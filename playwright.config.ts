import { defineConfig } from '@playwright/test';

const host = process.env['PULSEOPS_E2E_BASE_URL'] || 'http://127.0.0.1:4300';
const orders = process.env['PULSEOPS_E2E_ORDERS_ORIGIN'] || 'http://localhost:4201';
const inventory = process.env['PULSEOPS_E2E_INVENTORY_ORIGIN'] || 'http://localhost:4202';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  use: {
    baseURL: host,
    channel: process.env['PLAYWRIGHT_CHANNEL'] || 'chrome',
    trace: 'retain-on-failure',
  },
  webServer:
    process.env['PULSEOPS_E2E_EXTERNAL'] === '1'
      ? undefined
      : [
          {
            command: `node scripts/serve-build.mjs mfe-shell ${new URL(host).port}`,
            url: host,
            reuseExistingServer: false,
          },
          {
            command: `node scripts/serve-build.mjs mfe-orders ${new URL(orders).port}`,
            url: orders + '/remoteEntry.json',
            reuseExistingServer: false,
          },
          {
            command: `node scripts/serve-build.mjs mfe-inventory ${new URL(inventory).port}`,
            url: inventory + '/remoteEntry.json',
            reuseExistingServer: false,
          },
        ],
});
