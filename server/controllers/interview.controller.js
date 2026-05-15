import fs from "fs";
import path from "path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { askAi } from "../services/groq.service.js";
import User from "../models/user.model.js";
import Interview from "../models/interview.model.js";

export const analyzeResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Resume Required" });
    }

    const filepath = req.file.path;

    const fileBuffer = await fs.promises.readFile(filepath);
    const uint8Array = new Uint8Array(fileBuffer);

    const pdf = await pdfjsLib.getDocument({ data: uint8Array }).promise;

    let resumeText = "";

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();

      const pageText = content.items.map((item) => item.str).join(" ");
      resumeText += pageText + "\n";
    }

    resumeText = resumeText.replace(/\s+/g, " ").trim();

    const messages = [
      {
        role: "system",
        content: `
You are a resume parser.

Rules:
- Return ONLY valid JSON
- No explanation or extra text
- Do NOT guess missing info
- If missing → use "" or []

Output format:
{
  "name": "string",
  "education": "string",
  "role": "string",
  "experience": "string",
  "projects": ["project1", "project2"],
  "skills": ["skill1", "skill2"]
}
`,
      },
      {
        role: "user",
        content: resumeText,
      },
    ];

    const aiResponse = await askAi(messages);

    let parsed;

    try {
      parsed = JSON.parse(aiResponse);
    } catch (err) {
      console.error("Invalid JSON:", aiResponse);

      return res.status(500).json({
        message: "AI returned invalid JSON",
        raw: aiResponse,
      });
    }

    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }

    return res.json({
      name: parsed.name || "",
      education: parsed.education || "",
      role: parsed.role || "",
      experience: parsed.experience || "",
      projects: parsed.projects || [],
      skills: parsed.skills || [],
      resumeText,
    });
  } catch (error) {
    console.log(error);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ message: error.message });
  }
};

export const generateQuestions = async (req, res) => {
  try {
    let { role, experience, mode, resumeText, projects, skills, userName } = req.body;

    role = role?.trim();
    experience = experience?.trim();
    mode = mode?.trim();

    if (!role || !experience || !mode) {
      return res
        .status(400)
        .json({ message: "Role, Experience and mode are required." });
    }

    const user = await User.findById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.credits < 50) {
      return res
        .status(403)
        .json({ message: "Not enough credits. Minimum 50 required." });
    }

    const projectText =
      Array.isArray(projects) && projects.length ? projects.join(", ") : "None";

    const skillsText =
      Array.isArray(skills) && skills.length ? skills.join(", ") : "None";

    const safeResume = resumeText?.trim() || "None";

    const userPrompt = `
    Role: ${role}
    Experience: ${experience}
    InterviewMode: ${mode}
    Projects: ${projectText}
    Skills: ${skillsText}
    Resume: ${safeResume}
    `;

    if (!userPrompt.trim()) {
      return res.status(400).json({ message: "Prompt content is empty" });
    }

    const messages = [
      {
        role: "system",
        content: `
You are a professional human interviewer conducting a realistic job interview.

Speak naturally in simple conversational English, exactly like a real interviewer speaking to a candidate.

Generate exactly 5 interview questions.

Instructions:
- Each question must contain between 15 and 25 words.
- Each question must be exactly one complete sentence.
- Do NOT number the questions.
- Do NOT use bullet points.
- Do NOT add explanations, introductions, or conclusions.
- Output only the questions.
- One question per line.
- Keep the tone professional, practical, and realistic.
- Avoid overly generic or robotic wording.
- Questions should feel personalized to the candidate.

Difficulty progression:
- Question 1: Easy
- Question 2: Easy
- Question 3: Medium
- Question 4: Medium
- Question 5: Hard

Generate questions using:
- Candidate role
- Years of experience
- Technical skills
- Projects
- Resume details
- Interview mode
- Technologies used
- Problem-solving ability
- Real-world work scenarios

Focus on realistic interview situations instead of textbook theory questions.
`,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const aiResponse = await askAi(messages, false);

    if (!aiResponse || !aiResponse.trim()) {
      return res.status(500).json({ message: "AI return empty response." });
    }

    const questionsArray = aiResponse
      .split("\n")
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, 5);

    if (questionsArray.length === 0) {
      return res
        .status(500)
        .json({ message: "AI failed to generate questions" });
    }

    user.credits -= 50;
    await user.save();

    const interview = await Interview.create({
      userId: user._id,
      role,
      experience,
      mode,
      resumeText: safeResume,
      userName: userName || user.name,
      questions: questionsArray.map((q, index) => ({
        question: q,
        difficulty: ["easy", "easy", "medium", "medium", "hard"][index],
        timeLimit: [60, 60, 90, 90, 120][index],
      })),
    });

    res.json({
      interviewId: interview._id,
      creditsLeft: user.credits,
      userName: interview.userName,
      questions: interview.questions,
    });
  } catch (error) {
    return res.status(500).json({ message: `failed to create interview ${error}` });
  }
};

