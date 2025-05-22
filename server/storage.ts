import { 
  Admin, InsertAdmin, 
  Quiz, InsertQuiz, 
  Question, InsertQuestion, 
  Participant, InsertParticipant, 
  Answer, InsertAnswer, 
  QuizOption, QuizStatus,
  admins, quizzes, questions, participants, answers
} from "@shared/schema";
import crypto from 'crypto';
import { eq, and, desc } from 'drizzle-orm';
import { db } from './db';

// Storage interface
export interface IStorage {
  // Admin methods
  getAdmin(id: number): Promise<Admin | undefined>;
  getAdminByUsername(username: string): Promise<Admin | undefined>;
  createAdmin(admin: InsertAdmin): Promise<Admin>;
  
  // Quiz methods
  getQuiz(id: number): Promise<Quiz | undefined>;
  getQuizByCode(code: string): Promise<Quiz | undefined>;
  getQuizzesByAdmin(adminId: number): Promise<Quiz[]>;
  createQuiz(quiz: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: number, quiz: Partial<Quiz>): Promise<Quiz | undefined>;
  deleteQuiz(id: number): Promise<boolean>;
  
  // Question methods
  getQuestion(id: number): Promise<Question | undefined>;
  getQuestionsByQuiz(quizId: number): Promise<Question[]>;
  createQuestion(question: InsertQuestion): Promise<Question>;
  updateQuestion(id: number, question: Partial<Question>): Promise<Question | undefined>;
  deleteQuestion(id: number): Promise<boolean>;
  
  // Participant methods
  getParticipant(id: number): Promise<Participant | undefined>;
  getParticipantsByQuiz(quizId: number): Promise<Participant[]>;
  createParticipant(participant: InsertParticipant): Promise<Participant>;
  updateParticipant(id: number, participant: Partial<Participant>): Promise<Participant | undefined>;
  
  // Answer methods
  getAnswer(id: number): Promise<Answer | undefined>;
  getAnswersByParticipant(participantId: number): Promise<Answer[]>;
  getAnswersByQuestion(questionId: number): Promise<Answer[]>;
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  
  // Special methods
  getLeaderboard(quizId: number): Promise<Participant[]>;
  generateQuizCode(): Promise<string>;
}

export class MemStorage implements IStorage {
  private admins: Map<number, Admin>;
  private quizzes: Map<number, Quiz>;
  private questions: Map<number, Question>;
  private participants: Map<number, Participant>;
  private answers: Map<number, Answer>;
  
  private adminId: number;
  private quizId: number;
  private questionId: number;
  private participantId: number;
  private answerId: number;
  
  constructor() {
    this.admins = new Map();
    this.quizzes = new Map();
    this.questions = new Map();
    this.participants = new Map();
    this.answers = new Map();
    
    this.adminId = 1;
    this.quizId = 1;
    this.questionId = 1;
    this.participantId = 1;
    this.answerId = 1;
    
    // Add a default admin user
    this.createAdmin({
      username: 'admin',
      password: 'password'
    });
    
    // Add a sample quiz for testing
    const adminId = 1;
    this.createQuiz({
      adminId,
      title: 'Geography Quiz',
      timePerQuestion: 15,
      status: QuizStatus.ACTIVE,
      code: 'GEO123'
    }).then(quiz => {
      // Add sample questions
      this.createQuestion({
        quizId: quiz.id,
        text: 'What is the capital of France?',
        options: [
          { id: 0, text: 'Paris', isCorrect: true },
          { id: 1, text: 'London', isCorrect: false },
          { id: 2, text: 'Berlin', isCorrect: false },
          { id: 3, text: 'Madrid', isCorrect: false }
        ],
        order: 0
      });
      
      this.createQuestion({
        quizId: quiz.id,
        text: 'Which river is the longest in the world?',
        options: [
          { id: 0, text: 'Amazon', isCorrect: false },
          { id: 1, text: 'Nile', isCorrect: true },
          { id: 2, text: 'Mississippi', isCorrect: false },
          { id: 3, text: 'Yangtze', isCorrect: false }
        ],
        order: 1
      });
    });
  }
  
