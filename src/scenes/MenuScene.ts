import Phaser from 'phaser';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../config';
import { GameConfig, DEFAULT_CONFIG } from '../FieldConfig';
import { LevelDef } from '../LevelDef';
import { fieldLevels, courseLevels } from '../levels/index';
import { net, Player, ServerMsg } from '../net';

const CX = CANVAS_WIDTH / 2;
const CY = CANVAS_HEIGHT / 2;
const C_DARK = 0x030320;

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
  private allLevels: LevelDef[] = [];

  // ─── Menu DOM overlay ───────────────────────────────────────────────────────
  private menuEl: HTMLDivElement | null = null;
  private levelBtns: { level: LevelDef; el: HTMLButtonElement }[] = [];

  // ─── Preview card ───────────────────────────────────────────────────────────
  private previewEl: HTMLDivElement | null = null;
  private previewImg: HTMLImageElement | null = null;
  private previewTitle: HTMLDivElement | null = null;
  private previewTagline: HTMLDivElement | null = null;

  // ─── Action buttons ─────────────────────────────────────────────────────────
  private playBtnEl: HTMLButtonElement | null = null;
  private onlineBtnEl: HTMLButtonElement | null = null;

  // ─── vs display ─────────────────────────────────────────────────────────────
  private vsMyEl: HTMLDivElement | null = null;
  private vsLabelEl: HTMLDivElement | null = null;
  private vsOpponentEl: HTMLDivElement | null = null;

  // ─── Lobby state ────────────────────────────────────────────────────────────
  private lobbyEl: HTMLDivElement | null = null;
  private lobbyState: LobbyState = 'name-entry';
  private pendingPairFrom: string | null = null;
  private pendingPairTo: string | null = null;
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
    this.allLevels = [...fieldLevels, ...courseLevels];
    this.selectedLevel = this.registry.get('level') ?? this.allLevels[0];
    this.levelBtns = [];

    // Minimal Phaser background — the DOM overlay sits on top
    this.add.rectangle(CX, CY, CANVAS_WIDTH, CANVAS_HEIGHT, C_DARK);

    this.buildMenuDOM();

    if (net.connected) {
      this.registerNetHandlers();
      this.updateVsDisplay();
    }

    this.highlightSelected();
    this.updatePreview();

    this.events.on('shutdown', () => {
      this.menuEl?.remove();
      this.menuEl = null;
      this.lobbyEl?.remove();
      this.lobbyEl = null;
      this.unregisterNetHandlers();
    });
  }

  // ─── DOM menu construction ───────────────────────────────────────────────────

  private buildMenuDOM() {
    const canvas = this.game.canvas;
    const parent = canvas.parentElement!;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    const wrap = document.createElement('div');
    this.menuEl = wrap;
    Object.assign(wrap.style, {
      position: 'absolute', inset: '0',
      overflowX: 'hidden', overflowY: 'auto',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '24px 16px 32px',
      boxSizing: 'border-box',
      background: '#030320',
      fontFamily: 'monospace',
      color: '#aabbcc',
    });
    parent.appendChild(wrap);

    // ── Title ─────────────────────────────────────────────────────────────────
    const titleEl = document.createElement('div');
    Object.assign(titleEl.style, {
      color: '#00ffee', fontSize: '34px', fontWeight: 'bold',
      letterSpacing: '4px', textShadow: '0 0 20px #00ffee44',
      marginBottom: '20px', textAlign: 'center',
    });
    titleEl.textContent = 'TABLE SOCCER';
    wrap.appendChild(titleEl);

    // ── Play + Online buttons ─────────────────────────────────────────────────
    const actionRow = document.createElement('div');
    Object.assign(actionRow.style, {
      display: 'flex', gap: '20px', marginBottom: '10px',
    });
    wrap.appendChild(actionRow);

    const pairedNow = net.connected && !!net.partner;

    this.playBtnEl = document.createElement('button');
    const pb = this.playBtnEl;
    Object.assign(pb.style, {
      background: 'transparent', border: '2px solid #ffcc00',
      color: '#ffcc00', fontFamily: 'monospace',
      fontSize: pairedNow ? '16px' : '28px', fontWeight: 'bold',
      padding: '10px 24px', cursor: 'pointer',
      minWidth: '120px', minHeight: '52px', lineHeight: '1.2',
    });
    pb.innerHTML = pairedNow ? 'PLAY<br>ONLINE' : 'PLAY';
    pb.addEventListener('mouseover', () => { pb.style.background = 'rgba(255,204,0,0.15)'; pb.style.color = '#ffffff'; });
    pb.addEventListener('mouseout',  () => { pb.style.background = 'transparent';            pb.style.color = '#ffcc00'; });
    pb.addEventListener('click', () => {
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
    actionRow.appendChild(pb);

    this.onlineBtnEl = document.createElement('button');
    const ob = this.onlineBtnEl;
    Object.assign(ob.style, {
      background: 'transparent', border: '2px solid #00ffee',
      color: '#00ffee', fontFamily: 'monospace',
      fontSize: '18px', fontWeight: 'bold',
      padding: '10px 24px', cursor: 'pointer',
      minWidth: '120px', minHeight: '52px',
    });
    ob.textContent = net.connected ? 'LOBBY' : 'LOGIN';
    ob.addEventListener('mouseover', () => { ob.style.background = 'rgba(0,255,238,0.15)'; ob.style.color = '#ffffff'; });
    ob.addEventListener('mouseout',  () => { ob.style.background = 'transparent';           ob.style.color = '#00ffee'; });
    ob.addEventListener('click', () => this.openLobby());
    actionRow.appendChild(ob);

    // ── vs display (hidden until connected) ───────────────────────────────────
    const vsWrap = document.createElement('div');
    Object.assign(vsWrap.style, {
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: '4px', marginBottom: '12px', minHeight: '0',
    });
    wrap.appendChild(vsWrap);

    this.vsMyEl = document.createElement('div');
    Object.assign(this.vsMyEl.style, {
      color: '#00ffee', fontSize: '22px', display: 'none', textAlign: 'center',
    });
    vsWrap.appendChild(this.vsMyEl);

    this.vsLabelEl = document.createElement('div');
    Object.assign(this.vsLabelEl.style, {
      color: '#334455', fontSize: '12px', letterSpacing: '4px', display: 'none',
    });
    this.vsLabelEl.textContent = 'vs';
    vsWrap.appendChild(this.vsLabelEl);

    this.vsOpponentEl = document.createElement('div');
    Object.assign(this.vsOpponentEl.style, {
      color: '#334455', fontSize: '22px', display: 'none', textAlign: 'center',
    });
    vsWrap.appendChild(this.vsOpponentEl);

    // ── Preview card with arrow navigation ───────────────────────────────────
    const previewRow = document.createElement('div');
    Object.assign(previewRow.style, {
      display: 'flex', alignItems: 'center', gap: '8px',
      marginBottom: '20px',
    });
    wrap.appendChild(previewRow);

    const makeArrow = (symbol: string, onClick: () => void) => {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        background: 'transparent', border: '1px solid #224455',
        color: '#446688', fontFamily: 'monospace', fontSize: '22px',
        width: '36px', height: '36px', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: '0', padding: '0', lineHeight: '1',
      });
      btn.textContent = symbol;
      btn.addEventListener('mouseover', () => { btn.style.borderColor = '#00ffee'; btn.style.color = '#00ffee'; });
      btn.addEventListener('mouseout',  () => { btn.style.borderColor = '#224455'; btn.style.color = '#446688'; });
      btn.addEventListener('click', onClick);
      return btn;
    };

    previewRow.appendChild(makeArrow('◀', () => this.stepLevel(-1)));

    const card = document.createElement('div');
    this.previewEl = card;
    Object.assign(card.style, {
      width: '280px', maxWidth: '80vw',
      background: '#05051e', border: '1px solid #224455',
      pointerEvents: 'none', flexShrink: '0',
    });

    this.previewTitle = document.createElement('div');
    Object.assign(this.previewTitle.style, {
      color: '#00ffee', fontSize: '13px', letterSpacing: '3px',
      textTransform: 'uppercase', textAlign: 'center',
      padding: '10px 12px 6px',
    });
    card.appendChild(this.previewTitle);

    this.previewImg = document.createElement('img');
    Object.assign(this.previewImg.style, {
      display: 'block', width: '100%', aspectRatio: '1', objectFit: 'cover',
    });
    card.appendChild(this.previewImg);

    this.previewTagline = document.createElement('div');
    Object.assign(this.previewTagline.style, {
      color: '#556677', fontSize: '11px', lineHeight: '1.6',
      padding: '8px 12px 10px', textAlign: 'center',
    });
    card.appendChild(this.previewTagline);
    previewRow.appendChild(card);

    previewRow.appendChild(makeArrow('▶', () => this.stepLevel(1)));

    // ── Level buttons ─────────────────────────────────────────────────────────
    if (fieldLevels.length > 0) {
      wrap.appendChild(this.makeSectionLabel('FIELDS'));
      wrap.appendChild(this.buildLevelGrid(fieldLevels));
      wrap.appendChild(this.makeSpacer(12));
    }

    if (courseLevels.length > 0) {
      wrap.appendChild(this.makeSectionLabel('COURSES'));
      wrap.appendChild(this.buildLevelGrid(courseLevels));
      wrap.appendChild(this.makeSpacer(12));
    }

    // ── Hint ─────────────────────────────────────────────────────────────────
    const hint = document.createElement('div');
    Object.assign(hint.style, {
      color: '#334455', fontSize: '11px', textAlign: 'center',
      maxWidth: '420px', lineHeight: '1.6', marginTop: '8px',
    });
    hint.textContent = 'Drag a coin to kick  •  Pass between the other two  •  First to 3 goals wins';
    wrap.appendChild(hint);
  }

  private makeSectionLabel(text: string): HTMLDivElement {
    const el = document.createElement('div');
    Object.assign(el.style, {
      color: '#446688', fontSize: '11px', letterSpacing: '2px',
      textTransform: 'uppercase', marginBottom: '8px', textAlign: 'center',
    });
    el.textContent = text;
    return el;
  }

  private makeSpacer(h: number): HTMLDivElement {
    const el = document.createElement('div');
    el.style.height = `${h}px`;
    return el;
  }

  private buildLevelGrid(levels: LevelDef[]): HTMLDivElement {
    const grid = document.createElement('div');
    Object.assign(grid.style, {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, 140px)',
      gap: '8px',
    });

    for (const level of levels) {
      const btn = document.createElement('button');
      Object.assign(btn.style, {
        background: 'transparent', border: '1px solid #224455',
        color: '#778899', fontFamily: 'monospace', fontSize: '13px',
        padding: '9px 8px', cursor: 'pointer', textAlign: 'center',
      });
      btn.textContent = level.label;
      btn.addEventListener('mouseover', () => {
        if (this.selectedLevel !== level) { btn.style.borderColor = '#00ffee'; btn.style.color = '#00ffee'; }
      });
      btn.addEventListener('mouseout', () => this.highlightSelected());
      btn.addEventListener('click', () => {
        this.selectedLevel = level;
        this.highlightSelected();
        this.updatePreview();
      });
      this.levelBtns.push({ level, el: btn });
      grid.appendChild(btn);
    }

    return grid;
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
        const listEl = document.createElement('div');
        listEl.id = 'lobby-user-list';
        Object.assign(listEl.style, { marginBottom: '20px', minHeight: '60px' });
        panel.appendChild(listEl);
        btn('BACK TO MENU', '#ffcc00', () => this.closeLobby());
        btn('DISCONNECT', '#445566', () => {
          net.disconnect();
          this.closeLobby();
          if (this.onlineBtnEl) this.onlineBtnEl.textContent = 'LOGIN';
          if (this.vsMyEl)       this.vsMyEl.style.display = 'none';
          if (this.vsLabelEl)    this.vsLabelEl.style.display = 'none';
          if (this.vsOpponentEl) this.vsOpponentEl.style.display = 'none';
        });
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
          if (this.playBtnEl) { this.playBtnEl.textContent = 'PLAY'; this.playBtnEl.style.fontSize = '28px'; }
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
          if (net.partner) net.send({ type: 'unpair' });
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
    this.closeLobby();
    this.updateVsDisplay();
    if (this.playBtnEl) {
      this.playBtnEl.innerHTML = 'PLAY<br>ONLINE';
      this.playBtnEl.style.fontSize = '16px';
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
    if (this.playBtnEl) { this.playBtnEl.textContent = 'PLAY'; this.playBtnEl.style.fontSize = '28px'; }
  }

  private onPartnerDisconnected(_msg: Extract<ServerMsg, { type: 'partner-disconnected' }>) {
    if (!net.connected) {
      this.closeLobby();
      if (this.onlineBtnEl)    this.onlineBtnEl.textContent = 'LOGIN';
      if (this.vsMyEl)         this.vsMyEl.style.display = 'none';
      if (this.vsLabelEl)      this.vsLabelEl.style.display = 'none';
      if (this.vsOpponentEl)   this.vsOpponentEl.style.display = 'none';
      return;
    }
    this.lobbyState = 'lobby';
    if (this.lobbyEl) this.renderLobby('Partner disconnected.');
    this.updateVsDisplay();
    if (this.playBtnEl) { this.playBtnEl.textContent = 'PLAY'; this.playBtnEl.style.fontSize = '28px'; }
  }

  private onSelectLevel(msg: Extract<ServerMsg, { type: 'select-level' }>) {
    const allLevels = [...fieldLevels, ...courseLevels];
    const level = allLevels.find(l => l.id === msg.levelId);
    if (level) this.launchNetworkGame(level, msg.startingPlayer);
  }

  // ─── vs display ──────────────────────────────────────────────────────────────

  private updateVsDisplay() {
    if (!this.vsMyEl) return;
    this.vsMyEl.textContent = net.myName ?? '';
    this.vsMyEl.style.display = '';
    this.vsLabelEl!.style.display = '';
    const opponent = net.partner ?? '-----';
    this.vsOpponentEl!.textContent = opponent;
    this.vsOpponentEl!.style.color = net.partner ? '#ff00cc' : '#334455';
    this.vsOpponentEl!.style.display = '';
    if (this.onlineBtnEl) this.onlineBtnEl.textContent = 'LOBBY';
  }

  // ─── Level grid ──────────────────────────────────────────────────────────────

  private stepLevel(dir: 1 | -1) {
    const idx = this.allLevels.indexOf(this.selectedLevel);
    const next = (idx + dir + this.allLevels.length) % this.allLevels.length;
    this.selectedLevel = this.allLevels[next];
    this.highlightSelected();
    this.updatePreview();
  }

  private updatePreview() {
    if (!this.previewEl) return;
    const level = this.selectedLevel;
    const BASE = import.meta.env.BASE_URL ?? '/';
    const menuUrl = `${BASE}field-images/menus/${level.id}_menu.jpg`;

    this.previewTitle!.textContent = level.label;
    this.previewImg!.src = menuUrl;
    this.previewImg!.style.display = 'block';
    this.previewImg!.onerror = () => { this.previewImg!.style.display = 'none'; };
    this.previewTagline!.textContent = level.tagline ?? '';
  }

  private highlightSelected() {
    for (const { level, el } of this.levelBtns) {
      const active = this.selectedLevel === level;
      el.style.borderColor  = active ? '#ffcc00' : '#224455';
      el.style.borderWidth  = active ? '2px'     : '1px';
      el.style.color        = active ? '#ffcc00' : '#778899';
      el.style.background   = active ? 'rgba(255,204,0,0.1)' : 'transparent';
    }
  }
}
