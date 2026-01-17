# SAIL Backend

**SAIL** is an intelligent meeting assistant platform that helps teams extract actionable insights, generate summaries, and track tasks from their meetings.

## 📋 Project Overview

This is the **backend** repository for the SAIL project. It provides REST APIs for:
- User authentication and management
- Meeting information management
- Meeting metrics and analytics
- Task tracking and management
- Integration with Google Calendar and Jira

**Frontend Repository:** [https://github.com/MahekRohitGor/Innovate4_frontend]

---

## 🛠️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB (via Mongoose)
- **Authentication:** JWT (JSON Web Tokens) + Bcrypt
- **File Storage:** Supabase
- **Audio Processing:** AssemblyAI
- **AI Integration:** Google Generative AI
- **Calendar Integration:** Google Calendar API
- **Project Management:** Jira API
- **PDF Generation:** PDFKit
- **Monitoring:** New Relic
- **File Upload:** Multer

---

## 📁 Project Structure

```
be/
├── controllers/           # Request handlers
│   ├── auth.controller.js
│   ├── meeting.controllers.js
│   └── user.controller.js
├── models/               # Database schemas
│   ├── meetings.js
│   ├── meetingMetrics.js
│   ├── meetingTasks.js
│   └── users.js
├── routes/               # API routes
│   ├── api/
│   │   ├── meeting.routes.js
│   │   └── user.routes.js
│   └── index.js
├── services/             # Business logic
│   ├── auth.service.js
│   ├── meeting.service.js
│   └── user.service.js
├── middleware/           # Express middleware
│   └── auth.js           # JWT authentication
├── db/                   # Database connection
│   └── index.js
├── utils/                # Helper utilities
│   ├── constants.js
│   ├── helper.js
│   └── response.js
├── seeders/              # Sample data
│   └── data.json
├── index.js              # Application entry point
├── newrelic.js           # New Relic configuration
└── package.json
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js (v14 or higher)
- MongoDB instance
- Environment variables (see below)

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd be
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Copy `.sample.env` to `.env` and update with your credentials:
   ```bash
   cp .sample.env .env
   ```
   Then edit `.env` and add your actual API keys and secrets for:
   - MongoDB connection string
   - JWT secret
   - Google OAuth credentials
   - Supabase credentials
   - AssemblyAI API key
   - Google Generative AI key
   - Jira API token
   - New Relic license key

4. **Start the server:**
   ```bash
   npm start
   ```
   The server will run on `http://localhost:3000`

---

## 📡 API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/refresh` - Refresh JWT token

### User Management
- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile
- `DELETE /api/user/:id` - Delete user account

### Meetings
- `GET /api/meeting` - Get all meetings
- `GET /api/meeting/:id` - Get meeting details
- `POST /api/meeting` - Create a new meeting
- `PUT /api/meeting/:id` - Update meeting
- `DELETE /api/meeting/:id` - Delete meeting

### Meeting Tasks
- `GET /api/meeting/:id/tasks` - Get tasks for a meeting
- `POST /api/meeting/:id/tasks` - Create task for meeting
- `PUT /api/meeting/:id/tasks/:taskId` - Update task
- `DELETE /api/meeting/:id/tasks/:taskId` - Delete task

### Meeting Metrics
- `GET /api/meeting/:id/metrics` - Get meeting metrics
- `POST /api/meeting/:id/metrics` - Create metrics

---

## 🔐 Authentication

The API uses **JWT (JSON Web Tokens)** for authentication. Include the token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

Password hashing is handled with **bcrypt** for secure storage.

---

## 🎙️ Key Features

- **Meeting Recording & Transcription:** Integrate with AssemblyAI for audio processing
- **AI-Powered Summaries:** Uses Google Generative AI for intelligent meeting summaries
- **Calendar Integration:** Sync with Google Calendar
- **Task Management:** Track action items from meetings
- **Metrics & Analytics:** Generate insights from meeting data
- **PDF Reports:** Generate meeting summaries as PDFs
- **File Storage:** Secure file uploads via Supabase

---

## 📝 Database Models

### Users
- Email, password, profile information
- Google authentication details

### Meetings
- Meeting title, description, date/time
- Attendees, recording/transcript links
- AI-generated summary and insights

### Meeting Tasks
- Task descriptions
- Assigned to, due date, status
- Associated meeting reference

### Meeting Metrics
- Duration, participant count
- Sentiment analysis
- Key topics discussed
- Engagement metrics

---

## 🤝 Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---

## 📞 Support

For issues or questions, please open an issue on the GitHub repository.

---


