import type { FaceLandmarkDetector, FaceLandmarks, FaceShape } from "../types.js";

export class MockFaceLandmarkDetector implements FaceLandmarkDetector {
  async detect(_imagePath: string): Promise<FaceLandmarks> {
    const shapes: FaceShape[] = ["oval", "round", "square", "heart", "diamond", "oblong"];
    const faceShape = shapes[Math.floor(Math.random() * shapes.length)];

    const points = Array.from({ length: 10 }, (_, i) => {
      const angle = (i / 10) * 2 * Math.PI;
      return {
        x: 0.5 + 0.25 * Math.cos(angle),
        y: 0.5 + 0.3 * Math.sin(angle),
      };
    });

    return {
      points,
      boundingBox: { x: 0.25, y: 0.15, width: 0.5, height: 0.6 },
      faceShape,
    };
  }
}