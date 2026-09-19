import { hasAnyPermission } from "./permission-guard";
import { describe, expect, it } from "vitest";

describe("hasAnyPermission", () => {
  it("returns true when the user has one required permission", () => {
    expect(hasAnyPermission(["attachment:read"], ["attachment:manage"])).toBe(
      false,
    );
    expect(
      hasAnyPermission(
        ["attachment:read"],
        ["attachment:read", "attachment:manage"],
      ),
    ).toBe(true);
  });

  it("returns false for empty permissions", () => {
    expect(hasAnyPermission([], ["attachment:read"])).toBe(false);
  });
});
