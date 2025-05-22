import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface UserAnswerProps {
  isCorrect: boolean;
  score: number;
  selectedAnswer: string;
  responseTime: number; // in seconds
  position: number;
  onContinue: () => void;
}

const UserAnswer: React.FC<UserAnswerProps> = ({
  isCorrect,
  score,
  selectedAnswer,
  responseTime,
  position,
  onContinue
}) => {
  const [isReady, setIsReady] = useState(false);
  
  // Add a slight delay before showing the component for dramatic effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);
  
  // Play sound effect
  useEffect(() => {
    if (isReady) {
      try {
        const audio = new Audio(isCorrect 
          ? 'https://assets.mixkit.co/active_storage/sfx/1010/1010-preview.mp3' // correct sound
          : 'https://assets.mixkit.co/active_storage/sfx/1015/1015-preview.mp3' // incorrect sound
        );
        audio.play();
      } catch (e) {
        console.error('Could not play sound:', e);
      }
    }
  }, [isReady, isCorrect]);

  if (!isReady) {
    return <div className="h-full player-gradient"></div>;
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 player-gradient">
      {/* Success/Error Feedback */}
      <div className={`
        ${isCorrect ? 'bg-[#00C853] bg-opacity-20' : 'bg-[#FF3D00] bg-opacity-20'} 
        rounded-full w-32 h-32 flex items-center justify-center mb-6 animate-bounce-in
      `}>
        <div className={`
          ${isCorrect ? 'bg-[#00C853]' : 'bg-[#FF3D00]'} 
          rounded-full w-24 h-24 flex items-center justify-center
        `}>
          <span className="text-white text-6xl">{isCorrect ? '✓' : '✗'}</span>
        </div>
      </div>
      
      <h2 className="text-3xl font-bold text-white mb-2 animate-fade-in">
        {isCorrect ? 'Correct!' : 'Wrong!'}
      </h2>
      
      {isCorrect && (
        <p className="text-[#00FF88] text-xl mb-6 animate-fade-in">+{score} points</p>
      )}
      
      <div className="bg-[#2D2D2D] rounded-xl p-6 shadow-lg w-full max-w-md animate-fade-in">
        <div className="flex justify-between items-center mb-4">
          <div className="text-white">Your answer:</div>
          <div className={isCorrect ? 'text-[#00FF88]' : 'text-[#FF3D00]'} font-medium>
            {selectedAnswer}
          </div>
        </div>
        <div className="flex justify-between items-center mb-4">
          <div className="text-white">Time taken:</div>
          <div className="text-white">{responseTime.toFixed(1)} seconds</div>
        </div>
        <div className="flex justify-between items-center">
          <div className="text-white">Current position:</div>
          <Badge className={`font-bold ${position === 1 ? 'bg-[#00FF88] text-dark' : 'bg-gray-600 text-white'}`}>
            #{position}
          </Badge>
        </div>
      </div>
      
      <p className="text-gray-400 mt-8 animate-fade-in">Waiting for next question...</p>
    </div>
  );
};

export default UserAnswer;
