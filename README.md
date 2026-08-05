# SAIL Backend

SAIL is a meeting intelligence backend that helps teams capture meeting content, derive actionable insights, and connect those insights with calendar, task, and AI workflows.

This repository contains the Express-based backend service that powers user authentication, meeting processing, Google/Jira integrations, background task execution, and AI-assisted meeting outputs.

Frontend repository: https://github.com/NishantAsnani/SAIL_FE

## Project Overview

The backend is designed to support the full meeting workflow:

- User sign-up, login, and profile management
- Google Calendar authentication and event retrieval
- Meeting upload and processing
- AI-generated chat responses and meeting summaries
- Jira ticket creation based on meeting outcomes
- Meeting metrics, tasks, and structured meeting data storage
- Background queue processing with Redis and BullMQ
- Real-time updates through Socket.IO

This repository is the backend for the SAIL platform and works with the frontend application that consumes its APIs. The frontend for this backend is hosted at https://github.com/NishantAsnani/SAIL_FE.

## Tech Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication with bcrypt
- Redis + BullMQ for background jobs
- Socket.IO for real-time communication
- Supabase for file storage and upload handling
- AssemblyAI for transcription / audio processing
- Google Generative AI for meeting intelligence
- Google Calendar API for calendar sync
- Jira API for task / issue generation
- PDFKit for PDF reporting
- New Relic for monitoring

## Core Architecture

The server entry point is [index.js](index.js), which:

1. Initializes the Express app
2. Connects to MongoDB
3. Starts the HTTP server
4. Initializes Socket.IO
5. Mounts all API routes under `/api`

The route layer is organized as follows:

- `routes/index.js` - top-level route aggregator
- `routes/api/user.routes.js` - user-related endpoints
- `routes/api/meeting.routes.js` - meeting-related endpoints

The project follows a simple layered structure:

- `controllers/` - request handlers
- `services/` - business logic and external integrations
- `models/` - MongoDB schemas
- `middleware/` - auth and request middleware
- `utils/` - reusable helpers, constants, response handlers, queue/workers

## Main Features

### Authentication and User Management

The backend allows users to:

- Sign up and log in
- Access protected endpoints using JWT
- Connect to Google and Jira via OAuth flows
- Retrieve and update profile data

### Meeting Processing

Meeting-related APIs support:

- Uploading meeting files
- Processing uploaded content for meeting insights
- Querying meeting details and meeting metrics
- Fetching action items / meeting tasks
- Downloading meeting output such as MOM PDFs

### External Integrations

This backend integrates with several external systems:

- Google Calendar for reading calendar events
- Jira for creating tickets from meeting outcomes
- Supabase for storage
- AssemblyAI and Gemini for audio / AI processing

### Background Processing

The project uses Redis-backed queues to process background work through BullMQ and worker utilities. This allows heavy operations to happen asynchronously instead of blocking the API request lifecycle.

## Project Structure

```text
be/
├── controllers/              # HTTP controller layer
├── services/                 # Core application logic
├── models/                   # MongoDB schemas
├── routes/                   # API routing
├── middleware/               # Auth and request middleware
├── utils/                    # Shared helpers, queue, socket, response utilities
├── db/                       # Database connection setup
├── seeders/                  # Seed data
├── tests/                    # Test files
├── index.js                  # App bootstrap
├── package.json              # Dependencies and scripts
└── .sample.env               # Environment variable template
```

## Environment Variables

Copy `.sample.env` to `.env` and fill in the required values.

Key variables include:

- `PORT`
- `MONGODB_URI`
- `DB_NAME`
- `JWT_SECRET`
- `FRONTEND_URL`
- `SUPABASE_SECRET_KEY`
- `SUPABASE_PROJECT_URL`
- `ASSEMBLY_AI_KEY`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `JIRA_CLIENT_ID`
- `JIRA_CLIENT_SECRET`
- `JIRA_REDIRECT_URI`
- `JIRA_AUTH_URL`
- `JIRA_TOKEN_URL`
- `GEMINI_API_KEY`
- `MODEL_NAME`
- `NEW_RELIC_LICENSE_KEY`
- `NEW_RELIC_APP_NAME`

## Local Setup

### Prerequisites

- Node.js 22 or newer
- MongoDB instance
- Redis instance
- Environment variables configured in `.env`

### Install Dependencies

```bash
npm install
```

### Run the Backend

```bash
npm start
```

By default, the app runs on:

```text
http://localhost:3000
```

## Docker Setup

A `docker-compose.yml` file is included for running the backend with supporting services.

Typical services in the stack:

- MongoDB
- Redis
- Backend containers
- NGINX

To start everything:

```bash
docker-compose up --build
```

## API Conventions

All routes are mounted under `/api`.

### Authentication

Protected endpoints require a JWT token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

### Main Route Groups

- `/api/user` - user authentication, profile, and Google/Jira sync routes
- `/api/meeting` - meeting upload, task, metrics, and MOM endpoints

## Typical Workflow

A typical end-to-end flow looks like this:

1. User signs up or logs in
2. User connects Google Calendar and/or Jira
3. Meeting file is uploaded to the backend
4. The backend processes the file and stores meeting-related data
5. AI endpoints generate summaries, metrics, or chat responses
6. Meeting tasks and outputs are returned to the frontend

## Important Notes

- The backend is configured to allow requests from the frontend at `http://localhost:5173`.
- The worker process is started through the `npm run worker` script.
- Redis and MongoDB must be available for full functionality.

## Contribution Guidelines

1. Create a feature branch
2. Keep changes scoped and well-documented
3. Update environment configuration when introducing new integrations
4. Verify API behavior before opening a pull request

## Support

For questions, issues, or feature requests, use the repository issue tracker or contact the project maintainers.


