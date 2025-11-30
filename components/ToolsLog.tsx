import React from 'react';
import { ToolCallLog } from '../types';
import { Terminal, CheckCircle2, Loader2 } from 'lucide-react';

interface ToolsLogProps {
  logs: ToolCallLog[];
}

const ToolsLog: React.FC<ToolsLogProps> = ({ logs }) => {
  if (logs.length === 0) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 md:right-auto md:w-96 bg-gray-900/90 backdrop-blur-md border border-gray-700 rounded-lg p-4 max-h-60 overflow-y-auto shadow-2xl z-20">
      <div className="flex items-center gap-2 mb-3 text-gray-400 border-b border-gray-800 pb-2">
        <Terminal size={16} />
        <span className="text-xs font-mono uppercase tracking-wider">System Logs</span>
      </div>
      <div className="space-y-3">
        {logs.map((log) => (
          <div key={log.id} className="text-sm font-mono">
            <div className="flex items-center justify-between text-blue-400 mb-1">
              <span className="font-bold">ƒ {log.name}</span>
              {log.result ? <CheckCircle2 size={14} className="text-green-500" /> : <Loader2 size={14} className="animate-spin text-yellow-500" />}
            </div>
            <div className="text-gray-500 text-xs truncate">
              Args: {JSON.stringify(log.args)}
            </div>
            {log.result && (
               <div className="text-gray-400 text-xs mt-1 pl-2 border-l-2 border-green-900">
                Result: {typeof log.result === 'string' ? log.result : JSON.stringify(log.result).slice(0, 100) + '...'}
               </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ToolsLog;
