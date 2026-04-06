# Table Soccer — Design Notes

## Core Mechanic

Always 3 coins. No ball. Always refer to them as **coins**.

- **Kickoff:** kicked coin must hit at least one of the other two coins, or it is a foul.
- **Normal play:** kicked coin must pass *between* the other two coins — crossing the line (gate) between them makes the kick legal.

The gate mechanic is the defining feature of the game. Positioning all three coins matters every turn, not just where the kicked one ends up.

---

## Level Types

### Match (type: 'field')
Symmetric field, two goals. Soccer-style — race to score goals.

- Turn-by-turn: board rotates 180° for local handover so each player always attacks the top goal.
- Networked: board stays static, goal always at top for each player on their own screen.
- First to 3 goals wins (configurable).
- Level boundary is drawn as a half-shape; the editor mirrors it 180° to create the full closed polygon.
- Polys and ellipses are also mirrored at runtime in GameScene.

### Course (type: 'course')
Asymmetric obstacle course. Single player. A challenge of accuracy and clever coin placement.

- The designer draws the **full** boundary polyline — no mirroring. The closing edge (last→first vertex) is where the single goal sits.
- Same 3-coin gate mechanic applies throughout.
- **Par:** maximum faults allowed before the run is failed. Set in the editor.
- **Timer:** starts on the first kick, stops on goal. Displayed in HUD.
- **Score:** faults (primary) + time (secondary tiebreak). Lower is better.
- Foul = coins return to last legal position (respawn outside sink if sink foul); turn stays with same player.
- Resetting to kickoff (Backspace) costs a fault.
- Hitting a sink obstacle is a fault.
- No board rotation between turns.
- Leaderboard: planned but not yet implemented. Will require login (name) to submit.

---

## Game Modes

| Mode | Level Type | Notes |
|---|---|---|
| Single Player | Course | Solo puzzle / challenge levels — implemented |
| Single Player vs AI | Match | Simple AI opponent — not yet built |
| Two Player (same machine) | Match | Current local implementation — board rotates |
| Two Player Networked | Match | Working — lobby, pairing, pos-stream sync |
| Two Player (Course race) | Course | Both attempt same course, compare results — future |

### AI

Initial AI: look 2 moves ahead, bias toward goal. No blocking, no trick shots.
Keep ML upgrade path open — this game could make an interesting ML test later.

---

## Foul Conditions

### Match
- Kicked coin does not pass between the other two (gate not crossed).
- Coins stay where they are; turn passes to opponent.

### Course
- Kicked coin does not cross the gate (same mechanic as match).
- Hitting a sink obstacle — coin fades, respawns outside the sink.
- Resetting to kickoff (Backspace) — counts as a fault.
- Exceeding par = run failed immediately.

---

## Obstacle Types

| Type | Behaviour | Editor |
|---|---|---|
| Poly (block) | Solid wall — coins bounce off | Polygon tool, Mode: Block |
| Poly (sink) | Sensor — coins pass through, fade, respawn outside. Fault. | Polygon tool, Mode: Sink |
| Ellipse (block) | Solid ellipse obstacle | Ellipse tool, Mode: Block |
| Ellipse (sink) | Sensor sink | Ellipse tool, Mode: Sink |
| Boundary edge (sink) | Edge of the boundary becomes a fall-off edge (no wall) | Shift+click edge in Boundary mode |

Sink respawn: walks backwards along the coin's velocity vector until outside the sink collider, plus 10px margin.

---

## Level Primitives

### Implemented
- **Boundary walls** — arbitrary closed polyline perimeter (field: half + mirror; course: full shape)
- **Goal(s)** — seam edge(s) with spokes; coins crossing scoring line = goal
- **Polys** — solid interior polygon obstacles (block or sink mode)
- **Ellipses** — ellipse obstacles (block or sink mode)
- **Start positions** — 3 coin kickoff positions

### Planned
- **Bouncers** — like walls but restitution > 1 (add energy on bounce)
- **Teleports** — paired portals; coin exits one and enters the other
- **Checkpoints** — save position mid-course (course levels)

