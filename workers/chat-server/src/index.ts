import { MessageBatch } from "@cloudflare/workers-types";
import { ChatRoom, Env } from "./chat-room";

export { ChatRoom };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // CORS headers
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. WebSocket Upgrade / Chat Connection
    if (path.startsWith("/ws/")) {
      const chatId = path.split("/")[2];
      if (!chatId) return new Response("Missing chatId", { status: 400 });

      const id = env.CHAT_ROOM.idFromName(chatId);
      const room = env.CHAT_ROOM.get(id);

      return room.fetch(request);
    }

    // 2. Chat History from D1
    if (path.startsWith("/history/")) {
      const chatId = path.split("/")[2];
      if (!chatId) return new Response("Missing chatId", { status: 400 });

      const { results } = await env.DB.prepare(
        "SELECT * FROM messages WHERE chatId = ? ORDER BY timestamp ASC LIMIT 100"
      )
        .bind(chatId)
        .all();

      return new Response(JSON.stringify(results), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Ensure Chat Exists (equivalent to Firestore logic)
    if (path.startsWith("/ensure-chat") && request.method === "POST") {
      const { chatId, participants, caseTitle } = await request.json() as any;
      
      const existing = await env.DB.prepare("SELECT id FROM chats WHERE id = ?").bind(chatId).first();
      
      if (!existing) {
        await env.DB.prepare(
          "INSERT INTO chats (id, participants, caseTitle) VALUES (?, ?, ?)"
        )
          .bind(chatId, JSON.stringify(participants), caseTitle)
          .run();
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Public Key Management
    if (path.startsWith("/key/")) {
      const targetUserId = path.split("/")[2];
      
      if (request.method === "GET") {
        if (!targetUserId) return new Response("Missing userId", { status: 400 });
        const key = await env.DB.prepare("SELECT publicKey FROM user_keys WHERE userId = ?").bind(targetUserId).first();
        return new Response(JSON.stringify(key || { publicKey: null }), {
           headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      if (request.method === "POST") {
        const { userId, publicKey } = await request.json() as any;
        await env.DB.prepare(
          "INSERT INTO user_keys (userId, publicKey, updatedAt) VALUES (?, ?, ?) ON CONFLICT(userId) DO UPDATE SET publicKey=excluded.publicKey, updatedAt=excluded.updatedAt"
        )
          .bind(userId, publicKey, Math.floor(Date.now() / 1000))
          .run();
        
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },

  // Queue Consumer for Offline Notifications
  async queue(batch: MessageBatch<any>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      const { recipientId, text, senderName, chatId } = message.body;
      
      // Here you would integrate with LINE API or Email service
      // Example: sendLineNotification(recipientId, `New message from ${senderName}: ${text}`);
      console.log(`Sending offline notification to ${recipientId}: ${text}`);
      
      // For now, we'll just log it. 
      // In production, use fetch() to trigger a LINE webhook or similar.
    }
  }
};
