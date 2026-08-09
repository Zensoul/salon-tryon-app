import fs from "node:fs";
import type { StyleRenderer, RenderRequest, RenderResult } from "../types.js";

const CV_SERVICE_URL = process.env.CV_INFERENCE_SERVICE_URL ?? "http://localhost:8001";

export class RealStyleRenderer implements StyleRenderer {
  async render(request: RenderRequest): Promise<RenderResult> {
    if (request.style.category !== "hair_color" || !request.style.targetColor) {
      return {
        outputImagePath: request.sourceImagePath,
        renderedAt: new Date().toISOString(),
      };
    }

    const fileBuffer = fs.readFileSync(request.sourceImagePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "selfie.jpg");

    const targetColor = encodeURIComponent(request.style.targetColor);
    const response = await fetch(
      `${CV_SERVICE_URL}/render-hair-color?target_color=${targetColor}`,
      { method: "POST", body: formData }
    );

    if (!response.ok) {
      throw new Error(`cv-inference-service render-hair-color error (${response.status})`);
    }

    const data = (await response.json()) as { renderedImageBase64: string; format: string };

    const outputPath = request.sourceImagePath.replace(/\.jpg$/i, `_rendered.${data.format}`);
    fs.writeFileSync(outputPath, Buffer.from(data.renderedImageBase64, "base64"));

    return { outputImagePath: outputPath, renderedAt: new Date().toISOString() };
  }
}