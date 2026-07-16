import { describe, expect, it } from "vitest";
import { generateTemporaryPassword } from "./password";

describe("senha temporária administrativa", () => {
  it("gera uma senha forte sem caracteres ambíguos", () => {
    const password = generateTemporaryPassword();

    expect(password).toHaveLength(16);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/\d/);
    expect(password).toMatch(/[^A-Za-z0-9]/);
    expect(password).not.toMatch(/[01IlOo]/);
  });
});
