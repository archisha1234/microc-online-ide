import { WebSocketServer } from 'ws';
import http from 'http';

const PORT = 1234;

const server = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('MicroC Collab Server');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws: any, req: any) => {
  console.log('Client joined room:', req.url);
  ws.on('message', (msg: any) => {
    wss.clients.forEach((client: any) => {
      if (client !== ws && client.readyState === 1) {
        client.send(msg);
      }
    });
  });
  ws.on('close', () => console.log('Client left'));
});

server.listen(PORT, () => {
  console.log(`Collab server running on ws://localhost:${PORT}`);
});