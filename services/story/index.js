// Story Service
// Owns: Story, StoryContribution
// Scope: services/story/SCOPE.md
// Resolved decisions applied: expiry via query-time filtering (no
// background worker); contributions expire with their parent story.

const http = require("http");
const url = require("url");
const { db, uuid, nowISO, userFromToken, isMember } = require("../_shared/store");
const { sendJSON, readBody, authHeader, matchRoute } = require("../_shared/http");

const DAY_MS = 24 * 60 * 60 * 1000;

function requireAuth(req, res) {
  const token = authHeader(req);
  const user = token && userFromToken(token);
  if (!user) {
    sendJSON(res, 401, { error: "authentication required" });
    return null;
  }
  return user;
}

function isActive(story) {
  return new Date(story.expires_at).getTime() > Date.now();
}

async function handleListStories(req, res, params) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!isMember(params.id, user.id)) return sendJSON(res, 403, { error: "not a member of this circle" });

  const stories = [...db.stories.values()]
    .filter((s) => s.circle_id === params.id && isActive(s)) // query-time expiry filter, resolved decision
    .map((s) => ({
      ...s,
      contributions: s.is_collaborative
        ? [...db.contributions.values()].filter((c) => c.story_id === s.id)
        : undefined,
    }));
  return sendJSON(res, 200, stories);
}

async function handlePostStory(req, res, params) {
  const user = requireAuth(req, res);
  if (!user) return;
  if (!isMember(params.id, user.id)) return sendJSON(res, 403, { error: "not a member of this circle" });

  const body = await readBody(req);
  if (!body.media_url || !body.media_type) {
    return sendJSON(res, 400, { error: "media_url and media_type are required" });
  }
  const createdAt = nowISO();
  const story = {
    id: uuid(),
    circle_id: params.id,
    author_id: user.id,
    media_url: body.media_url,
    media_type: body.media_type, // "image" | "video"
    created_at: createdAt,
    expires_at: new Date(Date.now() + DAY_MS).toISOString(),
    is_collaborative: !!body.is_collaborative,
    collab_window_closes_at: body.is_collaborative
      ? body.collab_window_closes_at || new Date(Date.now() + DAY_MS).toISOString()
      : null,
  };
  db.stories.set(story.id, story);
  return sendJSON(res, 201, story);
}

async function handleContribute(req, res, params) {
  const user = requireAuth(req, res);
  if (!user) return;
  const story = db.stories.get(params.id);
  if (!story) return sendJSON(res, 404, { error: "story not found" });
  if (!story.is_collaborative) return sendJSON(res, 400, { error: "this story is not collaborative" });
  if (!isActive(story)) return sendJSON(res, 410, { error: "story has expired" });
  if (!isMember(story.circle_id, user.id)) return sendJSON(res, 403, { error: "not a member of this circle" });

  const body = await readBody(req);
  if (!body.media_url) return sendJSON(res, 400, { error: "media_url is required" });

  const contribution = {
    id: uuid(),
    story_id: story.id,
    contributor_id: user.id,
    media_url: body.media_url,
    created_at: nowISO(),
    // no independent expires_at — resolved decision: expires with parent story
  };
  db.contributions.set(contribution.id, contribution);
  return sendJSON(res, 201, contribution);
}

function createServer() {
  return http.createServer(async (req, res) => {
    const { pathname } = url.parse(req.url);
    let params;
    try {
      if (req.method === "GET" && (params = matchRoute("/circles/:id/stories", pathname))) {
        return await handleListStories(req, res, params);
      }
      if (req.method === "POST" && (params = matchRoute("/circles/:id/stories", pathname))) {
        return await handlePostStory(req, res, params);
      }
      if (req.method === "POST" && (params = matchRoute("/stories/:id/contributions", pathname))) {
        return await handleContribute(req, res, params);
      }
      sendJSON(res, 404, { error: "not found" });
    } catch (err) {
      sendJSON(res, 500, { error: "internal error", detail: err.message });
    }
  });
}

module.exports = { createServer, isActive };

if (require.main === module) {
  const PORT = process.env.STORY_PORT || 4003;
  createServer().listen(PORT, () => console.log(`Story Service listening on ${PORT}`));
}
