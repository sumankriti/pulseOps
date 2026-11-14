import { test, expect, type Page } from '@playwright/test';
import { readFile, readdir } from 'node:fs/promises';

const DEMO_EMAIL = 'operator@pulseops.demo';
const DEMO_PASSWORD = 'PulseOpsDemo!';
const ORDERS_ORIGIN = new URL(process.env['PULSEOPS_E2E_ORDERS_ORIGIN'] || 'http://localhost:4201')
  .origin;
const INVENTORY_ORIGIN = new URL(
  process.env['PULSEOPS_E2E_INVENTORY_ORIGIN'] || 'http://localhost:4202',
).origin;

function isRemoteResource(url: string, origin: string, pathname: RegExp): boolean {
  const parsed = new URL(url);
  return parsed.origin === origin && pathname.test(parsed.pathname);
}

async function submitDemoLogin(page: Page): Promise<void> {
  await page.getByLabel('Email', { exact: true }).fill(DEMO_EMAIL);
  await page.getByLabel('Password', { exact: true }).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}

async function signIn(page: Page, destination = '/orders'): Promise<void> {
  await page.goto(destination);
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await submitDemoLogin(page);
  await expect(page).toHaveURL((url) => url.pathname === destination.split('?')[0]);
}

interface RemoteEntry {
  name: string;
  exposes: { key: string; outFileName: string }[];
}

function isRemoteEntry(value: unknown): value is RemoteEntry {
  return (
    typeof value === 'object' &&
    value !== null &&
    'name' in value &&
    typeof value.name === 'string' &&
    'exposes' in value &&
    Array.isArray(value.exposes) &&
    value.exposes.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'key' in item &&
        typeof item.key === 'string' &&
        'outFileName' in item &&
        typeof item.outFileName === 'string',
    )
  );
}

test('generated entries expose routes and shell output contains no domain fixtures', async () => {
  for (const name of ['mfe-orders', 'mfe-inventory']) {
    const entry: unknown = JSON.parse(
      await readFile(`dist/${name}/browser/remoteEntry.json`, 'utf8'),
    );
    if (!isRemoteEntry(entry)) throw new Error(`Invalid remote entry for ${name}`);
    expect(entry.name).toBe(name);
    expect(entry.exposes.some((item: { key: string }) => item.key === './Routes')).toBe(true);
    const exposed = entry.exposes.find((item) => item.key === './Routes');
    if (!exposed) throw new Error(`Routes exposure missing for ${name}`);
    expect(await readFile(`dist/${name}/browser/${exposed.outFileName}`, 'utf8')).toBeTruthy();
  }
  const files = await readdir('dist/mfe-shell/browser');
  const scripts = await Promise.all(
    files
      .filter((file) => file.endsWith('.js'))
      .map((file) => readFile(`dist/mfe-shell/browser/${file}`, 'utf8')),
  );
  expect(scripts.join('\n')).not.toContain('Alex Morgan');
  expect(scripts.join('\n')).not.toContain('Studio Headphones');
});

