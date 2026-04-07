import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
} from "react-native";
import { Stack } from "expo-router";
import { supabase } from "../lib/supabase";
import { API_BASE } from "../lib/supabase";

export default function PairScreen() {
  const [code, setCode] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [paired, setPaired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  async function handlePair() {
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/pair/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setSessionId(data.sessionId);
      setPaired(true);
    } catch {
      setError("Connection failed");
    }
  }

  async function sendCommand(command: string) {
    if (!sessionId) return;
    const now = new Date().toISOString();
    const updates: Record<string, any> = {
      last_command: command,
      last_command_at: now,
    };
    if (command === "play") {
      updates.playback_state = "playing";
      setIsPlaying(true);
    } else if (command === "pause") {
      updates.playback_state = "paused";
      setIsPlaying(false);
    }

    await supabase
      .from("pairing_sessions")
      .update(updates)
      .eq("id", sessionId);
  }

  if (!paired) {
    return (
      <>
        <Stack.Screen options={{ title: "Pair with TV" }} />
        <View style={styles.container}>
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>Pair as Remote</Text>
          <Text style={styles.subtitle}>
            Enter the 4-digit code on your TV
          </Text>

          <TextInput
            style={styles.input}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ""))}
            maxLength={4}
            keyboardType="number-pad"
            placeholder="0000"
            placeholderTextColor="#555"
            autoFocus
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <TouchableOpacity
            style={[styles.button, code.length !== 4 && { opacity: 0.4 }]}
            onPress={handlePair}
            disabled={code.length !== 4}
          >
            <Text style={styles.buttonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: "Remote" }} />
      <View style={styles.container}>
        <View style={styles.connectedBadge}>
          <View style={styles.dot} />
          <Text style={styles.connectedText}>Connected to TV</Text>
        </View>

        <TouchableOpacity
          style={styles.playPause}
          onPress={() => sendCommand(isPlaying ? "pause" : "play")}
          activeOpacity={0.8}
        >
          <Text style={styles.playPauseText}>
            {isPlaying ? "⏸ Pause" : "▶ Play"}
          </Text>
        </TouchableOpacity>

        <View style={styles.navRow}>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => sendCommand("prev")}
            activeOpacity={0.8}
          >
            <Text style={styles.navBtnText}>⏮ Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => sendCommand("next")}
            activeOpacity={0.8}
          >
            <Text style={styles.navBtnText}>Next ⏭</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.codeLabel}>Code: {code}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0a0a0a",
    padding: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emoji: { fontSize: 48, marginBottom: 16 },
  title: { color: "#ededed", fontSize: 24, fontWeight: "bold", marginBottom: 4 },
  subtitle: { color: "#888", fontSize: 14, marginBottom: 32 },
  input: {
    width: "100%",
    maxWidth: 280,
    textAlign: "center",
    fontSize: 36,
    fontWeight: "bold",
    fontFamily: "monospace",
    letterSpacing: 12,
    color: "#ededed",
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    padding: 20,
  },
  error: { color: "#f87171", fontSize: 14, marginTop: 12 },
  button: {
    width: "100%",
    maxWidth: 280,
    backgroundColor: "#7c5cfc",
    borderRadius: 12,
    padding: 18,
    alignItems: "center",
    marginTop: 20,
  },
  buttonText: { color: "#fff", fontSize: 18, fontWeight: "600" },
  connectedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.3)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 40,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#22c55e" },
  connectedText: { color: "#22c55e", fontSize: 14 },
  playPause: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "#7c5cfc",
    borderRadius: 16,
    paddingVertical: 36,
    alignItems: "center",
    marginBottom: 16,
  },
  playPauseText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
  navRow: { flexDirection: "row", gap: 12, width: "100%", maxWidth: 320 },
  navBtn: {
    flex: 1,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
  },
  navBtnText: { color: "#ededed", fontSize: 16, fontWeight: "500" },
  codeLabel: { color: "#555", fontSize: 12, marginTop: 32, fontFamily: "monospace" },
});
