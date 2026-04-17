import { useEffect, useMemo, useState } from "react";

const TOKEN_KEY = "life_rpg_admin_token";

function resolveApiBase() {
  const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim();
  const protocol = window.location.protocol || "http:";
  const host = window.location.hostname || "localhost";

  if (configured) {
    try {
      const parsed = new URL(configured);
      if ((parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") && host !== "localhost" && host !== "127.0.0.1") {
        parsed.hostname = host;
        return parsed.toString().replace(/\/$/, "");
      }
      return configured;
    } catch {
      // ignore
    }
  }
  return `${protocol}//${host}:4000`;
}

async function adminFetch(path, token) {
  const base = resolveApiBase();
  const res = await fetch(`${base}${path}`, {
    headers: { "x-admin-token": token },
    cache: "no-store"
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

function fmtTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString();
}

function levelColor(level) {
  const l = String(level || "info").toLowerCase();
  if (l === "fatal") return "#ff3b3b";
  if (l === "error") return "#ff6b6b";
  if (l === "warn") return "#f59e0b";
  if (l === "debug") return "#8b92a8";
  return "#60a5fa";
}

export default function AdminPanel() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || "");
  const [tokenInput, setTokenInput] = useState("");
  const [summary, setSummary] = useState(null);
  const [events, setEvents] = useState([]);
  const [health, setHealth] = useState(null);
  const [ab, setAb] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState("");
  const [filterLevel, setFilterLevel] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);

  const authenticated = Boolean(token);

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filterType) params.set("type", filterType);
      if (filterLevel) params.set("level", filterLevel);

      const [s, e, h, a] = await Promise.all([
        adminFetch(`/api/admin/summary`, token),
        adminFetch(`/api/admin/events?${params.toString()}`, token),
        adminFetch(`/api/admin/health`, token),
        adminFetch(`/api/admin/ab`, token)
      ]);
      setSummary(s);
      setEvents(e.events || []);
      setHealth(h);
      setAb(a);
      setLastUpdated(new Date());
    } catch (err) {
      if (String(err?.message || err).includes("401")) {
        setError("Invalid admin token.");
        setToken("");
        localStorage.removeItem(TOKEN_KEY);
      } else {
        setError(String(err?.message || err));
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, filterType, filterLevel]);

  useEffect(() => {
    if (!authenticated || !autoRefresh) return undefined;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, autoRefresh, filterType, filterLevel]);

  const byType = summary?.byType || [];
  const byLevel = summary?.byLevel || [];

  const totals = summary?.totals || {};

  const uniqueTypes = useMemo(() => {
    const set = new Set();
    for (const e of events) set.add(e.type);
    for (const b of byType) set.add(b.type);
    return Array.from(set).sort();
  }, [events, byType]);

  if (!authenticated) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>Life RPG Admin</h1>
          <p style={styles.authHint}>Enter admin token to view telemetry.</p>
          <input
            type="password"
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="admin token"
            style={styles.authInput}
            onKeyDown={(e) => {
              if (e.key === "Enter" && tokenInput.trim()) {
                const t = tokenInput.trim();
                localStorage.setItem(TOKEN_KEY, t);
                setToken(t);
              }
            }}
          />
          <button
            style={styles.authButton}
            onClick={() => {
              const t = tokenInput.trim();
              if (!t) return;
              localStorage.setItem(TOKEN_KEY, t);
              setToken(t);
            }}
          >
            Sign in
          </button>
          {error ? <div style={styles.authError}>{error}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <div style={styles.headerTitle}>Life RPG — Admin</div>
          <div style={styles.headerSub}>
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : "Loading…"}
            {health ? ` · uptime ${health.uptimeSec}s · rss ${health.memory?.rssMB}MB` : ""}
          </div>
        </div>
        <div style={styles.headerActions}>
          <label style={styles.toggleLabel}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />{" "}
            auto-refresh
          </label>
          <button style={styles.smallButton} onClick={load} disabled={loading}>
            {loading ? "…" : "Refresh"}
          </button>
          <button
            style={styles.smallButtonGhost}
            onClick={() => {
              localStorage.removeItem(TOKEN_KEY);
              setToken("");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <section style={styles.cards}>
        <StatCard label="Users" value={totals.users ?? "—"} />
        <StatCard label="Active 24h" value={totals.activeUsers24h ?? "—"} />
        <StatCard label="Events 24h" value={totals.eventsLast24h ?? "—"} />
        <StatCard label="Events 7d" value={totals.eventsLast7d ?? "—"} />
        <StatCard label="Errors 24h" value={totals.errorsLast24h ?? "—"} tone={totals.errorsLast24h ? "danger" : "default"} />
      </section>

      <section style={styles.twoCol}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Events by type (24h)</div>
          {byType.length === 0 ? <div style={styles.empty}>No events yet.</div> : (
            <div>
              {byType.map((b) => (
                <div key={b.type} style={styles.row}>
                  <span>{b.type}</span>
                  <span style={styles.count}>{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>By level (24h)</div>
          {byLevel.length === 0 ? <div style={styles.empty}>No events.</div> : (
            <div>
              {byLevel.map((b) => (
                <div key={b.level} style={styles.row}>
                  <span style={{ color: levelColor(b.level) }}>{b.level}</span>
                  <span style={styles.count}>{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section style={styles.panel}>
        <div style={styles.panelTitle}>A/B experiments (last 14d)</div>
        {!ab || !ab.experiments || ab.experiments.length === 0 ? (
          <div style={styles.empty}>No experiment data yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {ab.experiments.map((exp) => (
              <div key={exp.experiment}>
                <div style={{ marginBottom: 6, color: "#cbd5e1", fontWeight: 600 }}>{exp.experiment}</div>
                <div style={styles.tableWrap}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={styles.th}>Variant</th>
                        <th style={styles.th}>Users</th>
                        <th style={styles.th}>Events</th>
                        <th style={styles.th}>Errors</th>
                        <th style={styles.th}>Err rate</th>
                        <th style={styles.th}>Conversions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {exp.variants.map((v) => (
                        <tr key={v.variant} style={styles.tr}>
                          <td style={styles.td}>{v.variant}</td>
                          <td style={styles.td}>{v.users}</td>
                          <td style={styles.td}>{v.events}</td>
                          <td style={{ ...styles.td, color: v.errors ? "#ff6b6b" : undefined }}>{v.errors}</td>
                          <td style={styles.td}>{(v.errorRate * 100).toFixed(2)}%</td>
                          <td style={styles.tdWide}>
                            {Object.keys(v.conversions || {}).length === 0
                              ? "—"
                              : Object.entries(v.conversions).map(([k, n]) => `${k}:${n}`).join("  ·  ")}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={styles.panel}>
        <div style={styles.panelTitle}>Recent events</div>
        <div style={styles.filters}>
          <select value={filterLevel} onChange={(e) => setFilterLevel(e.target.value)} style={styles.select}>
            <option value="">all levels</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
            <option value="fatal">fatal</option>
            <option value="debug">debug</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={styles.select}>
            <option value="">all types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        {events.length === 0 ? (
          <div style={styles.empty}>No events for current filter.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Level</th>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Platform</th>
                  <th style={styles.th}>Message</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id} style={styles.tr}>
                    <td style={styles.td}>{fmtTime(e.createdAt)}</td>
                    <td style={{ ...styles.td, color: levelColor(e.level) }}>{e.level}</td>
                    <td style={styles.td}>{e.type}</td>
                    <td style={styles.td}>{e.username || e.userId || "—"}</td>
                    <td style={styles.td}>{e.platform || "—"}</td>
                    <td style={styles.tdWide}>
                      <div style={{ whiteSpace: "pre-wrap" }}>{e.message || "—"}</div>
                      {e.stack ? (
                        <details>
                          <summary style={styles.stackSummary}>stack</summary>
                          <pre style={styles.pre}>{e.stack}</pre>
                        </details>
                      ) : null}
                      {e.meta ? (
                        <details>
                          <summary style={styles.stackSummary}>meta</summary>
                          <pre style={styles.pre}>{e.meta}</pre>
                        </details>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {error ? <div style={styles.errorBar}>{error}</div> : null}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }) {
  return (
    <div style={{ ...styles.statCard, borderColor: tone === "danger" ? "#ff6b6b" : "rgba(255,255,255,0.1)" }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: tone === "danger" ? "#ff6b6b" : "#f1f5f9" }}>{value}</div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#020617",
    color: "#e2e8f0",
    fontFamily: "system-ui, -apple-system, sans-serif",
    padding: "24px"
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    gap: 16,
    flexWrap: "wrap"
  },
  headerTitle: { fontSize: 24, fontWeight: 600, color: "#f1f5f9" },
  headerSub: { fontSize: 12, color: "#94a3b8", marginTop: 2 },
  headerActions: { display: "flex", gap: 8, alignItems: "center" },
  toggleLabel: { fontSize: 12, color: "#94a3b8" },
  smallButton: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 13
  },
  smallButtonGhost: {
    background: "transparent",
    color: "#94a3b8",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "6px 12px",
    cursor: "pointer",
    fontSize: 13
  },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 },
  statCard: { background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" },
  statLabel: { fontSize: 12, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: 700, marginTop: 4 },
  twoCol: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 12, marginBottom: 16 },
  panel: { background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 16, marginBottom: 16 },
  panelTitle: { fontSize: 14, color: "#cbd5e1", marginBottom: 10, fontWeight: 600 },
  row: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 },
  count: { color: "#60a5fa", fontWeight: 600 },
  empty: { color: "#64748b", fontSize: 13, padding: "8px 0" },
  filters: { display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  select: { background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { textAlign: "left", padding: "8px 10px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { verticalAlign: "top" },
  td: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap" },
  tdWide: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: 560 },
  stackSummary: { cursor: "pointer", color: "#64748b", fontSize: 11, marginTop: 4 },
  pre: { whiteSpace: "pre-wrap", fontSize: 11, color: "#94a3b8", background: "#020617", padding: 8, borderRadius: 6, marginTop: 4, maxHeight: 220, overflow: "auto" },
  errorBar: { position: "fixed", bottom: 16, right: 16, background: "#7f1d1d", color: "#fff", padding: "8px 12px", borderRadius: 8, fontSize: 12 },

  authWrap: { minHeight: "100vh", background: "#020617", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 },
  authCard: { background: "#0f172a", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: 24, width: "100%", maxWidth: 360 },
  authTitle: { color: "#f1f5f9", fontSize: 22, margin: 0, marginBottom: 8 },
  authHint: { color: "#94a3b8", fontSize: 13, marginBottom: 16 },
  authInput: { width: "100%", padding: "10px 12px", background: "#020617", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, color: "#e2e8f0", boxSizing: "border-box" },
  authButton: { marginTop: 12, width: "100%", padding: "10px 12px", background: "#22d3ee", color: "#0f172a", fontWeight: 700, border: "none", borderRadius: 8, cursor: "pointer" },
  authError: { marginTop: 12, color: "#fca5a5", fontSize: 13 }
};
