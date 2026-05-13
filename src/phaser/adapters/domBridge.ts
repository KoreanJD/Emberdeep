import { getDungeonRoomSummaries } from '../../game/content/encounters';
import type { Entity, GameState, HeroId } from '../../game/simulation/types';

export type ActionMode = 'move' | 'attack' | 'skill';

export interface HudActions {
  mode: ActionMode;
  status: string;
  heroOptions: Entity[];
  selectedSkillId: string | null;
  setMode(mode: ActionMode): void;
  useSkill(skillId: string): void;
  selectReward(rewardId: string): void;
  selectHero(heroId: HeroId): void;
  endTurn(): void;
  reset(): void;
}

export function renderHud(root: HTMLElement, state: GameState, actions: HudActions): void {
  const hero = state.entities[state.activeHeroId];
  const enemies = Object.values(state.entities).filter((entity) => entity.team === 'enemies');
  const livingEnemies = enemies.filter((entity) => entity.hp > 0);
  const canAct = state.phase === 'player' && hero.hp > 0 && hero.ap > 0;

  root.innerHTML = `
    <div class="hud">
      <header class="hud-header">
        <div>
          <p class="eyebrow">Emberdeep: Goblin Cave</p>
          <h1>${state.roomName}</h1>
        </div>
        <span class="round-pill">${phaseLabel(state.phase)}</span>
      </header>

      ${renderDungeonProgress(state)}

      <section class="hero-card">
        ${renderEntity(hero)}
        <div class="ap-row" aria-label="Action points">
          ${Array.from({ length: hero.maxAp }, (_, index) => `<span class="${index < hero.ap ? 'ap-dot filled' : 'ap-dot'}"></span>`).join('')}
        </div>
        ${hero.statuses.length > 0 ? `<p class="status-tags">${hero.statuses.map((status) => status.name).join(' · ')}</p>` : ''}
      </section>

      <section class="hero-select">
        <h2>Hero</h2>
        <div class="hero-select-grid">
          ${actions.heroOptions
            .map(
              (option) => `
                <button id="hero-${option.id}" class="${option.id === state.activeHeroId ? 'active' : ''}" title="${option.name}">
                  ${heroInitial(option)}
                </button>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="action-panel">
        <button id="mode-move" class="${actions.mode === 'move' ? 'active' : ''}" ${canAct ? '' : 'disabled'}>Move</button>
        <button id="mode-attack" class="${actions.mode === 'attack' ? 'active' : ''}" ${canAct ? '' : 'disabled'}>Attack</button>
        <button id="end-turn" ${state.phase === 'player' && hero.hp > 0 ? '' : 'disabled'}>End Turn</button>
        <button id="reset-game">Reset</button>
      </section>

      <section class="skill-panel">
        <h2>Skills</h2>
        <div class="skill-grid">
          ${hero.skills
            .map(
              (skill) => `
                <button
                  id="skill-${skill.id}"
                  class="${actions.selectedSkillId === skill.id ? 'active' : ''}"
                  title="${skill.description}"
                  ${state.phase === 'player' && hero.hp > 0 && hero.ap >= skill.cost ? '' : 'disabled'}
                >
                  <span>${skill.name}</span>
                  <small>${skill.cost} AP</small>
                </button>
              `,
            )
            .join('')}
        </div>
      </section>

      <section class="status-panel">
        <div>
          <span class="label">Objective</span>
          <strong>${livingEnemies.length === 0 ? 'Chamber secured' : `Defeat ${livingEnemies.length} goblin${livingEnemies.length === 1 ? '' : 's'}`}</strong>
        </div>
        <p>${actions.status}</p>
      </section>

      ${state.phase === 'victory' || state.phase === 'defeat' ? renderResultPanel(state) : ''}

      ${
        state.phase === 'reward'
          ? `<section class="reward-panel">
              <h2>Rewards</h2>
              <div class="reward-grid">
                ${state.rewardOptions
                  .map(
                    (reward) => `
                      <button id="reward-${reward.id}">
                        <span>${reward.name}</span>
                        <small>${reward.description}</small>
                      </button>
                    `,
                  )
                  .join('')}
              </div>
            </section>`
          : ''
      }

      <section class="enemy-list">
        <h2>Enemies</h2>
        ${enemies.map(renderEntity).join('')}
      </section>

      <section class="combat-log">
        <h2>Combat Log</h2>
        <ol>
          ${state.log
            .slice(-10)
            .reverse()
            .map((entry) => `<li class="${entry.type}">${entry.message}</li>`)
            .join('')}
        </ol>
      </section>
    </div>
  `;

  root.querySelector<HTMLButtonElement>('#mode-move')?.addEventListener('click', () => actions.setMode('move'));
  root.querySelector<HTMLButtonElement>('#mode-attack')?.addEventListener('click', () => actions.setMode('attack'));
  hero.skills.forEach((skill) => {
    root
      .querySelector<HTMLButtonElement>(`#skill-${skill.id}`)
      ?.addEventListener('click', () => actions.useSkill(skill.id));
  });
  actions.heroOptions.forEach((heroOption) => {
    root
      .querySelector<HTMLButtonElement>(`#hero-${heroOption.id}`)
      ?.addEventListener('click', () => actions.selectHero(heroOption.id as HeroId));
  });
  state.rewardOptions.forEach((reward) => {
    root
      .querySelector<HTMLButtonElement>(`#reward-${reward.id}`)
      ?.addEventListener('click', () => actions.selectReward(reward.id));
  });
  root.querySelector<HTMLButtonElement>('#restart-run')?.addEventListener('click', actions.reset);
  root.querySelector<HTMLButtonElement>('#end-turn')?.addEventListener('click', actions.endTurn);
  root.querySelector<HTMLButtonElement>('#reset-game')?.addEventListener('click', actions.reset);
}

