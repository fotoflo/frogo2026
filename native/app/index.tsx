import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../lib/supabase";
import type { Channel } from "../lib/types";

export default function ChannelsScreen() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    supabase
      .from("channels")
      .select("*")
      .order("name")
      .then(({ data }) => {
        setChannels(data ?? []);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cfc" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>frogo.tv</Text>
      <Text style={styles.subtitle}>Watch Together</Text>

      <FlatList
        data={channels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingBottom: 32 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/channel/${item.slug}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.icon}>{item.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.channelName}>{item.name}</Text>
              <Text style={styles.channelDesc} numberOfLines={1}>
                {item.description}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={styles.pairButton}
        onPress={() => router.push("/pair")}
      >
        <Text style={styles.pairButtonText}>Pair with TV</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 20, paddingTop: 60 },
  center: { flex: 1, backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" },
  title: { color: "#ededed", fontSize: 28, fontWeight: "bold" },
  subtitle: { color: "#888", fontSize: 16, marginBottom: 24 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
  },
  icon: { fontSize: 28 },
  channelName: { color: "#ededed", fontSize: 16, fontWeight: "600" },
  channelDesc: { color: "#888", fontSize: 12, marginTop: 2 },
  pairButton: {
    backgroundColor: "#7c5cfc",
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 12,
  },
  pairButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
});
