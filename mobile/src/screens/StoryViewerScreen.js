import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as presenceApi from "../api/presence";
import * as storyApi from "../api/story";
import { useAuth } from "../context/AuthContext";
import { usePresenceSocket } from "../hooks/usePresenceSocket";
import { pickAndCompressImage } from "../media";

// Fixed 6-emoji set, no free text — per presence/SCOPE.md: "limited set
// only, no free-text input" and presence/index.js's ALLOWED_EMOJI.
const EMOJI = ["❤️", "😂", "😮", "🔥", "👏", "😢"];

export default function StoryViewerScreen({ route }) {
  const { storyId } = route.params;
  const { token, user } = useAuth();
  const [story, setStory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [contributing, setContributing] = useState(false);
  const { viewerCount, reactions } = usePresenceSocket(storyId, token);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setStory(await storyApi.getStory(token, storyId));
    } catch (e) {
      // Stories can just disappear once expired — query-time filtering,
      // no push event fires (see story/SCOPE.md). A 404 here is expected,
      // not a bug, once the 24h window passes.
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, storyId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onReact(emoji) {
    try {
      await presenceApi.react(token, storyId, emoji);
    } catch (e) {
      setError(e.message);
    }
  }

  async function onContribute() {
    setError("");
    setContributing(true);
    try {
      const uri = await pickAndCompressImage("library");
      if (uri) {
        await storyApi.contribute(token, storyId, uri);
        await load();
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setContributing(false);
    }
  }

  if (loading) return <ActivityIndicator style={{ marginTop: 24 }} />;
  if (!story) return <Text style={styles.error}>{error || "Story not found."}</Text>;

  return (
    <ScrollView style={styles.container}>
      <Image source={{ uri: story.media_url }} style={styles.media} />
      <Text style={styles.viewerCount} testID="viewer-count">
        👀 {viewerCount} watching
      </Text>

      <View style={styles.emojiRow}>
        {EMOJI.map((emoji) => (
          <Pressable key={emoji} onPress={() => onReact(emoji)} testID={`react-${emoji}`}>
            <Text style={styles.emoji}>{emoji}</Text>
          </Pressable>
        ))}
      </View>

      {reactions.length > 0 ? (
        <Text style={styles.reactionLog} testID="reaction-log">
          {reactions.map((r) => r.emoji).join(" ")}
        </Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {story.is_collaborative ? (
        <View style={styles.collabSection}>
          <Text style={styles.collabTitle}>Collaborative story</Text>
          {(story.contributions || []).map((c) => (
            <Image key={c.id} source={{ uri: c.media_url }} style={styles.contribution} />
          ))}
          <Pressable style={styles.contributeButton} onPress={onContribute} disabled={contributing} testID="contribute-button">
            <Text style={styles.contributeButtonText}>{contributing ? "…" : "+ Add to this story"}</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  media: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#eee" },
  viewerCount: { marginTop: 12, color: "#666" },
  emojiRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  emoji: { fontSize: 32 },
  reactionLog: { marginTop: 8, fontSize: 18 },
  error: { color: "#c0392b", marginTop: 12 },
  collabSection: { marginTop: 24 },
  collabTitle: { fontWeight: "600", marginBottom: 8 },
  contribution: { width: "100%", aspectRatio: 1.5, borderRadius: 8, backgroundColor: "#eee", marginBottom: 8 },
  contributeButton: { backgroundColor: "#333", borderRadius: 8, padding: 12, alignItems: "center" },
  contributeButtonText: { color: "#fff", fontWeight: "600" },
});
