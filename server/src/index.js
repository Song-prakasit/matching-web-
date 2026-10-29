import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { api } from './routes.js';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));

app.use('/api', api);

// Serve the built React app (npm run build) from the same port.
const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
if (fs.existsSync(dist)) {
  app.use(express.static(dist));
  app.get('/{*splat}', (req, res) => res.sendFile(path.join(dist, 'index.html')));
}

app.use((err, req, res, next) => {
  // Client mistakes such as malformed JSON (body-parser sets a 4xx status).
  if (err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'คำขอไม่ถูกต้อง' });
  }
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err);
  const dbDown = ['ESOCKET', 'ETIMEOUT', 'ELOGIN', 'ECONNCLOSED'].includes(err.code);
  res.status(dbDown ? 503 : 500).json({
    error: dbDown ? 'เชื่อมต่อฐานข้อมูลไม่ได้ กรุณาตรวจสอบเครือข่าย' : 'เกิดข้อผิดพลาดในระบบ',
  });
});

const server = config.https
  ? https.createServer({ key: fs.readFileSync(config.https.key), cert: fs.readFileSync(config.https.cert) }, app)
  : http.createServer(app);

server.listen(config.port, () => {
  const scheme = config.https ? 'https' : 'http';
  console.log(`Matching server: ${scheme}://localhost:${config.port}  (database: ${config.dbMode})`);
});
