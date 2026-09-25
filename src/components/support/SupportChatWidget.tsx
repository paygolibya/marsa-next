"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { api, ApiError, type SupportMessage } from "@/lib/api";
import { Button } from "@/components/ui";

// Floating button + slide-in panel — same fixed/sticky pattern as
// cart-drawer.tsx. Mounted once in the dashboard layout, inside
// ToastProvider (matches the design editor's own reuse of that provider).
export function SupportChatWidget() {
  const { token } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token || loaded) return;
    api
      .supportLatestConversation(token)
      .then((data) => {
        setConversationId(data.conversationId);
        setMessages(data.messages);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [token, loaded]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !input.trim() || sending) return;
    const message = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: message }]);
    setSending(true);
    try {
      const result = await api.supportChat(token, { conversationId, message });
      setConversationId(result.conversationId);
      setMessages((prev) => [...prev, { role: "assistant", content: result.reply }]);
    } catch (err) {
      const text = err instanceof ApiError ? err.message : "تعذّر إرسال الرسالة، حاول مجددًا";
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="الدعم الفني"
        className="fixed bottom-5 left-5 z-40 h-14 w-14 rounded-full bg-signal text-canvas shadow-lg shadow-signal/30 hover:bg-signal-dark transition-colors flex items-center justify-center text-2xl"
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div className="fixed bottom-24 left-5 z-40 w-[calc(100vw-2.5rem)] max-w-sm h-[28rem] rounded-2xl border border-harbor/10 bg-white shadow-2xl flex flex-col overflow-hidden">
          <div className="bg-harbor text-canvas px-4 py-3">
            <p className="font-display font-bold text-sm">الدعم الفني الذكي</p>
            <p className="text-xs text-canvas/70">اسأل عن أي شيء يخص متجرك</p>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.length === 0 && loaded && (
              <p className="text-rope text-xs text-center py-6">مرحبًا! كيف يمكنني مساعدتك في متجرك اليوم؟</p>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-start" : "justify-end"}`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    m.role === "user" ? "bg-harbor/5 text-harbor" : "bg-brass/10 text-harbor"
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && <p className="text-rope text-xs">يكتب الآن...</p>}
          </div>

          <form onSubmit={handleSend} className="border-t border-harbor/10 p-2 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="اكتب رسالتك..."
              className="input flex-1 !py-2 text-sm"
              disabled={sending}
            />
            <Button type="submit" size="sm" disabled={!input.trim()} loading={sending}>
              إرسال
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
