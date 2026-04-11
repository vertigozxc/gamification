import re

with open('C:\\Users\\User\\Desktop\\gamification\\client\\src\\components\\CityIllustration.jsx', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Remove birds and airplane
c = re.sub(r'const birds = useMemo\(\(\) => \{.+?\}, \[\]\);', '', c, flags=re.DOTALL)
c = re.sub(r'const airplanes = useMemo\(\(\) => \{.+?\}, \[\]\);', '', c, flags=re.DOTALL)
c = c.replace('{airplanes}', '')
c = c.replace('{birds}', '')

# 2. Snake to be random and white
snake_old = """           // Start from bottom up
           validRows.reverse();

           validRows.forEach((rowY, i) => {
              const xStart = cx - baseW/3 + 4 + 3;
              const xEnd = cx - baseW/3 + 4 + (numCols - 1) * 10 + 3;
              const cy = rowY + 4; // center of window

              if (i === 0) {
                 d += `M ${xStart},${cy} L ${xEnd},${cy}`;
              } else if (i % 2 === 1) {
                 d += ` L ${xEnd},${cy} L ${xStart},${cy}`;
              } else {
                 d += ` L ${xStart},${cy} L ${xEnd},${cy}`;
              }
           });

            return (
                <path className="city-light" d={d} fill="none" stroke="#facc15" strokeWidth="8" strokeDasharray="15 85" pathLength="100" filter="drop-shadow(0 0 10px #facc15)">
                  <animate attributeName="stroke-dashoffset" from="100" to="0" dur="7.5s" repeatCount="indefinite" />
                </path>
             );"""

snake_new = """           // Start from bottom up
           validRows.reverse();

           const rngSnake = seededRNG(20);
           let currRow = Math.floor(validRows.length / 2);
           let currCol = Math.floor(numCols / 2);
           
           const getPoint = (r, c) => {
              const rPos = validRows[r] + 4;
              const cPos = cx - baseW/3 + 4 + c * 10 + 3;
              return `${cPos},${rPos}`;
           };
           
           d = `M ${getPoint(currRow, currCol)}`;
           
           for(let k=0; k<150; k++) {
              const dirs = [];
              if (currRow > 0) dirs.push([-1, 0]);
              if (currRow < validRows.length - 1) dirs.push([1, 0]);
              if (currCol > 0) dirs.push([0, -1]);
              if (currCol < numCols - 1) dirs.push([0, 1]);
              
              const chosen = dirs[Math.floor(rngSnake() * dirs.length)];
              currRow += chosen[0];
              currCol += chosen[1];
              
              d += ` L ${getPoint(currRow, currCol)}`;
           }

            return (
                <path className="city-light" d={d} fill="none" stroke="#ffffff" strokeWidth="6" strokeDasharray="10 90" pathLength="100" filter="drop-shadow(0 0 10px #ffffff)">
                  <animate attributeName="stroke-dashoffset" from="100" to="0" dur="12s" repeatCount="indefinite" />
                </path>
             );"""

c = c.replace(snake_old, snake_new)


# 3. Basic windows staggered on
win_old = """        {/* Basic windows pattern appearing conditionally */}
        <g>
           {Array.from({ length: Math.floor(h / 15) }).map((_, vi) => {
              const rowY = top + 15 + vi * 15;
              if (rowY >= GROUND) return null;
              return Array.from({ length: Math.floor(baseW / 1.5 / 10) }).map((_, hi) => {
                 const cellX = (cx - baseW/3 + 4) + hi * 10;
                 return (
                   <g key={`mc-${vi}-${hi}`}>
                      <rect x={cellX} y={rowY} width="6" height="8" fill="#1e293b" />
                      {stage < 10 && <rect className="city-light" x={cellX} y={rowY} width="6" height="8" fill="#fde047" opacity="1" />}
                      {stage >= 10 && <rect className="city-light" x={cellX} y={rowY} width="6" height="8" fill="#22d3ee" opacity="0.8" />}
                   </g>
                 );
              });
           })}
        </g>"""

win_new = """        {/* Basic windows pattern appearing conditionally */}
        <g>
           {(() => {
              const rngLights = seededRNG(stage * 42); // stable random sequence for lights
              return Array.from({ length: Math.floor(h / 15) }).map((_, vi) => {
                 const rowY = top + 15 + vi * 15;
                 if (rowY >= GROUND) return null;
                 return Array.from({ length: Math.floor(baseW / 1.5 / 10) }).map((_, hi) => {
                    const cellX = (cx - baseW/3 + 4) + hi * 10;
                    // Introduce a stable random negative delay up to 15s to trigger the staggered turning on effect
                    const delay = (rngLights() * 15).toFixed(1);
                    return (
                      <g key={`mc-${vi}-${hi}`}>
                         <rect x={cellX} y={rowY} width="6" height="8" fill="#1e293b" />
                         {stage < 10 && <rect className="city-light" x={cellX} y={rowY} width="6" height="8" fill="#fde047" opacity="1" style={{ animationDelay: `-${delay}s` }} />}
                         {stage >= 10 && <rect className="city-light" x={cellX} y={rowY} width="6" height="8" fill="#22d3ee" opacity="0.8" style={{ animationDelay: `-${delay}s` }} />}
                      </g>
                    );
                 });
              });
           })()}
        </g>"""

c = c.replace(win_old, win_new)

with open('C:\\Users\\User\\Desktop\\gamification\\client\\src\\components\\CityIllustration.jsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Done")