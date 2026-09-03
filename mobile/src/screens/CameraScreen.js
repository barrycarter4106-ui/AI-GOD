import { useState } from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Switch, Text, View } from "react-native";
import * as storyApi from "../api/story";
import { useAuth } from "../context/AuthContext";
import { pickAndCompressImage } from "../media";

export default function CameraScreen({ route, navigation }) {
  const { circleId } = route.params;
  const { token } = useAuth();
  const [dataUri, setDataUri] = useState(null);
  const [isCollaborative, setIsCollaborative] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function pickFrom(launcher) {
    setError("");
    setBusy(true);
    try {
      const uri = await pickAndCompressImage(launcher);
      if (uri) setDataUri(uri);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function onPost() {
    if (!dataUri) return;
    setBusy(true);
    setError("");
    try {
      await storyApi.postStory(token, circleId, {
        media_url: dataUri,
        media_type: "image",
        is_collaborative: isCollaborative,
      });
      navigation.goBack();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      {dataUri ? (
        <Image source={{ uri: dataUri }} style={styles.preview} />
      ) : (
        <View style={[styles.preview, styles.placeholder]}>
          <Text style={{ color: "#888" }}>No photo selected</Text>
        </View>
      )}

      <View style={styles.pickRow}>
        <Pressable style={styles.pickButton} onPress={() => pickFrom("camera")} testID="pick-camera">
          <Text style={styles.pickButtonText}>Take Photo</Text>
        </Pressable>
        <Pressable style={styles.pickButton} onPress={() => pickFrom("library")} testID="pick-library">
          <Text style={styles.pickButtonText}>Choose Photo</Text>
        </Pressable>
      </View>

      <View style={styles.toggleRow}>
        <Text>Collaborative story</Text>
        <Switch value={isCollaborative} onValueChange={setIsCollaborative} testID="collaborative-toggle" />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable
        style={[styles.postButton, !dataUri && styles.postButtonDisabled]}
        onPress={onPost}
        disabled={!dataUri || busy}
        testID="post-story-submit"
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.postButtonText}>Post Story</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  preview: { width: "100%", aspectRatio: 1, borderRadius: 12, backgroundColor: "#eee", marginBottom: 16 },
  placeholder: { alignItems: "center", justifyContent: "center" },
  pickRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  pickButton: { flex: 1, backgroundColor: "#333", borderRadius: 8, padding: 12, alignItems: "center" },
  pickButtonText: { color: "#fff", fontWeight: "600" },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  postButton: { backgroundColor: "#5865f2", borderRadius: 8, padding: 14, alignItems: "center" },
  postButtonDisabled: { opacity: 0.5 },
  postButtonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#c0392b", marginBottom: 8 },
});
