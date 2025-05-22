import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  insertAdminSchema, insertQuizSchema, insertQuestionSchema,
  insertParticipantSchema, insertAnswerSchema,
  QuizStatus
} from "@shared/schema";
import { randomUUID } from "crypto";

// WebSocket event types
enum WSEventType {
  JOIN_QUIZ = "JOIN_QUIZ",
  QUIZ_STARTED = "QUIZ_STARTED",
  NEW_QUESTION = "NEW_QUESTION",
  SUBMIT_ANSWER = "SUBMIT_ANSWER",
  QUESTION_ENDED = "QUESTION_ENDED",
  QUIZ_ENDED = "QUIZ_ENDED",
  LEADERBOARD_UPDATE = "LEADERBOARD_UPDATE",
  ERROR = "ERROR",
  PLAYER_JOINED = "PLAYER_JOINED",
}

// WebSocket connection management
interface WsClient {
  id: string;
  ws: WebSocket;
  quizId?: number;
  participantId?: number;
  isAdmin?: boolean;
  adminId?: number;
}

// Active quiz session management
interface ActiveQuiz {
  quizId: number;
  currentQuestionId?: number;
  startTime?: Date;
  questionStartTime?: Date;
  adminWsId?: string;
  status: "waiting" | "question_active" | "question_ended" | "ended";
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // Set up WebSocket server
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  
  // Store client connections and active quizzes
  const clients = new Map<string, WsClient>();
  const activeQuizzes = new Map<number, ActiveQuiz>();
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    const clientId = randomUUID();
    clients.set(clientId, { id: clientId, ws });
    
    // Send client ID to the connected client
    ws.send(JSON.stringify({
      type: 'CLIENT_ID',
      clientId
    }));
    
    ws.on('message', async (messageData) => {
      try {
        const message = JSON.parse(messageData.toString());
        const eventType = message.type;
        const client = clients.get(clientId);
        
        if (!client) {
          return;
        }
        
        // Handle special testing messages
        if (eventType === 'GET_CLIENT_ID') {
          sendToClient(client, {
            type: 'CLIENT_ID',
            clientId: client.id
          });
          return;
        }
        
        if (eventType === 'PING') {
          sendToClient(client, {
            type: 'PONG',
            data: { 
              receivedAt: new Date().toISOString(),
              ...message.data
            }
          });
          return;
        }
        
        switch (eventType) {
          case WSEventType.JOIN_QUIZ: {
            // User joining a quiz
            const { quizCode, alias } = message.data;
            
            // Find the quiz
            const quiz = await storage.getQuizByCode(quizCode);
            if (!quiz) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Quiz not found" }
              });
              return;
            }
            
            // Create a participant
            const participant = await storage.createParticipant({
              quizId: quiz.id,
              alias,
              score: 0
            });
            
            // Update client info
            client.quizId = quiz.id;
            client.participantId = participant.id;
            clients.set(clientId, client);
            
            // Initialize active quiz if it doesn't exist
            if (!activeQuizzes.has(quiz.id)) {
              activeQuizzes.set(quiz.id, {
                quizId: quiz.id,
                status: "waiting"
              });
            }
            
            // Send confirmation to user
            sendToClient(client, {
              type: WSEventType.JOIN_QUIZ,
              data: {
                quizId: quiz.id,
                participantId: participant.id,
                title: quiz.title
              }
            });
            
            // Notify admin that a player has joined
            const activeQuiz = activeQuizzes.get(quiz.id);
            if (activeQuiz && activeQuiz.adminWsId) {
              const adminClient = Array.from(clients.values()).find(c => c.id === activeQuiz.adminWsId);
              if (adminClient) {
                sendToClient(adminClient, {
                  type: WSEventType.PLAYER_JOINED,
                  data: {
                    participant
                  }
                });
              }
            }
            
            break;
          }
          
          case WSEventType.QUIZ_STARTED: {
            // Admin starting a quiz
            if (!client.isAdmin || !client.quizId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Unauthorized" }
              });
              return;
            }
            
            const quizId = client.quizId;
            const quiz = await storage.getQuiz(quizId);
            
