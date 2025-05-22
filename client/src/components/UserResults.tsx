import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ResultStat {
  label: string;
  value: string;
  highlight?: boolean;
}

interface UserResultsProps {
  position: number;
  totalScore: number;
  totalQuestions: number;
  correctAnswers: number;
  avgResponseTime: number;
  onPlayAgain: () => void;
  onViewAnswers: () => void;
}

const UserResults: React.FC<UserResultsProps> = ({
  position,
  totalScore,
  totalQuestions,
  correctAnswers,
  avgResponseTime,
  onPlayAgain,
  onViewAnswers
}) => {
  const [isReady, setIsReady] = useState(false);
  
  // Add a slight delay for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      
      // Play victory sound if in top 3
      if (position <= 3) {
        try {
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/1413/1413-preview.mp3');
          audio.play();
        } catch (e) {
          console.error('Could not play sound:', e);
        }
      }
    }, 500);
    
    return () => clearTimeout(timer);
  }, [position]);

  if (!isReady) {
    return <div className="h-full player-gradient"></div>;
  }

  // Calculate accuracy percentage
  const accuracy = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
  
  // Calculate bonus points (this is a mock calculation)
  const bonusPoints = Math.max(0, 150 - Math.floor(avgResponseTime * 10));

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 player-gradient">
      <div className="text-center mb-8 animate-bounce-in">
        <div className={`w-20 h-20 rounded-full ${
          position === 1 ? 'bg-[#00FF88]' : position === 2 ? 'bg-[#29B6F6]' : position === 3 ? 'bg-[#FFA726]' : 'bg-gray-600'
        } flex items-center justify-center mx-auto mb-4 text-dark text-4xl font-bold`}>
          {position}
        </div>
        <h2 className="text-4xl font-bold text-white">
          {position === 1 ? 'You won!' : position <= 3 ? 'Great job!' : 'Quiz completed!'}
        </h2>
        <p className="text-[#00FF88] text-xl font-medium mt-2">{totalScore} total points</p>
      </div>
      
      <div className="bg-[#2D2D2D] rounded-xl p-6 shadow-lg w-full max-w-md mb-8 animate-fade-in">
        <h3 className="text-white text-lg font-medium mb-4">Your Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-dark rounded-lg p-4 text-center">
            <div className="text-sm text-gray-400 mb-1">Correct Answers</div>
            <div className="text-[#00FF88] text-2xl font-bold">{correctAnswers}/{totalQuestions}</div>
          </div>
          <div className="bg-dark rounded-lg p-4 text-center">
            <div className="text-sm text-gray-400 mb-1">Avg. Response Time</div>
            <div className="text-white text-2xl font-bold">{avgResponseTime.toFixed(1)}s</div>
          </div>
          <div className="bg-dark rounded-lg p-4 text-center">
            <div className="text-sm text-gray-400 mb-1">Accuracy</div>
            <div className="text-white text-2xl font-bold">{Math.round(accuracy)}%</div>
          </div>
          <div className="bg-dark rounded-lg p-4 text-center">
            <div className="text-sm text-gray-400 mb-1">Bonus Points</div>
            <div className="text-white text-2xl font-bold">+{bonusPoints}</div>
          </div>
        </div>
      </div>
      
      <div className="flex gap-4 animate-fade-in">
        <Button 
          className="px-6 py-3 bg-[#3A3A3A] text-white rounded-lg hover:bg-opacity-80"
          onClick={onViewAnswers}
        >
          View Answers
        </Button>
        <Button 
          className="px-6 py-3 bg-[#00FF88] text-dark font-bold rounded-lg hover:bg-opacity-90"
          onClick={onPlayAgain}
        >
          Play Again
        </Button>
      </div>
    </div>
  );
};

export default UserResults;