---

## Level Format (TypeScript source + JSON sidecar)

Levels are TypeScript files in `src/levels/`. The editor also saves a `.json` sidecar for load/save.

```typescript
interface LevelDef {
  id: string;
  label: string;
  type: 'field' | 'course';
  par?: number;           // course only — max faults before fail
  boundary: BoundaryPoint[];  // { x, y, edgeMode?: 'block'|'sink' }
  polys: PolyDef[];       // { verts: Vec2[], mode?: 'block'|'sink' }
  ellipses?: EllipseDef[]; // { x, y, rx, ry, angle, mode? }
  goals: GoalPost[];
  start: [Vec2, Vec2, Vec2];
  imageUrl?: string;
  tagline?: string;
  coinConfig?: CoinConfig;
  look?: 'neon' | 'ambient';
}
```

Field levels export both goals; course levels export one goal only (scorer: 0).

---

## Level Designer (`/editor.html`)

Canvas2D tool. Sidebar controls.

**Modes:** Boundary, Poly, Ellipse, Start Coins

**Level type selector:** Field or Course — drives mirroring behaviour throughout the editor.

**Field mode:**
- Draw boundary half-shape; editor shows mirrored preview (pink dashed)
- Two goals rendered (cyan top, magenta bottom)
- Polys and ellipses show mirror copies

**Course mode:**
- Draw full boundary — no mirroring shown
- Single goal at closing edge (last→first vertex)
- No mirror polys/ellipses
- Par field shown in sidebar

**Obstacle modes:** Block (solid) or Sink (orange, pass-through fault trigger)

**Boundary sink edges:** Shift+click an edge in Boundary mode to toggle block/sink

**Save/Load:** Writes `.ts` + `.json` to `src/levels/` via Vite dev-server plugin. Game picks up instantly via HMR.

**Export Image Template:** Renders clean 800×800 field → 1024×1024 → POSTs to `/export-image` → `public/field-images/templates/<slug>.png`

---

## Menu (`MenuScene`)

Full DOM overlay — no Phaser UI objects (aside from background rectangle).

Layout order: Title → Play/Login buttons + vs display → Level preview card → Level buttons grid → Hint

**Arrow navigation:** ◀ ▶ buttons beside preview card cycle through all levels.

**Preview card:** Shows `<level>_menu.jpg` from `public/field-images/menus/`, level name, and tagline.

**Lobby:** Fixed-position DOM overlay. States: name-entry → connecting → lobby → pending-out / pending-in → paired.

---

## Physics Notes (Rapier2D)

- Coins: dynamic bodies, CCD enabled, `restitution: 0.95`, `friction: 0.0`
- Walls: fixed cuboid bodies, thickness 20px, shifted outward so inner face aligns with drawn edge
- Sink obstacles: `setSensor(true)` — no collision response, still fires `drainCollisionEvents`
- Ellipse colliders: 24-point convexHull approximation
- `rapierWorld.free()` + `eventQueue.free()` in try/catch on shutdown — WASM cleanup can throw

---

## Visual / Effects Direction

- Neon/Tron aesthetic throughout. Dark backgrounds, glowing edges.
- **Neon look:** glow-ring coins, electric lightning split-line, spark collision FX
- **Ambient look:** drop-shadow coins, expanding glow pulse collision FX, straight split-line
- Electric effects are a strong part of the identity — extend wherever possible.
- Portal entry/exit would suit the electric visual language well.

---

## Deployment

```bash
bash deploy.sh
```

Builds with Vite → commits dist → `git subtree split --prefix dist` to gh-pages branch → force pushes → cleans dist from master → pushes master.

Live: https://rangisutton.github.io/table_soccer/

## Server Deployment (Railway)

WebSocket relay server: `rangisutton/table_soccer_server` on GitHub.
Hosted on Railway — auto-deploys on push to master.

Live: wss://tablesoccerserver-production.up.railway.app

The client reads `VITE_WS_URL` at build time (set in `.env.production`).
Falls back to `ws://localhost:3001` in dev.
