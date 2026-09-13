import { SpecialRoles } from "@/services/types/user";
import { describe, expect, it } from "vitest";

import { hasAnySpecialRole } from "./special-role-guard";

describe("hasAnySpecialRole", () => {
  it("accepts a user with one of the required roles", () => {
    expect(
      hasAnySpecialRole([SpecialRoles.Developer], [
        SpecialRoles.SuperAdmin,
        SpecialRoles.Developer,
      ]),
    ).toBe(true);
  });

  it("rejects a user without any required roles", () => {
    expect(
      hasAnySpecialRole([], [SpecialRoles.SuperAdmin, SpecialRoles.Developer]),
    ).toBe(false);
  });
});
