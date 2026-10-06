import { describe, expect, it } from "vitest";
import { messagesAfterSuccessfulEdit } from "../chatMessageState";

describe("workspace chat follow-up state", () => {
  it("clears stale failures when a later edit succeeds while preserving the conversation", () => {
    expect(messagesAfterSuccessfulEdit([
      { role: "user", content: "Add a feature" },
      { role: "error", content: "Earlier request failed" },
      { role: "user", content: "Try a valid change" },
    ], "Architectural edit applied (resize scene:marker)."))
      .toEqual([
        { role: "user", content: "Add a feature" },
        { role: "user", content: "Try a valid change" },
        { role: "assistant", content: "Architectural edit applied (resize scene:marker)." },
      ]);
  });
});
