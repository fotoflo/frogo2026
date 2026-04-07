import { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Dimensions,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { WebView } from "react-native-webview";
import { supabase } from "../../../lib/supabase";
import type { Video } from "../../../lib/types";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function WatchScreen() {
  const { slug, videoId } = useLocalSearchParams<{
    slug: string;
    videoId: string;
  }>();
  const [video, setVideo] = useState<Video | null>(null);
  const [playlist, setPlaylist] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const webviewRef = useRef<WebView>(null);

  useEffect(() => {
    async function load() {
      const { data: vid } = await supabase
        .from("videos")
        .select("*")
        .eq("id", videoId)
        .single();
      if (!vid) return;
      setVideo(vid);

      const { data: vids } = await supabase
        .from("videos")
        .select("*")
        .eq("channel_id", vid.channel_id)
        .order("position");
      setPlaylist(vids ?? []);
      setLoading(false);
    }
    load();
  }, [videoId]);

  if (loading || !video) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#7c5cfc" size="large" />
      </View>
    );
  }

  const currentIdx = playlist.findIndex((v) => v.id === video.id);
  const nextVideo = playlist[currentIdx + 1];
  const prevVideo = playlist[currentIdx - 1];

  const playerHtml = `
    <!DOCTYPE html>
    <html><head>
      <meta name="viewport" content="width=device-width,initial-scale=1">
      <style>body{margin:0;background:#000}iframe{width:100%;height:100vh}</style>
    </head><body>
      <iframe src="https://www.youtube.com/embed/${video.youtube_id}?autoplay=1&playsinline=1&modestbranding=1&rel=0"
        frameborder="0" allow="autoplay;encrypted-media" allowfullscreen></iframe>
    </body></html>
  `;

  return (
    <>
      <Stack.Screen options={{ title: video.title, headerShown: false }} />
      <View style={styles.container}>
        {/* YouTube Player */}
        <View style={{ width: SCREEN_WIDTH, height: SCREEN_WIDTH * 9 / 16 }}>
          <WebView
            ref={webviewRef}
            source={{ html: playerHtml }}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            style={{ flex: 1 }}
          />
        </View>

        <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 40 }}>
          <Text style={styles.videoTitle}>{video.title}</Text>
          <Text style={styles.videoDesc}>{video.description}</Text>

          {/* Nav buttons */}
          <View style={styles.navRow}>
            {prevVideo ? (
              <TouchableOpacity
                style={[styles.navBtn, { flex: 1 }]}
                onPress={() =>
                  router.replace(`/watch/${slug}/${prevVideo.id}`)
                }
              >
                <Text style={styles.navLabel}>Previous</Text>
                <Text style={styles.navTitle} numberOfLines={1}>
                  {prevVideo.title}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            {nextVideo ? (
              <TouchableOpacity
                style={[styles.navBtn, { flex: 1, alignItems: "flex-end" }]}
                onPress={() =>
                  router.replace(`/watch/${slug}/${nextVideo.id}`)
                }
              >
                <Text style={styles.navLabel}>Up Next</Text>
                <Text style={styles.navTitle} numberOfLines={1}>
                  {nextVideo.title}
                </Text>
              </TouchableOpacity>
            ) : (
              <View style={{ flex: 1 }} />
            )}
          </View>

          {/* Playlist */}
          <Text style={styles.sectionTitle}>Playlist</Text>
          {playlist.map((v) => (
            <TouchableOpacity
              key={v.id}
              style={[
                styles.playlistItem,
                v.id === video.id && styles.playlistItemActive,
              ]}
              onPress={() => router.replace(`/watch/${slug}/${v.id}`)}
            >
              <Text
                style={[
                  styles.playlistText,
                  v.id === video.id && { color: "#7c5cfc" },
                ]}
                numberOfLines={1}
              >
                {v.position}. {v.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Back button overlay */}
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={styles.backText}>&larr;</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0a0a0a" },
  center: { flex: 1, backgroundColor: "#0a0a0a", justifyContent: "center", alignItems: "center" },
  content: { flex: 1, padding: 16 },
  videoTitle: { color: "#ededed", fontSize: 18, fontWeight: "bold", marginBottom: 4 },
  videoDesc: { color: "#888", fontSize: 13, marginBottom: 16 },
  navRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  navBtn: {
    backgroundColor: "#141414",
    borderWidth: 1,
    borderColor: "#2a2a2a",
    borderRadius: 10,
    padding: 12,
  },
  navLabel: { color: "#888", fontSize: 11 },
  navTitle: { color: "#ededed", fontSize: 12, fontWeight: "500", marginTop: 2 },
  sectionTitle: { color: "#888", fontSize: 14, fontWeight: "500", marginBottom: 8 },
  playlistItem: { paddingVertical: 8, paddingHorizontal: 4 },
  playlistItemActive: {
    backgroundColor: "rgba(124,92,252,0.1)",
    borderRadius: 6,
  },
  playlistText: { color: "#ededed", fontSize: 13 },
  backBtn: {
    position: "absolute",
    top: 50,
    left: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 20,
    width: 36,
    height: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  backText: { color: "#fff", fontSize: 18 },
});
