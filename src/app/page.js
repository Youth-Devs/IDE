'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, ChevronRight, FileCode, Plus, X, Terminal, CheckSquare, Square, Zap, LogOut, Folder, ArrowLeft, LogIn, Sun, Moon, Users, UserPlus, Save, Github } from 'lucide-react';

// Firebase Connectors
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, signInWithPopup, GoogleAuthProvider, GithubAuthProvider, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, getDocs, query, where, updateDoc, setDoc, onSnapshot, serverTimestamp, getCountFromServer, arrayUnion } from 'firebase/firestore';

// Safe environment variable initialization with mock fallbacks to prevent runtime compilation crashes
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_MEASUREMENT_ID
};

let app = null;
let auth = null;
let db = null;
let googleProvider = null;

// Gracefully instantiate Firebase services so missing environment variables do not block the page load
try {
  if (firebaseConfig && firebaseConfig.apiKey && firebaseConfig.apiKey !== "placeholder-api-key-for-local-vibe") {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
    googleProvider = new GoogleAuthProvider();
  }
} catch (error) {
  console.warn("Firebase initialization skipped or failed. Falling back to local offline mode.", error);
}

// Helper to decode Base64 safe for UTF-8 unicode content
const decodeBase64Utf8 = (str) => {
  try {
    return decodeURIComponent(atob(str).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
  } catch (e) {
    try {
      return atob(str);
    } catch (err) {
      return '';
    }
  }
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState('');

  // GitHub Integration States
  const [githubToken, setGithubToken] = useState(null);
  const [githubUser, setGithubUser] = useState(null);
  const [useGithubForNewProject, setUseGithubForNewProject] = useState(false);

  // Dashboard vs IDE View state
  const [currentProjectId, setCurrentProjectId] = useState(null); 
  const [projects, setProjects] = useState([]);
  const [newProjectName, setNewProjectName] = useState('');
  const [dashboardError, setDashboardError] = useState(''); 
  
  // PROJECT CREATION LOADING STATUS
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectStatusMessage, setProjectStatusMessage] = useState('');

  // Teammate Invitation Input State
  const [teammateEmailInput, setTeammateEmailInput] = useState('');
  const [inviteStatus, setInviteStatus] = useState('');

  // Core IDE Project States
  const [files, setFiles] = useState([]);
  const [activeFileId, setActiveFileId] = useState('');
  const [newFileName, setNewFileName] = useState('');
  const [showNewFileInput, setShowNewFileInput] = useState(false);
  const [selectedContextIds, setSelectedContextIds] = useState([]);

  // Supercharge Rate Limiter State
  const [isSupercharged, setIsSupercharged] = useState(false);
  const [superchargeUses, setSuperchargeUses] = useState(0);
  const [cooldownEndTime, setCooldownEndTime] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [lastModelUsed, setLastModelUsed] = useState(null);

  // Theme State
  const [theme, setTheme] = useState('dark');

  // Registered Users Global Statistics
  const [totalUsers, setTotalUsers] = useState(0);

  // TEAM CHANGE POP-UP MODAL STATE
  const [showChangeModal, setShowChangeModal] = useState(false);
  const [changeNameInput, setChangeNameInput] = useState('');
  const [pendingFilesToSync, setPendingFilesToSync] = useState(null);

  // Monaco Editor Dynamic Load Hook States
  const [monacoLoaded, setMonacoLoaded] = useState(false);
  const editorContainerRef = useRef(null);
  const editorInstanceRef = useRef(null);

  // KEEP TRACK OF CLEAN SYNCHRONIZED VERSION OF DB FILES TO PREVENT LOCAL OVERWRITING WHILE TYPING
  const lastSyncedFilesRef = useRef([]);

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

  // Detect if there are unsaved local modifications compared to the Firestore database
  const isDirty = activeProjectData && JSON.stringify(files) !== JSON.stringify(activeProjectData.files);

  // Robust content comparison utility to prevent file explorer desyncs
  const filesAreIdentical = (arr1, arr2) => {
    if (!arr1 || !arr2) return false;
    if (arr1.length !== arr2.length) return false;
    return arr1.every(f1 => {
      const f2 = arr2.find(f => f.name === f1.name);
      return f2 && f2.content === f1.content;
    });
  };

  // Theme Initialization Layer
  useEffect(() => {
    const savedTheme = localStorage.getItem('ide-theme');
    if (savedTheme) {
      setTheme(savedTheme);
    }
    
    // Retrieve GitHub Token parameter if persistent
    const savedGitToken = localStorage.getItem('github-token');
    if (savedGitToken) {
      setGithubToken(savedGitToken);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ide-theme', nextTheme);
  };

  // Reset synced file caches when leaving or switching projects
  useEffect(() => {
    if (!currentProjectId) {
      lastSyncedFilesRef.current = [];
    }
  }, [currentProjectId]);

  // Auth Listener Connection Hook with token support
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      // Initialize with mock offline dev user
      setUser({ uid: 'mock-user-123', email: 'offline-developer@youthdevs.me' });
      return;
    }

    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
        } catch (e) {
          await signInAnonymously(auth);
        }
      } else {
        try {
          await signInAnonymously(auth);
        } catch (e) {
          // Fallback to state-based auth
        }
      }
    };
    initAuth();

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
    if (!user || !db) {
      // Mock localized projects for offline testing when firebase config isn't supplied
      if (projects.length === 0) {
        setProjects([{
          id: 'local-demo-project',
          name: 'hackathon-demo-project',
          memberEmails: ['offline-developer@youthdevs.me'],
          memberUids: ['mock-user-123'],
          files: [
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
  <div class="text-center p-6 bg-slate-800 rounded-xl border border-indigo-500/20">
    <h1 class="text-2xl font-bold text-indigo-400">Offline Demonstration Project</h1>
    <p class="text-xs text-slate-400 mt-2 font-mono">Fill in your __firebase_config values to enable live cloud features!</p>
  </div>
</body>
</html>`
            }
          ]
        }]);
      }
      return;
    }

    const userProfileRef = doc(db, 'users', user.uid);
    const unsubProfile = onSnapshot(userProfileRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSuperchargeUses(data.superchargeUses || 0);
        setCooldownEndTime(data.cooldownEndTime || null);
      } else {
        try {
          await setDoc(userProfileRef, { email: user.email || 'anonymous@youthdevs.me', superchargeUses: 0, cooldownEndTime: null }, { merge: true });
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

  // Fetch GitHub User parameters when token is parsed
  useEffect(() => {
    if (!githubToken) {
      setGithubUser(null);
      return;
    }

    fetch('https://api.github.com/user', {
      headers: { Authorization: `token ${githubToken}` }
    })
      .then(res => {
        if (res.ok) return res.json();
        throw new Error('Unauthorized GitHub Token');
      })
      .then(data => {
        setGithubUser(data);
      })
      .catch(err => {
        console.error(err);
        localStorage.removeItem('github-token');
        setGithubToken(null);
      });
  }, [githubToken]);

  // Sync Live Workspace Presence Matrix 
  useEffect(() => {
    if (!currentProjectId || !user || !activeFileId || !db) return;

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

  // Real-Time Active File Array Sync Node (Optimized for instant teammate refreshes & GitHub file system sync)
  useEffect(() => {
    if (!user || !currentProjectId) return;

    // Handle local offline sync
    if (!db) {
      const activeProj = projects.find(p => p.id === currentProjectId);
      if (activeProj && files.length === 0) {
        setFiles(activeProj.files || []);
        if (activeProj.files && activeProj.files.length > 0) {
          setActiveFileId(activeProj.files[0].id);
          setSelectedContextIds(activeProj.files.map(f => f.id));
        }
      }
      return;
    }

    const projectRef = doc(db, 'projects', currentProjectId);
    const unsubProjectFiles = onSnapshot(projectRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const incomingFiles = data.files || [];
        
        // HYBRID LOAD SEQUENCE: If GitHub is active, we have a token, and Firestore is completely empty, lazy-load from GitHub once
        if (data.githubRepo && data.githubOwner && githubToken && incomingFiles.length === 0) {
          try {
            const branch = data.githubBranch || 'main';
            const res = await fetch(`https://api.github.com/repos/${data.githubOwner}/${data.githubRepo}/contents?ref=${branch}`, {
              headers: { Authorization: `token ${githubToken}` }
            });
            if (res.ok) {
              const contents = await res.json();
              const loadedFiles = await Promise.all(
                contents.filter(item => item.type === 'file').map(async (item) => {
                  // 🚀 INTUATIVE FIX: Fetch private files content from the JSON Contents API endpoint and decode locally
                  // This bypasses raw.githubusercontent.com redirection Authorization header stripping issues!
                  const rawRes = await fetch(`https://api.github.com/repos/${data.githubOwner}/${data.githubRepo}/contents/${item.path}?ref=${branch}`, {
                    headers: { 
                      Authorization: `token ${githubToken}`,
                      Accept: 'application/vnd.github.v3+json'
                    }
                  });
                  let rawContent = '';
                  if (rawRes.ok) {
                    const fileDetails = await rawRes.json();
                    rawContent = fileDetails.content ? decodeBase64Utf8(fileDetails.content.replace(/\s/g, '')) : '';
                  } else {
                    rawContent = 'Error loading content';
                  }
                  
                  let language = 'html';
                  if (item.name.endsWith('.css')) language = 'css';
                  if (item.name.endsWith('.js')) language = 'javascript';
                  return {
                    id: item.sha,
                    name: item.name,
                    language,
                    content: rawContent
                  };
                })
              );

              if (!filesAreIdentical(loadedFiles, lastSyncedFilesRef.current)) {
                setFiles(loadedFiles);
                lastSyncedFilesRef.current = loadedFiles;
                
                if (loadedFiles.length > 0 && (!activeFileId || !loadedFiles.some(f => f.id === activeFileId))) {
                  setActiveFileId(loadedFiles[0].id);
                  setSelectedContextIds(loadedFiles.map(f => f.id));
                }

                // Mirror the loaded files back to Firestore so teammates without GitHub access can see them immediately!
                await updateDoc(projectRef, { files: loadedFiles });
              }
            }
          } catch (err) {
            console.error("Failed to compile workspace files from GitHub repository:", err);
          }
        } else {
          // Standard Firestore files load sync (Our primary local fallback cache for everyone!)
          if (!filesAreIdentical(incomingFiles, lastSyncedFilesRef.current)) {
            setFiles(incomingFiles);
            lastSyncedFilesRef.current = incomingFiles;
            
            if (incomingFiles.length > 0 && (!activeFileId || !incomingFiles.some(f => f.id === activeFileId))) {
              setActiveFileId(incomingFiles[0].id);
              setSelectedContextIds(incomingFiles.map(f => f.id));
            }
          }
        }
      }
    });

    return () => unsubProjectFiles();
  }, [user, currentProjectId, activeFileId, githubToken, projects]);

  // RUNTIME MONACO EDITOR SCRIPT LOADER (Bypasses compile-time dependencies perfectly)
  useEffect(() => {
    if (window.monaco) {
      setMonacoLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/loader.min.js';
    script.async = true;
    script.onload = () => {
      window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        setMonacoLoaded(true);
      });
    };
    document.body.appendChild(script);
  }, []);

  // Update Monaco content and properties on file activation or model changes
  useEffect(() => {
    if (!monacoLoaded || !editorContainerRef.current || !currentActiveFile) return;

    if (editorInstanceRef.current) {
      editorInstanceRef.current.dispose();
    }

    editorInstanceRef.current = window.monaco.editor.create(editorContainerRef.current, {
      value: currentActiveFile.content,
      language: currentActiveFile.language === 'javascript' ? 'javascript' : currentActiveFile.language,
      theme: theme === 'dark' ? 'vs-dark' : 'vs',
      minimap: { enabled: false },
      fontSize: 14,
      automaticLayout: true,
      wordWrap: 'on'
    });

    const changeListener = editorInstanceRef.current.onDidChangeModelContent(() => {
      const val = editorInstanceRef.current.getValue();
      handleEditorChange(val);
    });

    return () => {
      if (changeListener) changeListener.dispose();
      if (editorInstanceRef.current) {
        editorInstanceRef.current.dispose();
      }
    };
  }, [monacoLoaded, activeFileId, theme]);

  // Query Total Users Count
  const fetchTotalUsersCount = async () => {
    if (!db) return;
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
        if (user && db) {
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
    if (!auth) {
      setAuthError('Authentication Service is offline. Please supply Firebase credentials.');
      return;
    }
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
    if (!auth) {
      setAuthError('Authentication Service is offline.');
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // GITHUB DIRECT WORKSPACE OAUTH SIGN-IN
  const handleGithubSignIn = async () => {
    setAuthError('');
    if (!auth) {
      setAuthError('Authentication Service is offline.');
      return;
    }
    try {
      const provider = new GithubAuthProvider();
      provider.addScope('repo'); // Requests write credentials for collaborative code storage
      const result = await signInWithPopup(auth, provider);
      const credential = GithubAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;
      if (token) {
        localStorage.setItem('github-token', token);
        setGithubToken(token);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  // --- PROJECT SETUP FOR COLLABORATIVE TEAMS AND GITHUB STORAGE REPOS ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setDashboardError(''); 
    
    // Offline creation guard
    if (!db) {
      const newLocalId = `project-${Date.now()}`;
      const newLocalProj = {
        id: newLocalId,
        name: newProjectName.trim(),
        memberEmails: ['offline-developer@youthdevs.me'],
        memberUids: ['mock-user-123'],
        files: [
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
    <p class="text-xs text-slate-400 mt-2 font-mono">Local development mode is online.</p>
  </div>
</body>
</html>`
          }
        ]
      };
      setProjects([...projects, newLocalProj]);
      setNewProjectName('');
      return;
    }

    setIsCreatingProject(true); // Set Loading overlay status
    setProjectStatusMessage('Preparing workspace metadata...');

    const cleanedRepoName = newProjectName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
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
    <p class="text-xs text-slate-400 mt-2 font-mono">Workspace online. Happy hackathon coding!</p>
  </div>
</body>
</html>`
      }
    ];

    try {
      let gitRepoName = '';
      let gitOwner = '';

      // CREATE GITHUB REPOSITORY IF CHECKBOX INITIATED
      if (useGithubForNewProject && githubToken && githubUser) {
        setProjectStatusMessage('Creating private GitHub repository...');
        const repoRes = await fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            Authorization: `token ${githubToken}`,
            'Content-Type': 'application/json',
            Accept: 'application/vnd.github.v3+json'
          },
          body: JSON.stringify({
            name: cleanedRepoName,
            private: true,
            auto_init: true // Generates base commit to hook our files tree directly on branch creation
          })
        });

        if (!repoRes.ok) {
          const errData = await repoRes.json();
          throw new Error(`GitHub repo creation failed: ${errData.message}`);
        }

        const repoData = await repoRes.json();
        gitRepoName = repoData.name;
        gitOwner = repoData.owner.login;

        // SECURE REFERENCE HANDSHAKE POLLING: Wait until GitHub registers the initial main branch!
        setProjectStatusMessage('Spawning main branch on GitHub...');
        let retries = 5;
        let refAccessible = false;
        while (retries > 0 && !refAccessible) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          try {
            const checkRef = await fetch(`https://api.github.com/repos/${gitOwner}/${gitRepoName}/git/refs/heads/main`, {
              headers: { Authorization: `token ${githubToken}`, Accept: 'application/vnd.github.v3+json' }
            });
            if (checkRef.ok) {
              refAccessible = true;
            }
          } catch (e) {
            // Silence and retry
          }
          retries--;
        }

        if (!refAccessible) {
          throw new Error('GitHub branch reference handshake timeout. Please check your network connection.');
        }

        setProjectStatusMessage('Deploying initial index.html templates...');
        await pushCommitToGithub(gitOwner, gitRepoName, 'main', defaultFiles, 'Initial project build', githubToken);
      }

      setProjectStatusMessage('Syncing project variables with team roster...');
      await addDoc(collection(db, 'projects'), {
        name: newProjectName.trim(),
        userId: user.uid, 
        memberUids: [user.uid], 
        memberEmails: [user.email || 'anonymous'], 
        presence: {},          
        files: defaultFiles, // Always initialize defaultFiles in Firestore so non-GitHub teammates can see them immediately!
        githubRepo: gitRepoName || null,
        githubOwner: gitOwner || null,
        githubBranch: gitRepoName ? 'main' : null,
        createdAt: serverTimestamp(),
        lastChange: {
          by: user.email ? user.email.split('@')[0] : 'anonymous',
          message: 'Workspace Initialized'
        }
      });
      
      setNewProjectName('');
      setUseGithubForNewProject(false);
    } catch (err) {
      console.error(err);
      setDashboardError(err.message || 'Permission denied. Make sure your Firestore rules match your project schema!');
    } finally {
      setIsCreatingProject(false); // Clear Loading status overlay
      setProjectStatusMessage('');
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

    if (!db) {
      setInviteStatus('Cloud sync is offline during local demonstration mode.');
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', targetEmail));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setInviteStatus('Teammate profile not found. Have them sign in once first!');
        return;
      }

      const teammateDoc = querySnapshot.docs[0];
      const teammateUid = teammateDoc.id;

      const projectRef = doc(db, 'projects', currentProjectId);
      await updateDoc(projectRef, {
        memberUids: arrayUnion(teammateUid),
        memberEmails: arrayUnion(targetEmail)
      });

      setInviteStatus('Teammate synced successfully!');
      setTeammateEmailInput('');
    } catch (err) {
      console.error(err);
      setInviteStatus(err.message ? `Error: ${err.message}` : 'Error appending team credentials.');
    }
  };

  // --- GIT DATABASE MULTI-FILE ATOMIC COMMIT MECHANISM ---
  const pushCommitToGithub = async (owner, repo, branch, filesToCommit, commitMessage, token) => {
    const authHeader = {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    };

    // 1. Fetch reference details for current active branch head
    const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      headers: authHeader
    });
    if (!refRes.ok) throw new Error('Could not get branch reference parameters.');
    const refData = await refRes.json();
    const currentCommitSha = refData.object.sha;

    // 2. Fetch parent commit details to find parent tree
    const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${currentCommitSha}`, {
      headers: authHeader
    });
    if (!commitRes.ok) throw new Error('Could not find parent commit data.');
    const commitData = await commitRes.json();
    const baseTreeSha = commitData.tree.sha;

    // 3. Assemble blob modifications arrays
    const treeItems = filesToCommit.map(file => ({
      path: file.name,
      mode: '100644',
      type: 'blob',
      content: file.content
    }));

    // 4. Create new compiled Git Tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });
    if (!treeRes.ok) throw new Error('Could not compile Git Tree contents.');
    const treeData = await treeRes.json();
    const newTreeSha = treeData.sha;

    // 5. Create atomic commit vectors
    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: authHeader,
      body: JSON.stringify({
        message: commitMessage,
        tree: newTreeSha,
        parents: [currentCommitSha]
      })
    });
    if (!newCommitRes.ok) throw new Error('Could not write commit details.');
    const newCommitData = await newCommitRes.json();
    const newCommitSha = newCommitData.sha;

    // 6. Push head references update
    const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: authHeader,
      body: JSON.stringify({
        sha: newCommitSha,
        force: true
      })
    });
    if (!updateRefRes.ok) throw new Error('Could not shift branch pointers.');
    return newCommitSha;
  };

  // --- INTERCEPT WORKSPACE CHANGES & ASK FOR CHANGE DESCRIPTION ---
  const triggerPushCommitModal = (updatedFiles) => {
    setPendingFilesToSync(updatedFiles);
    setChangeNameInput('');
    setShowChangeModal(true);
  };

  const handleConfirmChangeCommit = async (e) => {
    e.preventDefault();
    if (!changeNameInput.trim() || !pendingFilesToSync || !currentProjectId) return;

    // Offline modification fallback handler
    if (!db) {
      setFiles(pendingFilesToSync);
      const updatedProjects = projects.map(p => p.id === currentProjectId ? {
        ...p,
        files: pendingFilesToSync,
        lastChange: {
          by: 'offline-developer',
          message: changeNameInput.trim(),
          timestamp: Date.now()
        }
      } : p);
      setProjects(updatedProjects);
      setShowChangeModal(false);
      setPendingFilesToSync(null);
      setConsoleLogs(prev => [...prev, `SUCCESS: Simulated sync completed - "${changeNameInput.trim()}"`]);
      return;
    }

    try {
      const projectRef = doc(db, 'projects', currentProjectId);
      const userHandle = user.email ? user.email.split('@')[0] : 'anonymous';

      // IF WORKSPACE IS LINKED TO GITHUB, PUSH FILES ATOMICALLY VIA OAUTH
      if (activeProjectData?.githubRepo && activeProjectData?.githubOwner && githubToken) {
        setConsoleLogs(prev => [...prev, 'SYSTEM: Syncing multi-file updates to GitHub branch...']);
        const branch = activeProjectData.githubBranch || 'main';
        await pushCommitToGithub(
          activeProjectData.githubOwner,
          activeProjectData.githubRepo,
          branch,
          pendingFilesToSync,
          changeNameInput.trim(),
          githubToken
        );
      }

      // Always update Firestore change telemetry metadata so all teammate dashboard clients hot-sync
      await updateDoc(projectRef, {
        files: pendingFilesToSync, // Always keep Firestore in sync so non-GitHub teammates can read files!
        lastChange: {
          by: userHandle,
          message: changeNameInput.trim(),
          timestamp: Date.now()
        }
      });

      // HOT RELOAD OPTIMIZATION: Update state immediately so changes render on the explorer instantly
      setFiles(pendingFilesToSync);
      lastSyncedFilesRef.current = pendingFilesToSync; // Avoid self-sync triggers
      setShowChangeModal(false);
      setPendingFilesToSync(null);
      setConsoleLogs(prev => [...prev, `SUCCESS: Sync completed - "${changeNameInput.trim()}"`]);
    } catch (err) {
      console.error(err);
      setConsoleLogs(prev => [...prev, `CRITICAL: Sync failed: ${err.message}`]);
    }
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
    
    setActiveFileId(newId);
    setSelectedContextIds([...selectedContextIds, newId]);
    setNewFileName('');
    setShowNewFileInput(false);

    // Prompt team member immediately to document the new file spawning action
    triggerPushCommitModal(nextFiles);
  };

  const handleCloseFile = async (idToClose, e) => {
    e.stopPropagation();
    if (files.length <= 1) return;
    const filtered = files.filter(f => f.id !== idToClose);
    
    if (activeFileId === idToClose) {
      setActiveFileId(filtered[filtered.length - 1].id);
    }

    // Prompt team member immediately to document file removal
    triggerPushCommitModal(filtered);
  };

  const handleEditorChange = (val) => {
    // Keep typing changes fully local so it doesn't freeze typing.
    const updated = files.map(f => f.id === activeFileId ? { ...f, content: val || '' } : f);
    setFiles(updated);
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

        setLastModelUsed(targetModel === 'gemini-3.5-flash' ? 'Gemini 3.5 Flash' : 'Gemini 3.1 Flash-Lite');
        setConsoleLogs(prev => [...prev, ...actionLogs.map(l => `SUCCESS: ${l}`), 'COMPLETED: AI patch generation complete. Preparing team change commit...']);
        setPromptInput('');

        // Token metric tracking updates
        if (isSupercharged && db) {
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

        // Trigger pop up to name and sync the AI vibe additions
        triggerPushCommitModal(updatedFilesList);
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
          <p className="text-xs text-slate-500 mt-1 mb-4">Enter credentials or connect using your provider channels.</p>
          
          <form onSubmit={handleAuthSubmit} className="flex flex-col gap-3">
            <input 
              type="email" 
              placeholder="Email address" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
              required 
              className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-855'}`} 
            />
            <input 
              type="password" 
              placeholder="Account Security Key" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
              className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-855'}`} 
            />
            {authError && <p className="text-[11px] text-red-400 font-mono">{authError}</p>}
            
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2.5 rounded-lg transition mt-1 shadow-md shadow-indigo-650/10">
              {isSignUp ? 'Initialize Profile' : 'Access Workspace'}
            </button>
          </form>

          <div className={`relative flex py-4 items-center font-mono text-[9px] uppercase tracking-widest ${theme === 'dark' ? 'text-slate-600' : 'text-slate-400'}`}>
            <div className={`flex-grow border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}></div>
            <span className="mx-2 shrink-0">OR</span>
            <div className={`flex-grow border-t ${theme === 'dark' ? 'border-slate-800' : 'border-slate-200'}`}></div>
          </div>

          <div className="flex flex-col gap-2">
            <button onClick={handleGithubSignIn} className={`w-full border text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${theme === 'dark' ? 'bg-slate-900 border-slate-800 text-slate-100 hover:bg-slate-855' : 'bg-white border-slate-200 text-slate-755 hover:bg-slate-50'}`}>
              <Github size={14} className="fill-slate-100" /> Continue with GitHub
            </button>

            <button onClick={handleGoogleSignIn} className={`w-full border text-xs font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition ${theme === 'dark' ? 'bg-slate-955 border-slate-800 text-slate-300 hover:bg-slate-900' : 'bg-white border-slate-200 text-slate-705 hover:bg-slate-50'}`}>
              <LogIn size={14} /> Continue with Google
            </button>
          </div>

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
      <div className={`h-screen w-screen flex flex-col font-sans transition-colors duration-200 relative ${theme === 'dark' ? 'bg-slate-950 text-slate-200' : 'bg-slate-50 text-slate-800'}`}>
        
        {/* PROJECT CREATION LOADER OVERLAY STATUS PANEL */}
        {isCreatingProject && (
          <div className="absolute inset-0 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 font-mono text-xs text-indigo-400 gap-3">
            <div className="h-8 w-8 border-4 border-indigo-500 border-t-transparent animate-spin rounded-full" />
            <span className="uppercase tracking-widest font-bold">Configuring Collaboration Layer</span>
            <span className="text-slate-400 text-[11px] animate-pulse">⚙️ {projectStatusMessage}</span>
          </div>
        )}

        <header className={`h-14 border-b px-6 flex items-center justify-between transition-colors ${theme === 'dark' ? 'border-slate-800 bg-slate-900/40' : 'border-slate-200 bg-white'}`}>
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 bg-indigo-600 rounded-md flex items-center justify-center font-black text-sm text-white">Y</div>
            <span className={`text-xs font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>YouthDevs Central Hub</span>
          </div>
          <div className="flex items-center gap-4">
            
            {/* DYNAMIC GITHUB HUBLINK CONTROLLER INDICATOR */}
            {githubUser ? (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-400' : 'bg-emerald-50 border-emerald-100 text-emerald-600'}`}>
                <Github size={11} />
                <span>Git Connected: <b>{githubUser.login}</b></span>
              </div>
            ) : (
              <button onClick={handleGithubSignIn} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border hover:scale-105 transition-all ${theme === 'dark' ? 'bg-amber-950/25 border-amber-900/30 text-amber-400' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                <Github size={11} />
                <span>Link GitHub Account</span>
              </button>
            )}

            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${theme === 'dark' ? 'bg-indigo-955/30 border-indigo-900/40 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
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

            <span className="text-xs text-slate-500 font-mono hidden sm:inline">{user.email || 'anonymous@youthdevs.me'}</span>
            <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 transition flex items-center gap-1 text-xs">
              <LogOut size={13} /> Exit
            </button>
          </div>
        </header>

        <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 overflow-y-auto">
          {/* OFFLINE DEMONSTRATION WORKSPACE CALLOUT */}
          {!db && (
            <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs font-mono">
              ⚠️ Simulated Localhost Demo Mode. To unlock persistent team databases, dynamic presence badges, and GitHub API handshakes, configure your <b>__firebase_config</b> environment values.
            </div>
          )}

          <div className={`border p-6 rounded-2xl mb-8 transition-colors ${theme === 'dark' ? 'bg-gradient-to-r from-indigo-950/40 to-slate-900 border-slate-800/80' : 'bg-gradient-to-r from-indigo-50/50 to-white border-slate-200'}`}>
            <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>Welcome Back to Hackathon Core</h2>
            <p className={`text-xs mt-1 max-w-lg ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>Build collaborative multi-file web applications natively with your team of up to 3 members. Switch your workspace parameters to GitHub to save, track, and deploy code directly inside GitHub repos!</p>
            
            <form onSubmit={handleCreateProject} className="mt-4 flex flex-col gap-3 max-w-md">
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="New project or repository name..." 
                  value={newProjectName} 
                  onChange={e => setNewProjectName(e.target.value)} 
                  required 
                  className={`flex-1 border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' : 'bg-white border-slate-300 focus:border-indigo-500 text-slate-855'}`} 
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition shadow-lg shadow-indigo-650/10 shrink-0">
                  <Plus size={14} /> Create Repo
                </button>
              </div>

              {/* GITHUB ENABLE SYNC TOGGLE */}
              {githubUser && (
                <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                  <input 
                    type="checkbox" 
                    checked={useGithubForNewProject} 
                    onChange={e => setUseGithubForNewProject(e.target.checked)} 
                    className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 focus:ring-offset-slate-955 h-4 w-4 bg-slate-900"
                  />
                  <span className={`text-xs font-medium ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>
                    Initialize workspace as a private **GitHub Repository** (`${newProjectName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')}`)
                  </span>
                </label>
              )}
            </form>

            {/* Dashboard Error Panel displaying Firestore Permission issues beautifully */}
            {dashboardError && (
              <p className="text-xs text-rose-400 font-mono mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg animate-shake">
                ⚠️ {dashboardError}
              </p>
            )}
          </div>

          <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Your Persistent Team Repositories</h3>
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
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 bg-slate-500/10 px-1.5 py-0.5 rounded">
                      <Users size={10} />
                      <span>{proj.memberUids?.length || 1}/3</span>
                      {proj.githubRepo && <Github size={10} className="fill-slate-400 text-slate-400 shrink-0 ml-0.5" />}
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
        <div className="flex items-center gap-3 max-w-[50%] overflow-hidden">
          <button onClick={() => setCurrentProjectId(null)} className={`p-1.5 rounded-lg transition-colors shrink-0 ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-100 text-slate-500 hover:text-slate-855'}`} title="Return to Dashboard">
            <ArrowLeft size={14} />
          </button>
          <div className={`h-5 w-px shrink-0 ${theme === 'dark' ? 'bg-slate-800' : 'bg-slate-200'}`} />
          <span className="font-bold text-xs tracking-wider bg-gradient-to-r from-indigo-500 to-cyan-500 bg-clip-text text-transparent uppercase font-mono truncate shrink-0 flex items-center gap-1.5">
            {activeProjectData?.githubRepo && <Github size={13} className="shrink-0 text-slate-400" />}
            {activeProjectData?.name}
          </span>
          
          <div className={`hidden md:flex items-center gap-1 text-[10px] text-slate-400 px-2 py-0.5 rounded font-mono border truncate shrink-0 ${theme === 'dark' ? 'bg-slate-900 border-slate-800' : 'bg-slate-200/50 border-slate-300'}`}>
            <span>Team: {activeProjectData?.memberEmails?.map(m => m.split('@')[0]).join(', ')}</span>
          </div>

          {/* LATEST TEAM CHANGE HEADER PANEL INDICATOR IN THEIR SPECIFIC ASSIGNED COLORS */}
          {activeProjectData?.lastChange && (() => {
            const idx = activeProjectData.memberEmails?.findIndex(m => m.toLowerCase().split('@')[0] === activeProjectData.lastChange.by?.toLowerCase());
            
            let containerClass = theme === 'dark' ? 'bg-slate-950 border-slate-800 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600';
            let authorClass = 'font-bold';

            if (idx === 0) {
              containerClass = theme === 'dark' ? 'bg-emerald-950/25 border-emerald-500/30 text-emerald-400' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
              authorClass = 'font-black text-emerald-500 dark:text-emerald-400';
            } else if (idx === 1) {
              containerClass = theme === 'dark' ? 'bg-orange-950/25 border-orange-500/30 text-orange-400' : 'bg-orange-50 border-orange-200 text-orange-700';
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

        {/* TEAM ACCOMMODATION: Add Teammate Overlay Feature */}
        <div className="flex items-center gap-2">
          <form onSubmit={handleAddTeammateSubmit} className="hidden xl:flex items-center gap-1 border rounded-lg p-1 text-xs bg-slate-950/30 border-slate-800/80">
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
            <span className="hidden xl:inline text-[9px] font-mono text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded max-w-[200px] truncate" title={inviteStatus}>
              {inviteStatus}
            </span>
          )}

          <div className={`flex items-center gap-1 text-[10px] font-semibold border px-3 py-1 rounded-full shrink-0 ${theme === 'dark' ? 'bg-indigo-955/30 border-indigo-900/40 text-indigo-400' : 'bg-indigo-50 border-indigo-100 text-indigo-600'}`}>
            <Users size={11} />
            <span>IDE Users: <b className="font-mono">{totalUsers !== undefined && totalUsers !== null ? totalUsers : '...'}</b></span>
          </div>

          <button 
            onClick={toggleTheme} 
            className={`p-2 rounded-lg border transition-all shrink-0 ${theme === 'dark' ? 'border-slate-800 text-amber-400 hover:bg-slate-850' : 'border-slate-200 text-slate-500 hover:bg-slate-100'}`}
            title="Toggle system theme"
          >
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Supercharge Status */}
          <div className={`flex items-center gap-3 border px-3 py-1 rounded-xl transition-colors shrink-0 ${theme === 'dark' ? 'bg-slate-900/90 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
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
            <button onClick={() => setShowNewFileInput(!showNewFileInput)} className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-slate-200 text-slate-500 hover:text-slate-855'}`}><Plus size={14} /></button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            {showNewFileInput && (
              <form onSubmit={handleCreateFile} className="mb-2">
                <input type="text" autoFocus placeholder="filename.html..." value={newFileName} onChange={e => setNewFileName(e.target.value)} onBlur={() => setTimeout(() => setShowNewFileInput(false), 200)} className={`w-full border rounded px-2 py-1 text-xs outline-none font-mono ${theme === 'dark' ? 'bg-slate-955 border-indigo-500 text-slate-200' : 'bg-white border-indigo-500 text-slate-800'}`} />
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
                  
                  {/* Real-time Team Member Edit Badge color assigned individually */}
                  {isTeammateActiveHere && (() => {
                    const idx = activeProjectData?.memberEmails?.findIndex(m => m.toLowerCase().split('@')[0] === currentFileViewer.toLowerCase());
                    let badgeClass = "bg-slate-500/20 text-slate-400 border border-slate-500/30";
                    if (idx === 0) badgeClass = theme === 'dark' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-emerald-50 text-emerald-700 border border-emerald-200";
                    if (idx === 1) badgeClass = theme === 'dark' ? "bg-orange-500/20 text-orange-400 border border-orange-500/30" : "bg-orange-50 text-orange-700 border border-orange-200";
                    if (idx === 2) badgeClass = theme === 'dark' ? "bg-blue-500/20 text-blue-400 border border-blue-500/30" : "bg-blue-50 text-blue-700 border border-blue-200";
                    return (
                      <span className={`text-[8px] px-1 rounded scale-90 tracking-tighter uppercase shrink-0 animate-pulse font-bold ${badgeClass}`}>
                        {currentFileViewer}
                      </span>
                    );
                  })()}
                  <X size={11} className={`opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500 shrink-0 ml-1`} onClick={e => handleCloseFile(file.id, e)} />
                </div>
              );
            })}
          </div>

          {/* ACTIVE MEMBERS IN THEIR RESPECTIVE COLORS LIST (Left Panel Footer Container) */}
          {activeProjectData && (
            <div className={`p-3 border-t shrink-0 transition-colors text-[11px] font-mono flex flex-col gap-1.5 ${theme === 'dark' ? 'border-slate-800/60 bg-slate-950/40' : 'border-slate-200 bg-slate-100'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-400'}`}>Active Team</div>
              <div className="flex flex-col gap-1">
                {activeProjectData.memberEmails?.map((memberEmail, index) => {
                  const handle = memberEmail.split('@')[0];
                  let clr = 'text-slate-400';
                  if (index === 0) clr = theme === 'dark' ? 'text-emerald-400 font-bold' : 'text-emerald-600 font-black';
                  if (index === 1) clr = theme === 'dark' ? 'text-orange-400 font-bold' : 'text-orange-600 font-black';
                  if (index === 2) clr = theme === 'dark' ? 'text-blue-400 font-bold' : 'text-blue-600 font-black';
                  
                  // Is this member current user?
                  const isSelf = user && memberEmail.toLowerCase() === user.email?.toLowerCase();

                  return (
                    <div key={memberEmail} className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${
                        index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-orange-500' : 'bg-blue-500'
                      }`} />
                      <span className={`${clr} truncate max-w-[150px]`}>
                        {handle} {isSelf && <span className="opacity-50 text-[10px] font-normal">(Self)</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* DRAG HANDLER 1 */}
        <div className={`w-1.5 h-full cursor-ew-resize bg-transparent hover:bg-indigo-500/40 transition-colors z-20 shrink-0`} onMouseDown={() => { isResizingLeft.current = true; }} />

        {/* CODE EDITOR WINDOW */}
        <section style={{ width: `${centerWidth}px` }} className={`flex flex-col h-full shrink-0 overflow-hidden border-r transition-colors ${theme === 'dark' ? 'bg-slate-955 border-slate-800/80' : 'bg-white border-slate-200'}`}>
          <div className={`h-9 border-b flex items-center justify-between overflow-x-auto shrink-0 select-none transition-colors ${theme === 'dark' ? 'bg-slate-900/40 border-slate-800/60' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center overflow-x-auto">
              {files.map(file => {
                const isActive = file.id === activeFileId;
                return (
                  <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`h-9 flex items-center gap-2 px-4 text-xs font-mono border-r cursor-pointer transition-all shrink-0 ${
                    isActive 
                      ? theme === 'dark' ? 'bg-slate-955 border-t-2 border-t-indigo-500 text-slate-100 border-r-slate-800/60' : 'bg-white border-t-2 border-t-indigo-500 text-slate-800 border-r-slate-200'
                      : theme === 'dark' ? 'bg-slate-900/20 text-slate-500 border-r-slate-800/60' : 'bg-slate-100/50 text-slate-500 border-r-slate-200'
                  }`}>
                    <span>{file.name}</span>
                    <X size={10} className="hover:text-red-500 transition-colors" onClick={e => handleCloseFile(file.id, e)} />
                  </div>
                );
              })}
            </div>

            {/* ACTION COMPONENT: Commit / Save Push Workspace Change Trigger Button */}
            {isDirty && (
              <button 
                onClick={() => triggerPushCommitModal(files)}
                className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 mr-2 rounded bg-indigo-600 hover:bg-indigo-500 text-white transition-all shadow-md shadow-indigo-650/20 hover:scale-105 animate-pulse"
              >
                <Save size={12} />
                <span>{activeProjectData?.githubRepo ? 'Push GitHub Commit' : 'Push Team Change'}</span>
              </button>
            )}
          </div>

          <div className="flex-1 w-full overflow-hidden bg-[#1e1e1e] relative">
            {!monacoLoaded ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-xs font-mono text-indigo-400 gap-2">
                <div className="h-5 w-5 border-2 border-indigo-500 border-t-transparent animate-spin rounded-full" />
                <span>Booting Monaco Engine...</span>
              </div>
            ) : null}
            <div ref={editorContainerRef} className="w-full h-full" />
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
          <form onSubmit={handleAgenticVibeSubmit} className={`flex-1 flex items-stretch gap-2 border rounded-xl p-2 transition-all ${theme === 'dark' ? 'bg-slate-955 border-slate-800 focus-within:border-indigo-500/60' : 'bg-slate-50 border-slate-200 focus-within:border-indigo-500/70'}`}>
            <textarea value={promptInput} onChange={e => setPromptInput(e.target.value)} disabled={isAiLoading} placeholder={cooldownEndTime ? "Supercharge mode re-calibrating..." : "Instruct the file agent ecosystem to execute actions..."} className={`flex-1 bg-transparent border-none text-xs focus:outline-none resize-none p-1 custom-scrollbar leading-relaxed ${theme === 'dark' ? 'text-slate-100 placeholder-slate-500' : 'text-slate-855 placeholder-slate-400'}`} />
            <button type="submit" disabled={isAiLoading || !promptInput.trim()} className="self-end flex items-center justify-center bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg transition shrink-0 shadow-lg shadow-indigo-650/10">Vibe <ChevronRight size={12} /></button>
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

      {/* CUSTOM COMMIT CHANGE POP-UP MODAL UI (NO WINDOW ALERTS USED) */}
      {showChangeModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className={`w-full max-w-md border p-6 rounded-2xl shadow-2xl transition-all ${
            theme === 'dark' ? 'bg-slate-900 border-slate-850' : 'bg-white border-slate-200'
          }`}>
            <div className="flex items-center gap-2 mb-3">
              <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-500">
                <Save size={16} />
              </div>
              <h3 className={`text-base font-bold ${theme === 'dark' ? 'text-white' : 'text-slate-900'}`}>
                {activeProjectData?.githubRepo ? 'Push GitHub Commit' : 'Push Collaborative Change'}
              </h3>
            </div>
            
            <p className={`text-xs mb-4 ${theme === 'dark' ? 'text-slate-400' : 'text-slate-500'}`}>
              Please enter a brief name or description for this changeset. Teammates will see this description in real-time.
            </p>

            <form onSubmit={handleConfirmChangeCommit} className="flex flex-col gap-4">
              <input 
                type="text" 
                placeholder="e.g., Fix responsive layout sizing" 
                value={changeNameInput} 
                onChange={e => setChangeNameInput(e.target.value)} 
                required 
                autoFocus
                className={`w-full border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${
                  theme === 'dark' 
                    ? 'bg-slate-950 border-slate-800 focus:border-indigo-500 text-slate-200' 
                    : 'bg-slate-50 border-slate-300 focus:border-indigo-500 text-slate-855'
                }`} 
              />

              <div className="flex gap-2 justify-end text-xs font-bold">
                <button 
                  type="button"
                  onClick={() => {
                    setShowChangeModal(false);
                    setPendingFilesToSync(null);
                  }}
                  className={`px-4 py-2.5 rounded-lg border transition ${
                    theme === 'dark' 
                      ? 'border-slate-850 hover:bg-slate-850 text-slate-400' 
                      : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                  }`}
                >
                  Cancel
                </button>
                <button 
                  type="submit"
                  disabled={!changeNameInput.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-lg transition shadow-md shadow-indigo-650/10"
                >
                  Confirm & Push
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}