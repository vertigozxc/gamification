import { createContext, useContext, useState, useEffect, useMemo } from "react";
import themes, { themeIds } from "./themeConfig";
import { languageIds, languagePacks, normalizeLanguageId } from "./i18nConfig";

const THEME_STORAGE_KEY = "rpg_theme";
const LANGUAGE_STORAGE_KEY = "rpg_language";
const ThemeContext = createContext(null);

function getInitialTheme() {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && themeIds.includes(stored)) return stored;
  } catch {}
  return "adventure";
}

function getInitialLanguage() {
  try {
    return normalizeLanguageId(localStorage.getItem(LANGUAGE_STORAGE_KEY));
  } catch {}
  return "en";
}

function interpolate(template, vars = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? ""));
}

export function ThemeProvider({ children }) {
  const [themeId, setThemeId] = useState(getInitialTheme);
  const [languageId, setLanguageId] = useState(getInitialLanguage);

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, themeId);
    document.body.setAttribute("data-theme", themeId);
  }, [themeId]);

  useEffect(() => {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, languageId);
    document.documentElement.setAttribute("lang", languageId);
  }, [languageId]);

  const value = useMemo(() => {
    const theme = themes[themeId] || themes.adventure;
    const language = languagePacks[languageId] || languagePacks.en;
    const localizedThemeMeta = language.themeMeta?.[themeId] || {};
    const mergedVocab = {
      ...theme.vocab,
      ...(language.ui || {}),
      ...(language.themeVocab?.[themeId] || {})
    };

    const translateQuest = (quest, field, fallback = "") => {
      const sourceId = String(quest?.sourceId || quest?.id || "");
      const translation = language.quests?.[sourceId];
      if (field === "title") return translation?.title || fallback;
      if (field === "description") return translation?.description || fallback;
      return fallback;
    };

    const translateCategory = (category) => {
      const normalized = String(category || "UNCATEGORIZED").trim().toUpperCase() || "UNCATEGORIZED";
      return language.categoryLabels?.[normalized] || category;
    };

    return {
      themeId,
      setThemeId: (id) => { if (themeIds.includes(id)) setThemeId(id); },
      languageId,
      setLanguageId: (id) => setLanguageId(normalizeLanguageId(id)),
      languageIds,
      languages: languagePacks,
      theme,
      t: mergedVocab,
      tf: (key, vars = {}, fallback = "") => interpolate(mergedVocab[key] ?? fallback, vars),
      formatText: interpolate,
      translateQuest,
      translateCategory,
      getThemeMeta: (id) => {
        const nextTheme = themes[id] || themes.adventure;
        const nextMeta = language.themeMeta?.[id] || {};
        return {
          ...nextTheme,
          label: nextMeta.label || nextTheme.label,
          description: nextMeta.description || nextTheme.description
        };
      },
      getLanguageMeta: (id) => languagePacks[id] || languagePacks.en,
      localizedThemeMeta: {
        label: localizedThemeMeta.label || theme.label,
        description: localizedThemeMeta.description || theme.description
      }
    };
  }, [themeId, languageId]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
