export interface MoonData {
  name: string;
  radius: number; // Relative size
  distance: number; // Distance from parent planet
  speed: number; // Orbit speed
  color: string;
  description?: string;
}

export interface PlanetData {
  name: string;
  color: string;
  radius: number; // Relative size
  distance: number; // Distance from sun
  speed: number; // Orbit speed
  description: string;
  type?: 'planet' | 'star' | 'asteroid' | 'moon';
  owner?: string; // For claimed asteroids
  hasRings?: boolean;
  ringColor?: string;
  textureUrl?: string;
  hasAtmosphere?: boolean;
  moons?: MoonData[];
}

export interface GeminiResponse {
  text: string;
}

export type ViewMode = 'orbit' | 'fly' | 'landed';
export type TerrainProfile = 'flat' | 'balanced' | 'mountainous';

export interface ViewContext {
  mode: ViewMode;
  cameraDistance?: number;
  sunAltitude?: number;
  targetName?: string | null;
}
