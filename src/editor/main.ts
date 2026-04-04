const CW = 800, CH = 800;
const CX = CW / 2, CY = CH / 2;
const GRID = 20;
const HANDLE_R = 7;
const EDGE_HIT = 10; // px — distance to register a click as "on an edge"

let exportMode = false;

interface Vec2 { x: number; y: number; }
type ObstacleMode = 'block' | 'sink';
interface EllipseDef { x: number; y: number; rx: number; ry: number; angle: number; mode?: ObstacleMode; }
interface PolyState { verts: Vec2[]; mode: ObstacleMode; }

function mirror(v: Vec2): Vec2 {
  return { x: 2 * CX - v.x, y: 2 * CY - v.y };
}
function lerp2(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function dist2(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}
function normalize(v: Vec2): Vec2 {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}
function projectOnSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return 0;
  return Math.max(0.05, Math.min(0.95, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
}

/** Distance from point p to segment a-b. Returns { dist, t } */
function distToSegment(p: Vec2, a: Vec2, b: Vec2): { dist: number; t: number } {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { dist: dist2(p, a), t: 0 };
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const closest = { x: a.x + t * dx, y: a.y + t * dy };
  return { dist: dist2(p, closest), t };
}

// ─── State ────────────────────────────────────────────────────────────────────

type Mode = 'boundary' | 'poly' | 'start' | 'ellipse';

interface DragTarget {
  type: 'half-vert' | 'start-coin' | 'poly-vert' | 'goal' | 'ellipse';
  polyIdx: number;
  vertIdx: number;
}

const state = {
  halfVerts: [] as Vec2[],
  halfEdgeModes: [] as ObstacleMode[], // mode of edge from halfVerts[i] to halfVerts[i+1]
  goal: { t: 0.5, gap: 80, spoke: 50 },
  polys: [] as PolyState[],
  activePoly: null as Vec2[] | null,
  selectedPolyIdx: null as number | null,
  start: null as [Vec2, Vec2, Vec2] | null,
  mode: 'boundary' as Mode,
  ellipses: [] as EllipseDef[],
  selectedEllipseIdx: null as number | null,
  ellipseRx: 60,
  ellipseEcc: 0,
  ellipseAngle: 0,
  drag: null as DragTarget | null,
  snapGrid: true,
  levelName: 'My Field',
  levelType: 'field' as 'field' | 'course',
  par: 5,
  tagline: '',
  imageUrl: null as string | null,
  look: 'neon' as string,
  coinRadius: 10,
  coinKickPower: 1.0,
  coinDrag: 5.0,
  bgImage: null as HTMLImageElement | null,
  showBgImage: false,
  bgImageStatus: 'none' as 'none' | 'loading' | 'loaded' | 'error',
};

// ─── Computed geometry ────────────────────────────────────────────────────────

function fullBoundary(): Vec2[] {
  if (state.halfVerts.length < 2) return [];
  if (state.levelType === 'course') return [...state.halfVerts];
  return [...state.halfVerts, ...state.halfVerts.map(mirror)];
}

/** For courses: the closing edge between last and first vert, where the goal sits. */
function courseSeam(): [Vec2, Vec2] | null {
  const n = state.halfVerts.length;
  if (n < 2) return null;
  return [state.halfVerts[n - 1], state.halfVerts[0]];
}

/** The seam carrying the primary (top/only) goal. */
function activeGoalSeam(): [Vec2, Vec2] | null {
  if (state.levelType === 'course') return courseSeam();
  const seams = orderedSeams();
  return seams ? seams[0] : null;
}

function seamEdge1(): [Vec2, Vec2] | null {
  const n = state.halfVerts.length;
  if (n < 2) return null;
  return [state.halfVerts[n - 1], mirror(state.halfVerts[0])];
}

function seamEdge2(): [Vec2, Vec2] | null {
  const n = state.halfVerts.length;
  if (n < 2) return null;
  return [mirror(state.halfVerts[n - 1]), state.halfVerts[0]];
}

interface GoalPost {
  leftBase: Vec2; rightBase: Vec2;
  leftTip: Vec2; rightTip: Vec2;
  scorer: 0 | 1;
}

function computeGoal(seam: [Vec2, Vec2], scorer: 0 | 1): GoalPost {
  const [a, b] = seam;
  const centre = lerp2(a, b, state.goal.t);
  const edgeLen = dist2(a, b);
  const edgeDir = { x: (b.x - a.x) / edgeLen, y: (b.y - a.y) / edgeLen };
  const toCentre = normalize({ x: CX - centre.x, y: CY - centre.y });
  const half = state.goal.gap / 2;
  const leftBase  = { x: centre.x - edgeDir.x * half, y: centre.y - edgeDir.y * half };
  const rightBase = { x: centre.x + edgeDir.x * half, y: centre.y + edgeDir.y * half };
  const leftTip   = { x: leftBase.x  + toCentre.x * state.goal.spoke, y: leftBase.y  + toCentre.y * state.goal.spoke };
  const rightTip  = { x: rightBase.x + toCentre.x * state.goal.spoke, y: rightBase.y + toCentre.y * state.goal.spoke };
  return { leftBase, rightBase, leftTip, rightTip, scorer };
}

/** All polys; mirrors included only for field levels */
function allPolys(): { verts: Vec2[]; isMirror: boolean; mode: ObstacleMode }[] {
  const result: { verts: Vec2[]; isMirror: boolean; mode: ObstacleMode }[] = [];
  for (const p of state.polys) {
    result.push({ verts: p.verts, isMirror: false, mode: p.mode });
    if (state.levelType === 'field') {
      result.push({ verts: p.verts.map(mirror), isMirror: true, mode: p.mode });
    }
  }
  return result;
}

function autoStart(): [Vec2, Vec2, Vec2] {
  const boundary = fullBoundary();
  let maxY = CY + 20;
  for (const v of boundary) maxY = Math.max(maxY, v.y);
  const spread = 36;
  const baseY = CY + (maxY - CY) * 0.65;
  return [
    { x: CX,               y: baseY + spread },
    { x: CX - spread * 0.65, y: baseY - spread * 0.5 },
    { x: CX + spread * 0.65, y: baseY - spread * 0.5 },
  ];
}

function getStart(): [Vec2, Vec2, Vec2] {
  return state.start ?? autoStart();
}

// ─── Canvas ───────────────────────────────────────────────────────────────────

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function canvasCoords(e: MouseEvent): Vec2 {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - rect.left) * (CW / rect.width),
    y: (e.clientY - rect.top)  * (CH / rect.height),
  };
}

