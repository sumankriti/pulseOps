import { inject } from '@angular/core';
import { RedirectCommand, Router, type CanActivateFn, type CanMatchFn } from '@angular/router';
import { DemoSession } from './demo-session';
import { safeReturnUrl } from './return-url';

export const requireSession: CanMatchFn = (_route, segments) => {
  const session = inject(DemoSession);
  const router = inject(Router);
  session.checkExpiry();
  if (session.status() === 'authenticated') return true;
  const requested =
    router.currentNavigation()?.extractedUrl.toString() ??
    '/' + segments.map((segment) => segment.toString()).join('/');
  return new RedirectCommand(
    router.createUrlTree(['/login'], {
      queryParams: { returnUrl: safeReturnUrl(requested) },
    }),
    { replaceUrl: true },
  );
};

export const anonymousOnly: CanActivateFn = (route) => {
  const session = inject(DemoSession);
  const router = inject(Router);
  session.checkExpiry();
  return session.status() === 'authenticated'
    ? new RedirectCommand(router.parseUrl(safeReturnUrl(route.queryParamMap.get('returnUrl'))), {
        replaceUrl: true,
      })
    : true;
};
