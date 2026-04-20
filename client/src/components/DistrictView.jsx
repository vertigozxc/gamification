import { useTheme } from "../ThemeContext";

const W = 1000;
const H = 500;
const GROUND_Y = 380;

function useDistrictPalette() {
  const { themeId } = useTheme();
  const isLight = themeId === "light";
  return {
    isLight,
    sky: isLight
      ? ["#bde3ff", "#e6f4ff", "#fff1d8"]
      : ["#0a1226", "#1a2a4a", "#2b1a3a"],
    ground: isLight ? "#9db67a" : "#2d3a1f",
    road: isLight ? "#8a8d92" : "#2a2c30",
    roadLine: isLight ? "#fff" : "#f5c84b",
    stroke: isLight ? "#2a2f3a" : "#0a0e16",
    windowOn: isLight ? "#ffd98a" : "#6cd3ff",
    windowOff: isLight ? "#b9c2cf" : "#1b2436",
    leaf: isLight ? "#3f8b4e" : "#2b6b3a",
    trunk: isLight ? "#6a4a2c" : "#3a2a1a",
    water: isLight ? "#6cc3f0" : "#2a6b9c",
    accent: "#f5c84b"
  };
}

function SkyAndGround({ palette }) {
  return (
    <g>
      <defs>
        <linearGradient id="district-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.sky[0]} />
          <stop offset="60%" stopColor={palette.sky[1]} />
          <stop offset="100%" stopColor={palette.sky[2]} />
        </linearGradient>
      </defs>
      <rect x={0} y={0} width={W} height={GROUND_Y} fill="url(#district-sky)" />
      <rect x={0} y={GROUND_Y} width={W} height={H - GROUND_Y} fill={palette.ground} />
      <rect x={0} y={GROUND_Y + 40} width={W} height={30} fill={palette.road} />
      <g>
        {Array.from({ length: 12 }).map((_, i) => (
          <rect key={i} x={40 + i * 80} y={GROUND_Y + 53} width={30} height={4} fill={palette.roadLine} />
        ))}
      </g>
    </g>
  );
}

function Building({ x, baseY, w, h, palette, windows = true, roofColor, accent }) {
  return (
    <g>
      <rect x={x} y={baseY - h} width={w} height={h} fill={roofColor || "#6b8cb8"} stroke={palette.stroke} strokeWidth={1} />
      {windows && (
        <g>
          {Array.from({ length: Math.floor(h / 22) }).map((_, row) =>
            Array.from({ length: Math.max(1, Math.floor(w / 18)) }).map((__, col) => (
              <rect
                key={`${row}-${col}`}
                x={x + 6 + col * 18}
                y={baseY - h + 10 + row * 22}
                width={10}
                height={12}
                fill={(row + col) % 3 === 0 ? palette.windowOn : palette.windowOff}
              />
            ))
          )}
        </g>
      )}
      {accent && (
        <rect x={x + w / 2 - 3} y={baseY - h - 14} width={6} height={14} fill={accent} />
      )}
    </g>
  );
}

function Tree({ x, y, size = 1, palette }) {
  const s = size;
  return (
    <g>
      <rect x={x - 3 * s} y={y - 18 * s} width={6 * s} height={18 * s} fill={palette.trunk} />
      <circle cx={x} cy={y - 26 * s} r={16 * s} fill={palette.leaf} />
      <circle cx={x - 10 * s} cy={y - 20 * s} r={11 * s} fill={palette.leaf} />
      <circle cx={x + 10 * s} cy={y - 20 * s} r={11 * s} fill={palette.leaf} />
    </g>
  );
}

