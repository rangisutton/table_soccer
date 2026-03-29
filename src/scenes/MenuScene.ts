import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT, FIELD_RADIUS } from '../config';
import { GameConfig, DEFAULT_CONFIG, FIELD_SHAPES, FieldShapePreset } from '../FieldConfig';
import { getFieldVertices, buildGoals } from '../Field';

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;
const C_CYAN    = 0x00ffee;
const C_MAGENTA = 0xff00cc;
const C_GOLD    = 0xffcc00;
const C_DARK    = 0x030320;

export class MenuScene extends Phaser.Scene {
  private cfg!: GameConfig;
  private previewGfx!: Phaser.GameObjects.Graphics;
  private shapeButtons: Phaser.GameObjects.Container[] = [];
  private goalGapLabel!: Phaser.GameObjects.Text;
  private spokeLabel!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'MenuScene' });
  }

  create() {
    this.cfg = { ...(this.registry.get('gameConfig') ?? DEFAULT_CONFIG) };

    // Background
    this.add.rectangle(CX, CY, CANVAS_WIDTH, CANVAS_HEIGHT, C_DARK);

    // Title
    this.add.text(CX, 28, 'TABLE SOCCER', {
      fontSize: '32px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#00ffee', stroke: '#003333', strokeThickness: 4,
    }).setOrigin(0.5, 0.5);

    // ── Field shape section ──
    this.add.text(CX, 75, 'FIELD SHAPE', {
      fontSize: '13px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5, 0.5);

    const cols = 3, btnW = 140, btnH = 42, padX = 20, padY = 12;
    const gridLeft = CX - (cols * btnW + (cols - 1) * padX) / 2;
    const gridTop  = 98;

    FIELD_SHAPES.forEach((shape, idx) => {
      const col = idx % cols, row = Math.floor(idx / cols);
      const bx = gridLeft + col * (btnW + padX) + btnW / 2;
      const by = gridTop  + row * (btnH + padY) + btnH / 2;
      const btn = this.makeShapeButton(bx, by, btnW, btnH, shape);
      this.shapeButtons.push(btn);
    });

    // ── Field preview ──
    this.add.text(CX, 242, 'PREVIEW', {
      fontSize: '11px', fontFamily: 'monospace', color: '#555555',
    }).setOrigin(0.5, 0.5);

    this.previewGfx = this.add.graphics();
    this.drawPreview();

    // ── Goal controls ──
    this.add.text(CX, 520, 'GOAL SIZE', {
      fontSize: '13px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5, 0.5);

    // Goal gap
    this.add.text(220, 548, 'Width', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5, 0.5);
    this.goalGapLabel = this.add.text(220, 570, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.makeAdjustButtons(220, 595, -10, 10,
      () => this.cfg.goalGap,
      (v) => { this.cfg.goalGap = Phaser.Math.Clamp(v, 30, 200); this.refresh(); },
    );

    // Spoke length
    this.add.text(580, 548, 'Depth', {
      fontSize: '12px', fontFamily: 'monospace', color: '#aaaaaa',
    }).setOrigin(0.5, 0.5);
    this.spokeLabel = this.add.text(580, 570, '', {
      fontSize: '16px', fontFamily: 'monospace', color: '#ffffff',
    }).setOrigin(0.5, 0.5);
    this.makeAdjustButtons(580, 595, -5, 5,
      () => this.cfg.goalSpokeLength,
      (v) => { this.cfg.goalSpokeLength = Phaser.Math.Clamp(v, 15, 120); this.refresh(); },
    );

    // ── Play button ──
    const playBg = this.add.rectangle(CX, 680, 220, 52, 0x000000, 0)
      .setStrokeStyle(2, C_GOLD).setInteractive({ useHandCursor: true });
    const playTxt = this.add.text(CX, 680, 'PLAY', {
      fontSize: '28px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffcc00',
    }).setOrigin(0.5, 0.5);

    playBg.on('pointerover', () => { playBg.setFillStyle(C_GOLD, 0.15); playTxt.setColor('#ffffff'); });
    playBg.on('pointerout',  () => { playBg.setFillStyle(0, 0);        playTxt.setColor('#ffcc00'); });
    playBg.on('pointerup',   () => {
      this.registry.set('gameConfig', { ...this.cfg });
      this.scene.start('GameScene');
    });

    // ── Rules summary ──
    this.add.text(CX, 740, 'Drag a coin to kick  •  Pass between the other two  •  First to 3 goals wins', {
      fontSize: '11px', fontFamily: 'monospace', color: '#445566', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.refresh();
    this.highlightSelected();
  }

  // ─── Shape button ────────────────────────────────────────────────────────────

  private makeShapeButton(x: number, y: number, w: number, h: number, shape: FieldShapePreset) {
    const container = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, w, h, 0x000000, 0).setStrokeStyle(1, 0x334455);
    const label = this.add.text(0, 0, shape.label, {
      fontSize: '14px', fontFamily: 'monospace', color: '#888888',
    }).setOrigin(0.5, 0.5);
    container.add([bg, label]);

    bg.setInteractive({ useHandCursor: true });
    bg.on('pointerover', () => {
      if (this.cfg.shape !== shape) {
        bg.setStrokeStyle(1, C_CYAN);
        label.setColor('#00ffee');
      }
    });
    bg.on('pointerout', () => this.highlightSelected());
    bg.on('pointerup', () => {
      this.cfg.shape = shape;
      this.highlightSelected();
      this.drawPreview();
    });
    return container;
  }

  private highlightSelected() {
    FIELD_SHAPES.forEach((shape, idx) => {
      const container = this.shapeButtons[idx];
      const bg    = container.getAt(0) as Phaser.GameObjects.Rectangle;
      const label = container.getAt(1) as Phaser.GameObjects.Text;
      const active = this.cfg.shape === shape;
      bg.setStrokeStyle(active ? 2 : 1, active ? C_GOLD : 0x334455);
      bg.setFillStyle(active ? C_GOLD : 0x000000, active ? 0.1 : 0);
      label.setColor(active ? '#ffcc00' : '#888888');
    });
  }

  // ─── +/- adjuster ────────────────────────────────────────────────────────────

  private makeAdjustButtons(
    x: number, y: number,
    smallStep: number, bigStep: number,
    get: () => number,
    set: (v: number) => void,
  ) {
    const mkBtn = (bx: number, label: string, step: number) => {
      const btn = this.add.text(bx, y, label, {
        fontSize: '18px', fontFamily: 'monospace', color: '#00ffee',
        backgroundColor: '#001122', padding: { x: 8, y: 4 },
      }).setOrigin(0.5, 0.5).setInteractive({ useHandCursor: true });
      btn.on('pointerup', () => set(get() + step));
      btn.on('pointerover', () => btn.setColor('#ffffff'));
      btn.on('pointerout',  () => btn.setColor('#00ffee'));
    };
    mkBtn(x - 60, '−−', smallStep * 2);
    mkBtn(x - 28, '−',  smallStep);
    mkBtn(x + 28, '+',  bigStep);
    mkBtn(x + 60, '++', bigStep * 2);
  }

  // ─── Refresh labels + preview ─────────────────────────────────────────────────

  private refresh() {
    this.goalGapLabel.setText(`${this.cfg.goalGap}px`);
    this.spokeLabel.setText(`${this.cfg.goalSpokeLength}px`);
    this.drawPreview();
  }

  // ─── Field preview ────────────────────────────────────────────────────────────

  private drawPreview() {
    const g = this.previewGfx;
    g.clear();

    const px = CX, py = 375;
    const scale = 0.58;
    const { sides } = this.cfg.shape;

    // Scaled vertices
    const worldVerts = getFieldVertices(px, py, this.cfg);
    const verts = worldVerts.map(v => ({
      x: px + (v.x - px) * scale,
      y: py + (v.y - py) * scale,
    }));

    // Fill
    g.fillStyle(C_DARK, 1);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < sides; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath(); g.fillPath();

    // Half tints
    this.previewHalfTint(g, verts, py, true,  C_CYAN,    0.07);
    this.previewHalfTint(g, verts, py, false, C_MAGENTA, 0.07);

    // Centre circle
    g.lineStyle(1, C_CYAN, 0.4);
    g.strokeCircle(px, py, 32 * scale);

    // Border
    for (let i = 0; i < sides; i++) {
      const a = verts[i], b = verts[(i + 1) % sides];
      const midY = (a.y + b.y) / 2;
      const col = midY < py ? C_CYAN : C_MAGENTA;
      g.lineStyle(4, col, 0.15); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
      g.lineStyle(1.5, col, 0.9); g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
    }

    // Goals
    const goals = buildGoals(px, py, this.cfg);
    for (let gi = 0; gi < 2; gi++) {
      const goal = goals[gi];
      const col = gi === 0 ? C_CYAN : C_MAGENTA;
      const pts = [goal.leftBase, goal.leftTip, goal.rightBase, goal.rightTip].map(v => ({
        x: px + (v.x - px) * scale, y: py + (v.y - py) * scale,
      }));
      const [lb, lt, rb, rt] = pts;
      g.lineStyle(3, col, 0.8);
      g.beginPath(); g.moveTo(lb.x, lb.y); g.lineTo(lt.x, lt.y); g.strokePath();
      g.beginPath(); g.moveTo(rb.x, rb.y); g.lineTo(rt.x, rt.y); g.strokePath();
      g.lineStyle(1, C_GOLD, 0.5);
      g.beginPath(); g.moveTo(lt.x, lt.y); g.lineTo(rt.x, rt.y); g.strokePath();
    }
  }

  private previewHalfTint(
    g: Phaser.GameObjects.Graphics, verts: {x:number,y:number}[],
    midY: number, topHalf: boolean, color: number, alpha: number,
  ) {
    const sign = topHalf ? -1 : 1;
    const pts: {x:number,y:number}[] = [];
    const n = verts.length;
    for (let i = 0; i < n; i++) {
      const a = verts[i], b = verts[(i + 1) % n];
      const aIn = sign * (a.y - midY) <= 0;
      const bIn = sign * (b.y - midY) <= 0;
      if (aIn) pts.push(a);
      if (aIn !== bIn) {
        const t = (a.y - midY) / (a.y - b.y);
        pts.push({ x: a.x + t * (b.x - a.x), y: midY });
      }
    }
    if (pts.length < 3) return;
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.fillPath();
  }
}
