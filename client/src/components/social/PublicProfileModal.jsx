import { useEffect, useState } from "react";
import CityIsometricOverview from "../CityIsometricOverview";
import {
  fetchPublicProfile,
  fetchFriendRelation,
  sendFriendRequest,
  respondToFriendRequest,
  cancelFriendRequest,
  removeFriend
} from "../../api";
import StreakFrame from "./StreakFrame";
import Avatar from "./Avatar";

function parseDistrictLevels(str) {
  return String(str || "0,0,0,0,0")
    .split(",")
    .map((v) => Math.max(0, Math.min(5, Math.floor(Number(v) || 0))))
    .concat([0, 0, 0, 0, 0])
    .slice(0, 5);
}

function formatDate(value, languageId) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(languageId === "ru" ? "ru-RU" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  } catch {
    return "—";
  }
}

export default function PublicProfileModal({ targetUsername, meUsername, t, languageId, onClose }) {
  const [profile, setProfile] = useState(null);
  const [relation, setRelation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    setError("");
    try {
      const [p, r] = await Promise.all([
        fetchPublicProfile(targetUsername),
        meUsername ? fetchFriendRelation(meUsername, targetUsername) : Promise.resolve(null)
      ]);
      setProfile(p?.user || null);
      setRelation(r || null);
    } catch (e) {
      setError(e?.message || t.socialErrorLoad || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    refresh();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUsername, meUsername]);

  async function handleAction(fn) {
    if (!meUsername) return;
    setBusy(true);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e?.message || t.socialErrorGeneric || "Action failed");
    } finally {
      setBusy(false);
    }
  }

  const districtLevels = profile ? parseDistrictLevels(profile.districtLevels) : [0, 0, 0, 0, 0];
  const state = relation?.state;
  const isSelf = state === "self";

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 60,
        background: "rgba(0,0,0,0.72)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "stretch",
        justifyContent: "center",
        overflowY: "auto"
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          margin: "auto",
          background: "var(--panel-bg)",
          border: "1px solid var(--panel-border)",
          borderRadius: "var(--border-radius-panel)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
          padding: "1.25rem",
          display: "flex",
          flexDirection: "column",
          gap: "1rem"
        }}
      >
        {/* Close button */}
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.close || "Close"}
            style={{
              background: "rgba(0,0,0,0.3)",
              color: "var(--color-text)",
              border: "1px solid var(--panel-border)",
              borderRadius: 999,
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: "1rem"
            }}
          >
            ✕
          </button>
        </div>

        {loading ? (
          <p style={{ textAlign: "center", color: "var(--color-muted)" }}>{t.socialLoading || "Loading…"}</p>
        ) : !profile ? (
          <p style={{ textAlign: "center", color: "var(--color-danger, #f87171)" }}>{error || t.socialErrorLoad || "Failed to load profile"}</p>
        ) : (
          <>
            {/* Avatar + identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <StreakFrame streak={profile.streak} size={72} ringWidth={4}>
                <Avatar photoUrl={profile.photoUrl} displayName={profile.displayName} size={72} />
              </StreakFrame>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontSize: "1.15rem",
                    fontWeight: 700,
                    color: "var(--color-text)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis"
                  }}
                >
                  {profile.displayName}
                </p>
                <p style={{ fontSize: "0.72rem", color: "var(--color-muted)", marginTop: 2 }}>
                  {t.socialLevelLabel || "Level"} {profile.level}
                </p>
              </div>
            </div>

            {/* Stats strip */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "0.5rem",
                padding: "0.75rem",
                background: "rgba(0,0,0,0.2)",
                border: "1px solid var(--panel-border)",
                borderRadius: "0.75rem"
              }}
            >
              <Stat label={t.socialStreakLabel || "Streak"} value={profile.streak} accent="#f97316" />
              <Stat label={t.socialMaxStreakLabel || "Max streak"} value={profile.maxStreak} accent="#fbbf24" />
              <Stat label={t.socialJoinedLabel || "Joined"} value={formatDate(profile.createdAt, languageId)} small />
            </div>

            {/* Read-only city */}
            <div
              style={{
                background: "rgba(0,0,0,0.25)",
                border: "1px solid var(--panel-border)",
                borderRadius: "0.75rem",
                padding: "0.5rem",
                overflow: "hidden"
              }}
            >
              <p style={{ fontSize: "0.65rem", letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--color-primary-dim)", marginBottom: "0.35rem", fontWeight: 700 }}>
                {t.socialCityLabel || "City"}
              </p>
              <div style={{ aspectRatio: "1 / 1", width: "100%", pointerEvents: "none" }}>
                <CityIsometricOverview levels={districtLevels} selectedIdx={-1} t={t} />
              </div>
            </div>

            {/* Friendship button */}
            {!isSelf && meUsername && (
              <FriendshipButton
                state={state}
                relation={relation}
                busy={busy}
                t={t}
                onAdd={() => handleAction(() => sendFriendRequest(meUsername, targetUsername))}
                onCancel={() => handleAction(() => cancelFriendRequest(meUsername, targetUsername))}
                onAccept={() => handleAction(() => respondToFriendRequest(meUsername, relation.requestId, "accept"))}
                onDecline={() => handleAction(() => respondToFriendRequest(meUsername, relation.requestId, "decline"))}
                onRemove={() => handleAction(() => removeFriend(meUsername, targetUsername))}
              />
            )}

            {error && (
              <p style={{ fontSize: "0.8rem", color: "var(--color-danger, #f87171)", textAlign: "center" }}>{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent, small }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textAlign: "center" }}>
      <span style={{
        fontSize: "0.56rem",
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        fontWeight: 700,
        color: "var(--color-primary-dim)"
      }}>
        {label}
      </span>
      <span style={{
        fontSize: small ? "0.78rem" : "1.1rem",
        fontWeight: 700,
        color: accent || "var(--color-text)",
        whiteSpace: "nowrap"
      }}>
        {value}
      </span>
    </div>
  );
}

