import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { PhysicsType, ElementDef, GrowthStyle } from '../types';
import { GRID_HEIGHT, GRID_WIDTH } from '../constants';
import { discoverReaction } from '../services/geminiService';

interface SandboxProps {
  elements: ElementDef[];
  onElementDiscovery: (newElement: Omit<ElementDef, 'id'>) => void;
  onReaction: (a: string, b: string, result: string, isNew: boolean) => void;
  selectedElementId: number;
  brushSize: number;
  triggerClear: number;
}

export interface SandboxRef {
    getStats: () => Record<string, number>;
    getImageData: () => string | null;
    agentDraw: (xPct: number, yPct: number, elementId: number, radius: number) => void;
}

export const Sandbox = forwardRef<SandboxRef, SandboxProps>(({
  elements,
  onElementDiscovery,
  onReaction,
  selectedElementId,
  brushSize,
  triggerClear,
}, ref) => {
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const clampProb = (value: unknown, max: number) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
    return clamp(value, 0, max);
  };

  // Safety limits (simulator-enforced; independent of Gemini prompts)
  const MAX_DECAY_CHANCE = 0.25; // caps per-tick decay probability
  const BASE_ENERGY_SPREAD_CHANCE = 0.02; // max diffusion probability per tick
  const MAX_NEW_ENERGY_PER_TICK = Math.floor(GRID_WIDTH * GRID_HEIGHT * 0.02); // caps new energy pixels per tick

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingMessage, setThinkingMessage] = useState<string>('');

  // Simulation State
  const gridRef = useRef<Int32Array>(new Int32Array(GRID_WIDTH * GRID_HEIGHT).fill(0));
  const nextGridRef = useRef<Int32Array>(new Int32Array(GRID_WIDTH * GRID_HEIGHT).fill(0));
  
  // Energy Grid (Overlay for Fire, Electricity, etc)
  const energyGridRef = useRef<Int32Array>(new Int32Array(GRID_WIDTH * GRID_HEIGHT).fill(0));
  const nextEnergyGridRef = useRef<Int32Array>(new Int32Array(GRID_WIDTH * GRID_HEIGHT).fill(0));

  // Density/Mass (0.0 to 1.0+) for Materials. 
  // For LIFE: Represents Hydration/Growth Potential. 1.0 = 1 pixel of growth.
  const densityRef = useRef<Float32Array>(new Float32Array(GRID_WIDTH * GRID_HEIGHT).fill(0));
  const nextDensityRef = useRef<Float32Array>(new Float32Array(GRID_WIDTH * GRID_HEIGHT).fill(0));

  // Reaction Cache
  const reactionsCache = useRef<Map<string, number>>(new Map());
  const pendingResolution = useRef<Map<string, string>>(new Map());
  
  // Reaction Queue Management
  const pendingReactions = useRef<Set<string>>(new Set());
  const inflightReactions = useRef<Set<string>>(new Set());
  const activeRequestCount = useRef(0);
  const isRateLimited = useRef(false);
  
  const MAX_CONCURRENT_REQUESTS = 4;
  const MAX_QUEUE_SIZE = 50;

  const isDrawing = useRef(false);
  const mousePos = useRef({ x: 0, y: 0 });

  const getIdx = (x: number, y: number) => {
    if (x < 0 || x >= GRID_WIDTH || y < 0 || y >= GRID_HEIGHT) return -1;
    return y * GRID_WIDTH + x;
  };

  // Expose methods for the Supervisor Agent
  useImperativeHandle(ref, () => ({
      getStats: () => {
          const counts: Record<string, number> = {};
          const grid = gridRef.current;
          const totalPixels = grid.length;
          
          elements.forEach(e => counts[e.name] = 0);

          let baseOccupied = 0;
          for (let i = 0; i < grid.length; i++) {
              if (grid[i] > 0) { // Ignore negative (consumed) values
                  const elem = elements.find(e => e.id === grid[i]);
                  if (elem) {
                      counts[elem.name] = (counts[elem.name] || 0) + 1;
                      baseOccupied++;
                  }
              }
          }
          
          // Correctly set Empty count based on screen area
          counts['Empty'] = totalPixels - baseOccupied;
          counts['Total'] = totalPixels; // Explicit total for AI context

          // Also check energy grid for fire/elec
          const enGrid = energyGridRef.current;
          for(let i=0; i<enGrid.length; i++) {
              if(enGrid[i] !== 0) {
                   const elem = elements.find(e => e.id === enGrid[i]);
                   if (elem) counts[elem.name] = (counts[elem.name] || 0) + 1;
              }
          }
          return counts;
      },
      getImageData: () => {
          if (!canvasRef.current) return null;
          // Return base64 string without data prefix for API
          return canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
      },
      agentDraw: (xPct: number, yPct: number, elementId: number, radius: number) => {
          const centerX = Math.floor((xPct / 100) * GRID_WIDTH);
          const centerY = Math.floor((yPct / 100) * GRID_HEIGHT);
          
          const selectedElem = elements.find(e => e.id === elementId);
          // Allow drawing "Empty" (elementId 0)
          const isEnergy = selectedElem?.physics === PhysicsType.ENERGY;
          const isErase = elementId === 0;

          for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                  if (dx*dx + dy*dy > radius*radius) continue;
                  const px = centerX + dx;
                  const py = centerY + dy;
                  const idx = getIdx(px, py);
                  
                  if (idx !== -1) {
                       if (isErase) {
                           gridRef.current[idx] = 0;
                           energyGridRef.current[idx] = 0;
                           densityRef.current[idx] = 0;
                       } else if (isEnergy) {
                           energyGridRef.current[idx] = elementId;
                       } else {
                           gridRef.current[idx] = elementId;
                           densityRef.current[idx] = 1.0;
                       }
                  }
              }
          }
      }
  }));

  // Initialize / Clear
  useEffect(() => {
    gridRef.current.fill(0);
    nextGridRef.current.fill(0);
    energyGridRef.current.fill(0);
    nextEnergyGridRef.current.fill(0);
    densityRef.current.fill(0);
    nextDensityRef.current.fill(0);
  }, [triggerClear]);

  // Resolve pending reaction IDs
  useEffect(() => {
    pendingResolution.current.forEach((name, key) => {
       const existing = elements.find(e => e.name.toLowerCase() === name.toLowerCase());
       if (existing) {
           reactionsCache.current.set(key, existing.id);
           pendingResolution.current.delete(key);
       }
    });

    const getId = (n: string) => elements.find(e => e.name === n)?.id;
    const w = getId('Water');
    const e = getId('Electricity');
    const h = getId('Hydrogen');
    const o = getId('Oxygen');
    const f = getId('Fire');
    
    const ignore = (id1?: number, id2?: number) => {
        if (id1 !== undefined && id2 !== undefined) {
            const key = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
            reactionsCache.current.set(key, 0); 
        }
    };

    // Standard exclusions
    ignore(w, e); 
    ignore(h, o); 
    ignore(h, f); 
    ignore(o, f); 
    ignore(h, e); 
    ignore(o, e); 

    // Prevent LIFE elements from reacting chemically with Water
    // We want physics absorption (Growth) to take precedence over mixing.
    if (w !== undefined) {
        elements.forEach(elem => {
            if (elem.physics === PhysicsType.LIFE) {
                ignore(w, elem.id);
            }
        });
    }
    
  }, [elements]);

  // Input Handlers
  const handleMouseDown = () => { isDrawing.current = true; };
  const handleMouseUp = () => { isDrawing.current = false; };
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = GRID_WIDTH / rect.width;
    const scaleY = GRID_HEIGHT / rect.height;
    mousePos.current = {
      x: Math.floor((e.clientX - rect.left) * scaleX),
      y: Math.floor((e.clientY - rect.top) * scaleY),
    };
  };

  const paint = useCallback(() => {
    if (!isDrawing.current) return;
    const { x, y } = mousePos.current;
    const r = Math.floor(brushSize / 2);
    const selectedElem = elements.find(e => e.id === selectedElementId);
    const isEnergy = selectedElem?.physics === PhysicsType.ENERGY;

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx*dx + dy*dy > r*r) continue; 
        const px = x + dx;
        const py = y + dy;
        const idx = getIdx(px, py);
        
        if (idx !== -1) {
            if (isEnergy) {
                energyGridRef.current[idx] = selectedElementId;
            } else {
                gridRef.current[idx] = selectedElementId;
                densityRef.current[idx] = 1.0; 
            }
        }
      }
    }
  }, [brushSize, selectedElementId, elements]);

  // Reaction Processing
  const processReactions = useCallback(async () => {
    // Check limits
    if (isRateLimited.current) return;
    if (activeRequestCount.current >= MAX_CONCURRENT_REQUESTS) return;
    if (pendingReactions.current.size === 0) {
        if (activeRequestCount.current === 0) setIsThinking(false);
        return;
    }

    // Get next batch of keys up to available slots
    const availableSlots = MAX_CONCURRENT_REQUESTS - activeRequestCount.current;
    const keysToProcess: string[] = [];
    const iterator = pendingReactions.current.values();
    
    for (let i = 0; i < availableSlots; i++) {
        const next = iterator.next();
        if (next.done) break;
        keysToProcess.push(next.value);
    }

    if (keysToProcess.length === 0) return;
    
    setIsThinking(true);

    keysToProcess.forEach(async (reactionKey) => {
        // Move from Pending -> Inflight
        pendingReactions.current.delete(reactionKey);
        
        // Double check cache just in case
        if (reactionsCache.current.has(reactionKey) || pendingResolution.current.has(reactionKey) || inflightReactions.current.has(reactionKey)) {
             return;
        }

        inflightReactions.current.add(reactionKey);
        activeRequestCount.current++;

        const [idA, idB] = reactionKey.split(':').map(Number);
        const elemA = elements.find(e => e.id === idA);
        const elemB = elements.find(e => e.id === idB);

        if (elemA && elemB) {
            setThinkingMessage(`Mixing: ${elemA.name} + ${elemB.name}...`);
            try {
                const result = await discoverReaction(elemA, elemB);
                
                if (result) {
                    const existing = elements.find(e => e.name.toLowerCase() === result.name.toLowerCase());
                    if (existing) {
                        reactionsCache.current.set(reactionKey, existing.id);
                        onReaction(elemA.name, elemB.name, existing.name, false);
                    } else {
                        onElementDiscovery(result);
                        pendingResolution.current.set(reactionKey, result.name);
                        onReaction(elemA.name, elemB.name, result.name, true);
                    }
                } else {
                    reactionsCache.current.set(reactionKey, 0); 
                }
            } catch (error: any) {
                if (error.message === 'RATE_LIMIT') {
                    console.warn("Quota exceeded. Backing off.");
                    isRateLimited.current = true;
                    setThinkingMessage('AI Resting (Quota)...');
                    setTimeout(() => {
                        isRateLimited.current = false;
                        setThinkingMessage('');
                    }, 10000);
                } else {
                    console.error("Reaction failed", error);
                    reactionsCache.current.set(reactionKey, 0); // Cache failure as no-reaction to prevent infinite retry loop
                }
            }
        }

        // Cleanup
        inflightReactions.current.delete(reactionKey);
        activeRequestCount.current--;
        
        // Trigger next immediately
        processReactions();
    });

  }, [elements, onElementDiscovery, onReaction]);

  useEffect(() => {
    const interval = setInterval(() => {
        processReactions();
    }, 200); // Check more frequently
    return () => clearInterval(interval);
  }, [processReactions]);


  // Physics Loop
  useEffect(() => {
    let animationId: number;
    
    const update = () => {
      // 1. Sanitize Grid (Cleanup consumed particles from previous frame)
      // -1 marks a consumed water particle. It must be reset to 0 (Empty) for this frame.
      for (let k = 0; k < gridRef.current.length; k++) {
          if (gridRef.current[k] < 0) gridRef.current[k] = 0;
      }

      paint();

      const grid = gridRef.current;
      const nextGrid = nextGridRef.current;
      const energyGrid = energyGridRef.current;
      const nextEnergyGrid = nextEnergyGridRef.current;
      const density = densityRef.current;
      const nextDensity = nextDensityRef.current;

      nextGrid.fill(0);
      nextDensity.fill(0);
      nextEnergyGrid.fill(0);

      let newEnergyThisTick = 0;
      const setEnergy = (idx: number, energyId: number) => {
        if (idx === -1) return false;
        if (nextEnergyGrid[idx] === energyId) return true;
        if (nextEnergyGrid[idx] === 0) {
          if (newEnergyThisTick >= MAX_NEW_ENERGY_PER_TICK) return false;
          newEnergyThisTick++;
        }
        nextEnergyGrid[idx] = energyId;
        return true;
      };

      const elemMap = new Map<number, ElementDef>();
      elements.forEach(e => elemMap.set(e.id, e));

      const getId = (name: string) => elements.find(e => e.name === name)?.id;
      const waterId = getId('Water');
      const elecId = getId('Electricity');
      const hydroId = getId('Hydrogen');
      const oxyId = getId('Oxygen');
      const fireId = getId('Fire');
      const heaterId = getId('Heater');
      const fanId = getId('Fan');
      const waterWheelId = getId('Water Wheel');
      const scrapId = getId('Scrap');

      // Iterate Bottom to Top 
      for (let y = GRID_HEIGHT - 1; y >= 0; y--) {
        const leftToRight = Math.random() > 0.5;
        const xStart = leftToRight ? 0 : GRID_WIDTH - 1;
        const xEnd = leftToRight ? GRID_WIDTH : -1;
        const xStep = leftToRight ? 1 : -1;

        for (let x = xStart; x !== xEnd; x += xStep) {
          const i = getIdx(x, y);
          
          // --- ENERGY PHYSICS (Decay & Spread) ---
          const enId = energyGrid[i];
          if (enId !== 0) {
              const enElem = elemMap.get(enId);
              if (enElem) {
                   const decayChance = clampProb(enElem.decayChance, MAX_DECAY_CHANCE);
                   // Decay
                   if (Math.random() > decayChance) {
                       nextEnergyGrid[i] = enId;
                       
                       // Simple Spread (Diffusion)
                       // Disable spread for Electricity to keep it as a static source
                       const isStatic = enId === elecId;

                       // Prevent runaway energy growth by tying spread probability to decay probability.
                       // (Low-decay energy spreads slowly; zero-decay becomes static.)
                       const spreadChance = Math.min(BASE_ENERGY_SPREAD_CHANCE, decayChance);
                       if (!isStatic && spreadChance > 0 && Math.random() < spreadChance) {
                            const dirs = [getIdx(x+1, y), getIdx(x-1, y), getIdx(x, y-1), getIdx(x, y+1)];
                            const validDirs = dirs.filter(d => d !== -1 && nextEnergyGrid[d] === 0);
                            if (validDirs.length > 0) {
                                const dest = validDirs[Math.floor(Math.random() * validDirs.length)];
                                setEnergy(dest, enId);
                            }
                       }
                   }
              }
          }

          // --- MATERIAL PHYSICS ---
          const cellId = grid[i];
          if (cellId <= 0) continue; // Skip empty or consumed (-1) cells
          if (nextGrid[i] !== 0) continue; // Already moved/consumed in next state

          const elem = elemMap.get(cellId);
          if (!elem) continue;

          let currentMass = density[i];
          if (currentMass <= 0.005) currentMass = 0; 
          // For LIFE, currentMass can be 0 (dry), so we continue even if 0.
          if (elem.physics !== PhysicsType.LIFE && currentMass === 0) continue;

          const neighbors = [
              getIdx(x, y-1),
              getIdx(x, y+1),
              getIdx(x-1, y),
              getIdx(x+1, y)
          ];
          
          // HARDCODED REACTIONS
          if (cellId === waterId && elecId !== undefined && hydroId !== undefined && oxyId !== undefined) {
              let hasElec = enId === elecId;
              if (!hasElec) {
                   for (const nIdx of neighbors) {
                      if (nIdx !== -1 && energyGrid[nIdx] === elecId) { hasElec = true; break; }
                  }
              }
              if (hasElec && Math.random() < 0.2) {
                  nextGrid[i] = Math.random() > 0.5 ? hydroId : oxyId;
                  nextDensity[i] = 1.0; 
                  continue; 
              }
          }

          if (cellId === hydroId) {
               let ignited = enId === fireId || enId === elecId;
               if (!ignited) {
                    for (const nIdx of neighbors) {
                        if (nIdx !== -1) {
                            const nEn = energyGrid[nIdx];
                            const nMat = grid[nIdx];
                            if (nEn === fireId || nEn === elecId || nMat === fireId || nMat === heaterId) { ignited = true; break; }
                        }
                    }
               }
               if (ignited && fireId) {
                   nextGrid[i] = 0; // Burn away
                   const smokeId = getId('Smoke');
                   if (smokeId) {
                       nextGrid[i] = smokeId;
                       nextDensity[i] = 1.0;
                   } 
                   setEnergy(i, fireId);
                   continue; 
               }
          }
          
          if (cellId === oxyId && waterId !== undefined && fireId !== undefined) {
              let touchedFire = enId === fireId;
              if (!touchedFire) {
                  for(const nIdx of neighbors) {
                      if (nIdx !== -1 && (energyGrid[nIdx] === fireId || grid[nIdx] === heaterId)) { touchedFire = true; break; }
                  }
              }
              if (touchedFire) {
                  if (Math.random() < 0.3) {
                      nextGrid[i] = waterId;
                      nextDensity[i] = 1.0;
                  } else {
                      nextGrid[i] = 0;
                  }
                  setEnergy(i, fireId);
                  continue;
              }
          }

          // Default Decay
          const materialDecayChance = clampProb(elem.decayChance, MAX_DECAY_CHANCE);
          if (elem.physics !== PhysicsType.BOT && elem.decayTo !== undefined && Math.random() < materialDecayChance) {
             nextGrid[i] = elem.decayTo;
             nextDensity[i] = currentMass * 0.9;
             continue;
          }
          
          // MOVEMENT PHYSICS
          let moved = false;

          // --- BOT LOGIC ---
          if (elem.physics === PhysicsType.BOT) {
              let battery = currentMass;

              // 1. Check Hazards (Water kills bots)
              let dead = false;
              for (const n of neighbors) {
                  if (n!==-1 && grid[n]!==0) {
                      const nEl = elemMap.get(grid[n]);
                      if (nEl?.physics === PhysicsType.LIQUID) {
                          dead = true;
                          break;
                      }
                  }
              }
              if (dead) {
                  if (elem.decayTo) nextGrid[i] = elem.decayTo;
                  else nextGrid[i] = 0;
                  nextDensity[i] = 1.0;
                  continue;
              }

              // 2. Recharge
              let charging = enId === elecId;
              if (!charging) {
                   for(const n of neighbors) {
                       if (n!==-1 && energyGrid[n] === elecId) { charging = true; break; }
                   }
              }
              if (charging) battery = 1.0;

              // 3. Drain Battery
              battery -= 0.002; // Drain rate
              if (battery <= 0) {
                  if (elem.decayTo) nextGrid[i] = elem.decayTo;
                  else nextGrid[i] = 0;
                  nextDensity[i] = 1.0;
                  continue;
              }
              
              // 4. Replication (Automata Rule)
              // If high battery and touching SCRAP or WALL, turn it into a bot
              if (battery > 0.8 && Math.random() < 0.05) {
                   const targets = neighbors.filter(n => {
                       if (n === -1) return false;
                       const nid = grid[n];
                       return nid !== 0 && (nid === scrapId || nid === 1); // Scrap or Wall
                   });
                   
                   if (targets.length > 0) {
                       const target = targets[Math.floor(Math.random() * targets.length)];
                       if (nextGrid[target] === 0) { // Only if not moved yet
                           nextGrid[target] = cellId;
                           nextDensity[target] = 0.5; // Start with half charge
                           battery -= 0.1; // Cost to replicate
                       }
                   }
              }

              // 5. Movement (Fall, then Crawl)
              const down = getIdx(x, y + 1);
              if (down !== -1 && grid[down] === 0 && nextGrid[down] === 0) {
                  nextGrid[down] = cellId;
                  nextDensity[down] = battery;
                  moved = true;
              } else {
                  // Crawl
                  const l = getIdx(x - 1, y);
                  const r = getIdx(x + 1, y);
                  const dirs = [];
                  if (l!==-1 && grid[l]===0 && nextGrid[l]===0) dirs.push(l);
                  if (r!==-1 && grid[r]===0 && nextGrid[r]===0) dirs.push(r);
                  
                  // Climb over small obstacles
                  if (dirs.length === 0) {
                      const ul = getIdx(x - 1, y - 1);
                      const ur = getIdx(x + 1, y - 1);
                      if (ul!==-1 && grid[ul]===0 && nextGrid[ul]===0) dirs.push(ul);
                      if (ur!==-1 && grid[ur]===0 && nextGrid[ur]===0) dirs.push(ur);
                  }

                  if (dirs.length > 0) {
                      const dest = dirs[Math.floor(Math.random() * dirs.length)];
                      nextGrid[dest] = cellId;
                      nextDensity[dest] = battery;
                      moved = true;
                  }
              }

              if (!moved) {
                  nextGrid[i] = cellId;
                  nextDensity[i] = battery;
              }
              continue; // Skip generic movement
          }

          if (elem.physics === PhysicsType.MECHANISM) {
              nextGrid[i] = cellId;
              nextDensity[i] = currentMass;
              
              if (cellId === waterWheelId) {
                  const top = getIdx(x, y-1);
                  if (top !== -1 && grid[top] !== 0) {
                      const topId = grid[top];
                      const topEl = elemMap.get(topId);
                      if (topEl?.physics === PhysicsType.LIQUID && nextGrid[top] === 0) {
                           const right = getIdx(x+1, y);
                           const left = getIdx(x-1, y);
                           const dests = [right, left].filter(d => d !== -1 && grid[d] === 0 && nextGrid[d] === 0);
                           if (dests.length > 0) {
                               const dest = dests[Math.floor(Math.random() * dests.length)];
                               nextGrid[dest] = topId;
                               nextDensity[dest] = density[top];
                           }
                      }
                  }
                  
                  let touchingWater = false;
                  for(const n of neighbors) {
                      if (n !== -1 && grid[n] !== 0) {
                          const nEl = elemMap.get(grid[n]);
                          if (nEl?.physics === PhysicsType.LIQUID) touchingWater = true;
                      }
                  }
                  if (touchingWater && Math.random() < 0.05 && elecId) {
                      const empty = neighbors.filter(n => n !== -1 && energyGrid[n] === 0 && nextEnergyGrid[n] === 0); 
                      if (empty.length > 0) {
                          const t = empty[Math.floor(Math.random() * empty.length)];
                          setEnergy(t, elecId);
                      }
                  }
              }
              
              if (cellId === fanId) {
                   const push = (nIdx: number) => {
                      if (nIdx !== -1 && grid[nIdx] !== 0) {
                          const gId = grid[nIdx];
                          const gEl = elemMap.get(gId);
                          if (gEl && (gEl.physics === PhysicsType.GAS)) {
                              const up2 = getIdx(x, y-2);
                              if (up2 !== -1 && grid[up2] === 0 && nextGrid[up2] === 0) {
                                   nextGrid[up2] = gId;
                                   nextDensity[up2] = density[nIdx];
                                   if (nextGrid[nIdx] === gId) nextGrid[nIdx] = 0;
                              }
                          }
                      }
                   };
                   push(getIdx(x, y+1));
              }
              
              if (cellId === heaterId) {
                   if (fireId && Math.random() < 0.2) {
                       const up = getIdx(x, y-1);
                       setEnergy(up, fireId);
                   }
                   neighbors.forEach(n => {
                      if (n !== -1 && grid[n] === waterId) {
                           if (nextGrid[n] === waterId) {
                               nextGrid[n] = 0; // Steam/Empty
                               if (Math.random() < 0.3 && fireId) setEnergy(n, fireId);
                           }
                      }
                   });
              }
              continue;
          }

          // --- LIFE PHYSICS (Connected Growth) ---
          if (elem.physics === PhysicsType.LIFE) {
             
             // Overcrowding Check (Spread style)
             if (elem.growthStyle === GrowthStyle.SPREAD) {
                  let sameNeighbors = 0;
                  const allNeighbors = [
                      getIdx(x-1,y-1), getIdx(x,y-1), getIdx(x+1,y-1),
                      getIdx(x-1,y),              getIdx(x+1,y),
                      getIdx(x-1,y+1), getIdx(x,y+1), getIdx(x+1,y+1)
                  ];
                  for(const n of allNeighbors) {
                      if (n!==-1 && grid[n] === cellId) sameNeighbors++;
                  }
                  if (sameNeighbors >= 7 && Math.random() < 0.05) {
                      nextGrid[i] = 0; // Die
                      continue;
                  }
             }

             // Support Check
             const down = getIdx(x, y + 1);
             const supportId = down !== -1 ? grid[down] : 0;
             const supportElem = supportId > 0 ? elemMap.get(supportId) : null;
             const hasSupport = supportId > 0 && (supportElem?.physics === PhysicsType.SOLID || supportElem?.physics === PhysicsType.POWDER || supportElem?.physics === PhysicsType.LIFE);

             if ((elem.growthStyle === GrowthStyle.VERTICAL || elem.growthStyle === GrowthStyle.SURFACE) && !hasSupport) {
                  if (Math.random() < 0.1) { 
                       nextGrid[i] = 0;
                       continue;
                  }
             }
             
             // Keep Alive
             nextGrid[i] = cellId;

             // --- HYDRODYNAMICS & GROWTH ---
             // `myMass` represents absorbed water/nutrients. 1.0 = 1 pixel growth potential.
             let myMass = currentMass; 

             // 1. ABSORPTION: Drink water from neighbors
             // Life can drink if touches Water.
             if (myMass < 1.0 && waterId !== undefined) {
                 const waterNeighbors = neighbors.filter(n => 
                     n !== -1 && grid[n] === waterId && nextGrid[n] <= 0
                 );
                 if (waterNeighbors.length > 0) {
                     const wIdx = waterNeighbors[Math.floor(Math.random() * waterNeighbors.length)];
                     // Double check it hasn't been consumed
                     if (nextGrid[wIdx] === 0) {
                         nextGrid[wIdx] = -1; // Consume
                         myMass += 1.0;
                     }
                 }
             }

             // 2. GROWTH: If we have enough mass/water, grow.
             let didGrow = false;
             if (myMass >= 1.0 && (elem.growthChance || 0) > 0) {
                 if (Math.random() < (elem.growthChance || 0)) {
                      let potentialGrowth: number[] = [];
                      
                      if (elem.growthStyle === GrowthStyle.SURFACE) {
                          const l = getIdx(x - 1, y);
                          const r = getIdx(x + 1, y);
                          const ld = getIdx(x - 1, y + 1);
                          const rd = getIdx(x + 1, y + 1);
                          const isGround = (idx: number) => {
                             if (idx === -1) return false;
                             const id = grid[idx];
                             if (id <= 0) return false;
                             const e = elemMap.get(id);
                             return e?.physics === PhysicsType.SOLID || e?.physics === PhysicsType.POWDER;
                          };
                          if (l !== -1 && grid[l] === 0 && nextGrid[l] === 0 && isGround(ld)) potentialGrowth.push(l);
                          if (r !== -1 && grid[r] === 0 && nextGrid[r] === 0 && isGround(rd)) potentialGrowth.push(r);
                      } else if (elem.growthStyle === GrowthStyle.VERTICAL) {
                          const up = getIdx(x, y - 1);
                          if (up !== -1 && grid[up] === 0 && nextGrid[up] === 0) potentialGrowth.push(up);
                          
                          if (Math.random() < 0.2) {
                             const ul = getIdx(x - 1, y - 1);
                             const ur = getIdx(x + 1, y - 1);
                             if (ul !== -1 && grid[ul] === 0 && nextGrid[ul] === 0) potentialGrowth.push(ul);
                             if (ur !== -1 && grid[ur] === 0 && nextGrid[ur] === 0) potentialGrowth.push(ur);
                          }

                          // Spawning Leaves (also requires mass)
                          if (elem.relatedElementId && Math.random() < 0.3) {
                              const dirs = [getIdx(x-1, y), getIdx(x+1, y), getIdx(x, y-1), getIdx(x-1, y-1), getIdx(x+1, y-1)];
                              const valid = dirs.filter(d => d !== -1 && grid[d] === 0 && nextGrid[d] === 0);
                              if (valid.length > 0) {
                                  const leafDest = valid[Math.floor(Math.random() * valid.length)];
                                  nextGrid[leafDest] = elem.relatedElementId;
                                  nextDensity[leafDest] = 0; // New leaves start dry
                                  myMass -= 1.0;
                                  didGrow = true;
                              }
                          }
                      } else if (elem.growthStyle === GrowthStyle.CLING) {
                          const down = getIdx(x, y + 1);
                          if (down !== -1 && grid[down] === 0 && nextGrid[down] === 0) potentialGrowth.push(down);
                          let touchingWall = false;
                          neighbors.forEach(n => {
                              if (n!==-1 && grid[n]>0 && elemMap.get(grid[n])?.physics === PhysicsType.SOLID) touchingWall = true;
                          });
                          if (touchingWall) {
                              const emptyNeighbors = neighbors.filter(n => n !== -1 && grid[n] === 0 && nextGrid[n] === 0);
                              potentialGrowth.push(...emptyNeighbors);
                          }
                      } else {
                          // SPREAD
                          const dirs = [getIdx(x, y-1), getIdx(x, y+1), getIdx(x-1, y), getIdx(x+1, y)];
                          potentialGrowth = dirs.filter(d => d !== -1 && grid[d] === 0 && nextGrid[d] === 0);
                      }

                      if (!didGrow && potentialGrowth.length > 0) {
                          const growDest = potentialGrowth[Math.floor(Math.random() * potentialGrowth.length)];
                          if (nextGrid[growDest] === 0) {
                              nextGrid[growDest] = cellId;
                              nextDensity[growDest] = 0; // Start dry
                              myMass -= 1.0;
                              didGrow = true;
                          }
                      }
                 }
             }

             // 3. TRANSPORT: Diffuse mass to "drier" neighbors of connected type
             // Allow bidirectional flow: Root <-> Leaf
             if (myMass > 0) {
                 const connected = neighbors.filter(n => {
                     if (n === -1) return false;
                     const nid = grid[n];
                     if (nid <= 0) return false;

                     // 1. Same element type (Tree to Tree)
                     if (nid === cellId) return true;
                     
                     // 2. Parent -> Child (Tree -> Leaf)
                     if (elem.relatedElementId && nid === elem.relatedElementId) return true;
                     
                     // 3. Child -> Parent (Leaf -> Tree)
                     // Check if neighbor defines ME as its child
                     const nElem = elemMap.get(nid);
                     if (nElem && nElem.relatedElementId === cellId) return true;

                     return false;
                 });

                 // Find neighbor with lowest density (gradient descent)
                 // We look at `density` (previous frame) for stability
                 connected.sort((a, b) => density[a] - density[b]);

                 let transferred = false;
                 if (connected.length > 0) {
                     const target = connected[0];
                     if (density[target] < myMass) {
                         const diff = myMass - density[target];
                         const transfer = diff * 0.5; // Equalize
                         if (transfer > 0.05) {
                             nextDensity[target] += transfer; // Give to neighbor
                             myMass -= transfer; // Take from self
                             transferred = true;
                         }
                     }
                 }
             }

             // Store remaining mass
             nextDensity[i] += myMass;

             continue;
          }

          // SOLID (Static)
          if (elem.physics === PhysicsType.SOLID) {
             nextGrid[i] = cellId;
             nextDensity[i] = currentMass;
          } 
          // POWDER
          else if (elem.physics === PhysicsType.POWDER) {
            const down = getIdx(x, y + 1);
            if (down !== -1 && grid[down] === 0 && nextGrid[down] === 0) {
                nextGrid[down] = cellId;
                nextDensity[down] = currentMass;
                moved = true;
            } else if (down !== -1) {
                 const targetId = nextGrid[down]; 
                 if (targetId !== 0) {
                     const targetElem = elemMap.get(targetId);
                     if (targetElem && (targetElem.physics === PhysicsType.LIQUID || targetElem.physics === PhysicsType.GAS)) {
                         nextGrid[down] = cellId;
                         nextDensity[down] = currentMass;
                         nextGrid[i] = targetId;
                         nextDensity[i] = nextDensityRef.current[down];
                         moved = true;
                     }
                 }
            }

            if (!moved) {
                const dl = getIdx(x - 1, y + 1);
                const dr = getIdx(x + 1, y + 1);
                const canL = dl !== -1 && grid[dl] === 0 && nextGrid[dl] === 0;
                const canR = dr !== -1 && grid[dr] === 0 && nextGrid[dr] === 0;
                if (canL && canR) {
                    const dest = Math.random() > 0.5 ? dl : dr;
                    nextGrid[dest] = cellId;
                    nextDensity[dest] = currentMass;
                    moved = true;
                } else if (canL) {
                    nextGrid[dl] = cellId;
                    nextDensity[dl] = currentMass;
                    moved = true;
                } else if (canR) {
                    nextGrid[dr] = cellId;
                    nextDensity[dr] = currentMass;
                    moved = true;
                }
            }
          } 
          // LIQUID
          else if (elem.physics === PhysicsType.LIQUID) {
             const down = getIdx(x, y + 1);
             if (down !== -1 && grid[down] === 0 && nextGrid[down] === 0) {
                nextGrid[down] = cellId;
                nextDensity[down] = currentMass;
                moved = true;
             } else if (down !== -1) {
                 const targetId = nextGrid[down];
                 if (targetId !== 0) {
                     const targetElem = elemMap.get(targetId);
                     if (targetElem && targetElem.physics === PhysicsType.GAS) {
                         nextGrid[down] = cellId;
                         nextDensity[down] = currentMass;
                         nextGrid[i] = targetId;
                         nextDensity[i] = nextDensityRef.current[down];
                         moved = true;
                     }
                 }
             }

             if (!moved) {
                const l = getIdx(x - 1, y);
                const r = getIdx(x + 1, y);
                const canL = l !== -1 && grid[l] === 0 && nextGrid[l] === 0;
                const canR = r !== -1 && grid[r] === 0 && nextGrid[r] === 0;
                if (canL && canR) {
                    const dest = Math.random() > 0.5 ? l : r;
                    nextGrid[dest] = cellId;
                    nextDensity[dest] = currentMass;
                    moved = true;
                } else if (canL) {
                    nextGrid[l] = cellId;
                    nextDensity[l] = currentMass;
                    moved = true;
                } else if (canR) {
                    nextGrid[r] = cellId;
                    nextDensity[r] = currentMass;
                    moved = true;
                }
             }
          }
          // GAS
          else if (elem.physics === PhysicsType.GAS) {
             if (Math.random() < 0.15) { 
                 const neighbors = [getIdx(x+1,y), getIdx(x-1,y), getIdx(x,y+1), getIdx(x,y-1)];
                 const valid = neighbors.filter(n => n!==-1);
                 const target = valid[Math.floor(Math.random() * valid.length)];
                 const targetId = nextGrid[target];
                 if (targetId !== 0 && targetId !== cellId) {
                     const tElem = elemMap.get(targetId);
                     if (tElem?.physics === PhysicsType.GAS) {
                         nextGrid[target] = cellId;
                         nextDensity[target] = currentMass;
                         nextGrid[i] = targetId;
                         nextDensity[i] = nextDensityRef.current[target];
                         moved = true;
                     }
                 }
             }

             if (!moved) {
                 const up = getIdx(x, y - 1);
                 if (up !== -1 && nextGrid[up] === 0) {
                     const upId = grid[up]; 
                     if (upId !== 0) {
                         const upElem = elemMap.get(upId);
                         if (upElem && (upElem.physics === PhysicsType.LIQUID || upElem.physics === PhysicsType.POWDER)) {
                             nextGrid[up] = cellId;
                             nextDensity[up] = currentMass;
                             nextGrid[i] = upId;
                             nextDensity[i] = density[up];
                             moved = true;
                         }
                     }
                 }
                 if (!moved) {
                     let target = -1;
                     if (up !== -1 && grid[up] === 0 && nextGrid[up] === 0) target = up;
                     else {
                         const dirs = [getIdx(x-1,y), getIdx(x+1,y), getIdx(x-1,y-1), getIdx(x+1,y-1)];
                         const valid = dirs.filter(d => d!==-1 && grid[d]===0 && nextGrid[d]===0);
                         if(valid.length>0) target = valid[Math.floor(Math.random()*valid.length)];
                     }
                     
                     if (currentMass > 0.1 && target !== -1) {
                         const half = currentMass / 2;
                         nextGrid[i] = cellId; nextDensity[i] = half;
                         nextGrid[target] = cellId; nextDensity[target] = half;
                         moved = true;
                     } else if (target !== -1) {
                         nextGrid[target] = cellId; nextDensity[target] = currentMass;
                         moved = true;
                     }
                 }
             }
          }

          if (!moved && nextGrid[i] === 0) {
              nextGrid[i] = cellId;
              nextDensity[i] = currentMass;
          }

          // --- AI REACTION DISCOVERY ---
          const queueReaction = (id1: number, id2: number) => {
               if (id1 === id2) return;
               const key = id1 < id2 ? `${id1}:${id2}` : `${id2}:${id1}`;
               
               if (reactionsCache.current.has(key)) {
                    const res = reactionsCache.current.get(key);
                    if (res && res > 0) { nextGrid[i] = res; nextDensity[i] = 1.0; }
               } 
               else if (
                   !pendingResolution.current.has(key) && 
                   !inflightReactions.current.has(key) &&
                   !isRateLimited.current && 
                   pendingReactions.current.size < MAX_QUEUE_SIZE
               ) {
                   pendingReactions.current.add(key);
               }
          };

          for (const nIdx of neighbors) {
              if (nIdx !== -1 && grid[nIdx] > 0) {
                  queueReaction(cellId, grid[nIdx]);
              }
          }
          if (enId !== 0) {
              queueReaction(cellId, enId);
          }
        }
      }

      gridRef.current.set(nextGrid);
      densityRef.current.set(nextDensity);
      energyGridRef.current.set(nextEnergyGrid);
      
      // Render
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const imgData = ctx.createImageData(GRID_WIDTH, GRID_HEIGHT);
            const data = imgData.data;
            const colorCache = new Map<number, [number, number, number]>();
            
            const gridData = gridRef.current;
            const energyData = energyGridRef.current;
            const densityData = densityRef.current;
            const time = Date.now() / 50; 

            for (let i = 0; i < gridData.length; i++) {
                const id = gridData[i];
                const enId = energyData[i];
                const idx = i * 4;

                let r = 17, g = 17, b = 17, a = 255; 

                if (id > 0) {
                    if (!colorCache.has(id)) {
                        const el = elemMap.get(id);
                        if (el) {
                            const hex = el.color.replace('#', '');
                            colorCache.set(id, [
                                parseInt(hex.substring(0, 2), 16),
                                parseInt(hex.substring(2, 4), 16),
                                parseInt(hex.substring(4, 6), 16)
                            ]);
                        } else colorCache.set(id, [255,0,255]);
                    }
                    const [cr, cg, cb] = colorCache.get(id)!;
                    const el = elemMap.get(id);
                    
                    if (el?.physics === PhysicsType.MECHANISM) {
                         const noise = Math.sin(time + i * 0.1) * 30;
                         r = cr + noise; g = cg + noise; b = cb + noise;
                    } else if (el?.physics === PhysicsType.GAS) {
                         const mass = densityData[i];
                         a = Math.min(255, Math.max(40, Math.floor(mass * 255)));
                         r=cr; g=cg; b=cb;
                    } else if (el?.physics === PhysicsType.LIFE) {
                        // Visualizing Hydration
                        const hydration = Math.min(1.0, densityData[i]); // 0 to 1
                        const noise = Math.sin(i * 132.1) * 10;
                        // Brighter if hydrated
                        r = Math.min(255, cr + noise + hydration * 40);
                        g = Math.min(255, cg + noise + hydration * 40);
                        b = Math.min(255, cb + noise + hydration * 40);
                    } else if (el?.physics === PhysicsType.BOT) {
                        const battery = densityData[i];
                        // Fade out as battery dies
                        r = cr * battery;
                        g = cg * battery;
                        b = cb * battery;
                    } else {
                         r=cr; g=cg; b=cb;
                    }
                }

                if (enId !== 0) {
                    if (!colorCache.has(enId)) {
                         const el = elemMap.get(enId);
                         if (el) {
                            const hex = el.color.replace('#', '');
                            colorCache.set(enId, [
                                parseInt(hex.substring(0, 2), 16),
                                parseInt(hex.substring(2, 4), 16),
                                parseInt(hex.substring(4, 6), 16)
                            ]);
                         } else colorCache.set(enId, [255, 255, 0]);
                    }
                    const [er, eg, eb] = colorCache.get(enId)!;
                    
                    r = Math.min(255, r + er * 0.8);
                    g = Math.min(255, g + eg * 0.8);
                    b = Math.min(255, b + eb * 0.8);
                    if (id === 0) a = 200; 
                }

                data[idx] = r; data[idx+1] = g; data[idx+2] = b; data[idx+3] = a;
            }
            ctx.putImageData(imgData, 0, 0);
        }
      }

      animationId = requestAnimationFrame(update);
    };

    animationId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animationId);
  }, [elements, paint]);

  return (
    <div className="relative bg-gray-800 border-4 border-gray-700 rounded-lg shadow-2xl overflow-hidden cursor-crosshair select-none">
      <canvas
        ref={canvasRef}
        width={GRID_WIDTH}
        height={GRID_HEIGHT}
        className="w-full h-full"
        style={{ width: '800px', height: '600px' }}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onMouseMove={handleMouseMove}
      />
      {isThinking && (
        <div className="absolute top-4 right-4 bg-black/80 text-purple-400 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 border border-purple-500/50 animate-pulse pointer-events-none">
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce"/>
            {thinkingMessage}
        </div>
      )}
      {!isThinking && isRateLimited.current && (
         <div className="absolute top-4 right-4 bg-black/80 text-yellow-400 px-3 py-1 rounded-full text-xs font-mono flex items-center gap-2 border border-yellow-500/50 pointer-events-none">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"/>
            {thinkingMessage}
        </div>
      )}
      <div className="absolute bottom-2 left-2 text-gray-500 text-[10px] font-mono pointer-events-none">
        Physics: {GRID_WIDTH}x{GRID_HEIGHT} | Elements: {elements.length}
      </div>
    </div>
  );
});
