export type Role = 'Admin' | 'Standard';

export interface AuthUser {
  userId: string;
  email: string;
  displayName: string;
  role: Role;
  emailVerified: boolean;
}
