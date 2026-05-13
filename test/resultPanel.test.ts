import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter } from '../src/game/content/encounters';
import { renderResultPanel } from '../src/phaser/adapters/domBridge';
import type { GameState } from '../src/game/simulation/types';

describe('result panel', () => {
  test('renders a victory summary with room, round, rewards, and restart action', () => {
    const state: GameState = {
      ...createGoblinCaveEncounter('hero_warrior', 2),
      phase: 'victory',
      round: 7,
      selectedRewards: ['field_dressing', 'ember_edge'],
    };

    const html = renderResultPanel(state);

    expect(html).toContain('Dungeon Cleared');
    expect(html).toContain("Gorvak's Forge");
    expect(html).toContain('Round 7');
    expect(html).toContain('Field Dressing');
    expect(html).toContain('Ember Edge');
    expect(html).toContain('id="restart-run"');
  });

  test('renders a defeat summary with the last room and restart action', () => {
    const state: GameState = {
      ...createGoblinCaveEncounter('hero_warrior', 1),
      phase: 'defeat',
      round: 4,
    };

    const html = renderResultPanel(state);

    expect(html).toContain('Dungeon Failed');
    expect(html).toContain('Mushroom Gallery');
    expect(html).toContain('Round 4');
    expect(html).toContain('Try Again');
    expect(html).toContain('id="restart-run"');
  });
});
