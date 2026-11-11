// 手元で試すためのサーバー（Cloudflare なしで、アプリと対人戦をまとめて動かす）
//   node server/dev.mjs   → http://localhost:8787
// 本番（Cloudflare）では使わない。WebSocket は外部ライブラリなしの最小実装。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Core } from './core.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const PORT = +process.env.PORT || 8787;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
const core = new Core();

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || p.startsWith('/server') || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});

server.on('upgrade', (req, socket) => {
  if (new URL(req.url, 'http://x').pathname !== '/ws') { socket.destroy(); return; }
  const key = req.headers['sec-websocket-key'];
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
  let closed = false;
  const sock = {
    send(text) {
      if (closed) return;
      const data = Buffer.from(text);
      let head;
      if (data.length < 126) head = Buffer.from([0x81, data.length]);
      else if (data.length < 65536) { head = Buffer.alloc(4); head[0] = 0x81; head[1] = 126; head.writeUInt16BE(data.length, 2); }
      else { head = Buffer.alloc(10); head[0] = 0x81; head[1] = 127; head.writeBigUInt64BE(BigInt(data.length), 2); }
      socket.write(Buffer.concat([head, data]));
    },
    close() { if (!closed) { closed = true; socket.end(); } }
  };
  const h = core.connect(sock, req.socket.remoteAddress + ':' + Math.random());   // 手元のテストでは制限しない
  let buf = Buffer.alloc(0);
  socket.on('data', chunk => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length >= 2) {
      const op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126) { if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (buf.length < 10) return; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      const mk = masked ? buf.slice(off, off + 4) : null; if (masked) off += 4;
      if (buf.length < off + len) return;
      const payload = buf.slice(off, off + len); buf = buf.slice(off + len);
      if (mk) for (let i = 0; i < payload.length; i++) payload[i] ^= mk[i & 3];
      if (op === 0x8) { closed = true; socket.end(); return; }
      if (op === 0x9) { socket.write(Buffer.concat([Buffer.from([0x8a, payload.length]), payload])); continue; }
      if (op === 0x1) h.message(payload.toString('utf8'));
    }
  });
  const bye = () => { if (!sock._gone) { sock._gone = true; closed = true; h.close(); } };
  socket.on('close', bye); socket.on('error', bye);
});

server.listen(PORT, () => console.log(`九路 Blitz dev server: http://localhost:${PORT}`));
