# Emberdeep Combat Prototype Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a playable Emberdeep v0.1 combat room with grid movement, AP actions, dice combat, enemy AI, HUD, and win/loss states.

**Architecture:** Keep combat state and rules in TypeScript simulation modules outside Phaser. Phaser owns only canvas rendering and pointer input. DOM owns text-heavy HUD, controls, and combat log.

**Tech Stack:** Vite, TypeScript, Phaser, Vitest, DOM/CSS.

---

### Task 1: Project Shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `src/main.ts`
- Create: `src/styles.css`

- [ ] Create the Vite TypeScript shell and install dependencies.
- [ ] Add scripts for `dev`, `build`, `test`, and `test:run`.
- [ ] Render an app root and load the Phaser scene from `src/main.ts`.

### Task 2: Simulation Tests

**Files:**
- Create: `test/combat.test.ts`
- Create: `test/movement.test.ts`

- [ ] Write failing tests for d20 hit/miss/critical/fumble behavior.
- [ ] Write failing tests for AP spending, movement range, blocked tiles, and enemy turn behavior.
- [ ] Run `npm test -- --run` and verify the tests fail because the simulation modules do not exist yet.

### Task 3: Simulation Implementation

**Files:**
- Create: `src/game/simulation/types.ts`
- Create: `src/game/simulation/dice.ts`
- Create: `src/game/content/encounters.ts`
- Create: `src/game/simulation/combat.ts`
- Create: `src/game/simulation/movement.ts`
- Create: `src/game/simulation/gameState.ts`

- [ ] Implement serializable game types.
- [ ] Implement injectable dice helpers.
- [ ] Implement the Goblin Cave starter encounter.
- [ ] Implement attack resolution, movement, turn ending, enemy AI, and combat logs.
- [ ] Run tests until they pass.

### Task 4: Phaser and DOM UI

**Files:**
- Create: `src/phaser/scenes/BattleScene.ts`
- Create: `src/phaser/adapters/domBridge.ts`
- Modify: `src/main.ts`
- Modify: `src/styles.css`

- [ ] Render the 10x8 cave grid in Phaser.
- [ ] Render the hero, enemies, reachable cells, and selected target hints.
- [ ] Wire pointer clicks to select movement or attacks.
- [ ] Render HP, AP, turn state, action buttons, and logs in DOM.
- [ ] End enemy turns automatically and re-render state changes.

### Task 5: Verification

**Files:**
- Modify as needed from Tasks 1-4.

- [ ] Run `npm test -- --run`.
- [ ] Run `npm run build`.
- [ ] Start the dev server.
- [ ] Open the local app in the browser and verify the board and HUD render.
