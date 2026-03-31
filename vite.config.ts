import { defineConfig } from 'vite'
import { IncomingMessage, ServerResponse } from 'http'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

function levelSaverPlugin() {
  return {
    name: 'level-saver',
    configureServer(server: any) {
      server.middlewares.use('/save-level', (req: IncomingMessage, res: ServerResponse) => {
        if (req.method === 'GET') {
          const url = new URL(req.url!, 'http://localhost');
          const file = url.searchParams.get('file');
          if (!file || !/^[a-z0-9-]+\.json$/.test(file)) {
            res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'Invalid filename' })); return;
          }
          const jsonPath = join(__dirname, 'src', 'levels', file);
          if (!existsSync(jsonPath)) {
            res.statusCode = 404; res.end(JSON.stringify({ ok: false, error: 'Not found' })); return;
          }
          res.setHeader('Content-Type', 'application/json');
          res.end(readFileSync(jsonPath, 'utf-8'));
          return;
        }
        if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
        let body = '';
        req.on('data', (chunk: Buffer) => body += chunk.toString());
        req.on('end', () => {
          try {
            const { filename, content, state } = JSON.parse(body);
            if (!filename || !/^[a-z0-9-]+\.ts$/.test(filename)) throw new Error('Invalid filename');
            const tsPath   = join(__dirname, 'src', 'levels', filename);
            const jsonPath = join(__dirname, 'src', 'levels', filename.replace(/\.ts$/, '.json'));
            writeFileSync(tsPath,   content, 'utf-8');
            writeFileSync(jsonPath, JSON.stringify(state, null, 2), 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (e: any) {
            res.statusCode = 400;
            res.end(JSON.stringify({ ok: false, error: e.message }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: './',
  build: { outDir: 'dist' },
  plugins: [levelSaverPlugin()],
})
