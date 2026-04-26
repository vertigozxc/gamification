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
import { createPortal } from "react-dom";
import { useTheme } from "../../ThemeContext";
import InputWithClear from "../InputWithClear";
import { IconCheck, IconClose, IconList, IconSparkle, IconTrash } from "../icons/Icons";
import Avatar from "../social/Avatar";
import {
  fetchMyReferrals as apiFetchMyReferrals,
  createReferralCode as apiCreateReferralCode,
  redeemReferralCode as apiRedeemReferralCode,
  claimReferralReward as apiClaimReferralReward,
  checkReferralCodeAvailable as apiCheckAvailable,
  lookupReferralCode as apiLookupCode,
  deleteReferralCode as apiDeleteReferralCode
} from "../../api";

const MIN_LEN = 4;
const MAX_LEN = 10;
const REWARD_SILVER = 50;
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
  // Top-level slide-bar tab. "codes" — owner-side codes + redeem-a-
  // friend's-code surface. "referrals" — table of users who used my
  // codes with claim buttons + KPI strip. Same slide-bar pattern as
  // the OnboardingModal / SingleHabitPickerModal so the screens
  // feel like a family.
  const [tab, setTab] = useState("codes");
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
  // Pending delete-confirm popup. Holds { codeId, code } when the user
  // tapped Delete on a code row; null otherwise. Replaces the previous
  // window.confirm() so the prompt matches the rest of the app's
  // styled confirmation dialogs.
  const [deleteCodeTarget, setDeleteCodeTarget] = useState(null);
  const [deletingCodeId, setDeletingCodeId] = useState(null);

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
    setTab("codes");
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

  function handleDeleteCode(codeId, codeText) {
    if (!codeId) return;
    setDeleteCodeTarget({ codeId, code: codeText || "" });
  }

  async function confirmDeleteCode() {
    if (!deleteCodeTarget) return;
    const { codeId } = deleteCodeTarget;
    setDeletingCodeId(codeId);
    setError("");
    try {
      const resp = await apiDeleteReferralCode(username, codeId);
      setData(resp);
      setDeleteCodeTarget(null);
    } catch (err) {
      setError(err?.message || "Delete failed");
    } finally {
      setDeletingCodeId(null);
    }
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
      if (typeof onTokensClaimed === "function" && resp?.silver != null) {
        onTokensClaimed(Number(resp.silver));
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

          {/* Slide-bar tabs — same segmented pattern as the
              OnboardingModal / SingleHabitPickerModal so the screens
              read as a family. Hidden in create-mode (the create
              form takes over the whole body and tabs would be
              meaningless there). */}
          {mode === "list" ? (
            <div
              role="tablist"
              className="onb-habits-tabs"
              style={{ "--onb-tabs-count": 2, "--onb-tabs-active": tab === "referrals" ? 1 : 0, marginTop: 12 }}
            >
              <div className="onb-habits-tabs-slider" aria-hidden />
              <button
                type="button"
                role="tab"
                aria-selected={tab === "codes"}
                onClick={() => setTab("codes")}
                className="onb-habits-tab cinzel mobile-pressable"
              >
                <span className="onb-habits-tab-ico" aria-hidden style={{ display: "inline-flex" }}><IconList size={14} /></span>
                <span className="onb-habits-tab-label">{t.referralsTabCodes || "My Codes"}</span>
                {Array.isArray(data?.codes) && data.codes.length > 0 ? (
                  <span className="onb-habits-tab-count">{data.codes.length}</span>
                ) : null}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "referrals"}
                onClick={() => setTab("referrals")}
                className="onb-habits-tab cinzel mobile-pressable"
              >
                <span className="onb-habits-tab-ico" aria-hidden style={{ display: "inline-flex" }}><IconSparkle size={14} /></span>
                <span className="onb-habits-tab-label">{t.referralsTabReferrals || "My Referrals"}</span>
                {Array.isArray(data?.referrals) && data.referrals.length > 0 ? (
                  <span className="onb-habits-tab-count">{data.referrals.length}</span>
                ) : null}
              </button>
            </div>
          ) : null}
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
          ) : tab === "codes" ? (
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
                onDelete={handleDeleteCode}
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
            </>
          ) : (
            <ReferralsTab
              t={t}
              tf={tf}
              referrals={referrals}
              claimingId={claimingId}
              onClaim={handleClaim}
              onSwitchToCodes={() => setTab("codes")}
            />
          )}
        </div>
      </div>

      {/* Initial-load spinner — covers the body until the first fetch
          resolves. Without this the user sees an empty sheet for a
          beat plus the mobile tab bar lingers underneath; the overlay
          masks both gaps with a clean centered ring. */}
      {open && loading && !data ? (
        <div
          aria-hidden="true"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 88,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "color-mix(in srgb, var(--card-bg, #0f172a) 96%, transparent)",
            backdropFilter: "blur(2px)"
          }}
        >
          <div className="ref-spinner" />
        </div>
      ) : null}

      {/* Delete-code confirmation. Same logout-confirm-overlay pattern
          the rest of the app uses for destructive prompts (delete
          profile, etc.) so the styling is consistent. Renders to body
          via createPortal so it's not clipped by the parent modal's
          overflow:hidden + safe-area padding. */}
      {deleteCodeTarget && createPortal(
        <div
          className="logout-confirm-overlay"
          onClick={() => { if (!deletingCodeId) setDeleteCodeTarget(null); }}
          style={{ zIndex: 92 }}
        >
          <div
            className="logout-confirm-card"
            role="dialog"
            aria-modal="true"
            aria-label={t.referralsCodeDeleteTitle || "Delete code?"}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="logout-confirm-icon" style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#dc2626" }}>
              <IconTrash size={28} />
            </div>
            <h3 className="cinzel logout-confirm-title">
              {t.referralsCodeDeleteTitle || "Delete code?"}
            </h3>
            <p className="logout-confirm-msg">
              {(t.referralsCodeDeleteConfirm || "Delete code {code}? Existing referrals stay yours, but nobody new can use this code.")
                .replace("{code}", deleteCodeTarget.code || "")}
            </p>
            <div className="logout-confirm-actions">
              <button
                className="logout-confirm-cancel cinzel"
                disabled={Boolean(deletingCodeId)}
                onClick={() => setDeleteCodeTarget(null)}
              >
                {t.cancelLabel || "Cancel"}
              </button>
              <button
                className="logout-confirm-proceed cinzel"
                disabled={Boolean(deletingCodeId)}
                onClick={confirmDeleteCode}
              >
                {deletingCodeId
                  ? (t.referralsDeleting || "Deleting…")
                  : (t.referralsCodeDelete || "Delete")}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sub-components — kept in the same file because they're tightly
// coupled to the modal's i18n + handler closure and not reused elsewhere.
// ─────────────────────────────────────────────────────────────────────

function MyCodesBlock({ t, tf, codes, codesLimit, canCreateMore, copiedCode, onCopy, onShare, onDelete, onCreateClick }) {
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
              onDelete={typeof onDelete === "function" ? () => onDelete(c.id, c.code) : undefined}
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

function CodeCard({ code, usageCount, copied, onCopy, onShare, onDelete, t, tf }) {
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
        {typeof onDelete === "function" ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={t.referralsCodeDelete || "Delete"}
            className="cinzel mobile-pressable"
            style={{
              flex: "0 0 auto",
              minHeight: 36,
              padding: "0 14px",
              borderRadius: 10,
              background: "transparent",
              border: "1px solid color-mix(in srgb, #f87171 45%, transparent)",
              color: "#f87171",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              cursor: "pointer"
            }}
          >
            {t.referralsCodeDelete || "Delete"}
          </button>
        ) : null}
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
        <InputWithClear
          value={input}
          onChange={setInput}
          maxLength={MAX_LEN}
          placeholder={t.referralStepInputPlaceholder || ""}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          clearAriaLabel={t.clearLabel || "Clear"}
          inputStyle={{
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

// ─── ReferralsTab — table-style listing with a KPI strip on top.
//
// Layout:
//   ┌────────────────┬──────────────────┐
//   │ Total invited  │ Ready to claim   │
//   │      N         │   K  ·  +50 🪙   │
//   └────────────────┴──────────────────┘
//   ┌──────────────────────────────────┐
//   │ ◯ Display name        Lvl 12 [+50 Claim] │
//   │   @handle                                 │
//   ├──────────────────────────────────┤
//   │ ◯ Display name        Lvl 3   🔒 3 / 5  │
//   │   @handle                                 │
//   ├──────────────────────────────────┤
//   │ ◯ Display name        Lvl 7   ✓ Claimed │
//   │   @handle                                 │
//   └──────────────────────────────────┘
//
// Empty state surfaces a CTA back to the My Codes tab so the user has
// somewhere to go instead of staring at "No invitees yet".
function ReferralsTab({ t, tf, referrals, claimingId, onClaim, onSwitchToCodes }) {
  const total = referrals.length;
  const claimableCount = referrals.filter((r) => Boolean(r.claimable)).length;

  if (total === 0) {
    return (
      <div className="ref-empty">
        <div className="ref-empty-icon" aria-hidden>👥</div>
        <p className="ref-empty-title cinzel">{t.referralsEmptyTitle || "No invitees yet"}</p>
        <p className="ref-empty-body">{t.referralsEmptyBody || "Share your code with friends to start bringing them in."}</p>
        <button
          type="button"
          onClick={onSwitchToCodes}
          className="cinzel mobile-pressable ref-empty-cta"
        >
          {t.referralsEmptyCta || "Go to My Codes"}
        </button>
      </div>
    );
  }

  return (
    <div className="ref-tab">
      {/* KPI strip — total invited vs ready-to-claim. The right tile
          glows in primary when there are rewards waiting; muted when
          everything is either pending-level-up or already claimed. */}
      <div className="ref-kpi-row">
        <div className="ref-kpi-tile">
          <p className="ref-kpi-label">{t.referralsKpiTotal || "Total invited"}</p>
          <p className="cinzel ref-kpi-value">{total}</p>
        </div>
        <div className={`ref-kpi-tile ${claimableCount > 0 ? "ref-kpi-tile--hot" : ""}`}>
          <p className="ref-kpi-label">{t.referralsKpiClaimable || "Ready to claim"}</p>
          <p className="cinzel ref-kpi-value">
            {claimableCount}
            {claimableCount > 0 ? (
              <span className="ref-kpi-bonus"> · +{claimableCount * REWARD_SILVER}🪙</span>
            ) : null}
          </p>
        </div>
      </div>

      {/* Compact table-style list of every referee. */}
      <div className="ref-table">
        {referrals.map((row) => (
          <ReferralRow
            key={row.id}
            row={row}
            isClaiming={claimingId === row.id}
            onClaim={() => onClaim(row.id)}
            t={t}
            tf={tf}
          />
        ))}
      </div>

      <p className="ref-footnote">
        {tf("referralsFootnoteHint", { level: TARGET_LEVEL, silver: REWARD_SILVER })}
      </p>
    </div>
  );
}

function ReferralRow({ row, isClaiming, onClaim, t, tf }) {
  const referee = row?.referee || {};
  const displayName = referee.displayName || referee.handle || "—";
  const handle = referee.handle ? `@${referee.handle}` : "";
  const level = Number(referee.level) || 0;
  const claimable = Boolean(row.claimable);
  const claimed = Boolean(row.referrerClaimedAt);

  // Right-side affordance has three mutually exclusive states.
  let rightSlot = null;
  if (claimed) {
    rightSlot = (
      <span className="ref-row-status ref-row-status--claimed cinzel">
        <IconCheck size={12} strokeWidth={2.6} />
        {t.referralsClaimedBadge || "Claimed"}
      </span>
    );
  } else if (claimable) {
    rightSlot = (
      <button
        type="button"
        onClick={onClaim}
        disabled={isClaiming}
        className="cinzel mobile-pressable ref-row-claim"
      >
        {isClaiming
          ? (t.referralsInviteeClaiming || "…")
          : `+${REWARD_SILVER}`}
      </button>
    );
  } else {
    // Locked: lvl < 5. Show a lock + N/5 progress so the user
    // understands why it isn't claimable yet.
    rightSlot = (
      <span className="ref-row-status ref-row-status--locked cinzel" aria-label={t.referralsLockedAria || "Locked"}>
        <span aria-hidden style={{ fontSize: 12 }}>🔒</span>
        {Math.min(level, TARGET_LEVEL)} / {TARGET_LEVEL}
      </span>
    );
  }

  return (
    <div className="ref-row">
      <div className="ref-row-avatar">
        <Avatar photoUrl={referee.photoUrl} displayName={displayName} size={32} />
      </div>
      <div className="ref-row-body">
        <div className="ref-row-line1">
          <span className="ref-row-name">{displayName}</span>
        </div>
        {handle ? (
          <p className="ref-row-handle">{handle}</p>
        ) : null}
      </div>
      {/* Level chip — plain "Level N" text, vertically centered against
          the row by the wrapper's flex alignItems. The previous "⭐N"
          glyph chip read as a starred rating instead of a level
          indicator and sat awkwardly above the avatar baseline. */}
      <span
        className="cinzel"
        style={{
          flexShrink: 0,
          alignSelf: "center",
          padding: "4px 10px",
          borderRadius: 999,
          background: "color-mix(in srgb, var(--color-primary) 14%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)",
          color: "var(--color-primary)",
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.04em",
          whiteSpace: "nowrap"
        }}
      >
        {(t.referralsRefereeLevel || "Level {level}").replace("{level}", String(level))}
      </span>
      <div className="ref-row-right">
        {rightSlot}
      </div>
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
        placeholder=""
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
