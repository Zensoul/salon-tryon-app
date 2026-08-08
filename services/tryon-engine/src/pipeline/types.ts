export interface Point2D {
  x: number;
  y: number;
}

export type FaceShape = "oval" | "round" | "square" | "heart" | "diamond" | "oblong";

export interface FaceLandmarks {
  points: Point2D[];
  boundingBox: { x: number; y: number; width: number; height: number };
  faceShape: FaceShape;
}

export interface HairMask {
  maskImagePath: string;
  width: number;
  height: number;
}

export interface SkinToneEstimate {
  hex: string;
  undertone: "warm" | "cool" | "neutral";
}

export interface StyleSpec {
  styleId: string;
  category: "hair_color" | "hair_style" | "makeup_lip" | "makeup_eye";
  targetColor?: string;
  referenceAssetPath?: string;
}

export interface RenderRequest {
  sourceImagePath: string;
  landmarks: FaceLandmarks;
  hairMask?: HairMask;
  style: StyleSpec;
}

export interface RenderResult {
  outputImagePath: string;
  renderedAt: string;
}

export interface FaceLandmarkDetector {
  detect(imagePath: string): Promise<FaceLandmarks>;
}

export interface HairSegmenter {
  segment(imagePath: string): Promise<HairMask>;
}

export interface SkinToneAnalyzer {
  analyze(imagePath: string, landmarks: FaceLandmarks): Promise<SkinToneEstimate>;
}

export interface StyleRenderer {
  render(request: RenderRequest): Promise<RenderResult>;
}