import express from 'express'
import http from 'http'
import mongoose from 'mongoose'
import Automerge from 'automerge'
import { Server } from 'socket.io'

// ─── Express + Socket.IO setup ─────────────────────────────────────
const app = express()
const server = http.createServer(app)
const io = new Server(server, { cors: { origin: '*' } })

// ─── Mongoose model ────────────────────────────────────────────────
interface DocAttrs { content: string }
const DocSchema = new mongoose.Schema<DocAttrs>({ content: String })
const DocModel = mongoose.model<DocAttrs>('Document', DocSchema)

// ─── Start server & connect Mongo ──────────────────────────────────
const PORT = 4000
server.listen(PORT, () => console.log(`🔌 Backend listening on ${PORT}`))
mongoose
  .connect('mongodb://localhost:27017/collab')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err))

// ─── In-memory Automerge document ───────────────────────────────────
let doc = Automerge.init<{ text: string }>()
let json = Automerge.save(doc)  // this is a string

;(async () => {
  try {
    const existing = await DocModel.findOne()
    if (existing) {
      // decode base64 → UTF-8 JSON string → load
      const loaded = Buffer.from(existing.content, 'base64').toString('utf8')
      doc = Automerge.load<{ text: string }>(loaded)
      json = loaded
      console.log('🎉 Loaded doc from Mongo')
    } else {
      // first time: save the empty doc
      await DocModel.create({
        content: Buffer.from(json).toString('base64'),
      })
      console.log('🆕 Created initial doc in Mongo')
    }
  } catch (e) {
    console.error('❌ Load error:', e)
  }
})()

// ─── Socket.IO sync handlers ───────────────────────────────────────
io.on('connection', socket => {
  console.log('⚡️ WS connected:', socket.id)

  // send the current text
  socket.emit('init-doc', doc.text)

  // when a client edits, they send us the new string
  socket.on('doc-change', async (newText: string) => {
    // apply a CRDT change
    const newDoc = Automerge.change(doc, d => {
      d.text = newText
    })
    doc = newDoc

    // re-serialize to JSON string & persist to Mongo
    json = Automerge.save(doc)
    await DocModel.findOneAndUpdate(
      {},
      { content: Buffer.from(json).toString('base64') }
    )

    // broadcast the updated text to everyone
    io.emit('doc-update', doc.text)
  })
})

