import { resolveEnemyAttack } from './combat';
import { createGoblinCaveEncounter } from '../content/encounters';
import { findStepToward, getReachablePositions, isAdjacent, positionKey } from './movement';
import { manhattan } from './movement';
import { resolveRoomClear } from './progression';
import type { ActionResult, DiceRoller, Entity, GameState, Position } from './types';

export function moveEntity(state: GameState, entityId: string, destination: Position): ActionResult {
  const entity = state.entities[entityId];
  if (!entity || entity.hp <= 0) {
    return { ok: false, state, reason: 'Entity cannot move.' };
  }

  if (entity.ap <= 0) {
    return { ok: false, state, reason: 'Not enough AP.' };
  }

  const reachable = new Set(getReachablePositions(state, entityId).map(positionKey));
  if (!reachable.has(positionKey(destination))) {
    return { ok: false, state, reason: 'Destination is not reachable.' };
  }

  const moved: Entity = {
    ...entity,
    position: destination,
    ap: entity.team === 'heroes' ? Math.max(0, entity.ap - 1) : entity.ap,
  };

  return {
    ok: true,
    state: appendLog(
      {
        ...state,
        entities: {
          ...state.entities,
          [entityId]: moved,
        },
      },
      {
        type: 'movement',
        message: `${entity.name} moves to (${destination.x}, ${destination.y}).`,
      },
    ),
  };
}

export function endPlayerTurn(state: GameState, dice: DiceRoller): GameState {
  if (state.phase !== 'player') {
    return state;
  }

  if (isVictory(state)) {
    return resolveRoomClear(state);
  }

  let nextState = appendLog({ ...state, phase: 'enemy' }, {
    type: 'system',
    message: 'Enemy turn begins.',
  });
  nextState = applyEnemyTurnStartStatuses(nextState);

  if (isVictory(nextState)) {
    return resolveRoomClear(nextState);
  }

  for (const enemy of Object.values(nextState.entities).filter(
    (entity) => entity.team === 'enemies' && entity.hp > 0,
  )) {
    nextState = takeEnemyAction(nextState, enemy.id, dice);
    if (nextState.phase === 'defeat') {
      return nextState;
    }
  }

  if (isVictory(nextState)) {
    return resolveRoomClear(nextState);
  }

  return appendLog(refreshHeroes({ ...nextState, phase: 'player', round: nextState.round + 1 }), {
    type: 'system',
    message: `Round ${nextState.round + 1}. Player turn begins.`,
  });
}

export function isVictory(state: GameState): boolean {
  return Object.values(state.entities).every((entity) => entity.team !== 'enemies' || entity.hp <= 0);
}

export function isDefeat(state: GameState): boolean {
  return Object.values(state.entities).every((entity) => entity.team !== 'heroes' || entity.hp <= 0);
}

export function selectReward(state: GameState, rewardId: string): ActionResult {
  if (state.phase !== 'reward') {
    return { ok: false, state, reason: 'No reward is available.' };
  }

  const reward = state.rewardOptions.find((option) => option.id === rewardId);
  if (!reward) {
    return { ok: false, state, reason: 'Reward is not available.' };
  }

  const hero = applyRewardToHero(state.entities[state.activeHeroId], reward.id);
  const nextState = createGoblinCaveEncounter(
    state.activeHeroId,
    state.currentRoomIndex + 1,
    hero,
    [...state.selectedRewards, reward.id],
  );

  return {
    ok: true,
    state: appendLog(
      {
        ...nextState,
        log: state.log,
      },
      {
        type: 'system',
        message: `${reward.name} chosen. The party enters ${nextState.roomName}.`,
      },
    ),
  };
}

function applyRewardToHero(hero: Entity, rewardId: string): Entity {
  switch (rewardId) {
    case 'field_dressing':
      return {
        ...hero,
        hp: Math.min(hero.maxHp, hero.hp + 3),
      };
    case 'ember_edge':
      return {
        ...hero,
        basicAttack: {
          ...hero.basicAttack,
          damageBonus: (hero.basicAttack.damageBonus ?? 0) + 1,
        },
      };
    case 'tactical_focus':
      return {
        ...hero,
        statuses: [
          ...hero.statuses.filter((status) => status.id !== 'blessed'),
          { id: 'blessed', name: 'Blessed', value: 2 },
        ],
      };
    default:
      return hero;
  }
}

