import express, { Request, Response, NextFunction } from "express";
import path from "path";
import fs from "fs";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const JWT_SECRET = process.env.JWT_SECRET!;
const COOKIE_NAME = "dma_token";
const isProd = process.env.NODE_ENV === "production";
const STATE_FILE = path.join(process.cwd(), "db_state.json");
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 5000;

if (!JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET is required");
  process.exit(1);
}

// ─── State Management ─────────────────────────────────────────────────────────

interface AppState {
  users: any[];
  courses: any[];
  enrollments: any[];
  subscriptions: any[];
  certificates: any[];
  logs: any[];
  learningPaths: any[];
  events: any[];
  messages: any[];
  assignmentSubmissions: any[];
  withdrawalRequests: any[];
  bankAccounts: any[];
  cmsContent: any;
  customRoles: any[];
  mediaLibrary: any[];
  invites: any[];
  themeSettings: any;
  webinarPosts: any[];
}

let state: AppState = {
  users: [], courses: [], enrollments: [], subscriptions: [],
  certificates: [], logs: [], learningPaths: [], events: [],
  messages: [], assignmentSubmissions: [], withdrawalRequests: [],
  bankAccounts: [], cmsContent: null, customRoles: [], mediaLibrary: [],
  invites: [], themeSettings: null, webinarPosts: [],
};

function saveState(): void {
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2)); } catch {}
}

function addLog(text: string, type = "general", userId?: string): void {
  state.logs.unshift({ id: `log_${Date.now()}`, text, type, userId: userId || null, time: new Date().toISOString() });
  if (state.logs.length > 500) state.logs = state.logs.slice(0, 500);
  saveState();
}

async function initializeState(): Promise<void> {
  if (fs.existsSync(STATE_FILE)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
      state = { ...state, ...raw };
    } catch {
      console.error("[DMA] Could not parse db_state.json, using defaults");
    }
  }

  if (!Array.isArray(state.users)) state.users = [];
  if (!Array.isArray(state.courses)) state.courses = [];
  if (!Array.isArray(state.enrollments)) state.enrollments = [];
  if (!Array.isArray(state.logs)) state.logs = [];
  if (!Array.isArray(state.learningPaths)) state.learningPaths = [];
  if (!Array.isArray(state.events)) state.events = [];
  if (!Array.isArray(state.messages)) state.messages = [];
  if (!Array.isArray(state.assignmentSubmissions)) state.assignmentSubmissions = [];
  if (!Array.isArray(state.withdrawalRequests)) state.withdrawalRequests = [];
  if (!Array.isArray(state.bankAccounts)) state.bankAccounts = [];
  if (!Array.isArray(state.customRoles)) state.customRoles = [];
  if (!Array.isArray(state.mediaLibrary)) state.mediaLibrary = [];
  if (!Array.isArray(state.invites)) state.invites = [];
  if (!Array.isArray(state.webinarPosts)) state.webinarPosts = [];
  if (state.webinarPosts.length === 0) {
    const now = new Date().toISOString();
    state.webinarPosts = [
      {
        id: `wp_seed_1`,
        title: "Welcome to DMA Academy Platform!",
        content: "We are thrilled to announce the official launch of the Digital Manufacturing Academy learning portal — a joint initiative between AIUB and Birmingham City University, funded by the British Council.\n\nThis platform hosts industry-grade courses in Digital Twin Technology, Robotics & PLC Programming, Smart Factory & IoT, Additive Manufacturing, and much more. Start your Industry 4.0 journey today!",
        type: "announcement",
        authorId: "system",
        authorName: "DMA Academy Team",
        authorRole: "super_admin",
        tags: ["welcome", "launch", "industry-4.0"],
        createdAt: now,
        pinned: true,
        views: 0,
      },
      {
        id: `wp_seed_2`,
        title: "Upcoming Live Webinar: Introduction to Digital Twins",
        content: "Join us for an exclusive live session with Dr. Majid Butt from Birmingham City University. We'll cover the fundamentals of Digital Twin technology, real-world deployment scenarios in manufacturing plants, and a hands-on Q&A session.\n\nAll enrolled students and registered users are welcome.",
        type: "webinar",
        authorId: "system",
        authorName: "DMA Academy Team",
        authorRole: "admin",
        scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        meetLink: "https://meet.google.com/dma-webinar-001",
        tags: ["digital-twin", "live-session", "bcit"],
        createdAt: now,
        pinned: false,
        views: 0,
      },
      {
        id: `wp_seed_3`,
        title: "New Course Released: Smart Factory & Cyber-Physical Systems",
        content: "We've just published a brand-new course module covering MQTT network brokers, sensory casing telemetry, and edge computing fundamentals for smart factory environments.\n\nThis module is available to all Basic, Pro, and Enterprise subscribers. Free learners can preview the first two lessons.",
        type: "release",
        authorId: "system",
        authorName: "Digital Mfg Admin",
        authorRole: "admin",
        tags: ["new-course", "smart-factory", "iot"],
        createdAt: now,
        pinned: false,
        views: 0,
      },
    ];
  }

  const SUPER_ADMIN_EMAIL = "pandoratecllc@gmail.com";
  const ADMIN_EMAIL = "digitalmfg.2026@gmail.com";
  const DEFAULT_PW = "Dmamfg.2026";

  async function ensureUser(email: string, name: string, role: string): Promise<void> {
    const exists = state.users.find((u: any) => u.email === email);
    if (!exists) {
      const hashed = await bcrypt.hash(DEFAULT_PW, 10);
      state.users.unshift({
        id: `u_${role}_${Date.now()}`, name, email, role,
        password: hashed, isApproved: true, suspended: false,
        subscriptionPlan: "premium", avatar: "", joinedAt: new Date().toISOString(),
        customRoleId: null,
      });
    } else if (!exists.password) {
      exists.password = await bcrypt.hash(DEFAULT_PW, 10);
      exists.isApproved = true;
      exists.suspended = false;
    }
  }

  await ensureUser(SUPER_ADMIN_EMAIL, "Pandora Tech (Super Admin)", "super_admin");
  await ensureUser(ADMIN_EMAIL, "Digital Mfg Admin", "admin");

  for (const u of state.users) {
    if (u.isApproved === undefined) u.isApproved = true;
    if (u.suspended === undefined) u.suspended = false;
  }

  const c101 = state.courses.find((c: any) => c.id === "c_101");
  if (c101) { c101.isFree = true; c101.price = 0; }

  if (!state.cmsContent) {
    state.cmsContent = { pages: [] };
  }

  saveState();
  console.log(`[DMA] State loaded: ${state.users.length} users, ${state.courses.length} courses`);
}

