'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthScreen from './_components/AuthScreen';
import {
  auth,
  googleProvider,
  GithubAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from '../workspace/_utils/firebase';
import { WORKSPACE_PATH } from '../workspace/_utils/routes';

export default function LoginPage() {
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    const savedTheme = localStorage.getItem('ide-theme');
    if (savedTheme) setTheme(savedTheme);
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        router.replace(WORKSPACE_PATH);
      }
    });
    return unsubscribe;
  }, [router]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('ide-theme', nextTheme);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!auth) {
      setAuthError('Authentication service is offline.');
      return;
    }

    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
      router.replace(WORKSPACE_PATH);
    } catch (error) {
      setAuthError(error.message.replace('Firebase: ', ''));
    }
  };

  const handleGoogleSignIn = async () => {
    setAuthError('');
    if (!auth) {
      setAuthError('Authentication service is offline.');
      return;
    }

    try {
      await signInWithPopup(auth, googleProvider);
      router.replace(WORKSPACE_PATH);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  const handleGithubSignIn = async () => {
    setAuthError('');
    if (!auth) {
      setAuthError('Authentication service is offline.');
      return;
    }

    try {
      const provider = new GithubAuthProvider();
      provider.addScope('repo');
      await signInWithPopup(auth, provider);
      router.replace(WORKSPACE_PATH);
    } catch (error) {
      setAuthError(error.message);
    }
  };

  if (!isMounted) {
    return (
      <div className="h-screen w-screen bg-[#050b08]" aria-hidden="true" />
    );
  }

  return (
    <AuthScreen
      theme={theme}
      isSignUp={isSignUp}
      email={email}
      password={password}
      authError={authError}
      onToggleTheme={toggleTheme}
      onAuthSubmit={handleAuthSubmit}
      onGithubSignIn={handleGithubSignIn}
      onGoogleSignIn={handleGoogleSignIn}
      onToggleAuthMode={() => setIsSignUp((value) => !value)}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
    />
  );
}
