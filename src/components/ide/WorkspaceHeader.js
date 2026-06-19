'use client';

import { ArrowLeft, Github, Moon, Sun, UserPlus, Users, Zap } from 'lucide-react';
import { formatTime } from '../../lib/ide-utils';

export default function WorkspaceHeader({
  theme,
  user,
  activeProjectData,
  totalUsers,
  inviteStatus,
  teammateEmailInput,
  onBackToDashboard,
  onToggleTheme,
  onSignOut,
  onAddTeammateSubmit,
  onTeammateEmailChange,
  onToggleSupercharge,
  cooldownEndTime,
  secondsLeft,
  superchargeUses,
  isSupercharged,
  isCooldownActive,
}) {
  return (
    <header className="flex h-14 items-center justify-between px-4 border-b z-10 shrink-0 transition-colors border-emerald-900/25 bg-[#07120c]/70 backdrop-blur-md">
      <div className="flex items-center gap-3 max-w-[50%] overflow-hidden">
        <button onClick={onBackToDashboard} className={`p-1.5 rounded-lg transition-colors shrink-0 ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-855'}`} title="Return to Dashboard">
          <ArrowLeft size={14} />
        </button>
        <div className={`h-5 w-px shrink-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
        <span className="font-bold text-xs tracking-wider bg-gradient-to-r from-emerald-300 to-lime-200 bg-clip-text text-transparent uppercase font-mono truncate shrink-0 flex items-center gap-1.5">
          {activeProjectData?.githubRepo && <Github size={13} className="shrink-0 text-slate-400" />}
          {activeProjectData?.name}
        </span>

        <div className={`hidden md:flex items-center gap-1 text-[10px] text-slate-400 px-2 py-0.5 rounded font-mono border truncate shrink-0 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/50 border-slate-300'}`}>
          <span>Team: {activeProjectData?.memberEmails?.map((m) => m.split('@')[0]).join(', ')}</span>
        </div>

        {activeProjectData?.lastChange && (() => {
          const idx = activeProjectData.memberEmails?.findIndex((m) => m.toLowerCase().split('@')[0] === activeProjectData.lastChange.by?.toLowerCase());

          let containerClass = theme === 'dark' ? 'bg-slate-955 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600';
          let authorClass = 'font-bold';

          if (idx === 0) {
            containerClass = theme === 'dark' ? 'bg-emerald-955/25 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
            authorClass = 'font-black text-emerald-500 dark:text-emerald-400';
          } else if (idx === 1) {
            containerClass = theme === 'dark' ? 'bg-orange-955/25 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-700';
            authorClass = 'font-black text-orange-500 dark:text-orange-400';
          } else if (idx === 2) {
            containerClass = theme === 'dark' ? 'bg-blue-950/25 border-blue-500/30 text-blue-400' : 'bg-blue-50 border-blue-200 text-blue-700';
            authorClass = 'font-black text-blue-500 dark:text-blue-400';
          }

          return (
            <div className={`hidden lg:flex items-center gap-1.5 text-[10px] font-mono border px-2.5 py-0.5 rounded truncate transition-all ${containerClass}`}>
              <span className="font-semibold uppercase text-[8px] tracking-wider shrink-0">Latest Change:</span>
              <span className={`shrink-0 ${authorClass}`}>{activeProjectData.lastChange.by}</span>
              <span className="opacity-50 shrink-0">·</span>
              <span className="italic truncate">"{activeProjectData.lastChange.message}"</span>
            </div>
          );
        })()}
      </div>

      <div className="flex items-center gap-2">
        <form onSubmit={onAddTeammateSubmit} className="hidden xl:flex items-center gap-1 border rounded-lg p-1 text-xs bg-slate-955/30 border-slate-800/80">
          <input
            type="email"
            placeholder="Teammate's Email..."
            value={teammateEmailInput}
            onChange={(e) => onTeammateEmailChange(e.target.value)}
            className="bg-transparent px-2 py-0.5 text-[11px] outline-none border-none font-mono text-slate-300 w-36"
          />
          <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white p-1 rounded transition flex items-center justify-center" title="Invite Teammate">
            <UserPlus size={12} />
          </button>
        </form>

        {inviteStatus && (
          <span className="hidden xl:inline text-[9px] font-mono text-emerald-300 border border-emerald-500/20 px-1.5 py-0.5 rounded max-w-[200px] truncate" title={inviteStatus}>
            {inviteStatus}
          </span>
        )}

        <div className={`flex items-center gap-1 text-[10px] font-semibold border px-3 py-1 rounded-full shrink-0 ${theme === 'dark' ? 'bg-emerald-950/25 border-emerald-900/40 text-emerald-300' : 'bg-emerald-950/25 border-emerald-900/40 text-emerald-300'}`}>
          <Users size={11} />
          <span>IDE Users: <b className="font-mono">{totalUsers !== undefined && totalUsers !== null ? totalUsers : '...'}</b></span>
        </div>

        <button
          onClick={onToggleTheme}
          className={`p-2 rounded-lg border transition-all shrink-0 ${theme === 'dark' ? 'border-emerald-900/30 text-emerald-300 hover:bg-[#0b1810]' : 'border-emerald-900/30 text-emerald-300 hover:bg-[#0b1810]'}`}
          title="Toggle system theme"
        >
          {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
        </button>

        <div className={`flex items-center gap-3 border px-3 py-1 rounded-xl transition-colors shrink-0 ${theme === 'dark' ? 'bg-[#08140d] border-emerald-900/30' : 'bg-[#08140d] border-emerald-900/30'}`}>
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold uppercase tracking-tight">Supercharge</span>
            <span className="text-[9px] font-mono text-slate-500">
              {cooldownEndTime ? `Lock: ${formatTime(secondsLeft)}` : `Left: ${10 - superchargeUses}/10`}
            </span>
          </div>
          <button
            onClick={onToggleSupercharge}
            disabled={isCooldownActive}
            className={`p-1.5 rounded-lg border transition-all ${
              isCooldownActive
                ? 'bg-[#050b08] border-emerald-900/30 text-slate-700 cursor-not-allowed'
                : isSupercharged
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-[#050b08] border-emerald-900/30 text-slate-400'
            }`}
          >
            <Zap size={14} className={isSupercharged ? 'fill-emerald-300 text-emerald-300 animate-pulse' : ''} />
          </button>
        </div>

        <span className="text-xs text-slate-500 font-mono hidden sm:inline">{user.email || 'anonymous@youthdevs.me'}</span>
        <button onClick={onSignOut} className="text-slate-400 hover:text-red-500 transition flex items-center gap-1 text-xs">
          Exit
        </button>
      </div>
    </header>
  );
}
