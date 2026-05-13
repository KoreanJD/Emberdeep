export type Team = 'heroes' | 'enemies';

export type Phase = 'player' | 'enemy' | 'reward' | 'victory' | 'defeat';

export type AttackOutcome = 'hit' | 'miss' | 'critical' | 'fumble';

export type StatKey = 'strength' | 'agility' | 'intellect' | 'will';

export type SkillTargetKind = 'self' | 'ally' | 'enemy' | 'position';

export type MonsterAi = 'nearest_melee' | 'ranged' | 'bruiser' | 'support' | 'skirmisher';

export interface Position {
  x: number;
  y: number;
}

export interface Stats {
  strength: number;
  agility: number;
  intellect: number;
  will: number;
}

export interface AttackProfile {
  name: string;
  range: number;
  attackBonus?: number;
  attackStat?: StatKey;
  damageDice: number;
  damageDie: number;
  damageBonus?: number;
  damageBonusStat?: StatKey;
}

export interface SkillDefinition {
  id: string;
  name: string;
  cost: number;
  target: SkillTargetKind;
  range: number;
  description: string;
}

export interface StatusEffect {
  id: 'shielded' | 'rooted' | 'burning' | 'blessed';
  name: string;
  value: number;
}

export interface Entity {
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  defense: number;
  move: number;
  ap: number;
  maxAp: number;
  position: Position;
  stats: Stats;
  basicAttack: AttackProfile;
  skills: SkillDefinition[];
  statuses: StatusEffect[];
  ai?: MonsterAi;
}

export type HeroId = 'hero_warrior' | 'hero_archer' | 'hero_pyromancer' | 'hero_cleric';

export interface LogEntry {
  id: number;
  type: 'system' | 'movement' | 'attack';
  message: string;
}

export interface GameState {
  activeHeroId: HeroId;
  currentRoomIndex: number;
  roomName: string;
  rewardOptions: RewardOption[];
  selectedRewards: string[];
  width: number;
  height: number;
  tiles: string[];
  phase: Phase;
  round: number;
  entities: Record<string, Entity>;
  log: LogEntry[];
}

export interface DiceRoller {
  d20(): number;
  die(sides: number): number;
}

export interface AttackRoll {
  d20: number;
  bonus: number;
  total: number;
  targetDefense: number;
  outcome: AttackOutcome;
}

export interface ActionResult {
  ok: boolean;
  state: GameState;
  reason?: string;
}

export interface AttackResult extends ActionResult {
  roll?: AttackRoll;
}

export interface SkillTarget {
  targetId?: string;
  position?: Position;
}

export interface RewardOption {
  id: 'field_dressing' | 'ember_edge' | 'tactical_focus';
  name: string;
  description: string;
}
