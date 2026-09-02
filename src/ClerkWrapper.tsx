/// <reference types="vite/client" />
import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';

export const CLERK_PUBLISHABLE_KEY = (import.meta as any).env?.VITE_CLERK_PUBLISHABLE_KEY || '';

interface ClerkWrapperProps {
  children: React.ReactNode;
}

export const ClerkWrapper: React.FC<ClerkWrapperProps> = ({ children }) => {
  if (!CLERK_PUBLISHABLE_KEY) {
    // Render seamlessly without crashing if key is not yet set in environment
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
      {children}
    </ClerkProvider>
  );
};

