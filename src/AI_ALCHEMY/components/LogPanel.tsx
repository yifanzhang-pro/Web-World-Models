import React, { useEffect, useRef } from 'react';

interface LogPanelProps {
  logs: string[];
}

export const LogPanel: React.FC<LogPanelProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white w-72 border-l border-gray-700 p-4 shadow-xl z-10 hidden md:flex">
      <h2 className="text-sm font-semibold text-gray-400 mb-3 uppercase tracking-wider flex items-center gap-2">
        <span>📜</span> Alchemist Log
      </h2>
      <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs space-y-3 pr-1">
        {logs.length === 0 && (
            <div className="text-gray-600 text-center mt-10 italic">
                Experiment to discover new reactions...
            </div>
        )}
        {logs.map((log, i) => (
          <div key={i} className="border-b border-gray-800 pb-2 mb-2 last:border-0 animate-in fade-in slide-in-from-right-2 duration-300">
             <div className="text-gray-300 leading-relaxed break-words" dangerouslySetInnerHTML={{ __html: log }} />
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};