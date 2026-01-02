import { ElementDef, PhysicsType, GrowthStyle } from './types';

export const GRID_WIDTH = 120;
export const GRID_HEIGHT = 100;
export const FPS = 60;

// Initial set of elements
export const INITIAL_ELEMENTS: ElementDef[] = [
  {
    id: 0,
    name: 'Empty',
    color: '#000000',
    physics: PhysicsType.EMPTY,
    description: 'The void.',
  },
  {
    id: 1,
    name: 'Wall',
    color: '#808080',
    physics: PhysicsType.SOLID,
    description: 'Indestructible barrier.',
  },
  {
    id: 2,
    name: 'Sand',
    color: '#E6C288', // Warmer sand
    physics: PhysicsType.POWDER,
    description: 'Coarse and rough.',
  },
  {
    id: 3,
    name: 'Water',
    color: '#2288FF', // Bright distinct blue
    physics: PhysicsType.LIQUID,
    description: 'Flows freely.',
  },
  {
    id: 4,
    name: 'Fire',
    color: '#FF4500',
    physics: PhysicsType.ENERGY,
    description: 'Burns bright and fades.',
    decayTo: 0, 
    decayChance: 0.05,
  },
  {
    id: 5,
    name: 'Smoke',
    color: '#777777', // Lighter smoke for visibility
    physics: PhysicsType.GAS,
    description: 'Product of combustion.',
    decayTo: 0, // Decays to Empty
    decayChance: 0.01,
  },
  {
    id: 6,
    name: 'Hydrogen',
    color: '#FF4444', // Red for H2
    physics: PhysicsType.GAS,
    description: 'Highly flammable gas.',
  },
  {
    id: 7,
    name: 'Oxygen',
    color: '#FFFFFF', // White for O2
    physics: PhysicsType.GAS,
    description: 'Fuels combustion.',
  },
  {
    id: 8,
    name: 'Electricity',
    color: '#FFFF00', // Bright Yellow
    physics: PhysicsType.ENERGY, 
    description: 'Static power source. Splits water.',
    decayTo: 0,
    decayChance: 0.0, 
  },
  {
    id: 9,
    name: 'Water Wheel',
    color: '#CD853F', // Wood/Copper color
    physics: PhysicsType.MECHANISM,
    description: 'Churns water & generates power.',
  },
  {
    id: 10,
    name: 'Fan',
    color: '#A9A9A9', // Dark Gray
    physics: PhysicsType.MECHANISM,
    description: 'Blows gas upwards.',
  },
  {
    id: 11,
    name: 'Heater',
    color: '#8B0000', // Dark Red
    physics: PhysicsType.MECHANISM,
    description: 'Boils water, ignites gas.',
  },
  {
    id: 12,
    name: 'Vine',
    color: '#32CD32', // Lime Green
    physics: PhysicsType.LIFE,
    description: 'Hangs and climbs walls.',
    growthChance: 0.05, // Lowered
    decayChance: 0.005,
    growthStyle: GrowthStyle.CLING,
  },
  {
    id: 13,
    name: 'Grass',
    color: '#7CFC00', // Lawn Green
    physics: PhysicsType.LIFE,
    description: 'Grows on top of dirt/sand.',
    growthChance: 0.08, // Lowered
    decayChance: 0.005,
    growthStyle: GrowthStyle.SURFACE,
  },
  {
    id: 14,
    name: 'Tree',
    color: '#8B4513', // SaddleBrown (Wood color)
    physics: PhysicsType.LIFE,
    description: 'Grows wood and leaves.',
    growthChance: 0.05,
    decayChance: 0.0005,
    growthStyle: GrowthStyle.VERTICAL,
    relatedElementId: 15,
  },
  {
    id: 15,
    name: 'Leaf',
    color: '#228B22', // Forest Green
    physics: PhysicsType.LIFE,
    description: 'Grows on trees.',
    growthChance: 0, // Leaves don't grow on their own, they are spawned
    decayChance: 0.005,
    growthStyle: GrowthStyle.CLING,
  },
  {
    id: 16,
    name: 'Scrap',
    color: '#555555',
    physics: PhysicsType.SOLID,
    description: 'Dead electronics.',
  },
  {
    id: 17,
    name: 'Nanobot',
    color: '#FF00FF', // Magenta
    physics: PhysicsType.BOT,
    description: 'Consumes electricity. Replicates on Scrap. Dies in water.',
    decayTo: 16, // Turns to Scrap
    decayChance: 0.01, // Battery drain per tick (calculated manually)
  }
];

export const DEFAULT_BRUSH_SIZE = 3;