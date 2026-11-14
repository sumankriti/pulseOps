// Local verification server for the generated static artifacts, not production hosting.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const [project, portText] = process.argv.slice(2);
if (!['mfe-shell', 'mfe-orders', 'mfe-inventory'].includes(project))
  throw new Error('Unknown project');
const root = path.resolve('dist', project, 'browser');
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
};
const server = createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Cache-Control', 'no-store');
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    let file = path.resolve(root, '.' + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) {
      response.writeHead(403).end();
      return;
    }
    try {
      if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
    } catch {
      if (path.extname(pathname)) {
        response.writeHead(404).end('Not found');
        return;
      }
      file = path.join(root, 'index.html');
    }
    let body = await readFile(file);
    // Test an environment-specific manifest without modifying the build artifact.
    if (project === 'mfe-shell' && pathname === '/federation.manifest.json') {
      const manifest = JSON.parse(body.toString());
      if (process.env.PULSEOPS_E2E_ORDERS_ORIGIN)
        manifest['mfe-orders'] = process.env.PULSEOPS_E2E_ORDERS_ORIGIN + '/remoteEntry.json';
      if (process.env.PULSEOPS_E2E_INVENTORY_ORIGIN)
        manifest['mfe-inventory'] = process.env.PULSEOPS_E2E_INVENTORY_ORIGIN + '/remoteEntry.json';
      body = Buffer.from(JSON.stringify(manifest));
    }
    response.setHeader('Content-Type', mime[path.extname(file)] ?? 'application/octet-stream');
    response.writeHead(200).end(body);
  } catch {
    response.writeHead(500).end('Local artifact server error');
  }
});
server.listen(Number(portText), '127.0.0.1', () =>
  console.log(`${project}: http://127.0.0.1:${portText}`),
);
