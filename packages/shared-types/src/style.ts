export type StyleCategory = "hair_color" | "hair_style" | "makeup_lip" | "makeup_eye";

export interface Style {
  id: string;
  category: StyleCategory;
  name: string;
  targetColor?: string;
  referenceImageUrl?: string;
  active: boolean;
}