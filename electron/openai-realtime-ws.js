"use strict";

const crypto = require("crypto");
const https = require("https");

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const MAX_SECRET_LENGTH = 4096;

/**
 * Text-only WebSocket to OpenAI Realtime. Lives in the Electron main process
 * so dictation uses a normal outbound HTTPS upgrade (no WebRTC, no Windows
 * Firewall prompt) and can set an Authorization header (browsers cannot).
 */
function connectOpenAiRealtime(clientSecret) {
  if (
    typeof clientSecret !== "string" ||
    !clientSecret.startsWith("ek_") ||
    clientSecret.length > MAX_SECRET_LENGTH
  ) {
    return Promise.reject(new Error("That dictation session was not valid."));
  }

  return new Promise((resolve, reject) => {
    const key = crypto.randomBytes(16).toString("base64");
    const expectedAccept = crypto
      .createHash("sha1")
      .update(key + WS_MAGIC)
      .digest("base64");

    let settled = false;
    const fail = (error) => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(error instanceof Error ? error : new Error("Live dictation couldn't connect."));
    };

    const req = https.request({
      hostname: "api.openai.com",
      path: "/v1/realtime?intent=transcription",
      method: "GET",
      agent: false,
      headers: {
        Host: "api.openai.com",
        Upgrade: "websocket",
        Connection: "Upgrade",
        Authorization: `Bearer ${clientSecret}`,
        "OpenAI-Beta": "realtime=v1",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": key,
        "Sec-WebSocket-Protocol": "realtime",
      },
    });

    req.on("upgrade", (response, socket) => {
      const accept = response.headers["sec-websocket-accept"];
      if (response.statusCode !== 101 || accept !== expectedAccept) {
        socket.destroy();
        fail(new Error("Live dictation couldn't connect."));
        return;
      }
      if (settled) {
        socket.destroy();
        return;
      }
      settled = true;
      resolve(new RealtimeSocket(socket));
    });
    req.on("response", (response) => {
      response.resume();
      response.on("end", () => fail(new Error("Live dictation couldn't connect.")));
    });
    req.on("error", fail);
    req.setTimeout(12_000, () => fail(new Error("Live dictation timed out.")));
    req.end();
  });
}

class RealtimeSocket {
  constructor(socket) {
    this.socket = socket;
    this.buffer = Buffer.alloc(0);
    this.closed = false;
    this.closeNotified = false;
    this.onMessage = null;
    this.onClose = null;
    socket.on("data", (chunk) => this._push(chunk));
    socket.on("error", () => this.close());
    socket.on("close", () => this._notifyClose());
    socket.on("end", () => this.close());
  }

  sendJson(payload) {
    if (this.closed || !this.socket.writable) return;
    const data = Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload), "utf8");
    this.socket.write(maskFrame(1, data));
  }

  close() {
    if (this.closed) {
      this._notifyClose();
      return;
    }
    this.closed = true;
    try {
      if (this.socket.writable) this.socket.write(maskFrame(8, Buffer.alloc(0)));
    } catch {
      /* ignore */
    }
    this.socket.destroy();
    this._notifyClose();
  }

  _notifyClose() {
    this.closed = true;
    if (this.closeNotified) return;
    this.closeNotified = true;
    if (this.onClose) this.onClose();
  }

  _push(chunk) {
    this.buffer = Buffer.concat([this.buffer, chunk]);
    while (true) {
      const frame = readFrame(this.buffer);
      if (!frame) return;
      this.buffer = this.buffer.subarray(frame.consumed);
      if (frame.opcode === 8) {
        this.close();
        return;
      }
      if (frame.opcode === 9) {
        if (this.socket.writable) this.socket.write(maskFrame(10, frame.payload));
        continue;
      }
      if (frame.opcode === 1 && this.onMessage) {
        this.onMessage(frame.payload.toString("utf8"));
      }
    }
  }
}

function maskFrame(opcode, payload) {
  const mask = crypto.randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i] ^ mask[i % 4];

  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(6);
    header[1] = 0x80 | payload.length;
    mask.copy(header, 2);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(8);
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
    mask.copy(header, 4);
  } else {
    header = Buffer.alloc(14);
    header[1] = 0x80 | 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(payload.length, 6);
    mask.copy(header, 10);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, masked]);
}

function readFrame(buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0] & 0x0f;
  const masked = (buffer[1] & 0x80) !== 0;
  let length = buffer[1] & 0x7f;
  let offset = 2;
  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = buffer.readUInt32BE(6);
    offset = 10;
  }
  const maskSize = masked ? 4 : 0;
  if (buffer.length < offset + maskSize + length) return null;
  let payload = buffer.subarray(offset + maskSize, offset + maskSize + length);
  if (masked) {
    const mask = buffer.subarray(offset, offset + 4);
    const unmasked = Buffer.alloc(length);
    for (let i = 0; i < length; i++) unmasked[i] = payload[i] ^ mask[i % 4];
    payload = unmasked;
  }
  return { opcode, payload, consumed: offset + maskSize + length };
}

module.exports = { connectOpenAiRealtime };
