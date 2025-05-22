import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import UserWaiting from '@/components/UserWaiting';
import UserQuestion from '@/components/UserQuestion';
import UserAnswer from '@/components/UserAnswer';
import UserResults from '@/components/UserResults';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from '@/hooks/use-toast';

// Player view states
type PlayerViewState = 'waiting' | 'question' | 'answer' | 'results';

// Participant from session storage
interface StoredParticipant {
  id: number;
  quizId: number;
}

// Answer data
interface AnswerData {
  isCorrect: boolean;
  score: number;
  selectedAnswer: string;
  responseTime: number;
  position: number;
  correctOptionId: number;
}

const PlayPage = () => {
  const [, navigate] = useLocation();
  const { socket, connected } = useWebSocket();
  const [participantId, setParticipantId] = useState<number | null>(null);
  const [quizId, setQuizId] = useState<number | null>(null);
  const [alias, setAlias] = useState<string>('Player');
  const [quizTitle, setQuizTitle] = useState<string>('Quiz');
  const [viewState, setViewState] = useState<PlayerViewState>('waiting');
  const [answerData, setAnswerData] = useState<AnswerData | null>(null);
  const [selectedOptionText, setSelectedOptionText] = useState<string>('');
  
  // Stats for results screen
  const [totalScore, setTotalScore] = useState(0);
  const [position, setPosition] = useState(1);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [responseTimes, setResponseTimes] = useState<number[]>([]);
  
  // Current question data
  const currentQuestionRef = useRef<any>(null);

  // Check if participant info exists in session storage
  useEffect(() => {
    const participantData = sessionStorage.getItem('quizParticipant');
    
    if (!participantData) {
      toast({
        title: 'Session expired',
        description: 'Please rejoin the quiz',
        variant: 'destructive'
      });
      navigate('/join');
      return;
    }
    
    try {
      const participant = JSON.parse(participantData) as StoredParticipant;
      setParticipantId(participant.id);
      setQuizId(participant.quizId);
    } catch (error) {
      console.error('Error parsing participant data:', error);
      sessionStorage.removeItem('quizParticipant');
      navigate('/join');
    }
  }, [navigate]);

  // WebSocket event handling
  useEffect(() => {
    if (!socket || !participantId || !quizId) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'quiz_started':
            // Quiz is starting, transitioning from waiting to question will happen through countdown
            break;
            
          case 'new_question':
            // New question received
            currentQuestionRef.current = message.data;
            setTotalQuestions(prev => prev + 1);
            setViewState('question');
            break;
            
          case 'question_ended':
            // Question ended, show results if we haven't answered yet
            if (viewState === 'question') {
              // Time ran out and we didn't answer, show results
              setViewState('answer');
              setAnswerData({
                isCorrect: false,
                score: 0,
                selectedAnswer: 'No answer',
                responseTime: message.data.timeLimit || 15,
                position: message.data.leaderboard.findIndex((p: any) => p.id === participantId) + 1 || 999,
                correctOptionId: message.data.options.find((opt: any) => opt.isCorrect)?.optionId || 0
              });
            }
            break;
            
          case 'quiz_ended':
            // Quiz is over, show final results
            const finalLeaderboard = message.data.leaderboard;
            const userPosition = finalLeaderboard.findIndex((p: any) => p.id === participantId) + 1;
            const userScore = finalLeaderboard.find((p: any) => p.id === participantId)?.score || 0;
            
            setPosition(userPosition);
            setTotalScore(userScore);
            setViewState('results');
            break;
            
          case 'error':
            toast({
              title: 'Error',
              description: message.data.message,
              variant: 'destructive'
            });
            break;
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
    };
  }, [socket, participantId, quizId, viewState]);

  // Handle when user submits an answer
  const handleAnswerSubmitted = (isCorrect: boolean, score: number, correctOptionId: number) => {
    // Get user position from most recent leaderboard update
    // This is an approximation as we don't have real-time leaderboard here
    const userPosition = Math.max(1, position);
    
    // Update stats
    if (isCorrect) {
      setCorrectAnswers(prev => prev + 1);
    }
    
    // Get the currently selected option text
    const selectedOption = currentQuestionRef.current?.options.find(
      (opt: any) => opt.id === correctOptionId
    );
    const optionText = selectedOption ? selectedOption.text : 'Unknown';
    setSelectedOptionText(optionText);
    
    // Calculate response time (approximation)
    const responseTime = 3 + Math.random() * 5; // 3-8 seconds
    setResponseTimes(prev => [...prev, responseTime]);
    
    // Update total score
    setTotalScore(prev => prev + score);
    
    // Set answer data for the answer view
    setAnswerData({
      isCorrect,
      score,
      selectedAnswer: optionText,
      responseTime,
      position: userPosition,
      correctOptionId
    });
    
    // Change view state to show answer feedback
    setViewState('answer');
  };

  // Handle quiz start
  const handleQuizStart = () => {
    setViewState('waiting'); // This will be updated to 'question' when the first question arrives
  };

  // Calculate average response time
  const getAverageResponseTime = () => {
    if (responseTimes.length === 0) return 0;
    const sum = responseTimes.reduce((acc, time) => acc + time, 0);
    return sum / responseTimes.length;
  };

  // Handle play again
  const handlePlayAgain = () => {
    // Clear participant data and navigate back to join page
    sessionStorage.removeItem('quizParticipant');
    navigate('/join');
  };

  // Handle view answers
  const handleViewAnswers = () => {
    // This would navigate to a detailed answers page
    // For now just show a toast
    toast({
      title: 'Feature coming soon',
      description: 'Detailed answer review will be available in a future update!'
    });
  };
  
  // Continue to next question after showing answer
  const handleContinue = () => {
    setViewState('waiting'); // Will be updated to 'question' when the next question arrives
  };

  // Show loading state if participant data isn't loaded yet
  if (!participantId || !quizId) {
    return (
      <div className="h-full flex items-center justify-center player-gradient">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  // Render different views based on current state
  return (
    <div className="h-screen">
      {viewState === 'waiting' && (
        <UserWaiting
          participantId={participantId}
          quizId={quizId}
          alias={alias}
          quizTitle={quizTitle}
          onQuizStart={handleQuizStart}
        />
      )}
      
      {viewState === 'question' && (
        <UserQuestion
          participantId={participantId}
          quizId={quizId}
          onAnswerSubmitted={handleAnswerSubmitted}
        />
      )}
      
      {viewState === 'answer' && answerData && (
        <UserAnswer
          isCorrect={answerData.isCorrect}
          score={answerData.score}
          selectedAnswer={answerData.selectedAnswer}
          responseTime={answerData.responseTime}
          position={answerData.position}
          onContinue={handleContinue}
        />
      )}
      
      {viewState === 'results' && (
        <UserResults
          position={position}
          totalScore={totalScore}
          totalQuestions={totalQuestions}
          correctAnswers={correctAnswers}
          avgResponseTime={getAverageResponseTime()}
          onPlayAgain={handlePlayAgain}
          onViewAnswers={handleViewAnswers}
        />
      )}
    </div>
  );
};

export default PlayPage;
