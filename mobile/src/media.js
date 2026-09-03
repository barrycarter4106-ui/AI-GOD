// Shared by CameraScreen (new story) and StoryViewerScreen (collaborative
// contribution) — both need "pick a photo, compress it, get a data URI"
// with identical logic, so it lives here once rather than twice.
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

// No CDN/upload service exists anywhere in the backend (story/index.js's
// handlePostStory only checks media_url is truthy — zero format
// validation), so this encodes the picked photo as a base64 data URI and
// passes it straight through as media_url. See mobile/DECISIONS_PROPOSED.md.
// Compressed/downscaled first (max 1024px, JPEG q=0.5) to keep the JSON
// payload reasonable, since the backend's in-memory store has no size caps.
async function toCompressedDataUri(asset) {
  const context = ImageManipulator.manipulate(asset.uri);
  context.resize({ width: 1024, height: null });
  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.5, base64: true });
  return result.base64.startsWith("data:") ? result.base64 : `data:image/jpeg;base64,${result.base64}`;
}

// Returns a compressed data-URI string, or null if the user cancelled /
// permission was denied (caller decides how to surface that).
export async function pickAndCompressImage(launcher) {
  const perm = await (launcher === "camera"
    ? ImagePicker.requestCameraPermissionsAsync()
    : ImagePicker.requestMediaLibraryPermissionsAsync());
  if (!perm.granted) throw new Error("Permission denied.");

  const result = await (launcher === "camera"
    ? ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 })
    : ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 }));
  if (result.canceled || !result.assets?.length) return null;

  return toCompressedDataUri(result.assets[0]);
}
