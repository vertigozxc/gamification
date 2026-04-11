import { useState, useEffect } from "react";
import { fetchQuestFeedbackAnalytics } from "../../api";
import { useTheme } from "../../ThemeContext";

function AnalyticsModal({ open, onClose }) {
  const { t } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      setLoading(true);
      fetchQuestFeedbackAnalytics()
        .then((res) => {
          setData(res);
          setLoading(false);
        })
        .catch((err) => {
          console.error(err);
          setLoading(false);
        });
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="logout-confirm-overlay" onClick={onClose} style={{ zIndex: 10000 }}>
      <div className="logout-confirm-card relative" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "800px", width: "95vw", height: "80vh", overflow: "hidden" }}>
        
        <button 
          className="absolute top-4 right-6 text-2xl opacity-60 hover:opacity-100 transition-all font-bold"
          onClick={onClose}
        >
          &times;
        </button>
        
        <div className="flex flex-col items-center mb-6 mt-2">
          <div className="text-4xl mb-4">📈</div>
          <h2 className="cinzel font-bold text-xl uppercase tracking-widest text-center" style={{ color: "var(--color-accent)" }}>
            Feedback Analytics
          </h2>
          <p className="text-sm opacity-70 mt-1 uppercase tracking-wider text-center">
            How users feel about tasks
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 opacity-50 cinzel tracking-widest animate-pulse">
            Gathering Insights...
          </div>
        ) : !data ? (
          <div className="flex justify-center items-center py-20 opacity-50 cinzel tracking-widest text-red-400">
            Failed to load analytics.
          </div>
        ) : (
          <div className="w-full flex-col h-full overflow-y-auto pr-4 pb-24 styled-scrollbar">
            {/* Summary Section */}
            <div className="mb-8 p-6 rounded-xl relative overflow-hidden" style={{ background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--color-accent)" }}>
              <h3 className="font-bold text-xs uppercase tracking-[0.2em] mb-4 opacity-70 flex justify-between">
                <span>Aggregated Rating Averages</span>
              </h3>
              {Array.isArray(data?.stats) && data.stats.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {data.stats.map((stat, idx) => (
                    <div key={String(stat?.questId) + "_" + String(stat?.questionType) + idx} className="p-3 rounded-lg" style={{ background: "rgba(255,255,255,0.05)" }}>
                      <div className="text-[10px] uppercase opacity-70 truncate mb-1" title={stat?.questId}>{stat?.questId || "Unknown"}</div>
                      <div className="text-2xl font-bold font-mono" style={{ color: "var(--color-accent)" }}>
                        {typeof stat?._avg?.rating === "number" ? stat._avg.rating.toFixed(1) : "-"} <span className="text-xs opacity-50">/ 10</span>
                      </div>
                      <div className="text-[10px] uppercase opacity-40 mt-1">   
                        {stat?._count?.rating || 0} logs · {String(stat?.questionType || "").replace("How ", "").replace(" was this task?", "")}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm opacity-50 italic">No aggregated data yet.</p>
              )}
            </div>

            {/* Individual Feedback List */}
            <h3 className="font-bold text-xs uppercase tracking-[0.2em] mb-4 opacity-70 pl-2">
              Recent Player Feedback
            </h3>
            
            <div className="flex flex-col gap-3">
              {Array.isArray(data?.feedbacks) && data.feedbacks.length > 0 ? (
                data.feedbacks.map((f, i) => (
                  <div key={f?.id || i} className="p-4 rounded-xl flex flex-col gap-2 relative group transition-all" style={{ background: "var(--card-bg)", border: "1px solid rgba(255,255,255,0.05)" }}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <span className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[#000]" style={{ color: "var(--color-accent)", border: "1px solid var(--color-accent)" }}>
                          {f?.rating || 0}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold uppercase tracking-wider">{f?.questId || "Unknown"}</span>
                          <span className="text-[10px] opacity-50 uppercase tracking-widest">
                            By {f?.user?.displayName || f?.user?.username || "Unknown"}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[9px] uppercase tracking-widest opacity-40" style={{ whiteSpace: "nowrap" }}>
                          {f?.createdAt ? new Date(f.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : "Unknown Date"}
                        </span>
                      </div>
                    </div>

                    {f?.textNotes && (
                      <div className="mt-2 p-3 rounded-lg text-sm italic" style={{ background: "rgba(0,0,0,0.3)", borderLeft: "2px solid rgba(255,255,255,0.1)" }}>
                        "{f.textNotes}"
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-center py-10 opacity-40 text-sm uppercase tracking-widest border border-dashed border-[rgba(255,255,255,0.1)] rounded-xl">
                  No feedback recorded yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AnalyticsModal;