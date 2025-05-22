import { useState, useEffect } from 'react';
import { useLocation, useSearch } from 'wouter';
import UserLogin from '@/components/UserLogin';

const JoinPage = () => {
  const [, navigate] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const quizCode = params.get('code') || '';

  const handleJoin = (participantId: number, quizId: number) => {
    // Store participant info in session storage
    sessionStorage.setItem('quizParticipant', JSON.stringify({
      id: participantId,
      quizId: quizId
    }));
    
    // Navigate to the play page
    navigate('/play');
  };

  return (
    <UserLogin 
      initialCode={quizCode} 
      onJoin={handleJoin}
    />
  );
};

export default JoinPage;
