import { useEffect, useState } from "react";
import { createChallenge, fetchFriends } from "../../api";
import Avatar from "./Avatar";

const MAX_INVITEES = 5;

export default function CreateChallengeModal({ authUser, t, onClose, onCreated }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);
  const [duration, setDuration] = useState(7);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questTitle, setQuestTitle] = useState("");
  const [needsTimer, setNeedsTimer] = useState(false);
  const [timeEstimateMin, setTimeEstimateMin] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!meUid) return;
    fetchFriends(meUid).then((d) => setFriends(d?.friends || [])).catch(() => setFriends([]));
  }, [meUid]);

  function toggleFriend(username) {
    setSelected((prev) => {
      if (prev.includes(username)) return prev.filter((u) => u !== username);
      if (prev.length >= MAX_INVITEES) return prev;
      return [...prev, username];
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (title.trim().length < 1) { setError(t.socialTitleRequired || "Title is required"); return; }
    if (questTitle.trim().length < 1) { setError(t.socialQuestRequired || "Task is required"); return; }
    setSubmitting(true);
    try {
      await createChallenge({
        creatorUsername: meUid,
        title: title.trim(),
        description: description.trim(),
        questTitle: questTitle.trim(),
        needsTimer,
        timeEstimateMin: needsTimer ? Math.max(1, Math.min(600, Number(timeEstimateMin) || 0)) : 0,
        durationDays: Math.max(1, Math.min(365, Number(duration) || 7)),
        inviteeUsernames: selected
      });
      onCreated();
    } catch (err) {
      setError(err?.message || t.socialErrorGeneric || "Could not create challenge");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        overflowY: "auto"
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          margin: "auto",
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          borderRadius: "var(--border-radius-panel)",
          padding: "1.1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.85rem"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ fontFamily: "var(--font-heading)", fontSize: "1.05rem", fontWeight: 700, color: "var(--color-text)" }}>
            {t.socialCreateChallengeTitle || "New group challenge"}
          </h2>
          <button type="button" onClick={onClose} aria-label={t.close || "Close"} style={closeBtnStyle}>✕</button>
        </div>

        {/* Friends selector */}
        <Field label={`${t.socialInviteFriends || "Invite friends"} (${selected.length}/${MAX_INVITEES})`}>
          {friends.length === 0 ? (
            <p style={{ fontSize: "0.78rem", color: "var(--color-muted)", padding: "0.5rem 0" }}>
              {t.socialInviteFriendsEmpty || "Add friends first to invite them to a challenge."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem", maxHeight: 180, overflowY: "auto", paddingRight: 2 }}>
              {friends.map((f) => {
                const picked = selected.includes(f.username);
                return (
                  <label
                    key={f.username}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.6rem",
                      padding: "0.45rem 0.55rem",
                      borderRadius: "0.55rem",
                      border: `1px solid ${picked ? "rgba(var(--color-primary-rgb,251,191,36),0.6)" : "var(--panel-border)"}`,
                      background: picked ? "rgba(var(--color-primary-rgb,251,191,36),0.12)" : "rgba(0,0,0,0.18)",
                      cursor: "pointer"
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={picked}
                      onChange={() => toggleFriend(f.username)}
                      style={{ accentColor: "var(--color-primary)" }}
                    />
                    <div style={{ width: 28, height: 28, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
                      <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={28} />
                    </div>
                    <span style={{ fontSize: "0.82rem", color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                      {f.displayName || f.username}
                    </span>
                    <span style={{ fontSize: "0.7rem", color: "var(--color-muted)" }}>
                      {t.socialLevelLabel || "Lv"} {f.level}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>

        {/* Duration */}
        <Field label={`${t.socialDurationLabel || "Duration"} · ${duration} ${pluralDays(duration, t)}`}>
          <input
            type="range"
            min={1}
            max={365}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--color-primary)" }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.68rem", color: "var(--color-muted)", marginTop: 2 }}>
            <span>1</span><span>30</span><span>90</span><span>365</span>
          </div>
        </Field>

        {/* Title */}
        <Field label={t.socialChallengeTitleLabel || "Challenge title"}>
          <input
            type="text"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.socialChallengeTitlePlaceholder || "e.g. Summer shape-up"}
            style={inputStyle}
          />
        </Field>

        {/* Description */}
        <Field label={t.socialChallengeDescLabel || "Description (optional)"}>
          <textarea
            value={description}
            maxLength={300}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.socialChallengeDescPlaceholder || "Why are we doing this?"}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </Field>

        {/* Quest title */}
        <Field label={t.socialQuestTitleLabel || "Daily task"}>
          <input
            type="text"
            value={questTitle}
            maxLength={80}
            onChange={(e) => setQuestTitle(e.target.value)}
            placeholder={t.socialQuestTitlePlaceholder || "e.g. 30 push-ups"}
            style={inputStyle}
          />
        </Field>

        {/* Timer toggle */}
        <label style={{ display: "flex", alignItems: "center", gap: "0.55rem", fontSize: "0.82rem", color: "var(--color-text)" }}>
          <input
            type="checkbox"
            checked={needsTimer}
            onChange={(e) => setNeedsTimer(e.target.checked)}
            style={{ accentColor: "var(--color-primary)" }}
          />
          {t.socialNeedsTimerLabel || "This task uses a timer"}
        </label>
        {needsTimer && (
          <Field label={t.socialTimeEstimateLabel || "Estimated time (minutes)"}>
            <input
              type="number"
              min={1}
              max={600}
              value={timeEstimateMin}
              onChange={(e) => setTimeEstimateMin(e.target.value)}
              style={inputStyle}
            />
          </Field>
        )}

        {error && <p style={{ color: "var(--color-danger,#f87171)", fontSize: "0.78rem" }}>{error}</p>}

        <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
          <button type="button" onClick={onClose} style={{ ...btnBase, flex: 1, background: "rgba(0,0,0,0.3)" }}>
            {t.cancel || "Cancel"}
          </button>
          <button type="submit" disabled={submitting} style={{ ...btnBase, flex: 1, background: "rgba(var(--color-primary-rgb,251,191,36),0.22)", borderColor: "rgba(var(--color-primary-rgb,251,191,36),0.6)" }}>
            {submitting ? (t.socialCreating || "Creating…") : (t.socialCreateButton || "Create")}
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <span style={{ fontSize: "0.66rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", fontWeight: 700 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function pluralDays(n, t) {
  const lang = (typeof window !== "undefined" && window.i18nLanguage) || "en";
  if (lang === "ru") {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t.socialDayOne || "день";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t.socialDayFew || "дня";
    return t.socialDayMany || "дней";
  }
  return n === 1 ? (t.socialDayOne || "day") : (t.socialDayMany || "days");
}

const inputStyle = {
  width: "100%",
  padding: "0.55rem 0.65rem",
  background: "rgba(0,0,0,0.28)",
  color: "var(--color-text)",
  border: "1px solid var(--panel-border)",
  borderRadius: "0.5rem",
  fontSize: "0.86rem",
  outline: "none"
};

const btnBase = {
  padding: "0.65rem 1rem",
  borderRadius: "0.55rem",
  border: "1px solid var(--panel-border)",
  color: "var(--color-text)",
  fontFamily: "var(--font-heading)",
  fontWeight: 700,
  fontSize: "0.78rem",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  cursor: "pointer"
};

const closeBtnStyle = {
  background: "rgba(0,0,0,0.3)",
  color: "var(--color-text)",
  border: "1px solid var(--panel-border)",
  borderRadius: 999,
  width: 28,
  height: 28,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};
