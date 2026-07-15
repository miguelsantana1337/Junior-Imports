import { describe, expect, it } from "vitest";
import { AdminRequestError, guardAdminMutation } from "./admin-request-guard";

function request(origin = "http://localhost:3000", site = "same-origin") {
  return new Request("http://localhost:3000/api/admin/users", {
    method: "POST",
    headers: { origin, "sec-fetch-site": site },
  });
}

describe("guardAdminMutation", () => {
  it("aceita uma alteração da mesma origem", () => {
    expect(() => guardAdminMutation(request(), "same-origin-user")).not.toThrow();
  });

  it("bloqueia solicitações entre sites", () => {
    expect(() => guardAdminMutation(request("https://malicioso.exemplo", "cross-site"), "cross-site-user"))
      .toThrow(AdminRequestError);
  });

  it("limita tentativas repetidas", () => {
    const actor = `limited-user-${crypto.randomUUID()}`;
    guardAdminMutation(request(), actor, 1);
    expect(() => guardAdminMutation(request(), actor, 1)).toThrow(/Muitas tentativas/);
  });
});
