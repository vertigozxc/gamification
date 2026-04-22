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
    <div className="social-block">
      <div role="dialog" aria-modal="true" onClick={onClose} className="ios-sheet-backdrop">
        <form onSubmit={handleSubmit} onClick={(e) => e.stopPropagation()} className="ios-sheet">
          <div className="ios-sheet-handle" aria-hidden="true" />
          <div className="ios-sheet-header">
            <button
              type="button"
              onClick={onClose}
              className="ios-btn-ghost ios-tap"
              style={{ justifySelf: "start" }}
            >
              {t.cancel || "Cancel"}
            </button>
            <span className="ios-sheet-title">{t.socialCreateChallengeTitle || "New challenge"}</span>
            <button
              type="submit"
              disabled={submitting}
              className="ios-btn-ghost ios-tap"
              style={{ justifySelf: "end", fontWeight: 600 }}
            >
              {submitting ? (t.socialCreating || "Creating…") : (t.socialCreateButton || "Create")}
            </button>
          </div>

          <div className="ios-sheet-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Friends selector */}
            <Field label={`${t.socialInviteFriends || "Invite friends"} (${selected.length}/${MAX_INVITEES})`}>
              {friends.length === 0 ? (
                <p className="ios-subhead" style={{ padding: "8px 0" }}>
                  {t.socialInviteFriendsEmpty || "Add friends first to invite them."}
                </p>
              ) : (
                <div className="ios-list">
                  {friends.map((f, i) => {
                    const picked = selected.includes(f.username);
                    return (
                      <label
                        key={f.username}
                        className="ios-list-row ios-tap"
                        style={{ borderBottom: i === friends.length - 1 ? "none" : undefined, cursor: "pointer" }}
                      >
                        <input
                          type="checkbox"
                          checked={picked}
                          onChange={() => toggleFriend(f.username)}
                          style={{ accentColor: "var(--color-primary)", width: 20, height: 20 }}
                        />
                        <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
                          <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={32} />
                        </div>
                        <span className="ios-body" style={{ fontWeight: 600, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                          {f.displayName || f.username}
                        </span>
                        <span className="ios-caption">{t.socialLevelLabel || "Lv"} {f.level}</span>
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
              <div className="ios-caption" style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
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
                className="ios-input"
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
                style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
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
            <div
              className="ios-list-row"
              style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12 }}
            >
              <span style={{ fontSize: 18 }}>⏱</span>
              <span className="ios-body" style={{ flex: 1, fontWeight: 500 }}>
                {t.socialNeedsTimerLabel || "This task uses a timer"}
              </span>
              <IosSwitch checked={needsTimer} onChange={setNeedsTimer} />
            </div>
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

            {error && <p style={{ color: "#ff453a", fontSize: 14 }}>{error}</p>}
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="ios-caption" style={{ fontWeight: 600, fontSize: 13, color: "var(--color-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function IosSwitch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="ios-tap"
      style={{
        width: 51,
        height: 31,
        borderRadius: 999,
        border: "none",
        padding: 2,
        background: checked ? "#30d158" : "rgba(120,120,128,0.4)",
        position: "relative",
        cursor: "pointer",
        transition: "background 220ms ease"
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 22 : 2,
          width: 27,
          height: 27,
          borderRadius: "50%",
          background: "#fff",
          boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
          transition: "left 220ms cubic-bezier(0.4,0,0.2,1)"
        }}
      />
    </button>
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
  padding: "12px 14px",
  background: "var(--panel-bg)",
  color: "var(--color-text)",
  border: "1px solid var(--panel-border)",
  borderRadius: 10,
  fontSize: 16,
  outline: "none",
  WebkitAppearance: "none"
};