// ─── Auth Helpers ─────────────────────────────────────────────────────────────

function issueToken(res: Response, payload: object): string {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, secure: isProd, sameSite: isProd ? "strict" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000, path: "/",
  });
  return token;
}

function getSession(req: Request): { userId: string; email: string; role: string } | null {
  const raw = req.cookies?.[COOKIE_NAME] || (req.headers.authorization?.startsWith("Bearer ") ? req.headers.authorization.slice(7) : null);
  if (!raw) return null;
  try { const d = jwt.verify(raw, JWT_SECRET) as any; return { userId: d.id, email: d.email, role: d.role }; }
  catch { return null; }
}

function requireSession(req: Request, res: Response): { userId: string; email: string; role: string } | null {
  const s = getSession(req);
  if (!s) { res.status(401).json({ error: "Authentication required" }); return null; }
  return s;
}

function requireAdmin(req: Request, res: Response): { userId: string; email: string; role: string } | null {
  const s = getSession(req);
  if (!s) { res.status(401).json({ error: "Authentication required" }); return null; }
  if (s.role !== "admin" && s.role !== "super_admin") { res.status(403).json({ error: "Admin access required" }); return null; }
  return s;
}

function safeUser(u: any) {
  const { password: _pw, ...rest } = u;
  return rest;
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());

// ─── Auth Routes ──────────────────────────────────────────────────────────────

app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { name, email, role, password, inviteToken, bio, specialization, qualificationDoc, subscriptionPlan } = req.body;
    if (!name || !email) { res.status(400).json({ error: "name and email are required" }); return; }

    const emailLower = email.toLowerCase();
    if (state.users.find((u: any) => u.email === emailLower)) {
      res.status(409).json({ error: "Email already registered" }); return;
    }

    let assignedRole = "student";
    if (inviteToken) {
      const invite = state.invites.find((i: any) => i.token === inviteToken && i.status === "pending");
      if (invite && invite.email === emailLower) { assignedRole = invite.role; invite.status = "used"; }
    } else if (role === "instructor") {
      assignedRole = "instructor";
    }

    const safePassword = password || `DMA-${Math.random().toString(36).slice(2, 10)}`;
    const hashed = await bcrypt.hash(safePassword, 10);
    const user: any = {
      id: `u_${Date.now()}`, name, email: emailLower, role: assignedRole,
      password: hashed,
      isApproved: assignedRole !== "instructor",
      suspended: false,
      subscriptionPlan: subscriptionPlan || "free",
      avatar: "", joinedAt: new Date().toISOString(), customRoleId: null,
      bio: bio || "",
      specialization: specialization || "",
      qualificationDoc: qualificationDoc || null,
    };
    state.users.push(user);
    addLog(`User registered: ${name} (${assignedRole})${assignedRole === "instructor" ? " [pending approval]" : ""}`, "register", user.id);
    saveState();

    // Instructors are pending approval — still return token so they can log out cleanly
    const token = issueToken(res, { id: user.id, email: user.email, role: user.role });
    res.status(201).json({ status: "success", user: safeUser(user), token });
  } catch (err) {
    console.error("[register]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) { res.status(400).json({ error: "email and password are required" }); return; }

    const user = state.users.find((u: any) => u.email === email.toLowerCase());
    if (!user) { res.status(401).json({ error: "Invalid credentials" }); return; }
    if (user.suspended) { res.status(403).json({ error: "Account suspended. Contact your administrator." }); return; }
    if (!user.isApproved) { res.status(403).json({ error: "Account pending approval. Contact your administrator." }); return; }

    if (!user.password) {
      user.password = await bcrypt.hash("Dmamfg.2026", 10);
      saveState();
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) { res.status(401).json({ error: "Invalid credentials" }); return; }

    const token = issueToken(res, { id: user.id, email: user.email, role: user.role });
    addLog(`User logged in: ${user.name}`, "login", user.id);
    res.json({ status: "success", user: safeUser(user), token });
  } catch (err) {
    console.error("[login]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/auth/logout", (_req: Request, res: Response) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ status: "success" });
});

app.get("/api/auth/me", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
  const user = state.users.find((u: any) => u.id === session.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  res.json({ status: "success", user: safeUser(user) });
});

app.post("/api/auth/change-password", async (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { currentPassword, newPassword } = req.body;
  const user = state.users.find((u: any) => u.id === session.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  if (user.password) {
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) { res.status(400).json({ error: "Current password incorrect" }); return; }
  }
  user.password = await bcrypt.hash(newPassword, 10);
  saveState();
  res.json({ status: "success" });
});

// ─── Course Routes ────────────────────────────────────────────────────────────

