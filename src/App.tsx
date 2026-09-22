import React, { useState, useEffect } from 'react';
import { auth, signInWithGoogle, logout, db, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { getLocalProfile, saveLocalProfile } from './lib/profileStorage';
import { UserProfile, AdminConfig } from './types';
import { APP_FEATURES } from './lib/constants';
import { Navbar } from './components/layout/Navbar';
import { Overview } from './components/dashboard/Overview';
import { DocumentEditor } from './components/workspace/DocumentEditor';
import { CareerVault } from './components/profile/CareerVault';
import { ProfileEditor } from './components/profile/ProfileEditor';
import { InterviewPrep } from './components/interview/InterviewPrep';
import { AdminPanel } from './components/admin/AdminPanel';
import { AIAssistant } from './components/ai/AIAssistant';
import { ScheduleMonitor } from './components/workspace/ScheduleMonitor';
import { Button } from './components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { LogIn, Loader2, PenTool, AlertCircle, ShieldCheck, Share2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isWhitelisted, setIsWhitelisted] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [hasRequested, setHasRequested] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [isRemix, setIsRemix] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_config', 'global'), (snap) => {
      if (snap.exists()) {
        setAdminConfig(snap.data() as AdminConfig);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleLocalUpdate = (e: any) => {
      const uid = e.detail?.uid;
      if (uid && auth.currentUser && uid === auth.currentUser.uid) {
        setProfile(prev => {
          const currentLocal = getLocalProfile(uid);
          return {
            ...prev,
            ...currentLocal
          } as UserProfile;
        });
      }
    };
    window.addEventListener('local-profile-updated', handleLocalUpdate as any);
    return () => {
      window.removeEventListener('local-profile-updated', handleLocalUpdate as any);
    };
  }, []);

  useEffect(() => {
    // Remix Guard
    const authorizedId = 'sxtb2z2d7q326b3mv3hns7-795029610763';
    const isLocal = window.location.hostname === 'localhost';
    const isAuthorized = window.location.hostname.includes(authorizedId) || isLocal;
    setIsRemix(!isAuthorized);

    let unsubscribeSnapshot: (() => void) | undefined;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (user) {
        setUser(user);
        try {
          const email = user.email?.toLowerCase().trim() || '';
          const superAdmin = 'arvin8786@gmail.com';
          const isSuper = email === superAdmin;
          
          // Block Check
          const blockedDoc = doc(db, 'blocked_emails', email);
          const blockedSnap = await getDoc(blockedDoc);
          if (blockedSnap.exists()) {
            setIsBlocked(true);
            setLoading(false);
            return;
          }

          // Request Check
          const requestDoc = doc(db, 'access_requests', email);
          const requestSnap = await getDoc(requestDoc);
          setHasRequested(requestSnap.exists());

          // Whitelist Check - Super Admin bypasses DB check for speed/reliability
          let allowed = isSuper;
          
          if (!allowed) {
            const whitelistDoc = doc(db, 'whitelist', email);
            const whitelistSnap = await getDoc(whitelistDoc);
            allowed = whitelistSnap.exists();
          }

          setIsWhitelisted(allowed);

          if (!allowed) {
            setLoading(false);
            return;
          }

          const userDoc = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDoc);
          
          const localData = getLocalProfile(user.uid);
          
          if (!docSnap.exists()) {
            setIsNewUser(true);
            setLoading(false);
            return;
          } else {
            // Ensure admin/owner status is synced for super admin
            const currentProfile = docSnap.data();
            const isAdminByRole = currentProfile.role === 'owner' || currentProfile.role === 'moderator';
            const updates: any = {};
            
            if (isSuper && currentProfile.role !== 'owner') {
              updates.role = 'owner';
              updates.isAdmin = true;
            } else if (isSuper && currentProfile.isAdmin !== true) {
              updates.isAdmin = true;
            }
            
            if (Object.keys(updates).length > 0) {
              await updateDoc(userDoc, updates);
            }

            // Listen for real-time updates (only strictly for Plan, Admin, Identity changes)
            unsubscribeSnapshot = onSnapshot(userDoc, (doc) => {
              const cloudIdentity = doc.data();
              if (cloudIdentity) {
                setProfile(prev => {
                  const currentLocal = getLocalProfile(user.uid);
                  return {
                    ...currentLocal,
                    ...cloudIdentity
                  } as UserProfile;
                });
              }
            }, (error) => {
              // Ignore standard permission errors that occur immediately on sign-out
              if (error.code !== 'permission-denied' && auth.currentUser) {
                handleFirestoreError(error, OperationType.GET, `users/${user.uid}`);
              }
            });
          }

          // Initialize Admin Config (Super-Admin only)
          if (isSuper) {
            const adminDoc = doc(db, 'admin_config', 'global');
            const adminSnap = await getDoc(adminDoc);
            if (!adminSnap.exists()) {
              const initialTiers: Record<string, string[]> = {};
              const initialExpiry: Record<string, number> = { 
                freeTrial: 7,
                free: 0, // 0 = Lifetime/Never
                pro: 30
              };
              const initialFeatures: Record<string, boolean> = {};

              APP_FEATURES.forEach(f => {
                initialFeatures[f.id] = true;
                initialExpiry[f.id] = 0;
                if (['resignationGeneration', 'interviewPrep', 'aiAssistant'].includes(f.id)) {
                  initialTiers[f.id] = ['pro', 'enterprise'];
                } else {
                  initialTiers[f.id] = ['freeTrial', 'free', 'pro', 'enterprise'];
                }
              });

              await setDoc(adminDoc, {
                features: initialFeatures,
                featureTiers: initialTiers,
                featureExpiryDays: initialExpiry,
                planLimits: {
                  freeTrial: { docsPerMonth: 5 },
                  free: { docsPerMonth: 3 },
                  pro: { docsPerMonth: 50 }
                },
                updatedAt: new Date()
              });
            }
          }
        } catch (error) {
          console.error("Initialization error:", error);
          // We don't necessarily want to crash the whole app if admin config fails to init
          // but we should log it properly if it's a permission issue
          if (error instanceof Error && error.message.includes('permission')) {
             handleFirestoreError(error, OperationType.WRITE, 'admin_config/global');
          }
        }
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <Card className="border-none shadow-xl">
            <CardHeader className="text-center space-y-4">
              <div className="relative mx-auto w-fit">
                <div className="absolute -inset-3 bg-primary/20 blur-xl rounded-full" />
                <div className="relative bg-gradient-to-tr from-primary to-indigo-600 p-6 rounded-[2rem] shadow-xl shadow-primary/25">
                  <motion.div
                    animate={{ rotate: [0, 10, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 4 }}
                  >
                    <PenTool className="h-12 w-12 text-white" />
                  </motion.div>
                </div>
              </div>
              <CardTitle className="text-3xl font-bold tracking-tight text-slate-900 leading-tight">Welcome to ProEase</CardTitle>
              <CardDescription className="text-lg">
                Your AI-powered professional workspace for documents, career, and growth.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <Button onClick={signInWithGoogle} size="lg" className="w-full py-6 text-lg rounded-2xl bg-slate-900 group">
                <LogIn className="mr-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                Sign in with Google
              </Button>
              <p className="text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                PROEASE v3.5 DEPLOYMENT
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  if (isRemix) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 p-4 text-white">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="bg-red-500/10 p-10 rounded-[3rem] inline-block border-2 border-red-500/20 shadow-2xl shadow-red-500/10">
            <AlertCircle className="h-16 w-16 text-red-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter">Unauthorized Remix</h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">
              This application instance is unauthorized. The owner has strictly prohibited remixing or creating similar versions of this workspace.
            </p>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest pt-4">
              Access is restricted to the original deployment.
            </p>
          </div>
          <div className="pt-8">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = 'https://ais-pre-sxtb2z2d7q326b3mv3hns7-795029610763.asia-southeast1.run.app'}
              className="h-14 px-10 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-xs hover:bg-white hover:text-slate-900 transition-all"
            >
              Go to Original App
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (isNewUser) {
    const handleStartTrial = async () => {
      if (!user) return;
      setLoading(true);
      try {
        const userDoc = doc(db, 'users', user.uid);
        const configSnap = await getDoc(doc(db, 'admin_config', 'global'));
        const config = configSnap.data() as AdminConfig;
        const trialDays = Number(config?.featureExpiryDays?.freeTrial ?? 7);
        const expiryDate = trialDays > 0 ? new Date(Date.now() + trialDays * 24 * 60 * 60 * 1000) : null;
        const email = user.email?.toLowerCase().trim() || '';
        const superAdmin = 'arvin8786@gmail.com';
        const isSuper = email === superAdmin;

        const coreIdentity = {
          uid: user.uid,
          email: user.email || '',
          plan: 'freeTrial',
          subscriptionExpiry: expiryDate,
          isAdmin: isSuper,
          role: isSuper ? 'owner' : 'user',
          createdAt: new Date(),
          updatedAt: new Date()
        };
        
        await setDoc(userDoc, coreIdentity);
        const localData = getLocalProfile(user.uid);
        
        setProfile({
          ...coreIdentity,
          ...localData,
          displayName: user.displayName || localData.displayName || 'User',
        } as UserProfile);
        setIsNewUser(false);
      } catch (error) {
        console.error("Error starting trial:", error);
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-50 p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full text-center space-y-8"
        >
          <div className="bg-green-50 p-10 rounded-[3rem] inline-block border-2 border-green-100 shadow-xl shadow-green-100/30">
            <CheckCircle2 className="h-16 w-16 text-green-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Welcome to ProEase</h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed px-4">
              Your account has been approved! Ready to start your professional journey?
            </p>
          </div>
          <div className="pt-6">
            <Button 
              onClick={handleStartTrial}
              className="h-16 px-12 rounded-2xl font-black uppercase tracking-widest text-sm shadow-2xl shadow-green-200 w-full"
            >
              Start My Free Trial
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  if (isBlocked) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-950 p-4">
        <div className="max-w-md w-full text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <div className="bg-red-500/20 p-10 rounded-[3rem] inline-block border-2 border-red-500/30 shadow-2xl shadow-red-500/20">
            <AlertCircle className="h-16 w-16 text-red-500" />
          </div>
          <div className="space-y-4">
            <h1 className="text-4xl font-black tracking-tighter text-white">Access Terminated</h1>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">
              Your account (<span className="text-red-400 font-bold">{user.email}</span>) has been strictly blocked by the system administrator. 
            </p>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest pt-4">
              All functionality is permanently restricted.
            </p>
          </div>
          <div className="pt-8">
            <Button 
              variant="outline" 
              onClick={logout} 
              className="h-14 px-10 rounded-2xl border-white/10 bg-white/5 font-black uppercase tracking-widest text-xs text-white hover:bg-white hover:text-slate-900 transition-all"
            >
              Back to Terminal
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isWhitelisted) {
    const handleRequestAccess = async () => {
      if (!user.email) return;
      try {
        await setDoc(doc(db, 'access_requests', user.email.toLowerCase().trim()), {
          id: user.uid,
          email: user.email.toLowerCase().trim(),
          requestedAt: new Date(),
          status: 'pending'
        });
        setHasRequested(true);
      } catch (error) {
        console.error("Request access error:", error);
      }
    };

    return (
      <div className="h-screen w-screen flex items-center justify-center bg-white p-4">
        <div className="max-w-md w-full text-center space-y-8">
          <div className="bg-indigo-50 p-10 rounded-[3rem] inline-block border-2 border-indigo-100 shadow-xl shadow-indigo-100/50">
            <ShieldCheck className="h-16 w-16 text-indigo-500" />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Access Required</h1>
            <p className="text-slate-500 font-medium text-lg leading-relaxed px-4">
              {hasRequested 
                ? "Your access request has been submitted. The administrator will review your application shortly."
                : `This environment is restricted. Request access for your account (${user.email}) to continue.`}
            </p>
          </div>
          <div className="pt-6 flex flex-col gap-3">
            {!hasRequested && (
              <Button 
                onClick={handleRequestAccess}
                className="h-14 px-10 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-indigo-200"
              >
                Request Access Approval
              </Button>
            )}
            <Button 
              variant="outline" 
              onClick={logout} 
              className="h-14 px-10 rounded-2xl border-slate-200 font-black uppercase tracking-widest text-xs hover:bg-slate-50"
            >
              Back to Login
            </Button>
          </div>
          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-[0.3em] pt-10">
            SECURITY SYSTEM ACTIVE • VERSION 3.5.2
          </p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'overview': return <Overview profile={profile} setActiveTab={setActiveTab} />;
      case 'documents': return <DocumentEditor profile={profile} />;
      case 'career': return <CareerVault profile={profile} setActiveTab={setActiveTab} />;
      case 'profile': return <ProfileEditor profile={profile} />;
      case 'interview': return <InterviewPrep profile={profile} />;
      case 'admin': return <AdminPanel profile={profile} />;
      default: return <Overview profile={profile} setActiveTab={setActiveTab} />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col transition-colors duration-300">
      <Navbar 
        user={user} 
        profile={profile}
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLogout={logout} 
      />
      
      <main className={cn("flex-1 w-full max-w-7xl mx-auto p-4 md:p-8", activeTab === 'documents' && "max-w-none px-4 md:px-6")}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className="h-full"
          >
            {renderContent()}
          </motion.div>
        </AnimatePresence>
      </main>

      <AIAssistant profile={profile} activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <ScheduleMonitor profile={profile} />
    </div>
  );
}
