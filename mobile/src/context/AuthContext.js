import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/auth";

const STORAGE_KEY = "pulse_auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        const saved = JSON.parse(raw);
        setUser(saved.user);
        setToken(saved.token);
      }
      setLoading(false);
    });
  }, []);

  async function persist(session) {
    setUser(session.user);
    setToken(session.token);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }

  async function signup(fields) {
    const session = await authApi.signup(fields);
    await persist(session);
  }

  async function login(fields) {
    const session = await authApi.login(fields);
    await persist(session);
  }

  async function logout() {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, signup, login, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
