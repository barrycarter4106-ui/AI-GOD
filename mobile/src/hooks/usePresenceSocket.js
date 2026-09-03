import { useEffect, useRef, useState } from "react";
import { presenceWsUrl } from "../api/config";

const RECONNECT_DELAY_MS = 1000;

// Owns the WS connect -> identify -> listen -> reconnect lifecycle for a
// single story's presence room, so StoryViewerScreen itself stays
// declarative. Plain global WebSocket — the backend is a raw
// standards-compliant WS server (services/_shared/ws-lite.js), no
// socket.io-client needed.
export function usePresenceSocket(storyId, token) {
  const [viewerCount, setViewerCount] = useState(0);
  const [reactions, setReactions] = useState([]);
  const wsRef = useRef(null);
  const closedByUsRef = useRef(false);

  useEffect(() => {
    closedByUsRef.current = false;
    let reconnectTimer;

    function connect() {
      const ws = new WebSocket(presenceWsUrl(storyId));
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "identify", token }));
      };

      ws.onmessage = (event) => {
        let msg;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }
        if (msg.type === "presence") {
          setViewerCount(msg.viewer_count);
        } else if (msg.type === "reaction") {
          setReactions((prev) => [...prev, msg]);
        }
        // {type:"error", reason:"invalid_token"|"story_at_capacity"} is
        // also possible; the server closes the socket right after, which
        // onclose below will handle by reconnecting — acceptable for MVP,
        // a real error banner can be added once this needs polish.
      };

      ws.onclose = () => {
        if (!closedByUsRef.current) {
          reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };
    }

    connect();

    return () => {
      closedByUsRef.current = true;
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [storyId, token]);

  return { viewerCount, reactions };
}
