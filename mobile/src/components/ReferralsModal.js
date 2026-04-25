// Native "My Referrals" modal — mirrors web ReferralsModal but built
// with RN primitives (Modal + ScrollView + TextInput). Same three
// sections: my codes (with copy/share/create), I have a code, invitees.

import React, { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import {
  fetchMyReferrals,
  createReferralCode,
  redeemReferralCode,
  claimReferralReward,
  checkReferralCodeAvailable,
  lookupReferralCode
} from "../api/client";
import { tm } from "../i18n";

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

export default function ReferralsModal({ visible, username, onClose, onTokensChanged }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("list"); // list | create

  // Create-form state
  const [createInput, setCreateInput] = useState("");
  const [createSaving, setCreateSaving] = useState(false);

  // Redeem-form state
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemSaving, setRedeemSaving] = useState(false);

  // Claim-row state
  const [claimingId, setClaimingId] = useState(null);

  useEffect(() => {
    if (!visible || !username) return undefined;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetchMyReferrals(username)
      .then((resp) => { if (!cancelled) setData(resp); })
      .catch((err) => { if (!cancelled) setError(err?.message || "Failed to load"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [visible, username]);

  useEffect(() => {
    if (!visible) {
      setMode("list");
      setCreateInput("");
      setRedeemInput("");
      setError("");
    }
  }, [visible]);

  async function handleShare(code) {
    // RN's native Share sheet exposes Copy as one of its actions on
    // both iOS and Android — no separate Clipboard package needed.
    try {
      const message = String(tm("referralsShareMessage", { code }));
      await Share.share({ message });
    } catch {
      // user cancelled — silent.
    }
  }

  async function handleCreate() {
    const code = normalizeCode(createInput);
    if (code.length < MIN_LEN) return;
    setCreateSaving(true);
    setError("");
    try {
      // Pre-flight availability check so we can show a friendly message
      // before the create call. The create endpoint also revalidates.
      const probe = await checkReferralCodeAvailable(code);
      if (probe && !probe.available) {
        const reason = String(probe.reason || "taken");
        const map = {
          taken: tm("referralsCreateTaken"),
          invalid: tm("referralStepHintInvalid"),
          too_short: tm("referralStepHintTooShort"),
          too_long: tm("referralStepHintTooLong"),
          blocked: tm("referralStepHintBlocked")
        };
        setError(map[reason] || tm("referralsCreateTaken"));
        setCreateSaving(false);
        return;
      }
      const resp = await createReferralCode(username, code);
      setData(resp);
      setMode("list");
      setCreateInput("");
    } catch (err) {
      setError(err?.message || "Create failed");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleRedeem() {
    const code = normalizeCode(redeemInput);
    if (code.length < MIN_LEN) return;
    setRedeemSaving(true);
    setError("");
    try {
      const probe = await lookupReferralCode(code, username);
      if (!probe?.exists) {
        setError(tm("referralStepHintNotFound"));
        setRedeemSaving(false);
        return;
      }
      if (probe.ownedByMe) {
        setError(tm("referralStepHintSelf"));
        setRedeemSaving(false);
        return;
      }
      const resp = await redeemReferralCode(username, code);
      setData(resp);
      setRedeemInput("");
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
      const resp = await claimReferralReward(username, referralId);
      const fresh = await fetchMyReferrals(username);
      setData(fresh);
      if (typeof onTokensChanged === "function" && resp?.tokens != null) {
        onTokensChanged(Number(resp.tokens));
      }
    } catch (err) {
      setError(err?.message || "Claim failed");
    } finally {
      setClaimingId(null);
    }
  }

  const codes = Array.isArray(data?.codes) ? data.codes : [];
  const codesLimit = Number(data?.codesLimit || 3);
  const canCreateMore = Boolean(data?.canCreateMore);
  const referrals = Array.isArray(data?.referrals) ? data.referrals : [];
  const myRedemption = data?.myRedemption || null;

  return (
    <Modal animationType="slide" presentationStyle="pageSheet" visible={visible} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>
            {mode === "create"
              ? tm("referralsCreateModalTitle")
              : tm("referralsSectionTitle")}
          </Text>
          <Pressable onPress={() => (mode === "create" ? setMode("list") : onClose())} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        {loading && !data ? (
          <Text style={styles.loadingText}>{tm("loadingShort")}</Text>
        ) : mode === "create" ? (
          <ScrollView contentContainerStyle={styles.body}>
            <Text style={styles.hint}>{tm("referralsCreateModalHint")}</Text>
            <TextInput
              value={createInput}
              onChangeText={(v) => setCreateInput(normalizeCode(v))}
              placeholder="IVAN2026"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={MAX_LEN}
              editable={!createSaving}
              style={styles.input}
            />
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => { setMode("list"); setCreateInput(""); }}
                style={[styles.btn, styles.btnSecondary]}
              >
                <Text style={styles.btnSecondaryText}>{tm("referralsCreateCancel")}</Text>
              </Pressable>
              <Pressable
                onPress={handleCreate}
                disabled={createSaving || normalizeCode(createInput).length < MIN_LEN}
                style={[
                  styles.btn,
                  styles.btnPrimary,
                  (createSaving || normalizeCode(createInput).length < MIN_LEN) && styles.btnDisabled
                ]}
              >
                <Text style={styles.btnPrimaryText}>
                  {createSaving ? tm("referralsCreateSaving") : tm("referralsCreateConfirm")}
                </Text>
              </Pressable>
            </View>
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            {/* MY CODES */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{tm("referralsMyCodesHeading")}</Text>
              <Text style={styles.sectionRight}>
                {tm("referralsMyCodesLimit", { current: codes.length, limit: codesLimit })}
              </Text>
            </View>
            {codes.length === 0 ? (
              <Text style={styles.muted}>{tm("referralsCodeUsageNone")}</Text>
            ) : (
              codes.map((c) => (
                <View key={c.id} style={styles.card}>
                  <View style={styles.cardRow}>
                    <Text style={styles.codeText}>{c.code}</Text>
                    <Text style={styles.muted}>
                      {Number(c.usageCount) === 1
                        ? tm("referralsCodeUsageOne")
                        : Number(c.usageCount) > 0
                          ? tm("referralsCodeUsageMany", { n: c.usageCount })
                          : tm("referralsCodeUsageNone")}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <Pressable onPress={() => handleShare(c.code)} style={[styles.btn, styles.btnSecondary]}>
                      <Text style={styles.btnSecondaryText}>{tm("referralsCodeShare")}</Text>
                    </Pressable>
                  </View>
                </View>
              ))
            )}
            <Pressable
              onPress={() => canCreateMore && setMode("create")}
              disabled={!canCreateMore}
              style={[styles.btn, styles.btnDashed, !canCreateMore && styles.btnDisabled]}
            >
              <Text style={[styles.btnSecondaryText, !canCreateMore && { opacity: 0.5 }]}>
                {canCreateMore
                  ? (codes.length === 0
                      ? tm("referralsCreateFirst")
                      : tm("referralsCreateMore"))
                  : tm("referralsLimitReached", { limit: codesLimit })}
              </Text>
            </Pressable>

            {/* I HAVE A CODE */}
            {!myRedemption ? (
              <>
                <View style={styles.sectionHeaderTopMargin}>
                  <Text style={styles.sectionTitle}>{tm("referralsHaveCodeHeading")}</Text>
                </View>
                <TextInput
                  value={redeemInput}
                  onChangeText={(v) => setRedeemInput(normalizeCode(v))}
                  placeholder={tm("referralStepInputPlaceholder")}
                  placeholderTextColor="#64748b"
                  autoCapitalize="characters"
                  autoCorrect={false}
                  maxLength={MAX_LEN}
                  editable={!redeemSaving}
                  style={styles.input}
                />
                <Pressable
                  onPress={handleRedeem}
                  disabled={redeemSaving || normalizeCode(redeemInput).length < MIN_LEN}
                  style={[
                    styles.btn,
                    styles.btnPrimary,
                    (redeemSaving || normalizeCode(redeemInput).length < MIN_LEN) && styles.btnDisabled
                  ]}
                >
                  <Text style={styles.btnPrimaryText}>
                    {redeemSaving ? tm("referralsHaveCodeApplying") : tm("referralsHaveCodeRedeem")}
                  </Text>
                </Pressable>
              </>
            ) : (
              <View style={styles.banner}>
                <Text style={styles.bannerText}>
                  {tm("referralsHaveCodeRedeemed", { code: myRedemption.code })}
                </Text>
              </View>
            )}

            {/* INVITEES */}
            <View style={styles.sectionHeaderTopMargin}>
              <Text style={styles.sectionTitle}>{tm("referralsInviteesHeading")}</Text>
            </View>
            {referrals.length === 0 ? (
              <Text style={styles.muted}>{tm("referralsInviteesEmpty")}</Text>
            ) : (
              referrals.map((row) => {
                const referee = row.referee || {};
                const displayName = referee.handle ? `@${referee.handle}` : (referee.displayName || "—");
                const level = Number(referee.level) || 0;
                const claimable = Boolean(row.claimable);
                const claimed = Boolean(row.referrerClaimedAt);
                const isClaiming = claimingId === row.id;
                return (
                  <View key={row.id} style={styles.card}>
                    <View style={styles.cardRow}>
                      <Text style={styles.refereeName}>{displayName}</Text>
                      <Text style={styles.muted}>Lv. {level}</Text>
                    </View>
                    {claimed ? (
                      <Text style={styles.claimedText}>✓ {tm("referralsInviteeClaimed")}</Text>
                    ) : claimable ? (
                      <Pressable
                        onPress={() => handleClaim(row.id)}
                        disabled={isClaiming}
                        style={[styles.btn, styles.btnPrimary, isClaiming && styles.btnDisabled]}
                      >
                        <Text style={styles.btnPrimaryText}>
                          {isClaiming
                            ? tm("referralsInviteeClaiming")
                            : tm("referralsInviteeClaimCta", { tokens: REWARD_TOKENS })}
                        </Text>
                      </Pressable>
                    ) : (
                      <Text style={styles.muted}>
                        {tm("referralsInviteeProgress", { level: TARGET_LEVEL, tokens: REWARD_TOKENS })}
                      </Text>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a"
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#1e293b"
  },
  headerTitle: {
    color: "#e2e8f0",
    fontSize: 18,
    fontWeight: "800"
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: "#1e293b"
  },
  closeBtnText: {
    color: "#e2e8f0",
    fontSize: 16,
    fontWeight: "700"
  },
  body: {
    padding: 16,
    gap: 10
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 13,
    paddingHorizontal: 16,
    paddingTop: 8
  },
  loadingText: {
    color: "#94a3b8",
    textAlign: "center",
    padding: 24
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6
  },
  sectionHeaderTopMargin: {
    marginTop: 22,
    marginBottom: 6
  },
  sectionTitle: {
    color: "#22d3ee",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase"
  },
  sectionRight: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600"
  },
  card: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#1e293b",
    borderRadius: 12,
    padding: 14,
    gap: 8
  },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  codeText: {
    color: "#22d3ee",
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 2
  },
  refereeName: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "700"
  },
  muted: {
    color: "#94a3b8",
    fontSize: 12
  },
  hint: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6
  },
  input: {
    backgroundColor: "#0b1220",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    color: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 2,
    textTransform: "uppercase"
  },
  actionRow: {
    flexDirection: "row",
    gap: 8
  },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center"
  },
  btnPrimary: {
    backgroundColor: "#0284c7"
  },
  btnPrimaryText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 13,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  btnSecondary: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#334155"
  },
  btnSecondaryText: {
    color: "#cbd5e1",
    fontWeight: "700",
    fontSize: 12,
    letterSpacing: 0.6,
    textTransform: "uppercase"
  },
  btnDashed: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#22d3ee"
  },
  btnDisabled: {
    opacity: 0.5
  },
  banner: {
    backgroundColor: "#0c4a6e",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#0284c7"
  },
  bannerText: {
    color: "#bae6fd",
    fontSize: 13
  },
  claimedText: {
    color: "#22d3ee",
    fontSize: 12,
    fontWeight: "700"
  }
});
