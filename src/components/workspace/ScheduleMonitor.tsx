import React, { useEffect, useState } from 'react';
import { getScheduledMessages, markMessageAsSent } from '@/lib/scheduling';
import { UserProfile, ScheduledMessage } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageSquare, CalendarClock, BellRing } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ScheduleMonitorProps {
  profile: UserProfile | null;
}

export function ScheduleMonitor({ profile }: ScheduleMonitorProps) {
  const [allPendingMessages, setAllPendingMessages] = useState<ScheduledMessage[]>([]);
  const [pendingMessages, setPendingMessages] = useState<ScheduledMessage[]>([]);
  const [activeAlert, setActiveAlert] = useState<ScheduledMessage | null>(null);
  const [autoRedirectTimer, setAutoRedirectTimer] = useState<number | null>(null);
  const [redirectProgress, setRedirectProgress] = useState(0);

  useEffect(() => {
    if (!profile?.uid) return;

    const path = `users/${profile.uid}/scheduled_messages`;
    const q = query(
      collection(db, path),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        scheduledAt: doc.data().scheduledAt
      })) as ScheduledMessage[];
      
      setAllPendingMessages(messages);
      setPendingMessages(messages); // Keep legacy state synced if needed
    }, (error) => {
      console.error("Schedule Monitor Sync Error:", error);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  useEffect(() => {
    let timer: any;
    if (autoRedirectTimer !== null && autoRedirectTimer > 0) {
      timer = setTimeout(() => {
        setAutoRedirectTimer(autoRedirectTimer - 1);
        setRedirectProgress((prev) => prev + (100 / 10)); // Fixed for 10s
      }, 1000);
    } else if (autoRedirectTimer === 0 && activeAlert) {
      handleSendNow(activeAlert);
    }
    return () => clearTimeout(timer);
  }, [autoRedirectTimer, activeAlert]);

  useEffect(() => {
    const checkDueMessages = () => {
      if (allPendingMessages.length === 0) return;
      
      const now = new Date();
      // Use a small buffer to avoid missing messages by milliseconds
      const due = allPendingMessages.filter(m => {
        const scheduledTime = new Date(m.scheduledAt);
        return scheduledTime <= now;
      });

      if (due.length > 0 && !activeAlert) {
        // Sort by oldest first if multiple are due
        const sortedDue = [...due].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
        setActiveAlert(sortedDue[0]);
        setAutoRedirectTimer(10); // Give user 10 seconds to respond
        setRedirectProgress(0);
      }
    };

    const interval = setInterval(checkDueMessages, 1000); // Check every second for precision
    return () => clearInterval(interval);
  }, [allPendingMessages, activeAlert]);

  const handleSendNow = async (msg: ScheduledMessage) => {
    const encodedMsg = encodeURIComponent(msg.message);
    const cleanPhone = msg.recipientPhone.replace(/\D/g, '');
    window.open(`https://wa.me/${cleanPhone}/?text=${encodedMsg}`, '_blank');
    
    if (profile?.uid) {
      await markMessageAsSent(profile.uid, msg.id);
      setActiveAlert(null);
      setAutoRedirectTimer(null);
    }
  };

  const cancelAutoRedirect = () => {
    setAutoRedirectTimer(null);
    setRedirectProgress(0);
  };

  if (!activeAlert) return null;

  return (
    <AnimatePresence>
      <Dialog open={!!activeAlert} onOpenChange={() => { setActiveAlert(null); setAutoRedirectTimer(null); }}>
        <DialogContent className="max-w-md rounded-[3rem] border-none shadow-2xl overflow-hidden p-0 bg-slate-950 text-white">
          <div className="bg-gradient-to-br from-indigo-600 to-primary p-12 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(255,255,255,0.2)_0%,_transparent_70%)]"
            />
            <motion.div
              animate={{ 
                rotate: [0, -10, 10, -10, 10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="relative z-10 bg-white/10 p-6 rounded-[2.5rem] backdrop-blur-xl mb-6 shadow-2xl border border-white/10"
            >
              <BellRing className="h-12 w-12 text-white" />
            </motion.div>
            <h2 className="text-3xl font-black tracking-tighter relative z-10">Outreach Priority</h2>
            <p className="text-white/70 font-medium relative z-10">Your scheduled message is ready for dispatch.</p>
          </div>
          
          <div className="p-10 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-5 p-5 bg-white/5 rounded-3xl border border-white/10 group hover:bg-white/[0.08] transition-colors">
                <div className="bg-green-500/20 p-4 rounded-2xl group-hover:scale-110 transition-transform">
                  <MessageSquare className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 mb-1">Target Recipient</p>
                  <p className="font-black text-xl tracking-tight">{activeAlert.recipientPhone}</p>
                </div>
              </div>

              <div className="p-6 bg-white/5 rounded-3xl border border-white/10 relative overflow-hidden group">
                <div className="absolute top-0 left-0 w-1 h-full bg-primary/40" />
                <p className="text-sm text-white/80 leading-relaxed font-medium italic line-clamp-4">
                  "{activeAlert.message}"
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {autoRedirectTimer !== null && (
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-slate-500 px-1">
                    <span>Auto-redirecting to WhatsApp</span>
                    <span>{autoRedirectTimer}s</span>
                  </div>
                  <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${redirectProgress}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-4">
                <Button 
                  variant="ghost" 
                  className="flex-1 h-14 rounded-2xl font-bold text-white/40 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10"
                  onClick={autoRedirectTimer !== null ? cancelAutoRedirect : () => setActiveAlert(null)}
                >
                  {autoRedirectTimer !== null ? 'Stop Timer' : 'Later'}
                </Button>
                <Button 
                  className="flex-[2] h-14 rounded-2xl font-black text-lg px-8 bg-green-500 hover:bg-green-600 text-white shadow-[0_20px_40px_-12px_rgba(34,197,94,0.3)] transition-all hover:-translate-y-1 active:translate-y-0"
                  onClick={() => handleSendNow(activeAlert)}
                >
                  Send Now
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AnimatePresence>
  );
}
