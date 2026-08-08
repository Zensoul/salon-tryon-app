import type { SkinToneAnalyzer, SkinToneEstimate, FaceLandmarks } from "../types.js";

export class MockSkinToneAnalyzer implements SkinToneAnalyzer {
  async analyze(_imagePath: string, _landmarks: FaceLandmarks): Promise<SkinToneEstimate> {
    const undertones: SkinToneEstimate["undertone"][] = ["warm", "cool", "neutral"];
    return {
      hex: "#C68863",
      undertone: undertones[Math.floor(Math.random() * undertones.length)],
    };
  }
}