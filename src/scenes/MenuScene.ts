import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { GameConfig, DEFAULT_CONFIG } from '../FieldConfig';
import { LevelDef } from '../LevelDef';
import { fieldLevels, courseLevels } from '../levels/index';
import { net, Player, ServerMsg } from '../net';

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;
const C_CYAN    = 0x00ffee;
const C_GOLD    = 0xffcc00;
const C_DARK    = 0x030320;

// ─── Lobby state ──────────────────────────────────────────────────────────────

type LobbyState =
  | 'name-entry'
  | 'connecting'
  | 'lobby'
  | 'pending-out'   // we sent a pair request, waiting
  | 'pending-in'    // we received a pair request
  | 'paired';       // paired, pick level and start

export class MenuScene extends Phaser.Scene {
  private cfg!: GameConfig;
  private selectedLevel!: LevelDef;
  private levelBtns: { level: LevelDef; bg: Phaser.GameObjects.Rectangle; label: Phaser.GameObjects.Text }[] = [];

  // ─── Lobby state ────────────────────────────────────────────────────────────
  private lobbyEl: HTMLDivElement | null = null;
  private lobbyState: LobbyState = 'name-entry';
  private pendingPairFrom: string | null = null; // incoming pair requester
  private pendingPairTo: string | null = null;   // outgoing pair target
  private onlineStatusEl: HTMLDivElement | null = null; // small status bar under buttons
  private playTxt: Phaser.GameObjects.Text | null = null;
  private handlersRegistered = false;

  // Stored handler refs for net.off() cleanup
  private readonly handleUserList      = (msg: Extract<ServerMsg, { type: 'user-list' }>)            => this.onUserList(msg);
  private readonly handlePairRequest   = (msg: Extract<ServerMsg, { type: 'pair-request' }>)         => this.onPairRequest(msg);
  private readonly handlePaired        = (msg: Extract<ServerMsg, { type: 'paired' }>)               => this.onPaired(msg);
  private readonly handlePairRejected  = (msg: Extract<ServerMsg, { type: 'pair-rejected' }>)        => this.onPairRejected(msg);
  private readonly handleUnpairing     = (msg: Extract<ServerMsg, { type: 'unpairing' }>)            => this.onUnpairing(msg);
  private readonly handlePartnerDisc   = (msg: Extract<ServerMsg, { type: 'partner-disconnected' }>) => this.onPartnerDisconnected(msg);
  private readonly handleSelectLevel   = (msg: Extract<ServerMsg, { type: 'select-level' }>)         => this.onSelectLevel(msg);

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
    const pairedNow = net.connected && !!net.partner;
    const playBg = this.add.rectangle(CX - 68, y, 120, 52, 0x000000, 0)
      .setStrokeStyle(2, C_GOLD).setInteractive({ useHandCursor: true });
    this.playTxt = this.add.text(CX - 68, y, pairedNow ? 'PLAY\nONLINE' : 'PLAY', {
      fontSize: pairedNow ? '16px' : '28px', fontFamily: 'monospace', fontStyle: 'bold', color: '#ffcc00',
      align: 'center',
    }).setOrigin(0.5, 0.5);

    playBg.on('pointerover', () => { playBg.setFillStyle(C_GOLD, 0.15); this.playTxt!.setColor('#ffffff'); });
    playBg.on('pointerout',  () => { playBg.setFillStyle(0, 0);         this.playTxt!.setColor('#ffcc00'); });
    playBg.on('pointerup',   () => {
      this.registry.set('gameConfig', { ...this.cfg });
      this.registry.set('level', this.selectedLevel);
      if (net.connected && net.partner) {
        net.send({ type: 'select-level', levelId: this.selectedLevel.id });
        this.registry.set('netMode', true);
        this.registry.set('netPlayerIndex', 0);
      } else {
        this.registry.set('netMode', false);
      }
      this.scene.start('GameScene');
    });

