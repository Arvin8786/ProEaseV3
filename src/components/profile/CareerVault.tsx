import React, { useState } from 'react';
import { UserProfile, Experience, Education, UserActivity } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Plus, 
  Briefcase, 
  GraduationCap, 
  Wand2, 
  Trash2, 
  Edit2,
  Sparkles,
  CheckCircle2,
  PenTool,
  Target,
  UserCircle,
  Users,
  Clock,
  Mail,
  Phone,
  MapPin,
  Globe,
  Flag,
  ShieldCheck,
  Calendar,
  Linkedin,
  Camera,
  Loader2,
  X,
  Sparkles as SparklesIcon,
  Bell,
  Save,
  Zap,
  Info,
  ChevronRight,
  Database,
  FileText,
  Link as LinkIcon,
  Award,
  Check,
  ChevronsUpDown,
  Eye,
  EyeOff
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { updateLocalProfileField } from '@/lib/profileStorage';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SignatureVault } from './SignatureVault';
import { ResumeTailor } from './ResumeTailor';
import { CareerAlerts } from './CareerAlerts';
import { PhotoUploadModal } from './PhotoUploadModal';
import { generateProfessionalProfilePicture, generateProfessionalSummary, generateJobDescription, extractProfileDetails } from '@/services/gemini';
import { Label } from '@/components/ui/label';
import { calculateReadinessScore } from '@/lib/profileUtils';

interface AIPhotoEnhancerProps {
  profile: UserProfile;
}

function AIPhotoEnhancer({ profile }: AIPhotoEnhancerProps) {
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [enhancedPhoto, setEnhancedPhoto] = useState<string | null>(null);

  const handleEnhance = async () => {
    if (!profile.photoURL) return;
    setIsEnhancing(true);
    try {
      // Fetch image and convert to base64
      let base64Data = '';
      let mimeType = 'image/jpeg';

      if (profile.photoURL.startsWith('data:')) {
        const parts = profile.photoURL.split(',');
        mimeType = parts[0].split(':')[1].split(';')[0];
        base64Data = parts[1];
      } else {
        const response = await fetch(profile.photoURL);
        const blob = await response.blob();
        mimeType = blob.type;
        const reader = new FileReader();
        base64Data = await new Promise<string>((resolve) => {
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve(base64);
          };
          reader.readAsDataURL(blob);
        });
      }

      const enhancedUrl = await generateProfessionalProfilePicture(
        base64Data, 
        mimeType, 
        (profile.gender?.toLowerCase() as any) || 'other'
      );
      
      if (enhancedUrl) {
        setEnhancedPhoto(enhancedUrl);
        setShowComparison(true);
      }
    } catch (error) {
      console.error("AI Photo Enhancement failed:", error);
      alert("Failed to professionalize photo. Please try again with a clearer picture.");
    } finally {
      setIsEnhancing(false);
    }
  };

  const keepOriginal = () => {
    setShowComparison(false);
    setEnhancedPhoto(null);
  };

  const useEnhanced = async () => {
    if (!enhancedPhoto) return;
    try {
      await updateLocalProfileField(profile!.uid, {
        photoURL: enhancedPhoto,
        activities: [
          {
            id: Math.random().toString(36).substr(2, 9),
            type: 'personal',
            action: 'updated',
            detail: "Professionalized profile photo using ProEase AI",
            timestamp: new Date()
          } as UserActivity,
          ...(profile.activities || [])
        ].slice(0, 50),
        updatedAt: new Date()
      });
      setShowComparison(false);
      setEnhancedPhoto(null);
    } catch (error) {
      console.error("Failed to save enhanced photo:", error);
    }
  };

  return (
    <>
      <Button 
        variant="default" 
        className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl h-10 px-6 font-bold flex items-center gap-2 shadow-lg shadow-indigo-200"
        onClick={handleEnhance}
        disabled={isEnhancing}
      >
        {isEnhancing ? <Loader2 className="h-4 w-4 animate-spin" /> : <SparklesIcon className="h-4 w-4" />}
        AI Professionalize Photo
      </Button>

      <Dialog open={showComparison} onOpenChange={setShowComparison}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] p-0 overflow-hidden">
          <DialogHeader className="p-8 border-b bg-slate-50">
            <DialogTitle className="text-2xl font-black tracking-tight">AI Professional Enhancement</DialogTitle>
            <DialogDescription className="font-medium">
              We've generated a professional version of your photo with executive attire and a studio background.
            </DialogDescription>
          </DialogHeader>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Original Photo</Label>
              <div className="aspect-square rounded-[2rem] overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-inner">
                <img src={profile.photoURL} alt="Original" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-[10px] font-black uppercase tracking-widest text-primary">ProEase AI Version</Label>
                <Badge className="bg-primary/10 text-primary border-none text-[8px] font-black uppercase tracking-widest">Enhanced</Badge>
              </div>
              <div className="aspect-square rounded-[2rem] overflow-hidden border-4 border-primary/20 bg-slate-100 shadow-2xl shadow-primary/10">
                {enhancedPhoto && <img src={enhancedPhoto} alt="Enhanced" className="w-full h-full object-cover" referrerPolicy="no-referrer" />}
              </div>
            </div>
          </div>
          <DialogFooter className="p-8 bg-slate-50 border-t flex gap-3">
            <Button variant="ghost" className="rounded-xl font-bold h-12 px-8" onClick={keepOriginal}>
              Keep Original
            </Button>
            <Button className="rounded-xl font-bold h-12 px-10 shadow-xl shadow-primary/20" onClick={useEnhanced}>
              <Check className="h-4 w-4 mr-2" />
              Use This Professional Photo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

const MAJOR_LANGUAGES = [
  "English", "Spanish", "Mandarin Chinese", "Hindi", "French", "Arabic", "Bengali", "Portuguese", "Russian", "Urdu", "Indonesian", "German", "Japanese", "Swahili", "Marathi", "Telugu", "Turkish", "Tamil", "Vietnamese", "Tagalog"
];

interface CareerVaultProps {
  profile: UserProfile | null;
  setActiveTab: (tab: string) => void;
}

