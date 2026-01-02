import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Sandbox, SandboxRef } from './components/Sandbox';
import { ElementToolbar } from './components/ElementToolbar';
import { LogPanel } from './components/LogPanel';
import { INITIAL_ELEMENTS } from './constants';
import { ElementDef } from './types';
import { parseElementCommand, getSupervisorAction } from './services/geminiService';

function App() {
  const [elements, setElements] = useState<ElementDef[]>(INITIAL_ELEMENTS);
  const [selectedElementId, setSelectedElementId] = useState<number>(2); // Default to Sand
  const [brushSize, setBrushSize] = useState<number>(3);
  const [triggerClear, setTriggerClear] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  // Supervisor State
  const [isSupervisorActive, setIsSupervisorActive] = useState(false);
  const [supervisorInput, setSupervisorInput] = useState(''); // Text in input box
  const supervisorGuidanceRef = useRef(''); // Value sent to AI
  const sandboxRef = useRef<SandboxRef>(null);

  // Handler for when Gemini discovers a new element
  const handleElementDiscovery = useCallback((newElementData: Omit<ElementDef, 'id'>) => {
    setElements((prev) => {
      const exists = prev.find(e => e.name.toLowerCase() === newElementData.name.toLowerCase());
      if (exists) return prev;

      const newId = Math.max(...prev.map(e => e.id)) + 1;
      const newElement: ElementDef = {
        ...newElementData,
        id: newId,
      };
      
      return [...prev, newElement];
    });
  }, []);

  const handleReaction = useCallback((a: string, b: string, result: string, isNew: boolean) => {
      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const newBadge = isNew ? `<span class="text-yellow-400 font-bold text-[10px] border border-yellow-500 px-1 rounded ml-2">NEW</span>` : '';
      const logMessage = `
        <div class="opacity-50 text-[10px] mb-0.5">${timestamp}</div>
        <div class="flex items-center flex-wrap gap-1">
            <span class="font-bold text-purple-300">${a}</span>
            <span class="text-gray-500">+</span>
            <span class="font-bold text-purple-300">${b}</span>
            <span class="text-gray-500">→</span>
            <span class="font-bold text-green-400">${result}</span>
            ${newBadge}
        </div>
      `;
      setLogs(prev => [...prev, logMessage]);
  }, []);

  const handleClear = () => {
    setTriggerClear(prev => prev + 1);
    setLogs(prev => [...prev, `<span class="text-red-400 italic">World Reset.</span>`]);
  };

  const handleUserCommand = async (text: string) => {
      setLogs(prev => [...prev, `<div class="text-purple-400 italic text-[10px]">Processing: "${text}"...</div>`]);
      
      try {
          const result = await parseElementCommand(text, elements);
          
          if (result.operation === 'CREATE' && result.elementData) {
             handleElementDiscovery(result.elementData as any);
             setLogs(prev => [...prev, `<div class="text-green-400 font-bold">✨ Created: ${result.elementData?.name}</div>`]);
          } 
          else if (result.operation === 'UPDATE' && result.targetName && result.elementData) {
              setElements(prev => prev.map(e => {
                  if (e.name.toLowerCase() === result.targetName?.toLowerCase()) {
                      return { ...e, ...result.elementData };
                  }
                  return e;
              }));
              setLogs(prev => [...prev, `<div class="text-blue-400 font-bold">🔄 Updated: ${result.targetName}</div>`]);
          } else {
              setLogs(prev => [...prev, `<div class="text-gray-400">AI: ${result.message || "Could not understand."}</div>`]);
          }
      } catch (e) {
          setLogs(prev => [...prev, `<div class="text-red-400">Error processing command.</div>`]);
      }
  };

  // Supervisor Loop
  useEffect(() => {
    if (!isSupervisorActive) return;

    const runSupervisor = async () => {
        if (!sandboxRef.current) return;
        
        const stats = sandboxRef.current.getStats();
        const imageBase64 = sandboxRef.current.getImageData();
        const elementNames = elements.map(e => e.name);

        if (!imageBase64) return;

        // Use the Ref value here, so typing doesn't reset the interval
        const decision = await getSupervisorAction(stats, elementNames, imageBase64, supervisorGuidanceRef.current);

        if (decision.actionType === 'DRAW' && decision.drawCommand) {
             const elem = elements.find(e => e.name.toLowerCase() === decision.drawCommand!.elementName.toLowerCase());
             if (elem) {
                 sandboxRef.current.agentDraw(
                     decision.drawCommand.x, 
                     decision.drawCommand.y, 
                     elem.id, 
                     decision.drawCommand.radius
                 );
                 setLogs(prev => [...prev, `<div class="text-cyan-400 text-[10px] italic">🤖 Supervisor: ${decision.reason}</div>`]);
             }
        } else if (decision.actionType === 'NEW_ELEMENT' && decision.newElementCommand) {
             // Use existing command parser to create it roughly
             await handleUserCommand(`Create ${decision.newElementCommand.name}. ${decision.newElementCommand.description}`);
             setLogs(prev => [...prev, `<div class="text-cyan-400 text-[10px] italic">🤖 Supervisor: Invented something for balance.</div>`]);
        }
    };

    runSupervisor(); // Run immediately on activate
    const interval = setInterval(runSupervisor, 5000); // Run every 5 seconds
    return () => clearInterval(interval);
  }, [isSupervisorActive, elements]); // Removed supervisorInput from dependencies

  const commitGuidance = () => {
      if (!supervisorInput.trim()) return;
      supervisorGuidanceRef.current = supervisorInput;
      setLogs(prev => [...prev, `<div class="text-cyan-400 text-[10px] italic">📨 Guidance sent: "${supervisorInput}"</div>`]);
  };

  return (
    <div className="flex h-screen w-screen bg-gray-950 overflow-hidden font-sans">
      {/* Sidebar */}
      <ElementToolbar
        elements={elements}
        selectedElementId={selectedElementId}
        onSelectElement={setSelectedElementId}
        brushSize={brushSize}
        onBrushSizeChange={setBrushSize}
        onClear={handleClear}
        onUserCommand={handleUserCommand}
      />

      {/* Main View */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative">
        <div className="absolute inset-0 pointer-events-none opacity-5 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900 via-gray-900 to-black"></div>
        
        <div className="z-10 flex flex-col gap-4">
             {/* Header Area */}
             <div className="bg-gray-900/80 backdrop-blur text-white rounded-xl border border-gray-700 shadow-lg max-w-2xl w-full flex flex-col">
                <div className="px-6 py-3 flex justify-between items-center border-b border-gray-700/50">
                    <div>
                        <h2 className="text-lg font-bold text-purple-400 flex items-center gap-2">
                            <span className="text-2xl">⚗️</span> 
                            {elements.find(e => e.id === selectedElementId)?.name || 'Unknown'}
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            {elements.find(e => e.id === selectedElementId)?.description}
                        </p>
                    </div>
                    <button
                        onClick={() => setIsSupervisorActive(!isSupervisorActive)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${isSupervisorActive ? 'bg-cyan-900/50 border-cyan-500 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]' : 'bg-gray-800 border-gray-600 text-gray-500 hover:bg-gray-700'}`}
                    >
                        <div className={`w-2 h-2 rounded-full ${isSupervisorActive ? 'bg-cyan-400 animate-pulse' : 'bg-gray-500'}`} />
                        <span className="text-xs font-bold uppercase tracking-wider">
                            {isSupervisorActive ? 'AI Supervisor ON' : 'AI Supervisor OFF'}
                        </span>
                    </button>
                </div>
                {/* Supervisor Communication Channel */}
                {isSupervisorActive && (
                    <div className="px-6 py-2 bg-black/20 animate-in slide-in-from-top-2 flex gap-2">
                        <input 
                            type="text" 
                            value={supervisorInput}
                            onChange={(e) => setSupervisorInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    commitGuidance();
                                }
                            }}
                            placeholder="Message the Supervisor (e.g. 'Build a forest', 'Floods'). Press Enter to Send."
                            className="w-full bg-transparent border-none text-xs text-cyan-100 placeholder-cyan-800/50 focus:ring-0 focus:outline-none py-1"
                        />
                        <button 
                            onClick={commitGuidance}
                            className="text-cyan-500 hover:text-cyan-300 text-xs uppercase font-bold px-2 border-l border-gray-700"
                        >
                            Send
                        </button>
                    </div>
                )}
            </div>

            <Sandbox
              ref={sandboxRef}
              elements={elements}
              onElementDiscovery={handleElementDiscovery}
              onReaction={handleReaction}
              selectedElementId={selectedElementId}
              brushSize={brushSize}
              triggerClear={triggerClear}
            />
            
            <div className="text-gray-500 text-xs text-center max-w-lg">
                Tip: Use the text box in the header to tell the Supervisor what to do.
            </div>
        </div>
      </div>

      {/* Right Sidebar - Log */}
      <LogPanel logs={logs} />
    </div>
  );
}

export default App;