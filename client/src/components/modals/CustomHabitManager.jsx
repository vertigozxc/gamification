import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";

const TITLE_MAX = 40;
const DESC_MAX = 120;
const CUSTOM_LIMIT = 20;

function CustomHabitManager({
  customQuests,
  selectedIds,
  onToggleSelect,
  selectionLimitReached,
  accentVar = "--color-primary",
  allowDelete = true,
  onCreateCustomQuest,
  onUpdateCustomQuest,
  onDeleteCustomQuest,
  customSaving,
  customError,
  onClearCustomError
}) {
  const { t, tf } = useTheme();
  const [mode, setMode] = useState("list"); // "list" | "create" | "edit"
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [needsTimer, setNeedsTimer] = useState(false);
  const [timeMinutes, setTimeMinutes] = useState("30");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  // Track visualViewport so the create/edit popup shrinks with the
  // iOS keyboard instead of getting pushed off-screen.
  const [vvHeight, setVvHeight] = useState(() => (
    typeof window !== "undefined"
      ? (window.visualViewport?.height || window.innerHeight || 0)
      : 0
  ));
  const [vvTop, setVvTop] = useState(0);
  useEffect(() => {
    if (mode !== "create" && mode !== "edit") return undefined;
    if (typeof window === "undefined") return undefined;
    const update = () => {
      const vv = window.visualViewport;
      setVvHeight(vv?.height || window.innerHeight || 0);
      setVvTop(vv?.offsetTop || 0);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener("resize", update);
      vv.addEventListener("scroll", update);
    }
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      if (vv) {
        vv.removeEventListener("resize", update);
        vv.removeEventListener("scroll", update);
      }
    };
  }, [mode]);

  useEffect(() => {
    if (customError) {
      // auto-clear error after 4s
      const tid = setTimeout(() => onClearCustomError?.(), 4000);
      return () => clearTimeout(tid);
    }
    return undefined;
  }, [customError, onClearCustomError]);

  const resetForm = () => {
    setTitle("");
    setDesc("");
    setNeedsTimer(false);
    setTimeMinutes("30");
    setEditingId(null);
    setMode("list");
    onClearCustomError?.();
  };

  const startCreate = () => {
    onClearCustomError?.();
    setTitle("");
    setDesc("");
    setNeedsTimer(false);
    setTimeMinutes("30");
    setMode("create");
  };

  const startEdit = (cq) => {
    onClearCustomError?.();
    setEditingId(cq.id);
    setTitle(cq.title || "");
    setDesc(cq.desc || cq.description || "");
    setNeedsTimer(Boolean(cq.needsTimer));
    const mins = Number(cq.timeEstimateMin) || 0;
    setTimeMinutes(mins > 0 ? String(mins) : "30");
    setMode("edit");
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    const minutes = needsTimer ? Math.max(1, Math.min(480, parseInt(timeMinutes, 10) || 0)) : 0;
    const payload = {
      title: cleanTitle,
      description: desc.trim(),
      needsTimer,
      timeEstimateMin: minutes
    };
    if (mode === "create") {
      const created = await onCreateCustomQuest(payload);
      if (created) resetForm();
    } else if (mode === "edit" && editingId != null) {
      const updated = await onUpdateCustomQuest(editingId, payload);
      if (updated) resetForm();
    }
  };

  const previewMins = Math.max(0, parseInt(timeMinutes, 10) || 0);
  const previewXp = !needsTimer ? 30 : previewMins >= 50 ? 50 : previewMins >= 40 ? 40 : 30;

  const handleDelete = async (id) => {
    const ok = await onDeleteCustomQuest(id);
    if (ok) setConfirmDeleteId(null);
  };

  const accentStyle = { color: `var(${accentVar})` };
  const accentBorder = `var(${accentVar})`;
  const used = Array.isArray(customQuests) ? customQuests.length : 0;
  const atLimit = used >= CUSTOM_LIMIT;

  return (
    <div className="mt-4" style={{ borderTop: "1px dashed var(--card-border-idle)", paddingTop: 12 }}>
      <div className="flex items-center justify-between mb-2">
            <label className="cinzel text-xs tracking-widest uppercase" style={accentStyle}>
              {t.customHabitsSection}
        </label>
        <span className="cinzel text-xs text-slate-400">{used} / {CUSTOM_LIMIT}</span>
      </div>

      {mode === "list" && (
        <>
          {Array.isArray(customQuests) && customQuests.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              {customQuests.map((cq) => {
                const isSelected = Array.isArray(selectedIds) && selectedIds.includes(cq.id);
                const blocked = !isSelected && selectionLimitReached;
                return (
                  <div
                    key={"custom-" + cq.id}
                    className="rounded-lg border p-3 relative"
                    style={isSelected
                      ? { borderColor: accentBorder, background: "var(--color-accent-dim)" }
                      : { borderColor: "var(--card-border-idle)", background: "var(--card-bg)", opacity: blocked ? 0.5 : 1 }}
                  >
                    <button
                      type="button"
                      onClick={() => (blocked ? null : onToggleSelect?.(cq.id))}
                      disabled={blocked}
                      className="text-left w-full"
                      style={{
                        background: "transparent",
                        border: "none",
                        padding: 0,
                        cursor: blocked ? "not-allowed" : "pointer",
                        paddingRight: 100
                      }}
                    >
                      <p className="cinzel text-sm text-slate-100 font-bold">
                        <span style={{ ...accentStyle, marginRight: 6 }}>★</span>
                        {cq.title}
                      </p>
                      {cq.desc ? (
                        <p className="text-xs text-slate-400 mt-1">{cq.desc}</p>
                      ) : null}
                      {cq.needsTimer && Number(cq.timeEstimateMin) > 0 ? (
                        <p className="text-[11px] mt-1" style={{ color: "var(--color-muted)" }}>
                          ⏱ {cq.timeEstimateMin} {t.customHabitMinutesShort || "min"} · +{cq.xp || 30} XP
                        </p>
                      ) : (
                        <p className="text-[11px] mt-1" style={{ color: "var(--color-muted)" }}>
                          +30 XP
                        </p>
                      )}
                    </button>
                    <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEdit(cq); }}
                        title={t.customHabitEdit}
                        aria-label={t.customHabitEdit}
                        className="mobile-pressable"
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 11,
                          background: "rgba(15, 23, 42, 0.7)",
                          border: "1px solid var(--card-border-idle)",
                          color: "#e2e8f0",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0
                        }}
                      >
                        <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                        </svg>
                      </button>
                      {allowDelete ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cq.id); }}
                          title={t.customHabitDelete}
                          aria-label={t.customHabitDelete}
                          className="mobile-pressable"
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 11,
                            background: "rgba(239, 68, 68, 0.14)",
                            border: "1px solid rgba(239, 68, 68, 0.45)",
                            color: "#fca5a5",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            padding: 0
                          }}
                        >
                          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <polyline points="3 6 5 6 21 6"/>
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            <path d="M10 11v6M14 11v6"/>
                            <path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-500 mb-2">
                  {t.customHabitEmpty}
            </p>
          )}

          <button
            type="button"
            onClick={startCreate}
            disabled={atLimit}
            className="w-full rounded-lg border p-3 cinzel text-sm mobile-pressable"
            style={{
              borderStyle: "dashed",
              borderColor: atLimit ? "var(--card-border-idle)" : accentBorder,
              color: atLimit ? "#64748b" : `var(${accentVar})`,
              background: "transparent",
              cursor: atLimit ? "not-allowed" : "pointer",
              minHeight: 48
            }}
          >
            {atLimit
                  ? t.customHabitLimitReached
              : `+ ${t.customHabitCreate}`}
          </button>
        </>
      )}

      {(mode === "create" || mode === "edit") && createPortal(
        <div
          className="logout-confirm-overlay"
          style={{
            zIndex: 240,
            background: "rgba(0, 0, 0, 0.62)",
            padding: 0,
            alignItems: "stretch",
            justifyContent: "stretch"
          }}
          onClick={(e) => { if (e.target === e.currentTarget) resetForm(); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              top: vvTop ? `${vvTop}px` : 0,
              left: 0,
              right: 0,
              height: vvHeight ? `${vvHeight}px` : "100dvh",
              maxHeight: vvHeight ? `${vvHeight}px` : "100dvh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "20px 16px"
            }}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                maxHeight: "100%",
                display: "flex",
                flexDirection: "column",
                borderRadius: 18,
                overflow: "hidden",
                background: "var(--card-bg, #0f172a)",
                border: "1px solid color-mix(in srgb, var(--color-primary) 55%, var(--panel-border))",
                boxShadow: "0 24px 60px rgba(0,0,0,0.55), 0 0 60px color-mix(in srgb, var(--color-primary) 24%, transparent)",
                animation: "tour-finale-in 280ms cubic-bezier(0.2, 0.9, 0.35, 1)"
              }}
            >
              {/* Header */}
              <div
                style={{
                  padding: "14px 16px",
                  borderBottom: "1px solid var(--card-border-idle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  background: "color-mix(in srgb, var(--color-primary) 6%, var(--card-bg, #0f172a))"
                }}
              >
                <h3
                  className="cinzel"
                  style={{
                    margin: 0,
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "var(--color-primary)"
                  }}
                >
                  {mode === "create" ? t.customHabitCreate : t.customHabitEdit}
                </h3>
                <button
                  type="button"
                  onClick={resetForm}
                  aria-label={t.cancelLabel}
                  className="ui-close-x"
                  style={{ width: 34, height: 34, fontSize: 18 }}
                >
                  ✕
                </button>
              </div>

              {/* Scrollable body */}
              <div
                style={{
                  flex: 1,
                  minHeight: 0,
                  overflowY: "auto",
                  WebkitOverflowScrolling: "touch",
                  padding: "14px 16px"
                }}
              >
                <label className="cinzel text-xs tracking-widest uppercase block mb-1" style={accentStyle}>
                  {t.customHabitTitleLabel}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
                  maxLength={TITLE_MAX}
                  className="w-full rounded-md px-3 py-2 text-slate-100"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border-idle)", minHeight: 44 }}
                  placeholder={t.customHabitTitlePlaceholder}
                />
                <div className="text-right text-xs text-slate-500 mt-1">{title.length} / {TITLE_MAX}</div>

                <label className="cinzel text-xs tracking-widest uppercase block mt-3 mb-1" style={accentStyle}>
                  {t.customHabitDescLabel}
                </label>
                <textarea
                  value={desc}
                  onChange={(e) => setDesc(e.target.value.slice(0, DESC_MAX))}
                  maxLength={DESC_MAX}
                  rows={3}
                  className="w-full rounded-md px-3 py-2 text-slate-100"
                  style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border-idle)", resize: "vertical", minHeight: 76 }}
                  placeholder={t.customHabitDescPlaceholder}
                />
                <div className="text-right text-xs text-slate-500 mt-1">{desc.length} / {DESC_MAX}</div>

                <div className="mt-3 rounded-lg p-3" style={{ border: "1px solid var(--card-border-idle)", background: "rgba(0,0,0,0.2)" }}>
                  <label
                    className="flex items-center gap-2 cursor-pointer"
                    style={{ fontSize: 13, color: "#e2e8f0" }}
                  >
                    <input
                      type="checkbox"
                      checked={needsTimer}
                      onChange={(e) => setNeedsTimer(e.target.checked)}
                      style={{ width: 18, height: 18, cursor: "pointer" }}
                    />
                    <span className="cinzel" style={{ fontSize: 12, letterSpacing: "0.08em", textTransform: "uppercase", ...accentStyle }}>
                      {t.customHabitUseTimer || "Use timer"}
                    </span>
                  </label>
                  {needsTimer ? (
                    <div className="mt-2">
                      <label className="cinzel text-[11px] tracking-widest uppercase block mb-1" style={{ color: "var(--color-muted)" }}>
                        {t.customHabitMinutesLabel || "Duration (minutes)"}
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={1}
                          max={480}
                          value={timeMinutes}
                          onChange={(e) => setTimeMinutes(e.target.value.replace(/[^0-9]/g, "").slice(0, 3))}
                          className="rounded-md px-3 py-2 text-slate-100"
                          style={{ width: 100, background: "rgba(0,0,0,0.35)", border: "1px solid var(--card-border-idle)", minHeight: 40 }}
                          placeholder="30"
                        />
                        <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                          → <strong style={{ color: "#4ade80" }}>+{previewXp} XP</strong>{" "}
                          {t.customHabitXpHint || "per completion"}
                        </span>
                      </div>
                      <p className="text-[11px] mt-2" style={{ color: "var(--color-muted)", lineHeight: 1.45 }}>
                        {t.customHabitXpExplain
                          || "Up to 39 min → 30 XP · 40–49 min → 40 XP · 50+ min → 50 XP"}
                      </p>
                    </div>
                  ) : null}
                </div>

                {customError ? (
                  <p className="text-red-400 text-xs mt-2 font-bold">{customError}</p>
                ) : null}
              </div>

              {/* Sticky footer */}
              <div
                style={{
                  padding: "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))",
                  borderTop: "1px solid var(--card-border-idle)",
                  background: "rgba(0,0,0,0.35)",
                  display: "flex",
                  gap: 10
                }}
              >
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 rounded-md py-2 cinzel text-xs mobile-pressable"
                  style={{
                    background: "transparent",
                    border: "1px solid var(--card-border-idle)",
                    color: "#cbd5e1",
                    cursor: "pointer",
                    minHeight: 44
                  }}
                >
                  {t.cancelLabel}
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={customSaving || !title.trim()}
                  className="flex-1 rounded-md py-2 cinzel text-xs font-bold mobile-pressable"
                  style={{
                    background: `var(${accentVar})`,
                    color: "#0f172a",
                    border: "none",
                    cursor: customSaving || !title.trim() ? "not-allowed" : "pointer",
                    opacity: customSaving || !title.trim() ? 0.6 : 1,
                    minHeight: 44
                  }}
                >
                  {customSaving
                    ? t.onboardingSaving
                    : t.customHabitSave}
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {allowDelete && confirmDeleteId != null && (() => {
        const victim = Array.isArray(customQuests) ? customQuests.find((cq) => cq.id === confirmDeleteId) : null;
        const victimName = victim?.title || "";
        return (
        <div
          className="logout-confirm-overlay"
          style={{ zIndex: 120 }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}
        >
          <div className="logout-confirm-card" style={{ maxWidth: 360 }}>
            <div className="text-3xl mb-2 text-center">🗑</div>
            <p className="text-slate-100 text-center mb-4" style={{ lineHeight: 1.45 }}>
              {tf("customHabitDeleteConfirm", { name: victimName })}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-md py-2 cinzel text-xs mobile-pressable"
                style={{ background: "transparent", border: "1px solid var(--card-border-idle)", color: "#cbd5e1", cursor: "pointer", minHeight: 44 }}
                    >
                      {t.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={customSaving}
                className="flex-1 rounded-md py-2 cinzel text-xs font-bold mobile-pressable"
                style={{ background: "#dc2626", color: "#fff", border: "none", cursor: customSaving ? "not-allowed" : "pointer", opacity: customSaving ? 0.6 : 1, minHeight: 44 }}
              >
                {customSaving
                      ? t.onboardingSaving
                      : t.customHabitDelete}
              </button>
            </div>
          </div>
        </div>
        );
      })()}
    </div>
  );
}

export default CustomHabitManager;
