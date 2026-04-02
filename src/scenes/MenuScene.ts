import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { GameConfig, DEFAULT_CONFIG } from '../FieldConfig';
import { LevelDef } from '../LevelDef';
import { fieldLevels, courseLevels } from '../levels/index';

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;
const C_CYAN    = 0x00ffee;
const C_GOLD    = 0xffcc00;
const C_DARK    = 0x030320;

export class MenuScene extends Phaser.Scene {
  private cfg!: GameConfig;
  private selectedLevel!: LevelDef;
  private levelBtns: { level: LevelDef; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    this.cfg = { ...(this.registry.get('gameConfig') ?? DEFAULT_CONFIG) };
    this.selectedLevel = this.registry.get('level') ?? fieldLevels[0];

    this.add.rectangle(CX, CY, CANVAS_WIDTH, CANVAS_HEIGHT, C_DARK);

    this.add.text(CX, 44, 'TABLE SOCCER', {
      fontSize: '34px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#00ffee', stroke: '#003333', strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    let y = 90;

    // ── Field levels ──────────────────────────────────────────────────────────
    if (fieldLevels.length > 0) {
      this.add.text(CX, y, 'FIELDS', {
        fontSize: '11px', fontFamily: 'monospace', color: '#446688',
      }).setOrigin(0.5, 0.5);
      y += 22;
      y = this.buildLevelRow(fieldLevels, y);
      y += 12;
    }

    // ── Course levels ─────────────────────────────────────────────────────────
    if (courseLevels.length > 0) {
      this.add.text(CX, y, 'COURSES', {
        fontSize: '11px', fontFamily: 'monospace', color: '#446688',
      }).setOrigin(0.5, 0.5);
      y += 22;
      y = this.buildLevelRow(courseLevels, y);
      y += 12;
    }

    // ── Physics controls ──────────────────────────────────────────────────────
    y += 6;
    this.add.text(CX, y, 'PHYSICS', {
      fontSize: '11px', fontFamily: 'monospace', color: '#446688',
    }).setOrigin(0.5, 0.5);
    y += 24;

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
      const ry = y + i * 50;
      this.add.text(CX - 120, ry, ctrl.label, {
        fontSize: '13px', fontFamily: 'monospace', color: '#aaaaaa',
      }).setOrigin(0, 0.5);

      const valLabel = this.add.text(CX + 20, ry, ctrl.fmt(ctrl.get()), {
        fontSize: '14px', fontFamily: 'monospace', color: '#ffffff',
      }).setOrigin(0.5, 0.5);

      const mkBtn = (bx: number, delta: number, lbl: string) => {
        const btn = this.add.text(bx, ry, lbl, {
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
      mkBtn(CX + 78,  -ctrl.step, '−');
      mkBtn(CX + 118, +ctrl.step, '+');
    });

    y += controls.length * 50 + 20;

    // ── Play button ──────────────────────────────────────────────────────────
    const playBg = this.add.rectangle(CX, y, 220, 52, 0x000000, 0)
      .setStrokeStyle(2, C_GOLD).setInteractive({ useHandCursor: true });
    const playTxt = this.add.text(CX, y, 'PLAY', {
      fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffcc00',
    }).setOrigin(0.5, 0.5);

    playBg.on('pointerover', () => { playBg.setFillStyle(C_GOLD, 0.15); playTxt.setColor('#ffffff'); });
    playBg.on('pointerout',  () => { playBg.setFillStyle(0, 0);        playTxt.setColor('#ffcc00'); });
    playBg.on('pointerup',   () => {
      this.registry.set('gameConfig', { ...this.cfg });
      this.registry.set('level', this.selectedLevel);
      this.scene.start('GameScene');
    });

    this.add.text(CX, y + 50, 'Drag a coin to kick  •  Pass between the other two  •  First to 3 goals wins', {
      fontSize: '11px', fontFamily: 'monospace', color: '#334455', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.highlightSelected();
  }

  private buildLevelRow(levels: LevelDef[], y: number): number {
    const btnW = 140, btnH = 38, padX = 16, cols = 3;
    const rowW = cols * btnW + (cols - 1) * padX;
    const startX = CX - rowW / 2 + btnW / 2;

    for (let i = 0; i < levels.length; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const bx = startX + col * (btnW + padX);
      const by = y + row * (btnH + 8) + btnH / 2;
      const level = levels[i];

      const bg = this.add.rectangle(bx, by, btnW, btnH, 0x000000, 0)
        .setStrokeStyle(1, 0x224455).setInteractive({ useHandCursor: true });
      const lbl = this.add.text(bx, by, level.label, {
        fontSize: '13px', fontFamily: 'monospace', color: '#778899',
      }).setOrigin(0.5, 0.5);

      bg.on('pointerover', () => {
        if (this.selectedLevel !== level) { bg.setStrokeStyle(1, C_CYAN); lbl.setColor('#00ffee'); }
      });
      bg.on('pointerout', () => this.highlightSelected());
      bg.on('pointerup', () => {
        this.selectedLevel = level;
        this.highlightSelected();
      });

      this.levelBtns.push({ level, bg, label: lbl });
    }

    const rows = Math.ceil(levels.length / cols);
    return y + rows * (btnH + 8);
  }

  private highlightSelected() {
    for (const { level, bg, label } of this.levelBtns) {
      const active = this.selectedLevel === level;
      bg.setStrokeStyle(active ? 2 : 1, active ? C_GOLD : 0x224455);
      bg.setFillStyle(active ? C_GOLD : 0x000000, active ? 0.1 : 0);
      label.setColor(active ? '#ffcc00' : '#778899');
    }
  }
}
