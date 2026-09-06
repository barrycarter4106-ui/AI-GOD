import { API_BASE } from "./config";
import { request } from "./http";

export function signup({ email, password, handle, display_name }) {
  return request(API_BASE.auth, "/auth/signup", {
    method: "POST",
    body: { email, password, handle, display_name },
  });
}

export function login({ email, password }) {
  return request(API_BASE.auth, "/auth/login", {
    method: "POST",
    body: { email, password },
  });
}
