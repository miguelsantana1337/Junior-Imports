import { describe, expect, it } from "vitest";
import { scopedSelection } from "./scoped-selection";

describe("edição de seleções por catálogo", () => {
  it("mantém os destaques ou categorias da outra loja, inclusive mudanças recentes", () => {
    expect([...scopedSelection(["pharma-2", "fora-do-escopo"], ["pharma-1", "pharma-2"], ["pharma-1", "iphone", "ipad"])])
      .toEqual(["iphone", "ipad", "pharma-2"]);
  });
  it("não limpa outro catálogo quando a seleção ou o escopo estão vazios", () => {
    expect([...scopedSelection([], ["pharma-1"], ["pharma-1", "iphone"])]).toEqual(["iphone"]);
    expect([...scopedSelection([], [], ["iphone"])]).toEqual(["iphone"]);
  });
  it("preserva o comportamento global dos editores sem separação de lojas", () => {
    expect([...scopedSelection(["novo"], undefined, ["antigo"])]).toEqual(["novo"]);
  });
});
