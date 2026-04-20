import { useTheme } from "../ThemeContext";

const DISTRICTS = [
  { id: "sport",       col: 0, row: 0 },
  { id: "business",    col: 1, row: 0 },
  { id: "residential", col: 2, row: 0 },
  { id: "park",        col: 0, row: 1 },
  { id: "square",      col: 1, row: 1 }
];

const TILE_W = 260;
const TILE_H = 150;
const ISO_X = TILE_W / 2;
const ISO_Y = TILE_H / 2;

function isoProject(col, row) {
  const x = (col - row) * ISO_X;
  const y = (col + row) * ISO_Y;
  return { x, y };
}

function diamondPath(cx, cy, w, h) {
  const hw = w / 2;
  const hh = h / 2;
  return `M ${cx} ${cy - hh} L ${cx + hw} ${cy} L ${cx} ${cy + hh} L ${cx - hw} ${cy} Z`;
}

function DistrictPlot({ district, level, palette, t, isSelected, onClick }) {
  const { x, y } = isoProject(district.col, district.row);
  const cx = x;
  const cy = y;

  const plotFill = level === 0 ? palette.emptyPlot : palette.plotByLevel(level);
  const roofFill = palette.roofByLevel(level);

  const buildings = [];
  const count = Math.max(1, level + (district.id === "park" || district.id === "square" ? 0 : 1));
  const isGreen = district.id === "park" || district.id === "square";

  for (let i = 0; i < count; i++) {
    const bx = cx - 55 + (i * 28) + (i % 2 === 0 ? 0 : 8);
    const by = cy - 6 - (i * 4);
    const bh = isGreen ? 8 + level * 2 : 14 + level * 10 + (i * 3);
    const bw = isGreen ? 16 : 22;
    buildings.push(
      <g key={i}>
        <rect
          x={bx - bw / 2}
          y={by - bh}
          width={bw}
          height={bh}
          fill={isGreen ? palette.greenBuilding : roofFill}
          stroke={palette.stroke}
          strokeWidth={0.6}
          rx={2}
        />
        {!isGreen && level >= 2 && (
          <rect x={bx - bw / 2 + 3} y={by - bh + 4} width={bw - 6} height={2} fill={palette.windowGlow} />
        )}
        {!isGreen && level >= 3 && (
          <rect x={bx - bw / 2 + 3} y={by - bh + 9} width={bw - 6} height={2} fill={palette.windowGlow} />
        )}
      </g>
    );
  }

  // District-specific accent mark
  const accents = {
    sport:       (<circle cx={cx + 50} cy={cy - 2} r={6 + level} fill={palette.sportAccent} opacity={0.85} />),
    business:    (<polygon points={`${cx + 50},${cy - 30} ${cx + 55},${cy - 5} ${cx + 45},${cy - 5}`} fill={palette.bizAccent} />),
    park:        (<g><circle cx={cx + 40} cy={cy - 4} r={10 + level} fill={palette.parkAccent} /><circle cx={cx + 55} cy={cy - 2} r={7 + level} fill={palette.parkAccent} /></g>),
    square:      (<circle cx={cx + 45} cy={cy - 2} r={5 + level} fill={palette.squareAccent} />),
    residential: (<rect x={cx + 38} y={cy - 14 - level * 2} width={14} height={14 + level * 2} fill={palette.resAccent} rx={2} />)
  };

  const label = t?.[`district${district.id.charAt(0).toUpperCase() + district.id.slice(1)}`] || district.id;

  return (
    <g
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } }}
      style={{ cursor: "pointer", outline: "none" }}
      className="city-iso-district"
    >
      <path
        d={diamondPath(cx, cy, TILE_W - 10, TILE_H - 10)}
        fill={plotFill}
        stroke={isSelected ? palette.selected : palette.stroke}
        strokeWidth={isSelected ? 2.5 : 1}
        opacity={0.95}
      />
      {level > 0 && buildings}
      {level > 0 && accents[district.id]}
      <g transform={`translate(${cx}, ${cy + TILE_H / 2 - 18})`}>
        <rect x={-60} y={-10} width={120} height={20} rx={10} fill={palette.labelBg} stroke={palette.stroke} strokeWidth={0.5} />
        <text
          x={0}
          y={4}
          textAnchor="middle"
          fontSize={11}
          fontWeight={600}
          fill={palette.labelText}
          style={{ pointerEvents: "none" }}
        >
          {label} · {level}/5
        </text>
      </g>
    </g>
  );
}

export default function CityIsometricOverview({ levels = [0, 0, 0, 0, 0], selectedIndex = -1, onDistrictClick, t }) {
  const { themeId } = useTheme();
  const isLight = themeId === "light";

  const palette = {
    ground: isLight ? "#e8ecf1" : "#1a1f2b",
    stroke: isLight ? "#3d4450" : "#0f1420",
    emptyPlot: isLight ? "#d5d8de" : "#2a3040",
    selected: "#f5c84b",
    labelBg: isLight ? "rgba(255,255,255,0.9)" : "rgba(15,20,32,0.85)",
    labelText: isLight ? "#1a1f2b" : "#e8ecf1",
    windowGlow: isLight ? "#ffd98a" : "#6cd3ff",
    greenBuilding: "#5ca867",
    sportAccent: "#e14b5a",
    bizAccent: "#2d7fd4",
    parkAccent: "#4fa85e",
    squareAccent: "#d9a441",
    resAccent: "#b57cd0",
    plotByLevel: (lvl) => {
      const base = isLight ? [210, 215, 222] : [40, 48, 64];
      const delta = lvl * (isLight ? -8 : 12);
      return `rgb(${Math.max(0, Math.min(255, base[0] + delta))}, ${Math.max(0, Math.min(255, base[1] + delta))}, ${Math.max(0, Math.min(255, base[2] + delta))})`;
    },
    roofByLevel: (lvl) => {
      const hues = ["#8a96ab", "#6b8cb8", "#5b9bd4", "#3a7fd5", "#1e5ea8", "#0e4080"];
      return hues[Math.max(0, Math.min(5, lvl))];
    }
  };

  // Compute bbox for viewBox
  const points = DISTRICTS.map((d) => isoProject(d.col, d.row));
  const minX = Math.min(...points.map((p) => p.x)) - TILE_W / 2 - 20;
  const maxX = Math.max(...points.map((p) => p.x)) + TILE_W / 2 + 20;
  const minY = Math.min(...points.map((p) => p.y)) - TILE_H / 2 - 20;
  const maxY = Math.max(...points.map((p) => p.y)) + TILE_H / 2 + 30;
  const w = maxX - minX;
  const h = maxY - minY;

  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block", background: "transparent" }}
      aria-label="City districts overview"
    >
      {/* Outer ground frame */}
      <path
        d={`M ${minX + w / 2} ${minY + 10} L ${maxX - 10} ${minY + h / 2} L ${minX + w / 2} ${maxY - 10} L ${minX + 10} ${minY + h / 2} Z`}
        fill={palette.ground}
        stroke={palette.stroke}
        strokeWidth={1}
        opacity={0.6}
      />
      {DISTRICTS.map((d, idx) => (
        <DistrictPlot
          key={d.id}
          district={d}
          level={Math.max(0, Math.min(5, Math.floor(Number(levels[idx]) || 0)))}
          palette={palette}
          t={t}
          isSelected={selectedIndex === idx}
          onClick={() => onDistrictClick?.(d.id, idx)}
        />
      ))}
    </svg>
  );
}

export { DISTRICTS };
