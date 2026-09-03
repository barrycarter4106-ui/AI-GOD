// Cross-service story lookup — used by Presence to find a story's author
// for the "friends watching" notification trigger. Presence owns no
// Story data itself, so it asks Story directly, same pattern as
// authClient.js/circleClient.js.
const http = require("http");

function getStory(storyId, token) {
  return new Promise((resolve) => {
    if (!token || !storyId) return resolve(null);

    let base;
    try {
      base = new URL(process.env.STORY_SERVICE_URL || "http://localhost:4003");
    } catch (_) {
      return resolve(null);
    }

    const req = http.request(
      {
        hostname: base.hostname,
        port: base.port || 80,
        path: `/stories/${encodeURIComponent(storyId)}`,
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode !== 200) return resolve(null);
          try {
            resolve(JSON.parse(data));
          } catch (_) {
            resolve(null);
          }
        });
      }
    );
    req.on("error", () => resolve(null));
    req.end();
  });
}

module.exports = { getStory };
