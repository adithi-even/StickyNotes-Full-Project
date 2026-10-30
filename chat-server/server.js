const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8787);
const ROOM_TTL_MS = 30 * 60 * 1000;
const rooms = new Map();
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ service: 'Soft Sticky Notes temporary chat', status: 'online', rooms: rooms.size }));
});
const wss = new WebSocketServer({ server, maxPayload: 2 * 1024 * 1024 });
function code() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }
function send(ws, data) { if (ws.readyState === 1) ws.send(JSON.stringify(data)); }
function broadcast(room, data, except) {
  for (const client of room.clients) if (client !== except) send(client, data);
}
function removeClient(ws) {
  const roomCode = ws.roomCode;
  if (!roomCode) return;
  const room = rooms.get(roomCode);
  if (!room) return;
  room.clients.delete(ws);
  broadcast(room, { type: 'room-ended' }, ws);
  if (room.clients.size === 0) rooms.delete(roomCode);
  ws.roomCode = null;
}
wss.on('connection', ws => {
  ws.on('message', raw => {
    let m;
    try { m = JSON.parse(raw.toString()); } catch { return send(ws, { type:'error', message:'Invalid message.' }); }
    if (m.type === 'create') {
      if (ws.roomCode) removeClient(ws);
      let roomCode; do { roomCode = code(); } while (rooms.has(roomCode));
      const room = { clients: new Set([ws]), expires: Date.now() + ROOM_TTL_MS };
      rooms.set(roomCode, room); ws.roomCode = roomCode;
      send(ws, { type:'created', room:roomCode });
      return;
    }
    if (m.type === 'join') {
      const roomCode = String(m.room || '').toUpperCase().replace(/[^A-F0-9]/g,'');
      const room = rooms.get(roomCode);
      if (!room || room.expires < Date.now()) { rooms.delete(roomCode); return send(ws,{type:'error',message:'Room not found or expired.'}); }
      if (room.clients.size >= 2) return send(ws,{type:'error',message:'This room already has two people.'});
      if (ws.roomCode) removeClient(ws);
      room.clients.add(ws); room.expires = Date.now() + ROOM_TTL_MS; ws.roomCode = roomCode;
      send(ws,{type:'joined',room:roomCode});
      broadcast(room,{type:'message',text:'Someone joined the chat.',sender:'system'},ws);
      return;
    }
    if (m.type === 'message') {
      const room = rooms.get(ws.roomCode);
      if (!room || !room.clients.has(ws)) return send(ws,{type:'error',message:'Join a room first.'});
      const text = String(m.text || '').trim().slice(0,4000);
      const imageData = typeof m.imageData === 'string' && m.imageData.startsWith('data:image/') && m.imageData.length <= 1_900_000 ? m.imageData : undefined;
      if (!text && !imageData) return;
      room.expires = Date.now() + ROOM_TTL_MS;
      const payload = {type:'message',text,imageData,sender:String(m.sender||'guest').slice(0,80)};
      send(ws,payload); broadcast(room,payload,ws);
      return;
    }
    if (m.type === 'leave') { removeClient(ws); ws.close(); }
  });
  ws.on('close', () => removeClient(ws));
});
setInterval(() => {
  const now = Date.now();
  for (const [key, room] of rooms) if (room.expires < now) {
    for (const client of room.clients) { send(client,{type:'room-ended'}); client.close(); }
    rooms.delete(key);
  }
}, 60_000).unref();
server.listen(PORT, () => console.log(`Temporary chat server listening on ${PORT}`));