  // Admin methods
  async getAdmin(id: number): Promise<Admin | undefined> {
    return this.admins.get(id);
  }
  
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    return Array.from(this.admins.values()).find(
      (admin) => admin.username === username
    );
  }
  
  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const id = this.adminId++;
    const newAdmin: Admin = { ...admin, id };
    this.admins.set(id, newAdmin);
    return newAdmin;
  }
  
  // Quiz methods
  async getQuiz(id: number): Promise<Quiz | undefined> {
    return this.quizzes.get(id);
  }
  
  async getQuizByCode(code: string): Promise<Quiz | undefined> {
    return Array.from(this.quizzes.values()).find(
      (quiz) => quiz.code === code
    );
  }
  
  async getQuizzesByAdmin(adminId: number): Promise<Quiz[]> {
    return Array.from(this.quizzes.values()).filter(
      (quiz) => quiz.adminId === adminId
    );
  }
  
  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    const id = this.quizId++;
    const createdAt = new Date();
    const newQuiz: Quiz = { 
      ...quiz, 
      id, 
      createdAt,
      timePerQuestion: quiz.timePerQuestion || 15,
      status: quiz.status || 'draft'
    };
    this.quizzes.set(id, newQuiz);
    return newQuiz;
  }
  
  async updateQuiz(id: number, quiz: Partial<Quiz>): Promise<Quiz | undefined> {
    const existingQuiz = this.quizzes.get(id);
    
    if (!existingQuiz) {
      return undefined;
    }
    
    const updatedQuiz: Quiz = { ...existingQuiz, ...quiz };
    this.quizzes.set(id, updatedQuiz);
    return updatedQuiz;
  }
  
  async deleteQuiz(id: number): Promise<boolean> {
    // Delete all related questions, participants, and answers first
    const questions = await this.getQuestionsByQuiz(id);
    for (const question of questions) {
      await this.deleteQuestion(question.id);
    }
    
    const participants = await this.getParticipantsByQuiz(id);
    for (const participant of participants) {
      // Delete all answers by this participant
      const answers = await this.getAnswersByParticipant(participant.id);
      for (const answer of answers) {
        this.answers.delete(answer.id);
      }
      this.participants.delete(participant.id);
    }
    
    return this.quizzes.delete(id);
  }
  
  // Question methods
  async getQuestion(id: number): Promise<Question | undefined> {
    return this.questions.get(id);
  }
  
  async getQuestionsByQuiz(quizId: number): Promise<Question[]> {
    return Array.from(this.questions.values())
      .filter((question) => question.quizId === quizId)
      .sort((a, b) => a.order - b.order);
  }
  
  async createQuestion(question: InsertQuestion): Promise<Question> {
    const id = this.questionId++;
    const newQuestion: Question = { ...question, id };
    this.questions.set(id, newQuestion);
    return newQuestion;
  }
  
  async updateQuestion(id: number, question: Partial<Question>): Promise<Question | undefined> {
    const existingQuestion = this.questions.get(id);
    
    if (!existingQuestion) {
      return undefined;
    }
    
    const updatedQuestion: Question = { ...existingQuestion, ...question };
    this.questions.set(id, updatedQuestion);
    return updatedQuestion;
  }
  
  async deleteQuestion(id: number): Promise<boolean> {
    // Delete all answers related to this question
    const answers = await this.getAnswersByQuestion(id);
    for (const answer of answers) {
      this.answers.delete(answer.id);
    }
    
    return this.questions.delete(id);
  }
  
  // Participant methods
  async getParticipant(id: number): Promise<Participant | undefined> {
    return this.participants.get(id);
  }
  
  async getParticipantsByQuiz(quizId: number): Promise<Participant[]> {
    return Array.from(this.participants.values()).filter(
      (participant) => participant.quizId === quizId
    );
  }
  
  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const id = this.participantId++;
    const joinedAt = new Date();
    const newParticipant: Participant = { 
      ...participant, 
      id, 
      joinedAt,
      score: participant.score ?? 0
    };
    this.participants.set(id, newParticipant);
    return newParticipant;
  }
  
  async updateParticipant(id: number, participant: Partial<Participant>): Promise<Participant | undefined> {
    const existingParticipant = this.participants.get(id);
    
    if (!existingParticipant) {
      return undefined;
    }
    
    const updatedParticipant: Participant = { ...existingParticipant, ...participant };
    this.participants.set(id, updatedParticipant);
    return updatedParticipant;
  }
  
  // Answer methods
  async getAnswer(id: number): Promise<Answer | undefined> {
    return this.answers.get(id);
  }
  
  async getAnswersByParticipant(participantId: number): Promise<Answer[]> {
    return Array.from(this.answers.values()).filter(
      (answer) => answer.participantId === participantId
    );
  }
  
  async getAnswersByQuestion(questionId: number): Promise<Answer[]> {
    return Array.from(this.answers.values()).filter(
      (answer) => answer.questionId === questionId
    );
  }
  
  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const id = this.answerId++;
    const newAnswer: Answer = { ...answer, id };
    this.answers.set(id, newAnswer);
    
    // Update participant score
    const participant = await this.getParticipant(answer.participantId);
    if (participant) {
      const updatedScore = participant.score + answer.score;
      await this.updateParticipant(participant.id, { score: updatedScore });
    }
    
    return newAnswer;
  }
  
  // Special methods
  async getLeaderboard(quizId: number): Promise<Participant[]> {
    const participants = await this.getParticipantsByQuiz(quizId);
    return participants.sort((a, b) => b.score - a.score);
  }
  
  async generateQuizCode(): Promise<string> {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters
    let code = '';
    
    // Generate a 6-character random code
    for (let i = 0; i < 6; i++) {
      const randomIndex = crypto.randomInt(0, characters.length);
      code += characters.charAt(randomIndex);
    }
    
    // Check if the code already exists, regenerate if needed
    const existingQuiz = await this.getQuizByCode(code);
    if (existingQuiz) {
      return this.generateQuizCode();
    }
    
    return code;
  }
}

