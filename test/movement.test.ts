import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter } from '../src/game/content/encounters';
import { endPlayerTurn, isVictory, moveEntity } from '../src/game/simulation/gameState';
import { getReachablePositions } from '../src/game/simulation/movement';
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

function adjacentEnemyState(): GameState {
  const state = createGoblinCaveEncounter();

  return {
    ...state,
    entities: {
      ...state.entities,
      goblin_1: {
        ...state.entities.goblin_1,
        position: { x: 2, y: 3 },
      },
      goblin_2: {
        ...state.entities.goblin_2,
        hp: 0,
      },
    },
  };
}

describe('grid movement', () => {
  test('reachable positions respect the hero move stat and walls', () => {
    const state = createGoblinCaveEncounter();
    const reachable = getReachablePositions(state, 'hero_warrior').map((position) => `${position.x},${position.y}`);

    expect(reachable).toContain('5,3');
    expect(reachable).not.toContain('6,3');
    expect(reachable).not.toContain('0,0');
  });

  test('moving to a reachable floor tile spends one AP', () => {
    const state = createGoblinCaveEncounter();
    const result = moveEntity(state, 'hero_warrior', { x: 4, y: 3 });

    expect(result.ok).toBe(true);
    expect(result.state.entities.hero_warrior.position).toEqual({ x: 4, y: 3 });
    expect(result.state.entities.hero_warrior.ap).toBe(1);
  });

  test('moving through blocked terrain is rejected without spending AP', () => {
    const state = createGoblinCaveEncounter();
    const result = moveEntity(state, 'hero_warrior', { x: 0, y: 0 });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('Destination is not reachable.');
    expect(result.state.entities.hero_warrior.ap).toBe(2);
  });
});

describe('turn flow', () => {
  test('ending the player turn lets adjacent enemies attack and refreshes hero AP', () => {
    const state = adjacentEnemyState();
    const result = endPlayerTurn(state, fixedDice([12], [3]));

    expect(result.entities.hero_warrior.hp).toBe(10);
    expect(result.entities.hero_warrior.ap).toBe(2);
    expect(result.phase).toBe('player');
    expect(result.log.some((entry) => entry.message.includes('Goblin Scout stabs Shield Warrior'))).toBe(true);
  });

  test('victory is true only when all enemies are defeated', () => {
    const state = adjacentEnemyState();

    expect(isVictory(state)).toBe(false);

    const defeated = {
      ...state,
      entities: {
        ...state.entities,
        goblin_1: { ...state.entities.goblin_1, hp: 0 },
      },
    };

    expect(isVictory(defeated)).toBe(true);
  });
});
