import { initFederation } from '@angular-architects/native-federation-v4';

initFederation(
  {},
  {
    hostRemoteEntry: { url: './remoteEntry.json' },
    strict: { strictRemoteEntry: false, strictExternalCompatibility: true },
  },
)
  .then(() => import('./bootstrap').then((m) => m.bootstrap()))
  .catch((error) => {
    console.error('Federation startup failed', error);
    const root = document.querySelector('app-root');
    if (root)
      root.textContent =
        'PulseOps could not start. Check the federation manifest and remote entries, then reload.';
  });
