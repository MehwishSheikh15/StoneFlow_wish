import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Shield, Mail, Lock, Eye, EyeOff, ArrowLeft, ArrowRight, CheckCircle2, AlertCircle, Sparkles, UserCheck } from 'lucide-react';
import { dbSync as dbMock } from '../lib/dbSync';
import { GoogleSignInModal } from './GoogleSignInModal';
import { useClerk, useUser } from '@clerk/clerk-react';
import { CLERK_PUBLISHABLE_KEY } from '../ClerkWrapper';
import { buildCrmUserFromClerk, extractClerkRole, updateClerkUserRole, CrmRole } from '../lib/clerkRoleSync';

interface AuthPageProps {
  onLoginSuccess: (user: User) => void;
}

function ClerkAuthButton({ onLoginSuccess }: { onLoginSuccess: (user: User) => void }) {
  if (!CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/40 rounded-lg text-xs space-y-1">
        <div className="flex items-center gap-1.5 font-bold text-indigo-700 dark:text-indigo-300">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Clerk Authentication Enabled</span>
        </div>
        <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
          Set <code className="bg-indigo-100 dark:bg-indigo-900/40 px-1 py-0.5 rounded font-mono text-[10px]">VITE_CLERK_PUBLISHABLE_KEY</code> in environment settings to enable live Clerk SSO & User Management.
        </p>
      </div>
    );
  }

  return <ClerkAuthHandler onLoginSuccess={onLoginSuccess} />;
}

