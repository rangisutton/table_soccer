/**
 * net.ts — WebSocket client wrapper for networked multiplayer.
 *
 * Usage:
 *   net.connect('Alice')          → connects, returns Promise<void>
 *   net.disconnect()
 *   net.send({ type: 'kick', ... })
 *   net.on('kick', handler)       → register typed message handler
 *   net.off('kick', handler)
 *   net.myName                    → string | null
 *   net.connected                 → boolean
 */

// ─── Server URL ───────────────────────────────────────────────────────────────
// Override at build time via VITE_WS_URL env var; falls back to localhost for dev.
const SERVER_URL = (import.meta.env.VITE_WS_URL as string | undefined) ?? 'ws://localhost:3001';

// ─── Message types (server → client) ─────────────────────────────────────────

export interface Player { name: string; state: 'waiting' | 'paired' | 'playing'; }

export type ServerMsg =
  | { type: 'connected';            name: string }
  | { type: 'error';                message: string }
  | { type: 'user-list';            players: Player[] }
  | { type: 'pair-request';         from: string }
  | { type: 'pair-rejected';        by: string }
  | { type: 'paired';               with: string }
  | { type: 'unpairing';            reason: string }
  | { type: 'partner-disconnected'; name: string }
  | { type: 'select-level';         levelId: string; startingPlayer: string }
  | { type: 'kick';                 coinIndex: number; vx: number; vy: number }
  | { type: 'pos-stream';           positions: {x:number,y:number}[]; kickoffHit: boolean; split: boolean }
  | { type: 'settled';              result: 'legal' | 'foul' | 'goal'; scorer?: number }
  | { type: 'sync';                 positions: {x:number,y:number}[]; result: 'play-on'|'foul'|'goal'; scorer?: number; isOwnGoal?: boolean };

// ─── Message types (client → server) ─────────────────────────────────────────

export type ClientMsg =
  | { type: 'list' }
  | { type: 'pair-request';  target: string }
  | { type: 'pair-accept';   target: string }
  | { type: 'pair-reject';   target: string }
  | { type: 'unpair' }
  | { type: 'select-level';  levelId: string }
  | { type: 'kick';          coinIndex: number; vx: number; vy: number }
  | { type: 'pos-stream';    positions: {x:number,y:number}[]; kickoffHit: boolean; split: boolean }
  | { type: 'settled';       result: 'legal' | 'foul' | 'goal'; scorer?: number }
  | { type: 'sync';          positions: {x:number,y:number}[]; result: 'play-on'|'foul'|'goal'; scorer?: number; isOwnGoal?: boolean };

// ─── Handler map ─────────────────────────────────────────────────────────────

type MsgType = ServerMsg['type'];
type HandlerFor<T extends MsgType> = (msg: Extract<ServerMsg, { type: T }>) => void;
type AnyHandler = (msg: ServerMsg) => void;

// ─── Net singleton ────────────────────────────────────────────────────────────

class Net {
  private ws: WebSocket | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private handlers = new Map<string, Set<any>>();

  myName: string | null = null;
  partner: string | null = null;

  get connected() { return this.ws?.readyState === WebSocket.OPEN; }

  connect(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws) this.ws.close();

      const url = `${SERVER_URL}?name=${encodeURIComponent(name)}`;
      this.ws = new WebSocket(url);

      this.ws.onopen = () => { /* wait for 'connected' msg */ };

      this.ws.onmessage = (event) => {
        let msg: ServerMsg;
        try { msg = JSON.parse(event.data as string) as ServerMsg; }
        catch { return; }

        // Connection handshake
        if (msg.type === 'connected') { this.myName = msg.name; resolve(); }
        if (msg.type === 'error') { reject(new Error(msg.message)); this.ws?.close(); return; }

        // Track partner
        if (msg.type === 'paired')               this.partner = msg.with;
        if (msg.type === 'unpairing')            this.partner = null;
        if (msg.type === 'partner-disconnected') this.partner = null;

        this._dispatch(msg);
      };

      this.ws.onerror = () => reject(new Error('WebSocket error'));
      this.ws.onclose = () => {
        this.myName = null;
        this.partner = null;
        this._dispatch({ type: 'partner-disconnected', name: '' } as ServerMsg);
      };
    });
  }

  disconnect() {
    this.ws?.close();
    this.ws = null;
    this.myName = null;
    this.partner = null;
  }

  send(msg: ClientMsg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on<T extends MsgType>(type: T, handler: HandlerFor<T>) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler as AnyHandler);
  }

  off<T extends MsgType>(type: T, handler: HandlerFor<T>) {
    this.handlers.get(type)?.delete(handler as AnyHandler);
  }

  private _dispatch(msg: ServerMsg) {
    this.handlers.get(msg.type)?.forEach(h => (h as AnyHandler)(msg));
  }
}

export const net = new Net();
