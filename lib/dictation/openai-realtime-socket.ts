import { createHash, randomBytes } from "node:crypto";
import { request as httpsRequest } from "node:https";
import { Socket } from "node:net";

const WS_MAGIC = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

export type RealtimeSocket = {
  sendJson: (payload: string | object) => void;
  close: () => void;
  onMessage: ((text: string) => void) | null;
  onClose: (() => void) | null;
};

/**
 * Server-side text WebSocket to OpenAI Realtime. Browsers cannot set an
 * Authorization header on WebSocket, so TEMPO opens this from Node instead.
 */
export function connectOpenAiRealtime(
  bearerToken: string,
  extraHeaders: Record<string, string> = {},
): Promise<RealtimeSocket> {
  if (typeof bearerToken !== "string" || bearerToken.length < 8 || bearerToken.length > 4096) {
    return Promise.reject(new Error("That dictation session was not valid."));
  }

  return new Promise((resolve, reject) => {
    const key = randomBytes(16).toString("base64");
    const expectedAccept = createHash("sha1")
      .update(key + WS_MAGIC)
      .digest("base64");

    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      req.destroy();
      reject(error instanceof Error ? error : new Error("Live dictation couldn't connect."));
    };

    const req = httpsRequest({
      hostname: "api.openai.com",
      path: "/v1/realtime?intent=transcription",
      method: "GET",
      agent: false,
      headers: {
        Host: "api.openai.com",
        Upgrade: "websocket",
        Connection: "Upgrade",
        Authorization: `Bearer ${bearerToken}`,
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": key,
        ...extraHeaders,
      },
    });

    req.on("upgrade", (response, socket, head) => {
      const acceptHeader = response.headers["sec-websocket-accept"];
      const accept = Array.isArray(acceptHeader) ? acceptHeader[0] : acceptHeader;
      if (response.statusCode !== 101) {
        socket.destroy();
        fail(new Error("Live dictation couldn't connect."));
        return;
      }
      if (accept && accept.trim() !== expectedAccept) {
        socket.destroy();
        fail(new Error("Live dictation couldn't connect."));
        return;
      }
      if (settled) {
        socket.destroy();
        return;
      }
      settled = true;
      if (head.length) socket.unshift(head);
      resolve(new NodeRealtimeSocket(socket));
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

class NodeRealtimeSocket implements RealtimeSocket {
  onMessage: ((text: string) => void) | null = null;
  onClose: (() => void) | null = null;
  private buffer = Buffer.alloc(0);
  private closed = false;
  private closeNotified = false;

  constructor(private readonly socket: Socket) {
    socket.on("data", (chunk) => this.push(chunk));
    socket.on("error", () => this.close());
    socket.on("close", () => this.notifyClose());
    socket.on("end", () => this.close());
  }

  sendJson(payload: string | object) {
    if (this.closed || !this.socket.writable) return;
    const data = Buffer.from(
      typeof payload === "string" ? payload : JSON.stringify(payload),
      "utf8",
    );
    this.socket.write(maskFrame(1, data));
  }

  close() {
    if (this.closed) {
      this.notifyClose();
      return;
    }
    this.closed = true;
    try {
      if (this.socket.writable) this.socket.write(maskFrame(8, Buffer.alloc(0)));
    } catch {
      /* ignore */
    }
    this.socket.destroy();
    this.notifyClose();
  }

  private notifyClose() {
    this.closed = true;
    if (this.closeNotified) return;
    this.closeNotified = true;
    this.onClose?.();
  }

  private push(chunk: Buffer) {
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
      if (frame.opcode === 1) this.onMessage?.(frame.payload.toString("utf8"));
    }
  }
}

function maskFrame(opcode: number, payload: Buffer) {
  const mask = randomBytes(4);
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) masked[i] = payload[i]! ^ mask[i % 4]!;

  let header: Buffer;
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

function readFrame(buffer: Buffer) {
  if (buffer.length < 2) return null;
  const opcode = buffer[0]! & 0x0f;
  const masked = (buffer[1]! & 0x80) !== 0;
  let length = buffer[1]! & 0x7f;
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
    for (let i = 0; i < length; i++) unmasked[i] = payload[i]! ^ mask[i % 4]!;
    payload = unmasked;
  }
  return { opcode, payload, consumed: offset + maskSize + length };
}
