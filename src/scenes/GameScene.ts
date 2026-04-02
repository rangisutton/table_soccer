import Phaser from 'phaser';
import RAPIER from '@dimforge/rapier2d-compat';
import {
  CANVAS_WIDTH, CANVAS_HEIGHT,
  COIN_RADIUS, WIN_GOALS,
} from '../config';
import { GameState, Vec2, GoalPost, PlayerId } from '../types';
import { GameConfig, DEFAULT_CONFIG } from '../FieldConfig';
import { LevelDef, EllipseDef, LookDef, LOOKS } from '../LevelDef';
import { alienLevel } from '../levels/alien';
import { GameAudio } from '../Audio';
import { net, ServerMsg } from '../net';

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
  private level!: LevelDef;
  private coins: RAPIER.RigidBody[] = [];
  private rapierWorld!: RAPIER.World;
  private eventQueue!: RAPIER.EventQueue;
  private colliderLabels = new Map<number, string>(); // collider handle → 'coin'|'wall'|'obstacle'
  private goals!: [GoalPost, GoalPost];
  private state!: GameState;

  // Visual theme
  private look!: LookDef;

  // Collision glow pulses (for 'ambient' collisionFX: 'glow')
  private glowPulses: { x: number; y: number; life: number; maxLife: number; color: number }[] = [];

  // Field image (optional, replaces procedural rendering)
  private fieldImg: Phaser.GameObjects.Image | null = null;
  private showFieldOverlay = false;

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
  private statusText!: Phaser.GameObjects.Text;

  // DOM panel elements
  private domP1Score!: HTMLElement;
  private domP2Score!: HTMLElement;
  private domP1Status!: HTMLElement;
  private domP2Status!: HTMLElement;
  private domP1Pips!: HTMLElement;
  private domP2Pips!: HTMLElement;

  // Drag input
  private dragging = false;
  private dragCoinIndex = -1;
  private dragScreenStart: Vec2 = { x: 0, y: 0 };
  private dragScreenCurrent: Vec2 = { x: 0, y: 0 };

  // Simulation tracking
  private prevCoinPos: Vec2[] = [];
  private splitDetected = false;
  private kickoffMove = true;
  private kickoffHitDetected = false; // kicked coin touched another coin during kickoff
  private resultHandled = false;
  private simFrameCount = 0;
  private lastFoulCoinIndex: number | null = null; // preserves red glow after illegal kick settles
  private pendingGoal: { scorer: PlayerId, isOwnGoal: boolean } | null = null;

  // Network mode
  private netMode = false;
  private netPlayerIndex: 0 | 1 = 0;
  private readonly handleNetKick = (msg: Extract<ServerMsg, { type: 'kick' }>) => this.applyNetworkKick(msg);
  private readonly handleNetPartnerDisc = () => {
    this.showStatus('Partner left', '#ff4422');
    this.time.delayedCall(1500, () => this.scene.start('MenuScene'));
  };

  constructor() {
    super({ key: 'GameScene' });
  }

  preload() {
    const level: LevelDef = this.registry.get('level') ?? alienLevel;
    if (level.imageUrl) {
      const key = `field_img_${level.id}`;
      this.textures.remove(key); // force reload in case image was updated
      this.load.on('loaderror', () => { /* modified image not yet placed — fall back to procedural */ });
      const base = import.meta.env.BASE_URL.replace(/\/$/, '');
      const url = level.imageUrl.startsWith('/') ? base + level.imageUrl : level.imageUrl;
      this.load.image(key, url);
    }
  }

  create() {
    this.cfg   = { ...(this.registry.get('gameConfig') ?? DEFAULT_CONFIG) };
    this.level = this.registry.get('level') ?? alienLevel;
    this.netMode        = this.registry.get('netMode')        ?? false;
    this.netPlayerIndex = this.registry.get('netPlayerIndex') ?? 0;
    this.goals = this.level.goals as [GoalPost, GoalPost];

    // Apply level coin config over menu settings
    if (this.level.coinConfig) {
      this.cfg.coinRadius = this.level.coinConfig.radius;
      this.cfg.kickPower  = this.level.coinConfig.kickPower;
      this.cfg.coinDrag   = this.level.coinConfig.drag;
    }

    this.look = LOOKS[this.level.look ?? 'neon'];

    this.rapierWorld = new RAPIER.World({ x: 0, y: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);
    this.colliderLabels = new Map();

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

    // Field image — sits behind everything; hides procedural rendering
    const imgKey = `field_img_${this.level.id}`;
    if (this.level.imageUrl && this.textures.exists(imgKey)) {
      this.fieldImg = this.add.image(0, 0, imgKey)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(CANVAS_WIDTH, CANVAS_HEIGHT);
      this.gameContainer.addAt(this.fieldImg, 0);
      this.fieldGfx.setVisible(false);
    } else {
      this.fieldImg = null;
    }

    // Tab toggles procedural overlay back on top of the image
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      if (!this.fieldImg) return;
      this.showFieldOverlay = !this.showFieldOverlay;
      this.fieldGfx.setVisible(this.showFieldOverlay);
    });

    this.buildWalls();
    this.placeKickoff();
    this.setupInput();

    // Esc → menu, F1 → reset same level
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MenuScene'));
    this.input.keyboard?.on('keydown-F1',  (e: KeyboardEvent) => { e.preventDefault(); this.scene.restart(); });

    this.createSettingsPanel();
    this.draw();
    this.updateUI();

    if (this.netMode) {
      net.on('kick',                 this.handleNetKick);
      net.on('partner-disconnected', this.handleNetPartnerDisc);
      this.events.once('shutdown', () => {
        net.off('kick',                 this.handleNetKick);
        net.off('partner-disconnected', this.handleNetPartnerDisc);
      });
    }
  }

  // ─── UI ──────────────────────────────────────────────────────────────────────

  private createUI() {
    this.domP1Score  = document.getElementById('p1-score')!;
    this.domP2Score  = document.getElementById('p2-score')!;
    this.domP1Status = document.getElementById('p1-status')!;
    this.domP2Status = document.getElementById('p2-status')!;
    this.domP1Pips   = document.getElementById('p1-pips')!;
    this.domP2Pips   = document.getElementById('p2-pips')!;

    this.statusText = this.add.text(CX, CY, '', {
      fontSize: '64px', fontFamily: 'monospace', fontStyle: 'bold',
      color: '#ffffff', stroke: '#000022', strokeThickness: 10, align: 'center',
    }).setOrigin(0.5, 0.5).setAlpha(0).setDepth(55);
  }

  private updateUI() {
    const { scores, attacker, phase } = this.state;

    this.domP1Score.textContent = `${scores[0]}`;
    this.domP2Score.textContent = `${scores[1]}`;

    // Goal pip indicators
    const renderPips = (el: HTMLElement, score: number, color: string) => {
      el.innerHTML = '';
      for (let i = 0; i < WIN_GOALS; i++) {
        const pip = document.createElement('div');
        pip.className = 'pip' + (i < score ? ' filled' : '');
        pip.style.color = color;
        el.appendChild(pip);
      }
    };
    renderPips(this.domP1Pips, scores[0], '#00ffee');
    renderPips(this.domP2Pips, scores[1], '#ff00cc');

    // Active player highlight
    const panelLeft  = document.getElementById('panel-left')!;
    const panelRight = document.getElementById('panel-right')!;
    const p1Active = phase !== 'gameover' && attacker === 0;
    const p2Active = phase !== 'gameover' && attacker === 1;
    panelLeft.classList.toggle('is-active',  p1Active);
    panelRight.classList.toggle('is-active', p2Active);

    if (phase === 'gameover') {
      const winner = scores[0] >= WIN_GOALS ? 0 : 1;
      this.domP1Status.textContent = winner === 0 ? 'Winner!' : '';
      this.domP2Status.textContent = winner === 1 ? 'Winner!' : '';
    } else {
      const activeStatus = (
        phase === 'kickoff' ? 'Kick off!' :
        phase === 'playing' ? 'Choose a coin' : ''
      );
      this.domP1Status.textContent = attacker === 0 ? activeStatus : '';
      this.domP2Status.textContent = attacker === 1 ? activeStatus : '';
    }
  }

  private showStatus(msg: string, color: string) {
    this.statusText.setText(msg).setColor(color).setAlpha(1);
    this.tweens.killTweensOf(this.statusText);
    this.tweens.add({ targets: this.statusText, alpha: 0, delay: 1000, duration: 500 });
  }

  // ─── Settings panel ───────────────────────────────────────────────────────────

  private createSettingsPanel() {
    const panel = document.getElementById('settings-panel')!;
    panel.style.display = 'block';
    panel.innerHTML = '';

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
        set: (v) => { this.cfg.coinDrag = v; for (const c of this.coins) c.setLinearDamping(v); },
        step: 0.5, min: 0.0, max: 30.0,
        fmt: (v) => v.toFixed(1),
      },
    ];

    for (const ctrl of controls) {
      const row = document.createElement('div');
      row.className = 'setting-row';

      const lbl = document.createElement('span');
      lbl.className = 'setting-label';
      lbl.textContent = ctrl.label;

      const val = document.createElement('span');
      val.className = 'setting-val';
      val.textContent = ctrl.fmt(ctrl.get());

      const mkBtn = (delta: number, text: string) => {
        const btn = document.createElement('button');
        btn.className = 'setting-btn';
        btn.textContent = text;
        btn.addEventListener('click', () => {
          const next = Math.round((ctrl.get() + delta) * 1000) / 1000;
          ctrl.set(Math.max(ctrl.min, Math.min(ctrl.max, next)));
          val.textContent = ctrl.fmt(ctrl.get());
        });
        return btn;
      };

      row.appendChild(lbl);
      row.appendChild(mkBtn(-ctrl.step, '−'));
      row.appendChild(val);
      row.appendChild(mkBtn(+ctrl.step, '+'));
      panel.appendChild(row);
    }

    this.events.once('shutdown', () => {
      panel.style.display = 'none';
      panel.innerHTML = '';
    });
  }

  // ─── Physics walls ────────────────────────────────────────────────────────────

  private buildWalls() {
    const { boundary, goals, blockers } = this.level;
    const n = boundary.length;

    // Build a set of edge indices that are goal openings — skip those
    const goalEdgeMids = new Set<string>();
    for (const goal of goals) {
      // Find which boundary edge this goal sits on by matching midpoint proximity
      for (let i = 0; i < n; i++) {
        const a = boundary[i], b = boundary[(i + 1) % n];
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const gMx = (goal.leftBase.x + goal.rightBase.x) / 2;
        const gMy = (goal.leftBase.y + goal.rightBase.y) / 2;
        if (Math.hypot(mx - gMx, my - gMy) < 4) {
          goalEdgeMids.add(i.toString());
          break;
        }
      }
    }

    // Boundary walls (skip goal edges)
    for (let i = 0; i < n; i++) {
      if (goalEdgeMids.has(i.toString())) continue;
      this.addWall(boundary[i], boundary[(i + 1) % n]);
    }

    // Goal spokes
    for (const goal of goals) {
      this.addWall(goal.leftBase,  goal.leftTip);
      this.addWall(goal.rightBase, goal.rightTip);
    }

    // Blockers — shift walls inward (toward centroid) so the outer face sits on
    // the drawn edge and coins approaching from the field hit the correct surface.
    // For field levels, also add the 180° mirrored copy of each blocker.
    const allBlockers = this.level.type === 'field'
      ? [...blockers, ...blockers.map(b => b.map(v => ({ x: 2 * CX - v.x, y: 2 * CY - v.y })))]
      : blockers;

    for (const blocker of allBlockers) {
      const m = blocker.length;
      const centX = blocker.reduce((s, v) => s + v.x, 0) / m;
      const centY = blocker.reduce((s, v) => s + v.y, 0) / m;
      for (let i = 0; i < m; i++) {
        const a = blocker[i], b = blocker[(i + 1) % m];
        if (Math.hypot(b.x - a.x, b.y - a.y) < 1) continue; // skip duplicate/zero-length edges
        this.addWall(a, b, centX, centY, true);
      }
    }

    // Ellipse blockers — approximated as convex polygon colliders
    const srcEllipses = this.level.ellipses ?? [];
    const allEllipses: EllipseDef[] = this.level.type === 'field'
      ? [...srcEllipses, ...srcEllipses.map(e => ({ ...e, x: 2 * CX - e.x, y: 2 * CY - e.y }))]
      : srcEllipses;

    for (const ell of allEllipses) {
      this.addEllipseWall(ell);
    }
  }

  private addEllipseWall(e: EllipseDef) {
    const N = 24;
    const pts = new Float32Array(N * 2);
    const cos = Math.cos(e.angle), sin = Math.sin(e.angle);
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N;
      const lx = e.rx * Math.cos(a), ly = e.ry * Math.sin(a);
      pts[i * 2]     = e.x + lx * cos - ly * sin;
      pts[i * 2 + 1] = e.y + lx * sin + ly * cos;
    }
    const body = this.rapierWorld.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const hull = RAPIER.ColliderDesc.convexHull(pts);
    if (!hull) return;
    const col = this.rapierWorld.createCollider(
      hull.setRestitution(1.0).setFriction(0.0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    this.colliderLabels.set(col.handle, 'wall');
  }

  /**
   * Add a wall segment flush with the drawn edge.
   * The rectangle is shifted outward by half its thickness so its inner face
   * sits exactly on the a–b line, eliminating the inward offset.
   * Length is extended by the wall thickness at each end to overlap corners
   * and close the seam gap between adjacent segments.
   */
  private addWall(a: Vec2, b: Vec2, refX = CX, refY = CY, inward = false) {
    // CCD on coins handles tunneling — walls can be thinner than Matter.js needed
    const t = 20;
    const dx = b.x - a.x, dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dy, dx);

    // Shift wall outward from the reference point (field centre for boundary,
    // blocker centroid for blockers) so its inner face aligns with the drawn edge
    const nx = dy / len, ny = -dx / len;
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const dot = nx * (refX - midX) + ny * (refY - midY);
    // inward=false (boundary): shift away from ref so inner face is on edge
    // inward=true (blocker):   shift toward ref so outer face is on edge
    const outX = inward ? (dot > 0 ? nx : -nx) : (dot > 0 ? -nx : nx);
    const outY = inward ? (dot > 0 ? ny : -ny) : (dot > 0 ? -ny : ny);

    // Shift outward so inner face aligns with drawn edge
    const cx = midX + outX * (t / 2);
    const cy = midY + outY * (t / 2);

    const body = this.rapierWorld.createRigidBody(
      RAPIER.RigidBodyDesc.fixed().setTranslation(cx, cy).setRotation(angle),
    );
    const col = this.rapierWorld.createCollider(
      RAPIER.ColliderDesc.cuboid((len + t) / 2, t / 2)
        .setRestitution(1.0).setFriction(0.0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body,
    );
    this.colliderLabels.set(col.handle, 'wall');
  }

  // ─── Coin placement ───────────────────────────────────────────────────────────

  private placeKickoff() {
    for (const c of this.coins) this.rapierWorld.removeRigidBody(c);
    this.coins = [];
    this.resetSimState();
    this.kickoffMove = true;

    const r = this.cfg.coinRadius;
    const jitter = () => (Math.random() - 0.5) * r * 0.2;

    // P1 uses level start positions; P2 gets them mirrored through centre
    const base = this.level.start;
    const pts: Vec2[] = this.state.attacker === 0
      ? base.map(p => ({ x: p.x + jitter(), y: p.y + jitter() }))
      : base.map(p => ({ x: 2 * CX - p.x + jitter(), y: 2 * CY - p.y + jitter() }));

    for (const p of pts) {
      const body = this.rapierWorld.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(p.x, p.y)
          .setLinearDamping(this.cfg.coinDrag)
          .setCcdEnabled(true),
      );
      const col = this.rapierWorld.createCollider(
        RAPIER.ColliderDesc.ball(r)
          .setRestitution(0.95).setFriction(0.0)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body,
      );
      this.colliderLabels.set(col.handle, 'coin');
      this.coins.push(body);
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
      if (this.netMode && this.state.attacker !== this.netPlayerIndex) return;
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
      try { this.eventQueue.free(); } catch (_) { /* ignore WASM cleanup errors */ }
      try { this.rapierWorld.free(); } catch (_) { /* ignore WASM cleanup errors */ }
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
      const pos = this.coins[i].translation();
      const dx = pos.x - world.x;
      const dy = pos.y - world.y;
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
    // Rapier velocity is px/s — multiply by 60 to match previous px/frame behaviour
    const spd = power * 7.2 * this.cfg.kickPower;
    const vx = (dx / dist) * spd;
    const vy = (dy / dist) * spd;
    this.coins[idx].setLinvel({ x: vx, y: vy }, true);

    if (this.netMode) net.send({ type: 'kick', coinIndex: idx, vx, vy });

    this.applyKickState(idx);
  }

  private applyNetworkKick(msg: Extract<ServerMsg, { type: 'kick' }>) {
    const coin = this.coins[msg.coinIndex];
    if (!coin) return;
    coin.setLinvel({ x: msg.vx, y: msg.vy }, true);
    this.applyKickState(msg.coinIndex);
  }

  private applyKickState(idx: number) {
    this.state.lastKickedCoinIndex = idx;
    this.state.phase = 'simulating';
    this.splitDetected = false;
    this.resultHandled = false;
    this.pendingGoal = null;
    this.simFrameCount = 0;
    // Seed prevCoinPos so frame-1 checks (kickoff hit, goal, escape) are not skipped
    this.prevCoinPos = this.coins.map(c => { const t = c.translation(); return { x: t.x, y: t.y }; });
    this.updateUI();
  }

  // ─── Game loop ────────────────────────────────────────────────────────────────

  update(_time: number, delta: number) {
    this.rapierWorld.step(this.eventQueue);
    this.processCollisionEvents();
    if (this.state.phase === 'simulating') this.runSimulationChecks();
    // Advance sparks and glow pulses
    const dt = delta / 16.67; // normalise to 60fps
    this.sparks = this.sparks.filter(s => {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.vx *= 0.88; s.vy *= 0.88;
      s.life -= delta;
      return s.life > 0;
    });
    this.glowPulses = this.glowPulses.filter(p => { p.life -= delta; return p.life > 0; });
    this.draw();
  }

  private runSimulationChecks() {
    this.simFrameCount++;
    const ki = this.state.lastKickedCoinIndex!;
    const cur: Vec2[] = this.coins.map(c => {
      const t = c.translation(); return { x: t.x, y: t.y };
    });
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
      // Record first coin to cross a goal — resolved on settlement
      if (!this.pendingGoal) {
        outer: for (let ci = 0; ci < this.coins.length; ci++) {
          if (!prev[ci]) continue;
          for (const goal of this.goals) {
            if (segmentsIntersect(prev[ci], cur[ci], goal.leftTip, goal.rightTip)) {
              this.pendingGoal = { scorer: goal.scorer, isOwnGoal: goal.scorer !== this.state.attacker };
              break outer;
            }
          }
        }
      }
      if (!this.resultHandled) {
        const maxR = Math.max(...this.level.boundary.map(v => Math.hypot(v.x - CX, v.y - CY))) + COIN_RADIUS * 2;
        let escaped = false;
        for (let ci = 0; ci < this.coins.length; ci++) {
          if (Math.hypot(cur[ci].x - CX, cur[ci].y - CY) > maxR) {
            // Teleport back to centre so the game stays playable
            this.coins[ci].setTranslation({ x: CX, y: CY }, true);
            this.coins[ci].setLinvel({ x: 0, y: 0 }, true);
            escaped = true;
          }
        }
        if (escaped) {
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
      if (c.isSleeping()) return true;
      const v = c.linvel();
      return Math.hypot(v.x, v.y) < 5; // px/s — Rapier units
    });
  }

  private onSettled() {
    const isLegal = this.kickoffMove ? this.kickoffHitDetected : this.splitDetected;

    if (!isLegal) {
      this.pendingGoal = null;
      this.onFoul();
      return;
    }

    if (this.pendingGoal) {
      const { scorer, isOwnGoal } = this.pendingGoal;
      this.pendingGoal = null;
      this.kickoffMove = false;
      this.onGoal(scorer, isOwnGoal);
      return;
    }

    // Legal kick, no goal — continue play
    this.kickoffMove = false;
    this.state.phase = 'playing';
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
    const wasKickoff = this.kickoffMove;
    this.state.phase = 'foul';
    this.showStatus('Fault', '#ff4422');
    this.state.attacker = (1 - this.state.attacker) as PlayerId;
    this.lastFoulCoinIndex = this.state.lastKickedCoinIndex; // keep red until rotation
    this.splitDetected = false;
    this.resultHandled = false;
    this.pendingGoal = null;
    this.kickoffMove = false;
    this.state.lastKickedCoinIndex = null;
    this.updateUI();
    if (wasKickoff) {
      this.time.delayedCall(1200, () => {
        this.placeKickoff();
        this.rotateView(this.state.attacker, 'kickoff');
      });
    } else {
      this.time.delayedCall(1200, () => this.rotateView(this.state.attacker, 'playing'));
    }
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

  private processCollisionEvents() {
    this.eventQueue.drainCollisionEvents((h1: number, h2: number, started: boolean) => {
      if (!started) return;
      const col1 = this.rapierWorld.getCollider(h1);
      const col2 = this.rapierWorld.getCollider(h2);
      const label1 = this.colliderLabels.get(h1) ?? '';
      const label2 = this.colliderLabels.get(h2) ?? '';
      const body1 = col1.parent();
      const body2 = col2.parent();
      if (!body1 || !body2) return;

      const aIsCoin = label1 === 'coin';
      const bIsCoin = label2 === 'coin';
      const aIsWall = label1 === 'wall' || label1 === 'obstacle';
      const bIsWall = label2 === 'wall' || label2 === 'obstacle';

      if (aIsCoin && bIsCoin) {
        const va = body1.linvel(), vb = body2.linvel();
        // Rapier velocity is px/s; scale thresholds accordingly (×60 vs old px/frame)
        const spd = Math.hypot(va.x - vb.x, va.y - vb.y);
        if (spd < 30) return;
        const p1 = body1.translation(), p2 = body2.translation();
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        this.audio.coinClack(Math.min(spd / 720, 1));
        if (spd > 120) this.emitCollisionFX(mx, my, spd, 'coin');
      } else if ((aIsCoin && bIsWall) || (bIsCoin && aIsWall)) {
        const coinBody = aIsCoin ? body1 : body2;
        const v = coinBody.linvel();
        const spd = Math.hypot(v.x, v.y);
        if (spd < 60) return;
        const p = coinBody.translation();
        this.audio.wallClick(Math.min(spd / 840, 1));
        if (spd > 180) this.emitCollisionFX(p.x, p.y, spd, 'wall');
      }
    });
  }

  private emitCollisionFX(wx: number, wy: number, spd: number, source: 'coin' | 'wall') {
    const fx = this.look.collisionFX;
    if (fx === 'none') return;

    if (fx === 'sparks') {
      if (this.sparks.length > 80) return;
      const colors = source === 'coin'
        ? [0x00ffaa, 0xffffff, 0x00ff44]
        : [0x0088ff, 0x00ccff];
      const count = source === 'coin' ? 14 : 7;
      const speed = spd / 60;
      const life = 180 + speed * 12;
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const s = (0.4 + Math.random() * 0.6) * speed * 0.4;
        this.sparks.push({
          x: wx, y: wy,
          vx: Math.cos(angle) * s,
          vy: Math.sin(angle) * s,
          life, maxLife: life,
          color: colors[Math.floor(Math.random() * colors.length)],
        });
      }
    } else if (fx === 'glow') {
      const color = source === 'coin' ? 0x00ffaa : 0x4499ff;
      const life = 300 + (spd / 60) * 8;
      this.glowPulses.push({ x: wx, y: wy, life, maxLife: life, color });
    }
  }

  private drawCollisionFX() {
    const g = this.sparkGfx;
    g.clear();

    // Sparks
    for (const s of this.sparks) {
      const t = s.life / s.maxLife;
      const alpha = t * t;
      const local = this.worldToLocal(s.x, s.y);
      const trailLen = Math.hypot(s.vx, s.vy) * 1.5 + 2;
      const vLen = Math.hypot(s.vx, s.vy) || 1;
      const tx = local.x - (s.vx / vLen) * trailLen;
      const ty = local.y - (s.vy / vLen) * trailLen;
      g.lineStyle(1.5, s.color, alpha);
      g.beginPath(); g.moveTo(local.x, local.y); g.lineTo(tx, ty); g.strokePath();
      g.fillStyle(0xffffff, alpha * 0.8);
      g.fillCircle(local.x, local.y, 1.2);
    }

    // Glow pulses
    for (const p of this.glowPulses) {
      const t = p.life / p.maxLife;
      const alpha = t * (1 - t) * 4; // ramps up then fades
      const local = this.worldToLocal(p.x, p.y);
      const radius = 20 + (1 - t) * 40;
      g.lineStyle(12, p.color, alpha * 0.25);
      g.strokeCircle(local.x, local.y, radius);
      g.lineStyle(4, p.color, alpha * 0.6);
      g.strokeCircle(local.x, local.y, radius * 0.55);
      g.fillStyle(p.color, alpha * 0.15);
      g.fillCircle(local.x, local.y, radius);
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
    this.drawCollisionFX();
    this.drawCoins();
    if (this.dragging) this.drawDrag();
    else this.dragGfx.clear();
  }

  private drawField() {
    const g = this.fieldGfx;
    g.clear();
    if (!g.visible) return;
    const verts = this.level.boundary.map(v => this.worldToLocal(v.x, v.y));
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

    // ── Centre dividing line — span the full field width ──
    const hw = Math.max(...this.level.boundary.map(v => Math.abs(v.x - CX)));
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

    // ── Blockers (polygon) ──
    const allPolyBlockers = this.level.type === 'field'
      ? [...this.level.blockers, ...this.level.blockers.map(b => b.map(v => ({ x: 2 * CX - v.x, y: 2 * CY - v.y })))]
      : this.level.blockers;

    for (const blocker of allPolyBlockers) {
      const bverts = blocker.map(v => this.worldToLocal(v.x, v.y));
      if (bverts.length < 2) continue;
      g.fillStyle(C_DARK, 1);
      g.beginPath();
      g.moveTo(bverts[0].x, bverts[0].y);
      for (let i = 1; i < bverts.length; i++) g.lineTo(bverts[i].x, bverts[i].y);
      g.closePath(); g.fillPath();
      g.lineStyle(6, 0x334455, 0.4);
      g.beginPath();
      g.moveTo(bverts[0].x, bverts[0].y);
      for (let i = 1; i < bverts.length; i++) g.lineTo(bverts[i].x, bverts[i].y);
      g.closePath(); g.strokePath();
      g.lineStyle(2, 0x446688, 0.9);
      g.beginPath();
      g.moveTo(bverts[0].x, bverts[0].y);
      for (let i = 1; i < bverts.length; i++) g.lineTo(bverts[i].x, bverts[i].y);
      g.closePath(); g.strokePath();
    }

    // ── Blockers (ellipse) ──
    const srcEllipses = this.level.ellipses ?? [];
    const allEllipses: EllipseDef[] = this.level.type === 'field'
      ? [...srcEllipses, ...srcEllipses.map(e => ({ ...e, x: 2 * CX - e.x, y: 2 * CY - e.y }))]
      : srcEllipses;

    for (const ell of allEllipses) {
      this.drawEllipseBlocker(g, ell);
    }
  }

  private drawEllipseBlocker(g: Phaser.GameObjects.Graphics, e: EllipseDef) {
    const N = 32;
    const local = this.worldToLocal(e.x, e.y);
    const cos = Math.cos(e.angle), sin = Math.sin(e.angle);
    const pts: Vec2[] = [];
    for (let i = 0; i < N; i++) {
      const a = (2 * Math.PI * i) / N;
      const lx = e.rx * Math.cos(a), ly = e.ry * Math.sin(a);
      pts.push({ x: local.x + lx * cos - ly * sin, y: local.y + lx * sin + ly * cos });
    }
    g.fillStyle(C_DARK, 1);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.fillPath();
    g.lineStyle(6, 0x334455, 0.4);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.strokePath();
    g.lineStyle(2, 0x446688, 0.9);
    g.beginPath(); g.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < N; i++) g.lineTo(pts[i].x, pts[i].y);
    g.closePath(); g.strokePath();
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
    const posA = this.coins[others[0]].translation();
    const posB = this.coins[others[1]].translation();
    const a = this.worldToLocal(posA.x, posA.y);
    const b = this.worldToLocal(posB.x, posB.y);

    const lineStyle = this.look.intersectionLine;
    if (lineStyle === 'none') return;

    if (lineStyle === 'electric') {
      const pts = lightningPath(a, b, 3, 0.38);
      g.lineStyle(10, 0x00ff88, 0.1);
      strokePath(g, pts);
      g.lineStyle(4, 0x00ff88, 0.35);
      strokePath(g, pts);
      g.lineStyle(1.2, 0xeeffee, 0.95);
      strokePath(g, pts);
      const pulse = 0.6 + 0.4 * Math.sin(this.time.now / 80);
      for (const pt of [a, b]) {
        g.lineStyle(2, 0x00ff88, 0.9 * pulse);
        g.strokeCircle(pt.x, pt.y, 5 + pulse * 2);
        g.fillStyle(0x00ff88, pulse * 0.7);
        g.fillCircle(pt.x, pt.y, 3);
      }
    } else {
      // straight
      g.lineStyle(1.5, 0x00ff88, 0.5);
      g.beginPath(); g.moveTo(a.x, a.y); g.lineTo(b.x, b.y); g.strokePath();
      for (const pt of [a, b]) {
        g.fillStyle(0x00ff88, 0.6);
        g.fillCircle(pt.x, pt.y, 3);
      }
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

    const PAL: Record<string, { glow: number; body: number; rim: number }> = {
      green: { glow: 0x00ff44, body: 0xccffdd, rim: 0x00ff44 },
      blue:  { glow: 0x0088ff, body: 0xaaccff, rim: 0x0088ff },
      red:   { glow: 0xff2200, body: 0xffcccc, rim: 0xff2200 },
    };

    for (let i = 0; i < this.coins.length; i++) {
      const c = this.coins[i];
      const pos = c.translation();
      const lx = pos.x - CX;
      const ly = pos.y - CY;
      const glowState = this.coinGlowState(i);
      const pal = PAL[glowState];
      const r = this.cfg.coinRadius;

      if (this.look.coinRendering === 'glow') {
        // Outer glow rings
        g.lineStyle(14, pal.glow, 0.08);
        g.strokeCircle(lx, ly, r + 8);
        g.lineStyle(7, pal.glow, 0.22);
        g.strokeCircle(lx, ly, r + 4);
      } else {
        // Drop shadow
        g.fillStyle(0x000000, 0.45);
        g.fillCircle(lx + 4, ly + 5, r);
      }

      // Body
      g.fillStyle(pal.body, 1);
      g.fillCircle(lx, ly, r);
      // Specular highlight
      g.fillStyle(0xffffff, 0.55);
      g.fillCircle(lx - 4, ly - 4, r * 0.45);

      // Rim — subtle for drop-shadow, bright for glow
      const rimAlpha = this.look.coinRendering === 'glow' ? 0.9 : 0.4;
      g.lineStyle(2, pal.rim, rimAlpha);
      g.strokeCircle(lx, ly, r);
    }
  }

  private drawDrag() {
    const g = this.dragGfx;
    g.clear();
    if (this.dragCoinIndex < 0) return;

    const coin = this.coins[this.dragCoinIndex];
    const coinPos = coin.translation();
    const coinLocal = this.worldToLocal(coinPos.x, coinPos.y);
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

    const arrowLen = t * 80 + 15;
    const tip = { x: coinLocal.x + nx * arrowLen, y: coinLocal.y + ny * arrowLen };
    const electric = this.look.intersectionLine !== 'straight';

    if (electric) {
      // ── Pull-back: faint electric line from mouse to coin ──
      const pullPts = lightningPath(mouseLocal, coinLocal, 2, 0.25);
      g.lineStyle(3, 0xff4400, 0.08 + t * 0.12);
      strokePath(g, pullPts);
      g.lineStyle(1, 0xff6600, 0.2 + t * 0.25);
      strokePath(g, pullPts);

      // ── Kick direction: lightning bolt ──
      for (let pass = 0; pass < 2; pass++) {
        const boltPts = lightningPath(coinLocal, tip, 3, 0.3);
        g.lineStyle(8,   C_CYAN, 0.05 * alpha); strokePath(g, boltPts);
        g.lineStyle(3,   C_CYAN, 0.25 * alpha); strokePath(g, boltPts);
        g.lineStyle(1.2, 0xffffff, 0.8 * alpha); strokePath(g, boltPts);
      }
      // Energy nodes
      const nodeCount = Math.floor(t * 4) + 1;
      for (let i = 0; i < nodeCount; i++) {
        const frac = (i + 1) / (nodeCount + 1);
        g.fillStyle(0xffffff, (0.5 + Math.random() * 0.5) * alpha);
        g.fillCircle(
          coinLocal.x + nx * arrowLen * frac + (Math.random() - 0.5) * 4,
          coinLocal.y + ny * arrowLen * frac + (Math.random() - 0.5) * 4,
          1.5,
        );
      }
    } else {
      // ── Pull-back: simple line ──
      g.lineStyle(1.5, 0xff6600, 0.2 + t * 0.3);
      g.beginPath(); g.moveTo(mouseLocal.x, mouseLocal.y); g.lineTo(coinLocal.x, coinLocal.y); g.strokePath();

      // ── Kick direction: straight arrow ──
      g.lineStyle(2, C_CYAN, 0.5 * alpha);
      g.beginPath(); g.moveTo(coinLocal.x, coinLocal.y); g.lineTo(tip.x, tip.y); g.strokePath();
    }

    // Arrowhead (both styles)
    const perpX = -ny * (6 + t * 4), perpY = nx * (6 + t * 4);
    g.fillStyle(0xffffff, alpha);
    g.fillTriangle(
      tip.x, tip.y,
      tip.x - nx * 14 + perpX, tip.y - ny * 14 + perpY,
      tip.x - nx * 14 - perpX, tip.y - ny * 14 - perpY,
    );
    if (electric) {
      g.lineStyle(6, C_CYAN, 0.4 * alpha);
      g.strokeCircle(tip.x, tip.y, 5 + t * 4);
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
