'use client';

import { Award, FileCode, X } from 'lucide-react';

export default function AdminSubmissionInspectorModal({ files, theme, activeFileName, activeFileContent, onSelectFile, onClose }) {
  if (!files) return null;

  return (
    <div className="fixed inset-0 bg-[#050b08]/90 backdrop-blur-md flex items-center justify-center p-6 z-50 animate-fade-in">
      <div className="w-full h-[90vh] max-w-5xl border rounded-2xl flex flex-col overflow-hidden bg-[#08140d] border-emerald-900/30 shadow-2xl">
        <header className="h-12 border-b border-emerald-900/30 px-4 flex items-center justify-between bg-[#050b08] shrink-0"><div className="flex items-center gap-2"><Award className="text-rose-400" size={16} /><span className="text-xs font-bold text-slate-200">Admin Live Grading Sandbox</span></div><button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={16} /></button></header>
        <div className="flex-1 flex min-h-0">
          <div className="w-64 border-r border-emerald-900/30 bg-[#050b08] p-3 overflow-y-auto shrink-0 flex flex-col gap-1"><span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Team Files</span>{files.map((file) => <button key={file.id || file.name} type="button" onClick={() => onSelectFile(file)} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs font-mono transition ${activeFileName === file.name ? 'bg-rose-500/10 text-rose-400 font-bold border border-rose-500/20' : theme === 'dark' ? 'text-slate-400 hover:bg-slate-900/60' : 'text-slate-600 hover:bg-emerald-50'}`}><FileCode size={13} /><span className="truncate">{file.name}</span></button>)}</div>
          <div className="flex-1 flex flex-col bg-[#050b08] min-w-0"><div className="h-9 px-4 border-b border-emerald-900/30 bg-[#08140d]/60 flex items-center justify-between shrink-0"><span className="text-[11px] font-mono text-slate-400">{activeFileName || 'Select a file to inspect'}</span></div><div className="flex-1 p-4 overflow-auto custom-scrollbar"><pre className="text-xs font-mono text-slate-300 leading-relaxed whitespace-pre-wrap select-text selection:bg-rose-500/30 selection:text-white">{activeFileContent || 'No content found inside this file segment.'}</pre></div></div>
        </div>
      </div>
    </div>
  );
}
