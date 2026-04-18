import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchGameState, freezeStreak, buyExtraReroll } from "../api/client";
import PortalPreloader from "../components/PortalPreloader";

const USERNAME_KEY = "mobile_username";

export default function VaultScreen() {
  const [username, setUsername] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);

  useEffect(() => {
    async function loadState() {
      try {
        const saved = await AsyncStorage.getItem(USERNAME_KEY);
        if (saved) {
          setUsername(saved);
          const response = await fetchGameState(saved);
          setState({
            tokens: Number(response?.user?.tokens ?? 0),
            streakFreezeActive: response?.user?.streakFreezeExpiresAt ? true : false,
            extraRerollsToday: Number(response?.extraRerollsToday ?? 0),
            hasRerolledToday: response?.hasRerolledToday === true
          });
        }
      } catch (error) {
        Alert.alert("Load error", error.message);
      } finally {
        setLoading(false);
      }
    }

    loadState();
  }, []);

  async function handleFreezeStreak() {
    if (state.tokens < 3) {
      Alert.alert("Not enough tokens", "You need 3 tokens to freeze your streak.");
      return;
    }

    setPurchasing(true);
    try {
      await freezeStreak(username);
      setState(prev => ({
        ...prev,
        tokens: prev.tokens - 3,
        streakFreezeActive: true
      }));
      Alert.alert("Success", "Your streak has been frozen!");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setPurchasing(false);
    }
  }

  async function handleBuyReroll() {
    if (state.tokens < 1) {
      Alert.alert("Not enough tokens", "You need 1 token for extra reroll.");
      return;
    }

    if (!state.hasRerolledToday) {
      Alert.alert("Free reroll available", "Use your free daily reroll first!");
      return;
    }

    setPurchasing(true);
    try {
      await buyExtraReroll(username);
      setState(prev => ({
        ...prev,
        tokens: prev.tokens - 1,
        extraRerollsToday: prev.extraRerollsToday + 1
      }));
      Alert.alert("Success", "Extra reroll purchased!");
    } catch (error) {
      Alert.alert("Error", error.message);
    } finally {
      setPurchasing(false);
    }
  }

  if (loading) {
    return <PortalPreloader title="Summoning Portal..." />;
  }

  if (!state) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>No vault data available</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <View style={styles.tokenDisplay}>
          <Text style={styles.tokenIcon}>🪙</Text>
          <Text style={styles.tokenCount}>{state.tokens}</Text>
        </View>
        <Text style={styles.title}>Token Vault</Text>
      </View>

      <View style={styles.shop}>
        <ShopItem
          icon="🧊"
          title="Streak Freeze"
          description="Protect your streak for one day"
          cost={3}
          active={state.streakFreezeActive}
          activeLabel="Active"
          canBuy={state.tokens >= 3 && !state.streakFreezeActive}
          onBuy={handleFreezeStreak}
          disabled={purchasing}
        />

        <ShopItem
          icon="🎲"
          title="Extra Reroll"
          description="Get an extra random quest reroll"
          cost={1}
          available={state.extraRerollsToday}
          canBuy={state.tokens >= 1 && state.hasRerolledToday}
          onBuy={handleBuyReroll}
          disabled={purchasing}
        />
      </View>
    </ScrollView>
  );
}

function ShopItem({ icon, title, description, cost, active, activeLabel, available, canBuy, onBuy, disabled }) {
  return (
    <View style={styles.item}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemIcon}>{icon}</Text>
        <View style={styles.itemInfo}>
          <Text style={styles.itemTitle}>{title}</Text>
          <Text style={styles.itemDesc}>{description}</Text>
        </View>
        <View style={styles.costBadge}>
          <Text style={styles.costIcon}>🪙</Text>
          <Text style={styles.costText}>{cost}</Text>
        </View>
      </View>

      {active && (
        <View style={styles.activeLabel}>
          <Text style={styles.activeLabelText}>{activeLabel}</Text>
        </View>
      )}

      {available ? (
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{available} ready</Text>
        </View>
      ) : null}

      <Pressable
        style={[styles.button, !canBuy && styles.buttonDisabled]}
        onPress={onBuy}
        disabled={!canBuy || disabled}
      >
        {disabled && <ActivityIndicator color="#f8fafc" style={{ marginRight: 8 }} />}
        <Text style={styles.buttonText}>
          {active ? "Active" : `Buy for ${cost}`}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a"
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20
  },
  header: {
    alignItems: "center",
    marginBottom: 32
  },
  tokenDisplay: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    justifyContent: "center"
  },
  tokenIcon: {
    fontSize: 36,
    marginRight: 8
  },
  tokenCount: {
    fontSize: 32,
    fontWeight: "700",
    color: "#a78bfa"
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e2e8f0"
  },
  shop: {
    gap: 12
  },
  item: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 16
  },
  itemHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 12
  },
  itemIcon: {
    fontSize: 28,
    marginRight: 12
  },
  itemInfo: {
    flex: 1
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#e2e8f0"
  },
  itemDesc: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 4
  },
  costBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1e293b",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  costIcon: {
    fontSize: 14,
    marginRight: 4
  },
  costText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#22d3ee"
  },
  activeLabel: {
    backgroundColor: "#164e63",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: "flex-start"
  },
  activeLabelText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#67e8f9"
  },
  statusBadge: {
    backgroundColor: "#6b21a8",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 8,
    alignSelf: "flex-start"
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#e879f9"
  },
  button: {
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row"
  },
  buttonDisabled: {
    backgroundColor: "#334155",
    opacity: 0.6
  },
  buttonText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 14
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20
  }
});
