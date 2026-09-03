import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as circleApi from "../api/circle";
import { useAuth } from "../context/AuthContext";

// The invite link is "pulse://join/<token>" — deep-link handling isn't
// exercised in this environment (no simulator/emulator, can't test a
// custom URL scheme through a browser tab), so this screen accepts either
// the raw token or the full link pasted in, and just strips the prefix.
function extractToken(input) {
  const trimmed = input.trim();
  const marker = "pulse://join/";
  return trimmed.startsWith(marker) ? trimmed.slice(marker.length) : trimmed;
}

export default function JoinCircleScreen({ navigation }) {
  const { token } = useAuth();
  const [inviteInput, setInviteInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onJoin() {
    setError("");
    setBusy(true);
    try {
      const circle = await circleApi.joinCircle(token, extractToken(inviteInput));
      navigation.replace("CircleDetail", { circleId: circle.id, circleName: circle.name });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Paste an invite link or token</Text>
      <TextInput
        style={styles.input}
        placeholder="pulse://join/... or just the token"
        autoCapitalize="none"
        value={inviteInput}
        onChangeText={setInviteInput}
        testID="invite-input"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable style={styles.button} onPress={onJoin} disabled={busy} testID="join-submit">
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Join</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  label: { fontSize: 16, marginBottom: 8 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: "#5865f2", borderRadius: 8, padding: 14, alignItems: "center", marginTop: 16 },
  buttonText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  error: { color: "#c0392b", marginTop: 8 },
});
