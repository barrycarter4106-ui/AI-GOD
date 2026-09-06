# Pulse Mobile

React Native (Expo) client for Pulse. See `DECISIONS_PROPOSED.md` for the
product/scope calls made while building this — no wireframes or nav spec
existed for this layer, so several defaults were proposed rather than
assumed silently.

## Running it

The backend has no gateway — Auth, Circle, Story, and Presence are four
separate services on four separate ports. Start all four first, from the
repo root:

```bash
node services/auth/index.js &
node services/circle/index.js &
node services/story/index.js &
node services/presence/index.js &
```

Then, from this directory:

```bash
npm install
npx expo start --web    # or: npm run ios / npm run android
```

**Web is the only target verified on the machine this was built on** — no
Xcode, no Android SDK/emulator were installed there, so the native iOS/
Android paths (real camera, native WebSocket reconnect behavior, deep
links, platform-specific rendering) are untested. If you have Xcode or
Android Studio, `npm run ios` / `npm run android` should work unmodified —
this is a standard Expo managed-workflow app with no native-only code.

## Pointing at a different backend

Each service's base URL can be overridden at build time via env vars
(see `src/api/config.js`), useful for testing against a real device on
the same LAN instead of `localhost`:

```bash
EXPO_PUBLIC_AUTH_URL=http://192.168.1.23:4001 \
EXPO_PUBLIC_CIRCLE_URL=http://192.168.1.23:4002 \
EXPO_PUBLIC_STORY_URL=http://192.168.1.23:4003 \
EXPO_PUBLIC_PRESENCE_URL=http://192.168.1.23:4004 \
npx expo start
```

## Structure

```
src/
  api/        one file per backend service, plus a shared fetch helper (http.js)
              and per-service base URLs (config.js)
  context/    AuthContext — token/session, persisted to AsyncStorage
  hooks/      usePresenceSocket — the WS connect/identify/reconnect lifecycle
  navigation/ RootNavigator — auth-gated stack switch
  screens/    one file per screen
  media.js    shared image-pick + compress + base64-encode helper
```

No state management library, no TypeScript build step — matches the
backend's own zero-build-tooling, no-premature-abstraction philosophy for
an app this size (8 endpoints, one WebSocket, 8 screens).
