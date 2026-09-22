import React from 'react';
import { UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Briefcase, 
  TrendingUp, 
  CheckCircle2, 
  Clock,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Share2,
  Zap,
  Target,
  Rocket,
  ShieldCheck,
  GraduationCap,
  Users,
  UserCircle,
  PenTool,
  Receipt
} from 'lucide-react';
import { motion } from 'motion/react';
import { calculateReadinessScore } from '@/lib/profileUtils';
import { generateProfessionalSummary } from '@/services/gemini';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { updateLocalProfileField } from '@/lib/profileStorage';
import { PlanGuard } from '@/components/common/AccessGuard';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OverviewProps {
  profile: UserProfile | null;
  setActiveTab: (tab: string) => void;
}

export function Overview({ profile, setActiveTab }: OverviewProps) {
  const [isRefining, setIsRefining] = React.useState(false);
  if (!profile) return null;

  const readinessScore = calculateReadinessScore(profile);
  const isOwner = profile.role === 'owner' || profile.email === 'arvin8786@gmail.com';

  const handleRefineSummary = async () => {
    setIsRefining(true);

    const logActivity = (type: any, action: any, detail: string) => {
      const activity = {
        id: Math.random().toString(36).substr(2, 9),
        type,
        action,
        detail,
        timestamp: new Date()
      };
      return [activity, ...(profile.activities || [])].slice(0, 50);
    };

    try {
      const summary = await generateProfessionalSummary(profile);
      await updateLocalProfileField(profile!.uid, {
        professionalSummary: summary,
        activities: logActivity('summary', 'updated', 'Refined professional summary with AI from Dashboard'),
        updatedAt: new Date()
      });
    } catch (error: any) {
      console.error("Refine Summary Error:", error);
      if (error?.code && typeof error.code === 'string' && error.code.startsWith('permission-')) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      }
    } finally {
      setIsRefining(false);
    }
  };

  const handleShare = () => {
    const formatProfile = (p: UserProfile) => {
      let text = `PROEASE PROFESSIONAL PROFILE: ${p.displayName.toUpperCase()}\n`;
      text += `TITLE: ${p.professionalSummary?.split('.')[0] || 'Professional'}\n`;
      text += `------------------------------------------\n\n`;
      
      if (p.professionalSummary) {
        text += `EXECUTIVE SUMMARY:\n${p.professionalSummary}\n\n`;
      }

      if (p.experience && p.experience.length > 0) {
        text += `PROFESSIONAL EXPERIENCE:\n`;
        p.experience.forEach(exp => {
          text += `• ${exp.position} @ ${exp.company}\n`;
          text += `  Period: ${exp.startDate} - ${exp.isCurrent ? 'Present' : exp.endDate}\n`;
          if (exp.location) text += `  Location: ${exp.location}\n`;
          if (exp.description) text += `  Responsibilities:\n  ${exp.description.split('\n').join('\n  ')}\n`;
        });
        text += `\n`;
      }

      if (p.education && p.education.length > 0) {
        text += `EDUCATION:\n`;
        p.education.forEach(edu => {
          text += `• ${edu.degree} in ${edu.field}\n`;
          text += `  Institution: ${edu.school}\n`;
          text += `  Period: ${edu.startDate} - ${edu.isCurrent ? 'Present' : edu.endDate}\n`;
        });
        text += `\n`;
      }

      if (p.skills && p.skills.length > 0) {
        text += `CORE COMPETENCIES & SKILLS:\n`;
        text += `• ${p.skills.join('\n• ')}\n\n`;
      }

      if (p.projects && p.projects.length > 0) {
        text += `KEY PROJECTS:\n`;
        p.projects.forEach(proj => {
          text += `• ${proj.name}\n`;
          if (proj.description) text += `  ${proj.description}\n`;
          if (proj.link) text += `  Link: ${proj.link}\n`;
        });
        text += `\n`;
      }

      if (p.certifications && p.certifications.length > 0) {
        text += `CERTIFICATIONS:\n`;
        p.certifications.forEach(cert => {
          text += `• ${cert.name} (${cert.issuer}, ${cert.date})\n`;
        });
        text += `\n`;
      }

      if (p.languages && p.languages.length > 0) {
        text += `LANGUAGES:\n`;
        p.languages.forEach(lang => {
          text += `• ${lang.name} (${lang.proficiency})\n`;
        });
        text += `\n`;
      }

      if (p.references && p.references.length > 0) {
        text += `PROFESSIONAL REFERENCES:\n`;
        p.references.forEach(ref => {
          if (ref.isVisible !== false) {
            text += `• ${ref.name} - ${ref.position} @ ${ref.company}\n`;
            if (ref.email) text += `  Email: ${ref.email}\n`;
            if (ref.phone) text += `  Phone: ${ref.phone}\n`;
          }
        });
        text += `\n`;
      }

      if (p.email || p.phone || p.linkedin || p.website || p.address) {
        text += `CONTACT DETAILS:\n`;
        if (p.email) text += `Email: ${p.email}\n`;
        if (p.phone) text += `Phone: ${p.phone}\n`;
        if (p.linkedin) text += `LinkedIn: ${p.linkedin}\n`;
        if (p.website) text += `Website: ${p.website}\n`;
        if (p.address) text += `Address: ${p.address}\n`;
      }

      text += `\nShared via ProEase AI Career Strategist\n${window.location.origin}`;
      return text;
    };

    const shareContent = formatProfile(profile);

    if (navigator.share) {
      navigator.share({
        title: `${profile.displayName} - Professional Profile`,
        text: shareContent,
        url: window.location.href
      }).catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.error('Error sharing:', error);
      });
    } else {
      navigator.clipboard.writeText(shareContent);
      alert('Full profile details copied to clipboard!');
    }
  };

  const stats = [
    { label: 'Documents', value: '4 Assets', icon: FileText, color: 'text-slate-900', bg: 'bg-primary/10', tab: 'documents' },
    { label: 'Experience', value: `${profile.experience?.length || 0} Roles`, icon: Briefcase, color: 'text-slate-900', bg: 'bg-primary/10', tab: 'career' },
    { label: 'AI Readiness', value: `${readinessScore}%`, icon: Sparkles, color: 'text-slate-900', bg: 'bg-primary/10', tab: 'profile' },
    { label: 'Vault Status', value: 'Optimized', icon: ShieldCheck, color: 'text-slate-900', bg: 'bg-primary/10', tab: 'career' },
  ];

  return (
    <div className="space-y-16 pb-24">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-100 pb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-2 w-12 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Professional Headquarters</span>
          </div>
          <h1 className="font-heading text-5xl md:text-7xl font-bold tracking-tight text-slate-900 leading-[0.9]">
            Welcome, <span className="text-primary italic">{profile.displayName.split(' ')[0]}</span>.
          </h1>
          <p className="text-slate-500 text-xl font-medium mt-8 max-w-2xl leading-relaxed">
            Your executive career narrative is currently <span className="text-slate-900 font-bold border-b-2 border-primary/20">{readinessScore}% optimized</span>.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Button 
            onClick={handleShare}
            className="rounded-2xl h-14 px-8 font-bold text-sm bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-sm flex gap-3 transition-all hover:shadow-xl hover:-translate-y-1"
          >
            <Share2 className="h-4 w-4" />
            Share Profile
          </Button>
          {isOwner && (
            <div className="bg-slate-950 text-white px-6 h-14 rounded-2xl flex items-center gap-3 shadow-2xl">
              <ShieldCheck className="h-5 w-5 text-amber-500" />
              <span className="text-[10px] font-black uppercase tracking-widest">Master Key Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="cursor-pointer group"
            onClick={() => setActiveTab(stat.tab)}
          >
            <div className="bg-white p-8 rounded-[3rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] border border-slate-100 relative overflow-hidden transition-all hover:shadow-2xl hover:-translate-y-2">
              <div className="flex flex-col gap-6 relative z-10">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-500 group-hover:rotate-12 group-hover:scale-110",
                  stat.bg
                )}>
                  <stat.icon className={cn("h-8 w-8", stat.color)} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">{stat.label}</p>
                  <p className="text-3xl font-black tracking-tighter text-slate-900">{stat.value}</p>
                </div>
              </div>
              <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-150 duration-700">
                <stat.icon className="h-32 w-32 text-slate-900" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {profile.plan === 'freeTrial' && !isOwner && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-[3rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-primary p-1 border-none shadow-2xl shadow-indigo-200/50"
        >
          <div className="bg-white/95 backdrop-blur-xl rounded-[2.8rem] p-8 md:p-14 relative overflow-hidden">
            {/* Decorative elements */}
            <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
              <div className="flex-1 space-y-8 text-center lg:text-left">
                <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 shadow-sm">
                  <Zap className="h-4 w-4 fill-indigo-600" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Premium Trial Active</span>
                </div>
                
                <div className="space-y-4">
                  <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-slate-900 leading-[1.1]">
                    Master Your <span className="text-primary italic">Professional Destiny</span>
                  </h2>
                  <p className="text-xl text-slate-500 font-medium max-w-2xl leading-relaxed">
                    You're witnessing ProEase at its full potential. Every elite AI tool is at your command to accelerate your career growth.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-4">
                  {[
                    { icon: Sparkles, text: "AI Resume Sculptor", sub: "Engineered for AI ATS systems", color: "text-amber-500", bg: "bg-amber-50" },
                    { icon: Target, text: "Strategic Goal Engine", sub: "Data-driven path to success", color: "text-blue-500", bg: "bg-blue-50" },
                    { icon: Briefcase, text: "Interview Elite Simulator", sub: "Real-time behavioral analysis", color: "text-purple-500", bg: "bg-purple-50" },
                    { icon: Rocket, text: "Unlimited AI Summaries", sub: "Dynamic narrative adaptation", color: "text-green-500", bg: "bg-green-50" },
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      className="flex items-center gap-4 p-5 rounded-3xl bg-slate-50/50 border border-slate-100 hover:bg-white hover:shadow-xl hover:shadow-slate-200/40 transition-all duration-300 group"
                    >
                      <div className={`${item.bg} p-3.5 rounded-2xl shadow-sm transition-transform group-hover:scale-110`}>
                        <item.icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div>
                        <p className="font-black text-slate-900 text-sm">{item.text}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">{item.sub}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
              
              <div className="lg:w-1/3 flex flex-col items-center justify-center space-y-8 bg-slate-50/80 backdrop-blur-sm p-10 rounded-[3rem] border border-white shadow-xl">
                <div className="relative">
                  <div className="w-40 h-40 rounded-full border-8 border-white flex flex-col items-center justify-center text-primary font-black shadow-2xl bg-white relative overflow-hidden group">
                    <div className="absolute inset-0 bg-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="text-5xl tracking-tighter relative z-10">
                      {profile.subscriptionExpiry ? Math.max(0, Math.ceil((new Date(profile.subscriptionExpiry?.toDate ? profile.subscriptionExpiry.toDate() : profile.subscriptionExpiry).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : '∞'}
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black relative z-10">Days Left</span>
                  </div>
                  <div className="absolute -bottom-4 -right-4 bg-primary text-white p-4 rounded-[1.5rem] shadow-2xl shadow-primary/40 animate-bounce">
                    <Rocket className="h-6 w-6" />
                  </div>
                </div>
                
                <div className="w-full space-y-4">
                  <Button 
                    onClick={() => setActiveTab('profile')}
                    className="w-full h-16 rounded-[1.5rem] font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/30 flex gap-3 group px-4"
                  >
                    <span>Supercharge Profile</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                  <p className="text-[10px] text-center text-slate-400 font-bold uppercase tracking-widest px-4">
                    Complete your profile to unlock full AI potential
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative"
          >
            <div className="absolute -inset-1 bg-gradient-to-tr from-primary/30 to-indigo-500/30 rounded-[4rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
            <Card className="border-none overflow-hidden h-full relative z-10 rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] bg-white">
              <CardHeader className="border-b border-slate-50 pb-10 p-12">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-4xl font-heading font-bold text-slate-900 leading-none">Executive Brief</CardTitle>
                    <CardDescription className="text-base font-medium text-slate-400 mt-4 italic">Strategic career narrative synthesized by AI</CardDescription>
                  </div>
                  <div className="bg-primary/5 p-5 rounded-[1.75rem] border border-primary/10 transition-transform group-hover:rotate-6">
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-12 space-y-12">
                <div className="relative">
                  <div className="absolute -top-12 -left-8 text-9xl font-heading text-primary/10 select-none font-bold leading-none transition-colors">“</div>
                  <p className="text-2xl leading-[1.6] text-slate-700 font-medium tracking-tight relative z-10 first-letter:text-5xl first-letter:font-heading first-letter:font-bold first-letter:mr-3 first-letter:float-left first-letter:text-primary">
                    {profile.professionalSummary || "Your professional summary will appear here once you add experience to your Career Vault. Our AI will analyze your history to craft a compelling narrative."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 pt-6">
                  <PlanGuard profile={profile} feature="aiAssistant">
                    <Button 
                      variant="default" 
                      className="rounded-2xl h-14 px-10 font-black text-xs uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-105 active:scale-95 transition-all"
                      onClick={handleRefineSummary}
                      disabled={isRefining}
                    >
                      {isRefining ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Sparkles className="mr-3 h-5 w-5" />}
                      Refine Strategy
                    </Button>
                  </PlanGuard>
                  <Button 
                    variant="outline" 
                    className="rounded-2xl h-14 px-10 font-bold border-slate-100 bg-slate-50 hover:bg-slate-100 text-slate-900 transition-colors"
                    onClick={() => {
                      navigator.clipboard.writeText(profile.professionalSummary || "");
                      alert('Summary copied!');
                    }}
                  >
                    Export Assets
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        <motion.div
           initial={{ opacity: 0, x: 30 }}
           whileInView={{ opacity: 1, x: 0 }}
           viewport={{ once: true }}
        >
          <Card className="border-none h-full flex flex-col rounded-[3.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] bg-white overflow-hidden">
            <CardHeader className="border-b border-slate-50 pb-8 p-10">
              <CardTitle className="text-2xl font-black tracking-tight text-slate-900">Action Log</CardTitle>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-y-auto max-h-[600px] custom-scrollbar">
              {(!profile.activities || profile.activities.length === 0) ? (
                <div className="p-16 text-center h-full flex flex-col items-center justify-center">
                  <div className="bg-slate-50 p-10 rounded-[3rem] inline-block mb-8 shadow-inner border border-slate-100 italic">
                    <CheckCircle2 className="h-16 w-16 text-slate-200" />
                  </div>
                  <p className="text-slate-400 font-bold text-lg">System Synchronized</p>
                  <p className="text-slate-300 text-sm mt-1 uppercase tracking-widest font-black">All activities logged</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {profile.activities.map((activity, i) => {
                    const date = activity.timestamp?.toDate ? activity.timestamp.toDate() : new Date(activity.timestamp);
                    const formattedDate = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
                    
                    return (
                      <div key={activity.id} className="p-8 hover:bg-slate-50/80 transition-all group relative">
                        <div className="flex gap-6">
                          <div className="mt-1 bg-white p-3.5 rounded-2xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform group-hover:rotate-6">
                            {activity.type === 'experience' && <Briefcase className="h-5 w-5 text-indigo-500" />}
                            {activity.type === 'education' && <GraduationCap className="h-5 w-5 text-blue-500" />}
                            {activity.type === 'reference' && <Users className="h-5 w-5 text-green-500" />}
                            {activity.type === 'summary' && <Sparkles className="h-5 w-5 text-amber-500" />}
                            {activity.type === 'personal' && <UserCircle className="h-5 w-5 text-slate-500" />}
                            {activity.type === 'signature' && <PenTool className="h-5 w-5 text-orange-500" />}
                            {activity.type === 'document' && <FileText className="h-5 w-5 text-emerald-600" />}
                            {activity.type === 'payment' && <Receipt className="h-5 w-5 text-green-600" />}
                            {activity.type !== 'experience' && activity.type !== 'education' && activity.type !== 'reference' && activity.type !== 'summary' && activity.type !== 'personal' && activity.type !== 'signature' && activity.type !== 'document' && activity.type !== 'payment' && (
                              <Clock className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="space-y-1.5 pr-8">
                            <p className="text-[10px] font-black tracking-[0.2em] text-slate-300 uppercase">{formattedDate}</p>
                            <p className="font-black text-slate-800 tracking-tight leading-tight">{activity.detail}</p>
                            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                              {activity.action} {activity.type.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                        {activity.link && (
                          <div className="absolute top-1/2 -translate-y-1/2 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a href={activity.link} onClick={(e) => {
                               if (activity.link?.startsWith('/#')) {
                                 e.preventDefault();
                                 setActiveTab(activity.link.replace('/#', ''));
                               }
                            }}>
                              <Button size="icon" variant="ghost" className="rounded-2xl h-10 w-10 bg-white shadow-sm border border-slate-100">
                                <ArrowRight className="h-4 w-4 text-primary" />
                              </Button>
                            </a>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <footer className="pt-16 border-t border-black/5 mt-20">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="bg-slate-900 text-white px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">PERSONAL EDITION</div>
              <span className="text-sm font-black tracking-tighter text-slate-900">ProEase v3.5 Workspace</span>
            </div>
            
            {(profile.plan === 'freeTrial' || profile.plan === 'pro') && !isOwner && (
              <div className="flex items-center gap-3 bg-white border border-slate-100 rounded-xl p-3 shadow-sm mt-4">
                <div className={cn(
                  "h-2 w-2 rounded-full animate-pulse",
                  profile.plan === 'pro' ? "bg-blue-500" : "bg-orange-500"
                )} />
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Plan</p>
                  <p className="text-xs font-bold text-slate-900">
                    {profile.plan === 'pro' ? 'Pro Membership' : 'Free Trial Period'}
                  </p>
                </div>
                <div className="h-8 w-px bg-slate-100 mx-1" />
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Expires On</p>
                  <p className="text-xs font-bold text-slate-900">
                    {profile.subscriptionExpiry 
                      ? new Date(profile.subscriptionExpiry?.toDate ? profile.subscriptionExpiry.toDate() : profile.subscriptionExpiry).toLocaleDateString()
                      : 'Lifetime'
                    }
                  </p>
                </div>
              </div>
            )}

            {isOwner && (
               <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 shadow-2xl mt-4">
                 <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                 <div className="min-w-0">
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">System Permission</p>
                   <p className="text-xs font-black text-white">OWNER ACCESS</p>
                 </div>
                 <div className="h-8 w-px bg-slate-800 mx-1" />
                 <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Limits</p>
                   <p className="text-xs font-black text-amber-500 italic">None</p>
                 </div>
               </div>
            )}

            <p className="text-xs text-slate-400 font-medium max-w-md">
              The premium career workspace for the modern professional. 
              Securely managing your professional identity since 2026.
            </p>
          </div>
          
          <div className="text-[10px] font-bold text-slate-400 text-left md:text-right space-y-2">
            <p className="uppercase tracking-[0.2em] text-slate-500">System Information</p>
            <p className="opacity-70">Release Version: 3.5.0-stable</p>
            <p className="opacity-70 text-red-400">Security: Remixing strictly prohibited</p>
            <p className="opacity-70">Deployment Date: 17/4/2026</p>
            <p className="pt-2 border-t border-black/5 mt-2 opacity-70">&copy; 2026 ProEase Workspace. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
