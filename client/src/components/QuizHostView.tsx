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
      type: 'QUIZ_STARTED',
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
      type: 'NEW_QUESTION',
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
    
    // Record start time
    const startTime = new Date().getTime();
    const endTime = startTime + (questionTime * 1000);
    
    timer.current = setInterval(() => {
      const currentTime = new Date().getTime();
      const remaining = Math.max(0, Math.ceil((endTime - currentTime) / 1000));
      
      setTimeLeft(remaining);
      
      if (remaining <= 0) {
        // Time's up, end the question
        clearInterval(timer.current!);
        endQuestion();
      }
    }, 200); // Update more frequently for smoother countdown
  };

  // End current question
  const endQuestion = () => {
    if (!socket || !currentQuestion) return;
    
    if (timer.current) {
      clearInterval(timer.current);
    }
    
    socket.send(JSON.stringify({
      type: 'QUESTION_ENDED',
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
      type: 'QUIZ_ENDED',
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
                <h3 className="text-white text-2xl mb-4 font-bold">¡Quiz completado!</h3>
                <p className="text-gray-400 mb-6">Todas las preguntas han sido respondidas</p>
                
                <div className="bg-[#3A3A3A] p-6 rounded-xl mb-6 max-w-2xl mx-auto">
                  <h4 className="text-white text-xl mb-4">Resultados finales</h4>
                  
                  {participants.length > 0 ? (
                    <div className="space-y-6">
                      {/* Podio de ganadores */}
                      <div className="flex justify-center items-end mt-8 mb-8">
                        {participants.length > 1 && (
                          <div className="flex flex-col items-center mx-2">
                            <div className="w-14 h-14 rounded-full bg-[#C0C0C0] flex items-center justify-center text-dark text-xl font-bold mb-2">
                              2
                            </div>
                            <div className="w-20 h-24 bg-[#333] rounded-t-lg flex flex-col items-center justify-end p-2">
                              <div className="text-[#C0C0C0] font-bold mb-1 text-sm truncate w-full text-center">{participants[1].alias}</div>
                              <div className="text-white text-xs">{participants[1].score} pts</div>
                            </div>
                          </div>
                        )}
                        
                        {/* Primer lugar */}
                        <div className="flex flex-col items-center mx-2 -mt-4">
                          <div className="w-10 h-10 text-yellow-500 mb-1">👑</div>
                          <div className="w-16 h-16 rounded-full bg-[#FFD700] flex items-center justify-center text-dark text-2xl font-bold mb-2">
                            1
                          </div>
                          <div className="w-24 h-32 bg-[#444] rounded-t-lg flex flex-col items-center justify-end p-2">
                            <div className="text-[#FFD700] font-bold mb-1 truncate w-full text-center">{participants[0].alias}</div>
                            <div className="text-white">{participants[0].score} pts</div>
                          </div>
                        </div>
                        
                        {participants.length > 2 && (
                          <div className="flex flex-col items-center mx-2">
                            <div className="w-12 h-12 rounded-full bg-[#CD7F32] flex items-center justify-center text-dark text-lg font-bold mb-2">
                              3
                            </div>
                            <div className="w-20 h-20 bg-[#333] rounded-t-lg flex flex-col items-center justify-end p-2">
                              <div className="text-[#CD7F32] font-bold mb-1 text-sm truncate w-full text-center">{participants[2].alias}</div>
                              <div className="text-white text-xs">{participants[2].score} pts</div>
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Lista de puntajes */}
                      <div className="mt-6 border-t border-gray-700 pt-4">
                        <h5 className="text-white mb-2">Tabla de puntajes</h5>
                        <div className="space-y-2 max-h-40 overflow-y-auto pr-2">
                          {participants.slice(0, 10).map((participant, index) => (
                            <div key={participant.id} className="flex justify-between items-center p-2 bg-[#2D2D2D] rounded">
                              <div className="flex items-center">
                                <div className="w-6 h-6 rounded-full bg-dark flex items-center justify-center text-xs text-white mr-2">
                                  {index + 1}
                                </div>
                                <span className="text-white">{participant.alias}</span>
                              </div>
                              <span className="text-[#00FF88] font-bold">{participant.score}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-400 text-center py-10">No hay participantes en este quiz</div>
                  )}
                </div>
                
                <Button
                  className="px-6 py-3 bg-[#00FF88] text-dark font-bold rounded-lg hover:bg-opacity-90"
                  onClick={returnToDashboard}
                >
                  Volver al Dashboard
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