export const submitAnswer = async (req, res) => {
  try {
    const { interviewId, questionIndex, answer, timeTaken } = req.body;

    const interview = await Interview.findById(interviewId);
    const question = interview.questions[questionIndex];

    if (!answer) {
      question.score = 0;
      question.feedback = "You did not submit an answer.";
      question.answer = "";

      await interview.save();

      return res.json({
        feedback: question.feedback,
      });
    }

    if (timeTaken > question.timeLimit) {
      question.score = 0;
      question.feedback = "Time limit exceeded. Answer not evaluated.";
      question.answer = answer;

      await interview.save();

      return res.json({
        feedback: question.feedback,
      });
    }

    const messages = [
      {
        role: "system",
        content: `
You are an experienced professional interviewer evaluating a candidate's interview answer.

Evaluate the response naturally, fairly, and realistically like a real human interviewer.

Score these categories from 0 to 10:

1. Confidence
- Does the answer sound confident, clear, and well-presented?

2. Communication
- Is the answer easy to understand, structured, and professionally explained?

3. Correctness
- Is the answer accurate, relevant, complete, and technically correct?

Scoring Guidelines:
- Weak, unclear, incorrect, or irrelevant answers should receive low scores.
- Average answers should receive moderate scores.
- Strong, detailed, confident, and accurate answers should receive high scores.
- Do not give high scores unnecessarily.
- Avoid score inflation.
- Evaluate realistically and consistently.

Important Rules:
- Consider answer quality, relevance, clarity, structure, and completeness.
- Penalize vague, off-topic, copied, or extremely short answers.
- Reward practical examples and clear explanations.
- Be unbiased and professional.

Final Score Rule:
finalScore = rounded average of confidence, communication, and correctness.

Feedback Rules:
- Write natural human interview feedback.
- Use 10 to 15 words only.
- Keep feedback professional, concise, and realistic.
- Mention one improvement if needed.
- Do not repeat the question.
- Do not explain scores.
- Avoid robotic wording.

Return ONLY valid JSON.
Do not include markdown.
Do not include code blocks.
Do not include extra text.

JSON format:
{
  "confidence": number,
  "communication": number,
  "correctness": number,
  "finalScore": number,
  "feedback": "short professional feedback"
}
`,
      },
      {
        role: "user",
        content: `
Interview Question:
${question.question}

Answer:
${answer}
`
      },
    ];

    const aiResponse = await askAi(messages);

    const parsed = JSON.parse(aiResponse);

    question.answer = answer;
    question.confidence = parsed.confidence;
    question.communication = parsed.communication;
    question.correctness = parsed.correctness;
    question.score = parsed.finalScore;
    question.feedback = parsed.feedback;

    await interview.save();

    return res.status(200).json({ feedback: parsed.feedback });

  } catch (error) {
    return res.status(500).json({ message: `failed to submit answer ${error}` });
  }
};

