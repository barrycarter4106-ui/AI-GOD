// Pulse has no API gateway — each backend service is its own port. Defaults
// match each service's own hardcoded fallback (e.g. services/auth/index.js:
// `process.env.AUTH_PORT || 4001`). Expo inlines any env var prefixed
// EXPO_PUBLIC_ at build time — that's how a real device on the same LAN
// overrides localhost with the dev machine's IP later, without touching
// this file.
const DEFAULTS = {
  auth: "http://localhost:4001",
  circle: "http://localhost:4002",
  story: "http://localhost:4003",
  presence: "http://localhost:4004",
};

export const API_BASE = {
  auth: process.env.EXPO_PUBLIC_AUTH_URL || DEFAULTS.auth,
  circle: process.env.EXPO_PUBLIC_CIRCLE_URL || DEFAULTS.circle,
  story: process.env.EXPO_PUBLIC_STORY_URL || DEFAULTS.story,
  presence: process.env.EXPO_PUBLIC_PRESENCE_URL || DEFAULTS.presence,
};

// NOTE: reactions are POST /stories/:id/react on the PRESENCE service
// (port 4004), not the story service — confirmed in
// services/presence/index.js. Easy to get wrong since the path looks
// story-shaped.
export function presenceWsUrl(storyId) {
  return API_BASE.presence.replace(/^http/, "ws") + `/presence/${storyId}`;
}