function snap(v: Vec2): Vec2 {
  if (!state.snapGrid) return v;
  return { x: Math.round(v.x / GRID) * GRID, y: Math.round(v.y / GRID) * GRID };
}

// ─── Background image ─────────────────────────────────────────────────────────

function loadBgImage(url: string) {
  state.bgImageStatus = 'loading';
  updateBgStatus();
  const img = new Image();
  img.onload = () => {
    state.bgImage = img;
    state.bgImageStatus = 'loaded';
    updateBgStatus();
  };
  img.onerror = () => {
    state.bgImage = null;
    state.bgImageStatus = 'error';
    updateBgStatus();
  };
  img.src = url;
}

function updateBgStatus() {
  const el = document.getElementById('bgStatus');
  if (!el) return;
  const showCb = document.getElementById('showBgImage') as HTMLInputElement | null;
  if (state.bgImageStatus === 'loaded') {
    el.textContent = 'Image loaded';
    el.style.color = '#00ff88';
    if (showCb) showCb.disabled = false;
  } else if (state.bgImageStatus === 'loading') {
    el.textContent = 'Loading…';
    el.style.color = '#446688';
    if (showCb) showCb.disabled = true;
  } else if (state.bgImageStatus === 'error') {
    el.textContent = 'Not found';
    el.style.color = '#ff4422';
    if (showCb) showCb.disabled = true;
  } else {
    el.textContent = '';
    if (showCb) showCb.disabled = true;
  }
}

// ─── Edge split detection ─────────────────────────────────────────────────────

/** Find closest edge on the half-vert polyline within EDGE_HIT. Returns insertion index or -1. */
function findHalfEdgeHit(p: Vec2): { insertAt: number; point: Vec2 } | null {
  const verts = state.halfVerts;
  if (verts.length < 2) return null;
  let best = { dist: EDGE_HIT + 1, insertAt: -1, t: 0 };
  for (let i = 0; i < verts.length - 1; i++) {
    const { dist, t } = distToSegment(p, verts[i], verts[i + 1]);
    if (dist < best.dist) best = { dist, insertAt: i + 1, t };
  }
  if (best.insertAt === -1) return null;
  const a = verts[best.insertAt - 1], b = verts[best.insertAt];
  const point = snap(lerp2(a, b, best.t));
  return { insertAt: best.insertAt, point };
}

/** Find closest edge on a poly polygon within EDGE_HIT. */
function findPolyEdgeHit(p: Vec2, polyIdx: number): { insertAt: number; point: Vec2 } | null {
  const b = state.polys[polyIdx]?.verts;
  if (!b || b.length < 2) return null;
  let best = { dist: EDGE_HIT + 1, insertAt: -1, t: 0 };
  for (let i = 0; i < b.length; i++) {
    const a = b[i], bv = b[(i + 1) % b.length];
    const { dist, t } = distToSegment(p, a, bv);
    if (dist < best.dist) best = { dist, insertAt: i + 1, t };
  }
  if (best.insertAt === -1) return null;
  const a = b[best.insertAt - 1], bv = b[best.insertAt % b.length];
  const point = snap(lerp2(a, bv, best.t));
  return { insertAt: best.insertAt, point };
}

// ─── Drawing ──────────────────────────────────────────────────────────────────

function draw() {
  ctx.clearRect(0, 0, CW, CH);
  const isCourse = state.levelType === 'course';
  const showBg = !exportMode && state.showBgImage && state.bgImage !== null;
  if (!exportMode) {
    ctx.fillStyle = '#010118';
    ctx.fillRect(0, 0, CW, CH);
    if (showBg) {
      ctx.drawImage(state.bgImage!, 0, 0, CW, CH);
    }
    drawGrid();
  }

  const boundary = fullBoundary();
  if (boundary.length >= 4) {
    if (!showBg) drawFieldFill(boundary);
    if (!showBg && !isCourse) drawHalfTints(boundary);
    drawBoundaryBorder(boundary);
  }

  if (!exportMode) {
    if (!isCourse) drawSeamEdges();
    if (!isCourse) drawMirrorHalf();
    drawUserHalf();
  }
  drawEllipses(showBg);
  drawPolys(showBg);
  drawGoals();
  if (!exportMode && boundary.length >= 4) drawStartCoins();
  if (!exportMode) {
    drawCentreLines();
    drawHandles();
  }
}

function drawGrid() {
  ctx.strokeStyle = '#0a0a28'; ctx.lineWidth = 0.5;
  for (let x = 0; x <= CW; x += GRID) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CH); ctx.stroke();
  }
  for (let y = 0; y <= CH; y += GRID) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CW, y); ctx.stroke();
  }
}

function drawCentreLines() {
  ctx.strokeStyle = '#0a2a3a'; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.beginPath(); ctx.moveTo(CX, 0); ctx.lineTo(CX, CH); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, CY); ctx.lineTo(CW, CY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = '#00ffee55';
  ctx.beginPath(); ctx.arc(CX, CY, 4, 0, Math.PI * 2); ctx.fill();
}

function drawFieldFill(boundary: Vec2[]) {
  ctx.fillStyle = '#030320'; polyPath(boundary); ctx.fill();
}

function drawHalfTints(boundary: Vec2[]) {
  drawHalfFill(boundary, true,  'rgba(0,255,238,0.06)');
  drawHalfFill(boundary, false, 'rgba(255,0,204,0.06)');
}

function drawHalfFill(boundary: Vec2[], topHalf: boolean, color: string) {
  const sign = topHalf ? -1 : 1;
  const pts: Vec2[] = [];
  const n = boundary.length;
  for (let i = 0; i < n; i++) {
    const a = boundary[i], b = boundary[(i + 1) % n];
    const aIn = sign * (a.y - CY) <= 0;
    const bIn = sign * (b.y - CY) <= 0;
    if (aIn) pts.push(a);
    if (aIn !== bIn) {
      const t = (a.y - CY) / (a.y - b.y);
      pts.push({ x: a.x + t * (b.x - a.x), y: CY });
    }
  }
  if (pts.length < 3) return;
  ctx.fillStyle = color; polyPath(pts); ctx.fill();
}

