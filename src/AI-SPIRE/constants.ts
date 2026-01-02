
import { ICard, CardType, CardRarity } from './types';

export const INITIAL_ENERGY = 3;
export const CARDS_PER_TURN = 3;
export const INITIAL_HAND_SIZE = 5;
export const MAX_HAND_SIZE = 10;
export const STARTING_GOLD = 99;

const createStrike = (id: string): ICard => ({
  id: `strike-${id}`,
  name: "Strike",
  type: CardType.ATTACK,
  rarity: CardRarity.COMMON,
  cost: 1,
  damage: 6,
  description: "Deal 6 damage.",
  emoji: "🗡️"
});

const createDefend = (id: string): ICard => ({
  id: `defend-${id}`,
  name: "Defend",
  type: CardType.SKILL,
  rarity: CardRarity.COMMON,
  cost: 1,
  block: 5,
  description: "Gain 5 Block.",
  emoji: "🛡️"
});

const createBash = (id: string): ICard => ({
  id: `bash-${id}`,
  name: "Bash",
  type: CardType.ATTACK,
  rarity: CardRarity.COMMON,
  cost: 2,
  damage: 8,
  block: 0,
  specialEffect: "vulnerable_2",
  description: "Deal 8 damage. Apply 2 Vulnerable.",
  emoji: "💥"
});

export const getInitialDeck = (): ICard[] => [
  createStrike('1'), createStrike('2'), createStrike('3'), createStrike('4'),
  createDefend('1'), createDefend('2'), createDefend('3'), createDefend('4'),
  createBash('1')
];
