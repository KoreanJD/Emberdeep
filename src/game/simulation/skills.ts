import { isWalkable, manhattan } from './movement';
import type {
  AttackResult,
  AttackRoll,
  DiceRoller,
  Entity,
  GameState,
  Position,
  SkillDefinition,
  SkillTarget,
  StatusEffect,
} from './types';

export function resolveSkill(
  state: GameState,
  actorId: string,
  skillId: string,
  target: SkillTarget,
  dice: DiceRoller,
): AttackResult {
  const actor = state.entities[actorId];
  if (!actor || actor.hp <= 0) {
    return reject(state, 'Actor cannot use skills.');
  }

  const skill = actor.skills.find((candidate) => candidate.id === skillId);
  if (!skill) {
    return reject(state, 'Skill is not available.');
  }

  if (actor.ap < skill.cost) {
    return reject(state, 'Not enough AP.');
  }

  switch (skill.id) {
    case 'shield_guard':
      return applySelfStatus(state, actor, skill, { id: 'shielded', name: 'Shielded', value: 3 });
    case 'push':
      return resolveDamagingSkill(state, actor, skill, target, dice, {
        attackBonus: actor.stats.strength,
        damageDice: 1,
        damageDie: 4,
        damageBonus: actor.stats.strength,
        logVerb: 'pushes',
        push: true,
      });
    case 'aimed_shot':
      return resolveDamagingSkill(state, actor, skill, target, dice, {
        attackBonus: actor.stats.agility + 2,
        damageDice: 1,
        damageDie: 8,
        damageBonus: actor.stats.agility,
        logVerb: 'uses Aimed Shot on',
      });
    case 'pinning_shot':
      return resolveDamagingSkill(state, actor, skill, target, dice, {
        attackBonus: actor.stats.agility,
        damageDice: 1,
        damageDie: 4,
        damageBonus: actor.stats.agility,
        logVerb: 'uses Pinning Shot on',
        status: { id: 'rooted', name: 'Rooted', value: 1 },
      });
    case 'fire_bolt':
      return resolveDamagingSkill(state, actor, skill, target, dice, {
        attackBonus: actor.stats.intellect,
        damageDice: 1,
        damageDie: 8,
        damageBonus: actor.stats.intellect,
        logVerb: 'casts Fire Bolt at',
        status: { id: 'burning', name: 'Burning', value: 2 },
      });
    case 'fire_burst':
      return resolveFireBurst(state, actor, skill, target, dice);
    case 'heal':
      return resolveHeal(state, actor, skill, target, dice);
    case 'bless':
      return resolveBless(state, actor, skill, target);
    default:
      return reject(state, 'Skill is not implemented.');
  }
}

interface DamagingSkillOptions {
  attackBonus: number;
  damageDice: number;
  damageDie: number;
  damageBonus: number;
  logVerb: string;
  status?: StatusEffect;
  push?: boolean;
}

function resolveDamagingSkill(
  state: GameState,
  actor: Entity,
  skill: SkillDefinition,
  target: SkillTarget,
  dice: DiceRoller,
  options: DamagingSkillOptions,
): AttackResult {
  const targetEntity = getTargetEntity(state, target.targetId);
  if (!targetEntity || targetEntity.team === actor.team || targetEntity.hp <= 0) {
    return reject(state, 'Choose a living enemy target.');
  }

  if (manhattan(actor.position, targetEntity.position) > skill.range) {
    return reject(state, 'Target is out of range.');
  }

  const d20 = dice.d20();
  const total = d20 + options.attackBonus;
  const outcome = d20 === 1 ? 'fumble' : d20 === 20 || total >= targetEntity.defense ? 'hit' : 'miss';
  const roll: AttackRoll = {
    d20,
    bonus: options.attackBonus,
    total,
    targetDefense: targetEntity.defense,
    outcome: d20 === 20 ? 'critical' : outcome,
  };
  let nextState = spendAp(state, actor.id, skill.cost);

  if (outcome === 'miss' || outcome === 'fumble') {
    return {
      ok: true,
      roll,
      state: appendLog(nextState, {
        type: 'attack',
        message: `${actor.name} ${options.logVerb} ${targetEntity.name}: d20 ${d20} + ${options.attackBonus} = ${total} vs ${targetEntity.defense}. Miss.`,
      }),
    };
  }

  const damage = rollDamage(options.damageDice * (d20 === 20 ? 2 : 1), options.damageDie, options.damageBonus, dice);
  const pushedPosition = options.push ? pushedTile(state, actor.position, targetEntity.position) : null;
  const nextTarget = {
    ...targetEntity,
    hp: Math.max(0, targetEntity.hp - damage.total),
    position: pushedPosition ?? targetEntity.position,
    statuses: options.status ? upsertStatus(targetEntity.statuses, options.status) : targetEntity.statuses,
  };

  nextState = {
    ...nextState,
    entities: {
      ...nextState.entities,
      [targetEntity.id]: nextTarget,
    },
  };

  nextState = appendLog(nextState, {
    type: 'attack',
    message: `${actor.name} ${options.logVerb} ${targetEntity.name}: d20 ${d20} + ${options.attackBonus} = ${total} vs ${targetEntity.defense}. Damage ${damage.detail} = ${damage.total}.`,
  });

  return { ok: true, roll, state: withVictory(nextState) };
}