test('shell loads both remote route bundles and preserves routed domain state', async ({
  page,
}) => {
  const urls: string[] = [];
  const errors: string[] = [];
  page.on('request', (request) => urls.push(request.url()));
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, '/orders');
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  await expect(page.getByTestId('remote-session')).toContainText(DEMO_EMAIL);
  await expect(page.getByRole('link', { name: 'ORD-1048', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'ORD-1048', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'ORD-1048', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Simulate next status' }).click();
  await expect(page.locator('dd').filter({ hasText: /^Shipped$/ })).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await expect(page.getByTestId('remote-session')).toContainText(DEMO_EMAIL);
  const monitor = page.getByRole('row').filter({ hasText: 'MON-003' });
  await monitor.getByRole('button', { name: 'Reserve 1' }).click();
  await expect(monitor.locator('td').nth(2)).toHaveText('3');
  await nav.getByRole('link', { name: 'Orders', exact: true }).click();
  await page.getByRole('link', { name: 'ORD-1048', exact: true }).click();
  await expect(page.locator('dd').filter({ hasText: /^Shipped$/ })).toBeVisible();
  await nav.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(
    page.getByRole('row').filter({ hasText: 'MON-003' }).locator('td').nth(2),
  ).toHaveText('3');
  expect(urls.some((url) => isRemoteResource(url, ORDERS_ORIGIN, /^\/remoteEntry\.json$/))).toBe(
    true,
  );
  expect(urls.some((url) => isRemoteResource(url, INVENTORY_ORIGIN, /^\/remoteEntry\.json$/))).toBe(
    true,
  );
  expect(urls.some((url) => isRemoteResource(url, ORDERS_ORIGIN, /^\/Routes(?:-.*?)?\.js$/))).toBe(
    true,
  );
  expect(
    urls.some((url) => isRemoteResource(url, INVENTORY_ORIGIN, /^\/Routes(?:-.*?)?\.js$/)),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test('direct remote detail URL binds its id and standalone previews work', async ({ page }) => {
  await signIn(page, '/orders/ORD-1047');
  await expect(page.getByRole('heading', { name: 'ORD-1047', exact: true })).toBeVisible();
  await page.goto(`${ORDERS_ORIGIN}/orders/ORD-1048`);
  await expect(page.getByRole('heading', { name: 'ORD-1048', exact: true })).toBeVisible();
  await page.goto(`${INVENTORY_ORIGIN}/inventory`);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
});

test('an unavailable inventory remote leaves orders and shell navigation usable', async ({
  page,
}) => {
  await page.route(`${INVENTORY_ORIGIN}/**`, (route) => route.abort());
  await signIn(page, '/orders');
  await expect(page.getByRole('link', { name: 'ORD-1048', exact: true })).toBeVisible();
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await nav.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'This workspace could not be loaded' }),
  ).toBeVisible();
  await nav.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByRole('link', { name: 'ORD-1048', exact: true })).toBeVisible();
  await page.unroute(`${INVENTORY_ORIGIN}/**`);
  await page.reload();
  await nav.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
});

test('login validates fields, rejects wrong credentials, and defaults to orders', async ({
  page,
}) => {
  await page.goto('/login');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await expect(page.getByText('Enter your password.', { exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('invalid-email');
  await page.getByLabel('Password', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Enter a valid email address.', { exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(DEMO_EMAIL);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Email or password is incorrect.');
  await expect(page.getByLabel('Password', { exact: true })).toHaveValue('');
  await expect(page).toHaveURL(/\/login$/);
  await submitDemoLogin(page);
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
});

test('guard remembers inventory deep link and does not load exposed route code before login', async ({
  page,
}) => {
  const exposedRequests: string[] = [];
  page.on('request', (request) => {
    if (
      [ORDERS_ORIGIN, INVENTORY_ORIGIN].some((origin) =>
        isRemoteResource(request.url(), origin, /^\/Routes(?:-.*?)?\.js$/),
      )
    )
      exposedRequests.push(request.url());
  });
  await page.goto('/inventory');
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/inventory');
  expect(exposedRequests).toEqual([]);
  await submitDemoLogin(page);
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await expect(page.getByTestId('remote-session')).toContainText(DEMO_EMAIL);
});

test('session survives refresh and an authenticated login visit returns to the requested page', async ({
  page,
}) => {
  await signIn(page, '/orders/ORD-1047');
  await expect(page.getByRole('heading', { name: 'ORD-1047', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'ORD-1047', exact: true })).toBeVisible();
  await expect(page.getByTestId('remote-session')).toContainText(DEMO_EMAIL);
  await page.goto('/login?returnUrl=%2Finventory');
  await expect(page).toHaveURL(/\/inventory$/);
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
});

test('logout clears the demo marker and resets remote domain state for the next session', async ({
  page,
}) => {
  await signIn(page, '/inventory');
  const monitor = page.getByRole('row').filter({ hasText: 'MON-003' });
  await monitor.getByRole('button', { name: 'Reserve 1' }).click();
  await expect(monitor.locator('td').nth(2)).toHaveText('3');
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  expect(await page.evaluate(() => sessionStorage.getItem('pulseops.demo-session.v1'))).toBeNull();
  await submitDemoLogin(page);
  await expect(page).toHaveURL(/\/orders$/);
  await page
    .getByRole('navigation', { name: 'Main navigation' })
    .getByRole('link', { name: 'Inventory', exact: true })
    .click();
  await expect(
    page.getByRole('row').filter({ hasText: 'MON-003' }).locator('td').nth(2),
  ).toHaveText('4');
});

test('expired stored session returns to login rather than showing the protected page', async ({
  page,
}) => {
  await signIn(page, '/inventory');
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  await page.evaluate(() =>
    sessionStorage.setItem(
      'pulseops.demo-session.v1',
      JSON.stringify({
        email: 'operator@pulseops.demo',
        expiresAt: Date.now() - 1000,
      }),
    ),
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/inventory');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
});

for (const destination of ['https://example.com/steal', '//example.com/steal', '/login']) {
  test(`login rejects unsafe return destination ${destination}`, async ({ page, baseURL }) => {
    await page.goto('/login?returnUrl=' + encodeURIComponent(destination));
    await submitDemoLogin(page);
    await expect(page).toHaveURL(
      (url) => url.origin === new URL(baseURL!).origin && url.pathname === '/orders',
    );
    await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  });
}

test('startup shows a loading state while the federation manifest is pending', async ({ page }) => {
  let releaseManifest!: () => void;
  let markRequested!: () => void;
  const pendingManifest = new Promise<void>((resolve) => {
    releaseManifest = resolve;
  });
  const manifestRequested = new Promise<void>((resolve) => {
    markRequested = resolve;
  });
  await page.route('**/federation.manifest.json', async (route) => {
    markRequested();
    await pendingManifest;
    await route.continue();
  });

  // Commit does not wait for the delayed startup work or its resulting page load.
  await page.goto('/login', { waitUntil: 'commit' });
  try {
    await manifestRequested;
    await expect(
      page.getByRole('heading', { name: 'Starting PulseOps', exact: true }),
    ).toBeVisible();
  } finally {
    releaseManifest();
  }
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
});

test('fatal manifest failure displays retry UI and recovers after reload', async ({ page }) => {
  await page.route('**/federation.manifest.json', (route) => route.abort());
  await page.goto('/login', { waitUntil: 'commit' });
  await expect(
    page.getByRole('heading', { name: 'PulseOps could not start', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reload and retry', exact: true })).toBeVisible();
  await page.unroute('**/federation.manifest.json');
  await page.getByRole('button', { name: 'Reload and retry', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
});

test('shell and both remotes observe the same notification service across navigation', async ({
  page,
}) => {
  await signIn(page, '/orders');
  const notifications = page.getByRole('region', { name: 'Notifications', exact: true });
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(notifications).toContainText('Welcome to PulseOps. Your workspace is ready.');
  await expect(page.getByTestId('remote-notification')).toContainText(
    'Welcome to PulseOps. Your workspace is ready.',
  );

  await notifications.getByRole('button', { name: 'Clear notifications', exact: true }).click();
  await expect(page.getByTestId('remote-notification')).toContainText(
    'No shared notifications yet.',
  );
  const simulate = page.getByRole('button', { name: 'Simulate update', exact: true });
  await expect(simulate).toBeEnabled();
  await simulate.click();
  const orderNotice = 'ORD-1048 changed to Shipped.';
  await expect(notifications).toContainText(orderNotice);
  await expect(notifications).toContainText('Orders');
  await expect(page.getByTestId('remote-notification')).toContainText(orderNotice);

  await nav.getByRole('link', { name: 'Inventory', exact: true }).click();
  await expect(page.getByTestId('remote-notification')).toContainText(orderNotice);
  const monitor = page.getByRole('row').filter({ hasText: 'MON-003' });
  await monitor.getByRole('button', { name: 'Reserve 1', exact: true }).click();
  const stockNotice = 'Reserved one unit of MON-003 in this local demo.';
  await expect(notifications).toContainText(stockNotice);
  await expect(notifications).toContainText('Inventory');
  await expect(page.getByTestId('remote-notification')).toContainText(stockNotice);

  // The list is newest first. A shell command must update the remote's readout.
  await notifications
    .getByRole('button', { name: /^Dismiss notification / })
    .first()
    .click();
  await expect(notifications).not.toContainText(stockNotice);
  await expect(page.getByTestId('remote-notification')).toContainText(orderNotice);
  await notifications.getByRole('button', { name: 'Clear notifications', exact: true }).click();
  await expect(page.getByTestId('remote-notification')).toContainText(
    'No shared notifications yet.',
  );
  await nav.getByRole('link', { name: 'Orders', exact: true }).click();
  await expect(page.getByTestId('remote-notification')).toContainText(
    'No shared notifications yet.',
  );
});

test('standalone notification service is isolated from the composed host application', async ({
  page,
  context,
}) => {
  await signIn(page, '/orders');
  const simulate = page.getByRole('button', { name: 'Simulate update', exact: true });
  await expect(simulate).toBeEnabled();
  await simulate.click();
  await expect(page.getByTestId('remote-notification')).toContainText(
    'ORD-1048 changed to Shipped.',
  );

  const standalone = await context.newPage();
  await standalone.goto(`${INVENTORY_ORIGIN}/inventory`);
  await expect(standalone.getByTestId('standalone-notification')).toContainText(
    'No shared notifications yet.',
  );
  await standalone
    .getByRole('row')
    .filter({ hasText: 'MON-003' })
    .getByRole('button', { name: 'Reserve 1', exact: true })
    .click();
  await expect(standalone.getByTestId('standalone-notification')).toContainText(
    'Reserved one unit of MON-003 in this local demo.',
  );
  await expect(page.getByTestId('remote-notification')).toContainText(
    'ORD-1048 changed to Shipped.',
  );
  await expect(page.getByRole('region', { name: 'Notifications', exact: true })).not.toContainText(
    'Reserved one unit of MON-003 in this local demo.',
  );
  await standalone.close();
});

test('logout clears shared notification state before the next session', async ({ page }) => {
  await signIn(page, '/inventory');
  await page
    .getByRole('row')
    .filter({ hasText: 'MON-003' })
    .getByRole('button', { name: 'Reserve 1', exact: true })
    .click();
  await expect(page.getByRole('region', { name: 'Notifications', exact: true })).toContainText(
    'Reserved one unit of MON-003 in this local demo.',
  );
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Sign in to your workspace' })).toBeVisible();
  await submitDemoLogin(page);
  await expect(page.getByRole('heading', { name: 'Orders', exact: true })).toBeVisible();
  const notifications = page.getByRole('region', { name: 'Notifications', exact: true });
  await expect(notifications).not.toContainText('Reserved one unit of MON-003 in this local demo.');
  await expect(page.getByTestId('remote-notification')).toContainText(
    'Welcome to PulseOps. Your workspace is ready.',
  );
});