app.get("/api/courses", (_req: Request, res: Response) => {
  const published = state.courses.filter((c: any) => c.isPublished !== false);
  res.json(published);
});

app.get("/api/courses/enrollments/:userId", (req: Request, res: Response) => {
  const session = getSession(req);
  const { userId } = req.params;
  if (!session || (session.userId !== userId && session.role !== "admin" && session.role !== "super_admin")) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  const enrollments = state.enrollments.filter((e: any) => e.userId === userId);
  res.json({ enrollments });
});

app.get("/api/courses/:id", (req: Request, res: Response) => {
  const course = state.courses.find((c: any) => c.id === req.params.id);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  res.json(course);
});

app.post("/api/courses/create", async (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { title, headline, description, category, level, duration, price, image, isFree } = req.body;
  if (!title || !category) { res.status(400).json({ error: "title and category required" }); return; }
  const user = state.users.find((u: any) => u.id === session.userId);
  const course: any = {
    id: `c_${Date.now()}`, title, headline: headline || "", description: description || "",
    category, level: level || "Beginner", duration: duration || "TBD",
    instructorId: session.userId, instructorName: user?.name || "Instructor",
    price: isFree ? 0 : (price || 0), isFree: !!isFree, image: image || "",
    isPublished: false, approvalStatus: "draft", enrollmentCount: 0,
    lessons: [], quizzes: [], createdAt: new Date().toISOString(),
  };
  state.courses.push(course);
  addLog(`Course created: ${title}`, "course_create", session.userId);
  saveState();
  res.json({ status: "success", course });
});

app.post("/api/courses/update", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { courseId, updates } = req.body;
  const idx = state.courses.findIndex((c: any) => c.id === courseId);
  if (idx === -1) { res.status(404).json({ error: "Course not found" }); return; }
  const course = state.courses[idx];
  if (course.instructorId !== session.userId && session.role !== "admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Unauthorized" }); return;
  }
  state.courses[idx] = { ...course, ...updates };
  saveState();
  res.json({ status: "success", course: state.courses[idx] });
});

app.post("/api/courses/submit-for-review", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { courseId } = req.body;
  const course = state.courses.find((c: any) => c.id === courseId && c.instructorId === session.userId);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  course.approvalStatus = "pending";
  course.isPublished = false;
  addLog(`Course "${course.title}" submitted for review`, "course_review", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/courses/:id/enroll", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { id } = req.params;
  const course = state.courses.find((c: any) => c.id === id);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }

  const existing = state.enrollments.find((e: any) => e.userId === session.userId && e.courseId === id);
  if (existing) { res.json({ status: "already_enrolled", enrollment: existing }); return; }

  const enrollment: any = {
    id: `enr_${Date.now()}`, userId: session.userId, courseId: id,
    progress: 0, completedLessons: [], quizAttempts: {},
    enrolledAt: new Date().toISOString(), completedAt: null,
  };
  state.enrollments.push(enrollment);
  course.enrollmentCount = (course.enrollmentCount || 0) + 1;
  addLog(`User enrolled in: ${course.title}`, "enrollment", session.userId);
  saveState();
  res.json({ status: "success", enrollment });
});

app.post("/api/courses/:id/progress", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { id } = req.params;
  const { lessonId } = req.body;

  const enrollment = state.enrollments.find((e: any) => e.userId === session.userId && e.courseId === id);
  if (!enrollment) { res.status(404).json({ error: "Not enrolled" }); return; }

  if (!enrollment.completedLessons) enrollment.completedLessons = [];
  if (!enrollment.completedLessons.includes(lessonId)) enrollment.completedLessons.push(lessonId);

  const course = state.courses.find((c: any) => c.id === id);
  const lessons = (course?.lessons || []).filter((l: any) => l.isRequired !== false);
  enrollment.progress = lessons.length > 0
    ? Math.round((enrollment.completedLessons.length / lessons.length) * 100)
    : 0;
  if (enrollment.progress >= 100) enrollment.completedAt = new Date().toISOString();
  saveState();
  res.json({ status: "success", enrollment });
});

app.post("/api/courses/:id/quiz", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { id } = req.params;
  const { quizId, answers } = req.body;

  const enrollment = state.enrollments.find((e: any) => e.userId === session.userId && e.courseId === id);
  if (!enrollment) { res.status(404).json({ error: "Not enrolled" }); return; }

  const course = state.courses.find((c: any) => c.id === id);
  const quiz = (course?.quizzes || []).find((q: any) => q.id === quizId);
  if (!quiz) { res.status(404).json({ error: "Quiz not found" }); return; }

  let correct = 0;
  for (let i = 0; i < quiz.questions.length; i++) {
    if (answers[i] === quiz.questions[i].correctAnswer) correct++;
  }
  const score = Math.round((correct / quiz.questions.length) * 100);
  const passed = score >= (quiz.passingScore || 80);

  if (!enrollment.quizAttempts) enrollment.quizAttempts = {};
  enrollment.quizAttempts[quizId] = { score, passed, attemptedAt: new Date().toISOString() };
  saveState();
  res.json({ status: "success", score, passed, correct, total: quiz.questions.length });
});

// ─── db-state bulk endpoint (used by frontend on mount) ──────────────────────

app.get("/api/db-state", (req: Request, res: Response) => {
  const session = getSession(req);
  const isAdmin = session && (session.role === "admin" || session.role === "super_admin");
  res.json({
    users: isAdmin ? state.users.map(safeUser) : [],
    courses: state.courses,
    enrollments: session ? state.enrollments.filter((e: any) => isAdmin || e.userId === session.userId) : [],
    certificates: state.certificates || [],
    learningPaths: state.learningPaths,
    events: state.events,
    logs: isAdmin ? state.logs : [],
    messages: session ? state.messages.filter((m: any) => isAdmin || m.toUserId === session.userId || m.fromUserId === session.userId) : [],
  });
});

