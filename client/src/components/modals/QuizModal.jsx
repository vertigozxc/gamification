import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";
import { claimQuizScholar } from "../../api";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";
import { IconClose } from "../icons/Icons";
import { buildQuiz } from "./quizPool";

// Knowledge Quiz — 10 random questions from a 24-pool, no per-question
// feedback (right/wrong is hidden until the very end), pass = 10/10.
// First successful pass calls /api/quiz/scholar/claim which idempotently
// grants the `scholar` achievement and +10 tokens. Subsequent passes
// just re-affirm the success screen with no extra reward.
//
// Closing the modal mid-quiz drops all progress per the user's spec —
// returning later starts a fresh random 10. We rebuild on every open
// via the `instance` counter dep on useMemo.
function QuizModal({ open, username, onClose, onPassed }) {
  const { t, languageId } = useTheme();
  const [instance, setInstance] = useState(0);
  // Rebuild a fresh randomized quiz every time the modal (re)opens.
  const quiz = useMemo(() => (open ? buildQuiz(languageId) : []), [open, languageId, instance]);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState([]); // index per question or null
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { score, total, passed, justUnlocked, silverGranted }
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    if (!open) {
      // Closing — reset everything so the next open starts clean.
      setCurrentIdx(0);
      setAnswers([]);
      setSubmitting(false);
      setResult(null);
      setSubmitError("");
      return undefined;
    }
    setCurrentIdx(0);
    setAnswers(new Array(quiz.length).fill(null));
    setResult(null);
    setSubmitError("");
    return undefined;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, instance]);

  useEffect(() => {
    if (!open || typeof document === "undefined") return undefined;
    const prevBody = document.body.style.overflow;
    const prevHtml = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevBody;
      document.documentElement.style.overflow = prevHtml;
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const swipeBind = useEdgeSwipeBack(onClose);

  if (!open) return null;

  const total = quiz.length;
  const currentQuestion = quiz[currentIdx];
  const selected = answers[currentIdx];
  const isLast = currentIdx === total - 1;
  const allAnswered = answers.every((a) => a !== null);

  const select = (optIdx) => {
    if (result) return; // already submitted
    setAnswers((prev) => {
      const next = prev.slice();
      next[currentIdx] = optIdx;
      return next;
    });
  };

  const goNext = () => {
    if (selected === null) return;
    if (currentIdx < total - 1) {
      setCurrentIdx((v) => v + 1);
    }
  };
  const goBack = () => {
    if (currentIdx > 0) setCurrentIdx((v) => v - 1);
  };

  const submit = async () => {
    if (submitting || result) return;
    setSubmitting(true);
    setSubmitError("");
    let score = 0;
    for (let i = 0; i < quiz.length; i += 1) {
      if (answers[i] === quiz[i].correct) score += 1;
    }
    const passed = score === total;
    let justUnlocked = false;
    let silverGranted = 0;
    if (passed && username) {
      // Always call the server — it's idempotent. If `scholar` is
      // already unlocked, the server returns justUnlocked: false with
      // no token grant; this is the single source of truth for whether
      // the reward fires, regardless of what the client thought.
      try {
        const resp = await claimQuizScholar(username);
        justUnlocked = !!resp?.justUnlocked;
        silverGranted = Number(resp?.silverGranted) || 0;
      } catch (err) {
        // Reward grant failed — score still counts, surface a soft
        // error but don't block the success screen.
        setSubmitError(err?.data?.error || err?.message || "Failed to claim reward");
      }
    }
    setResult({ score, total, passed, justUnlocked, silverGranted });
    setSubmitting(false);
    if (passed && justUnlocked) {
      onPassed?.({ silverGranted, justUnlocked });
    }
  };

  const restart = () => {
    setInstance((v) => v + 1);
  };

  return createPortal(
    <div
      className="logout-confirm-overlay"
      style={{ zIndex: 90, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.78)" }}
      onClick={onClose}
      {...swipeBind}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--panel-bg)",
          display: "flex",
          flexDirection: "column",
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)"
        }}
        role="dialog"
        aria-modal="true"
        aria-label={t.quizTitle || "Knowledge Quiz"}
      >
        {/* Header — progress counter on the LEFT, ✕ on the RIGHT,
            matching the NotesHistory full-screen modal so users build
            one mental model for "where the close button lives". */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 8px", gap: 12 }}>
          {!result ? (
            <span className="cinzel" style={{ color: "var(--color-muted)", fontSize: 12, fontWeight: 700, minWidth: 32 }}>
              {currentIdx + 1}/{total}
            </span>
          ) : (
            <span style={{ minWidth: 32 }} />
          )}
          <span className="cinzel" style={{ color: "var(--color-primary)", fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "center", flex: 1 }}>
            🎓 {t.quizTitle || "Knowledge Quiz"}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.closeLabel || "Close"}
            className="ui-close-x"
          >
            <IconClose size={16} strokeWidth={2.4} />
          </button>
        </div>

        {/* Progress bar (hidden on result screen) */}
        {!result ? (
          <div style={{ padding: "0 16px 12px" }}>
            <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 999, overflow: "hidden" }}>
              <div
                style={{
                  width: `${((currentIdx + (selected !== null ? 1 : 0)) / total) * 100}%`,
                  height: "100%",
                  background: "var(--color-primary)",
                  borderRadius: 999,
                  transition: "width 240ms cubic-bezier(.22,1,.36,1)"
                }}
              />
            </div>
          </div>
        ) : null}

        {/* Body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "8px 16px 16px" }}>
          {!result ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <p style={{
                fontSize: 16,
                lineHeight: 1.4,
                color: "var(--color-text)",
                margin: 0,
                padding: "16px 14px",
                background: "color-mix(in srgb, var(--panel-bg) 60%, rgba(255,255,255,0.04))",
                border: "1px solid var(--panel-border)",
                borderRadius: 14,
                fontWeight: 600
              }}>
                {currentQuestion?.text}
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {currentQuestion?.options.map((label, i) => {
                  const isSelected = selected === i;
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => select(i)}
                      className="mobile-pressable"
                      style={{
                        width: "100%",
                        textAlign: "left",
                        padding: "13px 14px",
                        borderRadius: 14,
                        border: `1.5px solid ${isSelected ? "color-mix(in srgb, var(--color-primary) 70%, transparent)" : "var(--panel-border)"}`,
                        background: isSelected
                          ? "color-mix(in srgb, var(--color-primary) 12%, transparent)"
                          : "color-mix(in srgb, var(--panel-bg) 80%, rgba(255,255,255,0.02))",
                        color: "var(--color-text)",
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        transition: "background 180ms ease, border-color 180ms ease"
                      }}
                    >
                      <span style={{
                        flexShrink: 0,
                        width: 22,
                        height: 22,
                        borderRadius: 999,
                        border: `1.5px solid ${isSelected ? "var(--color-primary)" : "var(--panel-border)"}`,
                        background: isSelected ? "var(--color-primary)" : "transparent",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        color: isSelected ? "#0b0d12" : "var(--color-muted)",
                        fontWeight: 800
                      }}>
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.3 }}>{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <ResultScreen result={result} t={t} submitError={submitError} />
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 16px 18px",
          borderTop: "1px solid var(--panel-border)",
          background: "color-mix(in srgb, var(--panel-bg) 92%, rgba(0,0,0,0.4))",
          display: "flex",
          gap: 10
        }}>
          {!result ? (
            <>
              {/* On Q1 there's nothing to go back to — swap Back for
                  Close so the secondary slot is actually useful. From
                  Q2 onward it returns to the previous question as
                  before. */}
              {currentIdx === 0 ? (
                <button
                  type="button"
                  className="mobile-pressable"
                  onClick={onClose}
                  style={{
                    flex: "0 0 auto",
                    padding: "12px 18px",
                    borderRadius: 999,
                    border: "1.5px solid var(--panel-border)",
                    background: "transparent",
                    color: "var(--color-text)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  {t.closeLabel || "Close"}
                </button>
              ) : (
                <button
                  type="button"
                  className="mobile-pressable"
                  onClick={goBack}
                  style={{
                    flex: "0 0 auto",
                    padding: "12px 18px",
                    borderRadius: 999,
                    border: "1.5px solid var(--panel-border)",
                    background: "transparent",
                    color: "var(--color-text)",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer"
                  }}
                >
                  {t.quizPrev || "Back"}
                </button>
              )}
              {!isLast ? (
                <button
                  type="button"
                  className="mobile-pressable"
                  onClick={goNext}
                  disabled={selected === null}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: 999,
                    border: "1.5px solid color-mix(in srgb, var(--color-primary) 60%, transparent)",
                    background: selected === null
                      ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                      : "color-mix(in srgb, var(--color-primary) 22%, transparent)",
                    color: "var(--color-primary)",
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: selected === null ? "not-allowed" : "pointer",
                    opacity: selected === null ? 0.55 : 1
                  }}
                >
                  {t.quizNext || "Next"}
                </button>
              ) : (
                <button
                  type="button"
                  className="mobile-pressable"
                  onClick={submit}
                  disabled={!allAnswered || submitting}
                  style={{
                    flex: 1,
                    padding: "12px 18px",
                    borderRadius: 999,
                    border: "1.5px solid color-mix(in srgb, var(--color-primary) 70%, transparent)",
                    background: !allAnswered
                      ? "color-mix(in srgb, var(--color-primary) 8%, transparent)"
                      : "color-mix(in srgb, var(--color-primary) 30%, transparent)",
                    color: "var(--color-primary)",
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    cursor: !allAnswered ? "not-allowed" : "pointer",
                    opacity: !allAnswered ? 0.55 : 1
                  }}
                >
                  {submitting ? (t.quizSubmitting || "Checking…") : (t.quizSubmit || "Finish quiz")}
                </button>
              )}
            </>
          ) : result.passed ? (
            // Passed — single primary "Finish" button. Retrying after a
            // pass adds nothing (achievement and tokens are already
            // claimed via the popup), so we hide that path entirely.
            <button
              type="button"
              className="mobile-pressable"
              onClick={onClose}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: 999,
                border: "1.5px solid color-mix(in srgb, var(--color-primary) 70%, transparent)",
                background: "color-mix(in srgb, var(--color-primary) 30%, transparent)",
                color: "var(--color-primary)",
                fontWeight: 800,
                fontSize: 14,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: "pointer",
                boxShadow: "0 4px 18px color-mix(in srgb, var(--color-primary) 25%, transparent)"
              }}
            >
              {t.quizFinish || "Finish"}
            </button>
          ) : (
            <>
              <button
                type="button"
                className="mobile-pressable"
                onClick={onClose}
                style={{
                  flex: "0 0 auto",
                  padding: "12px 18px",
                  borderRadius: 999,
                  border: "1.5px solid var(--panel-border)",
                  background: "transparent",
                  color: "var(--color-text)",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer"
                }}
              >
                {t.closeLabel || "Close"}
              </button>
              <button
                type="button"
                className="mobile-pressable"
                onClick={restart}
                style={{
                  flex: 1,
                  padding: "12px 18px",
                  borderRadius: 999,
                  border: "1.5px solid color-mix(in srgb, var(--color-primary) 60%, transparent)",
                  background: "color-mix(in srgb, var(--color-primary) 22%, transparent)",
                  color: "var(--color-primary)",
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  cursor: "pointer"
                }}
              >
                {t.quizRetry || "Try again"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function ResultScreen({ result, t, submitError }) {
  const { score, total, passed, justUnlocked, silverGranted } = result;
  // "Already unlocked" = passed but the server reported no new
  // grant — i.e. scholar was unlocked on a previous run.
  const alreadyUnlocked = passed && !justUnlocked;
  const fill = (template, vars) =>
    String(template).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : ""));

  const headline = passed
    ? (t.quizResultPassed || "Test passed")
    : (t.quizResultFailed || "Not passed");
  const accent = passed ? "#4ade80" : "#f87171";

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: 18,
      padding: "32px 12px",
      textAlign: "center"
    }}>
      <div style={{
        width: 96,
        height: 96,
        borderRadius: 999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 56,
        background: passed
          ? "color-mix(in srgb, #4ade80 16%, transparent)"
          : "color-mix(in srgb, #f87171 16%, transparent)",
        border: `2px solid color-mix(in srgb, ${accent} 60%, transparent)`,
        boxShadow: `0 0 40px color-mix(in srgb, ${accent} 30%, transparent)`
      }}>
        {passed ? "🎓" : "📘"}
      </div>
      <h2 className="cinzel" style={{
        color: accent,
        fontSize: 24,
        margin: 0,
        letterSpacing: "0.04em",
        textTransform: "uppercase"
      }}>
        {headline}
      </h2>
      <p style={{ fontSize: 18, fontWeight: 700, color: "var(--color-text)", margin: 0 }}>
        {fill(t.quizResultScore || "{score} / {total} correct", { score, total })}
      </p>
      {!passed && (
        <p style={{ fontSize: 13, color: "var(--color-muted)", margin: 0, lineHeight: 1.5, maxWidth: 320 }}>
          {t.quizResultFailedHint || "You need 10/10 to pass. Read About the App and try again — every detail counts."}
        </p>
      )}
      {passed && justUnlocked ? (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
          padding: "12px 18px",
          borderRadius: 14,
          background: "color-mix(in srgb, #4ade80 10%, transparent)",
          border: "1.5px solid color-mix(in srgb, #4ade80 50%, transparent)",
          color: "#bbf7d0",
          fontSize: 14
        }}>
          <span style={{ fontWeight: 800, letterSpacing: "0.06em", fontSize: 11, textTransform: "uppercase", color: "#86efac" }}>
            {t.quizResultRewardKicker || "Reward unlocked"}
          </span>
          <span>
            {fill(t.quizResultRewardLine || "🎓 Scholar achievement · +{amount} {silverIcon}", {
              amount: silverGranted || 10,
              silverIcon: t.silverIcon || "🪙"
            })}
          </span>
        </div>
      ) : null}
      {alreadyUnlocked ? (
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: 0, lineHeight: 1.5, maxWidth: 320, fontStyle: "italic" }}>
          {t.quizResultAlreadyUnlocked || "You've already unlocked the Scholar achievement and claimed the reward — this run is just for your own records."}
        </p>
      ) : null}
      {submitError ? (
        <p style={{ fontSize: 12, color: "#fca5a5", margin: 0, maxWidth: 320 }}>
          {submitError}
        </p>
      ) : null}
    </div>
  );
}

export default QuizModal;
