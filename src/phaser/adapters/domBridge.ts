import type { Entity, GameState, HeroId } from '../../game/simulation/types';

export type ActionMode = 'move' | 'attack' | 'skill';

export interface HudActions {
  mode: ActionMode;
  status: string;
  heroOptions: Entity[];
  selectedSkillId: string | null;
  setMode(mode: ActionMode): void;
  useSkill(skillId: string): void;
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
          <h1>First Chamber</h1>
        </div>
        <span class="round-pill">${phaseLabel(state.phase)}</span>
      </header>

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
  root.querySelector<HTMLButtonElement>('#end-turn')?.addEventListener('click', actions.endTurn);
  root.querySelector<HTMLButtonElement>('#reset-game')?.addEventListener('click', actions.reset);
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
    case 'victory':
      return 'Victory';
    case 'defeat':
      return 'Defeat';
  }
}
