import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/useWebSocket';

interface UserWaitingProps {
  participantId: number;
  quizId: number;
  alias: string;
  quizTitle: string;
  onQuizStart: () => void;
}

const UserWaiting: React.FC<UserWaitingProps> = ({
  participantId,
  quizId,
  alias,
  quizTitle,
  onQuizStart
}) => {
  const { socket } = useWebSocket();
  const [countdown, setCountdown] = useState<number | null>(null);
  
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'quiz_started') {
          // Quiz is starting! Begin countdown
          setCountdown(3);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, quizId]);
  
  // Handle countdown
  useEffect(() => {
    if (countdown === null) return;
    
    if (countdown <= 0) {
      // Countdown finished, start the quiz
      onQuizStart();
      return;
    }
    
    const timer = setTimeout(() => {
      setCountdown(countdown - 1);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [countdown, onQuizStart]);
  
  return (
    <div className="h-full flex flex-col items-center justify-center p-6 player-gradient">
      <div className="text-center mb-8">
        <div className="w-20 h-20 rounded-full bg-[#00FF88] bg-opacity-20 flex items-center justify-center mx-auto mb-4">
          <div className="w-16 h-16 rounded-full bg-[#00FF88] animate-ping-slow"></div>
        </div>
        
        {countdown !== null ? (
          <>
            <h2 className="text-4xl font-bold text-white mb-2">Starting in {countdown}</h2>
            <p className="text-[#00FF88] text-xl">Get ready!</p>
          </>
        ) : (
          <>
            <h2 className="text-2xl font-bold text-white">Waiting for quiz to start...</h2>
            <p className="text-gray-300 mt-2">Get ready to play!</p>
          </>
        )}
      </div>
      
      <div className="bg-[#2D2D2D] rounded-xl p-6 shadow-lg w-full max-w-md">
        <div className="text-center">
          <div className="text-white mb-2">You're in!</div>
          <div className="text-[#00FF88] text-2xl font-bold mb-4">{quizTitle}</div>
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 rounded-full bg-[#3A3A3A] flex items-center justify-center text-[#00FF88] mr-3">
              <span>👤</span>
            </div>
            <div className="text-white text-xl font-medium">{alias}</div>
          </div>
          <p className="text-gray-400 text-sm">Quiz Host: <span className="text-white">Admin User</span></p>
        </div>
      </div>
    </div>
  );
};

export default UserWaiting;
