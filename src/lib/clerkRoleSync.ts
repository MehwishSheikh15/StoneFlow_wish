import { User } from '../types';
import { dbSync as dbMock } from './dbSync';

export type CrmRole = 'owner' | 'office' | 'factory' | 'installer';

/**
 * Extracts and normalizes user role from Clerk User object (publicMetadata, unsafeMetadata, or org memberships)
 */
export function extractClerkRole(clerkUser: any): CrmRole {
  if (!clerkUser) return 'office';

  // Extract from publicMetadata, unsafeMetadata, or organizationMemberships
  const metaRole = 
    clerkUser.publicMetadata?.role || 
    clerkUser.unsafeMetadata?.role || 
    clerkUser.organizationMemberships?.[0]?.role || 
    '';

  const normalized = String(metaRole).toLowerCase().trim();

  if (['owner', 'admin', 'org:admin', 'superadmin', 'director'].includes(normalized)) {
    return 'owner';
  }
  if (['office', 'sales', 'pm', 'estimator', 'draftsman', 'org:office', 'member'].includes(normalized)) {
    return 'office';
  }
  if (['factory', 'shop', 'cutter', 'saw', 'polisher', 'cnc', 'org:factory'].includes(normalized)) {
    return 'factory';
  }
  if (['installer', 'site', 'driver', 'fitter', 'org:installer'].includes(normalized)) {
    return 'installer';
  }

  // Email hint fallback if metadata is empty
  const email = (
    clerkUser.primaryEmailAddress?.emailAddress || 
    clerkUser.emailAddresses?.[0]?.emailAddress || 
    ''
  ).toLowerCase();

  if (email.includes('factory') || email.includes('shop') || email.includes('cutter')) return 'factory';
  if (email.includes('install') || email.includes('site') || email.includes('fitter')) return 'installer';
  if (email.includes('office') || email.includes('sales')) return 'office';
  if (email.includes('owner') || email.includes('admin') || email.includes('mehwish')) return 'owner';

  // Default fallback role
  return 'office';
}

/**
 * Helper to update role in Clerk's user metadata
 */
export async function updateClerkUserRole(clerkUser: any, newRole: CrmRole): Promise<boolean> {
  if (!clerkUser || typeof clerkUser.update !== 'function') return false;
  try {
    const existingUnsafe = clerkUser.unsafeMetadata || {};
    await clerkUser.update({
      unsafeMetadata: {
        ...existingUnsafe,
        role: newRole
      }
    });
    return true;
  } catch (err) {
    console.warn('[ClerkRoleSync] Failed to update unsafeMetadata in Clerk:', err);
    return false;
  }
}

/**
 * Maps a Clerk User object into a CRM User type and registers in dbMock
 */
export function buildCrmUserFromClerk(clerkUser: any, overrideRole?: CrmRole): User {
  const role = overrideRole || extractClerkRole(clerkUser);
  const name = clerkUser.fullName || clerkUser.firstName || (clerkUser.primaryEmailAddress?.emailAddress?.split('@')[0]) || 'Clerk Member';
  const initials = name
    .split(' ')
    .filter(Boolean)
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2) || 'CL';

  const avatarBg = 
    role === 'owner' ? 'bg-amber-600 text-white' :
    role === 'factory' ? 'bg-orange-600 text-white' :
    role === 'installer' ? 'bg-emerald-600 text-white' :
    'bg-indigo-600 text-white';

  const userObj: User = {
    id: `clerk-${clerkUser.id}`,
    name,
    initials,
    role,
    avatarBg,
    email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses?.[0]?.emailAddress || ''
  };

  // Register user in dbMock so team management / permissions lists recognize them
  try {
    const existingUsers = dbMock.getUsers();
    const idx = existingUsers.findIndex(u => u.id === userObj.id || u.email === userObj.email);
    if (idx >= 0) {
      existingUsers[idx] = { ...existingUsers[idx], ...userObj };
    } else {
      existingUsers.push(userObj);
    }
    // Save to localStorage or mock db
    localStorage.setItem('stoneflow_users', JSON.stringify(existingUsers));
  } catch (e) {
    console.warn('[ClerkRoleSync] Failed to sync user into dbMock:', e);
  }

  return userObj;
}
