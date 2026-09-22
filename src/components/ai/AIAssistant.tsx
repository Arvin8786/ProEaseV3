import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { UserProfile } from '@/types';
import { auth, db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  X, 
  Send, 
  Sparkles, 
  Bot,
  Loader2,
  Minimize2,
  User,
  FileText,
  Terminal,
  ShieldCheck,
  Trash2,
  Paperclip,
  RotateCcw,
  LayoutGrid,
  ChevronDown,
  ChevronUp,
  Menu,
  BrainCircuit,
  Command,
  Activity,
  Zap,
  Target,
  Briefcase,
  PenTool
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateLocalProfileField } from '@/lib/profileStorage';
import { cn } from '@/lib/utils';
import { calculateReadinessScore, getProfileTips } from '@/lib/profileUtils';
import { checkFeatureAccess } from '@/lib/limits';

// --- Types ---
interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isAction?: boolean;
  timestamp: number;
}

interface AIAssistantProps {
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// --- Data Constants ---
const RECOMMENDED_COURSES = [
  { name: "Google Data Analytics", link: "https://www.coursera.org/professional-certificates/google-data-analytics" },
  { name: "Meta Front-End Developer", link: "https://www.coursera.org/professional-certificates/meta-front-end-developer" },
  { name: "AWS Cloud Practitioner", link: "https://explore.skillbuilder.aws/learn/course/external/view/elearning/134" }
];

// --- Function Declarations for AI ---
const AI_TOOLS = [
  {
    name: "update_profile",
    description: "Updates specific fields in the user's professional profile (e.g., summary, skills, contact info).",
    parameters: {
      type: "OBJECT",
      properties: {
        field: {
          type: "STRING",
          description: "The profile field to update.",
          enum: ["professionalSummary", "skills", "displayName", "phone", "website", "linkedin"]
        },
        value: {
          type: "STRING",
          description: "The new content or value for the field."
        }
      },
      required: ["field", "value"]
    }
  },
  {
    name: "navigate_to",
    description: "Navigates the user interface to a specific app section/tab.",
    parameters: {
      type: "OBJECT",
      properties: {
        tab: {
          type: "STRING",
          description: "Target tab identifier.",
          enum: ["overview", "profile", "resume", "interview", "documents", "settings", "solver", "career"]
        }
      },
      required: ["tab"]
    }
  },
  {
    name: "generate_document",
    description: "Starts the generation process for career-related documents.",
    parameters: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          description: "Document type to generate.",
          enum: ["resume", "cover_letter", "resignation_letter"]
        }
      },
      required: ["type"]
    }
  },
  {
    name: "analyze_career_path",
    description: "Provides a deep analysis of course recommendations and profile gaps.",
    parameters: {
      type: "OBJECT",
      properties: {}
    }
  }
];

