// "My Referrals" — full-screen modal accessible from Profile → Settings.
// Three sections in one scrollable view:
//   1. My codes        — owner-side. Up to 3 codes, each with usage count
//                        + copy / share. "+ Create code" opens an inline
//                        create-form mode.
//   2. I have a code   — referee-side. Hidden once the user has redeemed.
//   3. Invitees        — referrer-side. Lists every referee + their level
//                        + a per-row "Claim +50" button when eligible.
//
// All API calls go through ../../api referral helpers; this component
// owns the loaded payload and re-fetches after mutating actions.

import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../../ThemeContext";
import { IconCheck, IconClose } from "../icons/Icons";
import {
  fetchMyReferrals as apiFetchMyReferrals,
  createReferralCode as apiCreateReferralCode,
  redeemReferralCode as apiRedeemReferralCode,
  claimReferralReward as apiClaimReferralReward,
  checkReferralCodeAvailable as apiCheckAvailable,
  lookupReferralCode as apiLookupCode
} from "../../api";

const MIN_LEN = 4;
const MAX_LEN = 10;
const REWARD_TOKENS = 50;
const TARGET_LEVEL = 5;

function normalizeCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, MAX_LEN);
}

function buildShareText(t, tf, code) {
  if (typeof tf === "function") return tf("referralsShareMessage", { code });
  const tpl = String(t.referralsShareMessage || "Sign up with my code {code}");
  return tpl.replace("{code}", code);
}

