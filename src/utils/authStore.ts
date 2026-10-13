import { UserProfile, DirectoryUser } from '../types/dashboard';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  provider: 'google' | 'email';
  role: 'user' | 'producer' | 'admin';
  createdAt: number;
}

const STORAGE_KEY_AUTH_USER = 'sonimix_auth_user_v1';
const STORAGE_KEY_ADMIN_SESSION = 'sonimix_admin_session_v1';
const STORAGE_KEY_REGISTERED_USERS = 'sonimix_registered_users_v1';

// Get current logged-in user
export function getStoredAuthUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_AUTH_USER);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// Save current user session
export function setStoredAuthUser(user: AuthUser | null): void {
  try {
    if (user) {
      localStorage.setItem(STORAGE_KEY_AUTH_USER, JSON.stringify(user));
      recordDirectoryUser(user);
    } else {
      localStorage.removeItem(STORAGE_KEY_AUTH_USER);
    }
  } catch {
    // ignore
  }
}

// Check admin authentication session
export function getIsAdminAuthenticated(): boolean {
  try {
    return sessionStorage.getItem(STORAGE_KEY_ADMIN_SESSION) === 'true';
  } catch {
    return false;
  }
}

export function setAdminAuthenticated(authenticated: boolean): void {
  try {
    if (authenticated) {
      sessionStorage.setItem(STORAGE_KEY_ADMIN_SESSION, 'true');
    } else {
      sessionStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
    }
  } catch {
    // ignore
  }
}

// Validate admin login credentials
export function verifyAdminCredentials(password: string, email?: string): boolean {
  const validPassword = 'admin' || 'admin123';
  // Accepts admin master credentials
  const cleanPass = password.trim();
  const cleanEmail = (email || '').trim().toLowerCase();
  
  // Either admin password or admin email with matching pass
  if (cleanPass === 'admin' || cleanPass === 'admin123' || cleanPass === 'sonimix2026') {
    return true;
  }
  if (cleanEmail === 'admin@sonimix.audio' && cleanPass === 'admin123') {
    return true;
  }
  return false;
}

// Registered users directory management (real users only, no demo accounts)
export function getRegisteredUsers(): DirectoryUser[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_REGISTERED_USERS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function recordDirectoryUser(user: AuthUser): void {
  try {
    const users = getRegisteredUsers();
    const index = users.findIndex((u) => u.id === user.id || u.email === user.email);
    const updatedUser: DirectoryUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      plan: 'Pro',
      joinedDate: new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }),
      storageUsedMb: index >= 0 ? users[index].storageUsedMb : 0,
      bouncesCount: index >= 0 ? users[index].bouncesCount : 0,
      status: 'active',
      lastActive: 'Just now',
    };

    if (index >= 0) {
      users[index] = { ...users[index], ...updatedUser };
    } else {
      users.unshift(updatedUser);
    }
    localStorage.setItem(STORAGE_KEY_REGISTERED_USERS, JSON.stringify(users));
  } catch {
    // ignore
  }
}

// Convert AuthUser to UserProfile
export function authUserToProfile(user: AuthUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    role: user.role,
    plan: 'Pro',
    storageUsedMb: 0,
    storageLimitMb: 2048,
    totalBounces: 0,
    totalProjects: 0,
    joinedDate: new Date(user.createdAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    preferences: {
      defaultSampleRate: 48000,
      defaultTargetLufs: -14,
      defaultBitDepth: 24,
      autoSaveEnabled: true,
    },
  };
}
