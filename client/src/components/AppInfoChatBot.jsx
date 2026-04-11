import { useMemo, useState } from "react";

const QUICK_QUESTIONS = [
  "How XP and level up works?",
  "How streak bonus is calculated?",
  "How rerolls and tokens work?",
  "How PI score and tiers are calculated?",
  "How analytics ratings work?"
];

const ANSWERS = [
  {
    id: "xp-level",
    test: (q) => /xp|level|lvl|progression|level up/.test(q),
    text:
      "XP comes from completed quests. Your level increases when XP reaches your XP-next threshold. Base progression starts at level 1 with XP-next = 300, and XP/level values are synced to server state for consistency."
  },
  {
    id: "streak",
    test: (q) => /streak|bonus|multiplier/.test(q),
    text:
      "Streak bonus multiplier is applied by streak milestones: 3+ days = 1.05x, 5+ = 1.10x, 7+ = 1.15x, 10+ = 1.20x, 15+ = 1.25x, 25+ = 1.30x."
  },
  {
    id: "reroll-token",
    test: (q) => /reroll|token|vault|pinned/.test(q),
    text:
      "Random quest reroll is limited daily, with optional extra rerolls purchased via tokens. Pinned quest replacement is free once every 30 days, otherwise costs tokens. Token actions are managed through Token Vault features."
  },
  {
    id: "daily-reset",
    test: (q) => /reset|midnight|daily|utc/.test(q),
    text:
      "Daily reset follows UTC midnight (server-synced time), not local browser midnight. This keeps reset behavior identical for all users and prevents timezone desync issues."
  },
  {
    id: "feedback-analytics",
    test: (q) => /analytics|review|rating|feedback/.test(q),
    text:
      "When a user completes a quest, they can submit a quest rating (0-10) and optional note. Analytics aggregates these reviews per quest (average rating and review count) and shows recent reviews separately."
  },
  {
    id: "pi-formula",
    test: (q) => /pi|tier|rank|formula|score/.test(q),
    text:
      "Daily Score = (xpToday/200) * (0.7 + 0.3*(baseTasksCompleted/4)) * disciplineFactor(tasksCompleted) * 100. Discipline factor: 6+ tasks=1.0, 4-5=0.85, 2-3=0.65, else 0.4. PI = 0.6*avg(last3 daily scores) + 0.3*avg(last7) + 0.1*todayScore, clamped to 0..100. Tiers: IRON, BRONZE, SILVER, GOLD, PLATINUM, DIAMOND by PI range."
  }
];

function getInfoAnswer(question) {
  const q = String(question || "").toLowerCase();
  const found = ANSWERS.find((item) => item.test(q));
  if (found) return found.text;

  return "I can explain app systems only: XP/levels, streak multipliers, UTC daily reset, rerolls/tokens, PI formulas, tiers/ranks, onboarding, and analytics ratings. I cannot access personal user data, private notes, or sensitive account info.";
}

function AppInfoChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I am your App Info AI. Ask me how app logic, formulas, and features work. I do not have access to personal user/private data."
    }
  ]);

  const canSend = input.trim().length > 0;

  const quickQuestions = useMemo(() => QUICK_QUESTIONS, []);

  function sendQuestion(text) {
    const question = String(text || "").trim();
    if (!question) return;

    const answer = getInfoAnswer(question);

    setMessages((prev) => [
      ...prev,
      { role: "user", text: question },
      { role: "assistant", text: answer }
    ]);
    setInput("");
  }

  return (
    <div style={{ position: "fixed", right: 18, bottom: 18, zIndex: 12000 }}>
      {open ? (
        <div
          className="rounded-2xl border p-3 shadow-2xl"
          style={{
            width: "min(92vw, 390px)",
            maxHeight: "70vh",
            background: "rgba(8,12,24,0.97)",
            borderColor: "var(--panel-border)",
            backdropFilter: "blur(10px)"
          }}
        >
          <div className="flex items-center justify-between mb-2">
            <div>
              <h4 className="cinzel text-sm uppercase tracking-wider" style={{ color: "var(--color-accent)" }}>App Info AI</h4>
              <p className="text-[10px] opacity-70">Logic and formulas only</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs px-2 py-1 rounded border"
              style={{ borderColor: "var(--panel-border)" }}
            >
              Close
            </button>
          </div>

          <div className="flex flex-wrap gap-1 mb-2">
            {quickQuestions.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => sendQuestion(q)}
                className="text-[10px] px-2 py-1 rounded-md border opacity-90 hover:opacity-100"
                style={{ borderColor: "var(--panel-border)", background: "rgba(255,255,255,0.03)" }}
                title={q}
              >
                {q}
              </button>
            ))}
          </div>

          <div
            className="rounded-lg border p-2 mb-2 overflow-y-auto"
            style={{ borderColor: "var(--panel-border)", maxHeight: "38vh", background: "rgba(255,255,255,0.02)" }}
          >
            <div className="flex flex-col gap-2">
              {messages.map((m, idx) => (
                <div
                  key={`${m.role}-${idx}`}
                  className="rounded-lg px-2 py-1 text-xs"
                  style={{
                    alignSelf: m.role === "user" ? "flex-end" : "flex-start",
                    maxWidth: "94%",
                    background: m.role === "user" ? "rgba(59,130,246,0.20)" : "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.08)"
                  }}
                >
                  {m.text}
                </div>
              ))}
            </div>
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendQuestion(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about app logic or formulas"
              className="flex-1 rounded-lg border px-3 py-2 text-xs outline-none"
              style={{ borderColor: "var(--panel-border)", background: "rgba(255,255,255,0.03)" }}
            />
            <button
              type="submit"
              disabled={!canSend}
              className="rounded-lg px-3 py-2 text-xs font-bold border disabled:opacity-40"
              style={{ borderColor: "var(--panel-border)", color: "var(--color-accent)" }}
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-full border px-4 py-3 shadow-xl font-bold uppercase tracking-wider text-xs"
          style={{
            background: "linear-gradient(135deg, rgba(30,58,138,0.95), rgba(30,64,175,0.95))",
            borderColor: "rgba(96,165,250,0.7)",
            color: "#dbeafe"
          }}
        >
          AI Help
        </button>
      )}
    </div>
  );
}

export default AppInfoChatBot;