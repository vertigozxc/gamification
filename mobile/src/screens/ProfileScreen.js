import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchGameState } from "../api/client";
import PortalPreloader from "../components/PortalPreloader";
import { tm } from "../i18n";

const USERNAME_KEY = "mobile_username";

export default function ProfileScreen() {
  const [username, setUsername] = useState("");
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProfile() {
      try {
        const saved = await AsyncStorage.getItem(USERNAME_KEY);
        if (saved) {
          setUsername(saved);
          const response = await fetchGameState(saved);
          setState({
            lvl: Number(response?.user?.level ?? 1),
            xp: Number(response?.user?.xp ?? 0),
            xpNext: Number(response?.user?.xpNext ?? 250),
            streak: Number(response?.streak ?? 0),
            tokens: Number(response?.user?.tokens ?? 0),
            displayName: response?.user?.displayName || saved
          });
        }
      } catch (error) {
        Alert.alert(tm("profileLoadError"), error.message);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, []);

  if (loading) {
    return <PortalPreloader title={tm("initializing")} />;
  }

  if (!state) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{tm("noProfileData")}</Text>
      </View>
    );
  }

  const xpPercent = Math.min(100, (state.xp / state.xpNext) * 100);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>{tm("profileTitle")}</Text>
        <Text style={styles.username}>{state.displayName}</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.label}>{tm("levelLabel")}</Text>
          <Text style={styles.value}>{state.lvl}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{tm("experienceProgress")}</Text>
        <Text style={styles.xpText}>
          {state.xp} / {state.xpNext} XP
        </Text>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${xpPercent}%` }
            ]}
          />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.label}>{tm("streakLabel")}</Text>
          <Text style={[styles.value, styles.streakValue]}>🔥 {state.streak}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.statRow}>
          <Text style={styles.label}>{tm("tokensLabel")}</Text>
          <Text style={[styles.value, styles.tokenValue]}>🪙 {state.tokens}</Text>
        </View>
      </View>

      <Pressable 
        style={styles.logoutButton}
        onPress={async () => {
          await AsyncStorage.removeItem(USERNAME_KEY);
          setUsername("");
          setState(null);
        }}
      >
        <Text style={styles.buttonText}>{tm("logoutLabel")}</Text>
      </Pressable>
    </ScrollView>
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
    marginBottom: 24
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: "#e2e8f0",
    marginBottom: 8
  },
  username: {
    fontSize: 18,
    color: "#94a3b8"
  },
  card: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#cbd5e1",
    marginBottom: 8
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  label: {
    fontSize: 14,
    color: "#94a3b8"
  },
  value: {
    fontSize: 24,
    fontWeight: "700",
    color: "#22d3ee"
  },
  streakValue: {
    color: "#fbbf24"
  },
  tokenValue: {
    color: "#a78bfa"
  },
  xpText: {
    fontSize: 12,
    color: "#94a3b8",
    marginBottom: 8
  },
  progressBar: {
    height: 8,
    backgroundColor: "#0b1220",
    borderRadius: 4,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#334155"
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#22d3ee",
    borderRadius: 4
  },
  loadingText: {
    color: "#cbd5e1",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20
  },
  errorText: {
    color: "#fca5a5",
    fontSize: 16,
    textAlign: "center",
    marginTop: 20
  },
  logoutButton: {
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 24,
    alignItems: "center"
  },
  buttonText: {
    color: "#f8fafc",
    fontWeight: "700",
    fontSize: 16
  }
});
