import React, { useState } from 'react';
import { ElementDef } from '../types';

interface ElementToolbarProps {
  elements: ElementDef[];
  selectedElementId: number;
  onSelectElement: (id: number) => void;
  brushSize: number;
  onBrushSizeChange: (size: number) => void;
  onClear: () => void;
  onUserCommand: (text: string) => Promise<void>;
}

export const ElementToolbar: React.FC<ElementToolbarProps> = ({
  elements,
  selectedElementId,
  onSelectElement,
  brushSize,
  onBrushSizeChange,
  onClear,
  onUserCommand,
}) => {
  const [command, setCommand] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleCommandSubmit = async () => {
    if (!command.trim()) return;
    setIsProcessing(true);
    try {
      await onUserCommand(command);
      setCommand('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-72 border-r border-gray-700 p-4 shadow-xl z-10">
      <h1 className="text-2xl font-bold mb-1 bg-gradient-to-r from-purple-400 to-pink-600 bg-clip-text text-transparent">
        AI Alchemy
      </h1>
      <p className="text-xs text-gray-500 mb-6">
        Sandbox + Generative AI
      </p>

      {/* Creator Console */}
      <div className="mb-6 bg-gray-800 p-3 rounded-lg border border-gray-700">
        <label className="block text-xs font-semibold text-purple-400 mb-2 uppercase">
          Creator Console
        </label>
        <textarea
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder='e.g. "Create Acid that melts stone" or "Make Fire blue"'
          className="w-full bg-gray-900 text-xs text-white p-2 rounded border border-gray-600 focus:border-purple-500 outline-none resize-none h-20 custom-scrollbar mb-2"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleCommandSubmit();
            }
          }}
        />
        <button
          onClick={handleCommandSubmit}
          disabled={isProcessing}
          className={`w-full py-1.5 text-xs font-medium rounded transition-colors ${
            isProcessing 
              ? 'bg-gray-700 text-gray-400 cursor-wait' 
              : 'bg-purple-600 hover:bg-purple-500 text-white'
          }`}
        >
          {isProcessing ? 'Thinking...' : 'Apply Rules'}
        </button>
      </div>

      {/* Brush Control */}
      <div className="mb-4">
        <label className="block text-xs font-medium text-gray-400 mb-1">
          Brush Size: {brushSize}px
        </label>
        <input
          type="range"
          min="1"
          max="10"
          value={brushSize}
          onChange={(e) => onBrushSizeChange(parseInt(e.target.value))}
          className="w-full h-1 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
        />
      </div>

      {/* Elements List */}
      <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
        <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider sticky top-0 bg-gray-900 py-1">Elements</h2>
        <div className="grid grid-cols-3 gap-2">
          {elements.map((elem) => (
            <button
              key={elem.id}
              onClick={() => onSelectElement(elem.id)}
              className={`
                relative aspect-square rounded-md border transition-all duration-200 flex flex-col items-center justify-center p-1
                ${selectedElementId === elem.id 
                  ? 'bg-gray-800 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.3)]' 
                  : 'bg-gray-800 border-gray-700 hover:bg-gray-750 hover:border-gray-600'}
              `}
              title={elem.description}
            >
              <div
                className="w-4 h-4 rounded-full mb-1 border border-white/10 shadow-sm"
                style={{ backgroundColor: elem.color }}
              />
              <span className="text-[10px] text-center truncate w-full leading-tight text-gray-300">{elem.name}</span>
              {selectedElementId === elem.id && (
                <div className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-purple-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-gray-700">
        <button
          onClick={onClear}
          className="w-full py-2 px-4 bg-red-500/10 text-red-400 border border-red-500/30 rounded hover:bg-red-500/20 transition-colors text-xs font-medium uppercase tracking-wide"
        >
          Reset World
        </button>
      </div>
    </div>
  );
};