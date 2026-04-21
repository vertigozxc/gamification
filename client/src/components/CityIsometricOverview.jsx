import { useTheme } from "../ThemeContext";

/*
 * Isometric city overview.
 *
 * IMPORTANT: local plot coordinates (dx, dy) project onto the plot diamond
 * when max(|dx|, |dy|) ≤ 0.5. Anything outside that square projects OUTSIDE
 * the diamond footprint and visually overflows. Use clampSquare() to enforce.
 */

const DISTRICTS = [
  { id: "sport",       col: 1, row: 0, accent: "#e14b5a" },
  { id: "business",    col: 2, row: 0, accent: "#2d7fd4" },
  { id: "park",        col: 0, row: 1, accent: "#4fa85e" },
  { id: "square",      col: 1, row: 1, accent: "#d9a441" },
  { id: "residential", col: 2, row: 1, accent: "#b57cd0" },
  // Locked expansion row — unlock when all core districts reach level 5
  { id: "aquapark",    col: 0, row: 2, accent: "#5a8fb5", locked: true },
  { id: "university",  col: 1, row: 2, accent: "#8a6abc", locked: true },
  { id: "industrial",  col: 2, row: 2, accent: "#a06838", locked: true }
];

const CORE_DISTRICT_COUNT = 5;

const TILE = 160;
const DEPTH = 0; // plots are flat (no side extrusion)
const CLIP_H = 140; // vertical headroom above plot for tall buildings

// Projection --------------------------------------------------------------
function iso(x, y) { return { x: x - y, y: (x + y) * 0.5 }; }

function plotCentre(col, row) {
  return iso(col * TILE, row * TILE);
}

function plotCorners(cx, cy) {
  return {
    n: { x: cx,        y: cy - TILE * 0.5 },
    e: { x: cx + TILE, y: cy },
    s: { x: cx,        y: cy + TILE * 0.5 },
    w: { x: cx - TILE, y: cy }
  };
}

function toIso(cx, cy, dx, dy, dz = 0) {
  const p = iso(dx * TILE, dy * TILE);
  return { x: cx + p.x, y: cy + p.y - dz };
}

// Local (dx, dy) is inside the plot diamond iff max(|dx|,|dy|) ≤ 0.5.
function clampSquare(dx, dy, margin = 0) {
  const max = 0.5 - margin;
  return [Math.max(-max, Math.min(max, dx)), Math.max(-max, Math.min(max, dy))];
}

function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  if (amount < 0) {
    const a = 1 + amount;
    r = cl(r * a); g = cl(g * a); b = cl(b * a);
  } else {
    r = cl(r + (255 - r) * amount);
    g = cl(g + (255 - g) * amount);
    b = cl(b + (255 - b) * amount);
  }
  return `rgb(${r}, ${g}, ${b})`;
}

// ---------- Primitives ----------

function IsoBox({
  cx, cy, dx, dy, w, d, h,
  palette,
  colorTop, colorL, colorR,
  windows = null,
  door = false
}) {
  const hw = w / 2;
  const hd = d / 2;
  const c = {
    baseWN: toIso(cx, cy, dx - hw, dy - hd, 0),
    baseEN: toIso(cx, cy, dx + hw, dy - hd, 0),
    baseES: toIso(cx, cy, dx + hw, dy + hd, 0),
    baseWS: toIso(cx, cy, dx - hw, dy + hd, 0),
    topWN:  toIso(cx, cy, dx - hw, dy - hd, h),
    topEN:  toIso(cx, cy, dx + hw, dy - hd, h),
    topES:  toIso(cx, cy, dx + hw, dy + hd, h),
    topWS:  toIso(cx, cy, dx - hw, dy + hd, h)
  };
  const topPts    = [c.topWN, c.topEN, c.topES, c.topWS];
  const rightFace = [c.baseEN, c.baseES, c.topES, c.topEN];
  const leftFace  = [c.baseES, c.baseWS, c.topWS, c.topES];
  const toPts = (arr) => arr.map((p) => `${p.x},${p.y}`).join(" ");

  const windowsNodes = [];
  if (windows && h > 10) {
    const { cols = 2, rows = 2, lit = palette.windowOn, unlit = palette.windowOff } = windows;
    const faces = [
      { A: rightFace[0], B: rightFace[1], D: rightFace[3], seed: 0 },
      { A: leftFace[0],  B: leftFace[1],  D: leftFace[3],  seed: 13 }
    ];
    faces.forEach((f, fi) => {
      for (let r = 0; r < rows; r++) {
        for (let col = 0; col < cols; col++) {
          const u0 = (col + 0.22) / cols;
          const u1 = (col + 0.78) / cols;
          const v0 = (r + 0.25) / rows;
          const v1 = (r + 0.75) / rows;
          const pt = (u, v) => ({
            x: f.A.x + (f.B.x - f.A.x) * u + (f.D.x - f.A.x) * v,
            y: f.A.y + (f.B.y - f.A.y) * u + (f.D.y - f.A.y) * v
          });
          const p00 = pt(u0, v0);
          const p10 = pt(u1, v0);
          const p11 = pt(u1, v1);
          const p01 = pt(u0, v1);
          const seed = (r * 7 + col * 3 + f.seed) % 5;
          const fill = seed < 2 ? lit : unlit;
          windowsNodes.push(
            <polygon
              key={`win-${fi}-${r}-${col}`}
              points={`${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`}
              fill={fill}
              stroke={palette.stroke}
              strokeWidth={0.25}
            />
          );
        }
      }
    });
  }

  const doorNodes = [];
  if (door) {
    const A = leftFace[0], B = leftFace[1], D = leftFace[3];
    const pt = (u, v) => ({
      x: A.x + (B.x - A.x) * u + (D.x - A.x) * v,
      y: A.y + (B.y - A.y) * u + (D.y - A.y) * v
    });
    const u0 = 0.4, u1 = 0.6, v0 = 0, v1 = Math.min(0.4, 10 / Math.max(1, h));
    const p00 = pt(u0, v0);
    const p10 = pt(u1, v0);
    const p11 = pt(u1, v1);
    const p01 = pt(u0, v1);
    doorNodes.push(
      <polygon
        key="door"
        points={`${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}`}
        fill="#4a2d1a"
        stroke={palette.stroke}
        strokeWidth={0.4}
      />
    );
  }

  return (
    <g>
      <polygon points={toPts(leftFace)}  fill={colorL || palette.buildingSideL} stroke={palette.stroke} strokeWidth={0.5} />
      <polygon points={toPts(rightFace)} fill={colorR || palette.buildingSideR} stroke={palette.stroke} strokeWidth={0.5} />
      <polygon points={toPts(topPts)}    fill={colorTop || palette.buildingTop}  stroke={palette.stroke} strokeWidth={0.5} />
      {windowsNodes}
      {doorNodes}
    </g>
  );
}

function PitchedRoof({ cx, cy, dx, dy, w, d, wallH, roofH, palette, roofColor = "#8a4b2b" }) {
  const hw = w / 2;
  const hd = d / 2;
  const eNW = toIso(cx, cy, dx - hw, dy - hd, wallH);
  const eNE = toIso(cx, cy, dx + hw, dy - hd, wallH);
  const eSE = toIso(cx, cy, dx + hw, dy + hd, wallH);
  const eSW = toIso(cx, cy, dx - hw, dy + hd, wallH);
  const ridgeN = toIso(cx, cy, dx, dy - hd, wallH + roofH);
  const ridgeS = toIso(cx, cy, dx, dy + hd, wallH + roofH);

  return (
    <g>
      <polygon points={`${eNW.x},${eNW.y} ${eNE.x},${eNE.y} ${ridgeN.x},${ridgeN.y}`}
        fill={shade(roofColor, -0.18)} stroke={palette.stroke} strokeWidth={0.4} />
      <polygon points={`${eNW.x},${eNW.y} ${eSW.x},${eSW.y} ${ridgeS.x},${ridgeS.y} ${ridgeN.x},${ridgeN.y}`}
        fill={shade(roofColor, -0.08)} stroke={palette.stroke} strokeWidth={0.4} />
      <polygon points={`${eNE.x},${eNE.y} ${eSE.x},${eSE.y} ${ridgeS.x},${ridgeS.y} ${ridgeN.x},${ridgeN.y}`}
        fill={roofColor} stroke={palette.stroke} strokeWidth={0.4} />
      <polygon points={`${eSW.x},${eSW.y} ${eSE.x},${eSE.y} ${ridgeS.x},${ridgeS.y}`}
        fill={shade(roofColor, 0.08)} stroke={palette.stroke} strokeWidth={0.4} />
      <line x1={ridgeN.x} y1={ridgeN.y} x2={ridgeS.x} y2={ridgeS.y} stroke={palette.stroke} strokeWidth={0.6} />
    </g>
  );
}

function Chimney({ cx, cy, dx, dy, h, palette }) {
  return (
    <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.03} d={0.03} h={h} palette={palette}
      colorTop="#6a4a2c" colorL="#3a2a1a" colorR="#4a3422" />
  );
}

function IsoTree({ cx, cy, dx, dy, size = 1, palette }) {
  const bot = toIso(cx, cy, dx, dy, 0);
  const mid = toIso(cx, cy, dx, dy, 8 * size);
  const c1  = toIso(cx, cy, dx, dy, 14 * size);
  const c2  = toIso(cx, cy, dx, dy, 18 * size);
  const c3  = toIso(cx, cy, dx + 0.01, dy, 15 * size);
  return (
    <g>
      <line x1={bot.x} y1={bot.y} x2={mid.x} y2={mid.y} stroke={palette.trunk} strokeWidth={2 * size} />
      <circle cx={c1.x} cy={c1.y} r={7 * size} fill={palette.leafDark} stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={c2.x} cy={c2.y} r={5.5 * size} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={c3.x} cy={c3.y} r={4 * size} fill={palette.leafLight} stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function Bush({ cx, cy, dx, dy, size = 1, palette }) {
  const c1 = toIso(cx, cy, dx, dy, 3 * size);
  const c2 = toIso(cx, cy, dx + 0.015, dy, 4 * size);
  const c3 = toIso(cx, cy, dx - 0.015, dy + 0.01, 3 * size);
  return (
    <g>
      <circle cx={c1.x} cy={c1.y} r={4 * size} fill={palette.leafDark} stroke={palette.stroke} strokeWidth={0.3} />
      <circle cx={c2.x} cy={c2.y} r={3 * size} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.3} />
      <circle cx={c3.x} cy={c3.y} r={2.5 * size} fill={palette.leafLight} stroke={palette.stroke} strokeWidth={0.3} />
    </g>
  );
}

function Flower({ cx, cy, dx, dy, color, palette }) {
  const p = toIso(cx, cy, dx, dy, 4);
  const stem = toIso(cx, cy, dx, dy, 0);
  return (
    <g>
      <line x1={stem.x} y1={stem.y} x2={p.x} y2={p.y} stroke={palette.leafDark} strokeWidth={0.7} />
      <circle cx={p.x} cy={p.y} r={1.8} fill={color} stroke={palette.stroke} strokeWidth={0.3} />
    </g>
  );
}

function Bench({ cx, cy, dx, dy, palette }) {
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.08} d={0.03} h={3} palette={palette}
        colorTop="#8b6a3a" colorL="#5a3e1e" colorR="#6e4e26" />
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy - 0.015} w={0.08} d={0.015} h={6} palette={palette}
        colorTop="#8b6a3a" colorL="#5a3e1e" colorR="#6e4e26" />
    </g>
  );
}

function Lamppost({ cx, cy, dx, dy, palette }) {
  const bot = toIso(cx, cy, dx, dy, 0);
  const top = toIso(cx, cy, dx, dy, 14);
  return (
    <g>
      <line x1={bot.x} y1={bot.y} x2={top.x} y2={top.y} stroke={palette.stroke} strokeWidth={1} />
      <circle cx={top.x} cy={top.y - 1.5} r={2.2} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function Car({ cx, cy, dx, dy, color = "#5b9bd4", palette }) {
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.1} d={0.05} h={3} palette={palette}
        colorTop={color} colorL={shade(color, -0.25)} colorR={shade(color, -0.1)} />
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.06} d={0.04} h={6} palette={palette}
        colorTop={shade(color, -0.1)} colorL={shade(color, -0.3)} colorR={shade(color, -0.18)} />
    </g>
  );
}

function Hedge({ cx, cy, dx, dy, length = 0.1, axis = "x", palette }) {
  const w = axis === "x" ? length : 0.03;
  const d = axis === "x" ? 0.03 : length;
  return (
    <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={w} d={d} h={4} palette={palette}
      colorTop={palette.leaf} colorL={palette.leafDark} colorR={shade(palette.leaf, -0.15)} />
  );
}

function Fence({ cx, cy, dx, dy, length = 0.1, axis = "x", palette }) {
  const parts = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const px = axis === "x" ? dx + length * t : dx;
    const py = axis === "x" ? dy : dy + length * t;
    const bot = toIso(cx, cy, px, py, 0);
    const top = toIso(cx, cy, px, py, 5);
    parts.push(<line key={i} x1={bot.x} y1={bot.y} x2={top.x} y2={top.y} stroke="#8a6a3a" strokeWidth={1} />);
  }
  // rail
  const r1a = toIso(cx, cy, axis === "x" ? dx - length / 2 : dx, axis === "x" ? dy : dy - length / 2, 4);
  const r1b = toIso(cx, cy, axis === "x" ? dx + length / 2 : dx, axis === "x" ? dy : dy + length / 2, 4);
  parts.push(<line key="rail" x1={r1a.x} y1={r1a.y} x2={r1b.x} y2={r1b.y} stroke="#8a6a3a" strokeWidth={1.2} />);
  return <g>{parts}</g>;
}

