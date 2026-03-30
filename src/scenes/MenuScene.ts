import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { GameConfig, DEFAULT_CONFIG } from '../FieldConfig';
import { stadiumLevel } from '../levels/stadium';

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;
const C_CYAN    = 0x00ffee;
const C_GOLD    = 0xffcc00;
const C_DARK    = 0x030320;

export class MenuScene extends Phaser.Scene {
  private cfg!: GameConfig;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    this.cfg = { ...(this.registry.get('gameConfig') ?? DEFAULT_CONFIG) };

    this.add.rectangle(CX, CY, CANVAS_WIDTH, CANVAS_HEIGHT, C_DARK);

    this.add.text(CX, 60, 'TABLE SOCCER', {
      fontSize: '36px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#00ffee', stroke: '#003333', strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    this.add.text(CX, 105, stadiumLevel.label.toUpperCase(), {
      fontSize: '14px', fontFamily: 'monospace', color: '#446688',
    }).setOrigin(0.5, 0.5);

    // ── Physics controls ──────────────────────────────────────────────────────
    this.add.text(CX, 200, 'PHYSICS', {
      fontSize: '13px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5, 0.5);

    const controls: {
      label: string;
      get: () => number; set: (v: number) => void;
      step: number; min: number; max: number;
      fmt: (v: number) => string;
    }[] = [
      {
        label: 'Coin size',
        get: () => this.cfg.coinRadius,
        set: (v) => { this.cfg.coinRadius = v; },
        step: 1, min: 8, max: 36,
        fmt: (v) => `${v}px`,
      },
      {
        label: 'Kick power',
        get: () => this.cfg.kickPower,
        set: (v) => { this.cfg.kickPower = v; },
        step: 0.1, min: 0.3, max: 3.0,
        fmt: (v) => v.toFixed(1) + 'x',
      },
      {
        label: 'Drag',
        get: () => this.cfg.coinDrag,
        set: (v) => { this.cfg.coinDrag = v; },
        step: 0.5, min: 0.0, max: 30.0,
        fmt: (v) => v.toFixed(1),
      },
    ];

    controls.forEach((ctrl, i) => {
      const y = 250 + i * 60;
      this.add.text(CX - 120, y, ctrl.label, {
        fontSize: '13px', fontFamily: 'monospace', color: '#aaaaaa',
      }).setOrigin(0, 0.5);

      const valLabel = this.add.text(CX + 20, y, ctrl.fmt(ctrl.get()), {
        fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
      }).setOrigin(0.5, 0.5);

      const mkBtn = (bx: number, delta: number, lbl: string) => {
        const btn = this.add.text(bx, y, lbl, {
          fontSize: '16px', fontFamily: 'monospace', color: '#00ffee',
          backgroundColor: '#001118', padding: { x: 6, y: 3 },
        }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
        btn.on('pointerup', () => {
          const next = Phaser.Math.Clamp(
            Math.round((ctrl.get() + delta) * 1000) / 1000,
            ctrl.min, ctrl.max,
          );
          ctrl.set(next);
          valLabel.setText(ctrl.fmt(ctrl.get()));
        });
        btn.on('pointerover', () => btn.setColor('#ffffff'));
        btn.on('pointerout',  () => btn.setColor('#00ffee'));
      };

      mkBtn(CX + 80,  -ctrl.step, '−');
      mkBtn(CX + 120, +ctrl.step, '+');
    });

    // ── Play button ──────────────────────────────────────────────────────────
    const playBg = this.add.rectangle(CX, 560, 220, 52, 0x000000, 0)
      .setStrokeStyle(2, C_GOLD).setInteractive({ useHandCursor: true });
    const playTxt = this.add.text(CX, 560, 'PLAY', {
      fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffcc00',
    }).setOrigin(0.5, 0.5);

    playBg.on('pointerover', () => { playBg.setFillStyle(C_GOLD, 0.15); playTxt.setColor('#ffffff'); });
    playBg.on('pointerout',  () => { playBg.setFillStyle(0, 0);        playTxt.setColor('#ffcc00'); });
    playBg.on('pointerup',   () => {
      this.registry.set('gameConfig', { ...this.cfg });
      this.registry.set('level', stadiumLevel);
      this.scene.start('GameScene');
    });

    this.add.text(CX, 640, 'Drag a coin to kick  •  Pass between the other two  •  First to 3 goals wins', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445566', align: 'center',
    }).setOrigin(0.5, 0.5);
  }
}
