import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";
import useEdgeSwipeBack from "../../hooks/useEdgeSwipeBack";

export default function AboutAppModal({ open, onClose }) {
  const { languageId, themeId } = useTheme();
  const isRu = languageId === "ru";
  const isLight = themeId === "light";
  const [sheetAnim, setSheetAnim] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  useEffect(() => {
    if (!open) {
      setSheetAnim(false);
      setOpenSection(null);
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

  const swipeBind = useEdgeSwipeBack(onClose);

  if (!open) return null;

  const copy = isRu ? COPY_RU : COPY_EN;

  return createPortal(
    <div
      className="logout-confirm-overlay"
      style={{ zIndex: 90, alignItems: "stretch", justifyContent: "stretch", padding: 0, background: "rgba(0,0,0,0.76)" }}
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
          // Respect iOS notch / status bar so the close button is tappable
          // and the scroll content doesn't sit under the system UI.
          paddingTop: "env(safe-area-inset-top, 0px)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          transform: sheetAnim ? "translateY(0)" : "translateY(8px)",
          opacity: sheetAnim ? 1 : 0,
          transition: "transform 220ms cubic-bezier(0.32, 0.72, 0, 1), opacity 180ms ease"
        }}
        role="dialog"
        aria-modal="true"
        aria-label={copy.title}
      >
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "14px 16px 28px"
          }}
        >
          {/* Hero header card — mirrors the panel framing used on the
              dashboard / profile so the About screen feels at home in
              the rest of the app. Taller than before so the title
              breathes a bit and isn't cramped with the close button. */}
          <div
            className="mobile-card"
            style={{
              position: "relative",
              overflow: "hidden",
              padding: "18px 18px 20px",
              marginBottom: 14,
              background: "var(--card-bg)",
              border: "1px solid var(--panel-border)",
              borderRadius: "var(--border-radius-panel, 1.25rem)",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.22)"
            }}
          >
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                background: "radial-gradient(140% 120% at 100% 0%, rgba(var(--color-primary-rgb,251,191,36),0.16), transparent 60%)",
                pointerEvents: "none"
              }}
            />
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 56, height: 56, borderRadius: 16,
                  background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.32), rgba(0,0,0,0.3))",
                  border: "1px solid color-mix(in srgb, var(--color-primary) 55%, transparent)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 28, flexShrink: 0,
                  boxShadow: "0 4px 14px rgba(0,0,0,0.35), inset 0 0 12px rgba(255,255,255,0.05)"
                }}
              >
                📖
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2
                  className="cinzel"
                  style={{
                    color: "var(--color-primary)",
                    fontSize: 22,
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: 1.15,
                    letterSpacing: "0.02em",
                    textShadow: "0 2px 10px rgba(0,0,0,0.45)"
                  }}
                >
                  {copy.title}
                </h2>
                <p
                  style={{
                    fontSize: 12.5,
                    color: "var(--color-muted)",
                    margin: "6px 0 0",
                    letterSpacing: "0.05em",
                    lineHeight: 1.35
                  }}
                >
                  {copy.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label={copy.close}
                className="ui-close-x"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Accordion sections. Tap a card to expand the details. */}
          {copy.sections.map((section, idx) => {
            const isOpen = openSection === idx;
            return (
              <AccordionCard
                key={idx}
                icon={section.icon}
                title={section.title}
                summary={section.summary}
                isOpen={isOpen}
                onToggle={() => setOpenSection(isOpen ? null : idx)}
              >
                {section.body}
              </AccordionCard>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
}

function AccordionCard({ icon, title, summary, isOpen, onToggle, children }) {
  return (
    <div
      style={{
        marginBottom: 10,
        borderRadius: 14,
        border: "1px solid var(--panel-border)",
        background: "color-mix(in srgb, var(--panel-bg) 86%, rgba(255,255,255,0.02))",
        overflow: "hidden"
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="mobile-pressable"
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 14px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--color-text)"
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: isOpen
              ? "color-mix(in srgb, var(--color-primary) 20%, transparent)"
              : "rgba(255,255,255,0.04)",
            border: `1px solid ${isOpen ? "color-mix(in srgb, var(--color-primary) 50%, transparent)" : "var(--panel-border)"}`,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
            transition: "background 180ms ease, border-color 180ms ease"
          }}
        >
          {icon}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span
            className="cinzel"
            style={{
              display: "block",
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-primary)",
              letterSpacing: "0.04em",
              lineHeight: 1.2
            }}
          >
            {title}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              color: "var(--color-muted)",
              marginTop: 3,
              lineHeight: 1.35
            }}
          >
            {summary}
          </span>
        </span>
        <span
          aria-hidden="true"
          style={{
            color: "var(--color-muted)",
            fontSize: 18,
            flexShrink: 0,
            transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 180ms ease"
          }}
        >
          ›
        </span>
      </button>
      {isOpen ? (
        <div
          style={{
            padding: "4px 16px 16px",
            borderTop: "1px solid var(--panel-border)",
            background: "rgba(0,0,0,0.18)"
          }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

function Bullets({ items }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: "10px 0 0", display: "flex", flexDirection: "column", gap: 8 }}>
      {items.map((item, idx) => (
        <li
          key={idx}
          style={{
            display: "flex",
            gap: 10,
            alignItems: "flex-start",
            fontSize: 13.5,
            color: "var(--color-text)",
            lineHeight: 1.5
          }}
        >
          <span aria-hidden="true" style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 1, fontSize: 15 }}>•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function Rows({ rows }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
      {rows.map((row, idx) => (
        <div
          key={idx}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 10,
            padding: "8px 10px",
            borderRadius: 10,
            background: "color-mix(in srgb, var(--panel-bg) 65%, transparent)",
            border: "1px solid color-mix(in srgb, var(--card-border-idle) 65%, transparent)"
          }}
        >
          <span style={{ fontSize: 13, color: "var(--color-text)", fontWeight: 600 }}>{row.label}</span>
          <span
            className="cinzel"
            style={{
              fontSize: 12,
              color: "var(--color-primary)",
              fontWeight: 700,
              letterSpacing: "0.04em",
              textAlign: "right"
            }}
          >
            {row.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Copy. Inline because this is a single-document screen and moving
// every line into i18nConfig would bloat that file.
// ────────────────────────────────────────────────────────────────

const COPY_EN = {
  title: "About the app",
  subtitle: "Complete guide to how everything works",
  close: "Close",
  sections: [
    {
      icon: "🎯",
      title: "The main idea",
      summary: "Show up every day, build habits, grow a city.",
      body: (
        <>
          <Bullets items={[
            "Every day you get a small set of quests to complete.",
            "Finishing quests earns XP (levels you up) and sometimes silver (premium currency).",
            "Showing up day after day grows your streak, which multiplies the XP from every quest.",
            "Silver upgrades districts in your personal city — each district gives a permanent gameplay perk.",
            "Everything is designed around one habit: come back every day."
          ]} />
        </>
      )
    },
    {
      icon: "📋",
      title: "Your daily quests",
      summary: "How many you get and why they change as you level up.",
      body: (
        <>
          <Bullets items={[
            "Your board mixes two kinds of quests: habits (you pick them, they stay pinned) and daily quests (shuffle each day).",
            "The higher your level, the more quests unlock each day, and the harder quests appear.",
            "You can reroll today's random quests once for free; extra rerolls cost 3 silver each in the shop.",
            "Finishing a quest at 100% always counts toward your streak. Timer quests can earn partial XP — see the Timer section."
          ]} />
          <Rows rows={[
            { label: "Level 1–4", value: "2 habits + 2 daily" },
            { label: "Level 5–9", value: "3 habits + 3 daily" },
            { label: "Level 10–19", value: "3 habits + 3 daily (harder)" },
            { label: "Level 20+", value: "4 habits + 4 daily" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            The hardest quests (difficulty 5) only appear once your streak reaches 14 days.
          </p>
        </>
      )
    },
    {
      icon: "🔥",
      title: "Streak — your daily chain",
      summary: "The core mechanic. Every extra day makes every quest worth more.",
      body: (
        <>
          <Bullets items={[
            "Finish 4 or more quests today → streak +1.",
            "Finish exactly 3 → streak holds (no change).",
            "Finish 2 or fewer → streak resets to 0.",
            "Streak multiplies the XP from every single quest, permanently while the streak holds.",
            "Reaching 14 days unlocks the hardest (difficulty 5) quests.",
            "A Streak Freeze charge auto-consumes when you would otherwise miss a day — no manual action needed. See Shop and Profile."
          ]} />
          <Rows rows={[
            { label: "0–2 day streak", value: "normal XP" },
            { label: "3–6 day streak", value: "+5% XP" },
            { label: "7–13 day streak", value: "+10% XP" },
            { label: "14–20 day streak", value: "+15% XP" },
            { label: "21–29 day streak", value: "+20% XP" },
            { label: "30–49 day streak", value: "+30% XP" },
            { label: "50+ day streak", value: "+50% XP" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            The XP bonus stacks with district perks and the XP Boost shop item.
          </p>
        </>
      )
    },
    {
      icon: "⏱",
      title: "Timer quests",
      summary: "Some quests need you to actually spend time on them.",
      body: (
        <>
          <Bullets items={[
            "Quests like reading, stretching, or a focus sprint use a timer.",
            "Tap Start — the app tracks your session on the server.",
            "You can pause and come back, the clock will wait.",
            "At 100% the quest finishes automatically and you get a congrats.",
            "Quit early? You still get partial XP if you reached at least half the time."
          ]} />
          <Rows rows={[
            { label: "Less than 50% done", value: "No XP, quest stays" },
            { label: "50–74% done", value: "Half XP" },
            { label: "75–99% done", value: "3/4 XP" },
            { label: "100% done", value: "Full XP + streak credit" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Only quests finished at 100% count for your streak. Partial finishes still go on the daily board.
          </p>
        </>
      )
    },
    {
      icon: "🏅",
      title: "Daily board rewards",
      summary: "Bonus XP and silver when you fill enough slots.",
      body: (
        <>
          <Bullets items={[
            "The board shows three milestones matching your daily quest count.",
            "Hitting each milestone gives extra XP and, at the top one, a silver.",
            "The board clears every day at midnight UTC."
          ]} />
          <Rows rows={[
            { label: "Reach 2nd-to-last milestone", value: "+20 XP" },
            { label: "Reach 1-before-last milestone", value: "+25 XP" },
            { label: "Fill the whole board", value: "+25 XP and +1 token" }
          ]} />
        </>
      )
    },
    {
      icon: "📌",
      title: "Habits",
      summary: "The quests you keep every day.",
      body: (
        <>
          <Bullets items={[
            "Habits are the quests you've pinned for yourself. They don't shuffle.",
            "Every habit gives a flat 30 XP, no matter its base reward.",
            "Complete the same habit 21 days in a row → earn a +20 silver bonus.",
            "Want to swap a habit? Use the Replace Habits button — free once every 21 days, otherwise 7 silver.",
            "You can also create your own custom habits, up to 20 total."
          ]} />
        </>
      )
    },
    {
      icon: "🏙",
      title: "Your city",
      summary: "Why a city? Every district is a permanent gameplay perk you earn.",
      body: (
        <>
          <Bullets items={[
            "Your city is the long-term progression layer. As you save silver and upgrade districts, each district unlocks a permanent perk that changes how the game plays for you.",
            "It also gives daily work something visible: the city physically grows as you keep showing up — a snapshot of your discipline.",
            "Districts can be upgraded to level 5. Costs scale up (5 → 15 → 25 → 50 → 100 silver) and higher levels also require a minimum streak and account level.",
            "Districts upgrade independently — you can specialize, or spread upgrades across all five."
          ]} />
          <Rows rows={[
            { label: "🏃 Sport", value: "+5% XP per level (max +25%)" },
            { label: "💼 Business", value: "Claim a silver bundle once a day" },
            { label: "🌳 Park", value: "Unlocks Wheel of Fortune (lvl 1+); shortens its cooldown at higher levels" },
            { label: "🏛 Square", value: "Extra silver for filling the full daily board" },
            { label: "🏘 Residential", value: "Shop discount (lvl 1+), monthly Freeze (lvl 2+), Vacation (lvl 3+)" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Residential level 3 unlocks Vacation — a one-time bundle of 20 Streak Freeze charges (cooldown: once a year) that absorbs missed days automatically.
          </p>
        </>
      )
    },
    {
      icon: "🎰",
      title: "Wheel of Fortune",
      summary: "Daily free spin for XP, silver, or a level up.",
      body: (
        <>
          <Bullets items={[
            "The Wheel lives inside the Park district on the City screen. Rewards include XP, silver, or a free level up.",
            "It's locked until you upgrade Park to level 1 — there's no spin available at Park 0.",
            "From Park 1 onwards a cooldown kicks in after each spin; higher Park levels shorten that cooldown."
          ]} />
          <Rows rows={[
            { label: "Park 0 (not built)", value: "🔒 Locked" },
            { label: "Park 1", value: "24 hours" },
            { label: "Park 2", value: "20 hours" },
            { label: "Park 3", value: "16 hours" },
            { label: "Park 4", value: "12 hours" },
            { label: "Park 5", value: "8 hours" }
          ]} />
        </>
      )
    },
    {
      icon: "🪙",
      title: "Silver — where it comes from",
      summary: "Everything you can spend in the Shop and City.",
      body: (
        <>
          <Bullets items={[
            "Level up — silver per level scale: 1 (lvl 2–10), 2 (11–20), 3 (21–30), 4 (31–50), 5 (51+).",
            "Daily board — 3 silver for filling all 4 milestone slots.",
            "Habit milestone — +20 silver bonus for completing the same habit 21 days in a row.",
            "Business district — claim a daily silver bundle (1–5 silver based on district level).",
            "Square district — at level 1+, filling the full daily board gives extra silver equal to district level.",
            "Wheel of Fortune — silver are one of the possible spin rewards.",
            "Residential district — awards free Streak Freeze charges instead of silver: 1 per month from level 2, 2 per month from level 4."
          ]} />
        </>
      )
    },
    {
      icon: "🛒",
      title: "Shop",
      summary: "What your silver buy you.",
      body: (
        <>
          <Bullets items={[
            "Streak Freeze — 7 silver. Adds one charge to your inventory (visible in Profile). Charges auto-consume when you would otherwise miss a day — no manual activation. Limit: 1 purchase per week.",
            "Extra Daily Reroll — 3 silver. Reshuffles today's random quests once more after the free reroll is used. You can buy multiple.",
            "XP Boost — 15 silver. Gives +15% XP on every completed quest for 7 days. Buying again while active extends the timer.",
            "Pinned Quest Reroll — 7 silver. Opens the picker to replace your pinned habits. You also get a free pinned reroll every 21 days.",
            "Reset City — wipes every district back to level 0 and refunds the silver you spent on them. Cost grows each time: 10 → 20 → 30 → 40 → 50, capped at 50 silver from the 5th reset onward. The first paid reset unlocks the Phoenix achievement.",
            "Residential district gives a discount on every shop item (−1 silver from level 1, −2 silver from level 5)."
          ]} />
        </>
      )
    },
    {
      icon: "🏆",
      title: "Achievements",
      summary: "Trophies you collect by playing the long game.",
      body: (
        <>
          <Bullets items={[
            "Achievements unlock automatically as you play. Tap them in your Profile to see what you've earned and when.",
            "They cover three areas: daily discipline (streak length), silver spending, and social play (challenges, invites, language).",
            "There's no XP bonus — each one is a one-shot trophy and bragging right."
          ]} />
          <Rows rows={[
            { label: "🔥 Week Warrior", value: "Reach a 7-day streak" },
            { label: "🏔 Month Monk", value: "Reach a 30-day streak" },
            { label: "💯 Hundred Club", value: "Reach a 100-day streak" },
            { label: "🪙 First Coin", value: "Spend your first token" },
            { label: "💰 High Roller", value: "Spend 200+ silver total" },
            { label: "🌐 Polyglot", value: "Switch the app language" },
            { label: "🤝 First Handshake", value: "Join a group challenge" },
            { label: "🏅 Champion", value: "Finish a 7+ day group challenge" },
            { label: "👥 Mentor", value: "Invite 3 friends who stay active" },
            { label: "🐦 Phoenix", value: "Reset your city for the first time" }
          ]} />
        </>
      )
    },
    {
      icon: "🤝",
      title: "Group challenges",
      summary: "Run a multi-day mission with friends — keep up or get carried.",
      body: (
        <>
          <Bullets items={[
            "Create or accept a challenge (e.g. \"30 days of meditation\"). Everyone tracks the same goal in the same window.",
            "You can be in up to 3 active challenges at once. Creating a new one is limited to 1 per day.",
            "Each day participants mark their progress; a leaderboard inside the challenge shows who's keeping up.",
            "Finishing a challenge that ran 7 days or longer unlocks the Champion achievement.",
            "Joining a challenge for the first time unlocks First Handshake."
          ]} />
        </>
      )
    },
    {
      icon: "👥",
      title: "Friends & leaderboard",
      summary: "See who else is showing up.",
      body: (
        <>
          <Bullets items={[
            "Add friends by username — they show up on a friends-only leaderboard.",
            "Two leaderboards exist: weekly (XP earned in the last 7 days) and all-time (total XP).",
            "Inviting 3 friends who join and stay active unlocks the Mentor achievement."
          ]} />
        </>
      )
    },
    {
      icon: "📝",
      title: "Notes",
      summary: "Quick journaling, kept on your account.",
      body: (
        <>
          <Bullets items={[
            "Four kinds of notes: ✏️ personal, 💡 reflection, 🙏 gratitude, 🔤 vocabulary.",
            "Reflections are written when you finish certain quests; the rest you write on demand from My Notes in Profile.",
            "All notes are searchable and filterable by kind.",
            "Notes live only on your account — they're not shared with friends or shown on any leaderboard."
          ]} />
        </>
      )
    },
    {
      icon: "💡",
      title: "Tips",
      summary: "Small habits that pay off over months.",
      body: (
        <>
          <Bullets items={[
            "Aim for 4 quests a day — that's the streak growth line.",
            "Pick habits you genuinely want to build. Hitting the 21-day bonus is very rewarding.",
            "Stack multipliers for big XP days: high streak × Sport district × XP Boost shop item.",
            "Stockpile Streak Freeze charges — they auto-protect missed days, and Vacation plus Residential's monthly cycle add more for free on top of shop purchases.",
            "Use timer quests for deep-work sessions — they give the largest XP rewards.",
            "Going on vacation? Push Residential to level 3 — its Vacation perk drops 20 Streak Freeze charges in one go so missed days are absorbed automatically."
          ]} />
        </>
      )
    }
  ]
};

const COPY_RU = {
  title: "О приложении",
  subtitle: "Подробный гид по всем механикам",
  close: "Закрыть",
  sections: [
    {
      icon: "🎯",
      title: "Главная идея",
      summary: "Приходить каждый день, строить привычки, развивать город.",
      body: (
        <Bullets items={[
          "Каждый день вы получаете небольшой набор квестов.",
          "Закрывая квесты, вы зарабатываете опыт (для уровней) и иногда серебро (премиум-валюта).",
          "Если появляетесь каждый день — растёт стрик, который умножает опыт с каждого квеста.",
          "Серебро тратится на прокачку районов в вашем городе, а каждый район даёт постоянный игровой бонус.",
          "Всё приложение построено вокруг одной привычки: возвращаться каждый день."
        ]} />
      )
    },
    {
      icon: "📋",
      title: "Ваши ежедневные квесты",
      summary: "Сколько дают и как они меняются с уровнем.",
      body: (
        <>
          <Bullets items={[
            "На борде два типа квестов: привычки (вы их выбираете сами, они закреплены) и дневные (меняются каждый день).",
            "Чем выше уровень — тем больше квестов в день и тем сложнее становятся дневные.",
            "Перемешать сегодняшние дневные квесты можно один раз бесплатно; дополнительные реролы — по 3 серебра в магазине.",
            "Квест на 100% всегда засчитывается в стрик. У квестов с таймером есть частичные награды — см. раздел «Квесты с таймером»."
          ]} />
          <Rows rows={[
            { label: "Уровень 1–4", value: "2 привычки + 2 дневных" },
            { label: "Уровень 5–9", value: "3 привычки + 3 дневных" },
            { label: "Уровень 10–19", value: "3 привычки + 3 дневных (сложнее)" },
            { label: "Уровень 20+", value: "4 привычки + 4 дневных" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Самые сложные квесты (уровень сложности 5) появляются, когда стрик достигает 14 дней.
          </p>
        </>
      )
    },
    {
      icon: "🔥",
      title: "Стрик — ваша цепочка дней",
      summary: "Ядро игры. Каждый лишний день делает все квесты ценнее.",
      body: (
        <>
          <Bullets items={[
            "Закрыли 4+ квестов за день → стрик +1.",
            "Ровно 3 → стрик сохраняется без изменений.",
            "2 и меньше → стрик сбрасывается в 0.",
            "Стрик постоянно умножает опыт с каждого квеста, пока он держится.",
            "Стрик 14+ дней открывает самые сложные квесты.",
            "Заряды Streak Freeze списываются автоматически при пропуске дня — никаких действий вручную не нужно. См. разделы «Магазин» и «Профиль»."
          ]} />
          <Rows rows={[
            { label: "Стрик 0–2", value: "обычный XP" },
            { label: "Стрик 3–6", value: "+5% XP" },
            { label: "Стрик 7–13", value: "+10% XP" },
            { label: "Стрик 14–20", value: "+15% XP" },
            { label: "Стрик 21–29", value: "+20% XP" },
            { label: "Стрик 30–49", value: "+30% XP" },
            { label: "Стрик 50+", value: "+50% XP" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Множитель стрика складывается с бонусами от районов и с товаром «Буст опыта» из магазина.
          </p>
        </>
      )
    },
    {
      icon: "⏱",
      title: "Квесты с таймером",
      summary: "Некоторые квесты засекают время.",
      body: (
        <>
          <Bullets items={[
            "Квесты типа чтения, растяжки или фокус-сессии используют таймер.",
            "Нажали Start — приложение ведёт сессию на сервере.",
            "Можно ставить на паузу и возвращаться, время не убежит.",
            "При 100% квест завершается автоматически и выдаёт поздравление.",
            "Бросили раньше? Если дошли хотя бы до половины — всё равно получите часть XP."
          ]} />
          <Rows rows={[
            { label: "Меньше 50%", value: "Ничего, квест остаётся" },
            { label: "50–74%", value: "Половина XP" },
            { label: "75–99%", value: "3/4 XP" },
            { label: "100%", value: "Полный XP + зачёт в стрик" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            В стрик засчитываются только квесты на 100%. Частичные всё равно идут на дейли борд.
          </p>
        </>
      )
    },
    {
      icon: "🏅",
      title: "Награды за дейли борд",
      summary: "Бонусный XP и серебро за прогресс по борду.",
      body: (
        <>
          <Bullets items={[
            "На борде три вехи под количество ваших дневных квестов.",
            "За каждую веху — бонусный XP, за последнюю — плюс серебро.",
            "Борд обнуляется каждый день в полночь UTC."
          ]} />
          <Rows rows={[
            { label: "Первая веха", value: "+20 XP" },
            { label: "Вторая веха", value: "+25 XP" },
            { label: "Заполнили весь борд", value: "+25 XP и +1 серебро" }
          ]} />
        </>
      )
    },
    {
      icon: "📌",
      title: "Привычки",
      summary: "Квесты, которые вы оставляете за собой каждый день.",
      body: (
        <Bullets items={[
          "Привычки — это закреплённые квесты, которые вы выбрали сами. Они не меняются каждый день.",
          "За любую привычку вы получаете 30 XP независимо от её базовой награды.",
          "Закрыли одну привычку 21 день подряд → +20 серебра бонусом.",
          "Хочется поменять? Кнопка «Заменить привычки» — раз в 21 день бесплатно, иначе 7 серебра.",
          "Можете создать свои собственные привычки, до 20 штук."
        ]} />
      )
    },
    {
      icon: "🏙",
      title: "Ваш город",
      summary: "Зачем город? Каждый район — это постоянный игровой бонус.",
      body: (
        <>
          <Bullets items={[
            "Город — это слой долгосрочного прогресса. Копите серебро, прокачивайте районы, и каждый район открывает постоянный бонус, меняющий саму игру.",
            "А ещё город делает ежедневную работу видимой: он буквально растёт, пока вы не сдаётесь — это визуальный след вашей дисциплины.",
            "Районы прокачиваются до 5 уровня. Стоимость растёт (5 → 15 → 25 → 50 → 100 серебра), а верхние уровни требуют минимального стрика и уровня аккаунта.",
            "Районы независимы — можно сконцентрироваться на одном или равномерно прокачивать все пять."
          ]} />
          <Rows rows={[
            { label: "🏃 Спорт", value: "+5% XP за уровень (до +25%)" },
            { label: "💼 Бизнес", value: "Забираете пачку серебра раз в день" },
            { label: "🌳 Парк", value: "Открывает Колесо удачи (с lvl 1); на старших уровнях сокращает кулдаун" },
            { label: "🏛 Площадь", value: "Больше серебра за полный дейли борд" },
            { label: "🏘 Жилой", value: "Скидка в магазине (с lvl 1), Freeze в месяц (с lvl 2), Отпуск (с lvl 3)" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Жилой район с 3 уровня открывает «Отпуск» — разовый набор из 20 зарядов Streak Freeze (кулдаун раз в год), которые автоматически закрывают пропущенные дни.
          </p>
        </>
      )
    },
    {
      icon: "🎰",
      title: "Колесо удачи",
      summary: "Бесплатный спин на XP, серебро или уровень.",
      body: (
        <>
          <Bullets items={[
            "Колесо живёт внутри района Парк на экране «Город». Награды — опыт, серебро или бесплатный уровень.",
            "Заблокировано пока Парк не прокачен до 1 уровня — на Парке 0 спин недоступен.",
            "С 1 уровня Парка начинает работать кулдаун между спинами; чем выше Парк, тем короче кулдаун."
          ]} />
          <Rows rows={[
            { label: "Парк 0 (не построен)", value: "🔒 Заблокировано" },
            { label: "Парк 1", value: "24 часа" },
            { label: "Парк 2", value: "20 часов" },
            { label: "Парк 3", value: "16 часов" },
            { label: "Парк 4", value: "12 часов" },
            { label: "Парк 5", value: "8 часов" }
          ]} />
        </>
      )
    },
    {
      icon: "🪙",
      title: "Серебро — откуда брать",
      summary: "Всё, что можно тратить в магазине и на городе.",
      body: (
        <>
          <Bullets items={[
            "Новый уровень — шкала серебра за уровень: 1 (ур. 2–10), 2 (11–20), 3 (21–30), 4 (31–50), 5 (51+).",
            "Дейли борд — 3 серебра за заполнение всех 4 вех.",
            "Веха привычки — +20 серебра бонусом за закрытие одной привычки 21 день подряд.",
            "Район Бизнес — раз в день забираете пачку серебра (1–5 в зависимости от уровня района).",
            "Район Площадь — с 1 уровня за полный дейли борд начисляются дополнительные серебро, равные уровню района.",
            "Колесо удачи — серебро это одна из возможных наград за спин.",
            "Жилой район — вместо серебра выдаёт бесплатные заряды заморозки стрика: 1 в месяц с 2 уровня, 2 в месяц с 4 уровня."
          ]} />
        </>
      )
    },
    {
      icon: "🛒",
      title: "Магазин",
      summary: "Что можно купить за серебро.",
      body: (
        <Bullets items={[
          "Заморозка стрика — 7 серебра. Добавляет 1 заряд в инвентарь (виден в профиле). Заряды списываются автоматически при пропуске дня — без ручной активации. Лимит: 1 покупка в неделю.",
          "Доп. перемешивание — 3 серебра. Ещё раз перетасовывает сегодняшние дневные квесты после бесплатного рерола. Можно покупать несколько раз.",
          "Буст опыта — 15 серебра. Даёт +15% XP за каждый выполненный квест в течение 7 дней. Покупка во время действия продлевает таймер.",
          "Замена привычек — 7 серебра. Открывает выбор новых привычек. Раз в 21 день такая замена бесплатна.",
          "Сброс города — обнуляет все районы до 0 уровня и возвращает серебро, потраченные на их прокачку. Цена растёт с каждым сбросом: 10 → 20 → 30 → 40 → 50, и далее остаётся 50 серебра. Первый платный сброс открывает достижение «Феникс».",
          "Жилой район даёт скидку на все товары магазина (−1 серебро с 1 уровня, −2 сереброа с 5 уровня)."
        ]} />
      )
    },
    {
      icon: "🏆",
      title: "Достижения",
      summary: "Трофеи за долгую игру.",
      body: (
        <>
          <Bullets items={[
            "Достижения открываются автоматически по мере игры. Загляните в профиль, чтобы посмотреть, что уже собрано и когда.",
            "Покрывают три темы: ежедневная дисциплина (длина стрика), траты серебра и социальные действия (челленджи, приглашения, язык).",
            "За них не дают XP — каждое достижение это одноразовый трофей и предмет гордости."
          ]} />
          <Rows rows={[
            { label: "🔥 Воин недели", value: "Стрик 7 дней" },
            { label: "🏔 Монах месяца", value: "Стрик 30 дней" },
            { label: "💯 Клуб сотни", value: "Стрик 100 дней" },
            { label: "🪙 Первая монета", value: "Потратить первый серебро" },
            { label: "💰 Богач", value: "Потратить 200+ серебра" },
            { label: "🌐 Полиглот", value: "Сменить язык приложения" },
            { label: "🤝 Первое рукопожатие", value: "Войти в групповой челлендж" },
            { label: "🏅 Чемпион", value: "Завершить челлендж 7+ дней" },
            { label: "👥 Наставник", value: "3 приглашённых друга остались" },
            { label: "🐦 Феникс", value: "Сбросить город в первый раз" }
          ]} />
        </>
      )
    },
    {
      icon: "🤝",
      title: "Групповые челленджи",
      summary: "Многодневная миссия вместе с друзьями.",
      body: (
        <>
          <Bullets items={[
            "Создавайте челлендж сами или принимайте чужой («30 дней медитации» и т.д.). Все идут к одной цели в одном окне.",
            "Одновременно можно быть в 3 активных челленджах. Новый создаётся не чаще раза в день.",
            "Каждый день участники отмечают прогресс — внутри челленджа видно лидерборд, кто держит ритм.",
            "За завершение челленджа длиной 7+ дней дают достижение «Чемпион».",
            "Первое присоединение к любому челленджу открывает «Первое рукопожатие»."
          ]} />
        </>
      )
    },
    {
      icon: "👥",
      title: "Друзья и лидерборд",
      summary: "Посмотреть, кто ещё держит ритм.",
      body: (
        <>
          <Bullets items={[
            "Добавляйте друзей по имени пользователя — они появятся в личном лидерборде.",
            "Лидербордов два: недельный (XP за последние 7 дней) и общий (всего XP).",
            "Достижение «Наставник» даётся за 3 приглашённых друзей, которые остались играть."
          ]} />
        </>
      )
    },
    {
      icon: "📝",
      title: "Заметки",
      summary: "Короткие записи, привязанные к аккаунту.",
      body: (
        <>
          <Bullets items={[
            "Четыре типа: ✏️ личные, 💡 рефлексии, 🙏 благодарности, 🔤 слова.",
            "Рефлексии пишутся при закрытии некоторых квестов, остальное — вручную из «Мои заметки» в профиле.",
            "Заметки можно искать и фильтровать по типу.",
            "Хранятся только на вашем аккаунте — не отображаются у друзей и не идут в лидерборды."
          ]} />
        </>
      )
    },
    {
      icon: "💡",
      title: "Советы",
      summary: "Маленькие привычки, которые окупаются за месяцы.",
      body: (
        <Bullets items={[
          "Целитесь в 4 квеста в день — это порог роста стрика.",
          "Выбирайте привычки, которые действительно хочется развивать. 21 день — сильный результат и серебро-бонус.",
          "Складывайте множители для больших XP-дней: высокий стрик × район Спорт × Буст опыта из магазина.",
          "Копите заряды заморозки стрика — они автоматически закрывают пропуски, а «Отпуск» Жилого района и его ежемесячный цикл начисляют их бесплатно поверх покупок в магазине.",
          "Квесты с таймером — лучший способ наростить XP на глубокой работе.",
          "Собираетесь в отпуск? Доведите Жилой район до 3 уровня — его «Отпуск» сразу выдаёт 20 зарядов заморозки стрика, и пропущенные дни закрываются автоматически."
        ]} />
      )
    }
  ]
};
