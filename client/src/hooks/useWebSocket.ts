import { useState, useEffect, useRef } from 'react';

export function useWebSocket() {
  const [connected, setConnected] = useState(false);
  const [wsClientId, setWsClientId] = useState<string | null>(null);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Create WebSocket connection
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const socket = new WebSocket(wsUrl);
    socketRef.current = socket;

    socket.addEventListener('open', () => {
      console.log('WebSocket connection established');
      setConnected(true);
      
      // Request client ID assignment from server
      // The server will respond with a client ID in the first message
      socket.addEventListener('message', function handleFirstMessage(event) {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'client_id') {
            setWsClientId(data.clientId);
            socket.removeEventListener('message', handleFirstMessage);
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      });
    });

    socket.addEventListener('close', () => {
      console.log('WebSocket connection closed');
      setConnected(false);
      setWsClientId(null);
    });

    socket.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    });

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, []);

  return {
    socket: socketRef.current,
    connected,
    wsClientId
  };
}