function Bollard({ cx, cy, dx, dy, palette }) {
  return (
    <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.02} d={0.02} h={5} palette={palette}
      colorTop="#c0c5cf" colorL="#7e848f" colorR="#95a0ad" />
  );
}

function Kiosk({ cx, cy, dx, dy, palette, accent }) {
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.08} d={0.08} h={10} palette={palette}
        colorTop={accent} colorL={shade(accent, -0.25)} colorR={shade(accent, -0.12)}
        windows={{ cols: 1, rows: 1 }} />
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.11} d={0.11} h={12} palette={palette}
        colorTop="#6a4a2c" colorL="#3a2a1a" colorR="#4a3422" />
    </g>
  );
}

function Billboard({ cx, cy, dx, dy, h = 22, color = "#111", text = "AD", palette }) {
  // Pole + flat panel facing the viewer (draw as a short wide IsoBox on top of 2 thin posts)
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx - 0.04} dy={dy} w={0.018} d={0.018} h={h} palette={palette}
        colorTop="#555" colorL="#333" colorR="#444" />
      <IsoBox cx={cx} cy={cy} dx={dx + 0.04} dy={dy} w={0.018} d={0.018} h={h} palette={palette}
        colorTop="#555" colorL="#333" colorR="#444" />
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.14} d={0.03} h={h + 8} palette={palette}
        colorTop={color} colorL={shade(color, -0.25)} colorR={shade(color, -0.1)} />
      {text && (() => {
        const face = toIso(cx, cy, dx, dy - 0.015, h + 4);
        return <text x={face.x} y={face.y} textAnchor="middle" fontSize={5} fontWeight={800} fill="#f5c84b">{text}</text>;
      })()}
    </g>
  );
}

function LEDScreen({ cx, cy, dx, dy, h = 16, palette }) {
  // Bright animated screen panel (simulated with gradient colored rect via IsoBox)
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.16} d={0.04} h={h} palette={palette}
        colorTop="#1a1a1a" colorL="#0a0a0a" colorR="#222" />
      {(() => {
        const face = toIso(cx, cy, dx, dy - 0.02, h - 1);
        return (
          <g>
            <rect x={face.x - 18} y={face.y - 6} width={36} height={14} fill="#e14b5a" />
            <rect x={face.x - 14} y={face.y - 4} width={10} height={10} fill="#f5c84b" />
            <rect x={face.x - 2}  y={face.y - 4} width={10} height={10} fill="#4fa85e" />
            <rect x={face.x + 10} y={face.y - 4} width={6}  height={10} fill="#2d7fd4" />
          </g>
        );
      })()}
    </g>
  );
}

function Dome({ cx, cy, dx, dy, r = 0.22, h = 28, color = "#c9cdd3", palette }) {
  // Approximate a dome by stacking flattened ellipses at increasing heights.
  const levels = 6;
  const nodes = [];
  for (let i = 0; i < levels; i++) {
    const t = i / (levels - 1);
    const rx = (r * TILE) * Math.cos(t * Math.PI * 0.5);
    const ry = (r * TILE * 0.45) * Math.cos(t * Math.PI * 0.5);
    const z = h * Math.sin(t * Math.PI * 0.5);
    const c = toIso(cx, cy, dx, dy, z);
    const shadeAmt = -0.22 + t * 0.1;
    nodes.push(
      <ellipse
        key={`dome-${i}`}
        cx={c.x} cy={c.y}
        rx={rx} ry={ry}
        fill={shade(color, shadeAmt)}
        stroke={palette.stroke}
        strokeWidth={0.4}
      />
    );
  }
  return <g>{nodes}</g>;
}

function GoalPost({ cx, cy, dx, dy, palette }) {
  // Simple soccer goal — two posts + crossbar
  const w = 0.1;
  const h = 10;
  const leftBot  = toIso(cx, cy, dx - w / 2, dy, 0);
  const leftTop  = toIso(cx, cy, dx - w / 2, dy, h);
  const rightBot = toIso(cx, cy, dx + w / 2, dy, 0);
  const rightTop = toIso(cx, cy, dx + w / 2, dy, h);
  return (
    <g>
      <line x1={leftBot.x}  y1={leftBot.y}  x2={leftTop.x}  y2={leftTop.y}  stroke="#eee" strokeWidth={1.4} />
      <line x1={rightBot.x} y1={rightBot.y} x2={rightTop.x} y2={rightTop.y} stroke="#eee" strokeWidth={1.4} />
      <line x1={leftTop.x}  y1={leftTop.y}  x2={rightTop.x} y2={rightTop.y} stroke="#eee" strokeWidth={1.4} />
    </g>
  );
}

function Well({ cx, cy, dx, dy, palette }) {
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.08} d={0.08} h={5} palette={palette}
        colorTop="#7a6a55" colorL="#4e3e2c" colorR="#61513f" />
      {/* Roof */}
      <PitchedRoof cx={cx} cy={cy} dx={dx} dy={dy} w={0.1} d={0.1} wallH={5 + 7} roofH={4} palette={palette} roofColor="#6a3f24" />
      <IsoBox cx={cx} cy={cy} dx={dx - 0.04} dy={dy} w={0.01} d={0.01} h={12} palette={palette}
        colorTop="#3a2a1a" colorL="#2a1e12" colorR="#2a1e12" />
      <IsoBox cx={cx} cy={cy} dx={dx + 0.04} dy={dy} w={0.01} d={0.01} h={12} palette={palette}
        colorTop="#3a2a1a" colorL="#2a1e12" colorR="#2a1e12" />
    </g>
  );
}

function Swing({ cx, cy, dx, dy, palette }) {
  // Swing-set: 2 tall posts + crossbar + 2 seats
  const postH = 12;
  const a = toIso(cx, cy, dx - 0.05, dy, 0);
  const b = toIso(cx, cy, dx - 0.05, dy, postH);
  const c = toIso(cx, cy, dx + 0.05, dy, 0);
  const d = toIso(cx, cy, dx + 0.05, dy, postH);
  const seat1Top = toIso(cx, cy, dx - 0.02, dy, postH);
  const seat1Bot = toIso(cx, cy, dx - 0.02, dy, 3);
  const seat2Top = toIso(cx, cy, dx + 0.02, dy, postH);
  const seat2Bot = toIso(cx, cy, dx + 0.02, dy, 3);
  return (
    <g>
      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8b6a3a" strokeWidth={1.2} />
      <line x1={c.x} y1={c.y} x2={d.x} y2={d.y} stroke="#8b6a3a" strokeWidth={1.2} />
      <line x1={b.x} y1={b.y} x2={d.x} y2={d.y} stroke="#8b6a3a" strokeWidth={1.2} />
      <line x1={seat1Top.x} y1={seat1Top.y} x2={seat1Bot.x} y2={seat1Bot.y} stroke="#2a2f3a" strokeWidth={0.8} />
      <line x1={seat2Top.x} y1={seat2Top.y} x2={seat2Bot.x} y2={seat2Bot.y} stroke="#2a2f3a" strokeWidth={0.8} />
      <rect x={seat1Bot.x - 3} y={seat1Bot.y - 1} width={6} height={2} fill="#e14b5a" />
      <rect x={seat2Bot.x - 3} y={seat2Bot.y - 1} width={6} height={2} fill="#2d7fd4" />
    </g>
  );
}

function Slide({ cx, cy, dx, dy, palette }) {
  const topP = toIso(cx, cy, dx, dy, 10);
  const botP = toIso(cx, cy, dx + 0.08, dy, 0);
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.04} d={0.04} h={10} palette={palette}
        colorTop="#e14b5a" colorL="#a03543" colorR="#b53d4f" />
      <line x1={topP.x} y1={topP.y} x2={botP.x} y2={botP.y} stroke="#f5c84b" strokeWidth={3} strokeLinecap="round" />
    </g>
  );
}

function Bridge({ cx, cy, dx, dy, length = 0.2, palette }) {
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={length} d={0.03} h={3} palette={palette}
        colorTop="#b58a5a" colorL="#7e5e3a" colorR="#95714b" />
      {[-0.45, -0.15, 0.15, 0.45].map((t, i) => (
        <IsoBox key={`br-r-${i}`} cx={cx} cy={cy} dx={dx + t * length} dy={dy} w={0.012} d={0.012} h={8} palette={palette}
          colorTop="#8a6a3a" colorL="#5a3e1e" colorR="#6e4e26" />
      ))}
    </g>
  );
}

function Greenhouse({ cx, cy, dx, dy, palette }) {
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.18} d={0.14} h={8} palette={palette}
        colorTop="#c6e4df" colorL="#8fb8b2" colorR="#a3cbc6" windows={{ cols: 3, rows: 1, lit: "#a3cbc6", unlit: "#8fb8b2" }} />
      <PitchedRoof cx={cx} cy={cy} dx={dx} dy={dy} w={0.2} d={0.16} wallH={8} roofH={8} palette={palette} roofColor="#9dc8c2" />
    </g>
  );
}

function MonorailArch({ cx, cy, dx, dy, palette }) {
  // Two iso boxes as supports + a horizontal beam
  const h = 16;
  return (
    <g>
      <IsoBox cx={cx} cy={cy} dx={dx - 0.08} dy={dy} w={0.03} d={0.03} h={h} palette={palette}
        colorTop="#6a7280" colorL="#3a414b" colorR="#4a525c" />
      <IsoBox cx={cx} cy={cy} dx={dx + 0.08} dy={dy} w={0.03} d={0.03} h={h} palette={palette}
        colorTop="#6a7280" colorL="#3a414b" colorR="#4a525c" />
      <IsoBox cx={cx} cy={cy} dx={dx} dy={dy} w={0.22} d={0.03} h={h + 3} palette={palette}
        colorTop="#aab6c4" colorL="#6a7a8c" colorR="#7e8b9d" />
    </g>
  );
}


// ---------- District pedestrians (random walk, level-scaled) ----------

const PEOPLE_COUNTS = [1, 2, 4, 6, 8, 10];
const PEOPLE_COLORS = ["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a", "#5ba0e0", "#0e4080", "#d0829d", "#47a5b0"];

