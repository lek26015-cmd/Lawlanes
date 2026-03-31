import { NextRequest, NextResponse } from "next/server";
import { initAdmin } from "@/lib/firebase-admin";
import { v4 as uuidv4 } from "uuid";

/**
 * Webhook for Cloudflare Email Worker to post inbound email data.
 */
export async function POST(req: NextRequest) {
  try {
    const adminApp = await initAdmin();
    if (!adminApp) {
      return NextResponse.json({ error: "Firebase Admin init failed" }, { status: 500 });
    }
    const db = adminApp.firestore();

    const { from, to, subject, text, html } = await req.json();

    // Verify origin (Optional: Use a secret header for security)
    const authToken = req.headers.get("x-inbound-token");
    if (authToken !== process.env.INBOUND_EMAIL_SECRET) {
       return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!from || !subject) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const ticketId = `ticket-${uuidv4().slice(0, 8)}`;

    // Create a new support ticket in Firestore
    await db.collection("supportTickets").doc(ticketId).set({
      id: ticketId,
      userId: "system-inbound", // Or look up user by email
      userEmail: from,
      subject: subject,
      description: text || html || "[No content]",
      status: "pending",
      type: "email_inbound",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      metadata: {
        to,
        originalSubject: subject,
      }
    });

    console.log(`Inbound email from ${from} converted to ticket ${ticketId}`);

    return NextResponse.json({ success: true, ticketId });
  } catch (error) {
    console.error("Inbound email webhook error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
