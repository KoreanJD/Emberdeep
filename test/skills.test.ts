import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter, getHeroDefinitions } from '../src/game/content/encounters';
import { resolveAttack } from '../src/game/simulation/combat';
import { endPlayerTurn } from '../src/game/simulation/gameState';
import { resolveSkill } from '../src/game/simulation/skills';
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

function placeGoblin(state: GameState, x: number, y: number): GameState {
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

describe('hero skills', () => {
  test('each MVP hero has two authored skills', () => {
    const skillsByHero = Object.fromEntries(
      getHeroDefinitions().map((hero) => [hero.id, hero.skills.map((skill) => skill.id)]),
    );

    expect(skillsByHero).toEqual({
      hero_warrior: ['shield_guard', 'push'],
      hero_archer: ['aimed_shot', 'pinning_shot'],
      hero_pyromancer: ['fire_bolt', 'fire_burst'],
      hero_cleric: ['heal', 'bless'],
    });
  });

  test('shield guard spends AP and reduces the next incoming damage', () => {
    const guarded = resolveSkill(
      createGoblinCaveEncounter('hero_warrior'),
      'hero_warrior',
      'shield_guard',
      {},
      fixedDice([], []),
    );

    expect(guarded.ok).toBe(true);
    expect(guarded.state.entities.hero_warrior.ap).toBe(1);
    expect(guarded.state.entities.hero_warrior.statuses).toContainEqual({
      id: 'shielded',
      name: 'Shielded',
      value: 3,
    });

    const attacked = resolveAttack(
      placeGoblin(guarded.state, 2, 3),
      'goblin_1',
      'hero_warrior',
      fixedDice([18], [4]),
    );

    expect(attacked.state.entities.hero_warrior.hp).toBe(12);
    expect(attacked.state.entities.hero_warrior.statuses).toEqual([]);
  });

  test('push damages an adjacent enemy and moves it one tile away when space is open', () => {
    const state = placeGoblin(createGoblinCaveEncounter('hero_warrior'), 2, 3);
    const result = resolveSkill(state, 'hero_warrior', 'push', { targetId: 'goblin_1' }, fixedDice([12], [2]));

    expect(result.ok).toBe(true);
    expect(result.state.entities.hero_warrior.ap).toBe(1);
    expect(result.state.entities.goblin_1.hp).toBe(0);
    expect(result.state.entities.goblin_1.position).toEqual({ x: 3, y: 3 });
    expect(result.state.log.at(-1)?.message).toContain('pushes Goblin Scout');
  });

  test('aimed shot uses range and adds a hit bonus', () => {
    const state = placeGoblin(createGoblinCaveEncounter('hero_archer'), 5, 3);
    const result = resolveSkill(state, 'hero_archer', 'aimed_shot', { targetId: 'goblin_1' }, fixedDice([6], [1]));

    expect(result.ok).toBe(true);
    expect(result.roll?.total).toBe(12);
    expect(result.state.entities.goblin_1.hp).toBe(0);
    expect(result.state.log.at(-1)?.message).toContain('Aimed Shot');
  });

  test('pinning shot damages and roots a target on hit', () => {
    const state = placeGoblin(createGoblinCaveEncounter('hero_archer'), 5, 3);
    const result = resolveSkill(state, 'hero_archer', 'pinning_shot', { targetId: 'goblin_1' }, fixedDice([8], [1]));

    expect(result.ok).toBe(true);
    expect(result.state.entities.goblin_1.hp).toBe(0);
    expect(result.state.entities.goblin_1.statuses).toContainEqual({
      id: 'rooted',
      name: 'Rooted',
      value: 1,
    });
  });

  test('fire bolt can burn a target and fire burst hits enemies in a 3x3 area', () => {
    const boltState = placeGoblin(createGoblinCaveEncounter('hero_pyromancer'), 5, 3);
    const bolt = resolveSkill(boltState, 'hero_pyromancer', 'fire_bolt', { targetId: 'goblin_1' }, fixedDice([8], [1]));

    expect(bolt.ok).toBe(true);
    expect(bolt.state.entities.goblin_1.hp).toBe(4);
    expect(bolt.state.entities.goblin_1.statuses).toContainEqual({
      id: 'burning',
      name: 'Burning',
      value: 2,
    });

    const burstState = {
      ...createGoblinCaveEncounter('hero_pyromancer'),
      entities: {
        ...createGoblinCaveEncounter('hero_pyromancer').entities,
        goblin_1: { ...createGoblinCaveEncounter('hero_pyromancer').entities.goblin_1, position: { x: 6, y: 3 } },
        goblin_2: { ...createGoblinCaveEncounter('hero_pyromancer').entities.goblin_2, position: { x: 7, y: 4 } },
      },
    };
    const burst = resolveSkill(
      burstState,
      'hero_pyromancer',
      'fire_burst',
      { position: { x: 6, y: 3 } },
      fixedDice([], [3, 2, 2, 1]),
    );

    expect(burst.ok).toBe(true);
    expect(burst.state.entities.hero_pyromancer.ap).toBe(0);
    expect(burst.state.entities.goblin_1.hp).toBe(0);
    expect(burst.state.entities.goblin_2.hp).toBe(2);
  });

  test('heal restores HP and bless boosts the next attack roll once', () => {
    const wounded = createGoblinCaveEncounter('hero_cleric');
    wounded.entities.hero_cleric.hp = 4;
    const healed = resolveSkill(wounded, 'hero_cleric', 'heal', { targetId: 'hero_cleric' }, fixedDice([], [3]));

    expect(healed.ok).toBe(true);
    expect(healed.state.entities.hero_cleric.hp).toBe(10);
    expect(healed.state.entities.hero_cleric.ap).toBe(1);

    const blessed = resolveSkill(
      createGoblinCaveEncounter('hero_cleric'),
      'hero_cleric',
      'bless',
      { targetId: 'hero_cleric' },
      fixedDice([], []),
    );
    blessed.state.entities.hero_cleric.ap = 1;
    const attack = resolveAttack(
      placeGoblin(blessed.state, 2, 3),
      'hero_cleric',
      'goblin_1',
      fixedDice([8], [1]),
    );

    expect(attack.roll?.total).toBe(12);
    expect(attack.state.entities.hero_cleric.statuses).toEqual([]);
  });

  test('burning damages enemies at the start of the enemy turn and can clear the room', () => {
    const state = placeGoblin(createGoblinCaveEncounter('hero_pyromancer'), 5, 3);
    const burned = resolveSkill(state, 'hero_pyromancer', 'fire_bolt', { targetId: 'goblin_1' }, fixedDice([8], [1]));
    const readyToBurn = {
      ...burned.state,
      entities: {
        ...burned.state.entities,
        goblin_1: {
          ...burned.state.entities.goblin_1,
          hp: 2,
        },
        goblin_2: {
          ...burned.state.entities.goblin_2,
          hp: 0,
        },
      },
    };

    const afterTurn = endPlayerTurn(readyToBurn, fixedDice([], []));

    expect(afterTurn.phase).toBe('reward');
    expect(afterTurn.entities.goblin_1.hp).toBe(0);
    expect(afterTurn.log.some((entry) => entry.message.includes('Burning scorches Goblin Scout for 2'))).toBe(true);
  });

  test('rooted enemies skip movement once and then lose rooted', () => {
    const state = placeGoblin(createGoblinCaveEncounter('hero_archer'), 5, 3);
    const rooted = resolveSkill(state, 'hero_archer', 'pinning_shot', { targetId: 'goblin_1' }, fixedDice([8], [1]));
    const readyToRoot = {
      ...rooted.state,
      entities: {
        ...rooted.state.entities,
        hero_archer: {
          ...rooted.state.entities.hero_archer,
          position: { x: 1, y: 3 },
        },
        goblin_1: {
          ...rooted.state.entities.goblin_1,
          hp: 5,
          position: { x: 5, y: 3 },
        },
        goblin_2: {
          ...rooted.state.entities.goblin_2,
          hp: 0,
        },
      },
    };

    const afterTurn = endPlayerTurn(readyToRoot, fixedDice([], []));

    expect(afterTurn.entities.goblin_1.position).toEqual({ x: 5, y: 3 });
    expect(afterTurn.entities.goblin_1.statuses.some((status) => status.id === 'rooted')).toBe(false);
    expect(afterTurn.log.some((entry) => entry.message.includes('Goblin Scout is rooted and cannot move'))).toBe(true);
  });
});