function ReferralsModal({ open, onClose, username, onTokensClaimed }) {
  const { t, tf } = useTheme();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // mode: "list" | "create" — the create-form replaces the codes list
  // in place rather than nesting another modal layer (keeps the iOS
  // experience: one full-screen sheet, no double-blur).
  const [mode, setMode] = useState("list");
  // Create-code form state
  const [createInput, setCreateInput] = useState("");
  const [createStatus, setCreateStatus] = useState("idle"); // idle|checking|free|taken|invalid|too_short|too_long|blocked
  const [createSaving, setCreateSaving] = useState(false);
  const createReqRef = useRef(0);
  // Redeem-friend's-code state
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemStatus, setRedeemStatus] = useState("idle"); // idle|checking|found|not_found|invalid|too_short|too_long|blocked|self
  const [redeemSaving, setRedeemSaving] = useState(false);
  const [redeemOwnerHandle, setRedeemOwnerHandle] = useState(null);
  const redeemReqRef = useRef(0);
  // Per-row claim spinner — only one referral can be claimed at a time
  // so a single id is enough.
  const [claimingId, setClaimingId] = useState(null);
  const [copiedCode, setCopiedCode] = useState(null);

  // Fetch on open. We don't subscribe — the user explicitly closes the
  // modal between sessions so the staleness window is small.
  useEffect(() => {
    if (!open || !username) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    apiFetchMyReferrals(username)
      .then((resp) => {
        if (cancelled) return;
        setData(resp);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err?.message || "Failed to load");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [open, username]);

  // Reset form state when the modal closes — avoids stale flashes when
  // it reopens later in the same session.
  useEffect(() => {
    if (open) return;
    setMode("list");
    setCreateInput("");
    setCreateStatus("idle");
    setRedeemInput("");
    setRedeemStatus("idle");
    setRedeemOwnerHandle(null);
    setError("");
  }, [open]);

  // Debounced availability check while typing in the "create code" input.
  useEffect(() => {
    if (!open || mode !== "create") return undefined;
    const value = normalizeCode(createInput);
    if (value.length === 0) {
      setCreateStatus("idle");
      return undefined;
    }
    if (value.length < MIN_LEN) {
      setCreateStatus("too_short");
      return undefined;
    }
    setCreateStatus("checking");
    const req = ++createReqRef.current;
    const timer = setTimeout(() => {
      apiCheckAvailable(value)
        .then((resp) => {
          if (req !== createReqRef.current) return;
          if (!resp) return;
          if (resp.available) {
            setCreateStatus("free");
          } else {
            const reason = String(resp.reason || "taken");
            const known = ["taken", "invalid", "too_short", "too_long", "blocked"].includes(reason)
              ? reason : "invalid";
            setCreateStatus(known);
          }
        })
        .catch(() => {
          if (req !== createReqRef.current) return;
          // Network blip — let the user submit; the create endpoint
          // will revalidate.
          setCreateStatus("idle");
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [createInput, mode, open]);

  // Debounced lookup for the "I have a code" field.
  useEffect(() => {
    if (!open || data?.myRedemption) return undefined;
    const value = normalizeCode(redeemInput);
    if (value.length === 0) {
      setRedeemStatus("idle");
      setRedeemOwnerHandle(null);
      return undefined;
    }
    if (value.length < MIN_LEN) {
      setRedeemStatus("too_short");
      setRedeemOwnerHandle(null);
      return undefined;
    }
    setRedeemStatus("checking");
    const req = ++redeemReqRef.current;
    const timer = setTimeout(() => {
      apiLookupCode(value, username || undefined)
        .then((resp) => {
          if (req !== redeemReqRef.current) return;
          if (!resp) return;
          if (resp.exists) {
            if (resp.ownedByMe) {
              setRedeemStatus("self");
              setRedeemOwnerHandle(null);
            } else {
              setRedeemStatus("found");
              setRedeemOwnerHandle(resp.ownerHandle || null);
            }
          } else {
            const reason = String(resp.reason || "not_found");
            const known = ["invalid", "too_short", "too_long", "blocked", "not_found"].includes(reason)
              ? reason : "not_found";
            setRedeemStatus(known);
            setRedeemOwnerHandle(null);
          }
        })
        .catch(() => {
          if (req !== redeemReqRef.current) return;
          setRedeemStatus("idle");
          setRedeemOwnerHandle(null);
        });
    }, 350);
    return () => clearTimeout(timer);
  }, [redeemInput, open, data?.myRedemption, username]);

  if (!open) return null;

  const codes = Array.isArray(data?.codes) ? data.codes : [];
  const codesLimit = Number(data?.codesLimit || 3);
  const canCreateMore = Boolean(data?.canCreateMore);
  const referrals = Array.isArray(data?.referrals) ? data.referrals : [];
  const myRedemption = data?.myRedemption || null;

  const createInputNormalized = normalizeCode(createInput);
  const createDisabled = createSaving || createStatus !== "free" || createInputNormalized.length < MIN_LEN;
  const redeemInputNormalized = normalizeCode(redeemInput);
  const redeemDisabled = redeemSaving || redeemStatus !== "found" || redeemInputNormalized.length < MIN_LEN;

  async function handleCopy(code) {
    try {
      await navigator.clipboard?.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode((curr) => (curr === code ? null : curr)), 1500);
    } catch {
      // ignore — older browsers / file:// origins. The button's
      // tooltip already shows the code, user can long-press to copy.
    }
  }

  async function handleShare(code) {
    const text = buildShareText(t, tf, code);
    try {
      if (typeof navigator?.share === "function") {
        await navigator.share({ text });
        return;
      }
    } catch {
      // user cancelled — silently fall through to clipboard fallback
    }
    handleCopy(text);
  }

  async function handleCreate() {
    if (createDisabled) return;
    setCreateSaving(true);
    setError("");
    try {
      const resp = await apiCreateReferralCode(username, createInputNormalized);
      setData(resp);
      setMode("list");
      setCreateInput("");
      setCreateStatus("idle");
    } catch (err) {
      setError(err?.message || "Create failed");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleRedeem() {
    if (redeemDisabled) return;
    setRedeemSaving(true);
    setError("");
    try {
      const resp = await apiRedeemReferralCode(username, redeemInputNormalized);
      setData(resp);
      setRedeemInput("");
      setRedeemStatus("idle");
      setRedeemOwnerHandle(null);
    } catch (err) {
      setError(err?.message || "Apply failed");
    } finally {
      setRedeemSaving(false);
    }
  }

  async function handleClaim(referralId) {
    if (!referralId || claimingId) return;
    setClaimingId(referralId);
    setError("");
    try {
      const resp = await apiClaimReferralReward(username, referralId);
      // Refresh server-side payload to get the updated row state.
      const fresh = await apiFetchMyReferrals(username);
      setData(fresh);
      // Bubble the new token total up so the dashboard balance updates
      // without a full re-fetch of game-state.
      if (typeof onTokensClaimed === "function" && resp?.tokens != null) {
        onTokensClaimed(Number(resp.tokens));
      }
    } catch (err) {
      setError(err?.message || "Claim failed");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <div
      className="logout-confirm-overlay"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      style={{
        zIndex: 86,
        alignItems: "stretch",
        justifyContent: "stretch",
        padding: 0,
        background: "rgba(0,0,0,0.72)"
      }}
    >
      <div
        onClick={(event) => event.stopPropagation()}
        style={{
          position: "fixed",
          inset: 0,
          width: "100vw",
          height: "100dvh",
          maxWidth: "100vw",
          maxHeight: "100dvh",
          background: "var(--panel-bg, #0f172a)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        }}
      >
        {/* Header */}
        <div
          style={{
            flexShrink: 0,
            padding: "calc(var(--mobile-safe-top, env(safe-area-inset-top, 0px)) + 14px) 16px 12px",
            borderBottom: "1px solid var(--card-border-idle)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 22 }}>👥</span>
                <h2
                  className="cinzel"
                  style={{
                    color: "var(--color-primary)",
                    fontSize: 18,
                    fontWeight: 700,
                    margin: 0,
                    lineHeight: 1.2,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {mode === "create"
                    ? (t.referralsCreateModalTitle || "Create code")
                    : (t.referralsSectionTitle || "My Referrals")}
                </h2>
              </div>
              {mode === "list" ? (
                <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 4 }}>
                  {t.referralsSectionHint || ""}
                </p>
              ) : (
                <p style={{ color: "var(--color-muted)", fontSize: 12, marginTop: 4 }}>
                  {t.referralsCreateModalHint || "4–10 characters, A–Z and 0–9"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                if (mode === "create") {
                  setMode("list");
                  setCreateInput("");
                  setCreateStatus("idle");
                } else {
                  onClose();
                }
              }}
              aria-label={t.closeLabel || "Close"}
              className="ui-close-x"
            >
              <IconClose size={16} strokeWidth={2.4} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px"
          }}
        >
          {error ? (
            <p style={{ color: "#fca5a5", fontSize: 12, margin: "0 0 12px", fontWeight: 600 }}>
              {error}
            </p>
          ) : null}

          {loading && !data ? (
            <p style={{ color: "var(--color-muted)", fontSize: 13, textAlign: "center" }}>
              {t.loadingShort || "Loading…"}
            </p>
          ) : mode === "create" ? (
            <CreateForm
              t={t}
              tf={tf}
              input={createInput}
              setInput={(v) => setCreateInput(normalizeCode(v))}
              status={createStatus}
              saving={createSaving}
              disabled={createDisabled}
              onSubmit={handleCreate}
              onCancel={() => {
                setMode("list");
                setCreateInput("");
                setCreateStatus("idle");
              }}
            />
          ) : (
            <>
              <MyCodesBlock
                t={t}
                tf={tf}
                codes={codes}
                codesLimit={codesLimit}
                canCreateMore={canCreateMore}
                copiedCode={copiedCode}
                onCopy={handleCopy}
                onShare={handleShare}
                onCreateClick={() => setMode("create")}
              />

              {!myRedemption ? (
                <RedeemBlock
                  t={t}
                  tf={tf}
                  input={redeemInput}
                  setInput={(v) => setRedeemInput(normalizeCode(v))}
                  status={redeemStatus}
                  ownerHandle={redeemOwnerHandle}
                  saving={redeemSaving}
                  disabled={redeemDisabled}
                  onSubmit={handleRedeem}
                />
              ) : (
                <RedeemedBanner t={t} tf={tf} code={myRedemption.code} />
              )}

              <InviteesBlock
                t={t}
                tf={tf}
                referrals={referrals}
                claimingId={claimingId}
                onClaim={handleClaim}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components — kept in the same file because they're tightly
// coupled to the modal's i18n + handler closure and not reused elsewhere.
// ─────────────────────────────────────────────────────────────────────

function MyCodesBlock({ t, tf, codes, codesLimit, canCreateMore, copiedCode, onCopy, onShare, onCreateClick }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionHeader
        title={t.referralsMyCodesHeading || "My codes"}
        right={tf("referralsMyCodesLimit", { current: codes.length, limit: codesLimit })}
      />
      {codes.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: 12, margin: "0 0 12px" }}>
          {t.referralsCodeUsageNone || "Not used yet"}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
          {codes.map((c) => (
            <CodeCard
              key={c.id}
              code={c.code}
              usageCount={c.usageCount}
              copied={copiedCode === c.code}
              onCopy={() => onCopy(c.code)}
              onShare={() => onShare(c.code)}
              t={t}
              tf={tf}
            />
          ))}
        </div>
      )}
      <button
        type="button"
        disabled={!canCreateMore}
        onClick={onCreateClick}
        className="cinzel mobile-pressable"
        style={{
          width: "100%",
          minHeight: 44,
          borderRadius: 12,
          background: canCreateMore
            ? "color-mix(in srgb, var(--color-primary) 14%, transparent)"
            : "rgba(255,255,255,0.05)",
          border: `1px dashed ${canCreateMore ? "var(--color-primary)" : "var(--card-border-idle)"}`,
          color: canCreateMore ? "var(--color-primary)" : "var(--color-muted)",
          fontSize: 12,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          cursor: canCreateMore ? "pointer" : "not-allowed"
        }}
      >
        {canCreateMore
          ? (codes.length === 0 ? (t.referralsCreateFirst || "+ Create your first code") : (t.referralsCreateMore || "+ New code"))
          : tf("referralsLimitReached", { limit: codesLimit })}
      </button>
    </div>
  );
}

function CodeCard({ code, usageCount, copied, onCopy, onShare, t, tf }) {
  let usageText = "";
  if (Number(usageCount) === 1) {
    usageText = t.referralsCodeUsageOne || "Used by 1 person";
  } else if (Number(usageCount) > 0) {
    usageText = tf("referralsCodeUsageMany", { n: Number(usageCount) });
  } else {
    usageText = t.referralsCodeUsageNone || "Not used yet";
  }
  return (
    <div
      className="mobile-card"
      style={{
        padding: "14px 14px",
        background: "var(--card-bg, rgba(15,23,42,0.65))",
        border: "1px solid var(--card-border-idle)",
        borderRadius: 14,
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span
          className="cinzel"
          style={{
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: "0.12em",
            color: "var(--color-primary)"
          }}
        >
          {code}
        </span>
        <span style={{ fontSize: 11, color: "var(--color-muted)" }}>
          {usageText}
        </span>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          type="button"
          onClick={onCopy}
          className="cinzel mobile-pressable"
          style={{
            flex: 1,
            minHeight: 36,
            borderRadius: 10,
            background: "transparent",
            border: "1px solid var(--card-border-idle)",
            color: copied ? "var(--color-accent)" : "var(--color-text)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: "pointer"
          }}
        >
          {copied ? (t.referralsCodeCopied || "Copied") : (t.referralsCodeCopy || "Copy")}
        </button>
        <button
          type="button"
          onClick={onShare}
          className="cinzel mobile-pressable"
          style={{
            flex: 1,
            minHeight: 36,
            borderRadius: 10,
            background: "transparent",
            border: "1px solid var(--card-border-idle)",
            color: "var(--color-text)",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: "pointer"
          }}
        >
          {t.referralsCodeShare || "Share"}
        </button>
      </div>
    </div>
  );
}

function RedeemBlock({ t, tf, input, setInput, status, ownerHandle, saving, disabled, onSubmit }) {
  const map = useMemo(() => ({
    idle: { text: "", color: "var(--color-muted)" },
    checking: { text: t.referralsCreateChecking || "Checking…", color: "var(--color-muted)" },
    found: {
      text: ownerHandle
        ? tf("referralStepHintFound", { handle: ownerHandle })
        : (t.referralStepHintFoundNoHandle || "Code is valid"),
      color: "var(--color-accent)"
    },
    not_found: { text: t.referralStepHintNotFound, color: "#fca5a5" },
    invalid: { text: t.referralStepHintInvalid, color: "#fca5a5" },
    too_short: { text: t.referralStepHintTooShort, color: "#fca5a5" },
    too_long: { text: t.referralStepHintTooLong, color: "#fca5a5" },
    blocked: { text: t.referralStepHintBlocked, color: "#fca5a5" },
    self: { text: t.referralStepHintSelf, color: "#fca5a5" }
  }), [t, tf, ownerHandle]);
  const hint = map[status] || map.idle;
  return (
    <div style={{ marginBottom: 22 }}>
      <SectionHeader title={t.referralsHaveCodeHeading || "I have a friend's code"} />
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <input
          type="text"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={MAX_LEN}
          placeholder={t.referralStepInputPlaceholder || "IVAN2026"}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            background: "rgba(0,0,0,0.35)",
            border: "1px solid var(--card-border-idle)",
            color: "#e2e8f0",
            fontSize: 14,
            minHeight: 40,
            outline: "none",
            fontFamily: "var(--font-heading)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            width: "100%",
            boxSizing: "border-box"
          }}
        />
        {hint.text ? (
          <p style={{ margin: 0, fontSize: 11, color: hint.color, lineHeight: 1.4 }}>
            {hint.text}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="cinzel mobile-pressable"
          style={{
            minHeight: 44,
            borderRadius: 12,
            background: disabled
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
            border: "none",
            color: disabled ? "var(--color-muted)" : "#0b1120",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: disabled ? "not-allowed" : "pointer"
          }}
        >
          {saving ? (t.referralsHaveCodeApplying || "Applying…") : (t.referralsHaveCodeRedeem || "Apply code")}
        </button>
      </div>
    </div>
  );
}

function RedeemedBanner({ t, tf, code }) {
  return (
    <div
      style={{
        marginBottom: 22,
        padding: "12px 14px",
        borderRadius: 12,
        background: "color-mix(in srgb, var(--color-primary) 12%, transparent)",
        border: "1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)",
        display: "flex",
        alignItems: "center",
        gap: 10
      }}
    >
      <span style={{ color: "var(--color-accent)" }}>
        <IconCheck size={18} strokeWidth={2.6} />
      </span>
      <p style={{ margin: 0, fontSize: 12, color: "var(--color-text)", lineHeight: 1.4 }}>
        {tf("referralsHaveCodeRedeemed", { code })}
      </p>
    </div>
  );
}

function InviteesBlock({ t, tf, referrals, claimingId, onClaim }) {
  return (
    <div>
      <SectionHeader title={t.referralsInviteesHeading || "Invitees"} />
      {referrals.length === 0 ? (
        <p style={{ color: "var(--color-muted)", fontSize: 12 }}>
          {t.referralsInviteesEmpty || "No one has used your codes yet"}
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {referrals.map((row) => (
            <InviteeRow
              key={row.id}
              row={row}
              isClaiming={claimingId === row.id}
              onClaim={() => onClaim(row.id)}
              t={t}
              tf={tf}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function InviteeRow({ row, isClaiming, onClaim, t, tf }) {
  const referee = row?.referee || {};
  const displayName = referee.handle ? `@${referee.handle}` : (referee.displayName || "—");
  const level = Number(referee.level) || 0;
  const claimable = Boolean(row.claimable);
  const claimed = Boolean(row.referrerClaimedAt);
  return (
    <div
      className="mobile-card"
      style={{
        padding: "12px 14px",
        background: "var(--card-bg, rgba(15,23,42,0.65))",
        border: "1px solid var(--card-border-idle)",
        borderRadius: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)" }}>{displayName}</span>
        <span style={{ fontSize: 11, color: "var(--color-muted)", letterSpacing: "0.06em" }}>
          Lv. {level}
        </span>
      </div>
      {claimed ? (
        <p style={{ margin: 0, fontSize: 11, color: "var(--color-accent)", display: "flex", alignItems: "center", gap: 6 }}>
          <IconCheck size={12} strokeWidth={2.6} />
          {t.referralsInviteeClaimed || "Reward claimed"}
        </p>
      ) : claimable ? (
        <button
          type="button"
          onClick={onClaim}
          disabled={isClaiming}
          className="cinzel mobile-pressable"
          style={{
            minHeight: 36,
            borderRadius: 10,
            background: isClaiming
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
            border: "none",
            color: isClaiming ? "var(--color-muted)" : "#0b1120",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            cursor: isClaiming ? "not-allowed" : "pointer"
          }}
        >
          {isClaiming
            ? (t.referralsInviteeClaiming || "Claiming…")
            : tf("referralsInviteeClaimCta", { tokens: REWARD_TOKENS })}
        </button>
      ) : (
        <p style={{ margin: 0, fontSize: 11, color: "var(--color-muted)" }}>
          {tf("referralsInviteeProgress", { level: TARGET_LEVEL, tokens: REWARD_TOKENS })}
        </p>
      )}
    </div>
  );
}

function CreateForm({ t, input, setInput, status, saving, disabled, onSubmit, onCancel }) {
  const map = {
    idle: { text: "", color: "var(--color-muted)" },
    checking: { text: t.referralsCreateChecking || "Checking…", color: "var(--color-muted)" },
    free: { text: t.referralsCreateAvailable || "Code is free", color: "var(--color-accent)" },
    taken: { text: t.referralsCreateTaken || "Taken", color: "#fca5a5" },
    invalid: { text: t.referralStepHintInvalid, color: "#fca5a5" },
    too_short: { text: t.referralStepHintTooShort, color: "#fca5a5" },
    too_long: { text: t.referralStepHintTooLong, color: "#fca5a5" },
    blocked: { text: t.referralStepHintBlocked, color: "#fca5a5" }
  };
  const hint = map[status] || map.idle;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <input
        type="text"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        maxLength={MAX_LEN}
        placeholder="IVAN2026"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="characters"
        spellCheck={false}
        autoFocus
        style={{
          padding: "12px 14px",
          borderRadius: 10,
          background: "rgba(0,0,0,0.35)",
          border: "1px solid var(--card-border-idle)",
          color: "#e2e8f0",
          fontSize: 16,
          minHeight: 44,
          outline: "none",
          fontFamily: "var(--font-heading)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          width: "100%",
          boxSizing: "border-box"
        }}
      />
      {hint.text ? (
        <p style={{ margin: 0, fontSize: 12, color: hint.color }}>
          {hint.text}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="cinzel mobile-pressable"
          style={{
            flex: 1,
            minHeight: 44,
            borderRadius: 12,
            background: "transparent",
            border: "1px solid var(--card-border-idle)",
            color: "#cbd5e1",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: saving ? "not-allowed" : "pointer"
          }}
        >
          {t.referralsCreateCancel || "Cancel"}
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={disabled}
          className="cinzel mobile-pressable"
          style={{
            flex: 2,
            minHeight: 44,
            borderRadius: 12,
            background: disabled
              ? "rgba(255,255,255,0.08)"
              : "linear-gradient(90deg, var(--color-primary), var(--color-accent))",
            border: "none",
            color: disabled ? "var(--color-muted)" : "#0b1120",
            fontSize: 12,
            fontWeight: 800,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            cursor: disabled ? "not-allowed" : "pointer"
          }}
        >
          {saving ? (t.referralsCreateSaving || "Creating…") : (t.referralsCreateConfirm || "Create")}
        </button>
      </div>
    </div>
  );
}

function SectionHeader({ title, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
      <h3
        className="cinzel"
        style={{
          margin: 0,
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: "var(--color-primary)"
        }}
      >
        {title}
      </h3>
      {right ? (
        <span style={{ fontSize: 11, color: "var(--color-muted)", fontWeight: 700, letterSpacing: "0.06em" }}>
          {right}
        </span>
      ) : null}
    </div>
  );
}

export default ReferralsModal;
