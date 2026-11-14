# Angular Microfrontend Architecture — Revision Guide

Build **PulseOps**, a live commerce operations platform, to learn architecture through a realistic product. The goal is to demonstrate independent delivery, clear domain ownership, resilience, and engineering judgment.

## 1. The core idea

A microfrontend is a business capability delivered as an independently deployable frontend. Federation is a composition mechanism; it does not automatically create good boundaries or team autonomy.

Use microfrontends when separate teams need independent delivery and the product has stable domain boundaries. Prefer a modular Angular application when one team owns the product, boundaries are still changing, or independent releases offer little benefit.

## 2. Product: PulseOps

- **Orders:** search, order details, fulfillment workflow, and live order status.
- **Inventory:** warehouse stock, reservations, shortages, and live stock changes.
- **Incidents:** issue assignment, collaborative updates, and resolution history.
- **Shell:** navigation, session context, tenant selection, layout, and remote loading.
- **Signature feature:** an incident timeline linking a stock shortage to affected orders, with event replay for a repeatable demo.

Start with the shell and two domains. Add incidents after the first independent deployment works.

## 3. Architecture and responsibilities

```text
Browser
  Angular shell
    /orders     -> Orders remote     -> Orders API
    /inventory  -> Inventory remote  -> Inventory API
    /incidents  -> Incidents remote  -> Incidents API

Backend domain events -> Real-time gateway -> Domain updates in browser
```

Compose at route level first. Each remote owns its routes, domain state, data access, and user workflows. A modular backend is sufficient initially; frontend boundaries do not require separate backend services.

Suggested workspace shape:

```text
apps/
  shell/
  orders/
  inventory/
  incidents/
libs/
  orders/feature/      # domain-specific UI and workflows
  orders/data-access/ # API clients and state
  inventory/feature/
  inventory/data-access/
  incidents/feature/
  incidents/data-access/
  shared/ui/          # reusable presentation components
  shared/contracts/   # small, versioned integration schemas
  platform/auth/      # session integration
  platform/telemetry/
```

Keep remote-to-remote imports forbidden. Enforce domain dependency rules with linting or workspace boundary checks. A monorepo can still produce independent release artifacts.

## 4. Angular and federation

- Learn standalone components, routing, dependency injection, signals, RxJS, HTTP, and lazy loading first.
- Evaluate Native Federation for a new Angular project. Nx can provide workspace boundaries, caching, and affected builds.
- Learn Webpack Module Federation terminology for existing systems: host, remote, exposed module, shared dependency, and runtime loading.
- Keep Angular and shared dependency compatibility explicit. Singleton sharing is a compatibility choice, not a guarantee that arbitrary Angular versions work together.
- Pin compatible package versions when implementing; verify instructions against the versions you install.

Current Nx guidance recommends `@angular-architects/native-federation` for Angular microfrontends. See the sources below before selecting implementation commands.

## 5. State and communication rules

- **Local UI state:** component signals for selection, filters, and dialogs.
- **Domain state:** a domain-owned service or store; use RxJS where asynchronous streams benefit from it.
- **Server state:** domain APIs remain authoritative. Define caching and invalidation deliberately.
- **Cross-domain navigation:** use routes and stable identifiers, such as `/orders/123`.
- **Cross-domain notifications:** use small, versioned contracts only when needed; avoid a global event bus carrying all business state.
- **Shared context:** expose a narrow session/tenant interface. On tenant changes, cancel old requests, clear tenant-scoped caches, and reconnect streams.

Example event contract:

```json
{
  "type": "inventory.shortage.v1",
  "eventId": "evt-1042",
  "tenantId": "tenant-demo",
  "occurredAt": "2026-11-13T10:00:00Z",
  "aggregateId": "warehouse-01:sku-123",
  "aggregateVersion": 17,
  "payload": { "sku": "sku-123", "warehouseId": "warehouse-01" }
}
```

Version integration contracts and validate payloads at runtime. TypeScript types alone do not validate network data. Avoid putting credentials or unnecessary personal data in events.

## 6. Real-time behavior

Start with HTTP commands and SSE for server-to-browser notifications. Use WebSockets when bidirectional interaction requirements justify them.

- Deduplicate using event IDs with bounded retention.
- Use per-entity versions or sequence numbers to detect stale or missing updates; timestamps alone are insufficient for ordering.
- Reconnect with backoff and jitter, and show connection status.
- After reconnect, replay from a supported cursor or refetch authoritative state.
- Clean up subscriptions and connections when their owning scope ends.
- Scope stream access on the server to the authenticated tenant and permissions.
- Keep notifications separate from command success: do not assume an event will always arrive immediately.

## 7. Security and resilience

Enforce authorization and tenant isolation in backend APIs and stream subscriptions. Route guards and hidden buttons improve UX but do not secure data.

Treat federated remote code as trusted executable code in the page. Remotes sharing a JavaScript runtime do not provide a security sandbox or complete fault isolation. Consider an iframe boundary if genuinely untrusted code must run.

- Load remotes with a timeout and a useful fallback page.
- Keep navigation and unaffected domains usable when a remote fails to load.
- Restrict remote locations to trusted deployment origins; validate manifests and configure CSP/CORS deliberately.
- Use a defined session strategy, such as secure server-managed cookies with appropriate CSRF protections when applicable.
- Record remote version, route, correlation ID, and error category in telemetry; exclude secrets and sensitive payloads.

## 8. Independent deployment and rollback

Build each remote into an immutable, versioned artifact. A runtime manifest maps a remote name to its deployed artifact. Fetching configuration at runtime allows a remote release without rebuilding the shell, provided its contracts remain compatible.

```text
Change inventory -> validate -> build inventory -> publish versioned artifact
                 -> integration smoke test -> promote manifest entry
Rollback         -> restore previous compatible manifest entry
```

Keep old assets available, define manifest caching, and ensure entry files reference matching chunks. A manifest change primarily affects future loads; it does not replace code already running in an open tab. Test reload and session behavior during rollback.

