import { describe, expect, it } from "vitest";
import { normalizeProductImages, removeProductImage, reorderProductImages, setProductCover } from "./product-images";

describe("product image gallery", () => {
  it("normalizes legacy cover images without duplicates", () => {
    expect(normalizeProductImages({ imageUrl: "/cover.png", imageUrls: ["/side.png", "/cover.png"] })).toEqual(["/side.png", "/cover.png"]);
  });

  it("selects a cover without changing gallery order", () => {
    expect(setProductCover({ imageUrl: "/a.png", imageUrls: ["/a.png", "/b.png"] }, "/b.png")).toEqual({ imageUrl: "/b.png", imageUrls: ["/a.png", "/b.png"] });
  });

  it("reorders photos while preserving the selected cover", () => {
    expect(reorderProductImages({ imageUrl: "/b.png", imageUrls: ["/a.png", "/b.png", "/c.png"] }, 2, 0)).toEqual({ imageUrl: "/b.png", imageUrls: ["/c.png", "/a.png", "/b.png"] });
  });

  it("promotes the first remaining photo when the cover is removed", () => {
    expect(removeProductImage({ imageUrl: "/a.png", imageUrls: ["/a.png", "/b.png"] }, "/a.png")).toEqual({ imageUrl: "/b.png", imageUrls: ["/b.png"] });
  });
});
