'use client';

import React, { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sparkles, ChevronRight, FileCode, Plus, X, CheckSquare, Square, Zap, LogOut, Folder, Sun, Moon, Users, Save, Github, ShieldAlert, Award, FileSearch } from 'lucide-react';
import { addDoc, arrayUnion, collection, doc, getCountFromServer, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, updateDoc, where } from 'firebase/firestore';
import WorkspaceHeader from '../../app/workspace/_components/WorkspaceHeader';
import Terminal from './Terminal';
import AdminSubmissionWorkspace from './admin/AdminSubmissionWorkspace';
import ChangeCommitModal from './modals/ChangeCommitModal';
import AdminSubmissionInspectorModal from './modals/AdminSubmissionInspectorModal';
import useRouteGuard from './hooks/useRouteGuard';
import {
  buildVercelFilesPayload,
  decodeBase64Utf8,
  filesAreIdentical,
  slugifyProjectName,
} from '../../lib/ide-utils';
import { buildAdminProjectPath, buildWorkspaceProjectPath, getWorkspaceRouteState, WORKSPACE_PATH, LOGIN_PATH } from '../../app/workspace/_utils/routes';
import { toast } from 'react-hot-toast';

import {
  auth,
  db,
  GithubAuthProvider,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
  signInWithCustomToken,
  signInAnonymously,
} from '../../app/workspace/_utils/firebase';

const escapeHtmlText = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[char]));

const buildDefaultChatMessages = () => ([
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Your AI response will appear here after you run a task.',
    createdAt: 0,
    turnId: 'welcome',
  },
]);

