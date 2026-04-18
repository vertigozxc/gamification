import React, { useEffect, useMemo, useState } from "react";

const W = 1000;
const H = 500;
const GROUND = 400;
const APP_DAY_MS = 60000;

function seededRNG(seed) {
  let s = (seed | 0) || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function pickRandom(arr, rng) { return arr[Math.floor(rng() * arr.length)]; }

function GlobalStyles() {
  return (
    <style>{`
      @keyframes skyTopAnim {
        0%, 100% { stop-color: #ffb05c; }
        10%, 40% { stop-color: #4A90E2; }
        50% { stop-color: #ff4e50; }
        60%, 90% { stop-color: #0f172a; }
      }
      @keyframes skyMidAnim {
        0%, 100% { stop-color: #ffde82; }
        10%, 40% { stop-color: #90C3F0; }
        50% { stop-color: #f9d423; }
        60%, 90% { stop-color: #1e293b; }
      }
      @keyframes skyBotAnim {
        0%, 100% { stop-color: #ffe5b4; }
        10%, 40% { stop-color: #D5F0F9; }
        50% { stop-color: #ffb05c; }
        60%, 90% { stop-color: #334155; }
      }
      @keyframes sunTrajectory {
        0%   { transform: translate(-100px, 150px); }
        25%  { transform: translate(500px, 40px); }
        50%  { transform: translate(1100px, 150px); }
        51%, 99% { transform: translate(1100px, 600px); }
        100% { transform: translate(-100px, 150px); }
      }
      @keyframes moonTrajectory {
        0%, 49% { transform: translate(-100px, 600px); }
        50%  { transform: translate(-100px, 150px); }
        75%  { transform: translate(500px, 40px); }
        100% { transform: translate(1100px, 150px); }
      }
      @keyframes sunVisibility {
        0%, 49% { opacity: 1; }
        50%, 100% { opacity: 0; }
      }
      @keyframes moonVisibility {
        0%, 49% { opacity: 0; }
        50%, 100% { opacity: 1; }
      }
      @keyframes nightLights {
        0%, 45% { opacity: 0; }
        46%, 95% { opacity: 0.9; }
        96%, 100% { opacity: 0; }
      }
      @keyframes dayReflections {
        0%, 45% { opacity: 0.4; }
        46%, 95% { opacity: 0; }
        96%, 100% { opacity: 0.4; }
      }
      @keyframes starsFade {
        0%, 45% { opacity: 0; }
        46%, 95% { opacity: 0.8; }
        96%, 100% { opacity: 0; }
      }
      @keyframes rainDayVisibility {
        0%, 45% { opacity: 0.55; }
        46%, 100% { opacity: 0; }
      }

      .sky-top { animation: skyTopAnim 60s linear infinite; }
      .sky-mid { animation: skyMidAnim 60s linear infinite; }
      .sky-bot { animation: skyBotAnim 60s linear infinite; }
      .sun-anim { animation: sunTrajectory 60s linear infinite, sunVisibility 60s linear infinite; }
      .moon-anim { animation: moonTrajectory 60s linear infinite, moonVisibility 60s linear infinite; }
      .city-light { animation: nightLights 60s linear infinite; }
      .day-reflection { animation: dayReflections 60s linear infinite; }
      .stars-layer { animation: starsFade 60s linear infinite; }
      .rain-layer { animation: rainDayVisibility 60s linear infinite; }
    `}</style>
  );
}

function Sky({ stage, isRainyDay }) {
  const rng = seededRNG(42);
  return (
    <g>
      <defs>
        <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop className="sky-top" offset="0%" />
          <stop className="sky-mid" offset="60%" />
          <stop className="sky-bot" offset="100%" />
        </linearGradient>
      </defs>
      <rect width={W} height={H} fill="url(#skyGrad)" />
      
      {/* Stars layer */}
      <g className="stars-layer" fill="#ffffff">
        {Array.from({ length: 60 }).map((_, i) => (
           <circle key={i} cx={((i * 67) % W)} cy={((i * 19) % (H*0.5))} r={rng() > 0.5 ? 1 : 1.5}>
              <animate attributeName="opacity" values="0.3;1;0.3" dur={`${2 + (i%4)}s`} repeatCount="indefinite" />
           </circle>
        ))}
      </g>

      {/* Sun */}
      <g className="sun-anim" opacity={isRainyDay ? 0.3 : 1}>
        <circle cx="0" cy="0" r="35" fill="#FFCF40" filter="drop-shadow(0px 0px 20px #FFCF40)" />
        <circle cx="0" cy="0" r="45" fill="#FFCF40" opacity="1" />
      </g>

      {/* Moon */}
      <g className="moon-anim">
        <circle cx="0" cy="0" r="30" fill="#e2e8f0" filter="drop-shadow(0px 0px 15px #e2e8f0)" />
        <circle cx="-10" cy="-5" r="5" fill="#cbd5e1" opacity="0.6" />
        <circle cx="5" cy="10" r="8" fill="#cbd5e1" opacity="0.4" />
        <circle cx="10" cy="-5" r="4" fill="#cbd5e1" opacity="0.5" />
      </g>
    </g>
  );
}

function Rain({ stage, isRainyDay }) {
  if (!isRainyDay) return null;
  const rng = seededRNG(7000 + stage * 13);
  return (
    <g className="rain-layer">
      {Array.from({ length: 180 }).map((_, i) => {
        const x = rng() * W;
        const y = rng() * (GROUND - 30);
        const len = 8 + rng() * 12;
        const speed = 0.45 + rng() * 0.7;
        const drift = 2 + rng() * 4;
        return (
          <line
            key={`rain-${i}`}
            x1={x}
            y1={y}
            x2={x - drift}
            y2={y + len}
            stroke="#cbe9ff"
            strokeOpacity="0.85"
            strokeWidth="1.2"
          >
            <animate attributeName="y1" values={`${y};${H + 20}`} dur={`${speed}s`} repeatCount="indefinite" />
            <animate attributeName="y2" values={`${y + len};${H + 20 + len}`} dur={`${speed}s`} repeatCount="indefinite" />
          </line>
        );
      })}
    </g>
  );
}

function RainSplashes({ stage, isRainyDay }) {
  if (!isRainyDay) return null;
  const rng = seededRNG(9100 + stage * 9);
  const isPaved = stage >= 5;
  const splashY = isPaved ? GROUND + 31 : GROUND + 2;
  return (
    <g className="rain-layer">
      {Array.from({ length: 70 }).map((_, i) => {
        const x = rng() * W;
        const delay = rng() * 1.6;
        const dur = 0.35 + rng() * 0.4;
        const maxR = 1.8 + rng() * 2.2;
        return (
          <g key={`splash-${i}`}>
            <ellipse cx={x} cy={splashY} rx="1.1" ry="0.7" fill="#dbeafe" opacity="0.25">
              <animate attributeName="opacity" values="0;0.35;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            </ellipse>
            <circle cx={x} cy={splashY - 1} r="0.2" fill="#e0f2fe" opacity="0">
              <animate attributeName="r" values={`0.2;${maxR};0.2`} dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
              <animate attributeName="opacity" values="0;0.55;0" dur={`${dur}s`} begin={`${delay}s`} repeatCount="indefinite" />
            </circle>
          </g>
        );
      })}
    </g>
  );
}

function Clouds({ stage, isRainyDay }) {
  const rng = seededRNG(stage * 111);
  return (
    <g>
      <g className="clouds-layer" fill="#ffffff" opacity="0.3">
        {Array.from({ length: 8 }).map((_, i) => {
          const y = 30 + rng() * 150;
          const dur = 60 + rng() * 60; // Slow moving
          const scale = 0.4 + rng() * 0.6;
          const dir = rng() > 0.5 ? 1 : -1;
          const startX = dir === 1 ? -200 : W + 200;
          const endX = dir === 1 ? W + 200 : -200;
          
          return (
            <g key={`cloud-${i}`}>
              <animateTransform attributeName="transform" type="translate" from={`${startX} ${y}`} to={`${endX} ${y}`} dur={`${dur}s`} repeatCount="indefinite" />
              <g transform={`scale(${scale})`}>
                <circle cx="0" cy="0" r="30" />
                <circle cx="25" cy="-10" r="20" />
                <circle cx="-25" cy="-5" r="15" />
                <circle cx="15" cy="15" r="15" />
                <circle cx="-15" cy="10" r="20" />
                <ellipse cx="0" cy="15" rx="40" ry="10" />
              </g>
            </g>
          );
        })}
      </g>

      {isRainyDay && (
        <g className="rain-layer" fill="#475569" opacity="0.45">
          {Array.from({ length: 10 }).map((_, i) => {
            const y = 25 + rng() * 140;
            const dur = 70 + rng() * 70;
            const scale = 0.45 + rng() * 0.7;
            const startX = -260;
            const endX = W + 260;
            return (
              <g key={`rain-cloud-${i}`}>
                <animateTransform attributeName="transform" type="translate" from={`${startX} ${y}`} to={`${endX} ${y}`} dur={`${dur}s`} repeatCount="indefinite" />
                <g transform={`scale(${scale})`}>
                  <circle cx="0" cy="0" r="34" />
                  <circle cx="30" cy="-10" r="22" />
                  <circle cx="-28" cy="-6" r="17" />
                  <circle cx="14" cy="14" r="18" />
                  <circle cx="-14" cy="10" r="21" />
                  <ellipse cx="0" cy="16" rx="46" ry="12" />
                </g>
              </g>
            );
          })}
        </g>
      )}
    </g>
  );
}

function GroundMist({ isRainyDay }) {
  if (!isRainyDay) return null;
  return (
    <g className="rain-layer">
      <ellipse cx={W * 0.2} cy={GROUND - 2} rx="220" ry="22" fill="#dbeafe" opacity="0.22" />
      <ellipse cx={W * 0.52} cy={GROUND + 3} rx="300" ry="26" fill="#e2e8f0" opacity="0.2" />
      <ellipse cx={W * 0.82} cy={GROUND - 1} rx="210" ry="18" fill="#cbd5e1" opacity="0.18" />
    </g>
  );
}

  function BackgroundCity({ stage }) {
    const rng = seededRNG(999);
    
    const deepBgBuildings = [];
    // Hide deep skyscrapers for levels 1-4
    const deepNum = stage >= 5 ? Math.floor(lerp(10, 80, (stage - 4) / 16)) : 0;
    const deepMaxH = stage >= 5 ? lerp(50, 280, (stage - 4) / 16) : 0;
  
  for (let i = 0; i < deepNum; i++) {
    const w = 20 + rng() * 40;
    const h = 40 + rng() * deepMaxH;
    const x = rng() * W;
    
    // Very simple silhouettes fading into the atmospheric distance
    const color = pickRandom(["#1e293b", "#334155", "#475569"], rng);
    deepBgBuildings.push(
      <rect key={`dbg-${i}`} x={x} y={GROUND - h} width={w} height={h} fill={color} opacity="1" />
    );
  }

  const bgBuildings = [];
  if (stage >= 5) {
    const num = Math.floor(lerp(5, 35, (stage-4) / 16));
    const maxH = lerp(50, 200, (stage-4) / 16);
    
    for (let i = 0; i < num; i++) {
      const w = 30 + rng() * 40;
      const h = 40 + rng() * maxH;
      const x = rng() * W;
      const color = pickRandom(["#64748b", "#475569", "#78716c", "#52525b", "#3f3f46"], rng);
      const windowC = pickRandom(["#fef08a", "#fde047", "#67e8f9", "#e0f2fe"], rng);
      
      bgBuildings.push(
        <g key={`bg-${i}`} transform={`translate(${x}, ${GROUND - h})`}>
          <rect width={w} height={h} fill={color} opacity="1" />
          {h > 80 && w > 40 && (
             <g>
               <rect x="5" y="5" width={w-10} height={h-10} fill="#3f3f46" opacity="0.5" />
               {rng() > 0.5 && (
                 <rect className="city-light" x="10" y="20" width={w-20} height={h-40} fill={windowC} opacity="0.4" />
               )}
             </g>
          )}
        </g>
      );
    }
  }
  
  return (
    <g>
      {deepBgBuildings}
      {bgBuildings}
    </g>
  );
}

/* Grass layer — rendered separately BEFORE buildings so grass hides behind them */
function GrassLayer({ stage }) {
  const isPaved = stage >= 5;
  const isCity = stage >= 12;
  if (isCity) return null;

  const rng = seededRNG(stage * 3210 + 77);
  const count = isPaved ? 60 : 200;

  return (
    <g>
      {Array.from({ length: count }).map((_, i) => {
        const gx = rng() * W;
        const gh = isPaved ? (4 + rng() * 7) : (8 + rng() * 18);
        const lean = (-3 + rng() * 6) * (isPaved ? 0.5 : 1);
        const shade = pickRandom(["#4ade80", "#22c55e", "#16a34a", "#86efac", "#15803d", "#a3e635"], rng);
        const sw = isPaved ? (1.5 + rng() * 1) : (2 + rng() * 2.5);
        const opacity = isPaved ? 0.45 : (0.7 + rng() * 0.3);
        return (
          <path
            key={`grass-${i}`}
            d={`M${gx},${GROUND} Q${gx + lean},${GROUND - gh * 0.6} ${gx + lean * 0.6},${GROUND - gh}`}
            fill="none"
            stroke={shade}
            strokeWidth={sw}
            strokeLinecap="round"
            opacity={opacity}
          />
        );
      })}
      {/* Bushy tufts along the ground line */}
      {!isPaved && Array.from({ length: 60 }).map((_, i) => {
        const tx = rng() * W;
        const tw = 10 + rng() * 16;
        const th = 4 + rng() * 6;
        const shade = pickRandom(["#4ade80", "#22c55e", "#16a34a", "#86efac", "#15803d"], rng);
        return (
          <ellipse
            key={`tuft-${i}`}
            cx={tx}
            cy={GROUND}
            rx={tw / 2}
            ry={th / 2}
            fill={shade}
            opacity={0.55 + rng() * 0.35}
          />
        );
      })}
    </g>
  );
}

function Ground({ stage, isRainyDay }) {
  const isPaved = stage >= 5;
  const isCity = stage >= 12;
  const groundColor = isCity ? "#a1a1aa" : isPaved ? "#b5ccb4" : "#86b96e";

  return (
    <g>
      <rect x="0" y={GROUND} width={W} height={H - GROUND} fill={groundColor} />
      {/* Road */}
      {isPaved && (
        <g>
          <rect x="0" y={GROUND + 15} width={W} height="24" fill="#4B5563" />
          {isRainyDay && (
            <g className="rain-layer">
              <rect x="0" y={GROUND + 17} width={W} height="4" fill="#7dd3fc" opacity="0.2" />
              <rect x="0" y={GROUND + 29} width={W} height="3" fill="#bae6fd" opacity="0.18" />
              {Array.from({ length: 14 }).map((_, i) => (
                <ellipse
                  key={`puddle-${i}`}
                  cx={35 + i * 72}
                  cy={GROUND + 33}
                  rx="16"
                  ry="3"
                  fill="#e0f2fe"
                  opacity="0.25"
                />
              ))}
            </g>
          )}
          {Array.from({ length: 30 }).map((_, i) => (
            <rect key={`line-${i}`} x={i * 35 + 10} y={GROUND + 25} width="15" height="2" fill="#facc15" />
          ))}
          <rect x="0" y={GROUND + 13} width={W} height="2" fill="#9ca3af" />
          <rect x="0" y={GROUND + 39} width={W} height="2" fill="#9ca3af" />
        </g>
      )}
      {/* Streetlights toggle ON at night */}
      {isPaved && Array.from({ length: 10 }).map((_, i) => (
         <g key={`lamp-${i}`} transform={`translate(${100 + i*90}, ${GROUND + 15})`}>
            <rect x="0" y="-30" width="3" height="30" fill="#3f3f46" />
            <polygon points="0,-30 10,-32 10,-28" fill="#52525b" />
            <circle className="city-light" cx="8" cy="-28" r="4" fill="#fdf08a" />
         </g>
      ))}
    </g>
  );
}

function Subway({ stage }) {
    if (stage < 20) return null;
    return (
        <g transform={`translate(0, ${GROUND - 25})`}>
          {/* Elevated pillars */}
          {Array.from({ length: 8 }).map((_, i) => (
            <g key={`sp-${i}`} transform={`translate(${100 + i * 140}, 15)`}>
              <rect width="10" height="25" fill="#4b5563" />
              <polygon points="-5,0 15,0 10,15 0,15" fill="#374151" />
            </g>
          ))}

          {/* Track structure */}
          <rect width={W} height="15" fill="#374151" />
          <rect x="0" y="3" width={W} height="2" fill="#1f2937" />
          <rect x="0" y="10" width={W} height="2" fill="#1f2937" />

          {/* Train itself */}
          <g>
            <animateTransform attributeName="transform" type="translate" values="1100 -8; 350 -8; 350 -8; -400 -8" keyTimes="0; 0.333; 0.666; 1" dur="15s" repeatCount="indefinite" />
            <rect y="0" width="300" height="22" rx="3" fill="#4b6499" />
            <rect y="12" width="300" height="3" fill="#0ea5e9" />
            {[20, 60, 100, 140, 180, 220, 260].map(x => (
              <rect key={`w-${x}`} x={x} y="4" width="25" height="7" rx="1.5" fill="#fef08a" />
            ))}
          </g>
        </g>
    );
  }

  function Traffic({ stage }) {
    const t = (stage - 1) / 19;
    const numCars = stage >= 5 ? Math.floor(lerp(1, 15, (stage - 5) / 15)) : 0;
    const numPpl = Math.floor(lerp(3, 30, t));
    const rng = seededRNG(stage * 777);
  const people = [];
  for (let i = 0; i < numPpl; i++) {
    const dir = rng() > 0.5 ? 1 : -1;
    const dur = 10 + rng() * 15;
    const shirt = pickRandom(["#ef4444", "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#ec4899", "#14b8a6"], rng);
    
    people.push(
      <g key={`p-${i}`}>
        <animateTransform attributeName="transform" type="translate" from={`${dir > 0 ? -20 : W + 20} ${GROUND - 12}`} to={`${dir > 0 ? W + 20 : -20} ${GROUND - 12}`} dur={`${dur}s`} repeatCount="indefinite" />
        <ellipse cx="0" cy="11" rx="4" ry="1.5" fill="#1f2937" opacity="0.2" />
        <line x1="-1.5" y1="6" x2="-2" y2="10" stroke="#1e293b" strokeWidth="1.5">
           <animate attributeName="x2" values="-3;-1;-3" dur="0.5s" repeatCount="indefinite" />
        </line>
        <line x1="1.5" y1="6" x2="2" y2="10" stroke="#1e293b" strokeWidth="1.5">
           <animate attributeName="x2" values="1;3;1" dur="0.5s" repeatCount="indefinite" />
        </line>
        <rect x="-3" y="-1" width="6" height="8" rx="1" fill={shirt} />
        {rng() > 0.5 && <rect x="-4" y="0" width="2" height="5" rx="1" fill="#475569" />}
        <circle cx="0" cy="-3" r="3" fill="#fcd34d" />
        {rng() > 0.5 ? <path d="M-3,-4 Q0,-7 3,-4 L3,-2 L-3,-2 Z" fill="#451a03" /> :
                       <rect x="-4" y="-6" width="8" height="3" rx="1" fill="#1e3a8a" />}
      </g>
    );
  }

  const cars = [];
  for (let i = 0; i < numCars; i++) {
    const dir = rng() > 0.5 ? 1 : -1;
    const dur = 3 + rng() * 6;
    const color = pickRandom(["#dc2626", "#2563eb", "#eab308", "#f8fafc", "#0f172a", "#10b981", "#64748b", "#fbcfe8", "#c026d3"], rng);
    const y = GROUND + 15 + (dir > 0 ? 2 : 14);
    
    cars.push(
      <g key={`c-${i}`}>
        <animateTransform attributeName="transform" type="translate" from={`${dir > 0 ? -40 : W + 40} ${y}`} to={`${dir > 0 ? W + 40 : -40} ${y}`} dur={`${dur}s`} repeatCount="indefinite" />
        <ellipse cx="0" cy="8" rx="18" ry="2" fill="#1f2937" opacity="1" />
        <rect x="-18" y="-8" width="36" height="12" rx="4" fill={color} />
        <path d={dir > 0 ? "M-10,-8 L-4,-14 L8,-14 L14,-8 Z" : "M-14,-8 L-8,-14 L4,-14 L10,-8 Z"} fill={color} />
        <path d={dir > 0 ? "M-8,-8 L-3,-13 L7,-13 L12,-8 Z" : "M-12,-8 L-7,-13 L3,-13 L8,-8 Z"} fill="#cbd5e1" />
        
        {/* Car lights toggled on at night */}
        <circle className="city-light" cx={dir > 0 ? 17 : -17} cy="-2" r="3" fill="#fef08a" filter="drop-shadow(0 0 5px #fef08a)" />
        <circle className="city-light" cx={dir > 0 ? -17 : 17} cy="-2" r="3" fill="#ef4444" filter="drop-shadow(0 0 5px #ef4444)" />
        <circle cx={dir > 0 ? 17 : -17} cy="-2" r="1.5" fill="#ffffff" />
        
        <circle cx="-11" cy="4" r="4.5" fill="#111827" />
        <circle cx="-11" cy="4" r="2" fill="#cbd5e1" />
        <circle cx="11" cy="4" r="4.5" fill="#111827" />
        <circle cx="11" cy="4" r="2" fill="#cbd5e1" />
      </g>
    );
  }

  return <g>{people}{cars}</g>;
}

function CentralIcon({ stage }) {
    const cx = W / 2;

  const h = (40 + (stage - 1) * 9) * 1.3; // Max ~288
  const top = GROUND - h;
  const baseW = (40 + (stage - 1) * 6) * 1.3; // Max ~200
  const isFuturistic = stage >= 15;

  return (
    <g transform={`translate(${cx}, 0) translate(${-cx}, 0)`}>
      <defs>
        <linearGradient id="armorGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isFuturistic ? "#1e1b4b" : "#334155"} />
          <stop offset="100%" stopColor={isFuturistic ? "#020617" : "#0f172a"} />
        </linearGradient>
        <linearGradient id="coreGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isFuturistic ? "#38bdf8" : "#fbbf24"} />
          <stop offset="100%" stopColor={isFuturistic ? "#6366f1" : "#ea580c"} />
        </linearGradient>
        <linearGradient id="glassGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="glassGradRight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#0284c7" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Background Silhouette Arcology Base */}
      <path 
        d={`M ${cx - baseW*0.45} ${GROUND} L ${cx + baseW*0.45} ${GROUND} L ${cx + baseW*0.15} ${top} L ${cx - baseW*0.15} ${top} Z`} 
        fill="url(#armorGrad)" 
      />

      {/* Energy Core / Central Slit pulsing with energy */}
      {stage >= 6 && (
        <g className="city-light">
          <path 
            d={`M ${cx - baseW*0.06} ${GROUND} L ${cx + baseW*0.06} ${GROUND} L ${cx + baseW*0.02} ${top + 10} L ${cx - baseW*0.02} ${top + 10} Z`} 
            fill="url(#coreGrad)" 
            filter={isFuturistic ? "drop-shadow(0 0 15px #38bdf8)" : "drop-shadow(0 0 10px #fbbf24)"}
          >
             <animate attributeName="opacity" values="0.5;1;0.5" dur="3s" repeatCount="indefinite" />
          </path>
        </g>
      )}

      {/* Overlapping Front Glass Armor Plates */}
      <path 
        d={`M ${cx - baseW*0.5} ${GROUND} L ${cx - baseW*0.1} ${GROUND} L ${cx - baseW*0.06} ${GROUND - h*0.85} L ${cx - baseW*0.25} ${GROUND - h*0.6} Z`} 
        fill="url(#glassGrad)" 
        stroke="#e0f2fe" strokeWidth="1"
      />
      <path 
        d={`M ${cx + baseW*0.5} ${GROUND} L ${cx + baseW*0.1} ${GROUND} L ${cx + baseW*0.06} ${GROUND - h*0.85} L ${cx + baseW*0.25} ${GROUND - h*0.6} Z`} 
        fill="url(#glassGradRight)" 
        stroke="#e0f2fe" strokeWidth="1"
      />

      {/* Flashlight panels at night */}
      <g className="city-light">
        <path 
          d={`M ${cx - baseW*0.5} ${GROUND} L ${cx - baseW*0.1} ${GROUND} L ${cx - baseW*0.06} ${GROUND - h*0.85} L ${cx - baseW*0.25} ${GROUND - h*0.6} Z`} 
          fill="#7dd3fc" 
          opacity="0"
        >
            <animate attributeName="opacity" values="0;0.3;0;0;0;0;0.4;0" dur="4s" repeatCount="indefinite" />
          </path>
          <path
            d={`M ${cx + baseW*0.5} ${GROUND} L ${cx + baseW*0.1} ${GROUND} L ${cx + baseW*0.06} ${GROUND - h*0.85} L ${cx + baseW*0.25} ${GROUND - h*0.6} Z`}
            fill="#7dd3fc"
            opacity="0"
          >
            <animate attributeName="opacity" values="0;0;0;0.3;0;0;0.4;0" dur="4.5s" repeatCount="indefinite" />
          </path>
        </g>

        {/* Intricate Geometric Accents */}
        {stage >= 9 && (
          <>
            <polygon points={`${cx - baseW*0.3},${GROUND} ${cx - baseW*0.15},${GROUND - h*0.4} ${cx - baseW*0.4},${GROUND - h*0.2}`} fill="#0ea5e9" opacity="0.3" />
            <polygon points={`${cx + baseW*0.3},${GROUND} ${cx + baseW*0.15},${GROUND - h*0.4} ${cx + baseW*0.4},${GROUND - h*0.2}`} fill="#0ea5e9" opacity="0.3" />
          
          <circle cx={cx} cy={top + 10} r={12 + stage*0.5} fill="#0f172a" stroke="url(#coreGrad)" strokeWidth="3" />
          <circle className="city-light" cx={cx} cy={top + 10} r={4 + stage*0.2} fill="#ffffff" filter="drop-shadow(0 0 8px #ffffff)">
             <animate attributeName="r" values={`${4 + stage*0.2};${6 + stage*0.3};${4 + stage*0.2}`} dur="2s" repeatCount="indefinite" />
          </circle>
        </>
      )}

      {/* Crown / Spire */}
      {stage >= 15 && (
        <g transform={`translate(0, ${-15})`}>
          <path d={`M ${cx - 20} ${top} L ${cx + 20} ${top} L ${cx} ${top - 70} Z`} fill="url(#glassGrad)" opacity="0.9" />
          <line className="city-light" x1={cx} y1={top} x2={cx} y2={top - 130} stroke="#38bdf8" strokeWidth="3" filter="drop-shadow(0 0 10px #38bdf8)">
             <animate attributeName="y2" values={`${top - 90}; ${top - 150}; ${top - 90}`} dur="3s" repeatCount="indefinite" />
          </line>
          
          <text className="city-light" x={cx} y={top - 20} fontSize={14 + stage*0.3} fill="#0ea5e9" fontWeight="bold" textAnchor="middle" filter="drop-shadow(0 0 8px #0ea5e9)" letterSpacing="5">
            A E T H E R
          </text>
        </g>
      )}

      {/* Ascended Holographic Core at Stage 20 */}
      {stage >= 20 && (
        <g className="city-light">
           <path d={`M ${cx} ${top - 140} Q ${cx - 90} ${top - 200} ${cx} ${top - 260} Q ${cx + 90} ${top - 200} ${cx} ${top - 140} Z`} fill="none" stroke="#c084fc" strokeWidth="2" opacity="0.7">
              <animateTransform attributeName="transform" type="scale" values="0.95; 1.05; 0.95" transformOrigin={`${cx} ${top - 200}`} dur="4s" repeatCount="indefinite" />
           </path>
           <circle cx={cx} cy={top - 200} r={18} fill="#c084fc" filter="drop-shadow(0 0 20px #c084fc)">
              <animate attributeName="r" values="12; 22; 12" dur="2s" repeatCount="indefinite" />
           </circle>
           {/* Connecting energy beams */}
           <path d={`M ${cx - 15} ${top - 70} L ${cx} ${top - 140} L ${cx + 15} ${top - 70}`} fill="none" stroke="#c084fc" strokeWidth="2" strokeDasharray="5 5" opacity="0.6">
              <animate attributeName="stroke-dashoffset" from="20" to="0" dur="1s" repeatCount="indefinite" />
           </path>
        </g>
      )}
    </g>
  );
}

function AtmosphereOrnaments({ stage }) {
  const rng = seededRNG(stage * 4321);

  const mistBands = Array.from({ length: 3 }).map((_, idx) => (
    <ellipse
      key={`mist-${idx}`}
      cx={200 + idx * 300}
      cy={GROUND - 8 - idx * 5}
      rx={220 - idx * 25}
      ry={30 - idx * 4}
      fill="#93c5fd"
      opacity={0.08 + idx * 0.02}
    />
  ));

  const fireflies = stage < 10
    ? Array.from({ length: 10 + stage }).map((_, idx) => {
      const x = 40 + rng() * (W - 80);
      const y = 210 + rng() * 150;
      const delay = rng() * 2;
      return (
        <circle key={`fly-${idx}`} cx={x} cy={y} r={1.8} fill="#fde68a" opacity="0.7">
          <animate attributeName="opacity" values="0.15;0.9;0.15" dur={`${1.4 + rng() * 1.8}s`} begin={`${delay}s`} repeatCount="indefinite" />
          <animate attributeName="cy" values={`${y};${y - 10};${y}`} dur={`${2.2 + rng() * 1.4}s`} begin={`${delay}s`} repeatCount="indefinite" />
        </circle>
      );
    })
    : null;

  const skyGlyphs = stage >= 10
    ? Array.from({ length: Math.min(8, Math.floor(stage / 2)) }).map((_, idx) => {
      const x = 90 + idx * 110 + rng() * 30;
      const y = 70 + rng() * 90;
      const size = 8 + rng() * 7;
      return (
        <g key={`glyph-${idx}`} transform={`translate(${x}, ${y})`} opacity="0.35">
          <polygon points={`0,${-size} ${size},0 0,${size} ${-size},0`} fill="#67e8f9">
            <animateTransform attributeName="transform" type="rotate" values={`0 0 0;360 0 0`} dur={`${14 + rng() * 10}s`} repeatCount="indefinite" />
          </polygon>
        </g>
      );
    })
    : null;

  return (
    <g>
      {mistBands}
      {fireflies}
      {skyGlyphs}
    </g>
  );
}

export default function CityIllustration({ height = "500px", stage = 1, weatherCycleDay }) {
  const level = clamp(Number(stage) || 1, 1, 20);
  const [appCycleDay, setAppCycleDay] = useState(() => (
    Number.isFinite(Number(weatherCycleDay))
      ? Number(weatherCycleDay)
      : Math.floor(Date.now() / APP_DAY_MS)
  ));

  useEffect(() => {
    if (Number.isFinite(Number(weatherCycleDay))) {
      setAppCycleDay(Number(weatherCycleDay));
      return undefined;
    }

    const updateCycleDay = () => {
      setAppCycleDay(Math.floor(Date.now() / APP_DAY_MS));
    };

    updateCycleDay();
    const intervalId = setInterval(updateCycleDay, 1000);
    return () => clearInterval(intervalId);
  }, [weatherCycleDay]);

  const isRainyDay = appCycleDay % 3 === 2;

  const elements = useMemo(() => {
    const rng = seededRNG(level * 42);
    const items = [];
    
    // Determine number of elements to draw based on level
    // At low levels, let the user see a spreading village/town by adding more elements
    let baseCount = 14;
    if (level === 1) baseCount = 14;
    else if (level === 2) baseCount = 18;
    else if (level === 3) baseCount = 22; // Removed a bit at 3
    else if (level === 4) baseCount = 30; // Added more at 4
    
    for (let i = 0; i < baseCount; i++) {
       // Leave space in the center for the Central Icon
       const centerStart = Math.floor(baseCount / 2) - 1;
       const centerEnd = Math.floor(baseCount / 2);
       if (i === centerStart || i === centerEnd) continue;
       
       let bH = 30;
       let bW = 40 + rng() * 20;
       
       // Distribute them evenly, but with some overlap for density
       const spreadX = (W / baseCount);
       const baseX = i * spreadX + rng() * (spreadX * 0.5);
       
       let type = "village";
       const devBonus = rng() * 3; 
       const effLevel = clamp(level - 2 + devBonus, 1, 20);
       
       if (level <= 4) {
           // Strict capping for early levels to only show small buildings
           if (rng() > 0.5 || level >= 3) type = "house";
           if (level === 4 && rng() > 0.8) type = "shop"; // Tiny chance for a small shop at lvl 4
       } else {
           // Normal scaling for level 5+
           if (effLevel >= 3) type = "house";
           if (effLevel >= 6) type = "apartment"; 
           if (effLevel >= 9) type = "shop";
           if (effLevel >= 12) type = "office";
           if (effLevel >= 16) type = "skyscraper";
           if (effLevel >= 18) {
             const sciFiRoll = rng();
             if (sciFiRoll > 0.8) type = "sci-fi-spire";
             else if (sciFiRoll > 0.6) type = "sci-fi-block";
             else if (sciFiRoll > 0.4) type = "sci-fi-stripes";
           }
           if (effLevel >= 13 && i === 3) type = "mall";
           if (effLevel >= 13 && i === 10) type = "cinema";
       }

       if (type === "village") {
         bH = 25 + rng() * 15;
       } else if (type === "house") {
         bH = 40 + rng() * 20;
       } else if (type === "apartment") {
         bH = 70 + rng() * 30;
         bW = 45 + rng() * 15;
       } else if (type === "shop") {
         bH = 60 + rng() * 25;
       } else if (type === "office") {
         bH = 120 + rng() * 60;
         bW = 50 + rng() * 30;
       } else if (type === "mall" || type === "cinema") {
         bH = type === "cinema" ? 77 : 88;
         bW = 100 + rng() * 30;
       } else if (type.startsWith("sci-fi-") || type === "skyscraper") {
         bH = clamp(180 + rng() * 120, 180, GROUND - 60);
         bW = 55 + rng() * 35;
       }

       if (type !== "mall" && type !== "cinema") {
         if (level === 16) {
           bH *= 0.6;
         } else if (level === 17) {
           bH *= 0.8;
         } else if (level === 18) {
           bH *= 0.95;
         } else if (level >= 19) {
           bH *= 1.1;
         }
       }

       if (effLevel >= 13 && (i === 3 || i === 10)) {
          // Push a skyscraper behind the mall/cinema
          let skyType = "skyscraper";
          if (effLevel >= 18) {
             const sciFiRoll = rng();
             if (sciFiRoll > 0.8) skyType = "sci-fi-spire";
             else if (sciFiRoll > 0.6) skyType = "sci-fi-block";
             else if (sciFiRoll > 0.4) skyType = "sci-fi-stripes";
          }
          const skyH = clamp(180 + rng() * 120, 180, GROUND - 60);
          const skyW = 55 + rng() * 35;
          const skyX = baseX + rng() * 20;
          items.push({ id: `${i}-back`, type: skyType, h: skyH, w: skyW, x: skyX, seed: rng() });
       }

       items.push({ id: i, type, h: bH, w: bW, x: baseX, seed: rng() });
    }

    // Sort to ensure megamall and cineplex are drawn last (at the very front side)
    items.sort((a, b) => {
      const aIsFront = (a.type === "mall" || a.type === "cinema") ? 1 : 0;
      const bIsFront = (b.type === "mall" || b.type === "cinema") ? 1 : 0;
      return aIsFront - bIsFront;
    });

    return items;
  }, [level]);

  const buildings = useMemo(() => {
    return elements.map(lot => {
      const r = seededRNG(lot.seed * 999);
      const { x, w, h, type } = lot;
      const y = GROUND - h;
      
      let base, roof;
      // Vibrant, distinct colors!
      if (type === "village" || type === "house") {
        base = pickRandom(["#fce7f3", "#e0f2fe", "#dcfce7", "#fef3c7", "#ffedd5"], r);
        roof = pickRandom(["#b91c1c", "#1d4ed8", "#15803d", "#ea580c"], r);
      } else if (type === "apartment") {
        base = pickRandom(["#64748b", "#78716c", "#9f1239", "#0c4a6e", "#854d0e", "#374151"], r); // Deeper, more distinct building colors
        roof = pickRandom(["#1e293b", "#0f172a", "#1c1917", "#450a0a"], r); // Dark realistic roofs
      } else if (type === "shop") {
        base = pickRandom(["#f43f5e", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4"], r);
        roof = "#1e293b";
      } else if (type === "mall") {
        base = pickRandom(["#e2e8f0", "#cffafe", "#fdf4ff"], r); 
        roof = pickRandom(["#64748b", "#334155", "#0ea5e9"], r);
      } else if (type === "cinema") {
        base = "#171717";
        roof = "#dc2626";
      } else if (type === "office") {
        base = pickRandom(["#64748b", "#3b82f6", "#0284c7", "#f59e0b", "#10b981"], r);
        roof = "#1e293b";
      } else if (type.startsWith("sci-fi-")) {
        base = pickRandom(["#0f172a", "#1e1b4b", "#020617"], r);
        roof = pickRandom(["#38bdf8", "#f472b6", "#2dd4bf"], r);
      } else { // skyscraper
        base = pickRandom(["#0f172a", "#1e3a8a", "#581c87", "#064e3b", "#78350f", "#334155"], r);
        roof = "#020617";
      }

      const lightColor = pickRandom(["#fef08a", "#fde047", "#67e8f9", "#ffedd5"], r);

      return (
        <g key={`b-${lot.id}`} transform={`translate(${x}, ${y})`}>
          <rect width={w} height={h} fill={base} />
          <rect width={w * 0.15} height={h} fill="#000000" opacity="0.25" />

          {type === "apartment" && (() => {
             const aptVariant = Math.floor(r() * 4);
             const aptColor = base;
             
             // Common window generator for apartments
             const generateWindows = () => {
               const elements = [];
               for (let vi = 0; vi < Math.floor(h / 15); vi++) {
                  const yPos = 10 + vi*15;
                  if (yPos > h - 15) continue;
                  
                  // Left window with balcony detail
                  elements.push(
                    <g key={`apt-${vi}-l`}>
                      <rect x="8" y={yPos} width="12" height="10" fill="#94a3b8" stroke="#1e293b" />
                      <rect className="city-light" x="8" y={yPos} width="12" height="10" fill={lightColor} opacity={r()>0.5 ? 0.8 : 0} />
                      <rect x="6" y={yPos+8} width="16" height="3" fill={roof} opacity="0.8" />
                      <rect x="6" y={yPos+8} width="16" height="1" fill="#cbd5e1" opacity="0.5" />
                    </g>
                  );
                  // Right window with balcony detail
                  elements.push(
                    <g key={`apt-${vi}-r`}>
                      <rect x={w-20} y={yPos} width="12" height="10" fill="#94a3b8" stroke="#1e293b" />
                      <rect className="city-light" x={w-20} y={yPos} width="12" height="10" fill={lightColor} opacity={r()>0.5 ? 0.8 : 0} />
                      <rect x={w-22} y={yPos+8} width="16" height="3" fill={roof} opacity="0.8" />
                      <rect x={w-22} y={yPos+8} width="16" height="1" fill="#cbd5e1" opacity="0.5" />
                    </g>
                  );
               }

               // Add a shared front door at the very bottom
               elements.push(
                 <g key="apt-door">
                    <rect x={w/2 - 6} y={h - 14} width="12" height="14" fill="#1e293b" />
                    <rect x={w/2 - 5} y={h - 13} width="10" height="13" fill="#451a03" />
                    <rect x={w/2 - 8} y={h - 16} width="16" height="2" fill={roof} />
                 </g>
               )
               return elements;
             };

             if (aptVariant === 0) {
               // Standard triangle roof
               return (
                 <g>
                   <polygon points={`-5,0 ${w/2},-20 ${w+5},0`} fill={roof} />
                   {generateWindows()}
                 </g>
               );
             } else if (aptVariant === 1) {
               // Flat roof with parapet wall
               return (
                 <g>
                   <rect x="-2" y="-6" width={w+4} height="6" fill={roof} />
                   <rect x="-4" y="0" width={w+8} height="2" fill="#475569" />
                   {generateWindows()}
                 </g>
               );
             } else if (aptVariant === 2) {
               // Left-to-right slant roof
               return (
                 <g>
                   <polygon points={`-5,0 -5,-25 ${w+5},0`} fill={roof} />
                   {generateWindows()}
                 </g>
               );
             } else {
               // Top roof terrace / Blocky tier
               return (
                 <g>
                   <rect x="-2" y="-4" width={w+4} height="4" fill={roof} />
                   <rect x={10} y="-15" width={w-20} height="11" fill={aptColor} />
                   <rect x={8} y="-18" width={w-16} height="3" fill={roof} />
                   {generateWindows()}
                 </g>
               );
             }
          })()}

          {/* Details based on type */}
          {(type === "village" || type === "house") && (() => {
            const variant = Math.floor(r() * 4); // 4 distinct look variations
            const hasChimney = r() > 0.5;

            // Common elements
            const door = <g>
              <rect x={w/2 - 6} y={h - 16} width="12" height="16" fill="#451a03" />
              <circle cx={w/2 + 3} cy={h - 8} r="1" fill="#fbbf24" />
            </g>;

            const windows1 = <g>
              <rect x="5" y="10" width="8" height="10" fill="#334155" stroke="#1e293b" />
              <rect className="city-light" x="5" y="10" width="8" height="10" fill={lightColor} />
              <rect className="day-reflection" x="5" y="10" width="8" height="10" fill="#ffffff" opacity="0.4" />

              <rect x={w - 13} y="10" width="8" height="10" fill="#334155" stroke="#1e293b" />
              <rect className="city-light" x={w - 13} y="10" width="8" height="10" fill={lightColor} />
              <rect className="day-reflection" x={w - 13} y="10" width="8" height="10" fill="#ffffff" opacity="0.4" />
            </g>;

            if (variant === 0) {
              return (
                <g>
                  {/* Classic pitched roof */}
                  <polygon points={`-5,0 ${w/2},${-15} ${w+5},0`} fill={roof} />
                  {hasChimney && <rect x={w - 15} y="-20" width="6" height="15" fill="#A0522D" />}
                  {door}
                  {windows1}
                </g>
              );
            } else if (variant === 1) {
              return (
                <g>
                   {/* Flat roof with trim */}
                   <rect x="-2" y="-4" width={w+4} height="4" fill={roof} />
                   <rect x="-4" y="0" width={w+8} height="2" fill="#475569" />
                   {hasChimney && <rect x="8" y="-14" width="8" height="10" fill="#A0522D" />}
                   {door}
                   <rect x={w/2 - 8} y="10" width="16" height="12" fill="#334155" stroke="#1e293b" />
                   <rect className="city-light" x={w/2 - 8} y="10" width="16" height="12" fill={lightColor} />
                   <rect className="day-reflection" x={w/2 - 8} y="10" width="16" height="12" fill="#ffffff" opacity="0.4" />
                </g>
              )
            } else if (variant === 2) {
              return (
                <g>
                   {/* Asymmetrical sloped roof */}
                   <polygon points={`-5,0 -5,${-20} ${w+5},0`} fill={roof} />
                   {door}
                   {windows1}
                   <rect x="-3" y="-12" width="6" height="6" fill="#334155" />
                   <rect className="city-light" x="-3" y="-12" width="6" height="6" fill={lightColor} />
                </g>
              )
            } else {
              return (
                <g>
                   {/* Double pitched roof */}
                   <polygon points={`-5,0 ${w/4},${-15} ${w/2},0`} fill={roof} />
                   <polygon points={`${w/2},0 ${w*0.75},${-15} ${w+5},0`} fill={roof} />
                   {door}
                   {windows1}
                </g>
              )
            }
          })()}
          
{type === "shop" && (() => {
              const shopVariant = Math.floor(r() * 3);
              if (shopVariant === 0) return (
                <g>
                  <rect x="-4" y="-6" width={w+8} height="6" fill={roof} />
                  {Array.from({ length: Math.floor(w/8) }).map((_, i) => (
                     <path key={`aw1-${i}`} d={`M${i*8},12 Q${i*8+4},18 ${i*8+8},12 Z`} fill={i%2===0 ? "#ef4444" : "#ffffff"} />
                  ))}
                  {Array.from({ length: Math.floor(w/8) }).map((_, i) => (
                     <rect key={`sw-${i}`} x={i*8} y="0" width="8" height="12" fill={i%2===0 ? "#ef4444" : "#ffffff"} />
                  ))}

                  <rect x="8" y="25" width={w-16} height={h-25} fill="#1e293b" />
                  <rect className="city-light" x="8" y="25" width={w-16} height={h-25} fill={lightColor} />
                  <rect className="day-reflection" x="8" y="25" width={w-16} height={h-25} fill="#ffffff" opacity="0.5" />
                  <text x={w/2} y="8" fontSize="6" textAnchor="middle" fill="#ffffff" fontWeight="bold">STORE</text>
                </g>
              );
              
              if (shopVariant === 1) return (
                <g>
                  <rect x="-2" y="-5" width={w+4} height="8" fill={roof} />
                  <rect x="0" y="3" width={w} height="12" fill="#f59e0b" />
                  <rect x="0" y="15" width={w} height={h-15} fill="#1e293b" />
                  <rect className="city-light" x="6" y="22" width={w-12} height={h-25} fill={lightColor} />
                  <rect className="day-reflection" x="6" y="22" width={w-12} height={h-25} fill="#ffffff" opacity="0.4" />
                  <text x={w/2} y="11" fontSize="5" textAnchor="middle" fill="#ffffff" fontWeight="bold">CAFE</text>
                </g>
              );

              return (
                <g>
                  <polygon points={`0,0 ${w/2},-15 ${w},0`} fill={roof} />
                  <rect x="0" y="0" width={w} height={h} fill="#1e293b" />
                  <rect x="-2" y="10" width={w+4} height="6" fill="#3b82f6" />
                  <rect x="5" y="25" width={(w/2)-7} height={h-25} fill="#0f172a" />
                  <rect className="city-light" x="5" y="25" width={(w/2)-7} height={h-25} fill={lightColor} />
                  <rect x={(w/2)+2} y="25" width={(w/2)-7} height={h-25} fill="#0f172a" />
                  <rect className="city-light" x={(w/2)+2} y="25" width={(w/2)-7} height={h-25} fill={lightColor} />
                  <text x={w/2} y="15" fontSize="4.5" textAnchor="middle" fill="#ffffff" fontWeight="bold">TECH</text>
                </g>
              );
            })()}

          {type === "mall" && (
             <g>
                 {/* High-Tech Main building body */}
                   <rect x="0" y="20" width={w} height={h-20} fill="#0f172a" />
                   
                   {/* Neon Accent Lines and Grids */}
                   <rect className="city-light" x="5" y="25" width={w-10} height="2" fill="#0ea5e9" filter="drop-shadow(0 0 5px #0ea5e9)" />
                   <rect className="city-light" x="5" y="80" width={w-10} height="2" fill="#f43f5e" filter="drop-shadow(0 0 5px #f43f5e)" />
                   
                   {/* Futuristic Glass Dome / Vaulted Roof */}
                   <path d={`M 0,20 Q ${w/2},-15 ${w},20 Z`} fill="#38bdf8" opacity="0.3" />
                   <path className="city-light" d={`M 0,20 Q ${w/2},-15 ${w},20 Z`} fill="#0ea5e9" filter="drop-shadow(0 0 10px #0ea5e9)" opacity="0.5" />
                   <path className="day-reflection" d={`M 0,20 Q ${w/2},-15 ${w/2},10 Z`} fill="#ffffff" opacity="0.4" />

                   {/* Hexagonal segmentation over dome */}
                   <path d={`M ${w*0.3},8 L ${w*0.3},20 M ${w*0.5},0 L ${w*0.5},20 M ${w*0.7},8 L ${w*0.7},20`} stroke="#0284c7" strokeWidth="2" fill="none" opacity="0.7" />
                   
                   {/* Central Holographic Ring inside dome */}
                   <ellipse className="city-light" cx={w/2} cy="10" rx="15" ry="5" fill="none" stroke="#22d3ee" strokeWidth="2" filter="drop-shadow(0 0 8px #22d3ee)">
                      <animateTransform attributeName="transform" type="rotate" values={`-10 ${w/2} 10; 10 ${w/2} 10; -10 ${w/2} 10`} dur="3s" repeatCount="indefinite" />
                   </ellipse>

                   {/* Entrance / Digital Marquee */}
                   <rect x="10" y="15" width={w-20} height="15" rx="2" fill="#020617" stroke="#38bdf8" strokeWidth="1" />
                   <rect className="city-light" x="10" y="15" width={w-20} height="15" rx="2" fill="#020617" stroke="#38bdf8" strokeWidth="1" filter="drop-shadow(0 0 8px #38bdf8)" />
                   
                   {/* MEGAMALL Text with Sci-Fi Font Style */}
                   <text x={w/2} y="25" fontSize="8" fill="#e0f2fe" fontWeight="bold" textAnchor="middle" style={{ letterSpacing: '4px' }}>
                       NEXUS
                   </text>
                   <text className="city-light" x={w/2} y="25" fontSize="8" fill="#38bdf8" fontWeight="bold" textAnchor="middle" style={{ letterSpacing: '4px' }} filter="drop-shadow(0 0 5px #38bdf8)">
                       NEXUS
                   </text>

                   {/* Glowing Walkway / Atrium displays */}
                   {Array.from({ length: 4 }).map((_, i) => (
                      <g key={`store-${i}`} transform={`translate(${10 + i * ((w-20)/4)}, 40)`}>
                         <polygon points={`0,0 ${(w-20)/4 - 4},0 ${(w-20)/4 - 2},35 2,35`} fill="#1e293b" />
                         <polygon className="city-light" points={`0,0 ${(w-20)/4 - 4},0 ${(w-20)/4 - 2},35 2,35`} fill={i % 2 === 0 ? "#8b5cf6" : "#06b6d4"} opacity="0.8" filter="drop-shadow(0 0 4px #ffffff)">
                            <animate attributeName="opacity" values="0.6;0.9;0.6" dur={`${2 + i*0.5}s`} repeatCount="indefinite" />
                         </polygon>
                      </g>
                   ))}
               </g>
          )}

          {type === "cinema" && (
             <g>
               {/* Asymmetrical futuristic structure */}
               <path d={`M 0,40 L ${w*0.3},15 L ${w},25 L ${w},${h} L 0,${h} Z`} fill="#1e293b" />
               <path className="city-light" d={`M 0,40 L ${w*0.3},15 L ${w},25`} fill="none" stroke="#f472b6" strokeWidth="2" filter="drop-shadow(0 0 5px #f472b6)" />
               
               <rect x="15" y="35" width={w-30} height={h-35} fill="#312e81" />
               <rect className="city-light" x="15" y="35" width={w-30} height={h-35} fill="#312e81" stroke="#8b5cf6" strokeWidth="1" />
               
               {/* Floating Marquee Hologram */}
               <g transform={`translate(${w/2}, 25)`}>
                 <rect x="-35" y="-10" width="70" height="20" rx="3" fill="#0f172a" opacity="0.9" />
                 <text x="0" y="4" fontSize="10" fill="#f472b6" fontWeight="bold" textAnchor="middle" style={{ letterSpacing: '2px' }}>HOLOPLEX</text>
                 <rect className="city-light" x="-35" y="-10" width="70" height="20" rx="3" fill="none" stroke="#f472b6" strokeWidth="2" filter="drop-shadow(0 0 8px #f472b6)" />
               </g>

               {/* Digital Streaming Ads / Posters */}
               <rect x={w*0.2} y="55" width="22" height="30" fill="#312e81" rx="2" />
               <g className="city-light">
                 <rect x={w*0.2} y="55" width="22" height="30" fill="#0ea5e9" rx="2" filter="drop-shadow(0 0 8px #0ea5e9)" opacity="0.9">
                   <animate attributeName="opacity" values="0.7;1;0.7" dur="2s" repeatCount="indefinite" />
                 </rect>
                 {/* Internal scanning line */}
                 <line x1={w*0.2} x2={w*0.2 + 22} y1="55" y2="55" stroke="#ffffff" strokeWidth="1">
                    <animate attributeName="y1" values="55;85;55" dur="3s" repeatCount="indefinite" />
                    <animate attributeName="y2" values="55;85;55" dur="3s" repeatCount="indefinite" />
                 </line>
               </g>
               
               <rect x={w*0.6} y="55" width="22" height="30" fill="#4c1d95" rx="2" />
               <g className="city-light">
                 <rect x={w*0.6} y="55" width="22" height="30" fill="#d946ef" rx="2" filter="drop-shadow(0 0 8px #d946ef)" opacity="0.9">
                   <animate attributeName="opacity" values="0.7;1;0.7" dur="2.5s" repeatCount="indefinite" />
                 </rect>
                 <line x1={w*0.6} x2={w*0.6 + 22} y1="85" y2="85" stroke="#ffffff" strokeWidth="1">
                    <animate attributeName="y1" values="85;55;85" dur="2.5s" repeatCount="indefinite" />
                    <animate attributeName="y2" values="85;55;85" dur="2.5s" repeatCount="indefinite" />
                 </line>
               </g>
             </g>
          )}

          {type === "office" && (
            <g>
               <rect width={w} height="8" fill={roof} />
               {r() > 0.5 && <rect x={w/4} y="-15" width={w/2} height="15" fill={roof} />}
               <rect x={w/2 - 10} y="-6" width="20" height="6" fill="#0f172a" />
            </g>
          )}
          
          {type === "skyscraper" && (
            <g>
              {r() > 0.5 ? (
                 <polygon points={`0,0 ${w/2},-30 ${w},0`} fill={roof} />
              ) : (
                 <g>
                   <rect x="0" y="-10" width={w} height="10" fill={roof} />
                   <rect x={w/4} y="-20" width={w/2} height="10" fill={base} />
                 </g>
              )}
              {r() > 0.5 && <rect x={w/2 - 2} y="-50" width="4" height="20" fill="#94a3b8" />}
              <rect x="5" y="-8" width="10" height="8" fill="#cbd5e1" />
              <rect x={w - 15} y="-12" width="10" height="12" fill="#cbd5e1" />
              
              {/* Aircraft warning light (blinks mostly at night) */}
              <circle className="city-light" cx={w/2} cy="-30" r="3" fill="#ef4444" filter="drop-shadow(0 0 8px #ef4444)">
                 <animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite" />
              </circle>
            </g>
          )}

          {/* New Sci-Fi Tower Styles (added at lvl 18) */}
          {type === "sci-fi-spire" && (
            <g>
              <path d={`M 0,0 L ${w/2},-30 L ${w},0 Z`} fill={roof} />
              <rect x="5" y="-15" width={w-10} height="15" fill={base} />
              <rect x="0" y="-18" width={w} height="3" fill="#38bdf8" />
              <rect className="city-light" x="0" y="-18" width={w} height="3" fill="#38bdf8" filter="drop-shadow(0 0 5px #38bdf8)" />
            </g>
          )}
          
          {type === "sci-fi-block" && (
            <g>
              <rect x="-2" y="-10" width={w+4} height="10" fill={roof} />
              <rect x="0" y="-15" width={w} height="5" fill="#f472b6" />
              <rect className="city-light" x="0" y="-15" width={w} height="5" fill="#f472b6" filter="drop-shadow(0 0 5px #f472b6)" />
              <rect x={w/2 - 5} y="-35" width="10" height="20" fill={base} />
              <circle cx={w/2} cy="-38" r="4" fill="#2dd4bf" />
              <circle className="city-light" cx={w/2} cy="-38" r="4" fill="#2dd4bf" filter="drop-shadow(0 0 8px #2dd4bf)" />
            </g>
          )}

          {type === "sci-fi-stripes" && (
            <g>
              <path d={`M 0,0 L ${w/4},-20 L ${(w*3)/4},-20 L ${w},0 Z`} fill={roof} />
              <rect x={w/4} y="-35" width={w/2} height="15" fill={base} />
              <rect x={w/4 + 2} y="-35" width={w/2 - 4} height="5" fill="#2dd4bf" />
              <rect className="city-light" x={w/4 + 2} y="-35" width={w/2 - 4} height="5" fill="#2dd4bf" filter="drop-shadow(0 0 5px #2dd4bf)" />
            </g>
          )}

          {/* Detailed Windows for Offices and Skyscrapers */}
          {(type === "office" || type === "skyscraper" || type.startsWith("sci-fi-")) && (
            <g>
              {type.startsWith("sci-fi-") ? (
                // Sci-fi vertical light strips instead of normal windows for variation
                <g>
                  {Array.from({ length: 3 }).map((_, stripIdx) => {
                    const stripX = w/4 + stripIdx * (w/4);
                    return (
                      <g key={`strip-${stripIdx}`}>
                        <rect x={stripX - 2} y="10" width="4" height={h-20} fill="#1e293b" />
                        <rect className="city-light" x={stripX - 1} y="15" width="2" height={h-30} fill={lightColor} opacity={0.6 + r()*0.4} filter={`drop-shadow(0 0 3px ${lightColor})`} />
                      </g>
                    );
                  })}
                </g>
              ) : (
                // Normal windows
                Array.from({ length: Math.floor(h / 20) }).map((_, vi) => 
                  Array.from({ length: Math.floor(w / 14) }).map((_, hi) => {
                    if (r() > 0.85) return null; // Variation

                    return (
                      <g key={`w-${vi}-${hi}`} transform={`translate(${6 + hi*14}, ${15 + vi*20})`}>
                         {/* Base dark window */}
                         <rect width="9" height="12" fill="#1e293b" stroke="#0f172a" strokeWidth="1" />
                         {/* Night Light overlays */}
                         {r() > 0.3 && <rect className="city-light" width="9" height="12" fill={lightColor} />}
                         {/* Day Reflections overlay */}
                         <polygon className="day-reflection" points="0,6 9,0 0,0" fill="#ffffff" />
                      </g>
                    );
                  })
                )
              )}
            </g>
          )}
        </g>
      );
    });
  }, [elements, level]);
  
  const trees = useMemo(() => {
    const rng = seededRNG(level * 10);
    const ts = [];
    const numTrees = Math.max(0, 30 - Math.floor(level * 1.5));
    for (let i = 0; i < numTrees; i++) {
       const x = rng() * W;
       if (level >= 8 && x > W/2 - 150 && x < W/2 + 150) continue;
       const s = 0.5 + rng() * 0.7;
       ts.push(
         <g key={`tr-${i}`} transform={`translate(${x}, ${GROUND}) scale(${s})`}>
           <ellipse cx="0" cy="0" rx="12" ry="3" fill="#1f2937" opacity="0.25" />
           <rect x="-3" y="-15" width="6" height="15" fill="#78350f" />
           <circle cx="-5" cy="-20" r="12" fill="#166534" />
           <circle cx="5" cy="-25" r="14" fill="#15803d" />
           <circle cx="-2" cy="-30" r="12" fill="#22c55e" />
         </g>
       );
    }
    return ts;
  }, [level]);

  

  

  return (
    <div style={{ width: "100%", height }}>
      <GlobalStyles />
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: '100%' }}>
        <Sky stage={level} isRainyDay={isRainyDay} />
        <Clouds stage={level} isRainyDay={isRainyDay} />
        <Rain stage={level} isRainyDay={isRainyDay} />
        
        <BackgroundCity stage={level} />
        <AtmosphereOrnaments stage={level} />
        <GrassLayer stage={level} />
        {buildings}
        
        {trees}
        {level >= 5 && <CentralIcon stage={level} />}
        <GroundMist isRainyDay={isRainyDay} />
        <Ground stage={level} isRainyDay={isRainyDay} />
        <RainSplashes stage={level} isRainyDay={isRainyDay} />
        <Subway stage={level} />
        <Traffic stage={level} />
      </svg>
    </div>
  );
}