function drawBoundaryBorder(boundary: Vec2[]) {
  const n = boundary.length;
  const hn = state.halfVerts.length;
  if (exportMode) {
    ctx.strokeStyle = '#00ffee'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(boundary[0].x, boundary[0].y);
    for (let i = 1; i < n; i++) ctx.lineTo(boundary[i].x, boundary[i].y);
    ctx.closePath(); ctx.stroke();
    return;
  }
  const seams = state.levelType === 'field' ? orderedSeams() : null;
  for (let i = 0; i < n; i++) {
    const a = boundary[i], b = boundary[(i + 1) % n];
    // Course: closing edge (last→first) is always the goal gap — skip it
    if (state.levelType === 'course' && i === n - 1) continue;
    // Field: skip the two seam edges (goal openings)
    const isSeam = seams && seams.some(([sa, sb]) => dist2(a, sa) < 2 && dist2(b, sb) < 2);
    if (isSeam) continue;
    const edgeIdx = i < hn ? i : i - hn;
    const edgeMode = state.halfEdgeModes[edgeIdx] ?? 'block';
    const isSink = edgeMode === 'sink';
    const baseCol = isSink
      ? '#ff6600'
      : (state.levelType === 'course' ? '#00ffee' : ((a.y + b.y) / 2 < CY ? '#00ffee' : '#ff00cc'));
    ctx.strokeStyle = baseCol + '26'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.strokeStyle = baseCol; ctx.lineWidth = 2;
    if (isSink) ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawSeamEdges() {
  const seams = orderedSeams();
  if (!seams) return;
  ctx.strokeStyle = '#ffaa0044'; ctx.lineWidth = 1; ctx.setLineDash([6, 4]);
  for (const [a, b] of seams) {
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawMirrorHalf() {
  if (state.halfVerts.length < 2) return;
  const mirrored = state.halfVerts.map(mirror);
  ctx.strokeStyle = 'rgba(255,0,204,0.4)'; ctx.lineWidth = 1.5; ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(mirrored[0].x, mirrored[0].y);
  for (let i = 1; i < mirrored.length; i++) ctx.lineTo(mirrored[i].x, mirrored[i].y);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,0,204,0.25)';
  for (const v of mirrored) {
    ctx.beginPath(); ctx.arc(v.x, v.y, 4, 0, Math.PI * 2); ctx.fill();
  }
}

function drawUserHalf() {
  const verts = state.halfVerts;
  if (verts.length < 2) return;
  ctx.strokeStyle = '#00ffee'; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(verts[0].x, verts[0].y);
  for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
  ctx.stroke();
}

function orderedSeams(): [[Vec2,Vec2], [Vec2,Vec2]] | null {
  const s1 = seamEdge1(), s2 = seamEdge2();
  if (!s1 || !s2) return null;
  const m1y = (s1[0].y + s1[1].y) / 2;
  const m2y = (s2[0].y + s2[1].y) / 2;
  return m1y <= m2y ? [s1, s2] : [s2, s1]; // [topSeam, bottomSeam]
}

function drawGoals() {
  const goalSeam = activeGoalSeam();
  if (!goalSeam) return;
  const fieldSeams = state.levelType === 'field' ? orderedSeams() : null;
  const goalSeams: [[Vec2,Vec2], 0|1][] = state.levelType === 'course'
    ? [[goalSeam, 0]]
    : fieldSeams ? [[fieldSeams[0], 0], [fieldSeams[1], 1]] : [];
  for (const [seam, scorer] of goalSeams) {
    const g = computeGoal(seam, scorer);
    const col = scorer === 0 ? '#00ffee' : '#ff00cc';
    ctx.strokeStyle = col; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(g.leftBase.x, g.leftBase.y); ctx.lineTo(g.leftTip.x, g.leftTip.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(g.rightBase.x, g.rightBase.y); ctx.lineTo(g.rightTip.x, g.rightTip.y); ctx.stroke();
    ctx.strokeStyle = '#ffcc0077'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(g.leftTip.x, g.leftTip.y); ctx.lineTo(g.rightTip.x, g.rightTip.y); ctx.stroke();
  }
  if (!exportMode) {
    const goalCentre = lerp2(goalSeam[0], goalSeam[1], state.goal.t);
    ctx.strokeStyle = '#ffcc00'; ctx.fillStyle = '#ffcc0033'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(goalCentre.x, goalCentre.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}

function drawEllipses(showBg = false) {
  for (let ei = 0; ei < state.ellipses.length; ei++) {
    const e = state.ellipses[ei];
    const isSel = state.selectedEllipseIdx === ei;
    // Draw mirror (field levels only)
    if (state.levelType === 'field') {
    const mx = 2 * CX - e.x, my = 2 * CY - e.y;
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
    if (exportMode) {
      ctx.fillStyle = '#888888';
      ctx.fill();
      ctx.strokeStyle = '#446688';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      if (!showBg) { ctx.fillStyle = 'rgba(255,0,204,0.06)'; ctx.fill(); }
      ctx.strokeStyle = 'rgba(255,0,204,0.35)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    } // end field-only mirror
    // Draw original
    const selActive = isSel && !exportMode;
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);
    ctx.beginPath();
    ctx.ellipse(0, 0, e.rx, e.ry, 0, 0, Math.PI * 2);
    if (exportMode) {
      ctx.fillStyle = '#888888'; ctx.fill();
    } else if (!showBg) {
      ctx.fillStyle = selActive ? 'rgba(0,200,255,0.08)' : 'rgba(3,3,32,0.85)';
      ctx.fill();
    }
    ctx.strokeStyle = selActive ? '#00ccff' : '#446688';
    ctx.lineWidth = selActive ? 2 : 1.5;
    ctx.stroke();
    ctx.restore();
    if (!exportMode) {
      // Centre handle
      ctx.strokeStyle = selActive ? '#00ccff' : '#334466';
      ctx.fillStyle   = selActive ? '#00ccff33' : '#33446622';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    }
  }
}

function drawPolys(showBg = false) {
  // Draw mirrors first (behind)
  for (const { verts, isMirror, mode } of allPolys()) {
    if (!isMirror) continue;
    if (verts.length === 0) continue;
    const isSink = mode === 'sink';
    if (exportMode) {
      ctx.fillStyle = isSink ? '#331100' : '#888888';
      ctx.strokeStyle = isSink ? '#ff6600' : '#446688';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      ctx.strokeStyle = isSink ? 'rgba(255,102,0,0.4)' : 'rgba(255,0,204,0.35)';
      ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
      for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
      ctx.closePath();
      if (!showBg) { ctx.fillStyle = isSink ? 'rgba(255,102,0,0.06)' : 'rgba(255,0,204,0.06)'; ctx.fill(); }
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  // Draw user polys
  for (let bi = 0; bi < state.polys.length; bi++) {
    const { verts, mode } = state.polys[bi];
    const isSelected = state.selectedPolyIdx === bi;
    const isSink = mode === 'sink';
    if (verts.length === 0) continue;
    ctx.strokeStyle = isSelected ? '#00ccff' : (isSink ? '#ff6600' : '#446688');
    ctx.lineWidth = isSelected ? 2 : 1.5;
    ctx.beginPath(); ctx.moveTo(verts[0].x, verts[0].y);
    for (let i = 1; i < verts.length; i++) ctx.lineTo(verts[i].x, verts[i].y);
    ctx.closePath();
    if (exportMode) {
      ctx.fillStyle = isSink ? '#331100' : '#888888'; ctx.fill();
    } else if (!showBg) {
      ctx.fillStyle = isSelected ? 'rgba(0,200,255,0.08)' : (isSink ? 'rgba(255,102,0,0.12)' : 'rgba(3,3,32,0.85)');
      ctx.fill();
    }
    ctx.stroke();
  }
  // Active (in-progress) poly being drawn
  if (state.activePoly && state.activePoly.length > 0) {
    const b = state.activePoly;
    ctx.fillStyle = 'rgba(255,170,0,0.08)'; ctx.strokeStyle = '#ffaa00'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(b[0].x, b[0].y);
    for (let i = 1; i < b.length; i++) ctx.lineTo(b[i].x, b[i].y);
    ctx.stroke();
    const mb = b.map(mirror);
    ctx.strokeStyle = 'rgba(255,0,204,0.3)'; ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(mb[0].x, mb[0].y);
    for (let i = 1; i < mb.length; i++) ctx.lineTo(mb[i].x, mb[i].y);
    ctx.stroke(); ctx.setLineDash([]);
  }
}

function drawStartCoins() {
  const [c0, c1, c2] = getStart();
  const colors = ['#00ff44', '#0088ff', '#0088ff'];
  for (let i = 0; i < 3; i++) {
    const coin = [c0, c1, c2][i];
    ctx.strokeStyle = colors[i]; ctx.fillStyle = colors[i] + '33'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(coin.x, coin.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors[i];
    ctx.font = 'bold 10px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), coin.x, coin.y);
  }
}

function drawHandles() {
  for (let i = 0; i < state.halfVerts.length; i++) {
    const v = state.halfVerts[i];
    ctx.strokeStyle = i === 0 ? '#ffcc00' : '#00ffee';
    ctx.fillStyle   = i === 0 ? '#ffcc0033' : '#00ffee22';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(v.x, v.y, HANDLE_R, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  for (let bi = 0; bi < state.polys.length; bi++) {
    const isSelected = state.selectedPolyIdx === bi;
    const isSink = state.polys[bi].mode === 'sink';
    for (const v of state.polys[bi].verts) {
      ctx.strokeStyle = isSelected ? '#00ccff' : (isSink ? '#ff6600' : '#446688');
      ctx.fillStyle   = isSelected ? '#00ccff22' : '#44668822';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  if (state.activePoly) {
    for (const v of state.activePoly) {
      ctx.strokeStyle = '#ffaa00'; ctx.fillStyle = '#ffaa0022'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(v.x, v.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
}

function polyPath(pts: Vec2[]) {
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();
}

// ─── Hit testing ──────────────────────────────────────────────────────────────

function hitTest(p: Vec2): DragTarget | null {
  const goalSeam = activeGoalSeam();
  if (goalSeam) {
    const gc = lerp2(goalSeam[0], goalSeam[1], state.goal.t);
    if (dist2(p, gc) < HANDLE_R + 4) return { type: 'goal', polyIdx: 0, vertIdx: 0 };
  }
  for (let i = 0; i < state.halfVerts.length; i++) {
    if (dist2(p, state.halfVerts[i]) < HANDLE_R + 2) return { type: 'half-vert', polyIdx: 0, vertIdx: i };
  }
  if (state.mode === 'start') {
    const coins = getStart();
    for (let i = 0; i < 3; i++) {
      if (dist2(p, coins[i]) < 16) return { type: 'start-coin', polyIdx: 0, vertIdx: i };
    }
  }
  for (let bi = 0; bi < state.polys.length; bi++) {
    for (let vi = 0; vi < state.polys[bi].verts.length; vi++) {
      if (dist2(p, state.polys[bi].verts[vi]) < HANDLE_R) return { type: 'poly-vert', polyIdx: bi, vertIdx: vi };
    }
  }
  for (let ei = 0; ei < state.ellipses.length; ei++) {
    if (dist2(p, state.ellipses[ei]) < Math.max(state.ellipses[ei].rx, state.ellipses[ei].ry) * 0.4 + 8)
      return { type: 'ellipse', polyIdx: ei, vertIdx: 0 };
  }
  return null;
}

// ─── Mouse interaction ────────────────────────────────────────────────────────

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  const p = canvasCoords(e);
  const hit = hitTest(p);

  if (hit) {
    // Clicking a poly vert selects that poly
    if (hit.type === 'poly-vert') {
      state.selectedPolyIdx = hit.polyIdx;
      updateDeletePolyBtn();
      syncPolyModeUI(hit.polyIdx);
    }
    if (hit.type === 'ellipse') {
      state.selectedEllipseIdx = hit.polyIdx;
      updateEllipseDeleteBtn();
      syncEllipseUI(hit.polyIdx);
    }
    state.drag = hit;
    draw();
    return;
  }

  const snapped = snap(p);

  if (state.mode === 'boundary') {
    const edgeHit = findHalfEdgeHit(p);
    if (edgeHit) {
      // Shift+click on edge: toggle sink mode for that edge (don't split)
      if (e.shiftKey) {
        const edgeIdx = edgeHit.insertAt - 1;
        const cur = state.halfEdgeModes[edgeIdx] ?? 'block';
        state.halfEdgeModes[edgeIdx] = cur === 'sink' ? 'block' : 'sink';
      } else {
        state.halfVerts.splice(edgeHit.insertAt, 0, edgeHit.point);
        // Insert a default mode entry for the new edge
        state.halfEdgeModes.splice(edgeHit.insertAt, 0, 'block');
      }
    } else {
      state.halfVerts.push(snapped);
      state.halfEdgeModes.push('block');
    }
    save();
  } else if (state.mode === 'poly') {
    // Check for edge split on selected poly
    if (state.selectedPolyIdx !== null) {
      const edgeHit = findPolyEdgeHit(p, state.selectedPolyIdx);
      if (edgeHit) {
        state.polys[state.selectedPolyIdx].verts.splice(edgeHit.insertAt, 0, edgeHit.point);
        save(); draw(); return;
      }
    }
    // Otherwise add to active poly
    if (!state.activePoly) state.activePoly = [];
    state.activePoly.push(snapped);
  } else if (state.mode === 'ellipse') {
    const ry = state.ellipseRx * (1 - state.ellipseEcc / 100);
    const newEll: EllipseDef = { x: p.x, y: p.y, rx: state.ellipseRx, ry, angle: state.ellipseAngle * Math.PI / 180 };
    state.ellipses.push(newEll);
    state.selectedEllipseIdx = state.ellipses.length - 1;
    updateEllipseDeleteBtn();
    save();
  }
  draw();
});

canvas.addEventListener('mousemove', (e) => {
  if (!state.drag) return;
  const p = canvasCoords(e);
  const snapped = snap(p);
  const { type, polyIdx, vertIdx } = state.drag;

  if (type === 'half-vert') {
    state.halfVerts[vertIdx] = snapped; save();
  } else if (type === 'start-coin') {
    const coins = getStart();
    coins[vertIdx] = snapped;
    state.start = coins; save();
  } else if (type === 'poly-vert') {
    state.polys[polyIdx].verts[vertIdx] = snapped; save();
  } else if (type === 'ellipse') {
    state.ellipses[polyIdx].x = snapped.x;
    state.ellipses[polyIdx].y = snapped.y;
    save();
  } else if (type === 'goal') {
    const gs = activeGoalSeam();
    if (gs) { state.goal.t = projectOnSegment(p, gs[0], gs[1]); updateGoalUI(); save(); }
  }
  draw();
});

canvas.addEventListener('mouseup', () => { state.drag = null; });

canvas.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  const p = canvasCoords(e);

  if (state.mode === 'boundary') {
    // RMB on a specific vert → delete it; otherwise remove last
    let deleted = false;
    for (let i = 0; i < state.halfVerts.length; i++) {
      if (dist2(p, state.halfVerts[i]) < HANDLE_R + 4) {
        state.halfVerts.splice(i, 1);
        state.halfEdgeModes.splice(i, 1);
        deleted = true; break;
      }
    }
    if (!deleted && state.halfVerts.length > 0) {
      state.halfVerts.pop();
      state.halfEdgeModes.pop();
    }
    save();
  } else if (state.mode === 'poly') {
    if (state.activePoly) {
      // RMB closes the active poly if >= 3 verts, else cancels
      if (state.activePoly.length >= 3) {
        state.polys.push({ verts: state.activePoly, mode: 'block' });
        state.selectedPolyIdx = state.polys.length - 1;
        updateDeletePolyBtn();
        syncPolyModeUI(state.selectedPolyIdx);
        save();
      }
      state.activePoly = null;
    } else if (state.selectedPolyIdx !== null) {
      // RMB on a specific vert of selected poly → delete it
      const b = state.polys[state.selectedPolyIdx].verts;
      for (let i = 0; i < b.length; i++) {
        if (dist2(p, b[i]) < HANDLE_R + 4) {
          b.splice(i, 1);
          if (b.length < 3) {
            state.polys.splice(state.selectedPolyIdx, 1);
            state.selectedPolyIdx = null;
            updateDeletePolyBtn();
          }
          save(); draw(); return;
        }
      }
    }
  } else if (state.mode === 'ellipse') {
    if (state.selectedEllipseIdx !== null) {
      state.ellipses.splice(state.selectedEllipseIdx, 1);
      state.selectedEllipseIdx = null;
      updateEllipseDeleteBtn();
      save();
    }
  }
  draw();
});

// ─── Controls ─────────────────────────────────────────────────────────────────

function setMode(m: Mode) {
  if (state.mode === 'poly' && state.activePoly) {
    if (state.activePoly.length >= 3) {
      state.polys.push({ verts: state.activePoly, mode: 'block' });
      state.selectedPolyIdx = state.polys.length - 1;
      updateDeletePolyBtn();
      syncPolyModeUI(state.selectedPolyIdx);
    }
    state.activePoly = null;
  }
  state.mode = m;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`btn-${m}`)!.classList.add('active');
  const ellSec = document.getElementById('ellipseSection');
  if (ellSec) ellSec.style.display = m === 'ellipse' ? '' : 'none';
  const polySec = document.getElementById('polySection');
  if (polySec) polySec.style.display = m === 'poly' ? '' : 'none';
  draw();
}

function updateDeletePolyBtn() {
  const btn = document.getElementById('btnDeletePoly') as HTMLButtonElement;
  btn.disabled = state.selectedPolyIdx === null;
  btn.style.opacity = state.selectedPolyIdx === null ? '0.3' : '1';
}

function syncPolyModeUI(idx: number) {
  const p = state.polys[idx];
  if (!p) return;
  const sel = document.getElementById('polyMode') as HTMLSelectElement | null;
  if (sel) sel.value = p.mode;
}

function syncEllipseModeUI(idx: number) {
  const e = state.ellipses[idx];
  if (!e) return;
  const sel = document.getElementById('ellipseMode') as HTMLSelectElement | null;
  if (sel) sel.value = e.mode ?? 'block';
}

function updateEllipseDeleteBtn() {
  const btn = document.getElementById('btnDeleteEllipse') as HTMLButtonElement;
  btn.disabled = state.selectedEllipseIdx === null;
  btn.style.opacity = state.selectedEllipseIdx === null ? '0.3' : '1';
}

function updateCoinConfigUI() {
  (document.getElementById('coinRadius') as HTMLInputElement).value = String(state.coinRadius);
  (document.getElementById('coinKickPower') as HTMLInputElement).value = String(Math.round(state.coinKickPower * 10));
  (document.getElementById('coinDrag') as HTMLInputElement).value = String(Math.round(state.coinDrag * 10));
  document.getElementById('coinRadiusVal')!.textContent = String(state.coinRadius);
  document.getElementById('coinKickPowerVal')!.textContent = state.coinKickPower.toFixed(1) + 'x';
  document.getElementById('coinDragVal')!.textContent = state.coinDrag.toFixed(1);
}

function syncEllipseUI(idx: number) {
  const e = state.ellipses[idx];
  if (!e) return;
  const eccPct = Math.round((1 - e.ry / e.rx) * 100);
  const angleDeg = Math.round(e.angle * 180 / Math.PI) % 180;
  (document.getElementById('ellipseRx') as HTMLInputElement).value = String(Math.round(e.rx));
  (document.getElementById('ellipseEcc') as HTMLInputElement).value = String(eccPct);
  (document.getElementById('ellipseAngle') as HTMLInputElement).value = String(angleDeg < 0 ? angleDeg + 180 : angleDeg);
  document.getElementById('ellipseRxVal')!.textContent = String(Math.round(e.rx));
  document.getElementById('ellipseEccVal')!.textContent = eccPct + '%';
  document.getElementById('ellipseAngleVal')!.textContent = angleDeg + '°';
  state.ellipseRx = Math.round(e.rx);
  state.ellipseEcc = eccPct;
  state.ellipseAngle = angleDeg;
  syncEllipseModeUI(idx);
}

document.getElementById('btn-boundary')!.addEventListener('click', () => setMode('boundary'));
document.getElementById('btn-poly')!.addEventListener('click',     () => setMode('poly'));
document.getElementById('btn-start')!.addEventListener('click',    () => setMode('start'));

document.getElementById('btnDeletePoly')!.addEventListener('click', () => {
  if (state.selectedPolyIdx === null) return;
  state.polys.splice(state.selectedPolyIdx, 1);
  state.selectedPolyIdx = null;
  updateDeletePolyBtn();
  save(); draw();
});

(document.getElementById('polyMode') as HTMLSelectElement).addEventListener('change', (ev) => {
  if (state.selectedPolyIdx === null) return;
  state.polys[state.selectedPolyIdx].mode = (ev.target as HTMLSelectElement).value as ObstacleMode;
  save(); draw();
});

const goalTEl     = document.getElementById('goalT')      as HTMLInputElement;
const goalGapEl   = document.getElementById('goalGap')    as HTMLInputElement;
const goalSpokeEl = document.getElementById('goalSpoke')  as HTMLInputElement;

function updateGoalUI() {
  goalTEl.value     = String(Math.round(state.goal.t * 100));
  goalGapEl.value   = String(state.goal.gap);
  goalSpokeEl.value = String(state.goal.spoke);
  document.getElementById('goalTVal')!.textContent     = Math.round(state.goal.t * 100) + '%';
  document.getElementById('goalGapVal')!.textContent   = String(state.goal.gap);
  document.getElementById('goalSpokeVal')!.textContent = String(state.goal.spoke);
}

goalTEl.addEventListener('input', () => {
  state.goal.t = Number(goalTEl.value) / 100;
  document.getElementById('goalTVal')!.textContent = goalTEl.value + '%';
  save(); draw();
});
goalGapEl.addEventListener('input', () => {
  state.goal.gap = Number(goalGapEl.value);
  document.getElementById('goalGapVal')!.textContent = goalGapEl.value;
  save(); draw();
});
goalSpokeEl.addEventListener('input', () => {
  state.goal.spoke = Number(goalSpokeEl.value);
  document.getElementById('goalSpokeVal')!.textContent = goalSpokeEl.value;
  save(); draw();
});

document.getElementById('btn-ellipse')!.addEventListener('click', () => setMode('ellipse'));

document.getElementById('btnDeleteEllipse')!.addEventListener('click', () => {
  if (state.selectedEllipseIdx === null) return;
  state.ellipses.splice(state.selectedEllipseIdx, 1);
  state.selectedEllipseIdx = null;
  updateEllipseDeleteBtn();
  save(); draw();
});

function updateEllipseFromUI() {
  if (state.selectedEllipseIdx !== null) {
    const e = state.ellipses[state.selectedEllipseIdx];
    e.rx = state.ellipseRx;
    e.ry = state.ellipseRx * (1 - state.ellipseEcc / 100);
    e.angle = state.ellipseAngle * Math.PI / 180;
  }
  save(); draw();
}

(document.getElementById('ellipseRx') as HTMLInputElement).addEventListener('input', (ev) => {
  state.ellipseRx = Number((ev.target as HTMLInputElement).value);
  document.getElementById('ellipseRxVal')!.textContent = String(state.ellipseRx);
  updateEllipseFromUI();
});
(document.getElementById('ellipseEcc') as HTMLInputElement).addEventListener('input', (ev) => {
  state.ellipseEcc = Number((ev.target as HTMLInputElement).value);
  document.getElementById('ellipseEccVal')!.textContent = state.ellipseEcc + '%';
  updateEllipseFromUI();
});
(document.getElementById('ellipseAngle') as HTMLInputElement).addEventListener('input', (ev) => {
  state.ellipseAngle = Number((ev.target as HTMLInputElement).value);
  document.getElementById('ellipseAngleVal')!.textContent = state.ellipseAngle + '°';
  updateEllipseFromUI();
});

(document.getElementById('ellipseMode') as HTMLSelectElement).addEventListener('change', (ev) => {
  if (state.selectedEllipseIdx === null) return;
  state.ellipses[state.selectedEllipseIdx].mode = (ev.target as HTMLSelectElement).value as ObstacleMode;
  save(); draw();
});

(document.getElementById('snapGrid') as HTMLInputElement)
  .addEventListener('change', (e) => { state.snapGrid = (e.target as HTMLInputElement).checked; });

(document.getElementById('levelName') as HTMLInputElement)
  .addEventListener('input', (e) => { state.levelName = (e.target as HTMLInputElement).value; save(); });

(document.getElementById('levelType') as HTMLSelectElement)
  .addEventListener('change', (e) => {
    state.levelType = (e.target as HTMLSelectElement).value as 'field' | 'course';
    (document.getElementById('parSection') as HTMLElement).style.display = state.levelType === 'course' ? '' : 'none';
    save();
  });

(document.getElementById('levelPar') as HTMLInputElement)
  .addEventListener('input', (e) => { state.par = parseInt((e.target as HTMLInputElement).value) || 5; save(); });

(document.getElementById('levelTagline') as HTMLTextAreaElement)
  .addEventListener('input', (e) => { state.tagline = (e.target as HTMLTextAreaElement).value; save(); });

document.getElementById('btnClear')!.addEventListener('click', () => {
  if (!confirm('Clear everything?')) return;
  state.halfVerts = []; state.halfEdgeModes = []; state.polys = []; state.activePoly = null;
  state.start = null; state.selectedPolyIdx = null;
  state.ellipses = []; state.selectedEllipseIdx = null;
  updateEllipseDeleteBtn();
  updateDeletePolyBtn();
  localStorage.removeItem('editorState');
  draw();
});

document.getElementById('btnSave')!.addEventListener('click', async () => {
  const content = exportTS();
  if (content.startsWith('//')) { setStatus(content, 'error'); return; }
  const filename = toSlug(state.levelName || 'my-field') + '.ts';
  setStatus('Saving…', 'info');
  try {
    const res = await fetch('/save-level', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, content, state: editorStateForSave() }),
    });
    const json = await res.json();
    if (json.ok) setStatus(`Saved: src/levels/${filename}`, 'ok');
    else setStatus(`Error: ${json.error}`, 'error');
  } catch {
    setStatus('Save failed — is dev server running?', 'error');
  }
});

(document.getElementById('levelLook') as HTMLSelectElement).addEventListener('change', (ev) => {
  state.look = (ev.target as HTMLSelectElement).value;
  save();
});

(document.getElementById('coinRadius') as HTMLInputElement).addEventListener('input', (ev) => {
  state.coinRadius = Number((ev.target as HTMLInputElement).value);
  document.getElementById('coinRadiusVal')!.textContent = String(state.coinRadius);
  save();
});
(document.getElementById('coinKickPower') as HTMLInputElement).addEventListener('input', (ev) => {
  state.coinKickPower = Number((ev.target as HTMLInputElement).value) / 10;
  document.getElementById('coinKickPowerVal')!.textContent = state.coinKickPower.toFixed(1) + 'x';
  save();
});
(document.getElementById('coinDrag') as HTMLInputElement).addEventListener('input', (ev) => {
  state.coinDrag = Number((ev.target as HTMLInputElement).value) / 10;
  document.getElementById('coinDragVal')!.textContent = state.coinDrag.toFixed(1);
  save();
});

document.getElementById('btnLoadBg')!.addEventListener('click', () => {
  const slug = toSlug(state.levelName || 'my-field');
  if (!slug) { updateBgStatus(); return; }
  const url = `/field-images/${slug}.png`;
  state.imageUrl = url;
  loadBgImage(url);
  save();
});

(document.getElementById('showBgImage') as HTMLInputElement).addEventListener('change', (e) => {
  state.showBgImage = (e.target as HTMLInputElement).checked;
});

function setStatus(msg: string, type: 'ok' | 'error' | 'info') {
  const el = document.getElementById('saveStatus')!;
  el.textContent = msg;
  el.style.color = type === 'ok' ? '#00ff88' : type === 'error' ? '#ff4422' : '#446688';
}

// ─── Export ───────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function toCamel(name: string): string {
  return name.split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase())
    .join('') + 'Level';
}
function v2s(v: Vec2): string {
  return `{ x: ${Math.round(v.x)}, y: ${Math.round(v.y)} }`;
}

function exportTS(): string {
  const isCourse = state.levelType === 'course';
  const boundary = isCourse ? [...state.halfVerts] : fullBoundary();
  if (boundary.length < 3) return '// Need at least 3 boundary verts to export.';
  const gs = activeGoalSeam()!;
  const g1 = computeGoal(gs, 0);
  const g2 = isCourse ? g1 : computeGoal(orderedSeams()![1], 1);
  const [sa, sb, sc] = getStart();
  const name  = state.levelName || 'My Field';
  const id    = toSlug(name);
  const ident = toCamel(name);

  // Boundary: emit edgeMode where non-default ('block'), using halfVerts indices
  // Full boundary = halfVerts + mirrors; edge i uses halfEdgeModes[i % halfVerts.length]
  const hn = state.halfVerts.length;
  const bLines = boundary.map((v, i) => {
    const eMode = state.halfEdgeModes[i < hn ? i : i - hn] ?? 'block';
    const modeStr = eMode === 'sink' ? `, edgeMode: 'sink'` : '';
    return `    { x: ${Math.round(v.x)}, y: ${Math.round(v.y)}${modeStr} },`;
  }).join('\n');
  // Only export user-drawn polys — mirrors are added at runtime by GameScene
  const blLines = state.polys.map(p => {
    const vertsStr = p.verts.map(v => `      ${v2s(v)},`).join('\n');
    const modeStr = p.mode === 'sink' ? `, mode: 'sink'` : '';
    return `    { verts: [\n${vertsStr}\n    ]${modeStr} },`;
  }).join('\n');
  const elLines = state.ellipses.map(e => {
    const modeStr = e.mode === 'sink' ? `, mode: 'sink'` : '';
    return `    { x: ${Math.round(e.x)}, y: ${Math.round(e.y)}, rx: ${Math.round(e.rx)}, ry: ${Math.round(e.ry)}, angle: ${e.angle.toFixed(4)}${modeStr} },`;
  }).join('\n');

  const goalsBlock = isCourse
    ? `  goals: [
    {
      leftBase:  ${v2s(g1.leftBase)},  rightBase: ${v2s(g1.rightBase)},
      leftTip:   ${v2s(g1.leftTip)},   rightTip:  ${v2s(g1.rightTip)},
      scorer: 0,
    },
  ],`
    : `  goals: [
    {
      leftBase:  ${v2s(g1.leftBase)},  rightBase: ${v2s(g1.rightBase)},
      leftTip:   ${v2s(g1.leftTip)},   rightTip:  ${v2s(g1.rightTip)},
      scorer: 0,
    },
    {
      leftBase:  ${v2s(g2.leftBase)},  rightBase: ${v2s(g2.rightBase)},
      leftTip:   ${v2s(g2.leftTip)},   rightTip:  ${v2s(g2.rightTip)},
      scorer: 1,
    },
  ],`;

  return `import { LevelDef } from '../LevelDef';

export const ${ident}: LevelDef = {
  id: '${id}',
  label: '${name}',
  type: '${state.levelType}',${isCourse ? `\n  par: ${state.par},` : ''}${state.imageUrl ? `\n  imageUrl: '${state.imageUrl}',` : ''}${state.tagline ? `\n  tagline: ${JSON.stringify(state.tagline)},` : ''}
  look: '${state.look}',
  coinConfig: { radius: ${state.coinRadius}, kickPower: ${state.coinKickPower.toFixed(1)}, drag: ${state.coinDrag.toFixed(1)} },
  boundary: [
${bLines}
  ],
  polys: [${blLines ? '\n' + blLines + '\n  ' : ''}],
  ellipses: [${elLines ? '\n' + elLines + '\n  ' : ''}],
${goalsBlock}
  start: [
    ${v2s(sa)},
    ${v2s(sb)},
    ${v2s(sc)},
  ],
};

export default ${ident};
`;
}

async function exportImage() {
  const slug = toSlug(state.levelName || 'my-field');
  if (!slug) { setStatus('Enter a level name first', 'error'); return; }
  const filename = slug + '.png';

  // Render field without editor UI on the main 800×800 canvas
  exportMode = true;
  draw();
  exportMode = false;

  // Scale to 1024×1024
  const off = document.createElement('canvas');
  off.width = 1024; off.height = 1024;
  const octx = off.getContext('2d')!;
  octx.drawImage(canvas, 0, 0, 1024, 1024);
  const data = off.toDataURL('image/png');

  setStatus('Exporting…', 'info');
  try {
    const res = await fetch('/export-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename, data }),
    });
    const json = await res.json();
    if (json.ok) {
      state.imageUrl = `/field-images/${filename}`;
      save();
      setStatus(`Template: public/field-images/templates/${filename}`, 'ok');
    } else {
      setStatus(`Error: ${json.error}`, 'error');
    }
  } catch {
    setStatus('Export failed — is dev server running?', 'error');
  }
  draw(); // restore normal view
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function editorStateForSave() {
  return {
    halfVerts: state.halfVerts,
    halfEdgeModes: state.halfEdgeModes,
    goal: state.goal,
    polys: state.polys,
    ellipses: state.ellipses,
    start: state.start,
    levelName: state.levelName,
    levelType: state.levelType,
    par: state.par,
    tagline: state.tagline,
    imageUrl: state.imageUrl,
    look: state.look,
    coinRadius: state.coinRadius,
    coinKickPower: state.coinKickPower,
    coinDrag: state.coinDrag,
  };
}

function applyState(s: ReturnType<typeof editorStateForSave>) {
  state.halfVerts      = s.halfVerts  ?? [];
  state.halfEdgeModes  = (s as any).halfEdgeModes ?? [];
  state.goal           = s.goal       ?? state.goal;
  // Backwards compat: old saves had blockers: Vec2[][] — convert on load
  if ((s as any).blockers && !s.polys) {
    state.polys = ((s as any).blockers as Vec2[][]).map(b => ({ verts: b, mode: 'block' as ObstacleMode }));
  } else {
    state.polys = (s as any).polys ?? [];
  }
  state.start      = s.start      ?? null;
  state.levelName  = s.levelName  ?? 'My Field';
  state.levelType  = (s as any).levelType  ?? 'field';
  state.par        = (s as any).par        ?? 5;
  state.tagline    = (s as any).tagline    ?? '';
  state.selectedPolyIdx = null;
  state.ellipses     = (s as any).ellipses     ?? [];
  state.imageUrl     = (s as any).imageUrl     ?? null;
  state.look         = (s as any).look         ?? 'neon';
  state.coinRadius   = (s as any).coinRadius   ?? 10;
  state.coinKickPower = (s as any).coinKickPower ?? 1.0;
  state.coinDrag     = (s as any).coinDrag     ?? 5.0;
  state.selectedEllipseIdx = null;
  state.activePoly = null;
  (document.getElementById('levelName') as HTMLInputElement).value = state.levelName;
  (document.getElementById('levelType') as HTMLSelectElement).value = state.levelType;
  (document.getElementById('levelPar') as HTMLInputElement).value = String(state.par);
  (document.getElementById('parSection') as HTMLElement).style.display = state.levelType === 'course' ? '' : 'none';
  (document.getElementById('levelTagline') as HTMLTextAreaElement).value = state.tagline;
  (document.getElementById('levelLook') as HTMLSelectElement).value = state.look;
  updateGoalUI();
  updateDeletePolyBtn();
  updateEllipseDeleteBtn();
  updateCoinConfigUI();
  // Auto-load bg image if we have a URL
  if (state.imageUrl) {
    loadBgImage(state.imageUrl);
  } else {
    state.bgImage = null;
    state.bgImageStatus = 'none';
    updateBgStatus();
  }
}

function save() {
  localStorage.setItem('editorState', JSON.stringify(editorStateForSave()));
}

function loadSaved() {
  const raw = localStorage.getItem('editorState');
  if (!raw) return;
  try { applyState(JSON.parse(raw)); } catch { /* ignore corrupt storage */ }
}

document.getElementById('btnExportImage')!.addEventListener('click', () => exportImage());

document.getElementById('btnLoad')!.addEventListener('click', async () => {
  const slug = toSlug(state.levelName || 'my-field');
  if (!slug) { setStatus('Enter a level name to load', 'error'); return; }
  setStatus('Loading…', 'info');
  try {
    const res = await fetch(`/save-level?file=${slug}.json`);
    if (!res.ok) { setStatus(`Not found: ${slug}.json`, 'error'); return; }
    const s = await res.json();
    applyState(s);
    save();
    setStatus(`Loaded: ${slug}.json`, 'ok');
    draw();
  } catch {
    setStatus('Load failed — is dev server running?', 'error');
  }
});

// ─── Init ─────────────────────────────────────────────────────────────────────

loadSaved();
(document.getElementById('levelLook') as HTMLSelectElement).value = state.look;
updateGoalUI();
updateDeletePolyBtn();
updateEllipseDeleteBtn();
updateCoinConfigUI();
updateBgStatus();

function loop() { draw(); requestAnimationFrame(loop); }
loop();
