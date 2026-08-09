import fs from "node:fs";
import type { FaceLandmarkDetector, FaceLandmarks } from "../types.js";

const CV_SERVICE_URL = process.env.CV_INFERENCE_SERVICE_URL ?? "http://localhost:8001";

export class RealFaceLandmarkDetector implements FaceLandmarkDetector {
  async detect(imagePath: string): Promise<FaceLandmarks> {
    const fileBuffer = fs.readFileSync(imagePath);
    const blob = new Blob([fileBuffer]);

    const formData = new FormData();
    formData.append("file", blob, "selfie.jpg");

    const response = await fetch(`${CV_SERVICE_URL}/detect-landmarks`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`cv-inference-service error (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as FaceLandmarks;
    return data;
  }
}