function takeEnemyAction(state: GameState, enemyId: string, dice: DiceRoller): GameState {
  const enemy = state.entities[enemyId];
  const hero = nearestLivingHero(state, enemy);

  if (!hero) {
    return appendLog({ ...state, phase: 'defeat' }, {
      type: 'system',
      message: 'Defeat. The party has fallen.',
    });
  }

  let nextState = state;
  const currentEnemy = nextState.entities[enemyId];
  const bossState = maybeUseBossAction(nextState, currentEnemy);
  if (bossState) {
    nextState = bossState;
  }
  const supportAction = maybeUseSupportAction(nextState, currentEnemy);
  if (supportAction) {
    return supportAction;
  }

  const activeEnemy = nextState.entities[enemyId];

  if (
    activeEnemy.ai === 'ranged' &&
    hero.hp > 0 &&
    manhattan(activeEnemy.position, hero.position) <= activeEnemy.basicAttack.range
  ) {
    nextState = resolveEnemyAttack(nextState, enemyId, hero.id, dice);
    return replaceEnemyAttackLog(nextState, hero.id, enemyId);
  }

  let movementSkipped = false;

  if (!isAdjacent(activeEnemy.position, hero.position)) {
    if (activeEnemy.statuses.some((status) => status.id === 'rooted')) {
      movementSkipped = true;
      nextState = appendLog(
        {
          ...nextState,
          entities: {
            ...nextState.entities,
            [enemyId]: {
              ...activeEnemy,
              statuses: activeEnemy.statuses.filter((status) => status.id !== 'rooted'),
            },
          },
        },
        {
          type: 'system',
          message: `${activeEnemy.name} is rooted and cannot move.`,
        },
      );
    }
    const step = movementSkipped ? null : findStepToward(nextState, enemyId, hero.position);
    if (step) {
      nextState = appendLog(
        {
          ...nextState,
          entities: {
            ...nextState.entities,
            [enemyId]: {
              ...nextState.entities[enemyId],
              position: step,
            },
          },
        },
        {
          type: 'movement',
          message: `${currentEnemy.name} skitters to (${step.x}, ${step.y}).`,
        },
      );
    }
  }

  const movedEnemy = nextState.entities[enemyId];
  const currentHero = nextState.entities[hero.id];
  if (movedEnemy.hp > 0 && currentHero.hp > 0 && isAdjacent(movedEnemy.position, currentHero.position)) {
    nextState = resolveEnemyAttack(nextState, enemyId, currentHero.id, dice);
    nextState = replaceEnemyAttackLog(nextState, currentHero.id, enemyId);
  }

  if (isDefeat(nextState)) {
    return appendLog({ ...nextState, phase: 'defeat' }, {
      type: 'system',
      message: 'Defeat. The party has fallen.',
    });
  }

  return nextState;
}

function maybeUseSupportAction(state: GameState, enemy: Entity): GameState | null {
  if (enemy.ai !== 'support') {
    return null;
  }

  const woundedAlly = Object.values(state.entities).find(
    (entity) => entity.team === 'enemies' && entity.hp > 0 && entity.hp < entity.maxHp,
  );
  if (!woundedAlly) {
    return null;
  }

  const healed = {
    ...woundedAlly,
    hp: Math.min(woundedAlly.maxHp, woundedAlly.hp + 3),
  };

  return appendLog(
    {
      ...state,
      entities: {
        ...state.entities,
        [woundedAlly.id]: healed,
      },
    },
    {
      type: 'system',
      message: `${enemy.name} mends ${woundedAlly.name} for 3.`,
    },
  );
}

