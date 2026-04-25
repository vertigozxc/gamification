import { Fragment, useEffect, useState } from "react";
import { createChallenge, fetchFriends } from "../../api";
import Avatar from "./Avatar";
import Screen from "./Screen";

const MAX_INVITEES = 5;
// Must stay in sync with the server cap on POST /api/challenges.
const MAX_DURATION_DAYS = 30;

// 3-step wizard: Basics (name, daily task) → Rules (duration, timer)
// → Invite (friend picker). Keeps the user focused on one concern at a
// time and reduces cognitive load compared to a single long form.
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
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!meUid) return;
    fetchFriends(meUid).then((d) => setFriends(d?.friends || [])).catch(() => setFriends([]));
  }, [meUid]);

  const steps = [
    { id: "basics", label: t.arenaStepBasics || "Basics" },
    { id: "rules", label: t.arenaStepRules || "Rules" },
    { id: "invite", label: t.arenaStepInvite || "Invite" },
  ];

  // Step-by-step validation. Next advances only when the current step
  // is complete; future steps are unreachable, past steps are clickable
  // in the stepper so the user can scrub back quickly.
  const step0Valid = title.trim().length >= 1 && questTitle.trim().length >= 1;
  const step1Valid = !needsTimer
    || (Number(timeEstimateMin) >= 1 && Number(timeEstimateMin) <= 180);
  const canAdvance = (() => {
    if (step === 0) return step0Valid;
    if (step === 1) return step1Valid;
    return true;
  })();

  async function handleCreate() {
    setError("");
    if (!step0Valid) {
      setError(t.arenaCreateErrorTitle || "Challenge needs a name");
      setStep(0);
      return;
    }
    if (!step1Valid) {
      setError(t.arenaCreateErrorTimer || "Timer needs to be 1-180 minutes");
      setStep(1);
      return;
    }
    setSubmitting(true);
    try {
      await createChallenge({
        creatorUsername: meUid,
        title: title.trim(),
        questTitle: questTitle.trim(),
        needsTimer,
        timeEstimateMin: needsTimer ? Math.max(1, Math.min(180, Number(timeEstimateMin) || 0)) : 0,
        durationDays: Math.max(1, Math.min(MAX_DURATION_DAYS, Number(duration) || 7)),
        inviteeUsernames: selected,
      });
      onCreated && onCreated();
    } catch (err) {
      const code = err?.data?.code;
      const limit = err?.data?.limit;
      if (code === "daily_create_limit") {
        setError((t.arenaDailyCreateLimit || "You can create up to {n} challenges per day. Try again tomorrow.").replace("{n}", String(limit || 2)));
      } else if (code === "invitee_limit") {
        setError((t.arenaInviteeLimitReached || "Some friends already have their {n} active challenges — remove them from the list.").replace("{n}", String(limit || 2)));
      } else if (/Max active challenges reached/i.test(String(err?.message || ""))) {
        setError((t.arenaPactLimitBody || "You can run up to {max} group challenges at once. Finish or leave one to start a new pact.").replace("{max}", String(limit || 2)));
      } else if (/Load failed|NetworkError|Failed to fetch/i.test(String(err?.message || ""))) {
        setError(t.arenaCreateErrorNetwork || "Network hiccup — please try again.");
      } else {
        setError(err?.message || t.arenaCreateErrorGeneric || "Could not create the challenge");
      }
    } finally {
      setSubmitting(false);
    }
  }

  function goNext() {
    if (!canAdvance || submitting) return;
    if (step < steps.length - 1) {
      setError("");
      setStep(step + 1);
    } else {
      handleCreate();
    }
  }
  function goBack() {
    if (submitting) return;
    if (step === 0) {
      onClose();
    } else {
      setError("");
      setStep(step - 1);
    }
  }

  function toggleInvitee(username) {
    setSelected((prev) => {
      if (prev.includes(username)) return prev.filter((u) => u !== username);
      if (prev.length >= MAX_INVITEES) return prev;
      return [...prev, username];
    });
  }

  const isLastStep = step === steps.length - 1;
  const nextLabel = isLastStep
    ? (submitting ? (t.arenaForging || "Creating…") : (t.arenaForgePact || "Create challenge"))
    : `${t.arenaStepNext || "Next"} ›`;
  const backLabel = step === 0
    ? (t.communityCancel || "Cancel")
    : (t.arenaStepBack || "Back");

  const footer = (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        onClick={goBack}
        disabled={submitting}
        className="cc-back-btn press"
      >
        {backLabel}
      </button>
      <button
        type="button"
        onClick={goNext}
        disabled={!canAdvance || submitting}
        className="cm-primary-btn press"
        style={{ flex: 1, padding: "14px 16px" }}
      >
        {nextLabel}
      </button>
    </div>
  );

  return (
    <Screen
      title={t.arenaNewPactTitle || "New challenge"}
      subtitle={(t.arenaStepCounter || "Step {n} of {total}")
        .replace("{n}", String(step + 1))
        .replace("{total}", String(steps.length))}
      onClose={onClose}
      footer={footer}
    >
      <Stepper
        steps={steps}
        current={step}
        onJump={(i) => { if (i < step) { setError(""); setStep(i); } }}
      />

      <div className="cc-step-body">
        {step === 0 && (
          <BasicsStep
            t={t}
            title={title}
            setTitle={setTitle}
            questTitle={questTitle}
            setQuestTitle={setQuestTitle}
          />
        )}
        {step === 1 && (
          <RulesStep
            t={t}
            duration={duration}
            setDuration={setDuration}
            needsTimer={needsTimer}
            setNeedsTimer={setNeedsTimer}
            timeEstimateMin={timeEstimateMin}
            setTimeEstimateMin={setTimeEstimateMin}
          />
        )}
        {step === 2 && (
          <InviteStep
            t={t}
            friends={friends}
            selected={selected}
            onToggle={toggleInvitee}
            maxInvitees={MAX_INVITEES}
            preview={{ title, questTitle, duration, needsTimer, timeEstimateMin }}
          />
        )}

        {error && (
          <div className="cc-error" role="alert">
            <span aria-hidden="true">⚠️</span>
            <span>{error}</span>
          </div>
        )}
      </div>
    </Screen>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Stepper — classic numbered-dot wizard pattern: filled circle for
 * past steps (with a ✓), primary-tinted ring for the current step,
 * muted hollow circle for future steps, connected by primary-solid
 * (done) and dashed-muted (future) lines. Reads as "steps in a
 * process", not a tab switcher.
 * ──────────────────────────────────────────────────────────────── */
function Stepper({ steps, current, onJump }) {
  return (
    <div className="cc-stepper" role="tablist" aria-label="Create challenge steps">
      {steps.map((s, i) => {
        const isDone = i < current;
        const isActive = i === current;
        const status = isDone ? "done" : isActive ? "active" : "future";
        return (
          <Fragment key={s.id}>
            {i > 0 && (
              <span
                className={`cc-step-link cc-step-link-${i <= current ? "done" : "future"}`}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onJump(i)}
              disabled={i > current}
              className={`cc-step cc-step-${status}`}
            >
              <span className="cc-step-dot">{isDone ? "✓" : i + 1}</span>
              <span className="cc-step-label">{s.label}</span>
            </button>
          </Fragment>
        );
      })}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Step 1 · Basics — name + daily task
 * ──────────────────────────────────────────────────────────────── */
function BasicsStep({ t, title, setTitle, questTitle, setQuestTitle }) {
  return (
    <>
      <p className="cc-step-hint">
        {t.arenaStepBasicsHint || "Give your pact a name and describe the daily task everyone will do."}
      </p>

      <Field label={t.arenaPactNameLabel || "Challenge name"}>
        <InputWithClear
          value={title}
          onChange={setTitle}
          placeholder={t.arenaPactNamePlaceholder || "e.g. Morning routine"}
          maxLength={80}
          clearLabel={t.communityCancel || "Clear"}
          autoFocus
        />
      </Field>

      <Field label={t.arenaRitualLabel || "Daily task"}>
        <InputWithClear
          value={questTitle}
          onChange={setQuestTitle}
          placeholder={t.arenaRitualPlaceholder || "e.g. 30 push-ups before breakfast"}
          maxLength={80}
          clearLabel={t.communityCancel || "Clear"}
        />
      </Field>
    </>
  );
}

function InputWithClear({ value, onChange, placeholder, maxLength, clearLabel, autoFocus }) {
  return (
    <div className="cc-input-wrap">
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="sb-input"
        autoFocus={autoFocus}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel || "Clear"}
          className="cc-input-clear press"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Step 2 · Rules — duration + timer toggle (+minutes)
 * ──────────────────────────────────────────────────────────────── */
function RulesStep({ t, duration, setDuration, needsTimer, setNeedsTimer, timeEstimateMin, setTimeEstimateMin }) {
  return (
    <>
      <p className="cc-step-hint">
        {t.arenaStepRulesHint || "How long the pact runs and whether the daily task is timed."}
      </p>

      <Field label={`${t.arenaSpan || "Duration"} · ${duration} ${pluralDays(duration, t)}`}>
        <div style={{ padding: "2px 0" }}>
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
          <span>1</span><span>7</span><span>14</span><span>30</span>
        </div>
      </Field>

      <div
        className="sb-list-row press"
        style={{
          background: "var(--panel-bg)",
          border: "1px solid color-mix(in srgb, var(--card-border-idle) 65%, transparent)",
          borderRadius: 12,
          cursor: "pointer",
        }}
        onClick={() => setNeedsTimer((v) => !v)}
      >
        <span style={{ fontSize: 18 }}>⏱</span>
        <span className="sb-body" style={{ flex: 1, fontWeight: 500 }}>
          {t.arenaRitualIsTimed || "Timed task"}
        </span>
        <Switch checked={needsTimer} onChange={setNeedsTimer} />
      </div>

      {needsTimer && (
        <Field label={t.arenaTimedMinutes || "Duration · 1–180 min"}>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={180}
            value={timeEstimateMin}
            onChange={(e) => setTimeEstimateMin(e.target.value)}
            placeholder="1–180"
            className="sb-input"
          />
        </Field>
      )}
    </>
  );
}

/* ────────────────────────────────────────────────────────────────
 * Step 3 · Invite — friend chip grid + live-updating summary
 * ──────────────────────────────────────────────────────────────── */
function InviteStep({ t, friends, selected, onToggle, maxInvitees, preview }) {
  return (
    <>
      <p className="cc-step-hint">
        {(t.arenaStepInviteHint || "Invite up to {max} friends. Each gets a notification.")
          .replace("{max}", String(maxInvitees))}
      </p>

      <PactPreview t={t} preview={preview} />

      <div className="cc-section-head">
        <span className="cc-section-title">
          {t.arenaInvitePals || "Invite friends"}
        </span>
        <span className="cc-section-count">
          {selected.length}/{maxInvitees}
        </span>
      </div>

      {friends.length === 0 ? (
        <p className="cc-empty-friends">
          {t.arenaNoFriendsYet || "Add friends first — they will appear here."}
        </p>
      ) : (
        <div className="cc-friends-grid">
          {friends.map((f) => {
            const picked = selected.includes(f.username);
            const atLimit = !picked && selected.length >= maxInvitees;
            return (
              <button
                key={f.username}
                type="button"
                onClick={() => onToggle(f.username)}
                disabled={atLimit}
                aria-pressed={picked}
                className={`cc-friend-chip press ${picked ? "picked" : ""}`}
              >
                {picked && (
                  <span className="cc-friend-chip-badge" aria-hidden="true">✓</span>
                )}
                <div className="cc-friend-chip-avatar">
                  <Avatar photoUrl={f.photoUrl} displayName={f.displayName} size={40} />
                </div>
                <span className="cc-friend-chip-name">{f.displayName || f.username}</span>
                <span className="cc-friend-chip-meta">{t.arenaLvlShort || "Lv"} {f.level}</span>
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* Live preview card — mirrors the cm-challenge card format so the
 * user sees exactly how their pact will appear on the Challenges tab. */
function PactPreview({ t, preview }) {
  const title = preview.title?.trim() || (t.arenaPreviewNoName || "Untitled pact");
  const questTitle = preview.questTitle?.trim() || (t.arenaPreviewNoTask || "— no daily task —");
  const durationLabel = `${preview.duration}${(t.arenaPreviewDaySuffix || "d")}`;
  return (
    <div className="cc-preview">
      <div className="cc-preview-eyebrow">
        <span>✦</span>
        <span>{t.arenaPreviewLabel || "Preview"}</span>
        <span>✦</span>
      </div>
      <div className="cc-preview-head">
        <p className="cc-preview-title">{title}</p>
        <span className="cc-preview-pill">{durationLabel}</span>
      </div>
      <p className="cc-preview-quest">🎯 {questTitle}</p>
      {preview.needsTimer && (
        <p className="cc-preview-quest">
          ⏱ {(t.arenaPreviewTimerLabel || "{n} min")
            .replace("{n}", String(preview.timeEstimateMin))}
        </p>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="cc-field">
      <span className="cc-field-label">{label}</span>
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
        background: checked ? "var(--color-primary)" : "rgba(120,120,128,0.4)",
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
