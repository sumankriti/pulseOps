import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const required = ['SONAR_HOST_URL', 'SONAR_PROJECT_KEY', 'SONAR_TOKEN'];
const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length) {
  console.error(
    `Sonar analysis is not configured. Set ${missing.join(', ')} and run npm run test:coverage first.`,
  );
  process.exitCode = 1;
} else {
  try {
    const server = new URL(process.env.SONAR_HOST_URL);
    if (
      !['https:', 'http:'].includes(server.protocol) ||
      server.username ||
      server.password ||
      server.search ||
      server.hash
    ) {
      throw new Error(
        'SONAR_HOST_URL must be an HTTP(S) base URL without credentials, query parameters, or fragments.',
      );
    }
    if (!/^[A-Za-z0-9_.:-]{1,400}$/.test(process.env.SONAR_PROJECT_KEY)) {
      throw new Error(
        'SONAR_PROJECT_KEY must use letters, digits, underscore, dash, period, or colon.',
      );
    }
    const coverage = path.join(workspace, 'coverage/lcov.info');
    await access(coverage);
    if (!(await readFile(coverage, 'utf8')).includes('SF:')) {
      throw new Error('coverage/lcov.info is empty or invalid; run npm run test:coverage first.');
    }
    process.chdir(workspace);
    const { scan } = await import('@sonar/scan');
    await scan({
      serverUrl: server.href,
      // The token is never placed in command arguments or tracked configuration.
      token: process.env.SONAR_TOKEN,
      options: {
        'sonar.projectKey': process.env.SONAR_PROJECT_KEY,
        ...(process.env.SONAR_ORGANIZATION?.trim()
          ? { 'sonar.organization': process.env.SONAR_ORGANIZATION.trim() }
          : {}),
      },
    });
  } catch (error) {
    if (error?.code === 'ENOENT') {
      console.error('Missing coverage/lcov.info. Run npm run test:coverage before Sonar analysis.');
    } else if (error instanceof Error && error.message.startsWith('SONAR_')) {
      console.error(error.message);
    } else {
      console.error(
        'Sonar analysis did not complete successfully. Check the scanner output, coverage report, connection settings, and server-side quality gate.',
      );
    }
    process.exitCode = 1;
  }
}
