import { useCallback, useEffect, useRef } from "react";

const COLORS = [
  "#ff4444", "#ff6622", "#ffcc00", "#44ff66",
  "#00ccff", "#4488ff", "#cc44ff", "#ff44cc",
  "#ffffff", "#ffeeaa", "#aaffee"
];

const BURST_TIMES_MS = [0, 320, 580, 860, 1100, 1380, 1640, 1900];

export default function CityFireworks({ active, onDone }) {
  const canvasRef = useRef(null);
  const frameRef = useRef(null);

  const run = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;

    const particles = [];
    let startTime = null;
    let burstIdx = 0;
    const totalDuration = 3800;

    function spawnExplosion(x, y) {
      const c1 = COLORS[Math.floor(Math.random() * COLORS.length)];
      const c2 = COLORS[Math.floor(Math.random() * COLORS.length)];
      const count = 55 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.15;
        const speed = 2.5 + Math.random() * 5;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.2,
          alpha: 1,
          color: Math.random() > 0.45 ? c1 : c2,
          size: 2 + Math.random() * 2.8,
          gravity: 0.055 + Math.random() * 0.04,
          tail: Math.random() > 0.6
        });
      }
      // sparkle core
      for (let i = 0; i < 8; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 1.2,
          vy: (Math.random() - 0.5) * 1.2,
          alpha: 1,
          color: "#ffffff",
          size: 3.5 + Math.random() * 2,
          gravity: 0.02,
          tail: false
        });
      }
    }

    function frame(ts) {
      if (!startTime) startTime = ts;
      const elapsed = ts - startTime;

      while (burstIdx < BURST_TIMES_MS.length && elapsed >= BURST_TIMES_MS[burstIdx]) {
        const x = (0.12 + Math.random() * 0.76) * canvas.width;
        const y = (0.08 + Math.random() * 0.38) * canvas.height;
        spawnExplosion(x, y);
        burstIdx++;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (p.tail) {
          ctx.globalAlpha = p.alpha * 0.35;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x - p.vx * 2, p.y - p.vy * 2, p.size * 0.6, 0, Math.PI * 2);
          ctx.fill();
        }
        p.x += p.vx;
        p.y += p.vy;
        p.vy += p.gravity;
        p.vx *= 0.985;
        p.alpha -= 0.013;
        if (p.alpha <= 0) { particles.splice(i, 1); continue; }
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (elapsed < totalDuration || particles.length > 0) {
        frameRef.current = requestAnimationFrame(frame);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        onDone?.();
      }
    }

    frameRef.current = requestAnimationFrame(frame);
  }, [onDone]);

  useEffect(() => {
    if (!active) return;
    run();
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active, run]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 30,
        borderRadius: "inherit"
      }}
    />
  );
}
