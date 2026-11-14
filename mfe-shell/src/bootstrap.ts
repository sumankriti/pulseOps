import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { App } from './app/app';
import type { NativeFederationResult } from '@angular-architects/native-federation-v4';
import { createRoutes } from './app/app.routes';
import { SESSION_CONTEXT } from '@pulseops/auth-contract';
import { DemoSession } from './app/auth/demo-session';

export const bootstrap = (runtime: NativeFederationResult) =>
  bootstrapApplication(App, {
    providers: [
      { provide: SESSION_CONTEXT, useExisting: DemoSession },
      provideRouter(createRoutes(runtime), withComponentInputBinding()),
    ],
  });
