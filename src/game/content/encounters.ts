import type { Entity, GameState, HeroId } from '../simulation/types';

const tiles = [
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '#........#',
  '##########',
];

const heroDefinitions: Record<HeroId, Entity> = {
  hero_warrior: {
    id: 'hero_warrior',
    name: 'Shield Warrior',
    team: 'heroes',
    hp: 14,
    maxHp: 14,
    defense: 14,
    move: 4,
    ap: 2,
    maxAp: 2,
    position: { x: 1, y: 3 },
    stats: {
      strength: 4,
      agility: 1,
      intellect: 0,
      will: 2,
    },
    basicAttack: {
      name: 'slashes',
      range: 1,
      attackStat: 'strength',
      damageDice: 1,
      damageDie: 8,
      damageBonusStat: 'strength',
    },
  },
  hero_archer: {
    id: 'hero_archer',
    name: 'Ember Ranger',
    team: 'heroes',
    hp: 9,
    maxHp: 9,
    defense: 13,
    move: 5,
    ap: 2,
    maxAp: 2,
    position: { x: 1, y: 3 },
    stats: {
      strength: 1,
      agility: 4,
      intellect: 1,
      will: 1,
    },
    basicAttack: {
      name: 'looses an arrow at',
      range: 5,
      attackStat: 'agility',
      damageDice: 1,
      damageDie: 6,
      damageBonusStat: 'agility',
    },
  },
  hero_pyromancer: {
    id: 'hero_pyromancer',
    name: 'Cinder Mage',
    team: 'heroes',
    hp: 8,
    maxHp: 8,
    defense: 12,
    move: 4,
    ap: 2,
    maxAp: 2,
    position: { x: 1, y: 3 },
    stats: {
      strength: 0,
      agility: 2,
      intellect: 4,
      will: 2,
    },
    basicAttack: {
      name: 'hurls fire at',
      range: 5,
      attackStat: 'intellect',
      damageDice: 1,
      damageDie: 6,
      damageBonusStat: 'intellect',
    },
  },
  hero_cleric: {
    id: 'hero_cleric',
    name: 'Ashen Cleric',
    team: 'heroes',
    hp: 10,
    maxHp: 10,
    defense: 13,
    move: 4,
    ap: 2,
    maxAp: 2,
    position: { x: 1, y: 3 },
    stats: {
      strength: 2,
      agility: 0,
      intellect: 1,
      will: 4,
    },
    basicAttack: {
      name: 'swings a mace at',
      range: 1,
      attackStat: 'strength',
      damageDice: 1,
      damageDie: 6,
      damageBonusStat: 'strength',
    },
  },
};

const goblinScout = (id: string, position: { x: number; y: number }): Entity => ({
  id,
  name: 'Goblin Scout',
  team: 'enemies',
  hp: 5,
  maxHp: 5,
  defense: 12,
  move: 5,
  ap: 0,
  maxAp: 0,
  position,
  stats: {
    strength: 1,
    agility: 3,
    intellect: 0,
    will: 0,
  },
  basicAttack: {
    name: 'stabs',
    range: 1,
    attackBonus: 3,
    damageDice: 1,
    damageDie: 4,
    damageBonus: 1,
  },
});

export function getHeroDefinitions(): Entity[] {
  return Object.values(heroDefinitions).map((hero) => structuredClone(hero));
}

export function createGoblinCaveEncounter(heroId: HeroId = 'hero_warrior'): GameState {
  const hero = structuredClone(heroDefinitions[heroId]);

  return {
    activeHeroId: heroId,
    width: 10,
    height: 8,
    tiles,
    phase: 'player',
    round: 1,
    entities: {
      [hero.id]: hero,
      goblin_1: goblinScout('goblin_1', { x: 6, y: 3 }),
      goblin_2: goblinScout('goblin_2', { x: 7, y: 4 }),
    },
    log: [
      {
        id: 1,
        type: 'system',
        message: 'The cave air glows red. Two Goblin Scouts rush from the dark.',
      },
    ],
  };
}
