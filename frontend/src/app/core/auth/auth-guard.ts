import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = async () => {
  const auth = inject(Auth);
  await auth.whenReady();
  if (auth.isAuthenticated()) return true;
  auth.redirectToLogin();
  return false;
};
