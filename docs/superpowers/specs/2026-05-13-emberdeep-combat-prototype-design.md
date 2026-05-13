# Emberdeep Combat Prototype Design

## Goal

Build the first playable Emberdeep web prototype: a single 10x8 cave combat room where one Shield Warrior fights two Goblin Scouts through grid movement, AP-based actions, d20 attack rolls, damage rolls, enemy AI, combat logs, and win/loss resolution.

## Scope

Included:
- Vite, TypeScript, Phaser, and DOM HUD.
- One playable hero: Shield Warrior.
- Two enemies: Goblin Scouts.
- Team-turn structure simplified to one player token plus enemy turn.
- Two action points per player turn.
- Movement, attack, end turn, dice log, HP display, AP display, and victory/defeat states.

Excluded:
- Online multiplayer.
- Lobby, invite links, hero selection, rewards, dungeon progression, boss fights, persistence, audio, and asset pipeline.

## Architecture

The simulation is the source of truth and lives outside Phaser. Phaser renders the grid, tokens, reachable cells, and selected entity state; it sends user intents into the simulation through a small bridge. The DOM HUD renders dense text and action controls so the Phaser canvas can stay focused on the playfield.

## Gameplay Rules

The player starts with 2 AP. Moving costs 1 AP and can move up to the hero's move value through floor tiles. Attacking costs 1 AP and resolves `d20 + strength >= target defense`. A hit rolls `1d8 + strength` damage. Natural 20 doubles weapon dice; natural 1 always misses.

After the player ends the turn, each living goblin acts once. A goblin attacks if adjacent; otherwise it moves toward the hero up to its move value and attacks if it becomes adjacent. Goblins roll `d20 + 3` against hero defense and deal `1d4 + 1` on hit.

## UI Direction

Use a dark cave board with readable warm accents, simple token silhouettes, and compact DOM panels. The first screen is the playable combat view, not a landing page. Persistent UI is limited to a top status strip, a right combat panel, bottom action buttons, and a log.

## Tests

Vitest covers deterministic combat and movement rules with injected dice. A browser smoke check verifies that the app renders the board and accepts basic interactions after the dev server starts.
