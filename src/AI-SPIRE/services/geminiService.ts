
import { GoogleGenAI, Type } from "@google/genai";
import { ICard, CardType, CardRarity, IRelic, ShopContent } from "../types";

// --- Validation & Sanitization Helpers ---

const clampNumber = (value: any, min: number, max: number, fallback: number) => {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
};

const normalizeCardType = (value: any): CardType | null => {
  const v = typeof value === 'string' ? value.toUpperCase() : value;
  if (v === CardType.ATTACK || v === CardType.SKILL || v === CardType.POWER) return v as CardType;
  return null;
};

const normalizeCardRarity = (value: any): CardRarity | null => {
  const v = typeof value === 'string' ? value.toUpperCase() : value;
  if (v === CardRarity.COMMON || v === CardRarity.RARE || v === CardRarity.LEGENDARY) return v as CardRarity;
  return null;
};

const sanitizeEmoji = (value: any) => (typeof value === 'string' && value.trim() ? value.trim() : '🃏');

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const getShopRarityChances = (level: number) => {
  const t = clamp01((level - 1) / 20);
  const legendary = lerp(0.02, 0.15, t);
  const rare = lerp(0.22, 0.55, t);
  const common = Math.max(0, 1 - legendary - rare);
  return { common, rare, legendary };
};

const rollShopCardRarity = (level: number): CardRarity => {
  const { rare, legendary } = getShopRarityChances(level);
  const roll = Math.random();
  if (roll < legendary) return CardRarity.LEGENDARY;
  if (roll < legendary + rare) return CardRarity.RARE;
  return CardRarity.COMMON;
};

const getShopCardPrice = (rarity: CardRarity) =>
  50 +
  (rarity === CardRarity.RARE ? 50 : rarity === CardRarity.LEGENDARY ? 100 : 0) +
  Math.floor(Math.random() * 20);

const ALLOWED_FETCH_SOURCES = new Set(['draw', 'discard', 'exhaust', 'deck']);
const ALLOWED_FETCH_FILTERS = new Set(['ATTACK', 'SKILL', 'POWER', 'ANY', 'ALL']);
const ALLOWED_ENEMY_STATUS = new Set(['poison', 'burn', 'freeze', 'stun', 'weak', 'vulnerable']);
const ALLOWED_PLAYER_STATUS = new Set(['strength', 'dexterity', 'frail', 'reflect', 'metallicize', 'regen']);
const ALLOWED_RECURRING_ACTIONS = new Set([
  'energy', 'block', 'heal', 'draw', 'damage', 'poison', 'weak', 'vulnerable', 'freeze', 'burn', 'regen', 'metallicize', 'plates'
]);
const ALLOWED_RELIC_TRIGGERS = new Set(['start_combat', 'end_combat', 'turn_start', 'play_attack', 'play_skill', 'play_power', 'shop_enter']);
const ALLOWED_RELIC_ACTIONS = new Set(['heal', 'damage', 'block', 'energy', 'draw', 'strength', 'dexterity', 'max_hp', 'apply']);
const ALLOWED_RELIC_APPLY = new Set(['poison', 'weak', 'vulnerable']);

const sanitizeEffectToken = (raw: string): string | null => {
  const effect = raw.trim().toLowerCase();
  if (!effect) return null;

  const parts = effect.split('_').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  const head = parts[0];

  if (head === 'fetch' || head === 'recover') {
    const source = parts[1];
    if (!ALLOWED_FETCH_SOURCES.has(source)) return null;
    const filterRaw = (parts[2] || '').toUpperCase();
    const filter = ALLOWED_FETCH_FILTERS.has(filterRaw) ? filterRaw : undefined;
    return filter ? `${head}_${source}_${filter}` : `${head}_${source}`;
  }

  if (ALLOWED_ENEMY_STATUS.has(head) || ALLOWED_PLAYER_STATUS.has(head)) {
    const amount = clampNumber(parts[1] ?? 1, 1, 50, 1);
    return `${head}_${amount}`;
  }

  if (head === 'draw' || head === 'energy' || head === 'heal' || head === 'lifesteal') {
    const amount = clampNumber(parts[1] ?? 0, 0, 50, 0);
    return `${head}_${amount}`;
  }

  if (head === 'self' && parts[1] === 'damage') {
    const amount = clampNumber(parts[2] ?? 0, 0, 30, 0);
    return `self_damage_${amount}`;
  }

  if (head === 'recurring' || head === 'turn_start' || head === 'start_turn') {
    const action = parts[1];
    if (!ALLOWED_RECURRING_ACTIONS.has(action)) return null;
    const amount = clampNumber(parts[2] ?? 1, 1, 50, 1);
    return `${head}_${action}_${amount}`;
  }

  return null;
};

