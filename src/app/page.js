'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { FolderOpen, Save, Sparkles, ChevronRight, Play, FileCode, Plus, X, Terminal, CheckSquare, Square, Zap } from 'lucide-react';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function IdeWorkspace() {
  // MULTI-FILE ARCHITECTURE STATE
  const [files, setFiles] = useState([
    {
      id: 'index-html',
      name: 'index.html',
      language: 'html',
      content: `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="stylesheet" href="styles.css">
</head>
<body class="bg-gradient-to-br from-slate-900 to-indigo-950 text-white min-h-screen flex flex-col justify-center items-center font-sans">
  <div class="text-center p-8 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-md shadow-2xl max-w-md custom-card">
    <div class="h-12 w-12 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-xl text-white mx-auto mb-4 shadow-lg shadow-indigo-500/30">Y</div>
    <h1 id="main-title" class="text-3xl font-black mb-2 tracking-tight bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent">YouthDevs Vibe</h1>
    <p class="text-slate-400 text-sm">Type an instruction below to start vibe coding this application live.</p>
  </div>
</body>
</html>`
    },
    {
      id: 'styles-css',
      name: 'styles.css',
      language: 'css',
      content: `/* Custom Project Styles */
.custom-card {
  box-shadow: 0 20px 40px -15px rgba(99, 102, 241, 0.15);
  transition: transform 0.3s ease;
}
.custom-card:hover {
  transform: translateY(-2px);
}`
    }
  ]);

  const [activeFileId, setActiveFileId] = useState('index-html');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [selectedContextIds, setSelectedContextIds] = useState(['index-html', 'styles-css']);

  // MODEL ENGINE & COOLDOWN LIMITER STATE
  const [isSupercharged, setIsSupercharged] = useState(false);
  const [superchargeUses, setSuperchargeUses] = useState(0);
  const [cooldownEndTime, setCooldownEndTime] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastModelUsed, setLastModelUsed] = useState(null);

  // Core Utilities
  const [promptInput, setPromptInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  // 🚀 REAL-TIME LIVE STREAM CONSOLE LOG ARRAY STATE
  const [consoleLogs, setConsoleLogs] = useState([
    'SYSTEM: YouthDevs Virtual Kernel initialized.',
    'READY: Standing by for multi-file generation instructions...'
  ]);

  // Split Panels Sizing Tracker
  const [leftWidth, setLeftWidth] = useState(240); 
  const [centerWidth, setCenterWidth] = useState(600); 
  const [footerHeight, setFooterHeight] = useState(180); 

  const isResizingLeft = useRef(false);
  const isResizingCenter = useRef(false);
  const isResizingFooter = useRef(false);
  
  // Auto-scroll anchor reference for console stream box
  const consoleBottomRef = useRef(null);

  const currentActiveFile = files.find(f => f.id === activeFileId) || files[0];

  useEffect(() => {
    setMounted(true);
  }, []);

  // Auto-scroll console window down whenever a new log streams in
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [consoleLogs]);

  // COOLDOWN TIMER COUNTDOWN EFFECT
  useEffect(() => {
    if (!cooldownEndTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const distance = cooldownEndTime - now;

      if (distance <= 0) {
        setCooldownEndTime(null);
        setSecondsLeft(0);
        setSuperchargeUses(0);
        setConsoleLogs(prev => [...prev, 'SYSTEM: Supercharge cooldown expired. 3.5 Flash engine available.']);
        clearInterval(interval);
      } else {
        setSecondsLeft(Math.ceil(distance / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [cooldownEndTime]);

  // UI Drag Interceptors
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft.current) setLeftWidth(Math.max(180, Math.min(400, e.clientX)));
      if (isResizingCenter.current) setCenterWidth(Math.max(300, Math.min(window.innerWidth - leftWidth - 200, e.clientX - leftWidth)));
      if (isResizingFooter.current) setFooterHeight(Math.max(120, Math.min(500, window.innerHeight - e.clientY)));
    };
    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingCenter.current = false;
      isResizingFooter.current = false;
      document.body.classList.remove('is-resizing', 'is-resizing-v');
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth]);

  // Assembly Preview compiler
  const getBundledPreviewCode = () => {
    const indexFile = files.find(f => f.name === 'index.html');
    if (!indexFile) return '';
    let bundledHtml = indexFile.content;

    files.forEach(file => {
      if (file.language === 'css') {
        const cssMatcher = new RegExp(`<link[^>]*href=["']\\.?/?${file.name}["'][^>]*>`, 'g');
        bundledHtml = cssMatcher.test(bundledHtml) 
          ? bundledHtml.replace(cssMatcher, `<style>\n${file.content}\n</style>`)
          : bundledHtml.replace('</head>', `<style>\n${file.content}\n</style>\n</head>`);
      }
      if (file.language === 'javascript') {
        const jsMatcher = new RegExp(`<script[^>]*src=["']\\.?/?${file.name}["'][^>]*>\\s*</script>`, 'g');
        bundledHtml = jsMatcher.test(bundledHtml)
          ? bundledHtml.replace(jsMatcher, `<script>\n${file.content}\n</script>`)
          : bundledHtml.replace('</body>', `<script>\n${file.content}\n</script>\n</body>`);
      }
    });
    return bundledHtml;
  };

  if (!mounted) return <div className="h-screen w-screen bg-slate-950" />;

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  // Manual File Creator Nodes
  const handleCreateFile = (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    let language = 'html';
    if (name.endsWith('.css')) language = 'css';
    if (name.endsWith('.js')) language = 'javascript';

    const newId = `file-${Date.now()}`;
    const newFile = { id: newId, name, language, content: `` };
    setFiles([...files, newFile]);
    setSelectedContextIds([...selectedContextIds, newId]);
    setActiveFileId(newId);
    setNewFileName('');
    setShowNewFileInput(false);
    setConsoleLogs(prev => [...prev, `USER: Spawned custom local resource node [${name}]`]);
  };

  const handleCloseFile = (idToClose, e) => {
    e.stopPropagation();
    if (files.length <= 1) return;
    const filtered = files.filter(f => f.id !== idToClose);
    setFiles(filtered);
    setSelectedContextIds(selectedContextIds.filter(id => id !== idToClose));
    if (activeFileId === idToClose) setActiveFileId(filtered[filtered.length - 1].id);
  };

  const toggleContextSelection = (id, e) => {
    e.stopPropagation();
    selectedContextIds.includes(id)
      ? setSelectedContextIds(selectedContextIds.filter(cid => cid !== id))
      : setSelectedContextIds([...selectedContextIds, id]);
  };

  // 🚀 STREAMING TERMINAL LOADER GENERATOR MATRIX
  const triggerMatrixTerminalStream = (stopRef) => {
    const mockLogs = [
      'CONNECT: Allocating secure model token transport stream...',
      'SCAN: Digesting structural workspace repository mapping tree...',
      'CONTEXT: Loading context variables into system context prompt scope...',
      'PARSE: Analyzing abstract syntax layout configurations...',
      'OPTIMIZE: Compiling Tailwind CSS utilities dynamic injection modules...',
      'RESOLVE: Rebalancing multi-page internal link reference states...',
      'FETCH: Running model reasoning inference layers...',
      'STREAM: Evaluating dynamic HTML DOM modifications structural vectors...',
      'COMPILING: Rendering application components on fast compiler thread...',
      'INTEGRATING: Preparing differential source code hot patches...'
    ];

    let currentLogIndex = 0;
    const intervalId = setInterval(() => {
      if (stopRef.current === false) {
        clearInterval(intervalId);
        return;
      }
      if (currentLogIndex < mockLogs.length) {
        setConsoleLogs(prev => [...prev, `INFO: ${mockLogs[currentLogIndex]}`]);
        currentLogIndex++;
      } else {
        // Keep looping random debug noise if response takes longer than standard
        const noise = [
          'DEBUG: Maintaining active content stream thread link lock...',
          'DEBUG: Awaiting delta patch dictionary assembly verification...',
          'DEBUG: Syncing iframe preview runtime dependencies...'
        ];
        const randomNoise = noise[Math.floor(Math.random() * noise.length)];
        setConsoleLogs(prev => [...prev, randomNoise]);
      }
    }, 450); // Streams out a rapid new line log statement every 450ms

    return intervalId;
  };

  // MULTI-ACTION AGENT ENGINE EXECUTION
  const handleAgenticVibeSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || isAiLoading) return;

    if (isSupercharged && cooldownEndTime) {
      alert(`Supercharge rate limit hit! Please wait ${formatTime(secondsLeft)}.`);
      return;
    }

    setIsAiLoading(true);
    
    // Clear out console and append starting log commands instantly
    setConsoleLogs([
      `PROMPT: "${promptInput}"`,
      'INITIALIZING: Instantiating Copilot Vibe Engine compiler pipeline...'
    ]);

    // Reference controller flag to break interval execution loop
    const keepStreamingLogs = { current: true };
    const logIntervalId = triggerMatrixTerminalStream(keepStreamingLogs);

    const repositoryStructure = files.map(f => ({ name: f.name, language: f.language }));
    const selectedContextContents = files
      .filter(f => selectedContextIds.includes(f.id))
      .map(f => ({ name: f.name, content: f.content }));

    const targetModel = isSupercharged ? 'gemini-3.5-flash' : 'gemini-3.1-flash-lite';

    try {
      const response = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: promptInput,
          repositoryStructure,
          contextFiles: selectedContextContents,
          modelSelection: targetModel
        })
      });

      const data = await response.json();

      // Shut off the rapid pseudo-log auto-stream loop
      keepStreamingLogs.current = false;
      clearInterval(logIntervalId);

      if (data.filePatches && Array.isArray(data.filePatches)) {
        let updatedFilesList = [...files];
        let actionLogs = [];

        data.filePatches.forEach(patch => {
          const targetName = patch.name.trim();
          
          if (patch.action === 'create') {
            const alreadyExists = updatedFilesList.some(f => f.name.toLowerCase() === targetName.toLowerCase());
            if (!alreadyExists) {
              let language = 'html';
              if (targetName.endsWith('.css')) language = 'css';
              if (targetName.endsWith('.js')) language = 'javascript';

              const createdId = `file-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
              updatedFilesList.push({ id: createdId, name: targetName, language: language, content: patch.content || '' });
              selectedContextIds.push(createdId);
              actionLogs.push(`Spawned custom workspace item [${targetName}]`);
            }
          }
          else if (patch.action === 'update') {
            updatedFilesList = updatedFilesList.map(f => {
              if (f.name.toLowerCase() === targetName.toLowerCase()) {
                return { ...f, content: patch.content || '' };
              }
              return f;
            });
            actionLogs.push(`Injected updates into file asset [${targetName}]`);
          }
          else if (patch.action === 'delete') {
            updatedFilesList = updatedFilesList.filter(f => f.name.toLowerCase() !== targetName.toLowerCase());
            actionLogs.push(`Wiped file system node tracking item [${targetName}]`);
          }
        });

        if (updatedFilesList.length === 0) {
          updatedFilesList.push({ id: 'index-html', name: 'index.html', language: 'html', content: '' });
        }

        setFiles(updatedFilesList);
        setSelectedContextIds([...selectedContextIds]);
        
        if (!updatedFilesList.some(f => f.id === activeFileId)) {
          setActiveFileId(updatedFilesList[0].id);
        }

        setLastModelUsed(targetModel === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash' : 'Gemini 3.1 Flash-Lite');
        
        // Print clean ending telemetry details straight into the array log list
        setConsoleLogs(prev => [
          ...prev,
          ...actionLogs.map(logText => `SUCCESS: ${logText}`),
          'COMPLETED: Repository differential compilation update successfully linked.'
        ]);
        
        setPromptInput('');

        if (isSupercharged) {
          const nextCount = superchargeUses + 1;
          setSuperchargeUses(nextCount);
          if (nextCount >= 10) {
            setCooldownEndTime(Date.now() + 10 * 60 * 1000);
            setIsSupercharged(false);
          }
        }
      } else {
        setConsoleLogs(prev => [...prev, `CRITICAL: Compilation failed. ${data.error || 'Syntax exception.'}`]);
      }
    } catch (err) {
      keepStreamingLogs.current = false;
      clearInterval(logIntervalId);
      setConsoleLogs(prev => [...prev, 'CRITICAL: Network execution loop pipeline broken. Check server connection logs.']);
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-200 overflow-hidden select-none">
      
      {/* HEADER UTILITY */}
      <header className="flex h-14 items-center justify-between px-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-7 w-7 bg-indigo-600 rounded-lg flex items-center justify-center font-black text-sm text-white shadow-md shadow-indigo-600/20">Y</div>
          <div className="flex flex-col">
            <span className="font-bold text-xs tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent uppercase">Vibe Workspace Agent</span>
            <span className="text-[10px] text-slate-500 font-mono -mt-0.5">Stream Telemetry Build</span>
          </div>
        </div>

        {/* SUPERCHARGE TOGGLE BUTTON SWITCH */}
        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Supercharge Mode</span>
            <span className="text-[9px] font-mono text-slate-500">
              {cooldownEndTime ? `Cooldown: ${formatTime(secondsLeft)}` : `Tokens: ${10 - superchargeUses}/10 Left`}
            </span>
          </div>
          <button
            onClick={() => {
              if (cooldownEndTime) return;
              setIsSupercharged(!isSupercharged);
            }}
            disabled={!!cooldownEndTime}
            className={`p-1.5 rounded-lg border transition-all flex items-center justify-center ${
              cooldownEndTime 
                ? 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed'
                : isSupercharged
                  ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md shadow-amber-500/10'
                  : 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
            }`}
          >
            <Zap size={15} className={isSupercharged ? "fill-amber-400 text-amber-400 animate-pulse" : ""} />
          </button>
        </div>
      </header>

      {/* PANELS COMPARTMENT */}
      <main className="flex flex-1 w-full overflow-hidden min-h-0 relative">
        
        {/* EXPLORER TREE */}
        <section style={{ width: `${leftWidth}px` }} className="border-r border-slate-800/80 bg-slate-900/20 flex flex-col h-full shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Workspace Tree</span>
            <button onClick={() => setShowNewFileInput(!showNewFileInput)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
              <Plus size={14} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            {showNewFileInput && (
              <form onSubmit={handleCreateFile} className="mb-2">
                <input
                  type="text" autoFocus placeholder="filename.html..." value={newFileName}
                  onChange={(e) => setNewFileName(e.target.value)}
                  onBlur={() => setTimeout(() => setShowNewFileInput(false), 200)}
                  className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-slate-200 outline-none font-mono"
                />
              </form>
            )}

            {files.map((file) => {
              const isSelected = file.id === activeFileId;
              const isContextChecked = selectedContextIds.includes(file.id);
              return (
                <div
                  key={file.id} onClick={() => setActiveFileId(file.id)}
                  className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group text-xs font-mono border ${
                    isSelected ? 'bg-indigo-600/15 border-indigo-500/20 text-slate-100 font-medium' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-300 hover:bg-slate-900/40'
                  }`}
                >
                  <div className="flex items-center gap-2 overflow-hidden">
                    <div onClick={(e) => toggleContextSelection(file.id, e)} className="text-slate-500 hover:text-indigo-400 p-0.5">
                      {isContextChecked ? <CheckSquare size={13} className="text-indigo-500" /> : <Square size={13} />}
                    </div>
                    <FileCode size={13} className="text-slate-400 shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  <X size={11} className="opacity-0 group-hover:opacity-100 hover:text-red-400 p-0.5" onClick={(e) => handleCloseFile(file.id, e)} />
                </div>
              );
            })}
          </div>
        </section>

        <div className="w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 z-20 shrink-0" onMouseDown={() => { isResizingLeft.current = true; document.body.classList.add('is-resizing'); }} />

        {/* EDITOR SPLIT */}
        <section style={{ width: `${centerWidth}px` }} className="flex flex-col bg-slate-950 h-full border-r border-slate-800/80 shrink-0 overflow-hidden">
          <div className="bg-slate-900/40 h-9 border-b border-slate-800/60 flex items-center overflow-x-auto shrink-0 select-none">
            {files.map((file) => (
              <div
                key={file.id} onClick={() => setActiveFileId(file.id)}
                className={`h-full flex items-center gap-2 px-4 text-xs font-mono border-r border-slate-800/60 cursor-pointer ${
                  file.id === activeFileId ? 'bg-slate-950 border-t-2 border-t-indigo-500 text-slate-100' : 'bg-slate-900/20 text-slate-500 hover:text-slate-300'
                }`}
              >
                <span>{file.name}</span>
                <X size={10} className="hover:text-red-400" onClick={(e) => handleCloseFile(file.id, e)} />
              </div>
            ))}
          </div>

          <div className="flex-1 w-full overflow-hidden bg-[#1e1e1e]">
            {files.length > 0 && currentActiveFile && (
              <Editor
                height="100%" language={currentActiveFile.language} theme="vs-dark"
                value={currentActiveFile.content}
                onChange={(val) => setFiles(files.map(f => f.id === activeFileId ? { ...f, content: val || '' } : f))}
                options={{
                  minimap: { enabled: false }, fontSize: 15, wordWrap: "off", automaticLayout: true,
                  fontFamily: "Consolas, 'Courier New', Courier, monospace", tabSize: 4, insertSpaces: true, detectIndentation: false,
                  scrollbar: { horizontal: 'auto', horizontalScrollbarSize: 10 }
                }}
              />
            )}
          </div>
        </section>

        <div className="w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 z-20 shrink-0" onMouseDown={() => { isResizingCenter.current = true; document.body.classList.add('is-resizing'); }} />

        {/* LIVE CANVAS MESH */}
        <section className="flex-1 flex flex-col bg-slate-900 h-full overflow-hidden min-w-[200px]">
          <div className="bg-slate-900/40 h-9 px-4 border-b border-slate-800/60 flex items-center justify-between shrink-0">
            <span className="text-xs font-semibold tracking-wide text-slate-400">Live Workspace Mesh Sandbox</span>
          </div>
          <div className="flex-1 w-full bg-white relative">
            <iframe title="Live View" srcDoc={getBundledPreviewCode()} sandbox="allow-scripts" className="absolute inset-0 w-full h-full border-none m-0 p-0" />
          </div>
        </section>
      </main>

      <div className="h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-indigo-500/40 z-20 border-t border-slate-800/50" onMouseDown={() => { isResizingFooter.current = true; document.body.classList.add('is-resizing-v'); }} />

      {/* DRAWER INTERACTION CONSOLE */}
      <footer style={{ height: `${footerHeight}px` }} className="border-t border-slate-800 bg-slate-900/40 backdrop-blur-md p-4 flex gap-4 shrink-0 z-10 overflow-hidden">
        
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex items-center gap-1.5 mb-1.5 text-slate-400">
            <Sparkles size={13} className={isAiLoading ? "animate-spin text-indigo-400" : ""} />
            <span className="text-[11px] font-bold tracking-wider uppercase">Copilot Action Prompt (Linked Context: {selectedContextIds.length})</span>
          </div>
          <form onSubmit={handleAgenticVibeSubmit} className="flex-1 flex items-stretch gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-500/60 transition-all">
            <textarea
              value={promptInput} onChange={(e) => setPromptInput(e.target.value)} disabled={isAiLoading}
              placeholder={cooldownEndTime ? `Supercharge lock active. Wait ${formatTime(secondsLeft)}` : "Describe full repo architectural alterations..."}
              className="flex-1 bg-transparent border-none text-xs text-slate-100 focus:outline-none resize-none p-1 custom-scrollbar leading-relaxed"
            />
            <button type="submit" disabled={isAiLoading || !promptInput.trim()} className="self-end flex items-center justify-center gap-1 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition">
              Vibe <ChevronRight size={12} />
            </button>
          </form>
        </div>

        {/* 🚀 LOG WINDOW DISPLAYING MULTIPLE REAL-TIME STREAM LINES */}
        <div className="w-1/2 flex flex-col min-w-[250px] border-l border-slate-800/80 pl-4 h-full">
          <div className="flex items-center justify-between mb-1.5 text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5">
              <Terminal size={13} />
              <span className="text-[11px] font-bold tracking-wider uppercase">Agent Orchestration Console</span>
            </div>
            {lastModelUsed && (
              <span className="text-[9px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-1.5 py-0.5 rounded-md">
                Engine: {lastModelUsed}
              </span>
            )}
          </div>
          <div className="flex-1 bg-slate-950 border border-slate-800/60 rounded-xl p-3 font-mono text-[11px] leading-relaxed text-slate-400 overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner">
            {consoleLogs.map((log, index) => {
              let textClass = "text-slate-400";
              if (log.startsWith('SUCCESS:')) textClass = "text-emerald-400 font-semibold";
              if (log.startsWith('CRITICAL:')) textClass = "text-rose-400 font-black";
              if (log.startsWith('PROMPT:')) textClass = "text-indigo-400 font-medium italic";
              if (log.startsWith('INITIALIZING:') || log.startsWith('SYSTEM:')) textClass = "text-amber-400";
              
              return (
                <div key={index} className={`${textClass} break-all whitespace-pre-wrap`}>
                  &gt; {log}
                </div>
              );
            })}
            <div ref={consoleBottomRef} />
          </div>
        </div>

      </footer>
    </div>
  );
}