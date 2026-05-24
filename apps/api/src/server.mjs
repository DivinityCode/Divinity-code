import http from 'http';

import { evaluatePreflight } from '../../../packages/policy-engine/src/index.mjs';

const runs = new Map();

function readJson(req, callback) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    callback(JSON.parse(body || '{}'));
  });
}

const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'GET' && req.url === '/health') {
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.method === 'POST' && req.url === '/preflight') {
    readJson(req, (task) => {
      res.end(JSON.stringify(evaluatePreflight({ task })));
    });
    return;
  }

  if (req.method === 'POST' && req.url === '/tasks') {
    readJson(req, (task) => {
      const preflight = evaluatePreflight({ task });
      const run = {
        run_id: `run_${Date.now()}`,
        task_id: task.task_id || 'unknown',
        status: preflight.decision === 'requires_approval'
          ? 'awaiting_approval'
          : preflight.decision === 'block'
            ? 'failed'
            : 'queued',
        risk_level: preflight.risk_level,
        preflight
      };
      runs.set(run.run_id, run);
      res.statusCode = 201;
      res.end(JSON.stringify(run));
    });
    return;
  }

  if (req.method === 'GET' && req.url.startsWith('/runs/')) {
    const runId = req.url.split('/').pop();
    const run = runs.get(runId);
    if (!run) {
      res.statusCode = 404;
      res.end(JSON.stringify({ error: 'run not found' }));
      return;
    }
    res.end(JSON.stringify(run));
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: 'not found' }));
});

if (process.env.DIVINITY_API_AUTOSTART !== '0') {
  server.listen(3000, () => console.log('API listening on :3000'));
}

export { server };
