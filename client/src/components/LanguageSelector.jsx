import { useState, useRef, useEffect } from "react";

export default function LanguageSelector({ languageId, languageIds, getLanguageMeta, onChange, compact, direction = "down" }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const current = getLanguageMeta(languageId);
  const flagEmoji = languageId === "ru" ? "🇷🇺" : languageId === "en" ? "🇬🇧" : "🌐";

  return (
    <div ref={ref} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="cinzel"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: compact ? "6px 12px" : "8px 16px",
          borderRadius: "10px",
          border: "1.5px solid var(--card-border-idle)",
          background: "rgba(15, 23, 42, 0.7)",
          backdropFilter: "blur(8px)",
          color: "var(--color-text)",
          cursor: "pointer",
          fontSize: compact ? "13px" : "14px",
          fontWeight: 600,
          transition: "all 0.2s ease",
          minWidth: compact ? undefined : "140px",
        }}
      >
        <span style={{ fontSize: compact ? "16px" : "18px" }}>{flagEmoji}</span>
        <span>{current.nativeLabel}</span>
        <span style={{
          marginLeft: "auto",
          fontSize: "10px",
          opacity: 0.5,
          transform: open ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease"
        }}>▼</span>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: direction === "up" ? "auto" : "calc(100% + 6px)",
          bottom: direction === "up" ? "calc(100% + 6px)" : "auto",
          left: "50%",
          transform: "translateX(-50%)",
          minWidth: "180px",
          borderRadius: "12px",
          border: "1.5px solid var(--card-border-idle)",
          background: "rgba(15, 23, 42, 0.95)",
          backdropFilter: "blur(16px)",
          boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
          zIndex: 999,
          overflow: "hidden",
          animation: "fadeIn 0.15s ease"
        }}>
          {languageIds.map((id) => {
            const lang = getLanguageMeta(id);
            const isActive = id === languageId;
            const flag = id === "ru" ? "🇷🇺" : id === "en" ? "🇬🇧" : "🌐";
            return (
              <button
                key={id}
                type="button"
                onClick={() => { onChange(id); setOpen(false); }}
                className="cinzel"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "10px 16px",
                  border: "none",
                  borderLeft: isActive ? "3px solid var(--color-primary)" : "3px solid transparent",
                  background: isActive ? "var(--color-accent-dim)" : "transparent",
                  color: isActive ? "var(--color-primary)" : "var(--color-text)",
                  cursor: "pointer",
                  fontSize: "13px",
                  fontWeight: isActive ? 700 : 500,
                  textAlign: "left",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = "transparent";
                }}
              >
                <span style={{ fontSize: "18px" }}>{flag}</span>
                <div>
                  <div>{lang.nativeLabel}</div>
                  {lang.label !== lang.nativeLabel && (
                    <div style={{ fontSize: "11px", opacity: 0.5, fontWeight: 400 }}>{lang.label}</div>
                  )}
                </div>
                {isActive && <span style={{ marginLeft: "auto", fontSize: "14px" }}>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
