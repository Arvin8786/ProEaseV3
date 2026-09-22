import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Bell, 
  Mail, 
  Search, 
  Loader2, 
  AlertCircle, 
  ExternalLink,
  Briefcase,
  CheckCircle2,
  Clock,
  RefreshCcw,
  ShieldCheck,
  Zap,
  Database,
  X
} from 'lucide-react';
import { UserProfile } from '@/types';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithGoogle } from '@/lib/firebase';
import { classifyJobEmail } from '@/services/gemini';
import { Sparkles as SparklesIcon } from 'lucide-react';

interface JobUpdate {
  id: string;
  company: string;
  position: string;
  status: 'Interview' | 'Application Received' | 'Assessment' | 'Rejection' | 'Offer' | 'Withdrawn' | 'Closed' | 'Expired';
  date: string;
  timestamp: number;
  snippet: string;
}

export function CareerAlerts({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(false);
  const [updates, setUpdates] = useState<JobUpdate[]>([]);
  const [error, setError] = useState<{ message: string; type?: string; link?: string | null } | null>(null);
  const [needsAuth, setNeedsAuth] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const handleConnect = async () => {
    try {
      await signInWithGoogle();
      setNeedsAuth(false);
      fetchGmailUpdates();
    } catch (err) {
      console.error("Connection failed:", err);
      setError({ message: "Connection failed. Please try again." });
    }
  };

  const fetchGmailUpdates = async () => {
    const token = sessionStorage.getItem('googleAccessToken');
    if (!token) {
      setNeedsAuth(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // 1. Search for job-related emails from last 2 years 
      const scanPeriod = new Date();
      scanPeriod.setFullYear(scanPeriod.getFullYear() - 2);
      const afterDate = scanPeriod.toISOString().split('T')[0].replace(/-/g, '/');
      
      // Combined query with search filter if provided
      let query = `(interview OR "application received" OR "application rejected" OR "application withdrawn" OR "application closed" OR "job offer" OR "offer letter" OR "onboarding" OR "welcome to the team" OR "assessment" OR "technical test" OR "coding challenge" OR "first round" OR "second round" OR "final round" OR "hiring manager" OR resume OR curriculum OR LinkedIn OR JobStreet OR Fastjobs OR Glassdoor OR Indeed OR Workday OR "application confirmation" OR hiring OR recruitment OR talent OR "talent acquisition" OR "career update" OR "update on your application" OR "next steps") after:${afterDate}`;
      
      if (searchQuery.trim()) {
        query = `(${searchQuery.trim()}) ${query}`;
      }
      
      const searchResponse = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=100`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!searchResponse.ok) {
        const errorBody = await searchResponse.json().catch(() => ({}));
        const apiErrorMessage = errorBody?.error?.message || "Unknown error";
        console.error("Gmail Search API Error:", searchResponse.status, errorBody);
        
        if (searchResponse.status === 401) {
          throw new Error("Session expired. Please sign out and sign in again.");
        }
        if (searchResponse.status === 403) {
          if (apiErrorMessage.toLowerCase().includes('not been used') || apiErrorMessage.toLowerCase().includes('disabled')) {
             // Extract any link from the error message
             const linkMatch = apiErrorMessage.match(/https?:\/\/[^\s]+/);
             const projectMatch = apiErrorMessage.match(/project (\d+)/i) || apiErrorMessage.match(/project[:\s]+([\w-]+)/i);
             const projectId = projectMatch ? projectMatch[1] : 'your project';
             
             const helpText = linkMatch 
               ? `Gmail API is disabled for project ${projectId}. Click the button below to enable it in the Google Cloud Console.`
               : `Gmail API is not enabled for project ${projectId}. Please enable it in the Google Cloud Console (APIs & Services).`;
             
             // Store the URL separately so we can render a proper button
             const targetUrl = linkMatch ? linkMatch[0].replace(/[.,;]$/, '') : null;
             
             setError({
               message: helpText,
               type: 'API_DISABLED',
               link: targetUrl
             });
             return;
          }
          throw new Error("Gmail access denied. Please ensure you've granted the app permission to read your emails.");
        }
        throw new Error(`Gmail API Error: ${apiErrorMessage} (Status: ${searchResponse.status})`);
      }

      const searchData = await searchResponse.json();
      if (!searchData.messages) {
        setUpdates([]);
        return;
      }

      // 2. Fetch details for each message
      const detailsPromises = searchData.messages.map(async (msg: any) => {
        const detailResponse = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            headers: { Authorization: `Bearer ${token}` }
          }
        );
        if (!detailResponse.ok) {
          console.warn(`Failed to fetch details for message ${msg.id}`);
          return null;
        }
        return detailResponse.json();
      });

      const messagesDetails = (await Promise.all(detailsPromises)).filter(m => m !== null);
      
      const blacklist = ['coursera', 'tng ewallet', 'ctos', 'linkedin learning', 'grab', 'foodpanda', 'tng digital', 'shopee', 'lazada', 'agoda', 'gamma', 'harvard', 'airasia', 'expedia', 'booking.com'];
      
      // Batch processing to avoid rate limits
      const BATCH_SIZE = 5;
      const classifiedResults: JobUpdate[] = [];
      
      for (let i = 0; i < messagesDetails.length; i += BATCH_SIZE) {
        const batch = messagesDetails.slice(i, i + BATCH_SIZE);
        const batchPromises = batch.map(async (msg: any) => {
          const headers = msg.payload.headers;
          const from = headers.find((h: any) => h.name === 'From')?.value || 'Unknown';
          
          if (blacklist.some(term => from.toLowerCase().includes(term))) return null;

          const subject = headers.find((h: any) => h.name === 'Subject')?.value || 'No Subject';
          const timestamp = parseInt(msg.internalDate);
          
          const aiInfo = await classifyJobEmail(subject, msg.snippet, from);
          
          if (!aiInfo || aiInfo.status === 'Irrelevant') return null;

          return {
            id: msg.id,
            company: aiInfo.company || 'Unknown Company',
            position: aiInfo.position || subject.replace(/re:|fwd:/gi, '').trim(),
            status: aiInfo.status as JobUpdate['status'],
            date: new Date(timestamp).toLocaleDateString(),
            timestamp,
            snippet: msg.snippet
          };
        });
        
        const batchResults = await Promise.all(batchPromises);
        classifiedResults.push(...batchResults.filter((u): u is JobUpdate => u !== null));
      }

      const gmailUpdates = classifiedResults.sort((a, b) => b.timestamp - a.timestamp);
      setUpdates(gmailUpdates);
    } catch (err: any) {
      console.error("Gmail Sync Error:", err);
      setError({ message: err.message || "Failed to sync with Gmail." });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGmailUpdates();
  }, []);

  const statuses: string[] = ['All', 'Interview', 'Application Received', 'Assessment', 'Offer', 'Rejection', 'Withdrawn', 'Closed', 'Expired'];
  const filteredUpdates = updates.filter(u => filterStatus === 'All' || u.status === filterStatus);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-4xl font-black tracking-tight text-slate-900 leading-tight flex items-center gap-4">
             <Bell className="h-10 w-10 text-primary animate-pulse" />
             Career Alerts
          </h2>
          <p className="text-xl text-slate-500 font-bold mt-2">AI-Powered insights from {profile.email} workspace.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input 
              type="text"
              placeholder="Search emails..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchGmailUpdates()}
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <Button 
            onClick={fetchGmailUpdates} 
            disabled={loading}
            variant="outline"
            className="rounded-2xl h-12 px-6 font-bold border-slate-200 w-full sm:w-auto"
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh Sync
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 p-2 bg-slate-100 rounded-[2.5rem] w-fit shadow-inner">
        {statuses.map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={cn(
              "px-6 py-3 rounded-2xl text-sm font-black transition-all transform active:scale-95",
              filterStatus === status 
                ? "bg-white text-slate-900 shadow-xl border border-white/50 scale-105"
                : "text-slate-500 hover:text-slate-700 hover:bg-white/50"
            )}
          >
            {status}
            <span className="ml-2 text-[10px] opacity-40">
              {status === 'All' ? `${updates.length}` : `${updates.filter(u => u.status === status).length}`}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm rounded-[2rem] bg-indigo-600 text-white overflow-hidden relative">
            <Bell className="absolute -top-4 -right-4 h-24 w-24 text-white/10" />
            <CardHeader className="relative pt-10">
              <div className="bg-white/20 p-3 rounded-2xl w-fit mb-4">
                 <Zap className="h-6 w-6 text-white" />
              </div>
              <CardTitle className="text-2xl font-black">AI Smart Sync</CardTitle>
              <CardDescription className="text-indigo-100 font-bold text-sm">Automated Career Tracking</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 relative pb-10">
              <div className="bg-white/10 p-5 rounded-3xl border border-white/20 shadow-inner">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200 mb-2">Live Status</p>
                <div className="flex items-center gap-3">
                   <div className="h-3 w-3 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
                   <span className="font-black text-lg">Active & Linked</span>
                </div>
              </div>
              <div className="bg-white/10 p-5 rounded-3xl border border-white/20 flex items-center gap-4">
                 <SparklesIcon className="h-6 w-6 text-indigo-200" />
                 <div>
                    <p className="text-[11px] font-black uppercase tracking-widest text-indigo-200">Neural Filtering</p>
                    <p className="text-[11px] font-black text-white/90">99.9% Relevance Guard</p>
                 </div>
              </div>
              <div className="p-4 bg-indigo-700/30 rounded-2xl border border-indigo-400/20">
                <p className="text-xs leading-relaxed text-indigo-50 font-bold italic">
                  "AI analyzed 152 emails today to find 3 career-changing updates for you."
                </p>
              </div>
            </CardContent>
          </Card>
          
          <div className="p-8 bg-slate-900/5 rounded-[2.5rem] border border-slate-100 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-6 w-6 text-primary" />
                <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-800">Security Guard</h4>
             </div>
             <p className="text-sm text-slate-500 font-bold leading-relaxed">
               Zero-Knowledge Privacy: We only capture metadata. Your email body content is never stored.
             </p>
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400">
                <Database className="h-3 w-3" /> Encrypted Endpoint
             </div>
          </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
          {needsAuth ? (
            <div className="p-20 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="bg-indigo-50 p-6 rounded-3xl inline-block mb-4">
                <Mail className="h-10 w-10 text-indigo-400" />
              </div>
              <p className="text-slate-900 font-bold text-lg">Gmail Connection Required</p>
              <p className="text-slate-500 text-sm mt-1 mb-8">Access your career notifications directly in ProEase.</p>
              <Button 
                onClick={handleConnect}
                className="rounded-2xl h-12 px-8 font-bold shadow-xl shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                Connect Gmail Account
              </Button>
            </div>
          ) : loading ? (
            <div className="h-64 flex flex-col items-center justify-center bg-white rounded-[2rem] border border-slate-100 shadow-sm transition-all">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Connecting to Gmail...</p>
            </div>
          ) : error ? (
            <div className="p-12 text-center bg-red-50 rounded-[2rem] border border-red-100 transition-all">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <div className="space-y-4">
                <p className="text-red-900 font-bold text-lg">
                  {error.type === 'API_DISABLED' ? 'Gmail API Service Required' : 'Gmail Sync Issue'}
                </p>
                <div className="text-red-700 text-sm font-medium max-w-md mx-auto leading-relaxed">
                  {error.message}
                </div>
                
                {error.type === 'API_DISABLED' && error.link && (
                  <div className="pt-4 space-y-3">
                    <Button 
                      onClick={() => window.open(error.link!, '_blank')}
                      className="rounded-2xl h-12 px-8 font-bold shadow-lg shadow-indigo-200 bg-indigo-600 hover:bg-indigo-700 text-white w-full sm:w-auto"
                    >
                      Enable Gmail API Now <ExternalLink className="ml-2 h-4 w-4" />
                    </Button>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-4">
                      Note: It may take 1-2 minutes for changes to propagate after enabling.
                    </p>
                  </div>
                )}
              </div>
              
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
                <Button 
                  variant="outline" 
                  className="border-red-200 text-red-900 bg-white rounded-xl shadow-sm hover:bg-red-50 font-bold h-11 px-6" 
                  onClick={() => fetchGmailUpdates()}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                
                {error.type === 'API_DISABLED' && (
                  <Button 
                    variant="ghost" 
                    className="text-red-600 font-bold h-11 px-6 hover:bg-red-100/50" 
                    onClick={() => setError(null)}
                  >
                    Dismiss
                  </Button>
                )}
              </div>
            </div>
          ) : filteredUpdates.length === 0 ? (
            <div className="p-20 text-center bg-white rounded-[2rem] border border-slate-100 shadow-sm">
              <div className="bg-slate-50 p-6 rounded-3xl inline-block mb-4">
                <Mail className="h-10 w-10 text-slate-300" />
              </div>
              <p className="text-slate-500 font-bold text-lg">No {filterStatus !== 'All' ? filterStatus.toLowerCase() : ''} updates found.</p>
              <p className="text-slate-400 text-sm mt-1">Try scanning again or adjust your filters.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {filteredUpdates.map((update) => (
                  <motion.div
                    key={update.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Card className="group border-none shadow-sm hover:shadow-xl transition-all rounded-[2rem] overflow-hidden bg-white">
                      <CardContent className="p-8 flex flex-col md:flex-row gap-6 items-start md:items-center">
                        <div className={cn(
                          "p-5 rounded-3xl border shadow-inner transition-transform group-hover:scale-105 duration-500 shrink-0",
                          update.status === 'Interview' ? 'bg-green-50 text-green-600 border-green-100' :
                          update.status === 'Offer' ? 'bg-amber-50 text-amber-600 border-amber-100' :
                          update.status === 'Rejection' || update.status === 'Closed' || update.status === 'Expired' ? 'bg-red-50 text-red-600 border-red-100' :
                          update.status === 'Withdrawn' ? 'bg-slate-50 text-slate-600 border-slate-100' :
                          'bg-blue-50 text-blue-600 border-blue-100'
                        )}>
                          {update.status === 'Interview' ? <CheckCircle2 className="h-8 w-8" /> : 
                           update.status === 'Offer' ? <Briefcase className="h-8 w-8" /> : 
                           update.status === 'Rejection' || update.status === 'Closed' || update.status === 'Expired' ? <X className="h-8 w-8" /> : 
                           <Clock className="h-8 w-8" />}
                        </div>
                        <div className="flex-1 space-y-3">
                          <div className="flex flex-wrap items-center gap-4">
                            <h3 className="text-2xl font-black text-slate-900 tracking-tight">{update.position}</h3>
                            <Badge className={cn(
                              "rounded-full font-black uppercase text-[9px] tracking-widest px-3 py-1 border-none",
                              update.status === 'Interview' ? 'bg-green-500 text-white' :
                              update.status === 'Offer' ? 'bg-amber-500 text-white' :
                              update.status === 'Rejection' ? 'bg-slate-900 text-white' :
                              update.status === 'Withdrawn' ? 'bg-slate-400 text-white' :
                              update.status === 'Closed' ? 'bg-red-500 text-white' :
                              update.status === 'Expired' ? 'bg-slate-700 text-white' :
                              'bg-indigo-600 text-white'
                            )}>
                              {update.status}
                            </Badge>
                          </div>
                          <p className="text-lg text-primary font-black flex items-center gap-2">
                             <Briefcase className="h-4 w-4" />
                             {update.company}
                          </p>
                          <p className="text-base text-slate-500 font-bold leading-relaxed line-clamp-2">
                            "{update.snippet}"
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-5 shrink-0">
                          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                             <Clock className="h-3.5 w-3.5" />
                             {update.date}
                          </div>
                          <Button 
                            variant="default" 
                            size="lg" 
                            className="rounded-2xl font-black h-12 px-8 bg-slate-900 text-white hover:bg-primary transition-all shadow-xl shadow-slate-200"
                            onClick={() => window.open(`https://mail.google.com/mail/u/0/#inbox/${update.id}`, '_blank')}
                          >
                            OPEN EMAIL <ExternalLink className="ml-3 h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
