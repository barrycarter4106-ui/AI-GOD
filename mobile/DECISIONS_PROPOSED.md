# Frontend/Mobile UI — Proposal on Open Decisions

The spec (`Pulse_Architecture_Spec.md`) gives this layer four screen names
and nothing else — no wireframes, design tokens, or navigation spec. This
follows the same pattern `services/presence/DECISIONS_PROPOSED.md` uses:
concrete proposed defaults, not silent decisions. **Confirm or override
before this ships past local testing.**

## 1. Media storage placeholder

**Proposal: base64 data URIs as `media_url`, no real upload/CDN.**

No object storage service exists anywhere in the backend, and
`services/story/index.js`'s `handlePostStory` only checks `media_url` is
truthy — zero format validation. So `CameraScreen`/the collaborative
contribution flow encode the picked photo as a `data:image/jpeg;base64,...`
string and pass it straight through. `<Image source={{uri}}>` renders this
natively; `expo-image-manipulator` downscales to max 1024px width and
compresses to JPEG q=0.5 first, since the backend's in-memory `Map` store
has no size limits and an unshrunk photo would bloat every response that
returns a story. **Replace with real object storage before this handles
more than local/seed-test traffic** — same phrasing the backend's own
`services/_shared/store.js` uses for itself.

## 2. Photo only, not video, for MVP

`media_type` accepts `"video"` server-side, but a base64-encoded video
clip is an impractically large JSON payload over `fetch`. `CameraScreen`
only offers photo capture/selection. Revisit once real upload (see #1)
exists — video makes far more sense once media travels as a multipart
upload rather than inline JSON.

## 3. "List my circles" — added a backend endpoint rather than a client workaround

The backend had no way to answer "which circles am I in" (only
`GET /circles/:id` for an ID you already have). Rather than have the
mobile app fake this with locally-remembered circle IDs — which breaks on
reinstall or a second device — `GET /circles/mine` was added to
`services/circle/index.js`, using the existing `db.members` data. Same
shape as the `GET /circles/:id/members` endpoint added in an earlier
session.

## 4. Deep links not implemented — manual invite-token paste instead

Invites are `pulse://join/<token>` links. Handling that custom URL scheme
needs a real device/simulator to test (this environment has neither Xcode
nor an Android emulator — see the mobile README), so `JoinCircleScreen`
accepts either the full link or a bare token pasted in, and strips the
`pulse://join/` prefix itself. Wire up real deep-link handling
(`expo-linking`) once there's a device to test it on.

## 5. `Share.share()` has no web implementation — link is always shown, not only shared

Discovered during verification: `react-native-web`'s `Share` module
throws `"Share is not supported in this browser"` — there's no web
fallback. `CircleDetailScreen` now always displays the generated invite
link as selectable text and treats `Share.share()` as a bonus that's
silently skipped if it throws, rather than the only way to get the link.

---

**Implementation proceeds using these defaults.** Each is called out in
a code comment at the point it's used.
