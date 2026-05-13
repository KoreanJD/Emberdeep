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
    skills: [
      {
        id: 'shield_guard',
        name: 'Shield Guard',
        cost: 1,
        target: 'self',
        range: 0,
        description: 'Raise a shield and reduce the next incoming damage by 3.',
      },
      {
        id: 'push',
        name: 'Push',
        cost: 1,
        target: 'enemy',
        range: 1,
        description: 'Strike an adjacent enemy and shove it one tile away.',
      },
    ],
    statuses: [],
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
    skills: [
      {
        id: 'aimed_shot',
        name: 'Aimed Shot',
        cost: 1,
        target: 'enemy',
        range: 5,
        description: 'Take a careful shot with +2 to hit and higher weapon dice.',
      },
      {
        id: 'pinning_shot',
        name: 'Pinning Shot',
        cost: 1,
        target: 'enemy',
        range: 5,
        description: 'Damage an enemy and root it on a hit.',
      },
    ],
    statuses: [],
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
    skills: [
      {
        id: 'fire_bolt',
        name: 'Fire Bolt',
        cost: 1,
        target: 'enemy',
        range: 5,
        description: 'Hurl a burning bolt at one enemy.',
      },
      {
        id: 'fire_burst',
        name: 'Fire Burst',
        cost: 2,
        target: 'position',
        range: 5,
        description: 'Explode a 3x3 area for 2d6 fire damage.',
      },
    ],
    statuses: [],
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
    skills: [
      {
        id: 'heal',
        name: 'Heal',
        cost: 1,
        target: 'ally',
        range: 5,
        description: 'Restore 1d6 + will HP to an ally.',
      },
      {
        id: 'bless',
        name: 'Bless',
        cost: 1,
        target: 'ally',
        range: 5,
        description: 'Give an ally +2 on their next attack roll.',
      },
    ],
    statuses: [],
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
  skills: [],
  statuses: [],
});

const roomDefinitions = [
  {
    name: 'First Chamber',
    enemies: [
      { id: 'goblin_1', position: { x: 6, y: 3 } },
      { id: 'goblin_2', position: { x: 7, y: 4 } },
    ],
  },
  {
    name: 'Mushroom Gallery',
    enemies: [
      { id: 'goblin_1', position: { x: 6, y: 2 } },
      { id: 'goblin_2', position: { x: 7, y: 4 } },
      { id: 'goblin_3', position: { x: 5, y: 5 } },
    ],
  },
];

export function getHeroDefinitions(): Entity[] {
  return Object.values(heroDefinitions).map((hero) => structuredClone(hero));
}

export function getDungeonRoomCount(): number {
  return roomDefinitions.length;
}

export function createGoblinCaveEncounter(
  heroId: HeroId = 'hero_warrior',
  roomIndex = 0,
  heroOverride?: Entity,
  selectedRewards: string[] = [],
): GameState {
  const room = roomDefinitions[roomIndex] ?? roomDefinitions[0];
  const hero = heroOverride ? structuredClone(heroOverride) : structuredClone(heroDefinitions[heroId]);
  const readyHero = {
    ...hero,
    id: heroId,
    team: 'heroes' as const,
    position: { x: 1, y: 3 },
    ap: hero.maxAp,
  };

  return {
    activeHeroId: heroId,
    currentRoomIndex: roomIndex,
    roomName: room.name,
    rewardOptions: [],
    selectedRewards,
    width: 10,
    height: 8,
    tiles,
    phase: 'player',
    round: 1,
    entities: {
      [readyHero.id]: readyHero,
      ...Object.fromEntries(room.enemies.map((enemy) => [enemy.id, goblinScout(enemy.id, enemy.position)])),
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
