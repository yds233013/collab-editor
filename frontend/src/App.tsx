import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const socket = io('http://localhost:4000');

function App() {
  const [text, setText] = useState('');

  useEffect(() => {
    // When we first connect, load the current doc
    socket.on('init-doc', (doc: string) => setText(doc));
    // Whenever someone else edits, update our textarea
    socket.on('doc-update', (newText: string) => setText(newText));
  }, []);

  // Broadcast every keystroke
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    socket.emit('doc-update', e.target.value);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Collaborative Editor MVP</h1>
      <textarea
        className="w-full h-64 p-2 border rounded"
        value={text}
        onChange={handleChange}
      />
    </div>
  );
}

export default App;

