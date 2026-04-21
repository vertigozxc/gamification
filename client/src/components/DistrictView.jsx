import { useTheme } from "../ThemeContext";

const W = 1000;
const H = 800;        // matches city-canvas-shell aspect 1.25:1 (W/H = 1.25)
const GROUND_Y = 650; // ground baseline; sky fills 0..GROUND_Y, road below

// --------------------------- palette & primitives ---------------------------

function useDistrictPalette() {
  const { themeId } = useTheme();
  const isLight = themeId === "light";
  return {
    isLight,
    sky: isLight
      ? ["#bde3ff", "#e6f4ff", "#fff1d8"]
      : ["#0a1226", "#1a2a4a", "#2b1a3a"],
    ground: isLight ? "#9db67a" : "#2d3a1f",
    dirt: isLight ? "#b49871" : "#50412b",
    road: isLight ? "#8a8d92" : "#2a2c30",
    roadLine: isLight ? "#fff" : "#f5c84b",
    stroke: isLight ? "#2a2f3a" : "#0a0e16",
    windowOn: isLight ? "#ffd98a" : "#6cd3ff",
    windowOff: isLight ? "#b9c2cf" : "#1b2436",
    leaf: isLight ? "#3f8b4e" : "#2b6b3a",
    leafLight: isLight ? "#5fa664" : "#3a8148",
    trunk: isLight ? "#6a4a2c" : "#3a2a1a",
    water: isLight ? "#6cc3f0" : "#2a6b9c",
    paving: isLight ? "#d8cdb8" : "#4a4236",
    accent: "#f5c84b"
  };
}

function shade(hex, amount) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  let r = (n >> 16) & 0xff;
  let g = (n >> 8) & 0xff;
  let b = n & 0xff;
  const cl = (v) => Math.max(0, Math.min(255, Math.round(v)));
  if (amount < 0) { const a = 1 + amount; r = cl(r*a); g = cl(g*a); b = cl(b*a); }
  else { r = cl(r + (255 - r) * amount); g = cl(g + (255 - g) * amount); b = cl(b + (255 - b) * amount); }
  return `rgb(${r},${g},${b})`;
}

// --------------------------- WEATHER & DAY/NIGHT ---------------------------

