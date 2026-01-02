
import React, { useState, useEffect, useRef } from 'react';
import { 
  ICard, IPlayer, IEnemy, GamePhase, CardType, RoomType, MapNode, ShopContent, IRelic, IPower
} from './types';
import { getInitialDeck, CARDS_PER_TURN, INITIAL_ENERGY, STARTING_GOLD, INITIAL_HAND_SIZE, MAX_HAND_SIZE } from './constants';
import { generateRewardCards, generateShopContent, generateEliteRelic, generateWishCard } from './services/geminiService';
import { Card } from './components/Card';
import { 
  Shield, Heart, Zap, Swords, Skull, RefreshCcw, Loader2, Map as MapIcon, 
  Coins, ShoppingBag, Tent, Trophy, ArrowRight, Flame, Snowflake, Activity, ShieldAlert, Ghost, Layers, Search, X, Sparkles, Wand2
} from 'lucide-react';

// --- Icons & Small Components ---

const StatusIcon: React.FC<{ type: string, value: number }> = ({ type, value }) => {
  let icon = <Zap size={14} />;
  let color = "text-slate-200";
  let bg = "bg-slate-800";

  switch(type) {
    case 'strength': icon = <Swords size={14} />; color = "text-red-400"; break;
    case 'dexterity': icon = <Shield size={14} />; color = "text-green-400"; break;
    case 'vulnerable': icon = <ShieldAlert size={14} />; color = "text-purple-400"; break;
    case 'weak': icon = <RefreshCcw size={14} />; color = "text-yellow-400"; break;
    case 'frail': icon = <ShieldAlert size={14} />; color = "text-pink-400"; break;
    case 'poison': icon = <Activity size={14} />; color = "text-green-500"; break;
    case 'burn': icon = <Flame size={14} />; color = "text-orange-500"; break;
    case 'freeze': icon = <Snowflake size={14} />; color = "text-cyan-400"; break;
    case 'reflect': icon = <RefreshCcw size={14} />; color = "text-blue-400"; break;
    case 'metallicize': icon = <Shield size={14} />; color = "text-gray-300"; break;
    case 'regen': icon = <Heart size={14} />; color = "text-green-300"; break;
  }

  return (
    <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border border-slate-600 ${bg} ${color} text-[10px] md:text-xs shadow-sm`} title={type}>
      {icon} <span className="font-bold">{value}</span>
    </div>
  );
};

const ProgressBar: React.FC<{ current: number, max: number, colorClass: string, icon: React.ReactNode, label?: string }> = ({ current, max, colorClass, icon, label }) => (
  <div className="flex items-center gap-2 w-24 md:w-full max-w-xs group relative">
    <div className="text-white scale-75 md:scale-100">{icon}</div>
    <div className="flex-1 h-3 md:h-4 bg-slate-700 rounded-full overflow-hidden border border-slate-600 relative">
      <div 
        className={`h-full transition-all duration-500 ${colorClass}`} 
        style={{ width: `${Math.min(100, Math.max(0, (current / max) * 100))}%` }}
      />
      <span className="absolute inset-0 flex items-center justify-center text-[10px] md:text-xs font-bold text-white drop-shadow-md z-10">
        {current} / {max}
      </span>
    </div>
    {label && <div className="absolute -bottom-5 left-8 text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity hidden md:block">{label}</div>}
  </div>
);

const RelicIcon: React.FC<{ relic: IRelic, onClick?: () => void, tooltipSide?: 'bottom' | 'right' }> = ({ relic, onClick, tooltipSide = 'bottom' }) => {
  const tooltipClasses = tooltipSide === 'right'
    ? "absolute left-full top-0 ml-3 w-40 md:w-48 p-2 bg-slate-900 text-slate-200 text-xs rounded border border-slate-600 hidden group-hover:block z-50 shadow-xl pointer-events-none"
    : "absolute top-full right-0 mt-2 w-40 md:w-48 p-2 bg-slate-900 text-slate-200 text-xs rounded border border-slate-600 hidden group-hover:block z-50 shadow-xl pointer-events-none";

  return (
    <div 
      className="w-8 h-8 md:w-10 md:h-10 bg-slate-800 rounded-full border border-yellow-600 flex items-center justify-center text-lg md:text-xl cursor-help relative group hover:scale-110 transition-transform shadow-lg flex-shrink-0"
      onClick={onClick}
    >
      {relic.emoji}
      <div className={tooltipClasses}>
        <div className="font-bold text-yellow-400 mb-1">{relic.name}</div>
        {relic.description}
      </div>
    </div>
  );
};

// --- Types for Selection ---
interface SelectionState {
  isOpen: boolean;
  source: 'draw' | 'discard' | 'exhaust' | 'deck';
  filter?: string; // 'ATTACK', 'SKILL', 'POWER' or undefined for all
  title: string;
  onSelect: (card: ICard) => void;
}

// --- Main Component ---

export default function App() {
  // Game State
  const [phase, setPhase] = useState<GamePhase>(GamePhase.MENU);
  const [level, setLevel] = useState(1);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Entities
  const [player, setPlayer] = useState<IPlayer>({
    maxHp: 60,
    currentHp: 60,
    block: 0,
    statuses: {},
    gold: STARTING_GOLD,
    energy: INITIAL_ENERGY,
    maxEnergy: INITIAL_ENERGY,
    deck: getInitialDeck(),
    hand: [],
    discardPile: [],
    drawPile: [],
    exhaustPile: [],
    relics: [],
    powers: []
  });

  // Selection UI State
  const [selection, setSelection] = useState<SelectionState | null>(null);

  // Wish State
  const [wishInput, setWishInput] = useState('');
  const [isWishing, setIsWishing] = useState(false);

  // Drag State
  const [dragState, setDragState] = useState<{
    isDragging: boolean;
    cardIndex: number;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Ensure draw pile is initialized correctly on first render if needed
  useEffect(() => {
    if (phase === GamePhase.MENU) {
       setPlayer(p => ({ ...p, drawPile: [...p.deck].sort(() => Math.random() - 0.5) }));
    }
  }, [phase]);

  const [enemy, setEnemy] = useState<IEnemy>({
    maxHp: 20,
    currentHp: 20,
    block: 0,
    statuses: {},
    name: "Cultist",
    intent: "Attack",
    nextMoveDamage: 5,
    emoji: "🐦"
  });

  // Navigation / Content State
  const [nextNodes, setNextNodes] = useState<MapNode[]>([]);
  const [currentRoom, setCurrentRoom] = useState<RoomType | null>(null);
  
  // Generated Content
  const [pendingRewards, setPendingRewards] = useState<ICard[] | null>(null);
  const [shopContent, setShopContent] = useState<ShopContent | null>(null);
  const [pendingEliteRelic, setPendingEliteRelic] = useState<IRelic | null>(null);
  
  const generationLock = useRef(false);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 4));
  };

  // --- Drag and Drop Handlers ---
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState?.isDragging) {
        setDragState(prev => prev ? ({ ...prev, currentX: e.clientX, currentY: e.clientY }) : null);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (dragState?.isDragging) {
        // Check if dropped in "play zone" (roughly top 60% of screen)
        if (e.clientY < window.innerHeight * 0.6) {
          const card = player.hand[dragState.cardIndex];
          if (card && player.energy >= card.cost) {
            playCard(card, dragState.cardIndex);
          } else if (player.energy < card.cost) {
            addLog("Not enough energy!");
          }
        }
        setDragState(null);
      }
    };

    if (dragState?.isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', (e) => {
         const touch = e.touches[0];
         handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY } as any);
      }, { passive: false });
      window.addEventListener('touchend', (e) => {
         handleMouseUp({ clientX: dragState.currentX, clientY: dragState.currentY } as any);
      });
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragState, player.hand, player.energy, phase]);

  const handleCardMouseDown = (e: React.MouseEvent | React.TouchEvent, index: number) => {
    if (phase !== GamePhase.BATTLE_PLAYER_TURN) return;
    if (selection) return; // Disable dragging if selection overlay is open
    
    let clientX, clientY;
    if ('touches' in e) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
    } else {
        clientX = (e as React.MouseEvent).clientX;
        clientY = (e as React.MouseEvent).clientY;
    }

    setDragState({
      isDragging: true,
      cardIndex: index,
      startX: clientX,
      startY: clientY,
      currentX: clientX,
      currentY: clientY
    });
  };

  // --- Helper: Relic System & Stats ---

  // Universal Relic Trigger Processor
  const processRelicTrigger = (trigger: string, contextCard?: ICard) => {
     player.relics.forEach(relic => {
        if (!relic.effectType) return;
        
        // Standard format: TRIGGER_ACTION_AMOUNT (e.g. start_combat_strength_1)
        // Or simple format for backwards compatibility (e.g. strength_1) which assumes start_combat
        
        const parts = relic.effectType.split('_');
        let rTrigger = parts[0];
        let rAction = parts[1];
        let rAmount = parseInt(parts[2] || '1');
        
        // Handle triggers that have 2 words e.g. start_combat, end_combat, turn_start
        if (['start', 'end', 'turn', 'play', 'shop'].includes(parts[0])) {
             rTrigger = `${parts[0]}_${parts[1]}`; // start_combat
             
             // Handle "apply_poison" or "apply_weak" where action is 2 words or action is apply and next is type
             if (parts[2] === 'apply') {
                rAction = parts[3]; // poison/weak/etc
                rAmount = parseInt(parts[4] || '1');
             } else {
                rAction = parts[2];
                rAmount = parseInt(parts[3] || '1');
             }
        } else {
             // Legacy support: if no trigger specified, assume start_combat
             if (trigger === 'start_combat') {
                 rTrigger = 'start_combat';
                 if (parts[0] === 'apply') {
                     rAction = parts[1];
                     rAmount = parseInt(parts[2] || '1');
                 } else {
                     rAction = parts[0];
                     rAmount = parseInt(parts[1] || '1');
                 }
             }
        }

        // MATCH?
        if (trigger !== rTrigger) return;
        
        // Filter specific plays if needed (e.g. play_attack)
        if (trigger.startsWith('play_') && contextCard) {
            const requiredType = trigger.split('_')[1].toUpperCase(); // ATTACK, SKILL, POWER
            if (contextCard.type !== requiredType) return;
        }

        // EXECUTE ACTION
        switch(rAction) {
            case 'heal':
                setPlayer(p => ({ ...p, currentHp: Math.min(p.maxHp, p.currentHp + rAmount) }));
                addLog(`${relic.name} healed ${rAmount}.`);
                break;
            case 'block':
                setPlayer(p => ({ ...p, block: p.block + rAmount }));
                addLog(`${relic.name} gave ${rAmount} Block.`);
                break;
            case 'damage':
                setEnemy(e => ({ ...e, currentHp: Math.max(0, e.currentHp - rAmount) }));
                addLog(`${relic.name} dealt ${rAmount} damage.`);
                break;
            case 'energy':
                setPlayer(p => ({ ...p, energy: p.energy + rAmount }));
                addLog(`${relic.name} gave ${rAmount} Energy.`);
                break;
            case 'draw':
                drawCards(rAmount);
                addLog(`${relic.name} drew ${rAmount} cards.`);
                break;
            case 'strength':
            case 'dexterity':
            case 'reflect': // thorns
            case 'metallicize':
            case 'regen':
                const statusKey = rAction === 'reflect' ? 'reflect' : rAction; // normalized key
                setPlayer(p => ({ 
                    ...p, 
                    statuses: { ...p.statuses, [statusKey]: (p.statuses[statusKey] || 0) + rAmount } 
                }));
                addLog(`${relic.name}: +${rAmount} ${statusKey}.`);
                break;
             case 'poison':
             case 'weak':
             case 'vulnerable':
                const enemyDebuff = rAction;
                setEnemy(e => ({
                    ...e,
                    statuses: { ...e.statuses, [enemyDebuff]: (e.statuses[enemyDebuff] || 0) + rAmount }
                }));
                addLog(`${relic.name} applied ${rAmount} ${enemyDebuff}.`);
                break;
        }
     });
  };

  const getPlayerStats = () => {
    return {
      strength: player.statuses['strength'] || 0,
      dexterity: player.statuses['dexterity'] || 0
    };
  };

  const applyRelicPickupEffect = (relic: IRelic) => {
    // Effects that happen immediately on pickup (like Max HP)
    const parts = relic.effectType.split('_');
    // Check if simple format max_hp_X or trigger format pickup_max_hp_X (if we add pickup trigger later)
    // For now supporting "max_hp_X" directly or "start_combat_max_hp" won't work well, needs explicit check
    if (relic.effectType.includes('max_hp')) {
        const amount = parseInt(parts[parts.length-1] || '0');
        setPlayer(p => ({ 
            ...p, 
            maxHp: p.maxHp + amount,
            currentHp: p.currentHp + amount 
        }));
        addLog(`Max HP increased by ${amount}`);
    }
  };

  // --- Level/Map Logic ---

  const generateNextPaths = (currentLevel: number) => {
    const paths: MapNode[] = [];
    const numPaths = 3;
    const isBossLevel = (currentLevel + 1) % 10 === 0;

    if (isBossLevel) {
      paths.push({ id: 'boss', type: RoomType.BOSS, name: "The Guardian", icon: "👹", level: currentLevel + 1 });
      return paths;
    }

    for (let i = 0; i < numPaths; i++) {
      const rand = Math.random();
      let type = RoomType.MONSTER;
      let name = "Enemy";
      let icon = "👾";

      if (currentLevel > 1) {
        if (rand > 0.85) { type = RoomType.ELITE; name = "Elite"; icon = "👿"; }
        else if (rand > 0.65) { type = RoomType.SHOP; name = "Merchant"; icon = "💰"; }
        else if (rand > 0.50) { type = RoomType.REST; name = "Rest Site"; icon = "🔥"; }
      }

      paths.push({ id: `node-${Date.now()}-${i}`, type, name, icon, level: currentLevel + 1 });
    }
    return paths;
  };

  const selectPath = async (node: MapNode) => {
    setLevel(node.level);
    setCurrentRoom(node.type);
    setLogs([]);

    if (node.type === RoomType.SHOP) {
      setPhase(GamePhase.SHOP);
      setShopContent(null);
      const content = await generateShopContent(node.level);
      setShopContent(content);
      // processRelicTrigger('shop_enter'); // Future support
    } else if (node.type === RoomType.REST) {
      setPhase(GamePhase.REST);
    } else {
      startBattle(node);
    }
  };

  // --- Battle Logic ---

  const startBattle = (node: MapNode) => {
    // Scaling
    let enemyHp = 20 + (node.level * 8);
    let damage = 5 + Math.floor(node.level * 1.2);
    let enemyName = "Wanderer";
    let enemyEmoji = "👾";

    if (node.type === RoomType.ELITE) {
      enemyHp = Math.floor(enemyHp * 1.8);
      damage = Math.floor(damage * 1.5);
      enemyName = "Elite Sentry";
      enemyEmoji = "🛡️";
    } else if (node.type === RoomType.BOSS) {
      enemyHp = Math.floor(enemyHp * 3);
      damage = Math.floor(damage * 1.8);
      enemyName = "Level Boss";
      enemyEmoji = "👹";
    }

    setEnemy({
      maxHp: enemyHp,
      currentHp: enemyHp,
      block: 0,
      statuses: {},
      name: enemyName,
      intent: "Attack",
      nextMoveDamage: damage,
      isElite: node.type === RoomType.ELITE,
      isBoss: node.type === RoomType.BOSS,
      emoji: enemyEmoji
    });

    setPlayer(prev => {
      const deckShuffled = [...prev.deck].sort(() => Math.random() - 0.5);
      const innateCards = deckShuffled.filter(c => c.innate);
      const otherCards = deckShuffled.filter(c => !c.innate);
      const finalDraw = [...otherCards, ...innateCards]; 

      return {
        ...prev,
        block: 0,
        energy: prev.maxEnergy, 
        hand: [],
        discardPile: [],
        exhaustPile: [],
        drawPile: finalDraw,
        powers: [],
        statuses: {} // Clear statuses for fresh combat
      };
    });

    setPhase(GamePhase.BATTLE_PLAYER_TURN);
    
    // Background Generate Rewards
    (async () => {
      setPendingRewards(null);
      setPendingEliteRelic(null);
      
      const promises: Promise<any>[] = [generateRewardCards(node.level)];
      if (node.type === RoomType.ELITE || node.type === RoomType.BOSS) {
        promises.push(generateEliteRelic(node.level));
      }
  
      const [cards, relic] = await Promise.all(promises);
      setPendingRewards(cards);
      if (relic) setPendingEliteRelic(relic);
    })();

    // Triggers & Draw
    setTimeout(() => {
        processRelicTrigger('start_combat');
        drawCards(INITIAL_HAND_SIZE); // Relics that draw will add to this via trigger process
    }, 500);
  };

  const drawCards = (count: number) => {
    setPlayer(prev => {
      if (prev.hand.length >= MAX_HAND_SIZE) return prev;

      const cardsNeeded = Math.min(count, MAX_HAND_SIZE - prev.hand.length);
      if (cardsNeeded <= 0) return prev;

      let newHand = [...prev.hand];
      let newDraw = [...prev.drawPile];
      let newDiscard = [...prev.discardPile];

      for (let i = 0; i < cardsNeeded; i++) {
        if (newDraw.length === 0) {
          if (newDiscard.length === 0) break;
          newDraw = [...newDiscard].sort(() => Math.random() - 0.5);
          newDiscard = [];
        }
        if (newDraw.length > 0) {
          newHand.push(newDraw.pop()!);
        }
      }
      return { ...prev, hand: newHand, drawPile: newDraw, discardPile: newDiscard };
    });
  };

  const triggerPlayerPowers = () => {
    const effects = {
        energy: 0, block: 0, heal: 0, draw: 0,
        damage: 0, poison: 0, weak: 0, vulnerable: 0, freeze: 0, burn: 0
    };

    player.powers.forEach(pow => {
        const rawEffects = pow.effectType.split(',').map(s => s.trim());
        rawEffects.forEach(eff => {
            // Robust parsing for "recurring_X", "turn_start_X", "start_turn_X"
            // Matches action name (alpha) and optional amount (numeric)
            const match = eff.match(/(?:recurring|turn_start|start_turn)_([a-zA-Z]+)(?:_(\d+))?/);
            
            if (match) {
                const action = match[1].toLowerCase();
                const amount = match[2] ? parseInt(match[2]) : 1;

                // Safe assignment to effects object
                if (Object.prototype.hasOwnProperty.call(effects, action)) {
                    (effects as any)[action] += amount;
                }
                
                // Alias Handling
                if (action === 'regen') effects.heal += amount;
                if (action === 'metallicize') effects.block += amount;
                if (action === 'plates') effects.block += amount;
                if (action === 'apply' && eff.includes('freeze')) effects.freeze = 1; 
            } else if (eff === 'recurring_freeze' || eff === 'turn_start_freeze') {
                // Fallback for straight boolean flags if regex missed (unlikely but safe)
                effects.freeze = 1;
            }
        });
    });

    // 1. Apply to Player
    setPlayer(prev => {
      let { energy, currentHp, block, maxHp, statuses } = prev;
      
      if (effects.energy > 0) {
           energy += effects.energy;
           addLog(`Powers: +${effects.energy} Energy`);
      }
      if (effects.block > 0) {
          block += effects.block;
          addLog(`Powers: +${effects.block} Block`);
      }
      if (effects.heal > 0) {
          currentHp = Math.min(maxHp, currentHp + effects.heal);
          addLog(`Powers: Healed ${effects.heal}`);
      }
      if (effects.draw > 0) {
          // Draw handled outside setPlayer to avoid side effects in reducer
      }

      // Handle status counters decrement logic for things like Regen if they were just numbers,
      // but here we are just applying the EFFECT of the status. 
      // The actual status decrement happens in endTurn or startTurn separately.
      
      return { ...prev, energy, currentHp, block };
    });

    // 2. Draw Cards (outside setState)
    if (effects.draw > 0) {
        drawCards(effects.draw);
        addLog(`Powers: Drew ${effects.draw}`);
    }

    // 3. Apply to Enemy
    if (effects.damage > 0 || effects.poison > 0 || effects.weak > 0 || effects.vulnerable > 0 || effects.freeze > 0 || effects.burn > 0) {
        setEnemy(prev => {
            let { currentHp, statuses } = prev;
            const newStatuses = { ...statuses };

            if (effects.damage > 0) {
                currentHp = Math.max(0, currentHp - effects.damage);
                addLog(`Powers: Dealt ${effects.damage} dmg`);
            }
            
            if (effects.poison > 0) { newStatuses['poison'] = (newStatuses['poison'] || 0) + effects.poison; addLog(`Powers: +${effects.poison} Poison`); }
            if (effects.weak > 0) { newStatuses['weak'] = (newStatuses['weak'] || 0) + effects.weak; addLog(`Powers: +${effects.weak} Weak`); }
            if (effects.vulnerable > 0) { newStatuses['vulnerable'] = (newStatuses['vulnerable'] || 0) + effects.vulnerable; addLog(`Powers: +${effects.vulnerable} Vulnerable`); }
            if (effects.burn > 0) { newStatuses['burn'] = (newStatuses['burn'] || 0) + effects.burn; addLog(`Powers: +${effects.burn} Burn`); }
            if (effects.freeze > 0) { newStatuses['freeze'] = 1; addLog(`Powers: Frozen!`); }

            return { ...prev, currentHp, statuses: newStatuses };
        });
    }
  };

  const applyStatusEffect = (target: 'player' | 'enemy', effectString: string) => {
    const parts = effectString.split('_');
    const type = parts[0]; 
    const realType = type === 'recurring' ? parts[1] : type;
    const amount = parseInt(parts[parts.length-1] || '1');
    
    const setter = target === 'player' ? setPlayer : setEnemy;

    setter((prev: any) => {
      const newStatuses = { ...prev.statuses };
      
      if (realType === 'freeze' || realType === 'stun') {
        newStatuses['freeze'] = 1;
        addLog(`${target === 'player' ? 'Player' : enemy.name} Frozen!`);
      } else if (['poison', 'burn', 'strength', 'dexterity', 'vulnerable', 'weak', 'frail', 'reflect', 'metallicize', 'regen'].includes(realType)) {
        newStatuses[realType] = (newStatuses[realType] || 0) + amount;
      }
      return { ...prev, statuses: newStatuses };
    });
  };

  const playCard = (card: ICard, index: number) => {
    if (phase !== GamePhase.BATTLE_PLAYER_TURN) return;

    const stats = getPlayerStats();
    setPlayer(p => ({ ...p, energy: p.energy - card.cost }));

    let logMsg = `Played ${card.name}.`;
    
    // Triggers from Relics (e.g. Play Attack -> Gain Str)
    const triggerType = card.type === CardType.ATTACK ? 'play_attack' : card.type === CardType.SKILL ? 'play_skill' : 'play_power';
    processRelicTrigger(triggerType, card);

    if (card.type === CardType.POWER) {
       const newPower: IPower = {
           id: card.id,
           name: card.name,
           description: card.description,
           effectType: card.specialEffect || 'none',
           icon: card.emoji || "⚡"
       };
       setPlayer(p => ({ ...p, powers: [...p.powers, newPower] }));
       if (card.specialEffect?.includes('recurring') || card.specialEffect?.includes('turn_start')) {
           logMsg += " Power Active!";
       }
    } 

    // --- PROCESS CARD EFFECTS ---
    
    // 1. Damage
    let hits = card.multiHit || 1;
    if (card.type === CardType.ATTACK || (card.damage && card.damage > 0)) {
        for(let i=0; i<hits; i++) {
            let dmg = (card.damage || 0) + stats.strength;
            if (enemy.statuses['vulnerable'] > 0) dmg = Math.floor(dmg * 1.5);
            if (player.statuses['weak'] > 0) dmg = Math.floor(dmg * 0.75);

            setEnemy(e => {
                let remainingDmg = dmg;
                let newBlock = e.block;
                if (newBlock >= remainingDmg) {
                  newBlock -= remainingDmg;
                  remainingDmg = 0;
                } else {
                  remainingDmg -= newBlock;
                  newBlock = 0;
                }
                return { ...e, currentHp: Math.max(0, e.currentHp - remainingDmg), block: newBlock };
            });
        }
    }

    // 2. Block
    if (card.block && card.block > 0) {
        let blk = card.block + stats.dexterity;
        if ((player.statuses['frail'] || 0) > 0) blk = Math.floor(blk * 0.75);
        setPlayer(p => ({ ...p, block: p.block + blk }));
    }

    // 3. Special Effects Parsing
    if (card.specialEffect) {
        const effects = card.specialEffect.split(',').map(e => e.trim()); 
        effects.forEach(eff => {
            const parts = eff.split('_');
            const type = parts[0];

            if (type === 'fetch' || type === 'recover') {
                const source = parts[1] as any;
                const filter = parts[2] ? parts[2].toUpperCase() : undefined;
                
                let validSource: 'draw' | 'discard' | 'exhaust' | 'deck' = 'draw';
                if (source === 'discard') validSource = 'discard';
                if (source === 'exhaust') validSource = 'exhaust';
                if (source === 'deck') validSource = 'deck';

                setSelection({
                    isOpen: true,
                    source: validSource,
                    filter: (filter === 'ANY' || filter === 'ALL') ? undefined : filter,
                    title: `Choose card to hand`,
                    onSelect: (selectedCard) => {
                        setPlayer(p => {
                            const pileName = validSource === 'draw' ? 'drawPile' : 
                                           validSource === 'discard' ? 'discardPile' : 
                                           validSource === 'exhaust' ? 'exhaustPile' : 'deck';
                            
                            const targetPile = validSource === 'deck' ? p.drawPile : p[pileName];
                            const newPile = targetPile.filter(c => c.id !== selectedCard.id);
                            const finalPileUpdates = validSource === 'deck' ? { drawPile: newPile } : { [pileName]: newPile };

                            return {
                                ...p,
                                ...finalPileUpdates,
                                hand: [...p.hand, selectedCard]
                            };
                        });
                        setSelection(null);
                        addLog(`Retrieved ${selectedCard.name}`);
                    }
                });
            }
            else if (['vulnerable', 'weak', 'poison', 'burn', 'freeze', 'stun'].includes(type)) {
                applyStatusEffect('enemy', eff);
            }
            else if (['reflect', 'strength', 'dexterity', 'frail', 'metallicize', 'regen'].includes(type)) {
                applyStatusEffect('player', eff);
            }
            else if (type === 'draw') drawCards(parseInt(parts[1] || '1'));
            else if (type === 'energy') setPlayer(p => ({ ...p, energy: p.energy + parseInt(parts[1] || '1') }));
            else if (type === 'heal' && !eff.includes("lifesteal")) setPlayer(p => ({ ...p, currentHp: Math.min(p.maxHp, p.currentHp + parseInt(parts[1] || '1')) }));
            else if (type === 'self' && parts[1] === 'damage') {
                const amt = parseInt(parts[2] || '0');
                setPlayer(p => ({ ...p, currentHp: Math.max(1, p.currentHp - amt) }));
                addLog(`Sacrificed ${amt} HP`);
            }
            else if (eff.includes('lifesteal')) {
                 const healAmt = parseInt(parts[1] || '0');
                 setPlayer(p => ({...p, currentHp: Math.min(p.maxHp, p.currentHp + healAmt)}));
            }
        });
    }

    addLog(logMsg);

    setPlayer(prev => {
      const newHand = [...prev.hand];
      newHand.splice(index, 1);
      
      if (card.exhaust) {
          return { ...prev, hand: newHand, exhaustPile: [...prev.exhaustPile, card] };
      } else if (card.type === CardType.POWER) {
          return { ...prev, hand: newHand };
      } else {
          return { ...prev, hand: newHand, discardPile: [...prev.discardPile, card] };
      }
    });
  };

  // Check Win/Loss
  useEffect(() => {
    if (phase === GamePhase.BATTLE_PLAYER_TURN || phase === GamePhase.BATTLE_ENEMY_TURN) {
      if (enemy.currentHp <= 0) {
        processRelicTrigger('end_combat');
        const goldReward = 15 + Math.floor(Math.random() * 15) + (currentRoom === RoomType.ELITE ? 30 : 0) + (currentRoom === RoomType.BOSS ? 100 : 0);
        setPlayer(p => ({ ...p, gold: p.gold + goldReward }));
        setPhase(GamePhase.BATTLE_WIN);
      }
    }
  }, [enemy.currentHp, phase, currentRoom]);

  const endTurn = () => {
    setPhase(GamePhase.BATTLE_ENEMY_TURN);

    setPlayer(prev => {
        const retainedHand: ICard[] = [];
        const newExhaust = [...prev.exhaustPile];

        prev.hand.forEach(card => {
            if (card.ethereal) {
                newExhaust.push(card);
                addLog(`${card.name} faded away.`);
            } else {
                retainedHand.push(card);
            }
        });
        
        return {
            ...prev,
            hand: retainedHand,
            exhaustPile: newExhaust
        };
    });

    setEnemy(e => {
        const poison = e.statuses['poison'] || 0;
        const burn = e.statuses['burn'] || 0;
        let hp = e.currentHp;
        
        if (poison > 0) {
            hp -= poison;
            addLog(`Poison dealt ${poison} dmg.`);
        }
        if (burn > 0) {
            hp -= burn;
            addLog(`Burn dealt ${burn} dmg.`);
        }
        return { ...e, currentHp: Math.max(0, hp) };
    });

    if (enemy.currentHp <= 0) return; 
    
    setTimeout(() => {
      const isFrozen = (enemy.statuses['freeze'] || 0) > 0;

      if (isFrozen) {
          addLog(`${enemy.name} is Frozen! Turn skipped.`);
          setEnemy(e => ({ ...e, statuses: { ...e.statuses, freeze: 0 }}));
      } else {
          addLog(`${enemy.name} attacks!`);
          
          setPlayer(p => {
            let dmg = enemy.nextMoveDamage;
            if ((enemy.statuses['weak'] || 0) > 0) dmg = Math.floor(dmg * 0.75);
            if ((p.statuses['vulnerable'] || 0) > 0) dmg = Math.floor(dmg * 1.5);

            let newBlock = p.block;
            if (newBlock >= dmg) {
              newBlock -= dmg;
              dmg = 0;
            } else {
              dmg -= newBlock;
              newBlock = 0;
            }

            const reflectDmg = p.statuses['reflect'] || 0;
            if (reflectDmg > 0 && dmg >= 0) {
                setEnemy(e => ({...e, currentHp: Math.max(0, e.currentHp - reflectDmg)}));
                addLog(`Reflected ${reflectDmg} dmg!`);
            }

            const newHp = Math.max(0, p.currentHp - dmg);
            if (newHp <= 0) setTimeout(() => setPhase(GamePhase.BATTLE_LOSS), 500);
            return { ...p, currentHp: newHp, block: newBlock };
          });
      }

      setTimeout(() => {
        if (player.currentHp > 0) {
          
          setPlayer(p => {
              const s = { ...p.statuses };
              if (s['vulnerable']) s['vulnerable']--;
              if (s['weak']) s['weak']--;
              if (s['frail']) s['frail']--;
              return {
                ...p,
                energy: p.maxEnergy, // Reset energy to max
                block: 0,
                statuses: s
              };
          });

          setEnemy(e => {
              const s = { ...e.statuses };
              if (s['poison']) s['poison']--; 
              if (s['vulnerable']) s['vulnerable']--;
              if (s['weak']) s['weak']--;
              return { ...e, statuses: s };
          });

          triggerPlayerPowers();
          processRelicTrigger('turn_start');
          drawCards(CARDS_PER_TURN);
          
          const nextDmg = 5 + Math.floor(level * 1.5) + Math.floor(Math.random() * 4);
          setEnemy(e => ({ ...e, nextMoveDamage: nextDmg, block: 0 }));
          setPhase(GamePhase.BATTLE_PLAYER_TURN);
        }
      }, 1000);
    }, 1000);
  };

  // --- Actions (Shop/Rest) ---

  const buyCard = (card: ICard) => {
    if (player.gold >= (card.price || 999)) {
      setPlayer(p => ({
        ...p,
        gold: p.gold - (card.price || 0),
        deck: [...p.deck, card]
      }));
      setShopContent(prev => prev ? ({ ...prev, cards: prev.cards.filter(c => c.id !== card.id) }) : null);
      addLog(`Bought ${card.name}`);
    }
  };

  const buyRelic = (relic: IRelic) => {
    if (player.gold >= (relic.price || 999)) {
      setPlayer(p => ({
        ...p,
        gold: p.gold - (relic.price || 0),
        relics: [...p.relics, relic]
      }));
      applyRelicPickupEffect(relic);
      setShopContent(prev => prev ? ({ ...prev, relics: prev.relics.filter(r => r.id !== relic.id) }) : null);
      addLog(`Bought ${relic.name}`);
    }
  };

  const restAction = (action: 'heal' | 'remove') => {
    if (action === 'heal') {
      setPlayer(p => ({ ...p, currentHp: Math.min(p.maxHp, p.currentHp + Math.floor(p.maxHp * 0.3)) }));
    } else {
      setSelection({
          isOpen: true,
          source: 'deck',
          title: 'Choose card to Remove',
          onSelect: (c) => {
              setPlayer(p => ({...p, deck: p.deck.filter(card => card.id !== c.id)}));
              setSelection(null);
              generateNextPathsAndContinue();
          }
      });
      return; 
    }
    generateNextPathsAndContinue();
  };

  const generateNextPathsAndContinue = () => {
    const nodes = generateNextPaths(level);
    setNextNodes(nodes);
    setPhase(GamePhase.MAP_SELECTION);
  };
  
  const handleWish = async () => {
    if (!wishInput.trim() || isWishing) return;
    
    setIsWishing(true);
    const wishedCard = await generateWishCard(wishInput, level);
    setPendingRewards(prev => prev ? [...prev, wishedCard] : [wishedCard]);
    setIsWishing(false);
    setWishInput('');
  };

  // --- UI: Card Selector Overlay ---
  const renderSelectionOverlay = () => {
    if (!selection || !selection.isOpen) return null;

    const pile = selection.source === 'draw' ? player.drawPile : 
                 selection.source === 'discard' ? player.discardPile : 
                 selection.source === 'exhaust' ? player.exhaustPile : 
                 player.deck;

    const filteredPile = selection.filter ? pile.filter(c => c.type === selection.filter) : pile;

    return (
        <div className="fixed inset-0 bg-black/80 z-[100] flex flex-col items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-600 p-6 rounded-xl w-full max-w-4xl h-[80vh] flex flex-col relative">
                <button onClick={() => setSelection(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X /></button>
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-2"><Search /> {selection.title}</h2>
                
                {filteredPile.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center text-slate-500 italic">No cards found matching criteria.</div>
                ) : (
                    <div className="flex-1 overflow-y-auto grid grid-cols-3 md:grid-cols-5 gap-4 p-4">
                        {filteredPile.map(card => (
                            <div key={card.id} className="scale-75 origin-top-left">
                                <Card 
                                    card={card} 
                                    playable={false} 
                                    onClick={() => selection.onSelect(card)}
                                    className="cursor-pointer hover:scale-110 hover:border-yellow-400 transition-all"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
  };

  // --- Screens ---

  if (phase === GamePhase.MENU) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] animate-pulse pointer-events-none"></div>
        
        <div className="z-10 flex flex-col items-center relative px-4 text-center">
            <h1 className="text-5xl md:text-7xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 mb-4 drop-shadow-2xl animate-float">
            AI SPIRE
            </h1>
            <p className="text-slate-400 mb-8 text-lg md:text-xl">Infinite Roguelike Generated by Gemini</p>
            <button 
            onClick={() => {
                setPlayer({
                    maxHp: 60,
                    currentHp: 60,
                    block: 0,
                    statuses: {},
                    gold: STARTING_GOLD,
                    energy: INITIAL_ENERGY,
                    maxEnergy: INITIAL_ENERGY,
                    deck: getInitialDeck(),
                    hand: [],
                    discardPile: [],
                    drawPile: [],
                    exhaustPile: [],
                    relics: [],
                    powers: []
                });
                generateNextPathsAndContinue();
            }}
            className="px-10 py-5 bg-purple-700 hover:bg-purple-600 text-white rounded-xl font-bold text-xl md:text-2xl shadow-[0_0_20px_rgba(168,85,247,0.5)] hover:scale-105 transition-all flex items-center gap-3 cursor-pointer z-50 relative"
            >
            <Swords size={28} /> Start Ascension
            </button>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.MAP_SELECTION) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 p-4 md:p-8">
        {renderSelectionOverlay()} 
        <h2 className="text-3xl md:text-4xl font-bold text-slate-200 mb-8 md:mb-12 flex items-center gap-3">
          <MapIcon size={32} className="md:w-10 md:h-10" /> Choose Your Path
        </h2>
        <div className="flex gap-4 md:gap-8 items-center overflow-x-auto pb-4 w-full justify-center">
          {nextNodes.map((node, i) => (
            <div key={node.id} className="flex flex-col items-center flex-shrink-0">
              <button 
                onClick={() => selectPath(node)}
                className={`
                  w-32 h-48 md:w-48 md:h-64 rounded-2xl flex flex-col items-center justify-center gap-2 md:gap-4 border-4 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl
                  ${node.type === RoomType.BOSS ? 'bg-red-950 border-red-600 text-red-500' : 
                    node.type === RoomType.ELITE ? 'bg-slate-800 border-purple-500 text-purple-400' :
                    node.type === RoomType.SHOP ? 'bg-slate-800 border-yellow-500 text-yellow-400' :
                    node.type === RoomType.REST ? 'bg-slate-800 border-blue-500 text-blue-400' :
                    'bg-slate-800 border-slate-600 text-slate-300'}
                `}
              >
                <div className="text-4xl md:text-6xl filter drop-shadow-lg">{node.icon}</div>
                <div className="font-bold text-md md:text-xl uppercase tracking-wider text-center">{node.name}</div>
                <div className="text-[10px] md:text-xs opacity-70 bg-black/30 px-3 py-1 rounded-full">Level {node.level}</div>
              </button>
              <div className="h-8 w-1 bg-slate-700 mt-4" style={{display: i === 1 ? 'none' : 'block'}}></div>
            </div>
          ))}
        </div>
        <div className="mt-8 md:mt-12 flex flex-wrap justify-center gap-4">
            <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-600 flex items-center gap-2 text-slate-300 text-sm md:text-base">
                <Heart size={16} className="text-red-500"/> {player.currentHp} HP
            </div>
            <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-600 flex items-center gap-2 text-yellow-400 text-sm md:text-base">
                <Coins size={16}/> {player.gold} G
            </div>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.SHOP) {
    return (
      <div className="h-screen flex flex-col bg-slate-900 p-4 md:p-8">
        <div className="flex justify-between items-center mb-6 md:mb-8">
           <h2 className="text-2xl md:text-3xl font-bold text-yellow-400 flex items-center gap-3"><ShoppingBag /> Merchant</h2>
           <div className="bg-black/50 px-4 md:px-6 py-2 rounded-full border border-yellow-600 flex items-center gap-2 text-lg md:text-2xl font-bold text-yellow-400">
             <Coins className="w-5 h-5 md:w-6 md:h-6" /> {player.gold}
           </div>
        </div>

        {!shopContent ? (
           <div className="flex-1 flex items-center justify-center text-yellow-500">
             <Loader2 className="animate-spin w-16 h-16" />
           </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {/* Relics Section */}
            <div className="mb-8">
               <h3 className="text-slate-400 text-xs md:text-sm uppercase font-bold tracking-widest mb-4">Relics</h3>
               <div className="flex flex-wrap gap-4 md:gap-6">
                  {shopContent.relics.map(relic => (
                    <div key={relic.id} className="flex flex-col items-center gap-2">
                       <RelicIcon relic={relic} onClick={() => buyRelic(relic)} tooltipSide="right" />
                       <button 
                         onClick={() => buyRelic(relic)}
                         disabled={player.gold < (relic.price || 0)}
                         className="px-2 md:px-3 py-1 bg-slate-800 rounded text-[10px] md:text-xs text-yellow-400 border border-slate-700 hover:bg-slate-700 disabled:opacity-50"
                       >
                         {relic.price} G
                       </button>
                    </div>
                  ))}
               </div>
            </div>

            {/* Cards Section */}
            <div className="pb-24">
              <h3 className="text-slate-400 text-xs md:text-sm uppercase font-bold tracking-widest mb-4">Cards</h3>
              <div className="flex gap-4 md:gap-6 flex-wrap justify-center md:justify-start">
                {shopContent.cards.map(card => (
                  <Card 
                    key={card.id} 
                    card={card} 
                    showPrice 
                    onClick={() => buyCard(card)}
                    disabled={player.gold < (card.price || 0)}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={generateNextPathsAndContinue}
          className="absolute bottom-4 right-4 md:bottom-8 md:right-8 px-6 md:px-8 py-3 md:py-4 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg shadow-xl flex items-center gap-2 text-sm md:text-base z-50"
        >
          Leave Shop <ArrowRight size={18} />
        </button>
      </div>
    );
  }

  if (phase === GamePhase.REST) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900 p-4 md:p-8 text-center">
        {renderSelectionOverlay()}
        <Tent size={48} className="md:w-16 md:h-16 text-blue-400 mb-6 animate-bounce" />
        <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Rest Site</h2>
        <p className="text-slate-400 mb-8 md:mb-12 text-sm md:text-base">The fire is warm. You feel safe for a moment.</p>
        
        <div className="flex flex-col md:flex-row gap-4 md:gap-8">
           <button 
             onClick={() => restAction('heal')}
             className="w-full md:w-64 h-24 md:h-40 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-green-500 rounded-xl flex flex-row md:flex-col items-center justify-center gap-4 md:gap-2 group transition-all px-6"
           >
              <Heart size={32} className="md:w-10 md:h-10 text-red-500 group-hover:scale-110 transition-transform" />
              <div className="text-left md:text-center">
                 <div className="font-bold text-lg md:text-xl text-white">Rest</div>
                 <div className="text-xs md:text-sm text-slate-400">Heal 30% HP</div>
              </div>
           </button>
           <button 
             onClick={() => restAction('remove')}
             className="w-full md:w-64 h-24 md:h-40 bg-slate-800 hover:bg-slate-700 border-2 border-slate-600 hover:border-red-500 rounded-xl flex flex-row md:flex-col items-center justify-center gap-4 md:gap-2 group transition-all px-6"
           >
              <Skull size={32} className="md:w-10 md:h-10 text-slate-400 group-hover:text-red-500 group-hover:scale-110 transition-transform" />
              <div className="text-left md:text-center">
                <div className="font-bold text-lg md:text-xl text-white">Tock</div>
                <div className="text-xs md:text-sm text-slate-400">Remove a Card</div>
              </div>
           </button>
        </div>
      </div>
    );
  }

  if (phase === GamePhase.BATTLE_WIN) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-900/90 backdrop-blur-sm z-50">
        <h2 className="text-4xl font-bold text-yellow-400 mb-4 animate-bounce">Victory!</h2>
        <p className="text-slate-300 mb-8">Enemy defeated.</p>
        <button 
          onClick={() => setPhase(GamePhase.REWARD)}
          className="px-6 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-bold shadow-lg hover:scale-105 transition-all"
        >
          Open Rewards
        </button>
      </div>
    );
  }

  if (phase === GamePhase.BATTLE_LOSS) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-red-950 z-50">
        <Skull size={60} className="md:w-20 md:h-20 text-red-500 mb-4" />
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-4">DEFEATED</h2>
        <p className="text-red-300 mb-8 text-lg md:text-xl">You fell on floor {level}</p>
        <button 
          onClick={() => window.location.reload()}
          className="px-8 py-4 bg-slate-800 hover:bg-slate-700 rounded-lg font-bold shadow-lg flex items-center gap-2 text-white"
        >
          <RefreshCcw /> Try Again
        </button>
      </div>
    );
  }

  if (phase === GamePhase.REWARD) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 p-4 md:p-8 overflow-auto">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2 flex items-center gap-2"><Trophy className="text-yellow-400"/> Rewards</h2>
        
        <div className="bg-black/40 p-3 md:p-4 rounded-lg mb-6 md:mb-8 text-yellow-400 font-bold border border-yellow-600/30 text-sm md:text-base">
           Gold Obtained! Total: {player.gold} G
        </div>

        {/* Elite Reward Display */}
        {pendingEliteRelic && (
          <div className="mb-8 flex flex-col items-center animate-[fadeIn_1s]">
            <div className="text-purple-400 font-bold mb-2 text-xs md:text-sm uppercase tracking-wider">Elite Relic Found</div>
            <div className="p-4 bg-purple-900/30 rounded-xl border border-purple-500 flex items-center gap-4">
              <div className="text-3xl md:text-4xl">{pendingEliteRelic.emoji}</div>
              <div className="text-left">
                <div className="font-bold text-white text-sm md:text-base">{pendingEliteRelic.name}</div>
                <div className="text-xs md:text-sm text-purple-200">{pendingEliteRelic.description}</div>
              </div>
              <button 
                onClick={() => {
                  setPlayer(p => ({...p, relics: [...p.relics, pendingEliteRelic]}));
                  applyRelicPickupEffect(pendingEliteRelic);
                  setPendingEliteRelic(null);
                }}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 rounded text-white text-xs md:text-sm font-bold"
              >
                Collect
              </button>
            </div>
          </div>
        )}
        
        {/* Wish Input Section */}
        <div className="w-full max-w-2xl mb-8 flex flex-col items-center gap-2">
           <label className="text-slate-400 text-sm flex items-center gap-2"><Wand2 size={14} /> Manifest a Specific Desire</label>
           <div className="flex w-full gap-2">
               <input 
                  type="text" 
                  value={wishInput}
                  onChange={(e) => setWishInput(e.target.value)}
                  placeholder="E.g., 'A sword that heals me' or 'A massive fireball'"
                  className="flex-1 bg-slate-800 border border-slate-600 rounded px-4 py-2 text-white placeholder:text-slate-500 focus:border-purple-500 focus:outline-none"
                  disabled={isWishing}
                  onKeyDown={(e) => e.key === 'Enter' && handleWish()}
               />
               <button 
                  onClick={handleWish}
                  disabled={!wishInput.trim() || isWishing}
                  className="bg-purple-700 hover:bg-purple-600 disabled:opacity-50 text-white px-4 py-2 rounded font-bold flex items-center gap-2"
               >
                  {isWishing ? <Loader2 className="animate-spin" /> : <Sparkles size={16} />} Wish
               </button>
           </div>
        </div>

        <p className="text-slate-400 mb-4 md:mb-6 text-sm md:text-base">Choose a card to add to your deck:</p>

        {!pendingRewards ? (
          <div className="flex flex-col items-center text-purple-400">
            <Loader2 className="animate-spin w-10 h-10 md:w-12 md:h-12 mb-4" />
            <p>Consulting the Oracle...</p>
          </div>
        ) : (
          <div className="flex gap-4 md:gap-6 flex-wrap justify-center animate-fade-in pb-10">
            {pendingRewards.map((card) => (
              <Card 
                key={card.id} 
                card={card} 
                playable={true}
                onClick={() => {
                  setPlayer(p => ({ ...p, deck: [...p.deck, card] }));
                  generateNextPathsAndContinue();
                }}
              />
            ))}
            <button 
               onClick={generateNextPathsAndContinue} 
               className="w-28 h-40 md:w-40 md:h-60 rounded-xl border-2 border-dashed border-slate-600 flex flex-col items-center justify-center text-slate-500 hover:border-slate-400 hover:text-slate-300 hover:bg-slate-800 transition-all text-sm"
            >
               <span className="font-bold">Skip Card</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // --- BATTLE UI ---

  return (
    <div className="h-screen w-full flex flex-col bg-slate-900 overflow-hidden selection:bg-purple-500 selection:text-white">
      
      {renderSelectionOverlay()}

      {/* Top Bar */}
      <div className="h-auto min-h-[3.5rem] md:min-h-[4rem] bg-slate-950 border-b border-slate-800 flex flex-wrap md:flex-nowrap items-center justify-between px-4 py-2 shadow-lg z-20 gap-2">
        <div className="flex items-center gap-4 md:gap-6 flex-1">
          <div className="flex flex-col">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Level</span>
            <span className="text-base md:text-xl font-bold text-white">{level}</span>
          </div>
          
          <ProgressBar 
            current={player.currentHp} max={player.maxHp} 
            colorClass="bg-gradient-to-r from-red-600 to-red-500" icon={<Heart size={18} className="text-red-500" />} 
            label="Health"
          />
          
          {/* Gold Display */}
          <div className="flex items-center gap-1 md:gap-2 text-yellow-400 font-bold text-sm md:text-lg bg-slate-900 border border-slate-700 px-3 py-1 rounded-full shadow-inner ml-auto md:ml-0">
            <Coins size={14} className="md:w-4 md:h-4" /> {player.gold}
          </div>

          <div className="h-8 w-px bg-slate-700 mx-2 hidden md:block"></div>

          {/* Relics Bar */}
          <div className="flex items-center gap-1 md:gap-2 overflow-x-auto max-w-[150px] md:max-w-none scrollbar-hide">
             {player.relics.map((r, i) => (
               <RelicIcon key={i} relic={r} />
             ))}
             {player.relics.length === 0 && <span className="text-[10px] md:text-xs text-slate-600 italic hidden md:inline">No relics yet</span>}
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-wider w-full md:w-auto justify-end border-t border-slate-800 md:border-none pt-1 md:pt-0 mt-1 md:mt-0">
            <div>Deck: <span className="text-white">{player.deck.length}</span></div>
            <div>Discard: <span className="text-white">{player.discardPile.length}</span></div>
            <div>Draw: <span className="text-white">{player.drawPile.length}</span></div>
            <div>Exhaust: <span className="text-white">{player.exhaustPile.length}</span></div>
        </div>
      </div>

      {/* Battle Arena */}
      <div className="flex-1 flex items-center justify-center relative bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-800 via-slate-950 to-black overflow-hidden">
        
        {/* Player */}
        <div className="absolute left-8 md:left-20 bottom-40 md:bottom-64 flex flex-col items-center group scale-75 md:scale-100 origin-bottom-left transition-all">
           <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-indigo-600 to-blue-800 rounded-full shadow-[0_0_50px_rgba(79,70,229,0.3)] flex items-center justify-center text-4xl md:text-5xl animate-float border-4 border-indigo-400 relative z-10">
             🧙‍♂️
             {player.block > 0 && (
               <div className="absolute -top-2 -right-2 md:-top-4 md:-right-4 w-10 h-10 md:w-12 md:h-12 bg-blue-600 rounded-full border-2 border-blue-300 flex items-center justify-center text-white font-bold shadow-lg z-20 animate-pulse text-sm md:text-base">
                 <Shield size={14} className="mr-0.5"/> {player.block}
               </div>
             )}
           </div>
           
           {/* Player Status Effects */}
           <div className="flex gap-1 flex-wrap justify-center mt-2 max-w-[150px]">
              {Object.entries(player.statuses).map(([key, val]) => (
                  (val as number) > 0 && <StatusIcon key={key} type={key} value={val as number} />
              ))}
           </div>

           <div className="w-32 md:w-40 h-4 bg-black/50 rounded-full blur-sm mt-2"></div>
           
           {/* Active Powers Display */}
           <div className="mt-2 flex flex-wrap gap-1 max-w-[120px] md:max-w-[160px] justify-center">
              {player.powers.map((pow, i) => (
                  <div key={i} className="w-5 h-5 md:w-6 md:h-6 bg-purple-900 border border-purple-500 rounded-full flex items-center justify-center text-[10px] md:text-xs cursor-help group/power relative">
                      {pow.icon}
                      <div className="absolute bottom-full mb-2 bg-black text-white text-[10px] p-2 rounded w-32 pointer-events-none opacity-0 group-hover/power:opacity-100 z-50">
                          {pow.name}: {pow.description}
                      </div>
                  </div>
              ))}
           </div>
        </div>

        {/* Enemy */}
        <div className="absolute right-8 md:right-20 bottom-40 md:bottom-64 flex flex-col items-center group scale-75 md:scale-100 origin-bottom-right transition-all">
           <div className={`
             w-36 h-36 md:w-48 md:h-48 flex items-center justify-center text-6xl md:text-8xl animate-float delay-700 relative z-10 transition-transform duration-500
             ${enemy.isBoss ? 'scale-125 drop-shadow-[0_0_30px_rgba(220,38,38,0.6)]' : ''}
             ${enemy.isElite ? 'drop-shadow-[0_0_20px_rgba(147,51,234,0.5)]' : ''}
             ${enemy.statuses['freeze'] ? 'grayscale opacity-80 brightness-150 drop-shadow-[0_0_20px_rgba(34,211,238,0.8)]' : ''}
           `}>
             {enemy.emoji}
             
             {/* Intent Bubble */}
             <div className="absolute -top-10 md:-top-12 bg-slate-800 border border-slate-600 p-1.5 md:p-2 rounded-xl shadow-xl flex flex-col items-center min-w-[60px] md:min-w-[80px]">
                <div className="text-[10px] md:text-xs text-slate-400 uppercase font-bold mb-0.5">
                  {enemy.statuses['freeze'] ? 'FROZEN' : enemy.intent}
                </div>
                <div className="flex items-center gap-1 font-bold text-base md:text-xl text-white">
                   {!enemy.statuses['freeze'] && <><Swords size={16} className="text-red-500 md:w-5 md:h-5" /> {enemy.nextMoveDamage}</>}
                   {enemy.statuses['freeze'] && <Snowflake size={16} className="text-cyan-400" />}
                </div>
             </div>

             {enemy.block > 0 && (
               <div className="absolute top-2 -right-2 w-8 h-8 md:w-10 md:h-10 bg-blue-600 rounded-full border border-blue-400 flex items-center justify-center text-white font-bold shadow-lg text-sm md:text-base">
                 {enemy.block}
               </div>
             )}
           </div>
           
           <div className="mt-4 md:mt-6 w-36 md:w-48 space-y-1 md:space-y-2">
              <div className="flex justify-between text-xs md:text-sm font-bold text-slate-300 px-1">
                 <span>{enemy.name}</span>
                 <span className="text-red-400">{enemy.currentHp} HP</span>
              </div>
              <div className="h-1.5 md:h-2 bg-slate-800 rounded-full overflow-hidden">
                 <div className="h-full bg-red-600 transition-all duration-500" style={{width: `${(enemy.currentHp / enemy.maxHp) * 100}%`}}></div>
              </div>
              
              {/* Enemy Status Icons */}
              <div className="flex gap-1 flex-wrap justify-center">
                 {Object.entries(enemy.statuses).map(([key, val]) => (
                   (val as number) > 0 && <StatusIcon key={key} type={key} value={val as number} />
                 ))}
              </div>
           </div>
        </div>

        {/* Combat Log */}
        <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2 w-64 md:w-[500px] pointer-events-none flex flex-col items-center gap-1 z-30">
           {logs.map((log, i) => (
             <div key={i} className="text-center text-slate-200 text-xs md:text-sm font-medium bg-slate-900/80 border border-slate-700/50 rounded-full px-3 py-0.5 md:px-4 md:py-1 backdrop-blur animate-[fadeIn_0.3s_ease-out] shadow-sm whitespace-nowrap">
               {log}
             </div>
           ))}
        </div>

        {/* Energy Orb */}
        <div className="absolute bottom-24 left-2 md:bottom-4 md:left-4 z-30 flex items-center gap-2 scale-75 md:scale-100 origin-bottom-left">
           <div className="w-14 h-14 md:w-16 md:h-16 rounded-full bg-gradient-to-br from-yellow-400 to-orange-600 shadow-[0_0_20px_rgba(234,179,8,0.6)] flex items-center justify-center border-4 border-yellow-200 text-2xl md:text-3xl font-bold text-white relative">
              {player.energy}
              <span className="text-[10px] absolute top-9 md:top-10 font-normal opacity-80">/{player.maxEnergy}</span>
           </div>
           <div className="text-yellow-400 font-bold text-xs md:text-sm uppercase tracking-widest drop-shadow-md hidden md:block">Energy</div>
        </div>
        
        {/* Dragged Card Ghost */}
        {dragState && dragState.isDragging && (
          <div 
            className="fixed z-50 pointer-events-none"
            style={{
              left: dragState.currentX,
              top: dragState.currentY,
              transform: 'translate(-50%, -50%)'
            }}
          >
             <Card card={player.hand[dragState.cardIndex]} className="opacity-90 scale-110" />
          </div>
        )}

        {/* Hand Area */}
        <div className="absolute bottom-[-30px] md:bottom-0 left-0 right-0 h-48 md:h-80 flex items-end justify-center pb-6 md:pb-6 px-2 md:px-4 pointer-events-none">
          <div className="flex items-end justify-center w-full max-w-5xl perspective-1000 pointer-events-auto">
            {player.hand.map((card, idx) => {
               // Calculate rotation for fan effect
               const rotation = (idx - (player.hand.length - 1) / 2) * 4;
               const yOffset = Math.abs(idx - (player.hand.length - 1) / 2) * (window.innerWidth < 768 ? 4 : 8);
               const isBeingDragged = dragState?.cardIndex === idx;
               
               return (
                <div 
                  key={`${card.id}-${idx}`} 
                  className={`
                    transition-all duration-300 z-0 -mx-5 md:-mx-8 group 
                    ${isBeingDragged ? 'opacity-0' : 'opacity-100'}
                    hover:z-50
                  `}
                  style={{ 
                    transform: `rotate(${rotation}deg) translateY(${yOffset}px)`,
                    zIndex: idx + 10
                  }}
                >
                  <Card 
                    card={card} 
                    playable={player.energy >= card.cost && phase === GamePhase.BATTLE_PLAYER_TURN && !selection}
                    onMouseDown={(e) => handleCardMouseDown(e, idx)}
                    onTouchStart={(e) => handleCardMouseDown(e, idx)}
                    disabled={phase !== GamePhase.BATTLE_PLAYER_TURN || !!selection}
                    className={`
                       shadow-2xl transition-transform duration-200
                       translate-y-10 md:translate-y-0
                       group-hover:-translate-y-12 md:group-hover:-translate-y-24 
                       group-hover:scale-125 md:group-hover:scale-110
                       cursor-pointer
                    `}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* End Turn Button */}
        <button 
          onClick={endTurn}
          disabled={phase !== GamePhase.BATTLE_PLAYER_TURN || !!selection}
          className={`
            absolute bottom-24 right-2 md:bottom-40 md:right-8 px-4 py-2 md:px-8 md:py-4 rounded-xl font-bold text-white text-sm md:text-xl shadow-2xl border-b-4 transition-all duration-200 z-40
            ${phase === GamePhase.BATTLE_PLAYER_TURN && !selection
              ? 'bg-gradient-to-br from-blue-600 to-indigo-700 border-blue-900 hover:-translate-y-1 hover:shadow-blue-500/30 active:translate-y-1 active:border-b-0' 
              : 'bg-slate-800 border-slate-950 text-slate-500 cursor-not-allowed'}
          `}
        >
          {phase === GamePhase.BATTLE_PLAYER_TURN ? 'End Turn' : 'Enemy Turn...'}
        </button>
        
      </div>
    </div>
  );
}
