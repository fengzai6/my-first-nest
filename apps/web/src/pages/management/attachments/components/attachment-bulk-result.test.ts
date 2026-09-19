import { describe, expect, it } from "vitest";

import { getBulkFailureLines, getRemainingSelectionIds } from "./attachment-bulk-result";

describe("attachment bulk results", () => {
  it("keeps failed ids selected and removes successful ids", () => {
    const remaining = getRemainingSelectionIds(
      ["a", "b", "c"],
      {
        succeeded: ["a", "c"],
        failed: [{ id: "b", reason: "已绑定" }],
      },
    );

    expect(remaining).toEqual(["b"]);
  });

  it("formats each failure reason", () => {
    expect(
      getBulkFailureLines([
        { id: "b", reason: "已绑定" },
        { id: "c", reason: "无权限" },
      ]),
    ).toEqual("b：已绑定；c：无权限");
  });

  it("returns an empty reason suffix when all items succeed", () => {
    expect(getBulkFailureLines([])).toEqual("");
  });
});
