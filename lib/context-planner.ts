import { buildAttachmentContext, estimateTokens } from "@/lib/attachments";
import type {
  ChatMessage,
  ContextPlan,
  StoredMessage,
  TextAttachment,
  TokenBreakdown,
} from "@/lib/types";

const INPUT_BUDGET_RATIO = 0.75;
const MESSAGE_OVERHEAD = 4;

type PlanContextOptions = {
  history: StoredMessage[];
  current: ChatMessage & { attachments?: TextAttachment[] };
  systemPrompt: string;
  numCtx: number;
};

type ConversationTurn = {
  messages: StoredMessage[];
  tokens: number;
};

function messageContent(message: ChatMessage & { attachments?: TextAttachment[] }) {
  const attachmentContext =
    message.role === "user"
      ? buildAttachmentContext(message.attachments ?? [])
      : "";

  return attachmentContext
    ? `${message.content}\n\n${attachmentContext}`
    : message.content;
}

function messageTokens(message: ChatMessage & { attachments?: TextAttachment[] }) {
  return estimateTokens(messageContent(message)) + MESSAGE_OVERHEAD;
}

function groupTurns(messages: StoredMessage[]) {
  const turns: ConversationTurn[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      turns.push({
        messages: [message],
        tokens: messageTokens(message),
      });
      continue;
    }

    const currentTurn = turns.at(-1);
    if (currentTurn) {
      currentTurn.messages.push(message);
      currentTurn.tokens += messageTokens(message);
    }
  }

  return turns;
}

function toChatMessage(
  message: ChatMessage & { attachments?: TextAttachment[] },
): ChatMessage {
  return {
    role: message.role,
    content: messageContent(message),
  };
}

export function planContext({
  history,
  current,
  systemPrompt,
  numCtx,
}: PlanContextOptions): ContextPlan {
  const contextLimit = Math.max(1, Math.floor(numCtx));
  const inputBudget = Math.floor(contextLimit * INPUT_BUDGET_RATIO);
  const trimmedSystemPrompt = systemPrompt.trim();
  const currentAttachmentContext = buildAttachmentContext(
    current.attachments ?? [],
  );
  const currentAttachmentTokens = estimateTokens(currentAttachmentContext);
  const hasCurrentContent =
    current.content.trim().length > 0 || currentAttachmentContext.length > 0;
  const breakdown: TokenBreakdown = {
    system: trimmedSystemPrompt ? estimateTokens(trimmedSystemPrompt) : 0,
    history: 0,
    input: estimateTokens(current.content),
    attachments: currentAttachmentTokens,
    overhead:
      (hasCurrentContent ? MESSAGE_OVERHEAD : 0) +
      (trimmedSystemPrompt ? MESSAGE_OVERHEAD : 0),
  };
  const fixedTokens =
    breakdown.system +
    breakdown.input +
    breakdown.attachments +
    breakdown.overhead;
  const messages: ChatMessage[] = [];

  if (trimmedSystemPrompt) {
    messages.push({ role: "system", content: trimmedSystemPrompt });
  }

  if (fixedTokens > inputBudget) {
    messages.push(toChatMessage(current));
    return {
      messages,
      contextLimit,
      inputBudget,
      estimatedInputTokens: fixedTokens,
      excludedTurns: groupTurns(history).length,
      actualPromptTokens: null,
      breakdown,
      isOverBudget: true,
      reason:
        "The system prompt, current message, and attachments exceed the input budget.",
    };
  }

  const turns = groupTurns(history);
  const includedTurns: ConversationTurn[] = [];
  let usedTokens = fixedTokens;

  for (let index = turns.length - 1; index >= 0; index -= 1) {
    const turn = turns[index];
    if (usedTokens + turn.tokens > inputBudget) {
      break;
    }
    includedTurns.unshift(turn);
    usedTokens += turn.tokens;
    breakdown.history += turn.tokens;
  }

  for (const turn of includedTurns) {
    messages.push(...turn.messages.map(toChatMessage));
  }
  messages.push(toChatMessage(current));

  return {
    messages,
    contextLimit,
    inputBudget,
    estimatedInputTokens: usedTokens,
    excludedTurns: turns.length - includedTurns.length,
    actualPromptTokens: null,
    breakdown,
    isOverBudget: false,
    reason: null,
  };
}

export function contextUsageSnapshot(plan: ContextPlan) {
  return {
    contextLimit: plan.contextLimit,
    inputBudget: plan.inputBudget,
    estimatedInputTokens: plan.estimatedInputTokens,
    excludedTurns: plan.excludedTurns,
    actualPromptTokens: plan.actualPromptTokens,
    breakdown: plan.breakdown,
  };
}
