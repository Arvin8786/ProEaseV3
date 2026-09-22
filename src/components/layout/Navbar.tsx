import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  LayoutDashboard, 
  FileText, 
  Briefcase, 
  Calculator, 
  Mic2, 
  LogOut,
  Menu,
  X,
  PenTool,
  ShieldCheck,
  UserCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types';
import { motion, AnimatePresence } from 'motion/react';

interface NavbarProps {
  user: User;
  profile: UserProfile | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export function Navbar({ user, profile, activeTab, setActiveTab, onLogout }: NavbarProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'documents', label: 'Document Vault', icon: FileText },
    { id: 'career', label: 'Career Vault', icon: Briefcase },
    { id: 'profile', label: 'Profile', icon: UserCircle },
    { id: 'interview', label: 'Interview Prep', icon: Mic2 },
  ];

  if (profile?.isAdmin) {
    navItems.push({ id: 'admin', label: 'Admin', icon: ShieldCheck });
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-white/60 bg-white/40 backdrop-blur-2xl">
      <div className="w-full max-w-7xl mx-auto flex h-24 items-center justify-between px-6">
        <div className="flex items-center gap-12">
          <div className="flex items-center gap-4 group cursor-pointer" onClick={() => setActiveTab('overview')}>
            <div className="relative">
              <div className="absolute -inset-2 bg-primary/20 blur-xl rounded-full" />
              <div className="relative bg-gradient-to-tr from-primary to-indigo-600 p-3 rounded-2xl shadow-lg shadow-primary/20 group-hover:scale-110 transition-all duration-500 group-hover:rotate-12 border border-white/20 shrink-0">
                <PenTool className="h-7 w-7 text-white" />
              </div>
            </div>
            <div className="hidden md:flex flex-col items-start justify-center">
              <span className="font-heading font-bold text-3xl tracking-tight bg-gradient-to-br from-slate-900 via-primary to-slate-700 bg-clip-text text-transparent leading-none whitespace-nowrap">
                ProEase <span className="text-xs font-sans align-top ml-1 text-primary italic">Elite</span>
              </span>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.4em] whitespace-nowrap mt-2 translate-x-0.5">
                Executive Career Suite
              </span>
            </div>
          </div>

          <nav className="hidden md:flex items-center bg-slate-900/5 p-1 rounded-2xl border border-white/60">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300",
                  activeTab === item.id 
                    ? "bg-white text-slate-900 shadow-xl border border-white/40" 
                    : "text-slate-400 hover:text-slate-900 hover:bg-white/40"
                )}
              >
                <item.icon className={cn("mr-3 h-4 w-4", activeTab === item.id ? "text-primary" : "text-slate-300")} />
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden lg:flex items-center gap-5 pl-6 border-l border-slate-900/10">
            <div className="text-right">
              <p className="text-sm font-black text-slate-900 leading-none tracking-tight">{user.displayName}</p>
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.2em] mt-1.5 opacity-80">
                Pay-Per-Doc (RM 1)
              </p>
            </div>
            <Avatar className="h-12 w-12 border-2 border-white/60 shadow-xl">
              <AvatarImage src={user.photoURL || ''} />
              <AvatarFallback className="bg-primary text-white font-black">{user.displayName?.charAt(0)}</AvatarFallback>
            </Avatar>
          </div>
          
          <Button variant="outline" size="icon" onClick={onLogout} className="hidden md:flex h-11 w-11 rounded-xl border-slate-200 bg-white hover:bg-red-50 hover:text-red-500 hover:border-red-200 transition-all duration-300">
            <LogOut className="h-5 w-5" />
          </Button>

          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden h-10 w-10 rounded-xl"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </Button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden border-t border-slate-100 bg-white overflow-hidden"
          >
            <div className="p-4 flex flex-col gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center w-full px-5 py-3 rounded-xl text-sm font-bold transition-all",
                    activeTab === item.id 
                      ? "bg-primary/5 text-primary" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <item.icon className={cn("mr-4 h-5 w-5", activeTab === item.id ? "text-primary" : "text-slate-400")} />
                  {item.label}
                </button>
              ))}
              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.photoURL || ''} />
                    <AvatarFallback>{user.displayName?.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-bold text-slate-900">{user.displayName}</p>
                    <p className="text-[10px] text-slate-500 uppercase tracking-wider">Pay-Per-Doc (RM 1)</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={onLogout} className="text-red-500 hover:bg-red-50">
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
