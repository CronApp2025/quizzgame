import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import AdminDashboard from '@/components/AdminDashboard';
import { toast } from '@/hooks/use-toast';

interface Admin {
  id: number;
  username: string;
}

const DashboardPage = () => {
  const [, navigate] = useLocation();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if user is logged in
    const storedAdmin = localStorage.getItem('quizAdmin');
    
    if (!storedAdmin) {
      toast({
        title: 'Authentication required',
        description: 'Please log in to access the dashboard',
        variant: 'destructive'
      });
      navigate('/');
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
  }, [navigate]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-dark">
        <div className="text-[#00FF88] text-xl">Loading...</div>
      </div>
    );
  }

  if (!admin) {
    return null; // Will redirect in useEffect
  }

  return <AdminDashboard adminId={admin.id} />;
};

export default DashboardPage;
