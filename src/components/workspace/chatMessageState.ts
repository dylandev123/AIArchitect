/** A later successful request supersedes earlier transient failure banners in the same chat session. */
export type WorkspaceChatMessage = { role: "user" | "assistant" | "error"; content: string; scope?: string };

export function messagesAfterSuccessfulEdit(messages: readonly WorkspaceChatMessage[], summary: string): WorkspaceChatMessage[] {
  return [...messages.filter((message) => message.role !== "error"), { role: "assistant", content: summary }];
}