// ─── Legacy enroll route (App.tsx uses /api/courses/enroll with userId in body)

app.post("/api/courses/enroll", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { courseId } = req.body;
  if (!courseId) { res.status(400).json({ error: "courseId required" }); return; }
  const course = state.courses.find((c: any) => c.id === courseId);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  const existing = state.enrollments.find((e: any) => e.userId === session.userId && e.courseId === courseId);
  if (existing) { res.json({ status: "already_enrolled", enrollment: existing }); return; }
  const enrollment: any = {
    id: `enr_${Date.now()}`, userId: session.userId, courseId,
    progress: 0, completedLessons: [], quizAttempts: {},
    enrolledAt: new Date().toISOString(), completedAt: null,
  };
  state.enrollments.push(enrollment);
  course.enrollmentCount = (course.enrollmentCount || 0) + 1;
  addLog(`User enrolled in: ${course.title}`, "enrollment", session.userId);
  saveState();
  res.json({ status: "success", enrollment });
});

// ─── Legacy sync-progress (App.tsx uses /api/courses/sync-progress) ───────────

app.post("/api/courses/sync-progress", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { userId, courseId, lessonId, quizId, score, passed } = req.body;
  const uid = userId || session.userId;
  const enrollment = state.enrollments.find((e: any) => e.userId === uid && e.courseId === courseId);
  if (!enrollment) { res.status(404).json({ error: "Not enrolled" }); return; }

  if (lessonId) {
    if (!enrollment.completedLessons) enrollment.completedLessons = [];
    if (!enrollment.completedLessons.includes(lessonId)) enrollment.completedLessons.push(lessonId);
    const course = state.courses.find((c: any) => c.id === courseId);
    const lessons = (course?.lessons || []).filter((l: any) => l.isRequired !== false);
    enrollment.progress = lessons.length > 0
      ? Math.round((enrollment.completedLessons.length / lessons.length) * 100) : 0;
    if (enrollment.progress >= 100) enrollment.completedAt = new Date().toISOString();
  }

  if (quizId) {
    if (!enrollment.quizAttempts) enrollment.quizAttempts = {};
    enrollment.quizAttempts[quizId] = { score: score || 0, passed: !!passed, attemptedAt: new Date().toISOString() };
  }

  saveState();
  res.json({ status: "success", enrollment });
});

// ─── Subscription Routes ──────────────────────────────────────────────────────

app.get("/api/subscription/status", (req: Request, res: Response) => {
  const session = getSession(req);
  if (!session) { res.status(401).json({ error: "Not authenticated" }); return; }
  const user = state.users.find((u: any) => u.id === session.userId);
  res.json({ plan: user?.subscriptionPlan || "free", status: "active" });
});

app.post("/api/subscription/upgrade", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { planId } = req.body;
  const user = state.users.find((u: any) => u.id === session.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  user.subscriptionPlan = planId || "pro";
  saveState();
  res.json({ status: "success", transactionId: `txn_${Date.now()}`, plan: user.subscriptionPlan });
});

app.post("/api/subscription/cancel", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const user = state.users.find((u: any) => u.id === session.userId);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  user.subscriptionPlan = "free";
  saveState();
  res.json({ status: "success" });
});

// ─── Webinar / Platform Board Routes ─────────────────────────────────────────

app.get("/api/webinars", (_req: Request, res: Response) => {
  res.json({ posts: Array.isArray(state.webinarPosts) ? state.webinarPosts : [] });
});

app.post("/api/webinars/create", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (!["admin", "super_admin", "instructor"].includes(session.role)) {
    res.status(403).json({ error: "Only admins and instructors can post" }); return;
  }
  const user = state.users.find((u: any) => u.id === session.userId);
  if (!user) { res.status(401).json({ error: "User not found" }); return; }

  const { title, content, type, meetLink, scheduledAt, tags } = req.body;
  if (!title?.trim() || !content?.trim()) {
    res.status(400).json({ error: "title and content are required" }); return;
  }

  const post = {
    id: `wp_${Date.now()}`,
    title: title.trim(),
    content: content.trim(),
    type: type || "announcement",
    authorId: session.userId,
    authorName: user.name,
    authorRole: session.role,
    meetLink: meetLink || null,
    scheduledAt: scheduledAt || null,
    tags: Array.isArray(tags) ? tags : [],
    createdAt: new Date().toISOString(),
    pinned: false,
    views: 0,
  };

  if (!Array.isArray(state.webinarPosts)) state.webinarPosts = [];
  state.webinarPosts.unshift(post);
  addLog(`Webinar post created: "${title}" by ${user.name}`, "webinar", session.userId);
  saveState();
  res.json({ status: "success", post });
});

app.delete("/api/webinars/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  if (!Array.isArray(state.webinarPosts)) { res.status(404).json({ error: "Post not found" }); return; }
  const idx = state.webinarPosts.findIndex((p: any) => p.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Post not found" }); return; }
  state.webinarPosts.splice(idx, 1);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/webinars/:id/pin", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  if (!Array.isArray(state.webinarPosts)) { res.status(404).json({ error: "Post not found" }); return; }
  const post = state.webinarPosts.find((p: any) => p.id === req.params.id);
  if (!post) { res.status(404).json({ error: "Post not found" }); return; }
  post.pinned = !post.pinned;
  saveState();
  res.json({ status: "success", pinned: post.pinned });
});

