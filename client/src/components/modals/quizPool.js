// Knowledge Quiz pool — 24 questions covering the mechanics described
// in About the App. Each question has EN + RU text plus 4 options; the
// `correct` index is the position of the right answer in the `options`
// arrays (same index for both languages — keep them aligned).
//
// On every quiz launch we shuffle the pool and pull a random 10, then
// shuffle each question's options so the correct answer's letter
// (A/B/C/D) is randomized. Pass = 10/10. The pool is intentionally
// inline (not server-backed) — quiz scoring is client-only and the
// reward grant is gated by an idempotent server endpoint that just
// checks "achievement already unlocked?" before paying out.

const QUIZ_POOL = [
  {
    id: "streak-threshold",
    en: "How many quests must you complete at 100% in a single day to grow your streak by +1?",
    ru: "Сколько квестов нужно закрыть на 100% за день, чтобы стрик вырос на +1?",
    optionsEn: ["2", "3", "4", "5"],
    optionsRu: ["2", "3", "4", "5"],
    correct: 2
  },
  {
    id: "habit-flat-xp",
    en: "How much XP does any pinned habit award, regardless of its base reward?",
    ru: "Сколько XP даёт любая закреплённая привычка независимо от её базовой награды?",
    optionsEn: ["10 XP", "20 XP", "30 XP", "50 XP"],
    optionsRu: ["10 XP", "20 XP", "30 XP", "50 XP"],
    correct: 2
  },
  {
    id: "habit-21-day-bonus",
    en: "What's the bonus for completing the same habit 21 days in a row?",
    ru: "Бонус за закрытие одной привычки 21 день подряд:",
    optionsEn: ["+10 tokens", "+20 tokens", "+30 tokens", "+1 free reroll"],
    optionsRu: ["+10 токенов", "+20 токенов", "+30 токенов", "+1 бесплатный реролл"],
    correct: 1
  },
  {
    id: "freeze-price",
    en: "How much does a Streak Freeze cost in the Shop?",
    ru: "Цена Streak Freeze в магазине:",
    optionsEn: ["3 tokens", "5 tokens", "7 tokens", "10 tokens"],
    optionsRu: ["3 токена", "5 токенов", "7 токенов", "10 токенов"],
    correct: 2
  },
  {
    id: "streak-multiplier-50",
    en: "What XP multiplier do you get at streak 50+?",
    ru: "Какой множитель XP при стрике 50+ дней?",
    optionsEn: ["+20%", "+30%", "+40%", "+50%"],
    optionsRu: ["+20%", "+30%", "+40%", "+50%"],
    correct: 3
  },
  {
    id: "sport-max-bonus",
    en: "Maximum XP bonus from the Sport district at level 5:",
    ru: "Максимальный бонус XP от района Спорт (уровень 5):",
    optionsEn: ["+15% XP", "+20% XP", "+25% XP", "+50% XP"],
    optionsRu: ["+15% XP", "+20% XP", "+25% XP", "+50% XP"],
    correct: 2
  },
  {
    id: "vacation-unlock",
    en: "At which Residential level does the Vacation perk unlock?",
    ru: "На каком уровне Жилого района открывается «Отпуск»?",
    optionsEn: ["Level 1", "Level 2", "Level 3", "Level 4"],
    optionsRu: ["Уровень 1", "Уровень 2", "Уровень 3", "Уровень 4"],
    correct: 2
  },
  {
    id: "wheel-cd-park0",
    en: "How long is the Wheel of Fortune cooldown without the Park district (level 0)?",
    ru: "Сколько длится кулдаун Колеса удачи без района Парк (уровень 0)?",
    optionsEn: ["12 hours", "24 hours", "48 hours", "72 hours"],
    optionsRu: ["12 часов", "24 часа", "48 часов", "72 часа"],
    correct: 2
  },
  {
    id: "active-challenges-cap",
    en: "How many group challenges can you have active at the same time?",
    ru: "Сколько групповых челленджей одновременно можно держать активными?",
    optionsEn: ["1", "2", "3", "5"],
    optionsRu: ["1", "2", "3", "5"],
    correct: 2
  },
  {
    id: "xp-boost-shop",
    en: "What does the XP Boost shop item give?",
    ru: "Что даёт товар «XP Boost» в магазине?",
    optionsEn: [
      "+10% XP for 3 days",
      "+15% XP for 7 days",
      "+20% XP for 5 days",
      "+25% XP for 7 days"
    ],
    optionsRu: [
      "+10% XP на 3 дня",
      "+15% XP на 7 дней",
      "+20% XP на 5 дней",
      "+25% XP на 7 дней"
    ],
    correct: 1
  },
  {
    id: "quests-lvl-1-4",
    en: "What's the daily quest mix at levels 1–4?",
    ru: "Сколько квестов в день у игрока на уровне 1–4?",
    optionsEn: [
      "2 habits + 2 daily",
      "3 habits + 3 daily",
      "3 habits + 4 daily",
      "4 habits + 4 daily"
    ],
    optionsRu: [
      "2 привычки + 2 дневных",
      "3 привычки + 3 дневных",
      "3 привычки + 4 дневных",
      "4 привычки + 4 дневных"
    ],
    correct: 0
  },
  {
    id: "freeze-auto-consume",
    en: "What happens when you have a Streak Freeze charge and miss a day?",
    ru: "Что происходит, если у тебя есть заряд Streak Freeze и ты пропустил день?",
    optionsEn: [
      "The streak still burns",
      "You must manually activate the charge",
      "The charge is auto-consumed — your streak survives",
      "The charge carries over to next cycle"
    ],
    optionsRu: [
      "Стрик всё равно сгорает",
      "Нужно вручную активировать заряд",
      "Заряд списывается автоматически — стрик переживает пропуск",
      "Заряд начинает копиться на следующий цикл"
    ],
    correct: 2
  },
  {
    id: "effort-5-streak",
    en: "At what streak length do the hardest (effort 5) quests start appearing?",
    ru: "При каком стрике начинают появляться квесты максимальной сложности (effort 5)?",
    optionsEn: ["7 days", "14 days", "21 days", "30 days"],
    optionsRu: ["7 дней", "14 дней", "21 день", "30 дней"],
    correct: 1
  },
  {
    id: "timer-half",
    en: "If you finish a timed quest at 60% (between 50% and 74%), how much XP do you get?",
    ru: "Завершил квест с таймером на 60% (50–74%) — сколько XP получишь?",
    optionsEn: ["None", "Half", "Three quarters", "Full XP"],
    optionsRu: ["Ничего", "Половину", "Три четверти", "Полный XP"],
    correct: 1
  },
  {
    id: "freeze-weekly",
    en: "How often can you buy a Streak Freeze in the Shop?",
    ru: "Сколько раз в неделю можно купить Streak Freeze в магазине?",
    optionsEn: ["Unlimited", "Once a week", "Once a day", "Once a month"],
    optionsRu: ["Без ограничений", "1 раз в неделю", "1 раз в день", "1 раз в месяц"],
    correct: 1
  },
  {
    id: "park-max-cd",
    en: "Wheel of Fortune cooldown at maximum Park level (5):",
    ru: "Кулдаун Колеса удачи при максимальном уровне Парка (5):",
    optionsEn: ["4 hours", "6 hours", "8 hours", "12 hours"],
    optionsRu: ["4 часа", "6 часов", "8 часов", "12 часов"],
    correct: 2
  },
  {
    id: "business-lvl5",
    en: "How many tokens per day does the Business district give at level 5?",
    ru: "Сколько токенов в день даёт Бизнес-район на уровне 5?",
    optionsEn: ["1", "3", "5", "10"],
    optionsRu: ["1", "3", "5", "10"],
    correct: 2
  },
  {
    id: "residential-monthly-45",
    en: "How many free Streak Freeze charges per month does Residential level 4–5 grant?",
    ru: "Сколько зарядов Streak Freeze в месяц даёт Жилой район на уровне 4–5?",
    optionsEn: ["None", "1 per month", "2 per month", "5 per month"],
    optionsRu: ["Ничего не даёт", "1 в месяц", "2 в месяц", "5 в месяц"],
    correct: 2
  },
  {
    id: "vacation-cooldown",
    en: "How often can you collect the Vacation bundle (20 charges at once)?",
    ru: "Как часто можно получить «Отпуск» (20 зарядов разом)?",
    optionsEn: [
      "Every 30 days",
      "Every 90 days",
      "Every 180 days",
      "Once a year (365 days)"
    ],
    optionsRu: [
      "Каждые 30 дней",
      "Каждые 90 дней",
      "Каждые 180 дней",
      "1 раз в год (365 дней)"
    ],
    correct: 3
  },
  {
    id: "pinned-reroll-free",
    en: "Replacing your pinned habits is free:",
    ru: "Замена закреплённых привычек (Pinned Reroll) бесплатна:",
    optionsEn: ["Every day", "Once a week", "Every 14 days", "Every 21 days"],
    optionsRu: ["Каждый день", "Раз в неделю", "Раз в 14 дней", "Раз в 21 день"],
    correct: 3
  },
  {
    id: "city-reset-cap",
    en: "Maximum cost of a city reset (from the 5th reset onwards):",
    ru: "Цена сброса города начиная с 5-го раза:",
    optionsEn: [
      "100 tokens",
      "Keeps growing by +10 each time",
      "50 tokens (capped)",
      "200 tokens"
    ],
    optionsRu: [
      "100 токенов",
      "Продолжает расти на +10 каждый раз",
      "50 токенов (кап)",
      "200 токенов"
    ],
    correct: 2
  },
  {
    id: "phoenix-trigger",
    en: "Which action unlocks the Phoenix achievement?",
    ru: "За какое действие даётся достижение «Phoenix / Феникс»?",
    optionsEn: [
      "Reach a 100-day streak",
      "Spend 200+ tokens",
      "Pay to reset your city for the first time",
      "Finish 10 group challenges"
    ],
    optionsRu: [
      "Достичь стрика 100 дней",
      "Потратить 200+ токенов",
      "Платно сбросить город в первый раз",
      "Завершить 10 групповых челленджей"
    ],
    correct: 2
  },
  {
    id: "group-day-reward",
    en: "What reward does a group challenge give on a day when every member completes their daily?",
    ru: "Какую награду даёт групповой челлендж в день, когда все участники закрыли свой квест?",
    optionsEn: [
      "+5 XP each",
      "+1 token to every participant",
      "+10 XP and +1 token",
      "Nothing — only the final reward at the end"
    ],
    optionsRu: [
      "+5 XP каждому",
      "+1 токен каждому участнику",
      "+10 XP и +1 токен",
      "Ничего, только финальная награда в конце"
    ],
    correct: 1
  },
  {
    id: "mentor-trigger",
    en: "What's required to unlock the Mentor achievement?",
    ru: "Что нужно для достижения «Mentor / Наставник»?",
    optionsEn: [
      "Complete 100 quests",
      "Reach a 30-day streak",
      "Invite 3 friends who stay active",
      "Create 3 group challenges"
    ],
    optionsRu: [
      "Закрыть 100 квестов",
      "Достичь стрика 30 дней",
      "Пригласить 3 друзей, которые остались играть",
      "Создать 3 группы челленджей"
    ],
    correct: 2
  }
];

export default QUIZ_POOL;

// In-place Fisher-Yates shuffle, returns a NEW array (doesn't mutate input).
export function shuffled(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Pick a random 10 from the pool, shuffle each question's options, and
// remap `correct` to the new index. The returned shape is what the
// QuizModal renders directly — pre-localized labels are stitched at
// render time based on languageId.
export function buildQuiz(languageId) {
  const lang = languageId === "ru" ? "ru" : "en";
  const picked = shuffled(QUIZ_POOL).slice(0, 10);
  return picked.map((q) => {
    const labels = lang === "ru" ? q.optionsRu : q.optionsEn;
    // Build [{label, isCorrect}] pairs, shuffle them, then read the
    // resulting `correct` index from the new positions.
    const pairs = labels.map((label, idx) => ({ label, isCorrect: idx === q.correct }));
    const shuffledPairs = shuffled(pairs);
    const correctIdx = shuffledPairs.findIndex((p) => p.isCorrect);
    return {
      id: q.id,
      text: lang === "ru" ? q.ru : q.en,
      options: shuffledPairs.map((p) => p.label),
      correct: correctIdx
    };
  });
}