const buildDefaultProjectFiles = (projectName, template) => {
  const safeProjectName = escapeHtmlText(projectName || 'Untitled Project');
  const jsProjectName = JSON.stringify(projectName || 'YouthDevs Project');

  if (template === 'nextjs') {
    return [
      {
        id: 'package-json',
        name: 'package.json',
        language: 'json',
        content: `{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "14.2.3",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {}
}`
      },
      {
        id: 'app-layout-js',
        name: 'app/layout.js',
        language: 'javascript',
        content: `import './globals.css';

export const metadata = {
  title: ${jsProjectName},
  description: 'Built in YouthDevs IDE'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
      },
      {
        id: 'app-page-js',
        name: 'app/page.js',
        language: 'javascript',
        content: `export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900 flex items-center justify-center p-6">
      <section className="max-w-xl text-center">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-600">Next.js workspace online</p>
        <h1 className="mt-3 text-4xl font-black">${safeProjectName}</h1>
        <p className="mt-4 text-sm leading-6 text-slate-600">
          Edit this starter app and render it with the Next.js preview option.
        </p>
      </section>
    </main>
  );
}
`
      },
      {
        id: 'app-globals-css',
        name: 'app/globals.css',
        language: 'css',
        content: `* {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
`
      }
    ];
  }

  return [
    {
      id: 'index-html',
      name: 'index.html',
      language: 'html',
      content: `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-white text-slate-900 min-h-screen flex items-center justify-center">
  <div class="text-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
    <h1 class="text-2xl font-bold text-emerald-700">${safeProjectName}</h1>
    <p class="text-xs text-slate-500 mt-2 font-mono">Workspace online. Happy hackathon coding!</p>
  </div>
</body>
</html>`
    }
  ];
};

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authBootError, setAuthBootError] = useState('');

  // Admin and Hackathon Configuration States
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLoading, setAdminLoading] = useState(true);
  const [hackathonActive, setHackathonActive] = useState(false);
  const [submissionsEnabled, setSubmissionsEnabled] = useState(false);
  const [globalHackathonProjects, setGlobalHackathonProjects] = useState([]);
  const [adminSubmissions, setAdminSubmissions] = useState([]);
  const [customDomainMode, setCustomDomainMode] = useState(false);

  // Admin File Inspection Modal state
  const [selectedAdminProjectFiles, setSelectedAdminProjectFiles] = useState(null);
  const [adminActiveFileContent, setAdminActiveFileContent] = useState('');
  const [adminActiveFileName, setAdminActiveFileName] = useState('');
  const [adminViewTab, setAdminViewTab] = useState('code');

  // GitHub Integration States
  const [githubToken, setGithubToken] = useState(null);
  const [githubUser, setGithubUser] = useState(null);
  const [useGithubForNewProject, setUseGithubForNewProject] = useState(false);

  // Workspace vs IDE View state
  const [currentProjectId, setCurrentProjectIdState] = useState(null);
  const [projects, setProjects] = useState([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [routeLookupProject, setRouteLookupProject] = useState(null);
  const [routeLookupComplete, setRouteLookupComplete] = useState(false);
  const [routeLookupError, setRouteLookupError] = useState('');
  const [adminSubmissionsLoading, setAdminSubmissionsLoading] = useState(false);
  const [adminSubmissionsResolved, setAdminSubmissionsResolved] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectTemplate, setNewProjectTemplate] = useState('html');
  const [workspaceError, setWorkspaceError] = useState('');

  // PROJECT CREATION LOADING STATUS
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [projectStatusMessage, setProjectStatusMessage] = useState('');
  const [deployProjectName, setDeployProjectName] = useState('');
  const [isDeployingToVercel, setIsDeployingToVercel] = useState(false);
  const [deployStatusMessage, setDeployStatusMessage] = useState('');
  const [deployError, setDeployError] = useState('');
  const [deployUrl, setDeployUrl] = useState('');
  const [deployDomainMode, setDeployDomainMode] = useState('');
  const [skipCourseSubmittingProjectId, setSkipCourseSubmittingProjectId] = useState('');

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
  const lastChangeTimestampRef = useRef(0);

  // Synchronized Reference Pointers to neutralize state closures in active threads
  const activeFileIdRef = useRef(activeFileId);
  const isInternalChangeRef = useRef(false);
  const authBootstrapInFlightRef = useRef(false);

  // Layout & Console Utilities
  const [promptInput, setPromptInput] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState(buildDefaultChatMessages);
  const [consoleLogs, setConsoleLogs] = useState([
    'Ready. Your YouthDevs workspace is online.'
  ]);
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewUrl, setPreviewUrl] = useState('');
  const [renderMode, setRenderMode] = useState('html');
  const [previewStatus, setPreviewStatus] = useState('HTML preview renders the current workspace in the iframe.');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const [leftWidth, setLeftWidth] = useState(240);
  const [centerWidth, setCenterWidth] = useState(600);
  const [footerHeight, setFooterHeight] = useState(180);
  const [chatPanelWidth, setChatPanelWidth] = useState(50);

  const isResizingLeft = useRef(false);
  const isResizingCenter = useRef(false);
  const isResizingFooter = useRef(false);
  const isResizingChatPanel = useRef(false);
  const pathname = usePathname();
  const router = useRouter();
  const {
    routePath,
    routeSegments,
    routeMode,
    isAdminRoute,
    projectSlugFromRoute,
  } = getWorkspaceRouteState(pathname);

  const currentActiveFile = files.find(f => f.id === activeFileId) || files[0];
  const activeProjectData = projects.find(p => p.id === currentProjectId);
  const routeProjectsSource = routeMode === 'admin-project' ? adminSubmissions : projects;
  const routeProject = (routeMode === 'project' || routeMode === 'admin-project')
    ? routeProjectsSource.find((p) => {
      const routeKey = slugifyProjectName(projectSlugFromRoute);
      return [p.id, p.projectSlug, p.slug, p.projectName, p.name]
        .filter(Boolean)
        .some((candidate) => slugifyProjectName(candidate) === routeKey);
    })
    : null;
  const resolvedRouteProject = routeProject || (routeMode === 'project' ? routeLookupProject : null);
  // The current Firestore rules grant admin access to authenticated users.
  // Keep the client-side route gate consistent with that policy instead of
  // blocking /admin on a profile flag that is initialized to false.
  const canAccessAdminPanel = !!user || String(process.env.NEXT_PUBLIC_FORCE_ADMIN_PANEL).toLowerCase() === 'true' || !db;
  const canListenToAdminCollections = canAccessAdminPanel && !!db && isAdminRoute;

  // Detect if there are unsaved local modifications compared to the Firestore database
  const isDirty = activeProjectData && JSON.stringify(files) !== JSON.stringify(activeProjectData.files);

  // Update active file tracker reference whenever active file shifts
  useEffect(() => {
    activeFileIdRef.current = activeFileId;
  }, [activeFileId]);

  useEffect(() => {
    setDeployProjectName(activeProjectData?.name || '');
    setDeployUrl('');
    setDeployError('');
    setDeployStatusMessage('');
    setDeployDomainMode('');
  }, [activeProjectData?.name]);

  useEffect(() => {
    const savedDomainMode = localStorage.getItem('ide-custom-domain-mode');
    if (savedDomainMode === 'true' || savedDomainMode === 'false') {
      setCustomDomainMode(savedDomainMode === 'true');
      return;
    }
    setCustomDomainMode(String(process.env.NEXT_PUBLIC_USE_CUSTOM_DOMAIN).toLowerCase() === 'true');
  }, []);

  useEffect(() => {
    localStorage.setItem('ide-custom-domain-mode', String(customDomainMode));
  }, [customDomainMode]);

  useEffect(() => {
    setPreviewHtml('');
    setPreviewUrl('');
    const projectRenderMode = activeProjectData?.template === 'nextjs' ? 'nextjs' : 'html';
    setRenderMode(projectRenderMode);
    setPreviewStatus(projectRenderMode === 'nextjs'
      ? 'Next.js preview will run the workspace with npm run dev.'
      : 'HTML preview renders the current workspace in the iframe.');
  }, [currentProjectId, activeProjectData?.template]);

  const handleGithubSignIn = async () => {
    setAuthBootError('');
    if (!auth) {
      setAuthBootError('Authentication service is offline.');
      return;
    }

    try {
      const provider = new GithubAuthProvider();
      provider.addScope('repo');
      await signInWithPopup(auth, provider);
    } catch (error) {
      setAuthBootError(error.message.replace('Firebase: ', ''));
    }
  };

  // This is only for user-initiated project changes. Route effects update selection
  // directly so a route never causes another route transition.
  const setCurrentProjectId = (id) => {
    setCurrentProjectIdState(id);
    if (id) {
      const targetProject = projects.find((project) => project.id === id);
      // Use the Firestore document ID for newly opened projects. It is stable even
      // when legacy projects have missing or inconsistent slug fields.
      const nextSlug = targetProject?.id || slugifyProjectName(targetProject?.slug || targetProject?.name || id);
      sessionStorage.setItem('current-project-id', id);
      if (nextSlug) {
        const targetPath = buildWorkspaceProjectPath(nextSlug);
        if (pathname !== targetPath) router.push(targetPath);
      }
    } else {
      sessionStorage.removeItem('current-project-id');
      if (pathname !== WORKSPACE_PATH) router.push(WORKSPACE_PATH);
    }
  };

  useRouteGuard({
    authLoading,
    pathname,
    routeMode,
    user,
    router,
    currentProjectId,
    setCurrentProjectId: setCurrentProjectIdState,
    isAdminRoute,
    adminLoading,
    canAccessAdminPanel,
    adminSubmissionsResolved,
    routeProject,
  });

  // Select a resolved project without changing the browser URL. Project routes
  // must remain stable while Firestore and the IDE shell finish loading.
  useEffect(() => {
    if (routeMode !== 'project' || !resolvedRouteProject) return;
    if (resolvedRouteProject.id !== currentProjectId) {
      setCurrentProjectIdState(resolvedRouteProject.id);
    }
  }, [currentProjectId, resolvedRouteProject?.id, routeMode]);

  // Resolve the URL directly before treating a project as missing. This covers
  // legacy records whose membership query or slug fields are incomplete.
  useEffect(() => {
    let cancelled = false;

    if (routeMode !== 'project' || !user || projectsLoading) {
      setRouteLookupProject(null);
      setRouteLookupError('');
      setRouteLookupComplete(routeMode !== 'project' || !user);
      return () => {
        cancelled = true;
      };
    }

    if (routeProject) {
      setRouteLookupProject(null);
      setRouteLookupError('');
      setRouteLookupComplete(true);
      return () => {
        cancelled = true;
      };
    }

    const lookupProject = async () => {
      let foundProject = null;
      let lookupFailed = false;

      if (db) {
        try {
          const directSnapshot = await getDoc(doc(db, 'projects', projectSlugFromRoute));
          if (directSnapshot.exists()) {
            foundProject = { id: directSnapshot.id, ...directSnapshot.data() };
          }
        } catch (error) {
          // A slug is not a document ID, or the direct read is not permitted.
          // Continue with the indexed legacy slug lookups below.
        }

        if (!foundProject) {
          for (const field of ['slug', 'projectSlug']) {
            try {
              const snapshot = await getDocs(query(collection(db, 'projects'), where(field, '==', projectSlugFromRoute)));
              if (!snapshot.empty) {
                const projectSnapshot = snapshot.docs[0];
                foundProject = { id: projectSnapshot.id, ...projectSnapshot.data() };
                break;
              }
            } catch (error) {
              lookupFailed = true;
              console.error(`Project ${field} route lookup failed:`, error?.message || error);
            }
          }
        }
      }

      if (!cancelled) {
        setRouteLookupProject(foundProject);
        setRouteLookupError(foundProject
          ? ''
          : lookupFailed
            ? 'Project lookup is temporarily unavailable. Check your Firestore connection and try again.'
            : 'This project could not be found for the current account.');
        if (foundProject) {
          setProjects((currentProjects) => currentProjects.some((project) => project.id === foundProject.id)
            ? currentProjects
            : [...currentProjects, foundProject]);
        }
        setRouteLookupComplete(true);
      }
    };

    setRouteLookupComplete(false);
    lookupProject();

    return () => {
      cancelled = true;
    };
  }, [db, projectSlugFromRoute, projectsLoading, routeMode, routeProject?.id, user]);

  const handleDeployToVercel = async () => {
    if (isDeployingToVercel) return;

    const projectName = (deployProjectName || activeProjectData?.name || 'hackathon-ide-project').trim();
    if (!projectName) {
      setDeployError('Please enter a project name before deploying.');
      return;
    }
    if (!files.length) {
      setDeployError('Add at least one file before deploying.');
      return;
    }

    setIsDeployingToVercel(true);
    setDeployError('');
    setDeployUrl('');
    setDeployStatusMessage('Deploying...');

    try {
      const payload = {
        projectName,
        framework: activeProjectData?.template === 'nextjs' ? 'nextjs' : 'html',
        files: buildVercelFilesPayload(files),
        useCustomDomain: customDomainMode,
      };

      setDeployStatusMessage('Building...');
      const response = await fetch('/api/deploy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Deployment failed.');
      }

      setDeployUrl(result.url || '');
      setDeployDomainMode(result.domainMode || '');
      setDeployStatusMessage('Deployment complete.');
    } catch (error) {
      setDeployError(error.message || 'Unable to deploy right now.');
      setDeployStatusMessage('');
    } finally {
      setIsDeployingToVercel(false);
    }
  };

  const handleExportProjectToText = async (project) => {
    const projectName = project?.name || 'project';
    const slug = slugifyProjectName(project?.slug || projectName || project?.id || 'project');
    const filesToExport = Array.isArray(project?.files) ? project.files : [];
    const generatedAt = new Date().toISOString();

    const sections = filesToExport.map((file, index) => {
      const relativePath = String(file?.path || file?.name || '').replace(/^\/+/, '') || 'unknown';
      const fileName = file?.name || relativePath.split('/').pop() || `file-${index + 1}`;
      const content = typeof file?.content === 'string' ? file.content : '';

      return [
        `FILE ${index + 1}`,
        `Name: ${fileName}`,
        `Path: ${relativePath}`,
        '--- CONTENT START ---',
        content || '[empty file]',
        '--- CONTENT END ---',
      ].join('\n');
    });

    const output = [
      `Project: ${projectName}`,
      `Project Slug: ${slug}`,
      `Generated: ${generatedAt}`,
      `File Count: ${filesToExport.length}`,
      '',
      sections.length ? sections.join('\n\n' + '='.repeat(72) + '\n\n') : 'No files found in this project.',
      '',
    ].join('\n');

    const blob = new Blob([output], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${slug || 'project'}-skipcourse.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const submitProjectToSkipCourse = async (projectToSubmit, toastMessage = 'Submitting to SkipCourse...') => {
    if (!user) throw new Error('You must be signed in to submit to SkipCourse.');

    const submittedFiles = Array.isArray(projectToSubmit?.files)
      ? projectToSubmit.files.map((file) => ({ ...file }))
      : [];
    const submissionProjectId = projectToSubmit?.id || projectToSubmit?.slug || projectToSubmit?.name || '';

    if (!submittedFiles.length) {
      throw new Error('No project files were available to submit.');
    }

    setSkipCourseSubmittingProjectId(submissionProjectId);
    const toastId = toast.loading(toastMessage);
    try {
      const payload = {
        userId: user.uid || user.email,
        codeContent: buildVercelFilesPayload(submittedFiles),
      };

      const response = await fetch('/api/skipcourse-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result?.error || 'SkipCourse rejected the submission.');

      toast.success('Submission successful', { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error('Failed to submit to SkipCourse', { id: toastId });
      throw error;
    } finally {
      setSkipCourseSubmittingProjectId('');
    }
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

    // Project selection is restored from the URL, not session state. This avoids
    // a stale selection briefly mounting the wrong terminal/editor after refresh.
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
      lastChangeTimestampRef.current = 0;
    }
  }, [currentProjectId]);

  // Auth Listener Connection Hook with token support
  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return;
    }

    const shouldAutoSignIn = routeMode !== 'login';
    const allowAnonymousAuth = String(process.env.NEXT_PUBLIC_ENABLE_ANONYMOUS_AUTH).toLowerCase() === 'true';
    // Do not treat route mounting as auth completion. Firebase may still be
    // restoring a persisted session, and redirecting while user is null causes
    // every navigation to briefly bounce through /login.
    authBootstrapInFlightRef.current = false;

    const finishAuthBootstrap = () => {
      authBootstrapInFlightRef.current = false;
      setAuthLoading(false);
    };

    const authTimeout = setTimeout(() => {
      setAuthBootError('Auth bootstrap timed out. Opening sign-in screen.');
      finishAuthBootstrap();
    }, 8000);

    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        authBootstrapInFlightRef.current = true;
        try {
          await signInWithCustomToken(auth, __initial_auth_token);
          if (auth.currentUser) {
            finishAuthBootstrap();
          }
        } catch (e) {
          if (shouldAutoSignIn && allowAnonymousAuth) {
            try {
              await signInAnonymously(auth);
              if (auth.currentUser) {
                finishAuthBootstrap();
              }
            } catch (anonymousError) {
              setAuthBootError('Auth service unavailable. Opening sign-in screen.');
              finishAuthBootstrap();
            }
          } else {
            setAuthBootError('Sign-in token was rejected. Please open the login screen.');
            finishAuthBootstrap();
          }
        }
      } else if (shouldAutoSignIn && allowAnonymousAuth) {
        authBootstrapInFlightRef.current = true;
        try {
          await signInAnonymously(auth);
          if (auth.currentUser) {
            finishAuthBootstrap();
          }
        } catch (e) {
          setAuthBootError('Auth service unavailable. Opening sign-in screen.');
          finishAuthBootstrap();
        }
      }
    };
    initAuth().finally(() => {
      clearTimeout(authTimeout);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        // Auth changes must not navigate. The route effect owns redirects.
        setCurrentProjectIdState(null);
        sessionStorage.removeItem('current-project-id');
        setProjects([]);
        setProjectsLoading(false);
        setIsAdmin(false);
        setAdminLoading(false);
        if (!authBootstrapInFlightRef.current) {
          setAuthLoading(false);
        }
        return;
      }
      authBootstrapInFlightRef.current = false;
      setAuthLoading(false);
    });
    return () => {
      clearTimeout(authTimeout);
      unsubscribe();
    };
  }, []);

  // Fetch User Projects, Admin privileges and Hackathon System Configurations
  useEffect(() => {
    if (!db) {
      // Mock localized projects for offline testing when firebase config isn't supplied
      setIsAdmin(true); // Let's enable Admin mode by default in offline fallback mode for painless testing!
      setAdminLoading(false);
      setProjectsLoading(false);
      setAdminSubmissionsLoading(false);
      setAdminSubmissionsResolved(false);
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
<body class="bg-white text-slate-900 min-h-screen flex items-center justify-center">
  <div class="text-center p-6 bg-white rounded-xl border border-slate-200 shadow-sm">
    <h1 class="text-2xl font-bold text-emerald-700">Offline Demonstration Project</h1>
    <p class="text-xs text-slate-500 mt-2 font-mono">Fill in your __firebase_config values to enable live cloud features!</p>
  </div>
</body>
</html>`
            }
          ]
        }]);
      }
      return;
    }

    if (!user) {
      setIsAdmin(false);
      setAdminLoading(false);
      setProjects([]);
      setProjectsLoading(false);
      setAdminSubmissions([]);
      setAdminSubmissionsLoading(false);
      setAdminSubmissionsResolved(false);
      return;
    }

    const userProfileRef = doc(db, 'users', user.uid);
    setProjectsLoading(true);
    setAdminLoading(true);
    setAdminSubmissionsResolved(false);
    const bootListeners = async () => {
      try {
        const [profileSnap, hackathonSnap] = await Promise.all([
          getDoc(userProfileRef),
          getDoc(doc(db, 'system', 'hackathon')),
        ]);

        if (!profileSnap.exists()) {
          await setDoc(userProfileRef, {
            email: user.email || 'anonymous@youthdevs.me',
            superchargeUses: 0,
            cooldownEndTime: null,
            isAdmin: false,
          });
        }

        if (!hackathonSnap.exists()) {
          await setDoc(doc(db, 'system', 'hackathon'), {
            active: false,
            submissionsEnabled: false,
          });
        }
      } catch (err) {
        console.warn('Firestore bootstrap step failed before listeners attached:', err?.message || err);
      }
    };

    bootListeners();

    const unsubProfile = onSnapshot(userProfileRef, async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setSuperchargeUses(data.superchargeUses || 0);
        setCooldownEndTime(data.cooldownEndTime || null);

        // Mark admin based on Firestore configurations. The user count is an
        // admin-only statistic, so non-admin clients never request it.
        const hasAdminAccess = data.isAdmin === true;
        setIsAdmin(hasAdminAccess);
        if (hasAdminAccess) {
          fetchTotalUsersCount();
        } else {
          setTotalUsers(null);
        }
      } else {
        setIsAdmin(false);
        try {
          await setDoc(userProfileRef, { email: user.email || 'anonymous@youthdevs.me', superchargeUses: 0, cooldownEndTime: null, isAdmin: false }, { merge: true });
        } catch (err) {
          console.error("Failed to initialize user document:", err);
        }
      }
      setAdminLoading(false);
    }, (error) => {
      console.error('User profile listener failed:', error?.message || error);
      setIsAdmin(false);
      setAdminLoading(false);
    });

    // Subscribe to Hackathon Config Node globally
    const hackathonConfigRef = doc(db, 'system', 'hackathon');
    const unsubHackathon = onSnapshot(hackathonConfigRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setHackathonActive(data.active || false);
        setSubmissionsEnabled(data.submissionsEnabled || false);
      } else {
        // Safe defaults initialization
        setDoc(hackathonConfigRef, { active: false, submissionsEnabled: false }).catch(() => { });
      }
    }, (error) => {
      console.error('Hackathon config listener failed:', error?.message || error);
    });

    // TEAM ACCOMMODATION: Match either the user's UID or their email so legacy projects stay reachable.
    const userEmail = (user.email || '').trim().toLowerCase();
    const unsubscribers = [];
    const uidProjects = new Map();
    const emailProjects = new Map();
    const settledSources = new Set();
    const requiredSources = userEmail ? 2 : 1;
    const publishProjects = () => {
      setProjects(Array.from(new Map([...uidProjects, ...emailProjects]).values()));
    };
    const applySnapshot = (source, target, snapshot) => {
      target.clear();
      snapshot.forEach((docSnap) => target.set(docSnap.id, { id: docSnap.id, ...docSnap.data() }));
      publishProjects();
      settledSources.add(source);
      if (settledSources.size === requiredSources) setProjectsLoading(false);
    };
    const failSource = (source, error) => {
      console.error('Project listener failed:', error?.message || error);
      settledSources.add(source);
      if (settledSources.size === requiredSources) setProjectsLoading(false);
    };

    const uidQuery = query(collection(db, 'projects'), where('memberUids', 'array-contains', user.uid));
    unsubscribers.push(onSnapshot(uidQuery, (snapshot) => applySnapshot('uid', uidProjects, snapshot), (error) => failSource('uid', error)));

    if (userEmail) {
      const emailQuery = query(collection(db, 'projects'), where('memberEmails', 'array-contains', userEmail));
      unsubscribers.push(onSnapshot(emailQuery, (snapshot) => applySnapshot('email', emailProjects, snapshot), (error) => failSource('email', error)));
    }

    return () => {
      unsubProfile();
      unsubHackathon();
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [user]);

  // Admin Live Projects Snapshot listener (Fetches hackathon-marked projects)
  useEffect(() => {
    if (!canListenToAdminCollections) return;

    const projectsRef = collection(db, 'projects');
    const unsubAdminProjects = onSnapshot(projectsRef, (snapshot) => {
      const allProjects = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (data.isHackathonProject) {
          allProjects.push({ id: doc.id, ...data });
        }
      });
      setGlobalHackathonProjects(allProjects);
    }, (error) => {
      console.error('Admin projects listener failed:', error?.message || error);
    });

    return () => unsubAdminProjects();
  }, [canListenToAdminCollections]);

  // Admin submission snapshot listener (Dedicated Firestore collection for grading)
  useEffect(() => {
    if (!canListenToAdminCollections) {
      setAdminSubmissionsLoading(false);
      setAdminSubmissionsResolved(false);
      return;
    }

    setAdminSubmissionsLoading(true);
    setAdminSubmissionsResolved(false);
    const submissionsRef = collection(db, 'adminSubmissions');
    const unsubAdminSubmissions = onSnapshot(submissionsRef, (snapshot) => {
      const submissions = [];
      snapshot.forEach((docSnap) => {
        submissions.push({ id: docSnap.id, ...docSnap.data() });
      });
      submissions.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
      setAdminSubmissions(submissions);
      setAdminSubmissionsLoading(false);
      setAdminSubmissionsResolved(true);
    }, (error) => {
      console.error('Admin submissions listener failed:', error?.message || error);
      setAdminSubmissionsLoading(false);
      setAdminSubmissionsResolved(true);
    });

    return () => unsubAdminSubmissions();
  }, [canListenToAdminCollections]);

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
      }).catch(() => { });
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

        // AUTOMATIC PAGE RELOAD TRIGGER: Detect remote commits in real-time
        if (data.lastChange && data.lastChange.timestamp) {
          const currentHandle = user.email ? user.email.split('@')[0] : 'anonymous';
          const isOtherUser = data.lastChange.by !== currentHandle;

          if (lastChangeTimestampRef.current === 0) {
            lastChangeTimestampRef.current = data.lastChange.timestamp;
          } else if (isOtherUser && data.lastChange.timestamp > lastChangeTimestampRef.current) {
            lastChangeTimestampRef.current = data.lastChange.timestamp;
            // Hot reload instantly to sync Monaco and Frame previews cleanly
            window.location.reload();
            return;
          }
        }

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
                  // Fetch private files content from the JSON Contents API endpoint and decode locally
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
    }, (error) => {
      console.error('Project file listener failed:', error?.message || error);
    });

    return () => unsubProjectFiles();
  }, [user, currentProjectId, activeFileId, githubToken, projects]);

  // Load the saved AI chat thread for the active project so the full conversation survives reloads.
  useEffect(() => {
    if (!currentProjectId || !db) {
      setChatMessages(buildDefaultChatMessages());
      return undefined;
    }

    const chatMessagesRef = collection(db, 'projects', currentProjectId, 'chatMessages');
    const chatQuery = query(chatMessagesRef, orderBy('createdAt', 'asc'), limit(200));

    const unsubChatMessages = onSnapshot(chatQuery, (snapshot) => {
      const loadedMessages = snapshot.docs.map((docSnap) => {
        const data = docSnap.data() || {};
        return {
          id: docSnap.id,
          role: data.role === 'user' ? 'user' : 'assistant',
          content: typeof data.content === 'string' ? data.content : '',
          createdAt: typeof data.createdAt === 'number' ? data.createdAt : 0,
          turnId: typeof data.turnId === 'string' ? data.turnId : docSnap.id,
          pending: !!data.pending,
          status: typeof data.status === 'string' ? data.status : '',
        };
      });

      setChatMessages((current) => {
        const pendingMessages = current.filter((message) => (
          message.pending
          && typeof message.turnId === 'string'
          && message.turnId.startsWith(currentProjectId)
        ));
        const mergedMessages = [...loadedMessages];

        pendingMessages.forEach((pendingMessage) => {
          const hasCompletedMessage = mergedMessages.some(
            (message) => message.turnId === pendingMessage.turnId && message.role === pendingMessage.role && !message.pending
          );

          if (!hasCompletedMessage && !mergedMessages.some((message) => message.turnId === pendingMessage.turnId && message.role === pendingMessage.role && message.pending)) {
            mergedMessages.push(pendingMessage);
          }
        });

        return mergedMessages.length > 0 ? mergedMessages : buildDefaultChatMessages();
      });
    }, () => {
      setChatMessages(buildDefaultChatMessages());
    });

    return () => unsubChatMessages();
  }, [currentProjectId, db]);

  // RUNTIME MONACO EDITOR SCRIPT LOADER (Bypasses compile-time dependencies perfectly)
  useEffect(() => {
    if (window.monaco) {
      setMonacoLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs/loader.min.js';
    script.async = true;
    const monacoTimeout = setTimeout(() => {
      if (!window.monaco) {
        console.warn('Monaco loader timed out, falling back to plain workspace rendering.');
        setMonacoLoaded(true);
      }
    }, 10000);
    script.onload = () => {
      window.require.config({ paths: { vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.39.0/min/vs' } });
      window.require(['vs/editor/editor.main'], () => {
        clearTimeout(monacoTimeout);
        setMonacoLoaded(true);
      });
    };
    script.onerror = () => {
      clearTimeout(monacoTimeout);
      setMonacoLoaded(true);
    };
    document.body.appendChild(script);
    return () => clearTimeout(monacoTimeout);
  }, []);

  // Stable callback handler vector pointing to event listeners
  const handleEditorChange = (val) => {
    if (isInternalChangeRef.current) return;
    setFiles(prevFiles => prevFiles.map(f => f.id === activeFileIdRef.current ? { ...f, content: val || '' } : f));
  };

  const handleEditorChangeRef = useRef(handleEditorChange);
  useEffect(() => {
    handleEditorChangeRef.current = handleEditorChange;
  });

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
      handleEditorChangeRef.current(val);
    });

    return () => {
      if (changeListener) changeListener.dispose();
      if (editorInstanceRef.current) {
        editorInstanceRef.current.dispose();
      }
    };
  }, [monacoLoaded, activeFileId, theme]);

  // REAL-TIME SYNCHRONIZATION ALIGNER: Updates Monaco Editor content dynamically when changes occur
  useEffect(() => {
    if (!monacoLoaded || !editorInstanceRef.current || !currentActiveFile) return;

    const currentEditorValue = editorInstanceRef.current.getValue();
    if (currentEditorValue !== currentActiveFile.content) {
      // Intelligently save the user's cursor positions and scroll states to prevent jumping!
      const viewState = editorInstanceRef.current.saveViewState();
      isInternalChangeRef.current = true;
      editorInstanceRef.current.setValue(currentActiveFile.content);
      isInternalChangeRef.current = false;
      if (viewState) {
        editorInstanceRef.current.restoreViewState(viewState);
      }
    }
  }, [currentActiveFile?.content, monacoLoaded]);

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
        setSecondsLeft(Math.ceil(distance / 1005));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownEndTime, user]);

  // UI Split Drag Handlers
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isResizingLeft.current) setLeftWidth(Math.max(180, Math.min(400, e.clientX)));
      if (isResizingCenter.current) setCenterWidth(Math.max(300, Math.min(window.innerWidth - leftWidth - 200, e.clientX - leftWidth)));
      if (isResizingFooter.current) setFooterHeight(Math.max(120, Math.min(500, window.innerHeight - e.clientY)));
      if (isResizingChatPanel.current) {
        setChatPanelWidth(Math.max(30, Math.min(70, (e.clientX / window.innerWidth) * 100)));
      }
    };
    const handleMouseUp = () => {
      isResizingLeft.current = false;
      isResizingCenter.current = false;
      isResizingFooter.current = false;
      isResizingChatPanel.current = false;
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [leftWidth]);

  // --- PROJECT SETUP FOR COLLABORATIVE TEAMS AND GITHUB STORAGE REPOS ---
  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim() || !user) return;
    setWorkspaceError('');

    // Offline creation guard
    if (!db) {
      const newLocalId = `project-${Date.now()}`;
      const localSlug = slugifyProjectName(newProjectName.trim());
      const defaultFiles = buildDefaultProjectFiles(newProjectName.trim(), newProjectTemplate);
      const newLocalProj = {
        id: newLocalId,
        slug: localSlug,
        name: newProjectName.trim(),
        memberEmails: ['offline-developer@youthdevs.me'],
        memberUids: ['mock-user-123'],
        template: newProjectTemplate,
        files: defaultFiles
      };
      setProjects([...projects, newLocalProj]);
      setNewProjectName('');
      setNewProjectTemplate('html');
      const nextPath = buildWorkspaceProjectPath(localSlug || newLocalId);
      if (pathname !== nextPath) {
        router.push(nextPath);
      }
      return;
    }

    setIsCreatingProject(true); // Set Loading overlay status
    setProjectStatusMessage('Preparing workspace metadata...');

    const cleanedRepoName = newProjectName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-');
    const newProjectSlug = slugifyProjectName(newProjectName.trim());
    const defaultFiles = buildDefaultProjectFiles(newProjectName.trim(), newProjectTemplate);

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

        setProjectStatusMessage(`Deploying initial ${newProjectTemplate === 'nextjs' ? 'Next.js' : 'HTML'} template...`);
        await pushCommitToGithub(gitOwner, gitRepoName, 'main', defaultFiles, 'Initial project build', githubToken);
      }

      setProjectStatusMessage('Syncing project variables with team roster...');
      await addDoc(collection(db, 'projects'), {
        slug: newProjectSlug,
        name: newProjectName.trim(),
        userId: user.uid,
        memberUids: [user.uid],
        memberEmails: [(user.email || 'anonymous').trim().toLowerCase()],
        presence: {},
        template: newProjectTemplate,
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
      setNewProjectTemplate('html');
      setUseGithubForNewProject(false);
      const nextPath = buildWorkspaceProjectPath(newProjectSlug || cleanedRepoName || 'project');
      if (pathname !== nextPath) {
        router.push(nextPath);
      }
    } catch (err) {
      console.error(err);
      setWorkspaceError(err.message || 'Permission denied. Make sure your Firestore rules match your project schema!');
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

    // 3. Assembly of blob modifications arrays
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

  const syncFilesToWorkspace = async (updatedFiles, commitMessage, { skipGitHub = false } = {}) => {
    if (!currentProjectId) return;

    // Offline modification fallback handler
    if (!db) {
      setFiles(updatedFiles);
      const updatedProjects = projects.map(p => p.id === currentProjectId ? {
        ...p,
        files: updatedFiles,
        lastChange: {
          by: 'offline-developer',
          message: commitMessage,
          timestamp: Date.now()
        }
      } : p);
      setProjects(updatedProjects);
      setConsoleLogs(prev => [...prev, `SUCCESS: Simulated sync completed - "${commitMessage}"`]);
      return;
    }

    try {
      const projectRef = doc(db, 'projects', currentProjectId);
      const userHandle = user?.email ? user.email.split('@')[0] : 'anonymous';

      // IF WORKSPACE IS LINKED TO GITHUB, PUSH FILES ATOMICALLY VIA OAUTH
      if (!skipGitHub && activeProjectData?.githubRepo && activeProjectData?.githubOwner && githubToken) {
        setConsoleLogs(prev => [...prev, 'SYSTEM: Syncing multi-file updates to GitHub branch...']);
        const branch = activeProjectData.githubBranch || 'main';
        await pushCommitToGithub(
          activeProjectData.owner || activeProjectData.githubOwner,
          activeProjectData.githubRepo,
          branch,
          updatedFiles,
          commitMessage,
          githubToken
        );
      }

      // Always update Firestore "files" array with updatedFiles.
      // Keeping Firestore mirroring active allows teammates who do NOT have GitHub connected to see the latest code instantly in real-time!
      await updateDoc(projectRef, {
        files: updatedFiles,
        lastChange: {
          by: userHandle,
          message: commitMessage,
          timestamp: Date.now()
        }
      });

      // HOT RELOAD OPTIMIZATION: Update state immediately so changes render on the explorer instantly
      setFiles(updatedFiles);
      lastSyncedFilesRef.current = updatedFiles; // Avoid self-sync triggers
      setConsoleLogs(prev => [...prev, `SUCCESS: Sync completed - "${commitMessage}"`]);
    } catch (err) {
      console.error(err);
      setConsoleLogs(prev => [...prev, `CRITICAL: Sync failed: ${err.message}`]);
    }
  };

  const handleConfirmChangeCommit = async (e) => {
    e.preventDefault();
    if (!changeNameInput.trim() || !pendingFilesToSync || !currentProjectId) return;
    await syncFilesToWorkspace(pendingFilesToSync, changeNameInput.trim());
    setShowChangeModal(false);
    setPendingFilesToSync(null);
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

  // 🚀 RESTORED HELPER: Compiler Sandbox Preview Assembler
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

  const getBundledPreviewCodeFromFiles = (sourceFiles) => {
    const filesToBundle = Array.isArray(sourceFiles) ? sourceFiles : [];
    const indexFile = filesToBundle.find(f => f.name === 'index.html') || filesToBundle[0];
    if (!indexFile) return '';

    let bundledHtml = indexFile.content || '';

    filesToBundle.forEach((file) => {
      if (file.language === 'css') {
        const cssMatcher = new RegExp(`<link[^>]*href=["']\\.?/?${file.name}["'][^>]*>`, 'g');
        bundledHtml = cssMatcher.test(bundledHtml)
          ? bundledHtml.replace(cssMatcher, `<style>\n${file.content || ''}\n</style>`)
          : bundledHtml.replace('</head>', `<style>\n${file.content || ''}\n</style>\n</head>`);
      }
      if (file.language === 'javascript') {
        const jsMatcher = new RegExp(`<script[^>]*src=["']\\.?/?${file.name}["'][^>]*>\\s*</script>`, 'g');
        bundledHtml = jsMatcher.test(bundledHtml)
          ? bundledHtml.replace(jsMatcher, `<script>\n${file.content || ''}\n</script>`)
          : bundledHtml.replace('</body>', `<script>\n${file.content || ''}\n</script>\n</body>`);
      }
    });

    return bundledHtml;
  };

  const refreshSandboxPreview = async () => {
    if (renderMode === 'html') {
      setPreviewUrl('');
      setPreviewHtml(getBundledPreviewCode());
      setPreviewStatus('HTML preview refreshed from the current workspace files.');
      return;
    }

    setIsPreviewLoading(true);
    setPreviewStatus('Starting Next.js preview with npm run dev...');

    try {
      const response = await fetch('/api/preview-next', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files })
      });
      const responseText = await response.text();
      let data = null;
      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        const previewError = responseText.includes('<!DOCTYPE') || responseText.includes('<html')
          ? 'Preview returned an HTML error page instead of JSON.'
          : responseText || 'Next.js preview failed to start.';
        throw new Error(previewError);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Next.js preview failed to start.');
      }

      setPreviewHtml('');
      setPreviewUrl(`${data.url}?preview=${Date.now()}`);
      setPreviewStatus(`Next.js preview running at ${data.url}`);
    } catch (err) {
      setPreviewUrl('');
      setPreviewHtml(`<!DOCTYPE html>
<html>
<body style="margin:0;background:#050b08;color:#fecdd3;font-family:monospace;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;box-sizing:border-box;text-align:center;">
  <div>
    <strong>Next.js preview failed</strong>
    <div style="margin-top:10px;color:#94a3b8;line-height:1.5;">${String(err.message || err).replace(/[<>&"]/g, '')}</div>
  </div>
</body>
</html>`);
      setPreviewStatus(err.message || 'Next.js preview failed to start.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const previewPlaceholderHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0;
      width: 100%;
      height: 100%;
      background: #ffffff;
      color: #0f172a;
      font-family: monospace;
    }
    .wrap {
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
      box-sizing: border-box;
    }
    .card {
      max-width: 360px;
      border: 1px solid rgba(148, 163, 184, 0.35);
      background: rgba(255, 255, 255, 0.96);
      border-radius: 16px;
      padding: 18px;
      box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
    }
    .title {
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
    }
    .body {
      font-size: 12px;
      line-height: 1.6;
      color: #475569;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="title">Preview paused</div>
      <div class="body">Click Refresh Preview to re-render the current project in the sandbox.</div>
    </div>
  </div>
</body>
</html>`;

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

  // --- TASK PIPELINE RUNNER ---
  const handleAgenticVibeSubmit = async (e) => {
    e.preventDefault();
    const userMessage = promptInput.trim();
    if (!userMessage || isAiLoading || !currentProjectId) return;

    if (isSupercharged && cooldownEndTime) {
      alert(`Supercharge lock active. Wait ${secondsLeft} seconds.`);
      return;
    }

    const turnId = `${currentProjectId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const userMessageEntry = {
      role: 'user',
      content: userMessage,
      createdAt: Date.now(),
      turnId,
      status: 'sent',
      authorUid: user?.uid || null,
      authorEmail: user?.email || null,
    };
    const pendingAssistantEntry = {
      id: `${turnId}-pending`,
      role: 'assistant',
      content: 'Thinking through your request...',
      createdAt: Date.now(),
      turnId,
      pending: true,
      status: 'pending',
    };

    setIsAiLoading(true);
    setPromptInput('');
    setChatMessages((current) => {
      const baseMessages = current.length === 1 && current[0]?.id === 'welcome' ? [] : current;
      return [...baseMessages, userMessageEntry, pendingAssistantEntry];
    });
    setConsoleLogs([`TASK: "${userMessage}"`, 'SYSTEM: Preparing workspace context...']);

    const keepStreaming = { current: true };
    const streamId = triggerMatrixTerminalStream(keepStreaming);

    const repositoryStructure = files.map(f => ({ name: f.name, language: f.language }));
    const selectedContextContents = files.filter(f => selectedContextIds.includes(f.id)).map(f => ({ name: f.name, content: f.content }));
    const targetModel = isSupercharged ? 'gemini-3.5-flash' : 'gemini-3.1-flash-lite';
    const chatMessagesRef = db && currentProjectId
      ? collection(db, 'projects', currentProjectId, 'chatMessages')
      : null;
    let chatHistoryWriteEnabled = !!chatMessagesRef;

    if (chatMessagesRef) {
      try {
        await addDoc(chatMessagesRef, userMessageEntry);
      } catch (error) {
        chatHistoryWriteEnabled = false;
        console.warn('Failed to persist user chat message:', error?.message || error);
      }
    }

    try {
      const response = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: userMessage,
          repositoryStructure,
          contextFiles: selectedContextContents,
          modelSelection: targetModel
        })
      });

      const data = await response.json();
      keepStreaming.current = false;
      clearInterval(streamId);
      const assistantMessage = typeof data.chatResponse === 'string' && data.chatResponse.trim()
        ? data.chatResponse.trim()
        : typeof data.error === 'string' && data.error.trim()
          ? data.error.trim()
          : 'I finished the task, but the model did not return a readable explanation.';

      setChatMessages((current) => {
        let replaced = false;
        const nextMessages = current.map((message) => {
          if (message.turnId === turnId && message.pending && message.role === 'assistant') {
            replaced = true;
            return {
              ...message,
              content: assistantMessage,
              pending: false,
              status: 'complete',
              createdAt: Date.now(),
            };
          }

          return message;
        });

        if (!replaced) {
          nextMessages.push({
            id: `${turnId}-assistant`,
            role: 'assistant',
            content: assistantMessage,
            createdAt: Date.now(),
            turnId,
            pending: false,
            status: 'complete',
          });
        }

        return nextMessages;
      });

      if (chatHistoryWriteEnabled && chatMessagesRef) {
        try {
          await addDoc(chatMessagesRef, {
            role: 'assistant',
            content: assistantMessage,
            createdAt: Date.now(),
            turnId,
            status: data.error ? 'error' : 'complete',
            authorUid: user?.uid || null,
            authorEmail: user?.email || null,
            modelSelection: targetModel,
          });
        } catch (error) {
          console.warn('Failed to persist assistant chat message:', error?.message || error);
        }
      }

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
              updatedFilesList.push({ id: `file-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`, name: targetName, language, content: patch.content || '' });
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
        setConsoleLogs(prev => [...prev, ...actionLogs.map(l => `SUCCESS: ${l}`), 'COMPLETED: Changes applied. Preparing team update commit...']);
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

        // Apply AI changes immediately without forcing a commit prompt.
        const aiSummary = userMessage
          ? `AI update: ${userMessage.slice(0, 72)}${userMessage.length > 72 ? '...' : ''}`
          : 'AI update';
        await syncFilesToWorkspace(updatedFilesList, aiSummary, { skipGitHub: false });
      } else {
        setConsoleLogs(prev => [...prev, `CRITICAL: Compilation failed. ${data.error || 'Check server configuration structure.'}`]);
      }
    } catch (err) {
      keepStreaming.current = false; clearInterval(streamId);
      setConsoleLogs(prev => [...prev, 'CRITICAL: Engine compilation network failure.']);
      const failureMessage = 'I hit a network error while trying to complete your request. Please try again.';
      setChatMessages((current) => {
        let replaced = false;
        const nextMessages = current.map((message) => {
          if (message.turnId === turnId && message.pending && message.role === 'assistant') {
            replaced = true;
            return {
              ...message,
              content: failureMessage,
              pending: false,
              status: 'error',
              createdAt: Date.now(),
            };
          }

          return message;
        });

        if (!replaced) {
          nextMessages.push({
            id: `${turnId}-assistant-error`,
            role: 'assistant',
            content: failureMessage,
            createdAt: Date.now(),
            turnId,
            pending: false,
            status: 'error',
          });
        }

        return nextMessages;
      });
      if (chatHistoryWriteEnabled && chatMessagesRef) {
        addDoc(chatMessagesRef, {
          role: 'assistant',
          content: failureMessage,
          createdAt: Date.now(),
          turnId,
          status: 'error',
          authorUid: user?.uid || null,
          authorEmail: user?.email || null,
          modelSelection: targetModel,
        }).catch((error) => {
          console.warn('Failed to persist failed assistant chat message:', error?.message || error);
        });
      }
      console.error(err);
    } finally {
      setIsAiLoading(false);
    }
  };

  // --- HACKATHON ASSIGNMENT FLOW FOR USERS (LIMIT TO 1 ACTIVE ASSIGNED PROJECT) ---
  const handleToggleDeemHackathon = async (projectId, currentStatus) => {
    if (!db || !user) return;
    setWorkspaceError('');

    try {
      // Update the selected project first. A stale or inaccessible legacy
      // project must not prevent this project from being deemed for submission.
      await updateDoc(doc(db, 'projects', projectId), {
        isHackathonProject: !currentStatus,
      });

      if (!currentStatus) {
        const cleanupResults = await Promise.allSettled(
          projects
            .filter((project) => project.id !== projectId && project.isHackathonProject)
            .map((project) => updateDoc(doc(db, 'projects', project.id), { isHackathonProject: false }))
        );
        const cleanupFailures = cleanupResults.filter((result) => result.status === 'rejected');
        if (cleanupFailures.length) {
          console.warn('Some previous hackathon selections could not be cleared:', cleanupFailures);
        }
      }
    } catch (err) {
      console.error(err);
      setWorkspaceError("Failed to update Hackathon configuration status.");
    }
  };

  // --- SUBMIT WORKSPACE TO ADMIN FOR GRADING ---
  const handleSubmitProjectToAdmin = async (projectId) => {
    if (!db || !user) return;
    try {
      const projectToSubmit = projects.find((proj) => proj.id === projectId) || activeProjectData;
      const submittedFiles = Array.isArray(projectToSubmit?.files)
        ? projectToSubmit.files.map((file) => ({ ...file }))
        : [];
      const projectSlug = slugifyProjectName(projectToSubmit?.slug || projectToSubmit?.name || projectToSubmit?.id || projectId);
      const projectName = projectToSubmit?.name || 'Untitled Project';
      const submittedAt = Date.now();
      const submittedBy = user.email || user.uid;

      const pRef = doc(db, 'projects', projectId);
      await updateDoc(pRef, {
        submitted: true,
        submittedAt,
        submittedBy,
        submittedFiles
      });

      await setDoc(doc(db, 'adminSubmissions', projectId), {
        projectId,
        projectSlug,
        projectName,
        memberEmails: Array.isArray(projectToSubmit?.memberEmails) ? projectToSubmit.memberEmails : [],
        memberUids: Array.isArray(projectToSubmit?.memberUids) ? projectToSubmit.memberUids : [],
        submitted: true,
        submittedAt,
        submittedBy,
        submittedFiles
      }, { merge: true });
    } catch (err) {
      console.error(err);
      alert("Failed to submit code template files to Admin.");
    }
  };

  const openAdminSubmissionFiles = (project) => {
    const filesToInspect = Array.isArray(project?.submittedFiles) && project.submittedFiles.length > 0
      ? project.submittedFiles
      : Array.isArray(project?.files) ? project.files : [];

    setSelectedAdminProjectFiles(filesToInspect);
    if (filesToInspect.length > 0) {
      setAdminActiveFileName(filesToInspect[0].name || '');
      setAdminActiveFileContent(filesToInspect[0].content || '');
    } else {
      setAdminActiveFileName('');
      setAdminActiveFileContent('');
    }
  };

  // --- GLOBAL ADMIN CONFIGURATION ACTIONS (Optimistic toggling for instant responsiveness!) ---
  const handleToggleHackathonEvent = async () => {
    const nextState = !hackathonActive;
    setHackathonActive(nextState); // Optimistic update so switch animates instantly

    if (!db || !isAdmin) return;
    try {
      const configRef = doc(db, 'system', 'hackathon');
      await setDoc(configRef, { active: nextState }, { merge: true });
    } catch (err) {
      console.error("Failed to sync Hackathon activation to Firestore:", err);
    }
  };

  const handleToggleSubmissionGate = async () => {
    const nextState = !submissionsEnabled;
    setSubmissionsEnabled(nextState); // Optimistic update so switch animates instantly

    if (!db || !isAdmin) return;
    try {
      const configRef = doc(db, 'system', 'hackathon');
      await setDoc(configRef, { submissionsEnabled: nextState }, { merge: true });
    } catch (err) {
      console.error("Failed to sync Submission gating to Firestore:", err);
    }
  };

  if (authLoading) {
    return (
      <div className={`h-screen w-screen flex flex-col gap-4 items-center justify-center font-mono text-xs ${theme === 'dark' ? 'bg-[#050b08] text-emerald-300' : 'bg-[#eef7f1] text-emerald-700'}`}>
        <div className="h-6 w-6 border-2 border-emerald-500 border-t-transparent animate-spin rounded-full"></div>
        Loading YouthDevs IDE...
        {authBootError && <span className="text-[11px] text-slate-500 px-4 text-center max-w-md">{authBootError}</span>}
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`h-screen w-screen flex items-center justify-center font-mono text-xs ${theme === 'dark' ? 'bg-[#050b08] text-emerald-300' : 'bg-[#eef7f1] text-emerald-700'}`}>
        Opening sign-in screen...
      </div>
    );
  }

  if (routeMode === 'project' && !currentProjectId) {
    return (
      <div className={`h-screen w-screen flex flex-col gap-4 items-center justify-center font-mono text-xs px-6 text-center ${theme === 'dark' ? 'bg-[#050b08] text-emerald-300' : 'bg-[#eef7f1] text-emerald-700'}`}>
        <span>{routeLookupComplete && routeLookupError ? routeLookupError : 'Resolving project workspace...'}</span>
        {routeLookupComplete && routeLookupError && (
          <button
            type="button"
            onClick={() => router.push(WORKSPACE_PATH)}
            className="rounded-lg border border-emerald-500/40 px-3 py-2 text-[11px] text-emerald-300 transition hover:bg-emerald-500/10"
          >
            Return to workspace
          </button>
        )}
      </div>
    );
  }

  if (routeMode === 'admin-project') {
    const adminSubmissionProjectData = routeProject || activeProjectData;
    const adminSubmissionFiles = Array.isArray(adminSubmissionProjectData?.submittedFiles) && adminSubmissionProjectData.submittedFiles.length > 0
      ? adminSubmissionProjectData.submittedFiles
      : Array.isArray(adminSubmissionProjectData?.files) ? adminSubmissionProjectData.files : [];
    return <AdminSubmissionWorkspace project={adminSubmissionProjectData} theme={theme} onBack={() => router.push('/admin')} activeFileName={adminActiveFileName} activeFileContent={adminActiveFileContent} onSelectFile={(file) => { setAdminActiveFileName(file.name || ''); setAdminActiveFileContent(typeof file.content === 'string' ? file.content : ''); }} viewTab={adminViewTab} onViewTabChange={setAdminViewTab} previewHtml={getBundledPreviewCodeFromFiles(adminSubmissionFiles)} previewPlaceholderHtml={previewPlaceholderHtml} />;
  }

  // --- RENDER 2: DASHBOARD VIEW PANEL ---
  if (!currentProjectId) {
    return (
      <div className={`h-screen w-screen flex flex-col font-sans transition-colors duration-200 relative ${theme === 'dark' ? 'bg-[#050b08] text-slate-200' : 'bg-[#eef7f1] text-slate-800'}`}>

        {/* PROJECT CREATION LOADER OVERLAY STATUS PANEL */}
        {isCreatingProject && (
          <div className={`absolute inset-0 backdrop-blur-md flex flex-col items-center justify-center z-50 p-4 font-mono text-xs gap-3 ${theme === 'dark' ? 'bg-[#050b08]/85 text-emerald-300' : 'bg-white/85 text-emerald-700'}`}>
            <div className="h-8 w-8 border-4 border-emerald-500 border-t-transparent animate-spin rounded-full" />
            <span className="uppercase tracking-widest font-bold">Configuring Collaboration Layer</span>
            <span className={`text-[11px] animate-pulse ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>⚙️ {projectStatusMessage}</span>
          </div>
        )}

        <header className={`h-14 border-b px-6 flex items-center justify-between transition-colors ${theme === 'dark' ? 'border-emerald-900/30 bg-[#07120c]/70' : 'border-emerald-200 bg-white/80'}`}>
          <div className="flex items-center gap-3">
            <div className="h-7 w-7 bg-emerald-600 rounded-md flex items-center justify-center font-black text-sm text-white shadow-md shadow-emerald-950/20">Y</div>
            <span className={`text-xs font-bold uppercase tracking-widest ${theme === 'dark' ? 'text-slate-300' : 'text-slate-700'}`}>YouthDevs Central Hub</span>
          </div>
          <div className="flex items-center gap-4">

            {/* ADMIN ACCESS CONTEXT SWITCHER TRIGGER BUTTON */}
            {canAccessAdminPanel && (
              <button
                onClick={() => {
                  const nextPath = isAdminRoute ? WORKSPACE_PATH : '/admin';
                  if (pathname !== nextPath) router.push(nextPath);
                }}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold border hover:scale-105 transition-all ${isAdminRoute
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : theme === 'dark' ? 'bg-[#08140d] border-emerald-900/30 text-slate-300' : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  }`}
              >
                <ShieldAlert size={12} />
                <span>{isAdminRoute ? "Switch to Dashboard" : "Admin Panel"}</span>
              </button>
            )}

            {/* DYNAMIC GITHUB HUBLINK CONTROLLER INDICATOR */}
            {githubUser ? (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border ${theme === 'dark' ? 'bg-emerald-950/20 border-emerald-900/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                <Github size={11} />
                <span>Git Connected: <b>{githubUser.login}</b></span>
              </div>
            ) : (
              <button onClick={handleGithubSignIn} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold border hover:scale-105 transition-all ${theme === 'dark' ? 'bg-amber-950/25 border-amber-900/30 text-amber-400' : 'bg-emerald-50 border-emerald-200 text-emerald-800'}`}>
                <Github size={11} />
                <span>Link GitHub Account</span>
              </button>
            )}

            {isAdmin && (
              <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium border ${theme === 'dark' ? 'bg-emerald-950/25 border-emerald-900/40 text-emerald-300' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>
                <Users size={12} />
                <span>IDE Users: <b className="font-mono font-bold">{totalUsers !== undefined && totalUsers !== null ? totalUsers : '...'}</b></span>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg border transition-all shrink-0 ${theme === 'dark' ? 'border-emerald-900/30 text-emerald-300 hover:bg-[#0b1810]' : 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'}`}
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

        {/* CONDITIONAL RENDER: HACKATHON ADMIN CONTROLLER PANEL VIEW */}
        {canAccessAdminPanel && isAdminRoute ? (
          <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 overflow-y-auto">
          <div className={`border p-6 rounded-2xl mb-8 ${theme === 'dark' ? 'bg-gradient-to-r from-emerald-950/35 via-slate-950 to-emerald-900/20 border-emerald-900/30' : 'bg-gradient-to-r from-emerald-50 via-white to-emerald-50 border-emerald-200'}`}>
              <div className="flex items-center gap-2 text-emerald-300 font-bold mb-2">
                <ShieldAlert size={20} />
                <h2 className="text-lg">Hackathon Control Center</h2>
              </div>
              <p className={`text-xs max-w-xl ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                As a project administrator, you can toggle global Hackathon event registrations, open submission gateways, and dynamically view/inspect active submission source trees in real-time.
              </p>
              <div className="mt-4 flex flex-wrap gap-2 text-[10px] font-mono">
                <span className={`px-2 py-1 rounded-full border ${customDomainMode ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' : theme === 'dark' ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-white text-slate-600 border-emerald-200'}`}>
                  Domain mode: {customDomainMode ? 'Custom youthdevs.me aliases' : 'Standard vercel.app aliases'}
                </span>
                <span className={`px-2 py-1 rounded-full border ${theme === 'dark' ? 'bg-slate-900 text-slate-400 border-slate-800' : 'bg-white text-emerald-700 border-emerald-200'}`}>
                  Submissions: {adminSubmissions.length}
                </span>
              </div>

              <div className={`mt-4 flex items-center justify-between p-3.5 rounded-xl max-w-md ${theme === 'dark' ? 'bg-slate-950/40 border border-slate-800/80' : 'bg-white border border-emerald-200'}`}>
                <div className="flex flex-col gap-0.5">
                  <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-emerald-900'}`}>Domain Mode Override</span>
                  <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Switch between youthdevs.me aliases and standard vercel.app links</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCustomDomainMode((prev) => !prev)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ease-in-out duration-200 outline-none ${customDomainMode ? 'bg-emerald-600' : 'bg-slate-800'
                    }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${customDomainMode ? 'translate-x-5' : 'translate-x-0'
                      }`}
                  />
                </button>
              </div>

              {/* BEAUTIFUL VISUAL SWITCH TOGGLES (iOS-style optimistic interactive switches) */}
              <div className="mt-6 flex flex-col gap-5 max-w-md">

                {/* Switch 1: Global Hackathon Event */}
                <div className={`flex items-center justify-between p-3.5 rounded-xl ${theme === 'dark' ? 'bg-slate-950/40 border border-emerald-900/30' : 'bg-white border border-emerald-200'}`}>
                  <div className="flex flex-col gap-0.5">
                    <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-emerald-900'}`}>Hackathon Event Status</span>
                    <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Toggle student assignment registration badges globally</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleHackathonEvent}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ease-in-out duration-200 outline-none ${hackathonActive ? 'bg-rose-600' : 'bg-slate-800'
                      }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${hackathonActive ? 'translate-x-5' : 'translate-x-0'
                        }`}
                    />
                  </button>
                </div>

                {/* Switch 2: Submission Gate (Rendered when event is active) */}
                {hackathonActive && (
                  <div className={`flex items-center justify-between p-3.5 rounded-xl animate-fade-in ${theme === 'dark' ? 'bg-slate-950/40 border border-emerald-900/30' : 'bg-white border border-emerald-200'}`}>
                    <div className="flex flex-col gap-0.5">
                      <span className={`text-xs font-bold ${theme === 'dark' ? 'text-slate-200' : 'text-emerald-900'}`}>Submission Gateway Portal</span>
                      <span className={`text-[10px] ${theme === 'dark' ? 'text-slate-500' : 'text-slate-600'}`}>Enable "Submit to Admin" buttons on student repos</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleToggleSubmissionGate}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ease-in-out duration-200 outline-none ${submissionsEnabled ? 'bg-emerald-600' : 'bg-slate-800'
                        }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ease-in-out duration-200 ${submissionsEnabled ? 'translate-x-5' : 'translate-x-0'
                          }`}
                      />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center mb-4">
              <h3 className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1 ${theme === 'dark' ? 'text-slate-500' : 'text-emerald-700'}`}>
                <Award size={14} /> Registered Hackathon Submissions ({adminSubmissions.length})
              </h3>
            </div>

            {adminSubmissions.length === 0 ? (
              <div className={`text-center py-12 border border-dashed rounded-xl text-xs font-mono ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-emerald-200 text-emerald-700'}`}>
                No active student teams have flagged their repositories as hackathon submissions yet.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {adminSubmissions.map(proj => (
                  <div key={proj.id} className={`p-4 border rounded-xl flex items-center justify-between ${theme === 'dark' ? 'bg-slate-900/60 border-slate-800' : 'bg-white border-emerald-200'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <Folder size={15} className="text-emerald-500" />
                        <span className={`text-sm font-bold ${theme === 'dark' ? 'text-white' : 'text-emerald-950'}`}>{proj.projectName || proj.name}</span>
                        {proj.submitted ? (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Submitted</span>
                        ) : (
                          <span className="text-[10px] bg-amber-500/20 text-amber-500 border border-amber-500/30 px-2 py-0.5 rounded font-bold uppercase tracking-wider">In Progress</span>
                        )}
                      </div>
                      <div className={`text-[11px] mt-2 font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                        Team Members: {proj.memberEmails?.join(', ')}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                      onClick={() => {
                        const nextSlug = slugifyProjectName(proj.projectSlug || proj.slug || proj.projectName || proj.name || proj.id || '');
                        if (!nextSlug) return;
                        setSelectedAdminProjectFiles(null);
                        setAdminActiveFileName('');
                        setAdminActiveFileContent('');
                        const nextPath = buildAdminProjectPath(nextSlug);
                        if (pathname !== nextPath) {
                          router.push(nextPath);
                        }
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors"
                    >
                        <FileSearch size={13} />
                        View Files
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        ) : (
          <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-10 overflow-y-auto">
            {/* OFFLINE DEMONSTRATION WORKSPACE CALLOUT */}
            {!db && (
              <div className="mb-6 p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-500 text-xs font-mono">
                ⚠️ Simulated Localhost Demo Mode. To unlock persistent team databases, dynamic presence badges, and GitHub API handshakes, configure your <b>__firebase_config</b> environment values.
              </div>
            )}

            {/* HACKATHON LIVE NOTIFICATION FOR USERS */}
            {hackathonActive && (
              <div className={`mb-6 p-5 rounded-2xl border flex items-center justify-between flex-wrap gap-3 ${theme === 'dark' ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-emerald-200 bg-emerald-50'}`}>
                <div>
                  <div className={`flex items-center gap-1.5 font-bold text-sm ${theme === 'dark' ? 'text-emerald-400' : 'text-emerald-700'}`}>
                    <Award size={16} />
                    <span>Active Hackathon Event is LIVE!</span>
                  </div>
                  <p className={`text-[11px] mt-1 max-w-xl font-mono ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>
                    Deem one of your active projects below as your team submission to present it to the admins for validation.
                  </p>
                </div>
                {submissionsEnabled && (
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider animate-pulse shrink-0">Submissions Open</span>
                )}
              </div>
            )}

            <div className={`border p-6 rounded-2xl mb-8 transition-colors ${theme === 'dark' ? 'bg-gradient-to-r from-emerald-950/35 to-slate-900 border-slate-800/80' : 'bg-gradient-to-r from-emerald-50/70 to-white border-emerald-200'}`}>
              <h2 className={`text-xl font-black ${theme === 'dark' ? 'text-white' : 'text-emerald-950'}`}>Welcome Back to YouthDevs IDE</h2>
              <p className={`text-xs mt-1 max-w-lg ${theme === 'dark' ? 'text-slate-400' : 'text-slate-600'}`}>Build collaborative multi-file web apps with your team of up to 3 members. Connect GitHub if you want to sync a project repo while you work.</p>

              <form onSubmit={handleCreateProject} className="mt-4 flex flex-col gap-3 max-w-md">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New project or repository name..."
                    value={newProjectName}
                    onChange={e => setNewProjectName(e.target.value)}
                    required
                    className={`flex-1 border text-xs px-3 py-2.5 rounded-lg outline-none transition-colors ${theme === 'dark' ? 'bg-slate-950 border-slate-800 focus:border-emerald-500 text-slate-200' : 'bg-white border-emerald-200 focus:border-emerald-500 text-slate-900'}`}
                  />
                  <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 rounded-lg flex items-center gap-1 transition shadow-lg shadow-emerald-650/10 shrink-0">
                    <Plus size={14} /> Create Repo
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'html', label: 'Default HTML', detail: 'index.html starter' },
                    { value: 'nextjs', label: 'Default Next.js', detail: 'app router starter' }
                  ].map((templateOption) => {
                    const isSelected = newProjectTemplate === templateOption.value;
                    return (
                      <button
                        key={templateOption.value}
                        type="button"
                        onClick={() => setNewProjectTemplate(templateOption.value)}
                        className={`text-left rounded-lg border px-3 py-2 transition-colors ${isSelected
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-200'
                          : theme === 'dark'
                            ? 'border-slate-800 bg-slate-950/40 text-slate-300 hover:border-emerald-500/50'
                            : 'border-emerald-200 bg-white text-emerald-950 hover:border-emerald-400'
                          }`}
                      >
                        <span className="flex items-center gap-2 text-xs font-bold">
                          {isSelected ? <CheckSquare size={13} /> : <Square size={13} />}
                          {templateOption.label}
                        </span>
                        <span className={`mt-1 block text-[10px] ${isSelected ? 'text-emerald-200/80' : theme === 'dark' ? 'text-slate-500' : 'text-emerald-700'}`}>
                          {templateOption.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* GITHUB ENABLE SYNC TOGGLE */}
                {githubUser && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none py-1">
                    <input
                      type="checkbox"
                      checked={useGithubForNewProject}
                      onChange={e => setUseGithubForNewProject(e.target.checked)}
                      className="rounded border-emerald-300 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-emerald-50 h-4 w-4 bg-white"
                    />
                    <span className={`text-xs font-medium flex items-center gap-2 ${theme === 'dark' ? 'text-slate-300' : 'text-emerald-900'}`}>
                      Initialize workspace as a private GitHub Repository
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-700 border border-emerald-500/30 px-1.5 py-0.5 rounded font-bold uppercase shrink-0">WIP</span>
                      <span className="text-[11px] opacity-75">({newProjectName.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '-')})</span>
                    </span>
                  </label>
                )}
              </form>

              {/* Workspace Error Panel displaying Firestore Permission issues beautifully */}
              {workspaceError && (
                <p className="text-xs text-rose-400 font-mono mt-3 bg-rose-500/10 border border-rose-500/20 p-2.5 rounded-lg animate-shake">
                  ⚠️ {workspaceError}
                </p>
              )}
            </div>

            <h3 className={`text-xs font-bold uppercase tracking-widest mb-3 ${theme === 'dark' ? 'text-slate-500' : 'text-emerald-700'}`}>Your Persistent Team Repositories</h3>
            {projects.length === 0 ? (
              <div className={`text-center py-12 border border-dashed rounded-xl text-xs font-mono ${theme === 'dark' ? 'border-slate-800 text-slate-500' : 'border-emerald-200 text-emerald-700'}`}>No active projects found. Type a title above to spawn your team repository.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {projects.map(proj => (
                  <div
                    key={proj.id}
                    onClick={() => {
                      setFiles([]);
                      setActiveFileId('');
                      setInviteStatus('');
                      setCurrentProjectId(proj.id);
                    }}
                    className={`p-4 border rounded-xl cursor-pointer transition-all group relative ${theme === 'dark' ? 'bg-slate-900 border-slate-800 hover:border-emerald-500/40 text-slate-300' : 'bg-white border-emerald-200 hover:border-emerald-500/45 text-slate-700 shadow-sm hover:shadow'}`}
                  >
                    <div className={`flex items-center justify-between font-bold text-sm transition-colors ${theme === 'dark' ? 'group-hover:text-emerald-500' : 'group-hover:text-emerald-700'}`}>
                      <div className="flex items-center gap-2.5">
                        <Folder size={16} className="text-emerald-500" />
                        {proj.name}
                      </div>
                      <div className={`flex items-center gap-2 text-[10px] px-1.5 py-0.5 rounded ${theme === 'dark' ? 'text-slate-400 bg-slate-500/10' : 'text-emerald-700 bg-emerald-50'}`}>
                        <Users size={10} />
                        <span>{proj.memberUids?.length || 1}/3</span>
                        {proj.githubRepo && <Github size={10} className="fill-emerald-500 text-emerald-500 shrink-0 ml-0.5" />}
                      </div>
                    </div>

                    {/* HACKATHON ASSIGNMENT TOGGLE BUTTONS */}
                    {hackathonActive && (
                      <div className="mt-3 flex gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleDeemHackathon(proj.id, proj.isHackathonProject || false)}
                          className={`px-2 py-1 rounded text-[10px] font-mono font-bold border transition-all flex items-center gap-1 ${proj.isHackathonProject
                            ? 'bg-emerald-600/20 border-emerald-500 text-emerald-400'
                            : theme === 'dark'
                              ? 'bg-slate-950 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'
                              : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300'
                            }`}
                        >
                          {proj.isHackathonProject ? <CheckSquare size={10} /> : <Square size={10} />}
                          Deemed Submission
                        </button>

                        {/* SUBMIT BUTTON */}
                        {proj.isHackathonProject && submissionsEnabled && !proj.submitted && (
                          <button
                            onClick={() => handleSubmitProjectToAdmin(proj.id)}
                            className="px-2 py-1 rounded text-[10px] font-mono font-bold bg-emerald-600 text-white hover:bg-emerald-500 shadow-md shadow-emerald-650/15"
                          >
                            Submit to Admin
                          </button>
                        )}
                      </div>
                    )}

                    <div className={`flex justify-between items-center mt-4 text-[10px] font-mono ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>
                      <span className="truncate max-w-[150px]">Members: {proj.memberEmails?.map(m => m.split('@')[0]).join(', ')}</span>
                      <span className="text-emerald-500 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all shrink-0">Open Workspace <ChevronRight size={10} /></span>
                    </div>

                    <div className="mt-3 flex justify-start" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => submitProjectToSkipCourse(proj, 'Submitting project to SkipCourse...')}
                        disabled={skipCourseSubmittingProjectId === (proj?.id || proj?.slug || proj?.name || '')}
                        aria-busy={skipCourseSubmittingProjectId === (proj?.id || proj?.slug || proj?.name || '')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 text-xs font-bold transition-colors hover:bg-emerald-500/20 hover:border-emerald-400/30 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <Save size={12} />
                        {skipCourseSubmittingProjectId === (proj?.id || proj?.slug || proj?.name || '')
                          ? 'Sending to SkipCourse...'
                          : 'Send to SkipCourse'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </main>
        )}
      </div>
    );
  }

  // --- RENDER 3: PRIMARY WORKSPACE IDE VIEW ---
  return (
    <div className={`flex flex-col h-screen w-screen font-sans overflow-hidden select-none transition-colors duration-200 ${theme === 'dark' ? 'bg-[#050b08] text-slate-200' : 'bg-[#eef7f1] text-slate-800'}`}>
      <WorkspaceHeader
        theme={theme}
        user={user}
        activeProjectData={activeProjectData}
        totalUsers={totalUsers}
        isAdmin={isAdmin}
        inviteStatus={inviteStatus}
        teammateEmailInput={teammateEmailInput}
        onBackToDashboard={() => setCurrentProjectId(null)}
        onToggleTheme={toggleTheme}
        onSignOut={() => signOut(auth)}
        onAddTeammateSubmit={handleAddTeammateSubmit}
        onTeammateEmailChange={setTeammateEmailInput}
        onToggleSupercharge={() => !cooldownEndTime && setIsSupercharged(!isSupercharged)}
        cooldownEndTime={cooldownEndTime}
        secondsLeft={secondsLeft}
        superchargeUses={superchargeUses}
        isSupercharged={isSupercharged}
        isCooldownActive={!!cooldownEndTime}
      />

      <main className="flex flex-1 w-full overflow-hidden relative min-h-0">

        {/* EXPLORER TREE VIEW PANEL WITH LIVE PRESENCE BADGES */}
        <section style={{ width: `${leftWidth}px` }} className={`border-r flex flex-col h-full shrink-0 overflow-hidden transition-colors ${theme === 'dark' ? 'border-emerald-900/25 bg-[#07120c]/45' : 'border-emerald-200 bg-white/80'}`}>
          <div className={`p-3 border-b flex items-center justify-between shrink-0 transition-colors ${theme === 'dark' ? 'border-emerald-900/20 bg-[#08140d]/60 text-slate-300' : 'border-emerald-200 bg-white/80 text-slate-700'}`}>
            <span className="text-xs font-bold tracking-wider uppercase">Filesystem</span>
            <button onClick={() => setShowNewFileInput(!showNewFileInput)} className={`p-1 rounded transition-colors ${theme === 'dark' ? 'hover:bg-slate-800 text-slate-400 hover:text-white' : 'hover:bg-emerald-50 text-slate-500 hover:text-slate-700'}`}><Plus size={14} /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 custom-scrollbar">
            {showNewFileInput && (
              <form onSubmit={handleCreateFile} className="mb-2">
                <input type="text" autoFocus placeholder="filename.html..." value={newFileName} onChange={e => setNewFileName(e.target.value)} onBlur={() => setTimeout(() => setShowNewFileInput(false), 200)} className={`w-full border rounded px-2 py-1 text-xs outline-none font-mono ${theme === 'dark' ? 'bg-[#050b08] border-emerald-500 text-slate-200' : 'bg-white border-emerald-200 text-slate-900 placeholder-slate-400'}`} />
              </form>
            )}
            {files.map(file => {
              const isActive = file.id === activeFileId;

              // Presence detection lookups
              const currentFileViewer = activeProjectData?.presence?.[file.id];
              const isTeammateActiveHere = currentFileViewer && currentFileViewer !== (user.email ? user.email.split('@')[0] : 'anonymous');

              return (
                <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer group text-xs font-mono border transition-all ${isActive
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
            <div className={`p-3 border-t shrink-0 transition-colors text-[11px] font-mono flex flex-col gap-1.5 ${theme === 'dark' ? 'border-slate-800/60 bg-slate-900/40' : 'border-slate-200 bg-slate-50'}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme === 'dark' ? 'text-slate-500' : 'text-slate-500'}`}>Active Team</div>
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
                      <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-emerald-500' : index === 1 ? 'bg-orange-500' : 'bg-blue-500'
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
        <section style={{ width: `${centerWidth}px` }} className={`flex flex-col h-full shrink-0 overflow-hidden border-r transition-colors ${theme === 'dark' ? 'bg-[#07120c] border-emerald-900/25' : 'bg-white border-emerald-200'}`}>
          <div className={`h-9 border-b flex items-center justify-between overflow-x-auto shrink-0 select-none transition-colors ${theme === 'dark' ? 'bg-[#08140d]/60 border-emerald-900/20' : 'bg-emerald-50/80 border-emerald-200'}`}>
            <div className="flex items-center overflow-x-auto">
              {files.map(file => {
                const isActive = file.id === activeFileId;
                return (
                  <div key={file.id} onClick={() => setActiveFileId(file.id)} className={`h-9 flex items-center gap-2 px-4 text-xs font-mono border-r cursor-pointer transition-all shrink-0 ${isActive
                    ? theme === 'dark' ? 'bg-[#0b1810] border-t-2 border-t-emerald-500 text-slate-100 border-r-emerald-900/20' : 'bg-white border-t-2 border-t-emerald-500 text-emerald-900 border-r-emerald-200'
                    : theme === 'dark' ? 'bg-[#07120c] text-slate-400 border-r-emerald-900/20' : 'bg-emerald-50 text-slate-500 border-r-emerald-200'
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
                className="flex items-center gap-1 text-[11px] font-bold px-3 py-1 mr-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950/20 hover:scale-105 animate-pulse"
              >
                <Save size={12} />
                <span>{activeProjectData?.githubRepo ? 'Push GitHub Commit' : 'Push Team Change'}</span>
              </button>
            )}

            <div className="flex items-center gap-2 mr-2">
              <input
                type="text"
                value={deployProjectName}
                onChange={(e) => setDeployProjectName(e.target.value)}
                placeholder="Vercel project name"
                className={`w-40 text-xs font-mono px-3 py-1.5 rounded-lg border outline-none transition-colors ${theme === 'dark'
                  ? 'bg-[#050b08] border-emerald-900/35 text-slate-200 placeholder-slate-500 focus:border-emerald-500'
                  : 'bg-white border-emerald-200 text-slate-900 placeholder-slate-400 focus:border-emerald-500'
                  }`}
              />
              <button
                onClick={handleDeployToVercel}
                disabled={isDeployingToVercel || !files.length}
                className="flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 mr-2 rounded bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:cursor-not-allowed text-white transition-all shadow-md shadow-emerald-950/20"
              >
                <Zap size={12} />
                <span>{isDeployingToVercel ? deployStatusMessage : 'Deploy to Vercel'}</span>
              </button>
            </div>
          </div>

          {(deployStatusMessage || deployError || deployUrl) && (
            <div className={`px-4 py-2 border-b text-[11px] font-mono ${theme === 'dark' ? 'border-emerald-900/20 bg-[#050b08]/80' : 'border-emerald-200 bg-white/85'
              }`}>
              {deployStatusMessage && !deployError && (
                <span className="text-emerald-400">{deployStatusMessage}</span>
              )}
              {deployError && (
                <span className="text-rose-400">Deploy error: {deployError}</span>
              )}
              {deployUrl && (
                <a
                  href={deployUrl.startsWith('http') ? deployUrl : `https://${deployUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-emerald-300 hover:underline break-all"
                >
                  Live deployment ({deployDomainMode || (customDomainMode ? 'custom' : 'vercel')}): {deployUrl}
                </a>
              )}
            </div>
          )}

          <div className="flex-1 w-full overflow-hidden bg-[#050b08] relative">
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
        <section className="flex-1 flex flex-col h-full overflow-hidden min-w-[200px] bg-[#07120c] transition-colors">
          <div className="h-9 px-4 border-b flex items-center justify-between shrink-0 transition-colors bg-[#08140d]/60 border-emerald-900/20 text-slate-300">
            <span className="text-xs font-semibold">Sandbox Preview Engine</span>
            <button
              type="button"
              onClick={refreshSandboxPreview}
              disabled={isPreviewLoading}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-300 text-[10px] font-bold hover:bg-emerald-500/20 transition-colors"
            >
              <Zap size={10} className={isPreviewLoading ? 'animate-spin' : ''} />
              {isPreviewLoading ? 'Rendering...' : 'Refresh Preview'}
            </button>
          </div>
          <div className="flex-1 w-full bg-[#050b08] relative">
            {previewUrl ? (
              <iframe
                key={`url-${previewUrl}`}
                title="Live View"
                src={previewUrl}
                sandbox="allow-scripts allow-same-origin allow-forms"
                className="absolute inset-0 w-full h-full border-none"
              />
            ) : (
              <iframe
                key="html-preview"
                title="Live View"
                srcDoc={previewHtml || previewPlaceholderHtml}
                sandbox="allow-scripts allow-same-origin allow-forms"
                className="absolute inset-0 w-full h-full border-none"
              />
            )}
          </div>
        </section>
      </main>

      {/* DRAG HANDLER 3 */}
      <div className={`h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-emerald-500/40 transition-colors z-20 border-t ${theme === 'dark' ? 'border-emerald-900/25' : 'border-emerald-200'}`} onMouseDown={() => { isResizingFooter.current = true; }} />

      {/* FOOTER INTERACT CONSOLE */}
      <footer style={{ height: `${footerHeight}px` }} className={`border-t p-2 grid grid-cols-1 lg:flex gap-2 shrink-0 z-10 overflow-y-auto overflow-x-hidden custom-scrollbar transition-colors ${theme === 'dark' ? 'border-emerald-900/20 bg-[#07120c]/70 backdrop-blur-md' : 'border-emerald-200 bg-white/90'}`}>
        <section style={{ flexBasis: `${chatPanelWidth}%` }} className={`flex min-h-[150px] flex-col min-w-0 h-full overflow-hidden rounded-lg border ${theme === 'dark' ? 'border-emerald-900/25 bg-[#050b08]/95 text-slate-100' : 'border-emerald-200 bg-white text-slate-900'}`}>
          <div className={`flex items-center justify-between gap-3 border-b px-3 py-2 ${theme === 'dark' ? 'border-emerald-900/20 bg-[#07120c]/80' : 'border-emerald-100 bg-slate-50'}`}>
            <div className={`text-[11px] font-black uppercase tracking-[0.28em] ${theme === 'dark' ? 'text-emerald-300/90' : 'text-emerald-700'}`}>AI Chat</div>
            {isAiLoading && (
              <span className="text-[9px] font-bold uppercase tracking-wider text-emerald-300">
                writing
              </span>
            )}
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3">
            <div className="flex flex-col gap-3">
              {chatMessages.map((message, index) => {
                const isUser = message.role === 'user';
                const isPending = message.pending && message.role === 'assistant';
                const bubbleClasses = isUser
                  ? 'ml-auto rounded-br-md bg-emerald-500 text-white shadow-lg shadow-emerald-950/20'
                  : `rounded-bl-md border ${theme === 'dark' ? 'border-emerald-900/25 bg-[#07120c] text-slate-100 shadow-black/20' : 'border-emerald-200 bg-slate-50 text-slate-700 shadow-black/5'}`;

                return (
                  <div key={message.id || `${message.turnId}-${index}`} className={isUser ? 'flex justify-end' : 'flex justify-start'}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-left text-xs shadow-lg ${bubbleClasses}`}>
                      <div className={`mb-1 text-[9px] font-bold uppercase tracking-[0.24em] ${isUser ? 'text-emerald-100/80' : 'text-emerald-300/90'}`}>
                        {isUser ? 'You' : 'AI'}
                        {isPending ? ' · waiting' : ''}
                      </div>
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {message.content || (isUser ? 'Ask the assistant to modify your workspace...' : 'Your AI response will appear here after you run a task.')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <form onSubmit={handleAgenticVibeSubmit} className={`border-t px-0 py-1 ${theme === 'dark' ? 'border-emerald-900/20 bg-[#07120c]/80' : 'border-emerald-100 bg-slate-50'}`}>
            <div className={`flex items-end gap-2 rounded-2xl border p-2 transition-all ${theme === 'dark' ? 'border-emerald-900/30 bg-[#050b08] focus-within:border-emerald-500/60' : 'border-emerald-200 bg-white focus-within:border-emerald-500/60'}`}>
              <textarea
                value={promptInput}
                onChange={e => setPromptInput(e.target.value)}
                disabled={isAiLoading}
                placeholder={cooldownEndTime ? 'Boost mode cooling down...' : 'Message the assistant...'}
                className={`min-h-[56px] flex-1 resize-none border-none bg-transparent p-2 text-xs focus:outline-none ${theme === 'dark' ? 'text-slate-100 placeholder-slate-500' : 'text-slate-700 placeholder-slate-400'}`}
              />
              <button
                type="submit"
                disabled={isAiLoading || !promptInput.trim()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-800"
              >
                Send
                <ChevronRight size={12} />
              </button>
            </div>
          </form>
        </section>

        <div
          className={`hidden lg:block w-1 shrink-0 cursor-ew-resize rounded-full transition-colors ${theme === 'dark' ? 'bg-emerald-900/40 hover:bg-emerald-400/70' : 'bg-emerald-200 hover:bg-emerald-500'}`}
          onMouseDown={() => { isResizingChatPanel.current = true; }}
          role="separator"
          aria-label="Resize AI chat and terminal"
          aria-orientation="vertical"
        />

        <section className={`flex min-h-[150px] flex-1 flex-col min-w-0 h-full overflow-hidden rounded-lg border ${theme === 'dark' ? 'border-emerald-900/25 bg-[#050b08] text-slate-100' : 'border-emerald-200 bg-white text-slate-900'}`}>
          <div className="flex-1 min-h-0 p-2">
            <Terminal
              className="h-full min-h-0"
              title="Workspace Terminal"
              projectId={currentProjectId}
              projectData={activeProjectData}
            />
          </div>
        </section>
      </footer>

      <ChangeCommitModal open={showChangeModal} theme={theme} project={activeProjectData} value={changeNameInput} onChange={setChangeNameInput} onCancel={() => { setShowChangeModal(false); setPendingFilesToSync(null); }} onConfirm={handleConfirmChangeCommit} />
      <AdminSubmissionInspectorModal files={selectedAdminProjectFiles} theme={theme} activeFileName={adminActiveFileName} activeFileContent={adminActiveFileContent} onSelectFile={(file) => { setAdminActiveFileName(file.name || ''); setAdminActiveFileContent(file.content || ''); }} onClose={() => setSelectedAdminProjectFiles(null)} />

    </div>
  );
}
