import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';

interface UserLoginProps {
  initialCode?: string;
  onJoin: (participantId: number, quizId: number) => void;
}

const UserLogin: React.FC<UserLoginProps> = ({ initialCode = '', onJoin }) => {
  const [, navigate] = useLocation();
  const [quizCode, setQuizCode] = useState(initialCode);
  const [alias, setAlias] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  
  const { socket, connected } = useWebSocket();
  
  const handleJoin = () => {
    if (!quizCode.trim()) {
      toast({
        title: 'Missing quiz code',
        description: 'Please enter a quiz code to join',
        variant: 'destructive',
      });
      return;
    }
    
    if (!alias.trim()) {
      toast({
        title: 'Missing name',
        description: 'Please enter your name to join the quiz',
        variant: 'destructive',
      });
      return;
    }
    
    if (!socket || !connected) {
      toast({
        title: 'Connection error',
        description: 'Could not connect to quiz server. Please try again.',
        variant: 'destructive',
      });
      return;
    }
    
    setIsJoining(true);
    
    // Send join request to WebSocket server
    socket.send(JSON.stringify({
      type: 'JOIN_QUIZ',
      data: {
        quizCode: quizCode.trim().toUpperCase(),
        alias: alias.trim()
      }
    }));
    
    // Set up one-time handler for the response
    const handleJoinResponse = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'JOIN_QUIZ') {
          // Successfully joined
          const { participantId, quizId } = message.data;
          onJoin(participantId, quizId);
          socket.removeEventListener('message', handleJoinResponse);
        } else if (message.type === 'ERROR') {
          // Error joining
          toast({
            title: 'Could not join quiz',
            description: message.data.message,
            variant: 'destructive',
          });
          setIsJoining(false);
          socket.removeEventListener('message', handleJoinResponse);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        setIsJoining(false);
        socket.removeEventListener('message', handleJoinResponse);
      }
    };
    
    socket.addEventListener('message', handleJoinResponse);
  };
  
  const handleScanQR = () => {
    toast({
      title: 'QR Scanning',
      description: 'This feature would open the camera to scan a QR code',
    });
  };
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 player-gradient">
      {/* Quiz graphics at the top */}
      <div className="mb-8 text-center">
        <div className="w-64 h-48 mx-auto mb-4 flex items-center justify-center bg-[#3A3A3A] rounded-lg shadow-lg">
          <h1 className="text-4xl font-bold text-[#00FF88]">🎮</h1>
        </div>
        <h1 className="text-4xl font-bold text-white mt-4">QuizTime</h1>
        <p className="text-gray-300 mt-2">Join a quiz and challenge your knowledge!</p>
      </div>
      
      <div className="w-full max-w-md">
        <div className="bg-[#2D2D2D] rounded-xl p-6 shadow-lg">
          <div className="mb-6">
            <Label className="block text-white text-sm font-medium mb-2">Enter Quiz Code</Label>
            <Input
              type="text"
              className="w-full p-4 bg-dark border border-gray-700 rounded-lg text-white text-center text-xl tracking-widest focus:ring-2 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none"
              placeholder="QUIZ123"
              maxLength={6}
              value={quizCode}
              onChange={(e) => setQuizCode(e.target.value.toUpperCase())}
            />
          </div>
          
          <div className="mb-6">
            <Label className="block text-white text-sm font-medium mb-2">Your Name</Label>
            <Input
              type="text"
              className="w-full p-4 bg-dark border border-gray-700 rounded-lg text-white focus:ring-2 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none"
              placeholder="Enter your nickname"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
            />
          </div>
          
          <Button
            className="w-full py-4 bg-[#00FF88] text-dark font-bold rounded-lg hover:bg-opacity-90 transition-all"
            onClick={handleJoin}
            disabled={isJoining}
          >
            {isJoining ? 'Joining...' : 'Join Quiz'}
          </Button>
          
          <div className="mt-6 text-center">
            <p className="text-gray-400 text-sm">or</p>
            <Button
              variant="link"
              className="mt-3 text-[#00FF88] flex items-center justify-center mx-auto hover:underline"
              onClick={handleScanQR}
            >
              <span className="mr-2">📷</span> Scan QR Code
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
