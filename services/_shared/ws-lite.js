// ws-lite.js — a minimal, real WebSocket server (RFC 6455), built on
// Node's built-in `http`/`crypto`/`net` only. No `ws` package — this
// sandbox has no npm registry access. This implements the actual
// handshake and frame protocol (not a long-polling substitute), so it's
// wire-compatible with any real WebSocket client.
//
// Supports: text frames, close frames, ping/pong. Good enough for the
// presence/reaction use case. Swap for the `ws` package once this
// project has normal npm access — that gets you permessage-deflate,
// better backpressure handling, and far more production hardening than
// is worth hand-rolling here.

const crypto = require("crypto");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

function acceptKey(key) {
  return crypto.createHash("sha1").update(key + WS_MAGIC).digest("base64");
}

function encodeFrame(payload, opcode = 0x1) {
  const payloadBuf = Buffer.from(payload);
  const len = payloadBuf.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payloadBuf]);
}

// KNOWN LIMITATION (found in continued testing, deliberately not fixed):
// this decoder does not check the FIN bit and has no continuation-frame
// (opcode 0x0) reassembly. It assumes every frame is a complete message.
// This is safe for Pulse's actual usage — every message we send (identify,
// reactions) is a small JSON control message, far under any fragmentation
// threshold real clients use — but it means this implementation is not a
// spec-complete WebSocket server. A large message from an arbitrary
// compliant client could be silently dropped. Swap for the real `ws`
// package (see file header) before using this for anything beyond
// Pulse's specific small-message use case.
//
// Decodes one frame from a buffer. Returns { opcode, payload, rest } or
// null if the buffer doesn't yet contain a full frame.
function decodeFrame(buf) {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let len = buf[1] & 0x7f;
  let offset = 2;

  if (len === 126) {
    if (buf.length < 4) return null;
    len = buf.readUInt16BE(2);
    offset = 4;
  } else if (len === 127) {
    if (buf.length < 10) return null;
    len = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }

  const maskLen = masked ? 4 : 0;
  if (buf.length < offset + maskLen + len) return null; // incomplete

  let payload;
  if (masked) {
    const mask = buf.slice(offset, offset + 4);
    const data = buf.slice(offset + 4, offset + 4 + len);
    payload = Buffer.alloc(len);
    for (let i = 0; i < len; i++) payload[i] = data[i] ^ mask[i % 4];
  } else {
    payload = buf.slice(offset, offset + len);
  }

  return { opcode, payload, rest: buf.slice(offset + maskLen + len) };
}

/**
 * Attach a WebSocket upgrade handler to an http.Server.
 * @param {http.Server} server
 * @param {(pathname) => boolean} shouldUpgrade
 * @param {(socket, pathname, params) => void} onConnection
 * @param {(pattern, pathname) => object|null} matchRoute
 */
function attachWebSocketServer(server, routePattern, onConnection, matchRoute) {
  server.on("upgrade", (req, socket, head) => {
    const params = matchRoute(routePattern, req.url.split("?")[0]);
    const key = req.headers["sec-websocket-key"];
    if (!params || !key) {
      socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
      socket.destroy();
      return;
    }

    const accept = acceptKey(key);
    socket.write(
      "HTTP/1.1 101 Switching Protocols\r\n" +
        "Upgrade: websocket\r\n" +
        "Connection: Upgrade\r\n" +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );

    let buffer = Buffer.alloc(0);

    const ws = {
      send(text) {
        socket.write(encodeFrame(text, 0x1));
      },
      close() {
        try {
          socket.write(encodeFrame("", 0x8));
        } catch (_) {}
        socket.destroy();
      },
      onMessage: null,
      onClose: null,
    };

    socket.on("data", (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      let frame;
      while ((frame = decodeFrame(buffer))) {
        buffer = frame.rest;
        if (frame.opcode === 0x8) {
          // close
          ws.close();
          return;
        }
        if (frame.opcode === 0x9) {
          // ping -> pong
          socket.write(encodeFrame(frame.payload, 0xa));
          continue;
        }
        if (frame.opcode === 0x1 && ws.onMessage) {
          ws.onMessage(frame.payload.toString("utf8"));
        }
      }
    });

    socket.on("close", () => ws.onClose && ws.onClose());
    socket.on("error", () => ws.onClose && ws.onClose());

    onConnection(ws, params);
  });
}

module.exports = { attachWebSocketServer, encodeFrame, decodeFrame, acceptKey };
