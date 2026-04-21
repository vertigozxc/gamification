import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";

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
            padding: "8px 16px 28px"
          }}
        >
          {/* Title bar scrolls with content so it never blocks the body */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0 14px" }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 12,
                background: "linear-gradient(135deg, rgba(var(--color-primary-rgb,251,191,36),0.22), rgba(0,0,0,0.2))",
                border: "1px solid var(--color-primary-dim, var(--panel-border))",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, flexShrink: 0
              }}
            >
              📖
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 className="cinzel" style={{ color: "var(--color-primary)", fontSize: 18, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
                {copy.title}
              </h2>
              <p style={{ fontSize: 11.5, color: "#94a3b8", margin: "3px 0 0", letterSpacing: "0.04em" }}>
                {copy.subtitle}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label={copy.close}
              style={{
                width: 40, height: 40, borderRadius: 999,
                background: isLight ? "rgba(15,23,42,0.85)" : "rgba(255,255,255,0.08)",
                border: `1px solid ${isLight ? "rgba(15,23,42,0.75)" : "var(--card-border-idle, var(--panel-border))"}`,
                color: isLight ? "#f8fafc" : "#e2e8f0",
                cursor: "pointer",
                fontSize: 20,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                boxShadow: isLight ? "0 2px 8px rgba(15,23,42,0.25)" : "none"
              }}
            >
              ✕
            </button>
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
            background: "rgba(0,0,0,0.22)",
            border: "1px solid var(--panel-border)"
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
  subtitle: "Simple guide to how it works",
  close: "Close",
  sections: [
    {
      icon: "🎯",
      title: "The main idea",
      summary: "One sentence: show up every day and build habits.",
      body: (
        <>
          <Bullets items={[
            "Every day you get a small set of quests to do.",
            "Complete them → earn XP → level up.",
            "Keep going every day → grow your streak.",
            "Your streak makes every quest reward bigger."
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
            "You always have two kinds of quests: your habits (you pick them) and daily quests (they shuffle every day).",
            "The higher your level, the more quests you unlock each day.",
            "At higher levels you also get access to harder quests."
          ]} />
          <Rows rows={[
            { label: "Level 1–4", value: "2 habits + 2 daily" },
            { label: "Level 5–9", value: "3 habits + 3 daily" },
            { label: "Level 10–19", value: "3 habits + 3 daily (harder)" },
            { label: "Level 20+", value: "4 habits + 4 daily" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            The toughest quests (difficulty 5) only show up once your streak is at least 14 days.
          </p>
        </>
      )
    },
    {
      icon: "🔥",
      title: "Streak — your daily chain",
      summary: "Finish enough quests every day to keep it alive.",
      body: (
        <>
          <Bullets items={[
            "Finish 4 or more quests today → streak goes up by 1.",
            "Finish exactly 3 → streak stays the same.",
            "Finish 2 or fewer → streak resets to 0.",
            "The longer your streak, the more XP every quest gives you.",
            "Running a streak of 14+ days unlocks the hardest quests.",
            "Used a Streak Freeze? You're protected for one skipped day."
          ]} />
          <Rows rows={[
            { label: "0–2 day streak", value: "normal XP" },
            { label: "3–6 day streak", value: "+5% XP" },
            { label: "7–13 day streak", value: "+10% XP" },
            { label: "14–20 day streak", value: "+15% XP" },
            { label: "21–29 day streak", value: "+20% XP" },
            { label: "30+ day streak", value: "+30% XP" }
          ]} />
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
      summary: "Bonus XP and tokens when you fill enough slots.",
      body: (
        <>
          <Bullets items={[
            "The board shows three milestones matching your daily quest count.",
            "Hitting each milestone gives extra XP and, at the top one, a token.",
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
            "Complete the same habit 21 days in a row → earn a +10 token bonus.",
            "Want to swap a habit? Use the Replace Habits button — free once every 21 days, otherwise 7 tokens.",
            "You can also create your own custom habits, up to 20 total."
          ]} />
        </>
      )
    },
    {
      icon: "🏙",
      title: "Your city",
      summary: "Spend tokens on districts, they give you permanent perks.",
      body: (
        <>
          <Bullets items={[
            "Sport — every level boosts the XP you earn from all quests.",
            "Square — when you fill the daily board, you get extra tokens.",
            "Residential — discounts on shop items, plus a monthly Streak Freeze and vacation mode.",
            "Business — collect a small pile of tokens once a day.",
            "Education — shortens the cooldown before you can reroll again."
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Districts upgrade independently, so pick the perks that fit how you play.
          </p>
        </>
      )
    },
    {
      icon: "🛒",
      title: "Shop",
      summary: "What your tokens buy you.",
      body: (
        <>
          <Bullets items={[
            "Streak Freeze — costs 7 tokens, keeps your streak alive for one missed day. One per week.",
            "Extra Daily Reroll — costs 3 tokens, shuffles today's random quests again.",
            "Replace Habits — free once every 21 days, otherwise 7 tokens.",
            "The Residential district gives a discount on every shop item."
          ]} />
        </>
      )
    },
    {
      icon: "💡",
      title: "Tips",
      summary: "Small things that make a big difference.",
      body: (
        <>
          <Bullets items={[
            "Aim for 4 quests a day — that's the sweet spot for streak growth.",
            "Pick habits you genuinely want to build. Hitting 21 days in a row is very rewarding.",
            "Going on vacation? Unlock the Residential district early for the vacation mode that pauses your streak.",
            "Use timer quests for deep-work sessions — they are the best way to stack XP."
          ]} />
        </>
      )
    }
  ]
};

const COPY_RU = {
  title: "О приложении",
  subtitle: "Простой гид по тому, как это работает",
  close: "Закрыть",
  sections: [
    {
      icon: "🎯",
      title: "Главная идея",
      summary: "Одним предложением: каждый день появляться и строить привычки.",
      body: (
        <Bullets items={[
          "Каждый день вам выдаётся небольшой набор квестов.",
          "Выполняете их → получаете XP → растёте в уровне.",
          "Приходите каждый день → растёт стрик.",
          "Чем выше стрик, тем больше награда за каждый квест."
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
            "У вас всегда два типа квестов: привычки (вы их выбираете сами) и дневные (меняются каждый день).",
            "Чем выше уровень — тем больше квестов в день.",
            "На высоких уровнях открываются более сложные квесты."
          ]} />
          <Rows rows={[
            { label: "Уровень 1–4", value: "2 привычки + 2 дневных" },
            { label: "Уровень 5–9", value: "3 привычки + 3 дневных" },
            { label: "Уровень 10–19", value: "3 привычки + 3 дневных (сложнее)" },
            { label: "Уровень 20+", value: "4 привычки + 4 дневных" }
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Самые сложные квесты (уровень сложности 5) появляются только если стрик 14+ дней.
          </p>
        </>
      )
    },
    {
      icon: "🔥",
      title: "Стрик — ваша цепочка дней",
      summary: "Выполняйте достаточно квестов, чтобы не прерывалась.",
      body: (
        <>
          <Bullets items={[
            "Закрыли 4+ квестов за день → стрик +1.",
            "Ровно 3 → стрик сохраняется.",
            "2 и меньше → стрик сбрасывается в 0.",
            "Чем дольше стрик, тем больше XP за каждый квест.",
            "Стрик 14+ дней открывает самые сложные квесты.",
            "Купили Streak Freeze? Он защитит стрик на один пропущенный день."
          ]} />
          <Rows rows={[
            { label: "Стрик 0–2", value: "обычный XP" },
            { label: "Стрик 3–6", value: "+5% XP" },
            { label: "Стрик 7–13", value: "+10% XP" },
            { label: "Стрик 14–20", value: "+15% XP" },
            { label: "Стрик 21–29", value: "+20% XP" },
            { label: "Стрик 30+", value: "+30% XP" }
          ]} />
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
      summary: "Бонусный XP и токены за прогресс по борду.",
      body: (
        <>
          <Bullets items={[
            "На борде три вехи под количество ваших дневных квестов.",
            "За каждую веху — бонусный XP, за последнюю — плюс токен.",
            "Борд обнуляется каждый день в полночь UTC."
          ]} />
          <Rows rows={[
            { label: "Первая веха", value: "+20 XP" },
            { label: "Вторая веха", value: "+25 XP" },
            { label: "Заполнили весь борд", value: "+25 XP и +1 токен" }
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
          "Закрыли одну привычку 21 день подряд → +10 токенов бонусом.",
          "Хочется поменять? Кнопка «Заменить привычки» — раз в 21 день бесплатно, иначе 7 токенов.",
          "Можете создать свои собственные привычки, до 20 штук."
        ]} />
      )
    },
    {
      icon: "🏙",
      title: "Ваш город",
      summary: "Районы дают постоянные бонусы за токены.",
      body: (
        <>
          <Bullets items={[
            "Спорт — каждый уровень увеличивает XP со всех квестов.",
            "Площадь — за полный дейли борд получаете дополнительные токены.",
            "Жилой — скидки в магазине, ежемесячный Streak Freeze и режим отпуска.",
            "Бизнес — раз в день забираете небольшую пачку токенов.",
            "Образование — сокращает время до следующего рерола."
          ]} />
          <p style={{ fontSize: 12, color: "var(--color-muted)", marginTop: 10, fontStyle: "italic", lineHeight: 1.5 }}>
            Районы прокачиваются отдельно — выбирайте то, что подходит именно вам.
          </p>
        </>
      )
    },
    {
      icon: "🛒",
      title: "Магазин",
      summary: "Что можно купить за токены.",
      body: (
        <Bullets items={[
          "Streak Freeze — 7 токенов, спасёт стрик от одного пропущенного дня. Один раз в неделю.",
          "Extra Daily Reroll — 3 токена, перетасовывает сегодняшние дневные квесты.",
          "Замена привычек — раз в 21 день бесплатно, иначе 7 токенов.",
          "Жилой район даёт скидку на всё в магазине."
        ]} />
      )
    },
    {
      icon: "💡",
      title: "Советы",
      summary: "Маленькие штуки, которые дают большой эффект.",
      body: (
        <Bullets items={[
          "Целитесь в 4 квеста в день — это оптимум для роста стрика.",
          "Выбирайте привычки, которые действительно хочется развивать. 21 день — это сильный результат.",
          "Собрались в отпуск? Прокачайте Жилой район пораньше — там есть режим отпуска, который ставит стрик на паузу.",
          "Квесты с таймером — лучший способ нарастить XP за глубокую работу."
        ]} />
      )
    }
  ]
};