Independent deployability is something to demonstrate in CI and hosting, not just separate folders or localhost ports.

## 9. Learning milestones

1. **Angular foundation:** build an orders feature with routing, API access, signals, and RxJS. Exit: loading, empty, success, and error states work.
2. **Modular application:** isolate orders and inventory into domain libraries. Exit: forbidden cross-domain imports fail validation.
3. **First federation:** extract inventory into a remote. Exit: it loads by route and runs in local development.
4. **Communication:** navigate between domains using IDs and explicit contracts. Exit: neither domain imports the other's implementation.
5. **Live updates:** add SSE and an event simulator. Exit: duplicates, disconnects, and stale updates are handled.
6. **Tenant and access controls:** add two tenants and distinct roles. Exit: server tests reject cross-tenant reads and unauthorized actions.
7. **Delivery:** publish remote artifacts and runtime configuration. Exit: inventory releases and rolls back without a shell rebuild.
8. **Production evidence:** add telemetry, failure drills, performance measurements, and decision records. Exit: the interview demonstration is repeatable.

Use these as stages, not a guaranteed eight-week schedule. Complete each exit criterion before increasing complexity.

## 10. Meaningful verification

- Unit-test domain rules such as shortage detection and incident transitions.
- Validate API/event schemas and compatibility at integration boundaries.
- Test tenant isolation and permission enforcement on the backend.
- Exercise a critical journey across orders, inventory, and incidents.
- Simulate an unavailable remote, dropped connection, duplicate event, and expired session.
- Test the deployed shell against candidate remote versions before promotion.
- Measure cold navigation time, transferred JavaScript, and remote loading errors; document your environment and baseline before setting budgets.

## 11. Ten-minute interview demonstration

1. Explain the product problem and domain ownership.
2. Open an order and trigger a live fulfillment update.
3. Simulate a stock shortage and inspect affected orders.
4. Create an incident and show a second operator receiving the update.
5. Deploy an inventory change without rebuilding the shell.
6. Simulate an inventory loading failure and keep orders usable.
7. Roll back inventory and explain what happens to existing tabs.
8. Explain when a modular monolith would be the better choice.

Support the demo with a diagram, release evidence, a short runbook, measured performance, and architecture decision records. Present this honestly as a portfolio simulation with modeled team boundaries.

## 12. Architecture decisions to write

- Why microfrontends instead of a modular application?
- Why these business boundaries and route-level composition?
- Why Native Federation, and how are dependencies kept compatible?
- Why domain-owned state rather than one global store?
- Why SSE initially, and when would WebSockets be justified?
- How are remote releases validated, promoted, and rolled back?
- What security and failure isolation does the architecture actually provide?

For each decision, record context, alternatives, choice, consequences, and a condition that would trigger reconsideration.

## 13. Quick revision questions

- Can one remote deploy without rebuilding the shell?
- Can orders work when inventory fails to load?
- Who owns each piece of state?
- What happens after a stream disconnect or tenant switch?
- How do duplicate and out-of-order events affect the UI?
- How do you prevent a remote from importing another domain's implementation?
- What happens if the shared Angular versions are incompatible?
- How does rollback behave for an already open browser tab?
- Which evidence proves the architecture is worth its complexity?

## 14. Sources and implementation references

