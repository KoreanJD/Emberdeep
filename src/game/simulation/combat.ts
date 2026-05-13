import { manhattan } from './movement';
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
      message:
        outcome === 'fumble'
          ? `${attacker.name} rolls a natural 1 and misses ${target.name}.`
          : `${attacker.name} ${attacker.basicAttack.name} at ${target.name}: d20 ${d20} + ${bonus} = ${total} vs ${target.defense}. Miss.`,
    });

    return { ok: true, state: nextState, roll };
  }

  const damage = rollDamage(attacker, outcome === 'critical', dice);
  const nextTarget = {
    ...target,
    hp: Math.max(0, target.hp - damage.total),
  };

  nextState = {
    ...nextState,
    entities: {
      ...nextState.entities,
      [target.id]: nextTarget,
    },
  };

  const criticalText = outcome === 'critical' ? ' Critical!' : '';
  nextState = appendLog(nextState, {
    type: 'attack',
    message: `${attacker.name} ${attacker.basicAttack.name} ${target.name}: d20 ${d20} + ${bonus} = ${total} vs ${target.defense}.${criticalText} Damage ${damage.detail} = ${damage.total}.`,
  });

  if (allEnemiesDefeated(nextState)) {
    nextState = appendLog({ ...nextState, phase: 'victory' }, {
      type: 'system',
      message: 'Victory! The goblins collapse and the first chamber is secure.',
    });
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
  if (entity.basicAttack.attackStat) {
    return entity.stats[entity.basicAttack.attackStat];
  }

  return entity.basicAttack.attackBonus ?? 0;
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
  const detailParts = [...rolls.map(String)];

  if (bonus !== 0) {
    detailParts.push(String(bonus));
  }

  return {
    total,
    detail: detailParts.join(' + '),
  };
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
