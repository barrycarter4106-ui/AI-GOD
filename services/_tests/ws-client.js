// Minimal WebSocket *client* for tests — mirrors ws-lite.js on the
// server side. Connects, sends/receives text frames. Enough to verify
// the Presence Service works end-to-end without an external `ws` dep.

const net = require("net");
const crypto = require("crypto");
const { encodeFrame, decodeFrame } = require("../_shared/ws-lite");

function connect(port, path) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(port, "localhost", () => {
      const key = crypto.randomBytes(16).toString("base64");
      socket.write(
        `GET ${path} HTTP/1.1\r\n` +
          `Host: localhost:${port}\r\n` +
          `Upgrade: websocket\r\n` +
          `Connection: Upgrade\r\n` +
          `Sec-WebSocket-Key: ${key}\r\n` +
          `Sec-WebSocket-Version: 13\r\n\r\n`
      );
    });

    let handshakeDone = false;
    let buffer = Buffer.alloc(0);
    const listeners = [];

    socket.on("data", (chunk) => {
      if (!handshakeDone) {
        const text = chunk.toString("utf8");
        if (text.includes("101 Switching Protocols")) {
          handshakeDone = true;
          const client = {
            send(text) {
              // Client frames must be masked per RFC 6455.
              const payload = Buffer.from(text);
              const mask = crypto.randomBytes(4);
              const masked = Buffer.alloc(payload.length);
              for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];
              const len = payload.length;
              let header;
              if (len < 126) header = Buffer.from([0x81, 0x80 | len]);
              else {
                header = Buffer.alloc(4);
                header[0] = 0x81;
                header[1] = 0x80 | 126;
                header.writeUInt16BE(len, 2);
              }
              socket.write(Buffer.concat([header, mask, masked]));
            },
            onMessage(fn) {
              listeners.push(fn);
            },
            close() {
              socket.destroy();
            },
          };
          resolve(client);
          const rest = chunk.slice(chunk.indexOf("\r\n\r\n") + 4);
          buffer = Buffer.concat([buffer, rest]);
          drain();
        }
        return;
      }
      buffer = Buffer.concat([buffer, chunk]);
      drain();
    });

    function drain() {
      let frame;
      while ((frame = decodeFrame(buffer))) {
        buffer = frame.rest;
        if (frame.opcode === 0x1) {
          listeners.forEach((fn) => fn(frame.payload.toString("utf8")));
        }
      }
    }

    socket.on("error", reject);
  });
}

module.exports = { connect };
