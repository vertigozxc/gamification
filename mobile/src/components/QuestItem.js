import { Pressable, StyleSheet, Text, View } from "react-native";

export default function QuestItem({ quest, onComplete, disabled }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>{quest.title}</Text>
        <Text style={styles.xp}>+{quest.xp} XP</Text>
      </View>
      <Text style={styles.description}>{quest.desc}</Text>
      <Pressable disabled={disabled} style={[styles.button, disabled && styles.buttonDisabled]} onPress={onComplete}>
        <Text style={styles.buttonText}>{disabled ? "Completed" : "Complete"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#1e293b",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#334155"
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8
  },
  title: {
    color: "#e2e8f0",
    fontWeight: "700",
    flex: 1
  },
  xp: {
    color: "#67e8f9",
    fontWeight: "700"
  },
  description: {
    color: "#94a3b8",
    marginTop: 8,
    marginBottom: 12
  },
  button: {
    backgroundColor: "#0891b2",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center"
  },
  buttonDisabled: {
    backgroundColor: "#334155"
  },
  buttonText: {
    color: "#f8fafc",
    fontWeight: "700"
  }
});
