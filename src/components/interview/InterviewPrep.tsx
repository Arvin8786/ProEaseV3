import React, { useState, useRef, useEffect, useMemo } from 'react';
import { UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Mic2, 
  Video, 
  Sparkles, 
  MessageSquare, 
  Play, 
  Square,
  CheckCircle2,
  BrainCircuit,
  Target,
  ArrowRight,
  Clock,
  Send,
  Loader2,
  Volume2,
  Briefcase,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ai } from '@/lib/gemini';
import { auth } from '@/lib/firebase';
import { cn } from '@/lib/utils';
import { PlanGuard } from '@/components/common/AccessGuard';

interface InterviewPrepProps {
  profile: UserProfile | null;
}

const AIAvatar = ({ isTalking, isThinking }: { isTalking: boolean; isThinking: boolean }) => {
  return (
    <div className="relative w-80 h-80 flex flex-col items-center justify-center">
      {/* Background Aura */}
      <AnimatePresence>
        {(isTalking || isThinking) && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: isTalking ? [1, 1.1, 1] : 1.05, 
              opacity: [0.1, 0.2, 0.1] 
            }}
            exit={{ opacity: 0 }}
            transition={{ 
              duration: isTalking ? 0.8 : 2.5, 
              repeat: Infinity,
              ease: "easeInOut"
            }}
            className="absolute inset-0 bg-primary/30 rounded-full blur-[100px]"
          />
        )}
      </AnimatePresence>

      <motion.div 
        animate={{ y: [0, -4, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="relative z-10 w-64 h-64 rounded-full border-8 border-white/20 shadow-2xl overflow-hidden group"
      >
        <img 
          src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=800" 
          alt="AI Interviewer" 
          className={cn(
            "w-full h-full object-cover transition-all duration-700",
            isTalking ? "scale-105 saturate-[1.2]" : "saturate-[0.8]"
          )}
          referrerPolicy="no-referrer"
        />
        
        {/* Thinking Overlay */}
        <AnimatePresence>
          {isThinking && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-primary/20 backdrop-blur-[2px] flex items-center justify-center"
            >
               <div className="flex gap-2">
                {[0, 0.2, 0.4].map(d => (
                  <motion.div 
                    key={d}
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 0.8, delay: d, repeat: Infinity }}
                    className="w-3 h-3 bg-white rounded-full shadow-lg"
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Talking Pulse */}
        {isTalking && (
          <div className="absolute inset-0 border-4 border-primary/50 animate-ping rounded-full pointer-events-none" />
        )}
      </motion.div>

      <motion.div 
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mt-6 bg-slate-900/90 backdrop-blur-xl px-8 py-3 rounded-2xl border border-white/20 text-[10px] font-black tracking-[0.3em] text-white uppercase shadow-2xl"
      >
        ProEase Senior Recruiter AI
      </motion.div>
    </div>
  );
};

export function InterviewPrep({ profile }: InterviewPrepProps) {
  const [mode, setMode] = useState<'selection' | 'mock' | 'qa' | 'analysis'>('selection');
  const [isRecording, setIsRecording] = useState(false);
  const [videoRef] = useState<React.RefObject<HTMLVideoElement>>(useRef<HTMLVideoElement>(null));
  const [permissionError, setPermissionError] = useState<string | null>(null);
  
  // Silence Detection
  const [lastInteractionTime, setLastInteractionTime] = useState(Date.now());
  const nudgeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const nudgedCount = useRef(0);
  
  // AI States
  const [targetRole, setTargetRole] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [lastAIQuestion, setLastAIQuestion] = useState("");
  const [userAnswer, setUserAnswer] = useState("");
  const [interviewHistory, setInterviewHistory] = useState<{ role: 'interviewer' | 'candidate', text: string }[]>([]);
  const [aiFeedback, setAiFeedback] = useState<{ quote: string, sentiment: string }[]>([]);
  
  // Analysis States
  const [generatedSummary, setGeneratedSummary] = useState("");
  const [interviewScore, setInterviewScore] = useState<number | null>(null);
  const [detailedScoreFeedback, setDetailedScoreFeedback] = useState<string>("");
  const [isSavingSummary, setIsSavingSummary] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const hasCompleteProfile = useMemo(() => {
    return profile && (profile.experience?.length > 0 || profile.education?.length > 0 || profile.skills?.length > 0);
  }, [profile]);

  const generateAIResponse = async (history: typeof interviewHistory, isNudge = false) => {
    setIsThinking(true);
    setLastInteractionTime(Date.now());
    if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
    
    try {
      const profileContext = hasCompleteProfile 
        ? `Candidate Profile: 
           Name: ${profile?.displayName}
           Headline: ${profile?.professionalSummary}
           Key Experience: ${profile?.experience?.map(e => `${e.position} at ${e.company} (${e.startDate} - ${e.endDate || 'Present'})`).join(', ')}
           Skills: ${profile?.skills?.join(', ')}`
        : "The candidate has NOT set up their profile yet. Acknowledge this politely and ask a general introductory interview question to get them started.";

      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken();
      }

      const response = await fetch('/api/secure/interview', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ profileContext, history, targetRole, isNudge })
      });

      if (!response.ok) {
        throw new Error('Secure interview API failed');
      }

      const result = await response.json();
      const text = result.text || (isNudge ? "I'm still here, take your time." : "Could you tell me more about that?");
      
      setLastAIQuestion(text);
      setInterviewHistory(prev => [...prev, { role: 'interviewer', text }]);
      
      // Update interaction time after AI finishes speaking to start the next nudge timer
      setLastInteractionTime(Date.now());

      if (result.audioData) {
        playAudio(result.audioData);
      } else {
        // Browser Speech Synthesis Fallback
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onstart = () => setIsTalking(true);
        utterance.onend = () => {
          setIsTalking(false);
          // Only start nudge timer after interviewer finishes speaking
          setLastInteractionTime(Date.now());
        };
        window.speechSynthesis.speak(utterance);
      }

      // Generate brief feedback in background (not for nudges)
      if (!isNudge) {
        generateFeedback(text, history);
      }

    } catch (err) {
      console.error("AI Generation Error:", err);
      if (!isNudge) {
        setLastAIQuestion("I apologize, I'm having trouble processing right now. Let's try again. Can you tell me about your career goals?");
      }
    } finally {
      setIsThinking(false);
    }
  };

  // Nudge Monitor Effect
  useEffect(() => {
    if (mode !== 'mock' || isThinking || isTalking) {
      if (nudgeTimerRef.current) clearTimeout(nudgeTimerRef.current);
      return;
    }

  // A real candidate takes 10-30 seconds to formulate an answer. 
    // We nudge after 10 seconds of silence if they haven't nudged too much.
    const intervalId = setInterval(() => {
      const elapsed = Date.now() - lastInteractionTime;
      if (elapsed > 10000 && nudgedCount.current < 4 && !isThinking && !isTalking) {
        nudgedCount.current += 1;
        generateAIResponse(interviewHistory, true);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [mode, lastInteractionTime, isThinking, isTalking, interviewHistory]);

  const generateFeedback = async (aiQuestion: string, history: typeof interviewHistory) => {
    if (history.length < 2) return;
    try {
      const lastAnswer = history[history.length - 1];
      if (lastAnswer.role !== 'candidate') return;

      const feedbackPrompt = `Candidate answered: "${lastAnswer.text}"
      Analyze this briefly. Provide 2 concise feedback points (one positive, one for improvement).
      Format as JSON: [{"quote": "feedback", "sentiment": "positive" | "improvement"}]`;

      const result = await ai.models.generateContent({
        contents: feedbackPrompt,
        config: { responseMimeType: "application/json" }
      });

      const parsed = JSON.parse(result.text || "[]");
      setAiFeedback(parsed);
    } catch (err) {
      console.warn("Feedback generation failed", err);
    }
  };

  const playAudio = (base64: string) => {
    try {
      const audioContent = atob(base64);
      const buffer = new Uint8Array(audioContent.length);
      for (let i = 0; i < audioContent.length; i++) {
          buffer[i] = audioContent.charCodeAt(i);
      }
      
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = audioCtx.createBuffer(1, buffer.length / 2, 24000);
      const nowBuffering = audioBuffer.getChannelData(0);
      const dataView = new DataView(buffer.buffer);
      
      for (let i = 0; i < buffer.length / 2; i++) {
          nowBuffering[i] = dataView.getInt16(i * 2, true) / 32768;
      }
      
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start();
      setIsTalking(true);
      source.onended = () => {
        setIsTalking(false);
        audioCtx.close();
      };
    } catch (err) {
      console.warn("Audio playback failed", err);
      setIsTalking(true);
      setTimeout(() => setIsTalking(false), 3000);
    }
  };

  const startInterview = async () => {
    setPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setMode('mock');
      setInterviewHistory([]);
      setAiFeedback([]);
      
      // Wait for next tick to ensure videoRef is available in the new mode
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);

      // Initial AI Question
      generateAIResponse([]);

    } catch (err: any) {
      console.error("Error accessing media devices:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionError("Camera and Microphone access was denied. Please enable permissions in your browser settings to start the simulation.");
      } else {
        setPermissionError("Could not access camera or microphone. Please ensure they are connected and not in use by another application.");
      }
    }
  };

  const stopInterview = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    
    if (interviewHistory.length > 2) {
      setMode('analysis');
      generateInterviewAnalysis();
    } else {
      setMode('selection');
    }
  };

  const generateInterviewAnalysis = async () => {
    setIsAnalyzing(true);
    setInterviewScore(null);
    setDetailedScoreFeedback("");
    try {
      const prompt = `You are a Senior Executive Talent Evaluator and Interview Coach.
      Based on the following mock interview history${targetRole ? ` for a ${targetRole} position` : ''}, evaluate the candidate's performance.
      
      History:
      ${interviewHistory.map(h => `${h.role}: ${h.text}`).join('\n')}
      
      You must evaluate their answers, professional presence, and technical/behavioral match, then provide:
      1. A numeric performance score (an integer strictly between 0 and 100, where 100 is absolute mastery).
      2. A brief 3-5 sentence professional "Career Summary" for the candidate.
      3. A concise summary of their top strengths and actionable areas of improvement.
      
      Return a raw JSON object with the following exact keys:
      {
        "score": 85,
        "summary": "The candidate demonstrated strong leadership and technical expertise. They structured their answers cleanly with positive action verbs...",
        "feedback": "Positives: Excellent STAR structure, proactive problem-solving. Areas to Improve: Could be more specific with metrics in results."
      }`;

      const result = await ai.models.generateContent({
        contents: prompt,
        config: { 
          responseMimeType: "application/json"
        }
      });

      const parsed = JSON.parse(result.text || "{}");
      const score = typeof parsed.score === 'number' ? parsed.score : 85;
      
      setInterviewScore(score);
      setGeneratedSummary(parsed.summary || "The candidate displayed excellent dedication and technical expertise inside the mock environment.");
      setDetailedScoreFeedback(parsed.feedback || "Positives: Demonstrates clear enthusiasm and communication. Improvements: Work on organizing complex results into distinct items.");

      const { logProfileActivity } = await import('@/lib/profileStorage');
      await logProfileActivity(
        profile!.uid,
        'interview',
        'completed',
        `Completed mock interview for ${targetRole || 'General Role'} with an overall performance score of ${score}%`,
        '/#interview'
      );
    } catch (err) {
      console.error("Analysis Error:", err);
      setGeneratedSummary("Unable to generate a professional summary at this time.");
      setInterviewScore(75);
      setDetailedScoreFeedback("Great effort! Review the questions you were asked and try answering with structured STAR points to increase your score.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveSummaryToProfile = async () => {
    if (!profile || !generatedSummary) return;
    setIsSavingSummary(true);
    try {
      const { saveLocalProfile, getLocalProfile } = await import('@/lib/profileStorage');
      
      const currentLocal = getLocalProfile(profile.uid);
      saveLocalProfile(profile.uid, {
        ...currentLocal,
        professionalSummary: generatedSummary,
      });
      
      alert("Summary successfully saved to your profile!");
    } catch (err) {
      console.error("Save Error:", err);
    } finally {
      setIsSavingSummary(false);
    }
  };

  const handleSendAnswer = () => {
    if (!userAnswer.trim() || isThinking) return;
    
    // Reset nudge state on user input
    setLastInteractionTime(Date.now());
    nudgedCount.current = 0;

    const newAnswer = { role: 'candidate' as const, text: userAnswer };
    const newHistory = [...interviewHistory, newAnswer];
    setInterviewHistory(newHistory);
    setUserAnswer("");
    generateAIResponse(newHistory);
  };

  const [selectedQA, setSelectedQA] = useState<number | null>(null);
  const [qaAnswer, setQaAnswer] = useState<string>("");
  const [isQAThinking, setIsQAThinking] = useState(false);

  const generateSTARAnswer = async (question: string, index: number) => {
    setSelectedQA(index);
    setQaAnswer("");
    setIsQAThinking(true);
    try {
      const profileContext = hasCompleteProfile 
        ? `Candidate Profile: 
           Experience: ${JSON.stringify(profile?.experience)}
           Skills: ${JSON.stringify(profile?.skills)}
           Summary: ${profile?.professionalSummary}`
        : "The candidate has not provided a detailed profile yet. Generate a high-quality example STAR answer for a general top-tier candidate.";

      const prompt = `You are an AI career coach. Generate a high-quality STAR (Situation, Task, Action, Result) answer for the following interview question: "${question}".
      
      CONTEXT:
      ${profileContext}
      
      REQUIREMENTS:
      1. If the candidate has relevant experience in their profile, GROUND the answer in their actual experience.
      2. If the profile is empty, provide a "Prime Example" answer.
      3. Use a professional, confident, and achievement-oriented tone.
      4. Format clearly with Situation, Task, Action, and Result headers.
      5. Keep it concise enough to be spoken in 2 minutes.`;

      const result = await ai.models.generateContent({
        contents: prompt,
      });

      setQaAnswer(result.text || "I was unable to generate an answer at this time.");
    } catch (err) {
      console.error("QA Generation Error:", err);
      setQaAnswer("An error occurred while generating your tailored answer. Please try again.");
    } finally {
      setIsQAThinking(false);
    }
  };

  const starQuestions = [
    "Tell me about a time you faced a significant technical challenge and how you overcame it.",
    "Describe a situation where you had to resolve a conflict within your team.",
    "Give an example of a time you went above and beyond for a client or project.",
    "Tell me about a time you failed or made a mistake. What did you learn?",
    "Describe a project you led from conception to completion. What were the results?",
    "How have you handled a situation where you disagreed with a supervisor's decision?"
  ];

  const [customQuestion, setCustomQuestion] = useState("");

  return (
    <PlanGuard feature="interviewPrep" profile={profile}>
      <div className="space-y-8 pb-24">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-br from-slate-900 via-slate-700 to-indigo-900 bg-clip-text text-transparent">
              Interview Prep
            </h1>
            <p className="text-slate-500 text-lg font-medium">Elevate your performance with AI-driven behavioral analysis.</p>
          </div>
          {mode !== 'selection' && (
            <Button variant="outline" onClick={stopInterview} className="rounded-xl border-slate-200 bg-white shadow-sm font-bold">
              Exit Simulation
            </Button>
          )}
        </div>

        <AnimatePresence mode="wait">
          {mode === 'selection' && (
            <motion.div 
              key="selection"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
            {permissionError && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-6 bg-red-50/50 border border-red-200 rounded-3xl flex items-start gap-4 shadow-xl"
              >
                <div className="bg-red-500 p-2 rounded-xl">
                  <Video className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-red-900 font-bold">Hardware Access Required</h3>
                  <p className="text-red-700/80 text-sm font-medium mt-1">{permissionError}</p>
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <Card className="glass-card group border-none overflow-hidden flex flex-col">
                <div className="h-2 bg-primary w-full" />
                <CardHeader className="text-center pb-6 pt-12">
                  <div className="mx-auto bg-primary/10 p-6 rounded-3xl w-fit mb-6 group-hover:bg-primary group-hover:text-white transition-all duration-500 group-hover:rotate-6 border border-primary/20">
                    <Video className="h-10 w-10 text-primary group-hover:text-white" />
                  </div>
                  <CardTitle className="text-3xl font-black tracking-tighter text-slate-900">Live Mock Interview</CardTitle>
                  <CardDescription className="text-base max-w-xs mx-auto mt-4 leading-relaxed font-medium text-slate-500">
                    Enter an immersive simulation with a reactive AI avatar that analyzes your performance in real-time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center pb-12 space-y-6 flex-1">
                  <div className="w-full max-w-sm space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 pl-4 mb-2 block">
                      Target Role (e.g. Senior Product Designer)
                    </label>
                    <Input 
                      placeholder="Enter the role you're interviewing for..." 
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value)}
                      className="h-14 rounded-2xl bg-white border-2 border-slate-100 font-bold focus:border-primary px-6"
                    />
                  </div>
                  <Button 
                    size="lg" 
                    onClick={startInterview}
                    className="rounded-2xl px-12 h-14 font-black text-lg shadow-2xl shadow-primary/20 w-full max-w-xs"
                  >
                    Start AI Simulation
                  </Button>
                </CardContent>
              </Card>

              <Card className="glass-card group cursor-pointer border-none overflow-hidden" onClick={() => setMode('qa')}>
                <div className="h-2 bg-indigo-500 w-full" />
                <CardHeader className="text-center pb-6 pt-12">
                  <div className="mx-auto bg-indigo-50 p-6 rounded-3xl w-fit mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-500 group-hover:-rotate-6 border border-indigo-200">
                    <BrainCircuit className="h-10 w-10 text-indigo-600 group-hover:text-white" />
                  </div>
                  <CardTitle className="text-3xl font-black tracking-tighter text-slate-900">STAR Question Bank</CardTitle>
                  <CardDescription className="text-base max-w-xs mx-auto mt-4 leading-relaxed font-medium text-slate-500">
                    Master common behavioral questions with AI-generated answers grounded in your profile.
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex justify-center pb-12">
                  <Button size="lg" variant="outline" className="rounded-2xl px-12 h-14 font-black text-lg border-2 border-indigo-100 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700">
                    Browse Q&A Bank
                  </Button>
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {mode === 'mock' && (
          <motion.div 
            key="mock"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8"
          >
            {/* Main Interview Stage */}
            <div className="lg:col-span-8 space-y-8">
              <div className="relative aspect-video bg-slate-950 rounded-[3rem] overflow-hidden shadow-2xl border-4 border-white/10 group">
                {/* Real Interview Environment Backdrop */}
                <div className="absolute inset-0 z-0 transition-all duration-1000">
                  <img 
                    src="https://picsum.photos/seed/corporate-office/1920/1080?blur=4" 
                    alt="Interview Room" 
                    className="w-full h-full object-cover opacity-30 saturate-50"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-indigo-950/40 via-transparent to-slate-950/80" />
                </div>

                <video ref={videoRef} autoPlay muted playsInline className="relative z-10 w-full h-full object-cover opacity-40 grayscale-[0.8] mix-blend-screen group-hover:opacity-50 transition-opacity duration-700" />
                
                {/* AI Avatar Overlay */}
                <div className="absolute inset-x-0 top-0 z-20 flex flex-col items-center justify-center pt-8 pointer-events-none">
                  <AIAvatar isTalking={isTalking} isThinking={isThinking} />
                  
                  {nudgedCount.current > 0 && !isThinking && !isTalking && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-4 bg-amber-500/90 backdrop-blur-md px-4 py-1.5 rounded-full border border-amber-400 text-[10px] font-black uppercase tracking-widest text-white shadow-xl"
                    >
                      Interviewer is waiting for your input...
                    </motion.div>
                  )}
                </div>

                <div className="absolute top-8 left-8 flex gap-3">
                  <Badge className="bg-red-500 px-3 py-1 font-black tracking-widest animate-pulse border-none">SIMULATION ACTIVE</Badge>
                  <Badge variant="secondary" className="bg-white/10 text-white backdrop-blur-xl border border-white/20 font-mono">
                    FEED: CANDIDATE_01
                  </Badge>
                </div>
                
                <div className="absolute bottom-0 inset-x-0 p-10 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
                  <div className="flex items-end justify-between">
                    <div className="flex flex-col gap-2">
                       <span className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Audio Feed Active</span>
                       <div className="flex items-center gap-3 bg-white/10 backdrop-blur-xl p-4 rounded-2xl border border-white/20 max-w-md">
                         <Volume2 className={cn("h-5 w-5 text-primary", isTalking && "animate-bounce")} />
                         <p className="text-white text-xs font-bold leading-tight opacity-40">
                           Interviewer is speaking... (Audio Only)
                         </p>
                       </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Interaction Bar */}
              <div className="glass-card p-6 flex items-center gap-4">
                <div className="flex-1 relative">
                  <Input 
                    value={userAnswer}
                    onChange={(e) => setUserAnswer(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendAnswer()}
                    placeholder="Type your response here..."
                    className="h-16 rounded-2xl border-none bg-slate-100/50 pr-16 focus-visible:ring-primary font-medium"
                    disabled={isThinking}
                  />
                  <Button 
                    size="icon" 
                    onClick={handleSendAnswer}
                    disabled={!userAnswer.trim() || isThinking}
                    className="absolute right-2 top-2 h-12 w-12 rounded-xl shadow-xl transition-all active:scale-95"
                  >
                    {isThinking ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                </div>
                <Button 
                  size="icon" 
                  variant={isRecording ? 'destructive' : 'secondary'} 
                  className="h-16 w-16 rounded-2xl shadow-xl transition-all border border-slate-200"
                  onClick={() => setIsRecording(!isRecording)}
                >
                  {isRecording ? <Square className="h-6 w-6" /> : <Mic2 className="h-6 w-6" />}
                </Button>
              </div>
            </div>

            {/* Sidebar Stats & Feedback */}
            <div className="lg:col-span-4 space-y-6">
              <Card className="glass-card border-none overflow-hidden bg-slate-900 text-white">
                 <CardHeader className="pb-4">
                   <div className="flex items-center justify-between">
                     <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-primary">Live Sentiment</CardTitle>
                     <div className="flex gap-1">
                        {[1,2,3,4].map(i => <div key={i} className={cn("w-1 h-3 rounded-full bg-primary", i > 2 && "opacity-30")} />)}
                     </div>
                   </div>
                 </CardHeader>
                 <CardContent className="space-y-6 pb-8">
                    {aiFeedback.length === 0 ? (
                      <div className="py-12 text-center opacity-40">
                        <Target className="h-8 w-8 mx-auto mb-4" />
                        <p className="text-xs font-black uppercase tracking-widest">Awaiting Answer</p>
                      </div>
                    ) : (
                      aiFeedback.map((f, i) => (
                        <motion.div 
                          key={i}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className={cn(
                            "p-5 rounded-2xl border flex gap-4",
                            f.sentiment === 'positive' ? "bg-green-500/10 border-green-500/20" : "bg-blue-500/10 border-blue-500/20"
                          )}
                        >
                          {f.sentiment === 'positive' ? <CheckCircle2 className="h-5 w-5 text-green-400 shrink-0" /> : <Sparkles className="h-5 w-5 text-blue-400 shrink-0" />}
                          <p className="text-sm font-bold leading-relaxed">{f.quote}</p>
                        </motion.div>
                      ))
                    )}
                 </CardContent>
              </Card>

              <Card className="glass-card border-none">
                <CardHeader className="border-b border-black/5">
                  <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Profile Context</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  {!hasCompleteProfile ? (
                    <div className="space-y-4">
                      <div className="bg-amber-50 rounded-2xl p-4 border border-amber-100 flex gap-3">
                        <Target className="h-5 w-5 text-amber-500 shrink-0" />
                        <p className="text-xs font-bold text-amber-800 leading-relaxed">
                          Profile missing detailed experience. Interviewer will use general curiosity prompts.
                        </p>
                      </div>
                      <Button variant="outline" className="w-full rounded-xl border-dashed">Complete Profile</Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg"><Briefcase className="h-4 w-4 text-slate-600" /></div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Role</p>
                          <p className="text-xs font-bold text-slate-900">{targetRole || profile?.professionalSummary?.substring(0, 30)}...</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="bg-slate-100 p-2 rounded-lg"><BrainCircuit className="h-4 w-4 text-slate-600" /></div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Top Skills</p>
                          <div className="flex gap-1 mt-1">
                             {profile?.skills?.slice(0, 2).map(s => <Badge key={s} variant="secondary" className="text-[8px]">{s}</Badge>)}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </motion.div>
        )}

        {mode === 'analysis' && (
          <motion.div 
            key="analysis"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-4xl mx-auto space-y-8"
          >
            <Card className="glass-card border-none shadow-2xl rounded-[3rem] overflow-hidden">
              <div className="h-2 bg-gradient-to-r from-primary via-indigo-500 to-indigo-900 w-full" />
              <CardHeader className="p-12 pb-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="bg-primary/10 p-4 rounded-3xl">
                     <Target className="h-8 w-8 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-4xl font-black tracking-tighter">Simulation Retrospective</CardTitle>
                    <CardDescription className="text-lg">AI analysis of your mock interview performance.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-12 pt-6 space-y-10">
                {/* Score Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center bg-slate-50 p-8 rounded-[2.5rem] border border-white shadow-inner">
                  <div className="flex flex-col items-center justify-center text-center p-6 bg-white rounded-3xl shadow-sm border border-slate-100">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Interview Score</span>
                    {isAnalyzing ? (
                      <Loader2 className="h-10 w-10 animate-spin text-primary mt-4" />
                    ) : (
                      <div className="relative flex items-center justify-center mt-3">
                        <span className="text-5xl font-black text-indigo-600 tracking-tighter">{interviewScore !== null ? `${interviewScore}%` : '85%'}</span>
                      </div>
                    )}
                    <span className="text-[10px] text-slate-500 font-bold mt-2">Overall Rank</span>
                  </div>
                  <div className="md:col-span-2 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Pace & Sentiment Metrics</h4>
                    {isAnalyzing ? (
                      <div className="space-y-2">
                        <div className="h-3 bg-slate-200 rounded-full w-full animate-pulse" />
                        <div className="h-3 bg-slate-200 rounded-full w-5/6 animate-pulse" />
                      </div>
                    ) : (
                      <p className="text-slate-700 text-sm font-bold leading-relaxed">
                        {detailedScoreFeedback || "Evaluating your STAR framework application, pacing mechanics, confidence quotients, and role suitability markers."}
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">AI Generated Professional Summary</h3>
                    {isAnalyzing && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                  </div>
                  <div className="relative group">
                    <div className="absolute -inset-1 bg-gradient-to-r from-primary to-indigo-600 rounded-[2.5rem] blur opacity-10 group-hover:opacity-20 transition duration-1000"></div>
                    <div className="relative p-8 bg-slate-50 rounded-[2.2rem] border border-white shadow-inner min-h-[160px]">
                      {isAnalyzing ? (
                        <div className="space-y-3">
                          <div className="h-4 bg-slate-200 rounded-full w-full animate-pulse" />
                          <div className="h-4 bg-slate-200 rounded-full w-5/6 animate-pulse" />
                          <div className="h-4 bg-slate-200 rounded-full w-4/6 animate-pulse" />
                        </div>
                      ) : (
                        <p className="text-slate-700 text-lg leading-relaxed font-medium italic">
                          "{generatedSummary}"
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button 
                    variant="outline" 
                    className="h-14 rounded-2xl font-bold border-2 border-slate-100 hover:bg-slate-50 transition-all"
                    onClick={() => setMode('selection')}
                  >
                    Return to Lobby
                  </Button>
                  <Button 
                    className="h-14 rounded-2xl font-black shadow-xl shadow-primary/20 brightness-110 active:scale-95 transition-all"
                    disabled={isAnalyzing || isSavingSummary || !generatedSummary}
                    onClick={saveSummaryToProfile}
                  >
                    {isSavingSummary ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <ShieldCheck className="mr-2 h-5 w-5" />}
                    Save to Professional Profile
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400 pl-4">Interview Log</h3>
               <div className="space-y-4">
                  {interviewHistory.slice(-6).map((item, idx) => (
                    <div key={idx} className={cn(
                      "p-6 rounded-[2rem] border shadow-sm max-w-[80%]",
                      item.role === 'interviewer' ? "bg-slate-900 text-white ml-auto" : "bg-white border-slate-100 mr-auto"
                    )}>
                      <p className="text-[10px] font-black uppercase tracking-widest opacity-50 mb-2 truncate">{item.role}</p>
                      <p className="text-sm font-bold leading-relaxed">{item.text}</p>
                    </div>
                  ))}
               </div>
            </div>
          </motion.div>
        )}

        {mode === 'qa' && (
          <motion.div 
            key="qa"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-12"
          >
            {/* Manual Question Input */}
            <Card className="glass-card border-none shadow-xl rounded-[2.5rem] overflow-hidden">
              <div className="h-2 bg-primary w-full" />
              <CardHeader className="p-8">
                <CardTitle className="text-2xl font-black tracking-tighter">Manual Question Lab</CardTitle>
                <CardDescription>Input any interview question and I'll tailor a STAR answer based on your profile.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 flex gap-4">
                <Input 
                  placeholder="e.g. Describe a time you had to pivot quickly on a project..."
                  value={customQuestion}
                  onChange={(e) => setCustomQuestion(e.target.value)}
                  className="h-16 rounded-2xl bg-slate-50 border-slate-100 font-medium text-lg px-6"
                />
                <Button 
                  className="h-16 px-10 rounded-2xl font-black shadow-xl shrink-0"
                  disabled={!customQuestion.trim() || isQAThinking}
                  onClick={() => generateSTARAnswer(customQuestion, -1)}
                >
                  {isQAThinking && selectedQA === -1 ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Sparkles className="mr-2 h-5 w-5" />}
                  Generate Tailored Answer
                </Button>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {starQuestions.map((q, i) => (
                <Card key={i} className={cn(
                  "glass-card hover:shadow-2xl transition-all cursor-pointer group border-none relative overflow-hidden",
                  selectedQA === i && "ring-2 ring-primary"
                )} onClick={() => generateSTARAnswer(q, i)}>
                  <CardHeader className="pb-4">
                    <div className="flex justify-between items-start mb-3">
                      <Badge variant="outline" className="border-slate-200">Behavioral</Badge>
                      {selectedQA === i && isQAThinking && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
                    </div>
                    <CardTitle className="text-lg font-black tracking-tight text-slate-900 group-hover:text-primary transition-colors">{q}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Button variant="ghost" size="sm" className="w-full justify-between font-bold text-slate-500 group-hover:text-primary p-0 h-auto">
                      {selectedQA === i ? "Refining Answer..." : "Generate AI STAR Answer"}
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            <AnimatePresence>
              {selectedQA !== null && qaAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  className="max-w-4xl mx-auto"
                >
                  <Card className="glass-card border-none shadow-2xl overflow-hidden rounded-[3rem]">
                    <div className="h-2 bg-primary w-full" />
                    <CardHeader className="p-10 pb-4">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="bg-primary/10 p-3 rounded-2xl">
                          <BrainCircuit className="h-6 w-6 text-primary" />
                        </div>
                        <CardTitle className="text-3xl font-black tracking-tighter">Your Tailored Answer</CardTitle>
                      </div>
                      <p className="text-slate-500 font-medium">Question: {selectedQA === -1 ? customQuestion : starQuestions[selectedQA!]}</p>
                    </CardHeader>
                    <CardContent className="p-10 pt-6">
                      <div className="prose prose-slate max-w-none">
                        <div className="whitespace-pre-wrap text-slate-700 text-lg leading-relaxed font-medium bg-slate-50 p-8 rounded-[2rem] border border-slate-100 shadow-inner">
                          {qaAnswer}
                        </div>
                      </div>
                      <div className="mt-8 flex justify-end gap-3">
                        <Button variant="outline" className="rounded-xl font-bold px-8 h-12" onClick={() => {
                          setSelectedQA(null);
                          setQaAnswer("");
                        }}>
                          Close Answer
                        </Button>
                        <Button className="rounded-xl font-bold px-8 h-12" onClick={() => {
                          navigator.clipboard.writeText(qaAnswer);
                        }}>
                          Copy to Clipboard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </PlanGuard>
  );
}
