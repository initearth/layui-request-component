import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

const livereloadScript = `
<script>
(function () {
  var source = new EventSource('/__livereload');
  source.onmessage = function (event) {
    if (event.data === 'reload') window.location.reload();
  };
})();
</script>
`;

export function startServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 5173);
  const clients = new Set();

  const server = createServer(async function (req, res) {
    const pathname = decodeURIComponent((req.url || '/').split('?')[0]);

    if (pathname === '/__livereload') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive'
      });
      res.write('data: connected\n\n');
      clients.add(res);
      req.on('close', function () {
        clients.delete(res);
      });
      return;
    }

    if (pathname === '/example/mock/me') {
      const authorization = req.headers.authorization || null;
      const valid = authorization === 'Bearer mock-token-9f3c2a7b';

      const body = JSON.stringify({
        code: valid ? 0 : 401,
        message: valid ? 'ok' : (authorization ? 'invalid token' : 'missing token'),
        data: {
          authorization: authorization,
          injected: !!authorization,
          valid: valid
        }
      });

      res.writeHead(valid ? 200 : 401, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(body);
      return;
    }

    if (pathname === '/example/mock/forbidden') {
      res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        code: 403,
        message: 'forbidden',
        data: { valid: false }
      }));
      return;
    }

    const relativePath = pathname.replace(/^[/\\]+/, '');
    let filePath = resolve(join(root, normalize(relativePath)));

    if (filePath !== root && !filePath.startsWith(root + sep)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    try {
      const info = await stat(filePath);
      if (info.isDirectory()) filePath = join(filePath, 'index.html');

      const body = await readFile(filePath);
      const contentType = mime[extname(filePath)] || 'application/octet-stream';

      if (extname(filePath) === '.html') {
        const html = body.toString('utf8').replace(/<\/body>/i, livereloadScript + '</body>');
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(html);
        return;
      }

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(body);
    } catch (e) {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  server.listen(port, function () {
    console.log('layui-request debug server:');
    console.log('http://localhost:' + port + '/example/debug.html');
  });

  return {
    server: server,
    port: port,
    reload: function () {
      clients.forEach(function (client) {
        try {
          client.write('data: reload\n\n');
        } catch (e) {}
      });
    },
    close: function () {
      clients.forEach(function (client) {
        try {
          client.end();
        } catch (e) {}
      });
      return new Promise(function (resolveClose) {
        server.close(resolveClose);
      });
    }
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startServer();
}
