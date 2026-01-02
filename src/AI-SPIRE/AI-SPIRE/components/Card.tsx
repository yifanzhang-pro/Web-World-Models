import React from 'react';
import { ICard, CardType, CardRarity } from '../types';
import { Coins, Ghost, Pin, Sparkles, Trash2 } from 'lucide-react';

interface CardProps {
  card: ICard;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  onTouchStart?: (e: React.TouchEvent) => void;
  playable?: boolean;
  disabled?: boolean;
  className?: string;
  showPrice?: boolean;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({ 
  card, 
  onClick, 
  onMouseDown,
  onTouchStart,
  playable, 
  disabled, 
  className = '', 
  showPrice = false,
  style
}) => {
  
  const getBorderColor = (rarity: CardRarity) => {
    switch (rarity) {
      case CardRarity.RARE: return 'border-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.3)]';
      case CardRarity.LEGENDARY: return 'border-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.5)]';
      default: return 'border-slate-600';
    }
  };

  const getBgGradient = (type: CardType) => {
    switch (type) {
      case CardType.ATTACK: return 'from-red-950 to-slate-900';
      case CardType.SKILL: return 'from-blue-950 to-slate-900';
      case CardType.POWER: return 'from-purple-950 to-slate-900';
    }
  };

  return (
    <div 
      className={`flex flex-col items-center group/card ${className}`} 
      style={style}
      onMouseDown={!disabled ? onMouseDown : undefined}
      onTouchStart={!disabled ? onTouchStart : undefined}
      onClick={!disabled ? onClick : undefined}
    >
      <div 
        className={`
          relative w-28 h-40 md:w-40 md:h-60 rounded-xl border-2 flex flex-col overflow-hidden transition-transform duration-100 select-none
          bg-gradient-to-b ${getBgGradient(card.type)}
          ${getBorderColor(card.rarity)}
          ${playable && !disabled ? 'cursor-grab active:cursor-grabbing shadow-2xl z-10' : ''}
          ${disabled ? 'opacity-60 grayscale cursor-not-allowed' : 'bg-slate-800'}
          ${card.ethereal ? 'opacity-90' : ''}
        `}
      >
        {/* Cost Badge */}
        <div className="absolute top-1 left-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-blue-500 flex items-center justify-center font-bold text-white border border-blue-300 shadow-lg z-20 text-xs md:text-sm">
            {card.cost}
        </div>

        {/* Name */}
        <div className="mt-1 md:mt-2 px-1 md:px-2 text-center z-10 h-8 md:h-10 flex items-center justify-center">
          <span className={`font-bold text-[10px] md:text-xs leading-tight ${card.rarity === 'LEGENDARY' ? 'text-yellow-300' : 'text-slate-100'}`}>
            {card.name}
          </span>
        </div>

        {/* Emoji Visualization */}
        <div className="flex-1 flex items-center justify-center bg-black/20 mx-2 my-1 rounded border border-white/5 relative overflow-hidden">
           <div className="text-4xl md:text-6xl transform group-hover/card:scale-110 transition-transform duration-500 filter drop-shadow-lg">
             {card.emoji || '🃏'}
           </div>
           {/* Type Label */}
           <div className="absolute bottom-0 w-full text-[8px] md:text-[10px] text-center bg-black/40 text-slate-300 uppercase tracking-widest font-bold py-0.5">
             {card.type}
           </div>
        </div>

        {/* Description */}
        <div className="h-16 md:h-20 p-1 md:p-2 flex flex-col justify-center items-center bg-black/30 text-center mx-2 mb-2 rounded border border-white/5">
          <p className="text-[8px] md:text-[10px] font-medium text-slate-200 leading-tight">
            {card.description}
          </p>
          
          {/* Keyword Icons */}
          <div className="flex gap-1 mt-1">
            {card.exhaust && <div title="Exhaust"><Trash2 size={10} className="text-gray-400" /></div>}
            {card.ethereal && <div title="Ethereal"><Ghost size={10} className="text-cyan-300" /></div>}
            {card.innate && <div title="Innate"><Sparkles size={10} className="text-yellow-300" /></div>}
            {card.retain && <div title="Retain"><Pin size={10} className="text-green-300" /></div>}
          </div>
        </div>
      </div>
      
      {/* Price Tag for Shops */}
      {showPrice && card.price !== undefined && (
        <div className="mt-2 bg-slate-900 px-2 md:px-3 py-1 rounded-full border border-yellow-600 flex items-center gap-1 text-yellow-400 text-xs md:text-sm font-bold shadow-lg">
          <Coins size={12} className="md:w-3.5 md:h-3.5" /> {card.price}
        </div>
      )}
    </div>
  );
};