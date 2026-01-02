
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Scene from './components/Scene';
import Sidebar from './components/Sidebar';
import { PlanetData, ViewContext } from './types';
import { getPlanetDetails } from './services/geminiService';
import { Orbit, Rocket, Gamepad2, ScanEye, ArrowUpCircle } from 'lucide-react';

const App: React.FC = () => {
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  const [isFlyMode, setIsFlyMode] = useState(false);
  const [isLanded, setIsLanded] = useState(false);
  const [viewContext, setViewContext] = useState<ViewContext>({ mode: 'orbit' });
  const [autoNarrative, setAutoNarrative] = useState<string | null>(null);
  const [autoNarrativeLoading, setAutoNarrativeLoading] = useState(false);
  const [narrativeSentences, setNarrativeSentences] = useState<string[]>([]);
  const [currentSentenceIdx, setCurrentSentenceIdx] = useState(0);
  const [typedSentence, setTypedSentence] = useState('');
  const lastNarrativeRef = useRef<number>(0);
  const typingTimerRef = useRef<number | undefined>(undefined);
  const sentenceAdvanceRef = useRef<number | undefined>(undefined);

  const handlePlanetSelect = (planet: PlanetData) => {
    setSelectedPlanet(planet);
  };

  const handleCloseSidebar = () => {
    setSelectedPlanet(null);
  };

  const toggleFlyMode = () => {
    setIsFlyMode(!isFlyMode);
    if (!isFlyMode) {
      setSelectedPlanet(null);
      setIsLanded(false);
    }
  };

  const handleLand = () => {
    setIsLanded(true);
  };

  const handleLaunch = () => {
    setIsLanded(false);
  };

  const handleViewContextChange = useCallback((ctx: ViewContext) => {
    setViewContext(ctx);
  }, []);

  // Determine narration target: prefer the selected planet, otherwise the current target from context, otherwise solar system
  const narrationTarget = useMemo(() => {
    return selectedPlanet?.name || viewContext.targetName || 'Solar System';
  }, [selectedPlanet?.name, viewContext.targetName]);

  const fetchAutoNarrative = useCallback(async () => {
    const now = Date.now();
    if (lastNarrativeRef.current && now - lastNarrativeRef.current < 30000) {
      return; // throttle to min 30s between generations
    }
    setAutoNarrativeLoading(true);
    try {
      const details = await getPlanetDetails({
        name: narrationTarget,
        mode: viewContext.mode,
        cameraDistance: viewContext.cameraDistance,
        sunAltitude: viewContext.sunAltitude,
        targetName: viewContext.targetName ?? narrationTarget,
      });
      setAutoNarrative(details);
      const sentences = details
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(Boolean);
      setNarrativeSentences(sentences.length ? sentences : [details]);
      setCurrentSentenceIdx(0);
      lastNarrativeRef.current = now;
    } catch (err) {
      // Fallback is handled in service; still ensure we don't stay loading
      setAutoNarrative(autoNarrative ?? null);
    } finally {
      setAutoNarrativeLoading(false);
    }
  }, [autoNarrative, narrationTarget, viewContext]);

  // Periodic ambient narration every 30s, and immediately on selection/context change
  useEffect(() => {
    fetchAutoNarrative();
    const id = setInterval(fetchAutoNarrative, 30000);
    return () => clearInterval(id);
  }, [fetchAutoNarrative]);

  // Typewriter effect for subtitle-style delivery
  useEffect(() => {
    if (!narrativeSentences.length) {
      setTypedSentence('');
      return;
    }
    const sentence = narrativeSentences[currentSentenceIdx] ?? '';
    setTypedSentence('');

    // Clear any previous timers
    if (typingTimerRef.current) clearInterval(typingTimerRef.current);
    if (sentenceAdvanceRef.current) clearTimeout(sentenceAdvanceRef.current);

    let idx = 0;
    const speedMs = 28; // galgame-like reveal speed
    typingTimerRef.current = window.setInterval(() => {
      idx += 1;
      setTypedSentence(sentence.slice(0, idx));
      if (idx >= sentence.length) {
        if (typingTimerRef.current) clearInterval(typingTimerRef.current);
        // Auto-advance to next sentence after a brief pause
        if (currentSentenceIdx < narrativeSentences.length - 1) {
          sentenceAdvanceRef.current = window.setTimeout(() => {
            setCurrentSentenceIdx((prev) => Math.min(prev + 1, narrativeSentences.length - 1));
          }, 1400);
        }
      }
    }, speedMs);

    return () => {
      if (typingTimerRef.current) clearInterval(typingTimerRef.current);
      if (sentenceAdvanceRef.current) clearTimeout(sentenceAdvanceRef.current);
    };
  }, [narrativeSentences, currentSentenceIdx]);

  return (
    <div className="relative w-full h-screen bg-black text-white overflow-hidden">
      {/* Main 3D Viewport */}
      <div className="absolute inset-0 z-0">
        <Scene 
          onPlanetSelect={handlePlanetSelect} 
          selectedPlanetName={selectedPlanet?.name ?? null}
          isFlyMode={isFlyMode}
          isLanded={isLanded}
          onViewContextChange={handleViewContextChange}
        />
      </div>

      {/* Ambient AI Narration (Subtitle style) */}
      <div className="pointer-events-none absolute bottom-10 left-1/2 -translate-x-1/2 z-20 w-[95%] sm:w-3/4 md:w-2/3 lg:w-1/2">
        <div className="relative mx-auto max-w-3xl">
          <div className="bg-black/70 backdrop-blur-md border border-white/15 rounded-2xl px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
            <div className="flex items-center justify-between mb-1 text-[10px] tracking-wide uppercase text-gray-400">
              <span>Cosmic Guide</span>
              <span className="text-gray-500">≥30s cadence</span>
            </div>
            <div className="text-base leading-relaxed text-gray-100 min-h-[36px] font-semibold tracking-wide">
              {autoNarrativeLoading && !typedSentence ? (
                <span className="text-gray-500">Receiving transmission...</span>
              ) : typedSentence ? (
                <span className="inline-block">{typedSentence}</span>
              ) : (
                <span className="text-gray-500">Awaiting initial transmission…</span>
              )}
              {/* Cursor effect */}
              <span className="inline-block w-2 h-4 ml-1 align-middle bg-gray-300 animate-pulse rounded-sm" />
            </div>
          </div>
        </div>
      </div>

      {/* Mode Toggle & Controls - Moved to Top Left */}
      <div className="absolute top-4 left-4 z-20 flex flex-col items-start gap-2">
        {!isLanded ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFlyMode();
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg transition-all duration-300 ${
              isFlyMode 
                ? "bg-red-600/80 hover:bg-red-500 text-white border border-red-400/50" 
                : "bg-blue-600/80 hover:bg-blue-500 text-white border border-blue-400/50"
            }`}
          >
            {isFlyMode ? <Gamepad2 size={20} /> : <ScanEye size={20} />}
            {isFlyMode ? "PILOT MODE" : "ORBIT MODE"}
          </button>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleLaunch();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold shadow-lg transition-all duration-300 bg-emerald-600/80 hover:bg-emerald-500 text-white border border-emerald-400/50"
          >
            <ArrowUpCircle size={20} />
            RETURN TO ORBIT
          </button>
        )}

        {/* Controls Helper */}
        <div className="bg-black/60 backdrop-blur-md p-3 rounded-lg border border-white/10 text-xs text-gray-300 max-w-[200px]">
          {isLanded ? (
            <div className="space-y-1">
               <p className="font-bold text-emerald-300 mb-1">Explorer Controls:</p>
               <p><span className="text-white font-mono">Click</span> - Lock Cursor</p>
               <p><span className="text-white font-mono">WASD</span> - Walk</p>
               <p><span className="text-white font-mono">Mouse</span> - Look</p>
               <p><span className="text-white font-mono">ESC</span> - Show Cursor</p>
            </div>
          ) : isFlyMode ? (
            <div className="space-y-1">
              <p className="font-bold text-red-300 mb-1">Spaceship Controls:</p>
              <p><span className="text-white font-mono">W/S</span> - Forward/Back</p>
              <p><span className="text-white font-mono">A/D</span> - Left/Right</p>
              <p><span className="text-white font-mono">R/F</span> - Up/Down</p>
              <p><span className="text-white font-mono">Drag</span> - Look around</p>
            </div>
          ) : (
            <div className="space-y-1">
              <p className="font-bold text-blue-300 mb-1">Commander Controls:</p>
              <p><span className="text-white font-mono">Click</span> - Select Planet</p>
              <p><span className="text-white font-mono">Drag</span> - Orbit Camera</p>
              <p><span className="text-white font-mono">Scroll</span> - Zoom</p>
            </div>
          )}
        </div>
      </div>

      {/* Logo Overlay - Moved to Bottom Middle */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none">
        <div className="flex items-center gap-2 bg-black/50 backdrop-blur-sm p-3 rounded-lg border border-white/10 pointer-events-auto shadow-lg">
          <Orbit className={`text-blue-400 ${!isLanded ? 'animate-spin-slow' : ''}`} size={24} />
          <div>
            <h1 className="font-bold text-lg tracking-wider">COSMIC VOYAGER</h1>
            <p className="text-xs text-gray-400">
              {isLanded ? `Exploring Surface: ${selectedPlanet?.name}` : 'Interactive Solar System Explorer'}
            </p>
          </div>
        </div>
      </div>

      {/* Instructions Overlay (Center Bottom, shifted up) - Only when idle */}
      {!selectedPlanet && !isFlyMode && !isLanded && (
        <div className="absolute bottom-24 left-1/2 transform -translate-x-1/2 z-10 pointer-events-none text-center">
          <div className="bg-black/60 backdrop-blur-md px-6 py-2 rounded-full border border-white/20 text-sm text-gray-300 animate-pulse flex items-center gap-2">
            <Rocket size={14} />
            Click on a planet to travel there
          </div>
        </div>
      )}

      {/* Detail Sidebar - Hide when landed to immerse user */}
      {!isLanded && (
        <Sidebar 
          planet={selectedPlanet} 
          onClose={handleCloseSidebar}
          onLand={handleLand}
          viewContext={viewContext}
        />
      )}
    </div>
  );
};

export default App;
