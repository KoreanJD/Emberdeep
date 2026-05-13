import { manhattan } from './movement';
import { resolveRoomClear } from './progression';
import type { AttackResult, AttackRoll, DiceRoller, Entity, GameState } from './types';

export function resolveAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
  dice: DiceRoller,
): AttackResult {
  const attacker = state.entities[attackerId];
  const target = state.entities[targetId];

  if (!attacker || attacker.hp <= 0) {
    return reject(state, 'Attacker cannot act.');
  }

  if (!target || target.hp <= 0) {
    return reject(state, 'Target is not alive.');
  }

  if (attacker.ap <= 0 && attacker.team === 'heroes') {
    return reject(state, 'Not enough AP.');
  }

  if (manhattan(attacker.position, target.position) > attacker.basicAttack.range) {
    return reject(state, 'Target is out of range.');
  }

  const d20 = dice.d20();
  const bonus = attackBonus(attacker);
  const total = d20 + bonus;
  const outcome = attackOutcome(d20, total, target.defense);
  const roll: AttackRoll = {
    d20,
    bonus,
    total,
    targetDefense: target.defense,
    outcome,
  };
  let nextState = spendAp(state, attacker.id);

  if (outcome === 'miss' || outcome === 'fumble') {
    nextState = appendLog(nextState, {
      type: 'attack',
      message: `${attacker.name} ${attacker.basicAttack.name} ${target.name}. ${formatAttackCheck(roll)} ${target.name} HP: ${target.hp} -> ${target.hp}.`,
    });

    return { ok: true, state: nextState, roll };
  }

  const damage = rollDamage(attacker, outcome === 'critical', dice);
  const mitigated = applyShield(target, damage.total);
  const beforeHp = target.hp;
  const nextTarget = {
    ...mitigated.entity,
    hp: Math.max(0, beforeHp - mitigated.total),
  };
  const nextAttacker = {
    ...nextState.entities[attacker.id],
    statuses: nextState.entities[attacker.id].statuses.filter((status) => status.id !== 'blessed'),
  };

  nextState = {
    ...nextState,
    entities: {
      ...nextState.entities,
      [attacker.id]: nextAttacker,
      [target.id]: nextTarget,
    },
  };

  const criticalText = outcome === 'critical' ? ' Critical hit.' : '';
  const shieldText = mitigated.reduced > 0 ? ` Shield absorbs ${mitigated.reduced}.` : '';
  nextState = appendLog(nextState, {
    type: 'attack',
    message: `${attacker.name} ${attacker.basicAttack.name} ${target.name}. ${formatAttackCheck(roll)}${criticalText} Damage: ${damage.detail} = ${damage.total}.${shieldText} ${target.name} HP: ${beforeHp} -> ${nextTarget.hp}.`,
  });

  if (allEnemiesDefeated(nextState)) {
    nextState = resolveRoomClear(nextState);
  }

  return { ok: true, state: nextState, roll };
}

export function resolveEnemyAttack(
  state: GameState,
  attackerId: string,
  targetId: string,
  dice: DiceRoller,
): GameState {
  const result = resolveAttack(state, attackerId, targetId, dice);
  return result.state;
}

function attackBonus(entity: Entity): number {
  const blessBonus = entity.statuses.some((status) => status.id === 'blessed') ? 2 : 0;
  if (entity.basicAttack.attackStat) {
    return entity.stats[entity.basicAttack.attackStat] + blessBonus;
  }

  return (entity.basicAttack.attackBonus ?? 0) + blessBonus;
}

function attackOutcome(d20: number, total: number, defense: number): AttackRoll['outcome'] {
  if (d20 === 1) {
    return 'fumble';
  }

  if (d20 === 20) {
    return 'critical';
  }

  return total >= defense ? 'hit' : 'miss';
}

function rollDamage(entity: Entity, critical: boolean, dice: DiceRoller): { total: number; detail: string } {
  const diceCount = critical ? entity.basicAttack.damageDice * 2 : entity.basicAttack.damageDice;
  const rolls = Array.from({ length: diceCount }, () => dice.die(entity.basicAttack.damageDie));
  const statBonus = entity.basicAttack.damageBonusStat
    ? entity.stats[entity.basicAttack.damageBonusStat]
    : 0;
  const flatBonus = entity.basicAttack.damageBonus ?? 0;
  const bonus = statBonus + flatBonus;
  const total = rolls.reduce((sum, roll) => sum + roll, 0) + bonus;

  return {
    total,
    detail: `${diceCount}d${entity.basicAttack.damageDie} [${rolls.join(' + ')}]${bonus !== 0 ? ` + ${bonus}` : ''}`,
  };
}

function formatAttackCheck(roll: AttackRoll): string {
  const d20Text = roll.d20 === 1 ? 'natural 1' : roll.d20 === 20 ? 'natural 20' : `d20 ${roll.d20}`;
  const outcomeText = roll.outcome === 'critical' ? 'Hit' : roll.outcome[0].toUpperCase() + roll.outcome.slice(1);
  return `Attack: ${d20Text} + ${roll.bonus} = ${roll.total} vs DEF ${roll.targetDefense}. ${outcomeText}.`;
}

function spendAp(state: GameState, entityId: string): GameState {
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
        ap: Math.max(0, entity.ap - 1),
      },
    },
  };
}

function reject(state: GameState, reason: string): AttackResult {
  return { ok: false, state, reason };
}

function applyShield(entity: Entity, damage: number): { entity: Entity; total: number; reduced: number } {
  const shield = entity.statuses.find((status) => status.id === 'shielded');
  if (!shield) {
    return { entity, total: damage, reduced: 0 };
  }

  const reduced = Math.min(shield.value, damage);
  return {
    entity: {
      ...entity,
      statuses: entity.statuses.filter((status) => status.id !== 'shielded'),
    },
    total: damage - reduced,
    reduced,
  };
}

function allEnemiesDefeated(state: GameState): boolean {
  return Object.values(state.entities).every((entity) => entity.team !== 'enemies' || entity.hp <= 0);
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