function seedRand(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Walkable zones per district — rectangles in plot-local (dx, dy) that avoid
// the main building footprints.
function walkableZones(id) {
  switch (id) {
    case "sport":
      return [
        { dx1: -0.45, dx2:  0.45, dy1:  0.32, dy2:  0.46 },
        { dx1: -0.46, dx2: -0.16, dy1: -0.42, dy2:  0.32 },
        { dx1:  0.16, dx2:  0.46, dy1: -0.42, dy2:  0.32 },
        { dx1: -0.45, dx2:  0.45, dy1: -0.46, dy2: -0.38 }
      ];
    case "business":
      return [
        { dx1: -0.46, dx2:  0.46, dy1:  0.34, dy2:  0.46 },
        { dx1: -0.46, dx2:  0.46, dy1: -0.46, dy2: -0.34 }
      ];
    case "park":
      return [{ dx1: -0.45, dx2: 0.45, dy1: -0.45, dy2: 0.45 }];
    case "square":
      return [
        { dx1: -0.35, dx2: 0.35, dy1: -0.12, dy2: 0.42 },
        { dx1: -0.45, dx2: 0.45, dy1:  0.38, dy2: 0.46 }
      ];
    case "residential":
      return [
        { dx1: -0.46, dx2: 0.46, dy1:  0.34, dy2:  0.46 },
        { dx1: -0.46, dx2: 0.46, dy1: -0.04, dy2:  0.04 },
        { dx1: -0.46, dx2: 0.46, dy1: -0.46, dy2: -0.36 }
      ];
    default:
      return [{ dx1: -0.4, dx2: 0.4, dy1: -0.4, dy2: 0.4 }];
  }
}

function generatePeople(id, level, cx, cy, palette) {
  const lvl = Math.max(0, Math.min(5, level));
  const count = PEOPLE_COUNTS[lvl];
  const zones = walkableZones(id);
  const out = [];
  for (let i = 0; i < count; i++) {
    const rng = seedRand((id.charCodeAt(0) * 101 + i * 7919 + lvl * 13) | 0);
    const zone = zones[i % zones.length];
    const waypoints = 4 + Math.floor(rng() * 2);
    const pts = [];
    for (let w = 0; w < waypoints; w++) {
      const dx = zone.dx1 + rng() * (zone.dx2 - zone.dx1);
      const dy = zone.dy1 + rng() * (zone.dy2 - zone.dy1);
      pts.push(toIso(cx, cy, dx, dy, 0));
    }
    pts.push({ ...pts[0] });
    const dur = 14 + rng() * 22;
    const delay = -rng() * dur;
    const color = PEOPLE_COLORS[(i * 3 + id.charCodeAt(0)) % PEOPLE_COLORS.length];
    const values = pts.map((p) => `${p.x} ${p.y}`).join(";");
    out.push(
      <g key={`ppl-${id}-${lvl}-${i}`}>
        <rect x={-1.8} y={-5.5} width={3.6} height={6.5} fill={color} stroke={palette.stroke} strokeWidth={0.25} />
        <circle cx={0} cy={-7.5} r={2.1} fill="#f4d3a9" stroke={palette.stroke} strokeWidth={0.25} />
        <line x1={-1.2} y1={1} x2={-1.2} y2={4} stroke={palette.stroke} strokeWidth={0.8} />
        <line x1={1.2}  y1={1} x2={1.2}  y2={4} stroke={palette.stroke} strokeWidth={0.8} />
        <animateTransform
          attributeName="transform"
          type="translate"
          values={values}
          dur={`${dur.toFixed(2)}s`}
          begin={`${delay.toFixed(2)}s`}
          repeatCount="indefinite"
          calcMode="linear"
        />
      </g>
    );
  }
  return out;
}

// ---------- District decor (0 → 5) ----------
// Each stage picks up additions from previous stages cumulatively, with
// meaningful visual changes at every level. All (dx, dy) stay in [-0.5, 0.5].

function renderDistrictDecor(id, level, cx, cy, palette, accent) {
  const lvl = Math.max(0, Math.min(5, level));
  const n = [];
  const add = (node) => n.push(node);

  if (id === "sport") {
    // ---- ground & base ----
    const gc = toIso(cx, cy, 0, 0, 1);
    if (lvl === 0) {
      // Dirt field outline + fence + goal posts
      add(<ellipse key="dirt" cx={gc.x} cy={gc.y} rx={TILE * 0.34} ry={TILE * 0.15} fill={shade("#a98b62", 0.05)} stroke={palette.stroke} />);
      add(<GoalPost key="gp1" cx={cx} cy={cy} dx={-0.28} dy={0} palette={palette} />);
      add(<GoalPost key="gp2" cx={cx} cy={cy} dx={ 0.28} dy={0} palette={palette} />);
      // Small ball
      const ball = toIso(cx, cy, 0.05, 0.08, 2);
      add(<circle key="ball" cx={ball.x} cy={ball.y} r={3} fill="#fff" stroke={palette.stroke} strokeWidth={0.6} />);
      // Perimeter fence
      [-0.42, -0.21, 0, 0.21, 0.42].forEach((t, i) => {
        add(<Fence key={`fn-${i}`} cx={cx} cy={cy} dx={t} dy={-0.45} length={0.18} axis="x" palette={palette} />);
      });
    } else {
      // Pitch + concentric markings
      add(<ellipse key="p1" cx={gc.x} cy={gc.y} rx={TILE * 0.42} ry={TILE * 0.2} fill={palette.field} stroke={palette.stroke} />);
      add(<ellipse key="p2" cx={gc.x} cy={gc.y} rx={TILE * 0.36} ry={TILE * 0.17} fill={palette.fieldInner} stroke="#fff" strokeWidth={0.6} />);
      add(<ellipse key="cc" cx={gc.x} cy={gc.y} rx={TILE * 0.07} ry={TILE * 0.035} fill="none" stroke="#fff" strokeWidth={0.8} />);
      const l = toIso(cx, cy, -0.22, 0, 1);
      const r = toIso(cx, cy,  0.22, 0, 1);
      add(<line key="ml" x1={l.x} y1={l.y} x2={r.x} y2={r.y} stroke="#fff" strokeWidth={0.8} />);
      add(<GoalPost key="gp1" cx={cx} cy={cy} dx={-0.33} dy={0} palette={palette} />);
      add(<GoalPost key="gp2" cx={cx} cy={cy} dx={ 0.33} dy={0} palette={palette} />);
    }

    // ---- level 1: grass pitch, small wooden stand, corner flag ----
    if (lvl >= 1) {
      add(<IsoBox key="stand1" cx={cx} cy={cy} dx={0} dy={-0.35} w={0.22} d={0.06} h={6} palette={palette}
        colorTop="#9c7040" colorL="#6a4b2a" colorR="#835937" />);
      // corner flags
      [[-0.36, -0.22], [0.36, -0.22], [-0.36, 0.22], [0.36, 0.22]].forEach(([dx, dy], i) => {
        const bot = toIso(cx, cy, dx, dy, 0);
        const top = toIso(cx, cy, dx, dy, 8);
        add(<line key={`cf-l-${i}`} x1={bot.x} y1={bot.y} x2={top.x} y2={top.y} stroke={palette.stroke} strokeWidth={0.8} />);
        add(<polygon key={`cf-${i}`} points={`${top.x},${top.y} ${top.x + 6},${top.y + 2} ${top.x},${top.y + 5}`} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.4} />);
      });
      // Small changing booth
      add(<IsoBox key="booth" cx={cx} cy={cy} dx={-0.4} dy={0.38} w={0.08} d={0.08} h={7} palette={palette}
        colorTop="#8a4b2b" colorL="#5a321c" colorR="#6a3b24" door />);
    }

    // ---- level 2: running track, stands on two sides, scoreboard, gates ----
    if (lvl >= 2) {
      // Running track (darker ring around pitch)
      add(<ellipse key="tr" cx={gc.x} cy={gc.y} rx={TILE * 0.46} ry={TILE * 0.22} fill="none" stroke="#c2a878" strokeWidth={4} />);
      // Larger stands (east + west)
      add(<IsoBox key="stE" cx={cx} cy={cy} dx={ 0.36} dy={0} w={0.08} d={0.3} h={10 + lvl * 2} palette={palette}
        colorTop={accent} colorL={shade(accent, -0.3)} colorR={shade(accent, -0.12)} windows={{ cols: 1, rows: 3 }} />);
      add(<IsoBox key="stW" cx={cx} cy={cy} dx={-0.36} dy={0} w={0.08} d={0.3} h={10 + lvl * 2} palette={palette}
        colorTop={accent} colorL={shade(accent, -0.3)} colorR={shade(accent, -0.12)} windows={{ cols: 1, rows: 3 }} />);
      // Scoreboard on north edge
      add(<IsoBox key="sb" cx={cx} cy={cy} dx={0} dy={-0.4} w={0.18} d={0.03} h={18} palette={palette}
        colorTop="#111" colorL="#0a0a0a" colorR="#1a1a1a" />);
      const sbF = toIso(cx, cy, 0, -0.4, 15);
      add(<text key="sbt" x={sbF.x} y={sbF.y} textAnchor="middle" fontSize={6} fontWeight={800} fill="#f5c84b">3 : 2</text>);
      // Turnstile gates south
      [-0.18, -0.06, 0.06, 0.18].forEach((t, i) => add(<Bollard key={`tg-${i}`} cx={cx} cy={cy} dx={t} dy={0.42} palette={palette} />));
    }

    // ---- level 3: full enclosed stands, light masts, ticket booth, basketball court ----
    if (lvl >= 3) {
      // North + south stands
      add(<IsoBox key="stN" cx={cx} cy={cy} dx={0} dy={-0.3} w={0.32} d={0.08} h={12 + lvl * 2} palette={palette}
        colorTop={shade(accent, 0.1)} colorL={shade(accent, -0.28)} colorR={shade(accent, -0.1)} windows={{ cols: 4, rows: 2 }} />);
      add(<IsoBox key="stS" cx={cx} cy={cy} dx={0} dy={ 0.3} w={0.32} d={0.08} h={12 + lvl * 2} palette={palette}
        colorTop={shade(accent, 0.1)} colorL={shade(accent, -0.28)} colorR={shade(accent, -0.1)} windows={{ cols: 4, rows: 2 }} />);
      // Light masts at corners
      [[-0.4, -0.35], [0.4, -0.35], [-0.4, 0.35], [0.4, 0.35]].forEach(([dx, dy], i) => {
        const bot = toIso(cx, cy, dx, dy, 0);
        const top = toIso(cx, cy, dx, dy, 26);
        add(<line key={`lm-${i}`} x1={bot.x} y1={bot.y} x2={top.x} y2={top.y} stroke={palette.stroke} strokeWidth={1} />);
        add(<rect key={`lm-h-${i}`} x={top.x - 5} y={top.y - 4} width={10} height={3} fill="#f5f3c8" stroke={palette.stroke} strokeWidth={0.4} />);
      });
      // Ticket booth
      add(<Kiosk key="tb" cx={cx} cy={cy} dx={-0.42} dy={0.42} palette={palette} accent={accent} />);
      // Side basketball court
      const bc = toIso(cx, cy, 0.4, -0.38, 1);
      add(<rect key="bc" x={bc.x - 12} y={bc.y - 6} width={24} height={12} fill="#b46a3b" stroke="#fff" strokeWidth={0.5} />);
    }

    // ---- level 4: multi-purpose complex ----
    if (lvl >= 4) {
      // Tennis court
      const tc = toIso(cx, cy, -0.4, -0.38, 1);
      add(<rect key="tc" x={tc.x - 14} y={tc.y - 5} width={28} height={10} fill="#3f7a3f" stroke="#fff" strokeWidth={0.5} />);
      add(<line key="tc-m" x1={tc.x} y1={tc.y - 5} x2={tc.x} y2={tc.y + 5} stroke="#fff" strokeWidth={0.6} />);
      // Pool
      const pc = toIso(cx, cy, 0.42, 0.38, 1);
      add(<rect key="pc" x={pc.x - 10} y={pc.y - 4} width={20} height={8} fill={palette.water} stroke={palette.stroke} strokeWidth={0.5} />);
      add(<rect key="pc-ln" x={pc.x - 9} y={pc.y - 1} width={18} height={0.8} fill="#fff" opacity={0.6} />);
      // Parking row
      [-0.35, -0.22, -0.09, 0.04, 0.17].forEach((t, i) => add(<Car key={`pk-${i}`} cx={cx} cy={cy} dx={t} dy={0.45} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0"][i]} palette={palette} />));
    }

    // ---- level 5: mega domed arena, monorail, huge screens ----
    if (lvl >= 5) {
      add(<Dome key="dm" cx={cx} cy={cy} dx={0} dy={0} r={0.46} h={36} color="#c9d0da" palette={palette} />);
      // Monorail arches around perimeter
      [[-0.3, -0.45], [0.3, -0.45], [-0.3, 0.45], [0.3, 0.45]].forEach(([dx, dy], i) => add(<MonorailArch key={`mr-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} palette={palette} />));
      // Big LED screen
      add(<LEDScreen key="led" cx={cx} cy={cy} dx={0} dy={-0.44} h={18} palette={palette} />);
      // Team shop
      add(<IsoBox key="ts" cx={cx} cy={cy} dx={0.42} dy={-0.38} w={0.1} d={0.08} h={12} palette={palette}
        colorTop={accent} colorL={shade(accent, -0.3)} colorR={shade(accent, -0.12)} windows={{ cols: 2, rows: 2 }} door />);
    }
  }

  if (id === "business") {
    // ---- level 0: empty lot + kiosk + lamppost ----
    if (lvl === 0) {
      add(<Kiosk key="kk" cx={cx} cy={cy} dx={0} dy={0} palette={palette} accent={accent} />);
      add(<Lamppost key="lp" cx={cx} cy={cy} dx={-0.3} dy={0.1} palette={palette} />);
      // some gravel dots
      for (let i = 0; i < 8; i++) {
        const p = toIso(cx, cy, -0.3 + (i / 7) * 0.6, 0.35, 1);
        add(<circle key={`gv-${i}`} cx={p.x} cy={p.y} r={1.2} fill="#b5a890" />);
      }
    }

    // ---- level 1: small shops + cafe + signage ----
    if (lvl >= 1) {
      const shops = [
        { dx: -0.35, dy: -0.2, color: "#d0829d" },
        { dx: -0.05, dy: -0.2, color: "#7cb0d0" },
        { dx:  0.25, dy: -0.2, color: "#d0a07c" }
      ];
      const shopCount = Math.min(3, 1 + Math.floor(lvl / 2));
      for (let i = 0; i < shopCount; i++) {
        const S = shops[i];
        add(<IsoBox key={`sh-${i}`} cx={cx} cy={cy} dx={S.dx} dy={S.dy} w={0.22} d={0.22} h={12} palette={palette}
          colorTop={S.color} colorL={shade(S.color, -0.28)} colorR={shade(S.color, -0.12)}
          windows={{ cols: 3, rows: 1 }} door />);
        add(<PitchedRoof key={`shr-${i}`} cx={cx} cy={cy} dx={S.dx} dy={S.dy} w={0.24} d={0.24} wallH={12} roofH={6} palette={palette} roofColor="#8a4b2b" />);
      }
      // Cafe awning
      add(<IsoBox key="caf" cx={cx} cy={cy} dx={0.38} dy={-0.15} w={0.1} d={0.1} h={10} palette={palette}
        colorTop="#f39c7a" colorL="#b06750" colorR="#c97860" windows={{ cols: 2, rows: 1 }} door />);
      // Sidewalk dots
      [-0.35, -0.2, -0.05, 0.1, 0.25, 0.4].forEach((t, i) => add(<Bollard key={`sb-${i}`} cx={cx} cy={cy} dx={t} dy={0.28} palette={palette} />));
    }

    // ---- level 2: mid-rise office + gallery + signs + ATM ----
    if (lvl >= 2) {
      add(<IsoBox key="mr" cx={cx} cy={cy} dx={0} dy={0.05} w={0.28} d={0.18} h={32} palette={palette}
        colorTop="#2d7fd4" colorL={shade("#2d7fd4", -0.3)} colorR={shade("#2d7fd4", -0.12)}
        windows={{ cols: 4, rows: 5 }} door />);
      // Shop sign
      const sf = toIso(cx, cy, 0, 0.15, 14);
      add(<rect key="mrs" x={sf.x - 12} y={sf.y - 3} width={24} height={5} fill="#111" stroke={palette.stroke} strokeWidth={0.3} />);
      add(<text key="mrst" x={sf.x} y={sf.y + 1} textAnchor="middle" fontSize={4} fontWeight={800} fill="#f5c84b">OFFICE</text>);
    }

    // ---- level 3: 3-4 towers 10-15 floors, canopy entrances, flags ----
    if (lvl >= 3) {
      const towers3 = [
        { dx: -0.32, dy: -0.32, h: 44, hue: "#1e5ea8" },
        { dx:  0.32, dy: -0.32, h: 52, hue: "#3a7fd5" },
        { dx: -0.32, dy:  0.3,  h: 36, hue: "#5ba0e0" },
        { dx:  0.32, dy:  0.3,  h: 40, hue: "#2d7fd4" }
      ];
      towers3.forEach((T, i) => add(
        <IsoBox key={`tw3-${i}`} cx={cx} cy={cy} dx={T.dx} dy={T.dy} w={0.18} d={0.18} h={T.h} palette={palette}
          colorTop={T.hue} colorL={shade(T.hue, -0.3)} colorR={shade(T.hue, -0.12)}
          windows={{ cols: 3, rows: Math.round(T.h / 8) }} door />
      ));
      // Flags around central plaza
      [-0.12, 0, 0.12].forEach((dx, i) => {
        const bot = toIso(cx, cy, dx, 0.4, 0);
        const top = toIso(cx, cy, dx, 0.4, 14);
        add(<line key={`fl-${i}`} x1={bot.x} y1={bot.y} x2={top.x} y2={top.y} stroke={palette.stroke} strokeWidth={0.8} />);
        add(<rect key={`fl-f-${i}`} x={top.x} y={top.y} width={10} height={6} fill={accent} stroke={palette.stroke} strokeWidth={0.3} />);
      });
    }

    // ---- level 4: glass skyscrapers + helipad + fountain + pedestrian overpass ----
    if (lvl >= 4) {
      const skys = [
        { dx:  0,    dy: -0.35, h: 68, hue: "#2d7fd4" },
        { dx: -0.3,  dy:  0.05, h: 76, hue: "#1e5ea8" },
        { dx:  0.3,  dy:  0.05, h: 62, hue: "#3a7fd5" }
      ];
      skys.forEach((T, i) => add(
        <IsoBox key={`sk-${i}`} cx={cx} cy={cy} dx={T.dx} dy={T.dy} w={0.2} d={0.2} h={T.h} palette={palette}
          colorTop={T.hue} colorL={shade(T.hue, -0.3)} colorR={shade(T.hue, -0.12)}
          windows={{ cols: 4, rows: Math.round(T.h / 8) }} />
      ));
      // Helipad circle on -0.3 tower
      const hpad = toIso(cx, cy, -0.3, 0.05, 76);
      add(<circle key="hp" cx={hpad.x} cy={hpad.y} r={10} fill="#e14b5a" stroke="#fff" strokeWidth={0.6} />);
      add(<text key="hpt" x={hpad.x} y={hpad.y + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#fff">H</text>);
      // Fountain in south plaza
      add(<IsoBox key="fn" cx={cx} cy={cy} dx={0} dy={0.4} w={0.14} d={0.14} h={4} palette={palette}
        colorTop={palette.water} colorL={shade("#2a6b9c", -0.2)} colorR={shade("#2a6b9c", -0.05)} />);
      // Parked cars
      [-0.35, -0.2, 0.2, 0.35].forEach((t, i) => add(<Car key={`bc4-${i}`} cx={cx} cy={cy} dx={t} dy={0.45} color={["#e14b5a", "#f5c84b", "#4fa85e", "#b57cd0"][i]} palette={palette} />));
    }

    // ---- level 5: Manhattan-style mega cluster + LED billboards + spires ----
    if (lvl >= 5) {
      const mega = [
        { dx:  0,    dy: -0.4,  h: 110, hue: "#0e4080" },
        { dx: -0.3,  dy: -0.1,  h: 92,  hue: "#1e5ea8" },
        { dx:  0.3,  dy: -0.1,  h: 100, hue: "#2d7fd4" },
        { dx: -0.15, dy:  0.25, h: 84,  hue: "#3a7fd5" },
        { dx:  0.15, dy:  0.25, h: 78,  hue: "#5ba0e0" }
      ];
      mega.forEach((T, i) => {
        add(
          <IsoBox key={`mg-${i}`} cx={cx} cy={cy} dx={T.dx} dy={T.dy} w={0.2} d={0.2} h={T.h} palette={palette}
            colorTop={T.hue} colorL={shade(T.hue, -0.3)} colorR={shade(T.hue, -0.1)}
            windows={{ cols: 4, rows: Math.round(T.h / 7) }} />
        );
        // Spire on top
        const topP = toIso(cx, cy, T.dx, T.dy, T.h);
        const tipP = toIso(cx, cy, T.dx, T.dy, T.h + 14);
        add(<line key={`sp-${i}`} x1={topP.x} y1={topP.y} x2={tipP.x} y2={tipP.y} stroke={palette.stroke} strokeWidth={1} />);
        add(<circle key={`sp-d-${i}`} cx={tipP.x} cy={tipP.y} r={1.4} fill={accent} />);
      });
      // LED billboards
      add(<LEDScreen key="led1" cx={cx} cy={cy} dx={0.42} dy={0.3} h={20} palette={palette} />);
      add(<LEDScreen key="led2" cx={cx} cy={cy} dx={-0.42} dy={0.3} h={18} palette={palette} />);
      // Taxi cars
      [-0.3, -0.1, 0.1, 0.3].forEach((t, i) => add(<Car key={`tx-${i}`} cx={cx} cy={cy} dx={t} dy={0.45} color="#f5c84b" palette={palette} />));
    }
  }

  if (id === "park") {
    // ---- level 0: wild grass + 2 trees + rock ----
    const rockC = toIso(cx, cy, 0.12, 0.12, 2);
    add(<ellipse key="rk" cx={rockC.x} cy={rockC.y} rx={8} ry={4} fill="#89847c" stroke={palette.stroke} strokeWidth={0.4} />);
    add(<IsoTree key="pt0-1" cx={cx} cy={cy} dx={-0.25} dy={-0.15} size={0.7} palette={palette} />);
    add(<IsoTree key="pt0-2" cx={cx} cy={cy} dx={ 0.22} dy={-0.3}  size={0.8} palette={palette} />);
    add(<IsoTree key="pt0-3" cx={cx} cy={cy} dx={-0.35} dy={ 0.25} size={0.6} palette={palette} />);

    // ---- level 1: dirt paths + bench + flowers + trash can ----
    if (lvl >= 1) {
      const p1a = toIso(cx, cy, -0.42, 0.05, 1);
      const p1b = toIso(cx, cy,  0.42, 0.05, 1);
      add(<line key="pp1" x1={p1a.x} y1={p1a.y} x2={p1b.x} y2={p1b.y} stroke="#a48458" strokeWidth={4} strokeLinecap="round" />);
      add(<Bench key="pbh1" cx={cx} cy={cy} dx={-0.1} dy={-0.02} palette={palette} />);
      // Flowers
      ["#e14b5a", "#f5c84b", "#b57cd0", "#4fa85e"].forEach((cl, i) =>
        add(<Flower key={`fl-${i}`} cx={cx} cy={cy} dx={-0.35 + i * 0.05} dy={0.15} color={cl} palette={palette} />)
      );
      // Trash can
      add(<IsoBox key="tc" cx={cx} cy={cy} dx={-0.08} dy={-0.18} w={0.025} d={0.025} h={5} palette={palette}
        colorTop="#2d3a4f" colorL="#1a2333" colorR="#242d40" />);
      // More trees
      add(<IsoTree key="pt1-4" cx={cx} cy={cy} dx={0.3} dy={0.2} size={0.75} palette={palette} />);
      add(<IsoTree key="pt1-5" cx={cx} cy={cy} dx={-0.08} dy={0.38} size={0.7} palette={palette} />);
    }

    // ---- level 2: paved cross paths + pond + gazebo + lamps ----
    if (lvl >= 2) {
      const pNa = toIso(cx, cy, 0, -0.42, 1);
      const pNb = toIso(cx, cy, 0,  0.42, 1);
      add(<line key="pcN" x1={pNa.x} y1={pNa.y} x2={pNb.x} y2={pNb.y} stroke={palette.paving} strokeWidth={5} strokeLinecap="round" />);
      // Pond
      const pc = toIso(cx, cy, 0.22, -0.18, 1);
      add(<ellipse key="pd" cx={pc.x} cy={pc.y} rx={TILE * 0.13} ry={TILE * 0.06} fill={palette.water} stroke={palette.stroke} />);
      add(<ellipse key="pdh" cx={pc.x - 4} cy={pc.y - 1} rx={TILE * 0.04} ry={TILE * 0.015} fill={palette.waterHi} opacity={0.6} />);
      // Ducks
      add(<ellipse key="duck1" cx={pc.x + 4} cy={pc.y + 1} rx={2} ry={1.2} fill="#fff" stroke={palette.stroke} strokeWidth={0.3} />);
      add(<ellipse key="duck2" cx={pc.x - 6} cy={pc.y + 3} rx={2} ry={1.2} fill="#fff" stroke={palette.stroke} strokeWidth={0.3} />);
      // Gazebo
      add(<IsoBox key="gz" cx={cx} cy={cy} dx={-0.3} dy={0.25} w={0.14} d={0.14} h={10} palette={palette}
        colorTop="#c9a56b" colorL="#8a6e42" colorR="#a48658" />);
      add(<PitchedRoof key="gzr" cx={cx} cy={cy} dx={-0.3} dy={0.25} w={0.16} d={0.16} wallH={10} roofH={8} palette={palette} roofColor="#8a4b2b" />);
      // Lamps
      add(<Lamppost key="pl1" cx={cx} cy={cy} dx={-0.2} dy={0.05} palette={palette} />);
      add(<Lamppost key="pl2" cx={cx} cy={cy} dx={0.2} dy={0.05} palette={palette} />);
      add(<Bench key="pbh2" cx={cx} cy={cy} dx={0.14} dy={-0.05} palette={palette} />);
    }

    // ---- level 3: fountain, playground (swing+slide), pavilion, flower beds ----
    if (lvl >= 3) {
      // Central fountain
      add(<IsoBox key="fn-b" cx={cx} cy={cy} dx={0} dy={0} w={0.18} d={0.18} h={3} palette={palette}
        colorTop={palette.water} colorL={shade("#2a6b9c", -0.25)} colorR={shade("#2a6b9c", -0.05)} />);
      add(<IsoBox key="fn-p" cx={cx} cy={cy} dx={0} dy={0} w={0.04} d={0.04} h={10} palette={palette}
        colorTop="#f5c84b" colorL={shade("#f5c84b", -0.2)} colorR={shade("#f5c84b", -0.05)} />);
      // Playground
      add(<Swing key="sw" cx={cx} cy={cy} dx={-0.35} dy={-0.3} palette={palette} />);
      add(<Slide key="sl" cx={cx} cy={cy} dx={0.3} dy={-0.3} palette={palette} />);
      // Flower beds rectangles
      [[-0.38, -0.05], [0.38, -0.05]].forEach(([dx, dy], i) => {
        const c = toIso(cx, cy, dx, dy, 1);
        add(<ellipse key={`fb-${i}`} cx={c.x} cy={c.y} rx={14} ry={6} fill="#a04f6e" stroke={palette.stroke} strokeWidth={0.4} />);
        [0.02, 0.06, 0.1].forEach((off, k) => add(<Flower key={`fb-f-${i}-${k}`} cx={cx} cy={cy} dx={dx + off - 0.06} dy={dy} color={["#e14b5a", "#f5c84b", "#b57cd0"][k]} palette={palette} />));
      });
      // Bicycle rack = 3 small bollards
      [-0.09, -0.04, 0.01].forEach((t, i) => add(<Bollard key={`br-${i}`} cx={cx} cy={cy} dx={t} dy={0.28} palette={palette} />));
      // More trees
      [[-0.42, 0.4], [0.42, 0.4], [-0.42, -0.4], [0.42, -0.4]].forEach(([dx, dy], i) =>
        add(<IsoTree key={`pt3-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} size={0.7} palette={palette} />)
      );
    }

    // ---- level 4: botanical sections, greenhouse, sculpture, bridge over pond ----
    if (lvl >= 4) {
      add(<Greenhouse key="gh" cx={cx} cy={cy} dx={-0.32} dy={0.35} palette={palette} />);
      // Pond gets bigger with bridge
      const pc2 = toIso(cx, cy, 0.22, -0.18, 1);
      add(<ellipse key="pd2" cx={pc2.x} cy={pc2.y} rx={TILE * 0.18} ry={TILE * 0.08} fill={palette.water} stroke={palette.stroke} />);
      add(<Bridge key="br" cx={cx} cy={cy} dx={0.22} dy={-0.18} length={0.3} palette={palette} />);
      // Abstract sculpture
      add(<IsoBox key="sc1" cx={cx} cy={cy} dx={0.32} dy={0.32} w={0.06} d={0.06} h={14} palette={palette}
        colorTop="#d9a441" colorL={shade("#d9a441", -0.3)} colorR={shade("#d9a441", -0.1)} />);
      const scTop = toIso(cx, cy, 0.32, 0.32, 14);
      add(<circle key="sc1-top" cx={scTop.x} cy={scTop.y} r={6} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.5} />);
      // Butterfly-area flowers (denser)
      for (let i = 0; i < 8; i++) {
        const dx = -0.15 + (i % 4) * 0.1;
        const dy = -0.05 + ((i / 4 | 0) * 0.06);
        add(<Flower key={`pbf-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} color={["#e14b5a", "#f5c84b", "#b57cd0", "#f39c7a"][i % 4]} palette={palette} />);
      }
    }

    // ---- level 5: Central-Park: big lake + boats + carousel + bandshell + ice rink ----
    if (lvl >= 5) {
      // Lake
      const lc = toIso(cx, cy, 0.25, -0.12, 1);
      add(<ellipse key="lk" cx={lc.x} cy={lc.y} rx={TILE * 0.22} ry={TILE * 0.1} fill={palette.water} stroke={palette.stroke} />);
      // Boats
      [[-0.02, 0.01], [0.04, -0.03]].forEach(([dx, dy], i) => {
        const bt = toIso(cx, cy, 0.25 + dx, -0.12 + dy, 2);
        add(<ellipse key={`bt-${i}`} cx={bt.x} cy={bt.y} rx={5} ry={1.8} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.4} />);
        add(<line key={`bt-s-${i}`} x1={bt.x} y1={bt.y} x2={bt.x + 1} y2={bt.y - 6} stroke={palette.stroke} strokeWidth={0.5} />);
      });
      // Bandshell (half dome)
      add(<Dome key="bs" cx={cx} cy={cy} dx={-0.32} dy={-0.12} r={0.18} h={12} color={accent} palette={palette} />);
      // Carousel (cylinder)
      add(<IsoBox key="cr-b" cx={cx} cy={cy} dx={-0.3} dy={0.3} w={0.12} d={0.12} h={3} palette={palette}
        colorTop="#e14b5a" colorL="#a03543" colorR="#b53d4f" />);
      const crT = toIso(cx, cy, -0.3, 0.3, 3);
      add(<polygon key="cr-r" points={`${crT.x - 10},${crT.y} ${crT.x + 10},${crT.y} ${crT.x},${crT.y - 8}`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.5} />);
      // Ice rink
      const ir = toIso(cx, cy, 0.32, 0.3, 1);
      add(<ellipse key="ir" cx={ir.x} cy={ir.y} rx={14} ry={6} fill="#d6ecf6" stroke={palette.stroke} strokeWidth={0.5} />);
    }
  }

  if (id === "square") {
    // ---- level 0: dirt clearing + well + signpost ----
    if (lvl === 0) {
      const c0 = toIso(cx, cy, 0, 0, 1);
      add(<ellipse key="dz" cx={c0.x} cy={c0.y} rx={TILE * 0.3} ry={TILE * 0.14} fill={shade("#a98b62", -0.05)} stroke={palette.stroke} />);
      add(<Well key="wl" cx={cx} cy={cy} dx={-0.1} dy={0} palette={palette} />);
      // Signpost
      const sb = toIso(cx, cy, 0.1, 0, 0);
      const st = toIso(cx, cy, 0.1, 0, 14);
      add(<line key="sp-p" x1={sb.x} y1={sb.y} x2={st.x} y2={st.y} stroke="#6a4a2c" strokeWidth={1.2} />);
      add(<rect key="sp-s" x={st.x - 8} y={st.y} width={16} height={5} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.4} />);
      // Cart
      add(<IsoBox key="ct" cx={cx} cy={cy} dx={0.28} dy={0.15} w={0.1} d={0.05} h={5} palette={palette}
        colorTop="#8a4b2b" colorL="#5a321c" colorR="#6a3b24" />);
    }

    // ---- level 1: cobbled plaza + small fountain + bench + lamp ----
    if (lvl >= 1) {
      const c1 = toIso(cx, cy, 0, 0, 1);
      add(<ellipse key="pv1" cx={c1.x} cy={c1.y} rx={TILE * 0.35} ry={TILE * 0.16} fill={palette.paving} stroke={palette.stroke} />);
      // fountain
      add(<IsoBox key="fn1" cx={cx} cy={cy} dx={0} dy={0} w={0.12} d={0.12} h={3} palette={palette}
        colorTop={palette.water} colorL={shade("#2a6b9c", -0.25)} colorR={shade("#2a6b9c", -0.08)} />);
      add(<Bench key="sbh1" cx={cx} cy={cy} dx={-0.25} dy={0.2} palette={palette} />);
      add(<Lamppost key="sll1" cx={cx} cy={cy} dx={-0.35} dy={-0.08} palette={palette} />);
      add(<Lamppost key="sll2" cx={cx} cy={cy} dx={0.35} dy={-0.08} palette={palette} />);
    }

    // ---- level 2: bigger square + grand fountain + clocktower + flagpoles ----
    if (lvl >= 2) {
      const c2 = toIso(cx, cy, 0, 0, 1);
      add(<ellipse key="pv2" cx={c2.x} cy={c2.y} rx={TILE * 0.44} ry={TILE * 0.2} fill={palette.paving} stroke={palette.stroke} />);
      // Tile pattern
      const a = toIso(cx, cy, 0, -0.3, 1);
      const b = toIso(cx, cy, 0.3, 0, 1);
      const d = toIso(cx, cy, 0, 0.3, 1);
      const e = toIso(cx, cy, -0.3, 0, 1);
      add(<polygon key="pvt" points={`${a.x},${a.y} ${b.x},${b.y} ${d.x},${d.y} ${e.x},${e.y}`} fill="none" stroke={palette.stroke} strokeDasharray="2 3" strokeWidth={0.6} />);
      // Fountain 3-tier
      const fH = 4 + lvl * 2;
      add(<IsoBox key="f1" cx={cx} cy={cy} dx={0} dy={0} w={0.18} d={0.18} h={3} palette={palette}
        colorTop={palette.water} colorL={shade("#2a6b9c", -0.25)} colorR={shade("#2a6b9c", -0.05)} />);
      add(<IsoBox key="f2" cx={cx} cy={cy} dx={0} dy={0} w={0.1} d={0.1} h={3 + fH} palette={palette}
        colorTop={palette.water} colorL={shade("#2a6b9c", -0.2)} colorR={shade("#2a6b9c", -0.05)} />);
      // Clocktower
      const twH = 26 + lvl * 5;
      add(<IsoBox key="ct" cx={cx} cy={cy} dx={-0.32} dy={-0.22} w={0.12} d={0.12} h={twH} palette={palette}
        colorTop="#c9a56b" colorL={shade("#c9a56b", -0.3)} colorR={shade("#c9a56b", -0.1)}
        windows={{ cols: 2, rows: Math.floor(twH / 12) }} door />);
      const clockP = toIso(cx, cy, -0.32 + 0.06, -0.22 + 0.06, twH - 6);
      add(<circle key="ctc" cx={clockP.x} cy={clockP.y} r={5} fill="#fff" stroke={palette.stroke} strokeWidth={0.7} />);
      add(<line key="cth" x1={clockP.x} y1={clockP.y} x2={clockP.x + 1.5} y2={clockP.y - 2.5} stroke={palette.stroke} strokeWidth={1} />);
      add(<line key="ctm" x1={clockP.x} y1={clockP.y} x2={clockP.x} y2={clockP.y - 4} stroke={palette.stroke} strokeWidth={1} />);
      add(<PitchedRoof key="ctr" cx={cx} cy={cy} dx={-0.32} dy={-0.22} w={0.14} d={0.14} wallH={twH} roofH={8} palette={palette} roofColor="#8a4b2b" />);
      // Flagpoles
      [-0.15, 0, 0.15].forEach((dx, i) => {
        const bot = toIso(cx, cy, dx, 0.42, 0);
        const top = toIso(cx, cy, dx, 0.42, 20);
        add(<line key={`flp-${i}`} x1={bot.x} y1={bot.y} x2={top.x} y2={top.y} stroke={palette.stroke} strokeWidth={1} />);
        add(<rect key={`flp-f-${i}`} x={top.x} y={top.y} width={12} height={7} fill={accent} stroke={palette.stroke} strokeWidth={0.3} />);
      });
    }

    // ---- level 3: civic buildings + monument statue + food kiosks + performer ----
    if (lvl >= 3) {
      // Town hall east
      add(<IsoBox key="th" cx={cx} cy={cy} dx={0.32} dy={-0.22} w={0.16} d={0.16} h={22} palette={palette}
        colorTop="#e5d1a4" colorL={shade("#e5d1a4", -0.3)} colorR={shade("#e5d1a4", -0.1)}
        windows={{ cols: 3, rows: 3 }} door />);
      add(<PitchedRoof key="thr" cx={cx} cy={cy} dx={0.32} dy={-0.22} w={0.18} d={0.18} wallH={22} roofH={10} palette={palette} roofColor="#5a3124" />);
      // Monument statue on pedestal
      add(<IsoBox key="mn-b" cx={cx} cy={cy} dx={0} dy={0} w={0.07} d={0.07} h={8} palette={palette}
        colorTop="#c9bda6" colorL="#8a7d66" colorR="#a49785" />);
      add(<IsoBox key="mn-s" cx={cx} cy={cy} dx={0} dy={0} w={0.03} d={0.03} h={14} palette={palette}
        colorTop="#b5a890" colorL="#7a6d55" colorR="#8c7f67" />);
      // Food kiosks
      add(<Kiosk key="kk1" cx={cx} cy={cy} dx={0.3} dy={0.3} palette={palette} accent="#e14b5a" />);
      add(<Kiosk key="kk2" cx={cx} cy={cy} dx={-0.15} dy={0.3} palette={palette} accent="#4fa85e" />);
    }

    // ---- level 4: grand plaza with columns + multi-tier fountain + chime tower ----
    if (lvl >= 4) {
      // Columns at 4 corners of plaza
      [[-0.3, 0.25], [0.3, 0.25], [-0.3, -0.3], [0.3, -0.3]].forEach(([dx, dy], i) =>
        add(<IsoBox key={`cl-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} w={0.03} d={0.03} h={20} palette={palette}
          colorTop="#e8e0cf" colorL={shade("#e8e0cf", -0.25)} colorR={shade("#e8e0cf", -0.1)} />)
      );
      // Extra fountain pillar
      const fH = 4 + lvl * 2;
      add(<IsoBox key="fp" cx={cx} cy={cy} dx={0} dy={0} w={0.04} d={0.04} h={3 + fH + 14 + lvl * 3} palette={palette}
        colorTop="#f5c84b" colorL={shade("#f5c84b", -0.2)} colorR={shade("#f5c84b", -0.05)} />);
      // Water jets
      const jetY = 3 + fH + 14 + lvl * 3 + 7;
      const jt = toIso(cx, cy, 0, 0, jetY);
      add(<circle key="jt1" cx={jt.x - 5} cy={jt.y + 2} r={1.8} fill={palette.water} opacity={0.85} />);
      add(<circle key="jt2" cx={jt.x + 5} cy={jt.y + 2} r={1.8} fill={palette.water} opacity={0.85} />);
      add(<circle key="jt3" cx={jt.x} cy={jt.y - 3} r={2.4} fill={palette.water} opacity={0.9} />);
      // Lamposts
      [[-0.38, 0.12], [0.38, 0.12]].forEach(([dx, dy], i) => add(<Lamppost key={`lp4-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} palette={palette} />));
      // Benches
      [[-0.2, 0.22], [0.2, 0.22]].forEach(([dx, dy], i) => add(<Bench key={`bh4-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} palette={palette} />));
    }

    // ---- level 5: Times Square: LED screens on all sides + huge monument + stage ----
    if (lvl >= 5) {
      add(<LEDScreen key="ls-n" cx={cx} cy={cy} dx={0} dy={-0.42} h={26} palette={palette} />);
      add(<LEDScreen key="ls-w" cx={cx} cy={cy} dx={-0.42} dy={0} h={22} palette={palette} />);
      add(<LEDScreen key="ls-e" cx={cx} cy={cy} dx={0.42} dy={0} h={22} palette={palette} />);
      // Giant monument on pedestal center (taller pillar)
      const jetY = 3 + 14 + 14 + 15;
      const mT = toIso(cx, cy, 0, 0, jetY + 12);
      add(<polygon key="mN" points={`${mT.x - 4},${mT.y + 3} ${mT.x + 4},${mT.y + 3} ${mT.x},${mT.y - 6}`} fill={accent} stroke={palette.stroke} strokeWidth={0.4} />);
      // Concert stage
      add(<IsoBox key="stg" cx={cx} cy={cy} dx={0.2} dy={0.4} w={0.2} d={0.06} h={4} palette={palette}
        colorTop="#333" colorL="#111" colorR="#222" />);
      add(<IsoBox key="stg-b" cx={cx} cy={cy} dx={0.2} dy={0.36} w={0.2} d={0.03} h={14} palette={palette}
        colorTop="#555" colorL="#333" colorR="#444" />);
      // Holiday billboards
      add(<Billboard key="bb1" cx={cx} cy={cy} dx={-0.25} dy={0.4} h={20} color="#e14b5a" text="SALE" palette={palette} />);
      add(<Billboard key="bb2" cx={cx} cy={cy} dx={0.4} dy={-0.35} h={18} color="#2d7fd4" text="NEWS" palette={palette} />);
    }
  }

  if (id === "residential") {
    // ---- level 0: 1-2 tiny huts + dirt road + well ----
    if (lvl === 0) {
      add(<IsoBox key="h0-1" cx={cx} cy={cy} dx={-0.2} dy={-0.1} w={0.16} d={0.16} h={8} palette={palette}
        colorTop="#b58a5a" colorL="#7e5e3a" colorR="#95714b" windows={{ cols: 1, rows: 1 }} door />);
      add(<PitchedRoof key="hr0-1" cx={cx} cy={cy} dx={-0.2} dy={-0.1} w={0.18} d={0.18} wallH={8} roofH={6} palette={palette} roofColor="#6a3f24" />);
      add(<IsoBox key="h0-2" cx={cx} cy={cy} dx={0.18} dy={0.15} w={0.14} d={0.14} h={7} palette={palette}
        colorTop="#a98060" colorL="#725540" colorR="#8a6a4c" windows={{ cols: 1, rows: 1 }} />);
      add(<PitchedRoof key="hr0-2" cx={cx} cy={cy} dx={0.18} dy={0.15} w={0.16} d={0.16} wallH={7} roofH={5} palette={palette} roofColor="#6a3f24" />);
      add(<Well key="wl0" cx={cx} cy={cy} dx={0.05} dy={-0.3} palette={palette} />);
      // Dirt road
      const r1 = toIso(cx, cy, -0.45, 0.35, 1);
      const r2 = toIso(cx, cy,  0.45, 0.35, 1);
      add(<line key="dr" x1={r1.x} y1={r1.y} x2={r2.x} y2={r2.y} stroke="#8a7556" strokeWidth={6} strokeLinecap="round" />);
    }

    // ---- level 1: 3-4 wooden houses + picket fences + mailboxes + dog ----
    if (lvl >= 1) {
      const houses1 = [
        { dx: -0.28, dy: -0.2, hue: "#b58a5a" },
        { dx:  0.28, dy: -0.2, hue: "#a98060" },
        { dx: -0.18, dy:  0.2, hue: "#c9a56b" },
        { dx:  0.22, dy:  0.2, hue: "#b58a5a" }
      ];
      const show = Math.min(4, 1 + lvl);
      for (let i = 0; i < show; i++) {
        const H = houses1[i];
        const wallH = 10 + lvl * 2;
        const roofH = 7 + lvl;
        add(<IsoBox key={`h1-${i}`} cx={cx} cy={cy} dx={H.dx} dy={H.dy} w={0.18} d={0.18} h={wallH} palette={palette}
          colorTop={H.hue} colorL={shade(H.hue, -0.3)} colorR={shade(H.hue, -0.12)}
          windows={{ cols: 2, rows: 1 }} door />);
        add(<PitchedRoof key={`hr1-${i}`} cx={cx} cy={cy} dx={H.dx} dy={H.dy} w={0.2} d={0.2} wallH={wallH} roofH={roofH} palette={palette} roofColor="#6a3f24" />);
        if (lvl >= 2) add(<Chimney key={`ch1-${i}`} cx={cx} cy={cy} dx={H.dx + 0.06} dy={H.dy - 0.03} h={wallH + roofH * 0.8} palette={palette} />);
        // Mailbox
        add(<IsoBox key={`mb-${i}`} cx={cx} cy={cy} dx={H.dx - 0.1} dy={H.dy + 0.08} w={0.015} d={0.015} h={4} palette={palette}
          colorTop="#e14b5a" colorL="#a03543" colorR="#b53d4f" />);
      }
      // Picket fences along front
      add(<Fence key="fn1" cx={cx} cy={cy} dx={0} dy={0.44} length={0.3} axis="x" palette={palette} />);
    }

    // ---- level 2: suburbs - brick + garages + driveways + cars ----
    if (lvl >= 2) {
      // Cars in driveways
      [[-0.2, -0.02], [0.2, -0.02], [-0.2, 0.38], [0.2, 0.38]].forEach(([dx, dy], i) =>
        add(<Car key={`rc-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} color={["#5ba0e0", "#e14b5a", "#4fa85e", "#f5c84b"][i]} palette={palette} />)
      );
      // Hedges (neat front yards)
      add(<Hedge key="hd1" cx={cx} cy={cy} dx={-0.4} dy={0} length={0.25} axis="y" palette={palette} />);
      add(<Hedge key="hd2" cx={cx} cy={cy} dx={0.4} dy={0} length={0.25} axis="y" palette={palette} />);
      // Street trees on front
      [-0.35, -0.12, 0.12, 0.35].forEach((t, i) => add(<IsoTree key={`rt2-${i}`} cx={cx} cy={cy} dx={t} dy={0.42} size={0.6} palette={palette} />));
    }

    // ---- level 3: townhouses in row + shared walls + bike stand + courtyard ----
    if (lvl >= 3) {
      // Row of townhouses east side
      [0.28, 0.35, 0.42].forEach((dx, i) => {
        add(<IsoBox key={`th-${i}`} cx={cx} cy={cy} dx={dx} dy={0} w={0.065} d={0.18} h={18 + lvl * 2} palette={palette}
          colorTop={["#b57cd0", "#d0829d", "#7cb0d0"][i]} colorL={shade(["#b57cd0", "#d0829d", "#7cb0d0"][i], -0.3)} colorR={shade(["#b57cd0", "#d0829d", "#7cb0d0"][i], -0.1)}
          windows={{ cols: 1, rows: 3 }} door />);
      });
      // Bike stand (3 short bollards)
      [0, 0.03, 0.06].forEach((t, i) => add(<Bollard key={`bs3-${i}`} cx={cx} cy={cy} dx={-0.05 + t} dy={-0.2} palette={palette} />));
      // Community bench + flowers
      add(<Bench key="cbh" cx={cx} cy={cy} dx={-0.28} dy={-0.15} palette={palette} />);
      add(<Flower key="cf1" cx={cx} cy={cy} dx={-0.18} dy={-0.15} color="#e14b5a" palette={palette} />);
      add(<Flower key="cf2" cx={cx} cy={cy} dx={-0.15} dy={-0.1} color="#f5c84b" palette={palette} />);
    }

    // ---- level 4: mid-rise apartments 6-8 floors + balconies + courtyard playground ----
    if (lvl >= 4) {
      // Mid-rise blocks
      [[-0.32, -0.05], [-0.32, 0.25]].forEach(([dx, dy], i) =>
        add(<IsoBox key={`mr-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} w={0.16} d={0.16} h={38} palette={palette}
          colorTop="#b57cd0" colorL={shade("#b57cd0", -0.3)} colorR={shade("#b57cd0", -0.1)}
          windows={{ cols: 3, rows: 6 }} door />)
      );
      // Courtyard playground
      add(<Swing key="sw-r" cx={cx} cy={cy} dx={0.08} dy={-0.2} palette={palette} />);
      add(<Slide key="sl-r" cx={cx} cy={cy} dx={0.22} dy={-0.2} palette={palette} />);
      // Corner shop
      add(<IsoBox key="cs" cx={cx} cy={cy} dx={0.38} dy={-0.3} w={0.1} d={0.1} h={9} palette={palette}
        colorTop="#d9a441" colorL={shade("#d9a441", -0.3)} colorR={shade("#d9a441", -0.1)} door />);
    }

    // ---- level 5: hi-rise towers + rooftop gardens + pool + underground parking ramp ----
    if (lvl >= 5) {
      [[-0.3, -0.1], [0.3, -0.1], [0, 0.2]].forEach(([dx, dy], i) => {
        const hue = ["#7cb0d0", "#b57cd0", "#d0829d"][i];
        // Tower with windows — green top face = rooftop garden cap
        add(<IsoBox key={`hr-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} w={0.2} d={0.2} h={82} palette={palette}
          colorTop={palette.leaf}
          colorL={shade(hue, -0.3)}
          colorR={shade(hue, -0.1)}
          windows={{ cols: 4, rows: 9 }} />);
      });
      // Rooftop pool symbol on first tower
      const poolP = toIso(cx, cy, -0.3, -0.1, 82);
      add(<rect key="rp" x={poolP.x - 6} y={poolP.y - 2} width={12} height={4} fill={palette.water} stroke={palette.stroke} strokeWidth={0.3} />);
      // Ground level landscaping
      [[-0.42, 0.4], [0.42, 0.4], [0, 0.42]].forEach(([dx, dy], i) => add(<IsoTree key={`hrt-${i}`} cx={cx} cy={cy} dx={dx} dy={dy} size={0.6} palette={palette} />));
    }
  }

  return n;
}

// ---------- Animated entities ----------

function svgPoint(districtId, dx, dy, dz = 0) {
  const d = DISTRICTS.find((x) => x.id === districtId);
  if (!d) return { x: 0, y: 0 };
  const { x: cx, y: cy } = plotCentre(d.col, d.row);
  return toIso(cx, cy, dx, dy, dz);
}

function Bird({ fromX, toX, y, dur, delay = 0, size = 1, color = "#2a2f3a" }) {
  const s = size;
  return (
    <g>
      <g>
        <path
          d={`M ${-6 * s} 0 Q ${-3 * s} ${-3 * s} 0 0 Q ${3 * s} ${-3 * s} ${6 * s} 0`}
          stroke={color}
          strokeWidth={1.2 * s}
          fill="none"
          strokeLinecap="round"
        />
        <animateTransform
          attributeName="transform"
          type="scale"
          values={`1 1;1 0.55;1 1;1 0.55;1 1`}
          dur={`${0.8}s`}
          repeatCount="indefinite"
        />
      </g>
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`${fromX} ${y};${toX} ${y}`}
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        additive="sum"
      />
    </g>
  );
}

function Pedestrian({ path, dur, delay = 0, color = "#e14b5a" }) {
  // path: array of {x, y} SVG points; entity ping-pongs back and forth through them.
  const forward = path.map((p) => `${p.x} ${p.y}`).join(";");
  const backward = [...path].reverse().map((p) => `${p.x} ${p.y}`).join(";");
  const values = `${forward};${backward}`;
  return (
    <g>
      <rect x={-1.8} y={-5} width={3.6} height={6} fill={color} stroke="#2a2f3a" strokeWidth={0.3} />
      <circle cx={0} cy={-7} r={2} fill="#f4d3a9" stroke="#2a2f3a" strokeWidth={0.3} />
      <line x1={-1.2} y1={1} x2={-1.2} y2={4} stroke="#2a2f3a" strokeWidth={0.9} />
      <line x1={1.2} y1={1} x2={1.2} y2={4} stroke="#2a2f3a" strokeWidth={0.9} />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={values}
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
        calcMode="linear"
      />
    </g>
  );
}

function MovingCar({ fromP, toP, dur, delay = 0, color = "#e14b5a" }) {
  return (
    <g>
      <rect x={-5} y={-3} width={10} height={4} fill={color} stroke="#2a2f3a" strokeWidth={0.4} />
      <rect x={-3.5} y={-6} width={7} height={3} fill={shade(color, -0.15)} stroke="#2a2f3a" strokeWidth={0.4} />
      <rect x={-2.8} y={-5.5} width={2.4} height={2} fill="#a7d8ff" />
      <rect x={0.4} y={-5.5} width={2.4} height={2} fill="#a7d8ff" />
      <circle cx={-3} cy={1.5} r={1.1} fill="#2a2f3a" />
      <circle cx={3}  cy={1.5} r={1.1} fill="#2a2f3a" />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={`${fromP.x} ${fromP.y};${toP.x} ${toP.y};${fromP.x} ${fromP.y}`}
        dur={`${dur}s`}
        begin={`${delay}s`}
        repeatCount="indefinite"
      />
    </g>
  );
}

function AnimatedLayer({ minX, maxX }) {
  // Birds fly above everything — pedestrians are handled per-plot so that
  // buildings can occlude them correctly.
  const birdY1 = -30;
  const birdY2 = 10;
  const birdY3 = 50;
  return (
    <g pointerEvents="none">
      <Bird fromX={minX - 20} toX={maxX + 20} y={birdY1} dur={14} />
      <Bird fromX={minX - 20} toX={maxX + 20} y={birdY2} dur={18} delay={4} size={0.8} />
      <Bird fromX={maxX + 20} toX={minX - 20} y={birdY3} dur={22} delay={2} size={0.9} color="#3a4250" />
    </g>
  );
}

// ---------- Mountain/sky landscape backdrop ----------

// Build one mountain layer: a series of triangular peaks with a sun-lit side
// and a shaded side, plus optional snow caps.
function MountainLayer({
  minX, vbW, baseY,
  peaks,        // [{ x (0..1 within width), w, h, snow? }, ...]
  fillLight, fillShadow, outline, snowColor,
  key: groupKey
}) {
  const nodes = [];
  // Main silhouette polygon — union of all peaks against baseline
  let silhouette = `M ${minX} ${baseY} `;
  peaks.forEach((p) => {
    const cx = minX + p.x * vbW;
    silhouette += `L ${cx - p.w / 2} ${baseY} `;
    silhouette += `L ${cx} ${baseY - p.h} `;
    silhouette += `L ${cx + p.w / 2} ${baseY} `;
  });
  silhouette += `L ${minX + vbW} ${baseY} Z`;
  nodes.push(
    <path key={`${groupKey}-sil`} d={silhouette} fill={fillLight} stroke={outline || "none"} strokeWidth={0.5} />
  );

  // Shadow side (right slope)
  peaks.forEach((p, i) => {
    const cx = minX + p.x * vbW;
    const tip = { x: cx, y: baseY - p.h };
    const rightBase = { x: cx + p.w / 2, y: baseY };
    nodes.push(
      <polygon
        key={`${groupKey}-sh-${i}`}
        points={`${tip.x},${tip.y} ${rightBase.x},${rightBase.y} ${cx + p.w * 0.12},${baseY - p.h * 0.2}`}
        fill={fillShadow}
      />
    );
  });

  // Ridge highlight (ridge line from tip going slightly down-right to suggest form)
  peaks.forEach((p, i) => {
    const cx = minX + p.x * vbW;
    const tip = { x: cx, y: baseY - p.h };
    nodes.push(
      <line
        key={`${groupKey}-ridge-${i}`}
        x1={tip.x} y1={tip.y}
        x2={cx + p.w * 0.18} y2={baseY - p.h * 0.35}
        stroke={fillShadow}
        strokeWidth={1}
        opacity={0.7}
      />
    );
  });

  // Snow caps — jagged triangles on the top portion
  peaks.forEach((p, i) => {
    if (!p.snow) return;
    const cx = minX + p.x * vbW;
    const tip = { x: cx, y: baseY - p.h };
    const snowBand = Math.min(p.h * 0.35, p.w * 0.3);
    // jagged shape: tip + zigzag down both sides
    const left1 = { x: cx - snowBand * 0.4, y: baseY - p.h + snowBand * 0.6 };
    const left2 = { x: cx - snowBand * 0.7, y: baseY - p.h + snowBand * 0.9 };
    const right1 = { x: cx + snowBand * 0.3, y: baseY - p.h + snowBand * 0.5 };
    const right2 = { x: cx + snowBand * 0.7, y: baseY - p.h + snowBand * 0.9 };
    nodes.push(
      <polygon
        key={`${groupKey}-snow-${i}`}
        points={`${tip.x},${tip.y} ${right1.x},${right1.y} ${right2.x},${right2.y} ${cx + snowBand * 0.45},${baseY - p.h + snowBand * 1.05} ${cx - snowBand * 0.15},${baseY - p.h + snowBand * 0.9} ${left2.x},${left2.y} ${left1.x},${left1.y}`}
        fill={snowColor}
      />
    );
    // small shadow on snow (right side)
    nodes.push(
      <polygon
        key={`${groupKey}-snowsh-${i}`}
        points={`${tip.x},${tip.y} ${right1.x},${right1.y} ${right2.x},${right2.y}`}
        fill={shade(snowColor, -0.12)}
        opacity={0.7}
      />
    );
  });

  return <g>{nodes}</g>;
}

function Landscape({ minX, minY, vbW, vbH, isLight, palette, horizonY }) {
  const grassTop = horizonY;
  const farBase  = grassTop + 4;
  const midBase  = grassTop + 12;
  const nearBase = grassTop + 20;

  // Extra vertical padding so sky/grass fill the letterbox produced by the
  // aspect-ratio mismatch between viewBox and container.
  const OVERFLOW = 400;

  // Deterministic "random" peak generators based on seeded positions.
  const farPeaks = [
    { x: 0.04, w: 70,  h: 48, snow: false },
    { x: 0.11, w: 90,  h: 72, snow: true  },
    { x: 0.19, w: 80,  h: 58, snow: false },
    { x: 0.26, w: 110, h: 84, snow: true  },
    { x: 0.34, w: 85,  h: 60, snow: false },
    { x: 0.42, w: 100, h: 78, snow: true  },
    { x: 0.49, w: 95,  h: 66, snow: false },
    { x: 0.56, w: 105, h: 82, snow: true  },
    { x: 0.64, w: 78,  h: 54, snow: false },
    { x: 0.72, w: 118, h: 92, snow: true  },
    { x: 0.80, w: 88,  h: 62, snow: false },
    { x: 0.88, w: 96,  h: 72, snow: true  },
    { x: 0.96, w: 72,  h: 50, snow: false }
  ];

  const midPeaks = [
    { x: 0.05, w: 80,  h: 40, snow: false },
    { x: 0.14, w: 95,  h: 58, snow: true },
    { x: 0.22, w: 78,  h: 42, snow: false },
    { x: 0.31, w: 110, h: 68, snow: true },
    { x: 0.40, w: 85,  h: 46, snow: false },
    { x: 0.49, w: 100, h: 60, snow: true },
    { x: 0.58, w: 92,  h: 52, snow: false },
    { x: 0.67, w: 112, h: 72, snow: true },
    { x: 0.76, w: 82,  h: 44, snow: false },
    { x: 0.85, w: 98,  h: 58, snow: true },
    { x: 0.93, w: 76,  h: 40, snow: false }
  ];

  const nearPeaks = [
    { x: 0.08, w: 110, h: 36, snow: false },
    { x: 0.22, w: 130, h: 50, snow: false },
    { x: 0.36, w: 100, h: 34, snow: false },
    { x: 0.50, w: 140, h: 56, snow: false },
    { x: 0.64, w: 110, h: 38, snow: false },
    { x: 0.78, w: 135, h: 52, snow: false },
    { x: 0.92, w: 105, h: 34, snow: false }
  ];

  // Forest tree line along nearBase (small conifer silhouettes)
  const forestDark = isLight ? "#3c6a3c" : "#14321f";
  const treeLine = [];
  const treeCount = 48;
  for (let i = 0; i < treeCount; i++) {
    const tx = minX + (i / (treeCount - 1)) * vbW;
    const ty = nearBase + 2;
    const tH = 8 + ((i * 37) % 6);
    const tW = 5 + ((i * 13) % 3);
    treeLine.push(
      <polygon
        key={`tree-${i}`}
        points={`${tx},${ty - tH} ${tx - tW / 2},${ty + 1} ${tx + tW / 2},${ty + 1}`}
        fill={forestDark}
      />
    );
  }

  // Drifting clouds: each cloud slowly translates across the sky.
  const clouds = [];
  const cloudDefs = [
    { baseX: minX + vbW * 0.14, y: minY + vbH * 0.10, s: 1.0, dur: 120, delay: 0 },
    { baseX: minX + vbW * 0.42, y: minY + vbH * 0.05, s: 1.2, dur: 160, delay: 20 },
    { baseX: minX + vbW * 0.68, y: minY + vbH * 0.14, s: 0.9, dur: 140, delay: 50 },
    { baseX: minX + vbW * 0.88, y: minY + vbH * 0.08, s: 1.05, dur: 180, delay: 10 }
  ];
  cloudDefs.forEach((c, i) => {
    clouds.push(
      <g key={`cloud-${i}`} opacity={0.88}>
        <g>
          <ellipse cx={0}             cy={0}          rx={22 * c.s} ry={9 * c.s}  fill={palette.cloud} />
          <ellipse cx={-14 * c.s}     cy={4 * c.s}    rx={16 * c.s} ry={7 * c.s}  fill={palette.cloud} />
          <ellipse cx={18 * c.s}      cy={3 * c.s}    rx={14 * c.s} ry={6 * c.s}  fill={palette.cloud} />
          <ellipse cx={-3 * c.s}      cy={-5 * c.s}   rx={10 * c.s} ry={5 * c.s}  fill={palette.cloud} />
        </g>
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`${c.baseX - vbW * 0.2} ${c.y};${c.baseX + vbW * 1.1} ${c.y}`}
          dur={`${c.dur}s`}
          begin={`${c.delay - c.dur}s`}
          repeatCount="indefinite"
        />
      </g>
    );
  });

  // Day/night cycle. Sun and moon arc across the sky on opposite halves of a
  // 120s cycle. Each body follows a parametric arc: rises from left horizon,
  // peaks at centre, sets at right horizon, then stays below (hidden) until
  // its next turn.
  const CYCLE = 120; // seconds for a full day+night
  const peakY = minY + vbH * 0.06; // top of sky
  const horzLY = horizonY - 6;
  const leftX = minX + vbW * 0.08;
  const rightX = minX + vbW * 0.92;
  const midXs = minX + vbW * 0.5;

  // Arc samples (keyTimes uniformly spaced 0..0.5, then hidden 0.5..1)
  const arcSamples = 11;
  const arcPts = [];
  for (let i = 0; i <= arcSamples; i++) {
    const t = i / arcSamples;
    // parametric: x from left→mid→right, y arcs up using sin(π t)
    const x = leftX + (rightX - leftX) * t;
    const y = horzLY - Math.sin(Math.PI * t) * (horzLY - peakY);
    arcPts.push({ x, y });
  }
  const below = { x: midXs, y: horizonY + 120 }; // hidden position

  // Build translate values for sun (active 0..0.5) and moon (active 0.5..1)
  const sunValues = [
    ...arcPts.map((p) => `${p.x} ${p.y}`),
    `${below.x} ${below.y}`,
    `${below.x} ${below.y}`
  ].join(";");
  const sunKeyTimes = (() => {
    const kt = [];
    for (let i = 0; i <= arcSamples; i++) kt.push((i / arcSamples * 0.5).toFixed(4));
    kt.push("0.55");
    kt.push("1");
    return kt.join(";");
  })();

  const moonValues = [
    `${below.x} ${below.y}`,
    `${below.x} ${below.y}`,
    ...arcPts.map((p) => `${p.x} ${p.y}`)
  ].join(";");
  const moonKeyTimes = (() => {
    const kt = ["0", "0.45"];
    for (let i = 0; i <= arcSamples; i++) kt.push((0.5 + i / arcSamples * 0.5).toFixed(4));
    return kt.join(";");
  })();

  // Opacity schedule: sun visible 0.02..0.48, moon visible 0.52..0.98
  const sunOpacityValues = "0;1;1;0;0;0";
  const sunOpacityKt    = "0;0.05;0.45;0.5;0.95;1";
  const moonOpacityValues = "0;0;0;1;1;0";
  const moonOpacityKt     = "0;0.45;0.55;0.6;0.95;1";

  // Sun + glow
  const sun = (
    <g>
      <circle r={30} fill={palette.sunGlow} opacity={0.32} />
      <circle r={20} fill={palette.sunGlow} opacity={0.5} />
      <circle r={14} fill={palette.sun} />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={sunValues}
        keyTimes={sunKeyTimes}
        dur={`${CYCLE}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values={sunOpacityValues}
        keyTimes={sunOpacityKt}
        dur={`${CYCLE}s`}
        repeatCount="indefinite"
      />
    </g>
  );

  const moon = (
    <g>
      <circle r={24} fill={palette.moonGlow} opacity={0.28} />
      <circle r={14} fill={palette.moon} />
      <circle cx={-3} cy={-2} r={2.2} fill={shade(palette.moon, -0.1)} />
      <circle cx={4}  cy={3}  r={1.6} fill={shade(palette.moon, -0.1)} />
      <circle cx={1}  cy={-5} r={1.2} fill={shade(palette.moon, -0.1)} />
      <animateTransform
        attributeName="transform"
        type="translate"
        values={moonValues}
        keyTimes={moonKeyTimes}
        dur={`${CYCLE}s`}
        repeatCount="indefinite"
      />
      <animate
        attributeName="opacity"
        values={moonOpacityValues}
        keyTimes={moonOpacityKt}
        dur={`${CYCLE}s`}
        repeatCount="indefinite"
      />
    </g>
  );

  // Stars that fade in during night portion of the cycle
  const stars = [];
  const starPositions = [
    [0.08, 0.05], [0.16, 0.12], [0.24, 0.06], [0.33, 0.15], [0.4, 0.08],
    [0.48, 0.18], [0.56, 0.06], [0.64, 0.14], [0.72, 0.09], [0.8, 0.16],
    [0.88, 0.07], [0.2, 0.22], [0.6, 0.24], [0.76, 0.2], [0.12, 0.18]
  ];
  starPositions.forEach(([fx, fy], i) => {
    stars.push(
      <g key={`st-${i}`}>
        <circle cx={minX + vbW * fx} cy={minY + vbH * fy} r={0.8 + (i % 3) * 0.3} fill="#fff8d8" />
        <animate
          attributeName="opacity"
          values="0;0;0.9;0.9;0"
          keyTimes="0;0.5;0.6;0.95;1"
          dur={`${CYCLE}s`}
          repeatCount="indefinite"
        />
      </g>
    );
  });

  // Rain — appears periodically, drifts diagonally.
  const rainDrops = [];
  const rainCount = 34;
  for (let i = 0; i < rainCount; i++) {
    const x = minX + (i / rainCount) * vbW + ((i * 17) % 20);
    const y0 = minY - 20 + ((i * 23) % 60);
    const len = 8 + ((i * 7) % 4);
    rainDrops.push(
      <g key={`drop-${i}`}>
        <line x1={0} y1={0} x2={-2} y2={len} stroke={palette.rain} strokeWidth={1.1} strokeLinecap="round" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`${x} ${y0};${x - 14} ${y0 + vbH * 0.55}`}
          dur={`${0.9 + (i % 5) * 0.1}s`}
          repeatCount="indefinite"
        />
      </g>
    );
  }

  // Rain group fades in/out: a 45s weather cycle offset from day/night.
  const rainCycle = 45;

  // Atmospheric color graduation: far layers lighter (blended with sky); near
  // layers darker and more saturated.
  const farLight   = palette.mtFar;
  const farShadow  = shade(palette.mtFar, -0.18);
  const midLight   = palette.mtMid;
  const midShadow  = shade(palette.mtMid, -0.18);
  const nearLight  = shade(palette.mtMid, -0.1);
  const nearShadow = shade(palette.mtMid, -0.28);

  const grassHeight = Math.max(0, minY + vbH - grassTop);

  return (
    <g>
      {/* Sky extends well above viewBox to cover any letterbox area */}
      <rect
        x={minX - OVERFLOW}
        y={minY - OVERFLOW}
        width={vbW + OVERFLOW * 2}
        height={(grassTop - minY) + OVERFLOW}
        fill="url(#sky-grad)"
      />
      {stars}
      {sun}
      {moon}
      {clouds}
      {/* Grass extends well below viewBox to cover letterbox at bottom */}
      <rect
        x={minX - OVERFLOW}
        y={grassTop}
        width={vbW + OVERFLOW * 2}
        height={grassHeight + OVERFLOW}
        fill={palette.grass}
      />
      {/* Back-to-front mountain layers */}
      <MountainLayer
        minX={minX} vbW={vbW} baseY={farBase}
        peaks={farPeaks}
        fillLight={farLight} fillShadow={farShadow}
        snowColor={palette.snow}
        groupKey="far"
      />
      <MountainLayer
        minX={minX} vbW={vbW} baseY={midBase}
        peaks={midPeaks}
        fillLight={midLight} fillShadow={midShadow}
        snowColor={palette.snow}
        groupKey="mid"
      />
      <MountainLayer
        minX={minX} vbW={vbW} baseY={nearBase}
        peaks={nearPeaks}
        fillLight={nearLight} fillShadow={nearShadow}
        snowColor={palette.snow}
        groupKey="near"
      />
      {/* Forest line on nearest layer base */}
      {treeLine}
      {/* Rain — periodic */}
      <g>
        {rainDrops}
        <animate
          attributeName="opacity"
          values="0;0;0.75;0.75;0"
          keyTimes="0;0.5;0.55;0.85;1"
          dur={`${rainCycle}s`}
          repeatCount="indefinite"
        />
      </g>
    </g>
  );
}

// ---------- Plot body ----------

function PlotBody({ district, level, palette, isSelected, isLocked, onClick, clipId }) {
  const { x: cx, y: cy } = plotCentre(district.col, district.row);
  const c = plotCorners(cx, cy);

  const top = `M ${c.n.x} ${c.n.y} L ${c.e.x} ${c.e.y} L ${c.s.x} ${c.s.y} L ${c.w.x} ${c.w.y} Z`;
  const selectionStroke = "#ffd24a";

  // Locked plot: dark slab with a padlock, no decor or people.
  // Click still fires so the parent can explain *why* it's locked via
  // a popup; we just don't navigate into the district.
  if (isLocked) {
    return (
      <g
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } }}
        style={{ cursor: "pointer", outline: "none", opacity: 1 }}
      >
        <path d={top} fill="#1a1f2b" stroke={palette.stroke} strokeWidth={1} />
        <path d={top} fill="rgba(0,0,0,0.35)" />
        {/* Dashed border to suggest "coming soon" */}
        <path d={top} fill="none" stroke="#4a5568" strokeWidth={1.4} strokeDasharray="6 5" />
        {/* Padlock at centre */}
        {(() => {
          const p = toIso(cx, cy, 0, 0, 18);
          return (
            <g>
              {/* shackle */}
              <path d={`M ${p.x - 10} ${p.y - 2} a 10 10 0 0 1 20 0 v 10`} fill="none" stroke="#c9cdd3" strokeWidth={3} strokeLinecap="round" />
              {/* body */}
              <rect x={p.x - 14} y={p.y + 6} width={28} height={22} rx={3} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.8} />
              <circle cx={p.x} cy={p.y + 15} r={3} fill="#1a1f2b" />
              <rect x={p.x - 1} y={p.y + 15} width={2} height={7} fill="#1a1f2b" />
            </g>
          );
        })()}
      </g>
    );
  }

  const plotFill = palette.plotByLevel(district.id, level);
  const decor = renderDistrictDecor(district.id, level, cx, cy, palette, district.accent);
  const people = generatePeople(district.id, level, cx, cy, palette);

  return (
    <g
      className="city-iso-district"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{ cursor: "pointer", outline: "none" }}
    >
      {isSelected && (
        <path
          d={top}
          fill="none"
          stroke={selectionStroke}
          strokeWidth={4}
          opacity={0.45}
          style={{ filter: "blur(3px)" }}
        />
      )}
      {isSelected && (
        <ellipse cx={cx} cy={c.s.y + 6} rx={TILE * 0.94} ry={9}
          fill="rgba(245, 200, 75, 0.45)" opacity={0.9} />
      )}
      <path d={top} fill={plotFill} stroke={isSelected ? selectionStroke : palette.stroke} strokeWidth={isSelected ? 2.4 : 1} />

      {/* People layer: drawn directly on the plot surface, below decor so
          buildings/objects occlude them. Clipped to the plot diamond. */}
      <g clipPath={`url(#${clipId})`}>
        {people}
      </g>

      <g clipPath={`url(#${clipId})`}>
        {decor}
      </g>

      {isSelected && (
        <path d={top} fill="rgba(255, 210, 74, 0.12)" />
      )}
    </g>
  );
}

