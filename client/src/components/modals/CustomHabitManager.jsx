import { useState, useEffect } from "react";
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
  const { t } = useTheme();
  const [mode, setMode] = useState("list"); // "list" | "create" | "edit"
  const [editingId, setEditingId] = useState(null);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

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
    setEditingId(null);
    setMode("list");
    onClearCustomError?.();
  };

  const startCreate = () => {
    onClearCustomError?.();
    setTitle("");
    setDesc("");
    setMode("create");
  };

  const startEdit = (cq) => {
    onClearCustomError?.();
    setEditingId(cq.id);
    setTitle(cq.title || "");
    setDesc(cq.desc || cq.description || "");
    setMode("edit");
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;
    if (mode === "create") {
      const created = await onCreateCustomQuest({ title: cleanTitle, description: desc.trim() });
      if (created) resetForm();
    } else if (mode === "edit" && editingId != null) {
      const updated = await onUpdateCustomQuest(editingId, { title: cleanTitle, description: desc.trim() });
      if (updated) resetForm();
    }
  };

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
                        paddingRight: 60
                      }}
                    >
                      <p className="cinzel text-sm text-slate-100 font-bold">
                        <span style={{ ...accentStyle, marginRight: 6 }}>★</span>
                        {cq.title}
                      </p>
                      {cq.desc ? (
                        <p className="text-xs text-slate-400 mt-1">{cq.desc}</p>
                      ) : null}
                    </button>
                    <div style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4 }}>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); startEdit(cq); }}
                            title={t.customHabitEdit}
                        className="rounded-md"
                        style={{
                          background: "rgba(0,0,0,0.35)",
                          border: "1px solid var(--card-border-idle)",
                          color: "#cbd5e1",
                          padding: "4px 6px",
                          cursor: "pointer",
                          minWidth: 32,
                          minHeight: 32,
                          fontSize: 14
                        }}
                      >
                        ✏️
                      </button>
                      {allowDelete ? (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(cq.id); }}
                              title={t.customHabitDelete}
                          className="rounded-md"
                          style={{
                            background: "rgba(0,0,0,0.35)",
                            border: "1px solid var(--card-border-idle)",
                            color: "#fca5a5",
                            padding: "4px 6px",
                            cursor: "pointer",
                            minWidth: 32,
                            minHeight: 32,
                            fontSize: 14
                          }}
                        >
                          🗑
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
            className="w-full rounded-lg border p-3 cinzel text-sm"
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

      {(mode === "create" || mode === "edit") && (
        <div
          className="rounded-lg border p-3"
          style={{ borderColor: accentBorder, background: "var(--card-bg)" }}
        >
          <label className="cinzel text-xs tracking-widest uppercase block mb-1" style={accentStyle}>
                {t.customHabitTitleLabel}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
            maxLength={TITLE_MAX}
            className="w-full rounded-md px-3 py-2 text-slate-100"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border-idle)", minHeight: 44 }}
                placeholder={t.customHabitTitlePlaceholder}
          />
          <div className="text-right text-xs text-slate-500 mt-1">{title.length} / {TITLE_MAX}</div>

          <label className="cinzel text-xs tracking-widest uppercase block mt-2 mb-1" style={accentStyle}>
                {t.customHabitDescLabel}
          </label>
          <textarea
            value={desc}
            onChange={(e) => setDesc(e.target.value.slice(0, DESC_MAX))}
            maxLength={DESC_MAX}
            rows={2}
            className="w-full rounded-md px-3 py-2 text-slate-100"
            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid var(--card-border-idle)", resize: "vertical" }}
                placeholder={t.customHabitDescPlaceholder}
          />
          <div className="text-right text-xs text-slate-500 mt-1">{desc.length} / {DESC_MAX}</div>

          {customError ? (
            <p className="text-red-400 text-xs mt-2 font-bold">{customError}</p>
          ) : null}

          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 rounded-md py-2 cinzel text-xs"
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
              className="flex-1 rounded-md py-2 cinzel text-xs font-bold"
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
      )}

      {allowDelete && confirmDeleteId != null && (
        <div
          className="logout-confirm-overlay"
          style={{ zIndex: 120 }}
          onClick={(e) => { if (e.target === e.currentTarget) setConfirmDeleteId(null); }}
        >
          <div className="logout-confirm-card" style={{ maxWidth: 360 }}>
            <div className="text-3xl mb-2 text-center">🗑</div>
            <p className="text-slate-100 text-center mb-4">
                  {t.customHabitDeleteConfirm}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 rounded-md py-2 cinzel text-xs"
                style={{ background: "transparent", border: "1px solid var(--card-border-idle)", color: "#cbd5e1", cursor: "pointer", minHeight: 44 }}
                    >
                      {t.cancelLabel}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(confirmDeleteId)}
                disabled={customSaving}
                className="flex-1 rounded-md py-2 cinzel text-xs font-bold"
                style={{ background: "#dc2626", color: "#fff", border: "none", cursor: customSaving ? "not-allowed" : "pointer", opacity: customSaving ? 0.6 : 1, minHeight: 44 }}
              >
                {customSaving
                      ? t.onboardingSaving
                      : t.customHabitDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomHabitManager;
