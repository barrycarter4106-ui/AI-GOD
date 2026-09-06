// Plain JSDoc typedefs mirroring shared/types/models.ts (which is itself
// documentation-only — the JS backend doesn't consume it either). Kept
// here for editor autocomplete without adding a TypeScript build step,
// matching the rest of this repo's zero-build-tooling philosophy.

/**
 * @typedef {Object} User
 * @property {string} id
 * @property {string} handle
 * @property {string} display_name
 * @property {string} avatar_url
 * @property {string} created_at
 * @property {"email"|"phone"|"google"|"apple"} auth_provider
 */

/**
 * @typedef {Object} Circle
 * @property {string} id
 * @property {string} name
 * @property {string} owner_id
 * @property {Object|null} theme
 * @property {string} created_at
 * @property {string} invite_token
 */

/**
 * @typedef {Object} Story
 * @property {string} id
 * @property {string} circle_id
 * @property {string} author_id
 * @property {string} media_url
 * @property {"image"|"video"} media_type
 * @property {string} created_at
 * @property {string} expires_at
 * @property {boolean} is_collaborative
 * @property {string|null} collab_window_closes_at
 * @property {StoryContribution[]=} contributions
 */

/**
 * @typedef {Object} StoryContribution
 * @property {string} id
 * @property {string} story_id
 * @property {string} contributor_id
 * @property {string} media_url
 * @property {string} created_at
 */

export {};
