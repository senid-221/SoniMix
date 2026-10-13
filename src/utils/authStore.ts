import { UserProfile } from '../types/dashboard';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: number;
}

export function authUserToProfile(user: AuthUser): UserProfile {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: 'Account',
    storageUsedMb: 0,
    storageLimitMb: 0,
    totalBounces: 0,
    totalProjects: 0,
    joinedDate: new Date(user.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    preferences: {
      defaultSampleRate: 48000,
      defaultTargetLufs: -14,
      defaultBitDepth: 24,
      autoSaveEnabled: true,
    },
  };
}
