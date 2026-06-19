'use client';

import { Github, LogIn, Moon, Sun } from 'lucide-react';

export default function AuthScreen({
  theme,
  isSignUp,
  email,
  password,
  authError,
  onToggleTheme,
  onAuthSubmit,
  onGithubSignIn,
  onGoogleSignIn,
  onToggleAuthMode,
  onEmailChange,
  onPasswordChange,
}) {
  return (
    <div className={`h-screen w-screen flex items-center justify-center p-4 transition-colors duration-200 ${theme === 'dark' ? 'bg-[#050b08]' : 'bg-[#050b08]'}`}>
      <div className={`w-full max-w-sm border p-6 rounded-2xl shadow-2xl transition-all ${theme === 'dark' ? 'bg-[#08140d] border-emerald-900/30' : 'bg-[#08140d] border-emerald-900/30'}`}>
        <div className="flex items-center justify-between mb-4">
          <div className="h-10 w-10 bg-emerald-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg shadow-emerald-950/20">Y</div>
          <button
            onClick={onToggleTheme}
            className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'border-emerald-900/30 text-emerald-300 hover:bg-[#0b1810]' : 'border-emerald-900/30 text-emerald-300 hover:bg-[#0b1810]'}`}
            title="Toggle system theme"
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>

        <h2 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
          {isSignUp ? 'Create Workspace Account' : 'Sign In to Vibe Workspace'}
        </h2>
        <p className="text-xs text-slate-500 mt-1 mb-4">Enter credentials or connect using your provider channels.</p>

        <form onSubmit={onAuthSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            required
            className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-[#050b08] border-emerald-900/35 focus:border-emerald-500 text-slate-200' : 'bg-[#050b08] border-emerald-900/35 focus:border-emerald-500 text-slate-200'}`}
          />
          <input
            type="password"
            placeholder="Account Security Key"
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            required
            className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-[#050b08] border-emerald-900/35 focus:border-emerald-500 text-slate-200' : 'bg-[#050b08] border-emerald-900/35 focus:border-emerald-500 text-slate-200'}`}
          />
          {authError && <p className="text-[11px] text-red-400 font-mono">{authError}</p>}

          <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2.5 rounded-lg transition mt-1 shadow-md shadow-emerald-950/20">
            {isSignUp ? 'Initialize Profile' : 'Access Workspace'}
          </button>
        </form>

        <div className={`relative flex py-4 items-center font-mono text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
          <div className={`flex-grow border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}></div>
          <span className="mx-2 shrink-0">OR</span>
          <div className={`flex-grow border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}></div>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={onGithubSignIn} className={`w-full border text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${theme === 'dark' ? 'bg-[#08140d] border-emerald-900/30 text-slate-100 hover:bg-[#0b1810]' : 'bg-[#08140d] border-emerald-900/30 text-slate-100 hover:bg-[#0b1810]'}`}>
            <Github size={14} className="fill-slate-100" /> Continue with GitHub
          </button>

          <button onClick={onGoogleSignIn} className={`w-full border text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${theme === 'dark' ? 'bg-[#050b08] border-emerald-900/30 text-slate-300 hover:bg-[#0b1810]' : 'bg-[#050b08] border-emerald-900/30 text-slate-300 hover:bg-[#0b1810]'}`}>
            <LogIn size={14} /> Continue with Google
          </button>
        </div>

        <p className="text-center text-xs text-slate-500 mt-4">
          {isSignUp ? 'Already have an account?' : 'Need a cloud development profile?'}
          <button onClick={onToggleAuthMode} className="text-emerald-400 font-semibold ml-1 hover:underline">
            {isSignUp ? 'Log In' : 'Sign Up'}
          </button>
        </p>
      </div>
    </div>
  );
}
