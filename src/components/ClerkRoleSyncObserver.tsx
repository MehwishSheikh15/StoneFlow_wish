import React, { useEffect } from 'react';
import { useUser } from '@clerk/clerk-react';
import { CLERK_PUBLISHABLE_KEY } from '../ClerkWrapper';
import { buildCrmUserFromClerk, extractClerkRole } from '../lib/clerkRoleSync';
import { User } from '../types';

interface ClerkRoleSyncObserverProps {
  currentUser: User;
  onSyncUser: (syncedUser: User) => void;
}

export const ClerkRoleSyncObserver: React.FC<ClerkRoleSyncObserverProps> = ({ currentUser, onSyncUser }) => {
  if (!CLERK_PUBLISHABLE_KEY) return null;

  return <ClerkUserSyncInternal currentUser={currentUser} onSyncUser={onSyncUser} />;
};

const ClerkUserSyncInternal: React.FC<ClerkRoleSyncObserverProps> = ({ currentUser, onSyncUser }) => {
  const { user, isLoaded, isSignedIn } = useUser();

  useEffect(() => {
    if (isLoaded && isSignedIn && user) {
      const clerkRole = extractClerkRole(user);
      const expectedCrmUser = buildCrmUserFromClerk(user, clerkRole);

      // Check if user identity or role changed
      const idMismatch = currentUser.id !== expectedCrmUser.id;
      const roleMismatch = currentUser.role !== expectedCrmUser.role;

      if (idMismatch || roleMismatch) {
        console.log(`[ClerkRoleSync] Auto-syncing authenticated Clerk user (${expectedCrmUser.name}) role -> ${clerkRole.toUpperCase()}`);
        onSyncUser(expectedCrmUser);
      }
    }
  }, [isLoaded, isSignedIn, user, currentUser, onSyncUser]);

  return null;
};
