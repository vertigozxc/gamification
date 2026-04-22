import { useEffect, useState } from "react";
import { createChallenge, fetchFriends } from "../../api";
import Avatar from "./Avatar";
import Screen from "./Screen";

const MAX_INVITEES = 5;

export default function CreateChallengeScreen({ authUser, t, onClose, onCreated }) {
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

  const canSubmit = title.trim().length >= 1 && questTitle.trim().length >= 1 && !submitting;

  async function handleCreate() {
    setError("");
    if (title.trim().length < 1) { setError(t.arenaCreateErrorTitle || "Name your pact"); return; }
    if (questTitle.trim().length < 1) { setError(t.arenaCreateErrorTask || "Describe the ritual"); return; }
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
        inviteeUsernames: selected,
      });
      onCreated && onCreated();
    } catch (err) {
      setError(err?.message || t.arenaCreateErrorGeneric || "Couldn't forge the pact");
    } finally {
      setSubmitting(false);
    }
  }

  const footer = (
    <button
      type="button"
      disabled={!canSubmit}
      onClick={handleCreate}
      className="sb-primary-btn press"
      style={{ width: "100%", padding: 14 }}
    >
      {submitting ? (t.arenaForging || "Forging…") : (t.arenaForgePact || "Forge the pact")}
    </button>
  );

  return (
    <Screen
      title={t.arenaNewPactTitle || "New pact"}
      subtitle={t.arenaNewPactSubtitle || "Friends · span · daily ritual"}
      onClose={onClose}
      footer={footer}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
        <Field label={`${t.arenaInvitePals || "Invite pals"} (${selected.length}/${MAX_INVITEES})`}>
          {friends.length === 0 ? (
            <p className="sb-caption" style={{ padding: "8px 0" }}>
              {t.arenaNoFriendsYet || "Find some pals first — they'll appear here."}
            </p>
          ) : (
            <div className="sb-list">
              {friends.map((f, i) => {
                const picked = selected.includes(f.username);
                return (
                  <button
                    key={f.username}
                    type="button"
                    onClick={() => toggleFriend(f.username)}
                    className="sb-list-row press"
                    style={{ borderBottom: i === friends.length - 1 ? "none" : undefined }}
                  >
                    <span
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: "50%",
                        border: `2px solid ${picked ? "var(--color-primary)" : "rgba(120,120,128,0.5)"}`,
                        background: picked ? "var(--color-primary)" : "transparent",
                        color: "#1b1410",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 13,
                        fontWeight: 700,
                        flexShrink: 0,
                      }}
                    >
                      {picked ? "✓" : ""}
                    </span>
                    <div style={{ width: 32, height: 32, borderRadius: "50%", overflow: "hidden", flexShrink: 0, background: "var(--panel-bg)" }}>
                      <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={32} />
                    </div>
                    <span className="sb-body" style={{ fontWeight: 600, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", letterSpacing: "-0.01em" }}>
                      {f.displayName || f.username}
                    </span>
                    <span className="sb-caption">{t.arenaLvlShort || "Lv"} {f.level}</span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        <Field label={`${t.arenaSpan || "Span"} · ${duration} ${pluralDays(duration, t)}`}>
          <input
            type="range"
            min={1}
            max={365}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--color-primary)" }}
          />
          <div className="sb-caption" style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
            <span>1</span><span>30</span><span>90</span><span>365</span>
          </div>
        </Field>

        <Field label={t.arenaPactNameLabel || "Pact name"}>
          <input
            type="text"
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t.arenaPactNamePlaceholder || "e.g. Morning hustle"}
            className="sb-input"
          />
        </Field>

        <Field label={t.arenaPactHowLabel || "Why are we doing this? (optional)"}>
          <textarea
            value={description}
            maxLength={300}
            rows={2}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t.arenaPactHowPlaceholder || "Tell the crew the vibe"}
            className="sb-input"
            style={{ resize: "vertical" }}
          />
        </Field>

        <Field label={t.arenaRitualLabel || "Daily ritual"}>
          <input
            type="text"
            value={questTitle}
            maxLength={80}
            onChange={(e) => setQuestTitle(e.target.value)}
            placeholder={t.arenaRitualPlaceholder || "e.g. 30 push-ups before breakfast"}
            className="sb-input"
          />
        </Field>

        <div
          className="sb-list-row press"
          style={{ background: "var(--panel-bg)", border: "1px solid var(--panel-border)", borderRadius: 12 }}
          onClick={() => setNeedsTimer((v) => !v)}
        >
          <span style={{ fontSize: 18 }}>⏱</span>
          <span className="sb-body" style={{ flex: 1, fontWeight: 500 }}>
            {t.arenaRitualIsTimed || "Timed ritual"}
          </span>
          <Switch checked={needsTimer} onChange={setNeedsTimer} />
        </div>

        {needsTimer && (
          <Field label={t.arenaTimedMinutes || "Minutes on the clock"}>
            <input
              type="number"
              min={1}
              max={600}
              value={timeEstimateMin}
              onChange={(e) => setTimeEstimateMin(e.target.value)}
              className="sb-input"
            />
          </Field>
        )}

        {error && <p style={{ color: "#ff6a63", fontSize: 14 }}>{error}</p>}
      </div>
    </Screen>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span className="sb-caption" style={{ fontWeight: 600, fontSize: 13, color: "var(--color-muted)" }}>{label}</span>
      {children}
    </label>
  );
}

function Switch({ checked, onChange }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
      className="press"
      style={{
        width: 51,
        height: 31,
        borderRadius: 999,
        border: "none",
        padding: 2,
        background: checked ? "#30d158" : "rgba(120,120,128,0.4)",
        position: "relative",
        cursor: "pointer",
        transition: "background 220ms ease",
        flexShrink: 0,
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
          transition: "left 220ms cubic-bezier(0.4,0,0.2,1)",
        }}
      />
    </button>
  );
}

function pluralDays(n, t) {
  const lang = (typeof window !== "undefined" && window.i18nLanguage) || "en";
  if (lang === "ru") {
    const mod10 = n % 10, mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) return t.arenaDayOne || "день";
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return t.arenaDayFew || "дня";
    return t.arenaDayMany || "дней";
  }
  return n === 1 ? (t.arenaDayOne || "day") : (t.arenaDayMany || "days");
}
