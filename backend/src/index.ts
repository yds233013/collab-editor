import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import Automerge from 'automerge';

// 1) Connect to MongoDB
mongoose
  .connect('mongodb://localhost:27017/collab-editor')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 2) Define our Mongoose model for persistence
interface IDoc extends mongoose.Document {
  content: string;
}
const DocSchema = new mongoose.Schema(
  { content: { type: String, default: '' } },
  { versionKey: false }
);
const DocModel = mongoose.model<IDoc>('Document', DocSchema);

// 3) Initialize Automerge document & binary blob
let doc = Automerge.init<{ text: string }>();
let docBinary: Uint8Array;

// 4) Load or create the document in Mongo
;(async () => {
  try {
    const existing = await DocModel.findOne().exec();
    if (existing && existing.content) {
      docBinary = Buffer.from(existing.content, 'base64');
      doc = Automerge.load<{ text: string }>(docBinary);
    } else {
      doc = Automerge.from<{ text: string }>({ text: '' });
      docBinary = Automerge.save(doc);
      await DocModel.create({ content: docBinary.toString('base64') });
    }
    console.log('🔄 Loaded Automerge doc:', doc.text.slice(0, 50));
  } catch (e) {
    console.error('❌ Error loading doc:', e);
  }
})();

// 5) Set up Express + Socket.IO
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

io.on('connection', socket => {
  console.log('⚡️ WS connected:', socket.id);

  // send all existing changes on connect
  const allChanges = Automerge.getAllChanges(doc);
  socket.emit('init-doc', allChanges);

  // apply incoming change, persist, broadcast
  socket.on('doc-update', async (change: Uint8Array) => {
    const [newDoc] = Automerge.applyChanges(doc, [change]);
    doc = newDoc;
    docBinary = Automerge.save(doc);
    await DocModel.findOneAndUpdate(
      {},
      { content: docBinary.toString('base64') },
      { upsert: true }
    );
    socket.broadcast.emit('doc-update', change);
  });
});

// 6) Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));

