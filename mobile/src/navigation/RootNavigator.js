import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import CameraScreen from "../screens/CameraScreen";
import CircleDetailScreen from "../screens/CircleDetailScreen";
import CircleListScreen from "../screens/CircleListScreen";
import JoinCircleScreen from "../screens/JoinCircleScreen";
import LoginScreen from "../screens/LoginScreen";
import ProfileScreen from "../screens/ProfileScreen";
import SignupScreen from "../screens/SignupScreen";
import StoryViewerScreen from "../screens/StoryViewerScreen";

const Stack = createNativeStackNavigator();

function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
    </Stack.Navigator>
  );
}

function AppStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="CircleList" component={CircleListScreen} options={{ title: "Your Circles" }} />
      <Stack.Screen name="CircleDetail" component={CircleDetailScreen} options={{ title: "Circle" }} />
      <Stack.Screen name="JoinCircle" component={JoinCircleScreen} options={{ title: "Join a Circle" }} />
      <Stack.Screen name="Camera" component={CameraScreen} options={{ title: "New Story" }} />
      <Stack.Screen name="StoryViewer" component={StoryViewerScreen} options={{ title: "Story" }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: "Profile" }} />
    </Stack.Navigator>
  );
}

export default function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#111" }}>
        <ActivityIndicator color="#fff" />
      </View>
    );
  }

  return <NavigationContainer>{token ? <AppStack /> : <AuthStack />}</NavigationContainer>;
}
