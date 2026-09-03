import { API_BASE } from "./config";
import { request } from "./http";

export function myCircles(token) {
  return request(API_BASE.circle, "/circles/mine", { token });
}

export function createCircle(token, name) {
  return request(API_BASE.circle, "/circles", { method: "POST", token, body: { name } });
}

export function getCircle(token, circleId) {
  return request(API_BASE.circle, `/circles/${circleId}`, { token });
}

export function createInvite(token, circleId) {
  return request(API_BASE.circle, `/circles/${circleId}/invite`, { method: "POST", token });
}

export function joinCircle(token, inviteToken) {
  return request(API_BASE.circle, `/circles/join/${inviteToken}`, { method: "POST", token });
}