export const finishInterview = async (req, res) => {
  try {
    const { interviewId } = req.body;
    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(400).json({ message: "failed to find interview" });
    }

    const totalQuestions = interview.questions.length;

    let totalScore = 0;
    let totalConfidence = 0;
    let totalCorrectness = 0;
    let totalCommunication = 0;

    interview.questions.forEach((q) => {
      totalScore += q.score || 0;
      totalConfidence += q.confidence || 0;
      totalCorrectness += q.correctness || 0;
      totalCommunication += q.communication || 0;
    });

    const finalScore = totalQuestions ? totalScore / totalQuestions : 0;

    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;

    const avgCommunication = totalQuestions ? totalCommunication / totalQuestions : 0;

    const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;

    interview.finalScore = finalScore;
    interview.status = "completed";

    await interview.save();

    return res.status(200).json({
      finalScore: Number(finalScore.toFixed(1)),
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions.map((q) => ({
        question: q.question,
        score: q.score || 0,
        confidence: q.confidence || 0,
        correctness: q.correctness || 0,
        communication: q.communication || 0,
        feedback: q.feedback || ""
      }))
    })

  } catch (error) {
    return res.status(500).json({ message: `failed to finish interview ${error}` });
  }
}

export const getMyInterviews = async (req, res) => {
  try {
    const interviews = await Interview.find({ userId: req.userId })
      .sort({ createdAt: -1 })
      .select("role experience mode finalScore status createdAt");

    return res.status(200).json(interviews);
  } catch (error) {
    return res.status(500).json({ message: `failed to find currentUser Interview ${error}` })
  }
}

export const getInterviewReport = async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const totalQuestions = interview.questions.length;


    let totalConfidence = 0;
    let totalCorrectness = 0;
    let totalCommunication = 0;

    interview.questions.forEach((q) => {
      totalConfidence += q.confidence || 0;
      totalCorrectness += q.correctness || 0;
      totalCommunication += q.communication || 0;
    });

    const avgConfidence = totalQuestions ? totalConfidence / totalQuestions : 0;

    const avgCommunication = totalQuestions ? totalCommunication / totalQuestions : 0;

    const avgCorrectness = totalQuestions ? totalCorrectness / totalQuestions : 0;

    return res.json({
      finalScore: interview.finalScore,
      confidence: Number(avgConfidence.toFixed(1)),
      communication: Number(avgCommunication.toFixed(1)),
      correctness: Number(avgCorrectness.toFixed(1)),
      questionWiseScore: interview.questions
    });

  } catch (error) {
    return res.status(500).json({ message: `failed to find currentUser Interview report ${error}` })
  }
}

export const uploadSnapshots = async (req, res) => {
  try {
    const { interviewId, snapshots } = req.body;
    const interview = await Interview.findById(interviewId);

    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    const savedPaths = [];
    
    // Ensure directory exists with absolute path
    const snapshotDir = path.join(process.cwd(), "public", "snapshots");
    if (!fs.existsSync(snapshotDir)) {
      console.log("Creating snapshots directory:", snapshotDir);
      fs.mkdirSync(snapshotDir, { recursive: true });
    }

    console.log(`Processing ${snapshots.length} snapshots for interview ${interviewId}`);

    await Promise.all(snapshots.map(async (snapshot, i) => {
      try {
        const base64Data = snapshot.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `snapshot_${interviewId}_${Date.now()}_${i}.jpg`;
        const filepath = path.join(snapshotDir, filename);
        
        await fs.promises.writeFile(filepath, buffer);
        savedPaths.push(filename);
      } catch (err) {
        console.error(`Failed to save snapshot ${i} for interview ${interviewId}:`, err);
      }
    }));

    console.log(`Successfully saved ${savedPaths.length} snapshots for interview ${interviewId}`);

    interview.snapshots = savedPaths;
    await interview.save();

    res.status(200).json({ message: "Snapshots saved as files successfully", count: savedPaths.length });
  } catch (error) {
    res.status(500).json({ message: `Failed to upload snapshots: ${error.message}` });
  }
};

export const uploadVideo = async (req, res) => {
  try {
    const { interviewId } = req.body;
    if (!req.file) {
      return res.status(400).json({ message: "No video file uploaded" });
    }

    const interview = await Interview.findById(interviewId);
    if (!interview) {
      return res.status(404).json({ message: "Interview not found" });
    }

    interview.videoUrl = req.file.filename;
    await interview.save();

    res.status(200).json({ message: "Video uploaded successfully", videoUrl: req.file.filename });
  } catch (error) {
    res.status(500).json({ message: `Failed to upload video: ${error.message}` });
  }
};
