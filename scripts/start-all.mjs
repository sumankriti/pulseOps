import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

const projects = [
  ['mfe-orders', 4201],
  ['mfe-inventory', 4202],
  ['mfe-shell', 4200],
];
// Check every port before starting anything. Never terminate another user's server.
for (const [project, port] of projects) {
  await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', (error) =>
      reject(
        new Error(
          `${project}: cannot use port ${port}. Stop the existing server on that port before running start:all.`,
          { cause: error },
        ),
      ),
    );
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (child.exitCode === null) child.kill('SIGTERM');
}
process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));
for (const [project] of projects) {
  const child = spawn(process.execPath, ['node_modules/@angular/cli/bin/ng.js', 'serve', project], {
    stdio: 'inherit',
  });
  children.push(child);
  child.once('error', (error) => {
    console.error(`${project}: ${error.message}`);
    stop(1);
  });
  child.once('exit', (code, signal) => {
    if (!stopping) {
      console.error(`${project} exited (${signal ?? code}); stopping the other applications.`);
      stop(code || 1);
    }
  });
}
console.log(
  'Starting all PulseOps applications. Open http://localhost:4200 after compilation completes. Ctrl+C stops all three.',
);
