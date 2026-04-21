import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";

// Reference tables kept in English + Russian. Indexed by languageId so the
// modal renders the same structured data regardless of locale.
const LEVEL_TABLE = [
  { range: "1-4",  pinned: 2, random: 2, total: 4, effort: "1-3" },
  { range: "5-9",  pinned: 3, random: 3, total: 6, effort: "1-3" },
  { range: "10-19", pinned: 3, random: 3, total: 6, effort: "1-4" },
  { range: "20+", pinned: 4, random: 4, total: 8, effort: "1-4" }
];

const STREAK_MULTIPLIERS = [
  { range: "0-2",   mult: "x1.00" },
  { range: "3-6",   mult: "x1.05" },
  { range: "7-13",  mult: "x1.10" },
  { range: "14-20", mult: "x1.15" },
  { range: "21-29", mult: "x1.20" },
  { range: "30+",   mult: "x1.30" }
];

export default function AboutAppModal({ open, onClose }) {
  const { t, languageId } = useTheme();
  const isRu = languageId === "ru";
  const [sheetAnim, setSheetAnim] = useState(false);

  useEffect(() => {
    if (!open) {
      setSheetAnim(false);
      return undefined;
    }
    const id = requestAnimationFrame(() => setSheetAnim(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

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
    const onKeyDown = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const copy = isRu ? COPY_RU : COPY_EN;

  return createPortal(
    <div
      className="logout-confirm-overlay"
      style={{ zIndex: 90, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.76)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          background: "var(--panel-bg)",
          display: "flex",
          flexDirection: "column",
          transform: sheetAnim ? "translateY(0)" : "translateY(8px)",
          opacity: sheetAnim ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease"
        }}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "14px 16px 12px",
            borderBottom: "1px solid var(--panel-border)",
            background: "color-mix(in srgb, var(--panel-bg) 94%, transparent)",
            backdropFilter: "blur(10px)"
          }}
        >
          <div
            style={{
              width: 36, height: 36, borderRadius: 10,
              background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.22), rgba(0,0,0,0.2))",
              border: "1px solid var(--color-primary-dim, var(--panel-border))",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18
            }}
          >
            📖
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="cinzel" style={{ color: "var(--color-primary)", fontSize: 17, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
              {copy.title}
            </h2>
            <p style={{ fontSize: 11, color: "#94a3b8", margin: "2px 0 0", letterSpacing: "0.04em" }}>
              {copy.subtitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            style={{
              width: 36, height: 36, borderRadius: 999,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid var(--card-border-idle, var(--panel-border))",
              color: "#e2e8f0", cursor: "pointer", fontSize: 18,
              display: "flex", alignItems: "center", justifyContent: "center"
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "14px 16px 28px" }}>
          <Section icon="📈" title={copy.sections.levels.title} blurb={copy.sections.levels.blurb}>
            <Table
              headers={[copy.table.level, copy.table.habits, copy.table.dailyRandom, copy.table.totalQuests, copy.table.difficulty]}
              rows={LEVEL_TABLE.map((row) => [row.range, row.pinned, row.random, row.total, row.effort])}
            />
            <Note>{copy.sections.levels.note}</Note>
          </Section>

          <Section icon="🔥" title={copy.sections.streak.title} blurb={copy.sections.streak.blurb}>
            <Bullets items={copy.sections.streak.rules} />
            <SubHeading>{copy.sections.streak.multipliersHeading}</SubHeading>
            <Table
              headers={[copy.table.streakRange, copy.table.multiplier]}
              rows={STREAK_MULTIPLIERS.map((row) => [row.range, row.mult])}
            />
          </Section>

          <Section icon="⏱" title={copy.sections.timer.title} blurb={copy.sections.timer.blurb}>
            <Bullets items={copy.sections.timer.rules} />
            <Note>{copy.sections.timer.note}</Note>
          </Section>

          <Section icon="🎯" title={copy.sections.dailyBoard.title} blurb={copy.sections.dailyBoard.blurb}>
            <Bullets items={copy.sections.dailyBoard.rules} />
          </Section>

          <Section icon="🏆" title={copy.sections.habits.title} blurb={copy.sections.habits.blurb}>
            <Bullets items={copy.sections.habits.rules} />
          </Section>

          <Section icon="🏙" title={copy.sections.city.title} blurb={copy.sections.city.blurb}>
            <Bullets items={copy.sections.city.districts} />
          </Section>

          <Section icon="🛒" title={copy.sections.shop.title} blurb={copy.sections.shop.blurb}>
            <Bullets items={copy.sections.shop.items} />
          </Section>

          <Section icon="🧮" title={copy.sections.formulas.title} blurb={copy.sections.formulas.blurb}>
            <Formula label={copy.sections.formulas.xpLabel}>
              base_xp × streak_mult × (1 + sport_district × 0.05) × completion_percent
            </Formula>
            <Formula label={copy.sections.formulas.partialLabel}>
              elapsed_ms / (time_estimate_min × 60000) → quantize to 0 / 50 / 75 / 100
            </Formula>
            <Formula label={copy.sections.formulas.streakLabel}>
              100%_completions_today ≥ 4 → streak+1 · = 3 → hold · ≤ 2 → reset
            </Formula>
          </Section>
        </div>
      </div>
    </div>,
    document.body
  );
}

function Section({ icon, title, blurb, children }) {
  return (
    <section
      style={{
        borderRadius: 14,
        border: "1px solid var(--panel-border)",
        background: "color-mix(in srgb, var(--panel-bg) 84%, rgba(255,255,255,0.02))",
        padding: "14px 14px 12px",
        marginBottom: 12,
        boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset"
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: blurb ? 4 : 8 }}>
        <span aria-hidden="true" style={{ fontSize: 20 }}>{icon}</span>
        <h3 className="cinzel" style={{ fontSize: 14, fontWeight: 700, color: "var(--color-primary)", margin: 0, letterSpacing: "0.04em" }}>
          {title}
        </h3>
      </div>
      {blurb ? (
        <p style={{ fontSize: 12.5, color: "var(--color-muted)", margin: "2px 0 10px", lineHeight: 1.5 }}>{blurb}</p>
      ) : null}
      {children}
    </section>
  );
}

function Bullets({ items }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "4px 0 0", display: "flex", flexDirection: "column", gap: 6 }}>
      {items.map((item, idx) => (
        <li key={idx} style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: "var(--color-text)", lineHeight: 1.45 }}>
          <span aria-hidden="true" style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 1 }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function SubHeading({ children }) {
  return (
    <p
      className="cinzel"
      style={{
        fontSize: 11,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        color: "var(--color-muted)",
        margin: "14px 0 6px",
        fontWeight: 700
      }}
    >
      {children}
    </p>
  );
}

function Note({ children }) {
  return (
    <p
      style={{
        fontSize: 11.5,
        color: "var(--color-muted)",
        fontStyle: "italic",
        margin: "10px 0 0",
        lineHeight: 1.45,
        paddingTop: 8,
        borderTop: "1px dashed var(--panel-border)"
      }}
    >
      ⓘ {children}
    </p>
  );
}

function Formula({ label, children }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: 10,
        background: "rgba(0,0,0,0.3)",
        border: "1px solid var(--panel-border)",
        marginTop: 8
      }}
    >
      <p style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-muted)", margin: "0 0 4px", fontWeight: 700 }}>
        {label}
      </p>
      <code
        style={{
          display: "block",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 12,
          color: "var(--color-text)",
          wordBreak: "break-word",
          lineHeight: 1.45
        }}
      >
        {children}
      </code>
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div style={{ overflowX: "auto", marginTop: 6, borderRadius: 10, border: "1px solid var(--panel-border)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, color: "var(--color-text)" }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th
                key={i}
                style={{
                  padding: "8px 10px",
                  background: "color-mix(in srgb, var(--panel-bg) 70%, rgba(0,0,0,0.25))",
                  color: "var(--color-primary)",
                  fontFamily: "var(--font-heading)",
                  fontSize: 10.5,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  fontWeight: 700,
                  textAlign: "left",
                  borderBottom: "1px solid var(--panel-border)"
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx} style={{ background: rIdx % 2 === 0 ? "transparent" : "rgba(255,255,255,0.02)" }}>
              {row.map((cell, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: "8px 10px",
                    borderTop: rIdx === 0 ? "none" : "1px solid var(--panel-border)",
                    color: cIdx === 0 ? "var(--color-primary)" : "var(--color-text)",
                    fontWeight: cIdx === 0 ? 700 : 500
                  }}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Copy. Kept inline (instead of i18nConfig.js) because this is a
// single localized document — moving every paragraph into the shared
// vocab would bloat that file with 40+ one-off keys.
// ────────────────────────────────────────────────────────────────

const COPY_EN = {
  title: "About the App",
  subtitle: "Rules, mechanics, and formulas",
  close: "Close",
  table: {
    level: "Level",
    habits: "Habits",
    dailyRandom: "Random",
    totalQuests: "Total",
    difficulty: "Difficulty",
    streakRange: "Streak",
    multiplier: "XP Multiplier"
  },
  sections: {
    levels: {
      title: "Level progression",
      blurb: "How many quests you see each day depends on your level. Habits are quests you pin; random quests re-roll daily.",
      note: "Difficulty 5 quests unlock only while your streak is 14 or higher."
    },
    streak: {
      title: "Streak",
      blurb: "Complete enough quests each day to keep your streak alive. Higher streak = bigger XP bonus.",
      rules: [
        "4+ quests completed at 100% → streak +1",
        "Exactly 3 → streak holds (no change)",
        "2 or fewer → streak resets to 0",
        "Partial completions (50% / 75%) don't count toward the streak",
        "One Streak Freeze charge protects you for a day if you miss"
      ],
      multipliersHeading: "Streak XP multiplier"
    },
    timer: {
      title: "Timed quests",
      blurb: "Focused-session quests run a server-side timer. The percent you complete determines your XP.",
      rules: [
        "< 50% elapsed → nothing awarded, quest stays open",
        "50-74% → 50% XP, counts on the daily board but not streak",
        "75-99% → 75% XP, counts on the daily board but not streak",
        "100% → full XP, counts for both the daily board and streak"
      ],
      note: "Quests without a timer (accumulative / all-day) always count as 100% when completed."
    },
    dailyBoard: {
      title: "Daily board",
      blurb: "The board shows your three milestone rewards — scaled to the slots you've unlocked (X-2, X-1, X).",
      rules: [
        "X-2 quests → +20 XP bonus, +1 streak credit on full-streak day",
        "X-1 quests → +25 XP bonus",
        "X quests (full board) → +25 XP + 1 token (plus Square district bonus)",
        "The board resets every day at 00:00 UTC"
      ]
    },
    habits: {
      title: "Habits",
      blurb: "Pinned quests you commit to repeating. They award fixed 30 XP regardless of their base value.",
      rules: [
        "Complete the same habit 21 days in a row → +10 token milestone",
        "Replace habits via the shop (free once every 21 days, otherwise 7 tokens)",
        "You can also create custom habits up to 20 total",
        "Each level tier may unlock a new habit slot — empty slots appear for you to pick"
      ]
    },
    city: {
      title: "City districts",
      blurb: "Each district adds a passive perk. Upgrade districts by spending tokens.",
      districts: [
        "Sport — +5% quest XP per level (stacks with streak multiplier)",
        "Square — extra tokens when you fill the daily board",
        "Residential — discounts shop items, grants monthly Streak Freeze & vacations",
        "Business — daily token claim",
        "Education — faster reroll cooldown"
      ]
    },
    shop: {
      title: "Shop",
      blurb: "Spend tokens on reroll charges and streak protection.",
      items: [
        "Streak Freeze — 7 tokens (one per week, Monday UTC reset). Holds your streak for one missed day.",
        "Extra Daily Reroll — 3 tokens, replaces the current random quest set",
        "Replace Pinned Habits — free once per 21 days, otherwise 7 tokens",
        "Residential district reduces all shop costs"
      ]
    },
    formulas: {
      title: "Formulas",
      blurb: "Under the hood.",
      xpLabel: "XP awarded per quest",
      partialLabel: "Completion percent",
      streakLabel: "Streak update"
    }
  }
};

const COPY_RU = {
  title: "О приложении",
  subtitle: "Правила, механики и формулы",
  close: "Закрыть",
  table: {
    level: "Уровень",
    habits: "Привычки",
    dailyRandom: "Рандом",
    totalQuests: "Всего",
    difficulty: "Сложность",
    streakRange: "Стрик",
    multiplier: "Множитель XP"
  },
  sections: {
    levels: {
      title: "Прогрессия по уровням",
      blurb: "Сколько квестов вам доступно в день — зависит от уровня. Привычки — закреплённые квесты, рандомные — меняются каждый день.",
      note: "Квесты со сложностью 5 доступны только при стрике 14 и выше."
    },
    streak: {
      title: "Стрик",
      blurb: "Закрывайте достаточно квестов в день, чтобы стрик жил. Чем выше стрик — тем больше бонусный XP.",
      rules: [
        "4+ квестов на 100% → стрик +1",
        "Ровно 3 → стрик сохраняется",
        "2 и меньше → стрик сбрасывается в 0",
        "Частичные завершения (50% / 75%) в стрик не засчитываются",
        "Заряд Streak Freeze даёт защиту на один пропущенный день"
      ],
      multipliersHeading: "Множитель XP от стрика"
    },
    timer: {
      title: "Квесты с таймером",
      blurb: "Квесты-сессии используют серверный таймер. Процент выполнения определяет размер XP.",
      rules: [
        "< 50% времени → ничего не выдаётся, квест остаётся активным",
        "50–74% → 50% XP, засчитывается на дейли борд, но не в стрик",
        "75–99% → 75% XP, засчитывается на дейли борд, но не в стрик",
        "100% → полный XP, засчитывается и на борд, и в стрик"
      ],
      note: "Квесты без таймера (накопительные / на весь день) всегда считаются выполненными на 100%."
    },
    dailyBoard: {
      title: "Дейли борд",
      blurb: "Борд показывает три вехи — они масштабируются под открытые слоты (X−2, X−1, X).",
      rules: [
        "X−2 квестов → +20 XP бонус, +1 стрик в успешный день",
        "X−1 квестов → +25 XP бонус",
        "X квестов (полный борд) → +25 XP + 1 токен (плюс бонус Квартала)",
        "Борд обнуляется каждый день в 00:00 UTC"
      ]
    },
    habits: {
      title: "Привычки",
      blurb: "Закреплённые квесты, которые вы обещаете себе повторять. Дают фиксированные 30 XP независимо от базового значения.",
      rules: [
        "Закройте одну и ту же привычку 21 день подряд → +10 токенов",
        "Заменить привычки можно в магазине (раз в 21 день бесплатно, иначе 7 токенов)",
        "Можно создать до 20 собственных привычек",
        "С каждым тиром уровня может открыться новый слот — пустые карточки предложат выбрать"
      ]
    },
    city: {
      title: "Районы города",
      blurb: "Каждый район даёт пассивный бонус. Прокачивается за токены.",
      districts: [
        "Спорт — +5% XP за каждый уровень (стакается со множителем стрика)",
        "Площадь — дополнительные токены за полный дейли борд",
        "Жилой — скидки в магазине, ежемесячный Freeze и отпуска",
        "Бизнес — ежедневный клейм токенов",
        "Образование — быстрее перезарядка рерола"
      ]
    },
    shop: {
      title: "Магазин",
      blurb: "Тратьте токены на рероллы и защиту стрика.",
      items: [
        "Streak Freeze — 7 токенов (1/неделя, сброс в понедельник UTC). Защитит стрик при пропуске.",
        "Extra Daily Reroll — 3 токена, меняет набор рандомных квестов",
        "Заменить привычки — раз в 21 день бесплатно, иначе 7 токенов",
        "Жилой район даёт скидку на всё в магазине"
      ]
    },
    formulas: {
      title: "Формулы",
      blurb: "Под капотом.",
      xpLabel: "XP за квест",
      partialLabel: "Процент выполнения",
      streakLabel: "Обновление стрика"
    }
  }
};
