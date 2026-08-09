import fs from "node:fs";
import type { HairSegmenter, HairMask } from "../types.js";

const CV_SERVICE_URL = process.env.CV_INFERENCE_SERVICE_URL ?? "http://localhost:8001";

export class RealHairSegmenter implements HairSegmenter {
  async segment(imagePath: string): Promise<HairMask> {
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "selfie.jpg");

    const response = await fetch(`${CV_SERVICE_URL}/segment-hair`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`cv-inference-service segment-hair error (${response.status})`);
    }

    const data = (await response.json()) as { maskBase64: string; width: number; height: number };

    const maskPath = imagePath.replace(/\.jpg$/i, "_hairmask.png");
    fs.writeFileSync(maskPath, Buffer.from(data.maskBase64, "base64"));

    return { maskImagePath: maskPath, width: data.width, height: data.height };
  }
}