import app, { ensureStartupSync, serverReady } from '../server.js';

export const config = {
  api: {
    bodyParser: false
  }
};

export default async function handler(req: any, res: any) {
  try {
    const rawUrl = req.url || '/api';
    const parsed = new URL(rawUrl, 'http://localhost');
    const vpath = parsed.searchParams.get('__vpath');
    if (vpath !== null) {
      parsed.searchParams.delete('__vpath');
      const qs = parsed.searchParams.toString();
      const cleanSubPath = vpath.replace(/^\/+/, '');
      req.url = `/api/${cleanSubPath}${qs ? `?${qs}` : ''}`;
    }

    await serverReady;
    await ensureStartupSync();
    return app(req, res);
  } catch (err: any) {
    console.error('[VERCEL_HANDLER_ERROR]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          error: 'Erro interno na API serverless',
          details: err?.message || String(err)
        })
      );
    }
  }
}
