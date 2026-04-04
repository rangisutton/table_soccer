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

  // ─── Preview card ───────────────────────────────────────────────────────────
  private previewEl: HTMLDivElement | null = null;
  private previewImg: HTMLImageElement | null = null;
  private previewTitle: HTMLDivElement | null = null;
  private previewTagline: HTMLDivElement | null = null;

  // ─── Lobby state ────────────────────────────────────────────────────────────
  private lobbyEl: HTMLDivElement | null = null;
  private lobbyState: LobbyState = 'name-entry';
  private pendingPairFrom: string | null = null; // incoming pair requester
  private pendingPairTo: string | null = null;   // outgoing pair target
  private playTxt: Phaser.GameObjects.Text | null = null;
  private onlineTxt: Phaser.GameObjects.Text | null = null;
  private vsMyTxt: Phaser.GameObjects.Text | null = null;
  private vsLabelTxt: Phaser.GameObjects.Text | null = null;
  private vsOpponentTxt: Phaser.GameObjects.Text | null = null;
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
    this.levelBtns = [];
    this.vsMyTxt = null; this.vsLabelTxt = null; this.vsOpponentTxt = null;
    this.playTxt = null; this.onlineTxt = null;
    this.lobbyEl = null;

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

    y += 16; // gap below level buttons

    // ── Level preview card (DOM, positioned over this canvas gap) ─────────────
    this.createPreviewCard(y);
    y += 218; // reserve canvas height for the card

    y += 16; // gap above play button

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
    this.onlineTxt = this.add.text(CX + 68, y, net.connected ? 'LOBBY' : 'LOGIN', {
      fontSize: '18px', fontFamily: 'monospace', fontStyle: 'bold', color: '#00ffee',
    }).setOrigin(0.5, 0.5);

    onlineBg.on('pointerover', () => { onlineBg.setFillStyle(C_CYAN, 0.15); this.onlineTxt!.setColor('#ffffff'); });
    onlineBg.on('pointerout',  () => { onlineBg.setFillStyle(0, 0);         this.onlineTxt!.setColor('#00ffee'); });
    onlineBg.on('pointerup',   () => this.openLobby());

    // ── vs display ────────────────────────────────────────────────────────────
    y += 52;
    this.vsMyTxt = this.add.text(CX, y, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#00ffee',
    }).setOrigin(0.5, 0.5).setVisible(false);
    y += 26;
    this.vsLabelTxt = this.add.text(CX, y, 'vs', {
      fontSize: '12px', fontFamily: 'monospace', color: '#334455', letterSpacing: 4,
    }).setOrigin(0.5, 0.5).setVisible(false);
    y += 26;
    this.vsOpponentTxt = this.add.text(CX, y, '', {
      fontSize: '22px', fontFamily: 'monospace', color: '#334455',
    }).setOrigin(0.5, 0.5).setVisible(false);
    y += 28;

    // Restore status if already connected from a previous scene visit
    if (net.connected) {
      this.registerNetHandlers();
      this.updateVsDisplay();
    }

    this.add.text(CX, y, 'Drag a coin to kick  •  Pass between the other two  •  First to 3 goals wins', {
      fontSize: '11px', fontFamily: 'monospace', color: '#334455', align: 'center',
    }).setOrigin(0.5, 0.5);

    this.highlightSelected();
    this.updatePreview();

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      this.lobbyEl?.remove();
      this.lobbyEl = null;
      this.previewEl?.remove();
      this.previewEl = null;
      this.unregisterNetHandlers();
    });
  }

  // ─── Lobby overlay ────────────────────────────────────────────────────────────

  private openLobby(forceState?: LobbyState) {
    if (!this.lobbyEl) {
      this.lobbyEl = document.createElement('div');
      Object.assign(this.lobbyEl.style, {
        position: 'fixed', inset: '0', zIndex: '200',
        background: 'rgba(3,3,28,0.97)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        fontFamily: 'monospace',
      });
      document.body.appendChild(this.lobbyEl);
    }

    if (forceState) {
      this.lobbyState = forceState;
    } else if (net.connected) {
      this.lobbyState = net.partner ? 'paired' : 'lobby';
    } else {
      this.lobbyState = 'name-entry';
    }

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
        btn('BACK TO MENU', '#ffcc00', () => this.closeLobby());
        btn('DISCONNECT', '#445566', () => {
          net.disconnect();
          this.closeLobby();
          if (this.onlineTxt) this.onlineTxt.setText('LOGIN');
          this.vsMyTxt?.setVisible(false);
          this.vsLabelTxt?.setVisible(false);
          this.vsOpponentTxt?.setVisible(false);
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
        msg(`Online as: ${net.myName}`, '#667788');
        msg(`Paired with: ${net.partner}`, '#00ffee');
        msg('Close this lobby and select a level to play.', '#445566');
        btn('BACK TO MENU', '#ffcc00', () => this.closeLobby());
        btn('UNPAIR', '#445566', () => {
          net.send({ type: 'unpair' });
          net.partner = null;
          this.lobbyState = 'lobby';
          this.renderLobby();
          this.updateVsDisplay();
          if (this.playTxt) { this.playTxt.setText('PLAY'); this.playTxt.setFontSize(28); }
        });
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
        this.updateVsDisplay();
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
          if (net.partner) net.send({ type: 'unpair' }); // drop existing pairing first
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
    this.openLobby('pending-in');
  }

  private onPaired(_msg: Extract<ServerMsg, { type: 'paired' }>) {
    this.pendingPairTo = null;
    this.pendingPairFrom = null;
    this.lobbyState = 'paired';
    // Close the lobby overlay — level selection happens on the main menu
    this.closeLobby();
    this.updateVsDisplay();
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
    this.updateVsDisplay();
    if (this.playTxt) { this.playTxt.setText('PLAY'); this.playTxt.setFontSize(28); }
  }

  private onPartnerDisconnected(_msg: Extract<ServerMsg, { type: 'partner-disconnected' }>) {
    if (!net.connected) {
      // We were disconnected
      this.closeLobby();
      if (this.onlineTxt) this.onlineTxt.setText('LOGIN');
      this.vsMyTxt?.setVisible(false);
      this.vsLabelTxt?.setVisible(false);
      this.vsOpponentTxt?.setVisible(false);
      return;
    }
    this.lobbyState = 'lobby';
    if (this.lobbyEl) this.renderLobby('Partner disconnected.');
    this.updateVsDisplay();
    if (this.playTxt) { this.playTxt.setText('PLAY'); this.playTxt.setFontSize(28); }
  }

  private onSelectLevel(msg: Extract<ServerMsg, { type: 'select-level' }>) {
    const allLevels = [...fieldLevels, ...courseLevels];
    const level = allLevels.find(l => l.id === msg.levelId);
    if (level) this.launchNetworkGame(level, msg.startingPlayer);
  }

  // ─── vs display ──────────────────────────────────────────────────────────────

  private updateVsDisplay() {
    if (!this.vsMyTxt) return;
    this.vsMyTxt.setText(net.myName ?? '').setVisible(true);
    this.vsLabelTxt!.setVisible(true);
    const opponent = net.partner ?? '-----';
    this.vsOpponentTxt!
      .setText(opponent)
      .setColor(net.partner ? '#ff00cc' : '#334455')
      .setVisible(true);
    if (this.onlineTxt) this.onlineTxt.setText('LOBBY');
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
        this.updatePreview();
      });

      this.levelBtns.push({ level, bg, label: lbl });
    }

    const rows = Math.ceil(levels.length / cols);
    return y + rows * (btnH + 8);
  }

  private createPreviewCard(canvasY: number) {
    const canvas = this.game.canvas;
    const rect = canvas.getBoundingClientRect();
    const scaleX = rect.width  / CANVAS_WIDTH;
    const scaleY = rect.height / CANVAS_HEIGHT;
    // Card is 280px wide in screen px, centered on canvas
    const cardW = 280;

    const el = document.createElement('div');
    this.previewEl = el;
    Object.assign(el.style, {
      position: 'fixed',
      left:   `${rect.left + rect.width * 0.5 - cardW / 2}px`,
      top:    `${rect.top  + canvasY * scaleY}px`,
      width:  `${cardW}px`,
      background: '#05051e',
      border: '1px solid #224455',
      fontFamily: 'monospace',
      pointerEvents: 'none',
      zIndex: '10',
    });

    const title = document.createElement('div');
    this.previewTitle = title;
    Object.assign(title.style, {
      color: '#00ffee',
      fontSize: '13px',
      letterSpacing: '3px',
      textTransform: 'uppercase',
      textAlign: 'center',
      padding: '10px 12px 6px',
    });
    el.appendChild(title);

    const img = document.createElement('img');
    this.previewImg = img;
    Object.assign(img.style, {
      display: 'block',
      width: '100%',
      aspectRatio: '1',
      objectFit: 'cover',
    });
    el.appendChild(img);

    const tagline = document.createElement('div');
    this.previewTagline = tagline;
    Object.assign(tagline.style, {
      color: '#556677',
      fontSize: '11px',
      lineHeight: '1.6',
      padding: '8px 12px 10px',
      textAlign: 'center',
    });
    el.appendChild(tagline);

    document.body.appendChild(el);
  }

  private updatePreview() {
    if (!this.previewEl) return;
    const level = this.selectedLevel;
    const BASE = import.meta.env.BASE_URL ?? '/';
    const menuUrl = `${BASE}field-images/menus/${level.id}_menu.jpg`;

    this.previewTitle!.textContent = level.label;
    this.previewImg!.src = menuUrl;
    this.previewImg!.style.display = 'block';
    // Hide image gracefully if no menu image exists for this level
    this.previewImg!.onerror = () => { this.previewImg!.style.display = 'none'; };
    this.previewTagline!.textContent = level.tagline ?? '';
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
