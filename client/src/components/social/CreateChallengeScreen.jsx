import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { createChallenge, fetchFriends } from "../../api";
import Avatar from "./Avatar";
import Screen from "./Screen";

const MAX_INVITEES = 5;
const MAX_DURATION_DAYS = 90;

export default function CreateChallengeScreen({ authUser, t, onClose, onCreated }) {
  const meUid = String(authUser?.uid || "").slice(0, 128);
  const [friends, setFriends] = useState([]);
  const [selected, setSelected] = useState([]);
  const [duration, setDuration] = useState(7);
  const [title, setTitle] = useState("");
  const [questTitle, setQuestTitle] = useState("");
  const [needsTimer, setNeedsTimer] = useState(false);
  const [timeEstimateMin, setTimeEstimateMin] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);

  useEffect(() => {
    if (!meUid) return;
    fetchFriends(meUid).then((d) => setFriends(d?.friends || [])).catch(() => setFriends([]));
  }, [meUid]);

  const canSubmit = title.trim().length >= 1 && questTitle.trim().length >= 1 && !submitting;

  async function handleCreate() {
    setError("");
    if (title.trim().length < 1) { setError(t.arenaCreateErrorTitle || "Challenge needs a name"); return; }
    if (questTitle.trim().length < 1) { setError(t.arenaCreateErrorTask || "Describe the task"); return; }
    setSubmitting(true);
    try {
      await createChallenge({
        creatorUsername: meUid,
        title: title.trim(),
        questTitle: questTitle.trim(),
        needsTimer,
        timeEstimateMin: needsTimer ? Math.max(1, Math.min(600, Number(timeEstimateMin) || 0)) : 0,
        durationDays: Math.max(1, Math.min(MAX_DURATION_DAYS, Number(duration) || 7)),
        inviteeUsernames: selected,
      });
      onCreated && onCreated();
    } catch (err) {
      setError(err?.message || t.arenaCreateErrorGeneric || "Could not create the challenge");
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
      {submitting ? (t.arenaForging || "Creating…") : (t.arenaForgePact || "Create challenge")}
    </button>
  );

  const invitedPreview = selected
    .map((u) => friends.find((f) => f.username === u))
    .filter(Boolean);

  return (
    <>
      <Screen
        title={t.arenaNewPactTitle || "New challenge"}
        subtitle={t.arenaNewPactSubtitle || "Friends · duration · daily task"}
        onClose={onClose}
        footer={footer}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <Field label={`${t.arenaInvitePals || "Invite friends"} (${selected.length}/${MAX_INVITEES})`}>
            {friends.length === 0 ? (
              <p className="sb-caption" style={{ padding: "8px 0" }}>
                {t.arenaNoFriendsYet || "Add friends first — they will appear here."}
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setInviteOpen(true)}
                className="press"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "12px 14px",
                  background: "var(--panel-bg)",
                  border: "1px solid var(--panel-border)",
                  borderRadius: 12,
                  color: "var(--color-text)",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                {invitedPreview.length === 0 ? (
                  <>
                    <span style={{ fontSize: 18 }}>＋</span>
                    <span className="sb-body" style={{ flex: 1 }}>{t.arenaInviteOpen || "Choose friends"}</span>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", flexShrink: 0 }}>
                      {invitedPreview.slice(0, 5).map((f, i) => (
                        <div key={f.username} style={{ marginLeft: i === 0 ? 0 : -8, width: 28, height: 28, borderRadius: "50%", overflow: "hidden", border: "2px solid var(--panel-bg)", background: "var(--panel-bg)", flexShrink: 0 }}>
                          <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={24} />
                        </div>
                      ))}
                    </div>
                    <span className="sb-body" style={{ flex: 1, fontWeight: 500 }}>
                      {(t.arenaInvitedCount || "{n} selected").replace("{n}", String(invitedPreview.length))}
                    </span>
                  </>
                )}
                <span style={{ color: "var(--color-muted)" }}>›</span>
              </button>
            )}
          </Field>

          <Field label={`${t.arenaSpan || "Duration"} · ${duration} ${pluralDays(duration, t)}`}>
            <div style={{ padding: "6px 0" }}>
              <input
                type="range"
                min={1}
                max={MAX_DURATION_DAYS}
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="sb-range"
                aria-label={t.arenaSpan || "Duration"}
              />
            </div>
            <div className="sb-caption" style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
              <span>1</span><span>30</span><span>60</span><span>90</span>
            </div>
          </Field>

          <Field label={t.arenaPactNameLabel || "Challenge name"}>
            <input
              type="text"
              value={title}
              maxLength={80}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t.arenaPactNamePlaceholder || "e.g. Morning routine"}
              className="sb-input"
            />
          </Field>

          <Field label={t.arenaRitualLabel || "Daily task"}>
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
              {t.arenaRitualIsTimed || "Timed task"}
            </span>
            <Switch checked={needsTimer} onChange={setNeedsTimer} />
          </div>

          {needsTimer && (
            <Field label={t.arenaTimedMinutes || "Duration (minutes)"}>
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

      {inviteOpen && (
        <InviteFriendsSheet
          friends={friends}
          selected={selected}
          maxInvitees={MAX_INVITEES}
          t={t}
          onClose={() => setInviteOpen(false)}
          onChange={setSelected}
        />
      )}
    </>
  );
}

