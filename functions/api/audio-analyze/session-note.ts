import { proxyToWorker } from '../_workerProxy';

export const onRequest: PagesFunction = async (context) =>
  proxyToWorker(context.request, context.env, 'analysis', '/session-note');
