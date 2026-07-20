import type { CSSProperties } from "react";

type ProductImageFrame = {
  zoom: number;
  focusX: number;
  focusY: number;
};

type ProductImageFrameStyle = CSSProperties & {
  "--product-image-focus-x": string;
  "--product-image-focus-y": string;
  "--product-image-shift-x": string;
  "--product-image-shift-y": string;
  "--product-image-zoom": number;
};

const driveProductImageFrames: Record<string, ProductImageFrame> = {
  img_0015: { zoom: 2.41, focusX: 49.7, focusY: 51.6 },
  img_0018: { zoom: 1.28, focusX: 51.0, focusY: 48.9 },
  img_0020: { zoom: 3.2, focusX: 50.0, focusY: 50.0 },
  img_0021: { zoom: 1.83, focusX: 48.4, focusY: 50.9 },
  img_0023: { zoom: 1.83, focusX: 52.3, focusY: 51.1 },
  img_0026: { zoom: 1.51, focusX: 49.5, focusY: 45.9 },
  img_0027: { zoom: 1.55, focusX: 51.9, focusY: 48.6 },
  img_0028: { zoom: 1.84, focusX: 51.1, focusY: 50.3 },
  img_0029: { zoom: 1.88, focusX: 51.2, focusY: 51.2 },
  img_0030: { zoom: 1.6, focusX: 50.8, focusY: 54.8 },
  img_0035: { zoom: 2.08, focusX: 49.3, focusY: 51.0 },
  img_0036: { zoom: 2.01, focusX: 49.5, focusY: 53.3 },
  img_0037: { zoom: 2.11, focusX: 50.1, focusY: 54.3 },
  img_0041: { zoom: 1.06, focusX: 50.2, focusY: 54.7 },
  img_0045: { zoom: 1.28, focusX: 49.8, focusY: 53.5 },
  img_0047: { zoom: 1.59, focusX: 51.7, focusY: 58.0 },
  img_0048: { zoom: 1.29, focusX: 52.7, focusY: 56.2 },
  img_0049: { zoom: 1.63, focusX: 50.0, focusY: 48.6 },
  img_0050: { zoom: 1.41, focusX: 49.5, focusY: 56.5 },
  img_0054: { zoom: 2.02, focusX: 49.2, focusY: 52.2 },
  img_0055: { zoom: 2.08, focusX: 50.8, focusY: 52.4 },
  img_0056: { zoom: 1.98, focusX: 48.5, focusY: 52.2 },
  img_0057: { zoom: 1.95, focusX: 48.2, focusY: 51.2 },
  img_0064: { zoom: 1.1, focusX: 50.0, focusY: 48.1 },
  img_0065: { zoom: 1.16, focusX: 50.4, focusY: 43.1 },
  img_0067: { zoom: 1.38, focusX: 49.7, focusY: 44.9 },
  img_0068: { zoom: 2.17, focusX: 49.0, focusY: 52.9 },
  img_0069: { zoom: 1.77, focusX: 50.6, focusY: 48.6 },
  img_0070: { zoom: 2.36, focusX: 50.6, focusY: 53.1 },
  img_0071: { zoom: 2.21, focusX: 50.5, focusY: 51.8 },
  img_0072: { zoom: 2.25, focusX: 49.3, focusY: 53.7 },
  img_0073: { zoom: 2.09, focusX: 51.0, focusY: 52.7 },
  img_0074: { zoom: 2.46, focusX: 46.2, focusY: 54.4 },
  img_0075: { zoom: 2.38, focusX: 49.9, focusY: 50.9 },
  img_0076: { zoom: 2.45, focusX: 48.0, focusY: 54.9 },
  img_0079: { zoom: 2.26, focusX: 49.3, focusY: 54.2 },
  img_0080: { zoom: 2.73, focusX: 49.7, focusY: 54.9 },
  img_0081: { zoom: 2.14, focusX: 49.5, focusY: 50.9 },
  img_0082: { zoom: 2.2, focusX: 50.0, focusY: 52.0 },
  img_0083: { zoom: 2.36, focusX: 49.2, focusY: 52.1 },
  img_0084: { zoom: 2.32, focusX: 48.3, focusY: 51.6 },
  img_0085: { zoom: 2.39, focusX: 49.6, focusY: 51.2 },
  img_0086: { zoom: 1.23, focusX: 50.2, focusY: 51.1 },
  img_0087: { zoom: 2.17, focusX: 49.4, focusY: 52.4 },
};

export function getProductImageFramingStyle(imageUrl: string): ProductImageFrameStyle | undefined {
  const imageKey = imageUrl.match(/\/(img_\d+)\.jpe?g(?:\?|$)/i)?.[1]?.toLowerCase();
  const frame = imageKey ? driveProductImageFrames[imageKey] : undefined;
  if (!frame) return undefined;

  return {
    "--product-image-focus-x": `${frame.focusX}%`,
    "--product-image-focus-y": `${frame.focusY}%`,
    "--product-image-shift-x": `${50 - frame.focusX}%`,
    "--product-image-shift-y": `${50 - frame.focusY}%`,
    "--product-image-zoom": frame.zoom,
  };
}
