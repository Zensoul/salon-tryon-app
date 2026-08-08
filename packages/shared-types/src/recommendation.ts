export type FaceShape = "oval" | "round" | "square" | "heart" | "diamond" | "oblong";
export type Undertone = "warm" | "cool" | "neutral";

export interface FaceAnalysis {
  faceShape: FaceShape;
  skinToneHex: string;
  undertone: Undertone;
}

export interface StyleRecommendation {
  sessionId: string;
  analysis: FaceAnalysis;
  recommendedStyleIds: string[];
  rationale: string;
  createdAt: string;
}