import { inject } from '@angular/core';
import type { CanActivateFn } from '@angular/router';
import { Auth } from './auth';

export const authGuard: CanActivateFn = () => {
  const auth = inject(Auth);
  if (auth.isAuthenticated()) return true;
  auth.redirectToLogin();
  return false;
};
