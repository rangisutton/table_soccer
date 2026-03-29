import Phaser from 'phaser';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT, FIELD_RADIUS,
  COIN_RADIUS, KICKOFF_SPREAD, WIN_GOALS,
} from '../config';
import { getFieldVertices, buildGoals } from '../Field';
import { GameState, Vec2, GoalPost, PlayerId } from '../types';
import { GameConfig, DEFAULT_CONFIG } from '../FieldConfig';
import { GameAudio } from '../Audio';

interface Spark {
  x: number; y: number;     // world position
  vx: number; vy: number;   // px per frame at 60fps
  life: number;             // ms remaining
  maxLife: number;
  color: number;
}

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;

// Tron palette
const C_CYAN    = 0x00ffee;
const C_MAGENTA = 0xff00cc;
const C_DARK    = 0x030320;
const C_GOLD    = 0xffcc00;

export class GameScene extends Phaser.Scene {
  private cfg!: GameConfig;
  private coins: MatterJS.BodyType[] = [];
  private goals!: [GoalPost, GoalPost];
  private state!: GameState;

  // Rotatable container
  private gameContainer!: Phaser.GameObjects.Container;
  private fieldGfx!: Phaser.GameObjects.Graphics;
  private splitGfx!: Phaser.GameObjects.Graphics;
  private sparkGfx!: Phaser.GameObjects.Graphics;
  private coinGfx!: Phaser.GameObjects.Graphics;
  private dragGfx!: Phaser.GameObjects.Graphics;

  // Effects
  private sparks: Spark[] = [];
  private audio = new GameAudio();

  // Static UI (above container)
  private scoreText!: Phaser.GameObjects.Text;
  private playerText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private settingsLabels: Phaser.GameObjects.Text[] = [];

  // Drag input
  private dragging = false;
  private dragCoinIndex = -1;
  private dragScreenStart: Vec2 = { x: 0, y: 0 };
  private dragScreenCurrent: Vec2 = { x: 0, y: 0 };

  // Simulation tracking
  private prevCoinPos: Vec2[] = [];
  private splitLineA: Vec2 = { x: 0, y: 0 };
  private splitLineB: Vec2 = { x: 0, y: 0 };
  private splitDetected = false;
  private kickoffMove = true;
  private kickoffHitDetected = false; // kicked coin touched another coin during kickoff
  private resultHandled = false;
  private simFrameCount = 0;
  private lastFoulCoinIndex: number | null = null; // preserves red glow after illegal kick settles

  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    this.cfg = this.registry.get('gameConfig') ?? DEFAULT_CONFIG;
    this.goals = buildGoals(CX, CY, this.cfg);
    this.state = {
      phase: 'kickoff',
      attacker: 0,
      scores: [0, 0],
      lastKickedCoinIndex: null,
    };

    this.createUI();

    this.gameContainer = this.add.container(CX, CY).setDepth(1);
    this.fieldGfx = this.add.graphics();
    this.splitGfx = this.add.graphics();
    this.sparkGfx = this.add.graphics();
    this.coinGfx  = this.add.graphics();
    this.dragGfx  = this.add.graphics();
    this.gameContainer.add([this.fieldGfx, this.splitGfx, this.sparkGfx, this.coinGfx, this.dragGfx]);

    this.buildWalls();
    this.placeKickoff();
    this.setupInput();
    this.setupCollisions();

    // Menu button
    const menuBtn = this.add.text(CANVAS_WIDTH - 10, CANVAS_HEIGHT - 10, '[ Menu ]', {
      fontSize: '13px', fontFamily: 'monospace', color: '#446688',
    }).setOrigin(1, 1).setDepth(55).setInteractive({ useHandCursor: true });
    menuBtn.on('pointerover', () => menuBtn.setColor('#00ffee'));
    menuBtn.on('pointerout',  () => menuBtn.setColor('#446688'));
    menuBtn.on('pointerup',   () => this.scene.start('MenuScene'));

    this.createSettingsPanel();
    this.draw();
    this.updateUI();
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  private createUI() {
    // Score bar
    this.add.rectangle(CX, 30, CANVAS_WIDTH, 60, 0x000000, 0.85).setDepth(50);
    this.add.rectangle(CX, 30, CANVAS_WIDTH, 60)
      .setStrokeStyle(1, C_CYAN, 0.4).setFillStyle(0, 0).setDepth(50);

    this.scoreText = this.add.text(CX, 6, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#00ffee',
      stroke: '#003333', strokeThickness: 3, align: 'center',
    }).setOrigin(0.5, 0).setDepth(51);