function maybeUseBossAction(state: GameState, enemy: Entity): GameState | null {
  if (enemy.ai !== 'boss') {
    return null;
  }

  let nextState = state;
  let nextBoss = nextState.entities[enemy.id];

  if (nextBoss.hp <= Math.floor(nextBoss.maxHp / 2) && !nextBoss.statuses.some((status) => status.id === 'summoned')) {
    nextBoss = {
      ...nextBoss,
      statuses: [...nextBoss.statuses, { id: 'summoned', name: 'Summoned', value: 1 }],
    };
    nextState = appendLog(
      {
        ...nextState,
        entities: {
          ...nextState.entities,
          [enemy.id]: nextBoss,
          gorvak_scout_1: createBossScout('gorvak_scout_1', { x: 5, y: 2 }),
          gorvak_scout_2: createBossScout('gorvak_scout_2', { x: 7, y: 4 }),
        },
      },
      {
        type: 'system',
        message: 'Gorvak calls two scouts from the forge smoke.',
      },
    );
  }

  nextBoss = nextState.entities[enemy.id];
  if (nextBoss.hp <= 10 && !nextBoss.statuses.some((status) => status.id === 'enraged')) {
    nextBoss = {
      ...nextBoss,
      statuses: [...nextBoss.statuses, { id: 'enraged', name: 'Enraged', value: 2 }],
      basicAttack: {
        ...nextBoss.basicAttack,
        damageBonus: (nextBoss.basicAttack.damageBonus ?? 0) + 2,
      },
      defense: nextBoss.defense - 1,
    };
    nextState = appendLog(
      {
        ...nextState,
        entities: {
          ...nextState.entities,
          [enemy.id]: nextBoss,
        },
      },
      {
        type: 'system',
        message: 'Gorvak enters a rage.',
      },
    );
  }

  return nextState === state ? null : nextState;
}

function createBossScout(id: string, position: Position): Entity {
  return {
    id,
    name: 'Goblin Scout',
    team: 'enemies',
    hp: 5,
    maxHp: 5,
    defense: 12,
    move: 5,
    ap: 0,
    maxAp: 0,
    position,
    stats: {
      strength: 1,
      agility: 3,
      intellect: 0,
      will: 0,
    },
    basicAttack: {
      name: 'stabs',
      range: 1,
      attackBonus: 3,
      damageDice: 1,
      damageDie: 4,
      damageBonus: 1,
    },
    skills: [],
    statuses: [],
    ai: 'nearest_melee',
  };
}

function replaceEnemyAttackLog(state: GameState, heroId: string, enemyId: string): GameState {
  const afterAttackHero = state.entities[heroId];
  const afterAttackEnemy = state.entities[enemyId];
  return replaceLastLog(state, {
    type: 'attack',
    message: `${afterAttackEnemy.name} ${afterAttackEnemy.basicAttack.name} ${afterAttackHero.name}. ${state.log.at(-1)?.message ?? ''}`,
  });
}

function applyEnemyTurnStartStatuses(state: GameState): GameState {
  let nextState = state;

  for (const entity of Object.values(nextState.entities).filter(
    (candidate) => candidate.team === 'enemies' && candidate.hp > 0,
  )) {
    const burning = entity.statuses.find((status) => status.id === 'burning');
    if (!burning) {
      continue;
    }

    const nextHp = Math.max(0, entity.hp - burning.value);
    nextState = appendLog(
      {
        ...nextState,
        entities: {
          ...nextState.entities,
          [entity.id]: {
            ...entity,
            hp: nextHp,
            statuses: nextHp <= 0 ? [] : entity.statuses,
          },
        },
      },
      {
        type: 'system',
        message: `Burning scorches ${entity.name} for ${burning.value}.`,
      },
    );
  }

  return nextState;
}

function nearestLivingHero(state: GameState, enemy: Entity): Entity | null {
  const heroes = Object.values(state.entities).filter((entity) => entity.team === 'heroes' && entity.hp > 0);
  heroes.sort(
    (a, b) =>
      Math.abs(a.position.x - enemy.position.x) +
      Math.abs(a.position.y - enemy.position.y) -
      (Math.abs(b.position.x - enemy.position.x) + Math.abs(b.position.y - enemy.position.y)),
  );

  return heroes[0] ?? null;
}

function refreshHeroes(state: GameState): GameState {
  const entities = Object.fromEntries(
    Object.entries(state.entities).map(([id, entity]) => [
      id,
      entity.team === 'heroes' && entity.hp > 0 ? { ...entity, ap: entity.maxAp } : entity,
    ]),
  );

  return {
    ...state,
    entities,
  };
}

function appendLog(
  state: GameState,
  entry: Omit<GameState['log'][number], 'id'>,
): GameState {
  return {
    ...state,
    log: [
      ...state.log,
      {
        id: state.log.length + 1,
        ...entry,
      },
    ],
  };
}

function replaceLastLog(
  state: GameState,
  entry: Omit<GameState['log'][number], 'id'>,
): GameState {
  return {
    ...state,
    log: [
      ...state.log.slice(0, -1),
      {
        id: state.log.at(-1)?.id ?? state.log.length + 1,
        ...entry,
      },
    ],
  };
}
