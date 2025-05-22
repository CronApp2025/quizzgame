import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import QRCode from './QRCode';
import { Quiz } from '@shared/schema';
import { formatDistanceToNow } from 'date-fns';

interface AdminDashboardProps {
  adminId: number;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ adminId }) => {
  const [, navigate] = useLocation();

  // Fetch quizzes
  const { data, isLoading, error } = useQuery<{ quizzes: Quiz[] }>({
    queryKey: [`/api/quizzes?adminId=${adminId}`],
  });

  // Delete quiz mutation
  const deleteQuizMutation = useMutation({
    mutationFn: async (quizId: number) => {
      const res = await fetch(`/api/quizzes/${quizId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      
      if (!res.ok) {
        throw new Error('Failed to delete quiz');
      }
      
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/quizzes?adminId=${adminId}`] });
      toast({
        title: 'Quiz deleted',
        description: 'The quiz has been successfully deleted',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to delete quiz',
        variant: 'destructive',
      });
    },
  });

  // Handle quiz deletion
  const handleDeleteQuiz = (quizId: number) => {
    if (confirm('Are you sure you want to delete this quiz?')) {
      deleteQuizMutation.mutate(quizId);
    }
  };

  // Create new quiz
  const handleCreateQuiz = () => {
    navigate('/admin/quiz/new');
  };

  // Start or edit quiz
  const handleStartQuiz = (quizId: number) => {
    navigate(`/admin/quiz/${quizId}/host`);
  };

  const handleEditQuiz = (quizId: number) => {
    navigate(`/admin/quiz/${quizId}/edit`);
  };

  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('quizAdmin');
    navigate('/');
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (error) {
    return <div className="flex items-center justify-center h-screen">Error loading quizzes</div>;
  }

  return (
    <div className="flex h-full bg-dark">
      {/* Sidebar */}
      <div className="w-64 bg-dark text-white flex flex-col">
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-[#00FF88]">QuizTime</h2>
          <p className="text-sm text-gray-400">Admin Dashboard</p>
        </div>
        
        <nav className="flex-1 p-4">
          <ul>
            <li className="mb-2">
              <a href="#" className="flex items-center px-4 py-3 rounded-lg bg-dark-lighter text-[#00FF88]">
                <span className="mr-3">📊</span>
                <span>Dashboard</span>
              </a>
            </li>
            <li className="mb-2">
              <a href="#" className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-lighter text-gray-300 hover:text-white">
                <span className="mr-3">❓</span>
                <span>My Quizzes</span>
              </a>
            </li>
            <li className="mb-2">
              <a href="#" className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-lighter text-gray-300 hover:text-white">
                <span className="mr-3">📈</span>
                <span>Analytics</span>
              </a>
            </li>
            <li className="mb-2">
              <a href="#" className="flex items-center px-4 py-3 rounded-lg hover:bg-dark-lighter text-gray-300 hover:text-white">
                <span className="mr-3">⚙️</span>
                <span>Settings</span>
              </a>
            </li>
          </ul>
        </nav>
        
        <div className="p-4 border-t border-gray-700">
          <div className="flex items-center mb-4">
            <div className="w-10 h-10 rounded-full bg-dark-medium flex items-center justify-center text-[#00FF88]">
              <span>👤</span>
            </div>
            <div className="ml-3">
              <div className="font-medium text-white">Admin User</div>
              <div className="text-xs text-gray-400">admin@quiztime.com</div>
            </div>
          </div>
          <Button 
            variant="outline" 
            className="w-full py-2 flex items-center justify-center rounded-lg border border-gray-700 text-gray-400 hover:text-white"
            onClick={handleLogout}
          >
            <span className="mr-2">🚪</span> Logout
          </Button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold text-white">Quiz Dashboard</h1>
            <Button 
              className="flex items-center px-4 py-2 bg-[#00FF88] text-dark font-medium rounded-lg hover:bg-opacity-90 transition-all"
              onClick={handleCreateQuiz}
            >
              <span className="mr-2">➕</span> Create New Quiz
            </Button>
          </div>
          
          {/* Quiz List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data?.quizzes && data.quizzes.length > 0 ? (
              data.quizzes.map((quiz) => (
                <Card key={quiz.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <CardContent className="p-0">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <h3 className="text-lg font-semibold">{quiz.title}</h3>
                        <Badge className={quiz.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                          {quiz.status === 'active' ? 'Active' : 'Draft'}
                        </Badge>
                      </div>
                      <p className="text-gray-600 text-sm mb-4">
                        {/* Count would come from questions when implemented */}
                        ? questions • {quiz.timePerQuestion} sec/question
                      </p>
                      <div className="flex justify-between items-center">
                        <div>
                          <span className="text-xs text-gray-500">
                            Created: {formatDistanceToNow(new Date(quiz.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            className="p-2 text-gray-500 hover:text-[#00FF88] rounded-full hover:bg-gray-100"
                            onClick={() => handleEditQuiz(quiz.id)}
                          >
                            <span>✏️</span>
                          </button>
                          <button 
                            className="p-2 text-gray-500 hover:text-[#FF3366] rounded-full hover:bg-gray-100"
                            onClick={() => handleDeleteQuiz(quiz.id)}
                          >
                            <span>🗑️</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gray-50 px-5 py-3 flex justify-between items-center">
                      <div>
                        <Button
                          className={`px-3 py-1.5 ${
                            quiz.status === 'active'
                              ? 'bg-[#00FF88] text-dark'
                              : 'bg-gray-200 text-gray-600 cursor-not-allowed'
                          } text-sm font-medium rounded-lg hover:bg-opacity-90`}
                          onClick={() => quiz.status === 'active' && handleStartQuiz(quiz.id)}
                          disabled={quiz.status !== 'active'}
                        >
                          {quiz.status === 'active' ? 'Start Quiz' : 'Complete Quiz'}
                        </Button>
                      </div>
                      <div className={`border border-gray-200 rounded-md p-2 bg-white ${quiz.status !== 'active' ? 'opacity-50' : ''}`}>
                        <div className="w-16 h-16 flex items-center justify-center">
                          {quiz.status === 'active' ? (
                            <QRCode 
                              value={`${window.location.origin}/join?code=${quiz.code}`} 
                              size={64} 
                            />
                          ) : (
                            <div className="text-2xl text-gray-400">🔲</div>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="col-span-3 text-center py-10 text-gray-400">
                <p className="mb-4">No quizzes found</p>
                <Button 
                  className="bg-[#00FF88] text-dark hover:bg-opacity-90"
                  onClick={handleCreateQuiz}
                >
                  Create your first quiz
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
