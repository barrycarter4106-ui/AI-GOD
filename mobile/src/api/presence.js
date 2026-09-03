// NOTE: reacting is a call to the PRESENCE service (4004), not the story
// service, even though the path looks story-shaped — confirmed in
// services/presence/index.js. See api/config.js for the same note.
import { API_BASE } from "./config";
import { request } from "./http";

export function react(token, storyId, emoji) {
  return request(API_BASE.presence, `/stories/${storyId}/react`, {
    method: "POST",
    token,
    body: { emoji },
  });
}
