import { useEffect, useMemo, useState } from "react";
import { fetchQuestFeedbackAnalytics } from "../api";
import { useTheme } from "../ThemeContext";

function AnalyticsPage({ onBack }) {
  const { t } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [questSort, setQuestSort] = useState("top-rated");
  const [questQuery, setQuestQuery] = useState("");
  const [minReviews, setMinReviews] = useState(0);
  const [showUnrated, setShowUnrated] = useState(true);
  const [reviewSort, setReviewSort] = useState("newest");
  const [reviewQuery, setReviewQuery] = useState("");
  const [activeTab, setActiveTab] = useState("quests");

  useEffect(() => {
    setLoading(true);
    fetchQuestFeedbackAnalytics()
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setData(null);
        setLoading(false);
      });
  }, []);

  const ratedQuestCount = useMemo(() => {
    if (!Array.isArray(data?.questRatings)) return 0;
    return data.questRatings.filter((q) => (q?.ratingCount || 0) > 0).length;
  }, [data]);

  const avgRatedScore = useMemo(() => {
    if (!Array.isArray(data?.questRatings)) return null;
    const rated = data.questRatings.filter((q) => typeof q?.avgRating === "number");
    if (!rated.length) return null;
    const sum = rated.reduce((acc, q) => acc + q.avgRating, 0);
    return sum / rated.length;
  }, [data]);

  const insightCards = useMemo(() => {
    if (!Array.isArray(data?.questRatings)) {
      return {
        bestQuest: null,
        worstQuest: null,
        mostReviewedQuest: null,
        totalReviews: 0
      };
    }

    const rated = data.questRatings.filter((q) => typeof q?.avgRating === "number" && (q?.ratingCount || 0) > 0);
    const reviewed = data.questRatings.filter((q) => (q?.ratingCount || 0) > 0);
    const totalReviews = data.questRatings.reduce((sum, q) => sum + Number(q?.ratingCount || 0), 0);

    const byBest = [...rated].sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
      return Number(b.ratingCount || 0) - Number(a.ratingCount || 0);
    });

    const byWorst = [...rated].sort((a, b) => {
      if (a.avgRating !== b.avgRating) return a.avgRating - b.avgRating;
      return Number(b.ratingCount || 0) - Number(a.ratingCount || 0);
    });

    const byMostReviewed = [...reviewed].sort((a, b) => {
      if (Number(b.ratingCount || 0) !== Number(a.ratingCount || 0)) {
        return Number(b.ratingCount || 0) - Number(a.ratingCount || 0);
      }
      return Number(b.avgRating || 0) - Number(a.avgRating || 0);
    });

    return {
      bestQuest: byBest[0] || null,
      worstQuest: byWorst[0] || null,
      mostReviewedQuest: byMostReviewed[0] || null,
      totalReviews
    };
  }, [data]);

  const visibleQuestRatings = useMemo(() => {
    if (!Array.isArray(data?.questRatings)) return [];
    const q = questQuery.trim().toLowerCase();
    let list = data.questRatings.filter((quest) => {
      const count = Number(quest?.ratingCount || 0);
      const title = String(quest?.questTitle || "").toLowerCase();
      const idText = String(quest?.questId || "").toLowerCase();

      if (!showUnrated && count === 0) return false;
      if (count < minReviews) return false;
      if (q && !title.includes(q) && !idText.includes(q)) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      const aCount = Number(a?.ratingCount || 0);
      const bCount = Number(b?.ratingCount || 0);
      const aAvg = typeof a?.avgRating === "number" ? a.avgRating : -1;
      const bAvg = typeof b?.avgRating === "number" ? b.avgRating : -1;

      if (questSort === "most-reviewed") {
        if (bCount !== aCount) return bCount - aCount;
        return bAvg - aAvg;
      }
      if (questSort === "lowest-rated") {
        if (aAvg !== bAvg) return aAvg - bAvg;
        return bCount - aCount;
      }

      if (bAvg !== aAvg) return bAvg - aAvg;
      return bCount - aCount;
    });

    return list;
  }, [data, questSort, questQuery, minReviews, showUnrated]);

  const visibleFeedbacks = useMemo(() => {
    if (!Array.isArray(data?.feedbacks)) return [];
    const q = reviewQuery.trim().toLowerCase();

    const list = data.feedbacks.filter((f) => {
      if (!q) return true;
      const idText = String(f?.questId || "").toLowerCase();
      const notes = String(f?.textNotes || "").toLowerCase();
      const user = String(f?.user?.displayName || f?.user?.username || "").toLowerCase();
      return idText.includes(q) || notes.includes(q) || user.includes(q);
    });

    return [...list].sort((a, b) => {
      if (reviewSort === "highest") return Number(b?.rating || 0) - Number(a?.rating || 0);
      if (reviewSort === "lowest") return Number(a?.rating || 0) - Number(b?.rating || 0);
      return new Date(b?.createdAt || 0).getTime() - new Date(a?.createdAt || 0).getTime();
    });
  }, [data, reviewQuery, reviewSort]);

  const questMetaById = useMemo(() => {
    if (!Array.isArray(data?.questRatings)) return new Map();
    return new Map(data.questRatings.map((q) => [String(q.questId), q]));
  }, [data]);

  function applyInsightPreset(type) {
    if (type === "best") {
      setQuestSort("top-rated");
      setMinReviews(1);
      setShowUnrated(false);
      setQuestQuery("");
      return;
    }

    if (type === "worst") {
      setQuestSort("lowest-rated");
      setMinReviews(1);
      setShowUnrated(false);
      setQuestQuery("");
      return;
    }

    if (type === "most-reviewed") {
      setQuestSort("most-reviewed");
      setMinReviews(1);
      setShowUnrated(false);
      setQuestQuery("");
      return;
    }

    setQuestSort("top-rated");
    setMinReviews(0);
    setShowUnrated(true);
    setQuestQuery("");
    setReviewSort("newest");
    setReviewQuery("");
  }

  return (
    <div className="max-w-7xl mx-auto game-shell relative py-3 px-4">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--card-bg)]/80 p-5 md:p-7">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="cinzel text-2xl md:text-3xl font-bold uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>
              {t.analyticsTitle}
            </h2>
            <p className="text-xs uppercase tracking-[0.2em] opacity-70 mt-1">
              {t.analyticsSubtitle}
            </p>
          </div>
          <button
            onClick={onBack}
            className="text-xs px-4 py-2 rounded-full border border-[var(--panel-border)] bg-[var(--card-bg)] hover:opacity-80 transition-colors font-bold uppercase tracking-wider"
          >
            {t.backLabel}
          </button>
        </div>

        {loading ? (
          <div className="py-14 text-center opacity-70 uppercase tracking-widest animate-pulse">{t.loadingAnalytics}</div>
        ) : !data ? (
          <div className="py-14 text-center text-red-400 uppercase tracking-widest">{t.failedToLoadAnalytics}</div>
        ) : (
          <div className="space-y-8">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("quests")}
                className={`text-xs px-3 py-1 rounded-full border uppercase tracking-wider ${activeTab === "quests" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
              >
                {t.analyticsTabQuests}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("reviews")}
                className={`text-xs px-3 py-1 rounded-full border uppercase tracking-wider ${activeTab === "reviews" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
              >
                {t.analyticsTabReviews}
              </button>
            </div>

            {activeTab === "quests" && (
              <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => applyInsightPreset("best")}
                className="rounded-xl border border-[var(--panel-border)] p-4 text-left hover:border-blue-500/70 transition-colors"
                style={{ background: "rgba(0,0,0,0.2)" }}
                title={t.analyticsFilterBestTitle}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">{t.analyticsBestQuest}</div>
                <div className="mt-2 font-bold text-sm truncate" title={insightCards.bestQuest?.questTitle || t.analyticsNoRatedQuests}>
                  {insightCards.bestQuest?.questTitle || t.analyticsNoRatedQuests}
                </div>
                <div className="mt-1 text-lg font-mono" style={{ color: "var(--color-accent)" }}>
                  {typeof insightCards.bestQuest?.avgRating === "number" ? insightCards.bestQuest.avgRating.toFixed(1) : "-"}
                  <span className="text-xs opacity-50"> / 10</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyInsightPreset("worst")}
                className="rounded-xl border border-[var(--panel-border)] p-4 text-left hover:border-blue-500/70 transition-colors"
                style={{ background: "rgba(0,0,0,0.2)" }}
                title={t.analyticsFilterWorstTitle}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">{t.analyticsLowestRated}</div>
                <div className="mt-2 font-bold text-sm truncate" title={insightCards.worstQuest?.questTitle || t.analyticsNoRatedQuests}>
                  {insightCards.worstQuest?.questTitle || t.analyticsNoRatedQuests}
                </div>
                <div className="mt-1 text-lg font-mono" style={{ color: "var(--color-accent)" }}>
                  {typeof insightCards.worstQuest?.avgRating === "number" ? insightCards.worstQuest.avgRating.toFixed(1) : "-"}
                  <span className="text-xs opacity-50"> / 10</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyInsightPreset("most-reviewed")}
                className="rounded-xl border border-[var(--panel-border)] p-4 text-left hover:border-blue-500/70 transition-colors"
                style={{ background: "rgba(0,0,0,0.2)" }}
                title={t.analyticsFilterMostReviewedTitle}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">{t.analyticsMostReviewed}</div>
                <div className="mt-2 font-bold text-sm truncate" title={insightCards.mostReviewedQuest?.questTitle || t.analyticsNoReviewedQuests}>
                  {insightCards.mostReviewedQuest?.questTitle || t.analyticsNoReviewedQuests}
                </div>
                <div className="mt-1 text-lg font-mono" style={{ color: "var(--color-accent)" }}>
                  {Number(insightCards.mostReviewedQuest?.ratingCount || 0)}
                  <span className="text-xs opacity-50"> {t.analyticsReviewsSuffix}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => applyInsightPreset("all")}
                className="rounded-xl border border-[var(--panel-border)] p-4 text-left hover:border-blue-500/70 transition-colors"
                style={{ background: "rgba(0,0,0,0.2)" }}
                title={t.analyticsResetFiltersTitle}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] opacity-70">{t.analyticsTotalReviews}</div>
                <div className="mt-2 text-2xl font-mono" style={{ color: "var(--color-accent)" }}>
                  {insightCards.totalReviews}
                </div>
                <div className="text-xs opacity-60 mt-1">{t.analyticsAcrossAllQuests}</div>
              </button>
            </div>

            <div className="rounded-xl border border-[var(--panel-border)] p-4" style={{ background: "rgba(0,0,0,0.2)" }}>
              <h3 className="text-xs uppercase tracking-[0.2em] opacity-70 mb-4">{t.analyticsPerQuestRatings}</h3>
              <p className="text-xs opacity-60 mb-2">
                {t.analyticsRatedQuests}: {ratedQuestCount} / {Array.isArray(data?.questRatings) ? data.questRatings.length : 0}
              </p>
              <p className="text-xs opacity-60 mb-4">
                {t.analyticsGlobalAverage}: {typeof avgRatedScore === "number" ? avgRatedScore.toFixed(2) : "-"}/10
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 mb-4">
                <input
                  value={questQuery}
                  onChange={(e) => setQuestQuery(e.target.value)}
                  placeholder={t.analyticsSearchQuestPlaceholder}
                  className="lg:col-span-2 rounded-lg border border-[var(--panel-border)] bg-[var(--card-bg)] px-3 py-2 text-sm outline-none"
                />
                <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--card-bg)] px-2 py-2">
                  <div className="text-[10px] opacity-60 uppercase tracking-wider mb-2">{t.analyticsMinReviews}</div>
                  <div className="flex flex-wrap gap-1">
                    {[0, 1, 3, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMinReviews(value)}
                        className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${minReviews === value ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                      >
                        {value === 0 ? t.analyticsAll : `${value}+`}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="rounded-lg border border-[var(--panel-border)] bg-[var(--card-bg)] px-3 py-2 text-sm flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showUnrated}
                    onChange={(e) => setShowUnrated(e.target.checked)}
                  />
                  {t.analyticsShowUnrated}
                </label>
              </div>

              <div className="flex flex-wrap gap-2 mb-4">
                <button
                  onClick={() => setQuestSort("top-rated")}
                  className={`text-xs px-3 py-1 rounded-full border uppercase tracking-wider ${questSort === "top-rated" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                >
                  {t.analyticsTopRated}
                </button>
                <button
                  onClick={() => setQuestSort("most-reviewed")}
                  className={`text-xs px-3 py-1 rounded-full border uppercase tracking-wider ${questSort === "most-reviewed" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                >
                  {t.analyticsMostReviewed}
                </button>
                <button
                  onClick={() => setQuestSort("lowest-rated")}
                  className={`text-xs px-3 py-1 rounded-full border uppercase tracking-wider ${questSort === "lowest-rated" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                >
                  {t.analyticsLowestRated}
                </button>
              </div>

              {visibleQuestRatings.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {visibleQuestRatings.map((quest, idx) => (
                    <div key={String(quest?.questId) + "_" + idx} className="rounded-lg p-3 border border-[var(--panel-border)]" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="text-[11px] uppercase opacity-70 truncate">#{quest?.questId}</div>
                      <div className="font-bold text-sm mt-1 truncate" title={quest?.questTitle || t.analyticsUnknownQuest}>{quest?.questTitle || t.analyticsUnknownQuest}</div>
                      <p className="mt-1 text-xs opacity-75 line-clamp-2" title={quest?.questDescription || t.analyticsNoDescription}>
                        {quest?.questDescription || t.analyticsNoDescription}
                      </p>
                      <div className="mt-2 text-2xl font-mono" style={{ color: "var(--color-accent)" }}>
                        {typeof quest?.avgRating === "number" ? quest.avgRating.toFixed(1) : "-"}
                        <span className="text-xs opacity-50"> / 10</span>
                      </div>
                      <div className="text-[11px] opacity-55 uppercase mt-1">{quest?.ratingCount || 0} {t.analyticsReviewWord}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="opacity-60 italic">{t.analyticsNoQuestMatches}</div>
              )}
            </div>
            </>
            )}

            {activeTab === "reviews" && (
            <div className="rounded-xl border border-[var(--panel-border)] p-4" style={{ background: "rgba(0,0,0,0.2)" }}>
              <h3 className="text-xs uppercase tracking-[0.2em] opacity-70 mb-4">{t.analyticsRecentReviews}</h3>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 mb-4">
                <input
                  value={reviewQuery}
                  onChange={(e) => setReviewQuery(e.target.value)}
                  placeholder={t.analyticsSearchReviewPlaceholder}
                  className="lg:col-span-2 rounded-lg border border-[var(--panel-border)] bg-[var(--card-bg)] px-3 py-2 text-sm outline-none"
                />
                <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--card-bg)] px-2 py-2">
                  <div className="text-[10px] opacity-60 uppercase tracking-wider mb-2">{t.analyticsReviewOrder}</div>
                  <div className="flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => setReviewSort("newest")}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${reviewSort === "newest" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                    >
                      {t.analyticsNewest}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewSort("highest")}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${reviewSort === "highest" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                    >
                      {t.analyticsHighest}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewSort("lowest")}
                      className={`text-[11px] px-2 py-1 rounded-md border transition-colors ${reviewSort === "lowest" ? "border-blue-500 text-blue-300" : "border-[var(--panel-border)] opacity-80"}`}
                    >
                      {t.analyticsLowest}
                    </button>
                  </div>
                </div>
              </div>

              {visibleFeedbacks.length > 0 ? (
                <div className="space-y-3">
                  {visibleFeedbacks.map((f, i) => (
                    <div key={f?.id || i} className="rounded-lg p-3 border border-[var(--panel-border)]" style={{ background: "rgba(255,255,255,0.04)" }}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="font-bold text-sm uppercase">Quest #{f?.questId}</div>
                          <div className="text-[11px] opacity-75 mt-1">
                            {questMetaById.get(String(f?.questId))?.questTitle || t.analyticsUnknownQuestLower}
                          </div>
                          <div className="text-[11px] opacity-60 mt-1 line-clamp-2" title={questMetaById.get(String(f?.questId))?.questDescription || t.analyticsNoDescription}>
                            {questMetaById.get(String(f?.questId))?.questDescription || t.analyticsNoDescription}
                          </div>
                          <div className="text-[10px] uppercase opacity-60 mt-1">
                            {t.analyticsBy} {f?.user?.displayName || f?.user?.username || t.analyticsUnknownUser}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-lg" style={{ color: "var(--color-accent)" }}>{f?.rating ?? 0}/10</div>
                          <div className="text-[10px] opacity-55">
                            {f?.createdAt ? new Date(f.createdAt).toLocaleDateString() : t.analyticsUnknownDate}
                          </div>
                        </div>
                      </div>
                      {f?.questionType ? (
                        <p className="mt-2 text-[11px] uppercase tracking-widest opacity-60">{f.questionType}</p>
                      ) : null}
                      {f?.textNotes ? (
                        <p className="mt-2 text-sm italic opacity-90">"{f.textNotes}"</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="opacity-60 italic">{t.analyticsNoReviewMatches}</div>
              )}
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsPage;