import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from '@/hooks/use-toast';

export default function DebugPage() {
  const [messages, setMessages] = useState<Array<{type: string, data: any}>>([]);
  const [connectionStatus, setConnectionStatus] = useState('Disconnected');
  const { socket, connected } = useWebSocket();
  
  const { data: quizzes, isLoading } = useQuery({
    queryKey: ['/api/quizzes']
  });
  
  useEffect(() => {
    if (!socket) return;
    
    setConnectionStatus(connected ? 'Connected' : 'Disconnected');
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        setMessages(prev => [...prev, message]);
        
        toast({
          title: `Message Received: ${message.type}`,
          description: JSON.stringify(message.data),
        });
      } catch (error) {
        console.error('Error parsing message:', error);
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, connected]);
  
  const sendTestMessage = (type: string, data: any) => {
    if (!socket || !connected) {
      toast({
        title: 'Not connected',
        description: 'WebSocket is not connected',
        variant: 'destructive',
      });
      return;
    }
    
    socket.send(JSON.stringify({ type, data }));
    toast({
      title: `Sent: ${type}`,
      description: 'Message sent to WebSocket server',
    });
  };
  
  const authenticateAsAdmin = async () => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin123',
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        toast({
          title: 'Authenticated as Admin',
          description: `Admin ID: ${data.admin.id}`,
        });
        
        // Register with WebSocket if connected
        if (socket && connected) {
          connectAdminToWs(data.admin.id);
        }
      } else {
        toast({
          title: 'Authentication failed',
          description: 'Could not log in as admin',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error authenticating:', error);
      toast({
        title: 'Error',
        description: 'An error occurred during authentication',
        variant: 'destructive',
      });
    }
  };
  
  const connectAdminToWs = async (adminId: number) => {
    if (!socket || !connected) return;
    
    try {
      // Select the first quiz
      if (!quizzes || !quizzes.quizzes || quizzes.quizzes.length === 0) {
        toast({
          title: 'No quizzes found',
          description: 'Create a quiz first',
          variant: 'destructive',
        });
        return;
      }
      
      const quizId = quizzes.quizzes[0].id;
      
      // Get WebSocket client ID from the socket connection
      const clientId = await new Promise<string>((resolve) => {
        const handleMessage = (event: MessageEvent) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'CLIENT_ID') {
              socket.removeEventListener('message', handleMessage);
              resolve(message.clientId);
            }
          } catch (error) {
            console.error('Error parsing message:', error);
          }
        };
        
        socket.addEventListener('message', handleMessage);
        
        // Request client ID
        socket.send(JSON.stringify({ type: 'GET_CLIENT_ID' }));
      });
      
      // Connect admin to WebSocket
      const response = await fetch('/api/admin/connect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          adminId,
          quizId,
          wsClientId: clientId,
        }),
      });
      
      if (response.ok) {
        toast({
          title: 'Admin connected to WebSocket',
          description: `Quiz ID: ${quizId}`,
        });
      } else {
        toast({
          title: 'Connection failed',
          description: 'Could not connect admin to WebSocket',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error connecting admin:', error);
      toast({
        title: 'Error',
        description: 'An error occurred connecting admin',
        variant: 'destructive',
      });
    }
  };
  
  return (
    <div className="container mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">WebSocket Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <Card className="p-4">
            <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
            <div className="flex items-center mb-4">
              <div className={`w-3 h-3 rounded-full mr-2 ${connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
              <span>{connectionStatus}</span>
            </div>
            <div className="space-y-2">
              <Button onClick={authenticateAsAdmin} className="w-full">
                Authenticate as Admin
              </Button>
              <Button 
                onClick={() => sendTestMessage('PING', { timestamp: Date.now() })}
                className="w-full"
                disabled={!connected}
              >
                Send Test Ping
              </Button>
              <Button 
                onClick={() => sendTestMessage('QUIZ_STARTED', { quizId: quizzes?.quizzes?.[0]?.id || 1 })}
                className="w-full"
                disabled={!connected || !quizzes?.quizzes?.length}
              >
                Simulate Quiz Start
              </Button>
              <Button 
                onClick={() => sendTestMessage('NEW_QUESTION', { 
                  questionId: 1,
                  questionText: "What is the capital of France?",
                  options: [
                    { id: 1, text: "Paris" },
                    { id: 2, text: "London" },
                    { id: 3, text: "Berlin" },
                    { id: 4, text: "Madrid" }
                  ],
                  timeLimit: 15
                })}
                className="w-full"
                disabled={!connected}
              >
                Simulate New Question
              </Button>
            </div>
          </Card>
          
          <Card className="p-4 mt-6">
            <h2 className="text-xl font-semibold mb-4">Available Quizzes</h2>
            {isLoading ? (
              <p>Loading quizzes...</p>
            ) : quizzes?.quizzes && quizzes.quizzes.length > 0 ? (
              <ul className="space-y-2">
                {quizzes.quizzes.map((quiz: any) => (
                  <li key={quiz.id} className="border p-3 rounded">
                    <div className="font-semibold">{quiz.title}</div>
                    <div className="text-sm">ID: {quiz.id}</div>
                    <div className="text-sm">Code: {quiz.code}</div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No quizzes found</p>
            )}
          </Card>
        </div>
        
        <Card className="p-4 h-[600px] overflow-auto">
          <h2 className="text-xl font-semibold mb-4">Message Log</h2>
          {messages.length > 0 ? (
            <div className="space-y-2">
              {messages.map((msg, index) => (
                <div key={index} className="border p-3 rounded">
                  <div className="font-semibold">{msg.type}</div>
                  <pre className="text-xs mt-1 bg-gray-100 p-2 rounded">
                    {JSON.stringify(msg.data, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <p>No messages received yet</p>
          )}
        </Card>
      </div>
    </div>
  );
}