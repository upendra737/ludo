/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';

interface Props {
  logs: string[];
}

export const LogWindow: React.FC<Props> = ({ logs }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="bg-slate-900 rounded-xl p-4 h-48 md:h-64 flex flex-col border border-slate-800">
      <div className="text-[10px] uppercase font-black text-slate-500 mb-2 tracking-widest">Match Logs</div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar pr-2">
        {logs.map((log, i) => (
          <div key={i} className={`text-[11px] leading-relaxed ${i === logs.length - 1 ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>
            <span className="opacity-30 mr-2">[{i + 1}]</span>
            {log}
          </div>
        ))}
      </div>
    </div>
  );
};
