import { NextResponse } from "next/server";
import { getAuthMerchantId } from "@/lib/auth";

type MessageRow = { role: string; content: string };
type ConversationRow = { id: string; messages: MessageRow[] };

export type LatestConversationDb = {
  supportConversation: {
    findFirst: (args: {
      where: { merchantId: string };
      orderBy: { updatedAt: "desc" };
      include: { messages: { orderBy: { createdAt: "asc" } } };
    }) => Promise<ConversationRow | null>;
  };
};

// GET /api/support/conversations/latest — restores chat history on reload
// instead of the widget starting blank every time.
export async function handleLatestConversation(db: LatestConversationDb, req: Request): Promise<Response> {
  const merchantId = getAuthMerchantId(req);
  if (!merchantId) return NextResponse.json({ error: "Missing or invalid token" }, { status: 401 });

  const conversation = await db.supportConversation.findFirst({
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