export function AIAssistant({ profile, activeTab, setActiveTab }: AIAssistantProps) {
  // UI State
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Derived Context
  const readinessScore = useMemo(() => calculateReadinessScore(profile), [profile]);
  const profileTips = useMemo(() => getProfileTips(profile), [profile]);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assistantRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (assistantRef.current && !assistantRef.current.contains(event.target as Node)) {
        if (isOpen && !isMinimized) {
          setIsMinimized(true);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, isMinimized]);

  // Initialize with welcome message if empty
  useEffect(() => {
    if (messages.length === 0) {
      const welcome = readinessScore < 40 
        ? "Hello! I'm ProEase AI, your executive career strategist. Honestly, your profile looks like a rough draft. We should probably refine your Career Vault before targeting high-tier roles. Where should we start?"
        : "Welcome back. I'm ProEase AI. I've analyzed your latest profile updates. Your readiness score is strong, but there's always room for strategic optimization. How can I assist with your career narrative today?";
      
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: welcome,
        timestamp: Date.now()
      }]);
    }
  }, [readinessScore]);

  // Auto-scroll
  const scrollToBottom = useCallback(() => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isTyping, isOpen, isMinimized, scrollToBottom]);

  // --- Actions ---
  const clearChat = () => {
    setMessages([{ 
      id: Date.now().toString(),
      role: 'assistant', 
      content: "Memory purged. Command cycle reset. What's our next objective?",
      timestamp: Date.now()
    }]);
    setIsMenuOpen(false);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const msgId = Date.now().toString();
      setMessages(prev => [...prev, { id: msgId, role: 'user', content: `[Attached Document: ${file.name}]`, timestamp: Date.now() }]);
      setIsMenuOpen(false);
      
      setTimeout(() => {
        setMessages(prev => [...prev, { 
          id: (Date.now() + 1).toString(),
          role: 'assistant', 
          content: `I've registered the receipt of "${file.name}". While I process the metadata, you should describe the specific strategic outcome you want from this document. Are we extracting experience or building a new narrative?`,
          timestamp: Date.now()
        }]);
      }, 1000);
    }
  };

  const executeTool = async (name: string, args: any) => {
    if (!profile) return "Authentication required for system modification.";

    try {
      switch(name) {
        case 'analyze_career_path':
          const links = RECOMMENDED_COURSES.map(c => `• [${c.name}](${c.link})`).join('\n');
          return `Strategic Analysis Complete. Based on your current ${readinessScore}% readiness, I recommend prioritizing these assets:\n\n${links}\n\nGap Analysis: ${profileTips.join(', ')}.`;
        
        case 'update_profile':
          const { field, value } = args;
          const currentVal = (profile as any)[field];
          
          if (field === 'skills') {
            const skills = Array.isArray(currentVal) ? currentVal : [];
            if (!skills.includes(value)) {
              await updateLocalProfileField(profile.uid, { skills: [...skills, value], updatedAt: new Date() });
              return `Successfully integrated "${value}" into your core competency list.`;
            }
            return `Skill "${value}" is already indexed in your profile.`;
          } else {
            await updateLocalProfileField(profile.uid, { [field]: value, updatedAt: new Date() });
            return `Profile field "${field}" updated with strategic refinement.`;
          }

        case 'navigate_to':
          setActiveTab(args.tab);
          return `Interface redirected to ${args.tab.toUpperCase()} control module.`;

        case 'generate_document':
          setActiveTab('documents');
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('ai_generate_doc', { detail: { type: args.type } }));
          }, 500);
          return `Document generator initialized for: ${args.type.toUpperCase()}. Switched to Documents tab.`;

        default:
          return "Unknown command sequence.";
      }
    } catch (err: any) {
      console.error("Tool Execution Failed:", err);
      return `System Error: Unable to execute ${name}. ${err.message}`;
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isTyping) return;

    // Check plan limits & expiry for AI Assistant
    const access = await checkFeatureAccess('aiAssistant', profile);
    if (!access.allowed) {
      setMessages(prev => [
        ...prev,
        { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() },
        { 
          id: (Date.now() + 1).toString(), 
          role: 'assistant', 
          content: `🔒 **Feature Restricted**\n\n${access.message}\n\nPlease upgrade or contact your administrator.`, 
          timestamp: Date.now() + 1 
        }
      ]);
      setInput('');
      return;
    }

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const history = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      // Add current message to history
      history.push({ role: 'user', parts: [{ text }] });

      const idToken = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/secure/chat', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          messages: history,
          activeTab,
          profile,
          readinessScore,
          profileTipsList: profileTips,
          tools: [{ functionDeclarations: AI_TOOLS }]
        })
      });

      if (!response.ok) {
        let errorMsg = 'AI Bridge compromised or offline.';
        try {
          const errData = await response.json();
          errorMsg = errData.error || errorMsg;
        } catch (e) {}
        throw new Error(errorMsg);
      }

      const result = await response.json();
      const { text: aiText, functionCalls } = result;

      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          const actionMsg: Message = { 
            id: `action-${Date.now()}`, 
            role: 'assistant', 
            content: `[Executing: ${call.name}]`, 
            isAction: true,
            timestamp: Date.now() 
          };
          setMessages(prev => [...prev, actionMsg]);
          
          const feedback = await executeTool(call.name, call.args);
          setMessages(prev => [...prev, { 
            id: `feedback-${Date.now()}`, 
            role: 'assistant', 
            content: feedback, 
            timestamp: Date.now() 
          }]);
        }
      } else {
        setMessages(prev => [...prev, { 
          id: Date.now().toString(), 
          role: 'assistant', 
          content: aiText || "Response integrity failed. Please re-state your request.", 
          timestamp: Date.now() 
        }]);
      }

    } catch (err: any) {
      console.error("Chat Interaction Failed:", err);
      const errorMessage = err.message || "I'm having a bit of trouble connecting to my cognitive layers. Let's try that again in a moment.";
      
      setMessages(prev => [...prev, { 
        id: `err-${Date.now()}`, 
        role: 'assistant', 
        content: errorMessage, 
        timestamp: Date.now() 
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div ref={assistantRef} className="fixed bottom-8 right-8 z-[100] font-sans">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "mb-6 w-[400px] md:w-[460px] flex flex-col shadow-[0_40px_100px_-20px_rgba(0,0,0,0.3)] bg-white rounded-[3rem] overflow-hidden border border-slate-100",
              isMinimized ? 'h-24' : 'h-[720px]'
            )}
          >
            {/* Header */}
            <div className="bg-slate-950 p-7 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                   <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full" />
                   <div className="relative bg-gradient-to-tr from-primary to-indigo-600 p-2.5 rounded-2xl shadow-lg shadow-primary/20">
                     <PenTool className="h-6 w-6 text-white" />
                   </div>
                </div>
                <div>
                  <h3 className="text-white text-base font-black tracking-tighter flex items-center gap-2">
                    ProEase AI
                    <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Activity className="h-3 w-3 text-green-400" />
                    </motion.div>
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="flex h-1.5 w-1.5 rounded-full bg-green-500" />
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Protocol Active</p>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl hover:bg-white/10 text-slate-400 hover:text-white h-10 w-10"
                  onClick={() => setIsMinimized(!isMinimized)}
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl hover:bg-red-500/20 text-slate-400 hover:text-red-400 h-10 w-10"
                  onClick={() => setIsOpen(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {!isMinimized && (
              <>
                {/* Messages Area */}
                <div className="flex-1 overflow-hidden relative bg-slate-50/50">
                  <ScrollArea className="h-full w-full">
                    <div className="p-8 space-y-8">
                       {/* Context Chips (Sticky at top of scroll) */}
                       <div className="flex flex-wrap gap-2 mb-6">
                         <div className="bg-white border border-slate-100 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                           <Activity className="h-3 w-3 text-primary" />
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{readinessScore}% Ready</span>
                         </div>
                         <div className="bg-white border border-slate-100 rounded-full px-3 py-1.5 flex items-center gap-2 shadow-sm">
                           <LayoutGrid className="h-3 w-3 text-slate-400" />
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{activeTab}</span>
                         </div>
                       </div>

                       {messages.map((m) => (
                         <motion.div
                           key={m.id}
                           initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                           animate={{ opacity: 1, x: 0 }}
                           className={cn(
                             "flex",
                             m.role === 'user' ? 'justify-end' : 'justify-start'
                           )}
                         >
                           <div className={cn(
                              "max-w-[85%] relative group",
                              m.role === 'user' ? 'text-right' : 'text-left'
                           )}>
                             <div className={cn(
                               "p-5 px-6 rounded-[2rem] text-sm leading-relaxed shadow-sm transition-all",
                               m.role === 'user' 
                                 ? "bg-slate-900 text-white rounded-tr-none shadow-xl shadow-slate-950/10 font-medium"
                                 : m.isAction
                                   ? "bg-slate-50 border-2 border-dashed border-slate-200 text-slate-400 text-xs font-bold font-mono tracking-tighter"
                                   : "bg-white text-slate-800 rounded-tl-none border border-slate-100 font-medium"
                             )}>
                               {m.isAction && <Terminal className="h-4 w-4 inline mr-2 align-text-bottom text-primary" />}
                               {m.content}
                             </div>
                             <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mt-2 block opacity-0 group-hover:opacity-100 transition-opacity">
                               {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                             </span>
                           </div>
                         </motion.div>
                       ))}
                       
                       {isTyping && (
                         <div className="flex justify-start">
                           <div className="bg-white p-5 rounded-[2rem] rounded-tl-none border border-slate-100 shadow-sm">
                              <div className="flex gap-2">
                                {[0, 1, 2].map(i => (
                                  <motion.div
                                    key={i}
                                    animate={{ 
                                      scale: [1, 1.4, 1],
                                      opacity: [0.3, 1, 0.3]
                                    }}
                                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                                    className="w-1.5 h-1.5 bg-primary rounded-full"
                                  />
                                ))}
                              </div>
                           </div>
                         </div>
                       )}
                       <div ref={messagesEndRef} className="h-4" />
                    </div>
                  </ScrollArea>

                  {/* Quick Action Suggestion (Floats above input) */}
                  <div className="absolute bottom-4 left-0 right-0 px-8 flex gap-2 overflow-x-auto no-scrollbar pointer-events-none">
                     <AnimatePresence>
                        {messages.length < 3 && !isTyping && (
                           <motion.div 
                             initial={{ opacity: 0, y: 10 }}
                             animate={{ opacity: 1, y: 0 }}
                             className="flex gap-2 pointer-events-auto"
                           >
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-full bg-white/90 backdrop-blur-md border-slate-200 text-[10px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all shadow-sm h-8"
                                onClick={() => setInput("Check my career readiness")}
                              >
                                <Zap className="h-3 w-3 mr-1.5" /> Readiness Check
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="rounded-full bg-white/90 backdrop-blur-md border-slate-200 text-[10px] font-black uppercase text-primary hover:bg-primary hover:text-white transition-all shadow-sm h-8"
                                onClick={() => setInput("Navigate to Resume")}
                              >
                                <Target className="h-3 w-3 mr-1.5" /> Navigate to Resume
                              </Button>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </div>
                </div>

                {/* Input Controls */}
                <div className="p-8 bg-white border-t border-slate-50 relative">
                  <AnimatePresence>
                    {isMenuOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        className="absolute bottom-full left-8 right-8 mb-4 p-4 bg-white border border-slate-100 rounded-[2.5rem] shadow-2xl z-[110]"
                      >
                        <div className="grid grid-cols-2 gap-2">
                           <Button 
                             variant="ghost" 
                             className="h-14 rounded-2xl justify-start font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                             onClick={() => { fileInputRef.current?.click(); setIsMenuOpen(false); }}
                           >
                             <Paperclip className="h-4 w-4 mr-3 text-primary" />
                             Analyze File
                           </Button>
                           <Button 
                             variant="ghost" 
                             className="h-14 rounded-2xl justify-start font-black text-xs uppercase tracking-widest text-red-500 hover:bg-red-50"
                             onClick={clearChat}
                           >
                             <Trash2 className="h-4 w-4 mr-3 text-red-500" />
                             Purge Data
                           </Button>
                           <Button 
                             variant="ghost" 
                             className="h-14 rounded-2xl justify-start font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                             onClick={() => { setActiveTab('profile'); setIsMenuOpen(false); }}
                           >
                             <User className="h-4 w-4 mr-3 text-slate-400" />
                             My Profile
                           </Button>
                           <Button 
                             variant="ghost" 
                             className="h-14 rounded-2xl justify-start font-black text-xs uppercase tracking-widest text-slate-600 hover:bg-slate-50"
                             onClick={() => { setActiveTab('documents'); setIsMenuOpen(false); }}
                           >
                             <FileText className="h-4 w-4 mr-3 text-slate-400" />
                             Documents
                           </Button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="flex gap-3 items-center">
                    <Button
                      variant="outline"
                      size="icon"
                      className={cn(
                        "h-14 w-14 rounded-[1.25rem] border-slate-200 transition-all",
                        isMenuOpen ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-400"
                      )}
                      onClick={() => setIsMenuOpen(!isMenuOpen)}
                    >
                      <Menu className="h-6 w-6" />
                    </Button>

                    <form 
                      onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                      className="relative flex-1"
                    >
                      <Input 
                        placeholder="Strategize now..." 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="h-14 bg-slate-50 border-none rounded-[1.25rem] pr-16 focus-visible:ring-primary font-bold text-slate-900 shadow-inner"
                        disabled={isTyping}
                      />
                      <Button 
                        type="submit" 
                        size="icon" 
                        disabled={!input.trim() || isTyping}
                        className="absolute right-1.5 top-1.5 h-11 w-11 rounded-xl shadow-xl transition-all"
                      >
                        {isTyping ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      </Button>
                    </form>
                  </div>

                  <div className="mt-4 flex items-center justify-between text-[8px] font-black uppercase tracking-[0.2em] text-slate-300">
                    <div className="flex items-center gap-2">
                       <ShieldCheck className="h-3 w-3 text-green-500/50" />
                       End-to-End Secure AI Proxy
                    </div>
                    <div>v2.0 // Citadel Core</div>
                  </div>
                </div>
              </>
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileUpload} 
              accept=".pdf,.doc,.docx,.txt"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!isOpen && (
        <motion.div
           layoutId="fab"
           className="relative"
        >
          <div className="absolute -inset-4 bg-primary/20 blur-3xl rounded-full scale-110" />
          <Button
            size="lg"
            className="h-20 w-20 rounded-[2.2rem] shadow-[0_40px_80px_-15px_rgba(37,99,235,0.4)] p-0 bg-gradient-to-tr from-primary to-indigo-600 border border-white/20 hover:scale-105 transition-transform duration-500"
            onClick={() => setIsOpen(true)}
          >
            <div className="relative">
              <PenTool className="h-9 w-9 text-white" />
              <motion.div 
                animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.2, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="absolute inset-0 bg-primary blur-xl rounded-full -z-10" 
              />
            </div>
          </Button>
          <div className="absolute -top-1 -right-1 flex h-4 w-4">
             <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
             <span className="relative inline-flex rounded-full h-4 w-4 bg-primary border-2 border-white"></span>
          </div>
        </motion.div>
      )}
    </div>
  );
}
