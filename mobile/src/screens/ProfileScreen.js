import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";

// No update-profile endpoint exists on the backend (auth/index.js has
// only signup/login/verify), so this is deliberately view-only for MVP.
export default function ProfileScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.handle}>@{user?.handle}</Text>
      <Text style={styles.displayName}>{user?.display_name}</Text>
      <Pressable style={styles.logoutButton} onPress={logout} testID="logout-button">
        <Text style={styles.logoutButtonText}>Log out</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", padding: 32, paddingTop: 64 },
  handle: { fontSize: 24, fontWeight: "700" },
  displayName: { fontSize: 16, color: "#666", marginTop: 4 },
  logoutButton: { marginTop: 32, backgroundColor: "#c0392b", borderRadius: 8, padding: 12, paddingHorizontal: 24 },
  logoutButtonText: { color: "#fff", fontWeight: "600" },
});