function SportDistrict({ level, palette }) {
  const n = Math.max(1, level);
  return (
    <g>
      {/* Stadium */}
      {level >= 1 && (
        <g>
          <ellipse cx={500} cy={GROUND_Y - 10} rx={180} ry={40} fill="#c9cdd3" stroke={palette.stroke} />
          <ellipse cx={500} cy={GROUND_Y - 10} rx={140} ry={28} fill={palette.leaf} stroke={palette.stroke} />
          <text x={500} y={GROUND_Y - 6} textAnchor="middle" fontSize={14} fontWeight={700} fill={palette.stroke}>ARENA</text>
        </g>
      )}
      {/* Scoreboard + towers grow with level */}
      {level >= 2 && <Building x={250} baseY={GROUND_Y} w={60} h={80 + level * 10} palette={palette} roofColor="#e14b5a" accent={palette.accent} />}
      {level >= 3 && <Building x={690} baseY={GROUND_Y} w={60} h={80 + level * 12} palette={palette} roofColor="#e14b5a" accent={palette.accent} />}
      {level >= 4 && (
        <g>
          <circle cx={150} cy={GROUND_Y - 60} r={30} fill={palette.accent} />
          <text x={150} y={GROUND_Y - 54} textAnchor="middle" fontSize={22} fontWeight={800} fill={palette.stroke}>⚽</text>
        </g>
      )}
      {level >= 5 && (
        <g>
          <rect x={820} y={GROUND_Y - 140} width={120} height={140} fill="#d8e0ea" stroke={palette.stroke} />
          <text x={880} y={GROUND_Y - 70} textAnchor="middle" fontSize={16} fontWeight={700} fill="#e14b5a">GYM</text>
        </g>
      )}
      {Array.from({ length: n }).map((_, i) => (
        <Tree key={i} x={80 + i * 15} y={GROUND_Y} size={0.6} palette={palette} />
      ))}
    </g>
  );
}

function BusinessDistrict({ level, palette }) {
  const towers = Math.max(1, level);
  return (
    <g>
      {Array.from({ length: 5 }).map((_, i) => {
        const built = i < towers;
        const h = built ? 90 + i * 40 + level * 15 : 40;
        return (
          <Building
            key={i}
            x={120 + i * 150}
            baseY={GROUND_Y}
            w={100}
            h={h}
            palette={palette}
            roofColor={built ? ["#2d7fd4", "#1e5ea8", "#0e4080", "#3a6ea5", "#1a4d85"][i % 5] : "#8a8d92"}
            accent={built && i === Math.floor(towers / 2) ? palette.accent : null}
          />
        );
      })}
      {level >= 3 && <text x={500} y={80} textAnchor="middle" fontSize={18} fontWeight={700} fill={palette.isLight ? "#3d4450" : "#e8ecf1"} opacity={0.4}>DOWNTOWN</text>}
    </g>
  );
}

function ParkDistrict({ level, palette }) {
  const treeCount = 3 + level * 4;
  return (
    <g>
      {level >= 2 && (
        <g>
          <ellipse cx={500} cy={GROUND_Y + 10} rx={160} ry={30} fill={palette.water} stroke={palette.stroke} />
          <circle cx={500} cy={GROUND_Y + 4} r={6} fill={palette.isLight ? "#fff" : "#bde3ff"} opacity={0.7} />
        </g>
      )}
      {level >= 3 && (
        <g>
          <rect x={470} y={GROUND_Y - 60} width={60} height={50} fill="#c9a56b" stroke={palette.stroke} />
          <polygon points={`465,${GROUND_Y - 60} 535,${GROUND_Y - 60} 500,${GROUND_Y - 85}`} fill="#8a4b2b" stroke={palette.stroke} />
        </g>
      )}
      {level >= 4 && (
        <g>
          <circle cx={200} cy={GROUND_Y - 40} r={24} fill={palette.accent} />
          <text x={200} y={GROUND_Y - 34} textAnchor="middle" fontSize={20}>🌸</text>
        </g>
      )}
      {level >= 5 && (
        <g>
          <rect x={780} y={GROUND_Y - 80} width={80} height={80} fill={palette.leaf} stroke={palette.stroke} />
          <text x={820} y={GROUND_Y - 35} textAnchor="middle" fontSize={18} fill="#fff">♻</text>
        </g>
      )}
      {Array.from({ length: treeCount }).map((_, i) => (
        <Tree key={i} x={60 + (i * 900) / treeCount} y={GROUND_Y + 5} size={0.8 + (i % 3) * 0.2} palette={palette} />
      ))}
    </g>
  );
}

