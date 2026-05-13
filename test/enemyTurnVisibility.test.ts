import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter } from '../src/game/content/encounters';
import { endPlayerTurn } from '../src/game/simulation/gameState';
import { renderEnemyActionPanel } from '../src/phaser/adapters/domBridge';
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

describe('enemy turn visibility', () => {
  test('records the last enemy attack after enemy turn resolves', () => {
    const state: GameState = {
      ...createGoblinCaveEncounter(),
      entities: {
        ...createGoblinCaveEncounter().entities,
        goblin_1: {
          ...createGoblinCaveEncounter().entities.goblin_1,
          position: { x: 2, y: 3 },
        },
        goblin_2: {
          ...createGoblinCaveEncounter().entities.goblin_2,
          hp: 0,
        },
      },
    };

    const result = endPlayerTurn(state, fixedDice([12], [2]));

    expect(result.lastEnemyAction).toEqual({
      actorId: 'goblin_1',
      actorName: 'Goblin Scout',
      kind: 'attack',
      summary: 'Goblin Scout attacked Shield Warrior.',
    });
  });

  test('renders the latest enemy action for the HUD', () => {
    const state: GameState = {
      ...createGoblinCaveEncounter(),
      lastEnemyAction: {
        actorId: 'goblin_1',
        actorName: 'Goblin Scout',
        kind: 'move',
        summary: 'Goblin Scout moved toward Shield Warrior.',
      },
    };

    const html = renderEnemyActionPanel(state);

    expect(html).toContain('Enemy Action');
    expect(html).toContain('Goblin Scout');
    expect(html).toContain('moved toward Shield Warrior');
  });
});
