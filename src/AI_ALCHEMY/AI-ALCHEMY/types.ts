export enum PhysicsType {
  EMPTY = 'EMPTY',
  SOLID = 'SOLID',   // Walls, Stone (Static)
  POWDER = 'POWDER', // Sand, Dirt (Falls, piles)
  LIQUID = 'LIQUID', // Water, Acid (Falls, flows sideways)
  GAS = 'GAS',       // Steam, Smoke (Rises, flows sideways)
  ENERGY = 'ENERGY', // Fire, Electricity (Overlay, non-material)
  MECHANISM = 'MECHANISM', // Machines, Rotators, Fans (Static, moves neighbors)
  LIFE = 'LIFE',     // Plants, organic matter (Static, grows)
  BOT = 'BOT',       // Artificial life, consumes energy, moves
}

export enum GrowthStyle {
  SPREAD = 'SPREAD', // Grows in all directions (Mold, Moss)
  VERTICAL = 'VERTICAL', // Grows upwards, needs support (Tree, Corn)
  SURFACE = 'SURFACE', // Grows along top of solids (Grass)
  CLING = 'CLING', // Grows on walls or hangs (Vines)
}

export interface ElementDef {
  id: number;
  name: string;
  color: string; // Hex code
  physics: PhysicsType;
  description: string;
  decayTo?: number; // ID of element to turn into (e.g., Fire -> Smoke)
  decayChance?: number; // 0-1 probability per tick
  growthChance?: number; // 0-1 probability to spread to neighbor per tick
  growthStyle?: GrowthStyle; // How it behaves if it is LIFE
  relatedElementId?: number; // ID of element produced (e.g., Tree -> Leaf)
}

export interface ReactionResult {
  name: string;
  color: string;
  physics: PhysicsType;
  description: string;
  growthChance?: number;
  decayChance?: number;
  growthStyle?: GrowthStyle;
  relatedElementId?: number;
}

// Map 'ElementID_ElementID' -> ResultingElementID
export type ReactionMap = Map<string, number>;