import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter } from '../src/game/content/encounters';
import { resolveAttack } from '../src/game/simulation/combat';
import type { DiceRoller, GameState } from '../src/game/simulation/types';

function fixedDice(d20: number[], damage: number[]): DiceRoller {
  return {
    d20: () => {
      const value = d20.shift();
      if (value === undefined) {
        throw new Error('missing d20 roll');
      }
      return value;
    },
    die: () => {
      const value = damage.shift();
      if (value === undefined) {
        throw new Error('missing damage roll');
      }
      return value;
    },
  };
}

function putAdjacent(state: GameState): GameState {
  return {
    ...state,
    entities: {
      ...state.entities,
      goblin_1: {
        ...state.entities.goblin_1,
        position: { x: 2, y: 3 },
      },
    },
  };
}

describe('combat resolution', () => {
  test('a normal hit spends AP and deals weapon damage plus strength', () => {
    const state = putAdjacent(createGoblinCaveEncounter());
    const result = resolveAttack(state, 'hero_warrior', 'goblin_1', fixedDice([12], [5]));

    expect(result.ok).toBe(true);
    expect(result.roll?.total).toBe(16);
    expect(result.roll?.outcome).toBe('hit');
    expect(result.state.entities.hero_warrior.ap).toBe(1);
    expect(result.state.entities.goblin_1.hp).toBe(0);
    expect(result.state.log.at(-1)?.message).toContain('Attack: d20 12 + 4 = 16 vs DEF 12. Hit.');
    expect(result.state.log.at(-1)?.message).toContain('Damage: 1d8 [5] + 4 = 9.');
    expect(result.state.log.at(-1)?.message).toContain('Goblin Scout HP: 5 -> 0.');
  });

  test('a natural 20 doubles weapon dice before adding strength', () => {
    const state = putAdjacent(createGoblinCaveEncounter());
    const result = resolveAttack(state, 'hero_warrior', 'goblin_1', fixedDice([20], [2, 3]));

    expect(result.ok).toBe(true);
    expect(result.roll?.outcome).toBe('critical');
    expect(result.state.entities.goblin_1.hp).toBe(0);
    expect(result.state.log.at(-1)?.message).toContain('Critical hit.');
    expect(result.state.log.at(-1)?.message).toContain('Damage: 2d8 [2 + 3] + 4 = 9.');
  });

  test('a natural 1 always misses but still spends AP', () => {
    const state = putAdjacent(createGoblinCaveEncounter());
    const result = resolveAttack(state, 'hero_warrior', 'goblin_1', fixedDice([1], []));

    expect(result.ok).toBe(true);
    expect(result.roll?.outcome).toBe('fumble');
    expect(result.state.entities.hero_warrior.ap).toBe(1);
    expect(result.state.entities.goblin_1.hp).toBe(5);
    expect(result.state.log.at(-1)?.message).toContain('Attack: natural 1 + 4 = 5 vs DEF 12. Fumble.');
    expect(result.state.log.at(-1)?.message).toContain('Goblin Scout HP: 5 -> 5.');
  });

  test('an attack outside melee range is rejected without spending AP', () => {
    const state = createGoblinCaveEncounter();
    const result = resolveAttack(state, 'hero_warrior', 'goblin_1', fixedDice([20], [8, 8]));

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Target is out of range.');
    expect(result.state.entities.hero_warrior.ap).toBe(2);
    expect(result.state.entities.goblin_1.hp).toBe(5);
  });
});
