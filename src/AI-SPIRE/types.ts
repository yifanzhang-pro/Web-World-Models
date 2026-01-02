
export enum CardType {
  ATTACK = 'ATTACK',
  SKILL = 'SKILL',
  POWER = 'POWER'
}

export enum CardRarity {
  COMMON = 'COMMON',
  RARE = 'RARE',
  LEGENDARY = 'LEGENDARY'
}

export interface ICard {
  id: string;
  name: string;
  type: CardType;
  rarity: CardRarity;
  cost: number;
  damage?: number;
  block?: number;
  description: string;
  specialEffect?: string; 
  emoji?: string; // Visual representation
  price?: number; // For shops
  
  // Advanced Mechanics
  exhaust?: boolean; // Removed from combat when played
  ethereal?: boolean; // Exhausts if not played at end of turn
  innate?: boolean; // Always starts in opening hand
  retain?: boolean; // Not discarded at end of turn
  multiHit?: number; // Applies damage X times
}

export interface IRelic {
  id: string;
  name: string;
  description: string;
  effectType: string; // e.g. "strength_1", "dexterity_1", "max_hp_10", "start_energy_1"
  emoji: string;
  price?: number;
}

export interface IPower {
  id: string;
  name: string;
  description: string;
  effectType: string;
  icon: string;
}

export interface IEntity {
  maxHp: number;
  currentHp: number;
  block: number;
  statuses: { [key: string]: number }; // Changed from string[] to dictionary for counters (poison: 5, weak: 2)
}

export interface IPlayer extends IEntity {
  gold: number;
  energy: number;
  maxEnergy: number;
  deck: ICard[];
  hand: ICard[];
  discardPile: ICard[];
  drawPile: ICard[];
  exhaustPile: ICard[]; // Cards removed from combat
  relics: IRelic[];
  powers: IPower[];
}

export interface IEnemy extends IEntity {
  name: string;
  intent: string; 
  nextMoveDamage: number;
  isElite?: boolean;
  isBoss?: boolean;
  emoji?: string;
}

export enum RoomType {
  MONSTER = 'MONSTER',
  ELITE = 'ELITE',
  SHOP = 'SHOP',
  REST = 'REST',
  BOSS = 'BOSS'
}

export interface MapNode {
  id: string;
  type: RoomType;
  name: string;
  icon: string;
  level: number;
}

export enum GamePhase {
  MENU = 'MENU',
  MAP_SELECTION = 'MAP_SELECTION',
  BATTLE_PLAYER_TURN = 'BATTLE_PLAYER_TURN',
  BATTLE_ENEMY_TURN = 'BATTLE_ENEMY_TURN',
  BATTLE_WIN = 'BATTLE_WIN',
  BATTLE_LOSS = 'BATTLE_LOSS',
  REWARD = 'REWARD',
  SHOP = 'SHOP',
  REST = 'REST'
}

export interface GeneratedReward {
  level: number;
  cards: ICard[];
}

export interface ShopContent {
  cards: ICard[];
  relics: IRelic[];
}