function resolveFireBurst(
  state: GameState,
  actor: Entity,
  skill: SkillDefinition,
  target: SkillTarget,
  dice: DiceRoller,
): AttackResult {
  if (!target.position) {
    return reject(state, 'Choose a target tile.');
  }

  if (manhattan(actor.position, target.position) > skill.range) {
    return reject(state, 'Target tile is out of range.');
  }

  let nextState = spendAp(state, actor.id, skill.cost);
  const entities = { ...nextState.entities };
  const hits: string[] = [];

  for (const entity of Object.values(entities)) {
    if (entity.team !== 'enemies' || entity.hp <= 0 || !isInBurst(entity.position, target.position)) {
      continue;
    }

    const damage = rollDamage(2, 6, 0, dice);
    entities[entity.id] = {
      ...entity,
      hp: Math.max(0, entity.hp - damage.total),
    };
    hits.push(`${entity.name} takes ${damage.total}`);
  }

  nextState = appendLog(
    {
      ...nextState,
      entities,
    },
    {
      type: 'attack',
      message: `${actor.name} casts Fire Burst. ${hits.length > 0 ? hits.join(', ') : 'No enemies are caught.'}`,
    },
  );

  return { ok: true, state: withVictory(nextState) };
}

function resolveHeal(
  state: GameState,
  actor: Entity,
  skill: SkillDefinition,
  target: SkillTarget,
  dice: DiceRoller,
): AttackResult {
  const targetEntity = getTargetEntity(state, target.targetId);
  if (!targetEntity || targetEntity.team !== actor.team || targetEntity.hp <= 0) {
    return reject(state, 'Choose a living ally target.');
  }

  if (manhattan(actor.position, targetEntity.position) > skill.range) {
    return reject(state, 'Target is out of range.');
  }

  const amount = dice.die(6) + actor.stats.will;
  const spentState = spendAp(state, actor.id, skill.cost);
  const currentTarget = spentState.entities[targetEntity.id];
  const healed = {
    ...currentTarget,
    hp: Math.min(currentTarget.maxHp, currentTarget.hp + amount),
  };
  const nextState = appendLog(
    {
      ...spentState,
      entities: {
        ...spentState.entities,
        [targetEntity.id]: healed,
      },
    },
    {
      type: 'system',
      message: `${actor.name} heals ${targetEntity.name} for ${amount}.`,
    },
  );

  return { ok: true, state: nextState };
}

function resolveBless(state: GameState, actor: Entity, skill: SkillDefinition, target: SkillTarget): AttackResult {
  const targetEntity = getTargetEntity(state, target.targetId);
  if (!targetEntity || targetEntity.team !== actor.team || targetEntity.hp <= 0) {
    return reject(state, 'Choose a living ally target.');
  }

  if (manhattan(actor.position, targetEntity.position) > skill.range) {
    return reject(state, 'Target is out of range.');
  }

  let nextState = spendAp(state, actor.id, skill.cost);
  const blessed = {
    ...nextState.entities[targetEntity.id],
    statuses: upsertStatus(nextState.entities[targetEntity.id].statuses, {
      id: 'blessed',
      name: 'Blessed',
      value: 2,
    }),
  };
  nextState = appendLog(
    {
      ...nextState,
      entities: {
        ...nextState.entities,
        [targetEntity.id]: blessed,
      },
    },
    {
      type: 'system',
      message: `${actor.name} blesses ${targetEntity.name}.`,
    },
  );

  return { ok: true, state: nextState };
}

function applySelfStatus(
  state: GameState,
  actor: Entity,
  skill: SkillDefinition,
  status: StatusEffect,
): AttackResult {
  const nextActor = {
    ...actor,
    ap: Math.max(0, actor.ap - skill.cost),
    statuses: upsertStatus(actor.statuses, status),
  };

  return {
    ok: true,
    state: appendLog(
      {
        ...state,
        entities: {
          ...state.entities,
          [actor.id]: nextActor,
        },
      },
      {
        type: 'system',
        message: `${actor.name} uses ${skill.name}.`,
      },
    ),
  };
}

function spendAp(state: GameState, entityId: string, cost: number): GameState {
  const entity = state.entities[entityId];
  if (entity.team !== 'heroes') {
    return state;
  }

  return {
    ...state,
    entities: {
      ...state.entities,
      [entityId]: {
        ...entity,
        ap: Math.max(0, entity.ap - cost),
      },
    },
  };
}

function rollDamage(
  diceCount: number,
  damageDie: number,
  damageBonus: number,
  dice: DiceRoller,
): { total: number; detail: string } {
  const rolls = Array.from({ length: diceCount }, () => dice.die(damageDie));
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + damageBonus;
  const detailParts = [...rolls.map(String)];

  if (damageBonus !== 0) {
    detailParts.push(String(damageBonus));
  }

  return {
    total,
    detail: detailParts.join(' + '),
  };
}

function pushedTile(state: GameState, actorPosition: Position, targetPosition: Position): Position | null {
  const direction = {
    x: Math.sign(targetPosition.x - actorPosition.x),
    y: Math.sign(targetPosition.y - actorPosition.y),
  };
  const next = {
    x: targetPosition.x + direction.x,
    y: targetPosition.y + direction.y,
  };

  return isWalkable(state, next) ? next : null;
}

function isInBurst(position: Position, center: Position): boolean {
  return Math.abs(position.x - center.x) <= 1 && Math.abs(position.y - center.y) <= 1;
}

function upsertStatus(statuses: StatusEffect[], status: StatusEffect): StatusEffect[] {
  return [...statuses.filter((candidate) => candidate.id !== status.id), status];
}

function getTargetEntity(state: GameState, targetId?: string): Entity | null {
  return targetId ? state.entities[targetId] ?? null : null;
}

function withVictory(state: GameState): GameState {
  if (!Object.values(state.entities).every((entity) => entity.team !== 'enemies' || entity.hp <= 0)) {
    return state;
  }

  return appendLog(
    {
      ...state,
      phase: 'victory',
    },
    {
      type: 'system',
      message: 'Victory! The goblins collapse and the first chamber is secure.',
    },
  );
}

function reject(state: GameState, reason: string): AttackResult {
  return { ok: false, state, reason };
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