function ClerkAuthHandler({ onLoginSuccess }: { onLoginSuccess: (user: User) => void }) {
  const clerk = useClerk();
  const { user, isLoaded, isSignedIn } = useUser();
  const [selectedRole, setSelectedRole] = useState<CrmRole | null>(null);

  const activeRole: CrmRole = selectedRole || (user ? extractClerkRole(user) : 'office');

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const crmUser = buildCrmUserFromClerk(user, activeRole);
      onLoginSuccess(crmUser);
    }
  }, [isLoaded, isSignedIn, user, activeRole, onLoginSuccess]);

  const handleRoleChange = async (newRole: CrmRole) => {
    setSelectedRole(newRole);
    if (user) {
      await updateClerkUserRole(user, newRole);
      const updatedUser = buildCrmUserFromClerk(user, newRole);
      onLoginSuccess(updatedUser);
    }
  };

  if (isLoaded && isSignedIn && user) {
    return (
      <div className="p-4 bg-indigo-50/80 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 rounded-xl space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">
              {user.firstName?.[0] || 'C'}
            </div>
            <div>
              <div className="text-xs font-bold text-ink">{user.fullName || user.firstName}</div>
              <div className="text-[10px] text-mut">{user.primaryEmailAddress?.emailAddress}</div>
            </div>
          </div>
          <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-700">
            {activeRole.toUpperCase()}
          </span>
        </div>

        {/* Role Sync Selector */}
        <div className="space-y-1.5 pt-1 border-t border-indigo-200/60 dark:border-indigo-800/50">
          <label className="text-[10px] font-bold uppercase tracking-wider text-mut block">
            Clerk Role Sync (Metadata):
          </label>
          <div className="grid grid-cols-4 gap-1">
            {(['owner', 'office', 'factory', 'installer'] as CrmRole[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleRoleChange(r)}
                className={`py-1 text-[10px] font-bold rounded-lg capitalize transition-all cursor-pointer ${
                  activeRole === r
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white/80 dark:bg-zinc-800/80 text-ink hover:bg-indigo-100 dark:hover:bg-indigo-900/30'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            const crmUser = buildCrmUserFromClerk(user, activeRole);
            onLoginSuccess(crmUser);
          }}
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm transition-all cursor-pointer flex items-center justify-center gap-1.5"
        >
          <UserCheck className="w-3.5 h-3.5" />
          Continue to CRM as {activeRole.toUpperCase()}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => clerk.openSignIn()}
        className="w-full flex items-center justify-center gap-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs uppercase tracking-wider px-4 py-3 rounded-lg shadow-sm transition-all cursor-pointer"
      >
        <UserCheck className="w-4 h-4" />
        Sign in with Clerk Auth
      </button>
    </div>
  );
}

export function AuthPage({ onLoginSuccess }: AuthPageProps) {
  const [view, setView] = useState<'login' | 'forgot' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Password Reset state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [inputCode, setInputCode] = useState('');
  const [sentNotification, setSentNotification] = useState<{ email: string; code: string; time: string; deliveredLive: boolean; smtpError?: string } | null>(null);
  
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isGoogleModalOpen, setIsGoogleModalOpen] = useState(false);

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = dbMock.getUsers();
    const matched = users.find(
      u => (u.email || '').toLowerCase() === normalizedEmail && u.password === password
    );

    if (matched) {
      onLoginSuccess(matched);
      return;
    }

    setError('These credentials do not match our registered records. Please contact an admin if you need an account created.');
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email) {
      setError('Please enter your registered email address.');
      return;
    }

    const normalizedEmail = email.toLowerCase().trim();
    const users = dbMock.getUsers();
    const matched = users.find(u => (u.email || '').toLowerCase() === normalizedEmail);

    if (!matched) {
      setError('We cannot find a user with that registered email address.');
      return;
    }

    setIsLoading(true);

    // Generate 6-digit random code
    const generatedCode = Math.floor(100000 + Math.random() * 900000).toString();
    setVerificationCode(generatedCode);

    let deliveredLive = false;
    let smtpError: string | undefined = undefined;

    try {
      const res = await fetch('/api/auth/send-reset-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, resetCode: generatedCode })
      });
      const data = await res.json();
      if (data.deliveredLive) {
        deliveredLive = true;
      }
      if (data.smtpError) {
        smtpError = data.smtpError;
      }
    } catch (e) {
      console.warn('Backend notification email endpoint call failed, continuing with generated code:', e);
    }

    setIsLoading(false);
    setSentNotification({
      email: normalizedEmail,
      code: generatedCode,
      time: new Date().toLocaleTimeString(),
      deliveredLive,
      smtpError
    });
    setSuccessMsg(
      deliveredLive
        ? `Verification email sent to ${normalizedEmail}! Code is also shown on screen below for instant testing.`
        : `Reset code generated for ${normalizedEmail}.`
    );
    setView('reset');
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!inputCode) {
      setError('Please enter the 6-digit verification code sent to your email.');
      return;
    }

    if (inputCode.trim() !== verificationCode.trim()) {
      setError('Invalid verification code. Please check the code sent to your email.');
      return;
    }

    if (!newPassword || !confirmNewPassword) {
      setError('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 4) {
      setError('Password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('The new passwords do not match.');
      return;
    }

    setIsLoading(true);
    const success = await dbMock.updateUserPassword(email, newPassword);
    setIsLoading(false);

    if (success) {
      setSuccessMsg('Your credentials & password have been reset and saved! You can now log in.');
      setView('login');
      setPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setInputCode('');
      setVerificationCode('');
      setSentNotification(null);
    } else {
      setError('Failed to update password. Please verify your email and try again.');
    }
  };

  const handleGoogleLogin = () => {
    setIsGoogleModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-zinc-50 dark:bg-zinc-950 font-sans px-4 py-12 selection:bg-indigo-500 selection:text-white">
      {/* Centered Logo branding */}
      <div className="mb-6 text-center space-y-2">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs text-indigo-600 dark:text-indigo-400">
          <Shield className="w-6 h-6" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">
          StoneFlow CRM
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Authorized Team Workspace Sign-In
        </p>
      </div>

      {/* Card Wrapper */}
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800/80 shadow-md rounded-xl p-8 space-y-6">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400 text-xs rounded-lg border border-red-200 dark:border-red-900/30 font-semibold flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 text-xs rounded-lg border border-emerald-200 dark:border-emerald-900/30 font-semibold flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {view === 'login' && (
          <>
            <div className="space-y-3">
              {/* Clerk Auth Integration */}
              <ClerkAuthButton onLoginSuccess={onLoginSuccess} />

              {/* Google SSO integration */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-3 bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 font-semibold text-xs uppercase tracking-widest px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 shadow-xs transition-all duration-150 cursor-pointer"
              >
                {/* Custom inline colorful Google G logo */}
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>

              <div className="flex items-center justify-center gap-3">
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-grow" />
                <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 tracking-wider">
                  Or continue with email
                </span>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 flex-grow" />
              </div>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              {/* Email Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Password Input */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setView('forgot')}
                    className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    Forgot your password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-10 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                className="w-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs uppercase tracking-widest px-4 py-3 rounded-lg transition-all duration-150 flex items-center justify-center gap-2 mt-2 shadow-xs cursor-pointer"
              >
                Log In
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </>
        )}

        {view === 'forgot' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Reset Password
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Enter your registered team email address to locate your profile and receive a password reset verification code.
              </p>
            </div>

            <form onSubmit={handleForgotPasswordSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setView('login')}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-250 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Back to Log In
                </button>

                <button
                  type="submit"
                  className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  Find Account
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}

        {view === 'reset' && (
          <div className="space-y-5">
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                Verify Email &amp; Set New Password
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Resetting password for account <strong className="text-indigo-600 dark:text-indigo-400 font-mono">{email}</strong>
              </p>
            </div>

            {/* Verification Code Box */}
            {sentNotification && (
              <div className="p-3.5 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 rounded-xl space-y-2 text-xs text-amber-900 dark:text-amber-200 animate-fade-in shadow-xs">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                    <Mail className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    {sentNotification.deliveredLive ? 'Reset Code Sent (Also Shown Below)' : 'Generated Reset Code'}
                  </span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">{sentNotification.time}</span>
                </div>
                <div className="p-2.5 bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-700/60 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-amber-700 dark:text-amber-400">Generated Reset Code</div>
                    <div className="font-mono text-xl font-extrabold tracking-widest text-zinc-900 dark:text-zinc-100">{sentNotification.code}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setInputCode(sentNotification.code)}
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs rounded-md transition-all cursor-pointer shadow-xs flex items-center gap-1"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Autofill Code
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              {/* 6-Digit Verification Code */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  6-Digit Email Verification Code
                </label>
                <div className="relative">
                  <CheckCircle2 className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 font-mono tracking-widest focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Confirm New Password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3 top-3.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 mt-2">
                <button
                  type="button"
                  onClick={() => setView('forgot')}
                  className="flex items-center gap-1.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-250 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-black font-semibold text-xs uppercase tracking-widest px-4 py-2.5 rounded-lg transition-all duration-150 flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : 'Update & Save Password'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <GoogleSignInModal
        isOpen={isGoogleModalOpen}
        onClose={() => setIsGoogleModalOpen(false)}
        onLoginSuccess={onLoginSuccess}
      />
    </div>
  );
}
