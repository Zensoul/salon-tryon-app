import type { HairSegmenter, HairMask } from "../types.js";

export class MockHairSegmenter implements HairSegmenter {
  async segment(_imagePath: string): Promise<HairMask> {
    return {
      maskImagePath: "/tmp/mock-hair-mask.png",
      width: 1024,
      height: 1024,
    };
  }
}