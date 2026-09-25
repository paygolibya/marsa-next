import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";
import { runSupportAgent, type ChatMessage } from "@/lib/support/anthropic-client";
import { SUPPORT_TOOLS, createSupportTools } from "@/lib/support/tools";
import { SUPPORT_SYSTEM_PROMPT } from "@/lib/support/system-prompt";

// POST /api/support/chat — Bearer-authed merchant chat with the AI support
// agent. Stateless per request (a conversation persists in the DB, not in
// memory) — concurrent merchants are just concurrent requests, nothing
// special needed for that.
export async function POST(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  try {
    const body = await req.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const requestedConversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    if (!message) return NextResponse.json({ error: "الرسالة فارغة" }, { status: 400 });

    let conversation = requestedConversationId
      ? await prisma.supportConversation.findFirst({ where: { id: requestedConversationId, merchantId } })
      : null;

    if (!conversation) {
      const store = await prisma.store.findFirst({ where: { merchantId }, orderBy: { createdAt: "asc" } });
      conversation = await prisma.supportConversation.create({ data: { merchantId, storeId: store?.id ?? null } });
    }

    const priorMessages = await prisma.supportMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
    });
    const history: ChatMessage[] = priorMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

    await prisma.supportMessage.create({ data: { conversationId: conversation.id, role: "user", content: message } });

    const reply = await runSupportAgent({
      systemPrompt: SUPPORT_SYSTEM_PROMPT,
      history,
      userMessage: message,
      tools: SUPPORT_TOOLS,
      executors: createSupportTools(merchantId, conversation.id),
    });

    await prisma.supportMessage.create({ data: { conversationId: conversation.id, role: "assistant", content: reply } });
    // Touches @updatedAt so GET /conversations/latest picks this one up.
    await prisma.supportConversation.update({ where: { id: conversation.id }, data: { storeId: conversation.storeId } });

    return NextResponse.json({ conversationId: conversation.id, reply });
  } catch (err) {
    console.error("Support chat error:", err);
    return NextResponse.json({ error: "تعذّر معالجة طلبك حاليًا، حاول لاحقًا" }, { status: 500 });
  }
}