function FriendshipButton({ state, busy, t, onAdd, onCancel, onAccept, onDecline, onRemove }) {
  const baseStyle = {
    width: "100%",
    padding: "0.65rem 1rem",
    borderRadius: "0.6rem",
    fontFamily: "var(--font-heading)",
    fontWeight: 700,
    fontSize: "0.78rem",
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    cursor: busy ? "wait" : "pointer",
    border: "1px solid var(--panel-border)",
    color: "var(--color-text)",
    transition: "opacity 120ms"
  };

  if (state === "friends") {
    return (
      <button type="button" disabled={busy} onClick={onRemove} style={{ ...baseStyle, background: "rgba(239,68,68,0.15)", borderColor: "rgba(239,68,68,0.5)" }}>
        {t.socialRemoveFriend || "Remove friend"}
      </button>
    );
  }
  if (state === "outgoing_pending") {
    return (
      <button type="button" disabled={busy} onClick={onCancel} style={{ ...baseStyle, opacity: 0.7, background: "rgba(255,255,255,0.04)" }}>
        {t.socialPending || "Request sent — tap to cancel"}
      </button>
    );
  }
  if (state === "incoming_pending") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
        <button type="button" disabled={busy} onClick={onAccept} style={{ ...baseStyle, background: "rgba(34,197,94,0.2)", borderColor: "rgba(34,197,94,0.55)" }}>
          {t.socialAcceptRequest || "Accept"}
        </button>
        <button type="button" disabled={busy} onClick={onDecline} style={{ ...baseStyle, background: "rgba(0,0,0,0.3)", borderColor: "var(--panel-border)" }}>
          {t.socialDeclineRequest || "Decline"}
        </button>
      </div>
    );
  }
  if (state === "declined_by_them") {
    return (
      <button type="button" disabled style={{ ...baseStyle, opacity: 0.45, cursor: "not-allowed" }}>
        {t.socialDeclinedByThem || "Request was declined"}
      </button>
    );
  }
  return (
    <button type="button" disabled={busy} onClick={onAdd} style={{ ...baseStyle, background: "rgba(var(--color-primary-rgb,251,191,36),0.18)", borderColor: "rgba(var(--color-primary-rgb,251,191,36),0.6)" }}>
      {t.socialAddFriend || "Add friend"}
    </button>
  );
}
