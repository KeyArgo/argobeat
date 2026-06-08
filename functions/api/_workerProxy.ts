interface ProxyEnv {
  ANALYSIS_WORKER_URL?: string;
  ADVISOR_WORKER_URL?: string;
}

const DEFAULT_ANALYSIS_WORKER_URL = 'https://argobeat-audio-analyze.argobox.workers.dev';
const DEFAULT_ADVISOR_WORKER_URL = 'https://argobeat-advisor.argobox.workers.dev';

export async function proxyToWorker(
  request: Request,
  env: ProxyEnv,
  kind: 'analysis' | 'advisor',
  pathname: string,
): Promise<Response> {
  const base = kind === 'analysis'
    ? (env.ANALYSIS_WORKER_URL || DEFAULT_ANALYSIS_WORKER_URL)
    : (env.ADVISOR_WORKER_URL || DEFAULT_ADVISOR_WORKER_URL);

  const incomingUrl = new URL(request.url);
  const targetUrl = new URL(pathname, base);
  targetUrl.search = incomingUrl.search;

  const init: RequestInit = {
    method: request.method,
    headers: request.headers,
  };

  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.text();
  }

  const upstream = await fetch(targetUrl.toString(), init);
  return new Response(upstream.body, {
    status: upstream.status,
    headers: upstream.headers,
  });
}
