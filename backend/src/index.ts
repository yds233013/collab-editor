import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';

// 1) Connect to MongoDB
mongoose
  .connect('mongodb://localhost:27017/collab-editor')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// 2) Define our Document interface & model
interface IDoc extends mongoose.Document {
  content: string;
}
const DocSchema = new mongoose.Schema(
  { content: { type: String, default: '' } },
  { versionKey: false }
);
const DocModel = mongoose.model<IDoc>('Document', DocSchema);

// 3) Set up Express + Socket.IO
const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 4) Load (or create) the single document
let doc = '';
;(async () => {
  try {
    const existing = await DocModel.findOne().exec();
    if (existing) {
      doc = existing.content;
    } else {
      const created = await DocModel.create({ content: '' });
      doc = created.content;
    }
    console.log('🔄 Loaded initial doc:', doc.slice(0, 50));
  } catch (e) {
    console.error('❌ Error loading doc:', e);
  }
})();

// 5) Real-time sync handlers
io.on('connection', socket => {
  console.log('⚡️ WS connected:', socket.id);
  // send current text
  socket.emit('init-doc', doc);

  // on any update…
  socket.on('doc-update', async (newText: string) => {
    console.log('💾 server got update:', newText);
    doc = newText;
    await DocModel.findOneAndUpdate({}, { content: newText }, { upsert: true });
    socket.broadcast.emit('doc-update', newText);
  });
});

// 6) Start the server
const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Backend listening on ${PORT}`));

