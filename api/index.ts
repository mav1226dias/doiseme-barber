import app, { serverReady } from '../server';

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
  } catch {
    // Keep original req.url if URL parsing fails
  }

  await serverReady;
  return app(req, res);
}