// ─── Enrollment Routes ────────────────────────────────────────────────────────

app.get("/api/enrollments/:userId", (req: Request, res: Response) => {
  const session = getSession(req);
  const { userId } = req.params;
  if (!session || (session.userId !== userId && session.role !== "admin" && session.role !== "super_admin")) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  const enrollments = state.enrollments.filter((e: any) => e.userId === userId);
  res.json({ enrollments });
});

// ─── Admin Routes ─────────────────────────────────────────────────────────────

app.get("/api/admin/users", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({ status: "success", users: state.users.map(safeUser) });
});

app.post("/api/admin/users/create", async (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { name, email, role, avatar, password, customRoleId } = req.body;
  if (!name || !email || !role) { res.status(400).json({ error: "name, email, role required" }); return; }
  if (!password) { res.status(400).json({ error: "password required" }); return; }
  if (role === "super_admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Only super admin can create super admin accounts" }); return;
  }
  if (state.users.find((u: any) => u.email === email.toLowerCase())) {
    res.status(400).json({ error: "Email already registered" }); return;
  }
  const hashed = await bcrypt.hash(password, 10);
  const user: any = {
    id: `u_${Date.now()}`, name, email: email.toLowerCase(), role,
    password: hashed, avatar: avatar || "", suspended: false,
    isApproved: role === "instructor" ? false : true,
    subscriptionPlan: "free", joinedAt: new Date().toISOString(),
    customRoleId: customRoleId || null,
  };
  state.users.push(user);
  addLog(`Admin created user: ${name} (${role})`, "user_create", session.userId);
  saveState();
  res.json({ status: "success", user: safeUser(user) });
});

app.put("/api/admin/users/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { id } = req.params;
  const target = state.users.find((u: any) => u.id === id);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.role === "super_admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Admin cannot modify super admin accounts" }); return;
  }
  const { name, email, role, avatar, subscriptionPlan, customRoleId } = req.body;
  if (role === "super_admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Only super admin can promote to super admin" }); return;
  }
  if (name) target.name = name;
  if (email) target.email = email.toLowerCase();
  if (role) target.role = role;
  if (avatar !== undefined) target.avatar = avatar;
  if (subscriptionPlan !== undefined) target.subscriptionPlan = subscriptionPlan;
  if (customRoleId !== undefined) target.customRoleId = customRoleId || null;
  addLog(`Admin updated user: ${target.name}`, "user_update", session.userId);
  saveState();
  res.json({ status: "success", user: safeUser(target) });
});

