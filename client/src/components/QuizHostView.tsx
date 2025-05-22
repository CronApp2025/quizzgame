import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import QRCode from './QRCode';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Quiz, Question, Participant } from '@shared/schema';

interface QuizHostViewProps {
  quizId: number;
  adminId: number;
}

type QuizState = 'waiting' | 'question_active' | 'question_ended' | 'ended';

interface QuestionStats {
  optionId: number;
  text: string;
  isCorrect: boolean;
  percentage: number;
  count: number;
}

const QuizHostView: React.FC<QuizHostViewProps> = ({ quizId, adminId }) => {
  const [, navigate] = useLocation();
  const [quizState, setQuizState] = useState<QuizState>('waiting');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15);
  const [questionStats, setQuestionStats] = useState<QuestionStats[]>([]);
  const timer = useRef<NodeJS.Timeout | null>(null);

  // Fetch quiz details
  const { data: quizData } = useQuery<{ quiz: Quiz }>({
    queryKey: [`/api/quizzes/${quizId}`],
  });

  // Fetch questions
  const { data: questionsData } = useQuery<{ questions: Question[] }>({
    queryKey: [`/api/quizzes/${quizId}/questions`],
  });

  // Set up WebSocket connection
  const { socket, connected, wsClientId } = useWebSocket();

  // Register admin with WebSocket server
  useEffect(() => {
    if (connected && wsClientId) {
      const connectAdmin = async () => {
        try {
          const response = await fetch('/api/admin/connect', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              adminId,
              quizId,
              wsClientId,
            }),
            credentials: 'include',
          });
          
          if (!response.ok) {
            throw new Error('Failed to connect as admin');
          }
          
          const data = await response.json();
          if (data.participantCount > 0) {
            setParticipants(data.participants || []);
          }
        } catch (error) {
          toast({
            title: 'Connection Error',
            description: 'Failed to connect as quiz host',
            variant: 'destructive',
          });
        }
      };
      
      connectAdmin();
    }
  }, [connected, wsClientId, adminId, quizId]);

  // WebSocket message handling
  useEffect(() => {
    if (!socket) return;
    
    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);
        
        switch (message.type) {
          case 'player_joined':
            // Add new participant to the list
            setParticipants(prev => [...prev, message.data.participant]);
            break;
            
          case 'submit_answer':
            // We don't need to handle individual answers directly in the host view
            break;
            
          case 'leaderboard_update':
            // Update leaderboard
            setParticipants(message.data.leaderboard);
            break;
            
          case 'error':
            toast({
              title: 'Error',
              description: message.data.message,
              variant: 'destructive',
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
  }, [socket]);

  // Handle start quiz
  const startQuiz = () => {
    if (!socket || !questionsData?.questions.length) return;
    
    socket.send(JSON.stringify({
      type: 'quiz_started',
      data: { quizId }
    }));
    
    // Start with the first question after a brief delay
    setTimeout(() => {
      sendNextQuestion();
    }, 3000);
  };

  // Send next question
  const sendNextQuestion = () => {
    if (!socket || !questionsData?.questions) return;
    
    if (currentQuestionIndex >= questionsData.questions.length) {
      // No more questions, end the quiz
      endQuiz();
      return;
    }
    
    const question = questionsData.questions[currentQuestionIndex];
    setCurrentQuestion(question);
    
    socket.send(JSON.stringify({
      type: 'new_question',
      data: {
        questionId: question.id
      }
    }));
    
    setQuizState('question_active');
    
    // Start the timer
    const questionTime = quizData?.quiz.timePerQuestion || 15;
    setTimeLeft(questionTime);
    
    if (timer.current) {
      clearInterval(timer.current);
    }
    
    timer.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up, end the question
          clearInterval(timer.current!);
          endQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // End current question
  const endQuestion = () => {
    if (!socket || !currentQuestion) return;
    
    if (timer.current) {
      clearInterval(timer.current);
    }
    
    socket.send(JSON.stringify({
      type: 'question_ended',
      data: {
        questionId: currentQuestion.id
      }
    }));
    
    setQuizState('question_ended');
  };

  // Move to next question
  const goToNextQuestion = () => {
    setCurrentQuestionIndex(prev => prev + 1);
    sendNextQuestion();
  };

  // End the entire quiz
  const endQuiz = () => {
    if (!socket) return;
    
    socket.send(JSON.stringify({
      type: 'quiz_ended',
      data: { quizId }
    }));
    
    setQuizState('ended');
  };

  // Handle return to dashboard
  const returnToDashboard = () => {
    navigate('/admin/dashboard');
  };

  // Function to get the correct option text
  const getCorrectOptionText = () => {
    if (!currentQuestion) return '';
    
    const options = currentQuestion.options as any[];
    const correctOption = options.find(opt => opt.isCorrect);
    return correctOption ? correctOption.text : '';
  };

  return (
    <div className="h-full bg-dark">
      <div className="h-full flex flex-col md:flex-row">
        {/* Left Panel - Question Display */}
        <div className="flex-1 p-6 flex flex-col">
          <div className="mb-4 flex justify-between items-center">
            <h2 className="text-white text-xl font-bold">
              {quizData?.quiz.title}: {quizState === 'waiting' ? 'Waiting to Start' : 'Running'}
            </h2>
            <div className="flex gap-2">
              <Button
                className="px-4 py-2 bg-[#2D2D2D] text-white rounded-lg hover:bg-[#3A3A3A]"
                onClick={returnToDashboard}
              >
                End Quiz
              </Button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            {/* Quiz State: Pre-Start */}
            {quizState === 'waiting' && (
              <div className="animate-fade-in">
                <h3 className="text-white text-2xl mb-4 font-bold">Ready to Start</h3>
                <p className="text-gray-400 mb-6">Share the QR code with participants to join</p>
                <div className="bg-white p-4 rounded-xl mb-6 inline-block">
                  {quizData?.quiz.code && (
                    <QRCode
                      value={`${window.location.origin}/join?code=${quizData.quiz.code}`}
                      size={160}
                      className="w-40 h-40"
                    />
                  )}
                </div>
                <div>
                  <p className="text-white mb-2">Quiz Code: <span className="font-bold text-[#00FF88]">{quizData?.quiz.code}</span></p>
                  <p className="text-gray-400 text-sm mb-6">Players joined: <span>{participants.length}</span></p>
                  <Button
                    className="px-6 py-3 bg-[#00FF88] text-dark font-bold rounded-lg hover:bg-opacity-90 text-lg"
                    onClick={startQuiz}
                    disabled={!questionsData || questionsData.questions.length === 0}
                  >
                    {!questionsData || questionsData.questions.length === 0 
                      ? 'No questions available' 
                      : 'Start Quiz'}
                  </Button>
                </div>
              </div>
            )}
            
            {/* Quiz State: Question Active */}
            {quizState === 'question_active' && currentQuestion && (
              <div className="animate-fade-in">
                <div className="mb-6">
                  <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" fill="none" stroke="#2D2D2D" strokeWidth="8" />
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
                    <text x="50" y="55" textAnchor="middle" fill="white" fontSize="24" fontWeight="bold">{timeLeft}</text>
                  </svg>
                </div>
                <div className="mb-6">
                  <h3 className="text-white text-2xl mb-4 font-bold">
                    Question {currentQuestionIndex + 1} of {questionsData?.questions.length}
                  </h3>
                  <div className="bg-[#3A3A3A] p-6 rounded-xl mb-6 max-w-2xl mx-auto">
                    <p className="text-white text-xl">{currentQuestion.text}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 max-w-2xl mx-auto">
                    {(currentQuestion.options as any[]).map((option, index) => (
                      <div key={index} className="bg-[#3A3A3A] p-4 rounded-lg text-white">
                        {String.fromCharCode(65 + index)}: {option.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {/* Quiz State: Question Results */}
            {quizState === 'question_ended' && currentQuestion && (
              <div className="animate-fade-in">
                <h3 className="text-white text-2xl mb-4 font-bold">Question Results</h3>
                <div className="bg-[#3A3A3A] p-6 rounded-xl mb-6 max-w-2xl mx-auto">
                  <p className="text-white text-xl mb-4">{currentQuestion.text}</p>
                  <div className="flex justify-center items-center mb-4">
                    <div className="w-12 h-12 rounded-full bg-[#00C853] flex items-center justify-center text-white text-xl">
                      <span>✓</span>
                    </div>
                    <div className="ml-3 text-left">
                      <div className="text-white font-medium">Correct Answer</div>
                      <div className="text-[#00FF88]">{getCorrectOptionText()}</div>
                    </div>
                  </div>
                </div>
                
                <div className="mb-8 max-w-md mx-auto">
                  <h4 className="text-white mb-3">Answer Statistics</h4>
                  <div className="space-y-3">
                    {questionStats.length > 0 ? (
                      questionStats.map((stat, index) => (
                        <div key={index}>
                          <div className="flex justify-between mb-1 text-sm">
                            <span className="text-white">{stat.text}</span>
                            <span className={stat.isCorrect ? "text-[#00FF88]" : "text-gray-400"}>
                              {Math.round(stat.percentage)}%
                            </span>
                          </div>
                          <div className="w-full bg-[#3A3A3A] rounded-full h-2.5">
                            <div 
                              className={`${stat.isCorrect ? "bg-[#00FF88]" : "bg-gray-500"} h-2.5 rounded-full`} 
                              style={{ width: `${stat.percentage}%` }}
                            />
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-gray-400 text-center">No answers submitted</div>
                    )}
                  </div>
                </div>
                
                <Button
                  className="px-6 py-3 bg-[#00FF88] text-dark font-bold rounded-lg hover:bg-opacity-90"
                  onClick={goToNextQuestion}
                >
                  {currentQuestionIndex < (questionsData?.questions.length || 0) - 1 
                    ? 'Next Question' 
                    : 'View Final Results'}
                </Button>
              </div>
            )}
            
            {/* Quiz State: Ended */}
            {quizState === 'ended' && (
              <div className="animate-fade-in">
                <h3 className="text-white text-2xl mb-4 font-bold">Quiz Completed</h3>
                <p className="text-gray-400 mb-6">All questions have been answered</p>
                
                <div className="bg-[#3A3A3A] p-6 rounded-xl mb-6 max-w-2xl mx-auto">
                  <h4 className="text-white text-xl mb-4">Final Results</h4>
                  {participants.length > 0 ? (
                    <div className="flex items-center justify-center mb-4">
                      <div className="w-16 h-16 rounded-full bg-[#00FF88] flex items-center justify-center text-dark text-2xl font-bold mr-4">
                        1
                      </div>
                      <div className="text-left">
                        <div className="text-[#00FF88] text-2xl font-bold">{participants[0].alias}</div>
                        <div className="text-white">{participants[0].score} points</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400">No participants</div>
                  )}
                </div>
                
                <Button
                  className="px-6 py-3 bg-[#00FF88] text-dark font-bold rounded-lg hover:bg-opacity-90"
                  onClick={returnToDashboard}
                >
                  Return to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
        
        {/* Right Panel - Leaderboard */}
        <div className="w-full md:w-80 bg-[#3A3A3A] border-t md:border-t-0 md:border-l border-gray-700 p-6">
          <h3 className="text-white text-xl mb-4 font-bold flex items-center">
            <span className="mr-2">🏆</span> Leaderboard
          </h3>
          
          {participants.length > 0 ? (
            <div className="space-y-3">
              {participants.slice(0, 5).map((participant, index) => (
                <div 
                  key={participant.id} 
                  className={`bg-dark p-3 rounded-lg flex items-center ${index === 0 ? 'animate-bounce-in' : ''}`}
                >
                  <div className={`w-8 h-8 rounded-full ${index === 0 ? 'bg-[#00FF88] text-dark' : 'bg-gray-700 text-white'} flex items-center justify-center font-bold mr-3`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="text-white font-medium">{participant.alias}</div>
                    <div className="text-xs text-gray-400">
                      {/* We'd display response time here if available */}
                      Joined: {new Date(participant.joinedAt).toLocaleTimeString()}
                    </div>
                  </div>
                  <div className={index === 0 ? "text-[#00FF88] font-bold" : "text-white font-bold"}>
                    {participant.score}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-400 text-center py-6">
              No participants yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuizHostView;
