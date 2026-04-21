import { useEffect, useMemo, useState } from "react";

function copyEventToClipboard(e, d, identity) {
  const lines = [
    `🐛 BUG REPORT — GoHabit Admin`,
    ``,
    `Time: ${fmtTime(e.createdAt)}`,
    `Severity: ${levelLabel(e.level)}`,
    `Event type: ${e.type || "—"}`,
    `Platform: ${e.platform || "—"}`,
    ``,
    `Title: ${d.title}`,
    `Meaning: ${d.meaning}`,
    `Impact: ${d.impact}`,
    `Recommended action: ${d.action}`,
    ``,
    `User ID: ${identity.userId || "system event"}`,
    `Username: ${e.username || "—"}`,
    `Email: ${identity.email || "not provided"}`,
    ``,
    `Message: ${e.message || "—"}`,
  ];
  if (e.stack) lines.push(``, `Stack trace:`, e.stack);
  if (e.meta) lines.push(``, `Meta:`, safeJson(e.meta));
  navigator.clipboard.writeText(lines.join("\n")).catch(() => {});
}

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

async function adminFetch(path, token, options = {}) {
  const { method = "GET", body } = options;
  const base = resolveApiBase();
  const headers = { "x-admin-token": token };
  if (body !== undefined) {
    headers["content-type"] = "application/json";
  }
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    cache: "no-store",
    body: body !== undefined ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let detail = "";
    try {
      const payload = await res.json();
      detail = payload?.detail || payload?.error || "";
    } catch {
      // ignore
    }
    throw new Error(`${res.status}${detail ? `: ${detail}` : ""}`);
  }
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

function levelLabel(level) {
  const l = String(level || "info").toLowerCase();
  if (l === "fatal") return "Critical";
  if (l === "error") return "Problem";
  if (l === "warn") return "Warning";
  if (l === "debug") return "Technical";
  return "Info";
}

function safeJson(meta) {
  if (meta == null) return "";
  if (typeof meta === "string") return meta;
  try {
    return JSON.stringify(meta);
  } catch {
    return String(meta);
  }
}

function firstEmail(text) {
  if (!text) return "";
  const m = String(text).match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return m ? m[0] : "";
}