app.post("/api/admin/users/:id/suspend", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { id } = req.params;
  const { suspend } = req.body;
  if (id === session.userId) { res.status(400).json({ error: "Cannot suspend your own account" }); return; }
  const target = state.users.find((u: any) => u.id === id);
  if (!target) { res.status(404).json({ error: "User not found" }); return; }
  if (target.role === "super_admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Admin cannot suspend super admin accounts" }); return;
  }
  target.suspended = !!suspend;
  addLog(`Admin ${suspend ? "suspended" : "unsuspended"} user: ${target.name}`, "user_suspend", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.delete("/api/admin/users/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { id } = req.params;
  if (id === session.userId) { res.status(400).json({ error: "Cannot delete your own account" }); return; }
  const idx = state.users.findIndex((u: any) => u.id === id);
  if (idx === -1) { res.status(404).json({ error: "User not found" }); return; }
  if (state.users[idx].role === "super_admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Admin cannot delete super admin accounts" }); return;
  }
  const name = state.users[idx].name;
  state.users.splice(idx, 1);
  addLog(`Admin deleted user: ${name}`, "user_delete", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/admin/users/:id/reset-password", async (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const user = state.users.find((u: any) => u.id === req.params.id);
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const tempPassword = `DMA-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
  user.password = await bcrypt.hash(tempPassword, 10);
  addLog(`Admin reset password for: ${user.name}`, "password_reset", session.userId);
  saveState();
  res.json({ status: "success", tempPassword });
});

app.post("/api/admin/users/invite", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { email, role } = req.body;
  if (!email || !role) { res.status(400).json({ error: "email and role required" }); return; }
  const token = crypto.randomBytes(16).toString("hex");
  const invite = { id: `inv_${Date.now()}`, email, role, token, status: "pending", createdAt: new Date().toISOString() };
  state.invites.push(invite);
  addLog(`Invite generated for: ${email} (${role})`, "invite", session.userId);
  saveState();
  res.json({ status: "success", invite, inviteUrl: `/register?invite=${token}` });
});

app.get("/api/admin/invites", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({ status: "success", invites: [...state.invites].reverse() });
});

app.post("/api/admin/approve-instructor", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { instructorId } = req.body;
  const user = state.users.find((u: any) => u.id === instructorId);
  if (!user) { res.status(404).json({ error: "Instructor not found" }); return; }
  user.isApproved = true;
  addLog(`Approved instructor: ${user.name}`, "instructor_approve", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.delete("/api/admin/courses/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const idx = state.courses.findIndex((c: any) => c.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Course not found" }); return; }
  const title = state.courses[idx].title;
  state.courses.splice(idx, 1);
  addLog(`Admin removed course: ${title}`, "course_delete", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/admin/approve-course", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { courseId } = req.body;
  const course = state.courses.find((c: any) => c.id === courseId);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  course.approvalStatus = "approved";
  course.isPublished = true;
  addLog(`Course "${course.title}" approved and published`, "course_approve", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/admin/reject-course", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { courseId, reason } = req.body;
  const course = state.courses.find((c: any) => c.id === courseId);
  if (!course) { res.status(404).json({ error: "Course not found" }); return; }
  course.approvalStatus = "rejected";
  course.rejectionReason = reason || "Does not meet quality standards";
  saveState();
  res.json({ status: "success" });
});

app.get("/api/admin/logs", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({ logs: state.logs.slice(0, 200) });
});

app.post("/api/admin/clear-logs", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  state.logs = [{ id: `log_${Date.now()}`, text: "Activity logs cleared by admin.", type: "admin", time: new Date().toISOString() }];
  saveState();
  res.json({ status: "success" });
});

app.get("/api/admin/stats", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({
    userCount: state.users.length,
    courseCount: state.courses.filter((c: any) => c.isPublished).length,
    enrollmentCount: state.enrollments.length,
  });
});

app.get("/api/admin/enrollments", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({ enrollments: state.enrollments });
});

app.get("/api/admin/roles", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({ status: "success", roles: state.customRoles });
});

app.post("/api/admin/roles/create", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { name, description, permissions } = req.body;
  if (!name) { res.status(400).json({ error: "Role name required" }); return; }
  const role = { id: `role_${Date.now()}`, name, description: description || "", permissions: permissions || [], createdAt: new Date().toISOString() };
  state.customRoles.push(role);
  addLog(`Admin created custom role: ${name}`, "role_create", session.userId);
  saveState();
  res.json({ status: "success", role });
});

app.put("/api/admin/roles/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const role = state.customRoles.find((r: any) => r.id === req.params.id);
  if (!role) { res.status(404).json({ error: "Role not found" }); return; }
  const { name, description, permissions } = req.body;
  if (name) role.name = name;
  if (description !== undefined) role.description = description;
  if (permissions) role.permissions = permissions;
  saveState();
  res.json({ status: "success", role });
});

app.delete("/api/admin/roles/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const idx = state.customRoles.findIndex((r: any) => r.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Role not found" }); return; }
  const name = state.customRoles[idx].name;
  state.customRoles.splice(idx, 1);
  addLog(`Admin deleted custom role: ${name}`, "role_delete", session.userId);
  saveState();
  res.json({ status: "success" });
});

app.get("/api/admin/media", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  res.json({ status: "success", media: state.mediaLibrary });
});

app.post("/api/admin/media/upload", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { name, dataUrl, type } = req.body;
  if (!name || !dataUrl) { res.status(400).json({ error: "name and dataUrl required" }); return; }
  const item = { id: `media_${Date.now()}`, name, dataUrl, type: type || "image", usedAs: null, uploadedAt: new Date().toISOString() };
  state.mediaLibrary.push(item);
  addLog(`Media uploaded: ${name}`, "media_upload", session.userId);
  saveState();
  res.json({ status: "success", item });
});

app.delete("/api/admin/media/:id", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const idx = state.mediaLibrary.findIndex((m: any) => m.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Media not found" }); return; }
  state.mediaLibrary.splice(idx, 1);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/admin/media/:id/set-banner", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { target } = req.body;
  state.mediaLibrary.forEach((m: any) => { if (m.usedAs === target) m.usedAs = null; });
  const item = state.mediaLibrary.find((m: any) => m.id === req.params.id);
  if (!item) { res.status(404).json({ error: "Media not found" }); return; }
  item.usedAs = target;
  addLog(`Media '${item.name}' set as ${target} banner`, "media_banner", session.userId);
  saveState();
  res.json({ status: "success", item });
});

// ─── Learning Paths ───────────────────────────────────────────────────────────

app.get("/api/learning-paths", (_req: Request, res: Response) => {
  res.json(state.learningPaths);
});

app.post("/api/learning-paths/create", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { title, description, courseIds, badgeIcon, estimatedDuration } = req.body;
  if (!title || !courseIds) { res.status(400).json({ error: "title and courseIds required" }); return; }
  const lp = {
    id: `lp_${Date.now()}`, title, description: description || "",
    courseIds, badgeIcon: badgeIcon || "🎓", estimatedDuration: estimatedDuration || "TBD",
    enrolledCount: 0, createdAt: new Date().toISOString(),
  };
  state.learningPaths.push(lp);
  addLog(`Learning path created: ${title}`, "lp_create", session.userId);
  saveState();
  res.json({ status: "success", learningPath: lp });
});

app.post("/api/learning-paths/enroll", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { pathId } = req.body;
  const lp = state.learningPaths.find((p: any) => p.id === pathId);
  if (!lp) { res.status(404).json({ error: "Learning path not found" }); return; }
  lp.enrolledCount = (lp.enrolledCount || 0) + 1;
  for (const courseId of (lp.courseIds || [])) {
    const alreadyEnrolled = state.enrollments.find((e: any) => e.userId === session.userId && e.courseId === courseId);
    if (!alreadyEnrolled) {
      state.enrollments.push({
        id: `enr_${Date.now()}_${courseId}`, userId: session.userId, courseId,
        progress: 0, completedLessons: [], quizAttempts: {},
        enrolledAt: new Date().toISOString(), completedAt: null,
      });
    }
  }
  saveState();
  res.json({ status: "success" });
});

// ─── Events ───────────────────────────────────────────────────────────────────

app.get("/api/events", (_req: Request, res: Response) => {
  res.json(state.events);
});

app.post("/api/events/create", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { title, description, date, location, capacity, type } = req.body;
  if (!title || !date) { res.status(400).json({ error: "title and date required" }); return; }
  const event = {
    id: `evt_${Date.now()}`, title, description: description || "",
    date, location: location || "Online", capacity: capacity || 100,
    type: type || "webinar", attendeeCount: 0, createdAt: new Date().toISOString(),
  };
  state.events.push(event);
  addLog(`Event created: ${title}`, "event_create", session.userId);
  saveState();
  res.json({ status: "success", event });
});

app.post("/api/events/:id/attend", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const event = state.events.find((e: any) => e.id === req.params.id);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  event.attendeeCount = (event.attendeeCount || 0) + 1;
  saveState();
  res.json({ status: "success" });
});

// ─── Messages ─────────────────────────────────────────────────────────────────

app.post("/api/messages/send", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { toUserId, content } = req.body;
  if (!toUserId || !content) { res.status(400).json({ error: "toUserId and content required" }); return; }
  const msg = {
    id: `msg_${Date.now()}`, fromUserId: session.userId, toUserId,
    content, read: false, createdAt: new Date().toISOString(),
  };
  state.messages.push(msg);
  saveState();
  res.json({ status: "success", message: msg });
});

app.get("/api/messages/:userId", (req: Request, res: Response) => {
  const session = getSession(req);
  const { userId } = req.params;
  if (!session || (session.userId !== userId && session.role !== "admin" && session.role !== "super_admin")) {
    res.status(403).json({ error: "Access denied" }); return;
  }
  const msgs = state.messages.filter((m: any) => m.toUserId === userId || m.fromUserId === userId);
  res.json({ messages: msgs });
});

app.post("/api/messages/:id/read", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const msg = state.messages.find((m: any) => m.id === req.params.id && m.toUserId === session.userId);
  if (msg) { msg.read = true; saveState(); }
  res.json({ status: "success" });
});

// ─── CMS ─────────────────────────────────────────────────────────────────────

const DEFAULT_CMS_PAGES: any[] = [];

app.get("/api/cms", (_req: Request, res: Response) => {
  res.json(state.cmsContent || { pages: DEFAULT_CMS_PAGES });
});

app.post("/api/cms/update", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { pages } = req.body;
  state.cmsContent = { pages: pages || [] };
  addLog("CMS content updated", "cms_update", session.userId);
  saveState();
  res.json({ status: "success" });
});

// ─── Theme ────────────────────────────────────────────────────────────────────

app.get("/api/theme", (_req: Request, res: Response) => {
  res.json(state.themeSettings || null);
});

app.post("/api/theme", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  state.themeSettings = req.body;
  saveState();
  res.json({ status: "success" });
});

// ─── Revenue ─────────────────────────────────────────────────────────────────

app.get("/api/revenue/:instructorId", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { instructorId } = req.params;
  const isAdmin = session.role === "admin" || session.role === "super_admin";
  if (!isAdmin && session.userId !== instructorId) { res.status(403).json({ error: "Access denied" }); return; }

  const courses = state.courses.filter((c: any) => c.instructorId === instructorId);
  const totalRevenue = courses.reduce((sum: number, c: any) => sum + (c.enrollmentCount || 0) * (c.price || 0), 0);
  const withdrawals = state.withdrawalRequests.filter((w: any) => w.instructorId === instructorId);
  const totalWithdrawn = withdrawals.filter((w: any) => w.status === "approved").reduce((s: number, w: any) => s + w.amount, 0);
  const bank = state.bankAccounts.find((b: any) => b.instructorId === instructorId) || null;
  res.json({ totalRevenue, totalWithdrawn, bank, withdrawals, platformShare: 0.3, instructorShare: 0.7 });
});

app.post("/api/revenue/add-bank", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { instructorId, bankName, accountName, accountNumber, routingCode, country } = req.body;
  const isAdmin = session.role === "admin" || session.role === "super_admin";
  if (!isAdmin && session.userId !== instructorId) { res.status(403).json({ error: "Access denied" }); return; }
  const masked = (accountNumber || "").replace(/./g, (c: string, i: number) =>
    i < (accountNumber.length - 4) ? "*" : c
  );
  const idx = state.bankAccounts.findIndex((b: any) => b.instructorId === instructorId);
  const bankData = { id: `bank_${Date.now()}`, instructorId, bankName, accountName, accountNumber: masked, routingCode, country };
  if (idx >= 0) state.bankAccounts[idx] = bankData; else state.bankAccounts.push(bankData);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/revenue/withdraw", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { instructorId, instructorName, amount } = req.body;
  const isAdmin = session.role === "admin" || session.role === "super_admin";
  if (!isAdmin && session.userId !== instructorId) { res.status(403).json({ error: "Access denied" }); return; }

  const courses = state.courses.filter((c: any) => c.instructorId === instructorId);
  const totalRevenue = courses.reduce((sum: number, c: any) => sum + (c.enrollmentCount || 0) * (c.price || 0), 0);
  const instructorBalance = totalRevenue * 0.7;
  const withdrawals = state.withdrawalRequests.filter((w: any) => w.instructorId === instructorId && w.status !== "rejected");
  const alreadyWithdrawn = withdrawals.reduce((s: number, w: any) => s + w.amount, 0);
  const available = instructorBalance - alreadyWithdrawn;
  if (amount > available) { res.status(400).json({ error: "Insufficient balance" }); return; }
  const wr = { id: `wr_${Date.now()}`, instructorId, instructorName, amount, status: "pending", createdAt: new Date().toISOString() };
  state.withdrawalRequests.push(wr);
  saveState();
  res.json({ status: "success" });
});

app.post("/api/revenue/approve-withdrawal", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { requestId } = req.body;
  const wr = state.withdrawalRequests.find((w: any) => w.id === requestId);
  if (!wr) { res.status(404).json({ error: "Request not found" }); return; }
  wr.status = "approved";
  saveState();
  res.json({ status: "success" });
});

// ─── Assignments ─────────────────────────────────────────────────────────────

app.post("/api/assignments/submit", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const { courseId, assignmentId, content } = req.body;
  const sub = {
    id: `sub_${Date.now()}`, studentId: session.userId, courseId,
    assignmentId, content, grade: null, feedback: null, submittedAt: new Date().toISOString(),
  };
  state.assignmentSubmissions.push(sub);
  saveState();
  res.json({ status: "success", submission: sub });
});

app.post("/api/assignments/grade", (req: Request, res: Response) => {
  const session = requireAdmin(req, res);
  if (!session) return;
  const { submissionId, grade, feedback } = req.body;
  const sub = state.assignmentSubmissions.find((s: any) => s.id === submissionId);
  if (!sub) { res.status(404).json({ error: "Submission not found" }); return; }
  sub.grade = grade;
  sub.feedback = feedback || "";
  saveState();
  res.json({ status: "success" });
});

app.get("/api/assignments/instructor/:instructorId", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  const courses = state.courses.filter((c: any) => c.instructorId === req.params.instructorId).map((c: any) => c.id);
  const subs = state.assignmentSubmissions.filter((s: any) => courses.includes(s.courseId));
  res.json({ submissions: subs });
});

app.get("/api/assignments/student/:studentId", (req: Request, res: Response) => {
  const session = requireSession(req, res);
  if (!session) return;
  if (session.userId !== req.params.studentId && session.role !== "admin" && session.role !== "super_admin") {
    res.status(403).json({ error: "Access denied" }); return;
  }
  const subs = state.assignmentSubmissions.filter((s: any) => s.studentId === req.params.studentId);
  res.json({ submissions: subs });
});

// ─── AI / Gemini ─────────────────────────────────────────────────────────────

app.post("/api/gemini/tutor", async (req: Request, res: Response) => {
  const { message, courseName, userContext } = req.body;
  if (!message) { res.status(400).json({ error: "Message content required" }); return; }

  const sysPrompt = `You are 'DMA AI Assistant', an elite AI instructor at the Digital Manufacturing Academy (inspired by BCU and AIUB researchers). Your expertise spans Industry 4.0, Industry 5.0, Cyber-Physical Systems, PLC Programming (Ladder Logic), Siemens S7-1200 setups, G-code Generation, MQTT protocols, Additive Manufacturing (3D Printing with metallic FDM, SLA, SLS), Digital Twins, and industrial circular economy.

The student is currently checking: "${courseName || "General Academy Catalog"}".
User details: "${userContext || "Visitor Student"}".

Provide instant, professional, direct answers with neat technical bullet points. Keep explanations clear and encourage sustainable smart engineering. Format output as Markdown.`;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    setTimeout(() => {
      res.json({
        status: "mock_success",
        reply: `### DMA AI Assistant\n\nTo enable live AI responses, set a valid \`GEMINI_API_KEY\` in your secrets panel.\n\nHere's a quick overview about **"${message.substring(0, 50)}..."**:\n\n* **Industry 4.0 Integration:** Real-world sensors communicate over **MQTT** to publish physical parameters to an IoT broker.\n* **PLC Automation:** Siemens S7 controllers read telemetry and dispatch G-Code dynamically.\n* **Digital Twins:** Real-time synchronization between physical assets and virtual models optimizes production.\n* **Sustainability:** Diagnostic systems reduce idle factory power by up to 34%.\n\nWould you like a detailed breakdown on any specific topic?`
      });
    }, 1200);
    return;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: `${sysPrompt}\n\nStudent asks: ${message}` }] }],
    });
    res.json({ status: "success", reply: response.text || "Unable to formulate a response. Please rephrase your question." });
  } catch (error: any) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "AI engine error", details: error.message });
  }
});

