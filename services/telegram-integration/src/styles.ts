export interface HairColorOption {
  id: string;
  label: string;
  hex: string;
}

export const HAIR_COLOR_OPTIONS: HairColorOption[] = [
  { id: "natural_black", label: "Natural Black", hex: "#1C1C1C" },
  { id: "chestnut_brown", label: "Chestnut Brown", hex: "#5A3825" },
  { id: "chocolate_brown", label: "Chocolate Brown", hex: "#3D2314" },
  { id: "copper", label: "Copper", hex: "#B87333" },
  { id: "honey_blonde", label: "Honey Blonde", hex: "#C68E3F" },
  { id: "platinum_blonde", label: "Platinum Blonde", hex: "#E8DCC4" },
  { id: "burgundy", label: "Burgundy", hex: "#5C1A2B" },
  { id: "ash_grey", label: "Ash Grey", hex: "#8B8B8B" },
];