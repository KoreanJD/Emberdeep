import { resolveEnemyAttack } from './combat';
import { findStepToward, getReachablePositions, isAdjacent, positionKey } from './movement';
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
    return appendLog({ ...state, phase: 'victory' }, {
      type: 'system',
      message: 'Victory! The goblins collapse and the first chamber is secure.',
    });
  }

  let nextState = appendLog({ ...state, phase: 'enemy' }, {
    type: 'system',
    message: 'Enemy turn begins.',
  });

  for (const enemy of Object.values(nextState.entities).filter(
    (entity) => entity.team === 'enemies' && entity.hp > 0,
  )) {
    nextState = takeEnemyAction(nextState, enemy.id, dice);
    if (nextState.phase === 'defeat') {
      return nextState;
    }
  }

  if (isVictory(nextState)) {
    return appendLog({ ...nextState, phase: 'victory' }, {
      type: 'system',
      message: 'Victory! The goblins collapse and the first chamber is secure.',
    });
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

  if (!isAdjacent(currentEnemy.position, hero.position)) {
    const step = findStepToward(nextState, enemyId, hero.position);
    if (step) {
      nextState = appendLog(
        {
          ...nextState,
          entities: {
            ...nextState.entities,
            [enemyId]: {
              ...currentEnemy,
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
    const afterAttackHero = nextState.entities[currentHero.id];
    const afterAttackEnemy = nextState.entities[enemyId];
    nextState = replaceLastLog(nextState, {
      type: 'attack',
      message: `${afterAttackEnemy.name} ${afterAttackEnemy.basicAttack.name} ${afterAttackHero.name}. ${nextState.log.at(-1)?.message ?? ''}`,
    });
  }

  if (isDefeat(nextState)) {
    return appendLog({ ...nextState, phase: 'defeat' }, {
      type: 'system',
      message: 'Defeat. The party has fallen.',
    });
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
