import { GoogleGenAI } from "@google/genai";
import { TerrainProfile, ViewContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const FALLBACK_DESCRIPTIONS: Record<string, string> = {
  "Mercury": "Mercury is the smallest planet in the Solar System and the closest to the Sun. It orbits the Sun in just 88 Earth days. \n\nFun Fact: Despite being closest to the Sun, Mercury is not the hottest planet; Venus holds that title due to its thick atmosphere.",
  "Venus": "Venus is the second planet from the Sun and is Earth's closest planetary neighbor. It has a thick, toxic atmosphere filled with carbon dioxide and shrouded in thick yellowish clouds of sulfuric acid that trap heat, causing a runaway greenhouse effect.\n\nFun Fact: Venus spins in the opposite direction (retrograde rotation) to most other planets.",
  "Earth": "Earth is the third planet from the Sun and the only astronomical object known to harbor life. About 29% of Earth's surface is land consisting of continents and islands, while the remaining 71% is covered with water.\n\nFun Fact: Earth is the only planet not named after a Greek or Roman god or goddess.",
  "Mars": "Mars is the fourth planet from the Sun and the second-smallest planet in the Solar System, being larger than only Mercury. It is often referred to as the 'Red Planet' because the iron oxide prevalent on its surface gives it a reddish appearance.\n\nFun Fact: Mars is home to Olympus Mons, the tallest volcano and known mountain in the solar system.",
  "Jupiter": "Jupiter is the fifth planet from the Sun and the largest in the Solar System. It is a gas giant with a mass more than two and a half times that of all the other planets in the Solar System combined, but slightly less than one-thousandth the mass of the Sun.\n\nFun Fact: Jupiter has the shortest day of all the planets, spinning around its axis in just under 10 hours.",
  "Saturn": "Saturn is the sixth planet from the Sun and the second-largest in the Solar System, after Jupiter. It is a gas giant with an average radius of about nine and a half times that of Earth. It is famous for its prominent ring system.\n\nFun Fact: Saturn is the only planet in our solar system that is less dense than water; if there were a bathtub big enough, it would float.",
  "Uranus": "Uranus is the seventh planet from the Sun. It has the third-largest planetary radius and fourth-largest planetary mass in the Solar System. Uranus is similar in composition to Neptune, and both have bulk chemical compositions which differ from that of the larger gas giants Jupiter and Saturn.\n\nFun Fact: Uranus rotates on its side, making it the only planet whose equator is nearly at a right angle to its orbit.",
  "Neptune": "Neptune is the eighth and farthest-known Solar planet from the Sun. In the Solar System, it is the fourth-largest planet by diameter, the third-most-massive planet, and the densest giant planet. It is 17 times the mass of Earth.\n\nFun Fact: Neptune has the strongest winds in the solar system, reaching speeds of up to 1,300 miles per hour (2,100 km/h).",
  "The Sun": "The Sun is the star at the center of the Solar System. It is a nearly perfect sphere of hot plasma, heated to incandescence by nuclear fusion reactions in its core. It radiates this energy mainly as visible light, ultraviolet light, and infrared radiation.\n\nFun Fact: The Sun accounts for 99.86% of the mass in the solar system."
};

interface PlanetDetailRequest extends Partial<ViewContext> {
  name: string;
  bodyType?: string;
  fallbackText?: string;
}

const formatContextSnippet = (ctx?: Partial<ViewContext>) => {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.mode) parts.push(`mode: ${ctx.mode}`);
  if (ctx.cameraDistance !== undefined) parts.push(`range to target: ~${ctx.cameraDistance} units`);
  if (ctx.sunAltitude !== undefined) {
    const label = ctx.sunAltitude >= 0.75 ? "high sun (day)" : ctx.sunAltitude >= 0.4 ? "mid sun" : ctx.sunAltitude >= 0.15 ? "low sun (dusk/dawn)" : "night side";
    parts.push(`lighting: ${label}`);
  }
  return parts.length ? `Current view context — ${parts.join(', ')}.` : '';
};

// Simple in-memory cache so we don't spam the model for the same planet
const terrainCache: Record<string, TerrainProfile> = {};
const heuristicTerrain: Record<string, TerrainProfile> = {
  Mercury: 'mountainous',
  Venus: 'mountainous',
  Earth: 'balanced',
  Mars: 'mountainous',
  Jupiter: 'flat',
  Saturn: 'flat',
  Uranus: 'flat',
  Neptune: 'flat',
};

export const getTerrainPreference = async (planetName: string): Promise<TerrainProfile> => {
  if (terrainCache[planetName]) return terrainCache[planetName];
  const fallback = heuristicTerrain[planetName] ?? 'balanced';

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `You are assisting a procedural terrain generator for a space explorer.
For the planet "${planetName}", respond with exactly one word describing the recommended terrain feel: flat, balanced, or mountainous.
No punctuation, no sentences, just the single word.`,
    });

    const raw = response.text?.toLowerCase() || '';
    const choice: TerrainProfile =
      raw.includes('mountain') ? 'mountainous' :
      raw.includes('flat') ? 'flat' :
      'balanced';

    terrainCache[planetName] = choice;
    return choice;
  } catch (err) {
    console.warn("Gemini terrain query failed; using heuristic profile.", err);
    terrainCache[planetName] = fallback;
    return fallback;
  }
};

export const getPlanetDetails = async (request: PlanetDetailRequest): Promise<string> => {
  const planetName = request.name;
  const contextSnippet = formatContextSnippet(request);
  const fallbackText = request.fallbackText?.trim();
  const bodyType = request.bodyType?.trim();
  try {
    const model = 'gemini-2.5-flash';
    const prompt = `You are an expert astronomer and space travel guide.
    Write a short, engaging, and educational summary about ${planetName} tailored to the current view.
    ${bodyType ? `The target is a ${bodyType}.` : ''}
    ${contextSnippet}
    ${fallbackText ? `Onboard notes (may be incomplete): ${fallbackText}` : ''}
    Emphasize what the viewer would notice from this vantage (illumination, proximity), plus one concise fun fact.
    Keep it under 100 words.
    Format the output as plain text, using paragraphs.`;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
    });

    return response.text || FALLBACK_DESCRIPTIONS[planetName] || fallbackText || "Unable to retrieve planetary data.";
  } catch (error) {
    console.warn("Gemini API Quota exceeded or error. Switching to onboard computer (Fallback Data).");
    
    if (FALLBACK_DESCRIPTIONS[planetName]) {
        return FALLBACK_DESCRIPTIONS[planetName];
    }

    if (fallbackText) {
      return fallbackText;
    }

    return "Communications with the Galactic Database (Gemini) are currently down. Please try again later.";
  }
};
