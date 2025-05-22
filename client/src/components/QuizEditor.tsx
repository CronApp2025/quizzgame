import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { apiRequest } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from '@/hooks/use-toast';
import { Quiz, Question, QuizStatus } from '@shared/schema';

interface QuizEditorProps {
  quizId?: number;
  adminId: number;
}

interface QuizFormData {
  title: string;
  timePerQuestion: number;
}

interface QuestionFormData {
  text: string;
  options: Array<{
    id: number;
    text: string;
    isCorrect: boolean;
  }>;
  order: number;
}

const QuizEditor: React.FC<QuizEditorProps> = ({ quizId, adminId }) => {
  const [, navigate] = useLocation();
  const isEditing = !!quizId;
  
  // Quiz form state
  const [quizForm, setQuizForm] = useState<QuizFormData>({
    title: '',
    timePerQuestion: 15,
  });
  
  // Questions state
  const [questions, setQuestions] = useState<QuestionFormData[]>([]);
  
  // Fetch quiz if editing
  const { data: quizData, isLoading: quizLoading } = useQuery<{ quiz: Quiz }>({
    queryKey: [`/api/quizzes/${quizId}`],
    enabled: isEditing,
  });
  
  // Fetch questions if editing
  const { data: questionsData, isLoading: questionsLoading } = useQuery<{ questions: Question[] }>({
    queryKey: [`/api/quizzes/${quizId}/questions`],
    enabled: isEditing,
  });
  
  // Set up form with existing data when editing
  useEffect(() => {
    if (quizData?.quiz) {
      setQuizForm({
        title: quizData.quiz.title,
        timePerQuestion: quizData.quiz.timePerQuestion,
      });
    }
  }, [quizData]);
  
  useEffect(() => {
    if (questionsData?.questions) {
      setQuestions(questionsData.questions.map(q => ({
        text: q.text,
        options: q.options as any,
        order: q.order,
      })));
    }
  }, [questionsData]);
  
  // Initialize with one empty question if creating new quiz
  useEffect(() => {
    if (!isEditing && questions.length === 0) {
      setQuestions([{
        text: '',
        options: [
          { id: 0, text: '', isCorrect: true },
          { id: 1, text: '', isCorrect: false },
          { id: 2, text: '', isCorrect: false },
          { id: 3, text: '', isCorrect: false }
        ],
        order: 0
      }]);
    }
  }, [isEditing, questions.length]);
  
  // Handle quiz form changes
  const handleQuizChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setQuizForm(prev => ({
      ...prev,
      [name]: name === 'timePerQuestion' ? parseInt(value) : value
    }));
  };
  
  // Handle question text changes
  const handleQuestionTextChange = (index: number, value: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index].text = value;
    setQuestions(updatedQuestions);
  };
  
  // Handle option text changes
  const handleOptionTextChange = (questionIndex: number, optionIndex: number, value: string) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options[optionIndex].text = value;
    setQuestions(updatedQuestions);
  };
  
  // Handle correct option selection
  const handleCorrectOptionChange = (questionIndex: number, optionId: number) => {
    const updatedQuestions = [...questions];
    updatedQuestions[questionIndex].options = updatedQuestions[questionIndex].options.map(opt => ({
      ...opt,
      isCorrect: opt.id === optionId
    }));
    setQuestions(updatedQuestions);
  };
  
  // Add new question
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        text: '',
        options: [
          { id: 0, text: '', isCorrect: true },
          { id: 1, text: '', isCorrect: false },
          { id: 2, text: '', isCorrect: false },
          { id: 3, text: '', isCorrect: false }
        ],
        order: questions.length
      }
    ]);
  };
  
  // Remove question
  const removeQuestion = (index: number) => {
    const updatedQuestions = questions.filter((_, i) => i !== index);
    // Update order for remaining questions
    const reorderedQuestions = updatedQuestions.map((q, i) => ({
      ...q,
      order: i
    }));
    setQuestions(reorderedQuestions);
  };
  
  // Create quiz mutation
  const createQuizMutation = useMutation({
    mutationFn: async () => {
      // 1. Create the quiz
      const quizResponse = await apiRequest('POST', '/api/quizzes', {
        adminId,
        title: quizForm.title,
        timePerQuestion: quizForm.timePerQuestion,
        status: QuizStatus.ACTIVE,
        code: '' // This will be generated on the server
      });
      
      const quizJson = await quizResponse.json();
      const newQuizId = quizJson.quiz.id;
      
      // 2. Create all questions for the quiz
      for (const question of questions) {
        await apiRequest('POST', '/api/questions', {
          ...question,
          quizId: newQuizId
        });
      }
      
      return newQuizId;
    },
    onSuccess: (newQuizId) => {
      toast({
        title: 'Quiz created',
        description: 'Your quiz has been created successfully!',
      });
      navigate(`/admin/dashboard`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to create quiz: ${error}`,
        variant: 'destructive',
      });
    }
  });
  
  // Update quiz mutation
  const updateQuizMutation = useMutation({
    mutationFn: async () => {
      if (!quizId) return;
      
      // 1. Update the quiz details
      await apiRequest('PUT', `/api/quizzes/${quizId}`, {
        title: quizForm.title,
        timePerQuestion: quizForm.timePerQuestion,
        status: QuizStatus.ACTIVE
      });
      
      // 2. Get existing questions to compare
      const existingQuestionsRes = await fetch(`/api/quizzes/${quizId}/questions`, {
        credentials: 'include'
      });
      const existingQuestionsData = await existingQuestionsRes.json();
      const existingQuestions = existingQuestionsData.questions || [];
      
      // 3. Update existing questions and create new ones
      for (const question of questions) {
        const existingQuestion = existingQuestions.find((q: Question) => q.order === question.order);
        
        if (existingQuestion) {
          // Update existing question
          await apiRequest('PUT', `/api/questions/${existingQuestion.id}`, {
            text: question.text,
            options: question.options,
            order: question.order
          });
        } else {
          // Create new question
          await apiRequest('POST', '/api/questions', {
            ...question,
            quizId
          });
        }
      }
      
      // 4. Delete questions that were removed
      for (const existingQuestion of existingQuestions) {
        const stillExists = questions.some(q => q.order === existingQuestion.order);
        if (!stillExists) {
          await apiRequest('DELETE', `/api/questions/${existingQuestion.id}`);
        }
      }
      
      return quizId;
    },
    onSuccess: () => {
      toast({
        title: 'Quiz updated',
        description: 'Your quiz has been updated successfully!',
      });
      navigate(`/admin/dashboard`);
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: `Failed to update quiz: ${error}`,
        variant: 'destructive',
      });
    }
  });
  
  // Save quiz
  const saveQuiz = () => {
    // Validate form
    if (!quizForm.title.trim()) {
      toast({
        title: 'Missing title',
        description: 'Please enter a title for your quiz',
        variant: 'destructive',
      });
      return;
    }
    
    // Validate questions
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].text.trim()) {
        toast({
          title: 'Missing question text',
          description: `Please enter text for question ${i + 1}`,
          variant: 'destructive',
        });
        return;
      }
      
      for (let j = 0; j < questions[i].options.length; j++) {
        if (!questions[i].options[j].text.trim()) {
          toast({
            title: 'Missing option text',
            description: `Please enter text for all options in question ${i + 1}`,
            variant: 'destructive',
          });
          return;
        }
      }
      
      if (!questions[i].options.some(opt => opt.isCorrect)) {
        toast({
          title: 'No correct answer',
          description: `Please select a correct answer for question ${i + 1}`,
          variant: 'destructive',
        });
        return;
      }
    }
    
    if (isEditing) {
      updateQuizMutation.mutate();
    } else {
      createQuizMutation.mutate();
    }
  };
  
  // Cancel and go back
  const handleCancel = () => {
    navigate('/admin/dashboard');
  };
  
  if (quizLoading || questionsLoading) {
    return <div className="flex items-center justify-center h-screen">Loading quiz data...</div>;
  }
  
  return (
    <div className="flex-1 overflow-auto bg-white">
      <div className="p-6 max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-6 pb-4 border-b">
          <div>
            <h1 className="text-2xl font-bold">{isEditing ? 'Edit Quiz' : 'Create Quiz'}</h1>
            <p className="text-gray-500">Create or edit your quiz questions</p>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50"
              onClick={handleCancel}
            >
              Cancel
            </Button>
            <Button
              className="px-4 py-2 bg-[#00FF88] text-dark font-medium rounded-lg hover:bg-opacity-90"
              onClick={saveQuiz}
              disabled={createQuizMutation.isPending || updateQuizMutation.isPending}
            >
              {createQuizMutation.isPending || updateQuizMutation.isPending ? 'Saving...' : 'Save Quiz'}
            </Button>
          </div>
        </div>
        
        {/* Quiz Details */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Quiz Title</Label>
              <Input
                type="text"
                name="title"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none"
                value={quizForm.title}
                onChange={handleQuizChange}
                placeholder="Enter quiz title"
              />
            </div>
            <div>
              <Label className="block text-sm font-medium text-gray-700 mb-1">Time per Question (seconds)</Label>
              <Input
                type="number"
                name="timePerQuestion"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none"
                value={quizForm.timePerQuestion}
                onChange={handleQuizChange}
                min={5}
                max={60}
              />
            </div>
          </div>
        </div>
        
        {/* Questions List */}
        <div className="space-y-8">
          {questions.map((question, questionIndex) => (
            <div key={questionIndex} className="bg-gray-50 rounded-xl p-6 border border-gray-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-medium">Question {questionIndex + 1}</h3>
                <div className="flex gap-2">
                  <button
                    className="p-1.5 text-gray-500 hover:text-[#FF3366] rounded-full hover:bg-gray-100"
                    onClick={() => removeQuestion(questionIndex)}
                    disabled={questions.length === 1}
                  >
                    <span>🗑️</span>
                  </button>
                </div>
              </div>
              
              <div className="mb-4">
                <Label className="block text-sm font-medium text-gray-700 mb-1">Question Text</Label>
                <Textarea
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none"
                  rows={2}
                  value={question.text}
                  onChange={(e) => handleQuestionTextChange(questionIndex, e.target.value)}
                  placeholder="Enter your question"
                />
              </div>
              
              {/* Options */}
              <div className="space-y-3 mb-4">
                <Label className="block text-sm font-medium text-gray-700">Options (select correct answer)</Label>
                
                <RadioGroup
                  value={question.options.find(opt => opt.isCorrect)?.id.toString() || ''}
                  onValueChange={(value) => handleCorrectOptionChange(questionIndex, parseInt(value))}
                >
                  {question.options.map((option, optionIndex) => (
                    <div key={optionIndex} className="flex items-center gap-2">
                      <RadioGroupItem
                        id={`q${questionIndex}-option${optionIndex}`}
                        value={option.id.toString()}
                        className="w-4 h-4 text-[#00FF88] focus:ring-[#00FF88]"
                      />
                      <Input
                        type="text"
                        className="flex-1 p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#00FF88] focus:border-[#00FF88] outline-none"
                        value={option.text}
                        onChange={(e) => handleOptionTextChange(questionIndex, optionIndex, e.target.value)}
                        placeholder={`Option ${optionIndex + 1}`}
                      />
                    </div>
                  ))}
                </RadioGroup>
              </div>
              
              <Button
                variant="link"
                className="text-sm text-[#00FF88] hover:underline flex items-center"
              >
                <span className="mr-1">⚙️</span> Advanced Options
              </Button>
            </div>
          ))}
          
          {/* Add Question Button */}
          <Button
            className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 hover:border-[#00FF88] hover:text-[#00FF88] flex items-center justify-center"
            variant="ghost"
            onClick={addQuestion}
          >
            <span className="mr-2">➕</span> Add New Question
          </Button>
        </div>
      </div>
    </div>
  );
};

export default QuizEditor;
