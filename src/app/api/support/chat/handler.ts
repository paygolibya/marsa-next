import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { getAuthMerchantId } from "@/lib/auth";
import { runSupportAgent, type ChatMessage } from "@/lib/support/anthropic-client";
import { SUPPORT_TOOLS, createSupportTools } from "@/lib/support/tools";
import { SUPPORT_SYSTEM_PROMPT } from "@/lib/support/system-prompt";

type SupportConversationRow = { id: string; merchantId: string; storeId: string | null };
type SupportMessageRow = { role: string; content: string };

export type SupportChatDb = {
  store: { findFirst: (args: { where: { merchantId: string }; orderBy: { createdAt: "asc" } }) => Promise<{ id: string } | null> };
  supportConversation: {
    findFirst: (args: { where: { id: string; merchantId: string } }) => Promise<SupportConversationRow | null>;
    create: (args: { data: { merchantId: string; storeId: string | null } }) => Promise<SupportConversationRow>;
    update: (args: { where: { id: string }; data: { storeId: string | null } }) => Promise<unknown>;
  };
  supportMessage: {
    findMany: (args: { where: { conversationId: string }; orderBy: { createdAt: "asc" } }) => Promise<SupportMessageRow[]>;
    create: (args: { data: { conversationId: string; role: string; content: string } }) => Promise<unknown>;
  };
};

// POST /api/support/chat — Bearer-authed merchant chat with the AI support
// agent. Stateless per request (a conversation persists in the DB, not in
// memory) — concurrent merchants are just concurrent requests, nothing
// special needed for that. runSupportAgent itself falls back to a canned
// response when ANTHROPIC_API_KEY is unset (same mock-fallback convention
// as sms.ts/email.ts), so tests exercise the real function without needing
// a fake for it or a real network call.
export async function handleSupportChat(db: SupportChatDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const requestedConversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    if (!message) return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });

    let conversation = requestedConversationId
      ? await db.supportConversation.findFirst({ where: { id: requestedConversationId, merchantId } })
      : null;

    if (!conversation) {
      const store = await db.store.findFirst({ where: { merchantId }, orderBy: { createdAt: "asc" } });
      conversation = await db.supportConversation.create({ data: { merchantId, storeId: store?.id ?? null } });
    }

    const priorMessages = await db.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    const history: ChatMessage[] = priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await db.supportMessage.create({ data: { conversationId: conversation.id, role: "user", content: message } });

    const reply = await runSupportAgent({
      systemPrompt: SUPPORT_SYSTEM_PROMPT,
      history,
      userMessage: message,
      tools: SUPPORT_TOOLS,
      executors: createSupportTools(merchantId, conversation.id),
    });

    await db.supportMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: reply } });
    await db.supportConversation.update({ where: { id: conversation.id }, data: { storeId: conversation.storeId } });

    return NextResponse.json({ conversationId: conversation.id, reply });
  } catch (err) {
    console.error("Support chat error:", err);
    Sentry.captureException(err);
    return NextResponse.json({ error: "تعذّر معالجة طلبك حاليًا، حاول لاحقًا" }, { status: 500 });
  }
}
