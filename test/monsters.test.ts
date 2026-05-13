import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter, getMonsterDefinitions } from '../src/game/content/encounters';
import { endPlayerTurn } from '../src/game/simulation/gameState';
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

describe('monster roster', () => {
  test('defines the MVP goblin cave monster set', () => {
    const monsters = getMonsterDefinitions();

    expect(monsters.map((monster) => monster.id)).toEqual([
      'goblin_scout',
      'goblin_archer',
      'goblin_brawler',
      'goblin_shaman',
      'cave_bat',
    ]);
    expect(monsters.find((monster) => monster.id === 'goblin_archer')).toMatchObject({
      name: 'Goblin Archer',
      hp: 4,
      defense: 12,
      move: 4,
      ai: 'ranged',
      basicAttack: { range: 5, damageDice: 1, damageDie: 6 },
    });
    expect(monsters.find((monster) => monster.id === 'goblin_brawler')).toMatchObject({
      name: 'Goblin Brawler',
      hp: 9,
      defense: 13,
      ai: 'bruiser',
    });
    expect(monsters.find((monster) => monster.id === 'goblin_shaman')).toMatchObject({
      name: 'Goblin Shaman',
      hp: 6,
      defense: 11,
      ai: 'support',
    });
    expect(monsters.find((monster) => monster.id === 'cave_bat')).toMatchObject({
      name: 'Cave Bat',
      hp: 3,
      defense: 13,
      move: 6,
      ai: 'skirmisher',
    });
  });

  test('the second room uses varied monster types', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 1);
    const enemyNames = Object.values(state.entities)
      .filter((entity) => entity.team === 'enemies')
      .map((entity) => entity.name);

    expect(enemyNames).toEqual([
      'Goblin Brawler',
      'Goblin Archer',
      'Goblin Shaman',
      'Cave Bat',
    ]);
  });

  test('goblin archers attack from range instead of moving adjacent first', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 1);
    const archerOnly: GameState = {
      ...state,
      entities: {
        hero_warrior: {
          ...state.entities.hero_warrior,
          position: { x: 1, y: 3 },
        },
        goblin_archer_1: {
          ...state.entities.goblin_archer_1,
          position: { x: 5, y: 3 },
        },
      },
    };

    const result = endPlayerTurn(archerOnly, fixedDice([16], [4]));

    expect(result.entities.goblin_archer_1.position).toEqual({ x: 5, y: 3 });
    expect(result.entities.hero_warrior.hp).toBe(10);
    expect(result.log.some((entry) => entry.message.includes('Goblin Archer looses a shortbow'))).toBe(true);
  });

  test('goblin shamans heal wounded allies before attacking', () => {
    const state = createGoblinCaveEncounter('hero_warrior', 1);
    const supportOnly: GameState = {
      ...state,
      entities: {
        hero_warrior: state.entities.hero_warrior,
        goblin_shaman_1: {
          ...state.entities.goblin_shaman_1,
          position: { x: 6, y: 4 },
        },
        goblin_brawler_1: {
          ...state.entities.goblin_brawler_1,
          hp: 4,
          position: { x: 6, y: 3 },
        },
      },
    };

    const result = endPlayerTurn(supportOnly, fixedDice([1], []));

    expect(result.entities.goblin_brawler_1.hp).toBe(7);
    expect(result.log.some((entry) => entry.message.includes('Goblin Shaman mends Goblin Brawler'))).toBe(true);
  });
});