function InviteFriendsSheet({ friends, selected, maxInvitees, t, onClose, onChange }) {
  function toggle(username) {
    if (selected.includes(username)) {
      onChange(selected.filter((u) => u !== username));
      return;
    }
    if (selected.length >= maxInvitees) return;
    onChange([...selected, username]);
  }

  if (typeof document === "undefined") return null;

  const content = (
    <div
      className="logout-confirm-overlay social-block"
      style={{ zIndex: 92, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.72)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "var(--card-bg, var(--panel-bg))",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: 520,
          margin: "auto",
          height: "100svh",
          maxHeight: "100svh",
        }}
      >
        <div
          className="sb-page-header"
          style={{ flexShrink: 0, padding: "16px 16px 12px", borderBottom: "1px solid var(--card-border-idle, var(--panel-border))" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cinzel sb-page-title">{t.arenaInviteSheetTitle || "Invite friends"}</h2>
              <p className="sb-page-subtitle">
                {(t.arenaInviteSheetHint || "Pick up to {max} friends to join this challenge.").replace("{max}", String(maxInvitees))}
              </p>
            </div>
            <button type="button" aria-label="Close" onClick={onClose} className="ui-close-x">✕</button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
          {friends.length === 0 ? (
            <p className="sb-caption" style={{ textAlign: "center", padding: "24px 12px" }}>
              {t.arenaNoFriendsYet || "Add friends first — they will appear here."}
            </p>
          ) : (
            <div className="sb-list">
              {friends.map((f, i) => {
                const picked = selected.includes(f.username);
                const atLimit = !picked && selected.length >= maxInvitees;
                return (
                  <button
                    key={f.username}
                    type="button"
                    onClick={() => toggle(f.username)}
                    disabled={atLimit}
                    className="sb-list-row press"
                    style={{
                      borderBottom: i === friends.length - 1 ? "none" : undefined,
                      background: picked ? "rgba(var(--color-primary-rgb,251,191,36),0.12)" : "transparent",
                      opacity: atLimit ? 0.4 : 1,
                    }}
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
        </div>

        <div style={{ flexShrink: 0, padding: `12px 16px calc(12px + env(safe-area-inset-bottom, 0px))`, borderTop: "1px solid var(--card-border-idle, var(--panel-border))" }}>
          <button type="button" onClick={onClose} className="sb-primary-btn press" style={{ width: "100%", padding: 14 }}>
            {t.arenaInviteSheetDone || "Done"} · {selected.length}/{maxInvitees}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
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