function SquareDistrict({ level, palette }) {
  return (
    <g>
      {/* Plaza */}
      <ellipse cx={500} cy={GROUND_Y + 10} rx={280} ry={24} fill={palette.isLight ? "#d8cdb8" : "#3a3226"} stroke={palette.stroke} />
      {/* Fountain */}
      {level >= 1 && (
        <g>
          <circle cx={500} cy={GROUND_Y - 20} r={30 + level * 4} fill={palette.water} stroke={palette.stroke} />
          <rect x={498} y={GROUND_Y - 20 - (30 + level * 4)} width={4} height={20 + level * 3} fill={palette.stroke} />
          {level >= 3 && <circle cx={500} cy={GROUND_Y - 60 - level * 4} r={4} fill={palette.isLight ? "#fff" : "#bde3ff"} />}
        </g>
      )}
      {/* Clocktower */}
      {level >= 2 && (
        <g>
          <rect x={180} y={GROUND_Y - 180} width={40} height={180} fill="#c9a56b" stroke={palette.stroke} />
          <polygon points={`170,${GROUND_Y - 180} 230,${GROUND_Y - 180} 200,${GROUND_Y - 220}`} fill="#8a4b2b" />
          <circle cx={200} cy={GROUND_Y - 150} r={12} fill="#fff" stroke={palette.stroke} />
          <line x1={200} y1={200} x2={200} y2={GROUND_Y - 150} stroke={palette.stroke} />
        </g>
      )}
      {/* Monument */}
      {level >= 4 && (
        <g>
          <rect x={790} y={GROUND_Y - 100} width={30} height={100} fill={palette.accent} stroke={palette.stroke} />
          <polygon points={`785,${GROUND_Y - 100} 825,${GROUND_Y - 100} 805,${GROUND_Y - 130}`} fill={palette.accent} />
        </g>
      )}
      {/* Flags */}
      {level >= 5 && (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <line x1={360 + i * 140} y1={GROUND_Y - 120} x2={360 + i * 140} y2={GROUND_Y - 10} stroke={palette.stroke} strokeWidth={2} />
              <rect x={360 + i * 140} y={GROUND_Y - 120} width={30} height={20} fill={palette.accent} />
            </g>
          ))}
        </g>
      )}
    </g>
  );
}

function ResidentialDistrict({ level, palette }) {
  const houses = 3 + level;
  return (
    <g>
      {Array.from({ length: houses }).map((_, i) => {
        const x = 80 + (i * 830) / houses;
        const h = 70 + (i % 3) * 18 + level * 6;
        const roofColor = ["#b57cd0", "#d0829d", "#8a7cd0", "#7cb0d0", "#d0a07c"][i % 5];
        return (
          <g key={i}>
            <Building x={x} baseY={GROUND_Y} w={80} h={h} palette={palette} roofColor={roofColor} />
            <polygon points={`${x - 4},${GROUND_Y - h} ${x + 84},${GROUND_Y - h} ${x + 40},${GROUND_Y - h - 22}`} fill="#8a4b2b" stroke={palette.stroke} />
          </g>
        );
      })}
      {level >= 3 && Array.from({ length: level }).map((_, i) => (
        <Tree key={`t-${i}`} x={60 + i * 180} y={GROUND_Y + 5} size={0.6} palette={palette} />
      ))}
      {level >= 5 && (
        <g>
          <rect x={840} y={GROUND_Y - 140} width={120} height={140} fill="#b57cd0" stroke={palette.stroke} />
          <text x={900} y={GROUND_Y - 70} textAnchor="middle" fontSize={12} fontWeight={700} fill="#fff">COMMUNITY</text>
        </g>
      )}
    </g>
  );
}

const RENDERERS = {
  sport: SportDistrict,
  business: BusinessDistrict,
  park: ParkDistrict,
  square: SquareDistrict,
  residential: ResidentialDistrict
};

export default function DistrictView({ districtId, level = 0 }) {
  const palette = useDistrictPalette();
  const Renderer = RENDERERS[districtId] || RENDERERS.sport;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ width: "100%", height: "100%", display: "block" }}
      aria-label={`${districtId} district detail`}
    >
      <SkyAndGround palette={palette} />
      <Renderer level={Math.max(0, Math.min(5, Math.floor(Number(level) || 0)))} palette={palette} />
    </svg>
  );
}
