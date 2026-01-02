
import React, { useState, useEffect, useRef } from 'react';
import { PlanetData, ViewContext } from '../types';
import { X, Rocket, Info, Loader2, Footprints, Flag, Pickaxe, Moon } from 'lucide-react';
import { getPlanetDetails } from '../services/geminiService';

interface SidebarProps {
  planet: PlanetData | null;
  onClose: () => void;
  onLand: () => void;
  viewContext?: ViewContext;
}

const Sidebar: React.FC<SidebarProps> = ({ planet, onClose, onLand, viewContext }) => {
  const [aiContent, setAiContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const lastPlanetRef = useRef<string | null>(null);
  const lastModeRef = useRef<ViewContext['mode'] | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const lastFetchTimeRef = useRef<number>(0);

  useEffect(() => {
    if (planet) {
      setAiContent(null);
      // Only fetch AI content for major planets/suns, asteroids have static fun descriptions
      // Moons are also static for now to keep it simple, or we can enable AI for them
      if (planet.type === 'planet' || planet.type === 'star') {
        const now = Date.now();
        const planetChanged = lastPlanetRef.current !== planet.name;
        const modeChanged = lastModeRef.current !== viewContext?.mode;
        const targetChanged = lastTargetRef.current !== viewContext?.targetName;
        const timedOut = now - lastFetchTimeRef.current > 30000; // minimum 30s between fetches

        if (planetChanged || modeChanged || targetChanged || timedOut) {
          lastPlanetRef.current = planet.name;
          lastModeRef.current = viewContext?.mode ?? null;
          lastTargetRef.current = viewContext?.targetName ?? null;
          lastFetchTimeRef.current = now;
          fetchAiDetails(planet.name);
        }
      }
    }
  }, [planet, viewContext?.mode, viewContext?.targetName]);

  const fetchAiDetails = async (name: string) => {
    setLoading(true);
    const details = await getPlanetDetails({
      name,
      mode: viewContext?.mode,
      cameraDistance: viewContext?.cameraDistance,
      sunAltitude: viewContext?.sunAltitude,
      targetName: viewContext?.targetName,
    });
    setAiContent(details);
    setLoading(false);
  };

  if (!planet) return null;

  const isAsteroid = planet.type === 'asteroid';
  const isStar = planet.type === 'star';
  const isMoon = planet.type === 'moon';
  const canLand = !isAsteroid && !isStar && !isMoon;

  return (
    <div className="fixed top-0 right-0 h-full w-full sm:w-96 bg-black/90 border-l border-white/10 text-white p-6 shadow-2xl transform transition-transform duration-300 ease-in-out overflow-y-auto z-10 backdrop-blur-md">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500">
          {planet.name}
        </h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
      </div>

      {/* Action Buttons */}
      {canLand && (
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onLand();
          }}
          className="w-full mb-6 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center gap-2 shadow-lg transition-all transform hover:scale-[1.02]"
        >
          <Footprints size={20} />
          LAND ON SURFACE
        </button>
      )}

      {/* Asteroid Owner Badge */}
      {isAsteroid && planet.owner && (
        <div className="mb-6 bg-yellow-900/30 border border-yellow-600/50 p-4 rounded-lg flex items-center gap-4">
           <div className="bg-yellow-600/20 p-3 rounded-full">
             <Flag className="text-yellow-500" size={24} />
           </div>
           <div>
             <div className="text-xs text-yellow-500/80 uppercase tracking-widest font-bold">Claimed Owner</div>
             <div className="text-xl font-mono text-white">{planet.owner}</div>
           </div>
        </div>
      )}

      {/* Basic Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">
            {isMoon ? "Dist to Parent" : "Distance (AU)"}
          </div>
          <div className="text-xl font-mono">{planet.distance}</div>
        </div>
        <div className="bg-white/5 p-4 rounded-lg border border-white/10">
          <div className="text-gray-400 text-xs uppercase tracking-wider mb-1">Radius (Rel)</div>
          <div className="text-xl font-mono">{planet.radius}</div>
        </div>
      </div>

      {/* Static Description */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
          {isAsteroid ? <Pickaxe size={18} className="text-yellow-400"/> : 
           isMoon ? <Moon size={18} className="text-gray-400"/> : 
           <Rocket size={18} className="text-blue-400" />}
          
          {isAsteroid ? "Mining Data" : isMoon ? "Satellite Data" : "Quick Summary"}
        </h3>
        <p className="text-gray-300 leading-relaxed">
          {planet.description}
        </p>
      </div>

      {/* AI Gemini Content */}
      {!isAsteroid && !isMoon && (
        <div className="bg-gradient-to-b from-blue-900/20 to-purple-900/20 p-5 rounded-xl border border-blue-500/30">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2 text-blue-300">
            <Info size={18} />
            Cosmic Guide (AI)
          </h3>
          
          {loading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="animate-spin text-blue-400 mb-2" size={32} />
              <span className="text-sm text-gray-400">Receiving transmission...</span>
            </div>
          ) : (
            <div className="text-gray-200 leading-relaxed text-sm space-y-4">
              {aiContent ? (
                aiContent.split('\n').map((para, i) => para.trim() && <p key={i}>{para}</p>)
              ) : (
                <p>No data available.</p>
              )}
            </div>
          )}
          
          <div className="mt-4 pt-4 border-t border-white/10 flex justify-end">
            <span className="text-xs text-gray-500">Powered by Google Gemini</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Sidebar;
