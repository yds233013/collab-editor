import React, { useEffect, useState } from 'react'
import { io } from 'socket.io-client'

const socket = io('http://localhost:4000')

function App() {
  const [text, setText] = useState('')

  useEffect(() => {
    // When we first connect, the server will send us the current doc
    socket.on('init-doc', (docText: string) => {
      setText(docText)
    })

    // Whenever anyone else edits, we get the new text
    socket.on('doc-update', (docText: string) => {
      setText(docText)
    })
  }, [])

  // Broadcast every keystroke
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newVal = e.target.value
    setText(newVal)
    socket.emit('doc-change', newVal)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Collaborative Editor MVP</h1>
      <textarea
        className="w-full h-64 p-2 border rounded"
        value={text}
        onChange={handleChange}
      />
    </div>
  )
}

export default App

