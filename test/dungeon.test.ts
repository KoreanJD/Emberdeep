import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter } from '../src/game/content/encounters';
import { selectReward } from '../src/game/simulation/gameState';
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

function oneGoblinAdjacent(state: GameState): GameState {
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

describe('dungeon progression', () => {
  test('clearing the first combat room opens reward selection instead of ending the dungeon', () => {
    const state = oneGoblinAdjacent(createGoblinCaveEncounter());
    const result = resolveAttack(state, 'hero_warrior', 'goblin_1', fixedDice([20], [8, 8]));

    expect(result.state.phase).toBe('reward');
    expect(result.state.currentRoomIndex).toBe(0);
    expect(result.state.rewardOptions.map((reward) => reward.id)).toEqual([
      'field_dressing',
      'ember_edge',
      'tactical_focus',
    ]);
    expect(result.state.log.at(-1)?.message).toContain('Choose one reward');
  });

  test('selecting a reward advances to the next room and applies the reward', () => {
    const state = oneGoblinAdjacent(createGoblinCaveEncounter());
    state.entities.hero_warrior.hp = 9;
    const cleared = resolveAttack(state, 'hero_warrior', 'goblin_1', fixedDice([20], [8, 8])).state;

    const result = selectReward(cleared, 'field_dressing');

    expect(result.ok).toBe(true);
    expect(result.state.phase).toBe('player');
    expect(result.state.currentRoomIndex).toBe(1);
    expect(result.state.roomName).toBe('Mushroom Gallery');
    expect(result.state.entities.hero_warrior.hp).toBe(12);
    expect(result.state.entities.hero_warrior.ap).toBe(2);
    expect(Object.values(result.state.entities).filter((entity) => entity.team === 'enemies' && entity.hp > 0)).toHaveLength(4);
  });

  test('clearing room two opens the boss room reward step', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 1);
    const finalRoom = {
      ...state,
      entities: {
        ...state.entities,
        goblin_brawler_1: {
          ...state.entities.goblin_brawler_1,
          position: { x: 2, y: 3 },
        },
        goblin_archer_1: {
          ...state.entities.goblin_archer_1,
          hp: 0,
        },
        goblin_shaman_1: {
          ...state.entities.goblin_shaman_1,
          hp: 0,
        },
        cave_bat_1: {
          ...state.entities.cave_bat_1,
          hp: 0,
        },
      },
    };

    const result = resolveAttack(finalRoom, 'hero_warrior', 'goblin_brawler_1', fixedDice([20], [8, 8]));

    expect(result.state.phase).toBe('reward');
    expect(result.state.log.at(-1)?.message).toContain('Choose one reward');
  });
});
