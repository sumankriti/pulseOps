import {
  withNativeFederation,
  fromPackageJson,
  mappingsFromWorkspace,
} from '@angular-architects/native-federation-v4/config';

export default withNativeFederation({
  name: 'mfe-orders',
  exposes: { './Routes': './mfe-orders/src/app/orders.routes.ts' },
  sharedMappings: mappingsFromWorkspace({ singleton: true, strictVersion: true })
    .only(['@pulseops/auth-contract', '@pulseops/notifications'])
    .get(),
  shared: fromPackageJson({
    singleton: true,
    strictVersion: true,
    requiredVersion: 'auto',
    build: 'package',
  })
    .only([
      '@angular/core',
      '@angular/common',
      '@angular/router',
      '@angular/platform-browser',
      'rxjs',
    ])
    .patch(['@angular/*'], { includeSecondaries: { keepAll: true } }),
  skip: ['rxjs/ajax', 'rxjs/fetch', 'rxjs/testing', 'rxjs/webSocket'],
  features: { denseChunking: true, denseExternals: true, strictImports: false },
});
