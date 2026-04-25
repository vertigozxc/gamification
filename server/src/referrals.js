// Referral system helpers: code normalisation, validation, blacklist,
// and the small DB queries the REST endpoints reuse. Routes live in
// index.js — this module owns only pure logic and Prisma reads.

// Limit — enforced at the API layer rather than the DB schema, so the
// constant can be tuned in one place if product changes their mind.
export const MAX_CODES_PER_USER = 3;
export const REFERRAL_REWARD_TOKENS = 50;
export const REFERRAL_LEVEL_THRESHOLD = 5;

// Code format: uppercase A-Z + 0-9, length 4..10. We canonicalise on
// input — the user can type "ivan2026" or "Ivan-2026", we'll uppercase
// and strip the dash to "IVAN2026". The DB stores only canonical form.
const CODE_REGEX = /^[A-Z0-9]{4,10}$/;

// Tiny blacklist — a starter set that catches the obvious. Pop more in
// over time. Matched against the canonicalised (uppercase) code as
// substring, so "FUCK1" / "FUCKER" / "GOFUCK" all trip the same rule.
// Keep this short and uncontroversial — anything ambiguous we'd rather
// allow than reject and frustrate a user with a clean code.
const BLACKLIST_FRAGMENTS = [
  "FUCK", "SHIT", "CUNT", "BITCH", "NIGGA", "NIGGER", "FAGGOT",
  "BLYAT", "BLYAD", "PIZDA", "PIDOR", "PIDR", "MUDAK", "HUYNYA",
  "HUI", "HUY", "EBLO", "EBAT", "GANDON", "SUKA", "ZALUPA"
];

export function canonicaliseCode(raw) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// Returns { ok: true, code } or { ok: false, reason }. `reason` is a
// stable string the client can map to a localised message.
export function validateCode(raw) {
  const code = canonicaliseCode(raw);
  if (code.length === 0) return { ok: false, reason: "empty", code };
  if (code.length < 4) return { ok: false, reason: "too_short", code };
  if (code.length > 10) return { ok: false, reason: "too_long", code };
  if (!CODE_REGEX.test(code)) return { ok: false, reason: "invalid", code };
  if (BLACKLIST_FRAGMENTS.some((bad) => code.includes(bad))) {
    return { ok: false, reason: "blocked", code };
  }
  return { ok: true, code };
}

// True if this code already exists in the DB (any owner). Used by the
// availability check endpoint and by code creation.
export async function codeIsTaken(prisma, code) {
  if (!code) return false;
  const row = await prisma.referralCode.findUnique({
    where: { code },
    select: { id: true }
  });
  return Boolean(row);
}

// Counts how many codes a user currently owns (for the 3-code limit).
export async function countUserCodes(prisma, userId) {
  return prisma.referralCode.count({ where: { ownerUserId: userId } });
}

// Look up the user-id behind a code — null if the code doesn't exist.
// Used by redemption: we need to make sure the redeemer isn't trying to
// use their own code (self-referral) and to find the codeId for the
// Referral row.
export async function findCodeWithOwner(prisma, code) {
  if (!code) return null;
  return prisma.referralCode.findUnique({
    where: { code },
    select: { id: true, code: true, ownerUserId: true }
  });
}

// Has this user already redeemed someone's code? (Once per lifetime.)
export async function getRefereeRedemption(prisma, userId) {
  return prisma.referral.findUnique({
    where: { refereeUserId: userId },
    select: {
      id: true,
      codeId: true,
      createdAt: true,
      refereeLeveledUpAt: true,
      referrerClaimedAt: true,
      code: { select: { code: true, ownerUserId: true } }
    }
  });
}

// Build the "My Referrals" payload: my codes (with usage counts), my
// referees (each row + their current level + claim status), and whether
// I've already redeemed someone else's code (and if so — which code).
export async function buildMyReferralsPayload(prisma, userId) {
  const [codes, referrals, myRedemption] = await Promise.all([
    prisma.referralCode.findMany({
      where: { ownerUserId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        code: true,
        createdAt: true,
        _count: { select: { referrals: true } }
      }
    }),
    // All referrals where I'm the referrer = all referrals attached to
    // codes I own. Two-step: get my code ids, then pull referrals.
    prisma.referral.findMany({
      where: { code: { ownerUserId: userId } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        createdAt: true,
        refereeLeveledUpAt: true,
        referrerClaimedAt: true,
        referee: {
          select: {
            id: true,
            displayName: true,
            handle: true,
            level: true,
            photoUrl: true
          }
        }
      }
    }),
    getRefereeRedemption(prisma, userId)
  ]);

  return {
    codes: codes.map((c) => ({
      id: c.id,
      code: c.code,
      createdAt: c.createdAt,
      usageCount: c._count?.referrals || 0
    })),
    codesLimit: MAX_CODES_PER_USER,
    canCreateMore: codes.length < MAX_CODES_PER_USER,
    rewardTokens: REFERRAL_REWARD_TOKENS,
    rewardLevel: REFERRAL_LEVEL_THRESHOLD,
    referrals: referrals.map((r) => ({
      id: r.id,
      createdAt: r.createdAt,
      refereeLeveledUpAt: r.refereeLeveledUpAt,
      referrerClaimedAt: r.referrerClaimedAt,
      claimable: Boolean(r.refereeLeveledUpAt) && !r.referrerClaimedAt,
      referee: r.referee
    })),
    myRedemption: myRedemption
      ? {
          referralId: myRedemption.id,
          code: myRedemption.code?.code || null,
          referrerUserId: myRedemption.code?.ownerUserId || null,
          createdAt: myRedemption.createdAt,
          refereeLeveledUpAt: myRedemption.refereeLeveledUpAt
        }
      : null
  };
}
