import { useState } from "react";
import Avatar from "./Avatar";
import Alert from "./Alert";
import Screen from "./Screen";

// Must stay in sync with server's MAX_ACTIVE_CHALLENGES_PER_USER. If
// the client drifted higher the user would be allowed into the create
// screen, fill out the form, and only discover the cap on submit —
// exactly the "I hit create and got Load failed" flow reported.
const MAX_ACTIVE = 2;

export default function ChallengesListScreen({ challenges = [], t, onClose, onOpenChallenge, onOpenCreate }) {
  const now = Date.now();
  const active = challenges.filter((c) => new Date(c.endsAt).getTime() > now);
  const ended = challenges.filter((c) => new Date(c.endsAt).getTime() <= now);
  const canCreate = active.length < MAX_ACTIVE;
  const [showLimitAlert, setShowLimitAlert] = useState(false);

  const footer = (
    <button
      type="button"
      onClick={() => {
        if (canCreate) {
          onOpenCreate?.();
        } else {
          // Instead of a dead disabled button, show a styled popup
          // explaining the limit so the user knows what to do next.
          setShowLimitAlert(true);
        }
      }}
      className="sb-primary-btn press"
      style={{ width: "100%", padding: 14, opacity: canCreate ? 1 : 0.85 }}
    >
      {canCreate ? `＋ ${t.arenaPactForgeCta || "Start a challenge"}` : `＋ ${t.arenaPactForgeCta || "Start a challenge"}`}
    </button>
  );

  return (
    <Screen
      title={t.arenaPactsScreenTitle || "Group challenges"}
      subtitle={`${active.length} ${t.arenaPactActiveWord || "active"} · ${ended.length} ${t.arenaPactEndedWord || "ended"}`}
      onClose={onClose}
      footer={footer}
    >
      {active.length > 0 && (
        <>
          <h3 className="sb-section-title" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)", margin: "4px 4px 8px" }}>
            🔥 {t.arenaPactActive || "Active"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {active.map((c) => (
              <Card key={c.id} challenge={c} t={t} onOpen={() => onOpenChallenge(c.id)} />
            ))}
          </div>
        </>
      )}

      {ended.length > 0 && (
        <>
          <h3 className="sb-section-title" style={{ fontSize: 13, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--color-muted)", margin: "4px 4px 8px" }}>
            🏁 {t.arenaPactEnded || "Recently ended"}
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {ended.map((c) => (
              <Card key={c.id} challenge={c} t={t} ended onOpen={() => onOpenChallenge(c.id)} />
            ))}
          </div>
        </>
      )}

      {active.length === 0 && ended.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 38, marginBottom: 8 }}>🤝</div>
          <p className="sb-headline" style={{ marginBottom: 4 }}>
            {t.arenaPactsListEmptyTitle || "No group challenges yet"}
          </p>
          <p className="sb-caption" style={{ maxWidth: 300, margin: "0 auto" }}>
            {t.arenaPactsListEmptyBody || "Pick a friend, pick a habit, pick a duration. Every daily completion earns a token for everyone."}
          </p>
        </div>
      )}

      {showLimitAlert && (
        <Alert
          icon="🚧"
          title={t.arenaPactLimitTitle || "Max challenges reached"}
          message={(t.arenaPactLimitBody || "You can run up to {max} group challenges at once. Finish or leave one to start a new pact.").replace("{max}", String(MAX_ACTIVE))}
          confirmLabel={t.arenaPactLimitConfirm || "Got it"}
          onConfirm={() => setShowLimitAlert(false)}
        />
      )}
    </Screen>
  );
}

function Card({ challenge: c, t, ended, onOpen }) {
  const total = Math.max(1, Number(c.durationDays) || 1);
  const start = new Date(c.startedAt).getTime();
  const end = new Date(c.endsAt).getTime();
  const elapsed = ended ? total : Math.min(total, Math.max(0, Math.floor((Date.now() - start) / 86400000)));
  const daysLeft = ended ? 0 : Math.max(0, Math.ceil((end - Date.now()) / 86400000));
  const pct = Math.round((elapsed / total) * 100);
  const completedToday = c.myLastCompletionDayKey === todayKey();
  const active = (c.participants || []).filter((p) => !p.leftAt);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="sb-card press"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        opacity: ended ? 0.7 : 1,
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "inherit",
        color: "var(--color-text)",
      }}
    >
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <p className="sb-headline" style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.title}
        </p>
        <span className={`sb-pill ${ended ? "" : "sb-pill-accent"}`} style={{ flexShrink: 0 }}>
          {ended ? (t.arenaPactEndedWord || "ended") : (t.arenaDaysLeft || "{n}d").replace("{n}", String(daysLeft))}
        </span>
      </div>
      <p className="sb-caption">🎯 {c.questTitle}</p>
      <div className="sb-progress">
        <div className={`sb-progress-fill${ended ? " done" : ""}`} style={{ width: `${pct}%` }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex" }}>
          {active.slice(0, 5).map((p, i) => (
            <div
              key={p.id}
              style={{
                marginLeft: i === 0 ? 0 : -8,
                width: 24,
                height: 24,
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid var(--panel-bg)",
                background: "var(--panel-bg)",
              }}
            >
              <Avatar photoUrl={p.user.photoUrl} displayName={p.user.displayName} size={20} />
            </div>
          ))}
        </div>
        <span className="sb-caption">{active.length} {t.arenaPlayers || "players"}</span>
        {!ended && (
          <span
            style={{ marginLeft: "auto" }}
            className={`sb-pill ${completedToday ? "sb-pill-success" : ""}`}
          >
            {completedToday ? `✓ ${t.arenaDone || "today"}` : `🔥 ${c.myConsecutiveDays || 0}`}
          </span>
        )}
      </div>
    </button>
  );
}

function todayKey() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