// ─── Google Drive Callback ────────────────────────────────────────────────────

app.get("/drive-callback", (_req: Request, res: Response) => {
  res.send(`<!DOCTYPE html><html><head><title>Google Drive Authorization</title>
  <style>body{font-family:-apple-system,sans-serif;background:#0f172a;color:#f8fafc;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}.card{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:32px;max-width:400px}.spinner{border:3px solid rgba(255,255,255,.1);border-top:3px solid #3b82f6;border-radius:50%;width:30px;height:30px;animation:spin 1s linear infinite;margin:0 auto 16px}@keyframes spin{to{transform:rotate(360deg)}}h3{margin:8px 0;color:#3b82f6}p{color:#94a3b8;font-size:14px}</style>
  </head><body><div class="card"><div class="spinner"></div><h3>Google Drive Authorized</h3><p>Transferring credentials back to Digital Manufacturing Academy...</p></div>
  <script>const h=window.location.hash;if(h){const p=new URLSearchParams(h.substring(1)),t=p.get('access_token');if(t){if(window.opener){window.opener.postMessage({type:'GOOGLE_DRIVE_AUTH_SUCCESS',token:t},'*');setTimeout(()=>window.close(),800);}else{localStorage.setItem('dma_gd_access_token',t);document.querySelector('p').innerHTML='Credentials saved! You can close this tab.';}}}
  </script></body></html>`);
});

// ─── Vite / Static ────────────────────────────────────────────────────────────

async function startServer(): Promise<void> {
  await initializeState();

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[DMA SERVER] Academy running on http://0.0.0.0:${PORT}`);
    console.log(`[DMA SERVER] MySQL support: ${process.env.MYSQL_DATABASE_URL ? "ENABLED (Prisma)" : "NOT configured (using db_state.json)"}`);
  });
}

process.on("uncaughtException", (err) => console.error("[DMA] Uncaught exception:", err.message));
process.on("unhandledRejection", (reason) => console.error("[DMA] Unhandled rejection:", reason));

startServer();
