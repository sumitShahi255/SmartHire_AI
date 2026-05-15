# SmartHire.AI

AI-powered mock interview platform built using the MERN stack with AI-generated interview questions, real-time video interviews, voice interaction, resume-based interviews, strict interview monitoring, and detailed performance analytics.

---

# Features

* Real-time AI video interview system

* Strict interview monitoring rules

* Camera and microphone permission handling

* Tab switching detection during interviews

* Full-screen interview experience

* Auto warning system for suspicious activity

* Interview integrity tracking

* AI-generated interview questions using GROQ API

* Resume upload and analysis

* Technical and HR interview rounds

* Real-time AI voice interaction

* Speech recognition support

* AI-generated interview feedback

* Interview analytics dashboard

* Performance tracking and scoring

* JWT authentication system

* Google Authentication

* Razorpay payment integration

* Credit-based interview system

* Face detection and expression tracking

* Responsive modern UI

* Full-stack MERN architecture

---

# Tech Stack

## Frontend

* React.js
* Vite
* Tailwind CSS
* Redux Toolkit
* Framer Motion
* Axios
* React Router DOM
* Lucide React Icons

## Backend

* Node.js
* Express.js
* MongoDB
* Mongoose
* JWT Authentication

## AI & Voice Technologies

* GROQ API for AI-generated interview questions and feedback
* Web Speech API for speech recognition
* Window SpeechSynthesis API for AI voice responses
* face-api.js for face detection and expression analysis

## Payment Gateway

* Razorpay

---

# Project Structure

```text
SmartHire_AI/
│
├── client/
│   ├── public/
│   ├── src/
│   │   ├── assets/
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── Home.jsx
│   │   │   ├── Auth.jsx
│   │   │   ├── Pricing.jsx
│   │   │   ├── InterviewPage.jsx
│   │   │   ├── InterviewReport.jsx
│   │   │   └── InterviewHistory.jsx
│   │   ├── redux/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   │
│   ├── .gitignore
│   ├── eslint.config.js
│   ├── index.html
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.js
│
├── server/
│   ├── config/
│   ├── controllers/
│   ├── middlewares/
│   ├── models/
│   ├── routes/
│   ├── services/
│   ├── public/
│   │   └── snapshots/
│   │       └── .gitkeep
│   ├── index.js
│   ├── package.json
│   ├── package-lock.json
│   └── .gitignore
│
└── README.md
```

---

# Installation

## Clone Repository

```bash
git clone https://github.com/sumitShahi255/SmartHire_AI.git
```

```bash
cd SmartHire_AI
```

---

# Client Setup

```bash
cd client
```

```bash
npm install
```

```bash
npm run dev
```

Frontend runs on:

```text
http://localhost:5173
```

---

# Server Setup

Open another terminal:

```bash
cd server
```

```bash
npm install
```

```bash
npm start
```

Backend runs on:

```text
http://localhost:5000
```

---

# Environment Variables

## Client `.env`

```env
VITE_API_URL=http://localhost:5000
```

## Server `.env`

```env
PORT=5000
MONGO_URI=your_mongodb_connection
JWT_SECRET=your_jwt_secret
GROQ_API_KEY=your_groq_api_key
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_secret_key
```

---

# Authentication

* JWT-based authentication
* Google Sign-In integration
* Protected routes and middleware

---

# Interview Rules & Monitoring

The platform includes strict interview monitoring features to simulate real interview environments:

* Users must allow camera and microphone access
* Tab switching is monitored during interviews
* Multiple tab switches can terminate the interview
* Full-screen interview mode support
* Copy, cut, and paste actions disabled during interviews
* Keyboard shortcut restrictions during interview sessions
* Real-time face detection monitoring
* Phone Detection
* Interview warnings for suspicious activities
* AI interview session tracking

---

# AI Features

SmartHire.AI uses AI technologies to:

* Generate interview questions
* Analyze user responses
* Provide AI-generated feedback
* Evaluate communication and correctness
* Generate interview analytics reports
* Detect facial expressions during interviews

---

# Interview Analytics Dashboard

The platform provides:

* Overall interview performance score
* Question-wise performance trends
* Confidence analysis
* Communication assessment
* Correctness evaluation
* AI-generated improvement suggestions

---

# Payment Integration

Razorpay integration is used for:

* Credit purchases
* Premium interview access
* Secure payment processing
* Test mode payment integration

---

# Important Notes

## Files Ignored from GitHub

The following files/folders are ignored using `.gitignore`:

```text
node_modules/
.env
dist/
build/
```

These files are automatically recreated using:

```bash
npm install
```

---

# Empty Folder Handling

GitHub does not track empty folders.

To keep folders like:

```text
server/public/snapshots
```

Use:

```text
.gitkeep
```

Example:

```text
server/public/snapshots/.gitkeep
```

---

# GitHub Setup

## Initialize Git

```bash
git init
```

## Add Files

```bash
git add .
```

## Commit

```bash
git commit -m "Initial commit"
```

## Push to GitHub

```bash
git branch -M main
```

```bash
git remote add origin YOUR_GITHUB_REPOSITORY_LINK
```

```bash
git push -u origin main
```

---

# Future Improvements

* Multi-language interviews
* AI-generated resume optimization
* Live coding interview rounds
* Company-specific interview preparation
* Aptitude and reasoning test modules

---

# Author

## Sumit Shahi

Full Stack MERN Developer

GitHub: [https://github.com/sumitShahi255](https://github.com/sumitShahi255)

---

# License

This project is for educational and portfolio purposes.