const sanitizeSpecialEffect = (raw: any): string | undefined => {
  if (typeof raw !== 'string') return undefined;
  const sanitized = raw
    .split(',')
    .map(token => sanitizeEffectToken(token))
    .filter((t): t is string => Boolean(t));
  return sanitized.length ? sanitized.join(',') : undefined;
};

const sanitizeCard = (raw: any): ICard | null => {
  const type = normalizeCardType(raw?.type);
  const rarity = normalizeCardRarity(raw?.rarity);
  if (!type || !rarity) return null;

  const cost = clampNumber(raw?.cost, 0, 3, 1);
  const damage = raw?.damage !== undefined ? clampNumber(raw.damage, 0, 50, 0) : undefined;
  const block = raw?.block !== undefined ? clampNumber(raw.block, 0, 50, 0) : undefined;
  const multiHit = raw?.multiHit !== undefined ? clampNumber(raw.multiHit, 1, 5, 1) : undefined;

  const card: ICard = {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `card-${Math.random()}`,
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Unnamed Card',
    type,
    rarity,
    cost,
    damage,
    block,
    description: typeof raw?.description === 'string' && raw.description.trim() ? raw.description.trim() : 'No description.',
    specialEffect: sanitizeSpecialEffect(raw?.specialEffect),
    emoji: sanitizeEmoji(raw?.emoji),
    exhaust: Boolean(raw?.exhaust),
    ethereal: Boolean(raw?.ethereal),
    innate: Boolean(raw?.innate),
    retain: Boolean(raw?.retain),
    multiHit,
    price: raw?.price !== undefined ? clampNumber(raw.price, 0, 999, 0) : undefined
  };

  return card;
};

const sanitizeRelicEffectType = (raw: any): string | null => {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  const parts = raw.toLowerCase().split('_').map(p => p.trim()).filter(Boolean);
  if (!parts.length) return null;

  let trigger = 'start_combat';
  let index = 0;

  if (parts.length >= 2 && ALLOWED_RELIC_TRIGGERS.has(`${parts[0]}_${parts[1]}`)) {
    trigger = `${parts[0]}_${parts[1]}`;
    index = 2;
  } else if (ALLOWED_RELIC_TRIGGERS.has(parts[0])) {
    trigger = parts[0];
    index = 1;
  }

  const action = parts[index];
  if (!action) return null;

  if (action === 'apply') {
    const status = parts[index + 1];
    if (!ALLOWED_RELIC_APPLY.has(status)) return null;
    const amount = clampNumber(parts[index + 2] ?? 1, 1, 50, 1);
    return `${trigger}_apply_${status}_${amount}`;
  }

  if (action === 'max' && parts[index + 1] === 'hp') {
    const amount = clampNumber(parts[index + 2] ?? 5, 1, 50, 5);
    return `max_hp_${amount}`;
  }

  if (!ALLOWED_RELIC_ACTIONS.has(action)) return null;
  const amount = clampNumber(parts[index + 1] ?? 1, 1, 50, 1);
  return `${trigger}_${action}_${amount}`;
};

