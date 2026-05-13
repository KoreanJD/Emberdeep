import Phaser from 'phaser';
import { createGoblinCaveEncounter, getHeroDefinitions } from '../../game/content/encounters';
import { resolveAttack } from '../../game/simulation/combat';
import { randomDice } from '../../game/simulation/dice';
import { endPlayerTurn, moveEntity } from '../../game/simulation/gameState';
import { getReachablePositions, isAdjacent, positionKey } from '../../game/simulation/movement';
import type { Entity, GameState, HeroId, Position } from '../../game/simulation/types';
import { type ActionMode, renderHud } from '../adapters/domBridge';

const tileSize = 64;
const boardOrigin = { x: 80, y: 58 };

export class BattleScene extends Phaser.Scene {
  private state!: GameState;
  private mode: ActionMode = 'move';
  private status = 'Move up to 4 tiles, then strike when adjacent. Each action costs 1 AP.';
  private selectedHeroId: HeroId = 'hero_warrior';
  private heroOptions = getHeroDefinitions();
  private board!: Phaser.GameObjects.Graphics;
  private labels: Phaser.GameObjects.Text[] = [];

  constructor() {
    super('BattleScene');
  }

  create(): void {
    this.state = createGoblinCaveEncounter(this.selectedHeroId);
    this.board = this.add.graphics();
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.handlePointer(pointer));
    this.render();
  }

  private handlePointer(pointer: Phaser.Input.Pointer): void {
    if (this.state.phase !== 'player') {
      return;
    }

    const tile = this.pointerToTile(pointer);
    if (!tile) {
      return;
    }

    if (this.mode === 'move') {
      const result = moveEntity(this.state, this.state.activeHeroId, tile);
      this.state = result.state;
      this.status = result.ok ? `${this.activeHero().name} advances through the Emberdeep dust.` : result.reason ?? 'Invalid move.';
      this.render();
      return;
    }

    const target = this.entityAt(tile, 'enemies');
    if (!target) {
      this.status = 'Choose an adjacent goblin to attack.';
      this.renderHud();
      return;
    }

    const result = resolveAttack(this.state, this.state.activeHeroId, target.id, randomDice);
    this.state = result.state;
    this.status = result.ok ? attackStatus(result.roll?.outcome) : result.reason ?? 'Invalid attack.';
    this.render();
  }

  private endTurn(): void {
    this.state = endPlayerTurn(this.state, randomDice);
    this.mode = 'move';
    this.status =
      this.state.phase === 'defeat'
        ? 'The goblins overrun the chamber.'
        : this.state.phase === 'victory'
          ? 'The first chamber is secure.'
          : 'Your turn. Spend 2 AP before the goblins close in.';
    this.render();
  }

  private reset(): void {
    this.state = createGoblinCaveEncounter(this.selectedHeroId);
    this.mode = 'move';
    this.status = 'Move up to 4 tiles, then strike when adjacent. Each action costs 1 AP.';
    this.render();
  }

  private render(): void {
    this.board.clear();
    this.labels.forEach((label) => label.destroy());
    this.labels = [];

    this.drawRoom();
    this.drawHints();
    Object.values(this.state.entities)
      .filter((entity) => entity.hp > 0)
      .forEach((entity) => this.drawEntity(entity));
    this.renderHud();
  }

  private renderHud(): void {
    const root = document.querySelector<HTMLElement>('#hud-root');
    if (!root) {
      return;
    }

    renderHud(root, this.state, {
      mode: this.mode,
      status: this.status,
      heroOptions: this.heroOptions,
      setMode: (mode) => {
        this.mode = mode;
        this.status =
          mode === 'move'
            ? 'Highlighted cells are reachable this turn.'
            : 'Attack requires adjacency in this prototype.';
        this.render();
      },
      selectHero: (heroId) => this.selectHero(heroId),
      endTurn: () => this.endTurn(),
      reset: () => this.reset(),
    });
  }

  private selectHero(heroId: HeroId): void {
    this.selectedHeroId = heroId;
    this.state = createGoblinCaveEncounter(heroId);
    this.mode = 'move';
    this.status = `${this.activeHero().name} enters the first chamber.`;
    this.render();
  }

  private drawRoom(): void {
    this.board.fillStyle(0x11130f, 1);
    this.board.fillRect(0, 0, this.scale.width, this.scale.height);

    for (let y = 0; y < this.state.height; y += 1) {
      for (let x = 0; x < this.state.width; x += 1) {
        const wall = this.state.tiles[y]?.[x] === '#';
        const px = boardOrigin.x + x * tileSize;
        const py = boardOrigin.y + y * tileSize;

        this.board.fillStyle(wall ? 0x272a20 : 0x333326, 1);
        this.board.fillRect(px, py, tileSize - 2, tileSize - 2);
        this.board.lineStyle(1, wall ? 0x5f543a : 0x524b39, 0.78);
        this.board.strokeRect(px, py, tileSize - 2, tileSize - 2);

        if (!wall && (x + y) % 3 === 0) {
          this.board.fillStyle(0x3d3727, 0.35);
          this.board.fillCircle(px + 16, py + 18, 3);
          this.board.fillCircle(px + 45, py + 42, 2);
        }
      }
    }
  }

  private drawHints(): void {
    const hero = this.activeHero();
    if (this.state.phase !== 'player' || hero.hp <= 0) {
      return;
    }

    if (this.mode === 'move') {
      const reachable = getReachablePositions(this.state, hero.id);
      reachable.forEach((position) => {
        const { x, y } = tileToPixels(position);
        this.board.fillStyle(0x8ea45f, 0.26);
        this.board.fillRect(x + 6, y + 6, tileSize - 14, tileSize - 14);
      });
      return;
    }

    Object.values(this.state.entities)
      .filter((entity) => entity.team === 'enemies' && entity.hp > 0 && isAdjacent(hero.position, entity.position))
      .forEach((entity) => {
        const { x, y } = tileToPixels(entity.position);
        this.board.lineStyle(4, 0xe56b31, 0.95);
        this.board.strokeRect(x + 5, y + 5, tileSize - 12, tileSize - 12);
      });
  }

  private drawEntity(entity: Entity): void {
    const { x, y } = tileToPixels(entity.position);
    const centerX = x + tileSize / 2;
    const centerY = y + tileSize / 2;
    const isHero = entity.team === 'heroes';
    const color = isHero ? 0xf0b857 : 0xd64b3c;
    const edge = isHero ? 0xf7efe1 : 0x2a1210;

    this.board.fillStyle(0x000000, 0.25);
    this.board.fillEllipse(centerX + 3, centerY + 8, 42, 18);
    this.board.fillStyle(color, 1);
    this.board.fillCircle(centerX, centerY, 21);
    this.board.lineStyle(3, edge, 0.9);
    this.board.strokeCircle(centerX, centerY, 21);

    const label = this.add
      .text(centerX, centerY - 7, isHero ? heroInitial(entity) : 'G', {
        color: isHero ? '#24170d' : '#fff4df',
        fontFamily: 'Arial, sans-serif',
        fontSize: '20px',
        fontStyle: '700',
      })
      .setOrigin(0.5);
    const hp = this.add
      .text(centerX, centerY + 27, `${entity.hp}/${entity.maxHp}`, {
        color: '#f7efe1',
        fontFamily: 'Arial, sans-serif',
        fontSize: '13px',
      })
      .setOrigin(0.5);

    this.labels.push(label, hp);
  }

  private pointerToTile(pointer: Phaser.Input.Pointer): Position | null {
    const x = Math.floor((pointer.x - boardOrigin.x) / tileSize);
    const y = Math.floor((pointer.y - boardOrigin.y) / tileSize);

    if (x < 0 || y < 0 || x >= this.state.width || y >= this.state.height) {
      return null;
    }

    return { x, y };
  }

  private entityAt(position: Position, team: Entity['team']): Entity | null {
    return (
      Object.values(this.state.entities).find(
        (entity) =>
          entity.team === team &&
          entity.hp > 0 &&
          positionKey(entity.position) === positionKey(position),
      ) ?? null
    );
  }

  private activeHero(): Entity {
    return this.state.entities[this.state.activeHeroId];
  }
}

function tileToPixels(position: Position): Position {
  return {
    x: boardOrigin.x + position.x * tileSize,
    y: boardOrigin.y + position.y * tileSize,
  };
}

function heroInitial(entity: Entity): string {
  switch (entity.id) {
    case 'hero_warrior':
      return 'W';
    case 'hero_archer':
      return 'R';
    case 'hero_pyromancer':
      return 'M';
    case 'hero_cleric':
      return 'C';
    default:
      return entity.name.slice(0, 1);
  }
}

function attackStatus(outcome?: string): string {
  switch (outcome) {
    case 'critical':
      return 'Critical hit. The chamber sparks with ember light.';
    case 'hit':
      return 'Hit. The goblin line falters.';
    case 'fumble':
      return 'Natural 1. The strike goes wide.';
    case 'miss':
      return 'Miss. The goblin slips away.';
    default:
      return 'Attack resolved.';
  }
}
