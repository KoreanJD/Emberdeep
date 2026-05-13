import './styles.css';
import Phaser from 'phaser';
import { BattleScene } from './phaser/scenes/BattleScene';

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="app-shell">
    <section class="game-frame">
      <div id="game-root"></div>
    </section>
    <aside id="hud-root" class="hud-root"></aside>
  </main>
`;

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-root',
  width: 800,
  height: 640,
  backgroundColor: '#11130f',
  scene: [BattleScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
});
