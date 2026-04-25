import { useTheme } from "../ThemeContext";
import {
  IconMuscle,
  IconBrain,
  IconSwords,
  IconMoon,
  IconUsers,
  IconBolt,
  IconSparkle
} from "./icons/Icons";

const DEFAULT_CATEGORIES = ["BODY", "MIND", "DISCIPLINE", "RECOVERY", "SOCIAL", "ADAPTIVE"];
const CATEGORY_ICONS = {
  BODY: IconMuscle,
  MIND: IconBrain,
  DISCIPLINE: IconSwords,
  RECOVERY: IconMoon,
  SOCIAL: IconUsers,
  ADAPTIVE: IconBolt
};

export default function CategoryFilterRow({ value = "ALL", onChange, categories = DEFAULT_CATEGORIES, counts = null, translateCategory }) {
  const { t } = useTheme();
  const available = Array.isArray(categories) && categories.length > 0 ? categories : DEFAULT_CATEGORIES;

  const Pill = ({ key: _k, label, IconComp, active, onClick, count }) => (
    <button
      type="button"
      onClick={onClick}
      className="cinzel mobile-pressable"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 11px",
        borderRadius: 999,
        border: `1px solid ${active ? "var(--color-primary)" : "var(--card-border-idle)"}`,
        background: active
          ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
          : "rgba(255,255,255,0.03)",
        color: active ? "var(--color-primary)" : "var(--color-muted)",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        whiteSpace: "nowrap",
        flexShrink: 0,
        cursor: "pointer"
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        {IconComp ? <IconComp size={14} /> : null}
      </span>
      <span>{label}</span>
      {count != null ? (
        <span
          style={{
            background: active
              ? "color-mix(in srgb, var(--color-primary) 22%, transparent)"
              : "rgba(148,163,184,0.14)",
            padding: "1px 7px",
            borderRadius: 999,
            fontSize: 10,
            fontWeight: 800,
            color: active ? "var(--color-primary)" : "var(--color-muted)"
          }}
        >
          {count}
        </span>
      ) : null}
    </button>
  );

  return (
    <div
      className="no-scrollbar"
      style={{
        display: "flex",
        gap: 6,
        overflowX: "auto",
        paddingBottom: 0,
        WebkitOverflowScrolling: "touch"
      }}
    >
      <Pill
        label={t.categoryFilterAll || "All"}
        IconComp={IconSparkle}
        active={value === "ALL"}
        onClick={() => onChange?.("ALL")}
        count={counts?.ALL}
      />
      {available.map((cat) => (
        <Pill
          key={cat}
          label={translateCategory ? translateCategory(cat) : cat}
          IconComp={CATEGORY_ICONS[cat]}
          active={value === cat}
          onClick={() => onChange?.(cat)}
          count={counts?.[cat]}
        />
      ))}
    </div>
  );
}
