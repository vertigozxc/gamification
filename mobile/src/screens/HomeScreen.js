import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import QuestItem from "../components/QuestItem";
import { completeQuest, fetchAllQuests, fetchGameState, upsertProfile } from "../api/client";

const USERNAME_KEY = "mobile_username";

function normalizeQuest(raw) {
  return {
    id: Number(raw?.id),
    title: String(raw?.title || "Quest"),
    desc: String(raw?.desc ?? raw?.description ?? ""),
    xp: Number(raw?.xp ?? raw?.base_xp ?? 0)
  };
}

export default function HomeScreen() {
  const [username, setUsername] = useState("");
  const [usernameDraft, setUsernameDraft] = useState("");
  const [authError, setAuthError] = useState("");
  const [initializing, setInitializing] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [state, setState] = useState(null);
  const [quests, setQuests] = useState([]);
  const [completed, setCompleted] = useState([]);

  async function hydrate(targetUsername) {
    const [gameStateResponse, allQuests] = await Promise.all([
      fetchGameState(targetUsername),
      fetchAllQuests()
    ]);

    setState({
      lvl: Number(gameStateResponse?.user?.level ?? 1),
      xp: Number(gameStateResponse?.user?.xp ?? 0),
      xpNext: Number(gameStateResponse?.user?.xpNext ?? 300),
      streak: Number(gameStateResponse?.streak ?? 0),
      tokens: Number(gameStateResponse?.user?.tokens ?? 0)
    });

    setCompleted(Array.isArray(gameStateResponse?.completedQuestIds) ? gameStateResponse.completedQuestIds : []);
    setQuests(Array.isArray(allQuests?.allQuests) ? allQuests.allQuests.map(normalizeQuest) : []);
  }

  async function bootstrap() {
    setInitializing(true);
    try {
      const saved = await AsyncStorage.getItem(USERNAME_KEY);
      if (!saved) {
        setInitializing(false);
        return;
      }

      setUsername(saved);
      setUsernameDraft(saved);
      await hydrate(saved);
    } catch (error) {
      Alert.alert("Startup error", error.message);
    } finally {
      setInitializing(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  async function handleSaveUsername() {
    const normalized = usernameDraft.trim().toLowerCase();
    if (!normalized) {
      Alert.alert("Username required", "Enter your username to load your game state.");
      return;
    }

    try {
      setAuthError("");
      setSubmitting(true);
      await upsertProfile(normalized, normalized, "");
      await hydrate(normalized);
      await AsyncStorage.setItem(USERNAME_KEY, normalized);
      setUsername(normalized);
    } catch (error) {
      setAuthError(error.message || "Profile sync failed");
      Alert.alert("Profile sync failed", error.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRefresh() {
    if (!username) return;
    setRefreshing(true);
    try {
      await hydrate(username);
    } catch (error) {
      Alert.alert("Refresh failed", error.message);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleCompleteQuest(quest) {
    if (!username || completed.includes(quest.id)) return;
    try {
      await completeQuest(username, quest.id);
      await handleRefresh();
    } catch (error) {
      Alert.alert("Complete failed", error.message);
    }
  }

  const header = useMemo(() => {
    if (!state) {
      return null;
    }

    return (
      <View style={styles.statsWrap}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Level</Text>
          <Text style={styles.statValue}>{state.lvl}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Streak</Text>
          <Text style={styles.statValue}>{state.streak}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Tokens</Text>
          <Text style={styles.statValue}>{state.tokens}</Text>
        </View>
      </View>
    );
  }, [state]);

  if (initializing) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color="#22d3ee" />
      </View>
    );
  }

  if (!username) {
    return (
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.authScreenContent}>
          <Text style={styles.title}>Life RPG Mobile (iOS beta)</Text>
          <View style={styles.authBox}>
            <TextInput
              value={usernameDraft}
              onChangeText={setUsernameDraft}
              placeholder="Enter username"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!submitting}
              style={styles.input}
              placeholderTextColor="#64748b"
              returnKeyType="done"
              onSubmitEditing={handleSaveUsername}
            />
            <Pressable disabled={submitting} style={[styles.saveButton, submitting && styles.saveButtonDisabled]} onPress={handleSaveUsername}>
              <Text style={styles.saveButtonText}>{submitting ? "Loading..." : "Load Profile"}</Text>
            </Pressable>
            {!!authError && <Text style={styles.errorText}>{authError}</Text>}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Life RPG Mobile (iOS beta)</Text>

      <FlatList
        data={quests}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        renderItem={({ item }) => (
          <QuestItem
            quest={item}
            disabled={completed.includes(item.id)}
            onComplete={() => handleCompleteQuest(item)}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#22d3ee" />}
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    backgroundColor: "#0f172a"
  },
  title: {
    color: "#e2e8f0",
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 12
  },
  authScreenContent: {
    flexGrow: 1,
    justifyContent: "center"
  },
  authBox: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "#334155",
    borderRadius: 12,
    padding: 10,
    marginBottom: 12,
    gap: 8
  },
  input: {
    backgroundColor: "#0b1220",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    color: "#e2e8f0",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  saveButton: {
    backgroundColor: "#0284c7",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  saveButtonDisabled: {
    backgroundColor: "#334155"
  },
  saveButtonText: {
    color: "#f8fafc",
    fontWeight: "700"
  },
  errorText: {
    color: "#fda4af",
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center"
  },
  statsWrap: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  statCard: {
    flex: 1,
    backgroundColor: "#111827",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#334155",
    padding: 10
  },
  statLabel: {
    color: "#94a3b8",
    fontSize: 12
  },
  statValue: {
    color: "#e2e8f0",
    marginTop: 4,
    fontWeight: "800",
    fontSize: 20
  },
  listContent: {
    paddingBottom: 26
  }
});
