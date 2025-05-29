import React, { useEffect } from 'react';
import { io } from 'socket.io-client';

// adjust URL if your backend runs elsewhere
const socket = io('http://localhost:4000');

function App() {
  useEffect(() => {
    // send a ping on mount
    socket.emit('ping');
    // listen for the pong reply
    socket.on('pong', () => {
      console.log('🎉 received pong from server');
    });
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Collaborative Editor MVP</h1>
      <p>Check your browser console for the “🎉 received pong” message.</p>
    </div>
  );
}

export default App;

