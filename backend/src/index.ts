import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';

let doc = ''; // in-memory copy of the shared text

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  console.log('⚡️ WS connected:', socket.id);

  // 1) Send the current document to new clients
  socket.emit('init-doc', doc);

  // 2) When any client makes an edit…
  socket.on('doc-update', (newText: string) => {
    // update our in-memory copy
    console.log('💾 server got update:', newText);
    doc = newText;
    // broadcast that change to all *other* clients
    socket.broadcast.emit('doc-update', newText);
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));

