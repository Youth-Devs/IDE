'use client';

import { Save } from 'lucide-react';

export default function ChangeCommitModal({ open, theme, project, value, onChange, onCancel, onConfirm }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[#050b08]/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="w-full max-w-md border p-6 rounded-2xl shadow-2xl transition-all bg-[#08140d] border-emerald-900/30">
        <div className="flex items-center gap-2 mb-3"><div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500"><Save size={16} /></div><h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{project?.githubRepo ? 'Push GitHub Commit' : 'Push Collaborative Change'}</h3></div>
        <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Please enter a brief name or description for this changeset. Teammates will see this description in real-time.</p>
        <form onSubmit={onConfirm} className="flex flex-col gap-4">
          <input type="text" placeholder="e.g., Fix responsive layout sizing" value={value} onChange={(event) => onChange(event.target.value)} required autoFocus className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-[#050b08] border-emerald-900/35 focus:border-emerald-500 text-slate-200' : 'bg-white border-emerald-200 focus:border-emerald-500 text-slate-900'}`} />
          <div className="flex gap-2 justify-end text-xs font-bold"><button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-lg border transition border-emerald-900/30 hover:bg-[#0b1810] text-slate-300">Cancel</button><button type="submit" disabled={!value.trim()} className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition shadow-md shadow-emerald-950/20">Confirm & Push</button></div>
        </form>
      </div>
    </div>
  );
}
