import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Image,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { supabase } from "../../lib/supabase";
import type { Channel, Video } from "../../lib/types";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function ChannelScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function load() {
      const { data: ch } = await supabase
        .from("channels")
        .select("*")
        .eq("slug", slug)
        .single();
      if (!ch) return;
      setChannel(ch);

      const { data: vids } = await supabase
        .from("videos")
        .select("*")
        .eq("channel_id", ch.id)
        .order("position");
      setVideos(vids ?? []);
      setLoading(false);
    }
    load();
  }, [slug]);

  if (loading || !channel) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cfc" size="large" />
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${channel.icon} ${channel.name}` }} />
      <View style={styles.container}>
        <Text style={styles.desc}>{channel.description}</Text>

        <FlatList
          data={videos}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingBottom: 32 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.videoRow}
              onPress={() =>
                router.push(`/watch/${channel.slug}/${item.id}`)
              }
              activeOpacity={0.7}
            >
              <View style={styles.thumbWrap}>
                <Image
                  source={{ uri: item.thumbnail_url }}
                  style={styles.thumb}
                />
                <View style={styles.duration}>
                  <Text style={styles.durationText}>
                    {formatDuration(item.duration_seconds)}
                  </Text>
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.videoTitle} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={styles.videoDesc} numberOfLines={1}>
                  {item.description}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a", padding: 16 },
  center: { flex: 1, backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" },
  desc: { color: "#888", fontSize: 14, marginBottom: 16 },
  videoRow: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 8,
    marginBottom: 6,
  },
  thumbWrap: { width: 120, height: 68, borderRadius: 6, overflow: "hidden", position: "relative" },
  thumb: { width: "100%", height: "100%", backgroundColor: "#000" },
  duration: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: "rgba(0,0,0,0.8)",
    borderRadius: 3,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  durationText: { color: "#fff", fontSize: 10, fontFamily: "monospace" },
  videoTitle: { color: "#ededed", fontSize: 13, fontWeight: "500" },
  videoDesc: { color: "#888", fontSize: 11, marginTop: 2 },
});