            if (!quiz) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Quiz not found" }
              });
              return;
            }
            
            // Update quiz status
            await storage.updateQuiz(quizId, { status: QuizStatus.ACTIVE });
            
            // Set up active quiz
            const activeQuiz: ActiveQuiz = {
              quizId,
              startTime: new Date(),
              adminWsId: clientId,
              status: "waiting"
            };
            activeQuizzes.set(quizId, activeQuiz);
            
            // Notify all participants the quiz is starting
            broadcastToQuiz(quizId, {
              type: WSEventType.QUIZ_STARTED,
              data: { quizId }
            });
            
            break;
          }
          
          case WSEventType.NEW_QUESTION: {
            // Admin sending a new question
            if (!client.isAdmin || !client.quizId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Unauthorized" }
              });
              return;
            }
            
            const { questionId } = message.data;
            const quizId = client.quizId;
            const question = await storage.getQuestion(questionId);
            
            if (!question || question.quizId !== quizId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Question not found" }
              });
              return;
            }
            
            // Update active quiz with current question
            const activeQuiz = activeQuizzes.get(quizId) || {
              quizId,
              adminWsId: clientId,
              status: "waiting"
            };
            
            activeQuiz.currentQuestionId = questionId;
            activeQuiz.questionStartTime = new Date();
            activeQuiz.status = "question_active";
            activeQuizzes.set(quizId, activeQuiz);
            
            // Send question to all participants (without the correct answer)
            const quiz = await storage.getQuiz(quizId);
            const questionOptions = question.options as any[];
            const sanitizedOptions = questionOptions.map(opt => ({
              id: opt.id,
              text: opt.text
            }));
            
            broadcastToQuiz(quizId, {
              type: WSEventType.NEW_QUESTION,
              data: {
                questionId,
                questionText: question.text,
                options: sanitizedOptions,
                timeLimit: quiz?.timePerQuestion || 15
              }
            });
            
            break;
          }
          
          case WSEventType.SUBMIT_ANSWER: {
            // Participant submitting an answer
            if (!client.participantId || !client.quizId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Not in a quiz" }
              });
              return;
            }
            
            const { questionId, optionId, responseTime } = message.data;
            const quizId = client.quizId;
            const participantId = client.participantId;
            
            const activeQuiz = activeQuizzes.get(quizId);
            if (!activeQuiz || activeQuiz.currentQuestionId !== questionId || activeQuiz.status !== "question_active") {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Question is not active" }
              });
              return;
            }
            
            const question = await storage.getQuestion(questionId);
            if (!question) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Question not found" }
              });
              return;
            }
            
            // Determine if answer is correct
            const options = question.options as any[];
            const selectedOption = options.find(opt => opt.id === optionId);
            const isCorrect = selectedOption?.isCorrect || false;
            
            // Calculate score - base 100 points for correct answer + time bonus (max 50 points)
            let score = 0;
            if (isCorrect) {
              score = 100; // Base score
              
              // Add time bonus - faster answers get more points (up to 50 points if answered in under 5 seconds)
              if (responseTime < 5000) {
                score += 50;
              } else if (responseTime < 10000) {
                // Linear bonus from 0 to 50 points based on time
                score += Math.floor(50 * (1 - (responseTime - 5000) / 5000));
              }
            }
            
            // Save the answer
            const answer = await storage.createAnswer({
              participantId,
              questionId,
              selectedOption: optionId,
              isCorrect,
              responseTime,
              score
            });
            
            // Send response to the participant
            sendToClient(client, {
              type: WSEventType.SUBMIT_ANSWER,
              data: {
                answerId: answer.id,
                isCorrect,
                score,
                correctOptionId: options.find(opt => opt.isCorrect)?.id
              }
            });
            
            // Update leaderboard for admin
            const leaderboard = await storage.getLeaderboard(quizId);
            
            // Find admin client
            if (activeQuiz.adminWsId) {
              const adminClient = Array.from(clients.values()).find(c => c.id === activeQuiz.adminWsId);
              if (adminClient) {
                sendToClient(adminClient, {
                  type: WSEventType.LEADERBOARD_UPDATE,
                  data: { leaderboard }
                });
              }
            }
            
            break;
          }
          
          case WSEventType.QUESTION_ENDED: {
            // Admin ending the current question
            if (!client.isAdmin || !client.quizId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Unauthorized" }
              });
              return;
            }
            
            const quizId = client.quizId;
            const activeQuiz = activeQuizzes.get(quizId);
            
            if (!activeQuiz || !activeQuiz.currentQuestionId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "No active question" }
              });
              return;
            }
            
            const questionId = activeQuiz.currentQuestionId;
            const question = await storage.getQuestion(questionId);
            
            if (!question) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Question not found" }
              });
              return;
            }
            
            // Update active quiz status
            activeQuiz.status = "question_ended";
            activeQuizzes.set(quizId, activeQuiz);
            
            // Get answer statistics
            const answers = await storage.getAnswersByQuestion(questionId);
            const options = question.options as any[];
            
            // Calculate option percentages
            const optionStats = options.map(opt => {
              const optionAnswers = answers.filter(a => a.selectedOption === opt.id);
              const percentage = answers.length > 0 ? (optionAnswers.length / answers.length) * 100 : 0;
              
              return {
                optionId: opt.id,
                text: opt.text,
                isCorrect: opt.isCorrect,
                percentage,
                count: optionAnswers.length
              };
            });
            
            // Update leaderboard
            const leaderboard = await storage.getLeaderboard(quizId);
            
            // Broadcast question results to all participants
            broadcastToQuiz(quizId, {
              type: WSEventType.QUESTION_ENDED,
              data: {
                questionId,
                questionText: question.text,
                options: optionStats,
                leaderboard: leaderboard.slice(0, 5) // Top 5 for participants
              }
            });
            
            break;
          }
          
          case WSEventType.QUIZ_ENDED: {
            // Admin ending the entire quiz
            if (!client.isAdmin || !client.quizId) {
              sendToClient(client, {
                type: WSEventType.ERROR,
                data: { message: "Unauthorized" }
              });
              return;
            }
            
            const quizId = client.quizId;
            
            // Update quiz status
            await storage.updateQuiz(quizId, { status: QuizStatus.COMPLETED });
            
            // Update active quiz
            const activeQuiz = activeQuizzes.get(quizId);
            if (activeQuiz) {
              activeQuiz.status = "ended";
              activeQuizzes.set(quizId, activeQuiz);
            }
            
            // Get final leaderboard
            const leaderboard = await storage.getLeaderboard(quizId);
            
            // Broadcast quiz end to all participants
            broadcastToQuiz(quizId, {
              type: WSEventType.QUIZ_ENDED,
              data: {
                quizId,
                leaderboard
              }
            });
            
            break;
          }
          
          default:
            console.log(`Unknown event type: ${eventType}`);
        }
      } catch (error) {
        console.error("WebSocket message error:", error);
      }
    });
    
    ws.on('close', () => {
      const client = clients.get(clientId);
      
      // If client was an admin hosting a quiz, update the active quiz
      if (client?.isAdmin && client.quizId) {
        const activeQuiz = activeQuizzes.get(client.quizId);
        if (activeQuiz && activeQuiz.adminWsId === clientId) {
          activeQuiz.adminWsId = undefined;
          activeQuizzes.set(client.quizId, activeQuiz);
        }
      }
      
      clients.delete(clientId);
    });
  });
  
  // Helper function to send message to a specific client
  function sendToClient(client: WsClient, data: any) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(data));
    }
  }
  
  // Helper function to broadcast to all participants in a quiz
  function broadcastToQuiz(quizId: number, data: any, excludeAdmin: boolean = false) {
    Array.from(clients.values()).forEach(client => {
      if (client.quizId === quizId) {
        if (excludeAdmin && client.isAdmin) {
          return;
        }
        sendToClient(client, data);
      }
    });
  }
  
  // API Routes
  
  // Admin authentication
  app.post('/api/admin/login', async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }
      
      const admin = await storage.getAdminByUsername(username);
      
      if (!admin || admin.password !== password) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }
      
      // Send admin info without password
      const { password: _, ...adminData } = admin;
      res.json({ admin: adminData });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Quiz CRUD operations
  app.get('/api/quizzes', async (req: Request, res: Response) => {
    try {
      const adminId = Number(req.query.adminId);
      
      if (!adminId || isNaN(adminId)) {
        return res.status(400).json({ message: 'Admin ID is required' });
      }
      
      const quizzes = await storage.getQuizzesByAdmin(adminId);
      res.json({ quizzes });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.get('/api/quizzes/:id', async (req: Request, res: Response) => {
    try {
      const quizId = Number(req.params.id);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }
      
      const quiz = await storage.getQuiz(quizId);
      
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
      
      res.json({ quiz });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.post('/api/quizzes', async (req: Request, res: Response) => {
    try {
      const quizData = insertQuizSchema.parse(req.body);
      
      // Generate a unique code for the quiz
      const code = await storage.generateQuizCode();
      
      // Create the quiz
      const quiz = await storage.createQuiz({
        ...quizData,
        code
      });
      
      res.status(201).json({ quiz });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Server error' });
      }
    }
  });
  
  app.put('/api/quizzes/:id', async (req: Request, res: Response) => {
    try {
      const quizId = Number(req.params.id);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }
      
      const quizData = req.body;
      const quiz = await storage.updateQuiz(quizId, quizData);
      
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
      
      res.json({ quiz });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.delete('/api/quizzes/:id', async (req: Request, res: Response) => {
    try {
      const quizId = Number(req.params.id);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }
      
      const success = await storage.deleteQuiz(quizId);
      
      if (!success) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Question operations
  app.get('/api/quizzes/:quizId/questions', async (req: Request, res: Response) => {
    try {
      const quizId = Number(req.params.quizId);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }
      
      const questions = await storage.getQuestionsByQuiz(quizId);
      res.json({ questions });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.post('/api/questions', async (req: Request, res: Response) => {
    try {
      const questionData = insertQuestionSchema.parse(req.body);
      const question = await storage.createQuestion(questionData);
      
      res.status(201).json({ question });
    } catch (error) {
      if (error instanceof Error) {
        res.status(400).json({ message: error.message });
      } else {
        res.status(500).json({ message: 'Server error' });
      }
    }
  });
  
  app.put('/api/questions/:id', async (req: Request, res: Response) => {
    try {
      const questionId = Number(req.params.id);
      
      if (isNaN(questionId)) {
        return res.status(400).json({ message: 'Invalid question ID' });
      }
      
      const questionData = req.body;
      const question = await storage.updateQuestion(questionId, questionData);
      
      if (!question) {
        return res.status(404).json({ message: 'Question not found' });
      }
      
      res.json({ question });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  app.delete('/api/questions/:id', async (req: Request, res: Response) => {
    try {
      const questionId = Number(req.params.id);
      
      if (isNaN(questionId)) {
        return res.status(400).json({ message: 'Invalid question ID' });
      }
      
      const success = await storage.deleteQuestion(questionId);
      
      if (!success) {
        return res.status(404).json({ message: 'Question not found' });
      }
      
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Generate QR code for a quiz
  app.get('/api/quizzes/:id/qrcode', async (req: Request, res: Response) => {
    try {
      const quizId = Number(req.params.id);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }
      
      const quiz = await storage.getQuiz(quizId);
      
      if (!quiz) {
        return res.status(404).json({ message: 'Quiz not found' });
      }
      
      // We'll generate the QR on the client side, just return the code
      res.json({ code: quiz.code });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Get leaderboard for a quiz
  app.get('/api/quizzes/:id/leaderboard', async (req: Request, res: Response) => {
    try {
      const quizId = Number(req.params.id);
      
      if (isNaN(quizId)) {
        return res.status(400).json({ message: 'Invalid quiz ID' });
      }
      
      const leaderboard = await storage.getLeaderboard(quizId);
      res.json({ leaderboard });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  // Connect to WebSocket as admin for a quiz
  app.post('/api/admin/connect', async (req: Request, res: Response) => {
    try {
      const { adminId, quizId, wsClientId } = req.body;
      
      if (!adminId || !quizId || !wsClientId) {
        return res.status(400).json({ message: 'Admin ID, Quiz ID, and WebSocket Client ID are required' });
      }
      
      // Validate admin exists
      const admin = await storage.getAdmin(adminId);
      if (!admin) {
        return res.status(404).json({ message: 'Admin not found' });
      }
      
      // Validate quiz exists and belongs to admin
      const quiz = await storage.getQuiz(quizId);
      if (!quiz || quiz.adminId !== adminId) {
        return res.status(404).json({ message: 'Quiz not found or unauthorized' });
      }
      
      // Update client connection
      const client = clients.get(wsClientId);
      if (!client) {
        return res.status(404).json({ message: 'WebSocket connection not found' });
      }
      
      // Update client info
      client.isAdmin = true;
      client.adminId = adminId;
      client.quizId = quizId;
      clients.set(wsClientId, client);
      
      // Initialize or update active quiz
      let activeQuiz = activeQuizzes.get(quizId);
      if (!activeQuiz) {
        activeQuiz = {
          quizId,
          status: "waiting",
          adminWsId: wsClientId
        };
      } else {
        activeQuiz.adminWsId = wsClientId;
      }
      activeQuizzes.set(quizId, activeQuiz);
      
      // Get participant count
      const participants = await storage.getParticipantsByQuiz(quizId);
      
      res.json({ 
        success: true, 
        participantCount: participants.length,
        quiz
      });
    } catch (error) {
      res.status(500).json({ message: 'Server error' });
    }
  });
  
  return httpServer;
}
