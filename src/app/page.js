"use html";
'use client';

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { FolderOpen, Save, Sparkles, ChevronRight } from 'lucide-react';

export default function IdeWorkspace() {
  // --- CORE STATE ---
  const [currentCode, setCurrentCode] = useState(`<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-slate-900 to-indigo-950 text-white min-h-screen flex flex-col justify-center items-center font-sans">
  <h1 class="text-5xl font-black mb-4 tracking-tight">Welcome to YouthDevs</h1>
  <p class="text-slate-400 text-lg">Type an instruction below to modify this page live.</p>
</body>
</html>`);

  const [fileHandle, setFileHandle] = useState(null);
  const [promptInput, setPromptInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- LOCAL FILE ACCESS API HANDLERS ---
  const handleOpenLocalFile = async () => {
    try {
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: 'HTML Files',
          accept: { 'text/html': ['.html'] }
        }],
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
      // Fallback: If no handle exists, prompt user to select/create a file path
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
        alert('File saved directly to disk!');
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
        body: JSON.stringify({
          currentCode: currentCode,
          instruction: promptInput
        })
      });

      const data = await response.json();
      if (data.updatedCode) {
        setCurrentCode(data.updatedCode);
        setPromptInput('');
      } else {
        alert('AI model error. Make sure your API environment variable is set correctly.');
      }
    } catch (err) {
      console.error('API Error:', err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="grid h-screen grid-rows-[56px_1fr_72px] bg-slate-950 font-sans select-none text-slate-200">
      
      {/* HEADER CONTROLS */}
      <header className="flex items-center justify-between px-6 border-b border-slate-800 bg-slate-900/50">
        <div className="flex items-center gap-3">
          <div className="h-6 w-6 bg-indigo-500 rounded-md flex items-center justify-center font-black text-xs text-white">Y</div>
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">YOUTHDEVS VIBE IDE</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={handleOpenLocalFile} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-semibold transition">
            <FolderOpen size={14} /> Open Local
          </button>
          <button onClick={handleSaveLocalFile} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white transition">
            <Save size={14} /> Save Code
          </button>
        </div>
      </header>

      {/* THREE PANELS WORKSPACE GRID */}
      <main className="grid grid-cols-[280px_1fr_1fr] overflow-hidden">
        
        {/* SIDEBAR: PLAYBOOK GUIDE */}
        <section className="border-r border-slate-800 bg-slate-900/30 p-4 overflow-y-auto flex flex-col gap-4">
          <h2 className="text-xs font-bold text-indigo-400 tracking-wider uppercase">YouthDevs Playbook</h2>
          <div className="flex flex-col gap-2">
            <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-lg text-xs leading-relaxed">
              <span className="font-semibold text-white block mb-1">Step 1: Ideate</span>
              Think of what app or design you want to build. Use the AI input at the bottom to inject code elements dynamically.
            </div>
            <div className="p-3 bg-slate-900/10 border border-transparent rounded-lg text-xs leading-relaxed text-slate-500">
              <span className="font-semibold text-slate-400 block mb-1">Step 2: Connect Storage</span>
              Open or mount a local `.html` folder file to save updates straight back to your computer.
            </div>
          </div>
        </section>

        {/* CENTER COLUMN: MONACO TEXT WRAPPER */}
        <section className="flex flex-col bg-slate-950 overflow-hidden">
          <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">{fileHandle ? fileHandle.name : 'sandbox.html'}</span>
          </div>
          <div className="flex-1 overflow-hidden pt-2">
            <Editor
              height="100%"
              defaultLanguage="html"
              theme="vs-dark"
              value={currentCode}
              onChange={(val) => setCurrentCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                wordWrap: "on",
                automaticLayout: true,
                padding: { top: 12 }
              }}
            />
          </div>
        </section>

        {/* RIGHT COLUMN: PREVIEW ENVIRONMENT */}
        <section className="flex flex-col border-l border-slate-800 bg-white overflow-hidden">
          <iframe
            title="Live Preview Sandbox"
            srcDoc={currentCode}
            sandbox="allow-scripts"
            className="w-full h-full border-none bg-white"
          />
        </section>
      </main>

      {/* GLOBAL FOOTER AI PROMPT INTERFACE */}
      <footer className="border-t border-slate-800 bg-slate-900 px-6 flex items-center">
        <form onSubmit={handleAiVibeSubmit} className="w-full flex items-center gap-3 bg-slate-950 border border-slate-800 rounded-xl px-4 py-1.5 focus-within:border-indigo-500 transition">
          <Sparkles size={16} className={isAiLoading ? "text-indigo-400 animate-pulse" : "text-slate-500"} />
          <input
            type="text"
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            disabled={isAiLoading}
            placeholder={isAiLoading ? "Vibe coding in progress... generation active..." : "What component, landing block, or styling adjustments do you want to inject?"}
            className="flex-1 bg-transparent border-none text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-0 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isAiLoading || !promptInput.trim()}
            className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white disabled:text-slate-500 font-semibold text-xs px-3 py-1.5 rounded-lg transition"
          >
            Vibe <ChevronRight size={12} />
          </button>
        </form>
      </footer>
      
    </div>
  );
}