// Claude-powered merchant support agent — plain `fetch`, no SDK dependency,
// matching src/lib/integrations/{sms,email}.ts's established convention for
// every external API this app calls. Mocked when ANTHROPIC_API_KEY is
// unset, same shape as those two: no real credentials needed in dev/CI.

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001"; // fast — this is a live support chat, not a background job
const MAX_TOOL_ROUNDS = 5; // hard cap on tool-use round trips per reply, bounds latency and cost

export function isAnthropicConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

export type ChatMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

export type ToolDefinition = {
  name: string;
  description: string;
  input_schema: { type: "object"; properties: Record<string, unknown>; required?: string[] };
};

type ToolExecutor = (input: Record<string, unknown>) => Promise<string>;

async function callAnthropic(system: string, messages: ChatMessage[], tools: ToolDefinition[]) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set");
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;

  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({ model, max_tokens: 1024, system, messages, tools }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Anthropic API error ${res.status}: ${text}`);
  }
  return res.json() as Promise<{ content: ContentBlock[]; stop_reason: string }>;
}

// Runs the full tool-use loop server-side and returns only the final text —
// simpler and more reliable than streaming intermediate tool-call turns,
// still fast since a Haiku round trip is quick and MAX_TOOL_ROUNDS bounds
// the worst case.
export async function runSupportAgent({
  systemPrompt,
  history,
  userMessage,
  tools,
  executors,
}: {
  systemPrompt: string;
  history: ChatMessage[];
  userMessage: string;
  tools: ToolDefinition[];
  executors: Record<string, ToolExecutor>;
}): Promise<string> {
  if (!isAnthropicConfigured()) {
    return "الدعم الذكي غير مفعّل حاليًا على هذا الخادم. تواصل مع فريق رفقة مباشرة.";
  }

  const messages: ChatMessage[] = [...history, { role: "user", content: userMessage }];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await callAnthropic(systemPrompt, messages, tools);

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return text || "تعذّر إكمال الرد، حاول مجددًا.";
    }

    messages.push({ role: "assistant", content: response.content });

    const toolUseBlocks = response.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
    const toolResults: ContentBlock[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const executor = executors[block.name];
        const content = executor ? await executor(block.input).catch((err) => JSON.stringify({ error: String(err) })) : JSON.stringify({ error: "أداة غير معروفة" });
        return { type: "tool_result" as const, tool_use_id: block.id, content };
      })
    );
    messages.push({ role: "user", content: toolResults });
  }

  return "تعذّر إكمال الطلب بعد عدة محاولات، أعد صياغة سؤالك أو تواصل مع الدعم مباشرة.";
}
