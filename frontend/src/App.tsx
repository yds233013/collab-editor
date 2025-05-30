import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import Automerge from 'automerge';

const socket = io('http://localhost:4000');

function App() {
  // 1) CRDT state
  const [doc, setDoc] = useState(Automerge.init<{ text: string }>());

  // 2) On mount: receive full history + incremental changes
  useEffect(() => {
    // a) initial sync
    socket.on('init-doc', (changes: Uint8Array[]) => {
      let d = Automerge.init<{ text: string }>();
      [d] = Automerge.applyChanges(d, changes);
      setDoc(d);
    });
    // b) incremental updates
    socket.on('doc-update', (change: Uint8Array) => {
      setDoc(current => Automerge.applyChanges(current, [change])[0]);
    });
  }, []);

  // 3) Handle local edits
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    // a) apply change to our local CRDT
    const next = Automerge.change(doc, d => {
      d.text = e.target.value;
    });
    // b) extract the single change we just made
    const [lastChange] = Automerge.getLastLocalChange(next)!;
    // c) send it to the server & update our state
    socket.emit('doc-update', lastChange);
    setDoc(next);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Collaborative Editor MVP</h1>
      <textarea
        className="w-full h-64 p-2 border rounded"
        value={doc.text}
        onChange={handleChange}
      />
    </div>
  );
}

export default App;