export function CareerVault({ profile, setActiveTab }: CareerVaultProps) {
  const [isAddingExp, setIsAddingExp] = useState(false);
  const [isAddingEdu, setIsAddingEdu] = useState(false);
  const [isAddingRef, setIsAddingRef] = useState(false);
  const [editingExpId, setEditingExpId] = useState<string | null>(null);
  const [editingEduId, setEditingEduId] = useState<string | null>(null);
  const [editingRefId, setEditingRefId] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isGeneratingExpDescr, setIsGeneratingExpDescr] = useState(false);
  const [newExpData, setNewExpData] = useState({
    company: '',
    position: '',
    industry: '',
    jobContext: '',
    startDate: '',
    endDate: '',
    description: '',
    isCurrent: false
  });

  const [newEduData, setNewEduData] = useState({
    school: '',
    degree: '',
    field: '',
    startDate: '',
    endDate: '',
    isCurrent: false
  });

  const [newRefData, setNewRefData] = useState({
    name: '',
    position: '',
    company: '',
    email: '',
    phone: ''
  });

  const [isEditingPersonal, setIsEditingPersonal] = useState(false);
  const [activeVaultTab, setActiveVaultTab] = useState('identity');
  const [personalHighlight, setPersonalHighlight] = useState(false);
  const [personalData, setPersonalData] = useState({
    nationality: profile.nationality || '',
    visaStatus: profile.visaStatus || '',
    gender: profile.gender || ''
  });
  const [skillInput, setSkillInput] = useState('');
  const [langInput, setLangInput] = useState('');
  const [isAddingLang, setIsAddingLang] = useState(false);
  const [newLangData, setNewLangData] = useState({
    name: '',
    proficiency: 'Fluent' as const
  });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; type: 'exp' | 'edu' | 'ref' | 'lang' | 'skill' } | null>(null);
  const [smartImportText, setSmartImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [isEditingSummaryManual, setIsEditingSummaryManual] = useState(false);
  const [summaryInput, setSummaryInput] = useState(profile.professionalSummary || '');
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  React.useEffect(() => {
    if (profile?.professionalSummary) {
      setSummaryInput(profile.professionalSummary);
    }
  }, [profile?.professionalSummary]);

  if (!profile) return null;

  const logActivity = (type: UserActivity['type'], action: string, detail: string, link?: string) => {
    const activity: UserActivity = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      action,
      detail,
      timestamp: new Date(),
      link: link || '/#profile'
    };
    return [activity, ...(profile.activities || [])].slice(0, 50);
  };

  const handleSmartImport = async () => {
    if (!smartImportText.trim()) return;
    setIsImporting(true);
    try {
      const extracted = await extractProfileDetails(smartImportText);
      if (extracted) {
        
        // Prepare updated arrays
        const updatedExperience = [...(profile.experience || [])];
        if (extracted.experience) {
          extracted.experience.forEach((e: any) => {
            updatedExperience.push({
              id: Math.random().toString(36).substr(2, 9),
              ...e
            });
          });
        }

        const updatedEducation = [...(profile.education || [])];
        if (extracted.education) {
          extracted.education.forEach((e: any) => {
            updatedEducation.push({
              id: Math.random().toString(36).substr(2, 9),
              ...e
            });
          });
        }

        const updatedSkills = Array.from(new Set([...(profile.skills || []), ...(extracted.skills || [])]));

        await updateLocalProfileField(profile!.uid, {
          experience: updatedExperience,
          education: updatedEducation,
          skills: updatedSkills,
          activities: logActivity('experience', 'added', 'AI Smart Import: Extracted multiple professional details from provided text'),
          updatedAt: new Date()
        });
        
        setSmartImportText('');
        alert("Smart Import Complete! Your Work Experience, Education, and Skills have been updated.");
      }
    } catch (error) {
      console.error("Smart Import Failed:", error);
      alert("AI was unable to parse the content. Please try a cleaner text sample.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleSavePersonal = async () => {
    try {
      await updateLocalProfileField(profile!.uid, {
        ...personalData,
        activities: logActivity('personal', 'updated', 'Updated Profile'),
        updatedAt: new Date()
      });
      setIsEditingPersonal(false);
    } catch (error) {
      console.error("Error saving personal info:", error);
    }
  };

  const handleAddSkill = async () => {
    if (!skillInput.trim()) return;
    const trimmed = skillInput.trim();
    if (profile.skills?.includes(trimmed)) return;
    
    try {
      await updateLocalProfileField(profile!.uid, {
        skills: [...(profile.skills || []), trimmed],
        activities: logActivity('skill', 'added', `Added ${trimmed} to professional skills`),
        updatedAt: new Date()
      });
      setSkillInput('');
    } catch (error) {
      console.error("Error adding skill:", error);
    }
  };

  const handleDeleteSkill = async (skillToDelete: string) => {
    try {
      await updateLocalProfileField(profile!.uid, {
        skills: profile.skills.filter(s => s !== skillToDelete),
        activities: logActivity('skill', 'deleted', `Removed ${skillToDelete} from professional skills`),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error deleting skill:", error);
    }
  };

  // Sorting logic: Current roles first, then by start date descending
  const sortedExperience = [...(profile.experience || [])].sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1;
    if (!a.isCurrent && b.isCurrent) return 1;
    return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
  });

  const calculateProfileStrength = () => {
    const fields = [
      profile.photoURL,
      profile.professionalSummary,
      profile.experience?.length > 0,
      profile.education?.length > 0,
      profile.skills?.length > 0,
      profile.languages?.length > 0,
      profile.references?.length > 0,
      profile.nationality,
      profile.visaStatus,
      profile.dateOfBirth,
      profile.linkedin,
      profile.address,
      profile.phone
    ];
    const filledFields = fields.filter(Boolean).length;
    return Math.round((filledFields / fields.length) * 100);
  };

  const strength = calculateReadinessScore(profile);

  const handleSaveExperience = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let updatedExperience;

      const currentExperience = profile.experience || [];

      if (editingExpId) {
        updatedExperience = currentExperience.map(exp => 
          exp.id === editingExpId ? { ...exp, ...newExpData } : exp
        );
      } else {
        const newExp: Experience = {
          id: Math.random().toString(36).substr(2, 9),
          ...newExpData
        };
        updatedExperience = [...currentExperience, newExp];
      }

      await updateLocalProfileField(profile!.uid, {
        experience: updatedExperience,
        activities: logActivity('experience', editingExpId ? 'updated' : 'added', `${editingExpId ? 'Updated' : 'Added'} work experience at ${newExpData.company}`),
        updatedAt: new Date()
      });
      
      setIsAddingExp(false);
      setEditingExpId(null);
      setNewExpData({
        company: '',
        position: '',
        industry: '',
        jobContext: '',
        startDate: '',
        endDate: '',
        description: '',
        isCurrent: false
      });
    } catch (error) {
      console.error("Error saving experience:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleDeleteExperience = (id: string) => {
    setDeleteConfirm({ id, type: 'exp' });
  };

  const confirmDeleteExperience = async (id: string) => {
    try {
      const target = (profile.experience || []).find(e => e.id === id);
      const updatedExperience = (profile.experience || []).filter(exp => exp.id !== id);
      await updateLocalProfileField(profile!.uid, {
        experience: updatedExperience,
        activities: logActivity('experience', 'deleted', `Removed work experience at ${target?.company || 'Unknown Company'}`),
        updatedAt: new Date()
      });
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting experience:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleSaveEducation = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let updatedEducation;

      const currentEducation = profile.education || [];

      if (editingEduId) {
        updatedEducation = currentEducation.map(edu => 
          edu.id === editingEduId ? { ...edu, ...newEduData } : edu
        );
      } else {
        const newEdu: Education = {
          id: Math.random().toString(36).substr(2, 9),
          ...newEduData
        };
        updatedEducation = [...currentEducation, newEdu];
      }

      await updateLocalProfileField(profile!.uid, {
        education: updatedEducation,
        activities: logActivity('education', editingEduId ? 'updated' : 'added', `${editingEduId ? 'Updated' : 'Added'} education at ${newEduData.school}`),
        updatedAt: new Date()
      });
      
      setIsAddingEdu(false);
      setEditingEduId(null);
      setNewEduData({
        school: '',
        degree: '',
        field: '',
        startDate: '',
        endDate: '',
        isCurrent: false
      });
    } catch (error) {
      console.error("Error saving education:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleDeleteEducation = (id: string) => {
    setDeleteConfirm({ id, type: 'edu' });
  };

  const confirmDeleteEducation = async (id: string) => {
    try {
      const target = (profile.education || []).find(e => e.id === id);
      const updatedEducation = (profile.education || []).filter(edu => edu.id !== id);
      await updateLocalProfileField(profile!.uid, {
        education: updatedEducation,
        activities: logActivity('education', 'deleted', `Removed education from ${target?.school || 'Unknown School'}`),
        updatedAt: new Date()
      });
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting education:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleSaveReference = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      let updatedReferences;

      if (editingRefId) {
        updatedReferences = (profile.references || []).map(ref => 
          ref.id === editingRefId ? { ...ref, ...newRefData } : ref
        );
      } else {
        const newRef = {
          id: Math.random().toString(36).substr(2, 9),
          ...newRefData
        };
        updatedReferences = [...(profile.references || []), newRef];
      }

      await updateLocalProfileField(profile!.uid, {
        references: updatedReferences,
        activities: logActivity('reference', editingRefId ? 'updated' : 'added', `${editingRefId ? 'Updated' : 'Added'} reference: ${newRefData.name}`),
        updatedAt: new Date()
      });
      
      setIsAddingRef(false);
      setEditingRefId(null);
      setNewRefData({
        name: '',
        position: '',
        company: '',
        email: '',
        phone: ''
      });
    } catch (error) {
      console.error("Error saving reference:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleDeleteReference = (id: string) => {
    setDeleteConfirm({ id, type: 'ref' });
  };

  const confirmDeleteReference = async (id: string) => {
    try {
      const target = (profile.references || []).find(ref => ref.id === id);
      const updatedReferences = (profile.references || []).filter(ref => ref.id !== id);
      await updateLocalProfileField(profile!.uid, {
        references: updatedReferences,
        activities: logActivity('reference', 'deleted', `Removed reference: ${target?.name || 'Unknown'}`),
        updatedAt: new Date()
      });
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting reference:", error);
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const toggleReferenceVisibility = async (id: string, current: boolean) => {
    try {
      const target = (profile.references || []).find(ref => ref.id === id);
      const isVisible = !current;
      const updatedReferences = (profile.references || []).map(ref => 
        ref.id === id ? { ...ref, isVisible } : ref
      );
      await updateLocalProfileField(profile!.uid, {
        references: updatedReferences,
        activities: logActivity('reference', isVisible ? 'shown' : 'hidden', `${isVisible ? 'Ticked (selected)' : 'Unticked (deselected)'} reference for resume: ${target?.name || 'Unknown'}`),
        updatedAt: new Date()
      });
    } catch (error) {
      console.error("Error toggling reference visibility:", error);
    }
  };

  const handleSaveLanguage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLangData.name) return;
    try {
      const updatedLangs = [...(profile.languages || [])];
      const newLang = {
        id: Math.random().toString(36).substr(2, 9),
        ...newLangData
      };
      updatedLangs.push(newLang);
      await updateLocalProfileField(profile!.uid, {
        languages: updatedLangs,
        activities: logActivity('language', 'added', `Added ${newLangData.name} (${newLangData.proficiency}) to languages`),
        updatedAt: new Date()
      });
      setIsAddingLang(false);
      setNewLangData({ name: '', proficiency: 'Fluent' });
      setLangInput('');
    } catch (error) {
      console.error("Error saving language:", error);
    }
  };

  const handleDeleteLanguage = (id: string) => {
    setDeleteConfirm({ id, type: 'lang' });
  };

  const confirmDeleteLanguage = async (id: string) => {
    try {
      const target = (profile.languages || []).find(l => l.id === id);
      const updatedLangs = (profile.languages || []).filter(l => l.id !== id);
      await updateLocalProfileField(profile!.uid, {
        languages: updatedLangs,
        activities: logActivity('language', 'deleted', `Removed ${target?.name || 'language'} from profile`),
        updatedAt: new Date()
      });
      setDeleteConfirm(null);
    } catch (error) {
      console.error("Error deleting language:", error);
    }
  };

  const handleGenerateExperienceAI = async () => {
    if (!newExpData.position || !newExpData.company) return;
    setIsGeneratingExpDescr(true);
    try {
      const suggested = await generateJobDescription(
        newExpData.position, 
        newExpData.company, 
        newExpData.industry,
        newExpData.jobContext
      );
      setNewExpData(prev => ({ ...prev, description: suggested }));
    } catch (err) {
      console.error("AI Gen Failed:", err);
    } finally {
      setIsGeneratingExpDescr(false);
    }
  };

  const handleGenerateSummary = async () => {
    setIsGeneratingSummary(true);
    try {
      const summary = await generateProfessionalSummary(profile);
      await updateLocalProfileField(profile!.uid, {
        professionalSummary: summary,
        activities: logActivity('summary', 'updated', 'Regenerated professional summary with AI'),
        updatedAt: new Date()
      });
      setSummaryInput(summary);
    } catch (error: any) {
      console.error("Error generating summary:", error);
      if (error?.code && typeof error.code === 'string' && error.code.startsWith('permission-')) {
        handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleSaveSummaryManual = async () => {
    try {
      await updateLocalProfileField(profile!.uid, {
        professionalSummary: summaryInput,
        activities: logActivity('summary', 'updated', 'Manually updated professional summary'),
        updatedAt: new Date()
      });
      setIsEditingSummaryManual(false);
    } catch (error) {
      console.error("Error saving manual summary:", error);
    }
  };

  const uniqueCompanies = Array.from(new Set((profile.experience || []).map(exp => exp.company))).filter(Boolean).sort();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-slate-100">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-slate-900 leading-[1.1]">Career Vault</h1>
          <p className="text-lg text-muted-foreground font-medium">Manage your professional identity and let AI craft your story.</p>
        </div>
        <Button onClick={handleGenerateSummary} disabled={isGeneratingSummary} size="lg" className="h-14 px-8 rounded-2xl shadow-xl shadow-primary/20 shrink-0 bg-primary hover:bg-primary/90 text-white font-bold">
          {isGeneratingSummary ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Sparkles className="mr-3 h-5 w-5" />}
          <span className="text-base font-bold">Generate AI Summary</span>
        </Button>
      </div>

      <Tabs value={activeVaultTab} onValueChange={setActiveVaultTab} className="space-y-10">
        <TabsList className="bg-slate-100 p-2 rounded-2xl w-full flex overflow-x-auto lg:overflow-visible">
          <TabsTrigger value="identity" className="flex-1 rounded-xl py-3 data-active:bg-white data-active:shadow-lg shadow-slate-200/50 data-active:text-primary">
            <UserCircle className="mr-3 h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-widest">Identity</span>
          </TabsTrigger>
          <TabsTrigger value="signature" className="flex-1 rounded-xl py-3 data-active:bg-white data-active:shadow-lg shadow-slate-200/50 data-active:text-primary">
            <PenTool className="mr-3 h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-widest">Signatures</span>
          </TabsTrigger>
          <TabsTrigger value="tailor" className="flex-1 rounded-xl py-3 data-active:bg-white data-active:shadow-lg shadow-slate-200/50 data-active:text-primary">
            <Target className="mr-3 h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-widest">Resume Tailor</span>
          </TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1 rounded-xl py-3 data-active:bg-white data-active:shadow-lg shadow-slate-200/50 data-active:text-primary">
            <Bell className="mr-3 h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-widest">Alerts</span>
          </TabsTrigger>
          <TabsTrigger value="stream" className="flex-1 rounded-xl py-3 data-active:bg-white data-active:shadow-lg shadow-slate-200/50 data-active:text-primary">
            <Clock className="mr-3 h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-widest">Action Log</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="identity">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              {/* AI/Professional Executive Summary Card */}
              <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight text-slate-800">
                      <div className="bg-primary/10 p-2 rounded-xl">
                        <Sparkles className="h-6 w-6 text-primary" />
                      </div>
                      Executive Summary
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isGeneratingSummary}
                        onClick={handleGenerateSummary}
                        className="text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/5 h-9"
                      >
                        {isGeneratingSummary ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-2" />
                        )}
                        Rewrite with AI
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  {isEditingSummaryManual ? (
                    <div className="space-y-4">
                      <Textarea
                        value={summaryInput}
                        onChange={(e) => setSummaryInput(e.target.value)}
                        placeholder="Type or paste your professional summary. Make it punchy and highlight your key achievements..."
                        className="rounded-2xl border-slate-200 bg-white min-h-[140px] text-base leading-relaxed p-4 font-medium"
                      />
                      <div className="flex justify-end gap-3">
                        <Button
                          variant="ghost"
                          className="rounded-xl font-bold h-10"
                          onClick={() => {
                            setIsEditingSummaryManual(false);
                            setSummaryInput(profile.professionalSummary || '');
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          className="rounded-xl font-bold bg-slate-900 text-white h-10 px-6"
                          onClick={handleSaveSummaryManual}
                        >
                          Save Summary
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {profile.professionalSummary ? (
                        <p className="text-slate-700 text-base leading-relaxed font-semibold">
                          {profile.professionalSummary}
                        </p>
                      ) : (
                        <div className="text-center py-8 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl p-6">
                          <p className="text-sm font-medium mb-4">No professional summary generated yet. Create one with ProEase AI to tell your story beautifully.</p>
                          <Button
                            onClick={handleGenerateSummary}
                            disabled={isGeneratingSummary}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-11 px-6 rounded-xl shadow-lg shadow-indigo-100"
                          >
                            {isGeneratingSummary ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                            Write Summary with AI
                          </Button>
                        </div>
                      )}
                      
                      {profile.professionalSummary && (
                        <div className="flex justify-start">
                          <Button
                            variant="ghost"
                            className="rounded-xl h-10 text-slate-500 hover:bg-slate-50 font-bold flex items-center gap-2"
                            onClick={() => setIsEditingSummaryManual(true)}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                            Edit Summary
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Personal Details & Profile Photo */}
              <Card id="personal-details-card" className={cn(
                "border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white transition-all duration-1000",
                personalHighlight && "ring-4 ring-indigo-500 animate-pulse ring-offset-4 bg-indigo-50/20"
              )}>
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                      <div className="bg-primary/10 p-2 rounded-xl">
                        <UserCircle className="h-6 w-6 text-primary" />
                      </div>
                      Personal Details
                    </CardTitle>
                    <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-400">
                      <ShieldCheck className="h-4 w-4 text-green-500" />
                      Verified Profile
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-8">
                  <div className="flex flex-col md:flex-row gap-10 items-start">
                    <div className="flex flex-col items-center gap-4">
                      <div className="relative group">
                        <div 
                          className="w-40 h-40 rounded-[2.5rem] overflow-hidden bg-slate-100 border-2 border-slate-200 group-hover:border-primary transition-all duration-300 shadow-inner cursor-pointer"
                          onClick={() => setIsPhotoModalOpen(true)}
                          title="Click to update photo"
                        >
                          {profile.photoURL ? (
                            <img 
                              src={profile.photoURL} 
                              alt="Profile" 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50">
                              <Camera className="h-10 w-10 mb-2 opacity-20" />
                              <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Upload Photo</span>
                            </div>
                          )}
                        </div>
                        <Button 
                          size="icon" 
                          variant="secondary" 
                          className="absolute -bottom-2 -right-2 rounded-2xl shadow-xl h-12 w-12 bg-white hover:bg-slate-50 border border-slate-200"
                          onClick={() => setIsPhotoModalOpen(true)}
                          title="Upload / Change Profile Photo"
                        >
                          <Camera className="h-5 w-5 text-primary" />
                        </Button>
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Profile Picture</p>
                    </div>

                    <div className="flex-1 space-y-8 w-full">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Full Legal Name</Label>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 shadow-sm">
                            {profile.displayName}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email Address</Label>
                          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 shadow-sm">
                            {profile.email}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Nationality</Label>
                          {isEditingPersonal ? (
                            <Input 
                              value={personalData.nationality}
                              onChange={e => setPersonalData({...personalData, nationality: e.target.value})}
                              className="rounded-2xl border-slate-200 bg-white h-12 font-bold"
                            />
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 shadow-sm flex items-center gap-2">
                              <Flag className="h-4 w-4 text-slate-400" />
                              {profile.nationality || 'Not specified'}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Gender</Label>
                          {isEditingPersonal ? (
                            <Select 
                              value={personalData.gender} 
                              onValueChange={value => setPersonalData({...personalData, gender: value})}
                            >
                              <SelectTrigger className="rounded-2xl border-slate-200 bg-white h-12 font-bold">
                                <SelectValue placeholder="Select Gender" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl">
                                <SelectItem value="Male">Male</SelectItem>
                                <SelectItem value="Female">Female</SelectItem>
                                <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 shadow-sm flex items-center gap-2">
                              <Users className="h-4 w-4 text-slate-400" />
                              {profile.gender || 'Not specified'}
                            </div>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Visa / Work Status</Label>
                          {isEditingPersonal ? (
                            <Input 
                              value={personalData.visaStatus}
                              onChange={e => setPersonalData({...personalData, visaStatus: e.target.value})}
                              className="rounded-2xl border-slate-200 bg-white h-12 font-bold"
                            />
                          ) : (
                            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold text-slate-700 shadow-sm flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-slate-400" />
                              {profile.visaStatus || 'Not specified'}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 pt-8 border-t border-slate-100">
                        {profile.photoURL && (
                          <AIPhotoEnhancer profile={profile} />
                        )}
                        {isEditingPersonal ? (
                          <div className="flex gap-2">
                            <Button size="sm" className="rounded-xl h-10 px-6 font-bold" onClick={handleSavePersonal}>
                              <Save className="h-4 w-4 mr-2" /> Save Changes
                            </Button>
                            <Button size="sm" variant="outline" className="rounded-xl h-10 px-6 font-bold" onClick={() => setIsEditingPersonal(false)}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button 
                            variant="ghost" 
                            className="rounded-xl h-10 px-4 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                            onClick={() => setIsEditingPersonal(true)}
                          >
                            <Edit2 className="h-3.5 w-3.5 text-slate-400" />
                            Edit Details
                          </Button>
                        )}
                        <Button 
                          variant="ghost" 
                          className="rounded-xl h-10 px-4 font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                          onClick={() => setActiveTab('profile')}
                        >
                          <UserCircle className="h-3.5 w-3.5 text-slate-400" />
                          Full Profile Editor
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Experience Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black flex items-center gap-3 text-slate-900">
                      <Briefcase className="h-7 w-7 text-primary" />
                      Work Experience
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Your professional timeline and achievements.</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl font-bold h-10 px-4" onClick={() => setIsAddingExp(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Role
                  </Button>
                </div>

                {isAddingExp && (
                  <Card className="border-primary/20 bg-primary/5 rounded-[2rem] overflow-hidden shadow-lg border-2">
                    <CardHeader className="p-8 pb-0">
                      <CardTitle className="text-xl">
                        {editingExpId ? 'Edit Work Experience' : 'Add New Work Experience'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <form onSubmit={handleSaveExperience} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company</Label>
                            <Input 
                              value={newExpData.company}
                              onChange={e => setNewExpData({...newExpData, company: e.target.value})}
                              required 
                              placeholder="e.g. Google" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position</Label>
                            <Input 
                              value={newExpData.position}
                              onChange={e => setNewExpData({...newExpData, position: e.target.value})}
                              required 
                              placeholder="e.g. Senior Engineer" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry</Label>
                            <Input 
                              value={newExpData.industry}
                              onChange={e => setNewExpData({...newExpData, industry: e.target.value})}
                              placeholder="e.g. Technology, Healthcare, Finance" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</Label>
                            <Input 
                              value={newExpData.startDate}
                              onChange={e => setNewExpData({...newExpData, startDate: e.target.value})}
                              type="month" 
                              required 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</Label>
                            <Input 
                              value={newExpData.endDate}
                              onChange={e => setNewExpData({...newExpData, endDate: e.target.value})}
                              type="month" 
                              disabled={newExpData.isCurrent}
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="isCurrentNew"
                            checked={newExpData.isCurrent}
                            onChange={e => setNewExpData({...newExpData, isCurrent: e.target.checked, endDate: e.target.checked ? '' : newExpData.endDate})}
                            className="w-4 h-4 rounded border-slate-300 text-primary"
                          />
                          <Label htmlFor="isCurrentNew" className="text-xs font-bold text-slate-600">Currently work here</Label>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Context (Optional Reference)</Label>
                          <Textarea 
                            value={newExpData.jobContext}
                            onChange={e => setNewExpData({...newExpData, jobContext: e.target.value})}
                            placeholder="Paste a job description or list your tasks here. AI will use this to generate professional bullet points..." 
                            className="rounded-xl border-slate-200 bg-white h-24 text-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Description</Label>
                            <Button 
                              type="button"
                              variant="ghost" 
                              size="sm" 
                              className="h-8 text-[10px] font-black uppercase text-primary hover:text-primary/80"
                              disabled={!newExpData.position || !newExpData.company || isGeneratingExpDescr}
                              onClick={handleGenerateExperienceAI}
                            >
                              {isGeneratingExpDescr ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Sparkles className="h-3 w-3 mr-2" />}
                              AI Assist
                            </Button>
                          </div>
                          <Textarea 
                            value={newExpData.description}
                            onChange={e => setNewExpData({...newExpData, description: e.target.value})}
                            required 
                            placeholder="What did you achieve? Use AI Assist for suggestions..." 
                            className="rounded-xl border-slate-200 bg-white min-h-[150px] text-sm leading-relaxed"
                          />
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => {
                            setIsAddingExp(false);
                            setEditingExpId(null);
                            setNewExpData({
                              company: '',
                              position: '',
                              industry: '',
                              jobContext: '',
                              startDate: '',
                              endDate: '',
                              description: '',
                              isCurrent: false
                            });
                          }}>Cancel</Button>
                          <Button type="submit" className="rounded-xl font-bold px-8 bg-slate-900 text-white">
                            {editingExpId ? 'Update Role' : 'Save to Vault'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                {/* AI Smart Import Section */}
                <div className="flex flex-col gap-6 p-8 bg-indigo-50/30 rounded-[2.5rem] border-2 border-dashed border-indigo-200/50 mb-10 transition-all hover:bg-white hover:border-indigo-400 group/import">
                  <div className="flex items-center gap-4">
                     <div className="bg-indigo-600 text-white p-3 rounded-2xl shadow-lg shadow-indigo-200 group-hover/import:rotate-12 transition-transform">
                        <Zap className="h-6 w-6" />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black tracking-tight text-slate-900 leading-none">AI Smart Import</h3>
                        <p className="text-sm font-bold text-indigo-600 uppercase tracking-widest mt-2 flex items-center gap-2">
                           <Sparkles className="h-4 w-4" /> 
                           Auto-populate from raw text
                        </p>
                     </div>
                  </div>
                  
                  <div className="relative">
                    <Textarea 
                      value={smartImportText}
                      onChange={(e) => setSmartImportText(e.target.value)}
                      placeholder="Paste text from LinkedIn, your old resume, or raw job history here. Let ProEase AI capture the structure, spacing, and hierarchy for you..." 
                      className="rounded-3xl border-slate-200 bg-white p-6 min-h-[160px] text-base font-medium placeholder:text-slate-300 focus:border-indigo-500 focus:ring-0 transition-all shadow-sm"
                    />
                    <Button 
                        onClick={handleSmartImport}
                        disabled={isImporting || !smartImportText.trim()}
                        className="absolute bottom-4 right-4 rounded-xl h-12 px-6 font-black bg-indigo-600 text-white shadow-xl shadow-indigo-200 hover:bg-slate-900 transition-all active:scale-95"
                    >
                        {isImporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Database className="h-4 w-4 mr-2" />}
                        {isImporting ? 'ANALYZING...' : 'IMPORT NOW'}
                    </Button>
                  </div>
                  <div className="flex items-start gap-3 bg-white/50 p-4 rounded-2xl border border-indigo-100">
                     <Info className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
                     <p className="text-xs text-indigo-700/80 font-bold leading-relaxed">
                        Tip: Copy-paste your entire LinkedIn experience section. Our AI will automatically split it into company name, role, dates, and achievement bullets.
                     </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {sortedExperience.length === 0 ? (
                    <p className="text-center py-12 text-muted-foreground bg-white rounded-xl border border-dashed">
                      No experience added yet.
                    </p>
                  ) : (
                    sortedExperience.map((exp) => (
                      <Card key={exp.id} className="group hover:shadow-lg transition-all border-l-4 border-l-primary/20 hover:border-l-primary bg-white">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="flex gap-5">
                              <div className="bg-slate-50 p-4 rounded-2xl h-fit border border-slate-100 group-hover:bg-primary/5 transition-colors">
                                <Briefcase className="h-8 w-8 text-primary/60 group-hover:text-primary transition-colors" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-xl tracking-tight text-slate-900">{exp.position}</h3>
                                  {exp.isCurrent && (
                                    <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100 border-none text-[10px] font-bold uppercase tracking-wider">
                                      Current
                                    </Badge>
                                  )}
                                  {exp.industry && (
                                    <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider border-slate-200 text-slate-500">
                                      {exp.industry}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-primary font-semibold text-base">{exp.company}</p>
                                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                                  <Clock className="h-3.5 w-3.5" />
                                  {exp.startDate} — {exp.isCurrent ? 'Present' : exp.endDate}
                                </div>
                                <div className="pt-4">
                                  <p className="text-slate-600 leading-relaxed text-sm max-w-2xl">
                                    {exp.description}
                                  </p>
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-all transform translate-x-0">
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 className="h-9 w-9 rounded-full hover:bg-slate-100"
                                onClick={() => {
                                  setNewExpData({
                                    company: exp.company,
                                    position: exp.position,
                                    industry: exp.industry || '',
                                    jobContext: '',
                                    startDate: exp.startDate,
                                    endDate: exp.endDate || '',
                                    description: exp.description,
                                    isCurrent: exp.isCurrent
                                  });
                                  setEditingExpId(exp.id);
                                  setIsAddingExp(true);
                                }}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-9 w-9 rounded-full hover:bg-red-50 text-destructive"
                                onClick={() => handleDeleteExperience(exp.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </section>

              {/* Education Section */}
              <section className="space-y-4 pt-10 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black flex items-center gap-3">
                      <GraduationCap className="h-7 w-7 text-primary" />
                      Education
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Your academic background and certifications.</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => setIsAddingEdu(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Education
                  </Button>
                </div>

                {isAddingEdu && (
                  <Card className="border-primary/20 bg-primary/5 rounded-[2rem] overflow-hidden shadow-lg border-2">
                    <CardHeader className="p-8 pb-0">
                      <CardTitle className="text-xl">
                        {editingEduId ? 'Edit Education' : 'Add New Education'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <form onSubmit={handleSaveEducation} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">School / University</Label>
                            <Input 
                              value={newEduData.school}
                              onChange={e => setNewEduData({...newEduData, school: e.target.value})}
                              required 
                              placeholder="e.g. National University of Singapore" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Degree</Label>
                            <Input 
                              value={newEduData.degree}
                              onChange={e => setNewEduData({...newEduData, degree: e.target.value})}
                              required 
                              placeholder="e.g. Bachelor of Science" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Field of Study</Label>
                            <Input 
                              value={newEduData.field}
                              onChange={e => setNewEduData({...newEduData, field: e.target.value})}
                              required 
                              placeholder="e.g. Computer Science" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</Label>
                            <Input 
                              value={newEduData.startDate}
                              onChange={e => setNewEduData({...newEduData, startDate: e.target.value})}
                              type="month" 
                              required 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</Label>
                            <Input 
                              value={newEduData.endDate}
                              onChange={e => setNewEduData({...newEduData, endDate: e.target.value})}
                              type="month" 
                              disabled={newEduData.isCurrent}
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id="eduIsCurrent"
                            checked={newEduData.isCurrent}
                            onChange={e => setNewEduData({...newEduData, isCurrent: e.target.checked, endDate: e.target.checked ? '' : newEduData.endDate})}
                            className="w-4 h-4 rounded border-slate-300 text-primary"
                          />
                          <Label htmlFor="eduIsCurrent" className="text-xs font-bold text-slate-600">Currently studying here</Label>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => {
                            setIsAddingEdu(false);
                            setEditingEduId(null);
                            setNewEduData({
                              school: '',
                              degree: '',
                              field: '',
                              startDate: '',
                              endDate: '',
                              isCurrent: false
                            });
                          }}>Cancel</Button>
                          <Button type="submit" className="rounded-xl font-bold px-8 bg-slate-900 text-white">
                            {editingEduId ? 'Update Education' : 'Save Education'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="space-y-4">
                  {(profile.education?.length || 0) === 0 ? (
                    <div className="text-center py-8 text-muted-foreground bg-slate-50 rounded-xl border border-dashed">
                      No education records added yet.
                    </div>
                  ) : (
                    profile.education.map((edu) => (
                      <Card key={edu.id} className="group hover:shadow-md transition-all border-l-4 border-l-indigo-200">
                        <CardContent className="p-6">
                          <div className="flex justify-between items-start">
                            <div className="space-y-1">
                              <h3 className="font-bold text-lg">{edu.degree} in {edu.field}</h3>
                              <p className="text-indigo-600 font-semibold">{edu.school}</p>
                              <p className="text-sm text-slate-500">{edu.startDate} — {edu.isCurrent ? 'Present' : (edu.endDate || 'Present')}</p>
                            </div>
                            <div className="flex gap-1 opacity-70 group-hover:opacity-100 transition-all">
                               <Button 
                                 size="icon" 
                                 variant="ghost" 
                                 className="h-8 w-8 rounded-full hover:bg-slate-100"
                                onClick={() => {
                                  setNewEduData({
                                    school: edu.school,
                                    degree: edu.degree,
                                    field: edu.field,
                                    startDate: edu.startDate,
                                    endDate: edu.endDate || '',
                                    isCurrent: edu.isCurrent
                                  });
                                  setEditingEduId(edu.id);
                                  setIsAddingEdu(true);
                                }}
                              >
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-8 w-8 rounded-full hover:bg-red-50 text-destructive"
                                onClick={() => handleDeleteEducation(edu.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </section>

              {/* References Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Professional References
                  </h2>
                  <Button size="sm" variant="outline" onClick={() => {
                    setEditingRefId(null);
                    setIsAddingRef(true);
                  }}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Reference
                  </Button>
                </div>

                {isAddingRef && (
                  <Card className="border-primary/20 bg-primary/5 rounded-[2rem] overflow-hidden shadow-lg border-2">
                    <CardHeader className="p-8 pb-0">
                      <CardTitle className="text-xl">
                        {editingRefId ? 'Edit Reference' : 'Add New Reference'}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      <form onSubmit={handleSaveReference} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Name</Label>
                            <Input 
                              value={newRefData.name}
                              onChange={e => setNewRefData({...newRefData, name: e.target.value})}
                              required 
                              placeholder="e.g. John Smith" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position</Label>
                            <Input 
                              value={newRefData.position}
                              onChange={e => setNewRefData({...newRefData, position: e.target.value})}
                              required 
                              placeholder="e.g. HR Manager" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company</Label>
                            {uniqueCompanies.length > 0 ? (
                              <Select 
                                value={newRefData.company} 
                                onValueChange={value => setNewRefData({...newRefData, company: value})}
                              >
                                <SelectTrigger className="rounded-xl border-slate-200 bg-white h-12">
                                  <SelectValue placeholder="Select a company from your profile" />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {uniqueCompanies.map((company) => (
                                    <SelectItem key={company} value={company}>{company}</SelectItem>
                                  ))}
                                  <SelectItem value="Other">Other (Type manually below)</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Input 
                                value={newRefData.company}
                                onChange={e => setNewRefData({...newRefData, company: e.target.value})}
                                required 
                                placeholder="e.g. Acme Corp" 
                                className="rounded-xl border-slate-200 bg-white h-12"
                              />
                            )}
                            {uniqueCompanies.length > 0 && (newRefData.company === 'Other' || !uniqueCompanies.includes(newRefData.company)) && (
                               <Input 
                                value={newRefData.company === 'Other' ? '' : newRefData.company}
                                onChange={e => setNewRefData({...newRefData, company: e.target.value})}
                                required 
                                placeholder="Enter company name manually" 
                                className="rounded-xl border-slate-200 bg-white h-12 mt-2"
                              />
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email Address (Optional)</Label>
                            <Input 
                              value={newRefData.email}
                              onChange={e => setNewRefData({...newRefData, email: e.target.value})}
                              type="email"
                              placeholder="e.g. john@example.com" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone Number (Optional)</Label>
                            <Input 
                              value={newRefData.phone}
                              onChange={e => setNewRefData({...newRefData, phone: e.target.value})}
                              placeholder="e.g. +60 12-345 6789" 
                              className="rounded-xl border-slate-200 bg-white h-12"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => {
                            setIsAddingRef(false);
                            setEditingRefId(null);
                            setNewRefData({
                              name: '',
                              position: '',
                              company: '',
                              email: '',
                              phone: ''
                            });
                          }}>Cancel</Button>
                          <Button type="submit" className="rounded-xl font-bold px-8 bg-slate-900 text-white">
                            {editingRefId ? 'Update Reference' : 'Save Reference'}
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(profile.references?.length || 0) === 0 ? (
                    <div className="md:col-span-2 text-center py-8 text-muted-foreground bg-slate-50 rounded-xl border border-dashed text-sm">
                      No references added. Add them in the Professional Profile editor.
                    </div>
                  ) : (
                    profile.references.map((ref) => (
                      <Card key={ref.id} className={cn(
                        "hover:shadow-md transition-all border-l-4 bg-white group relative",
                        ref.isVisible !== false ? "border-l-primary" : "border-l-slate-200 opacity-60 grayscale-[0.5]"
                      )}>
                        <CardContent className="p-5">
                          <div className="flex justify-between items-start">
                             <div className="space-y-3">
                              <div>
                                <h3 className="font-bold text-slate-900">{ref.name}</h3>
                                <p className="text-xs font-bold text-primary uppercase tracking-wider">{ref.position}</p>
                                <p className="text-sm text-slate-500 font-medium">@{ref.company}</p>
                              </div>
                              <div className="pt-2 flex flex-col gap-1">
                                {ref.email && (
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Mail className="h-3 w-3" />
                                    {ref.email}
                                  </div>
                                )}
                                {ref.phone && (
                                  <div className="flex items-center gap-2 text-xs text-slate-500">
                                    <Phone className="h-3 w-3" />
                                    {ref.phone}
                                  </div>
                                )}
                              </div>
                            </div>
                              <div className="flex flex-col gap-1">
                                <div 
                                  className="flex items-center gap-2 pr-2 mb-2 cursor-pointer select-none" 
                                  onClick={() => toggleReferenceVisibility(ref.id, ref.isVisible !== false)}
                                >
                                   <input 
                                     type="checkbox"
                                     checked={ref.isVisible !== false}
                                     onChange={() => {}} // parent div handles click safely
                                     className="h-4 w-4 rounded text-primary border-slate-300 focus:ring-primary cursor-pointer accent-indigo-600"
                                   />
                                   <Label className="text-[10px] font-black uppercase text-slate-400 cursor-pointer">Include in Resume</Label>
                                </div>
                                <div className="flex gap-1 justify-end">
                                 <Button 
                                   size="icon" 
                                   variant="ghost" 
                                   className="h-8 w-8 rounded-full hover:bg-slate-100"
                                  onClick={() => {
                                    setNewRefData({
                                      name: ref.name,
                                      position: ref.position,
                                      company: ref.company,
                                      email: ref.email,
                                      phone: ref.phone
                                    });
                                    setEditingRefId(ref.id);
                                    setIsAddingRef(true);
                                  }}
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button 
                                  size="icon" 
                                  variant="ghost" 
                                  className="h-8 w-8 rounded-full hover:bg-red-50 text-destructive"
                                  onClick={() => handleDeleteReference(ref.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                               </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </section>

              {/* Languages Section */}
              <section className="space-y-4 pt-10 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black flex items-center gap-3">
                      <Globe className="h-7 w-7 text-primary" />
                      Languages
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">Multi-lingual communication skills.</p>
                  </div>
                  <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => setIsAddingLang(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Language
                  </Button>
                </div>

                {isAddingLang && (
                  <Card className="border-primary/20 bg-primary/5 rounded-[2rem] overflow-hidden shadow-lg border-2">
                    <CardHeader className="p-8 pb-0">
                      <CardTitle className="text-xl">Add New Language</CardTitle>
                      <CardDescription>Select a major language and your proficiency level.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8">
                      <form onSubmit={handleSaveLanguage} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2 relative">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Language Name</Label>
                            <Input 
                              value={langInput}
                              onChange={e => {
                                setLangInput(e.target.value);
                                setNewLangData({ ...newLangData, name: e.target.value });
                              }}
                              required 
                              placeholder="Search or type language..." 
                              className="rounded-xl border-slate-200 bg-white h-12 font-bold"
                            />
                            {langInput && !MAJOR_LANGUAGES.includes(langInput) && (
                              <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                                {MAJOR_LANGUAGES.filter(l => l.toLowerCase().includes(langInput.toLowerCase())).map(l => (
                                  <div 
                                    key={l}
                                    className="p-3 hover:bg-slate-50 cursor-pointer text-sm font-bold text-slate-700 flex items-center justify-between"
                                    onClick={() => {
                                      setNewLangData({ ...newLangData, name: l });
                                      setLangInput(l);
                                    }}
                                  >
                                    {l}
                                    <Plus className="h-3 w-3 text-primary" />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Proficiency</Label>
                            <div className="flex gap-2">
                              {['Basic', 'Intermediate', 'Fluent', 'Native'].map((level) => (
                                <Button
                                  key={level}
                                  type="button"
                                  variant={newLangData.proficiency === level ? 'default' : 'outline'}
                                  className="flex-1 rounded-xl h-12 text-[10px] font-black uppercase tracking-widest"
                                  onClick={() => setNewLangData({ ...newLangData, proficiency: level as any })}
                                >
                                  {level}
                                </Button>
                              ))}
                            </div>
                          </div>
                        </div>
                        <div className="flex justify-end gap-3 pt-4">
                          <Button type="button" variant="ghost" className="rounded-xl font-bold" onClick={() => {
                            setIsAddingLang(false);
                            setLangInput('');
                            setNewLangData({ name: '', proficiency: 'Fluent' });
                          }}>Cancel</Button>
                          <Button 
                            type="submit" 
                            disabled={!newLangData.name}
                            className="rounded-xl font-bold px-8 bg-slate-900 text-white"
                          >
                            Save Language
                          </Button>
                        </div>
                      </form>
                    </CardContent>
                  </Card>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {(profile.languages?.length || 0) === 0 ? (
                    <div className="md:col-span-2 lg:col-span-3 text-center py-6 text-muted-foreground bg-slate-50 rounded-xl border border-dashed text-xs">
                      No languages added.
                    </div>
                  ) : (
                    profile.languages.map((lang) => (
                      <div key={lang.id} className="p-4 bg-white border border-slate-100 rounded-2xl flex items-center justify-between group hover:border-primary/50 transition-all shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="bg-indigo-50 p-2 rounded-xl">
                            <Globe className="h-4 w-4 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{lang.name}</p>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{lang.proficiency}</p>
                          </div>
                        </div>
                        <Button 
                          size="icon" 
                          variant="ghost" 
                          className="h-8 w-8 rounded-full opacity-65 group-hover:opacity-100 transition-all text-destructive hover:bg-red-50 hover:text-red-600"
                          onClick={() => handleDeleteLanguage(lang.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>

            <div className="space-y-8">
              <Card>
                <CardHeader>
                  <CardTitle>Skills & Expertise</CardTitle>
                  <CardDescription>Add your technical and soft skills</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Add a skill..." 
                      value={skillInput}
                      onChange={(e) => setSkillInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleAddSkill()}
                    />
                    <Button size="icon" onClick={handleAddSkill}><Plus className="h-4 w-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {profile.skills?.map(skill => (
                      <div key={skill} className="bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2">
                        {skill}
                        <Trash2 
                          className="h-3 w-3 cursor-pointer hover:text-destructive" 
                          onClick={() => handleDeleteSkill(skill)}
                        />
                      </div>
                    ))}
                    {(profile.skills?.length || 0) === 0 && <p className="text-sm text-muted-foreground">No skills added.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-slate-900 text-white overflow-hidden relative">
                <Sparkles className="absolute -top-4 -right-4 h-24 w-24 text-white/5" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-400" />
                    Profile Strength
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${strength}%` }}
                      className="h-full bg-green-400"
                    />
                  </div>
                  <p className="text-sm text-slate-300">
                    Your profile is {strength}% complete. {strength < 100 ? 'Fill in more details to stand out to employers.' : 'Excellent! Your profile is fully complete.'}
                  </p>
                  <Button 
                    variant="secondary" 
                    className="w-full font-bold h-12 rounded-2xl" 
                    onClick={() => {
                      setActiveTab('profile');
                      window.location.hash = 'personal'; // Scroll to personal section
                    }}
                  >
                    Complete Profile
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="signature">
          <SignatureVault profile={profile} />
        </TabsContent>

        <TabsContent value="tailor">
          <ResumeTailor profile={profile} />
        </TabsContent>

        <TabsContent value="alerts">
          <CareerAlerts profile={profile} />
        </TabsContent>

        <TabsContent value="stream">
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="bg-slate-50/50 p-8 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                     <Clock className="h-6 w-6 text-primary" />
                     Career Stream
                  </CardTitle>
                  <CardDescription className="text-sm font-medium">A chronological log of your professional journey and document changes.</CardDescription>
                </div>
                <Badge variant="outline" className="h-8 px-4 rounded-xl font-bold border-slate-200">
                  {profile.activities?.length || 0} Events Logged
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              <div className="space-y-6 relative">
                <div className="absolute left-6 top-0 bottom-0 w-px bg-slate-100 hidden md:block" />
                
                {(!profile.activities || profile.activities.length === 0) ? (
                  <div className="text-center py-20 text-slate-400">
                    <Clock className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="font-bold uppercase tracking-widest text-xs">No activity logged yet</p>
                  </div>
                ) : (
                  profile.activities.map((activity, index) => (
                    <div key={activity.id} className="relative flex flex-col md:flex-row gap-6 group">
                      <div className="hidden md:flex items-center justify-center w-12 h-12 rounded-2xl bg-white border-2 border-slate-100 shadow-sm z-10 group-hover:border-primary transition-colors shrink-0">
                        {activity.type === 'experience' && <Briefcase className="h-5 w-5 text-indigo-500" />}
                        {activity.type === 'education' && <GraduationCap className="h-5 w-5 text-blue-500" />}
                        {activity.type === 'skill' && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                        {activity.type === 'document' && <FileText className="h-5 w-5 text-orange-500" />}
                        {activity.type === 'personal' && <UserCircle className="h-5 w-5 text-purple-500" />}
                        {activity.type === 'summary' && <Sparkles className="h-5 w-5 text-amber-500" />}
                      </div>
                      
                      <div 
                        onClick={() => {
                           if (activity.type === 'personal') {
                             setActiveVaultTab('identity');
                             setPersonalHighlight(true);
                             setTimeout(() => {
                               setPersonalHighlight(false);
                             }, 60000);
                             setTimeout(() => {
                               const element = document.getElementById('personal-details-card');
                               if (element) {
                                 element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                               }
                             }, 150);
                           } else if (activity.link?.startsWith('/#')) {
                             setActiveTab(activity.link.replace('/#', ''));
                           }
                        }}
                        className="flex-1 bg-slate-50 p-6 rounded-3xl border border-slate-100 hover:border-primary/40 group-hover:bg-white group-hover:shadow-xl group-hover:shadow-slate-200/50 transition-all cursor-pointer select-none"
                      >
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-2">
                           <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                              {new Date(activity.timestamp?.toDate ? activity.timestamp.toDate() : activity.timestamp).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                           </span>
                           <Badge className="bg-white border-slate-200 text-slate-600 w-fit text-[9px] font-black tracking-widest uppercase px-3 py-0.5">
                              {activity.type} • {activity.action}
                           </Badge>
                        </div>
                        <p className="text-slate-900 font-bold text-lg mb-1">{activity.detail}</p>
                        {(activity.link || activity.type === 'personal') && (
                          <Button 
                            variant="link" 
                            className="p-0 h-auto text-primary text-xs font-bold uppercase tracking-widest"
                            onClick={(e) => {
                               e.stopPropagation(); // Parent div click is already handling!
                               if (activity.type === 'personal') {
                                 setActiveVaultTab('identity');
                                 setPersonalHighlight(true);
                                 setTimeout(() => {
                                   setPersonalHighlight(false);
                                 }, 60000);
                                 setTimeout(() => {
                                   const element = document.getElementById('personal-details-card');
                                   if (element) {
                                     element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                   }
                                 }, 150);
                               } else if (activity.link?.startsWith('/#')) {
                                 setActiveTab(activity.link.replace('/#', ''));
                               }
                            }}
                          >
                            View Record <ChevronRight className="h-3 w-3 ml-1" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="rounded-[2rem] max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">Are you sure?</DialogTitle>
            <DialogDescription className="font-medium text-slate-500">
              This action cannot be undone. This record will be permanently removed from your profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col sm:flex-row gap-2 pt-4">
            <Button variant="ghost" className="rounded-xl font-bold flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              className="rounded-xl font-bold bg-red-600 flex-1" 
              onClick={() => {
                if (!deleteConfirm) return;
                switch(deleteConfirm.type) {
                  case 'exp': confirmDeleteExperience(deleteConfirm.id); break;
                  case 'edu': confirmDeleteEducation(deleteConfirm.id); break;
                  case 'ref': confirmDeleteReference(deleteConfirm.id); break;
                  case 'lang': confirmDeleteLanguage(deleteConfirm.id); break;
                }
              }}
            >
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Upload & Change Modal */}
      <PhotoUploadModal
        isOpen={isPhotoModalOpen}
        onClose={() => setIsPhotoModalOpen(false)}
        uid={profile.uid}
        currentPhotoURL={profile.photoURL}
        onPhotoUpdated={(newUrl) => {
          updateLocalProfileField(profile.uid, {
            photoURL: newUrl,
            activities: logActivity('personal', 'updated', 'Updated profile photo'),
            updatedAt: new Date()
          });
        }}
      />
    </div>
  );
}