const sanitizeRelic = (raw: any): IRelic | null => {
  const effectType = sanitizeRelicEffectType(raw?.effectType);
  if (!effectType) return null;

  return {
    id: typeof raw?.id === 'string' && raw.id ? raw.id : `relic-${Math.random()}`,
    name: typeof raw?.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'Mystery Relic',
    description: typeof raw?.description === 'string' && raw.description.trim() ? raw.description.trim() : 'No description.',
    effectType,
    emoji: sanitizeEmoji(raw?.emoji),
    price: raw?.price !== undefined ? clampNumber(raw.price, 0, 2000, 0) : undefined
  };
};

const sanitizeCards = (rawCards: any[]): ICard[] =>
  (rawCards || []).map(sanitizeCard).filter((c): c is ICard => Boolean(c));

const sanitizeRelics = (rawRelics: any[]): IRelic[] =>
  (rawRelics || []).map(sanitizeRelic).filter((r): r is IRelic => Boolean(r));

const apiKey = process.env.API_KEY || '';
const ai = new GoogleGenAI({ apiKey });

const CARD_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    type: { type: Type.STRING, enum: ['ATTACK', 'SKILL', 'POWER'] },
    rarity: { type: Type.STRING, enum: ['COMMON', 'RARE', 'LEGENDARY'] },
    cost: { type: Type.INTEGER, description: "Between 0 and 3" },
    damage: { type: Type.INTEGER, description: "Optional damage value, 0 if none" },
    block: { type: Type.INTEGER, description: "Optional block value, 0 if none" },
    description: { type: Type.STRING },
    specialEffect: { 
      type: Type.STRING, 
      description: "Comma separated string. \nFormat: 'effect_amount' or 'action_source_target_amount'. \nAdvanced Actions: fetch_draw_attack, fetch_discard_skill, exhaust_hand_random, recover_exhaust_any. \nStats: poison_X, burn_X, freeze, reflect_X, strength_X, dexterity_X, weak_X, vulnerable_X, frail_X, lifesteal_X, draw_X, energy_X, self_damage_X. \nPowers: recurring_poison_X, recurring_strength_X, metallicize_X, regen_X."
    },
    emoji: { type: Type.STRING, description: "A single emoji representing the card concept" },
    exhaust: { type: Type.BOOLEAN, description: "If true, remove from combat when played." },
    ethereal: { type: Type.BOOLEAN, description: "If true, exhaust if not played this turn." },
    innate: { type: Type.BOOLEAN, description: "If true, start in opening hand." },
    retain: { type: Type.BOOLEAN, description: "If true, do not discard at end of turn." },
    multiHit: { type: Type.INTEGER, description: "If > 1, damage applies this many times." }
  },
  required: ['name', 'type', 'rarity', 'cost', 'description', 'emoji']
};

const RELIC_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    effectType: { 
      type: Type.STRING, 
      description: "Format: 'trigger_action_amount'. \nTRIGGERS: start_combat, end_combat, turn_start, play_attack, play_skill, play_power. \nACTIONS: heal, damage (to all enemies), block, energy, draw, strength, dexterity, apply_poison, apply_weak, apply_vulnerable, max_hp (immediate). \nExamples: 'start_combat_strength_1' (Vajra), 'end_combat_heal_6' (Burning Blood), 'turn_start_damage_3' (Mercury Hourglass), 'start_combat_draw_2' (Bag of Prep)." 
    },
    emoji: { type: Type.STRING, description: "A single emoji representing the relic" }
  },
  required: ['name', 'description', 'effectType', 'emoji']
};

