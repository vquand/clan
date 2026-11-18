import { createApiHandler } from './api.mjs';
import { createD1Database, createD1LoginLimiter } from './d1.mjs';

const worker = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/') && url.pathname !== '/health') {
      return env.ASSETS.fetch(request);
    }
    if (!env.DB) {
      return Response.json(
        {
          error: {
            code: 'SERVICE_UNAVAILABLE',
            message: 'D1 is not configured',
          },
        },
        { status: 503, headers: { 'cache-control': 'no-store' } },
      );
    }
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(request.method) &&
      request.headers.has('origin') &&
      request.headers.get('origin') !== url.origin
    ) {
      return Response.json(
        {
          error: {
            code: 'INVALID_ORIGIN',
            message: 'Same-origin requests required',
          },
        },
        { status: 403, headers: { 'cache-control': 'no-store' } },
      );
    }

    // Reuse the tested Node-style handler while streaming Fetch bodies through its size limit.
    const incoming = {
      url: request.url,
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'x-forwarded-proto': url.protocol.slice(0, -1),
      },
      socket: {
        remoteAddress: request.headers.get('cf-connecting-ip') ?? 'local',
      },
      async *[Symbol.asyncIterator]() {
        if (request.body) yield* request.body;
      },
    };
    let response;
    let status;
    let headers;
    await createApiHandler({
      database: createD1Database(env.DB),
      env,
      loginLimiter: createD1LoginLimiter(env.DB),
    })(incoming, {
      writeHead(code, value) {
        status = code;
        headers = value;
      },
      end(body) {
        response = new Response(body ?? null, { status, headers });
      },
    });
    return response;
  },
};

export default worker;
