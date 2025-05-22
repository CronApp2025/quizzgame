import { QuizOption } from '@shared/schema';

// Function to generate a random quiz code
export const generateQuizCode = (): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters
  let code = '';
  
  // Generate a 6-character random code
  for (let i = 0; i < 6; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters.charAt(randomIndex);
  }
  
  return code;
};

// Function to calculate score based on response time and correctness
export const calculateScore = (isCorrect: boolean, responseTimeMs: number): number => {
  if (!isCorrect) return 0;
  
  // Base points for correct answer
  let score = 100;
  
  // Bonus points for quick answers
  // Up to 50 bonus points if answered in less than 5 seconds (5000ms)
  if (responseTimeMs < 5000) {
    score += 50;
  } else if (responseTimeMs < 10000) {
    // Linear bonus from 0 to 50 points based on time
    score += Math.floor(50 * (1 - (responseTimeMs - 5000) / 5000));
  }
  
  return score;
};

// Function to find the correct option from a list of options
export const findCorrectOption = (options: QuizOption[]): QuizOption | undefined => {
  return options.find(option => option.isCorrect);
};

// Function to format time in seconds to a readable format
export const formatTime = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds}s`;
  }
  
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

// Function to shuffle an array (for randomizing question order if needed)
export const shuffleArray = <T>(array: T[]): T[] => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

// Function to get leaderboard position suffix (1st, 2nd, 3rd, etc.)
export const getPositionSuffix = (position: number): string => {
  if (position >= 11 && position <= 13) {
    return `${position}th`;
  }
  
  switch (position % 10) {
    case 1: return `${position}st`;
    case 2: return `${position}nd`;
    case 3: return `${position}rd`;
    default: return `${position}th`;
  }
};
