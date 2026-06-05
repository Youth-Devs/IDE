'use client';

import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Sparkles, ChevronRight, FileCode, Plus, X, Terminal, CheckSquare, Square, Zap, LogOut, Folder, ArrowLeft, LogIn, Sun, Moon, Users, UserPlus } from 'lucide-react';

// Firebase Connectors
import { auth, db, googleProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from '../utils/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, addDoc, getDocs, query, where, updateDoc, setDoc, onSnapshot, serverTimestamp, getCountFromServer, arrayUnion } from 'firebase/firestore';

const Editor = dynamic(() => import('@monaco-editor/react'), { ssr: false });

export default function App() {
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
  const [dashboardError, setDashboardError] = useState(''); // 🚀 Added to catch and display database permission errors
  
  // Teammate Invitation Input State
  const [teammateEmailInput, setTeammateEmailInput] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');

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

  // Theme State
  const [theme, setTheme] = useState('dark');

  // Registered Users Global Statistics
  const [totalUsers, setTotalUsers] = useState(0);

  // Layout & Console Utilities
  const [promptInput, setPromptInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [consoleLogs, setConsoleLogs] = useState([
    'SYSTEM: YouthDevs Workspace Real-Time Team Layer Online.'
  ]);

  const [leftWidth, setLeftWidth] = useState(240); 
  const [centerWidth, setCenterWidth] = useState(600); 
  const [footerHeight, setFooterHeight] = useState(180); 

  const isResizingLeft = useRef(false);
  const isResizingCenter = useRef(false);
  const isResizingFooter = useRef(false);
  const consoleBottomRef = useRef(null);

  const currentActiveFile = files.find(f => f.id === activeFileId) || files[0];
  const activeProjectData = projects.find(p => p.id === currentProjectId);

  // Theme Initialization Layer
  useEffect(() => {
    const savedTheme = localStorage.getItem('ide-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ide-theme', nextTheme);
  };

  // Auth Listener Connection Hook
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
      if (!currentUser) {
        setCurrentProjectId(null);
        setProjects([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch User Projects via Collaborative Team Membership Arrays
  useEffect(() => {
    if (!user) return;

    const userProfileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userProfileRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSuperchargeUses(data.superchargeUses || 0);
        setCooldownEndTime(data.cooldownEndTime || null);
      } else {
        try {
          await setDoc(userProfileRef, { email: user.email, superchargeUses: 0, cooldownEndTime: null }, { merge: true });
        } catch (err) {
          console.error("Failed to initialize user document:", err);
        }
      }
      fetchTotalUsersCount();
    });

    // TEAM ACCOMMODATION: Query all projects where user.uid is contained inside memberUids array
    const q = query(collection(db, 'projects'), where('memberUids', 'array-contains', user.uid));
    const unsubProjects = onSnapshot(q, (snapshot) => {
      const projs = [];
      snapshot.forEach(doc => projs.push({ id: doc.id, ...doc.data() }));
      setProjects(projs);
    });

    fetchTotalUsersCount();

    return () => {
      unsubProfile();
      unsubProjects();
    };
  }, [user]);

  // Sync Live Workspace Presence Matrix 
  useEffect(() => {
    if (!currentProjectId || !user || !activeFileId) return;

    const projectRef = doc(db, 'projects', currentProjectId);
    const dynamicPresenceKey = `presence.${activeFileId}`;
    const userHandle = user.email ? user.email.split('@')[0] : 'anonymous';

    // Mark current user as active editor of this specific file index
    updateDoc(projectRef, {
      [dynamicPresenceKey]: userHandle
    }).catch(err => console.error("Presence sync failed:", err));

    return () => {
      // Clear presence markers when navigating away or switching files
      updateDoc(projectRef, {
        [dynamicPresenceKey]: null
      }).catch(() => {});
    };
  }, [activeFileId, currentProjectId, user]);

  // Real-Time Active File Array Sync Node
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

  // Query Total Users Count
  const fetchTotalUsersCount = async () => {
    try {
      const coll = collection(db, 'users');
      const snapshot = await getCountFromServer(coll);
      setTotalUsers(snapshot.data().count ?? 0);
    } catch (err) {
      console.warn("Firestore list rules blocked counting users. Falling back gracefully. Error:", err.message);
      setTotalUsers(1); 
    }
  };

  // Cooldown countdown tracking routine
  useEffect(() => {
    if (!cooldownEndTime) return;
    const interval = setInterval(async () => {
      const distance = cooldownEndTime - Date.now();
      if (distance <= 0) {
        setCooldownEndTime(null);
        setSecondsLeft(0);
        setSuperchargeUses(0);
        if (user) {
          try {
            await setDoc(doc(db, 'users', user.uid), { superchargeUses: 0, cooldownEndTime: null }, { merge: true });
          } catch (err) {
            console.error("Failed to clear cooldown in database:", err);
          }
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

  // --- PROJECT SETUP FOR COLLABORATIVE TEAMS ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setDashboardError(''); // Clear old dashboard errors

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
    <p class="text-xs text-slate-400 mt-2">Workspace online. Happy hackathon coding!</p>
  </div>
</body>
</html>`
      }
    ];

    try {
      await addDoc(collection(db, 'projects'), {
        name: newProjectName.trim(),
        userId: user.uid, // 🚀 KEY COMPATIBILITY ANCHOR: Keeps old Firestore security rules working!
        memberUids: [user.uid], // Array tracking membership for up to 3 teammates
        memberEmails: [user.email || 'anonymous'], 
        presence: {},          // Live tracking map for workspaces files
        files: defaultFiles,
        createdAt: serverTimestamp()
      });
      setNewProjectName('');
    } catch (err) {
      console.error(err);
      setDashboardError(err.message || 'Permission denied. Make sure your Firestore rules match your project schema!');
    }
  };

  // --- ADD TEAMMATE PIPELINE RUNNER ---
  const handleAddTeammateSubmit = async (e) => {
    e.preventDefault();
    setInviteStatus('');
    const targetEmail = teammateEmailInput.trim().toLowerCase();
    const userEmailSafe = user.email ? user.email.toLowerCase() : '';
    
    if (!targetEmail || !currentProjectId) return;
    if (targetEmail === userEmailSafe) {
      setInviteStatus('You are already the project owner.');
      return;
    }
    if (activeProjectData?.memberEmails?.map(m => m.toLowerCase()).includes(targetEmail)) {
      setInviteStatus('User is already added to this project.');
      return;
    }
    if (activeProjectData?.memberUids?.length >= 3) {
      setInviteStatus('Team capacity full! Maximum 3 developers per project container.');
      return;
    }

    try {
      // Find the teammate's user profile by querying their registered email address
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', targetEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setInviteStatus('Teammate profile not found. Have them sign in to YouthDevs once first!');
        return;
      }

      const teammateDoc = querySnapshot.docs[0];
      const teammateUid = teammateDoc.id;

      // Add the teammate's information to the project document
      const projectRef = doc(db, 'projects', currentProjectId);
      await updateDoc(projectRef, {
        memberUids: arrayUnion(teammateUid),
        memberEmails: arrayUnion(targetEmail)
      });

      setInviteStatus('Teammate synced successfully!');
      setTeammateEmailInput('');
    } catch (err) {
      console.error(err);
      setInviteStatus('Error appending team credentials.');
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

        // Token metric tracking updates
        if (isSupercharged) {
          const nextCount = superchargeUses + 1;
          const userRef = doc(db, 'users', user.uid);
          
          setSuperchargeUses(nextCount);

          if (nextCount >= 10) {
            const cooldownTime = Date.now() + 10 * 60 * 1000;
            await setDoc(userRef, { superchargeUses: nextCount, cooldownEndTime: cooldownTime }, { merge: true });
            setIsSupercharged(false);
          } else {
            await setDoc(userRef, { superchargeUses: nextCount }, { merge: true });
          }
        }
      } else {
        setConsoleLogs(prev => [...prev, `CRITICAL: Compilation failed. ${data.error || 'Check server configuration structure.'}`]);
      }
    } catch (err) {
      keepStreaming.current = false; clearInterval(streamId);
      setConsoleLogs(prev => [...prev, 'CRITICAL: Engine compilation network failure.']);
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  if (authLoading) {
    return (
      <div className={`h-screen w-screen flex flex-col gap-4 items-center justify-center font-mono text-xs ${theme === 'dark' ? 'bg-slate-950 text-indigo-400' : 'bg-slate-100 text-indigo-600'}`}>
        <div className="h-6 w-6 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full"></div>
        CONNECTING TO YOUTHDEVS KERNEL...
      </div>
    );
  }

  // --- RENDER 1: SIGN IN / SIGN UP SCREEN PANEL ---
  if (!user) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center p-4 transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>
        <div className={`w-full max-w-sm border p-6 rounded-2xl shadow-2xl transition-all ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-lg">Y</div>
            
            <button 
              onClick={toggleTheme} 
              className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'border-slate-800 text-amber-400 hover:bg-slate-850' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              title="Toggle system theme"
            >
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </button>
          </div>
          <h2 className={`text-xl font-bold tracking-tight ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>{isSignUp ? 'Create Workspace Account' : 'Sign In to Vibe Workspace'}</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">Enter credentials or connect using your Google parameters.</p>
          
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' : 'bg-slate-100 border-slate-300 focus:border-indigo-500 text-slate-850'}`} 
            />
            <input 
              type="password" 
              placeholder="Account Security Key" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' : 'bg-slate-100 border-slate-300 focus:border-indigo-500 text-slate-850'}`} 
            />
            {authError && <p className="text-[11px] text-red-400 font-mono">{authError}</p>}
            
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg transition mt-1 shadow-md shadow-indigo-600/10">
              {isSignUp ? 'Initialize Profile' : 'Access Workspace'}
            </button>
          </form>

          <div className={`relative flex py-4 items-center font-mono text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
            <div className={`flex-grow border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}></div>
            <span className="mx-2 shrink-0">OR</span>
            <div className={`flex-grow border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}></div>
          </div>

          <button onClick={handleGoogleSignIn} className={`w-full border text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-300 hover:bg-slate-900' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'}`}>
            <LogIn size={14} /> Continue with Google
          </button>

          <p className="text-center text-xs text-slate-500 mt-4">
            {isSignUp ? 'Already have an account?' : 'Need a cloud development profile?'} 
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-indigo-500 font-semibold ml-1 hover:underline">{isSignUp ? 'Log In' : 'Sign Up'}</button>
          </p>
        </div>
      </div>
    );
  }

  // --- RENDER 2: DASHBOARD VIEW PANEL ---
  if (!currentProjectId) {
    return (
      <div className={`h-screen w-screen flex flex-col font-sans transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
        <header className={`h-14 border-b px-6 flex items-center justify-between transition-colors ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 bg-indigo-600 rounded-md flex items-center justify-center font-black text-sm text-white">Y</div>
            <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>YouthDevs Central Hub</span>
          </div>
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${theme === 'dark' ? 'bg-indigo-950/30 border-indigo-900/40 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
              <Users size={12} />
              <span>IDE Users: <b className="font-mono font-bold">{totalUsers !== undefined && totalUsers !== null ? totalUsers : '...'}</b></span>
            </div>

            <button 
              onClick={toggleTheme} 
              className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'border-slate-800 text-amber-400 hover:bg-slate-850' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
              title="Toggle system theme"
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <span className="text-xs text-slate-500 font-mono hidden sm:inline">{user.email}</span>
            <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 transition flex items-center gap-1 text-xs">
              <LogOut size={13} /> Exit
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 overflow-y-auto">
          <div className={`border p-6 rounded-2xl mb-8 transition-colors ${theme === 'dark' ? 'bg-gradient-to-r from-indigo-950/40 to-slate-900 border-slate-800/80' : 'bg-gradient-to-r from-indigo-50/50 to-white border-slate-200'}`}>
            <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Welcome Back to Hackathon Core</h2>
            <p className={`text-xs mt-1 max-w-lg ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Build collaborative multi-file web applications natively with your team of up to 3 members. Each user maintains their individual personal AI prompt limit.</p>
            
            <form onSubmit={handleCreateProject} className="mt-4 flex gap-2 max-w-md">
              <input 
                type="text" 
                placeholder="New project or repository name..." 
                value={newProjectName} 
                onChange={e => setNewProjectName(e.target.value)} 
                required 
                className={`flex-1 border text-xs px-3 py-2 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-800'}`} 
              />
              <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition shadow-lg shadow-indigo-600/10 shrink-0">
                <Plus size={14} /> Create Repo
              </button>
            </form>

            {/* 🚀 Dashboard Error Panel displaying Firestore Permission issues beautifully */}
            {dashboardError && (
              <p className="text-xs text-rose-400 font-mono mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg animate-shake">
                ⚠️ {dashboardError}
              </p>
            )}
          </div>

          <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Shared Team Repositories</h3>
          {projects.length === 0 ? (
            <div className={`text-center py-12 border border-dashed rounded-xl text-xs font-mono ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-slate-300 text-slate-400'}`}>No active projects found. Type a title above to spawn your team repository.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {projects.map(proj => (
                <div key={proj.id} onClick={() => { setCurrentProjectId(proj.id); setFiles([]); setActiveFileId(''); setInviteStatus(''); }} className={`p-4 border rounded-xl cursor-pointer transition-all group ${theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-indigo-500/40 text-slate-300' : 'bg-white border-slate-200 hover:border-indigo-500/45 text-slate-700 shadow-sm hover:shadow'}`}>
                  <div className="flex items-center justify-between font-bold text-sm group-hover:text-indigo-500 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <Folder size={16} className="text-indigo-500" />
                      {proj.name}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded">
                      <Users size={10} />
                      <span>{proj.memberUids?.length || 1}/3</span>
                    </div>
                  </div>
                  <div className={`flex justify-between items-center mt-4 text-[10px] font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>
                    <span className="truncate max-w-[150px]">Members: {proj.memberEmails?.map(m => m.split('@')[0]).join(', ')}</span>
                    <span className="text-indigo-500 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">Open Workspace <ChevronRight size={10} /></span>
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
    <div className={`flex flex-col h-screen w-screen font-sans overflow-hidden select-none transition-colors duration-200 ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-100 text-slate-800'}`}>
      
      {/* HEADER SECTION */}
      <header className={`flex h-14 items-center justify-between px-4 border-b z-10 shrink-0 transition-colors ${theme === 'dark' ? 'border-slate-800 bg-slate-900/60 backdrop-blur-md' : 'border-slate-200 bg-white/95'}`}>
        <div className="flex items-center gap-3 max-w-[40%]">
          <button onClick={() => setCurrentProjectId(null)} className={`p-1.5 rounded-lg transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-850'}`} title="Return to Dashboard">
            <ArrowLeft size={14} />
          </button>
          <div className={`h-5 w-px ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <span className="font-bold text-xs tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent uppercase font-mono truncate">
            {activeProjectData?.name}
          </span>
          
          {/* Active Members In This Workspace Repo */}
          <div className={`hidden md:flex items-center gap-1 text-[10px] text-slate-400 px-2 py-0.5 rounded font-mono border ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/50 border-slate-300'}`}>
            <span>Team: {activeProjectData?.memberEmails?.map(m => m.split('@')[0]).join(', ')}</span>
          </div>
        </div>

        {/* TEAM ACCOMMODATION: Add Teammate Overlay Feature */}
        <div className="flex items-center gap-3">
          <form onSubmit={handleAddTeammateSubmit} className="hidden lg:flex items-center gap-1 border rounded-lg p-1 text-xs bg-slate-950/30 border-slate-800/80">
            <input 
              type="email" 
              placeholder="Teammate's Email..." 
              value={teammateEmailInput} 
              onChange={e => setTeammateEmailInput(e.target.value)} 
              className="bg-transparent px-2 py-0.5 text-[11px] outline-none border-none font-mono text-slate-300 w-36"
            />
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white p-1 rounded transition flex items-center justify-center" title="Invite Teammate">
              <UserPlus size={12} />
            </button>
          </form>
          {inviteStatus && (
            <span className="hidden lg:inline text-[9px] font-mono text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded max-w-[120px] truncate">
              {inviteStatus}
            </span>
          )}

          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-lg border transition-all ${theme === 'dark' ? 'border-slate-800 text-amber-400 hover:bg-slate-800' : 'border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            title="Toggle system theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Supercharge Status */}
          <div className={`flex items-center gap-3 border px-3 py-1 rounded-xl transition-colors ${theme === 'dark' ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex flex-col text-right">
              <span className="text-[10px] font-bold uppercase tracking-tight">Supercharge</span>
              <span className="text-[9px] font-mono text-slate-500">
                {cooldownEndTime ? `Lock: ${formatTime(secondsLeft)}` : `Left: ${10 - superchargeUses}/10`}
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
        </div>
      </header>

      <main className="flex flex-1 w-full overflow-hidden relative min-h-0">
        
        {/* EXPLORER TREE VIEW PANEL WITH LIVE PRESENCE BADGES */}
        <section style={{ width: `${leftWidth}px` }} className={`border-r flex flex-col h-full shrink-0 overflow-hidden transition-colors ${theme === 'dark' ? 'border-slate-800/80 bg-slate-900/20' : 'border-slate-200 bg-slate-50'}`}>
          <div className={`p-3 border-b flex items-center justify-between shrink-0 transition-colors ${theme === 'dark' ? 'border-slate-800/60 bg-slate-900/40 text-slate-400' : 'border-slate-200 bg-slate-200/45 text-slate-600'}`}>
            <span className="text-xs font-bold tracking-wider uppercase">Filesystem</span>
            <button onClick={() => setShowNewFileInput(!showNewFileInput)} className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-850'}`}><Plus size={14} /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            {showNewFileInput && (
              <form onSubmit={handleCreateFile} className="mb-2">
                <input type="text" autoFocus placeholder="filename.html..." value={newFileName} onChange={e => setNewFileName(e.target.value)} onBlur={() => setTimeout(() => setShowNewFileInput(false), 200)} className={`w-full border rounded px-2 py-1 text-xs outline-none font-mono ${theme === 'dark' ? 'bg-slate-950 border-indigo-500 text-slate-200' : 'bg-white border-indigo-500 text-slate-800'}`} />
              </form>
            )}
            {files.map(file => {
              const isActive = file.id === activeFileId;
              
              // Presence detection lookups
              const currentFileViewer = activeProjectData?.presence?.[file.id];
              const isTeammateActiveHere = currentFileViewer && currentFileViewer !== (user.email ? user.email.split('@')[0] : 'anonymous');

              return (
                <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group text-xs font-mono border transition-all ${
                  isActive 
                    ? theme === 'dark' ? 'bg-indigo-600/15 border-indigo-500/20 text-slate-100 font-semibold' : 'bg-indigo-50 border-indigo-200 text-indigo-600 font-semibold'
                    : theme === 'dark' ? 'text-slate-400 hover:bg-slate-900/40 border-transparent' : 'text-slate-600 hover:bg-slate-200/50 border-transparent'
                }`}>
                  <div className="flex items-center gap-2 overflow-hidden flex-1 mr-1">
                    <div onClick={(e) => { e.stopPropagation(); selectedContextIds.includes(file.id) ? setSelectedContextIds(selectedContextIds.filter(id => id !== file.id)) : setSelectedContextIds([...selectedContextIds, file.id]) }} className={`hover:text-indigo-500 transition-colors p-0.5 ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
                      {selectedContextIds.includes(file.id) ? <CheckSquare size={13} className="text-indigo-500" /> : <Square size={13} />}
                    </div>
                    <FileCode size={13} className="shrink-0" />
                    <span className="truncate">{file.name}</span>
                  </div>
                  
                  {/* Real-time Team Member Edit Badge */}
                  {isTeammateActiveHere && (
                    <span className="text-[8px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1 rounded scale-90 tracking-tighter uppercase shrink-0 animate-pulse">
                      {currentFileViewer}
                    </span>
                  )}
                  <X size={11} className={`opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0 ml-1`} onClick={e => handleCloseFile(file.id, e)} />
                </div>
              );
            })}
          </div>
        </section>

        {/* DRAG HANDLER 1 */}
        <div className={`w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 transition-colors z-20 shrink-0`} onMouseDown={() => { isResizingLeft.current = true; }} />

        {/* CODE EDITOR WINDOW */}
        <section style={{ width: `${centerWidth}px` }} className={`flex flex-col h-full shrink-0 overflow-hidden border-r transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800/80' : 'bg-white border-slate-200'}`}>
          <div className={`h-9 border-b flex items-center overflow-x-auto shrink-0 select-none transition-colors ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'}`}>
            {files.map(file => {
              const isActive = file.id === activeFileId;
              return (
                <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`h-full flex items-center gap-2 px-4 text-xs font-mono border-r cursor-pointer transition-all ${
                  isActive 
                    ? theme === 'dark' ? 'bg-slate-950 border-t-2 border-t-indigo-500 text-slate-100 border-r-slate-800/60' : 'bg-white border-t-2 border-t-indigo-500 text-slate-800 border-r-slate-200'
                    : theme === 'dark' ? 'bg-slate-900/20 text-slate-500 border-r-slate-800/60' : 'bg-slate-100/50 text-slate-500 border-r-slate-200'
                }`}>
                  <span>{file.name}</span>
                  <X size={10} className="hover:text-red-500 transition-colors" onClick={e => handleCloseFile(file.id, e)} />
                </div>
              );
            })}
          </div>
          <div className="flex-1 w-full overflow-hidden bg-[#1e1e1e]">
            {files.length > 0 && currentActiveFile && (
              <Editor 
                height="100%" 
                language={currentActiveFile.language} 
                theme={theme === 'dark' ? "vs-dark" : "light"} 
                value={currentActiveFile.content} 
                onChange={handleEditorChange} 
                options={{ minimap: { enabled: false }, fontSize: 14, automaticLayout: true, wordWrap: "on" }} 
              />
            )}
          </div>
        </section>

        {/* DRAG HANDLER 2 */}
        <div className={`w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 transition-colors z-20 shrink-0`} onMouseDown={() => { isResizingCenter.current = true; }} />

        {/* LIVE SANDBOX PREVIEW */}
        <section className={`flex-1 flex flex-col h-full overflow-hidden min-w-[200px] transition-colors ${theme === 'dark' ? 'bg-slate-900' : 'bg-slate-50'}`}>
          <div className={`h-9 px-4 border-b flex items-center justify-between shrink-0 transition-colors ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/60 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            <span className="text-xs font-semibold">Sandbox Preview Engine</span>
          </div>
          <div className="flex-1 w-full bg-white relative">
            <iframe title="Live View" srcDoc={getBundledPreviewCode()} sandbox="allow-scripts" className="absolute inset-0 w-full h-full border-none" />
          </div>
        </section>
      </main>

      {/* DRAG HANDLER 3 */}
      <div className={`h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-indigo-500/40 transition-colors z-20 border-t ${theme === 'dark' ? 'border-slate-800/50' : 'border-slate-200/50'}`} onMouseDown={() => { isResizingFooter.current = true; }} />

      {/* FOOTER INTERACT CONSOLE */}
      <footer style={{ height: `${footerHeight}px` }} className={`border-t p-4 flex gap-4 shrink-0 z-10 overflow-hidden transition-colors ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40 backdrop-blur-md' : 'border-slate-200 bg-white'}`}>
        <div className="flex-1 flex flex-col min-w-0 h-full">
          <div className={`flex items-center gap-1.5 mb-1.5 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            <Sparkles size={13} className={isAiLoading ? "animate-spin text-indigo-400" : ""} />
            <span className="text-[11px] font-bold uppercase tracking-wider">Prompt Terminal</span>
          </div>
          <form onSubmit={handleAgenticVibeSubmit} className={`flex-1 flex items-stretch gap-2 border rounded-xl p-2 transition-all ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus-within:border-indigo-500/60' : 'bg-slate-50 border-slate-200 focus-within:border-indigo-500/70'}`}>
            <textarea value={promptInput} onChange={e => setPromptInput(e.target.value)} disabled={isAiLoading} placeholder={cooldownEndTime ? "Supercharge mode re-calibrating..." : "Instruct the file agent ecosystem to execute actions..."} className={`flex-1 bg-transparent border-none text-xs focus:outline-none resize-none p-1 custom-scrollbar leading-relaxed ${theme === 'dark' ? 'text-slate-100 placeholder-slate-500' : 'text-slate-800 placeholder-slate-400'}`} />
            <button type="submit" disabled={isAiLoading || !promptInput.trim()} className="self-end flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition shrink-0 shadow-lg shadow-indigo-600/10">Vibe <ChevronRight size={12} /></button>
          </form>
        </div>

        <div className={`w-1/2 flex flex-col min-w-[250px] border-l pl-4 h-full ${theme === 'dark' ? 'border-slate-800/80' : 'border-slate-200'}`}>
          <div className={`flex items-center justify-between mb-1.5 shrink-0 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
            <div className="flex items-center gap-1.5"><Terminal size={13} /><span className="text-[11px] font-bold uppercase tracking-wider">Console Pipeline</span></div>
            {lastModelUsed && <span className="text-[9px] font-mono font-bold bg-indigo-950 text-indigo-400 border border-indigo-800/50 px-1.5 py-0.5 rounded-md">{lastModelUsed}</span>}
          </div>
          <div className={`flex-1 border rounded-xl p-3 font-mono text-[11px] overflow-y-auto custom-scrollbar flex flex-col gap-1 shadow-inner ${theme === 'dark' ? 'bg-slate-950 border-slate-800/60 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'}`}>
            {consoleLogs.map((log, idx) => {
              let clr = theme === 'dark' ? "text-slate-400" : "text-slate-600";
              if (log.startsWith('SUCCESS:')) clr = "text-emerald-500 font-medium";
              if (log.startsWith('CRITICAL:')) clr = "text-rose-500 font-bold";
              if (log.startsWith('PROMPT:')) clr = "text-indigo-500 italic";
              return <div key={idx} className={`${clr} break-all whitespace-pre-wrap`}>&gt; {log}</div>;
            })}
            <div ref={consoleBottomRef} />
          </div>
        </div>
      </footer>
    </div>
  );
}