// Fallback labels for locked expansion districts (no i18n keys yet).
const DISTRICT_FALLBACK_NAMES = {
  aquapark: "Aquapark",
  university: "University",
  industrial: "Industrial"
};

function PlotOverlay({ district, level, palette, t, isSelected, isLocked }) {
  const { x: cx, y: cy } = plotCentre(district.col, district.row);
  const c = plotCorners(cx, cy);
  const labelKey = `district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`;
  const label = t?.[labelKey] || DISTRICT_FALLBACK_NAMES[district.id] || district.id;
  const labelX = cx;
  const labelY = c.s.y + DEPTH + 18;

  if (isLocked) {
    return (
      <g style={{ pointerEvents: "none" }}>
        <rect x={labelX - 78} y={labelY - 10} width={156} height={20} rx={10}
          fill="rgba(26, 31, 43, 0.92)"
          stroke="#4a5568"
          strokeWidth={0.8} />
        <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize={11} fontWeight={700}
          fill="#8a97ac" style={{ letterSpacing: "0.2px" }}>
          🔒 {label} · LOCKED
        </text>
      </g>
    );
  }

  return (
    <g>
      <rect x={labelX - 78} y={labelY - 10} width={156} height={20} rx={10}
        fill={isSelected ? "#ffd24a" : palette.labelBg}
        stroke={isSelected ? "#b47f00" : palette.stroke}
        strokeWidth={isSelected ? 1.2 : 0.8} />
      <text x={labelX} y={labelY + 3} textAnchor="middle" fontSize={11} fontWeight={700}
        fill={isSelected ? "#3d2600" : palette.labelText}
        style={{ pointerEvents: "none", letterSpacing: "0.2px" }}>
        {label} · {level}/5
      </text>
    </g>
  );
}

