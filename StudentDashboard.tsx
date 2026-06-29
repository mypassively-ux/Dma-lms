import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, FileText, Award, Calendar, RefreshCw, 
  HelpCircle, CheckCircle, Upload, Send, Compass, User as UserIcon,
  Video, ExternalLink, X, ChevronLeft, ChevronRight, Presentation,
  MessageSquare
} from 'lucide-react';
import { Course, User, Enrollment, Certificate, LearningPath } from '../types';
import LearningPathsView from './LearningPathsView';

interface StudentDashboardProps {
  currentUser: User;
  courses: Course[];
  enrollments: Enrollment[];
  certificates: Certificate[];
  learningPaths?: LearningPath[];
  onEnrollInPath?: (pathId: string) => void;
  onSyncProgress: (payload: { userId: string, courseId: string, lessonId?: string, quizId?: string, score?: number, passed?: boolean }) => void;
  onExploreCourses: () => void;
}

export default function StudentDashboard({
  currentUser,
  courses,
  enrollments,
  certificates,
  learningPaths,
  onEnrollInPath,
  onSyncProgress,
  onExploreCourses,
}: StudentDashboardProps) {
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);
  const [currentlyPlayingLesson, setCurrentlyPlayingLesson] = useState<any | null>(null);
  const [activeSlideIndex, setActiveSlideIndex] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'learning' | 'paths' | 'certificates' | 'messages' | 'profile'>('learning');
  
  // Messaging states
  const [messages, setMessages] = useState<any[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [msgText, setMsgText] = useState('');
  const [msgSending, setMsgSending] = useState(false);
  const [newMsgTo, setNewMsgTo] = useState('');
  const [newMsgBody, setNewMsgBody] = useState('');
  const [newMsgOpen, setNewMsgOpen] = useState(false);
  const msgBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'messages') {
      fetch(`/api/messages/${currentUser.id}`)
        .then(r => r.json())
        .then(d => setMessages(d.messages || []))
        .catch(() => {});
    }
  }, [activeTab]);

  useEffect(() => {
    msgBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeThread, messages]);
  
  // Quiz taking states
  const [activeQuizCourse, setActiveQuizCourse] = useState<Course | null>(null);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);

  // Assignment states
  const [assignmentSubmission, setAssignmentSubmission] = useState("");
  const [assignmentFile, setAssignmentFile] = useState<string | null>(null);
  const [submittedAssignmentId, setSubmittedAssignmentId] = useState<string | null>(null);

  // Filter courses that are enrolled
  const enrolledList = enrollments
    .filter(e => e.userId === currentUser.id)
    .map(e => {
      const course = courses.find(c => c.id === e.courseId);
      return { enrollment: e, course };
    })
    .filter(item => item.course !== undefined) as Array<{ enrollment: Enrollment, course: Course }>;

  const activeEnrollmentObj = enrolledList.find(item => item.course.id === activeCourseId);

  const startQuiz = (course: Course) => {
    setActiveQuizCourse(course);
    setCurrentQuizQuestion(0);
    setSelectedAnswer(null);
    setQuizScore(0);
    setQuizFinished(false);
  };

  const handleAnswerSubmit = () => {
    if (selectedAnswer === null || !activeQuizCourse) return;

    const quiz = activeQuizCourse.quizzes[0];
    const isCorrect = selectedAnswer === quiz.questions[currentQuizQuestion].correctAnswer;
    const newScore = isCorrect ? quizScore + 1 : quizScore;
    
    setQuizScore(newScore);

    if (currentQuizQuestion + 1 < quiz.questions.length) {
      setCurrentQuizQuestion(currentQuizQuestion + 1);
      setSelectedAnswer(null);
    } else {
      // Quiz finished, save progression to server
      const passPercent = Math.floor((newScore / quiz.questions.length) * 100);
      const passed = passPercent >= quiz.passingScore;
      
      onSyncProgress({
        userId: currentUser.id,
        courseId: activeQuizCourse.id,
        quizId: quiz.id,
        score: passPercent,
        passed,
      });

      setQuizFinished(true);
    }
  };

  const handleLessonCompletion = (lessonId: string) => {
    if (!activeCourseId) return;
    onSyncProgress({
      userId: currentUser.id,
      courseId: activeCourseId,
      lessonId,
    });
  };

  const handleAssignmentSubmit = async (assignmentId: string, courseId: string, assignmentTitle: string, courseName: string) => {
    if (!assignmentSubmission.trim()) {
      alert("Please provide some text or explanation first.");
      return;
    }
    try {
      const resp = await fetch('/api/assignments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assignmentId,
          courseId,
          assignmentTitle,
          courseName,
          studentId: currentUser.id,
          studentName: currentUser.name,
          text: assignmentSubmission,
        }),
      });
      const data = await resp.json();
      if (data.status === 'success') {
        setSubmittedAssignmentId(assignmentId);
        setAssignmentSubmission("");
        setAssignmentFile(null);
        alert("Assignment submitted successfully! Your instructor will review and grade it within 48 hours.");
      }
    } catch {
      alert("Submission failed. Please try again.");
    }
  };

  const sendStudentMessage = async () => {
    if (!msgText.trim() || !activeThread) return;
    setMsgSending(true);
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: currentUser.id,
          fromName: currentUser.name,
          fromRole: currentUser.role,
          toId: activeThread,
          toName: activeThread,
          subject: 'Student Query',
          body: msgText,
        }),
      });
      setMsgText('');
      const r = await fetch(`/api/messages/${currentUser.id}`);
      const d = await r.json();
      setMessages(d.messages || []);
    } catch {} finally {
      setMsgSending(false);
    }
  };

  const sendNewStudentMessage = async () => {
    if (!newMsgTo.trim() || !newMsgBody.trim()) return;
    setMsgSending(true);
    try {
      await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromId: currentUser.id,
          fromName: currentUser.name,
          fromRole: currentUser.role,
          toId: newMsgTo,
          toName: newMsgTo,
          subject: 'Student Query',
          body: newMsgBody,
        }),
      });
      setNewMsgOpen(false);
      setNewMsgTo('');
      setNewMsgBody('');
      const r = await fetch(`/api/messages/${currentUser.id}`);
      const d = await r.json();
      setMessages(d.messages || []);
    } catch {} finally {
      setMsgSending(false);
    }
  };

  return (
    <div className="relative text-white min-h-screen pt-24 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto" id="student-dashboard">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(37,99,235,0.06),transparent_50%)] z-0 pointer-events-none" />
      
      {/* Upper Navigation Header */}
      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-6 mb-8 text-left">
        <div>
          <div className="text-xs font-bold text-blue-400 capitalize mb-1">
            Student Dashboard • Pro Academy membership active
          </div>
          <h2 className="text-2xl font-extrabold text-slate-100">
            Welcome back, {currentUser.name}!
          </h2>
          <p className="text-xs text-slate-400">Track and advance your Industry 4.0 certifications.</p>
        </div>

        {/* Navigation tabs */}
        <div className="flex flex-wrap gap-2">
          {['learning', 'paths', 'certificates', 'messages', 'profile'].map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab as any); setActiveCourseId(null); setActiveQuizCourse(null); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                activeTab === tab 
                  ? 'bg-blue-600/25 text-blue-400 border border-blue-500/30' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              {tab.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Main workspaces */}
      <div className="relative z-10">
        {activeTab === 'learning' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 text-left">
            {/* Left sidebar - Enrolled Courses Index */}
            <div className="lg:col-span-4 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">My Enrolled Courses</h3>
              
              {enrolledList.length === 0 ? (
                <div className="p-6 rounded-2xl glass-card text-center space-y-4">
                  <Compass className="w-10 h-10 mx-auto text-slate-600 animate-spin" style={{ animationDuration: '6s' }} />
                  <p className="text-xs text-slate-400 leading-relaxed">No enrolled programs found. Go to the course catalog to enroll in our British Council funded courses!</p>
                  <button 
                    onClick={onExploreCourses}
                    className="px-4 py-2 mt-2 rounded bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors cursor-pointer shadow-md"
                  >
                    Explore Courses
                  </button>
                </div>
              ) : (
                enrolledList.map(({ enrollment, course }) => {
                  const isActive = activeCourseId === course.id;
                  return (
                    <div
                      key={course.id}
                      onClick={() => { setActiveCourseId(course.id); setActiveQuizCourse(null); }}
                      className={`p-4.5 rounded-xl border transition-all cursor-pointer ${
                        isActive 
                          ? 'border-blue-500 bg-blue-600/10 shadow-lg shadow-blue-550/5' 
                          : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="text-[9px] font-mono font-bold text-blue-400 uppercase mb-1 block">
                        {course.category}
                      </span>
                      <h4 className="text-xs font-bold leading-snug line-clamp-2">{course.title}</h4>
                      
                      {/* Course progress indicator */}
                      <div className="mt-3.5 space-y-1.5">
                        <div className="flex justify-between text-[10px] text-slate-400">
                          <span>Progress:</span>
                          <span className="font-bold text-blue-400">{enrollment.progress}%</span>
                        </div>
                        <div className="w-full bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div className="bg-gradient-to-r from-blue-600 to-indigo-500 h-full rounded-full transition-all" style={{ width: `${enrollment.progress}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Right Workstation: Lesson video player and homework assignments */}
            <div className="lg:col-span-8">
              {activeEnrollmentObj ? (
                <div className="space-y-6">
                  {/* Title Header */}
                  <div className="p-5 rounded-2xl glass-card text-left flex justify-between items-start gap-4">
                    <div>
                      <span className="text-[10px] font-mono font-bold text-blue-400 block mb-1">DIGITAL WORKSPACE LEADERBOARD</span>
                      <h3 className="text-base font-extrabold text-white">{activeEnrollmentObj.course.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">Lead instructor: <b className="text-slate-300">{activeEnrollmentObj.course.instructorName}</b></p>
                    </div>
                    {currentlyPlayingLesson && (
                      <button
                        onClick={() => setCurrentlyPlayingLesson(null)}
                        className="px-2.5 py-1 bg-white/5 border border-white/10 text-[9px] font-mono font-bold uppercase rounded hover:bg-white/10 text-slate-300"
                      >
                        Minimize Classroom
                      </button>
                    )}
                  </div>

                  {/* Active classroom stream / textbook terminal */}
                  {currentlyPlayingLesson && (
                    <div className="p-6 rounded-2xl border border-[#00aaff]/20 bg-slate-950/80 space-y-5 animate-fade-in text-left shadow-2xl">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div>
                          <span className="text-[9px] font-mono font-bold text-blue-400 uppercase bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/10 mr-2">
                            {currentlyPlayingLesson.type}
                          </span>
                          <span className="text-xs font-bold text-white">{currentlyPlayingLesson.title}</span>
                        </div>
                        <button
                          onClick={() => setCurrentlyPlayingLesson(null)}
                          className="text-slate-400 hover:text-white"
                          title="Minimize lesson"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Video Player Render Space */}
                      {currentlyPlayingLesson.type === 'video' && currentlyPlayingLesson.contentUrl && (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-black border border-white/5 shadow-2xl">
                          {(() => {
                            const embedUrl = (() => {
                              const url = currentlyPlayingLesson.contentUrl;
                              const src = currentlyPlayingLesson.videoSource;
                              if (src === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be')) {
                                const id = url.includes('embed/') ? url.split('embed/')[1]?.split('?')[0] : url.includes('v=') ? url.split('v=')[1]?.split('&')[0] : url.split('/').pop()?.split('?')[0];
                                return `https://www.youtube.com/embed/${id || '5FpY9C8HIn8'}`;
                              }
                              if (src === 'vimeo' || url.includes('vimeo.com')) {
                                const id = url.includes('video/') ? url.split('video/')[1]?.split('?')[0] : url.split('/').pop()?.split('?')[0];
                                return `https://player.vimeo.com/video/${id || '224392349'}`;
                              }
                              return null;
                            })();

                            if (embedUrl) {
                              return (
                                <iframe
                                  src={embedUrl}
                                  className="absolute inset-0 w-full h-full"
                                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                  allowFullScreen
                                  title="Lecture Video Broadcast"
                                />
                              );
                            } else {
                              return (
                                <video
                                  src={currentlyPlayingLesson.contentUrl}
                                  controls
                                  className="absolute inset-0 w-full h-full"
                                />
                              );
                            }
                          })()}
                        </div>
                      )}

                      {/* Google Slides Embedded Presentation */}
                      {currentlyPlayingLesson.type === 'pptx' && currentlyPlayingLesson.contentUrl && (
                        <div className="relative w-full rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-slate-950">
                          <div className="flex items-center justify-between px-4 py-2 bg-slate-900/90 border-b border-white/5">
                            <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-400 font-extrabold tracking-wider uppercase">
                              <Presentation className="w-3.5 h-3.5" />
                              <span>DMA Slides Player (Google Slides)</span>
                            </div>
                            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-400 font-bold font-mono">BCU • AIUB TNE</span>
                          </div>
                          <div style={{ position: 'relative', paddingTop: '56.25%' }}>
                            <iframe
                              src={currentlyPlayingLesson.contentUrl}
                              style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                              allowFullScreen
                              title={currentlyPlayingLesson.title}
                            />
                          </div>
                        </div>
                      )}

                      {/* PPTX Slides Player Space (fallback — no embed URL) */}
                      {((currentlyPlayingLesson.type === 'pptx' && !currentlyPlayingLesson.contentUrl) || 
                        (currentlyPlayingLesson.type === 'video' && !currentlyPlayingLesson.contentUrl)) && (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-slate-950/80 border border-white/5 shadow-2xl flex flex-col justify-between p-6 sm:p-8 text-left group">
                          {/* Top Bar Info */}
                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 border-b border-white/5 pb-2">
                            <div className="flex items-center gap-1.5">
                              <Presentation className="w-3.5 h-3.5 text-blue-400" />
                              <span className="tracking-wider uppercase font-extrabold text-blue-400">DMA Slides Player (PPTX)</span>
                            </div>
                            <span className="text-[9px] bg-white/5 px-2 py-0.5 rounded text-slate-400 font-bold">Birmingham City • AIUB TNE Support</span>
                          </div>

                          {/* Interactive Slide Body */}
                          {(() => {
                            const slides = currentlyPlayingLesson.slides || [
                              {
                                title: "Module Presentation: " + currentlyPlayingLesson.title,
                                content: currentlyPlayingLesson.richTextContent || "Core syllabus slide content co-developed with expert investigators.",
                                bullets: [
                                  "No video broadcasting stream attached; slideshow model enabled.",
                                  "Click \"Next\" or \"Prev\" buttons below to move between slides.",
                                  "Verify other resources and proceed to certification examinations."
                                ]
                              }
                            ];

                            const activeIdx = Math.min(Math.max(0, activeSlideIndex), slides.length - 1);
                            const slide = slides[activeIdx] || slides[0];

                            return (
                              <div className="flex-1 flex flex-col justify-center py-4 text-left">
                                <h4 className="text-sm sm:text-base font-black tracking-tight text-white mb-2 uppercase border-l-2 border-blue-500 pl-3">
                                  {slide.title}
                                </h4>
                                {slide.content && (
                                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                                    {slide.content}
                                  </p>
                                )}
                                {slide.bullets && slide.bullets.length > 0 && (
                                  <ul className="text-[11px] text-slate-400 space-y-1 sm:space-y-1.5 list-disc pl-5">
                                    {slide.bullets.map((b: string, bIdx: number) => (
                                      <li key={bIdx} className="leading-snug">
                                        {b}
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            );
                          })()}

                          {/* Control Footer */}
                          {(() => {
                            const slides = currentlyPlayingLesson.slides || [
                              { title: "Slide 1" }
                            ];
                            const activeIdx = Math.min(Math.max(0, activeSlideIndex), slides.length - 1);

                            return (
                              <div className="flex items-center justify-between border-t border-white/5 pt-3 text-[10px] font-mono">
                                <div className="text-slate-500">
                                  Slide <b className="text-blue-400">{activeIdx + 1}</b> of <b className="text-slate-350">{slides.length}</b>
                                </div>

                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setActiveSlideIndex(prev => Math.max(0, prev - 1))}
                                    disabled={activeIdx === 0}
                                    className="p-1 px-3 bg-white/5 hover:bg-white/10 text-slate-350 rounded disabled:opacity-20 transition cursor-pointer"
                                  >
                                    <ChevronLeft className="w-3.5 h-3.5 inline mr-1" />
                                    <span>Prev</span>
                                  </button>
                                  <button
                                    onClick={() => setActiveSlideIndex(prev => Math.min(slides.length - 1, prev + 1))}
                                    disabled={activeIdx === slides.length - 1}
                                    className="p-1 px-3 bg-blue-600/20 hover:bg-blue-600/35 text-blue-400 rounded disabled:opacity-20 transition cursor-pointer font-bold border border-blue-500/10"
                                  >
                                    <span>Next</span>
                                    <ChevronRight className="w-3.5 h-3.5 inline ml-1" />
                                  </button>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* PDF Preview rendering or downloads */}
                      {currentlyPlayingLesson.type === 'pdf' && (
                        <div className="p-6 rounded-xl bg-slate-900/60 border border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4 animate-fade-in leading-relaxed">
                          <div className="flex items-center gap-3 text-left">
                            <div className="w-12 h-12 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                              <FileText className="w-6 h-6 text-emerald-400" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-200">Engineering Document Attached</div>
                              <p className="text-[10px] text-slate-400 mt-1 font-mono">Reference ID: Google Drive Reference Sync</p>
                            </div>
                          </div>
                          
                          <a
                            href={currentlyPlayingLesson.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold text-xs rounded-lg flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-650/20"
                          >
                            <ExternalLink className="w-4 h-4" />
                            <span>Preview Manual in Google Drive</span>
                          </a>
                        </div>
                      )}

                      {/* Google Drive Link Extra Info Block */}
                      {currentlyPlayingLesson.driveFileId && (
                        <div className="p-3 bg-[#112435]/40 border border-[#00aaff]/15 text-[#00ddff] text-[10px] rounded-xl flex items-center justify-between font-mono animate-fade-in leading-normal">
                          <span>🌐 Joint BCU-AIUB Sandbox: Linked workspace file connected.</span>
                          <a
                            href={currentlyPlayingLesson.contentUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="underline font-bold hover:text-white"
                          >
                            Open Attached Workstation File ↗
                          </a>
                        </div>
                      )}

                      {/* Lesson Rich Textbook sheet */}
                      {currentlyPlayingLesson.richTextContent && (
                        <div className="p-5.5 rounded-xl bg-zinc-950 border border-white/5 text-left text-slate-350 space-y-3 shadow-inner">
                          <span className="text-[9px] font-bold text-[#00ddff] uppercase font-mono tracking-widest block">Pedagogical Lesson Terminal Guide:</span>
                          <div className="font-mono text-xs text-slate-300 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto pr-1">
                            {currentlyPlayingLesson.richTextContent}
                          </div>
                        </div>
                      )}

                      {/* Completion check inside player container */}
                      <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 font-mono">Completed lessons logs automatically synchronized with Hostinger Mysql servers</span>
                        
                        <button
                          onClick={() => {
                            handleLessonCompletion(currentlyPlayingLesson.id);
                          }}
                          className={`p-2 px-5 text-xs font-bold font-sans rounded-lg cursor-pointer flex items-center gap-1.5 transition-all ${
                            activeEnrollmentObj.enrollment.completedLessons.includes(currentlyPlayingLesson.id)
                              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:opacity-95 shadow-md shadow-blue-500/10'
                          }`}
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>
                            {activeEnrollmentObj.enrollment.completedLessons.includes(currentlyPlayingLesson.id)
                              ? '✓ Successfully Cleared'
                              : 'Mark as Finished'}
                          </span>
                        </button>
                      </div>

                    </div>
                  )}

                  {/* Syllabus / Milestone listing */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Lesson Matrix & Sync Milestones</h4>
                    {activeEnrollmentObj.course.lessons.map((lesson, idx) => {
                      const isDone = activeEnrollmentObj.enrollment.completedLessons.includes(lesson.id);
                      return (
                        <div 
                          key={lesson.id}
                          className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-white/10 hover:bg-white/[0.04] transition"
                        >
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-blue-500/10 text-blue-400 flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <div>
                              <span className="text-[9px] font-mono uppercase bg-white/5 text-blue-400 px-2 py-0.5 rounded font-bold mr-2 border border-white/10">
                                {lesson.type}
                              </span>
                              <span className="text-xs text-blue-400 font-mono">{lesson.duration}</span>
                              <div className="text-xs font-bold mt-1 text-slate-100">{lesson.title}</div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setCurrentlyPlayingLesson(lesson);
                                setActiveSlideIndex(0);
                                window.scrollTo({ top: 300, behavior: 'smooth' });
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[11px] font-bold text-slate-250 flex items-center gap-1 cursor-pointer"
                            >
                              {lesson.type === 'pptx' || (lesson.type === 'video' && !lesson.contentUrl) ? (
                                <Presentation className="w-3 h-3 text-blue-400" />
                              ) : lesson.type === 'video' ? (
                                <Play className="w-3 h-3 text-blue-400" />
                              ) : (
                                <FileText className="w-3 h-3 text-emerald-400" />
                              )}
                              <span>
                                {lesson.type === 'pptx' || (lesson.type === 'video' && !lesson.contentUrl)
                                  ? 'Study Class Slides'
                                  : lesson.type === 'video'
                                  ? 'Study Studio Stream'
                                  : 'Study Document Guide'}
                              </span>
                            </button>
                            
                            <button
                              onClick={() => handleLessonCompletion(lesson.id)}
                              className={`px-3 py-1.5 rounded-lg border font-bold text-[11px] cursor-pointer transition-all ${
                                isDone 
                                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' 
                                  : 'bg-blue-600 hover:bg-blue-500 text-white border-transparent shadow-[0_2px_10px_rgba(37,99,235,0.2)]'
                              }`}
                            >
                              {isDone ? '✓ Completed' : 'Mark Complete'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Quiz assessment triggers */}
                  {activeEnrollmentObj.course.quizzes.length > 0 && (
                    <div className="p-6 rounded-2xl border border-blue-500/20 bg-blue-600/5 backdrop-blur shadow-sm space-y-4">
                      <div className="flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-blue-400 shrink-0" />
                        <h4 className="text-sm font-extrabold text-slate-100">Synchronous Exam Gate:</h4>
                      </div>
                      <p className="text-xs text-slate-300">You must pass this multi-choice module to qualify for the Birmingham co-signed certificate.</p>
                      
                      {activeEnrollmentObj.enrollment.quizAttempts[activeEnrollmentObj.course.quizzes[0].id]?.passed ? (
                        <div className="p-3.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold text-xs flex items-center gap-2 animate-fade-in">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          <span>Passed Exam! ({activeEnrollmentObj.enrollment.quizAttempts[activeEnrollmentObj.course.quizzes[0].id].score}% score)</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => startQuiz(activeEnrollmentObj.course)}
                          className="px-4.5 py-2 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                        >
                          Start Quiz Examination
                        </button>
                      )}
                    </div>
                  )}

                  {/* Submission and file homework logs */}
                  <div className="p-6 rounded-2xl glass-card space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Assignment Delivery Desk</h4>
                    <p className="text-[11px] text-slate-400">Complete the manufacturing project simulation instructions. Paste your G-Code scripts or assembly twin parameters below for grading verification.</p>
                    
                    <div className="space-y-3">
                      <textarea
                        value={assignmentSubmission}
                        onChange={e => setAssignmentSubmission(e.target.value)}
                        placeholder="Paste G-Code setup or structural parameters here..."
                        rows={4}
                        className="w-full text-xs font-mono p-3 rounded-lg glass-input focus:border-blue-500 text-slate-200"
                      />
                      
                      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-300 cursor-pointer">
                            <Upload className="w-3.5 h-3.5 text-blue-400" />
                            <span>Select CAD File</span>
                            <input 
                              type="file" 
                              className="hidden" 
                              onChange={() => {
                                setAssignmentFile("GCODE_ROBOTICS_REACTION_TWIN_MOCKED.pdf");
                                alert("Simulation file loaded as payload!");
                              }} 
                              id="cad-upload-input"
                            />
                          </label>
                          {assignmentFile && <span className="text-[10px] text-blue-400 font-mono">{assignmentFile}</span>}
                        </div>

                        <button
                          onClick={() => handleAssignmentSubmit('a_mock_1', activeEnrollmentObj?.course?.id || '', 'Practical Lab Assignment', activeEnrollmentObj?.course?.title || '')}
                          className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1 cursor-pointer transition-all shadow-md shadow-emerald-600/10"
                        >
                          <Send className="w-3 h-3" />
                          <span>Submit Work</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-12 rounded-3xl glass-card text-center space-y-4 shadow-sm max-w-xl mx-auto">
                  <Compass className="w-12 h-12 text-blue-500 mx-auto animate-pulse" />
                  <h4 className="text-sm font-bold text-slate-300">Workspace Selection Required</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">Click on one of your enrolled courses in the left index column to open lesson files, sync progress meters, or attempt examination quizzes!</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Messages Tab */}
        {activeTab === 'messages' && (
          <div className="space-y-6 text-left animate-fade-in">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Inbox & Messages</h3>
              <button
                onClick={() => setNewMsgOpen(v => !v)}
                className="px-4 py-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold rounded-lg hover:bg-blue-600/30 flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5" /> New Message
              </button>
            </div>

            {newMsgOpen && (
              <div className="p-5 rounded-xl glass-card space-y-3">
                <h4 className="text-xs font-bold text-slate-300 uppercase">Compose New Message</h4>
                <input
                  value={newMsgTo}
                  onChange={e => setNewMsgTo(e.target.value)}
                  placeholder="Recipient user ID or instructor ID..."
                  className="w-full text-xs p-2.5 rounded-lg glass-input text-white"
                />
                <textarea
                  value={newMsgBody}
                  onChange={e => setNewMsgBody(e.target.value)}
                  placeholder="Write your message..."
                  rows={3}
                  className="w-full text-xs p-2.5 rounded-lg glass-input text-white resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setNewMsgOpen(false)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white cursor-pointer">Cancel</button>
                  <button
                    onClick={sendNewStudentMessage}
                    disabled={msgSending}
                    className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3 h-3" /> Send
                  </button>
                </div>
              </div>
            )}

            {messages.length === 0 ? (
              <div className="p-10 rounded-xl glass-card text-center space-y-3">
                <MessageSquare className="w-10 h-10 mx-auto text-slate-600" />
                <p className="text-xs text-slate-500 italic">No messages yet. Start a conversation with your instructor!</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1 space-y-2">
                  {Array.from(new Set(messages.map((m: any) => m.fromId === currentUser.id ? m.toId : m.fromId))).map((threadId: any) => {
                    const threadMsgs = messages.filter((m: any) => m.fromId === threadId || m.toId === threadId);
                    const last = threadMsgs[threadMsgs.length - 1];
                    const name = last?.fromId === currentUser.id ? last?.toName : last?.fromName;
                    return (
                      <div
                        key={threadId}
                        onClick={() => setActiveThread(threadId)}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          activeThread === threadId
                            ? 'border-blue-500/40 bg-blue-600/10'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-200">{name || threadId}</div>
                        <p className="text-[10px] text-slate-500 truncate mt-0.5">{last?.body}</p>
                      </div>
                    );
                  })}
                </div>

                <div className="md:col-span-2 p-4 rounded-xl glass-card flex flex-col gap-3" style={{ minHeight: 320 }}>
                  {activeThread ? (
                    <>
                      <div className="flex-1 space-y-2 overflow-y-auto max-h-64 pr-1">
                        {messages
                          .filter((m: any) => m.fromId === activeThread || m.toId === activeThread)
                          .map((m: any, i: number) => {
                            const isMine = m.fromId === currentUser.id;
                            return (
                              <div key={i} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[75%] px-3 py-2 rounded-xl text-xs ${isMine ? 'bg-blue-600/25 text-blue-100' : 'bg-white/5 text-slate-300'}`}>
                                  <p>{m.body}</p>
                                  <span className="text-[9px] opacity-50 block mt-0.5">{new Date(m.timestamp).toLocaleTimeString()}</span>
                                </div>
                              </div>
                            );
                          })}
                        <div ref={msgBottomRef} />
                      </div>
                      <div className="flex gap-2 pt-2 border-t border-white/5">
                        <input
                          value={msgText}
                          onChange={e => setMsgText(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && sendStudentMessage()}
                          placeholder="Type a reply..."
                          className="flex-1 text-xs p-2.5 rounded-lg glass-input text-white"
                        />
                        <button
                          onClick={sendStudentMessage}
                          disabled={msgSending || !msgText.trim()}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                          <Send className="w-3 h-3" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-500 text-xs">Select a conversation to view messages</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Learning Paths Specialization Tab */}
        {activeTab === 'paths' && (
          <div className="space-y-8 animate-fade-in text-left">
            <LearningPathsView
              currentUser={currentUser}
              courses={courses}
              learningPaths={learningPaths || []}
              enrollments={enrollments}
              onEnrollPath={async (pathId) => {
                if (onEnrollInPath) onEnrollInPath(pathId);
              }}
            />
          </div>
        )}

        {/* Certificates view tab */}
        {activeTab === 'certificates' && (
          <div className="space-y-8 text-left">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-2">My Co-Signed Certifications</h3>
            
            {certificates.length === 0 ? (
              <div className="p-12 rounded-3xl glass-card text-center space-y-4 max-w-xl mx-auto">
                <Award className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                <h4 className="text-sm font-bold text-slate-400">No Certificates Released</h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">Complete 100% video hours and pass core exams for your enrolled courses to automatically unlock certificates.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-1">
                {certificates.map(cert => (
                  <div key={cert.id} className="p-6 rounded-2xl glass-card space-y-6 relative overflow-hidden group hover:border-white/20 transition-all duration-350">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full pointer-events-none" />
                    
                    {/* Compact Interactive Certificate Canvas Display */}
                    <div className="p-6 border border-white/10 rounded-xl bg-slate-950/70 text-center space-y-4">
                      {/* Badge and Title */}
                      <div className="flex flex-col items-center gap-1.5">
                        <Award className="w-10 h-10 text-blue-400 animate-bounce" style={{ animationDuration: '4s' }} />
                        <span className="text-[9px] uppercase font-bold tracking-widest text-blue-400 font-sans">BRITISH COUNCIL SPECIALIST PATHWAYS</span>
                        <h4 className="text-xs font-bold uppercase text-slate-200">ACCREDITED ACADEMIC CREDENTIAL</h4>
                      </div>

                      {/* Recipient info */}
                      <div className="space-y-1">
                        <span className="text-[9px] text-slate-504 italic block">Released to:</span>
                        <div className="text-sm font-serif font-bold text-blue-400 tracking-wide underline decoration-blue-500 decoration-1 decoration-dashed">
                          {cert.userName}
                        </div>
                      </div>

                      {/* Course verification */}
                      <div className="space-y-1 text-xs">
                        <span className="text-[9px] text-slate-500 italic block">For successfully passing:</span>
                        <span className="font-sans font-bold text-slate-300 leading-snug block">{cert.courseTitle}</span>
                        <span className="text-[9px] text-slate-500 font-mono block mt-1">Released at: {cert.issuedAt}</span>
                      </div>

                      {/* Signers representation */}
                      <div className="grid grid-cols-2 gap-4 border-t border-white/5 pt-3">
                        <div className="text-left text-[8px] text-slate-500 leading-normal">
                          <b className="text-slate-400 font-bold">Prof. Dr. A. Rahman</b><br />
                          Lead Investigator, AIUB
                        </div>
                        <div className="text-right text-[8px] text-slate-500 leading-normal">
                          <b className="text-slate-400 font-bold">Dr. Javaid Butt</b><br />
                          BCU Lead, United Kingdom
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono text-slate-500 pt-2 border-t border-white/5">
                      <span>UUID ID: {cert.id}</span>
                      <button 
                        onClick={() => alert(`Certificate verification system is fully active in this workspace! Unique code is recorded. Reference UUID can be validated in our Postgres schema certificates table.`)}
                        className="text-blue-400 font-bold hover:underline"
                      >
                        Verify Credential
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Profile Settings view tab */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 text-left">
            {/* Account Details */}
            <div className="p-6 rounded-2xl glass-card space-y-5">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">Account Particulars</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full border border-blue-500 overflow-hidden bg-slate-950">
                    <img src={currentUser.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{currentUser.name}</h4>
                    <span className="text-xs text-blue-400">Joined Academy on {currentUser.joinedAt}</span>
                  </div>
                </div>

                <div className="space-y-1.5 font-mono text-xs text-slate-400 pt-2">
                  <p><b>Registered Email:</b> {currentUser.email}</p>
                  <p><b>User Role:</b> <span className="capitalize text-blue-450 font-bold">{currentUser.role}</span></p>
                  <p><b>Membership Tier:</b> <span className="capitalize text-blue-450 font-bold">{currentUser.subscriptionPlan} Access</span></p>
                </div>
              </div>
            </div>

            {/* Simulated Payment Logs */}
            <div className="p-6 rounded-2xl glass-card space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 font-sans">Corporate Invoice Billing History</h3>
              <div className="space-y-3 font-mono text-xs">
                {[
                  { date: '2025-05-01', desc: 'SaaS Professional Path Activation', amt: '$79.00', status: 'Paid', method: 'Visa ending 4890' },
                  { date: '2025-04-01', desc: 'SaaS Professional Path Renewal', amt: '$79.00', status: 'Paid', method: 'Visa ending 4890' }
                ].map((inv, idx) => (
                  <div key={idx} className="p-3 bg-white/[0.02] rounded-lg border border-white/5 flex justify-between">
                    <div>
                      <div className="font-bold text-slate-300">{inv.desc}</div>
                      <span className="text-[10px] text-slate-500">{inv.date} via {inv.method}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-extrabold text-blue-400">{inv.amt}</div>
                      <span className="text-[9px] text-emerald-400 font-bold uppercase">{inv.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Embedded Quiz Modal when active */}
      {activeQuizCourse && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="p-8 sm:p-10 rounded-3xl glass-dialog max-w-lg w-full text-left space-y-6 shadow-2xl">
            <h3 className="text-sm font-bold uppercase tracking-widest text-blue-400 font-mono">
              SECTION COURSE EXAM
            </h3>
            
            {!quizFinished ? (
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between items-center text-xs text-slate-405 mb-2 font-mono">
                    <span>Question {currentQuizQuestion + 1} of {activeQuizCourse.quizzes[0].questions.length}</span>
                    <span className="text-blue-400">Minimum passing grade: {activeQuizCourse.quizzes[0].passingScore}%</span>
                  </div>
                  <h4 className="text-sm font-bold text-slate-100 leading-snug">
                    {activeQuizCourse.quizzes[0].questions[currentQuizQuestion].question}
                  </h4>
                </div>

                <div className="space-y-3">
                  {activeQuizCourse.quizzes[0].questions[currentQuizQuestion].options.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      onClick={() => setSelectedAnswer(oIdx)}
                      className={`w-full text-left p-4 rounded-xl border text-xs font-semibold select-none transition-all cursor-pointer ${
                        selectedAnswer === oIdx 
                          ? 'border-blue-500 bg-blue-600/20 text-white font-bold shadow-inner' 
                          : 'border-white/5 bg-white/[0.02] text-slate-350 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                  <button
                    onClick={handleAnswerSubmit}
                    disabled={selectedAnswer === null}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-bold transition-all cursor-pointer shadow-lg shadow-blue-500/20"
                  >
                    Submit Option
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6 text-center">
                <div className="w-16 h-16 rounded-full bg-blue-500/10 mx-auto flex items-center justify-center font-bold text-2xl text-blue-400 animate-bounce">
                  📊
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-white">Quiz Exam Finished</h4>
                  <p className="text-xs text-slate-450 mt-1">
                    Your final score is: <b>{Math.floor((quizScore / activeQuizCourse.quizzes[0].questions.length) * 100)}%</b>
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-blue-650/10 border border-blue-500/15 text-slate-300 text-xs text-left max-w-sm mx-auto">
                  {Math.floor((quizScore / activeQuizCourse.quizzes[0].questions.length) * 100) >= activeQuizCourse.quizzes[0].passingScore ? (
                    <span className="text-emerald-400 font-bold">✓ Congratulations! You cleared the passing threshold. Dynamic certificates are computed instantly onto your cert tab.</span>
                  ) : (
                    <span className="text-red-400 font-bold">✗ Retake recommended. Clear {activeQuizCourse.quizzes[0].passingScore}%+ score to qualify. You can re-attempt immediately in this workstation.</span>
                  )}
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => setActiveQuizCourse(null)}
                    className="px-4.5 py-2 rounded-lg border border-white/10 bg-white/5 text-slate-300 text-xs font-bold hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    Close Exam Tab
                  </button>
                  {Math.floor((quizScore / activeQuizCourse.quizzes[0].questions.length) * 100) < activeQuizCourse.quizzes[0].passingScore && (
                    <button
                      onClick={() => startQuiz(activeQuizCourse)}
                      className="px-4.5 py-2 rounded-lg bg-blue-605 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Retry Quiz Exam
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
