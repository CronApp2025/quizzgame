import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { useWebSocket } from '@/hooks/useWebSocket';
import { toast } from '@/hooks/use-toast';

interface UserQuestionProps {
  participantId: number;
  quizId: number;
  onAnswerSubmitted: (isCorrect: boolean, score: number, correctOptionId: number) => void;
}

interface QuestionData {
  questionId: number;
  questionText: string;
  options: Array<{
    id: number;
    text: string;
  }>;
  timeLimit: number;
}

const UserQuestion: React.FC<UserQuestionProps> = ({
  participantId,
  quizId,
  onAnswerSubmitted
}) => {
  const { socket } = useWebSocket();
  const [question, setQuestion] = useState<QuestionData | null>(null);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(0);
  
  // Listen for new questions
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'new_question') {
          // Reset state for new question
          setSelectedOption(null);
          setIsSubmitting(false);
          
          // Set question data
          setQuestion(message.data);
          setTimeLeft(message.data.timeLimit);
          
          // Start the timer
          startTime.current = Date.now();
          
          if (timer.current) {
            clearInterval(timer.current);
          }
          
          timer.current = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                clearInterval(timer.current!);
                // Auto-submit if time runs out and user hasn't answered
                if (!isSubmitting && selectedOption === null) {
                  // We don't actually submit - just time out
                  toast({
                    title: "Time is up!",
                    description: "You did not answer in time",
                    variant: 'destructive',
                  });
                }
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
    
    socket.addEventListener('message', handleMessage);
    
    return () => {
      socket.removeEventListener('message', handleMessage);
      if (timer.current) {
        clearInterval(timer.current);
      }
    };
  }, [socket, isSubmitting, selectedOption]);
  
  // Handle answer submission
  const handleSelectAnswer = (optionId: number) => {
    if (isSubmitting || selectedOption !== null || !question) return;
    
    setSelectedOption(optionId);
    setIsSubmitting(true);
    
    // Calculate response time in milliseconds
    const responseTime = Date.now() - startTime.current;
    
    // Send answer to server
    if (socket) {
      socket.send(JSON.stringify({
        type: 'submit_answer',
        data: {
          questionId: question.questionId,
          optionId,
          responseTime
        }
      }));
    }
    
    // Listen for response
    const handleAnswerResponse = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        if (message.type === 'submit_answer') {
          // Process answer result
          const { isCorrect, score, correctOptionId } = message.data;
          onAnswerSubmitted(isCorrect, score, correctOptionId);
          if (socket) {
            socket.removeEventListener('message', handleAnswerResponse);
          }
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
        if (socket) {
            socket.removeEventListener('message', handleAnswerResponse);
        }
        setIsSubmitting(false);
      }
    };
    
    if (socket) {
      socket.addEventListener('message', handleAnswerResponse);
    }
  };
  
  if (!question) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 player-gradient">
        <div className="text-white text-xl">Waiting for question...</div>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col player-gradient">
      {/* Timer at the top */}
      <div className="p-4 flex justify-center">
        <div className="relative w-16 h-16">
          <svg className="w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#3A3A3A" strokeWidth="8" />
            <circle 
              className="countdown-circle" 
              cx="50" cy="50" r="45" 
              fill="none" 
              stroke="#00FF88" 
              strokeWidth="8" 
              strokeLinecap="round"
              style={{
                animation: `countdown ${timeLeft}s linear forwards`
              }}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center text-white text-xl font-bold">{timeLeft}</div>
        </div>
      </div>
      
      {/* Question Card */}
      <div className="p-4 text-center mb-4">
        <h3 className="text-white text-xl font-bold mb-2">Question</h3>
        <div className="bg-[#2D2D2D] p-6 rounded-xl mb-6">
          <p className="text-white text-xl">{question.questionText}</p>
        </div>
      </div>
      
      {/* Answer Grid */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-full">
          {question.options.map((option, index) => (
            <Button
              key={option.id}
              className={`
                rounded-xl bg-[#2D2D2D] border-2 
                ${selectedOption === option.id 
                  ? 'border-[#00FF88]' 
                  : 'border-[#2D2D2D] hover:border-[#00FF88]'} 
                text-white p-6 flex flex-col items-center justify-center 
                transition-all option-hover
                ${selectedOption !== null && selectedOption !== option.id ? 'opacity-50' : ''}
              `}
              disabled={selectedOption !== null || isSubmitting}
              onClick={() => handleSelectAnswer(option.id)}
            >
              <div className="w-10 h-10 rounded-full bg-dark flex items-center justify-center mb-2">
                {String.fromCharCode(65 + index)}
              </div>
              <div className="text-lg">{option.text}</div>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default UserQuestion;
