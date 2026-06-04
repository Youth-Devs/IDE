'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, ChevronRight, FileCode, Plus, X, Terminal, CheckSquare, Square, Zap, LogOut, Folder, ArrowLeft, LogIn } from 'lucide-react';

// Firebase Connectors
import { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, addDoc, getDocs, query, where, updateDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function HomeContainer() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard vs IDE View state
  const [currentProjectId, setCurrentProjectId] = useState(null); 
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');

  // Core IDE Project States
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [selectedContextIds, setSelectedContextIds] = useState([]);

  // Supercharge Rate Limiter State (Shared globally across the account)
  const [isSupercharged, setIsSupercharged] = useState(false);
  const [superchargeUses, setSuperchargeUses] = useState(0);
  const [cooldownEndTime, setCooldownEndTime] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastModelUsed, setLastModelUsed] = useState(null);

  // Layout & Console Utilities
  const [promptInput, setPromptInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([
    'SYSTEM: YouthDevs Workspace Initialization Layer Online.'
  ]);

  const [leftWidth, setLeftWidth] = useState(240); 
  const [centerWidth, setCenterWidth] = useState(600); 
  const [footerHeight, setFooterHeight] = useState(180); 

  const isResizingLeft = useRef(false);
  const isResizingCenter = useRef(false);
  const isResizingFooter = useRef(false);
  const consoleBottomRef = useRef(null);

  const currentActiveFile = files.find(f => f.id === activeFileId) || files[0];

  // 1. Auth Listener Connection Hook
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        // Reset local views when logged out
        setCurrentProjectId(null);
        setProjects([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch User Projects & User Global Limits Configuration
  useEffect(() => {
    if (!user) return;

    // A. Keep tabs on User Account Profile Document for Persistent Supercharge metrics
    const userProfileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userProfileRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSuperchargeUses(data.superchargeUses || 0);
        setCooldownEndTime(data.cooldownEndTime || null);
      }
    });

    // B. Fetch associated working repositories 
    const q = query(collection(db, 'projects'), where('userId', '==', user.uid));
    const unsubProjects = onSnapshot(q, (snapshot) => {
      const projs = [];
      snapshot.forEach(doc => projs.push({ id: doc.id, ...doc.data() }));
      setProjects(projs);
    });

    return () => {
      unsubProfile();
      unsubProjects();
    };
  }, [user]);

  // 3. Real-Time Active File Array Sync Node
  useEffect(() => {
    if (!user || !currentProjectId) return;

    const projectRef = doc(db, 'projects', currentProjectId);
    const unsubProjectFiles = onSnapshot(projectRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const incomingFiles = data.files || [];
        setFiles(incomingFiles);
        if (incomingFiles.length > 0 && !activeFileId) {
          setActiveFileId(incomingFiles[0].id);
          setSelectedContextIds(incomingFiles.map(f => f.id));
        }
      }
    });

    return () => unsubProjectFiles();
  }, [user, currentProjectId]);

  // Cooldown countdown tracking routine
  useEffect(() => {
    if (!cooldownEndTime) return;
    const interval = setInterval(() => {
      const distance = cooldownEndTime - Date.now();
      if (distance <= 0) {
        setCooldownEndTime(null);
        setSecondsLeft(0);
        if (user) {
          updateDoc(doc(db, 'users', user.uid), { superchargeUses: 0, cooldownEndTime: null });
        }
        clearInterval(interval);
      } else {
        setSecondsLeft(Math.ceil(distance / 1000));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownEndTime, user]);

  useEffect(() => {
    if (consoleBottomRef.current) consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
  }, [consoleLogs]);

  // UI Split Drag Handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft.current) setLeftWidth(Math.max(180, Math.min(400, e.clientX)));
      if (isResizingCenter.current) setCenterWidth(Math.max(300, Math.min(window.innerWidth - leftWidth - 200, e.clientX - leftWidth)));
      if (isResizingFooter.current) setFooterHeight(Math.max(120, Math.min(500, window.innerHeight - e.clientY)));
    };
    const handleMouseUp = () => {
      isResizingLeft.current = false; isResizingCenter.current = false; isResizingFooter.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth]);

  // --- AUTH OPERATIONS ---
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setAuthError(err.message.replace('Firebase: ', ''));
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // --- PROJECT MANAGEMENT ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;

    const defaultFiles = [
      {
        id: 'index-html',
        name: 'index.html',
        language: 'html',
        content: `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-900 text-white min-h-screen flex items-center justify-center">
  <div class="text-center p-6 bg-slate-800 rounded-xl">
    <h1 class="text-2xl font-bold text-indigo-400">${newProjectName}</h1>
    <p class="text-xs text-slate-400 mt-2">Vibe engine standing by.</p>
  </div>
</body>
</html>`
      }
    ];

    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName.trim(),
        userId: user.uid,
        files: defaultFiles,
        createdAt: serverTimestamp()
      });
      setNewProjectName('');
    } catch (err) {
      console.error(err);
    }
  };

  // --- MANUAL SOURCE PATCH SYNCER ---
  const syncFileArrayToFirestore = async (updatedFiles) => {
    if (!currentProjectId) return;
    const projectRef = doc(db, 'projects', currentProjectId);
    await updateDoc(projectRef, { files: updatedFiles });
  };

  const handleCreateFile = async (e) => {
    e.preventDefault();
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    let language = 'html';
    if (name.endsWith('.css')) language = 'css';
    if (name.endsWith('.js')) language = 'javascript';

    const newId = `file-${Date.now()}`;
    const newFile = { id: newId, name, language, content: `` };
    
    const nextFiles = [...files, newFile];
    setFiles(nextFiles);
    setActiveFileId(newId);
    setSelectedContextIds([...selectedContextIds, newId]);
    setNewFileName('');
    setShowNewFileInput(false);
    
    await syncFileArrayToFirestore(nextFiles);
  };

  const handleCloseFile = async (idToClose, e) => {
    e.stopPropagation();
    if (files.length <= 1) return;
    const filtered = files.filter(f => f.id !== idToClose);
    setFiles(filtered);
    if (activeFileId === idToClose) setActiveFileId(filtered[filtered.length - 1].id);
    await syncFileArrayToFirestore(filtered);
  };

  const handleEditorChange = (val) => {
    const updated = files.map(f => f.id === activeFileId ? { ...f, content: val || '' } : f);
    setFiles(updated);
    // Debounce or save manually on key releases
    syncFileArrayToFirestore(updated);
  };

  // Compiler Sandbox Preview Assembler
  const getBundledPreviewCode = () => {
    const indexFile = files.find(f => f.name === 'index.html') || files[0];
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

  const triggerMatrixTerminalStream = (stopRef) => {
    const mockLogs = [
      'CONNECT: Querying secure model transport pipelines...',
      'SCAN: Structural project data map parsing sequence active...',
      'CONTEXT: Resolving linked file buffer vectors into global prompt token stack...',
      'PARSE: Evaluating document elements abstract structure configurations...',
      'FETCH: Running parallel model reasoning matrices...',
      'COMPILING: Structuring differential workspace patch components...'
    ];
    let idx = 0;
    const intervalId = setInterval(() => {
      if (!stopRef.current) return clearInterval(intervalId);
      if (idx < mockLogs.length) {
        setConsoleLogs(prev => [...prev, `INFO: ${mockLogs[idx]}`]);
        idx++;
      }
    }, 400);
    return intervalId;
  };

  // --- AGENT VIBE PIPELINE RUNNER ---
  const handleAgenticVibeSubmit = async (e) => {
    e.preventDefault();
    if (!promptInput.trim() || isAiLoading || !currentProjectId) return;

    if (isSupercharged && cooldownEndTime) {
      alert(`Supercharge lock active. Wait ${secondsLeft} seconds.`);
      return;
    }

    setIsAiLoading(true);
    setConsoleLogs([`PROMPT: "${promptInput}"`, 'SYSTEM: Initializing agent ecosystem pipeline context...']);

    const keepStreaming = { current: true };
    const streamId = triggerMatrixTerminalStream(keepStreaming);

    const repositoryStructure = files.map(f => ({ name: f.name, language: f.language }));
    const selectedContextContents = files.filter(f => selectedContextIds.includes(f.id)).map(f => ({ name: f.name, content: f.content }));
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
      keepStreaming.current = false;
      clearInterval(streamId);

      if (data.filePatches && Array.isArray(data.filePatches)) {
        let updatedFilesList = [...files];
        let actionLogs = [];

        data.filePatches.forEach(patch => {
          const targetName = patch.name.trim();
          if (patch.action === 'create') {
            if (!updatedFilesList.some(f => f.name.toLowerCase() === targetName.toLowerCase())) {
              let language = 'html';
              if (targetName.endsWith('.css')) language = 'css';
              if (targetName.endsWith('.js')) language = 'javascript';
              updatedFilesList.push({ id: `file-${Date.now()}-${Math.random().toString(36).substr(2,4)}`, name: targetName, language, content: patch.content || '' });
              actionLogs.push(`Added workspace document [${targetName}]`);
            }
          } else if (patch.action === 'update') {
            updatedFilesList = updatedFilesList.map(f => f.name.toLowerCase() === targetName.toLowerCase() ? { ...f, content: patch.content || '' } : f);
            actionLogs.push(`Injected edits to document [${targetName}]`);
          } else if (patch.action === 'delete') {
            updatedFilesList = updatedFilesList.filter(f => f.name.toLowerCase() !== targetName.toLowerCase());
            actionLogs.push(`Wiped document resource [${targetName}]`);
          }
        });

        if (updatedFilesList.length === 0) {
          updatedFilesList.push({ id: 'index-html', name: 'index.html', language: 'html', content: '' });
        }

        setFiles(updatedFilesList);
        await syncFileArrayToFirestore(updatedFilesList);
        setLastModelUsed(targetModel === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash' : 'Gemini 3.1 Flash-Lite');
        setConsoleLogs(prev => [...prev, ...actionLogs.map(l => `SUCCESS: ${l}`), 'COMPLETED: AI patch generation cycle finished.']);
        setPromptInput('');

        if (isSupercharged) {
          const nextCount = superchargeUses + 1;
          const userRef = doc(db, 'users', user.uid);
          if (nextCount >= 10) {
            const cooldownTime = Date.now() + 10 * 60 * 1000;
            await updateDoc(userRef, { superchargeUses: nextCount, cooldownEndTime: cooldownTime });
            setIsSupercharged(false);
          } else {
            await updateDoc(userRef, { superchargeUses: nextCount });
          }
        }
      } else {
        setConsoleLogs(prev => [...prev, `CRITICAL: Compilation failed. ${data.error || 'Check server configuration structure.'}`]);
      }
    } catch (err) {
      keepStreaming.current = false; clearInterval(streamId);
      setConsoleLogs(prev => [...prev, 'CRITICAL: Engine compilation network failure.']);
    } finally {
      setIsAiLoading(false);
    }
  };

  if (authLoading) {
    return <div className="h-screen w-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-indigo-400">CONNECTING TO YOUTHDEVS KERNEL...</div>;
  }

  // --- RENDER 1: SIGN IN / SIGN UP SCREEN PANEL ---
  if (!user) {
    return (
      <div className="h-screen w-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl">
          <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg mb-4">Y</div>
          <h2 className="text-xl font-bold tracking-tight text-white">{isSignUp ? 'Create Workspace Account' : 'Sign In to Vibe Workspace'}</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Enter credentials or connect using your Google parameters.</p>
          
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
            <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-slate-200" />
            <input type="password" placeholder="Account Security Key" value={password} onChange={e => setPassword(e.target.value)} required className="w-full bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3 py-2.5 rounded-lg outline-none text-slate-200" />
            {authError && <p className="text-[11px] text-red-400 font-mono">{authError}</p>}
            
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg transition mt-1">
              {isSignUp ? 'Initialize Profile' : 'Access Workspace'}
            </button>
          </form>

          <div className="relative flex py-4 items-center font-mono text-[9px] text-slate-600 uppercase tracking-widest">
            <div className="flex-grow border-t border-slate-800"></div><span className="mx-2 shrink-0">OR</span><div className="flex-grow border-t border-slate-800"></div>
          </div>

          <button onClick={handleGoogleSignIn} className="w-full bg-slate-950 border border-slate-800 hover:bg-slate-900 text-slate-300 text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition">
            <LogIn size={14} /> Continue with Google
          </button>

          <p className="text-center text-xs text-slate-500 mt-4">
            {isSignUp ? 'Already have an account?' : 'Need a cloud development profile?'} 
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-400 font-semibold ml-1 hover:underline">{isSignUp ? 'Log In' : 'Sign Up'}</button>
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER 2: DASHBOARD VIEW PANEL ---
  if (!currentProjectId) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-200 flex flex-col font-sans">
        <header className="h-14 border-b border-slate-800 bg-slate-900/40 px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 bg-indigo-600 rounded-md flex items-center justify-center font-black text-sm text-white">Y</div>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">YouthDevs Central Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500 font-mono">{user.email}</span>
            <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-400 transition flex items-center gap-1 text-xs">
              <LogOut size={13} /> Exit
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 overflow-y-auto">
          <div className="bg-gradient-to-r from-indigo-950/40 to-slate-900 border border-slate-800/80 p-6 rounded-2xl mb-8">
            <h2 className="text-xl font-black text-white">Welcome Back to Cloud Core</h2>
            <p className="text-xs text-slate-400 mt-1 max-w-lg">Build, update, and deploy multi-file codebases natively stored in Firestore containers. The global AI Supercharge token limit persists across all active instances.</p>
            
            <form onSubmit={handleCreateProject} className="mt-4 flex gap-2 max-w-md">
              <input type="text" placeholder="New app template name (e.g., dashboard-ui)..." value={newProjectName} onChange={e => setNewProjectName(e.target.value)} required className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 text-xs px-3 py-2 rounded-lg outline-none text-slate-200" />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition">
                <Plus size={14} /> Create Repo
              </button>
            </form>
          </div>

          <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Your Persistent Projects</h3>
          {projects.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-slate-800 rounded-xl text-xs text-slate-500 font-mono">No active projects found. Type a title above to spawn your first cloud node container.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map(proj => (
                <div key={proj.id} onClick={() => { setCurrentProjectId(proj.id); setFiles([]); setActiveFileId(''); }} className="p-4 bg-slate-900 border border-slate-800 rounded-xl cursor-pointer hover:border-indigo-500/40 transition group">
                  <div className="flex items-center gap-2.5 text-slate-300 font-bold text-sm group-hover:text-indigo-400 transition">
                    <Folder size={16} className="text-indigo-500" />
                    {proj.name}
                  </div>
                  <div className="flex justify-between items-center mt-4 text-[10px] text-slate-500 font-mono">
                    <span>Files Tracked: {proj.files?.length || 0}</span>
                    <span className="text-indigo-500 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">Open Workspace <ChevronRight size={10} /></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    );
  }

  // --- RENDER 3: PRIMARY WORKSPACE IDE VIEW ---
  return (
    <div className="flex flex-col h-screen w-screen bg-slate-950 font-sans text-slate-200 overflow-hidden select-none">
      <header className="flex h-14 items-center justify-between px-4 border-b border-slate-800 bg-slate-900/60 backdrop-blur-md z-10 shrink-0">
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentProjectId(null)} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition" title="Return to Dashboard">
            <ArrowLeft size={14} />
          </button>
          <div className="h-5 w-px bg-slate-800" />
          <span className="font-bold text-xs tracking-wider bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent uppercase font-mono">
            Repo: {projects.find(p => p.id === currentProjectId)?.name}
          </span>
        </div>

        <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 px-3 py-1 rounded-xl">
          <div className="flex flex-col text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">Supercharge Engine</span>
            <span className="text-[9px] font-mono text-slate-500">
              {cooldownEndTime ? `Cooldown: ${secondsLeft}s` : `Tokens: ${10 - superchargeUses}/10 Left`}
            </span>
          </div>
          <button
            onClick={() => !cooldownEndTime && setIsSupercharged(!isSupercharged)} disabled={!!cooldownEndTime}
            className={`p-1.5 rounded-lg border transition-all ${
              cooldownEndTime ? 'bg-slate-950 border-slate-800 text-slate-700 cursor-not-allowed' : isSupercharged ? 'bg-amber-500/20 border-amber-500 text-amber-400' : 'bg-slate-950 border-slate-800 text-slate-500'
            }`}
          >
            <Zap size={14} className={isSupercharged ? "fill-amber-400 text-amber-400 animate-pulse" : ""} />
          </button>
        </div>
      </header>

      <main className="flex flex-1 w-full overflow-hidden relative min-h-0">
        {/* EXPLORER TREE VIEW PANEL */}
        <section style={{ width: `${leftWidth}px` }} className="border-r border-slate-800/80 bg-slate-900/20 flex flex-col h-full shrink-0 overflow-hidden">
          <div className="p-3 border-b border-slate-800/60 bg-slate-900/40 flex items-center justify-between shrink-0">
            <span className="text-xs font-bold tracking-wider uppercase text-slate-400">Filesystem</span>
            <button onClick={() => setShowNewFileInput(!showNewFileInput)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"><Plus size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            {showNewFileInput && (
              <form onSubmit={handleCreateFile} className="mb-2">
                <input type="text" autoFocus placeholder="filename.html..." value={newFileName} onChange={e => setNewFileName(e.target.value)} onBlur={() => setTimeout(() => setShowNewFileInput(false), 200)} className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs outline-none font-mono text-slate-200" />
              </form>
            )}
            {files.map(file => (
              <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group text-xs font-mono border ${file.id === activeFileId ? 'bg-indigo-600/15 border-indigo-500/20 text-slate-100' : 'text-slate-400 hover:bg-slate-900/40'}`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <div onClick={(e) => { e.stopPropagation(); selectedContextIds.includes(file.id) ? setSelectedContextIds(selectedContextIds.filter(id => id !== file.id)) : setSelectedContextIds([...selectedContextIds, file.id]) }} className="text-slate-500 hover:text-indigo-400 p-0.5">
                    {selectedContextIds.includes(file.id) ? <CheckSquare size={13} className="text-indigo-500" /> : <Square size={13} />}
                  </div>
                  <FileCode size={13} className="shrink-0" />
                  <span className="truncate">{file.name}</span>
                </div>
                <X size={11} className="opacity-0 group-hover:opacity-100 hover:text-red-400" onClick={e => handleCloseFile(file.id, e)} />
              </div>
            ))}
          </div>
        </section>

        <div className="w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 z-20 shrink-0" onMouseDown={() => { isResizingLeft.current = true; }} />

        {/* INTEGRATED CODE EDITOR */}
        <section style={{ width: `${centerWidth}px` }} className="flex flex-col bg-slate-950 h-full border-r border-slate-800/80 shrink-0 overflow-hidden">
          <div className="bg-slate-900/40 h-9 border-b border-slate-800/60 flex items-center overflow-x-auto shrink-0 select-none">
            {files.map(file => (
              <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`h-full flex items-center gap-2 px-4 text-xs font-mono border-r border-slate-800/60 cursor-pointer ${file.id === activeFileId ? 'bg-slate-950 border-t-2 border-t-indigo-500 text-slate-100' : 'text-slate-500'}`}>
                <span>{file.name}</span>
                <X size={10} className="hover:text-red-400" onClick={e => handleCloseFile(file.id, e)} />
              </div>
            ))}
          </div>
          <div className="flex-1 w-full overflow-hidden bg-[#1e1e1e]">
            {files.length > 0 && currentActiveFile && (
              <Editor height="100%" language={currentActiveFile.language} theme="vs-dark" value={currentActiveFile.content} onChange={handleEditorChange} options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, wordWrap: "on" }} />
            )}
          </div>
        </section>

        <div className="w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 z-20 shrink-0" onMouseDown={() => { isResizingCenter.current = true; }} />

        {/* SANDBOX SANDBOX PREVIEW */}
        <section className="flex-1 flex flex-col bg-slate-900 h-full overflow-hidden min-w-[200px]">
          <div className="bg-slate-900/40 h-9 px-4 border-b border-slate-800/60 flex items-center justify-between shrink-0"><span className="text-xs font-semibold text-slate-400">Sandbox Preview Engine</span></div>
          <div className="flex-1 w-full bg-white relative">
            <iframe title="Live View" srcDoc={getBundledPreviewCode()} sandbox="allow-scripts" className="absolute inset-0 w-full h-full border-none" />
          </div>
        </section>
      </main>

      <div className="h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-indigo-500/40 z-20 border-t border-slate-800/50" onMouseDown={() => { isResizingFooter.current = true; }} />

      {/* FOOTER INTERACTION AGENT CONSOLE */}
      <footer style={{ height: `${footerHeight}px` }} className="border-t border-slate-800 bg-slate-900/40 backdrop-blur-md p-4 flex gap-4 shrink-0 z-10 overflow-hidden">
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className="flex items-center gap-1.5 mb-1.5 text-slate-400"><Sparkles size={13} className={isAiLoading ? "animate-spin text-indigo-400" : ""} /><span className="text-[11px] font-bold uppercase tracking-wider">Prompt Terminal</span></div>
          <form onSubmit={handleAgenticVibeSubmit} className="flex-1 flex items-stretch gap-2 bg-slate-950 border border-slate-800 rounded-xl p-2 focus-within:border-indigo-500/60 transition-all">
            <textarea value={promptInput} onChange={e => setPromptInput(e.target.value)} disabled={isAiLoading} placeholder={cooldownEndTime ? "Supercharge mode re-calibrating..." : "Instruct the file agent ecosystem to execute actions..."} className="flex-1 bg-transparent border-none text-xs text-slate-100 focus:outline-none resize-none p-1 custom-scrollbar leading-relaxed" />
            <button type="submit" disabled={isAiLoading || !promptInput.trim()} className="self-end flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition">Vibe <ChevronRight size={12} /></button>
          </form>
        </div>

        <div className="w-1/2 flex flex-col min-w-[250px] border-l border-slate-800/80 pl-4 h-full">
          <div className="flex items-center justify-between mb-1.5 text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5"><Terminal size={13} /><span className="text-[11px] font-bold uppercase tracking-wider">Console Pipeline</span></div>
            {lastModelUsed && <span className="text-[9px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-1.5 py-0.5 rounded-md">{lastModelUsed}</span>}
          </div>
          <div className="flex-1 bg-slate-950 border border-slate-800/60 rounded-xl p-3 font-mono text-[11px] text-slate-400 overflow-y-auto custom-scrollbar flex flex-col gap-1">
            {consoleLogs.map((log, idx) => {
              let clr = "text-slate-400";
              if (log.startsWith('SUCCESS:')) clr = "text-emerald-400";
              if (log.startsWith('CRITICAL:')) clr = "text-rose-400 font-bold";
              if (log.startsWith('PROMPT:')) clr = "text-indigo-400 italic";
              return <div key={idx} className={`${clr} break-all whitespace-pre-wrap`}>&gt; {log}</div>;
            })}
            <div ref={consoleBottomRef} />
          </div>
        </div>
      </footer>
    </div>
  );
}