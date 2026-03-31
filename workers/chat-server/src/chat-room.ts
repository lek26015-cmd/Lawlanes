import { D1Database, DurableObjectNamespace, DurableObjectState, Queue } from "@cloudflare/workers-types";

export interface Env {
  DB: D1Database;
  CHAT_ROOM: DurableObjectNamespace;
  OFFLINE_QUEUE: Queue;
}

export class ChatRoom {
  state: DurableObjectState;
  env: Env;
  sessions: { ws: WebSocket; userId: string }[] = [];

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }

  async fetch(request: Request) {
    const url = new URL(request.url);
    const userId = url.searchParams.get("userId") || "anonymous";

    if (request.headers.get("Upgrade") !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    await this.handleSession(server, userId);

    return new Response(null, { status: 101, webSocket: client });
  }

  async handleSession(ws: WebSocket, userId: string) {
    ws.accept();
    const session = { ws, userId };
    this.sessions.push(session);

    ws.addEventListener("message", async (msg) => {
      try {
        const data = JSON.parse(msg.data as string);
        if (data.type === "message") {
          await this.onMessage(session, data);
        }
      } catch (err) {
        console.error("Error parsing message:", err);
      }
    });

    ws.addEventListener("close", () => {
      this.sessions = this.sessions.filter((s) => s !== session);
    });
  }

  async onMessage(sender: { ws: WebSocket; userId: string }, data: any) {
    const { chatId, text, senderName, recipientId } = data;
    const messageId = crypto.randomUUID();
    const timestamp = Math.floor(Date.now() / 1000);

    const message = {
      id: messageId,
      chatId,
      text,
      senderId: sender.userId,
      timestamp,
      senderName
    };

    // 1. Save to D1
    await this.env.DB.prepare(
      "INSERT INTO messages (id, chatId, text, senderId, timestamp) VALUES (?, ?, ?, ?, ?)"
    )
      .bind(messageId, chatId, text, sender.userId, timestamp)
      .run();

    // Update chat metadata
    await this.env.DB.prepare(
      "UPDATE chats SET lastMessage = ?, lastMessageAt = ?, hasNewMessage = 1 WHERE id = ?"
    )
      .bind(text, timestamp, chatId)
      .run();

    // 2. Broadcast to other active clients in this room
    const broadcastMsg = JSON.stringify({
       type: "message",
       ...message
    });

    this.sessions.forEach(s => {
       if (s.ws.readyState === WebSocket.OPEN) {
          s.ws.send(broadcastMsg);
       }
    });

    // 3. Offline logic: If recipient is not connected, push to Queue
    const isRecipientConnected = this.sessions.some(s => s.userId === recipientId);
    if (!isRecipientConnected) {
       await this.env.OFFLINE_QUEUE.send({
          chatId,
          text,
          senderName,
          recipientId,
          timestamp
       });
    }
  }
}
