import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter, getHeroDefinitions } from '../src/game/content/encounters';
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

function placeGoblinForHero(state: GameState, x: number, y: number): GameState {
  return {
    ...state,
    entities: {
      ...state.entities,
      goblin_1: {
        ...state.entities.goblin_1,
        position: { x, y },
      },
    },
  };
}

describe('hero roster', () => {
  test('defines the four MVP hero classes with distinct combat stats', () => {
    const heroes = getHeroDefinitions();

    expect(heroes.map((hero) => hero.id)).toEqual([
      'hero_warrior',
      'hero_archer',
      'hero_pyromancer',
      'hero_cleric',
    ]);
    expect(heroes.find((hero) => hero.id === 'hero_warrior')).toMatchObject({
      name: 'Shield Warrior',
      hp: 14,
      defense: 14,
      move: 4,
      stats: { strength: 4, agility: 1, intellect: 0, will: 2 },
    });
    expect(heroes.find((hero) => hero.id === 'hero_archer')).toMatchObject({
      name: 'Ember Ranger',
      hp: 9,
      defense: 13,
      move: 5,
      stats: { strength: 1, agility: 4, intellect: 1, will: 1 },
    });
    expect(heroes.find((hero) => hero.id === 'hero_pyromancer')).toMatchObject({
      name: 'Cinder Mage',
      hp: 8,
      defense: 12,
      move: 4,
      stats: { strength: 0, agility: 2, intellect: 4, will: 2 },
    });
    expect(heroes.find((hero) => hero.id === 'hero_cleric')).toMatchObject({
      name: 'Ashen Cleric',
      hp: 10,
      defense: 13,
      move: 4,
      stats: { strength: 2, agility: 0, intellect: 1, will: 4 },
    });
  });

  test('creating an encounter with a hero id makes that hero the active player token', () => {
    const state = createGoblinCaveEncounter('hero_archer');
    const activeHero = state.entities[state.activeHeroId];

    expect(state.activeHeroId).toBe('hero_archer');
    expect(activeHero.name).toBe('Ember Ranger');
    expect(activeHero.position).toEqual({ x: 1, y: 3 });
    expect(Object.values(state.entities).filter((entity) => entity.team === 'heroes')).toHaveLength(1);
  });

  test('ranged heroes can attack from their authored range and use their primary stat', () => {
    const state = placeGoblinForHero(createGoblinCaveEncounter('hero_archer'), 5, 3);
    const result = resolveAttack(state, state.activeHeroId, 'goblin_1', fixedDice([8], [2]));

    expect(result.ok).toBe(true);
    expect(result.roll?.total).toBe(12);
    expect(result.state.entities.goblin_1.hp).toBe(0);
    expect(result.state.log.at(-1)?.message).toContain('d20 8 + 4 = 12');
  });

  test('pyromancer attacks use intellect while cleric melee attacks use strength', () => {
    const pyromancerState = placeGoblinForHero(createGoblinCaveEncounter('hero_pyromancer'), 5, 3);
    const pyromancerResult = resolveAttack(
      pyromancerState,
      pyromancerState.activeHeroId,
      'goblin_1',
      fixedDice([8], [1]),
    );

    expect(pyromancerResult.roll?.total).toBe(12);
    expect(pyromancerResult.state.entities.goblin_1.hp).toBe(0);

    const clericState = placeGoblinForHero(createGoblinCaveEncounter('hero_cleric'), 2, 3);
    const clericResult = resolveAttack(
      clericState,
      clericState.activeHeroId,
      'goblin_1',
      fixedDice([10], [3]),
    );

    expect(clericResult.roll?.total).toBe(12);
    expect(clericResult.state.entities.goblin_1.hp).toBe(0);
  });
});
