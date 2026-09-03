import { useCallback, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as circleApi from "../api/circle";
import { useAuth } from "../context/AuthContext";

export default function CircleListScreen({ navigation }) {
  const { token } = useAuth();
  const [circles, setCircles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setCircles(await circleApi.myCircles(token));
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Re-fetch every time this screen regains focus (e.g. after creating a
  // circle, joining one, or posting a story and navigating back).
  useFocusEffect(useCallback(() => { load(); }, [load]));

  async function onCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError("");
    try {
      await circleApi.createCircle(token, newName.trim());
      setNewName("");
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.createRow}>
        <TextInput
          style={styles.input}
          placeholder="New circle name"
          value={newName}
          onChangeText={setNewName}
          testID="circle-name-input"
        />
        <Pressable style={styles.createButton} onPress={onCreate} disabled={creating} testID="create-circle-submit">
          <Text style={styles.createButtonText}>{creating ? "…" : "Create"}</Text>
        </Pressable>
      </View>
      <Pressable onPress={() => navigation.navigate("JoinCircle")}>
        <Text style={styles.link}>Have an invite? Join a circle</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {loading ? (
        <ActivityIndicator style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={circles}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingTop: 16 }}
          ListEmptyComponent={<Text style={styles.empty}>No circles yet — create one above.</Text>}
          renderItem={({ item }) => (
            <Pressable
              style={styles.circleRow}
              onPress={() => navigation.navigate("CircleDetail", { circleId: item.id, circleName: item.name })}
              testID={`circle-row-${item.id}`}
            >
              <Text style={styles.circleName}>{item.name}</Text>
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.profileLink} onPress={() => navigation.navigate("Profile")}>
        <Text style={styles.link}>Profile</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  createRow: { flexDirection: "row", gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 10 },
  createButton: { backgroundColor: "#5865f2", borderRadius: 8, paddingHorizontal: 16, justifyContent: "center" },
  createButtonText: { color: "#fff", fontWeight: "600" },
  link: { color: "#5865f2", marginTop: 12 },
  error: { color: "#c0392b", marginTop: 8 },
  empty: { textAlign: "center", color: "#888", marginTop: 24 },
  circleRow: { padding: 16, borderBottomWidth: 1, borderBottomColor: "#eee" },
  circleName: { fontSize: 18, fontWeight: "600" },
  profileLink: { marginTop: 16, alignItems: "center" },
});
