// Single decision point for "which ring should this avatar wear?"
//
// Order of precedence (top wins):
//   1. Premium cosmetic frame  (e.g. Phoenix → cosmic) — paid frame
//      explicitly equipped by the user via the inventory popup.
//   2. Streak-tier ring        (bronze/silver/gold/diamond) — implicit,
//      derived from the user's current streak count.
//   3. Plain circle            — no streak ring, no cosmetic.
//
// All call sites (LeaderboardTab, FriendsListScreen, SearchScreen,
// ProfileScreen, ProfileTab) used to wrap <Avatar/> directly with
// <StreakFrame/>. Migrate them to <FramedAvatar/> and the cosmetic
// override comes for free everywhere.
//
// Inputs:
//   photoUrl, displayName  — passed straight to <Avatar/>.
//   size                   — inner avatar size in px (NOT the outer
//                            ring diameter; matches StreakFrame's prop).
//   ringWidth              — width of the streak ring (ignored when a
//                            premium frame is active, since the ring
//                            is baked into the cosmetic).
//   streak                 — for the streak-tier ring fallback.
//   activeCosmetics        — JSON string from the server, e.g.
//                            `{"frame":"frame_phoenix"}`. Safe to pass
//                            null / undefined / malformed; we parse it
//                            here and degrade gracefully.

import Avatar from "./Avatar";
import StreakFrame from "./StreakFrame";
import PlayerFrame, { getCosmeticFrameVariant } from "./PlayerFrame";

function parseActiveFrame(activeCosmetics) {
  if (!activeCosmetics) return null;
  if (typeof activeCosmetics === "object") return activeCosmetics.frame || null;
  try {
    const obj = JSON.parse(activeCosmetics);
    return obj && typeof obj === "object" ? obj.frame || null : null;
  } catch {
    return null;
  }
}

export default function FramedAvatar({
  photoUrl,
  displayName,
  size = 40,
  ringWidth = 3,
  streak = 0,
  activeCosmetics = null,
  title
}) {
  const frameId = parseActiveFrame(activeCosmetics);
  const variant = getCosmeticFrameVariant(frameId);

  // Cosmetic frame baked at total = size + 2*ringWidth so it visually
  // matches what StreakFrame would have drawn at the same call site.
  // The inner avatar must fit inside the cosmic "well" (inset ≈ 13%
  // on every side), so we shrink it to ~74% of the total diameter.
  if (variant) {
    const total = size + ringWidth * 2;
    const innerAvatarSize = Math.max(8, Math.round(total * 0.74));
    return (
      <PlayerFrame variant={variant} size={total} title={title}>
        <Avatar photoUrl={photoUrl} displayName={displayName} size={innerAvatarSize} />
      </PlayerFrame>
    );
  }

  // Fallback — original streak-tier ring (or plain circle if streak < 10).
  return (
    <StreakFrame streak={streak} size={size} ringWidth={ringWidth} title={title}>
      <Avatar photoUrl={photoUrl} displayName={displayName} size={size} />
    </StreakFrame>
  );
}

export { parseActiveFrame };
