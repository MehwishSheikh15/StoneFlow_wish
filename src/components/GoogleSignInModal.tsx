import React, { useState } from 'react';
import { User } from '../types';
import { dbMock } from '../lib/dbSync';
import { ArrowLeft, Eye, EyeOff, Shield, AlertCircle } from 'lucide-react';

interface GoogleSignInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
}

export function GoogleSignInModal({ isOpen, onClose, onLoginSuccess }: GoogleSignInModalProps) {
  const [step, setStep] = useState<'email' | 'password' | 'authenticating'>('email');
  
  const [inputEmail, setInputEmail] = useState('');
  const [selectedEmail, setSelectedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normEmail = inputEmail.trim().toLowerCase();
    if (!normEmail) {
      setError('Please enter your Google email address.');
      return;
    }
    if (!normEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }

    // STRICT CHECK: Verify if this email is registered in team database
    const users = dbMock.getUsers();
    const registeredUser = users.find(u => (u.email || '').toLowerCase() === normEmail);

    if (!registeredUser) {
      setError(`Access Denied: '${normEmail}' is not registered in the team database. Please contact your administrator or manager.`);
      return;
    }

    setSelectedEmail(normEmail);
    setStep('password');
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }

    const normEmail = selectedEmail.toLowerCase().trim();
    const users = dbMock.getUsers();
    const registeredUser = users.find(u => (u.email || '').toLowerCase() === normEmail);

    if (!registeredUser) {
      setError(`Access Denied: Account '${normEmail}' is not registered by an administrator.`);
      setStep('email');
      return;
    }

    setStep('authenticating');

    setTimeout(() => {
      onLoginSuccess(registeredUser);
    }, 1200);
  };

  const handleModalClose = () => {
    setError(null);
    setStep('email');
    setInputEmail('');
    setPassword('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden text-zinc-900 dark:text-zinc-100 transition-all">
        {/* Top Google Progress Bar when authenticating */}
        {step === 'authenticating' && (
          <div className="w-full h-1 bg-blue-100 overflow-hidden">
            <div className="h-full bg-blue-600 animate-pulse w-full origin-left" />
          </div>
        )}

        <div className="p-8 space-y-6">
          {/* Header with Google Logo */}
          <div className="text-center space-y-3">
            <div className="flex justify-center">
              <svg className="w-10 h-10" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
            </div>

            <h1 className="text-2xl font-normal text-zinc-800 dark:text-zinc-100 tracking-tight">
              {step === 'email' ? 'Sign in with Google' : step === 'password' ? 'Welcome' : 'Signing in...'}
            </h1>

            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              to continue to <span className="font-semibold text-zinc-800 dark:text-zinc-200">StoneFlow CRM</span>
            </p>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300 text-xs rounded-lg border border-red-200 dark:border-red-900/40 font-medium flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* STEP 1: Email Input (Manual Entry Only) */}
          {step === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Email address
                  </label>
                  <input
                    type="email"
                    required
                    autoFocus
                    placeholder="Enter registered Google email"
                    value={inputEmail}
                    onChange={(e) => setInputEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                </div>

                <div className="p-3 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/30 rounded-lg text-xs text-blue-900 dark:text-blue-300">
                  <p className="font-medium">Admin Authorization Required</p>
                  <p className="text-[11px] text-blue-700 dark:text-blue-400 mt-0.5">
                    Only email addresses pre-registered by an administrator can log in.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleModalClose}
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-full transition-all cursor-pointer shadow-xs"
                >
                  Next
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Password Input */}
          {step === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              {/* Selected account chip */}
              <div
                onClick={() => { setError(null); setStep('email'); }}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/60 rounded-full text-xs text-zinc-800 dark:text-zinc-200 font-medium cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all max-w-full"
              >
                <div className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                  {selectedEmail.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{selectedEmail}</span>
                <ArrowLeft className="w-3 h-3 text-zinc-400 rotate-90 shrink-0" />
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-1.5">
                    Enter your Google password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoFocus
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-9 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => { setError(null); setStep('email'); }}
                  className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back
                </button>

                <button
                  type="submit"
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-full transition-all cursor-pointer shadow-xs"
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Authenticating Spinner */}
          {step === 'authenticating' && (
            <div className="py-8 text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400">
                <Shield className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  Verifying credentials with Google...
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Connecting {selectedEmail} to StoneFlow
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
