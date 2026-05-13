import { describe, expect, test } from 'vitest';
import { createGoblinCaveEncounter } from '../src/game/content/encounters';
import { renderDungeonProgress } from '../src/phaser/adapters/domBridge';

describe('dungeon progress panel', () => {
  test('shows current room progress and the next room preview', () => {
    const html = renderDungeonProgress(createGoblinCaveEncounter('hero_warrior', 0));

    expect(html).toContain('Room 1/3');
    expect(html).toContain('First Chamber');
    expect(html).toContain('Next: Mushroom Gallery');
    expect(html).toContain('Combat');
  });

  test('warns the player when the current room is the boss room', () => {
    const html = renderDungeonProgress(createGoblinCaveEncounter('hero_warrior', 2));

    expect(html).toContain('Room 3/3');
    expect(html).toContain("Gorvak's Forge");
    expect(html).toContain('Boss Room');
    expect(html).toContain('Final encounter');
  });
});