function Weather({ palette }) {
  const CYCLE = 120; // seconds per full day+night
  const { isLight } = palette;

  // Sun/moon arc over sky
  const leftX = 80, rightX = W - 80;
  const peakY = 70, horzLY = GROUND_Y - 40;
  const midX = W / 2;
  const samples = 10;
  const arcPts = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const x = leftX + (rightX - leftX) * t;
    const y = horzLY - Math.sin(Math.PI * t) * (horzLY - peakY);
    arcPts.push({ x, y });
  }
  const below = { x: midX, y: GROUND_Y + 40 };
  const sunValues = [...arcPts.map(p => `${p.x} ${p.y}`), `${below.x} ${below.y}`, `${below.x} ${below.y}`].join(";");
  const sunKt = (() => {
    const kt = [];
    for (let i = 0; i <= samples; i++) kt.push((i / samples * 0.5).toFixed(4));
    kt.push("0.55", "1");
    return kt.join(";");
  })();
  const moonValues = [`${below.x} ${below.y}`, `${below.x} ${below.y}`, ...arcPts.map(p => `${p.x} ${p.y}`)].join(";");
  const moonKt = (() => {
    const kt = ["0", "0.45"];
    for (let i = 0; i <= samples; i++) kt.push((0.5 + i / samples * 0.5).toFixed(4));
    return kt.join(";");
  })();

  // Stars
  const starSeed = [
    [80, 60], [180, 110], [280, 50], [380, 90], [480, 70],
    [580, 110], [680, 60], [780, 40], [880, 90], [920, 140], [130, 150], [400, 160]
  ];

  // Rain
  const rainDrops = [];
  const rainCount = 36;
  for (let i = 0; i < rainCount; i++) {
    const x = (i / rainCount) * W + ((i * 13) % 30);
    const y0 = -10 + ((i * 19) % 80);
    const len = 8 + ((i * 7) % 4);
    const dur = 0.7 + ((i * 3) % 5) * 0.1;
    rainDrops.push(
      <g key={`rd-${i}`}>
        <line x1={0} y1={0} x2={-2} y2={len} stroke={isLight ? "rgba(60,90,140,0.55)" : "rgba(180,210,255,0.6)"} strokeWidth={1.2} strokeLinecap="round" />
        <animateTransform
          attributeName="transform"
          type="translate"
          values={`${x} ${y0};${x - 26} ${y0 + GROUND_Y * 0.8}`}
          dur={`${dur.toFixed(2)}s`}
          repeatCount="indefinite"
        />
      </g>
    );
  }

  return (
    <g pointerEvents="none">
      {/* Stars (night) */}
      {starSeed.map(([x, y], i) => (
        <g key={`st-${i}`}>
          <circle cx={x} cy={y} r={1 + (i % 3) * 0.3} fill="#fff8d8" />
          <animate attributeName="opacity" values="0;0;0.9;0.9;0" keyTimes="0;0.5;0.6;0.95;1" dur={`${CYCLE}s`} repeatCount="indefinite" />
        </g>
      ))}
      {/* Sun */}
      <g>
        <circle r={28} fill="#fff3c2" opacity={0.32} />
        <circle r={20} fill="#fff3c2" opacity={0.5} />
        <circle r={14} fill="#ffe49a" />
        <animateTransform attributeName="transform" type="translate" values={sunValues} keyTimes={sunKt} dur={`${CYCLE}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;1;1;0;0;0" keyTimes="0;0.05;0.45;0.5;0.95;1" dur={`${CYCLE}s`} repeatCount="indefinite" />
      </g>
      {/* Moon */}
      <g>
        <circle r={24} fill="#aab6c4" opacity={0.28} />
        <circle r={14} fill="#e8edf5" />
        <circle cx={-3} cy={-2} r={2.2} fill="#b5bccb" />
        <circle cx={4}  cy={3}  r={1.6} fill="#b5bccb" />
        <circle cx={1}  cy={-5} r={1.2} fill="#b5bccb" />
        <animateTransform attributeName="transform" type="translate" values={moonValues} keyTimes={moonKt} dur={`${CYCLE}s`} repeatCount="indefinite" />
        <animate attributeName="opacity" values="0;0;0;1;1;0" keyTimes="0;0.45;0.55;0.6;0.95;1" dur={`${CYCLE}s`} repeatCount="indefinite" />
      </g>
      {/* Clouds */}
      {[
        { x: 160, y: 80, s: 1.0, dur: 220 },
        { x: 440, y: 60, s: 1.2, dur: 260 },
        { x: 760, y: 100, s: 0.9, dur: 200 }
      ].map((c, i) => (
        <g key={`cl-${i}`}>
          <g>
            <ellipse cx={0} cy={0} rx={22 * c.s} ry={9 * c.s} fill="#fff" opacity={0.9} />
            <ellipse cx={-16 * c.s} cy={4 * c.s} rx={16 * c.s} ry={7 * c.s} fill="#fff" opacity={0.9} />
            <ellipse cx={18 * c.s}  cy={3 * c.s} rx={14 * c.s} ry={6 * c.s} fill="#fff" opacity={0.9} />
          </g>
          <animateTransform attributeName="transform" type="translate" values={`${-200} ${c.y};${c.x + W + 200} ${c.y}`} dur={`${c.dur}s`} repeatCount="indefinite" />
        </g>
      ))}
      {/* Rain — periodic, 45s cycle */}
      <g>
        {rainDrops}
        <animate attributeName="opacity" values="0;0;0.75;0.75;0" keyTimes="0;0.5;0.55;0.85;1" dur="45s" repeatCount="indefinite" />
      </g>
    </g>
  );
}

// --------------------------- PEOPLE & CARS ---------------------------

const PEOPLE_COUNTS_2D = [1, 2, 4, 6, 8, 10];
const CAR_COUNTS = [0, 1, 2, 3, 4, 6];
const PERSON_COLORS = ["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a", "#5ba0e0", "#0e4080", "#d0829d", "#47a5b0"];
const CAR_COLORS = ["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a"];

function seedRand2D(seed) {
  let s = seed | 0;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function WalkingPeople({ level, districtId, palette }) {
  const lvl = Math.max(0, Math.min(5, level));
  const count = PEOPLE_COUNTS_2D[lvl];
  // Walkable x range depends on district — sidewalk/plaza areas. Extended so
  // people also appear in the letterbox area when the view is landscape-fit.
  const xMin = -700;
  const xMax = W + 700;
  const yBand = districtId === "park" ? [GROUND_Y - 6, GROUND_Y + 36] : [GROUND_Y + 10, GROUND_Y + 34];
  const people = [];
  for (let i = 0; i < count; i++) {
    const rng = seedRand2D((districtId.charCodeAt(0) * 211 + i * 4273 + lvl * 29) | 0);
    const waypoints = 3 + Math.floor(rng() * 3);
    const pts = [];
    for (let w = 0; w < waypoints; w++) {
      const x = xMin + rng() * (xMax - xMin);
      const y = yBand[0] + rng() * (yBand[1] - yBand[0]);
      pts.push({ x, y });
    }
    pts.push({ ...pts[0] });
    const dur = 14 + rng() * 20;
    const delay = -rng() * dur;
    const color = PERSON_COLORS[(i * 3 + districtId.charCodeAt(0)) % PERSON_COLORS.length];
    const values = pts.map(p => `${p.x} ${p.y}`).join(";");
    people.push(
      <g key={`p2d-${districtId}-${lvl}-${i}`}>
        <rect x={-3} y={-18} width={6} height={12} fill={color} stroke={palette.stroke} strokeWidth={0.3} />
        <circle cx={0} cy={-22} r={4} fill="#f4d3a9" stroke={palette.stroke} strokeWidth={0.3} />
        <line x1={-2} y1={-6} x2={-2} y2={0} stroke={palette.stroke} strokeWidth={1.4} />
        <line x1={2} y1={-6} x2={2} y2={0} stroke={palette.stroke} strokeWidth={1.4} />
        <animateTransform attributeName="transform" type="translate" values={values} dur={`${dur.toFixed(2)}s`} begin={`${delay.toFixed(2)}s`} repeatCount="indefinite" calcMode="linear" />
      </g>
    );
  }
  return <g pointerEvents="none">{people}</g>;
}

function DrivingCars({ level, districtId, palette }) {
  const lvl = Math.max(0, Math.min(5, level));
  const count = CAR_COUNTS[lvl];
  if (count === 0) return null;
  const cars = [];
  const roadCenterY = GROUND_Y + 55;
  // Two lanes: top lane moves right, bottom lane moves left
  const lanes = [
    { y: roadCenterY - 8, dir: 1 },
    { y: roadCenterY + 8, dir: -1 }
  ];
  for (let i = 0; i < count; i++) {
    const rng = seedRand2D((districtId.charCodeAt(0) * 313 + i * 9901 + lvl * 41) | 0);
    const lane = lanes[i % 2];
    const dur = 9 + rng() * 10;
    const delay = -rng() * dur;
    const color = CAR_COLORS[(i + districtId.charCodeAt(0)) % CAR_COLORS.length];
    const fromX = lane.dir > 0 ? -700 : W + 700;
    const toX   = lane.dir > 0 ? W + 700 : -700;
    cars.push(
      <g key={`car-${districtId}-${lvl}-${i}`} transform={`scale(${lane.dir} 1)`}>
        <g>
          <rect x={-22} y={-14} width={44} height={10} fill={color} stroke={palette.stroke} strokeWidth={0.6} rx={3} />
          <rect x={-14} y={-22} width={28} height={10} fill={shade(color, -0.15)} stroke={palette.stroke} strokeWidth={0.6} rx={3} />
          <rect x={-12} y={-20} width={10} height={6} fill="#a7d8ff" />
          <rect x={2} y={-20} width={10} height={6} fill="#a7d8ff" />
          <circle cx={-12} cy={-3} r={4} fill={palette.stroke} />
          <circle cx={12} cy={-3} r={4} fill={palette.stroke} />
          {/* Headlights */}
          <circle cx={21} cy={-9} r={1.8} fill="#fff4c8" />
          <animateTransform attributeName="transform" type="translate"
            values={`${fromX} ${lane.y};${toX} ${lane.y}`}
            dur={`${dur.toFixed(2)}s`}
            begin={`${delay.toFixed(2)}s`}
            repeatCount="indefinite" />
        </g>
      </g>
    );
  }
  return <g pointerEvents="none">{cars}</g>;
}

// --------------------------- extended-side primitives ---------------------

function Haybale({ x, y, palette }) {
  return (
    <g>
      <ellipse cx={x} cy={y - 14} rx={22} ry={14} fill="#d6b877" stroke={palette.stroke} strokeWidth={0.6} />
      <line x1={x - 20} y1={y - 10} x2={x + 20} y2={y - 10} stroke={palette.stroke} strokeWidth={0.4} />
      <line x1={x - 20} y1={y - 18} x2={x + 20} y2={y - 18} stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function ConstructionFence({ x, y, w = 120, palette }) {
  return (
    <g>
      <rect x={x} y={y - 40} width={w} height={40} fill="#c97c3c" stroke={palette.stroke} strokeWidth={0.6} />
      {Array.from({ length: Math.floor(w / 20) }).map((_, i) => (
        <line key={i} x1={x + 4 + i * 20} y1={y - 40} x2={x + 4 + i * 20} y2={y} stroke="#8a5422" strokeWidth={0.5} />
      ))}
    </g>
  );
}

function BusStop({ x, y, palette }) {
  return (
    <g>
      <rect x={x} y={y - 50} width={60} height={50} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.8} />
      <rect x={x + 4} y={y - 46} width={52} height={28} fill="#a7d8ff" stroke={palette.stroke} strokeWidth={0.4} />
      <line x1={x + 30} y1={y - 18} x2={x + 30} y2={y} stroke={palette.stroke} strokeWidth={2} />
      <rect x={x + 20} y={y - 62} width={20} height={10} fill="#2d7fd4" stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function FoodTruck({ x, y, color = "#e14b5a", palette }) {
  return (
    <g>
      <rect x={x} y={y - 44} width={90} height={44} fill={color} stroke={palette.stroke} strokeWidth={0.7} rx={3} />
      <rect x={x + 10} y={y - 38} width={70} height={12} fill="#111" />
      <rect x={x + 14} y={y - 25} width={62} height={14} fill={shade(color, -0.18)} />
      <circle cx={x + 18} cy={y} r={6} fill={palette.stroke} />
      <circle cx={x + 72} cy={y} r={6} fill={palette.stroke} />
      <rect x={x + 18} y={y - 52} width={54} height={8} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function BillboardSign({ x, y, w = 90, h = 60, text = "AD", palette, color = "#111" }) {
  return (
    <g>
      <line x1={x + 10} y1={y} x2={x + 10} y2={y - h - 20} stroke={palette.stroke} strokeWidth={2} />
      <line x1={x + w - 10} y1={y} x2={x + w - 10} y2={y - h - 20} stroke={palette.stroke} strokeWidth={2} />
      <rect x={x} y={y - h - 20} width={w} height={h} fill={color} stroke={palette.stroke} strokeWidth={0.8} />
      <text x={x + w / 2} y={y - h / 2 - 10} textAnchor="middle" fontSize={18} fontWeight={900} fill="#f5c84b">{text}</text>
    </g>
  );
}

function MarketStall({ x, y, color = "#e14b5a", palette }) {
  return (
    <g>
      <rect x={x} y={y - 40} width={70} height={28} fill="#a88260" stroke={palette.stroke} strokeWidth={0.6} />
      <polygon points={`${x - 4},${y - 40} ${x + 74},${y - 40} ${x + 70},${y - 58} ${x},${y - 58}`} fill={color} stroke={palette.stroke} strokeWidth={0.6} />
      <line x1={x - 4} y1={y - 40} x2={x + 74} y2={y - 40} stroke={palette.stroke} strokeWidth={0.4} strokeDasharray="3 3" />
      {/* goods */}
      <circle cx={x + 20} cy={y - 30} r={5} fill="#e14b5a" />
      <circle cx={x + 35} cy={y - 30} r={5} fill="#f5c84b" />
      <circle cx={x + 50} cy={y - 30} r={5} fill="#4fa85e" />
    </g>
  );
}

function ChickenCoop({ x, y, palette }) {
  return (
    <g>
      <rect x={x} y={y - 30} width={50} height={30} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.6} />
      <polygon points={`${x - 4},${y - 30} ${x + 54},${y - 30} ${x + 25},${y - 50}`} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.6} />
      <circle cx={x + 10} cy={y - 4} r={4} fill="#fff" stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={x + 22} cy={y - 4} r={4} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function Cart({ x, y, palette }) {
  return (
    <g>
      <rect x={x} y={y - 26} width={70} height={18} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.5} />
      <circle cx={x + 12} cy={y - 4} r={8} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={x + 58} cy={y - 4} r={8} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.4} />
      <line x1={x + 70} y1={y - 22} x2={x + 100} y2={y - 16} stroke={palette.stroke} strokeWidth={1.2} />
    </g>
  );
}

function Rabbit({ x, y, palette }) {
  return (
    <g>
      <ellipse cx={x} cy={y - 5} rx={6} ry={4} fill="#d8d0c0" stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={x + 5} cy={y - 8} r={3} fill="#d8d0c0" stroke={palette.stroke} strokeWidth={0.4} />
      <line x1={x + 5} y1={y - 11} x2={x + 5} y2={y - 14} stroke={palette.stroke} strokeWidth={0.7} />
      <line x1={x + 7} y1={y - 11} x2={x + 8} y2={y - 14} stroke={palette.stroke} strokeWidth={0.7} />
    </g>
  );
}

function Carriage({ x, y, palette }) {
  return (
    <g>
      {/* Horse */}
      <rect x={x} y={y - 22} width={26} height={12} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.5} />
      <rect x={x + 22} y={y - 28} width={10} height={12} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.5} />
      <line x1={x + 2} y1={y - 10} x2={x + 2} y2={y} stroke={palette.stroke} strokeWidth={1.2} />
      <line x1={x + 24} y1={y - 10} x2={x + 24} y2={y} stroke={palette.stroke} strokeWidth={1.2} />
      {/* Carriage body */}
      <rect x={x - 38} y={y - 30} width={36} height={20} fill="#8a1e2c" stroke={palette.stroke} strokeWidth={0.5} />
      <polygon points={`${x - 40},${y - 30} ${x},${y - 30} ${x - 4},${y - 40} ${x - 36},${y - 40}`} fill="#5a1420" stroke={palette.stroke} strokeWidth={0.5} />
      <circle cx={x - 28} cy={y - 4} r={7} fill="#2a1a10" stroke={palette.stroke} strokeWidth={0.5} />
      <circle cx={x - 10} cy={y - 4} r={7} fill="#2a1a10" stroke={palette.stroke} strokeWidth={0.5} />
    </g>
  );
}

function DoubleDeckerBus({ x, y, palette }) {
  return (
    <g>
      <rect x={x} y={y - 56} width={120} height={48} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.7} rx={4} />
      {/* upper windows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={`uw-${i}`} x={x + 8 + i * 22} y={y - 52} width={16} height={12} fill="#a7d8ff" stroke={palette.stroke} strokeWidth={0.3} />
      ))}
      {/* lower windows */}
      {[0, 1, 2, 3, 4].map((i) => (
        <rect key={`lw-${i}`} x={x + 8 + i * 22} y={y - 32} width={16} height={12} fill="#a7d8ff" stroke={palette.stroke} strokeWidth={0.3} />
      ))}
      <circle cx={x + 22} cy={y} r={7} fill={palette.stroke} />
      <circle cx={x + 98} cy={y} r={7} fill={palette.stroke} />
    </g>
  );
}

function HotDogCart({ x, y, palette }) {
  return (
    <g>
      <rect x={x} y={y - 30} width={54} height={20} fill="#d9d9d9" stroke={palette.stroke} strokeWidth={0.5} />
      <polygon points={`${x - 4},${y - 30} ${x + 58},${y - 30} ${x + 54},${y - 46} ${x},${y - 46}`} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.5} />
      <circle cx={x + 10} cy={y - 4} r={6} fill={palette.stroke} />
      <circle cx={x + 44} cy={y - 4} r={6} fill={palette.stroke} />
      <rect x={x + 14} y={y - 40} width={26} height={4} fill="#f5c84b" />
    </g>
  );
}

function SmallBuilding({ x, w, h, color, palette, windows = true }) {
  return <Building x={x} baseY={GROUND_Y} w={w} h={h} palette={palette} roofColor={color} windows={windows} door />;
}

function Obelisk({ x, y, h = 120, palette }) {
  return (
    <g>
      <rect x={x - 16} y={y - h} width={32} height={h} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.7} />
      <polygon points={`${x - 16},${y - h} ${x + 16},${y - h} ${x},${y - h - 22}`} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.7} />
    </g>
  );
}

function SubwayEntrance({ x, y, palette }) {
  return (
    <g>
      <rect x={x} y={y - 32} width={60} height={32} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.6} />
      <rect x={x + 6} y={y - 28} width={48} height={20} fill="#1a1a1a" />
      <text x={x + 30} y={y - 13} textAnchor="middle" fontSize={16} fontWeight={900} fill="#e14b5a">M</text>
      {[0, 1, 2, 3].map((i) => (
        <line key={`sr-${i}`} x1={x + 8 + i * 14} y1={y - 7} x2={x + 12 + i * 14} y2={y} stroke={palette.stroke} strokeWidth={0.6} />
      ))}
    </g>
  );
}

function SkyAndGround({ palette, hasRoad = true }) {
  // Sky & grass rects extend far outside the viewBox so letterbox areas in
  // portrait or landscape containers stay filled with the scene background
  // instead of the empty shell color.
  const OVERFLOW = 800;
  return (
    <g>
      <defs>
        {/* Sky gradient animates with the 120s day/night cycle so night sky
            transitions to day when the sun is up, and back to night for the
            moon phase. */}
        <linearGradient id="district-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0b1530">
            <animate attributeName="stop-color"
              values="#0b1530;#4a4a70;#b4d7ff;#5a4270;#0b1530;#0b1530"
              keyTimes="0;0.1;0.25;0.4;0.5;1"
              dur="120s" repeatCount="indefinite" />
          </stop>
          <stop offset="60%" stopColor="#2a2348">
            <animate attributeName="stop-color"
              values="#2a2348;#d87555;#ffe7c7;#c97c5a;#2a2348;#2a2348"
              keyTimes="0;0.1;0.25;0.4;0.5;1"
              dur="120s" repeatCount="indefinite" />
          </stop>
          <stop offset="100%" stopColor="#1a1f3a">
            <animate attributeName="stop-color"
              values="#1a1f3a;#b86540;#ffd68a;#a04d33;#1a1f3a;#1a1f3a"
              keyTimes="0;0.1;0.25;0.4;0.5;1"
              dur="120s" repeatCount="indefinite" />
          </stop>
        </linearGradient>
      </defs>
      <rect
        x={-OVERFLOW}
        y={-OVERFLOW}
        width={W + OVERFLOW * 2}
        height={GROUND_Y + OVERFLOW}
        fill="url(#district-sky)"
      />
      {/* Distant hills silhouette */}
      <path
        d={`M ${-OVERFLOW} ${GROUND_Y - 70} Q 120 ${GROUND_Y - 110} 220 ${GROUND_Y - 85} T 460 ${GROUND_Y - 95} T 720 ${GROUND_Y - 80} T ${W} ${GROUND_Y - 90} L ${W + OVERFLOW} ${GROUND_Y - 90} L ${W + OVERFLOW} ${GROUND_Y} L ${-OVERFLOW} ${GROUND_Y} Z`}
        fill={palette.isLight ? "#97a996" : "#1b2533"}
        opacity={0.6}
      />
      <rect
        x={-OVERFLOW}
        y={GROUND_Y}
        width={W + OVERFLOW * 2}
        height={H - GROUND_Y + OVERFLOW}
        fill={palette.ground}
      />
      {hasRoad && (
        <>
          <rect x={-OVERFLOW} y={GROUND_Y + 40} width={W + OVERFLOW * 2} height={30} fill={palette.road} />
          {Array.from({ length: 40 }).map((_, i) => (
            <rect key={i} x={-OVERFLOW + 40 + i * 80} y={GROUND_Y + 53} width={30} height={4} fill={palette.roadLine} />
          ))}
        </>
      )}
    </g>
  );
}

function Building({ x, baseY, w, h, palette, roofColor = "#6b8cb8", windows = true, winCols = null, winRows = null, accent, door = false }) {
  const cols = winCols || Math.max(1, Math.floor(w / 18));
  const rows = winRows || Math.max(1, Math.floor(h / 22));
  return (
    <g>
      <rect x={x} y={baseY - h} width={w} height={h} fill={roofColor} stroke={palette.stroke} strokeWidth={1} />
      {windows && Array.from({ length: rows }).map((_, r) =>
        Array.from({ length: cols }).map((__, c) => (
          <rect
            key={`${r}-${c}`}
            x={x + 6 + c * ((w - 12) / Math.max(1, cols - 1) || (w - 12) / cols)}
            y={baseY - h + 10 + r * ((h - 20) / Math.max(1, rows - 1) || (h - 20) / rows)}
            width={Math.min(12, (w - 12) / cols * 0.6)}
            height={Math.min(14, (h - 20) / rows * 0.55)}
            fill={(r + c) % 3 === 0 ? palette.windowOn : palette.windowOff}
            stroke={palette.stroke}
            strokeWidth={0.3}
          />
        ))
      )}
      {door && (
        <rect x={x + w/2 - 6} y={baseY - 18} width={12} height={18} fill="#4a2d1a" stroke={palette.stroke} strokeWidth={0.6} />
      )}
      {accent && (
        <rect x={x + w / 2 - 3} y={baseY - h - 14} width={6} height={14} fill={accent} />
      )}
    </g>
  );
}

function PitchedHouse({ x, baseY, w, h, palette, wallColor = "#c9a56b", roofColor = "#6a3f24", door = true }) {
  return (
    <g>
      <rect x={x} y={baseY - h} width={w} height={h} fill={wallColor} stroke={palette.stroke} strokeWidth={0.8} />
      {/* windows */}
      <rect x={x + 6} y={baseY - h + 10} width={w / 2 - 10} height={h / 2} fill={palette.windowOn} stroke={palette.stroke} strokeWidth={0.4} />
      <rect x={x + w / 2 + 4} y={baseY - h + 10} width={w / 2 - 10} height={h / 2} fill={palette.windowOn} stroke={palette.stroke} strokeWidth={0.4} />
      {/* roof — pitched triangle */}
      <polygon points={`${x - 4},${baseY - h} ${x + w + 4},${baseY - h} ${x + w / 2},${baseY - h - h * 0.55}`} fill={roofColor} stroke={palette.stroke} strokeWidth={0.8} />
      {/* chimney */}
      <rect x={x + w * 0.7} y={baseY - h - h * 0.35} width={7} height={h * 0.3} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.4} />
      {door && (
        <rect x={x + w / 2 - 7} y={baseY - 20} width={14} height={20} fill="#4a2d1a" stroke={palette.stroke} strokeWidth={0.5} />
      )}
    </g>
  );
}

function Tree({ x, y, size = 1, palette }) {
  const s = size;
  return (
    <g>
      <rect x={x - 3 * s} y={y - 18 * s} width={6 * s} height={18 * s} fill={palette.trunk} />
      <circle cx={x}          cy={y - 30 * s} r={16 * s} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.5} />
      <circle cx={x - 10 * s} cy={y - 22 * s} r={11 * s} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.5} />
      <circle cx={x + 10 * s} cy={y - 22 * s} r={11 * s} fill={palette.leafLight} stroke={palette.stroke} strokeWidth={0.5} />
    </g>
  );
}

function Bush({ x, y, size = 1, palette }) {
  const s = size;
  return (
    <g>
      <circle cx={x}          cy={y - 6 * s} r={7 * s}  fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={x + 6 * s}  cy={y - 5 * s} r={5 * s}  fill={palette.leafLight} stroke={palette.stroke} strokeWidth={0.4} />
      <circle cx={x - 6 * s}  cy={y - 5 * s} r={5 * s}  fill={palette.leafLight} stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function Flower({ x, y, color, palette }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 10} stroke={palette.leaf} strokeWidth={1.4} />
      <circle cx={x} cy={y - 10} r={3.2} fill={color} stroke={palette.stroke} strokeWidth={0.4} />
    </g>
  );
}

function Lamp({ x, y, palette }) {
  return (
    <g>
      <line x1={x} y1={y} x2={x} y2={y - 30} stroke={palette.stroke} strokeWidth={1.6} />
      <circle cx={x} cy={y - 32} r={5} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.5} />
    </g>
  );
}

function Bench({ x, y, palette }) {
  return (
    <g>
      <rect x={x - 14} y={y - 10} width={28} height={4} fill="#8b6a3a" stroke={palette.stroke} strokeWidth={0.4} />
      <rect x={x - 14} y={y - 16} width={28} height={4} fill="#8b6a3a" stroke={palette.stroke} strokeWidth={0.4} />
      <rect x={x - 13} y={y - 6}  width={2}  height={6} fill={palette.stroke} />
      <rect x={x + 11} y={y - 6}  width={2}  height={6} fill={palette.stroke} />
    </g>
  );
}

function Car({ x, y, color = "#5ba0e0", palette }) {
  return (
    <g>
      <rect x={x - 22} y={y - 14} width={44} height={10} fill={color} stroke={palette.stroke} strokeWidth={0.6} rx={3} />
      <rect x={x - 14} y={y - 22} width={28} height={10} fill={shade(color, -0.15)} stroke={palette.stroke} strokeWidth={0.6} rx={3} />
      <rect x={x - 12} y={y - 20} width={10} height={6} fill="#a7d8ff" />
      <rect x={x + 2}  y={y - 20} width={10} height={6} fill="#a7d8ff" />
      <circle cx={x - 12} cy={y - 3} r={4} fill={palette.stroke} />
      <circle cx={x + 12} cy={y - 3} r={4} fill={palette.stroke} />
    </g>
  );
}

function PersonSilhouette({ x, y, color = "#e14b5a", palette }) {
  return (
    <g>
      <circle cx={x} cy={y - 22} r={4} fill="#f4d3a9" stroke={palette.stroke} strokeWidth={0.4} />
      <rect x={x - 3} y={y - 18} width={6} height={12} fill={color} stroke={palette.stroke} strokeWidth={0.4} />
      <line x1={x - 2} y1={y - 6} x2={x - 2} y2={y} stroke={palette.stroke} strokeWidth={1.6} />
      <line x1={x + 2} y1={y - 6} x2={x + 2} y2={y} stroke={palette.stroke} strokeWidth={1.6} />
    </g>
  );
}

function Fence({ x1, x2, y, palette }) {
  const posts = [];
  const n = Math.max(3, Math.floor((x2 - x1) / 14));
  for (let i = 0; i <= n; i++) {
    const x = x1 + (i / n) * (x2 - x1);
    posts.push(<line key={i} x1={x} y1={y} x2={x} y2={y - 12} stroke="#8a6a3a" strokeWidth={1.4} />);
  }
  posts.push(<line key="rail" x1={x1} y1={y - 9} x2={x2} y2={y - 9} stroke="#8a6a3a" strokeWidth={1.4} />);
  return <g>{posts}</g>;
}

// Rectangular sign with a recognizable brand-style logo. 6 variants; pick by
// `variant` index. Each logo fits inside (x, y, w, h).
function CompanyLogo({ x, y, w, h, variant = 0, palette }) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const pad = 6;
  const iw = w - pad * 2;
  const ih = h - pad * 2;
  // Background sign
  const bg = (
    <>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke={palette.stroke} strokeWidth={0.8} rx={4} />
    </>
  );
  let inner = null;
  if (variant === 0) {
    // "MSQ" – four-square grid (Microsoft-style)
    inner = (
      <g>
        <rect x={x + pad}           y={y + pad}           width={iw / 2 - 2} height={ih / 2 - 2} fill="#f05022" />
        <rect x={x + pad + iw / 2 + 2} y={y + pad}        width={iw / 2 - 2} height={ih / 2 - 2} fill="#7fba00" />
        <rect x={x + pad}           y={y + pad + ih / 2 + 2} width={iw / 2 - 2} height={ih / 2 - 2} fill="#00a4ef" />
        <rect x={x + pad + iw / 2 + 2} y={y + pad + ih / 2 + 2} width={iw / 2 - 2} height={ih / 2 - 2} fill="#ffb900" />
      </g>
    );
  } else if (variant === 1) {
    // "GGL" – multi-color "G" (Google-style)
    const r = Math.min(iw, ih) / 2 - 3;
    inner = (
      <g>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4285f4" strokeWidth={r * 0.5} />
        <path d={`M ${cx + r * 0.95} ${cy - r * 0.4} A ${r} ${r} 0 0 1 ${cx + r * 0.95} ${cy + r * 0.4}`} fill="none" stroke="#34a853" strokeWidth={r * 0.5} />
        <path d={`M ${cx + r * 0.95} ${cy + r * 0.4} A ${r} ${r} 0 0 1 ${cx - r * 0.4} ${cy + r * 0.95}`} fill="none" stroke="#fbbc05" strokeWidth={r * 0.5} />
        <path d={`M ${cx + r * 0.95} ${cy - r * 0.4} A ${r} ${r} 0 0 0 ${cx - r * 0.4} ${cy - r * 0.95}`} fill="none" stroke="#ea4335" strokeWidth={r * 0.5} />
        <rect x={cx} y={cy - 2} width={r + 2} height={4} fill="#4285f4" />
      </g>
    );
  } else if (variant === 2) {
    // Apple-ish silhouette
    const s = Math.min(iw, ih) * 0.7;
    inner = (
      <g transform={`translate(${cx - s / 2} ${cy - s / 2})`}>
        <circle cx={s * 0.5} cy={s * 0.55} r={s * 0.38} fill="#a6a6a6" />
        <circle cx={s * 0.7} cy={s * 0.4} r={s * 0.2} fill="#fff" />
        <ellipse cx={s * 0.6} cy={s * 0.18} rx={s * 0.06} ry={s * 0.12} fill="#4a7a2a" transform={`rotate(35 ${s * 0.6} ${s * 0.18})`} />
      </g>
    );
  } else if (variant === 3) {
    // Amazon-style: "a" with smile arrow
    inner = (
      <g>
        <text x={cx} y={cy + 2} textAnchor="middle" fontSize={ih * 0.7} fontWeight={900} fill="#232f3e" style={{ fontFamily: "serif" }}>a</text>
        <path d={`M ${x + pad + 2} ${cy + ih * 0.3} Q ${cx} ${cy + ih * 0.45} ${x + w - pad - 2} ${cy + ih * 0.3}`} fill="none" stroke="#ff9900" strokeWidth={ih * 0.1} strokeLinecap="round" />
        <polygon points={`${x + w - pad - 4},${cy + ih * 0.25} ${x + w - pad - 2},${cy + ih * 0.3} ${x + w - pad - 8},${cy + ih * 0.35}`} fill="#ff9900" />
      </g>
    );
  } else if (variant === 4) {
    // Meta-ish infinity
    const s = Math.min(iw, ih);
    inner = (
      <g transform={`translate(${cx} ${cy})`}>
        <path d={`M ${-s * 0.45} 0 C ${-s * 0.45} ${-s * 0.3} ${-s * 0.15} ${-s * 0.3} 0 0 C ${s * 0.15} ${s * 0.3} ${s * 0.45} ${s * 0.3} ${s * 0.45} 0 C ${s * 0.45} ${-s * 0.3} ${s * 0.15} ${-s * 0.3} 0 0 C ${-s * 0.15} ${s * 0.3} ${-s * 0.45} ${s * 0.3} ${-s * 0.45} 0 Z`} fill="none" stroke="#1877f2" strokeWidth={s * 0.14} strokeLinejoin="round" />
      </g>
    );
  } else if (variant === 5) {
    // Stylized red "N" (Netflix-like)
    inner = (
      <g>
        <rect x={x + pad + iw * 0.12} y={y + pad} width={iw * 0.18} height={ih} fill="#e50914" />
        <rect x={x + pad + iw * 0.7} y={y + pad} width={iw * 0.18} height={ih} fill="#e50914" />
        <polygon points={`${x + pad + iw * 0.3},${y + pad} ${x + pad + iw * 0.7},${y + pad + ih} ${x + pad + iw * 0.7},${y + pad + ih * 0.6} ${x + pad + iw * 0.3},${y + pad + ih * 0.4}`} fill="#e50914" />
      </g>
    );
  }
  return <g>{bg}{inner}</g>;
}

function LEDPanel({ x, y, w, h, palette }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#111" stroke={palette.stroke} strokeWidth={0.6} />
      <rect x={x + 4} y={y + 4}     width={w / 2 - 6} height={h / 2 - 6} fill="#e14b5a" />
      <rect x={x + w / 2 + 2} y={y + 4} width={w / 2 - 6} height={h / 2 - 6} fill="#f5c84b" />
      <rect x={x + 4} y={y + h / 2 + 2} width={w / 2 - 6} height={h / 2 - 6} fill="#4fa85e" />
      <rect x={x + w / 2 + 2} y={y + h / 2 + 2} width={w / 2 - 6} height={h / 2 - 6} fill="#2d7fd4" />
    </g>
  );
}

function Cloud({ x, y, s = 1, palette }) {
  return (
    <g opacity={0.85}>
      <ellipse cx={x}           cy={y}       rx={22 * s} ry={9 * s}  fill="#fff" />
      <ellipse cx={x - 16 * s}  cy={y + 4 * s} rx={16 * s} ry={7 * s}  fill="#fff" />
      <ellipse cx={x + 18 * s}  cy={y + 3 * s} rx={14 * s} ry={6 * s}  fill="#fff" />
    </g>
  );
}

// --------------------------- SPORT ---------------------------

function SportDistrict({ level, palette }) {
  const n = [];
  const lvl = Math.max(0, Math.min(5, level));

  // Ground dirt patch shared through levels 0-1
  if (lvl <= 1) {
    n.push(<ellipse key="dirt" cx={500} cy={GROUND_Y - 5} rx={380} ry={28} fill={palette.dirt} stroke={palette.stroke} />);
  } else {
    // Stadium bowl outline (oval pitch)
    n.push(<ellipse key="pitch-outer" cx={500} cy={GROUND_Y - 20} rx={360} ry={50} fill={palette.leaf} stroke={palette.stroke} />);
    n.push(<ellipse key="pitch-inner" cx={500} cy={GROUND_Y - 20} rx={330} ry={42} fill={shade(palette.leaf, -0.08)} />);
    // markings
    n.push(<line key="ml" x1={500} y1={GROUND_Y - 68} x2={500} y2={GROUND_Y + 28} stroke="#fff" strokeWidth={1} />);
    n.push(<ellipse key="cc" cx={500} cy={GROUND_Y - 20} rx={32} ry={10} fill="none" stroke="#fff" strokeWidth={1} />);
  }

  if (lvl === 0) {
    // 2 goal posts + ball
    n.push(<g key="gp1"><line x1={230} y1={GROUND_Y} x2={230} y2={GROUND_Y - 50} stroke="#eee" strokeWidth={3} /><line x1={280} y1={GROUND_Y} x2={280} y2={GROUND_Y - 50} stroke="#eee" strokeWidth={3} /><line x1={230} y1={GROUND_Y - 50} x2={280} y2={GROUND_Y - 50} stroke="#eee" strokeWidth={3} /></g>);
    n.push(<g key="gp2"><line x1={720} y1={GROUND_Y} x2={720} y2={GROUND_Y - 50} stroke="#eee" strokeWidth={3} /><line x1={770} y1={GROUND_Y} x2={770} y2={GROUND_Y - 50} stroke="#eee" strokeWidth={3} /><line x1={720} y1={GROUND_Y - 50} x2={770} y2={GROUND_Y - 50} stroke="#eee" strokeWidth={3} /></g>);
    n.push(<circle key="ball" cx={500} cy={GROUND_Y - 6} r={7} fill="#fff" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<Fence key="fc" x1={40} x2={960} y={GROUND_Y - 25} palette={palette} />);
    // grass tufts
    for (let i = 0; i < 10; i++) n.push(<line key={`gt-${i}`} x1={80 + i * 85} y1={GROUND_Y - 2} x2={80 + i * 85 + 4} y2={GROUND_Y - 8} stroke={palette.leaf} strokeWidth={1.2} />);
  }

  if (lvl >= 1) {
    // Corner flags
    [120, 880].forEach((x, i) => {
      n.push(<line key={`cf-l-${i}`} x1={x} y1={GROUND_Y - 20} x2={x} y2={GROUND_Y - 50} stroke={palette.stroke} strokeWidth={1.4} />);
      n.push(<polygon key={`cf-${i}`} points={`${x},${GROUND_Y - 50} ${x + 12},${GROUND_Y - 45} ${x},${GROUND_Y - 40}`} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.5} />);
    });
    // Small wooden stand on south side
    n.push(<Building x={400} baseY={GROUND_Y + 40} w={200} h={22} palette={palette} roofColor="#9c7040" winCols={4} winRows={1} windows={false} />);
    // Changing booth
    n.push(<PitchedHouse x={80} baseY={GROUND_Y + 40} w={90} h={40} palette={palette} wallColor="#8a4b2b" roofColor="#6a3f24" />);
    // Goal posts (proper)
    n.push(<g key="gp-l"><line x1={220} y1={GROUND_Y - 22} x2={220} y2={GROUND_Y - 68} stroke="#eee" strokeWidth={3} /><line x1={260} y1={GROUND_Y - 22} x2={260} y2={GROUND_Y - 68} stroke="#eee" strokeWidth={3} /><line x1={220} y1={GROUND_Y - 68} x2={260} y2={GROUND_Y - 68} stroke="#eee" strokeWidth={3} /></g>);
    n.push(<g key="gp-r"><line x1={740} y1={GROUND_Y - 22} x2={740} y2={GROUND_Y - 68} stroke="#eee" strokeWidth={3} /><line x1={780} y1={GROUND_Y - 22} x2={780} y2={GROUND_Y - 68} stroke="#eee" strokeWidth={3} /><line x1={740} y1={GROUND_Y - 68} x2={780} y2={GROUND_Y - 68} stroke="#eee" strokeWidth={3} /></g>);
    // People
    n.push(<PersonSilhouette key="p1" x={500} y={GROUND_Y - 15} color="#e14b5a" palette={palette} />);
    n.push(<PersonSilhouette key="p2" x={470} y={GROUND_Y - 15} color="#2d7fd4" palette={palette} />);
  }

  if (lvl >= 2) {
    // Stands on both sides
    n.push(<Building x={40}  baseY={GROUND_Y + 40} w={160} h={46} palette={palette} roofColor="#c0a78f" winCols={4} winRows={2} />);
    n.push(<Building x={800} baseY={GROUND_Y + 40} w={160} h={46} palette={palette} roofColor="#c0a78f" winCols={4} winRows={2} />);
    // Running track (brown oval stroke)
    n.push(<ellipse key="track" cx={500} cy={GROUND_Y - 20} rx={370} ry={56} fill="none" stroke="#c2a878" strokeWidth={8} />);
    // Scoreboard
    n.push(<rect key="sb" x={440} y={90} width={120} height={44} fill="#111" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<text key="sbt" x={500} y={118} textAnchor="middle" fontSize={20} fontWeight={800} fill="#f5c84b">3 : 2</text>);
    n.push(<line key="sbp" x1={500} y1={134} x2={500} y2={GROUND_Y - 75} stroke={palette.stroke} strokeWidth={2} />);
  }

  if (lvl >= 3) {
    // Full enclosed stadium
    n.push(<Building x={40} baseY={GROUND_Y + 40} w={200} h={80} palette={palette} roofColor="#e14b5a" winCols={5} winRows={3} />);
    n.push(<Building x={760} baseY={GROUND_Y + 40} w={200} h={80} palette={palette} roofColor="#e14b5a" winCols={5} winRows={3} />);
    // Light masts
    [150, 850, 450, 550].forEach((x, i) => {
      n.push(<line key={`lm-${i}`} x1={x} y1={GROUND_Y - 80} x2={x} y2={80} stroke={palette.stroke} strokeWidth={2} />);
      n.push(<rect key={`lh-${i}`} x={x - 14} y={78} width={28} height={8} fill="#f5f3c8" stroke={palette.stroke} strokeWidth={0.5} />);
    });
    // Basketball court
    n.push(<rect key="bc" x={260} y={GROUND_Y + 80} width={140} height={60} fill="#b46a3b" stroke="#fff" strokeWidth={1} />);
    n.push(<line key="bc-m" x1={330} y1={GROUND_Y + 80} x2={330} y2={GROUND_Y + 140} stroke="#fff" strokeWidth={1} />);
    // Ticket booth
    n.push(<Building x={620} baseY={GROUND_Y + 140} w={80} h={48} palette={palette} roofColor="#f5c84b" winCols={2} winRows={1} door />);
    // Crowd dots
    for (let i = 0; i < 20; i++) n.push(<circle key={`cr-${i}`} cx={80 + (i % 10) * 80} cy={GROUND_Y - 10 - ((i / 10 | 0) * 6)} r={2.5} fill={["#e14b5a", "#2d7fd4", "#f5c84b", "#4fa85e"][i % 4]} />);
  }

  if (lvl >= 4) {
    // Tennis court right
    n.push(<rect key="tc" x={800} y={GROUND_Y + 90} width={140} height={70} fill="#3f7a3f" stroke="#fff" strokeWidth={1} />);
    n.push(<line key="tc-n" x1={870} y1={GROUND_Y + 90} x2={870} y2={GROUND_Y + 160} stroke="#fff" strokeWidth={1} />);
    // Pool
    n.push(<rect key="pl" x={60} y={GROUND_Y + 90} width={180} height={70} fill={palette.water} stroke={palette.stroke} strokeWidth={1} rx={6} />);
    [0, 1, 2].forEach(k => n.push(<rect key={`pl-l-${k}`} x={60} y={GROUND_Y + 110 + k * 18} width={180} height={1.5} fill="#fff" opacity={0.6} />));
    // Parking cars
    [300, 360, 420, 540, 600, 660].forEach((x, i) => n.push(<Car key={`pc-${i}`} x={x} y={GROUND_Y + 150} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a"][i]} palette={palette} />));
  }

  if (lvl >= 5) {
    // Giant dome
    n.push(<path key="dm" d={`M 140 ${GROUND_Y + 20} Q 500 ${GROUND_Y - 250} 860 ${GROUND_Y + 20} Z`} fill="#c9d0da" stroke={palette.stroke} strokeWidth={1.5} />);
    // Dome panels
    for (let i = 0; i < 6; i++) {
      n.push(<line key={`dp-${i}`} x1={200 + i * 120} y1={GROUND_Y + 20} x2={500} y2={GROUND_Y - 250} stroke={shade("#c9d0da", -0.18)} strokeWidth={0.8} opacity={0.7} />);
    }
    n.push(<ellipse key="dtop" cx={500} cy={GROUND_Y - 238} rx={40} ry={10} fill={shade("#c9d0da", -0.12)} stroke={palette.stroke} strokeWidth={0.8} />);
    // Giant LED above entrance
    n.push(<LEDPanel key="led" x={380} y={80} w={240} h={80} palette={palette} />);
    // Monorail
    n.push(<line key="mr1" x1={0}    y1={GROUND_Y - 100} x2={1000} y2={GROUND_Y - 100} stroke="#aab6c4" strokeWidth={5} />);
    n.push(<line key="mr2" x1={0}    y1={GROUND_Y - 95}  x2={1000} y2={GROUND_Y - 95}  stroke={palette.stroke} strokeWidth={1} />);
    n.push(<rect key="mc" x={560} y={GROUND_Y - 112} width={90} height={20} fill="#f5c84b" stroke={palette.stroke} strokeWidth={1} rx={3} />);
    n.push(<rect key="mc-w" x={570} y={GROUND_Y - 108} width={72} height={8} fill="#a7d8ff" />);
    // Pylon supports
    [150, 500, 850].forEach((x, i) => n.push(<line key={`py-${i}`} x1={x} y1={GROUND_Y - 95} x2={x} y2={GROUND_Y} stroke="#6a7280" strokeWidth={3} />));
    // Crowds
    for (let i = 0; i < 40; i++) n.push(<PersonSilhouette key={`mpr-${i}`} x={60 + (i % 20) * 45} y={GROUND_Y + 36} color={["#e14b5a", "#2d7fd4", "#f5c84b", "#4fa85e", "#b57cd0"][i % 5]} palette={palette} />);
  }

  return n;
}

// --------------------------- BUSINESS ---------------------------

function BusinessDistrict({ level, palette }) {
  const n = [];
  const lvl = Math.max(0, Math.min(5, level));

  if (lvl === 0) {
    n.push(<rect key="lot" x={0} y={GROUND_Y} width={W} height={40} fill={palette.dirt} />);
    // small kiosk
    n.push(<Building x={470} baseY={GROUND_Y} w={60} h={40} palette={palette} roofColor={palette.accent} winCols={1} winRows={1} door />);
    n.push(<Lamp x={300} y={GROUND_Y} palette={palette} />);
    n.push(<Lamp x={700} y={GROUND_Y} palette={palette} />);
    // For Sale sign
    n.push(<line key="fs-p" x1={200} y1={GROUND_Y} x2={200} y2={GROUND_Y - 40} stroke={palette.stroke} strokeWidth={2} />);
    n.push(<rect key="fs-b" x={170} y={GROUND_Y - 60} width={60} height={22} fill="#fff" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<text key="fs-t" x={200} y={GROUND_Y - 44} textAnchor="middle" fontSize={10} fontWeight={700} fill={palette.stroke}>FOR SALE</text>);
  }

  if (lvl >= 1) {
    // Small shops
    n.push(<Building x={40}  baseY={GROUND_Y} w={140} h={60} palette={palette} roofColor="#d0829d" winCols={2} winRows={1} door />);
    n.push(<Building x={200} baseY={GROUND_Y} w={150} h={70} palette={palette} roofColor="#7cb0d0" winCols={3} winRows={1} door />);
    n.push(<Building x={820} baseY={GROUND_Y} w={140} h={60} palette={palette} roofColor="#d0a07c" winCols={2} winRows={1} door />);
    // Cafe with awning
    n.push(<Building x={680} baseY={GROUND_Y} w={120} h={60} palette={palette} roofColor="#f39c7a" winCols={2} winRows={1} door />);
    n.push(<polygon key="aw" points={`${680},${GROUND_Y - 30} ${800},${GROUND_Y - 30} ${795},${GROUND_Y - 15} ${685},${GROUND_Y - 15}`} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.6} />);
    // Signs
    n.push(<rect key="sg1" x={215} y={GROUND_Y - 78} width={120} height={12} fill="#111" />);
    n.push(<text key="sg1-t" x={275} y={GROUND_Y - 68} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f5c84b">MARKET</text>);
    // People
    [260, 420, 580].forEach((x, i) => n.push(<PersonSilhouette key={`p1-${i}`} x={x} y={GROUND_Y} color={["#e14b5a", "#2d7fd4", "#4fa85e"][i]} palette={palette} />));
  }

  if (lvl >= 2) {
    // Mid-rise office
    n.push(<Building x={380} baseY={GROUND_Y} w={160} h={160} palette={palette} roofColor="#2d7fd4" winCols={4} winRows={5} door />);
    n.push(<rect key="ofs" x={380} y={GROUND_Y - 170} width={160} height={14} fill="#111" />);
    n.push(<text key="ofs-t" x={460} y={GROUND_Y - 158} textAnchor="middle" fontSize={10} fontWeight={800} fill="#f5c84b">OFFICE</text>);
    // ATM + trash bins
    n.push(<rect key="atm" x={560} y={GROUND_Y - 40} width={18} height={40} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<rect key="atm-s" x={562} y={GROUND_Y - 36} width={14} height={10} fill="#a7d8ff" />);
  }

  if (lvl >= 3) {
    // 4 towers 10-15 floors
    n.push(<Building x={60}  baseY={GROUND_Y} w={140} h={260} palette={palette} roofColor="#1e5ea8" winCols={4} winRows={10} />);
    n.push(<Building x={220} baseY={GROUND_Y} w={140} h={220} palette={palette} roofColor="#3a7fd5" winCols={4} winRows={8} />);
    n.push(<Building x={560} baseY={GROUND_Y} w={140} h={240} palette={palette} roofColor="#5ba0e0" winCols={4} winRows={9} />);
    n.push(<Building x={800} baseY={GROUND_Y} w={140} h={200} palette={palette} roofColor="#2d7fd4" winCols={4} winRows={7} />);
    // Corporate plaza with flags
    [420, 460, 500].forEach((x, i) => {
      n.push(<line key={`cfl-${i}`} x1={x} y1={GROUND_Y} x2={x} y2={GROUND_Y - 40} stroke={palette.stroke} strokeWidth={1.2} />);
      n.push(<rect key={`cfl-f-${i}`} x={x} y={GROUND_Y - 40} width={18} height={12} fill={["#e14b5a", "#2d7fd4", "#4fa85e"][i]} />);
    });
    // Canopy entrance
    n.push(<polygon key="cano" points={`${130},${GROUND_Y - 32} ${170},${GROUND_Y - 32} ${150},${GROUND_Y - 10}`} fill="#111" />);
  }

  if (lvl >= 4) {
    // Glass skyscrapers
    n.push(<Building x={100} baseY={GROUND_Y} w={130} h={360} palette={palette} roofColor="#1e5ea8" winCols={5} winRows={14} />);
    n.push(<Building x={270} baseY={GROUND_Y} w={150} h={320} palette={palette} roofColor="#3a7fd5" winCols={5} winRows={12} />);
    n.push(<Building x={460} baseY={GROUND_Y} w={170} h={340} palette={palette} roofColor="#2d7fd4" winCols={5} winRows={13} />);
    n.push(<Building x={670} baseY={GROUND_Y} w={140} h={300} palette={palette} roofColor="#0e4080" winCols={4} winRows={11} />);
    n.push(<Building x={840} baseY={GROUND_Y} w={130} h={280} palette={palette} roofColor="#5ba0e0" winCols={4} winRows={10} />);
    // Helipad on tallest
    n.push(<rect key="hp" x={470} y={GROUND_Y - 350} width={150} height={10} fill="#e14b5a" />);
    n.push(<circle key="hpc" cx={545} cy={GROUND_Y - 336} r={22} fill="#fff" stroke="#e14b5a" strokeWidth={2} />);
    n.push(<text key="hpt" x={545} y={GROUND_Y - 330} textAnchor="middle" fontSize={22} fontWeight={900} fill="#e14b5a">H</text>);
    // Plaza fountain
    n.push(<ellipse key="fn-l" cx={220} cy={GROUND_Y + 30} rx={50} ry={10} fill={palette.water} stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<rect key="fn-p" x={214} y={GROUND_Y + 10} width={12} height={20} fill="#c9a56b" />);
  }

  if (lvl >= 5) {
    // Manhattan-style super-tall cluster with antennas and spires
    const megas = [
      { x: 30,  w: 110, h: 440, hue: "#0e4080" },
      { x: 160, w: 120, h: 380, hue: "#1e5ea8" },
      { x: 300, w: 130, h: 420, hue: "#2d7fd4" },
      { x: 450, w: 150, h: 460, hue: "#3a7fd5" },
      { x: 620, w: 130, h: 390, hue: "#5ba0e0" },
      { x: 770, w: 120, h: 370, hue: "#2d7fd4" },
      { x: 900, w: 100, h: 330, hue: "#0e4080" }
    ];
    megas.forEach((M, i) => {
      n.push(<Building key={`mg-${i}`} x={M.x} baseY={GROUND_Y} w={M.w} h={M.h} palette={palette} roofColor={M.hue} winCols={Math.max(4, Math.floor(M.w / 22))} winRows={Math.round(M.h / 18)} />);
      // spire
      n.push(<line key={`sp-${i}`} x1={M.x + M.w / 2} y1={GROUND_Y - M.h} x2={M.x + M.w / 2} y2={GROUND_Y - M.h - 34} stroke={palette.stroke} strokeWidth={2} />);
      n.push(<circle key={`sp-d-${i}`} cx={M.x + M.w / 2} cy={GROUND_Y - M.h - 34} r={3} fill="#e14b5a" />);
    });
    // LED billboards
    // Six distinct company logos on towers
    n.push(<CompanyLogo key="logo1" x={60}  y={GROUND_Y - 420} w={90}  h={70} variant={0} palette={palette} />);
    n.push(<CompanyLogo key="logo2" x={200} y={GROUND_Y - 360} w={90}  h={70} variant={1} palette={palette} />);
    n.push(<CompanyLogo key="logo3" x={340} y={GROUND_Y - 400} w={90}  h={70} variant={2} palette={palette} />);
    n.push(<CompanyLogo key="logo4" x={480} y={GROUND_Y - 450} w={90}  h={70} variant={3} palette={palette} />);
    n.push(<CompanyLogo key="logo5" x={640} y={GROUND_Y - 380} w={90}  h={70} variant={4} palette={palette} />);
    n.push(<CompanyLogo key="logo6" x={790} y={GROUND_Y - 360} w={90}  h={70} variant={5} palette={palette} />);
    // Taxi cars on street
    [80, 280, 520, 780].forEach((x, i) => n.push(<Car key={`tx-${i}`} x={x} y={GROUND_Y + 60} color="#f5c84b" palette={palette} />));
  }

  return n;
}

// --------------------------- PARK ---------------------------

function ParkDistrict({ level, palette }) {
  const n = [];
  const lvl = Math.max(0, Math.min(5, level));

  // Wild grass extensions always
  for (let i = 0; i < 30; i++) {
    const x = 20 + (i * 33) % 980;
    n.push(<line key={`gr-${i}`} x1={x} y1={GROUND_Y} x2={x + 3} y2={GROUND_Y - 5} stroke={palette.leaf} strokeWidth={1} />);
  }

  if (lvl === 0) {
    // Big rock
    n.push(<ellipse key="rock" cx={500} cy={GROUND_Y - 4} rx={60} ry={20} fill="#8a857c" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<ellipse key="rock2" cx={520} cy={GROUND_Y - 18} rx={30} ry={12} fill="#a3998c" stroke={palette.stroke} strokeWidth={0.6} />);
    // A few trees
    [150, 350, 650, 850].forEach((x, i) => n.push(<Tree key={`t0-${i}`} x={x} y={GROUND_Y} size={0.9} palette={palette} />));
    // Wildflowers
    for (let i = 0; i < 12; i++) n.push(<Flower key={`wf-${i}`} x={80 + i * 75} y={GROUND_Y + 4} color={["#e14b5a", "#f5c84b", "#b57cd0"][i % 3]} palette={palette} />);
  }

  if (lvl >= 1) {
    // Park entrance arch with sign — big, prominent
    n.push(<rect key="ar-l" x={440} y={GROUND_Y - 100} width={16} height={100} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<rect key="ar-r" x={544} y={GROUND_Y - 100} width={16} height={100} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<rect key="ar-t" x={430} y={GROUND_Y - 120} width={140} height={22} fill="#4fa85e" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<text key="ar-text" x={500} y={GROUND_Y - 104} textAnchor="middle" fontSize={14} fontWeight={900} fill="#fff">PARK</text>);
    // Dirt path
    n.push(<path key="dp" d={`M 0 ${GROUND_Y + 30} Q 300 ${GROUND_Y + 10} 500 ${GROUND_Y + 30} T 1000 ${GROUND_Y + 30}`} stroke={palette.dirt} strokeWidth={14} fill="none" strokeLinecap="round" />);
    // Picnic table with umbrella
    n.push(<rect key="pt-top" x={300} y={GROUND_Y - 16} width={90} height={8} fill="#8b6a3a" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<rect key="pt-lg1" x={306} y={GROUND_Y - 8} width={6} height={10} fill="#8b6a3a" />);
    n.push(<rect key="pt-lg2" x={378} y={GROUND_Y - 8} width={6} height={10} fill="#8b6a3a" />);
    n.push(<line key="pt-p" x1={345} y1={GROUND_Y - 16} x2={345} y2={GROUND_Y - 70} stroke={palette.stroke} strokeWidth={1.8} />);
    n.push(<path key="pt-um" d={`M 305 ${GROUND_Y - 70} Q 345 ${GROUND_Y - 100} 385 ${GROUND_Y - 70} Z`} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<path key="pt-um2" d={`M 305 ${GROUND_Y - 70} Q 345 ${GROUND_Y - 85} 385 ${GROUND_Y - 70}`} fill="#f39c7a" stroke={palette.stroke} strokeWidth={0.4} />);
    // Bench + trash can
    n.push(<Bench x={180} y={GROUND_Y + 10} palette={palette} />);
    n.push(<Bench x={700} y={GROUND_Y + 10} palette={palette} />);
    n.push(<rect key="tc" x={740} y={GROUND_Y + 4} width={12} height={20} fill="#2d3a4f" stroke={palette.stroke} strokeWidth={0.5} />);
    // Bird bath
    n.push(<rect key="bb-p" x={830} y={GROUND_Y - 30} width={10} height={30} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<ellipse key="bb-t" cx={835} cy={GROUND_Y - 30} rx={18} ry={5} fill={palette.water} stroke={palette.stroke} strokeWidth={0.5} />);
    // Dog walker (person + dog)
    n.push(<PersonSilhouette x={620} y={GROUND_Y} color="#2d7fd4" palette={palette} />);
    n.push(<ellipse key="dw-db" cx={650} cy={GROUND_Y - 6} rx={10} ry={5} fill="#8a6a3a" stroke={palette.stroke} strokeWidth={0.4} />);
    n.push(<rect key="dw-dh" x={657} y={GROUND_Y - 12} width={7} height={6} fill="#8a6a3a" stroke={palette.stroke} strokeWidth={0.4} />);
    n.push(<line key="dw-ls" x1={623} y1={GROUND_Y - 18} x2={650} y2={GROUND_Y - 8} stroke={palette.stroke} strokeWidth={0.8} />);
    // Rabbit
    n.push(<ellipse key="rb-b" cx={90} cy={GROUND_Y - 4} rx={7} ry={4} fill="#d8d0c0" stroke={palette.stroke} strokeWidth={0.4} />);
    n.push(<circle cx={96} cy={GROUND_Y - 8} r={3} fill="#d8d0c0" stroke={palette.stroke} strokeWidth={0.4} />);
    n.push(<line x1={96} y1={GROUND_Y - 11} x2={96} y2={GROUND_Y - 15} stroke={palette.stroke} strokeWidth={0.7} />);
    // Mushroom cluster
    [[90, GROUND_Y + 4], [104, GROUND_Y + 6], [116, GROUND_Y + 4]].forEach(([x, y], i) => {
      n.push(<rect key={`ms-${i}`} x={x - 2} y={y - 4} width={4} height={4} fill="#fff" />);
      n.push(<ellipse key={`mc-${i}`} cx={x} cy={y - 4} rx={6} ry={3} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.4} />);
      n.push(<circle cx={x - 2} cy={y - 5} r={0.8} fill="#fff" />);
      n.push(<circle cx={x + 2} cy={y - 4} r={0.8} fill="#fff" />);
    });
    // More trees
    [80, 220, 380, 540, 700, 860, 950].forEach((x, i) => n.push(<Tree key={`t1-${i}`} x={x} y={GROUND_Y} size={0.8 + (i % 3) * 0.1} palette={palette} />));
    // Flower beds in patterns
    for (let i = 0; i < 16; i++) {
      n.push(<Flower key={`fbc-${i}`} x={140 + i * 14} y={GROUND_Y + 4} color={["#e14b5a", "#f5c84b", "#b57cd0", "#4fa85e"][i % 4]} palette={palette} />);
    }
    for (let i = 0; i < 10; i++) {
      n.push(<Flower key={`fbc2-${i}`} x={880 - i * 12} y={GROUND_Y + 10} color={["#f39c7a", "#5ba0e0", "#d9a441"][i % 3]} palette={palette} />);
    }
  }

  if (lvl >= 2) {
    // Paved crossings
    n.push(<line key="pvh" x1={50} y1={GROUND_Y + 10} x2={950} y2={GROUND_Y + 10} stroke={palette.paving} strokeWidth={10} strokeLinecap="round" />);
    // Pond
    n.push(<ellipse key="pd" cx={750} cy={GROUND_Y - 10} rx={90} ry={18} fill={palette.water} stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<ellipse key="pdh" cx={720} cy={GROUND_Y - 14} rx={22} ry={4} fill={palette.sky[0]} opacity={0.6} />);
    // Ducks
    n.push(<ellipse key="dk1" cx={770} cy={GROUND_Y - 12} rx={6} ry={3} fill="#fff" stroke={palette.stroke} strokeWidth={0.4} />);
    n.push(<ellipse key="dk2" cx={740} cy={GROUND_Y - 10} rx={6} ry={3} fill="#fff" stroke={palette.stroke} strokeWidth={0.4} />);
    // Gazebo
    n.push(<rect key="gz" x={120} y={GROUND_Y - 40} width={80} height={40} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<polygon key="gzr" points={`${115},${GROUND_Y - 40} ${205},${GROUND_Y - 40} ${160},${GROUND_Y - 70}`} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.8} />);
    // Lamps
    [280, 540, 780].forEach((x, i) => n.push(<Lamp key={`lp-${i}`} x={x} y={GROUND_Y} palette={palette} />));
    // Bench extra
    n.push(<Bench x={620} y={GROUND_Y + 10} palette={palette} />);
  }

  if (lvl >= 3) {
    // Central fountain
    n.push(<ellipse key="fnb" cx={500} cy={GROUND_Y - 5} rx={48} ry={10} fill={palette.water} stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<rect key="fnp" x={494} y={GROUND_Y - 40} width={12} height={36} fill={palette.accent} stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="fnj" cx={500} cy={GROUND_Y - 48} r={5} fill={palette.water} opacity={0.8} />);
    // Playground
    // swing
    n.push(<line key="sw-l1" x1={280} y1={GROUND_Y} x2={280} y2={GROUND_Y - 50} stroke="#8b6a3a" strokeWidth={3} />);
    n.push(<line key="sw-l2" x1={340} y1={GROUND_Y} x2={340} y2={GROUND_Y - 50} stroke="#8b6a3a" strokeWidth={3} />);
    n.push(<line key="sw-b"  x1={280} y1={GROUND_Y - 50} x2={340} y2={GROUND_Y - 50} stroke="#8b6a3a" strokeWidth={3} />);
    n.push(<line key="sw-r1" x1={295} y1={GROUND_Y - 50} x2={295} y2={GROUND_Y - 20} stroke={palette.stroke} strokeWidth={1} />);
    n.push(<line key="sw-r2" x1={325} y1={GROUND_Y - 50} x2={325} y2={GROUND_Y - 20} stroke={palette.stroke} strokeWidth={1} />);
    n.push(<rect key="sw-s1" x={290} y={GROUND_Y - 22} width={10} height={3} fill="#e14b5a" />);
    n.push(<rect key="sw-s2" x={320} y={GROUND_Y - 22} width={10} height={3} fill="#2d7fd4" />);
    // Slide
    n.push(<rect key="sl-l" x={395} y={GROUND_Y - 40} width={10} height={40} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<line key="sl-sl" x1={400} y1={GROUND_Y - 40} x2={440} y2={GROUND_Y} stroke="#f5c84b" strokeWidth={6} strokeLinecap="round" />);
    // Pavilion small
    n.push(<Building x={600} baseY={GROUND_Y} w={120} h={50} palette={palette} roofColor="#c9a56b" winCols={3} winRows={1} windows={false} />);
    // Flower beds more
    for (let i = 0; i < 8; i++) n.push(<Flower key={`fb3-${i}`} x={60 + i * 25} y={GROUND_Y + 4} color={["#e14b5a", "#f5c84b", "#b57cd0", "#4fa85e"][i % 4]} palette={palette} />);
    // Bicycle path
    n.push(<line key="bp" x1={0} y1={GROUND_Y + 26} x2={W} y2={GROUND_Y + 26} stroke="#e14b5a" strokeWidth={1.5} strokeDasharray="4 4" />);
  }

  if (lvl >= 4) {
    // Greenhouse
    n.push(<rect key="gh" x={60} y={GROUND_Y - 100} width={160} height={100} fill="#c6e4df" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<polygon key="ghr" points={`${55},${GROUND_Y - 100} ${225},${GROUND_Y - 100} ${140},${GROUND_Y - 140}`} fill="#9dc8c2" stroke={palette.stroke} strokeWidth={0.8} />);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) n.push(<rect key={`gw-${r}-${c}`} x={70 + c * 38} y={GROUND_Y - 90 + r * 28} width={32} height={22} fill="#a3cbc6" stroke={palette.stroke} strokeWidth={0.4} />);
    // Sculpture
    n.push(<rect key="sc-p" x={860} y={GROUND_Y - 80} width={24} height={80} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="sc-b" cx={872} cy={GROUND_Y - 98} r={18} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.8} />);
    // Bridge over pond
    n.push(<rect key="br" x={660} y={GROUND_Y - 18} width={180} height={6} fill="#b58a5a" stroke={palette.stroke} strokeWidth={0.6} />);
    [680, 720, 780, 820].forEach((x, i) => n.push(<line key={`br-p-${i}`} x1={x} y1={GROUND_Y - 18} x2={x} y2={GROUND_Y - 32} stroke="#8a6a3a" strokeWidth={1.4} />));
    // Amphitheater tiers on hill
    [[260, GROUND_Y + 12, 90], [250, GROUND_Y + 4, 110], [240, GROUND_Y - 4, 130]].forEach(([x, y, w], i) =>
      n.push(<rect key={`at-${i}`} x={x} y={y} width={w} height={6} fill="#c2a878" stroke={palette.stroke} strokeWidth={0.4} />)
    );
  }

  if (lvl >= 5) {
    // Big lake
    n.push(<ellipse key="lk" cx={550} cy={GROUND_Y - 10} rx={300} ry={26} fill={palette.water} stroke={palette.stroke} strokeWidth={0.8} />);
    // Carousel
    n.push(<circle key="cr" cx={180} cy={GROUND_Y - 38} r={40} fill="#e14b5a" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<polygon key="crr" points={`${140},${GROUND_Y - 60} ${220},${GROUND_Y - 60} ${180},${GROUND_Y - 100}`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={1} />);
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      n.push(<line key={`crs-${i}`} x1={180} y1={GROUND_Y - 38} x2={180 + Math.cos(ang) * 34} y2={GROUND_Y - 38 + Math.sin(ang) * 10} stroke="#fff" strokeWidth={1} />);
    }
    // Hot air balloon drifting overhead
    n.push(<g key="hab">
      <ellipse cx={300} cy={120} rx={34} ry={42} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.8} />
      <path d={`M 266 120 Q 300 240 334 120`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.6} />
      <path d={`M 276 130 Q 300 220 324 130`} fill="#2d7fd4" stroke={palette.stroke} strokeWidth={0.6} opacity={0.7} />
      <line x1={280} y1={160} x2={290} y2={190} stroke={palette.stroke} strokeWidth={0.6} />
      <line x1={320} y1={160} x2={310} y2={190} stroke={palette.stroke} strokeWidth={0.6} />
      <rect x={284} y={186} width={32} height={14} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.6} />
      <animateTransform attributeName="transform" type="translate" values="-400 0;1100 0" dur="180s" repeatCount="indefinite" />
    </g>);
    // Bandshell with stage
    n.push(<path key="bs" d={`M 380 ${GROUND_Y} Q 500 ${GROUND_Y - 90} 620 ${GROUND_Y} Z`} fill={palette.accent} stroke={palette.stroke} strokeWidth={1} />);
    n.push(<rect key="bsf" x={430} y={GROUND_Y - 20} width={140} height={20} fill="#333" />);
    // Stage performers
    n.push(<PersonSilhouette x={470} y={GROUND_Y - 20} color="#2d7fd4" palette={palette} />);
    n.push(<PersonSilhouette x={500} y={GROUND_Y - 20} color="#e14b5a" palette={palette} />);
    n.push(<PersonSilhouette x={530} y={GROUND_Y - 20} color="#4fa85e" palette={palette} />);
    n.push(<rect key="mic" x={498} y={GROUND_Y - 42} width={2} height={22} fill={palette.stroke} />);
    n.push(<circle cx={499} cy={GROUND_Y - 44} r={3} fill={palette.stroke} />);
    // Ice rink with skaters
    n.push(<ellipse key="ir" cx={860} cy={GROUND_Y + 20} rx={100} ry={18} fill="#d6ecf6" stroke={palette.stroke} strokeWidth={0.8} />);
    [820, 860, 900].forEach((x, i) => n.push(<PersonSilhouette key={`sk-${i}`} x={x} y={GROUND_Y + 24} color={["#f5c84b", "#b57cd0", "#e14b5a"][i]} palette={palette} />));
    // Boats with sails
    [[480, GROUND_Y - 10], [560, GROUND_Y - 6], [620, GROUND_Y - 12]].forEach(([x, y], i) => {
      n.push(<ellipse key={`bt-${i}`} cx={x} cy={y} rx={20} ry={6} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.6} />);
      n.push(<line key={`bts-${i}`} x1={x} y1={y} x2={x + 4} y2={y - 26} stroke={palette.stroke} strokeWidth={1} />);
      n.push(<polygon key={`btf-${i}`} points={`${x + 4},${y - 26} ${x + 22},${y - 14} ${x + 4},${y - 8}`} fill="#fff" stroke={palette.stroke} strokeWidth={0.5} />);
    });
    // Horse-drawn carriage on path
    n.push(<rect key="hc-h" x={80} y={GROUND_Y - 22} width={26} height={12} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<rect key="hc-hd" x={102} y={GROUND_Y - 28} width={10} height={12} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<line x1={82} y1={GROUND_Y - 10} x2={82} y2={GROUND_Y} stroke={palette.stroke} strokeWidth={1.2} />);
    n.push(<line x1={104} y1={GROUND_Y - 10} x2={104} y2={GROUND_Y} stroke={palette.stroke} strokeWidth={1.2} />);
    n.push(<rect key="hc-b" x={40} y={GROUND_Y - 32} width={38} height={22} fill="#8a1e2c" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<circle cx={52} cy={GROUND_Y - 4} r={7} fill="#2a1a10" />);
    n.push(<circle cx={72} cy={GROUND_Y - 4} r={7} fill="#2a1a10" />);
    // Large plaza fountain (middle-front)
    n.push(<ellipse key="pf-b" cx={280} cy={GROUND_Y + 40} rx={50} ry={10} fill={palette.water} stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<rect key="pf-p" x={275} y={GROUND_Y + 20} width={10} height={20} fill="#d9a441" />);
    n.push(<circle cx={280} cy={GROUND_Y + 15} r={4} fill={palette.water} opacity={0.8} />);
    // Zoo entrance gate
    n.push(<rect key="zg-l" x={740} y={GROUND_Y - 60} width={10} height={60} fill="#4fa85e" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<rect key="zg-r" x={800} y={GROUND_Y - 60} width={10} height={60} fill="#4fa85e" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<rect key="zg-t" x={730} y={GROUND_Y - 80} width={90} height={20} fill="#2d7fd4" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<text x={775} y={GROUND_Y - 65} textAnchor="middle" fontSize={12} fontWeight={900} fill="#fff">ZOO</text>);
    // Statue on pedestal
    n.push(<rect key="st-p" x={36} y={GROUND_Y - 80} width={28} height={80} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="st-h" cx={50} cy={GROUND_Y - 92} r={12} fill="#b5a890" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<rect key="st-b" x={44} y={GROUND_Y - 80} width={12} height={18} fill="#a89875" />);
    // Food carts — varied
    n.push(<rect key="fc1" x={220} y={GROUND_Y - 30} width={50} height={30} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="fc1-r" points={`${215},${GROUND_Y - 30} ${275},${GROUND_Y - 30} ${245},${GROUND_Y - 46}`} fill="#fff" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<text x={245} y={GROUND_Y - 34} textAnchor="middle" fontSize={8} fontWeight={700} fill={palette.stroke}>🌮</text>);
    n.push(<rect key="fc2" x={340} y={GROUND_Y - 30} width={50} height={30} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="fc2-r" points={`${335},${GROUND_Y - 30} ${395},${GROUND_Y - 30} ${365},${GROUND_Y - 46}`} fill="#2d7fd4" stroke={palette.stroke} strokeWidth={0.6} />);
    // Street artist with easel
    n.push(<line key="ea-l1" x1={640} y1={GROUND_Y} x2={640} y2={GROUND_Y - 40} stroke="#8a6a3a" strokeWidth={1.6} />);
    n.push(<line key="ea-l2" x1={670} y1={GROUND_Y} x2={670} y2={GROUND_Y - 40} stroke="#8a6a3a" strokeWidth={1.6} />);
    n.push(<rect key="ea-c" x={630} y={GROUND_Y - 60} width={50} height={38} fill="#fff" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<rect x={636} y={GROUND_Y - 54} width={12} height={26} fill="#4fa85e" />);
    n.push(<circle cx={660} cy={GROUND_Y - 40} r={6} fill="#f5c84b" />);
    n.push(<PersonSilhouette x={612} y={GROUND_Y} color="#b57cd0" palette={palette} />);
    // Balloons vendor
    [660, 675, 690].forEach((cx, i) => {
      n.push(<circle key={`bl-${i}`} cx={cx} cy={GROUND_Y - 80 - i * 3} r={8} fill={["#e14b5a", "#f5c84b", "#4fa85e"][i]} stroke={palette.stroke} strokeWidth={0.4} />);
      n.push(<line key={`blst-${i}`} x1={cx} y1={GROUND_Y - 72 - i * 3} x2={695} y2={GROUND_Y - 30} stroke={palette.stroke} strokeWidth={0.4} />);
    });
    n.push(<PersonSilhouette x={695} y={GROUND_Y - 30} color="#e14b5a" palette={palette} />);
    // People scattered in crowd
    for (let i = 0; i < 18; i++) n.push(<PersonSilhouette key={`pp-${i}`} x={60 + i * 52} y={GROUND_Y + 30 + (i % 3) * 10} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a"][i % 6]} palette={palette} />);
  }

  return n;
}

// --------------------------- SQUARE ---------------------------

function SquareDistrict({ level, palette }) {
  const n = [];
  const lvl = Math.max(0, Math.min(5, level));

  if (lvl === 0) {
    n.push(<rect key="dirt" x={60} y={GROUND_Y - 6} width={880} height={46} fill={palette.dirt} stroke={palette.stroke} strokeWidth={0.8} />);
    // Well
    n.push(<rect key="wl" x={470} y={GROUND_Y - 20} width={60} height={20} fill="#7a6a55" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="wlr" points={`${465},${GROUND_Y - 20} ${535},${GROUND_Y - 20} ${500},${GROUND_Y - 50}`} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.6} />);
    // Signpost
    n.push(<line key="sp" x1={300} y1={GROUND_Y} x2={300} y2={GROUND_Y - 50} stroke="#6a4a2c" strokeWidth={3} />);
    n.push(<rect key="sps" x={280} y={GROUND_Y - 50} width={60} height={16} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.6} />);
    // Cart
    n.push(<rect key="ct" x={640} y={GROUND_Y - 20} width={80} height={26} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="ct-w1" cx={660} cy={GROUND_Y + 6} r={10} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<circle key="ct-w2" cx={700} cy={GROUND_Y + 6} r={10} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.5} />);
  }

  if (lvl >= 1) {
    // Cobbled plaza
    n.push(<rect key="pl" x={60} y={GROUND_Y + 10} width={880} height={40} fill={palette.paving} stroke={palette.stroke} strokeWidth={0.8} />);
    for (let i = 0; i < 20; i++) n.push(<line key={`cb-${i}`} x1={60 + i * 45} y1={GROUND_Y + 10} x2={60 + i * 45} y2={GROUND_Y + 50} stroke={palette.stroke} strokeWidth={0.3} opacity={0.5} />);
    // Small central fountain
    n.push(<ellipse key="fn1" cx={500} cy={GROUND_Y + 16} rx={42} ry={10} fill={palette.water} stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<rect key="fn1-p" x={495} y={GROUND_Y - 4} width={10} height={20} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.4} />);
    n.push(<circle cx={500} cy={GROUND_Y - 10} r={4} fill={palette.water} opacity={0.8} />);
    n.push(<Bench x={220} y={GROUND_Y + 50} palette={palette} />);
    n.push(<Bench x={780} y={GROUND_Y + 50} palette={palette} />);
    n.push(<Lamp x={140} y={GROUND_Y + 10} palette={palette} />);
    n.push(<Lamp x={860} y={GROUND_Y + 10} palette={palette} />);

    // Market-day decor hidden at max level (Times-Square stage)
    if (lvl < 5) {
      // MARKET DAY banner across the top
      n.push(<line key="md-l" x1={90} y1={GROUND_Y - 180} x2={910} y2={GROUND_Y - 180} stroke={palette.stroke} strokeWidth={1} />);
      n.push(<rect key="md-bn" x={360} y={GROUND_Y - 196} width={280} height={28} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.8} />);
      n.push(<text key="md-tx" x={500} y={GROUND_Y - 178} textAnchor="middle" fontSize={14} fontWeight={900} fill="#fff">MARKET DAY</text>);

      // String lights draped across
      n.push(<path key="sl-p" d={`M 90 ${GROUND_Y - 160} Q 500 ${GROUND_Y - 130} 910 ${GROUND_Y - 160}`} fill="none" stroke={palette.stroke} strokeWidth={0.5} />);
      for (let i = 0; i < 16; i++) {
        const t = i / 15;
        const lx = 90 + t * 820;
        const ly = GROUND_Y - 160 + Math.sin(Math.PI * t) * -30;
        n.push(<circle key={`sl-b-${i}`} cx={lx} cy={ly + 8} r={3} fill={["#ffd98a", "#e14b5a", "#4fa85e", "#5ba0e0"][i % 4]} stroke={palette.stroke} strokeWidth={0.3} />);
      }

      // Market stalls — 3 on each side of fountain
      const stalls = [
        { x: 60,  color: "#e14b5a", goods: ["#e14b5a", "#f5c84b", "#4fa85e"] },
        { x: 170, color: "#4fa85e", goods: ["#e14b5a", "#f39c7a", "#f5c84b"] },
        { x: 280, color: "#f5c84b", goods: ["#b57cd0", "#e14b5a", "#5ba0e0"] },
        { x: 620, color: "#2d7fd4", goods: ["#4fa85e", "#f5c84b", "#e14b5a"] },
        { x: 730, color: "#b57cd0", goods: ["#f39c7a", "#5ba0e0", "#4fa85e"] },
        { x: 840, color: "#f39c7a", goods: ["#e14b5a", "#f5c84b", "#b57cd0"] }
      ];
      stalls.forEach((st, i) => {
        n.push(<rect key={`st-c-${i}`} x={st.x} y={GROUND_Y - 40} width={80} height={30} fill="#a88260" stroke={palette.stroke} strokeWidth={0.6} />);
        n.push(<polygon key={`st-a-${i}`} points={`${st.x - 4},${GROUND_Y - 40} ${st.x + 84},${GROUND_Y - 40} ${st.x + 78},${GROUND_Y - 70} ${st.x + 2},${GROUND_Y - 70}`} fill={st.color} stroke={palette.stroke} strokeWidth={0.6} />);
        n.push(<line key={`st-s1-${i}`} x1={st.x + 22} y1={GROUND_Y - 40} x2={st.x + 24} y2={GROUND_Y - 70} stroke="#fff" strokeWidth={0.6} opacity={0.6} />);
        n.push(<line key={`st-s2-${i}`} x1={st.x + 56} y1={GROUND_Y - 40} x2={st.x + 58} y2={GROUND_Y - 70} stroke="#fff" strokeWidth={0.6} opacity={0.6} />);
        n.push(<line x1={st.x} y1={GROUND_Y - 40} x2={st.x} y2={GROUND_Y - 10} stroke={palette.stroke} strokeWidth={1} />);
        n.push(<line x1={st.x + 80} y1={GROUND_Y - 40} x2={st.x + 80} y2={GROUND_Y - 10} stroke={palette.stroke} strokeWidth={1} />);
        st.goods.forEach((g, k) => n.push(<circle key={`st-g-${i}-${k}`} cx={st.x + 20 + k * 22} cy={GROUND_Y - 26} r={5} fill={g} stroke={palette.stroke} strokeWidth={0.3} />));
        n.push(<PersonSilhouette x={st.x + 40} y={GROUND_Y - 10} color="#8a6a3a" palette={palette} />);
      });

      // Customers walking around
      [350, 420, 570, 680].forEach((x, i) => n.push(<PersonSilhouette key={`cst-${i}`} x={x} y={GROUND_Y + 50} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b"][i]} palette={palette} />));
      // Flower vendor with bouquet
      n.push(<rect key="fv" x={440} y={GROUND_Y - 24} width={30} height={18} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.5} />);
      [0, 1, 2].forEach(k => n.push(<circle cx={450 + k * 5} cy={GROUND_Y - 28} r={4} fill={["#e14b5a", "#f5c84b", "#b57cd0"][k]} />));
    }
  }

  if (lvl >= 2) {
    // Bigger fountain + clocktower + flagpoles
    n.push(<ellipse key="fn2" cx={500} cy={GROUND_Y + 16} rx={76} ry={16} fill={palette.water} stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<rect key="fn2-p" x={490} y={GROUND_Y - 40} width={20} height={56} fill={palette.accent} stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="fn2-j" cx={500} cy={GROUND_Y - 48} r={8} fill={palette.water} opacity={0.7} />);
    // Clocktower
    n.push(<rect key="ct" x={60} y={GROUND_Y - 200} width={80} height={200} fill="#c9a56b" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<polygon key="ctr" points={`${54},${GROUND_Y - 200} ${146},${GROUND_Y - 200} ${100},${GROUND_Y - 250}`} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<circle key="clock" cx={100} cy={GROUND_Y - 170} r={22} fill="#fff" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<line key="chh" x1={100} y1={GROUND_Y - 170} x2={108} y2={GROUND_Y - 182} stroke={palette.stroke} strokeWidth={2} />);
    n.push(<line key="chm" x1={100} y1={GROUND_Y - 170} x2={100} y2={GROUND_Y - 188} stroke={palette.stroke} strokeWidth={2} />);
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
      n.push(<circle key={`cd-${h}`} cx={100 + Math.cos(a) * 18} cy={GROUND_Y - 170 + Math.sin(a) * 18} r={1} fill={palette.stroke} />);
    }
    // Flagpoles (hidden at max level where crowd/LEDs dominate)
    if (lvl < 5) {
      [720, 800, 880].forEach((x, i) => {
        n.push(<line key={`fp-${i}`} x1={x} y1={GROUND_Y + 10} x2={x} y2={GROUND_Y - 70} stroke={palette.stroke} strokeWidth={2} />);
        n.push(<rect key={`fpf-${i}`} x={x} y={GROUND_Y - 70} width={30} height={20} fill={["#e14b5a", "#2d7fd4", "#4fa85e"][i]} />);
      });
    }
  }

  if (lvl >= 3) {
    // Town hall + library buildings
    n.push(<Building x={200} baseY={GROUND_Y + 10} w={200} h={100} palette={palette} roofColor="#e5d1a4" winCols={4} winRows={3} door />);
    n.push(<polygon key="thr" points={`${190},${GROUND_Y - 90} ${410},${GROUND_Y - 90} ${300},${GROUND_Y - 130}`} fill="#5a3124" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<text key="tht" x={300} y={GROUND_Y - 50} textAnchor="middle" fontSize={12} fontWeight={800} fill={palette.stroke}>TOWN HALL</text>);
    // Monument statue on pedestal
    n.push(<rect key="mn-b" x={490} y={GROUND_Y - 30} width={20} height={46} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="mn-h" cx={500} cy={GROUND_Y - 42} r={12} fill="#b5a890" stroke={palette.stroke} strokeWidth={0.6} />);
    // Food kiosks
    n.push(<Building x={630} baseY={GROUND_Y + 10} w={60} h={44} palette={palette} roofColor="#e14b5a" winCols={1} winRows={1} />);
    n.push(<Building x={720} baseY={GROUND_Y + 10} w={60} h={44} palette={palette} roofColor="#4fa85e" winCols={1} winRows={1} />);
    // Street performer
    n.push(<PersonSilhouette x={880} y={GROUND_Y + 50} color="#f5c84b" palette={palette} />);
    n.push(<circle key="sprh" cx={890} cy={GROUND_Y + 20} r={5} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.4} />);
  }

  if (lvl >= 4) {
    // Grand columns
    [160, 440, 720].forEach((x, i) => {
      n.push(<rect key={`col-${i}`} x={x} y={GROUND_Y - 80} width={20} height={80} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.8} />);
      n.push(<rect key={`col-c-${i}`} x={x - 4} y={GROUND_Y - 84} width={28} height={6} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.5} />);
      n.push(<rect key={`col-b-${i}`} x={x - 4} y={GROUND_Y - 6} width={28} height={6} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.5} />);
    });
    // Multi-tier fountain
    n.push(<rect key="ff-tier" x={450} y={GROUND_Y - 80} width={100} height={40} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<circle key="ff-j1" cx={475} cy={GROUND_Y - 100} r={6} fill={palette.water} opacity={0.8} />);
    n.push(<circle key="ff-j2" cx={525} cy={GROUND_Y - 100} r={6} fill={palette.water} opacity={0.8} />);
    n.push(<circle key="ff-j3" cx={500} cy={GROUND_Y - 110} r={8} fill={palette.water} opacity={0.9} />);
    // Decor strings
    n.push(<path key="st-l" d={`M 60 100 Q 500 60 940 100`} fill="none" stroke="#f5c84b" strokeDasharray="6 6" strokeWidth={1.4} />);
    for (let i = 0; i < 15; i++) n.push(<circle key={`lb-${i}`} cx={80 + i * 60} cy={95 + Math.sin(i * 0.9) * 8} r={2.5} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.3} />);
  }

  if (lvl >= 5) {
    // Giant monument obelisk
    n.push(<rect key="ob" x={480} y={GROUND_Y - 240} width={40} height={240} fill="#c9bda6" stroke={palette.stroke} strokeWidth={1} />);
    n.push(<polygon key="obt" points={`${480},${GROUND_Y - 240} ${520},${GROUND_Y - 240} ${500},${GROUND_Y - 280}`} fill="#d9a441" stroke={palette.stroke} strokeWidth={1} />);
    // Obelisk laurel ring
    n.push(<ellipse key="ob-l" cx={500} cy={GROUND_Y - 240} rx={30} ry={8} fill="none" stroke="#d9a441" strokeWidth={1.4} />);

    // Stage with full band
    n.push(<rect key="stg" x={240} y={GROUND_Y - 60} width={150} height={60} fill="#333" stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<rect key="stg-b" x={240} y={GROUND_Y - 80} width={150} height={20} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.6} />);
    // Back wall stage name
    n.push(<text key="stg-t" x={315} y={GROUND_Y - 65} textAnchor="middle" fontSize={11} fontWeight={800} fill="#f5c84b">LIVE STAGE</text>);
    // Drum kit
    n.push(<circle cx={270} cy={GROUND_Y - 16} r={10} fill="#fff" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle cx={285} cy={GROUND_Y - 22} r={6} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.5} />);
    n.push(<line key="cymb" x1={258} y1={GROUND_Y - 30} x2={258} y2={GROUND_Y - 8} stroke={palette.stroke} strokeWidth={0.8} />);
    n.push(<ellipse cx={258} cy={GROUND_Y - 30} rx={8} ry={1.5} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.4} />);
    // Guitarist
    n.push(<PersonSilhouette x={310} y={GROUND_Y - 16} color="#2d7fd4" palette={palette} />);
    n.push(<polygon key="gtr" points={`${305},${GROUND_Y - 22} ${318},${GROUND_Y - 20} ${322},${GROUND_Y - 8} ${310},${GROUND_Y - 10}`} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.5} />);
    // Singer with mic
    n.push(<PersonSilhouette x={350} y={GROUND_Y - 16} color="#e14b5a" palette={palette} />);
    n.push(<line x1={350} y1={GROUND_Y - 36} x2={350} y2={GROUND_Y - 20} stroke={palette.stroke} strokeWidth={1.2} />);
    n.push(<circle cx={350} cy={GROUND_Y - 38} r={2.5} fill={palette.stroke} />);

    // Large decorated tree (festive) on left
    n.push(<polygon key="ct-1" points={`${130},${GROUND_Y - 40} ${90},${GROUND_Y} ${170},${GROUND_Y}`} fill="#2a5f38" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="ct-2" points={`${130},${GROUND_Y - 80} ${95},${GROUND_Y - 30} ${165},${GROUND_Y - 30}`} fill="#2a5f38" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="ct-3" points={`${130},${GROUND_Y - 120} ${100},${GROUND_Y - 70} ${160},${GROUND_Y - 70}`} fill="#2a5f38" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="ct-4" points={`${130},${GROUND_Y - 155} ${106},${GROUND_Y - 110} ${154},${GROUND_Y - 110}`} fill="#2a5f38" stroke={palette.stroke} strokeWidth={0.6} />);
    // Tree ornaments
    [[108, -12], [130, -24], [152, -12], [112, -56], [146, -56], [116, -94], [144, -94], [126, -140]]
      .forEach(([x, y], i) => n.push(<circle key={`dec-${i}`} cx={x + 2} cy={GROUND_Y + y} r={3} fill={["#e14b5a", "#f5c84b", "#2d7fd4", "#b57cd0"][i % 4]} stroke={palette.stroke} strokeWidth={0.3} />));
    n.push(<polygon key="star" points={`130,${GROUND_Y - 165} 133,${GROUND_Y - 158} 140,${GROUND_Y - 158} 134,${GROUND_Y - 154} 136,${GROUND_Y - 148} 130,${GROUND_Y - 152} 124,${GROUND_Y - 148} 126,${GROUND_Y - 154} 120,${GROUND_Y - 158} 127,${GROUND_Y - 158}`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.4} />);

    // Ferris wheel on right side
    const fwX = 780, fwY = GROUND_Y - 120, fwR = 90;
    n.push(<circle key="fw-o" cx={fwX} cy={fwY} r={fwR} fill="none" stroke="#4a5568" strokeWidth={2} />);
    n.push(<circle key="fw-i" cx={fwX} cy={fwY} r={fwR - 10} fill="none" stroke="#4a5568" strokeWidth={1} strokeDasharray="4 3" />);
    n.push(<circle key="fw-hub" cx={fwX} cy={fwY} r={8} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.6} />);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const ex = fwX + Math.cos(a) * fwR;
      const ey = fwY + Math.sin(a) * fwR;
      n.push(<line key={`fw-sp-${i}`} x1={fwX} y1={fwY} x2={ex} y2={ey} stroke="#4a5568" strokeWidth={1} />);
      // gondolas
      n.push(<rect key={`fw-g-${i}`} x={ex - 9} y={ey - 6} width={18} height={12} fill={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a", "#5ba0e0", "#47a5b0"][i]} stroke={palette.stroke} strokeWidth={0.5} rx={2} />);
    }
    // Ferris wheel base
    n.push(<polygon key="fw-b" points={`${fwX - 30},${GROUND_Y} ${fwX + 30},${GROUND_Y} ${fwX},${fwY + fwR}`} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.6} />);

    // Cafe tables with umbrellas on sidewalk
    [[570, "#e14b5a"], [620, "#f5c84b"], [670, "#4fa85e"]].forEach(([x, color], i) => {
      n.push(<line key={`um-p-${i}`} x1={x} y1={GROUND_Y + 42} x2={x} y2={GROUND_Y - 8} stroke={palette.stroke} strokeWidth={1.2} />);
      n.push(<polygon key={`um-${i}`} points={`${x - 22},${GROUND_Y - 8} ${x + 22},${GROUND_Y - 8} ${x + 14},${GROUND_Y - 26} ${x - 14},${GROUND_Y - 26}`} fill={color} stroke={palette.stroke} strokeWidth={0.5} />);
      n.push(<circle cx={x} cy={GROUND_Y + 42} r={12} fill="#8a6a3a" stroke={palette.stroke} strokeWidth={0.4} />);
      // 2 chairs
      n.push(<rect x={x - 20} y={GROUND_Y + 42} width={6} height={8} fill="#4a2d1a" />);
      n.push(<rect x={x + 14} y={GROUND_Y + 42} width={6} height={8} fill="#4a2d1a" />);
      // Sitting people
      n.push(<circle cx={x - 17} cy={GROUND_Y + 38} r={3} fill="#f4d3a9" stroke={palette.stroke} strokeWidth={0.3} />);
      n.push(<circle cx={x + 17} cy={GROUND_Y + 38} r={3} fill="#f4d3a9" stroke={palette.stroke} strokeWidth={0.3} />);
    });

    // Ornate clock on a building
    n.push(<Building x={420} baseY={GROUND_Y} w={100} h={160} palette={palette} roofColor="#b58a5a" winCols={3} winRows={4} />);
    n.push(<polygon key="oc-r" points={`${415},${GROUND_Y - 160} ${525},${GROUND_Y - 160} ${470},${GROUND_Y - 200}`} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<circle key="oc-f" cx={470} cy={GROUND_Y - 130} r={22} fill="#fff" stroke="#d9a441" strokeWidth={2.4} />);
    // Roman numerals
    for (let h = 0; h < 12; h++) {
      const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
      n.push(<line key={`ocd-${h}`} x1={470 + Math.cos(a) * 17} y1={GROUND_Y - 130 + Math.sin(a) * 17} x2={470 + Math.cos(a) * 20} y2={GROUND_Y - 130 + Math.sin(a) * 20} stroke={palette.stroke} strokeWidth={1.2} />);
    }
    n.push(<line key="oc-h" x1={470} y1={GROUND_Y - 130} x2={478} y2={GROUND_Y - 140} stroke={palette.stroke} strokeWidth={2.2} />);
    n.push(<line key="oc-m" x1={470} y1={GROUND_Y - 130} x2={470} y2={GROUND_Y - 148} stroke={palette.stroke} strokeWidth={1.8} />);
    n.push(<circle cx={470} cy={GROUND_Y - 130} r={2} fill="#d9a441" />);

    // Historic buildings on far right
    n.push(<Building x={870} baseY={GROUND_Y + 10} w={180} h={200} palette={palette} roofColor="#b58a5a" winCols={5} winRows={6} door />);
    n.push(<polygon key="hbr" points={`${860},${GROUND_Y - 190} ${1060},${GROUND_Y - 190} ${960},${GROUND_Y - 250}`} fill="#6a3f24" />);

    // Grand entrance columns at front center
    [200, 800].forEach((x, i) => {
      n.push(<rect key={`gc-${i}`} x={x - 8} y={GROUND_Y - 40} width={16} height={40} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.5} />);
      n.push(<circle cx={x} cy={GROUND_Y - 44} r={10} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.4} />);
    });

    // Pigeons on the ground
    for (let i = 0; i < 8; i++) {
      const x = 140 + i * 90;
      n.push(<ellipse key={`pg-${i}`} cx={x} cy={GROUND_Y + 52} rx={4} ry={2.5} fill="#9aa0aa" stroke={palette.stroke} strokeWidth={0.3} />);
      n.push(<circle cx={x + 3} cy={GROUND_Y + 50} r={1.8} fill="#9aa0aa" stroke={palette.stroke} strokeWidth={0.3} />);
    }

    // Ice cream truck
    n.push(<rect key="ict" x={880} y={GROUND_Y + 24} width={80} height={32} fill="#fff" stroke={palette.stroke} strokeWidth={0.6} rx={3} />);
    n.push(<rect key="ict-w" x={884} y={GROUND_Y + 28} width={30} height={14} fill="#a7d8ff" />);
    n.push(<rect key="ict-s" x={918} y={GROUND_Y + 28} width={38} height={16} fill="#e14b5a" />);
    n.push(<text x={937} y={GROUND_Y + 40} textAnchor="middle" fontSize={9} fontWeight={800} fill="#fff">ICE</text>);
    n.push(<circle cx={895} cy={GROUND_Y + 58} r={6} fill={palette.stroke} />);
    n.push(<circle cx={950} cy={GROUND_Y + 58} r={6} fill={palette.stroke} />);

    // Segway rider
    n.push(<line key="sg-b" x1={360} y1={GROUND_Y} x2={360} y2={GROUND_Y - 20} stroke={palette.stroke} strokeWidth={2} />);
    n.push(<PersonSilhouette x={360} y={GROUND_Y - 20} color="#2d7fd4" palette={palette} />);
    n.push(<circle cx={360} cy={GROUND_Y + 2} r={6} fill={palette.stroke} />);

    // Fireworks in the sky (burst of colored lines from a center)
    [[220, 160, "#e14b5a"], [580, 120, "#f5c84b"], [720, 180, "#b57cd0"]].forEach(([cx, cy, color], fi) => {
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2;
        const r1 = 8, r2 = 22;
        n.push(<line key={`fw-${fi}-${i}`} x1={cx + Math.cos(a) * r1} y1={cy + Math.sin(a) * r1} x2={cx + Math.cos(a) * r2} y2={cy + Math.sin(a) * r2} stroke={color} strokeWidth={1.6} strokeLinecap="round" />);
        n.push(<circle cx={cx + Math.cos(a) * r2} cy={cy + Math.sin(a) * r2} r={2} fill={color} />);
      }
      n.push(<circle cx={cx} cy={cy} r={3} fill="#fff" />);
    });

    // Huge crowd at bottom (2 rows)
    for (let i = 0; i < 48; i++) n.push(<PersonSilhouette key={`mc-${i}`} x={40 + (i % 24) * 40} y={GROUND_Y + 64 + ((i / 24 | 0) * 14)} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0", "#f39c7a"][i % 6]} palette={palette} />);
  }

  return n;
}

// --------------------------- RESIDENTIAL ---------------------------

function ResidentialDistrict({ level, palette }) {
  const n = [];
  const lvl = Math.max(0, Math.min(5, level));

  if (lvl === 0) {
    // Dirt road
    n.push(<rect key="rd" x={0} y={GROUND_Y + 20} width={W} height={40} fill={palette.dirt} />);
    // 2 tiny huts
    n.push(<PitchedHouse x={180} baseY={GROUND_Y} w={140} h={80} palette={palette} wallColor="#b58a5a" roofColor="#6a3f24" />);
    n.push(<PitchedHouse x={640} baseY={GROUND_Y} w={120} h={70} palette={palette} wallColor="#a98060" roofColor="#6a3f24" />);
    // Well
    n.push(<rect key="wl" x={470} y={GROUND_Y - 26} width={40} height={26} fill="#7a6a55" stroke={palette.stroke} strokeWidth={0.6} />);
    n.push(<polygon key="wlr" points={`${465},${GROUND_Y - 26} ${515},${GROUND_Y - 26} ${490},${GROUND_Y - 50}`} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.6} />);
    // Trees
    [80, 400, 860].forEach((x, i) => n.push(<Tree key={`t0-${i}`} x={x} y={GROUND_Y} size={1} palette={palette} />));
  }

  if (lvl >= 1) {
    // 3-4 wooden houses with picket fences
    const houses = [
      { x: 40,  w: 180, h: 110, wall: "#b58a5a" },
      { x: 260, w: 180, h: 100, wall: "#a98060" },
      { x: 480, w: 180, h: 120, wall: "#c9a56b" },
      { x: 760, w: 180, h: 110, wall: "#b58a5a" }
    ];
    houses.forEach((H, i) => {
      n.push(<PitchedHouse key={`h-${i}`} x={H.x} baseY={GROUND_Y} w={H.w} h={H.h} palette={palette} wallColor={H.wall} roofColor="#6a3f24" />);
      // Mailbox
      n.push(<line key={`mb-p-${i}`} x1={H.x + H.w - 14} y1={GROUND_Y} x2={H.x + H.w - 14} y2={GROUND_Y - 20} stroke={palette.stroke} strokeWidth={1.2} />);
      n.push(<rect key={`mb-${i}`} x={H.x + H.w - 20} y={GROUND_Y - 26} width={12} height={8} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.4} />);
      // Picket fence
      n.push(<Fence key={`fn-${i}`} x1={H.x - 6} x2={H.x + H.w + 6} y={GROUND_Y} palette={palette} />);
    });
    // People
    n.push(<PersonSilhouette x={180} y={GROUND_Y} color="#2d7fd4" palette={palette} />);
    n.push(<PersonSilhouette x={720} y={GROUND_Y} color="#e14b5a" palette={palette} />);
  }

  if (lvl >= 2) {
    // Suburbs: brick houses with driveways and cars, better yards
    const houses2 = [
      { x: 40,  w: 200, h: 140, wall: "#c88b6a" },
      { x: 280, w: 200, h: 130, wall: "#b58a5a" },
      { x: 520, w: 200, h: 150, wall: "#a98060" },
      { x: 760, w: 200, h: 140, wall: "#c9a56b" }
    ];
    houses2.forEach((H, i) => {
      n.push(<PitchedHouse key={`h2-${i}`} x={H.x} baseY={GROUND_Y} w={H.w} h={H.h} palette={palette} wallColor={H.wall} roofColor="#6a3f24" />);
      // Garage
      n.push(<rect key={`gr-${i}`} x={H.x + H.w - 70} y={GROUND_Y - 60} width={60} height={60} fill="#666" stroke={palette.stroke} strokeWidth={0.8} />);
      n.push(<rect key={`gr-d-${i}`} x={H.x + H.w - 64} y={GROUND_Y - 54} width={48} height={54} fill="#444" stroke={palette.stroke} strokeWidth={0.5} />);
      // Driveway
      n.push(<rect key={`dv-${i}`} x={H.x + H.w - 70} y={GROUND_Y} width={60} height={28} fill={palette.paving} stroke={palette.stroke} strokeWidth={0.4} />);
      // Car
      n.push(<Car key={`rc-${i}`} x={H.x + H.w - 40} y={GROUND_Y + 14} color={["#5ba0e0", "#e14b5a", "#4fa85e", "#f5c84b"][i]} palette={palette} />);
      // Bush hedge
      n.push(<Bush x={H.x + 20} y={GROUND_Y + 2} size={0.8} palette={palette} />);
    });
  }

  if (lvl >= 3) {
    // Townhouses (shared walls) on one section
    const colors = ["#b57cd0", "#d0829d", "#7cb0d0", "#d0a07c", "#8a7cd0"];
    for (let i = 0; i < 6; i++) {
      const x = 40 + i * 150;
      n.push(<Building key={`th-${i}`} x={x} baseY={GROUND_Y} w={140} h={200} palette={palette} roofColor={colors[i % colors.length]} winCols={3} winRows={4} door />);
      // Balcony
      n.push(<rect key={`bc-${i}`} x={x} y={GROUND_Y - 130} width={140} height={6} fill="#8a6a3a" stroke={palette.stroke} strokeWidth={0.4} />);
      [x + 20, x + 70, x + 120].forEach((px, k) => n.push(<line key={`bc-r-${i}-${k}`} x1={px} y1={GROUND_Y - 130} x2={px} y2={GROUND_Y - 118} stroke={palette.stroke} strokeWidth={0.6} />));
      // Small plant on balcony
      n.push(<circle key={`bp-${i}`} cx={x + 20} cy={GROUND_Y - 134} r={4} fill={palette.leaf} />);
    }
    // Bike stand
    for (let i = 0; i < 4; i++) n.push(<line key={`bs-${i}`} x1={900 + i * 15} y1={GROUND_Y} x2={900 + i * 15} y2={GROUND_Y - 18} stroke={palette.stroke} strokeWidth={1.2} />);
  }

  if (lvl >= 4) {
    // Mid-rise apartments with courtyard
    [60, 340, 620].forEach((x, i) => {
      n.push(<Building key={`ap-${i}`} x={x} baseY={GROUND_Y} w={200} h={320} palette={palette} roofColor={["#b57cd0", "#7cb0d0", "#d0829d"][i]} winCols={5} winRows={10} door />);
      // Balconies every other floor
      for (let f = 1; f < 10; f += 2) {
        n.push(<rect key={`ab-${i}-${f}`} x={x} y={GROUND_Y - 30 - f * 30} width={200} height={4} fill="#666" />);
      }
    });
    // Corner shop
    n.push(<Building x={860} baseY={GROUND_Y} w={120} h={80} palette={palette} roofColor="#d9a441" winCols={2} winRows={2} door />);
    n.push(<rect key="cs-s" x={860} y={GROUND_Y - 92} width={120} height={10} fill="#111" />);
    n.push(<text key="cs-t" x={920} y={GROUND_Y - 84} textAnchor="middle" fontSize={8} fontWeight={800} fill="#f5c84b">SHOP</text>);
    // Playground in courtyard
    n.push(<line key="cs-sw1" x1={260} y1={GROUND_Y} x2={260} y2={GROUND_Y - 30} stroke="#8b6a3a" strokeWidth={2.4} />);
    n.push(<line key="cs-sw2" x1={320} y1={GROUND_Y} x2={320} y2={GROUND_Y - 30} stroke="#8b6a3a" strokeWidth={2.4} />);
    n.push(<line key="cs-sw-b" x1={260} y1={GROUND_Y - 30} x2={320} y2={GROUND_Y - 30} stroke="#8b6a3a" strokeWidth={2.4} />);
  }

  if (lvl >= 5) {
    // Hi-rise glass towers
    [40, 340, 640].forEach((x, i) => {
      n.push(<Building key={`ht-${i}`} x={x} baseY={GROUND_Y} w={260} h={440} palette={palette} roofColor={["#7cb0d0", "#b57cd0", "#d0829d"][i]} winCols={6} winRows={18} />);
      // Rooftop garden
      n.push(<rect key={`rg-${i}`} x={x + 10} y={GROUND_Y - 450} width={240} height={10} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.4} />);
      [20, 70, 120, 170, 220].forEach((off, k) => n.push(<circle key={`rgt-${i}-${k}`} cx={x + off} cy={GROUND_Y - 454} r={5} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.3} />));
    });
    // Rooftop pool on first tower
    n.push(<rect key="rp" x={70} y={GROUND_Y - 442} width={200} height={6} fill={palette.water} stroke={palette.stroke} strokeWidth={0.5} />);
    // Concierge entrance awning
    n.push(<polygon key="ce" points={`${160},${GROUND_Y - 24} ${260},${GROUND_Y - 24} ${250},${GROUND_Y} ${170},${GROUND_Y}`} fill="#333" stroke={palette.stroke} strokeWidth={0.6} />);
    // Landscape at base
    [30, 150, 320, 540, 700, 880].forEach((x, i) => n.push(<Tree key={`lt-${i}`} x={x} y={GROUND_Y + 64} size={0.7} palette={palette} />));
    // EV charging bollards
    [120, 480, 820].forEach((x, i) => n.push(<rect key={`ev-${i}`} x={x} y={GROUND_Y + 40} width={8} height={20} fill="#4fa85e" stroke={palette.stroke} strokeWidth={0.4} />));
    // Luxury car
    n.push(<Car x={900} y={GROUND_Y + 64} color="#111" palette={palette} />);
  }

  return n;
}

// --------------------------- Entry ---------------------------

// --------------------------- side decor per district ---------------------
// Fills the extended horizontal band (x < 0 and x > W) with district-themed
// objects matching the current level. Accumulates across levels.

function renderSideDecor(id, level, palette) {
  const lvl = Math.max(0, Math.min(5, level));
  const n = [];
  const add = (node) => n.push(node);

  // Convenience: two horizontal bands — left (x < 0) and right (x > W).
  const LX = [-680, -520, -360, -200, -80]; // five slots on the left
  const RX = [W + 40, W + 200, W + 360, W + 520, W + 680]; // five slots on the right

  if (id === "sport") {
    // 0 — rural outskirts
    add(<Haybale key="ha1" x={LX[0]} y={GROUND_Y + 4} palette={palette} />);
    add(<Haybale key="ha2" x={LX[1] + 40} y={GROUND_Y + 4} palette={palette} />);
    add(<Fence key="fl-f" x1={LX[2] - 10} x2={LX[3] + 110} y={GROUND_Y} palette={palette} />);
    add(<Tree key="sot1" x={LX[4]} y={GROUND_Y} size={0.9} palette={palette} />);
    add(<Haybale key="ha3" x={RX[0] + 30} y={GROUND_Y + 4} palette={palette} />);
    add(<Fence key="fr-f" x1={RX[1] - 10} x2={RX[3]} y={GROUND_Y} palette={palette} />);
    add(<Tree key="sot2" x={RX[4]} y={GROUND_Y} size={0.9} palette={palette} />);

    if (lvl >= 1) {
      // Practice drills on left grass
      [LX[0] + 20, LX[0] + 60, LX[0] + 100].forEach((x, i) =>
        add(<polygon key={`con-${i}`} points={`${x},${GROUND_Y} ${x - 5},${GROUND_Y + 8} ${x + 5},${GROUND_Y + 8}`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.4} />)
      );
      // Water tank on right
      add(<rect key="wt" x={RX[3]} y={GROUND_Y - 24} width={40} height={24} fill="#5ba0e0" stroke={palette.stroke} strokeWidth={0.5} />);
      // Small practice hoop
      add(<line key="hp-p" x1={LX[3]} y1={GROUND_Y} x2={LX[3]} y2={GROUND_Y - 60} stroke={palette.stroke} strokeWidth={2} />);
      add(<rect key="hp-b" x={LX[3] - 18} y={GROUND_Y - 64} width={22} height={14} fill="#fff" stroke={palette.stroke} strokeWidth={0.5} />);
      add(<circle key="hp-r" cx={LX[3] - 10} cy={GROUND_Y - 50} r={6} fill="none" stroke="#e14b5a" strokeWidth={1.6} />);
    }

    if (lvl >= 2) {
      // Portable bleachers left
      add(<Building x={LX[1]} baseY={GROUND_Y} w={140} h={40} palette={palette} roofColor="#9c7040" windows={false} />);
      // Tennis wall right
      add(<Building x={RX[1]} baseY={GROUND_Y} w={80} h={70} palette={palette} roofColor="#b56b42" winCols={2} winRows={2} />);
      // Trash bins
      [LX[4] + 20, RX[0] + 80].forEach((x, i) =>
        add(<rect key={`tb-${i}`} x={x} y={GROUND_Y - 18} width={12} height={18} fill="#2d3a4f" stroke={palette.stroke} strokeWidth={0.4} />)
      );
      // Light mast
      [LX[3], RX[3] + 20].forEach((x, i) => {
        add(<line key={`lm-${i}`} x1={x} y1={GROUND_Y} x2={x} y2={GROUND_Y - 140} stroke={palette.stroke} strokeWidth={2.4} />);
        add(<rect key={`lmh-${i}`} x={x - 14} y={GROUND_Y - 144} width={28} height={8} fill="#f5f3c8" stroke={palette.stroke} strokeWidth={0.4} />);
      });
    }

    if (lvl >= 3) {
      // Parking cars on left
      [LX[0] + 20, LX[0] + 100, LX[1] + 20, LX[1] + 100, LX[2] + 20].forEach((x, i) =>
        add(<Car key={`sp-pc-${i}`} x={x} y={GROUND_Y + 26} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0"][i]} palette={palette} />)
      );
      // Ticket booth on right
      add(<Building x={RX[0]} baseY={GROUND_Y} w={80} h={70} palette={palette} roofColor="#d9a441" winCols={2} winRows={1} door />);
      add(<text key="tb-t" x={RX[0] + 40} y={GROUND_Y - 78} textAnchor="middle" fontSize={12} fontWeight={800} fill={palette.stroke}>TICKETS</text>);
      // Ad banners
      add(<BillboardSign x={RX[2]} y={GROUND_Y} w={100} h={70} text="CHAMPS" color="#2d7fd4" palette={palette} />);
      add(<BillboardSign x={LX[4] - 30} y={GROUND_Y} w={90} h={60} text="WIN" color="#e14b5a" palette={palette} />);
    }

    if (lvl >= 4) {
      // Street basketball court on left
      add(<rect key="bb" x={LX[1]} y={GROUND_Y - 60} width={130} height={60} fill="#b46a3b" stroke="#fff" strokeWidth={1} />);
      add(<line key="bb-l" x1={LX[1] + 65} y1={GROUND_Y - 60} x2={LX[1] + 65} y2={GROUND_Y} stroke="#fff" strokeWidth={0.8} />);
      // Pool on right
      add(<rect key="pl" x={RX[1]} y={GROUND_Y - 40} width={140} height={40} fill={palette.water} stroke={palette.stroke} strokeWidth={0.8} rx={4} />);
      [0, 1].forEach(k => add(<rect key={`pll-${k}`} x={RX[1]} y={GROUND_Y - 30 + k * 14} width={140} height={1.2} fill="#fff" opacity={0.6} />));
      // Food trucks
      add(<FoodTruck x={LX[4] - 40} y={GROUND_Y} color="#e14b5a" palette={palette} />);
      add(<FoodTruck x={RX[4] - 20} y={GROUND_Y} color="#4fa85e" palette={palette} />);
    }

    if (lvl >= 5) {
      // Multi-level parking
      [0, 1, 2, 3].forEach(k =>
        add(<rect key={`mlp-${k}`} x={LX[0]} y={GROUND_Y - 50 - k * 40} width={280} height={40} fill="#8a97ac" stroke={palette.stroke} strokeWidth={0.6} />)
      );
      [0, 1, 2].forEach(k =>
        [0, 1, 2, 3, 4, 5].forEach(c =>
          add(<rect key={`mlp-c-${k}-${c}`} x={LX[0] + 20 + c * 42} y={GROUND_Y - 44 - k * 40} width={30} height={18} fill="#111" />)
        )
      );
      // Giant LED on right
      add(<LEDPanel x={RX[1]} y={GROUND_Y - 180} w={180} h={120} palette={palette} />);
      // Helipad on roof of LED support
      add(<circle cx={RX[4] - 20} cy={GROUND_Y - 120} r={22} fill="#e14b5a" stroke="#fff" strokeWidth={1.5} />);
      add(<text x={RX[4] - 20} y={GROUND_Y - 114} textAnchor="middle" fontSize={22} fontWeight={900} fill="#fff">H</text>);
    }
  }

  if (id === "business") {
    if (lvl === 0) {
      add(<ConstructionFence x={LX[0]} y={GROUND_Y} w={280} palette={palette} />);
      add(<ConstructionFence x={RX[1]} y={GROUND_Y} w={260} palette={palette} />);
      // FOR SALE sign
      add(<line key="fs" x1={LX[4]} y1={GROUND_Y} x2={LX[4]} y2={GROUND_Y - 60} stroke={palette.stroke} strokeWidth={2} />);
      add(<rect key="fsb" x={LX[4] - 30} y={GROUND_Y - 80} width={60} height={22} fill="#fff" stroke={palette.stroke} strokeWidth={0.6} />);
      add(<text key="fst" x={LX[4]} y={GROUND_Y - 64} textAnchor="middle" fontSize={10} fontWeight={700} fill={palette.stroke}>FOR SALE</text>);
      // Dumpster
      add(<rect key="dm" x={RX[0] + 20} y={GROUND_Y - 26} width={50} height={26} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.5} />);
      // Lamppost
      add(<Lamp x={LX[2]} y={GROUND_Y} palette={palette} />);
    }

    if (lvl >= 1) {
      // Small shops
      add(<SmallBuilding x={LX[0]} w={130} h={80} color="#d0829d" palette={palette} />);
      add(<SmallBuilding x={LX[1] + 10} w={130} h={70} color="#7cb0d0" palette={palette} />);
      add(<SmallBuilding x={RX[0]} w={130} h={80} color="#d0a07c" palette={palette} />);
      add(<SmallBuilding x={RX[2]} w={130} h={70} color="#f39c7a" palette={palette} />);
      // Newsstand
      add(<rect key="ns" x={LX[4] - 16} y={GROUND_Y - 34} width={32} height={34} fill="#4a5568" stroke={palette.stroke} strokeWidth={0.5} />);
      add(<rect key="ns-r" x={LX[4] - 20} y={GROUND_Y - 40} width={40} height={8} fill="#e14b5a" />);
    }

    if (lvl >= 2) {
      // Mid-rise offices
      add(<Building x={LX[0]} baseY={GROUND_Y} w={160} h={200} palette={palette} roofColor="#2d7fd4" winCols={4} winRows={7} />);
      add(<Building x={RX[0]} baseY={GROUND_Y} w={160} h={220} palette={palette} roofColor="#3a7fd5" winCols={4} winRows={8} />);
      add(<BusStop x={LX[3] - 10} y={GROUND_Y} palette={palette} />);
      add(<BusStop x={RX[3]} y={GROUND_Y} palette={palette} />);
    }

    if (lvl >= 3) {
      // More mid-rise
      add(<Building x={LX[2]} baseY={GROUND_Y} w={140} h={240} palette={palette} roofColor="#1e5ea8" winCols={4} winRows={8} />);
      add(<Building x={RX[2] + 10} baseY={GROUND_Y} w={140} h={230} palette={palette} roofColor="#5ba0e0" winCols={4} winRows={8} />);
      // Sculpture
      add(<rect key="sc" x={LX[4] - 20} y={GROUND_Y - 80} width={20} height={80} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.6} />);
      add(<circle cx={LX[4] - 10} cy={GROUND_Y - 96} r={14} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.8} />);
      // Outdoor cafe tables
      [LX[3], LX[3] + 40].forEach((x, i) => {
        add(<circle key={`ct-${i}`} cx={x} cy={GROUND_Y - 4} r={8} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.4} />);
        add(<rect key={`cu-${i}`} x={x - 1.5} y={GROUND_Y - 4} width={3} height={8} fill={palette.stroke} />);
      });
    }

    if (lvl >= 4) {
      // Glass skyscrapers
      add(<Building x={LX[0]} baseY={GROUND_Y} w={150} h={360} palette={palette} roofColor="#1e5ea8" winCols={5} winRows={14} />);
      add(<Building x={LX[2] + 20} baseY={GROUND_Y} w={150} h={400} palette={palette} roofColor="#3a7fd5" winCols={5} winRows={15} />);
      add(<Building x={RX[0] + 10} baseY={GROUND_Y} w={150} h={380} palette={palette} roofColor="#0e4080" winCols={5} winRows={14} />);
      add(<Building x={RX[2] + 20} baseY={GROUND_Y} w={150} h={360} palette={palette} roofColor="#5ba0e0" winCols={5} winRows={14} />);
      // Plaza fountain on left
      add(<ellipse key="pf" cx={LX[4]} cy={GROUND_Y + 30} rx={50} ry={10} fill={palette.water} stroke={palette.stroke} strokeWidth={0.6} />);
      add(<rect key="pfp" x={LX[4] - 6} y={GROUND_Y + 10} width={12} height={20} fill="#c9a56b" />);
    }

    if (lvl >= 5) {
      // Mega supertall towers
      [LX[0], LX[2], RX[0], RX[2]].forEach((x, i) => {
        const h = [440, 520, 480, 460][i];
        const hue = ["#0e4080", "#1e5ea8", "#2d7fd4", "#3a7fd5"][i];
        add(<Building key={`mt-${i}`} x={x} baseY={GROUND_Y} w={150} h={h} palette={palette} roofColor={hue} winCols={5} winRows={Math.round(h / 18)} />);
        add(<line key={`mt-sp-${i}`} x1={x + 75} y1={GROUND_Y - h} x2={x + 75} y2={GROUND_Y - h - 30} stroke={palette.stroke} strokeWidth={2} />);
        add(<circle key={`mt-sd-${i}`} cx={x + 75} cy={GROUND_Y - h - 30} r={3} fill="#e14b5a" />);
      });
      // Massive LED billboards
      add(<LEDPanel x={LX[1]} y={GROUND_Y - 360} w={140} h={80} palette={palette} />);
      add(<LEDPanel x={RX[1] + 10} y={GROUND_Y - 340} w={140} h={90} palette={palette} />);
      // Subway entrance
      add(<SubwayEntrance x={LX[4] - 30} y={GROUND_Y} palette={palette} />);
      // Hot-dog cart
      add(<HotDogCart x={RX[4] - 60} y={GROUND_Y} palette={palette} />);
      // Taxi cars
      [LX[1] + 60, LX[3] + 40, RX[1] + 60, RX[3] + 20].forEach((x, i) =>
        add(<Car key={`tax-${i}`} x={x} y={GROUND_Y + 72} color="#f5c84b" palette={palette} />)
      );
    }
  }

  if (id === "park") {
    // Always: wild nature
    [LX[0], LX[2] + 30, RX[1], RX[3] + 30].forEach((x, i) => add(<Tree key={`pw-${i}`} x={x} y={GROUND_Y} size={1} palette={palette} />));
    add(<ellipse key="rock1" cx={LX[1]} cy={GROUND_Y - 4} rx={30} ry={10} fill="#8a857c" stroke={palette.stroke} strokeWidth={0.6} />);
    add(<ellipse key="rock2" cx={RX[2]} cy={GROUND_Y - 4} rx={24} ry={8} fill="#a3998c" stroke={palette.stroke} strokeWidth={0.5} />);
    // Wildflowers
    for (let i = 0; i < 8; i++) {
      add(<Flower key={`wfl-${i}`} x={LX[0] + i * 90} y={GROUND_Y + 6} color={["#e14b5a", "#f5c84b", "#b57cd0"][i % 3]} palette={palette} />);
      add(<Flower key={`wfr-${i}`} x={RX[0] + i * 90} y={GROUND_Y + 6} color={["#f39c7a", "#4fa85e", "#5ba0e0"][i % 3]} palette={palette} />);
    }
    // Fallen log
    add(<rect key="log" x={LX[3]} y={GROUND_Y - 8} width={80} height={12} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.5} />);
    // Rabbits
    add(<Rabbit x={LX[4] - 30} y={GROUND_Y + 2} palette={palette} />);
    add(<Rabbit x={RX[4] - 10} y={GROUND_Y + 2} palette={palette} />);

    if (lvl >= 1) {
      // Signpost
      add(<line key="sgp" x1={LX[2]} y1={GROUND_Y} x2={LX[2]} y2={GROUND_Y - 70} stroke="#6a4a2c" strokeWidth={3} />);
      add(<rect key="sgr" x={LX[2] - 30} y={GROUND_Y - 74} width={60} height={18} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.5} />);
      add(<text key="sgt" x={LX[2]} y={GROUND_Y - 62} textAnchor="middle" fontSize={11} fontWeight={700} fill={palette.stroke}>PARK</text>);
      // Picnic table
      add(<rect key="pt-s" x={RX[0]} y={GROUND_Y - 10} width={80} height={6} fill="#8b6a3a" stroke={palette.stroke} strokeWidth={0.4} />);
      add(<rect key="pt-l1" x={RX[0] + 6} y={GROUND_Y - 4} width={6} height={8} fill="#8b6a3a" />);
      add(<rect key="pt-l2" x={RX[0] + 68} y={GROUND_Y - 4} width={6} height={8} fill="#8b6a3a" />);
      // Bird bath
      add(<rect key="bb-b" x={LX[0] + 50} y={GROUND_Y - 10} width={14} height={16} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.4} />);
      add(<ellipse key="bb-t" cx={LX[0] + 57} cy={GROUND_Y - 12} rx={16} ry={4} fill={palette.water} stroke={palette.stroke} strokeWidth={0.4} />);
      add(<Bench x={RX[3]} y={GROUND_Y + 10} palette={palette} />);
    }

    if (lvl >= 2) {
      // More benches + lamps
      add(<Bench x={LX[1]} y={GROUND_Y + 10} palette={palette} />);
      add(<Bench x={RX[1] + 30} y={GROUND_Y + 10} palette={palette} />);
      add(<Lamp x={LX[3] - 10} y={GROUND_Y} palette={palette} />);
      add(<Lamp x={RX[2] + 40} y={GROUND_Y} palette={palette} />);
      // Flower patches
      for (let i = 0; i < 5; i++) {
        add(<Flower key={`mfl-${i}`} x={LX[4] - 40 + i * 12} y={GROUND_Y + 4} color={["#e14b5a", "#f5c84b", "#b57cd0"][i % 3]} palette={palette} />);
      }
      add(<Bush x={LX[0] + 150} y={GROUND_Y} size={1} palette={palette} />);
      add(<Bush x={RX[3]} y={GROUND_Y} size={1} palette={palette} />);
    }

    if (lvl >= 3) {
      // Playground on left
      add(<line key="sw-p1" x1={LX[1] - 20} y1={GROUND_Y} x2={LX[1] - 20} y2={GROUND_Y - 50} stroke="#8b6a3a" strokeWidth={3} />);
      add(<line key="sw-p2" x1={LX[1] + 40} y1={GROUND_Y} x2={LX[1] + 40} y2={GROUND_Y - 50} stroke="#8b6a3a" strokeWidth={3} />);
      add(<line key="sw-b" x1={LX[1] - 20} y1={GROUND_Y - 50} x2={LX[1] + 40} y2={GROUND_Y - 50} stroke="#8b6a3a" strokeWidth={3} />);
      // Climber
      add(<rect key="cl-b" x={LX[2] - 10} y={GROUND_Y - 60} width={60} height={60} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.6} />);
      [0, 1, 2, 3].forEach(k => add(<line key={`cl-r-${k}`} x1={LX[2] - 10} y1={GROUND_Y - 50 + k * 15} x2={LX[2] + 50} y2={GROUND_Y - 50 + k * 15} stroke={palette.stroke} strokeWidth={0.4} />));
      // Pavilion right
      add(<Building x={RX[1]} baseY={GROUND_Y} w={100} h={50} palette={palette} roofColor="#c9a56b" winCols={2} winRows={1} windows={false} />);
      add(<polygon points={`${RX[1] - 6},${GROUND_Y - 50} ${RX[1] + 106},${GROUND_Y - 50} ${RX[1] + 50},${GROUND_Y - 76}`} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.7} />);
    }

    if (lvl >= 4) {
      // Greenhouse on left
      add(<rect key="gh-b" x={LX[0]} y={GROUND_Y - 80} width={170} height={80} fill="#c6e4df" stroke={palette.stroke} strokeWidth={1} />);
      add(<polygon points={`${LX[0] - 6},${GROUND_Y - 80} ${LX[0] + 176},${GROUND_Y - 80} ${LX[0] + 85},${GROUND_Y - 120}`} fill="#9dc8c2" stroke={palette.stroke} strokeWidth={0.8} />);
      for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++)
        add(<rect key={`gh-w-${r}-${c}`} x={LX[0] + 6 + c * 32} y={GROUND_Y - 74 + r * 22} width={28} height={18} fill="#a3cbc6" stroke={palette.stroke} strokeWidth={0.3} />);
      // Amphitheater tiers right
      [[RX[1] + 10, GROUND_Y, 160], [RX[1] + 4, GROUND_Y - 8, 172], [RX[1] - 2, GROUND_Y - 16, 184]].forEach(([x, y, w], i) =>
        add(<rect key={`at-${i}`} x={x} y={y} width={w} height={7} fill="#c2a878" stroke={palette.stroke} strokeWidth={0.4} />)
      );
      // Rose garden (dense flowers) center-band
      for (let i = 0; i < 12; i++) add(<Flower key={`rg-${i}`} x={LX[3] + i * 16} y={GROUND_Y + 4} color={["#e14b5a", "#f5c84b"][i % 2]} palette={palette} />);
    }

    if (lvl >= 5) {
      // Big lake extending
      add(<ellipse key="bl" cx={LX[2]} cy={GROUND_Y - 10} rx={260} ry={22} fill={palette.water} stroke={palette.stroke} strokeWidth={0.8} />);
      // Boats
      [[LX[2] - 60, GROUND_Y - 12], [LX[2] + 20, GROUND_Y - 8], [LX[2] + 80, GROUND_Y - 14]].forEach(([x, y], i) => {
        add(<ellipse key={`b5-${i}`} cx={x} cy={y} rx={20} ry={6} fill="#c9a56b" stroke={palette.stroke} strokeWidth={0.5} />);
        add(<line key={`b5-s-${i}`} x1={x} y1={y} x2={x + 4} y2={y - 24} stroke={palette.stroke} strokeWidth={1} />);
        add(<polygon key={`b5-f-${i}`} points={`${x + 4},${y - 24} ${x + 20},${y - 14} ${x + 4},${y - 8}`} fill="#fff" stroke={palette.stroke} strokeWidth={0.5} />);
      });
      // Bandshell on right
      add(<path key="bs5" d={`M ${RX[1]} ${GROUND_Y} Q ${RX[1] + 70} ${GROUND_Y - 90} ${RX[1] + 140} ${GROUND_Y} Z`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={0.8} />);
      add(<rect key="bs5-f" x={RX[1] + 40} y={GROUND_Y - 20} width={60} height={20} fill="#333" />);
      // Carousel on far right
      add(<circle key="cr5" cx={RX[3] + 40} cy={GROUND_Y - 40} r={42} fill="#e14b5a" stroke={palette.stroke} strokeWidth={1} />);
      add(<polygon key="cr5-r" points={`${RX[3]},${GROUND_Y - 62} ${RX[3] + 80},${GROUND_Y - 62} ${RX[3] + 40},${GROUND_Y - 108}`} fill="#f5c84b" stroke={palette.stroke} strokeWidth={1} />);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        add(<line key={`cr5s-${i}`} x1={RX[3] + 40} y1={GROUND_Y - 40} x2={RX[3] + 40 + Math.cos(a) * 36} y2={GROUND_Y - 40 + Math.sin(a) * 10} stroke="#fff" strokeWidth={0.8} />);
      }
      // Statue far left
      add(<rect key="st5-p" x={LX[0] - 10} y={GROUND_Y - 80} width={24} height={80} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.5} />);
      add(<circle cx={LX[0] + 2} cy={GROUND_Y - 92} r={10} fill="#b5a890" stroke={palette.stroke} strokeWidth={0.5} />);
      // Food cart
      add(<HotDogCart x={LX[4] - 30} y={GROUND_Y} palette={palette} />);
    }
  }

  if (id === "square") {
    if (lvl === 0) {
      add(<Cart x={LX[1]} y={GROUND_Y} palette={palette} />);
      add(<ChickenCoop x={RX[1]} y={GROUND_Y} palette={palette} />);
      add(<Haybale key="sqh1" x={LX[3]} y={GROUND_Y + 4} palette={palette} />);
      add(<Haybale key="sqh2" x={RX[3] + 30} y={GROUND_Y + 4} palette={palette} />);
      // Well
      add(<rect key="wl" x={LX[4] - 20} y={GROUND_Y - 24} width={36} height={24} fill="#7a6a55" stroke={palette.stroke} strokeWidth={0.5} />);
      add(<polygon points={`${LX[4] - 24},${GROUND_Y - 24} ${LX[4] + 20},${GROUND_Y - 24} ${LX[4] - 2},${GROUND_Y - 44}`} fill="#6a3f24" stroke={palette.stroke} strokeWidth={0.5} />);
      // Fence
      add(<Fence x1={LX[0] - 30} x2={LX[2] + 50} y={GROUND_Y} palette={palette} />);
    }

    if (lvl >= 1) {
      // Market stalls
      add(<MarketStall x={LX[0]} y={GROUND_Y} color="#e14b5a" palette={palette} />);
      add(<MarketStall x={LX[1] + 10} y={GROUND_Y} color="#f5c84b" palette={palette} />);
      add(<MarketStall x={LX[3]} y={GROUND_Y} color="#4fa85e" palette={palette} />);
      add(<MarketStall x={RX[0]} y={GROUND_Y} color="#b57cd0" palette={palette} />);
      add(<MarketStall x={RX[2]} y={GROUND_Y} color="#5ba0e0" palette={palette} />);
      // Vendors (silhouettes)
      [LX[0] + 80, LX[1] + 90, LX[3] + 80, RX[0] + 80, RX[2] + 80].forEach((x, i) =>
        add(<PersonSilhouette key={`vn-${i}`} x={x} y={GROUND_Y} color="#8a6a3a" palette={palette} />)
      );
    }

    if (lvl >= 2) {
      // Town hall on left, post office on right
      add(<Building x={LX[0]} baseY={GROUND_Y} w={180} h={140} palette={palette} roofColor="#e5d1a4" winCols={4} winRows={3} door />);
      add(<polygon points={`${LX[0] - 10},${GROUND_Y - 140} ${LX[0] + 190},${GROUND_Y - 140} ${LX[0] + 90},${GROUND_Y - 186}`} fill="#5a3124" stroke={palette.stroke} strokeWidth={0.8} />);
      add(<text x={LX[0] + 90} y={GROUND_Y - 100} textAnchor="middle" fontSize={12} fontWeight={800} fill={palette.stroke}>TOWN HALL</text>);
      add(<Building x={RX[2]} baseY={GROUND_Y} w={160} h={120} palette={palette} roofColor="#b58a5a" winCols={3} winRows={3} door />);
      add(<rect key="po-s" x={RX[2] + 20} y={GROUND_Y - 138} width={120} height={12} fill="#111" />);
      add(<text x={RX[2] + 80} y={GROUND_Y - 129} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f5c84b">POST</text>);
      // Cobblestone pattern
      for (let i = 0; i < 14; i++) add(<line key={`cb-${i}`} x1={LX[2] + i * 30} y1={GROUND_Y + 12} x2={LX[2] + i * 30} y2={GROUND_Y + 40} stroke={palette.stroke} strokeWidth={0.3} opacity={0.5} />);
    }

    if (lvl >= 3) {
      // Statue on pedestal left
      add(<rect key="st-p" x={LX[4] - 12} y={GROUND_Y - 60} width={24} height={60} fill="#c9bda6" stroke={palette.stroke} strokeWidth={0.6} />);
      add(<circle cx={LX[4]} cy={GROUND_Y - 72} r={12} fill="#b5a890" stroke={palette.stroke} strokeWidth={0.6} />);
      // Library on right
      add(<Building x={RX[0]} baseY={GROUND_Y} w={180} h={140} palette={palette} roofColor="#d4b78a" winCols={4} winRows={4} door />);
      add(<text x={RX[0] + 90} y={GROUND_Y - 110} textAnchor="middle" fontSize={12} fontWeight={800} fill={palette.stroke}>LIBRARY</text>);
      // Food kiosks
      add(<SmallBuilding x={LX[2]} w={80} h={50} color="#e14b5a" palette={palette} windows={false} />);
      add(<SmallBuilding x={LX[2] + 90} w={80} h={50} color="#4fa85e" palette={palette} windows={false} />);
      // Street performer
      add(<PersonSilhouette x={LX[3] + 40} y={GROUND_Y} color="#f5c84b" palette={palette} />);
      add(<circle cx={LX[3] + 50} cy={GROUND_Y - 30} r={4} fill="#f5c84b" />);
    }

    if (lvl >= 4) {
      // Triumphal arch right
      add(<rect key="ar-l" x={RX[1]} y={GROUND_Y - 160} width={30} height={160} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.8} />);
      add(<rect key="ar-r" x={RX[1] + 120} y={GROUND_Y - 160} width={30} height={160} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.8} />);
      add(<rect key="ar-t" x={RX[1]} y={GROUND_Y - 180} width={150} height={20} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.8} />);
      add(<text x={RX[1] + 75} y={GROUND_Y - 165} textAnchor="middle" fontSize={10} fontWeight={800} fill={palette.stroke}>MCMXX</text>);
      // Multi-tier fountain left
      add(<ellipse key="mtf-1" cx={LX[1]} cy={GROUND_Y + 10} rx={60} ry={10} fill={palette.water} stroke={palette.stroke} strokeWidth={0.6} />);
      add(<rect key="mtf-2" x={LX[1] - 20} y={GROUND_Y - 50} width={40} height={60} fill="#d9a441" stroke={palette.stroke} strokeWidth={0.6} />);
      // Columns
      [LX[3], RX[3]].forEach((x, i) => {
        add(<rect key={`co-${i}`} x={x - 8} y={GROUND_Y - 120} width={16} height={120} fill="#e8e0cf" stroke={palette.stroke} strokeWidth={0.6} />);
        add(<rect key={`co-c-${i}`} x={x - 14} y={GROUND_Y - 124} width={28} height={6} fill="#e8e0cf" />);
      });
      // Carriage
      add(<Carriage x={LX[2] + 40} y={GROUND_Y} palette={palette} />);
    }

    if (lvl >= 5) {
      // Double-decker bus
      add(<DoubleDeckerBus x={LX[4] - 60} y={GROUND_Y + 66} palette={palette} />);
      // Subway entrances
      add(<SubwayEntrance x={LX[1] + 20} y={GROUND_Y} palette={palette} />);
      add(<SubwayEntrance x={RX[3] - 20} y={GROUND_Y} palette={palette} />);
      // Hot-dog carts
      add(<HotDogCart x={LX[2] - 20} y={GROUND_Y} palette={palette} />);
      add(<HotDogCart x={RX[2] + 10} y={GROUND_Y} palette={palette} />);
      // Tourists — dense crowd
      for (let i = 0; i < 18; i++)
        add(<PersonSilhouette key={`ts-${i}`} x={LX[0] + i * 90} y={GROUND_Y + 28} color={["#e14b5a", "#2d7fd4", "#4fa85e", "#f5c84b", "#b57cd0"][i % 5]} palette={palette} />);
    }
  }

  if (id === "residential") {
    if (lvl === 0) {
      // Log cabin
      add(<PitchedHouse x={LX[1]} baseY={GROUND_Y} w={100} h={80} palette={palette} wallColor="#8a5a2a" roofColor="#6a3f24" />);
      // Wood pile
      [0, 1, 2].forEach(k =>
        add(<rect key={`wp-${k}`} x={LX[2] + 20} y={GROUND_Y - 6 - k * 6} width={40} height={6} fill="#8a6a3a" stroke={palette.stroke} strokeWidth={0.4} />)
      );
      add(<ChickenCoop x={LX[3] + 10} y={GROUND_Y} palette={palette} />);
      // Outhouse
      add(<rect key="oh" x={LX[4]} y={GROUND_Y - 36} width={30} height={36} fill="#8a4b2b" stroke={palette.stroke} strokeWidth={0.5} />);
      add(<polygon points={`${LX[4] - 3},${GROUND_Y - 36} ${LX[4] + 33},${GROUND_Y - 36} ${LX[4] + 15},${GROUND_Y - 46}`} fill="#6a3f24" />);
      // Vegetable garden on right
      for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) {
        add(<rect key={`vg-${r}-${c}`} x={RX[0] + 10 + c * 24} y={GROUND_Y - 12 + r * 8} width={20} height={5} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.3} />);
        add(<circle cx={RX[0] + 20 + c * 24} cy={GROUND_Y - 10 + r * 8} r={2} fill={palette.leaf} />);
      }
      add(<PitchedHouse x={RX[2]} baseY={GROUND_Y} w={90} h={70} palette={palette} wallColor="#a98060" roofColor="#6a3f24" />);
    }

    if (lvl >= 1) {
      // Wooden houses with fences
      add(<PitchedHouse x={LX[0]} baseY={GROUND_Y} w={140} h={100} palette={palette} wallColor="#b58a5a" roofColor="#6a3f24" />);
      add(<PitchedHouse x={LX[2]} baseY={GROUND_Y} w={140} h={110} palette={palette} wallColor="#c9a56b" roofColor="#6a3f24" />);
      add(<PitchedHouse x={RX[0]} baseY={GROUND_Y} w={140} h={100} palette={palette} wallColor="#a98060" roofColor="#6a3f24" />);
      add(<PitchedHouse x={RX[2]} baseY={GROUND_Y} w={140} h={110} palette={palette} wallColor="#b58a5a" roofColor="#6a3f24" />);
      // Mailboxes
      [LX[0] + 120, LX[2] + 120, RX[0] + 120, RX[2] + 120].forEach((x, i) => {
        add(<line key={`mbp-${i}`} x1={x} y1={GROUND_Y} x2={x} y2={GROUND_Y - 20} stroke={palette.stroke} strokeWidth={1.2} />);
        add(<rect key={`mbb-${i}`} x={x - 6} y={GROUND_Y - 26} width={12} height={8} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.4} />);
      });
      // Clothesline
      add(<line key="cl" x1={LX[1] + 150} y1={GROUND_Y - 40} x2={LX[2]} y2={GROUND_Y - 40} stroke={palette.stroke} strokeWidth={0.8} />);
      [0, 1, 2].forEach(k => add(<rect key={`cl-${k}`} x={LX[1] + 160 + k * 15} y={GROUND_Y - 40} width={10} height={12} fill={["#e14b5a", "#2d7fd4", "#f5c84b"][k]} />));
      // Fences
      add(<Fence x1={LX[0] - 10} x2={LX[0] + 150} y={GROUND_Y + 30} palette={palette} />);
      add(<Fence x1={RX[0] - 10} x2={RX[0] + 150} y={GROUND_Y + 30} palette={palette} />);
    }

    if (lvl >= 2) {
      // Brick houses with garages + cars
      add(<PitchedHouse x={LX[0]} baseY={GROUND_Y} w={180} h={130} palette={palette} wallColor="#c88b6a" roofColor="#6a3f24" />);
      add(<rect key="gr1" x={LX[0] + 120} y={GROUND_Y - 50} width={60} height={50} fill="#666" stroke={palette.stroke} strokeWidth={0.6} />);
      add(<rect key="gr1-d" x={LX[0] + 124} y={GROUND_Y - 46} width={52} height={46} fill="#444" />);
      add(<Car x={LX[0] + 150} y={GROUND_Y + 20} color="#5ba0e0" palette={palette} />);
      add(<PitchedHouse x={LX[2]} baseY={GROUND_Y} w={180} h={140} palette={palette} wallColor="#b58a5a" roofColor="#6a3f24" />);
      add(<rect key="gr2" x={LX[2] + 120} y={GROUND_Y - 50} width={60} height={50} fill="#666" stroke={palette.stroke} strokeWidth={0.6} />);
      add(<rect key="gr2-d" x={LX[2] + 124} y={GROUND_Y - 46} width={52} height={46} fill="#444" />);
      add(<Car x={LX[2] + 150} y={GROUND_Y + 20} color="#e14b5a" palette={palette} />);
      add(<PitchedHouse x={RX[0]} baseY={GROUND_Y} w={180} h={140} palette={palette} wallColor="#a98060" roofColor="#6a3f24" />);
      add(<Car x={RX[0] + 80} y={GROUND_Y + 20} color="#4fa85e" palette={palette} />);
      add(<PitchedHouse x={RX[2]} baseY={GROUND_Y} w={180} h={130} palette={palette} wallColor="#c9a56b" roofColor="#6a3f24" />);
      add(<Car x={RX[2] + 80} y={GROUND_Y + 20} color="#f5c84b" palette={palette} />);
      // BBQ
      add(<rect key="bq" x={LX[4] - 10} y={GROUND_Y - 14} width={20} height={14} fill="#2a2f3a" stroke={palette.stroke} strokeWidth={0.4} />);
      add(<rect key="bq-g" x={LX[4] - 12} y={GROUND_Y - 18} width={24} height={4} fill="#e14b5a" />);
      // Bushes
      [LX[0] + 30, LX[2] + 30, RX[0] + 30, RX[2] + 30].forEach((x, i) => add(<Bush key={`bs-${i}`} x={x} y={GROUND_Y + 4} size={0.9} palette={palette} />));
    }

    if (lvl >= 3) {
      // Townhouse rows
      const colors = ["#b57cd0", "#d0829d", "#7cb0d0", "#d0a07c", "#8a7cd0"];
      [0, 1, 2, 3].forEach(i =>
        add(<Building key={`thl-${i}`} x={LX[0] + i * 70} baseY={GROUND_Y} w={65} h={180} palette={palette} roofColor={colors[i]} winCols={2} winRows={4} door />)
      );
      [0, 1, 2, 3].forEach(i =>
        add(<Building key={`thr-${i}`} x={RX[0] + i * 70} baseY={GROUND_Y} w={65} h={180} palette={palette} roofColor={colors[(i + 2) % colors.length]} winCols={2} winRows={4} door />)
      );
      // Community garden center
      for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) {
        add(<rect key={`cg-${r}-${c}`} x={LX[4] - 60 + c * 20} y={GROUND_Y - 12 + r * 6} width={16} height={4} fill="#6a4a2c" stroke={palette.stroke} strokeWidth={0.3} />);
      }
      // Corner shop
      add(<SmallBuilding x={RX[3] + 10} w={100} h={80} color="#d9a441" palette={palette} />);
      add(<rect key="cs-s" x={RX[3] + 10} y={GROUND_Y - 92} width={100} height={10} fill="#111" />);
      add(<text x={RX[3] + 60} y={GROUND_Y - 84} textAnchor="middle" fontSize={8} fontWeight={800} fill="#f5c84b">SHOP</text>);
    }

    if (lvl >= 4) {
      // Mid-rise apartments
      [LX[0], LX[2] + 20].forEach((x, i) =>
        add(<Building key={`ma-${i}`} x={x} baseY={GROUND_Y} w={160} h={300} palette={palette} roofColor={["#b57cd0", "#7cb0d0"][i]} winCols={5} winRows={10} door />)
      );
      [RX[0], RX[2] + 10].forEach((x, i) =>
        add(<Building key={`mar-${i}`} x={x} baseY={GROUND_Y} w={160} h={300} palette={palette} roofColor={["#d0829d", "#d0a07c"][i]} winCols={5} winRows={10} door />)
      );
      // Pool with loungers
      add(<rect key="pl4" x={LX[4] - 40} y={GROUND_Y - 30} width={100} height={30} fill={palette.water} stroke={palette.stroke} strokeWidth={0.6} rx={4} />);
      [0, 1, 2].forEach(k => add(<rect key={`lnz-${k}`} x={LX[4] - 38 + k * 30} y={GROUND_Y - 4} width={24} height={5} fill="#e14b5a" stroke={palette.stroke} strokeWidth={0.3} />));
    }

    if (lvl >= 5) {
      // Hi-rise towers
      [LX[0], LX[2] + 20, RX[0] + 20, RX[3] - 60].forEach((x, i) => {
        const h = [420, 480, 440, 460][i];
        const hue = ["#7cb0d0", "#b57cd0", "#d0829d", "#8a7cd0"][i];
        add(<Building key={`hr-${i}`} x={x} baseY={GROUND_Y} w={180} h={h} palette={palette} roofColor={hue} winCols={6} winRows={Math.round(h / 20)} />);
        // Rooftop garden cap
        add(<rect key={`rg-${i}`} x={x + 10} y={GROUND_Y - h - 10} width={160} height={10} fill={palette.leaf} stroke={palette.stroke} strokeWidth={0.4} />);
      });
      // Rooftop pool on first
      add(<rect key="rpp" x={LX[0] + 40} y={GROUND_Y - 436} width={120} height={6} fill={palette.water} stroke={palette.stroke} strokeWidth={0.4} />);
      // EV chargers
      [LX[4] - 60, LX[4] - 20, RX[4] - 40].forEach((x, i) =>
        add(<rect key={`ev-${i}`} x={x} y={GROUND_Y - 24} width={10} height={24} fill="#4fa85e" stroke={palette.stroke} strokeWidth={0.4} />)
      );
      // Concierge entrance
      add(<polygon key="ce" points={`${LX[4] + 40},${GROUND_Y - 30} ${LX[4] + 130},${GROUND_Y - 30} ${LX[4] + 120},${GROUND_Y} ${LX[4] + 50},${GROUND_Y}`} fill="#333" stroke={palette.stroke} strokeWidth={0.6} />);
      // Landscape trees
      [LX[1] + 20, LX[3] + 40, RX[1] + 30, RX[3] - 30].forEach((x, i) => add(<Tree key={`lt5-${i}`} x={x} y={GROUND_Y + 34} size={0.7} palette={palette} />));
    }
  }

  return n;
}

const RENDERERS = {
  sport: SportDistrict,
  business: BusinessDistrict,
  park: ParkDistrict,
  square: SquareDistrict,
  residential: ResidentialDistrict
};

export default function DistrictView({ districtId, level = 0, preserveAspectRatio = "xMidYMid meet" }) {
  const palette = useDistrictPalette();
  const Renderer = RENDERERS[districtId] || RENDERERS.sport;
  const lvl = Math.max(0, Math.min(5, Math.floor(Number(level) || 0)));
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio={preserveAspectRatio}
      style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}
      aria-label={`${districtId} district detail`}
    >
      <SkyAndGround palette={palette} />
      <Weather palette={palette} />
      {renderSideDecor(districtId, lvl, palette)}
      <Renderer level={lvl} palette={palette} />
      <WalkingPeople level={lvl} districtId={districtId} palette={palette} />
      <DrivingCars   level={lvl} districtId={districtId} palette={palette} />
    </svg>
  );
}
