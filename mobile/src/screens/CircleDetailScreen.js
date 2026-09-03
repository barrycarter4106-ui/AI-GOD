import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, Image, Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as circleApi from "../api/circle";
import * as storyApi from "../api/story";
import { useAuth } from "../context/AuthContext";

export default function CircleDetailScreen({ route, navigation }) {
  const { circleId, circleName } = route.params;
  const { token } = useAuth();
  const [circle, setCircle] = useState(null);
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inviteLink, setInviteLink] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [circleData, storyData] = await Promise.all([
        circleApi.getCircle(token, circleId),
        storyApi.listStories(token, circleId),
      ]);
      setCircle(circleData);
      setStories(storyData);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token, circleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onInvite() {
    setError("");
    try {
      const { invite_link } = await circleApi.createInvite(token, circleId);
      // Always show the link so it's copyable — react-native-web has no
      // real Share implementation (throws "Share is not supported in
      // this browser"), so treat sharing as a bonus, not the only path.
      setInviteLink(invite_link);
      try {
        await Share.share({ message: `Join my circle "${circleName}" on Pulse: ${invite_link}` });
      } catch (_) {
        /* no native share sheet available (e.g. web) — link is already shown below */
      }
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <View style={styles.container}>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Text style={styles.memberCount} testID="member-count">
            {circle?.members ?? 0} member{circle?.members === 1 ? "" : "s"}
          </Text>

          <View style={styles.actionRow}>
            <Pressable style={styles.actionButton} onPress={onInvite} testID="invite-button">
              <Text style={styles.actionButtonText}>Invite</Text>
            </Pressable>
            <Pressable
              style={styles.actionButton}
              onPress={() => navigation.navigate("Camera", { circleId })}
              testID="new-story-button"
            >
              <Text style={styles.actionButtonText}>+ Story</Text>
            </Pressable>
          </View>

          {inviteLink ? (
            <Text style={styles.inviteLink} selectable testID="invite-link">
              {inviteLink}
            </Text>
          ) : null}

          <FlatList
            data={stories}
            keyExtractor={(s) => s.id}
            contentContainerStyle={{ paddingTop: 16 }}
            ListEmptyComponent={<Text style={styles.empty}>No active stories — be the first to post.</Text>}
            renderItem={({ item }) => (
              <Pressable
                style={styles.storyRow}
                onPress={() => navigation.navigate("StoryViewer", { storyId: item.id })}
                testID={`story-row-${item.id}`}
              >
                <Image source={{ uri: item.media_url }} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.storyMeta}>{item.is_collaborative ? "Collaborative" : "Story"}</Text>
                  {item.is_collaborative ? (
                    <Text style={styles.storyMeta}>{(item.contributions || []).length} contribution(s)</Text>
                  ) : null}
                </View>
              </Pressable>
            )}
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  memberCount: { color: "#666", marginBottom: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  actionButton: { flex: 1, backgroundColor: "#5865f2", borderRadius: 8, padding: 12, alignItems: "center" },
  actionButtonText: { color: "#fff", fontWeight: "600" },
  error: { color: "#c0392b", marginBottom: 8 },
  inviteLink: { marginTop: 12, padding: 10, backgroundColor: "#eef", borderRadius: 8, fontSize: 13 },
  empty: { textAlign: "center", color: "#888", marginTop: 24 },
  storyRow: { flexDirection: "row", gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: "#eee" },
  thumb: { width: 56, height: 56, borderRadius: 8, backgroundColor: "#ddd" },
  storyMeta: { color: "#444" },
});
