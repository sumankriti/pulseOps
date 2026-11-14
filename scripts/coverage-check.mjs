import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The full report includes all application TypeScript, including untested UI.
// This initial gate targets the core currently exercised by unit tests. Browser
// integration checks are a separate gate; their execution is not unit coverage.
const core = [
  'mfe-orders/src/app/order-rules.ts',
  'mfe-orders/src/app/orders-api.ts',
  'mfe-orders/src/app/orders-store.ts',
  'mfe-inventory/src/app/stock-rules.ts',
  'mfe-inventory/src/app/inventory-store.ts',
  'mfe-shell/src/app/auth/return-url.ts',
  'shared/notifications/index.ts',
];
const lineThreshold = 80;
const coverage = JSON.parse(await readFile('coverage/coverage-final.json', 'utf8'));
const normalized = new Map(
  Object.entries(coverage).map(([file, data]) => [path.resolve(file), data]),
);
const failures = [];

for (const file of normalized.keys()) {
  if (file.includes(`${path.sep}.angular${path.sep}`)) {
    failures.push(`Generated coverage path was not remapped to source: ${file}`);
  }
}

for (const file of core) {
  const data = normalized.get(path.resolve(file));
  if (!data) {
    failures.push(`Missing core source coverage: ${file}`);
    continue;
  }
  // Istanbul line coverage is the maximum count among statements starting on
  // that line. This matches its summary rather than counting raw TS lines.
  const lines = new Map();
  for (const [id, statement] of Object.entries(data.statementMap)) {
    const line = statement.start.line;
    lines.set(line, Math.max(lines.get(line) ?? 0, data.s[id] ?? 0));
  }
  const total = lines.size;
  const covered = [...lines.values()].filter((count) => count > 0).length;
  const percentage = total ? (covered / total) * 100 : 0;
  console.log(`${file}: ${covered}/${total} executable lines (${percentage.toFixed(1)}%)`);
  if (!total || percentage < lineThreshold) {
    failures.push(`${file}: line coverage ${percentage.toFixed(1)}% is below ${lineThreshold}%`);
  }
}

if (failures.length) {
  failures.forEach((message) => console.error(message));
  process.exit(1);
}
console.log(
  `Core coverage gate passed: each listed core source has at least ${lineThreshold}% line coverage. Full-app coverage is reported separately.`,
);