export function renderDungeonProgress(state: GameState): string {
  const rooms = getDungeonRoomSummaries();
  const current = rooms[state.currentRoomIndex] ?? rooms[0];
  const next = rooms[state.currentRoomIndex + 1];
  const isBossRoom = current?.kind === 'boss';

  return `
    <section class="progress-panel ${isBossRoom ? 'boss-room' : ''}" aria-label="Dungeon progress">
      <div class="progress-header">
        <span class="label">${isBossRoom ? 'Boss Room' : 'Combat'}</span>
        <strong>Room ${state.currentRoomIndex + 1}/${rooms.length}</strong>
      </div>
      <div class="room-track">
        ${rooms
          .map(
            (room) => `
              <span
                class="room-node ${room.index === state.currentRoomIndex ? 'current' : ''} ${room.index < state.currentRoomIndex ? 'cleared' : ''} ${room.kind === 'boss' ? 'boss' : ''}"
                title="${room.name}"
              ></span>
            `,
          )
          .join('')}
      </div>
      <p>${current.name}</p>
      <small>${isBossRoom ? 'Final encounter' : next ? `Next: ${next.name}` : 'Final room'}</small>
    </section>
  `;
}

export function renderResultPanel(state: GameState): string {
  const cleared = state.phase === 'victory';
  const rewardNames = state.selectedRewards.map(rewardLabel);

  return `
    <section class="result-panel ${cleared ? 'victory' : 'defeat'}" aria-live="polite">
      <span class="label">Run Result</span>
      <h2>${cleared ? 'Dungeon Cleared' : 'Dungeon Failed'}</h2>
      <p>
        ${cleared
          ? `${state.roomName} is secure. The stolen emberstone is recovered.`
          : `The party fell in ${state.roomName}. Regroup and try again.`}
      </p>
      <dl class="result-stats">
        <div>
          <dt>Final Room</dt>
          <dd>${state.roomName}</dd>
        </div>
        <div>
          <dt>Round</dt>
          <dd>Round ${state.round}</dd>
        </div>
        <div>
          <dt>Rewards</dt>
          <dd>${rewardNames.length > 0 ? rewardNames.join(' · ') : 'None'}</dd>
        </div>
      </dl>
      <button id="restart-run">${cleared ? 'New Run' : 'Try Again'}</button>
    </section>
  `;
}

function renderEntity(entity: Entity): string {
  const hpPercent = Math.max(0, Math.round((entity.hp / entity.maxHp) * 100));
  return `
    <article class="entity-row ${entity.hp <= 0 ? 'defeated' : ''}">
      <div>
        <strong>${entity.name}</strong>
        <span>DEF ${entity.defense} · MOVE ${entity.move}</span>
      </div>
      <div class="hp-meter" aria-label="${entity.name} HP">
        <span style="width:${hpPercent}%"></span>
      </div>
      <small>${entity.hp}/${entity.maxHp} HP</small>
      ${entity.statuses.length > 0 ? `<p class="status-tags">${entity.statuses.map((status) => status.name).join(' · ')}</p>` : ''}
    </article>
  `;
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

function phaseLabel(phase: GameState['phase']): string {
  switch (phase) {
    case 'player':
      return 'Player Turn';
    case 'enemy':
      return 'Enemy Turn';
    case 'reward':
      return 'Reward';
    case 'victory':
      return 'Victory';
    case 'defeat':
      return 'Defeat';
  }
}

function rewardLabel(rewardId: string): string {
  switch (rewardId) {
    case 'field_dressing':
      return 'Field Dressing';
    case 'ember_edge':
      return 'Ember Edge';
    case 'tactical_focus':
      return 'Tactical Focus';
    default:
      return rewardId;
  }
}
