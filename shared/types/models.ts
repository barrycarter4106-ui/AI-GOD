// Pulse — Shared Data Model
// Source of truth: Pulse_Architecture_Spec.md, Section 1
// DO NOT edit outside the Architecture Agent workflow — schema changes go
// through the spec first, then get propagated here.

export type UUID = string;

export interface User {
  id: UUID;
  handle: string; // unique, no public follower/like counts anywhere
  display_name: string;
  avatar_url: string;
  created_at: string; // ISO timestamp
  auth_provider: "email" | "phone" | "oauth"; // GAP: which OAuth providers? see changelog
}

export interface Circle {
  id: UUID;
  name: string;
  owner_id: UUID; // FK -> User
  theme: Record<string, unknown> | null; // phase 2
  created_at: string;
  invite_token: string; // rotating, single active token per circle
}

export interface CircleMember {
  circle_id: UUID; // FK -> Circle
  user_id: UUID; // FK -> User
  joined_at: string;
  role: "owner" | "member";
}

export interface Story {
  id: UUID;
  circle_id: UUID; // FK -> Circle
  author_id: UUID; // FK -> User
  media_url: string;
  media_type: "image" | "video";
  created_at: string;
  expires_at: string; // default created_at + 24h — GAP: cleanup mechanism TBD
  is_collaborative: boolean;
  collab_window_closes_at: string | null;
}

export interface StoryContribution {
  id: UUID;
  story_id: UUID; // FK -> Story (parent collaborative story)
  contributor_id: UUID; // FK -> User
  media_url: string;
  created_at: string;
  // GAP: does this expire with parent story or independently? see changelog
}

// --- Ephemeral / real-time layer ---
// These MUST live in a fast in-memory store (e.g. Redis), never the
// primary relational database. This is a hard architecture rule, not a
// suggestion — see spec Section 1, "Design rule."

export interface PresenceEvent {
  story_id: UUID;
  user_id: UUID;
  status: "viewing" | "left";
  updated_at: string;
}

export interface Reaction {
  story_id: UUID;
  user_id: UUID;
  emoji: string; // limited set only, no free text
  created_at: string;
}