    this.playerText = this.add.text(CX, 36, '', {
      fontSize: '14px', fontFamily: 'monospace', color: '#ff00cc',
      stroke: '#330033', strokeThickness: 2, align: 'center',
    }).setOrigin(0.5, 0).setDepth(51);

    this.statusText = this.add.text(CX, CY + 20, '', {
      fontSize: '64px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000022', strokeThickness: 10, align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(55);
  }

  private updateUI() {
    const { scores, attacker, phase } = this.state;
    this.scoreText.setText(`P1: ${scores[0]}   |   P2: ${scores[1]}`);

    if (phase === 'gameover') {
      const winner = scores[0] >= WIN_GOALS ? 1 : 2;
      this.playerText.setText(`Player ${winner} wins!`);
    } else {
      const name = `Player ${attacker + 1}`;
      this.playerText.setText(
        phase === 'kickoff'   ? `${name} — Kick off!` :
        phase === 'playing'   ? `${name} — Choose a coin` :
        name,
      );
    }
  }

  private showStatus(msg: string, color: string) {
    this.statusText.setText(msg).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.statusText);
    this.tweens.add({ targets: this.statusText, alpha: 0, delay: 1000, duration: 500 });
  }

  // ─── Settings panel ───────────────────────────────────────────────────────────

  private createSettingsPanel() {
    const px = 8, py = CANVAS_HEIGHT - 110;
    const rowH = 22;

    const panelW = 188, panelH = 100;
    this.add.rectangle(px + panelW / 2, py + panelH / 2 - 4, panelW, panelH, 0x000000, 0.6)
      .setDepth(54).setStrokeStyle(1, 0x224455, 1);

    const controls: { label: string; get: () => number; set: (v: number) => void; step: number; min: number; max: number; fmt: (v: number) => string }[] = [
      {
        label: 'Coin size',
        get: () => this.cfg.coinRadius,
        set: (v) => { this.cfg.coinRadius = v; this.placeKickoff(); },
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
        step: 0.01, min: 0.0, max: 0.5,
        fmt: (v) => v.toFixed(2),
      },
    ];

    controls.forEach((ctrl, i) => {
      const y = py + i * rowH + 12;

      this.add.text(px + 4, y, ctrl.label, {
        fontSize: '11px', fontFamily: 'monospace', color: '#556677',
      }).setOrigin(0, 0.5).setDepth(55);

      const valLabel = this.add.text(px + 86, y, ctrl.fmt(ctrl.get()), {
        fontSize: '11px', fontFamily: 'monospace', color: '#aaccdd',
      }).setOrigin(0.5, 0.5).setDepth(55);
      this.settingsLabels.push(valLabel);

      const mkBtn = (bx: number, delta: number, lbl: string) => {
        const btn = this.add.text(bx, y, lbl, {
          fontSize: '13px', fontFamily: 'monospace', color: '#00ffee',
          backgroundColor: '#001118', padding: { x: 3, y: 1 },
        }).setOrigin(0.5, 0.5).setDepth(55).setInteractive({ useHandCursor: true });
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

      mkBtn(px + 120, -ctrl.step, '−');
      mkBtn(px + 148, +ctrl.step, '+');
    });
  }

  // ─── Physics walls ────────────────────────────────────────────────────────────

  private buildWalls() {
    const { sides } = this.cfg.shape;
    const verts = getFieldVertices(CX, CY, this.cfg);
    const goalEdges = [0, sides / 2];
    for (let i = 0; i < sides; i++) {
      if (goalEdges.includes(i)) continue;
      this.addWall(verts[i], verts[(i + 1) % sides]);
    }
    for (const goal of this.goals) {
      this.addWall(goal.leftBase,  goal.leftTip);
      this.addWall(goal.rightBase, goal.rightTip);
    }

    // Centre obstacle — slightly larger than the decorative circle (r=55)
    const obs = 70; // half-side of square
    this.matter.add.rectangle(CX, CY, obs * 2, obs * 2, {
      isStatic: true, friction: 0, restitution: 1, slop: 0, label: 'obstacle',
    });
  }

  /**
   * Add a wall segment flush with the drawn edge.
   * The rectangle is shifted outward by half its thickness so its inner face
   * sits exactly on the a–b line, eliminating the inward offset.
   * Length is extended by the wall thickness at each end to overlap corners
   * and close the seam gap between adjacent segments.
   */
  private addWall(a: Vec2, b: Vec2) {
    // Thick enough that even tiny fast coins can't tunnel through in one step
    const t = 40;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Outward normal (away from field centre)
    const nx = dy / len, ny = -dx / len;
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const dot = nx * (CX - midX) + ny * (CY - midY);
    const outX = dot > 0 ? -nx : nx;
    const outY = dot > 0 ? -ny : ny;

    // Shift outward so inner face aligns with drawn edge
    const cx = midX + outX * (t / 2);
    const cy = midY + outY * (t / 2);

    this.matter.add.rectangle(cx, cy, len + t, t, {
      isStatic: true, angle,
      friction: 0, restitution: 1,
      slop: 0,
      label: 'wall',
    });
  }

  // ─── Coin placement ───────────────────────────────────────────────────────────

  private placeKickoff() {
    for (const c of this.coins) this.matter.world.remove(c);
    this.coins = [];
    this.resetSimState();
    this.kickoffMove = true;

    const dir = this.state.attacker === 0 ? 1 : -1;
    const baseY = CY + dir * (FIELD_RADIUS * 0.4);
    const s = KICKOFF_SPREAD;
    const r = this.cfg.coinRadius;
    const jitter = () => (Math.random() - 0.5) * r * 0.2;

    const pts: Vec2[] = [
      { x: CX + jitter(),             y: baseY + dir * s + jitter() },
      { x: CX - s * 0.65 + jitter(),  y: baseY - dir * s * 0.5 + jitter() },
      { x: CX + s * 0.65 + jitter(),  y: baseY - dir * s * 0.5 + jitter() },
    ];

    for (const p of pts) {
      this.coins.push(this.matter.add.circle(p.x, p.y, r, {
        restitution: 0.95, friction: 0, frictionAir: this.cfg.coinDrag,
        slop: 0, label: 'coin',
      }));
    }
  }

  private resetSimState() {
    this.splitDetected = false;
    this.kickoffMove = false;
    this.kickoffHitDetected = false;
    this.resultHandled = false;
    this.simFrameCount = 0;
    this.prevCoinPos = [];
    this.lastFoulCoinIndex = null;
  }

  // ─── Input ────────────────────────────────────────────────────────────────────

  private setupInput() {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.state.phase !== 'kickoff' && this.state.phase !== 'playing') return;
      const world = this.screenToWorld(ptr.x, ptr.y);
      const idx = this.coinAt(world);
      if (idx === -1) return;
      if (this.state.phase === 'kickoff' && idx !== 0) return;
      if (this.state.phase === 'playing' && idx === this.state.lastKickedCoinIndex) return;
      this.dragging = true;
      this.dragCoinIndex = idx;
      this.dragScreenStart = { x: ptr.x, y: ptr.y };
      this.dragScreenCurrent = { x: ptr.x, y: ptr.y };
    });

    // Track mouse anywhere on the window so dragging outside the canvas still works
    const onWindowMove = (e: MouseEvent) => {
      if (!this.dragging) return;
      this.dragScreenCurrent = this.windowToCanvas(e.clientX, e.clientY);
    };
    const onWindowUp = (e: MouseEvent) => {
      if (!this.dragging) return;
      this.dragging = false;
      const pos = this.windowToCanvas(e.clientX, e.clientY);
      this.kick(this.dragCoinIndex, this.dragScreenStart, pos);
    };
    window.addEventListener('mousemove', onWindowMove);
    window.addEventListener('mouseup', onWindowUp);

    // Clean up when scene shuts down
    this.events.once('shutdown', () => {
      window.removeEventListener('mousemove', onWindowMove);
      window.removeEventListener('mouseup', onWindowUp);
    });
  }

  /** Convert window client coordinates to Phaser canvas coordinates, accounting for FIT scaling. */
  private windowToCanvas(clientX: number, clientY: number): Vec2 {
    const canvas = this.sys.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH  / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top)  * scaleY,
    };
  }

  private coinAt(world: Vec2): number {
    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      const dx = (c.position.x as number) - world.x;
      const dy = (c.position.y as number) - world.y;
      if (Math.hypot(dx, dy) <= this.cfg.coinRadius * 2.2) return i;
    }
    return -1;
  }

  // ─── Kick ─────────────────────────────────────────────────────────────────────

  private kick(idx: number, screenStart: Vec2, screenEnd: Vec2) {
    const ws = this.screenToWorld(screenStart.x, screenStart.y);
    const we = this.screenToWorld(screenEnd.x, screenEnd.y);
    const dx = ws.x - we.x, dy = ws.y - we.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 5) return;

    const power = Math.min(dist, 200);
    this.matter.body.setVelocity(this.coins[idx], {
      x: (dx / dist) * power * 0.12 * this.cfg.kickPower,
      y: (dy / dist) * power * 0.12 * this.cfg.kickPower,
    });

    const others = [0, 1, 2].filter(i => i !== idx);
    this.splitLineA = { x: this.coins[others[0]].position.x as number, y: this.coins[others[0]].position.y as number };
    this.splitLineB = { x: this.coins[others[1]].position.x as number, y: this.coins[others[1]].position.y as number };

    this.state.lastKickedCoinIndex = idx;
    this.state.phase = 'simulating';
    this.splitDetected = false;
    this.resultHandled = false;
    this.simFrameCount = 0;
    this.updateUI();
  }

  // ─── Game loop ────────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    if (this.state.phase === 'simulating') this.runSimulationChecks();
    // Advance sparks
    const dt = delta / 16.67; // normalise to 60fps
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.88; s.vy *= 0.88;
      s.life -= delta;
      return s.life > 0;
    });
    this.draw();
  }

  private runSimulationChecks() {
    this.simFrameCount++;
    const ki = this.state.lastKickedCoinIndex!;
    const cur: Vec2[] = this.coins.map(c => ({
      x: c.position.x as number, y: c.position.y as number,
    }));
    const prev = this.prevCoinPos;

    if (prev.length === this.coins.length && !this.resultHandled) {
      if (this.kickoffMove && !this.kickoffHitDetected) {
        // Kickoff legal when kicked coin touches either other coin
        const others = [0, 1, 2].filter(i => i !== ki);
        for (const oi of others) {
          const dx = cur[ki].x - cur[oi].x, dy = cur[ki].y - cur[oi].y;
          if (Math.hypot(dx, dy) <= this.cfg.coinRadius * 2 + 2) {
            this.kickoffHitDetected = true;
            break;
          }
        }
      }

      if (!this.splitDetected && !this.kickoffMove) {
        // Use current positions of the other two coins — line travels with them
        const others = [0, 1, 2].filter(i => i !== ki);
        const liveA = cur[others[0]];
        const liveB = cur[others[1]];
        if (segmentsIntersect(prev[ki], cur[ki], liveA, liveB)) {
          this.splitDetected = true;
        }
      }
      // Any coin can score — check all
      outer: for (let ci = 0; ci < this.coins.length; ci++) {
        if (!prev[ci]) continue;
        for (const goal of this.goals) {
          if (segmentsIntersect(prev[ci], cur[ci], goal.leftTip, goal.rightTip)) {
            this.resultHandled = true;
            this.onGoal(goal.scorer, goal.scorer !== this.state.attacker);
            break outer;
          }
        }
      }
      if (!this.resultHandled) {
        const pos = cur[ki];
        const maxR = FIELD_RADIUS * Math.max(this.cfg.shape.scaleX, this.cfg.shape.scaleY);
        if (Math.hypot(pos.x - CX, pos.y - CY) > maxR + COIN_RADIUS * 2) {
          this.resultHandled = true;
          this.onFoul();
        }
      }
    }

    this.prevCoinPos = cur;
    if (!this.resultHandled && this.simFrameCount >= 8 && this.allStopped()) {
      this.resultHandled = true;
      this.onSettled();
    }
  }

  private allStopped() {
    return this.coins.every(c => {
      const v = c.velocity as { x: number; y: number };
      return Math.hypot(v.x, v.y) < 0.1;
    });
  }

  private onSettled() {
    if (this.kickoffMove) {
      if (this.kickoffHitDetected) {
        this.kickoffMove = false;
        this.state.lastKickedCoinIndex = null;
        this.state.phase = 'playing';
      } else {
        this.onFoul();
        return;
      }
    } else if (this.splitDetected) {
      this.state.phase = 'playing';
    } else {
      this.onFoul();
      return;
    }
    this.updateUI();
  }

  private onGoal(scorer: PlayerId, isOwnGoal = false) {
    this.state.scores[scorer]++;
    this.state.phase = 'goal';

    if (this.state.scores[scorer] >= WIN_GOALS) {
      this.state.phase = 'gameover';
      this.showStatus(`Player ${scorer + 1} Wins!`, '#ffcc00');
      this.updateUI();
      return;
    }

    this.showStatus(isOwnGoal ? 'Own Goal!' : 'Goal!', '#ffcc00');
    this.state.attacker = (1 - this.state.attacker) as PlayerId;
    this.updateUI();

    this.time.delayedCall(1600, () => {
      this.placeKickoff();
      this.rotateView(this.state.attacker, 'kickoff');
    });
  }

  private onFoul() {
    this.state.phase = 'foul';
    this.showStatus('Fault', '#ff4422');
    this.state.attacker = (1 - this.state.attacker) as PlayerId;
    this.lastFoulCoinIndex = this.state.lastKickedCoinIndex; // keep red until rotation
    this.splitDetected = false;
    this.resultHandled = false;
    this.kickoffMove = false;
    this.state.lastKickedCoinIndex = null;
    this.updateUI();
    this.time.delayedCall(1200, () => this.rotateView(this.state.attacker, 'playing'));
  }

  private rotateView(attacker: PlayerId, nextPhase: 'kickoff' | 'playing') {
    const targetRad = attacker === 0 ? 0 : Math.PI;
    this.tweens.add({
      targets: this.gameContainer,
      rotation: targetRad,
      duration: 600,
      ease: 'Quad.easeInOut',
      onComplete: () => {
        this.lastFoulCoinIndex = null;
        this.state.phase = nextPhase;
        this.updateUI();
      },
    });
  }

  // ─── Collision effects ────────────────────────────────────────────────────────

  private setupCollisions() {
    this.matter.world.on('collisionstart', (event: any) => {
      for (const pair of event.pairs) {
        const { bodyA, bodyB } = pair;
        const aIsCoin = bodyA.label === 'coin';
        const bIsCoin = bodyB.label === 'coin';
        const aIsWall = bodyA.label === 'wall' || bodyA.label === 'obstacle';
        const bIsWall = bodyB.label === 'wall' || bodyB.label === 'obstacle';

        if (aIsCoin && bIsCoin) {
          const spd = Math.hypot(
            (bodyA.velocity?.x ?? 0) - (bodyB.velocity?.x ?? 0),
            (bodyA.velocity?.y ?? 0) - (bodyB.velocity?.y ?? 0),
          );
          if (spd < 0.5) continue;
          const mx = ((bodyA.position.x as number) + (bodyB.position.x as number)) / 2;
          const my = ((bodyA.position.y as number) + (bodyB.position.y as number)) / 2;
          this.audio.coinClack(Math.min(spd / 12, 1));
          if (spd > 2) this.emitSparks(mx, my, spd, [0x00ffaa, 0xffffff, 0x00ff44], 14);
        } else if (aIsCoin && bIsWall) {
          const spd = Math.hypot(bodyA.velocity?.x ?? 0, bodyA.velocity?.y ?? 0);
          if (spd < 1) continue;
          this.audio.wallClick(Math.min(spd / 14, 1));
          if (spd > 3) this.emitSparks(bodyA.position.x as number, bodyA.position.y as number, spd, [0x0088ff, 0x00ccff], 7);
        } else if (bIsCoin && aIsWall) {
          const spd = Math.hypot(bodyB.velocity?.x ?? 0, bodyB.velocity?.y ?? 0);
          if (spd < 1) continue;
          this.audio.wallClick(Math.min(spd / 14, 1));
          if (spd > 3) this.emitSparks(bodyB.position.x as number, bodyB.position.y as number, spd, [0x0088ff, 0x00ccff], 7);
        }
      }
    });
  }

  private emitSparks(wx: number, wy: number, speed: number, colors: number[], count: number) {
    if (this.sparks.length > 80) return; // cap total
    const life = 180 + speed * 12;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.4 + Math.random() * 0.6) * speed * 0.4;
      this.sparks.push({
        x: wx, y: wy,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        life, maxLife: life,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }
  }

  private drawSparks() {
    const g = this.sparkGfx;
    g.clear();
    for (const s of this.sparks) {
      const t = s.life / s.maxLife;
      const alpha = t * t;
      const local = this.worldToLocal(s.x, s.y);
      // Draw as a short streak back along velocity
      const trailLen = Math.hypot(s.vx, s.vy) * 1.5 + 2;
      const vLen = Math.hypot(s.vx, s.vy) || 1;
      const tx = local.x - (s.vx / vLen) * trailLen;
      const ty = local.y - (s.vy / vLen) * trailLen;
      g.lineStyle(1.5, s.color, alpha);
      g.beginPath(); g.moveTo(local.x, local.y); g.lineTo(tx, ty); g.strokePath();
      // Bright tip
      g.fillStyle(0xffffff, alpha * 0.8);
      g.fillCircle(local.x, local.y, 1.2);
    }
  }

  // ─── Coordinate transforms ────────────────────────────────────────────────────

  private screenToWorld(sx: number, sy: number): Vec2 {
    const rad = this.gameContainer.rotation;
    if (rad === 0) return { x: sx, y: sy };
    const dx = sx - CX, dy = sy - CY;
    const cos = Math.cos(rad), sin = Math.sin(rad);
    return { x: CX + dx * cos + dy * sin, y: CY - dx * sin + dy * cos };
  }

  private worldToLocal(wx: number, wy: number): Vec2 {
    return { x: wx - CX, y: wy - CY };
  }

  // ─── Drawing ──────────────────────────────────────────────────────────────────

  private draw() {
    this.drawField();
    this.drawSplitLine();
    this.drawSparks();
    this.drawCoins();
    if (this.dragging) this.drawDrag();
    else this.dragGfx.clear();
  }

  private drawField() {
    const g = this.fieldGfx;
    g.clear();
    const verts = getFieldVertices(CX, CY, this.cfg).map(v => this.worldToLocal(v.x, v.y));
    const n = verts.length;

    // ── Dark fill ──
    g.fillStyle(C_DARK, 1);
    g.beginPath();
    g.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < n; i++) g.lineTo(verts[i].x, verts[i].y);
    g.closePath();
    g.fillPath();

    // ── Half tints: top half cyan, bottom half magenta ──
    // top half: polygon vertices with localY < 0, bridged at Y=0
    this.drawHalfTint(g, verts, true,  C_CYAN,    0.07);
    this.drawHalfTint(g, verts, false, C_MAGENTA, 0.07);

    // ── Centre circle ──
    g.lineStyle(1.5, C_CYAN, 0.5);
    g.strokeCircle(0, 0, 55);
    // dot at center
    g.fillStyle(C_CYAN, 0.6);
    g.fillCircle(0, 0, 3);

    // ── Centre dividing line ──
    const hw = FIELD_RADIUS * this.cfg.shape.scaleX;
    g.lineStyle(1, 0xffffff, 0.15);
    g.beginPath(); g.moveTo(-hw, 0); g.lineTo(hw, 0); g.strokePath();

    // ── Border: top half cyan, bottom half magenta (with glow) ──
    for (let i = 0; i < n; i++) {
      const a = verts[i], b = verts[(i + 1) % n];
      const midY = (a.y + b.y) / 2;
      const col = midY < 0 ? C_CYAN : C_MAGENTA;
      // glow
      g.lineStyle(6, col, 0.15);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
      // bright line
      g.lineStyle(2, col, 0.9);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
    }

    // ── Goals ──
    for (let gi = 0; gi < this.goals.length; gi++) {
      this.drawGoal(g, this.goals[gi], gi === 0 ? C_CYAN : C_MAGENTA);
    }

    // ── Centre obstacle ──
    const obs = 70;
    g.fillStyle(C_DARK, 1);
    g.fillRect(-obs, -obs, obs * 2, obs * 2);
    g.lineStyle(6, 0x334455, 0.4);
    g.strokeRect(-obs, -obs, obs * 2, obs * 2);
    g.lineStyle(2, 0x446688, 0.9);
    g.strokeRect(-obs, -obs, obs * 2, obs * 2);
  }

  /** Flood-fill a half of the polygon with a faint tint */
  private drawHalfTint(
    g: Phaser.GameObjects.Graphics,
    verts: Vec2[],
    topHalf: boolean,
    color: number,
    alpha: number,
  ) {
    const n = verts.length;
    const sign = topHalf ? -1 : 1; // top = localY < 0
    // collect points: polygon verts on correct side + interpolated crossings at Y=0
    const pts: Vec2[] = [];
    for (let i = 0; i < n; i++) {
      const a = verts[i], b = verts[(i + 1) % n];
      const aIn = sign * a.y <= 0;
      const bIn = sign * b.y <= 0;
      if (aIn) pts.push(a);
      if (aIn !== bIn) {
        // intersection with y=0
        const t = a.y / (a.y - b.y);
        pts.push({ x: a.x + t * (b.x - a.x), y: 0 });
      }
    }
    if (pts.length < 3) return;
    g.fillStyle(color, alpha);
    g.beginPath();
    g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath();
    g.fillPath();
  }

  private drawGoal(g: Phaser.GameObjects.Graphics, goal: GoalPost, color: number) {
    const lb = this.worldToLocal(goal.leftBase.x,  goal.leftBase.y);
    const lt = this.worldToLocal(goal.leftTip.x,   goal.leftTip.y);
    const rb = this.worldToLocal(goal.rightBase.x, goal.rightBase.y);
    const rt = this.worldToLocal(goal.rightTip.x,  goal.rightTip.y);

    // Glow
    g.lineStyle(8, color, 0.2);
    g.beginPath(); g.moveTo(lb.x, lb.y); g.lineTo(lt.x, lt.y); g.strokePath();
    g.beginPath(); g.moveTo(rb.x, rb.y); g.lineTo(rt.x, rt.y); g.strokePath();
    // Bright
    g.lineStyle(3, color, 1);
    g.beginPath(); g.moveTo(lb.x, lb.y); g.lineTo(lt.x, lt.y); g.strokePath();
    g.beginPath(); g.moveTo(rb.x, rb.y); g.lineTo(rt.x, rt.y); g.strokePath();

    // Scoring line
    g.lineStyle(1, C_GOLD, 0.5);
    g.beginPath(); g.moveTo(lt.x, lt.y); g.lineTo(rt.x, rt.y); g.strokePath();
  }

  private drawSplitLine() {
    const g = this.splitGfx;
    g.clear();

    // Never show during kickoff
    let kickedIdx: number | null = null;
    if (this.dragging && this.state.phase !== 'kickoff') {
      kickedIdx = this.dragCoinIndex;
    } else if (this.state.phase === 'simulating' && !this.kickoffMove && !this.splitDetected) {
      kickedIdx = this.state.lastKickedCoinIndex;
    }
    if (kickedIdx === null || this.coins.length < 3) return;

    const others = [0, 1, 2].filter(i => i !== kickedIdx);
    const a = this.worldToLocal(
      this.coins[others[0]].position.x as number,
      this.coins[others[0]].position.y as number,
    );
    const b = this.worldToLocal(
      this.coins[others[1]].position.x as number,
      this.coins[others[1]].position.y as number,
    );

    // Animate: regenerate jagged path every frame
    const pts = lightningPath(a, b, 3, 0.38);

    // Outer glow
    g.lineStyle(10, 0x00ff88, 0.1);
    strokePath(g, pts);
    // Mid glow
    g.lineStyle(4, 0x00ff88, 0.35);
    strokePath(g, pts);
    // Core
    g.lineStyle(1.2, 0xeeffee, 0.95);
    strokePath(g, pts);

    // End nodes — pulsing circle
    const pulse = 0.6 + 0.4 * Math.sin(this.time.now / 80);
    for (const pt of [a, b]) {
      g.lineStyle(2, 0x00ff88, 0.9 * pulse);
      g.strokeCircle(pt.x, pt.y, 5 + pulse * 2);
      g.fillStyle(0x00ff88, pulse * 0.7);
      g.fillCircle(pt.x, pt.y, 3);
    }
  }

  /**
   * Coin glow states:
   *   green  — ready to kick
   *   blue   — bystander / legally resolved
   *   red    — being kicked / kicked without legal split yet
   */
  private coinGlowState(i: number): 'green' | 'blue' | 'red' {
    const { phase, lastKickedCoinIndex } = this.state;

    // As soon as a coin is clicked/dragged, it goes red; the others go blue
    if (this.dragging) {
      return i === this.dragCoinIndex ? 'red' : 'blue';
    }

    if (phase === 'kickoff') {
      return i === 0 ? 'green' : 'blue';
    }

    if (phase === 'playing') {
      return i === lastKickedCoinIndex ? 'blue' : 'green';
    }

    if (phase === 'simulating') {
      if (i !== lastKickedCoinIndex) return 'blue';
      if (this.kickoffMove) return this.kickoffHitDetected ? 'blue' : 'red';
      return this.splitDetected ? 'blue' : 'red';
    }

    // foul / goal / gameover — show foul coin as red until rotation clears it
    if (i === this.lastFoulCoinIndex) return 'red';
    return 'blue';
  }

  private drawCoins() {
    const g = this.coinGfx;
    g.clear();

    const GLOW: Record<string, { glow: number; body: number; rim: number }> = {
      green: { glow: 0x00ff44, body: 0xccffdd, rim: 0x00ff44 },
      blue:  { glow: 0x0088ff, body: 0xaaccff, rim: 0x0088ff },
      red:   { glow: 0xff2200, body: 0xffcccc, rim: 0xff2200 },
    };

    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      const lx = (c.position.x as number) - CX;
      const ly = (c.position.y as number) - CY;
      const state = this.coinGlowState(i);
      const pal = GLOW[state];

      const r = this.cfg.coinRadius;

      // Outer glow
      g.lineStyle(14, pal.glow, 0.08);
      g.strokeCircle(lx, ly, r + 8);
      g.lineStyle(7, pal.glow, 0.22);
      g.strokeCircle(lx, ly, r + 4);

      // Shadow
      g.fillStyle(0x000000, 0.4);
      g.fillCircle(lx + 3, ly + 4, r);

      // Body
      g.fillStyle(pal.body, 1);
      g.fillCircle(lx, ly, r);
      // Specular highlight
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(lx - 4, ly - 4, r * 0.45);

      // Rim
      g.lineStyle(2, pal.rim, 0.9);
      g.strokeCircle(lx, ly, r);
    }
  }

  private drawDrag() {
    const g = this.dragGfx;
    g.clear();
    if (this.dragCoinIndex < 0) return;

    const coin = this.coins[this.dragCoinIndex];
    const coinLocal = this.worldToLocal(coin.position.x as number, coin.position.y as number);
    const mouseWorld = this.screenToWorld(this.dragScreenCurrent.x, this.dragScreenCurrent.y);
    const mouseLocal = this.worldToLocal(mouseWorld.x, mouseWorld.y);

    const dx = coinLocal.x - mouseLocal.x;
    const dy = coinLocal.y - mouseLocal.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 3) return;

    const power = Math.min(dist, 200);
    const t = power / 200;
    const alpha = 0.3 + t * 0.7;
    const nx = dx / dist, ny = dy / dist;

    // ── Pull-back indicator: faint electric line from mouse to coin ──
    const pullPts = lightningPath(mouseLocal, coinLocal, 2, 0.25);
    g.lineStyle(3, 0xff4400, 0.08 + t * 0.12);
    strokePath(g, pullPts);
    g.lineStyle(1, 0xff6600, 0.2 + t * 0.25);
    strokePath(g, pullPts);

    // ── Kick direction: bright lightning bolt forward from coin ──
    const arrowLen = t * 80 + 15;
    const tip = { x: coinLocal.x + nx * arrowLen, y: coinLocal.y + ny * arrowLen };

    // Draw 2 offset bolts for a thicker electric look
    for (let pass = 0; pass < 2; pass++) {
      const boltPts = lightningPath(coinLocal, tip, 3, 0.3);
      g.lineStyle(8,   C_CYAN, 0.05 * alpha);
      strokePath(g, boltPts);
      g.lineStyle(3,   C_CYAN, 0.25 * alpha);
      strokePath(g, boltPts);
      g.lineStyle(1.2, 0xffffff, 0.8 * alpha);
      strokePath(g, boltPts);
    }

    // Arrowhead
    const perpX = -ny * (6 + t * 4), perpY = nx * (6 + t * 4);
    g.fillStyle(0xffffff, alpha);
    g.fillTriangle(
      tip.x, tip.y,
      tip.x - nx * 14 + perpX, tip.y - ny * 14 + perpY,
      tip.x - nx * 14 - perpX, tip.y - ny * 14 - perpY,
    );
    // Tip glow
    g.lineStyle(6, C_CYAN, 0.4 * alpha);
    g.strokeCircle(tip.x, tip.y, 5 + t * 4);

    // Energy nodes along the bolt — small bright dots at random positions
    const nodeCount = Math.floor(t * 4) + 1;
    for (let i = 0; i < nodeCount; i++) {
      const frac = (i + 1) / (nodeCount + 1);
      const flicker = 0.5 + Math.random() * 0.5;
      g.fillStyle(0xffffff, flicker * alpha);
      g.fillCircle(
        coinLocal.x + nx * arrowLen * frac + (Math.random() - 0.5) * 4,
        coinLocal.y + ny * arrowLen * frac + (Math.random() - 0.5) * 4,
        1.5,
      );
    }
  }
}

