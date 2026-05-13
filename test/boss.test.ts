import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter, getDungeonRoomCount, getMonsterDefinitions } from '../src/game/content/encounters';
import { endPlayerTurn, selectReward } from '../src/game/simulation/gameState';
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

function clearedRewardState(roomIndex: number): GameState {
  const state = createGoblinCaveEncounter('hero_warrior', roomIndex);
  return {
    ...state,
    phase: 'reward',
    rewardOptions: [
      { id: 'field_dressing', name: 'Field Dressing', description: 'Restore 3 HP before entering the next room.' },
    ],
  };
}

describe('boss room', () => {
  test('the dungeon includes a third boss room with Gorvak', () => {
    const boss = getMonsterDefinitions().find((monster) => monster.id === 'gorvak');
    const state = createGoblinCaveEncounter('hero_warrior', 2);

    expect(getDungeonRoomCount()).toBe(3);
    expect(state.roomName).toBe("Gorvak's Forge");
    expect(boss).toMatchObject({
      name: 'Gorvak, Ember Goblin Chief',
      hp: 36,
      defense: 14,
      ai: 'boss',
    });
    expect(state.entities.gorvak).toMatchObject({
      name: 'Gorvak, Ember Goblin Chief',
      hp: 36,
    });
  });

  test('selecting a reward after room two advances into the boss room', () => {
    const result = selectReward(clearedRewardState(1), 'field_dressing');

    expect(result.ok).toBe(true);
    expect(result.state.currentRoomIndex).toBe(2);
    expect(result.state.roomName).toBe("Gorvak's Forge");
    expect(result.state.entities.gorvak.hp).toBe(36);
  });

  test('Gorvak summons scouts once when first bloodied', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 2);
    const bloodied = {
      ...state,
      entities: {
        ...state.entities,
        gorvak: {
          ...state.entities.gorvak,
          hp: 18,
          position: { x: 5, y: 3 },
        },
      },
    };

    const result = endPlayerTurn(bloodied, fixedDice([1], []));

    expect(result.entities.gorvak.statuses).toContainEqual({
      id: 'summoned',
      name: 'Summoned',
      value: 1,
    });
    expect(result.entities.gorvak_scout_1.name).toBe('Goblin Scout');
    expect(result.entities.gorvak_scout_2.name).toBe('Goblin Scout');
    expect(result.log.some((entry) => entry.message.includes('Gorvak calls two scouts'))).toBe(true);
  });

  test('Gorvak enrages at low HP and deals bonus damage', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 2);
    const enraged = {
      ...state,
      entities: {
        hero_warrior: {
          ...state.entities.hero_warrior,
          position: { x: 4, y: 3 },
        },
        gorvak: {
          ...state.entities.gorvak,
          hp: 10,
          position: { x: 5, y: 3 },
        },
      },
    };

    const result = endPlayerTurn(enraged, fixedDice([16], [5]));

    expect(result.entities.hero_warrior.hp).toBe(4);
    expect(result.entities.gorvak.statuses).toContainEqual({
      id: 'enraged',
      name: 'Enraged',
      value: 2,
    });
    expect(result.log.some((entry) => entry.message.includes('Gorvak enters a rage'))).toBe(true);
  });

  test('defeating Gorvak in the final room wins the dungeon', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 2);
    const adjacentBoss = {
      ...state,
      entities: {
        ...state.entities,
        gorvak: {
          ...state.entities.gorvak,
          hp: 1,
          position: { x: 2, y: 3 },
        },
      },
    };

    const result = resolveAttack(adjacentBoss, 'hero_warrior', 'gorvak', fixedDice([20], [8, 8]));

    expect(result.state.phase).toBe('victory');
    expect(result.state.log.at(-1)?.message).toContain('Victory');
  });
});
