'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FolderOpen, Save, Sparkles, ChevronRight, Play, LayoutGrid } from 'lucide-react';

// 🚀 THE FIX: Dynamically import Monaco Editor ONLY on the client side to prevent SSR crashes
const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function IdeWorkspace() {
  // --- CORE STATE ---
  const [currentCode, setCurrentCode] = useState(`<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-slate-900 to-indigo-950 text-white min-h-screen flex flex-col justify-center items-center font-sans">
  <div class="text-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-md shadow-2xl max-w-md">
    <div class="h-12 w-12 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-xl text-white mx-auto mb-4 shadow-lg shadow-indigo-500/30">Y</div>
    <h1 class="text-3xl font-black mb-2 tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">YouthDevs Vibe</h1>
    <p class="text-slate-400 text-sm">Type an instruction below to start vibe coding this application live.</p>
  </div>
</body>
</html>`);

  const [fileHandle, setFileHandle] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch issues by waiting for client-mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-screen w-screen bg-slate-950" />;

  // --- LOCAL FILE ACCESS API HANDLERS ---
  const handleOpenLocalFile = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }],
      });
      const file = await handle.getFile();
      const text = await file.text();
      setFileHandle(handle);
      setCurrentCode(text);
    } catch (err) {
      console.log('File picker closed or failed:', err);
    }
  };

  const handleSaveLocalFile = async () => {
    if (!fileHandle) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: 'index.html',
          types: [{ description: 'HTML Files', accept: { 'text/html': ['.html'] } }],
        });
        setFileHandle(handle);
        const writable = await handle.createWritable();
        await writable.write(currentCode);
        await writable.close();
        return;
      } catch (err) {
        return console.log('Save canceled:', err);
      }
    }
    try {
      const permission = await fileHandle.requestPermission({ mode: 'readwrite' });
      if (permission === 'granted') {
        const writable = await fileHandle.createWritable();
        await writable.write(currentCode);
        await writable.close();
      }
    } catch (err) {
      console.error('Error saving local file:', err);
    }
  };

  // --- VIBE CODING AI PROMPT HANDLER ---
  const handleAiVibeSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || isAiLoading) return;

    setIsAiLoading(true);
    try {
      const response = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentCode, instruction: promptInput })
      });

      const data = await response.json();
      if (data.updatedCode) {
        setCurrentCode(data.updatedCode);
        setPromptInput('');
      } else {
        alert('AI model error. Verify API configuration.');
      }
    } catch (err) {
      console.error('API Error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-200 overflow-hidden select-none">
      
      {/* 1. PREMIUM HEADER CONTROLS */}
      <header className="flex h-14 items-center justify-between px-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-sm text-white shadow-md shadow-indigo-600/20">Y</div>
          <div className="flex flex-col">
            <span className="font-bold text-xs tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent uppercase">YouthDevs Workspace</span>
            <span className="text-[10px] text-slate-500 font-mono -mt-0.5">v1.0.0-beta</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={handleOpenLocalFile} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs font-medium transition border border-slate-700/50">
            <FolderOpen size={14} className="text-slate-400" /> Open File
          </button>
          <button onClick={handleSaveLocalFile} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition shadow-lg shadow-indigo-600/10">
            <Save size={14} /> Save Changes
          </button>
        </div>
      </header>

      {/* 2. THE THREE-PANEL WORKSPACE GRID (EXACTLY FITS REMAINDER OF SCREEN) */}
      <main className="flex flex-1 w-full overflow-hidden min-h-0">
        
        {/* PANEL A: LEFT PLAYBOOK SIDEBAR */}
        <section className="w-64 border-r border-slate-800/80 bg-slate-900/20 flex flex-col h-full shrink-0">
          <div className="p-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center gap-2">
            <LayoutGrid size={14} className="text-indigo-400" />
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Playbook Guide</span>
          </div>
          <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3 custom-scrollbar">
            <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl text-xs leading-relaxed shadow-sm">
              <span className="font-bold text-indigo-400 block mb-1">🚀 01 / Prompt Engineering</span>
              Use the conversational frame at the bottom of the screen to describe layouts, buttons, or dynamic interfaces.
            </div>
            <div className="p-3 bg-slate-900/40 border border-slate-800/40 rounded-xl text-xs leading-relaxed text-slate-400">
              <span className="font-bold text-slate-400 block mb-1">📁 02 / Local Mounting</span>
              Mount a file using the header utility bar to pull static code directly from your desktop.
            </div>
          </div>
        </section>

        {/* PANEL B: MIDDLE CODE TEXT EDITOR */}
        <section className="flex-1 flex flex-col bg-slate-950 h-full border-r border-slate-800/80 min-w-0">
          <div className="bg-slate-900/40 h-9 px-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span className="text-xs font-mono tracking-tight text-slate-400">
                {fileHandle ? fileHandle.name : 'sandbox.html'}
              </span>
            </div>
          </div>
          <div className="flex-1 w-full overflow-hidden bg-[#1e1e1e]">
            <Editor
                height="100%"
                defaultLanguage="html"
                theme="vs-dark"
                value={currentCode}
                onChange={(val) => setCurrentCode(val || '')}
                options={{
                    minimap: { enabled: false },
                    fontSize: 13,
                    wordWrap: "on",
                    automaticLayout: true,
                    padding: { top: 12, bottom: 12 },
                    fontFamily: "var(--font-mono), Menlo, Monaco, Consolas, monospace",
                    lineHeight: 20,
                    // 🚀 THE TAB SPACER FIXES:
                    tabSize: 2,
                    insertSpaces: true,
                    detectIndentation: false
                }}
            />
          </div>
        </section>

        {/* PANEL C: RIGHT REFRESH PREVIEW DEVICE */}
        <section className="flex-1 flex flex-col bg-slate-900 h-full min-w-0">
          <div className="bg-slate-900/40 h-9 px-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <Play size={12} className="text-emerald-400 fill-emerald-400" />
              <span className="text-xs font-semibold tracking-wide text-slate-400">Live Preview Environment</span>
            </div>
          </div>
          <div className="flex-1 w-full bg-white relative">
            <iframe
              title="Live Preview Sandbox"
              srcDoc={currentCode}
              sandbox="allow-scripts"
              className="absolute inset-0 w-full h-full border-none m-0 p-0"
            />
          </div>
        </section>
      </main>

      {/* 3. ALIGNED BOTTOM AI PROMPT FOOTER PANEL */}
      <footer className="h-20 border-t border-slate-800 bg-slate-900/40 backdrop-blur-md px-6 flex items-center justify-center shrink-0 z-10">
        <form onSubmit={handleAiVibeSubmit} className="w-full max-w-5xl flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 focus-within:border-indigo-500/80 focus-within:ring-1 focus-within:ring-indigo-500/30 transition-all duration-200 shadow-inner">
          <Sparkles size={16} className={isAiLoading ? "text-indigo-400 animate-spin" : "text-slate-500"} />
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={isAiLoading}
            placeholder={isAiLoading ? "Streaming code adjustments..." : "What layout elements or content blocks should we build next?"}
            className="flex-1 bg-transparent border-none text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAiLoading || !promptInput.trim()}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-semibold text-xs px-3 py-1.5 rounded-lg transition dynamic-button shadow-md shadow-indigo-600/10"
          >
            Vibe <ChevronRight size={12} />
          </button>
        </form>
      </footer>
      
    </div>
  );
}