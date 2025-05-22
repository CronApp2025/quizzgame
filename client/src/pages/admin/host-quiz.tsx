import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import QuizHostView from '@/components/QuizHostView';
import { toast } from '@/hooks/use-toast';

interface Admin {
  id: number;
  username: string;
}

const HostQuizPage = () => {
  const [, navigate] = useLocation();
  const params = useParams();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Extract quiz ID from params
  const quizId = params.id ? parseInt(params.id) : null;

  useEffect(() => {
    // Check if user is logged in
    const storedAdmin = localStorage.getItem('quizAdmin');
    
    if (!storedAdmin) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to host a quiz',
        variant: 'destructive'
      });
      navigate('/');
      return;
    }
    
    if (!quizId) {
      toast({
        title: 'Quiz not found',
        description: 'Invalid quiz ID',
        variant: 'destructive'
      });
      navigate('/admin/dashboard');
      return;
    }
    
    try {
      const parsedAdmin = JSON.parse(storedAdmin);
      setAdmin(parsedAdmin);
      setIsLoading(false);
    } catch (error) {
      console.error('Error parsing stored admin data:', error);
      localStorage.removeItem('quizAdmin');
      navigate('/');
    }
  }, [navigate, quizId]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark">
        <div className="text-[#00FF88] text-xl">Loading quiz...</div>
      </div>
    );
  }

  if (!admin || !quizId) {
    return null; // Will redirect in useEffect
  }

  return <QuizHostView adminId={admin.id} quizId={quizId} />;
};

export default HostQuizPage;