export const generateRewardCards = async (level: number): Promise<ICard[]> => {
  if (!apiKey) return mockGenerateCards(level);

  const prompt = `
    Generate 3 CREATIVE & UNIQUE playing cards for a roguelike deckbuilder (Level ${level}).
    This is a "Slay the Spire" like game.
    
    Use these advanced mechanics to create synergy:
    1. Fetching: "Put an Attack from your draw pile into your hand" (specialEffect: "fetch_draw_attack").
    2. Recovery: "Return a card from Discard to Hand" (specialEffect: "fetch_discard_any").
    3. Keywords: Exhaust, Ethereal, Innate, Retain.
    4. Statuses: Poison, Burn, Freeze, Reflect, Metallicize (Block/turn), Regen (HP/turn).
    5. Multi-hit attacks (multiHit: 2 or 3).
    
    Examples:
    - "Tactical Retrieve": Skill, 0 cost, "Put a Skill from discard into hand.", specialEffect: "fetch_discard_skill", exhaust: true.
    - "Berserk": Power, 2 cost, "At start of turn, gain 2 Energy and 2 Vulnerable", specialEffect: "recurring_energy_2, recurring_vulnerable_2".
    - "Calculated Gamble": Skill, 1 cost, "Discard your hand, draw that many cards.", specialEffect: "discard_hand_all, draw_hand_count".
    - "Ice Shard": Attack, 1 cost, 6 dmg, "Apply 1 Weak and Freeze.", specialEffect: "weak_1, freeze".
    
    Return JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: CARD_SCHEMA
        }
      }
    });

    const rawCards = (() => {
      try {
        return JSON.parse(response.text || '[]');
      } catch {
        return [];
      }
    })();

    const sanitized = sanitizeCards(
      rawCards.map((c: any) => ({
        id: `gen-${level}-${Math.random().toString(36).substr(2, 9)}`,
        ...c
      }))
    );

    return sanitized.length ? sanitized : mockGenerateCards(level);

  } catch (error) {
    console.error("Gemini Generation Failed:", error);
    return mockGenerateCards(level);
  }
};

export const generateWishCard = async (wish: string, level: number): Promise<ICard> => {
  if (!apiKey) return mockGenerateCards(level)[0];

  const prompt = `
    Create a SINGLE playing card for a roguelike deckbuilder (Level ${level}) based on this USER WISH: "${wish}".
    
    Interpret the wish into valid game mechanics (damage, block, buffs, debuffs, special actions).
    If the wish is vague, be creative. If the wish is overpowered, balance it slightly but keep the flavor.
    
    Available Statuses/Effects: poison, burn, freeze, reflect, strength, dexterity, weak, vulnerable, frail, lifesteal, metallicize, regen.
    
    Return a single JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: CARD_SCHEMA
      }
    });

    const rawCard = (() => {
      try {
        return JSON.parse(response.text || '{}');
      } catch {
        return {};
      }
    })();

    const sanitized = sanitizeCard({
      id: `wish-${level}-${Math.random().toString(36).substr(2, 9)}`,
      ...rawCard
    });

    return sanitized || mockGenerateCards(level)[0];

  } catch (error) {
    console.error("Gemini Wish Generation Failed:", error);
    return mockGenerateCards(level)[0];
  }
};

