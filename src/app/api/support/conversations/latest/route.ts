import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthMerchantId } from "@/lib/auth";

// GET /api/support/conversations/latest — restores chat history on reload
// instead of the widget starting blank every time.
export async function GET(req: Request) {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const conversation = await prisma.supportConversation.findFirst({
    where: { merchantId },
    orderBy: { updatedAt: "desc" },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });

  if (!conversation) return NextResponse.json({ conversationId: null, messages: [] });

  return NextResponse.json({
    conversationId: conversation.id,
    messages: conversation.messages.map((m) => ({ role: m.role, content: m.content })),
  });
}
