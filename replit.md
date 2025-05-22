# Quiz Application Architecture Guide

## Overview
This is a real-time quiz application with admin and user interfaces. It allows administrators to create and host interactive quizzes while users can join with a code and participate in real-time. The application uses a client-server architecture with WebSockets for real-time communication and Drizzle ORM for database interactions.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture
The application follows a full-stack architecture with these key components:

1. **Frontend**: React with Tailwind CSS, using components from shadcn/ui based on Radix UI primitives. The application uses Wouter for routing and React Query for data fetching and state management.

2. **Backend**: Node.js with Express.js server that handles HTTP API requests and provides WebSocket connections using the 'ws' library for real-time features.

3. **Database**: PostgreSQL (via Drizzle ORM) with a schema for admins, quizzes, questions, participants, and answers.

4. **WebSockets**: Used for real-time communication during quiz sessions, allowing immediate updates between hosts and participants.

The application is bundled and served using Vite, with separate build processes for the client and server code.

## Key Components

### Client-Side

1. **Pages**:
   - Admin: Login, Dashboard, Quiz Editor, Quiz Host
   - User: Join Quiz, Play Quiz (waiting, question, answer, results)
   
2. **React Query**: Manages API data fetching, caching, and mutations.

3. **Hooks**:
   - `useWebSocket`: Manages WebSocket connections
   - `useToast`: Handles toast notifications
   - `useMobile`: Detects mobile devices

4. **UI Components**: Extensive component library based on shadcn/ui (Radix UI)

### Server-Side

1. **Express Router**: Handles HTTP API endpoints for quiz management.

2. **WebSocket Server**: Manages real-time connections for quiz sessions.

3. **Storage Layer**: Implements database operations through Drizzle ORM.

### Database Schema

1. **Admins**: Store administrator credentials
2. **Quizzes**: Quiz metadata (title, time limits, status)
3. **Questions**: Quiz questions with options
4. **Participants**: Users who join quizzes
5. **Answers**: Participant responses to questions

## Data Flow

### Quiz Creation Flow
1. Admin logs in
2. Admin creates a new quiz with questions
3. Admin publishes the quiz, generating a unique join code

### Quiz Participation Flow
1. Admin starts a quiz session
2. Users join with the quiz code
3. Admin advances through questions
4. Users submit answers in real-time
5. System calculates scores based on correctness and response time
6. Leaderboard is updated and displayed

### Real-Time Communication
WebSockets handle these events:
- Player joining
- Quiz starting
- Question advancement
- Answer submission
- Question ending
- Quiz ending
- Leaderboard updates

## External Dependencies

### Frontend
- React and React DOM
- Wouter (lightweight router)
- TanStack React Query
- Radix UI components
- Tailwind CSS with class-variance-authority
- date-fns for date formatting
- QRCode library

### Backend
- Express.js
- ws (WebSocket implementation)
- Drizzle ORM
- zod for validation

## Deployment Strategy
The application uses Replit's deployment capabilities:

1. **Development**: `npm run dev` which runs both client and server in development mode with hot-reloading.

2. **Build Process**: 
   - `npm run build`: Bundles client-side code with Vite and server code with esbuild
   - Client code is built to static assets
   - Server code is bundled as a Node.js application

3. **Production**: The application runs as a Node.js process serving both the API and the static frontend assets.

4. **Database**: Currently using Drizzle ORM, likely with PostgreSQL (based on configuration in `.replit`).

The application is configured for deployment to Replit's "autoscale" target, exposing port 5000 which is mapped to the external port 80.