- [Nx: Angular guidance](https://nx.dev/docs/technologies/angular/introduction)
- [Nx: Microfrontend architecture](https://nx.dev/docs/kb/micro-frontend-architecture)
- [Webpack: Module Federation concepts](https://webpack.js.org/concepts/module-federation/)
- [Angular documentation](https://angular.dev/)

Tooling guidance checked on 13 November 2026. The project design and learning sequence are recommendations; validate package compatibility when starting implementation.

## 15. Build journal — Milestone 01 (historical foundation)

Implemented on 13 November 2026: a local modular Angular application using Angular 21.2, compatible with the installed Node 24.14 runtime. Angular 22 requires a newer Node 24 release; this avoids changing the machine runtime. Refer to [Angular version compatibility](https://angular.dev/reference/versions).

This is the foundation stage, not yet a federated application. There is no backend, authentication, persisted data, or network event stream. Independent remote deployment remains a future milestone.

- Shell: responsive navigation, active-route indication, demo context, and route outlet.
- Orders: six fixture orders, search, status filter, computed metrics, details, and manual status simulation.
- Inventory: local stock overview, computed health counts, reservations, and reset.
- UX states: empty search results, invalid order ID, unknown route, and terminal delivered state.
- Boundaries: orders and inventory cannot import each other's implementation or shell code.

## 16. Run, verify, and explore (foundation checkpoint)

Run from the project root:

```sh
npm ci
npm start
```

Open `http://localhost:4200`. Stop the development server with Ctrl+C.

```sh
npm test
npm run check:boundaries
npm run build
npm run docs
```

- `npm test`: meaningful fulfillment transition tests using Node's built-in runner.
- `check:boundaries`: rejects domain imports outside their own folders and unapproved package aliases. The checker now uses the TypeScript AST and validates shell imports against public route aliases; adopt a full workspace graph rule as the repository grows.
- `build`: checks strict Angular templates and TypeScript, emits lazy chunks, and applies an initial bundle budget. The initial budget is provisional until measured against product needs.
- `docs`: regenerates standalone HTML from this Markdown, keeping both revision documents synchronized.

Manual exercise: search for Priya, filter Shipped, open an order, advance its status, navigate back, reserve inventory until zero, and reset the data. Visit `/orders/unknown` and `/unknown` to inspect missing-resource states. Repeat at mobile width.

## 17. Read the implementation in this order

1. `mfe-shell/src/main.ts`, `bootstrap.ts`, and `app/app.routes.ts`: federation initialization, Angular bootstrap, runtime route loading, and input binding.
2. `mfe-shell/src/app/app.ts` and `workspace-layout.ts`: root outlet, protected shell frame, and navigation without domain business state.
3. `mfe-orders/src/app/order-rules.ts`: order model and pure fulfillment transition rule.
4. `mfe-orders/src/app/orders-store.ts`: domain-owned writable state, read-only exposure, computed metrics, and simulation commands.
5. `mfe-orders/src/app/orders-page.ts`: signal-based filters and template composition.
6. `mfe-orders/src/app/order-detail.ts`: deriving the selected order from the route identifier.
7. `mfe-inventory/src/app/inventory-page.ts`: isolated inventory state and reservations.
8. `scripts/check-boundaries.mjs`: a check enforcing the chosen dependency direction.

In Milestone 01, orders was root-scoped while inventory was component-scoped. Milestone 02 changes inventory to a root-provided domain store: both now survive route navigation and reset on browser refresh. Those store lifetimes remain in the current federated application.

The update button applies a synchronous local command. It is not SSE or a distributed event implementation. The inventory reservation does not update orders because there is no backend workflow coordinating them yet.

## 18. Next implementation checkpoints

1. Completed in Milestone 02: orders API adapter and asynchronous loading, empty, success, and error states; fixtures remain behind the adapter.
2. Completed in Milestone 02: inventory-owned store and stock reservation invariant tests.
3. Add a lightweight backend and server-side validation before implementing real-time notifications.
4. Extract inventory with Native Federation, runtime remote configuration, loading fallback, and a separate build artifact.
5. Add server-sent events with reconnection, event deduplication, and state reconciliation.

First explain why the shell does not own order state and why a lazy route alone does not provide independent deployment. Those are the architectural lessons to take from this milestone.

## 19. Verification record — Milestone 01

- Production build passed with strict template checking and separate lazy chunks for orders, inventory, details, and the missing-route page.
- Initial production output: approximately 243.49 kB raw JavaScript/CSS, estimated 68.46 kB transfer. These are build estimates, not browser performance measurements.
- Both fulfillment transition tests passed.
- Boundary validation passed; a temporary cross-domain import was also confirmed to fail validation and then removed.
- The development server compiled and returned the `/orders` application document successfully. This checks server readiness, not client-side rendering or interactions.
- HTML navigation targets were validated. Browser interaction, accessibility, and responsive visual checks remain manual verification tasks.

The initial install encountered a permissions error in the existing npm cache. Installation succeeded with `npm install --cache /private/tmp/pulseops-npm-cache --no-audit --no-fund`; a lockfile is included for repeatable `npm ci` installs. The production build required execution outside the sandbox after the sandboxed process aborted.

## 20. Build journal — Milestone 02: asynchronous boundaries

Orders now depends on an `OrdersApi` interface through an `ORDERS_API` injection token. The default token factory supplies `FixtureOrdersApi`. The adapter returns an Observable after 700 ms and can return fixtures, an empty collection, or an error. It makes no network request; this is an asynchronous simulation preparing a replaceable data boundary.

```text
OrdersPage / OrderDetail
  -> OrdersStore
    -> ORDERS_API token
      -> FixtureOrdersApi
        -> delayed success / empty / error
```

The source files to read next:

1. `mfe-orders/src/app/orders-api.ts`: interface, scenario type, fixture adapter, and injection token factory.
2. `mfe-orders/src/app/order-fixtures.ts`: fixture data, separated from state ownership.
3. `mfe-orders/src/app/orders-store.ts`: request orchestration with RxJS and state exposure with signals.
4. `mfe-orders/src/app/orders-page.ts`: explicit loading, error, dataset-empty, and success views.
5. `mfe-orders/src/app/order-detail.ts`: missing order is shown only after a successful load.
6. `mfe-inventory/src/app/inventory-store.ts`: domain-owned state that survives navigation.
7. `mfe-inventory/src/app/stock-rules.ts`: stock validation and zero-floor reservation rule.

## 21. Why these asynchronous choices?

- `InjectionToken`: TypeScript interfaces disappear at runtime. A token gives Angular a runtime key for an adapter implementing the interface. Tests can replace it without changing the store.
- `Subject`: represents explicit load commands from the UI.
- `switchMap`: subscribes to the newest read and unsubscribes the previous one. This prevents a stale response from winning. It cancels the fixture timer; future HTTP cancellation depends on the transport. It does not undo server work or committed writes.
- `defer`: invokes the adapter at subscription time and converts a synchronous adapter exception into an observable error.
- Inner `catchError`: turns this request's failure into error state without terminating the outer command stream, so another load can recover.
- `takeUntilDestroyed`: cleans up the subscription when the owning injector is destroyed. A root-provided store lives beyond a page navigation.
- Signals: expose current status, data, and computed totals to the template. RxJS owns asynchronous orchestration; signals own the current view state.

```text
idle -> loading -> success (rows or empty collection)
                -> error -> loading -> success
loading -> another load -> cancel previous subscription -> latest result
```

Loading clears previous data and hides order metrics. Simulation commands are guarded while data is unavailable. `ensureLoaded()` starts only from idle, so page navigation does not overwrite local changes or duplicate a pending load. Explicit load/reset controls discard local order changes and restore the selected fixture response. Empty/error results stay cached until the user explicitly loads again.

The demo retry button intentionally requests healthy fixtures. It demonstrates recovery; a production retry should repeat the actual failed operation. Do not apply latest-read-wins cancellation blindly to writes such as payment or stock reservation requests.

## 22. Milestone 02 exercises and verification

1. Observe the 700 ms loading state on `/orders`.
2. Simulate API failure and recover using Retry with demo data.
3. Load an empty response, restore demo data, then search for a nonexistent customer. Explain why these are different states.
4. Select failure then success rapidly. The latest request should determine the final view.
5. Refresh `/orders/ORD-1048`. Loading should precede details. Refresh an unknown ID and wait for successful data loading before the missing-order message.
6. Reserve all four monitor units. Confirm further reservations cannot produce negative stock.
7. Navigate away from inventory and return; the reservation should remain. Refresh to reset browser memory.

Automated checks cover fulfillment transitions, loading and caching, empty versus error state, failure recovery, stale-request suppression, injector cleanup, asynchronous fixture responses, shared inventory store identity, and stock validation. Run `npm test`, `npm run check:boundaries`, and `npm run build`. No new dependency is needed. Browser interactions and responsive rendering still require a manual pass.

Verification completed: all nine tests passed, domain boundary validation passed, the production build passed, and both HTML documents passed navigation checks. The final build reported approximately 245.96 kB initial raw output and 69.06 kB estimated transfer; these are build estimates rather than measured browser performance.

At the end of Milestone 02, backend validation, federation, and real-time SSE remained future work. Milestone 03 below adds federation; backend validation and business SSE remain outstanding.

References: [RxJS catchError](https://rxjs.dev/api/operators/catchError), [RxJS switchMap](https://rxjs.dev/api/operators/switchMap), and [Angular takeUntilDestroyed](https://angular.dev/api/core/rxjs-interop/takeUntilDestroyed).

## 23. Separate project folders — preparation for federation (historical checkpoint)

The workspace now contains three Angular applications. Each has its own `src/main.ts`, document template, app tsconfig, build target, and serve target. Dependencies and lockfile stay at the repository root; run installation there once.

```text
mfe-shell/
  src/main.ts                      # Composition bootstrap
  src/app/app.ts                   # Shell layout and outlet
  src/app/not-found.ts
  tsconfig.app.json
mfe-orders/
  src/main.ts                      # Standalone development bootstrap
  src/app/app.ts                   # Minimal standalone frame
  src/app/orders.routes.ts         # Public route surface
  src/app/orders-page.ts
  src/app/order-detail.ts
  src/app/orders-store.ts
  src/app/orders-api.ts
  src/app/order-fixtures.ts
  src/app/order-rules.ts
  tsconfig.app.json
mfe-inventory/
  src/main.ts                      # Standalone development bootstrap
  src/app/app.ts
  src/app/inventory.routes.ts      # Public route surface
  src/app/inventory-page.ts
  src/app/inventory-store.ts
  src/app/stock-rules.ts
  tsconfig.app.json
shared/styles.css
angular.json
package.json
```

The root `tsconfig.app.json` forwards to the shell config for compatibility; Angular build targets use each project's own config. The existing roadmap's `apps/` and `libs/` tree is a conceptual future option; the active implementation uses these top-level `mfe-*` folders.

## 24. How the shell composed local domains (historical checkpoint)

```ts
// mfe-shell/src/main.ts — route excerpt
{
  path: 'orders',
  loadChildren: () => import('@pulseops/orders/routes')
    .then(m => m.ORDERS_ROUTES)
}

// mfe-orders/src/app/orders.routes.ts — route excerpt
{
  path: ':id',
  loadComponent: () => import('./order-detail').then(m => m.OrderDetail)
}
```

`loadChildren` loads a route array; it does not require an NgModule. The shell owns the `/orders` prefix and the domain owns its relative child routes, producing `/orders/:id`. `withComponentInputBinding()` stays enabled by the shell and the standalone orders bootstrap, so the detail component still receives its `id` parameter.

The aliases in root `tsconfig.json` resolve to local public route files during compilation. They are not URLs or runtime remote loaders. Both domain pages and their stores run inside the shell's Angular application when accessed through port 4200. Domain standalone `main.ts` and wrapper `App` files do not run inside the shell.

The boundary checker now parses TypeScript import/export declarations and dynamic imports. Domains cannot import another project's implementation. The shell may import its own files and the approved domain route aliases, but not domain stores or components directly. Shared styling has no TypeScript business dependencies.

## 25. Separate-folder verification (historical checkpoint)

```sh
npm start                 # Shell on 4200; same as start:shell
npm run start:orders      # Standalone orders on 4201
npm run start:inventory   # Standalone inventory on 4202
```

Use separate terminals if running all three. The shell requires only its own server; it loads locally compiled domain chunks. Preview applications have separate root injectors and memory, so changes do not synchronize between ports.

```sh
npm test
npm run check:boundaries
npm run build             # Builds all three
npm run build:shell
npm run build:orders
npm run build:inventory
```

Build output is under `dist/mfe-shell/browser`, `dist/mfe-orders/browser`, and `dist/mfe-inventory/browser`. All three production builds and the existing nine tests passed after the move. Browser rendering and interactions remain manual verification tasks.

Development-server checks also passed: standalone orders and inventory compiled on 4201 and 4202 and served their application documents. Since 4200 was already occupied, the restructured shell was checked on 4300 using `npm run start:shell -- --port 4300`; an order deep link returned its application document successfully. These HTTP checks do not verify browser interactions. Restart any old development server after the workspace configuration change.

Separate folders and artifacts are preparation, not proof of runtime federation. Changing a domain's source currently requires rebuilding the composed shell. The next federation checkpoint replaces the local route alias loader with a compatible runtime remote loader, then demonstrates an independent domain release without a shell rebuild.

## 26. Milestone 03 — host and remoteEntry implementation

The current application uses Native Federation v4 through the Angular 21-compatible adapter `@angular-architects/native-federation-v4@21.2.18`. Unlike Webpack federation, its generated entry is `remoteEntry.json`, containing metadata that points to executable JavaScript. The earlier local route-alias integration in sections 23–25 is historical and has been removed.

- Shell: `mfe-shell`, port 4200, no exposed business route of its own.
- Orders remote: `mfe-orders`, port 4201, exposes `./Routes` exporting `ORDERS_ROUTES`.
- Inventory remote: `mfe-inventory`, port 4202, exposes `./Routes` exporting `INVENTORY_ROUTES`.
- Remote URL configuration: `mfe-shell/public/federation.manifest.json`.
- Generated entries: `http://localhost:4201/remoteEntry.json` and `http://localhost:4202/remoteEntry.json`.

```json
{
  "mfe-orders": "http://localhost:4201/remoteEntry.json",
  "mfe-inventory": "http://localhost:4202/remoteEntry.json"
}
```

Each application's `federation.config.mjs` defines its name, exposures, and shared dependencies. The adapter builds remote metadata, exposed modules, and shared runtime bundles. Never hand-author the generated remote entry. Deploy each complete browser output directory rather than copying only the entry file.

## 27. Follow the host startup and remote route loading

```text
shell index.html -> shim + main.ts
  -> initFederation('federation.manifest.json')
  -> fetch host/remote metadata and prepare shared dependency import maps
  -> dynamic import('./bootstrap')
  -> bootstrap(runtime) -> Angular App + provideRouter(createRoutes(runtime))
  -> /orders -> loadRemoteModule('mfe-orders', './Routes')
  -> ORDERS_ROUTES -> lazy order component -> shell RouterOutlet
```

The shell's `main.ts` deliberately avoids importing Angular components before federation initialization finishes. The original Angular setup lives in `bootstrap.ts`. The remote entry metadata can be fetched at startup even though exposed business modules load on route activation.

```ts
// mfe-shell/src/app/app.routes.ts — simplified happy path
export const createRoutes = ({ loadRemoteModule }: NativeFederationResult): Routes => [
  {
    path: 'orders',
    loadChildren: () => loadRemoteModule('mfe-orders', './Routes')
      .then(module => module.ORDERS_ROUTES)
  }
];
```

The actual implementation validates the exported route array and catches entry/exposed-route loading failures. The loader is taken from the initialized runtime rather than the deprecated global helper, giving the route factory an explicit runtime instance. `withComponentInputBinding()` remains enabled for the composed order-detail route.

When a domain is opened directly, its own `main.ts` initializes federation with an empty remote map, then starts its standalone Angular wrapper. When consumed by the shell, those standalone entry points do not execute; the host loads only the exposed routes and referenced feature code. Separate tabs and standalone ports have independent in-memory state.

## 28. Sharing, failure behavior, and architecture boundaries

Angular core/common/router/platform-browser and RxJS use compatible singleton sharing and version requirements. Angular secondary entry points, including signal/RxJS interop, are included. This aligns the runtime and injector identities; it does not merge business stores across separate browser applications or provide a security sandbox.

The TypeScript aliases to domain route files were removed from root `tsconfig.json`. The boundary checker rejects imports of another application's source, including the shell importing a domain route directly. Milestone 04 permits the explicit shared auth-contract alias; it does not allow direct application-to-application imports. Remote names and exposed keys are runtime contracts rather than TypeScript source dependencies.

Missing remote entries are tolerated during initialization. Loading an unavailable exposed route returns a shell-owned fallback. Available domains remain navigable. Restore the remote and use Reload and retry: the implementation intentionally reloads the page to recreate runtime and cached route configuration. This fallback covers entry/exposed-route loading, not arbitrary component exceptions or every later nested chunk failure. A fatal host initialization failure is displayed in the root element.

The shared stylesheet is compiled into each app. A remote-only feature change can be built independently, but editing shared global styles still requires a deliberate compatibility/release decision. Production rollback, immutable hosting, and a release pipeline remain to be implemented.

## 29. Run and verify federation

Install once at the root, then use three terminals, preferably remotes first:

```sh
npm ci
npm run start:orders
npm run start:inventory
npm run start:shell
```

Open the shell on `http://localhost:4200`. If the port is occupied, restart the old server or use `npm run start:shell -- --port 4300`. The remotes must be reachable to use their features; the host no longer has locally compiled domain features as a fallback.

`angular.json` now has federation `build` and `serve` wrappers, underlying `esbuild` and `serve-original` targets, and per-project ports. Do not bypass the wrappers for normal development, because federation metadata must also be built.

```sh
npm test
npm run check:boundaries
npm run build
npm run test:e2e
```

Production output stays under `dist/<project>/browser`. Federation shared bundles are additional assets: the initial application bundle size alone no longer measures the complete cold-load cost. Inspect total browser transfer for performance decisions.

The browser test suite uses installed Google Chrome and launches temporary artifact servers on 4300/4201/4202. It checks generated remote entries, absence of domain fixtures from shell JavaScript, cross-origin loading of both exposed modules, routed state, direct order ID binding, standalone bootstraps, and failure recovery. `scripts/serve-build.mjs` is a local verification server, not production hosting.

An external-server mode runs the interaction checks against already started development servers, with shell on 4300:

```sh
PULSEOPS_E2E_EXTERNAL=1 npm run test:e2e -- --grep 'shell loads|direct remote|unavailable'
```

Verification: all three production builds, nine domain/store tests, and four production-artifact browser checks passed. The three browser interaction checks also passed against the Native Federation development servers. The shell test server used 4300 because an existing process occupied 4200. Browser requests confirmed both remoteEntry.json files and both exposed route modules were fetched from remote origins. A blocked inventory entry left orders usable; restoring it and reloading recovered inventory.

Sources: [Native Federation Angular runtime](https://native-federation.com/docs/v4/angular-adapter/runtime/), [Angular adapter builder](https://native-federation.com/docs/v4/angular-adapter/builder/), and [Angular adapter setup](https://native-federation.com/docs/v4/angular-adapter/getting-started/).

## 30. Native Federation, CLI commands, and an Nx workflow

**Current repository:** Angular CLI 21.2 with Native Federation v4. Nx is not installed: there is no `nx.json` or `nx` dependency. The commands in the Nx recipe below are documentation, not a migration performed on this workspace. The existing runtime federation implementation remains unchanged.

**Three distinct responsibilities**

- Angular compiles components, checks templates, and runs the application/router.
- Native Federation builds remote metadata and exposed modules, prepares shared dependency resolution, and loads remote exports in the browser.
- Nx can orchestrate project tasks, cache configured build outputs, visualize dependencies, and select affected work. Adding Nx does not replace federation or automatically create remote entries.

**How Native Federation works — build time**

1. Each project supplies `federation.config.mjs`: a name, shared package requirements, and optional exposures.
2. Orders exposes `./Routes` from its `orders.routes.ts`. Inventory exposes the same key from its own route file.
3. The federation builder wraps Angular's application builder and emits `remoteEntry.json`, exposed JavaScript, shared dependency bundles, and normal browser assets.
4. The shell is built without importing order/inventory source. Its own entry describes its shared runtime requirements; it exposes no business route.

**How Native Federation works — browser time**

1. The browser loads the shell document, import-map shim, and `main.ts` entry bundle.
2. `initFederation('federation.manifest.json', ...)` reads deployment locations and metadata, then prepares compatible shared-module mappings.
3. An import map associates bare package names such as `@angular/core` with generated module URLs. Our configuration uses `es-module-shims` in shim mode.
4. The shell dynamically imports `bootstrap.ts` only after initialization, then calls `bootstrapApplication` with the returned runtime.
5. Visiting `/orders` invokes the runtime's `loadRemoteModule('mfe-orders', './Routes')` and obtains `ORDERS_ROUTES` from the remote JavaScript module.
6. Angular mounts those child routes, lazy-loads the requested page, and renders it inside the shell outlet. `/orders/:id` still binds to the detail component's input.

```text
Build: config -> federation + Angular builders -> remoteEntry.json + JS
Browser: manifest -> metadata -> shared import map -> Angular bootstrap
         -> loadRemoteModule(remote name, exposed key)
         -> exported route array -> remote page in host outlet
Nx, if adopted: task graph -> run/cache those same build targets
```

**CLI and edits used in this implementation**

We installed the adapter and import-map shim through npm, then manually edited the build targets, federation configs, bootstrap split, manifest, route loading, and fallback. We did not run an Nx generator or the federation init schematic to produce the checked-in configuration. This dependency command reproduces the selected application packages:

```sh
npm install --save-exact @angular-architects/native-federation-v4@21.2.18 @angular/localize@21.2.26 es-module-shims@2.8.4
```

The existing lockfile is the normal starting point for another checkout:

```sh
npm ci
npm run start:orders
npm run start:inventory
npm run start:shell
```

Start those three servers in separate terminals. Use `npm run build` to generate all three complete browser outputs, then `npm run test:e2e` for the production-artifact checks after stopping other servers on the test ports.

**Equivalent scaffolding commands for a fresh Angular 21 workspace**

These are an alternative to the manual setup, not additional steps to rerun against the already federated PulseOps projects. They assume three existing standalone Angular applications with these project names and an installed matching adapter:

```sh
npx ng generate @angular-architects/native-federation-v4:init --project=mfe-orders --port=4201 --type=remote
npx ng generate @angular-architects/native-federation-v4:init --project=mfe-inventory --port=4202 --type=remote
npx ng generate @angular-architects/native-federation-v4:init --project=mfe-shell --port=4200 --type=dynamic-host
```

`--project` selects the Angular project. `--port` sets the development endpoint. `--type=remote` scaffolds a producer; `dynamic-host` scaffolds a host that reads a deployment manifest. The generated starter exposure is typically `./Component`; change it to `./Routes` and point it at your domain route file to match PulseOps. Inspect the generated bootstrap, polyfills, manifest assets, shared packages, and builder targets rather than assuming scaffolding has completed all product integration work.

For Angular 21, this project uses the `-v4` package name. Angular 22 documentation uses `@angular-architects/native-federation` without that suffix. Choose a compatible adapter rather than copying a package name from a different Angular major.

**Optional Nx adoption for this already federated workspace**

Nx's Angular CLI migration entry point is:

```sh
npx nx@latest init
```

This command changes repository configuration; it has not been executed here. Use the installed Node/Angular/Nx compatibility guides before adoption. Nx's current matrix lists Angular 21.2 support from Nx 22.6 onward; keep installed `nx` and `@nx/*` package versions aligned. The standard Angular CLI migration can preserve the current top-level `mfe-*` folder layout while moving project targets into Nx configuration. An integrated migration is a separate choice that can relocate applications; that is not needed just to gain task orchestration.

After adoption, inspect the discovered project names and target definitions before running them:

```sh
npx nx show projects
npx nx show project mfe-shell
npx nx graph
npx nx run mfe-orders:build
npx nx run mfe-inventory:build
npx nx run mfe-shell:build
npx nx run-many -t build -p mfe-shell,mfe-orders,mfe-inventory
npx nx run mfe-orders:serve
npx nx run mfe-inventory:serve
npx nx run mfe-shell:serve
```

Run serve commands in separate terminals. Confirm each Nx target still uses the federation build/serve wrapper and its correct underlying target, paths, and port. Nx executes those configured targets; `loadRemoteModule()` still runs later in the browser. Application route/exposure files do not need an Nx-specific runtime loader.

**Nx generator equivalent for fresh, unfederated application projects**

When using a compatible Nx setup that exposes the adapter's application schematic, the documented application init entry point is:

```sh
npx nx g @angular-architects/native-federation-v4:init --project=mfe-orders --port=4201 --type=remote
npx nx g @angular-architects/native-federation-v4:init --project=mfe-inventory --port=4202 --type=remote
npx nx g @angular-architects/native-federation-v4:init --project=mfe-shell --port=4200 --type=dynamic-host
```

These setup examples have not been run or validated in an Nx workspace here. Generator integration is version-sensitive: inspect `npx nx list @angular-architects/native-federation-v4` and the installed package's collection before execution. The inspected 21.2.18 package has an application `init` schematic and a separate `native-federation` generator for a library. That library generator is not the command to turn the shell into a dynamic host.

**Caching and affected builds require explicit design**

Cache complete build outputs, including shared assets and remoteEntry metadata. Include federation configs, relevant TypeScript configs, root package/lock files, and `shared/styles.css` in task inputs. Inspect Nx's inferred inputs before narrowing them; a shared dependency or stylesheet change can affect multiple artifacts. Serve targets are long-running processes, not reusable build results.

With Git available, an affected-build example is:

```sh
npx nx affected -t build --base=origin/main --head=HEAD
```

Replace `origin/main` with the real CI base revision. Runtime remote-name strings do not create normal source-import edges from the shell to remotes. Preserve independent builds, then explicitly run host/remote compatibility browser checks when a remote changes. Do not conclude that an unchanged shell is integration-safe just because its own build is unaffected. Existing npm-based domain and browser tests remain separate until you deliberately register equivalent Nx targets.

**Teach it back**

- Which tool emits remoteEntry.json? The federation builder, as part of each project build.
- Which tool schedules or caches builds? Nx, if adopted and configured.
- Does Nx load the remote in the browser? No; the initialized federation runtime does.
- Why is bootstrap.ts imported asynchronously? Shared-module resolution must be ready before Angular code executes.
- Are manifest keys, exposure keys, and exported symbols interchangeable? No: `mfe-orders`, `./Routes`, and `ORDERS_ROUTES` identify different layers of the contract.
- Why can the shell's affected build be skipped while integration tests must still run? A remote can change its runtime contract without changing host source.

**References checked on 13 November 2026:** [adapter schematics](https://native-federation.com/docs/v4/angular-adapter/schematics/), [runtime](https://native-federation.com/docs/v4/angular-adapter/runtime/), [Nx Angular CLI adoption](https://nx.dev/docs/kb/migrate-angular-cli-to-nx), [Nx Angular compatibility](https://nx.dev/docs/kb/angular-nx-version-matrix), and [Nx task commands](https://nx.dev/docs/reference/nx-commands). The installed adapter sources were also inspected; Nx commands are a documented recipe, not executed verification.

## 31. Milestone 04 — demo login, shared session, and startup feedback

The current application has a working client-side demo sign-in flow. It does not have a backend or a trusted authentication session. Use only `operator@pulseops.demo` with password `PulseOpsDemo!`; the sample credential check exists to teach navigation and shared state. Server-side identity verification and authorization remain future work.

**Start and sign in**

```sh
npm ci
npm run start:all
```

The launcher checks 4200/4201/4202 before starting all three development servers. It reports conflicts rather than connecting to an old server with mismatched federation artifacts. Stop old processes first. Alternatively use the individual start commands in separate terminals. Open `http://localhost:4200` and keep that hostname consistent: `127.0.0.1` is a different browser storage origin.

The initial document shows startup progress while federation initializes. A fatal startup failure shows recovery information instead of an empty root. Missing remote-route modules still use the separate shell-owned remote fallback.

**Follow the route and session flow**

```text
/orders/ORD-1048
  -> shell guard checks demo session
  -> anonymous: /login?returnUrl=...
  -> valid demo credentials
  -> populate shell DemoSession
  -> navigate to allowlisted return URL
  -> guarded WorkspaceLayout
  -> load remote routes -> order detail
```

Direct `/login` returns to `/orders` after sign-in. A protected inventory URL returns to inventory. The return-URL helper accepts internal orders, one order-detail segment, and inventory paths; invalid, external, login-loop, or unsupported destinations fall back to `/orders`. The session is updated before the destination guard runs.

**Ownership and dependency injection**

- `mfe-shell/src/app/app.ts`: root router outlet. It no longer owns the workspace sidebar.
- `mfe-shell/src/app/workspace-layout.ts`: protected frame, current user, navigation, and Sign out.
- `mfe-shell/src/app/auth/login/login.ts`: validated form, submitting state, credential error, and post-login navigation.
- `mfe-shell/src/app/auth/demo-session.ts`: demo identity, restoration, expiry, and logout lifecycle.
- `mfe-shell/src/app/auth/auth.guards.ts`: public-login and protected-route decisions.
- `shared/auth-contract/index.ts`: `SessionContext`, user type, and the `SESSION_CONTEXT` injection token.

All three federation configs map `@pulseops/auth-contract` as a singleton. Angular tokens are runtime objects: importing independently bundled copies would create different token identities. The shell binds that token to its single `DemoSession` instance with `useExisting`; composed remote pages read the same current user through the token without importing the shell service. Remote standalone wrappers instead supply the explicit `preview@pulseops.demo` fixture session.

**Persistence, expiry, and logout**

A 30-minute marker in this tab's `sessionStorage` restores the demo identity after refresh. It contains an email and expiry, not a password or authentication token. The marker is untrusted client-side data and must not be treated as a production credential. Reload resets order/inventory fixtures even if the demo session is restored.

Sign out clears the marker and reloads the document. This also destroys root-scoped remote stores and pending fixture requests. Expiry returns to login, preserving an allowed destination for another sign-in. Changing tabs or origins does not share an in-memory Angular service. Production logout/expiry will also need backend invalidation.

**Manual verification exercise**

1. Open inventory while signed out. Confirm public login appears without the workspace sidebar.
2. Submit missing/invalid values and incorrect sample credentials. Confirm the form stays on login with useful messages.
3. Sign in with the sample account. Confirm navigation returns to inventory.
4. Open orders and its details. Confirm both remotes display the same host demo email.
5. Refresh the host. Confirm the same tab restores the unexpired demo identity.
6. Reserve stock, sign out, sign in again, and confirm domain fixtures reset.
7. Try an external or unsupported return URL. Confirm the destination defaults to orders.
8. Open a standalone remote and compare its preview identity with the host session.

The browser suite covers login/session behavior as well as federation. Run `npm test`, `npm run check:boundaries`, `npm run build`, and `npm run test:e2e`. Read the actual command output for current pass/fail results; this section does not replace the verification report.

Verification completed after the interrupted login implementation: all three production builds, 11 unit/store tests, boundary checks, and 14 browser tests passed. The same 14 browser checks passed against the development servers launched by `start:all` on 4200/4201/4202. Startup-delay and fatal-manifest/retry checks are included. A fresh build/restart worked; the original reported blank page was not reproduced, so a specific original browser error was not established.

## 32. A concrete shared service — NotificationService

Added on 14 November 2026: `shared/notifications/index.ts` exports `NotificationService` through the `@pulseops/notifications` alias. This is a small platform service for UI notices, separate from the session contract and the domain-owned order/inventory stores. No new npm package is needed.

```ts
import { inject } from '@angular/core';
import { NotificationService } from '@pulseops/notifications';

const notifications = inject(NotificationService);
const id = notifications.notify('orders', 'Order status changed.');
notifications.dismiss(id);
notifications.clear();
```

**How one instance is shared**

The service uses `@Injectable({ providedIn: 'root' })`. The root TypeScript path maps `@pulseops/notifications` to the shared source, and every federation config includes that alias in singleton `sharedMappings` alongside `@pulseops/auth-contract`. Sharing the module preserves class-token identity; Angular then resolves the service from the composed host application's root injector. Providing the class again in a remote route or component would create another instance and defeat that lifetime choice.

```ts
// Federation config excerpt in shell and both remotes.
sharedMappings: mappingsFromWorkspace({
  singleton: true,
  strictVersion: true
}).only([
  '@pulseops/auth-contract',
  '@pulseops/notifications'
]).get()
```

**Service API and ownership**

- `notify(source, message)` creates a notice and returns its numeric ID. Source is `shell`, `orders`, or `inventory`.
- `messages()` exposes the read-only signal collection, newest first, capped at five entries.
- `latest()` is computed from the queue.
- `dismiss(id)` removes one notice; `clear()` empties the queue.
- The shell owns presentation in the workspace notification center. Orders and inventory publish local action feedback and show the latest shared notice through `data-testid="remote-notification"`.

```text
Shell welcome / Orders status action / Inventory reserve or reset
  -> shared NotificationService.notify(...)
  -> one root-owned signal queue
  -> shell notification center + remote latest-notice readouts
Shell dismiss/clear -> same queue -> all consumers update
```

**Try it and explain it**

1. Restart all three servers after changing shared federation mappings: `npm run start:all`.
2. Sign in. Observe the shell welcome notice.
3. Simulate an order update, navigate to inventory, and reserve stock. The shell center should show messages from both domains, subject to the five-entry limit.
4. Dismiss the latest message or clear all messages in the shell. The remote's latest-notice readout should change too, demonstrating shared state rather than identical duplicated services.
5. Navigate away and return; the queue should remain in that application. Reload or sign out; it resets.
6. Open a standalone remote on its own port. Its root wrapper shows that application's latest notice. It uses the same service code but a separate Angular application injector and memory.

A singleton federation mapping does not synchronize browser tabs, separate standalone applications, or backend processes. Notifications are UI feedback, not authoritative order state, stock reservations, or distributed events. Keep business rules inside their domain stores and use backend contracts for cross-domain consistency.

For verification, run the existing unit, boundary, build, and browser commands and review their current output. This documentation describes the intended demonstration and does not substitute for passing runtime checks.

Verification for the shared service on 14 November 2026: all three production builds, 13 unit/store tests, dependency boundary checks, and 17 browser tests passed. Browser tests specifically demonstrated cross-remote notification delivery, shell dismiss/clear updating remote consumers, standalone isolation, and notification reset after logout. Tests used temporary remote ports 4401 and 4402 to avoid stopping the already running development servers.

## 33. Production engineering baseline — lint, Sonar, coverage, and CI

The workspace now pins a supported ESLint10 toolchain, angular-eslint21 for the installed Angular major, type-aware typescript-eslint, Prettier, c8 coverage, and the Sonar npm scanner. `.nvmrc` selects Node24; `package.json` requires Node24.14+ within that major. These are local/CI quality controls; backend authentication and production operating controls remain future work.

```sh
npm run lint
npm run format:check
npm run check:boundaries
npm run test:coverage
npm run quality
npm run verify
```

Read `eslint.config.mjs`, `tsconfig.eslint.json`, `.prettierrc.json`, `.c8rc.json`, `scripts/coverage-check.mjs`, `sonar-project.properties`, `.github/workflows/quality.yml`, and `docs/production-readiness.md` in that order. ESLint checks TypeScript and inline Angular templates, including promise handling, unsafe types, and accessibility. Template `$any` escapes were replaced with typed template references; browser artifact JSON is now checked at runtime before typed use. The boundary checker also validates shared modules and import-type references, rather than only domain source folders.

Coverage maps the temporary test JavaScript back to original TypeScript sources. All runtime app/shared sources remain in the full report; untested UI/bootstrap/session files are visible. A separate 80% line gate covers seven explicitly listed core files. Passing that focused gate must not be presented as 80% full-app coverage. Production browser contracts are a different gate and are not added to unit LCOV coverage.

SonarQube for IDE is the current name for SonarLint. Workspace extension recommendations and ESLint/formatter settings are configured, preserving the existing editor theme. A real connected-mode binding needs the actual server/project and credentials in the IDE's credential storage. No fake connection IDs or tokens are committed.

The scanner requires explicit `SONAR_HOST_URL`, `SONAR_PROJECT_KEY`, and `SONAR_TOKEN`, plus the real organization for SonarQube Cloud. It imports `coverage/lcov.info` and waits for the server-side quality gate. Missing configuration fails clearly. No remote analysis has been run. The CI scan job is opt-in through `SONAR_ENABLED=true`, excludes fork PRs, and reads the token from secrets.

CI runs local quality checks, all three production builds, and browser contracts, then retains diagnostics and complete build artifacts. Action references are pinned to verified commits. Merge requirements and the server's new-code policy still need repository/server administration; they are not activated by merely checking in YAML or a properties file.

See `docs/production-readiness.md` for the prioritized path beyond tooling: verified identity, authorized/atomic domain APIs, tenant isolation, immutable asset publication, compatibility/rollback evidence, telemetry, performance, and accessibility.

Verification on 14 November 2026: root ESLint and all three Angular lint targets, type checking, formatting, strengthened boundaries, 14 unit/store tests with source-mapped coverage, all three production builds, and 17 browser tests passed. Full-app unit line coverage was 22.96%; the explicit core gate passed at 80% or more for each listed file. The server scan remains unconfigured; no remote Sonar or GitHub quality-gate result is claimed.