// ---------- Root ----------

export default function CityIsometricOverview({ levels = [0, 0, 0, 0, 0], selectedIdx = -1, onDistrictClick, t, preserveAspectRatio = "xMidYMid meet" }) {
  const { themeId } = useTheme();
  const isLight = themeId === "light";

  const palette = {
    stroke: isLight ? "#2a2f3a" : "#0a0e16",
    shadow: isLight ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.55)",
    // Dark themes (adventure / balance) previously used rgba(18,24,38) which
    // blended too much with the shadowed plots. Lightened slightly so the
    // pill reads as its own chip.
    labelBg: isLight ? "rgba(255,255,255,0.96)" : "rgba(44,54,78,0.92)",
    labelText: isLight ? "#1a1f2b" : "#f0f3f8",
    trunk: isLight ? "#6a4a2c" : "#3a2a1a",
    leafDark: isLight ? "#2f7a3e" : "#1e4a27",
    leaf: isLight ? "#4fa85e" : "#2f7a3e",
    leafLight: isLight ? "#7ec38a" : "#4fa85e",
    field: isLight ? "#5ca868" : "#2f6b3a",
    fieldInner: isLight ? "#6ec078" : "#3f7f4a",
    water: isLight ? "#6cc3f0" : "#2a6b9c",
    waterHi: "#b9e4f9",
    paving: isLight ? "#d8cdb8" : "#4a4236",
    buildingTop: isLight ? "#aab6c4" : "#4a5368",
    buildingSideL: isLight ? "#78849a" : "#2a3246",
    buildingSideR: isLight ? "#8b97ac" : "#353e56",
    slabSideL: isLight ? "#a59b7d" : "#1a2030",
    slabSideR: isLight ? "#b8ad8b" : "#242a3c",
    windowOn: isLight ? "#ffd98a" : "#6cd3ff",
    windowOff: isLight ? "#9ca7b6" : "#1b2436",
    // Landscape
    mtFar:   isLight ? "#8a98b2" : "#2a3146",
    mtMid:   isLight ? "#6b8b72" : "#1f3a2e",
    snow:    isLight ? "#fafbff" : "#c6d4e4",
    cloud:   isLight ? "#f7faff" : "#3e4a63",
    grass:   isLight ? "#7ec382" : "#1d3a28",
    sun:     "#ffe49a",
    sunGlow: "#fff3c2",
    moon:    "#e8edf5",
    moonGlow:"#aab6c4",
    skyTop:    isLight ? "#b4d7ff" : "#0b1530",
    skyHorizon:isLight ? "#ffe7c7" : "#2a2348",
    rain:      isLight ? "rgba(60, 90, 140, 0.55)" : "rgba(180, 210, 255, 0.6)",
    plotByLevel: (districtId, lvl) => {
      const themes = {
        sport:       { from: [220, 225, 215], to: [180, 200, 170] },
        business:    { from: [210, 218, 228], to: [150, 170, 200] },
        park:        { from: [170, 210, 160], to: [120, 180, 110] },
        square:      { from: [230, 220, 198], to: [200, 188, 155] },
        residential: { from: [220, 215, 222], to: [180, 165, 200] }
      };
      const dark = {
        sport:       { from: [40, 48, 55], to: [60, 85, 55] },
        business:    { from: [38, 46, 60], to: [40, 60, 90] },
        park:        { from: [35, 55, 38], to: [45, 85, 45] },
        square:      { from: [50, 46, 36], to: [80, 70, 45] },
        residential: { from: [48, 44, 52], to: [70, 50, 85] }
      };
      const pal = (isLight ? themes : dark)[districtId] || { from: [50, 50, 50], to: [80, 80, 80] };
      const k = lvl / 5;
      const r = Math.round(pal.from[0] + (pal.to[0] - pal.from[0]) * k);
      const g = Math.round(pal.from[1] + (pal.to[1] - pal.from[1]) * k);
      const b = Math.round(pal.from[2] + (pal.to[2] - pal.from[2]) * k);
      return `rgb(${r}, ${g}, ${b})`;
    }
  };

  // Tight viewBox. Headroom for tallest building is controlled by CLIP_H; the
  // viewBox just needs to expose that much space above the topmost plot.
  const centres = DISTRICTS.map((d) => plotCentre(d.col, d.row));
  const minCentreY = Math.min(...centres.map((p) => p.y));
  const maxCentreY = Math.max(...centres.map((p) => p.y));
  const minCentreX = Math.min(...centres.map((p) => p.x));
  const maxCentreX = Math.max(...centres.map((p) => p.x));
  const maxLvl = Math.max(0, ...levels.map((l) => Math.floor(Number(l) || 0)));
  // Headroom: leaves enough vertical space above plots for mountains + sky,
  // and pushes the plots into the lower portion of the container.
  const topPad = 160 + maxLvl * 16;
  const minX = minCentreX - TILE + 2;
  const maxX = maxCentreX + TILE - 2;
  const minY = minCentreY - TILE * 0.5 - topPad;
  const maxY = maxCentreY + TILE * 0.5 + DEPTH + 16;
  const vbW = maxX - minX;
  const vbH = maxY - minY;

  const ordered = DISTRICTS
    .map((d, idx) => ({ d, idx }))
    .sort((a, b) => (a.d.col + a.d.row) - (b.d.col + b.d.row) || a.d.row - b.d.row);

  // Build per-plot hexagonal clip polygons that match the 3D prism silhouette.
  const clipDefs = DISTRICTS.map((d) => {
    const { x: cx, y: cy } = plotCentre(d.col, d.row);
    const c = plotCorners(cx, cy);
    const id = `plot-clip-${d.id}`;
    // Hexagon: the outline of the prism when viewed iso.
    const pts = [
      `${c.n.x},${c.n.y - CLIP_H}`,           // top-N high
      `${c.e.x},${c.e.y - CLIP_H}`,           // top-E high
      `${c.e.x},${c.e.y}`,                    // E at plot
      `${c.e.x},${c.e.y + DEPTH}`,            // E at bottom
      `${c.s.x},${c.s.y + DEPTH}`,            // S at bottom
      `${c.w.x},${c.w.y + DEPTH}`,            // W at bottom
      `${c.w.x},${c.w.y}`,                    // W at plot
      `${c.w.x},${c.w.y - CLIP_H}`            // top-W high
    ].join(" ");
    return <clipPath key={id} id={id}><polygon points={pts} /></clipPath>;
  });

  return (
    <svg
      viewBox={`${minX} ${minY} ${vbW} ${vbH}`}
      preserveAspectRatio={preserveAspectRatio}
      style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
      aria-label="City districts overview"
    >
      <defs>
        {/* Sky gradient with a day/night cycle matched to the sun/moon arc
            (120s cycle in Landscape). Stops animate their colors through
            night → dawn → day → dusk → night. */}
        <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1530">
            <animate
              attributeName="stop-color"
              values="#0b1530;#4a4a70;#b4d7ff;#5a4270;#0b1530;#0b1530"
              keyTimes="0;0.1;0.25;0.4;0.5;1"
              dur="120s"
              repeatCount="indefinite"
            />
          </stop>
          <stop offset="100%" stopColor="#2a2348">
            <animate
              attributeName="stop-color"
              values="#2a2348;#d87555;#ffe7c7;#c97c5a;#2a2348;#2a2348"
              keyTimes="0;0.1;0.25;0.4;0.5;1"
              dur="120s"
              repeatCount="indefinite"
            />
          </stop>
        </linearGradient>
        {clipDefs}
      </defs>
      <style>{`
        .city-iso-district { transition: filter 0.15s ease; }
        .city-iso-district:hover { filter: brightness(1.12) drop-shadow(0 0 6px rgba(255,210,74,0.6)); }
        .city-iso-district:active { filter: brightness(1.25) drop-shadow(0 0 10px rgba(255,210,74,0.8)); }
      `}</style>
      <Landscape
        minX={minX}
        minY={minY}
        vbW={vbW}
        vbH={vbH}
        isLight={isLight}
        palette={palette}
        horizonY={minCentreY - TILE * 0.5 - 55}
      />

      {(() => {
        const coreAllMax = levels.slice(0, CORE_DISTRICT_COUNT)
          .every((l) => Math.floor(Number(l) || 0) >= 5);
        return (
          <>
            {ordered.map(({ d, idx }) => {
              const lvl = Math.max(0, Math.min(5, Math.floor(Number(levels[idx]) || 0)));
              const isLocked = !!d.locked && !coreAllMax;
              return (
                <PlotBody
                  key={`body-${d.id}`}
                  district={d}
                  level={lvl}
                  palette={palette}
                  isSelected={idx === selectedIdx}
                  isLocked={isLocked}
                  onClick={() => onDistrictClick?.(d.id, idx, { locked: isLocked })}
                  clipId={`plot-clip-${d.id}`}
                />
              );
            })}
            <AnimatedLayer minX={minX} maxX={maxX} />
            {DISTRICTS.map((d, idx) => {
              const lvl = Math.max(0, Math.min(5, Math.floor(Number(levels[idx]) || 0)));
              const isLocked = !!d.locked && !coreAllMax;
              return (
                <PlotOverlay
                  key={`ovl-${d.id}`}
                  district={d}
                  level={lvl}
                  palette={palette}
                  t={t}
                  isSelected={idx === selectedIdx}
                  isLocked={isLocked}
                />
              );
            })}
          </>
        );
      })()}
    </svg>
  );
}

export { DISTRICTS };
