import { API_BASE } from "./config";
import { request } from "./http";

export function listStories(token, circleId) {
  return request(API_BASE.story, `/circles/${circleId}/stories`, { token });
}

export function postStory(token, circleId, { media_url, media_type, is_collaborative }) {
  return request(API_BASE.story, `/circles/${circleId}/stories`, {
    method: "POST",
    token,
    body: { media_url, media_type, is_collaborative },
  });
}

export function getStory(token, storyId) {
  return request(API_BASE.story, `/stories/${storyId}`, { token });
}

export function contribute(token, storyId, mediaUrl) {
  return request(API_BASE.story, `/stories/${storyId}/contributions`, {
    method: "POST",
    token,
    body: { media_url: mediaUrl },
  });
}
