import fs from "node:fs";
import type { SkinToneAnalyzer, SkinToneEstimate, FaceLandmarks } from "../types.js";

const CV_SERVICE_URL = process.env.CV_INFERENCE_SERVICE_URL ?? "http://localhost:8001";

export class RealSkinToneAnalyzer implements SkinToneAnalyzer {
  async analyze(imagePath: string, _landmarks: FaceLandmarks): Promise<SkinToneEstimate> {
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "selfie.jpg");

    const response = await fetch(`${CV_SERVICE_URL}/analyze-skin-tone`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`cv-inference-service analyze-skin-tone error (${response.status})`);
    }

    return (await response.json()) as SkinToneEstimate;
  }
}