function parseMetaObject(metaRaw) {
  if (!metaRaw) return null;
  if (metaRaw && typeof metaRaw === "object" && !Array.isArray(metaRaw)) return metaRaw;
  if (typeof metaRaw !== "string") return null;
  try {
    const parsed = JSON.parse(metaRaw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function resolveEventEmail(event) {
  const metaRaw = event?.meta;
  const metaObj = parseMetaObject(metaRaw);
  if (metaObj) {
    if (metaObj.actorEmail) return String(metaObj.actorEmail);
    if (metaObj.email) return String(metaObj.email);
    if (metaObj.userEmail) return String(metaObj.userEmail);
  }

  let metaText = "";
  if (typeof metaRaw === "string") {
    metaText = metaRaw;
  }

  return (
    firstEmail(event?.username) ||
    firstEmail(event?.message) ||
    firstEmail(metaText) ||
    ""
  );
}

function resolveEventUserId(event) {
  const direct = String(event?.userId || "").trim();
  if (direct) return direct;
  const metaObj = parseMetaObject(event?.meta);
  if (!metaObj) return "";
  const fromMeta = metaObj.actorUserId || metaObj.userId || metaObj.uid || "";
  return String(fromMeta || "").trim();
}

function resolveActorIdentity(event) {
  const userId = resolveEventUserId(event);
  const email = resolveEventEmail(event);
  const hasIdentity = Boolean(userId || email);
  const isSystemEvent = !hasIdentity && String(event?.platform || "").toLowerCase() === "server";
  return { userId, email, hasIdentity, isSystemEvent };
}

function humanizeType(type) {
  return String(type || "unknown")
    .replace(/[._-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

function describeEvent(event) {
  const type = String(event?.type || "").toLowerCase();
  const level = String(event?.level || "info").toLowerCase();
  const message = String(event?.message || "").toLowerCase();
  const meta = safeJson(event?.meta).toLowerCase();
  const body = `${message} ${meta}`;

  if (type.includes("mobile-token") || type.includes("mobile-bridge") || type.includes("google") || type.includes("auth")) {
    return {
      title: "Login flow issue",
      meaning: "Users may be unable to complete sign-in on mobile.",
      action: "Open latest auth events, check HTTP status and bridge creation. Prioritize if repeated.",
      impact: "High"
    };
  }

  if (type === "window_error" || type === "unhandled_rejection" || type === "server_error" || type === "uncaught_exception") {
    return {
      title: "Application crash/error",
      meaning: "Part of the app failed unexpectedly.",
      action: "Open stack details and group by type. Escalate immediately if count is growing.",
      impact: level === "fatal" ? "Critical" : "High"
    };
  }

  if (body.includes("cors blocked")) {
    return {
      title: "Access policy blocked request",
      meaning: "The app tried to call backend, but request was rejected by security policy.",
      action: "Check allowed origins and environment URLs on backend deployment.",
      impact: "High"
    };
  }

  if (body.includes("timeout") || body.includes("timed out")) {
    return {
      title: "Slow response / timeout",
      meaning: "A backend request took too long and failed.",
      action: "Check backend load and recent deploy health. Monitor if this repeats.",
      impact: "Medium"
    };
  }

  if (type === "client_session_start") {
    return {
      title: "User opened app",
      meaning: "Normal session start signal.",
      action: "No action needed.",
      impact: "Low"
    };
  }

  if (type.includes("session_visibility")) {
    return {
      title: "App moved foreground/background",
      meaning: "Normal app lifecycle event.",
      action: "No action needed unless paired with errors.",
      impact: "Low"
    };
  }

  return {
    title: humanizeType(type),
    meaning: level === "error" || level === "fatal"
      ? "An operational problem was recorded."
      : "Operational telemetry event.",
    action: level === "error" || level === "fatal"
      ? "Open details and check whether it affects many users."
      : "No immediate action unless frequency is high.",
    impact: level === "fatal" ? "Critical" : level === "error" ? "High" : level === "warn" ? "Medium" : "Low"
  };
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
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterActor, setFilterActor] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState("telemetry");
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [actingUserId, setActingUserId] = useState("");

  const authenticated = Boolean(token);

  async function loadUsers() {
    if (!token) return;
    setUsersLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "300");
      if (userSearch.trim()) {
        params.set("search", userSearch.trim());
      }
      const response = await adminFetch(`/api/admin/users?${params.toString()}`, token);
      setUsers(response.users || []);
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setUsersLoading(false);
    }
  }

  async function runUserAction(user, action) {
    if (!user?.id) return;
    if (action === "reset-hard" || action === "reset-full") {
      const promptText = action === "reset-full"
        ? `FULL reset user ${user.name || user.username}? This wipes all user data and forces logout on next sync.`
        : `Hard reset user ${user.name || user.username}? This will reset level and quest progress.`;
      const ok = window.confirm(promptText);
      if (!ok) return;
    }

    setActingUserId(user.id);
    setError("");
    try {
      if (action === "grant-xp") {
        await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}/grant-xp`, token, {
          method: "POST",
          body: { amount: 500 }
        });
      } else if (action === "reset-daily") {
        await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}/reset-daily`, token, {
          method: "POST"
        });
      } else if (action === "reset-hard") {
        await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}/reset-hard`, token, {
          method: "POST"
        });
      } else if (action === "reset-full") {
        await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}/reset-full`, token, {
          method: "POST"
        });
      } else if (action === "toggle-dev") {
        await adminFetch(`/api/admin/users/${encodeURIComponent(user.id)}/set-dev-tester`, token, {
          method: "POST",
          body: { enabled: !user.isDevTester }
        });
      }
      await loadUsers();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setActingUserId("");
    }
  }

  async function runWipeAllData() {
    const ok = window.confirm("Wipe ALL database data (users + progress + events)? This cannot be undone.");
    if (!ok) return;

    setError("");
    setUsersLoading(true);
    try {
      await adminFetch("/api/admin/wipe-all-data", token, { method: "POST" });
      setUsers([]);
      await load();
    } catch (err) {
      setError(String(err?.message || err));
    } finally {
      setUsersLoading(false);
    }
  }

  async function load() {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      params.set("limit", "200");
      if (filterType) params.set("type", filterType);
      if (filterSeverity) params.set("level", filterSeverity);

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
  }, [token, filterType, filterSeverity]);

  useEffect(() => {
    if (!authenticated || !autoRefresh) return undefined;
    const id = setInterval(load, 10_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, autoRefresh, filterType, filterSeverity]);

  useEffect(() => {
    if (!authenticated || activeTab !== "users") return undefined;
    const id = setTimeout(() => {
      loadUsers();
    }, 200);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, activeTab, userSearch, token]);

  const byType = summary?.byType || [];
  const byLevel = summary?.byLevel || [];

  const totals = summary?.totals || {};
  const healthStatus = (totals.errorsLast24h || 0) > 0 ? "Needs attention" : "Stable";

  const uniqueTypes = useMemo(() => {
    const set = new Set();
    for (const e of events) set.add(e.type);
    for (const b of byType) set.add(b.type);
    return Array.from(set).sort();
  }, [events, byType]);

  const filteredEvents = useMemo(() => {
    if (filterActor === "all") return events;
    return events.filter((evt) => {
      const identity = resolveActorIdentity(evt);
      return filterActor === "user" ? identity.hasIdentity : identity.isSystemEvent;
    });
  }, [events, filterActor]);

  if (!authenticated) {
    return (
      <div style={styles.authWrap}>
        <div style={styles.authCard}>
          <h1 style={styles.authTitle}>GoHabit Admin</h1>
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
          <div style={styles.headerTitle}>GoHabit - Admin</div>
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

      <section style={styles.tabBar}>
        <button
          style={activeTab === "telemetry" ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab("telemetry")}
        >
          Telemetry
        </button>
        <button
          style={activeTab === "users" ? styles.tabButtonActive : styles.tabButton}
          onClick={() => setActiveTab("users")}
        >
          Users
        </button>
      </section>

      {activeTab === "telemetry" ? (
        <>
      <section style={styles.cards}>
        <StatCard label="System status" value={healthStatus} tone={healthStatus === "Stable" ? "ok" : "danger"} />
        <StatCard label="Users" value={totals.users ?? "—"} />
        <StatCard label="Active 24h" value={totals.activeUsers24h ?? "—"} />
        <StatCard label="Events 24h" value={totals.eventsLast24h ?? "—"} />
        <StatCard label="Events 7d" value={totals.eventsLast7d ?? "—"} />
        <StatCard label="Errors 24h" value={totals.errorsLast24h ?? "—"} tone={totals.errorsLast24h ? "danger" : "default"} />
      </section>

      <section style={styles.twoCol}>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>What happened most (last 24h)</div>
          {byType.length === 0 ? <div style={styles.empty}>No events yet.</div> : (
            <div>
              {byType.map((b) => (
                <div key={b.type} style={styles.row}>
                  <span>{humanizeType(b.type)}</span>
                  <span style={styles.count}>{b.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={styles.panel}>
          <div style={styles.panelTitle}>Severity overview (last 24h)</div>
          {byLevel.length === 0 ? <div style={styles.empty}>No events.</div> : (
            <div>
              {byLevel.map((b) => (
                <div key={b.level} style={styles.row}>
                  <span style={{ color: levelColor(b.level) }}>{levelLabel(b.level)}</span>
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
        <div style={styles.panelTitle}>Recent events with plain-language explanation</div>
        <div style={styles.helpText}>
          Tip: focus first on rows marked Critical or Problem, then follow the suggested action in each row.
        </div>
        <div style={styles.filters}>
          <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} style={styles.select}>
            <option value="">all severity</option>
            <option value="fatal">Critical</option>
            <option value="error">Problem</option>
            <option value="warn">Warning</option>
            <option value="info">Info</option>
            <option value="debug">Technical</option>
          </select>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={styles.select}>
            <option value="">all types</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select value={filterActor} onChange={(e) => setFilterActor(e.target.value)} style={styles.select}>
            <option value="all">all sources</option>
            <option value="user">user-linked only</option>
            <option value="system">system events only</option>
          </select>
        </div>

        {filteredEvents.length === 0 ? (
          <div style={styles.empty}>No events for current filter.</div>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Time</th>
                  <th style={styles.th}>Severity</th>
                  <th style={styles.th}>Event</th>
                  <th style={styles.th}>Meaning</th>
                  <th style={styles.th}>Recommended action</th>
                  <th style={styles.th}>User</th>
                  <th style={styles.th}>Google email</th>
                  <th style={styles.th}>Platform</th>
                  <th style={styles.th}>Message</th>
                  <th style={styles.th}>Copy</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((e) => (
                  <tr key={e.id} style={styles.tr}>
                    {(() => {
                      const d = describeEvent(e);
                      const identity = resolveActorIdentity(e);
                      return (
                        <>
                    <td style={styles.td}>{fmtTime(e.createdAt)}</td>
                    <td style={{ ...styles.td, color: levelColor(e.level), fontWeight: 700 }}>{levelLabel(e.level)}</td>
                    <td style={styles.td}>{d.title}</td>
                    <td style={styles.tdMeaning}>{d.meaning}<div style={styles.impactTag}>Impact: {d.impact}</div></td>
                    <td style={styles.tdMeaning}>{d.action}</td>
                    <td style={styles.tdIdentity}>
                      {identity.isSystemEvent ? (
                        <span style={styles.systemTag}>System event</span>
                      ) : (
                        <>
                          <div style={styles.identityPrimary}>{identity.userId || "unknown userId"}</div>
                          <div style={styles.identitySecondary}>{e.username || ""}</div>
                        </>
                      )}
                    </td>
                    <td style={styles.tdEmail}>
                      {identity.email ? (
                        <span style={styles.emailText}>{identity.email}</span>
                      ) : (
                        <span style={styles.emailMissing}>not provided</span>
                      )}
                    </td>
                    <td style={styles.td}>{e.platform || "—"}</td>
                    <td style={styles.tdWide}>
                      <div style={{ whiteSpace: "pre-wrap" }}>{e.message || "—"}</div>
                      <div style={styles.rawType}>raw type: {e.type || "—"}</div>
                      {e.stack ? (
                        <details>
                          <summary style={styles.stackSummary}>technical stack trace</summary>
                          <pre style={styles.pre}>{e.stack}</pre>
                        </details>
                      ) : null}
                      {e.meta ? (
                        <details>
                          <summary style={styles.stackSummary}>technical meta data</summary>
                          <pre style={styles.pre}>{safeJson(e.meta)}</pre>
                        </details>
                      ) : null}
                    </td>
                    <td style={styles.td}>
                      <CopyButton onClick={() => copyEventToClipboard(e, d, identity)} />
                    </td>
                        </>
                      );
                    })()}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
        </>
      ) : null}

      {activeTab === "users" ? (
        <section style={styles.panel}>
          <div style={styles.usersHeaderRow}>
            <div style={styles.panelTitle}>Users Management</div>
            <div style={styles.usersControls}>
              <input
                type="text"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
                placeholder="Search by name or username"
                style={styles.searchInput}
              />
              <button style={styles.smallButton} onClick={loadUsers} disabled={usersLoading}>
                {usersLoading ? "…" : "Refresh"}
              </button>
            </div>
          </div>
          <div style={styles.helpText}>
            Available actions: +500 XP, reset daily quests, hard reset (level + quests).
          </div>
          <div style={styles.userActionsRow}> 
            <button style={styles.actionButtonDanger} onClick={runWipeAllData} disabled={usersLoading}>
              Wipe All DB Data
            </button>
          </div>
          {usersLoading && users.length === 0 ? <div style={styles.empty}>Loading users…</div> : null}
          {!usersLoading && users.length === 0 ? <div style={styles.empty}>No users found.</div> : null}
          {users.length > 0 ? (
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Name</th>
                    <th style={styles.th}>Email</th>
                    <th style={styles.th}>Level</th>
                    <th style={styles.th}>Total XP</th>
                    <th style={styles.th}>Streak</th>
                    <th style={styles.th}>DEV</th>
                    <th style={styles.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const isActing = actingUserId === user.id;
                    return (
                      <tr key={user.id} style={styles.tr}>
                        <td style={styles.tdIdentity}>
                          <div style={styles.identityPrimary}>{user.name || user.username}</div>
                          <div style={styles.identitySecondary}>{user.username}</div>
                        </td>
                        <td style={styles.tdEmail}>
                          {user.email ? (
                            <span style={styles.emailText}>{user.email}</span>
                          ) : (
                            <span style={styles.emailMissing}>not found</span>
                          )}
                        </td>
                        <td style={styles.td}>{user.level}</td>
                        <td style={styles.td}>{user.totalXp}</td>
                        <td style={styles.td}>{user.streak}</td>
                        <td style={styles.td}>
                          <button
                            style={user.isDevTester ? styles.actionButton : styles.smallButton}
                            onClick={() => runUserAction(user, "toggle-dev")}
                            disabled={isActing}
                            title="Toggle DEV panel on the user's dashboard"
                          >
                            {user.isDevTester ? "ON" : "OFF"}
                          </button>
                        </td>
                        <td style={styles.tdWide}>
                          <div style={styles.userActionsRow}>
                            <button
                              style={styles.actionButton}
                              onClick={() => runUserAction(user, "grant-xp")}
                              disabled={isActing}
                            >
                              +500 XP
                            </button>
                            <button
                              style={styles.actionButton}
                              onClick={() => runUserAction(user, "reset-daily")}
                              disabled={isActing}
                            >
                              Reset Daily
                            </button>
                            <button
                              style={styles.actionButtonDanger}
                              onClick={() => runUserAction(user, "reset-hard")}
                              disabled={isActing}
                            >
                              Hard Reset
                            </button>
                            <button
                              style={styles.actionButtonDanger}
                              onClick={() => runUserAction(user, "reset-full")}
                              disabled={isActing}
                            >
                              Full Reset + Logout
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ) : null}

      {error ? <div style={styles.errorBar}>{error}</div> : null}
    </div>
  );
}

function StatCard({ label, value, tone = "default" }) {
  return (
    <div style={{ ...styles.statCard, borderColor: tone === "danger" ? "#ff6b6b" : tone === "ok" ? "#34d399" : "rgba(255,255,255,0.1)" }}>
      <div style={styles.statLabel}>{label}</div>
      <div style={{ ...styles.statValue, color: tone === "danger" ? "#ff6b6b" : tone === "ok" ? "#34d399" : "#f1f5f9" }}>{value}</div>
    </div>
  );
}

function CopyButton({ onClick }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      style={{
        background: copied ? "#166534" : "#1e293b",
        color: copied ? "#86efac" : "#94a3b8",
        border: `1px solid ${copied ? "#166534" : "#334155"}`,
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
        transition: "all 0.2s",
      }}
      onClick={() => {
        onClick();
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? "✓ Copied!" : "📋 Copy for AI"}
    </button>
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
  tabBar: { display: "flex", gap: 8, marginBottom: 16 },
  tabButton: {
    background: "#0f172a",
    color: "#94a3b8",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600
  },
  tabButtonActive: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(96,165,250,0.6)",
    borderRadius: 10,
    padding: "8px 14px",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 700
  },
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
  helpText: { color: "#94a3b8", fontSize: 12, marginBottom: 12 },
  row: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)", fontSize: 13 },
  count: { color: "#60a5fa", fontWeight: 600 },
  empty: { color: "#64748b", fontSize: 13, padding: "8px 0" },
  filters: { display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" },
  usersHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  usersControls: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  searchInput: {
    minWidth: 260,
    padding: "8px 10px",
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8
  },
  userActionsRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  actionButton: {
    background: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 600
  },
  actionButtonDanger: {
    background: "#3f1a1a",
    color: "#fecaca",
    border: "1px solid rgba(248,113,113,0.5)",
    borderRadius: 8,
    padding: "6px 10px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 700
  },
  select: { background: "#1e293b", color: "#e2e8f0", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "6px 10px" },
  tableWrap: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th: { textAlign: "left", padding: "8px 10px", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid rgba(255,255,255,0.08)" },
  tr: { verticalAlign: "top" },
  td: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", whiteSpace: "nowrap" },
  tdIdentity: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", minWidth: 170 },
  identityPrimary: { color: "#e2e8f0", fontWeight: 600, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", fontSize: 11 },
  identitySecondary: { color: "#94a3b8", fontSize: 11, marginTop: 2, maxWidth: 220, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  systemTag: { display: "inline-block", padding: "2px 8px", borderRadius: 999, background: "rgba(148,163,184,0.2)", color: "#cbd5e1", fontSize: 11, fontWeight: 600 },
  tdMeaning: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", minWidth: 220, maxWidth: 320, whiteSpace: "normal", lineHeight: 1.35 },
  tdEmail: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", minWidth: 220, maxWidth: 280, whiteSpace: "normal", wordBreak: "break-word" },
  emailText: { color: "#86efac", fontWeight: 600 },
  emailMissing: { color: "#94a3b8" },
  tdWide: { padding: "8px 10px", borderBottom: "1px solid rgba(255,255,255,0.05)", maxWidth: 560 },
  impactTag: { display: "inline-block", marginTop: 6, padding: "2px 8px", borderRadius: 999, background: "rgba(96,165,250,0.16)", color: "#93c5fd", fontSize: 11, fontWeight: 600 },
  rawType: { marginTop: 6, color: "#64748b", fontSize: 11 },
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
