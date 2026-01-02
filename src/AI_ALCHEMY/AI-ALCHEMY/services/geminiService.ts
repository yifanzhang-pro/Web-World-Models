import { GoogleGenAI, Type } from "@google/genai";
import { ElementDef, PhysicsType, ReactionResult, GrowthStyle } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

export const discoverReaction = async (
  elemA: ElementDef,
  elemB: ElementDef
): Promise<ReactionResult | null> => {
  try {
    const ai = getClient();
    
    const prompt = `
    Context: 2D Physics Sandbox.
    Interaction:
    1. "${elemA.name}"
       - Physics: ${elemA.physics}
       - Properties: ${elemA.description}
    2. "${elemB.name}"
       - Physics: ${elemB.physics}
       - Properties: ${elemB.description}
    
    Task: Determine if a NEW substance is created when these two mix.
    
    Rules:
    - Mass Conservation: 1 pixel of A + 1 pixel of B -> 2 pixels of Result. (A+B -> 2*C).
    - Life Physics: All LIFE elements REQUIRE 'Water' to grow. 1 Water pixel is consumed to create 1 Plant pixel.
    - **Advanced Life**: Plants have a BIDIRECTIONAL vascular system. Water can be absorbed by ROOTS or LEAVES and transported throughout the organism.
    - Energy (Fire/Elec) triggers reactions.
    - BOT elements act like cellular automata, consume energy.
    
    Safety Rules (CRITICAL):
    - NO INFINITE GROWTH: Do not create 'Grey Goo' or elements that fill the screen instantly.
    - If growthStyle is SPREAD/LIFE, growthChance MUST be low (< 0.1).
    - Aggressive elements must have high decayChance (> 0.05) or consume a resource.
    
    Output:
    Return JSON. 
    If reaction:
    - Name: Short unique name.
    - Physics: SOLID, POWDER, LIQUID, GAS, ENERGY, MECHANISM, LIFE, BOT.
    - growthStyle: If LIFE, choose SPREAD (mold), VERTICAL (tree), SURFACE (grass), or CLING (vine).
    - growthChance: 0.0 to 1.0.
    - relatedElementId: ID of a child element (e.g., fruit from tree). Optional.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reactionOccurred: { type: Type.BOOLEAN },
            result: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                color: { type: Type.STRING },
                physics: { 
                  type: Type.STRING, 
                  enum: [
                    PhysicsType.SOLID,
                    PhysicsType.POWDER,
                    PhysicsType.LIQUID,
                    PhysicsType.GAS,
                    PhysicsType.ENERGY,
                    PhysicsType.MECHANISM,
                    PhysicsType.LIFE,
                    PhysicsType.BOT
                  ] 
                },
                description: { type: Type.STRING },
                growthChance: { type: Type.NUMBER, nullable: true },
                decayChance: { type: Type.NUMBER, nullable: true },
                growthStyle: { 
                  type: Type.STRING, 
                  enum: ["SPREAD", "VERTICAL", "SURFACE", "CLING"],
                  nullable: true
                },
                relatedElementId: { type: Type.NUMBER, nullable: true }
              },
              nullable: true
            }
          }
        }
      }
    });

    const jsonText = response.text;
    if (!jsonText) return null;

    const data = JSON.parse(jsonText);

    if (data.reactionOccurred && data.result) {
      // Safety Clamp: Prevent infinite growth by capping chance
      let gChance = data.result.growthChance;
      if (typeof gChance === 'number' && gChance > 0.15) gChance = 0.15;

      return {
        name: data.result.name,
        color: data.result.color,
        physics: data.result.physics as PhysicsType,
        description: data.result.description,
        growthChance: gChance,
        decayChance: data.result.decayChance,
        growthStyle: data.result.growthStyle as GrowthStyle,
        relatedElementId: data.result.relatedElementId
      };
    }

    return null;

  } catch (error: any) {
    const errorMessage = error.message || JSON.stringify(error);
    if (
      errorMessage.includes('429') || 
      errorMessage.includes('quota') || 
      errorMessage.includes('RESOURCE_EXHAUSTED')
    ) {
        throw new Error("RATE_LIMIT");
    }
    console.error("Gemini API Error:", error);
    return null;
  }
};

export interface ElementCommandResult {
  operation: 'CREATE' | 'UPDATE' | 'NONE';
  elementData?: Partial<ElementDef>;
  targetName?: string; // For updates
  message?: string;
}

export const parseElementCommand = async (
  userText: string,
  currentElements: ElementDef[]
): Promise<ElementCommandResult> => {
  try {
    const ai = getClient();
    const elementList = currentElements.map(e => e.name).join(', ');

    const prompt = `
    User Command: "${userText}"
    Current Elements: ${elementList}

    Task: CREATE a new element or UPDATE an existing one based on natural language.
    
    Logic:
    - If LIFE/Plant:
      - "grow on ground/floor" -> SURFACE
      - "grow up/tall/tree" -> VERTICAL
      - "climb/hang/vine" -> CLING
      - "spread/mold" -> SPREAD
    
    Physics Constraint:
    - All LIFE elements strictly consume WATER to grow. 1 Water -> 1 Growth.
    - If no water is present, Plants will not grow.
    - **Vascular System**: Plants transport water bidirectionally (Roots <-> Leaves). Leaves can drink water too.
    
    Safety Rules (CRITICAL):
    - NO INFINITE GROWTH: Do not create 'Grey Goo' or elements that fill the screen instantly.
    - If growthStyle is SPREAD/LIFE, growthChance MUST be low (< 0.1).
    - Aggressive elements must have high decayChance (> 0.05) or consume a resource.
    
    Output JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                operation: { type: Type.STRING, enum: ["CREATE", "UPDATE", "NONE"] },
                targetName: { type: Type.STRING, nullable: true },
                data: {
                    type: Type.OBJECT,
                    properties: {
                        name: { type: Type.STRING },
                        color: { type: Type.STRING },
                        physics: { 
                            type: Type.STRING, 
                            enum: ["SOLID", "POWDER", "LIQUID", "GAS", "ENERGY", "MECHANISM", "LIFE", "BOT"] 
                        },
                        description: { type: Type.STRING },
                        growthChance: { type: Type.NUMBER, nullable: true },
                        decayChance: { type: Type.NUMBER, nullable: true },
                        growthStyle: { 
                          type: Type.STRING, 
                          enum: ["SPREAD", "VERTICAL", "SURFACE", "CLING"],
                          nullable: true
                        },
                        relatedElementId: { type: Type.NUMBER, nullable: true }
                    },
                    nullable: true
                },
                message: { type: Type.STRING }
            }
        }
      }
    });

    const res = JSON.parse(response.text);

    // Safety Clamp
    if (res.data && typeof res.data.growthChance === 'number' && res.data.growthChance > 0.15) {
        res.data.growthChance = 0.15;
    }

    return {
        operation: res.operation,
        targetName: res.targetName,
        elementData: res.data,
        message: res.message
    };

  } catch (e) {
      console.error(e);
      return { operation: 'NONE', message: "Failed to process command." };
  }
};

