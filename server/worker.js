/* 九路 Blitz — Cloudflare Workers の入口
 *   /ws      … 対人戦（WebSocket）。ひとつの Durable Object「Lobby」がマッチングと中継をする
 *   それ以外 … アプリのファイル（index.html など）をそのまま配る
 */
import { Core } from './core.js';

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/ws') {
      if (req.headers.get('Upgrade') !== 'websocket') return new Response('WebSocket only', { status: 426 });
      const stub = env.LOBBY.get(env.LOBBY.idFromName('main'));
      return stub.fetch(req);
    }
    if (url.pathname === '/health') return new Response('ok');
    return env.ASSETS.fetch(req);
  }
};

export class Lobby {
  constructor(ctx, env) {
    this.ctx = ctx;
    // アカウントは Durable Object のストレージ（消えない）に保存
    this.core = new Core({ store: { get: k => ctx.storage.get(k), put: (k, v) => ctx.storage.put(k, v) } });
  }
  async fetch(req) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    server.accept();
    const h = this.core.connect(server);
    server.addEventListener('message', e => h.message(typeof e.data === 'string' ? e.data : ''));
    server.addEventListener('close', () => h.close());
    server.addEventListener('error', () => h.close());
    return new Response(null, { status: 101, webSocket: client });
  }
}