    // ── Online button ─────────────────────────────────────────────────────────
    const onlineBg = this.add.rectangle(CX + 68, y, 120, 52, 0x000000, 0)
      .setStrokeStyle(2, C_CYAN).setInteractive({ useHandCursor: true });
    const onlineTxt = this.add.text(CX + 68, y, 'ONLINE', {
      fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', color: '#00ffee',
    }).setOrigin(0.5, 0.5);

    onlineBg.on('pointerover', () => { onlineBg.setFillStyle(C_CYAN, 0.15); onlineTxt.setColor('#ffffff'); });
    onlineBg.on('pointerout',  () => { onlineBg.setFillStyle(0, 0);         onlineTxt.setColor('#00ffee'); });
    onlineBg.on('pointerup',   () => this.openLobby());

    // Restore online status if already connected from a previous scene visit
    if (net.connected) {
      this.registerNetHandlers();
      this.showOnlineStatus(net.partner ? `Paired with ${net.partner}` : `Online as ${net.myName}`);
    }

    y += 60;
    this.add.text(CX, y, 'Drag a coin to kick  •  Pass between the other two  •  First to 3 goals wins', {
      fontSize: '11px', fontFamily: 'monospace', color: '#334455', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.highlightSelected();

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      this.lobbyEl?.remove();
      this.lobbyEl = null;
      this.onlineStatusEl?.remove();
      this.onlineStatusEl = null;
      this.unregisterNetHandlers();
    });
  }

  // ─── Lobby overlay ────────────────────────────────────────────────────────────

  private openLobby() {
    if (this.lobbyEl) return;

    this.lobbyEl = document.createElement('div');
    Object.assign(this.lobbyEl.style, {
      position: 'fixed', inset: '0', zIndex: '200',
      background: 'rgba(3,3,28,0.97)',
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      fontFamily: 'monospace',
    });
    document.body.appendChild(this.lobbyEl);

    if (net.connected) {
      this.lobbyState = net.partner ? 'paired' : 'lobby';
    } else {
      this.lobbyState = 'name-entry';
    }

    // Handlers may already be registered (e.g. returned from GameScene)
    this.registerNetHandlers();
    this.renderLobby();
  }

  private closeLobby() {
    // Only remove the DOM overlay — keep net handlers active for the scene's lifetime
    this.lobbyEl?.remove();
    this.lobbyEl = null;
  }

  private renderLobby(extra?: string) {
    if (!this.lobbyEl) return;
    this.lobbyEl.innerHTML = '';

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: '#05051e', border: '1px solid #00ffee44',
      padding: '32px', width: '360px', color: '#cdd',
    });
    this.lobbyEl.appendChild(panel);

    const h2 = (text: string) => {
      const el = document.createElement('div');
      Object.assign(el.style, { color: '#00ffee', fontSize: '14px', letterSpacing: '4px', marginBottom: '24px' });
      el.textContent = text;
      panel.appendChild(el);
    };

    const msg = (text: string, color = '#667788') => {
      const el = document.createElement('div');
      Object.assign(el.style, { color, fontSize: '13px', marginBottom: '16px' });
      el.textContent = text;
      panel.appendChild(el);
      return el;
    };

    const btn = (label: string, color: string, onClick: () => void) => {
      const el = document.createElement('button');
      Object.assign(el.style, {
        background: 'transparent', border: `1px solid ${color}`, color,
        fontFamily: 'monospace', fontSize: '13px', letterSpacing: '2px',
        padding: '8px 16px', cursor: 'pointer', marginRight: '10px', marginTop: '8px',
      });
      el.textContent = label;
      el.addEventListener('click', onClick);
      panel.appendChild(el);
      return el;
    };

    switch (this.lobbyState) {

      case 'name-entry': {
        h2('ONLINE PLAY');
        msg('Your name:');
        const input = document.createElement('input');
        Object.assign(input.style, {
          background: '#0a0a2e', border: '1px solid #00ffee66', color: '#00ffee',
          fontFamily: 'monospace', fontSize: '16px', padding: '8px 12px',
          width: '100%', boxSizing: 'border-box', marginBottom: '16px', outline: 'none',
        });
        input.type = 'text'; input.maxLength = 20; input.placeholder = 'enter name';
        panel.appendChild(input);
        input.focus();
        const doConnect = () => this.connectAs(input.value.trim());
        input.addEventListener('keydown', e => { if (e.key === 'Enter') doConnect(); });
        btn('CONNECT', '#00ffee', doConnect);
        btn('CANCEL', '#445566', () => this.closeLobby());
        if (extra) msg(extra, '#ff4422');
        break;
      }

      case 'connecting':
        h2('ONLINE PLAY');
        msg('Connecting…', '#667788');
        break;

      case 'lobby': {
        h2(`LOBBY — ${net.myName}`);
        // User list rendered by onUserList; placeholder until first message arrives
        const listEl = document.createElement('div');
        listEl.id = 'lobby-user-list';
        Object.assign(listEl.style, { marginBottom: '20px', minHeight: '60px' });
        panel.appendChild(listEl);
        btn('REFRESH', '#446688', () => net.send({ type: 'list' }));
        btn('DISCONNECT', '#445566', () => {
          net.disconnect();
          this.closeLobby();
          this.onlineStatusEl?.remove();
          this.onlineStatusEl = null;
        });
        // Immediately request the current user list
        net.send({ type: 'list' });
        break;
      }

      case 'pending-out':
        h2(`LOBBY — ${net.myName}`);
        msg(`Waiting for ${this.pendingPairTo} to accept…`, '#aabbcc');
        btn('CANCEL', '#445566', () => {
          this.pendingPairTo = null;
          this.lobbyState = 'lobby';
          this.renderLobby();
        });
        break;

      case 'pending-in':
        h2('PAIR REQUEST');
        msg(`${this.pendingPairFrom} wants to play!`, '#00ffee');
        btn('ACCEPT', '#00ffee', () => {
          net.send({ type: 'pair-accept', target: this.pendingPairFrom! });
          this.pendingPairFrom = null;
        });
        btn('DECLINE', '#ff4422', () => {
          net.send({ type: 'pair-reject', target: this.pendingPairFrom! });
          this.pendingPairFrom = null;
          this.lobbyState = 'lobby';
          this.renderLobby();
        });
        break;

      case 'paired': {
        h2('PAIRED');
        msg(`Playing with: ${net.partner}`, '#00ffee');
        msg('Choose a level then start:', '#667788');

        // Compact level list
        const allLevels = [...fieldLevels, ...courseLevels];
        allLevels.forEach(level => {
          const row = document.createElement('div');
          Object.assign(row.style, {
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '6px 8px', marginBottom: '4px',
            border: `1px solid ${this.selectedLevel === level ? '#ffcc0066' : '#1a2233'}`,
            background: this.selectedLevel === level ? '#ffcc0010' : 'transparent',
            cursor: 'pointer',
          });
          const name = document.createElement('span');
          name.textContent = level.label;
          name.style.color = this.selectedLevel === level ? '#ffcc00' : '#778899';
          name.style.fontSize = '13px';
          row.appendChild(name);
          row.addEventListener('click', () => {
            this.selectedLevel = level;
            this.renderLobby(); // re-render to show new selection
          });
          panel.appendChild(row);
        });

        const startRow = document.createElement('div');
        startRow.style.marginTop = '20px';
        panel.appendChild(startRow);

        const startBtn = document.createElement('button');
        Object.assign(startBtn.style, {
          background: 'transparent', border: '2px solid #ffcc00', color: '#ffcc00',
          fontFamily: 'monospace', fontSize: '16px', letterSpacing: '3px',
          padding: '10px 24px', cursor: 'pointer', marginRight: '10px',
        });
        startBtn.textContent = 'START';
        startBtn.addEventListener('click', () => {
          net.send({ type: 'select-level', levelId: this.selectedLevel.id });
          this.launchNetworkGame(this.selectedLevel, net.myName!);
        });
        startRow.appendChild(startBtn);

        const unpairBtn = document.createElement('button');
        Object.assign(unpairBtn.style, {
          background: 'transparent', border: '1px solid #445566', color: '#445566',
          fontFamily: 'monospace', fontSize: '13px', letterSpacing: '2px',
          padding: '10px 16px', cursor: 'pointer',
        });
        unpairBtn.textContent = 'UNPAIR';
        unpairBtn.addEventListener('click', () => {
          net.send({ type: 'unpair' });
          this.lobbyState = 'lobby';
          this.closeLobby();
          this.showOnlineStatus(`Online as ${net.myName}`);
          if (this.playTxt) { this.playTxt.setText('PLAY'); this.playTxt.setFontSize(28); }
        });
        startRow.appendChild(unpairBtn);
        break;
      }
    }
  }

  // ─── Net actions ─────────────────────────────────────────────────────────────

  private connectAs(name: string) {
    if (!name) return;
    this.lobbyState = 'connecting';
    this.renderLobby();
    net.connect(name)
      .then(() => {
        this.lobbyState = 'lobby';
        this.renderLobby();
        this.showOnlineStatus(`Online as ${name}`);
      })
      .catch((err: Error) => {
        this.lobbyState = 'name-entry';
        this.renderLobby(err.message);
      });
  }

  private launchNetworkGame(level: LevelDef, startingPlayerName: string) {
    const myIndex = startingPlayerName === net.myName ? 0 : 1;
    this.registry.set('gameConfig', { ...this.cfg });
    this.registry.set('level', level);
    this.registry.set('netMode', true);
    this.registry.set('netPlayerIndex', myIndex);
    this.scene.start('GameScene');
  }

  // ─── Net handlers ─────────────────────────────────────────────────────────────

  private registerNetHandlers() {
    if (this.handlersRegistered) return;
    this.handlersRegistered = true;
    net.on('user-list',            this.handleUserList);
    net.on('pair-request',         this.handlePairRequest);
    net.on('paired',               this.handlePaired);
    net.on('pair-rejected',        this.handlePairRejected);
    net.on('unpairing',            this.handleUnpairing);
    net.on('partner-disconnected', this.handlePartnerDisc);
    net.on('select-level',         this.handleSelectLevel);
  }

  private unregisterNetHandlers() {
    if (!this.handlersRegistered) return;
    this.handlersRegistered = false;
    net.off('user-list',            this.handleUserList);
    net.off('pair-request',         this.handlePairRequest);
    net.off('paired',               this.handlePaired);
    net.off('pair-rejected',        this.handlePairRejected);
    net.off('unpairing',            this.handleUnpairing);
    net.off('partner-disconnected', this.handlePartnerDisc);
    net.off('select-level',         this.handleSelectLevel);
  }

  private onUserList(msg: Extract<ServerMsg, { type: 'user-list' }>) {
    if (this.lobbyState !== 'lobby') return;
    const listEl = document.getElementById('lobby-user-list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const others = msg.players.filter(p => p.name !== net.myName);

    if (others.length === 0) {
      const empty = document.createElement('div');
      Object.assign(empty.style, { color: '#334455', fontSize: '12px', padding: '8px 0' });
      empty.textContent = 'No other players online';
      listEl.appendChild(empty);
      return;
    }

    others.forEach((p: Player) => {
      const row = document.createElement('div');
      Object.assign(row.style, {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '8px 0', borderBottom: '1px solid #0d1f33',
      });

      const nameEl = document.createElement('span');
      nameEl.textContent = p.name;
      nameEl.style.color = p.state === 'waiting' ? '#aabbcc' : '#445566';
      nameEl.style.fontSize = '14px';
      row.appendChild(nameEl);

      const stateEl = document.createElement('span');
      stateEl.textContent = p.state;
      stateEl.style.fontSize = '10px';
      stateEl.style.letterSpacing = '2px';
      stateEl.style.color = p.state === 'waiting' ? '#00ffee88' : '#334455';
      row.appendChild(stateEl);

      if (p.state === 'waiting') {
        const pairBtn = document.createElement('button');
        Object.assign(pairBtn.style, {
          background: 'transparent', border: '1px solid #00ffee44', color: '#00ffee',
          fontFamily: 'monospace', fontSize: '11px', padding: '3px 10px', cursor: 'pointer',
        });
        pairBtn.textContent = 'PAIR';
        pairBtn.addEventListener('click', () => {
          net.send({ type: 'pair-request', target: p.name });
          this.pendingPairTo = p.name;
          this.lobbyState = 'pending-out';
          this.renderLobby();
        });
        row.appendChild(pairBtn);
      }

      listEl.appendChild(row);
    });
  }

  private onPairRequest(msg: Extract<ServerMsg, { type: 'pair-request' }>) {
    this.pendingPairFrom = msg.from;
    this.lobbyState = 'pending-in';
    if (!this.lobbyEl) this.openLobby();
    else this.renderLobby();
  }

  private onPaired(_msg: Extract<ServerMsg, { type: 'paired' }>) {
    this.pendingPairTo = null;
    this.pendingPairFrom = null;
    this.lobbyState = 'paired';
    // Close the lobby overlay — level selection happens on the main menu
    this.closeLobby();
    this.showOnlineStatus(`Paired with ${net.partner} — pick a level and PLAY`);
    // Update PLAY button to show paired state
    if (this.playTxt) {
      this.playTxt.setText('PLAY\nONLINE');
      this.playTxt.setFontSize(16);
    }
  }

  private onPairRejected(msg: Extract<ServerMsg, { type: 'pair-rejected' }>) {
    this.pendingPairTo = null;
    this.lobbyState = 'lobby';
    this.renderLobby(`${msg.by} declined.`);
  }

  private onUnpairing(_msg: Extract<ServerMsg, { type: 'unpairing' }>) {
    this.lobbyState = 'lobby';
    if (this.lobbyEl) this.renderLobby('Partner unpairing.');
    this.showOnlineStatus(`Online as ${net.myName}`);
    if (this.playTxt) { this.playTxt.setText('PLAY'); this.playTxt.setFontSize(28); }
  }

  private onPartnerDisconnected(_msg: Extract<ServerMsg, { type: 'partner-disconnected' }>) {
    if (!net.connected) {
      // We were disconnected
      this.closeLobby();
      this.onlineStatusEl?.remove();
      this.onlineStatusEl = null;
      return;
    }
    this.lobbyState = 'lobby';
    if (this.lobbyEl) this.renderLobby('Partner disconnected.');
    this.showOnlineStatus(`Online as ${net.myName}`);
    if (this.playTxt) { this.playTxt.setText('PLAY'); this.playTxt.setFontSize(28); }
  }

  private onSelectLevel(msg: Extract<ServerMsg, { type: 'select-level' }>) {
    const allLevels = [...fieldLevels, ...courseLevels];
    const level = allLevels.find(l => l.id === msg.levelId);
    if (level) this.launchNetworkGame(level, msg.startingPlayer);
  }

  // ─── Online status bar (shown on main menu when connected) ───────────────────

  private showOnlineStatus(text: string) {
    if (!this.onlineStatusEl) {
      this.onlineStatusEl = document.createElement('div');
      Object.assign(this.onlineStatusEl.style, {
        position: 'fixed', bottom: '16px', left: '50%', transform: 'translateX(-50%)',
        background: '#03030f', border: '1px solid #00ffee22',
        color: '#00ffee88', fontFamily: 'monospace', fontSize: '11px',
        letterSpacing: '2px', padding: '6px 16px', zIndex: '100',
        cursor: 'pointer',
      });
      this.onlineStatusEl.title = 'Click to open lobby';
      this.onlineStatusEl.addEventListener('click', () => this.openLobby());
      document.body.appendChild(this.onlineStatusEl);
    }
    this.onlineStatusEl.textContent = `● ${text}`;
  }

  // ─── Level grid (existing) ───────────────────────────────────────────────────

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
