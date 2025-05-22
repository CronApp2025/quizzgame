import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';

interface LoginData {
  username: string;
  password: string;
}

const AdminLogin = () => {
  const [, navigate] = useLocation();
  const [formData, setFormData] = useState<LoginData>({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if already logged in
  useEffect(() => {
    const storedAdmin = localStorage.getItem('quizAdmin');
    if (storedAdmin) {
      try {
        const admin = JSON.parse(storedAdmin);
        if (admin && admin.id) {
          navigate('/admin/dashboard');
        }
      } catch (error) {
        // Invalid stored data, clear it
        localStorage.removeItem('quizAdmin');
      }
    }
  }, [navigate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast({
        title: 'Missing fields',
        description: 'Please enter both username and password',
        variant: 'destructive'
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password
        }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login failed');
      }
      
      const data = await response.json();
      
      // Store admin info in localStorage
      localStorage.setItem('quizAdmin', JSON.stringify(data.admin));
      
      toast({
        title: 'Login successful',
        description: 'Welcome to QuizTime!'
      });
      
      navigate('/admin/dashboard');
    } catch (error) {
      let message = 'Login failed';
      if (error instanceof Error) {
        message = error.message;
      }
      
      toast({
        title: 'Login failed',
        description: message,
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-dark p-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-[#00FF88] mb-2">QuizTime</h1>
          <p className="text-gray-400">Interactive Quiz Platform</p>
        </div>
        
        <Card className="border-gray-700 bg-[#2D2D2D]">
          <CardHeader>
            <CardTitle className="text-white">Admin Login</CardTitle>
            <CardDescription className="text-gray-400">
              Enter your credentials to access the dashboard
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-white">Username</Label>
                <Input
                  id="username"
                  name="username"
                  placeholder="Enter your username"
                  value={formData.username}
                  onChange={handleChange}
                  className="bg-[#1A1A1A] border-gray-700 text-white focus:border-[#00FF88]"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="bg-[#1A1A1A] border-gray-700 text-white focus:border-[#00FF88]"
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full bg-[#00FF88] text-[#1A1A1A] hover:bg-opacity-90"
                disabled={isLoading}
              >
                {isLoading ? 'Logging in...' : 'Login'}
              </Button>
              
              <div className="text-center mt-4">
                <p className="text-sm text-gray-400">
                  Default credentials: admin / password
                </p>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminLogin;
