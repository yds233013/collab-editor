// @ts-nocheck

import express from 'express';
import http from 'http';
import cors from 'cors';
import mongoose from 'mongoose';
import Automerge from 'automerge';
import { Server } from 'socket.io';

// 1) MongoDB connection
mongoose
  .connect('mongodb://localhost:27017/collab-editor')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 2) Define Document schema
interface IDoc extends mongoose.Document {
  content: string;  // Base64‐encoded Automerge binary
}
const DocSchema = new mongoose.Schema(
  { content: { type: String, default: '' } },
  { versionKey: false }
);
const DocModel = mongoose.model<IDoc>('Document', DocSchema);

// 3) Initialize in‐memory Automerge doc
let doc = Automerge.init<{ text: string }>();
let docBinary = Automerge.save(doc); // Uint8Array

// 4) Load or create in MongoDB
;(async () => {
  try {
    const existing = await DocModel.findOne().exec();
    if (existing && existing.content) {
      // decode Base64 to Uint8Array
      const buffer = Buffer.from(existing.content, 'base64');
      doc = Automerge.load<{ text: string }>(buffer);
      docBinary = buffer;
    } else {
      // first‐time setup: save initial empty doc
      docBinary = Automerge.save(doc);
      await DocModel.create({ content: Buffer.from(docBinary).toString('base64') });
    }
    console.log('🔄 Loaded initial doc:', doc.text);
  } catch (e) {
    console.error('❌ Error loading doc:', e);
  }
})();

// 5) Express + Socket.IO setup
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  console.log('⚡️ WS connected:', socket.id);

  // send initial doc as Base64
  socket.emit('init-doc', Buffer.from(docBinary).toString('base64'));

  // on receiving a new Base64 snapshot
  socket.on('doc-update', async (newBase64: string) => {
    try {
      // decode incoming
      const incoming = Buffer.from(newBase64, 'base64');
      // merge
      doc = Automerge.merge(doc, Automerge.load<{ text: string }>(incoming));
      // re‐serialize
      docBinary = Automerge.save(doc);
      const outBase64 = Buffer.from(docBinary).toString('base64');

      // persist
      await DocModel.updateOne({}, { content: outBase64 }, { upsert: true });

      // broadcast to others
      socket.broadcast.emit('doc-update', outBase64);
    } catch (err) {
      console.error('❌ Merge error:', err);
    }
  });
});

// 6) Start server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));