export interface SupervisorAction {
    actionType: 'DRAW' | 'NEW_ELEMENT' | 'WAIT';
    reason: string;
    drawCommand?: {
        elementName: string;
        x: number; // 0-100 percentage
        y: number; // 0-100 percentage
        radius: number;
    };
    newElementCommand?: {
        name: string;
        description: string;
    }
}

export const getSupervisorAction = async (
    stats: Record<string, number>,
    existingElementNames: string[],
    imageBase64: string,
    userGuidance?: string
): Promise<SupervisorAction> => {
    try {
        const ai = getClient();
        const statStr = JSON.stringify(stats);
        
        // Explicitly Calculate Dominance Percentage for Logic Check
        const total = stats['Total'] || 1;
        const dominanceChecks = Object.entries(stats)
            .filter(([name]) => name !== 'Total' && name !== 'Empty')
            .map(([name, count]) => {
                const percentage = (count / total) * 100;
                return `${name}: ${percentage.toFixed(1)}%`;
            }).join(', ');

        const prompt = `
        Role: Supervisor of a 2D Physics Sandbox.
        Goal: Maintain a BALANCED, evolving ecosystem. PREVENT MONOPOLIES.
        
        Input:
        1. Pixel Counts: ${statStr}
        2. Dominance Analysis: ${dominanceChecks} (Threshold > 50% triggers ACTION).
        3. Image: A screenshot of the current sandbox.
        4. User Instructions: "${userGuidance ? userGuidance : "None. Act autonomously."}"

        Instructions:
        1. **PRIORITY - USER INSTRUCTIONS**: If "User Instructions" are provided, you MUST attempt to fulfill them immediately, overriding standard balancing logic.
           - If user says "Make a forest", DRAW Trees or Grass.
           - If user says "Destroy sand", DRAW Empty or Water.
           - If user says "Make chaos", DRAW Fire.
           
        2. IF NO USER INSTRUCTIONS:
           - LOOK at the image to understand the spatial layout (clumps, flat lines, chaos).
           - CHECK pixel stats for dominance.
           - **Total Screen Pixels** = Use the 'Total' count in stats (includes 'Empty').
           - **Dominance Threshold** = 50% of the TOTAL SCREEN PIXELS.
           - Calculation: (ElementCount / TotalPixels) * 100. If > 50%, triggers dominance.

        Physics Awareness:
        - **LIFE NEEDS WATER**: Plants/Life will ONLY grow if there is Water to consume. If you want Life to flourish, ensure Water exists.

        Priorities (Autonomous Mode):
        1. **DOMINANCE CHECK**: If a SINGLE element covers > 50% of the ENTIRE SCREEN, you MUST reduce it.
           - Action: DRAW 'Empty' to create holes in the big blob.
           - Action: DRAW a counter-element (Fire burns Wood, Water erodes Earth).
           - Action: NEW_ELEMENT 'Virus' or 'Eater' designed to destroy that specific element.
           - CONSTRAINT: When creating a counter-element, ensure it DECAYS naturally so it doesn't become the new monopoly.
        2. **STAGNATION CHECK**: If nothing is moving or growing (visually static), introduce Life or Energy.
        3. **CHAOS CHECK**: If too much Fire/Energy visually, dump Water.
        4. **BUILD**: If world is empty, build Terrain.

        Output JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    inlineData: {
                        mimeType: "image/jpeg",
                        data: imageBase64
                    }
                },
                {
                    text: prompt
                }
            ],
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        actionType: { type: Type.STRING, enum: ["DRAW", "NEW_ELEMENT", "WAIT"] },
                        reason: { type: Type.STRING },
                        drawCommand: {
                            type: Type.OBJECT,
                            properties: {
                                elementName: { type: Type.STRING },
                                x: { type: Type.NUMBER },
                                y: { type: Type.NUMBER },
                                radius: { type: Type.NUMBER }
                            },
                            nullable: true
                        },
                        newElementCommand: {
                            type: Type.OBJECT,
                            properties: {
                                name: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            nullable: true
                        }
                    }
                }
            }
        });

        return JSON.parse(response.text) as SupervisorAction;

    } catch (e) {
        console.error("Supervisor Error", e);
        return { actionType: 'WAIT', reason: "Error connecting to AI." };
    }
}