// Shared fetch wrapper — mirrors services/_shared/http.js's naming on the
// backend. Just enough to avoid repeating JSON.stringify/res.json()/
// error-throwing in every api/*.js file; not a general client library.
export async function request(base, path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(base + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `request failed: ${res.status}`);
  return data;
}