// Database implementation
import { eq, and, desc } from 'drizzle-orm';
import { db } from './db';

export class DatabaseStorage implements IStorage {
  // Admin methods
  async getAdmin(id: number): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.id, id));
    return admin;
  }
  
  async getAdminByUsername(username: string): Promise<Admin | undefined> {
    const [admin] = await db.select().from(admins).where(eq(admins.username, username));
    return admin;
  }
  
  async createAdmin(admin: InsertAdmin): Promise<Admin> {
    const [newAdmin] = await db.insert(admins).values(admin).returning();
    return newAdmin;
  }
  
  // Quiz methods
  async getQuiz(id: number): Promise<Quiz | undefined> {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return quiz;
  }
  
  async getQuizByCode(code: string): Promise<Quiz | undefined> {
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.code, code));
    return quiz;
  }
  
  async getQuizzesByAdmin(adminId: number): Promise<Quiz[]> {
    return db.select().from(quizzes).where(eq(quizzes.adminId, adminId));
  }
  
  async createQuiz(quiz: InsertQuiz): Promise<Quiz> {
    const [newQuiz] = await db.insert(quizzes).values(quiz).returning();
    return newQuiz;
  }
  
  async updateQuiz(id: number, quiz: Partial<Quiz>): Promise<Quiz | undefined> {
    const [updatedQuiz] = await db.update(quizzes)
      .set(quiz)
      .where(eq(quizzes.id, id))
      .returning();
    return updatedQuiz;
  }
  
  async deleteQuiz(id: number): Promise<boolean> {
    // Delete all related questions, participants, and answers first
    const questions = await this.getQuestionsByQuiz(id);
    for (const question of questions) {
      await this.deleteQuestion(question.id);
    }
    
    const participants = await this.getParticipantsByQuiz(id);
    for (const participant of participants) {
      // Delete all answers by this participant
      const answers = await this.getAnswersByParticipant(participant.id);
      for (const answer of answers) {
        await db.delete(answers).where(eq(answers.id, answer.id));
      }
      await db.delete(participants).where(eq(participants.id, participant.id));
    }
    
    const result = await db.delete(quizzes).where(eq(quizzes.id, id)).returning();
    return result.length > 0;
  }
  
  // Question methods
  async getQuestion(id: number): Promise<Question | undefined> {
    const [question] = await db.select().from(questions).where(eq(questions.id, id));
    return question;
  }
  
  async getQuestionsByQuiz(quizId: number): Promise<Question[]> {
    return db.select()
      .from(questions)
      .where(eq(questions.quizId, quizId))
      .orderBy(questions.order);
  }
  
  async createQuestion(question: InsertQuestion): Promise<Question> {
    const [newQuestion] = await db.insert(questions).values(question).returning();
    return newQuestion;
  }
  
  async updateQuestion(id: number, question: Partial<Question>): Promise<Question | undefined> {
    const [updatedQuestion] = await db.update(questions)
      .set(question)
      .where(eq(questions.id, id))
      .returning();
    return updatedQuestion;
  }
  
  async deleteQuestion(id: number): Promise<boolean> {
    // Delete all answers related to this question
    const answers = await this.getAnswersByQuestion(id);
    for (const answer of answers) {
      await db.delete(answers).where(eq(answers.id, answer.id));
    }
    
    const result = await db.delete(questions).where(eq(questions.id, id)).returning();
    return result.length > 0;
  }
  
  // Participant methods
  async getParticipant(id: number): Promise<Participant | undefined> {
    const [participant] = await db.select().from(participants).where(eq(participants.id, id));
    return participant;
  }
  
  async getParticipantsByQuiz(quizId: number): Promise<Participant[]> {
    return db.select().from(participants).where(eq(participants.quizId, quizId));
  }
  
  async createParticipant(participant: InsertParticipant): Promise<Participant> {
    const [newParticipant] = await db.insert(participants).values(participant).returning();
    return newParticipant;
  }
  
  async updateParticipant(id: number, participant: Partial<Participant>): Promise<Participant | undefined> {
    const [updatedParticipant] = await db.update(participants)
      .set(participant)
      .where(eq(participants.id, id))
      .returning();
    return updatedParticipant;
  }
  
  // Answer methods
  async getAnswer(id: number): Promise<Answer | undefined> {
    const [answer] = await db.select().from(answers).where(eq(answers.id, id));
    return answer;
  }
  
  async getAnswersByParticipant(participantId: number): Promise<Answer[]> {
    return db.select().from(answers).where(eq(answers.participantId, participantId));
  }
  
  async getAnswersByQuestion(questionId: number): Promise<Answer[]> {
    return db.select().from(answers).where(eq(answers.questionId, questionId));
  }
  
  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const [newAnswer] = await db.insert(answers).values(answer).returning();
    
    // Update participant score
    const participant = await this.getParticipant(answer.participantId);
    if (participant) {
      const updatedScore = participant.score + answer.score;
      await this.updateParticipant(participant.id, { score: updatedScore });
    }
    
    return newAnswer;
  }
  
  // Special methods
  async getLeaderboard(quizId: number): Promise<Participant[]> {
    return db.select()
      .from(participants)
      .where(eq(participants.quizId, quizId))
      .orderBy(desc(participants.score));
  }
  
  async generateQuizCode(): Promise<string> {
    const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar-looking characters
    let code = '';
    
    // Generate a 6-character random code
    for (let i = 0; i < 6; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters.charAt(randomIndex);
    }
    
    // Check if the code already exists, regenerate if needed
    const existingQuiz = await this.getQuizByCode(code);
    if (existingQuiz) {
      return this.generateQuizCode();
    }
    
    return code;
  }
}

// Use the database storage implementation
export const storage = new DatabaseStorage();