// ─── Lightning helpers ────────────────────────────────────────────────────────

/**
 * Midpoint-displacement lightning between two points.
 * Returns an array of Vec2 vertices to stroke.
 */
function lightningPath(a: Vec2, b: Vec2, depth = 3, spread = 0.35): Vec2[] {
  if (depth === 0) return [a, b];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // Perpendicular offset
  const nx = -(b.y - a.y) / len;
  const ny =  (b.x - a.x) / len;
  const offset = (Math.random() - 0.5) * len * spread;
  const mid: Vec2 = { x: mx + nx * offset, y: my + ny * offset };
  const left  = lightningPath(a,   mid, depth - 1, spread * 0.6);
  const right = lightningPath(mid, b,   depth - 1, spread * 0.6);
  return [...left.slice(0, -1), ...right];
}

/** Stroke an array of Vec2 points as a polyline. */
function strokePath(g: Phaser.GameObjects.Graphics, pts: Vec2[]) {
  if (pts.length < 2) return;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.strokePath();
}

// ─── Geometry ─────────────────────────────────────────────────────────────────

function cross2d(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function segmentsIntersect(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): boolean {
  const d1 = cross2d(p3, p4, p1);
  const d2 = cross2d(p3, p4, p2);
  const d3 = cross2d(p1, p2, p3);
  const d4 = cross2d(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}
