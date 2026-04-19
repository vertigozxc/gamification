const MESSAGES = {
  en: {
    initializing: "Initializing app...",
    webLoadFailed: "Failed to load web app",
    connectionIssue: "Connection issue",
    retryLabel: "Retry",
    webUrlPrefix: "Web URL",
    startupError: "Startup error",
    usernameRequired: "Username required",
    usernameRequiredMsg: "Enter your username to load your game state.",
    profileSyncFailed: "Profile sync failed",
    refreshFailed: "Refresh failed",
    successTitle: "Success!",
    completeFailed: "Complete failed",
    enterUsernamePlaceholder: "Enter username",
    loadingShort: "Loading...",
    loadProfile: "Load Profile",
    appTitle: "GoHabit Mobile",
    appSubtitle: "Start tracking your habits",
    questsTitle: "Quests",
    levelLabel: "Level",
    streakLabel: "Streak",
    tokensLabel: "Tokens",
    xpProgressLabel: "XP Progress",
    questsRemaining: "{remaining}/{total} quests remaining",
    profileLoadError: "Profile load error",
    noProfileData: "No profile data",
    profileTitle: "Profile",
    experienceProgress: "Experience Progress",
    logoutLabel: "Logout",
    completedLabel: "Completed",
    completeLabel: "Complete",
    loadError: "Load error",
    notEnoughTokens: "Not enough tokens",
    needThreeTokensFreeze: "You need 3 tokens to freeze your streak.",
    successPlain: "Success",
    streakFrozenSuccess: "Your streak has been frozen!",
    genericError: "Error",
    needOneTokenReroll: "You need 1 token for extra reroll.",
    freeRerollAvailable: "Free reroll available",
    useFreeRerollFirst: "Use your free daily reroll first!",
    extraRerollPurchased: "Extra reroll purchased!",
    noVaultData: "No vault data available",
    tokenVaultTitle: "Token Vault",
    streakFreezeTitle: "Streak Freeze",
    streakFreezeDesc: "Protect your streak for one day",
    activeLabel: "Active",
    extraRerollTitle: "Extra Reroll",
    extraRerollDesc: "Get an extra random quest reroll",
    readySuffix: "ready",
    buyFor: "Buy for {cost}",
    questFallbackTitle: "Quest",
    questFallbackCategory: "Uncategorized",
    questXpGain: "+{xp} XP"
  },
  ru: {
    initializing: "Инициализация приложения...",
    webLoadFailed: "Не удалось загрузить веб-приложение",
    connectionIssue: "Проблема с подключением",
    retryLabel: "Повторить",
    webUrlPrefix: "Web URL",
    startupError: "Ошибка запуска",
    usernameRequired: "Требуется никнейм",
    usernameRequiredMsg: "Введите никнейм, чтобы загрузить ваш прогресс.",
    profileSyncFailed: "Ошибка синхронизации профиля",
    refreshFailed: "Ошибка обновления",
    successTitle: "Успешно!",
    completeFailed: "Ошибка выполнения",
    enterUsernamePlaceholder: "Введите никнейм",
    loadingShort: "Загрузка...",
    loadProfile: "Загрузить профиль",
    appTitle: "GoHabit Mobile",
    appSubtitle: "Отслеживайте свои привычки",
    questsTitle: "Quests",
    levelLabel: "Level",
    streakLabel: "streak",
    tokensLabel: "Токены",
    xpProgressLabel: "Прогресс XP",
    questsRemaining: "Осталось заданий: {remaining}/{total}",
    profileLoadError: "Ошибка загрузки профиля",
    noProfileData: "Нет данных профиля",
    profileTitle: "Профиль",
    experienceProgress: "Прогресс опыта",
    logoutLabel: "Выйти",
    completedLabel: "Выполнено",
    completeLabel: "Выполнить",
    loadError: "Ошибка загрузки",
    notEnoughTokens: "Недостаточно токенов",
    needThreeTokensFreeze: "Нужно 3 токена, чтобы заморозить streak.",
    successPlain: "Успешно",
    streakFrozenSuccess: "Ваш streak заморожен!",
    genericError: "Ошибка",
    needOneTokenReroll: "Нужен 1 токен для дополнительного reroll.",
    freeRerollAvailable: "Доступен бесплатный reroll",
    useFreeRerollFirst: "Сначала используйте бесплатный ежедневный reroll!",
    extraRerollPurchased: "Дополнительный reroll куплен!",
    noVaultData: "Нет данных хранилища",
    tokenVaultTitle: "Хранилище токенов",
    streakFreezeTitle: "Заморозка streak",
    streakFreezeDesc: "Защищает streak на один день",
    activeLabel: "Активно",
    extraRerollTitle: "Доп. reroll",
    extraRerollDesc: "Получите дополнительное случайное перемешивание задания",
    readySuffix: "готово",
    buyFor: "Купить за {cost}",
    questFallbackTitle: "Квест",
    questFallbackCategory: "Без категории",
    questXpGain: "+{xp} XP"
  }
};

function interpolate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

export function getMobileLanguage() {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || "en";
    return String(locale).toLowerCase().startsWith("ru") ? "ru" : "en";
  } catch {
    return "en";
  }
}

export function tm(key, vars = {}) {
  const lang = getMobileLanguage();
  const source = MESSAGES[lang] || MESSAGES.en;
  const fallback = MESSAGES.en[key] || key;
  return interpolate(source[key] ?? fallback, vars);
}