export const generateShopContent = async (level: number): Promise<ShopContent> => {
  if (!apiKey) return mockGenerateShop(level);

  const prompt = `
    Generate items for a fantasy shop at Level ${level}.
    1. Generate 5 Cards (Mix of Attack/Skill/Power).
    2. Generate 2 CREATIVE Relics with triggers.
    
    Use the 'effectType' format: TRIGGER_ACTION_AMOUNT.
    Triggers: start_combat, end_combat, turn_start, play_attack, play_skill, play_power.
    
    Relic Examples (Spire Inspired):
    - "Burning Blood": Heal 6 at end of combat. (end_combat_heal_6)
    - "Vajra": Start combat with 1 Strength. (start_combat_strength_1)
    - "Mercury Hourglass": Deal 3 damage to enemies at start of turn. (turn_start_damage_3)
    - "Happy Flower": Gain 1 Energy at start of turn. (turn_start_energy_1)
    - "Anchor": Start combat with 10 Block. (start_combat_block_10)
    - "Bird-Faced Urn": Heal 2 whenever you play a Power. (play_power_heal_2)
    - "Meal Ticket": Heal 15 when entering shop. (shop_enter_heal_15)
    - "Bag of Preparation": Draw 2 cards at start of combat. (start_combat_draw_2)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            cards: { type: Type.ARRAY, items: CARD_SCHEMA },
            relics: { type: Type.ARRAY, items: RELIC_SCHEMA }
          }
        }
      }
    });

    const data = (() => {
      try {
        return JSON.parse(response.text || '{}');
      } catch {
        return {};
      }
    })();
    
    const cards = sanitizeCards(
      (data.cards || []).map((c: any) => {
        const rarity = rollShopCardRarity(level);
        return {
          id: `shop-c-${Math.random()}`,
          ...c,
          rarity,
          price: getShopCardPrice(rarity)
        };
      })
    );

    const relics = sanitizeRelics(
      (data.relics || []).map((r: any) => ({
        id: `shop-r-${Math.random()}`,
        ...r,
        price: 150 + Math.floor(Math.random() * 50)
      }))
    );

    if (!cards.length || !relics.length) return mockGenerateShop(level);

    return { cards, relics };

  } catch (error) {
    return mockGenerateShop(level);
  }
};

export const generateEliteRelic = async (level: number): Promise<IRelic> => {
  if (!apiKey) return mockGenerateRelic();

  const prompt = `
    Generate 1 EXTREMELY UNIQUE Relic for a roguelike deckbuilder (Level ${level}).
    
    Use the 'effectType' format: TRIGGER_ACTION_AMOUNT.
    Triggers: start_combat, end_combat, turn_start, play_attack, play_skill, play_power.
    Actions: heal, damage, block, energy, draw, strength, dexterity, apply_poison, apply_weak.

    Examples:
    - "Black Blood": End combat, heal 12. (end_combat_heal_12)
    - "Horn Cleat": Turn start, gain 14 Block. (turn_start_block_14)
    - "Shuriken": Play attack, gain 1 Strength (simplified). (play_attack_strength_1)
    - "Ornamental Fan": Play skill, gain 4 Block (simplified). (play_skill_block_4)
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: RELIC_SCHEMA
      }
    });

    const rawRelic = (() => {
      try {
        return JSON.parse(response.text || '{}');
      } catch {
        return {};
      }
    })();

    const relic = sanitizeRelic({ id: `elite-${Math.random()}`, ...rawRelic });
    return relic || mockGenerateRelic();

  } catch (e) {
    return mockGenerateRelic();
  }
};

// --- MOCKS ---

const mockGenerateCards = (level: number): ICard[] => [
  {
    id: `mock-1-${Date.now()}`, name: `Venom Strike`, type: CardType.ATTACK, rarity: CardRarity.COMMON,
    cost: 1, damage: 4 + level, specialEffect: "poison_4", description: `Deal ${4+level} dmg. Apply 4 Poison.`, emoji: "🐍"
  },
  {
    id: `mock-2-${Date.now()}`, name: `Seeker`, type: CardType.SKILL, rarity: CardRarity.RARE,
    cost: 0, specialEffect: "fetch_draw_attack", description: `Put an Attack from your draw pile into your hand.`, emoji: "🔭", exhaust: true
  },
  {
    id: `mock-3-${Date.now()}`, name: `Combustion`, type: CardType.POWER, rarity: CardRarity.RARE,
    cost: 1, specialEffect: "burn_5", description: "Apply 5 Burn.", emoji: "🔥"
  }
];

const mockGenerateRelic = (): IRelic => ({
  id: `mock-r-${Date.now()}`, name: "Burning Blood", description: "Heal 6 HP at the end of combat.",
  effectType: "end_combat_heal_6", emoji: "🩸"
});

const mockGenerateShop = (level: number): ShopContent => ({
  cards: mockGenerateCards(level).map(c => {
    const rarity = rollShopCardRarity(level);
    return { ...c, rarity, price: getShopCardPrice(rarity) };
  }),
  relics: [mockGenerateRelic(), { ...mockGenerateRelic(), id: 'r2', name: "Anchor", description: "Start combat with 10 Block.", effectType: "start_combat_block_10", emoji: "⚓", price: 150 }]
});
