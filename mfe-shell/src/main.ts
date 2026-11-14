import { initFederation } from '@angular-architects/native-federation-v4';
import { startupStatus } from './startup-status';

const startup = startupStatus();

initFederation('federation.manifest.json', {
  hostRemoteEntry: { url: './remoteEntry.json' },
  strict: { strictRemoteEntry: false, strictExternalCompatibility: true },
})
  .then((runtime) => import('./bootstrap').then((m) => m.bootstrap(runtime)))
  .then(() => startup.complete())
  .catch((error) => startup.fail(error));
