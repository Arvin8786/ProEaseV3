import React, { useState } from 'react';
import { UserProfile, Experience, Education, Reference, Language } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Briefcase, 
  GraduationCap, 
  Wrench, 
  Users, 
  Languages,
  Plus,
  Trash2,
  Save,
  Loader2,
  Github,
  Linkedin,
  Calendar,
  Flag,
  ShieldCheck,
  Camera,
  Sparkles,
  ArrowRight,
  X
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { generateJobDescription, generateProfessionalSummary } from '@/services/gemini';
import { motion, AnimatePresence } from 'motion/react';
import { PhotoUploadModal } from './PhotoUploadModal';

const RequiredLabel = ({ children, value }: { children: React.ReactNode, value: any }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <label className="text-xs font-black uppercase tracking-widest text-slate-400">{children}</label>
    {(!value || (Array.isArray(value) && value.length === 0)) && (
      <span className="text-red-500 font-black animate-pulse">*</span>
    )}
  </div>
);

interface ProfileEditorProps {
  profile: UserProfile | null;
}

export function ProfileEditor({ profile }: ProfileEditorProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [formData, setFormData] = useState<UserProfile | null>(profile);
  const [skillInput, setSkillInput] = useState('');
  const [skillSuggestions, setSkillSuggestions] = useState<string[]>([]);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);

  React.useEffect(() => {
    if (profile && !formData) {
      setFormData(profile);
    }
  }, [profile, formData]);

  if (!formData) return null;

  const SUGGESTED_SKILLS = [
    'React', 'TypeScript', 'Node.js', 'Python', 'Java', 'Project Management', 
    'Agile', 'SQL', 'AWS', 'Docker', 'UI/UX Design', 'Product Management',
    'Data Analysis', 'Problem Solving', 'Communication', 'Leadership'
  ];

  const handleSkillInputChange = (val: string) => {
    setSkillInput(val);
    if (!val) {
      setSkillSuggestions([]);
      return;
    }
    const filtered = SUGGESTED_SKILLS.filter(s => 
      s.toLowerCase().includes(val.toLowerCase()) && 
      !formData.skills?.includes(s)
    );
    setSkillSuggestions(filtered);
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !formData.skills?.includes(trimmed)) {
      setFormData({
        ...formData,
        skills: [...(formData.skills || []), trimmed]
      });
    }
    setSkillInput('');
    setSkillSuggestions([]);
  };

  const addItem = (field: keyof UserProfile, newItem: any) => {
    setFormData(prev => {
      if (!prev) return null;
      const currentArray = (prev[field] as any[]) || [];
      return {
        ...prev,
        [field]: [...currentArray, newItem]
      };
    });
  };

  const removeItem = (field: keyof UserProfile, id: string) => {
    setFormData(prev => {
      if (!prev) return null;
      const currentArray = (prev[field] as any[]) || [];
      return {
        ...prev,
        [field]: currentArray.filter((item: any) => item.id !== id)
      };
    });
  };

  const updateItem = (field: keyof UserProfile, id: string, updates: any) => {
    setFormData(prev => {
      if (!prev) return null;
      const currentArray = (prev[field] as any[]) || [];
      return {
        ...prev,
        [field]: currentArray.map((item: any) => item.id === id ? { ...item, ...updates } : item)
      };
    });
  };

  const sortExperience = () => {
    setFormData(prev => {
      if (!prev) return null;
      const sorted = [...(prev.experience || [])].sort((a, b) => {
        if (a.isCurrent && !b.isCurrent) return -1;
        if (!a.isCurrent && b.isCurrent) return 1;
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      });
      return { ...prev, experience: sorted };
    });
  };

  const handleGenerateSummary = async () => {
    setIsGenerating('summary');
    try {
      const summary = await generateProfessionalSummary(formData);
      setFormData({ ...formData, professionalSummary: summary });
    } catch (error) {
      console.error("Summary Generation Error:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleGenerateDescription = async (id: string, position: string, company: string, industry?: string) => {
    if (!position || !company) return;
    setIsGenerating(id);
    try {
      const description = await generateJobDescription(position, company, industry);
      updateItem('experience', id, { description });
    } catch (error) {
      console.error("AI Generation Error:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleSave = async () => {
    if (!formData || !profile) return;
    setIsSaving(true);
    try {
      const { saveLocalProfile } = await import('@/lib/profileStorage');
      await saveLocalProfile(profile.uid, formData);
      await new Promise(resolve => setTimeout(resolve, 800));
    } catch (error) {
      console.error("Error saving profile:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-16 pb-32">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 border-b border-slate-100 pb-12">
        <div>
          <div className="flex items-center gap-3 mb-4">
            <div className="h-2 w-12 bg-primary rounded-full" />
            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Profile Orchestration</span>
          </div>
          <h1 className="text-5xl font-black tracking-tighter text-slate-900 leading-none">
            Identity <span className="text-primary italic decoration-primary/20">Studio</span>
          </h1>
          <p className="text-slate-500 text-xl font-medium mt-6">Defining the DNA of your professional persona.</p>
        </div>
        <Button 
          size="lg" 
          className="rounded-[1.5rem] px-10 h-16 font-black uppercase tracking-widest text-xs shadow-2xl shadow-primary/20 hover:scale-105 transition-transform"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
          Commit Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-3 sticky top-24 h-fit">
          {[
            { id: 'personal', label: 'Identity', icon: User },
            { id: 'experience', label: 'Chronicle', icon: Briefcase },
            { id: 'education', label: 'Academic', icon: GraduationCap },
            { id: 'skills', label: 'Capabilities', icon: Wrench },
            { id: 'languages', label: 'Linguistics', icon: Languages },
            { id: 'references', label: 'Endorsements', icon: Users },
          ].map((item) => (
            <a 
              key={item.id}
              href={`#${item.id}`} 
              className="flex items-center justify-between p-5 rounded-2xl bg-white/50 backdrop-blur-sm border border-slate-100 font-bold text-slate-500 hover:border-primary hover:text-primary transition-all group"
            >
              <div className="flex items-center gap-4">
                <item.icon className="h-5 w-5 transition-transform group-hover:scale-110" />
                <span className="tracking-tight">{item.label}</span>
              </div>
              <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-all -translate-x-2 group-hover:translate-x-0" />
            </a>
          ))}
        </div>

        {/* Form Content */}
        <div className="lg:col-span-9 space-y-16">
          {/* Personal Details */}
          <Card id="personal" className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
              <CardTitle className="flex items-center gap-3">
                <User className="h-6 w-6 text-primary" />
                Personal Details
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {/* Profile Photo */}
              <div className="flex flex-col items-center justify-center pb-8 border-b border-slate-100">
                <div className="relative group">
                  <div 
                    className="h-32 w-32 rounded-[2.5rem] bg-slate-100 border-4 border-white shadow-xl overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setIsPhotoModalOpen(true)}
                    title="Click to update photo"
                  >
                    {formData.photoURL ? (
                      <img src={formData.photoURL} alt="Profile" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-300">
                        <User className="h-12 w-12" />
                      </div>
                    )}
                  </div>
                  <Button 
                    size="icon" 
                    variant="secondary" 
                    className="absolute -bottom-2 -right-2 rounded-xl shadow-lg border-2 border-white"
                    onClick={() => setIsPhotoModalOpen(true)}
                    title="Upload / Change Photo"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">Profile Photo</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <RequiredLabel value={formData.displayName}>Full Name</RequiredLabel>
                  <Input 
                    value={formData.displayName} 
                    onChange={e => setFormData({...formData, displayName: e.target.value})}
                    className={cn("rounded-xl h-12 border-slate-200", !formData.displayName && "border-red-200 bg-red-50/10")}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.email}>Email Address</RequiredLabel>
                  <Input 
                    value={formData.email} 
                    disabled
                    className="rounded-xl h-12 border-slate-200 bg-slate-50"
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.phone}>Phone Number</RequiredLabel>
                  <Input 
                    value={formData.phone || ''} 
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    placeholder="+60 12-345 6789"
                    className={cn("rounded-xl h-12 border-slate-200", !formData.phone && "border-red-200 bg-red-50/10")}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.website}>Website / Portfolio</RequiredLabel>
                  <Input 
                    value={formData.website || ''} 
                    onChange={e => setFormData({...formData, website: e.target.value})}
                    placeholder="https://yourportfolio.com"
                    className="rounded-xl h-12 border-slate-200"
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.linkedin}>LinkedIn Profile</RequiredLabel>
                  <Input 
                    value={formData.linkedin || ''} 
                    onChange={e => setFormData({...formData, linkedin: e.target.value})}
                    placeholder="https://linkedin.com/in/username"
                    className={cn("rounded-xl h-12 border-slate-200", !formData.linkedin && "border-red-200 bg-red-50/10")}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.nationality}>Nationality</RequiredLabel>
                  <Input 
                    value={formData.nationality || ''} 
                    onChange={e => setFormData({...formData, nationality: e.target.value})}
                    placeholder="e.g. Malaysian"
                    className={cn("rounded-xl h-12 border-slate-200", !formData.nationality && "border-red-200 bg-red-50/10")}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.visaStatus}>Visa Status</RequiredLabel>
                  <Input 
                    value={formData.visaStatus || ''} 
                    onChange={e => setFormData({...formData, visaStatus: e.target.value})}
                    placeholder="e.g. Citizen / Permanent Resident"
                    className={cn("rounded-xl h-12 border-slate-200", !formData.visaStatus && "border-red-200 bg-red-50/10")}
                  />
                </div>
                <div className="space-y-2">
                  <RequiredLabel value={formData.dateOfBirth}>Date of Birth</RequiredLabel>
                  <Input 
                    type="date"
                    value={formData.dateOfBirth || ''} 
                    onChange={e => setFormData({...formData, dateOfBirth: e.target.value})}
                    className={cn("rounded-xl h-12 border-slate-200", !formData.dateOfBirth && "border-red-200 bg-red-50/10")}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <RequiredLabel value={formData.address}>Address</RequiredLabel>
                <Textarea 
                  value={formData.address || ''} 
                  onChange={e => setFormData({...formData, address: e.target.value})}
                  placeholder="Street, City, State, ZIP"
                  className={cn("rounded-xl min-h-[100px] border-slate-200", !formData.address && "border-red-200 bg-red-50/10")}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <RequiredLabel value={formData.professionalSummary}>Professional Summary</RequiredLabel>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="h-8 text-[10px] font-black uppercase text-primary hover:text-primary/80"
                    disabled={isGenerating === 'summary'}
                    onClick={handleGenerateSummary}
                  >
                    {isGenerating === 'summary' ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                    AI Generate
                  </Button>
                </div>
                <Textarea 
                  value={formData.professionalSummary || ''} 
                  onChange={e => setFormData({...formData, professionalSummary: e.target.value})}
                  placeholder="Briefly describe your professional background and goals..."
                  className={cn("rounded-xl min-h-[150px] border-slate-200", !formData.professionalSummary && "border-red-200 bg-red-50/10")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Experience */}
          <Card id="experience" className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Briefcase className="h-6 w-6 text-primary" />
                Work Experience
                {(!formData.experience || formData.experience.length === 0) && (
                  <span className="text-red-500 font-black animate-pulse">*</span>
                )}
              </CardTitle>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-[10px] font-black uppercase text-slate-400 hover:text-primary"
                  onClick={sortExperience}
                >
                  Auto-Sort
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="rounded-xl"
                  onClick={() => addItem('experience', { id: Math.random().toString(36).substr(2, 9), company: '', position: '', industry: '', startDate: '', description: '', isCurrent: false })}
                >
                  <Plus className="h-4 w-4 mr-2" /> Add
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              {formData.experience?.map((exp) => (
                <div key={exp.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeItem('experience', exp.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company</label>
                      <Input 
                        value={exp.company} 
                        onChange={e => updateItem('experience', exp.id, { company: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position</label>
                      <Input 
                        value={exp.position} 
                        onChange={e => updateItem('experience', exp.id, { position: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Industry</label>
                      <Input 
                        value={exp.industry || ''} 
                        onChange={e => updateItem('experience', exp.id, { industry: e.target.value })}
                        placeholder="e.g. Technology, Healthcare"
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
                      <Input 
                        type="month"
                        value={exp.startDate} 
                        onChange={e => updateItem('experience', exp.id, { startDate: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</label>
                      <div className="flex flex-col gap-2">
                        <Input 
                          type="month"
                          value={exp.endDate || ''} 
                          disabled={exp.isCurrent}
                          onChange={e => updateItem('experience', exp.id, { endDate: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={`current-exp-${exp.id}`}
                            checked={exp.isCurrent} 
                            onChange={e => updateItem('experience', exp.id, { isCurrent: e.target.checked, endDate: e.target.checked ? '' : exp.endDate })}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor={`current-exp-${exp.id}`} className="text-xs font-bold text-slate-600">Currently work here</label>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Job Description</label>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 text-[10px] font-black uppercase text-primary hover:text-primary/80"
                        disabled={!exp.position || !exp.company || isGenerating === exp.id}
                        onClick={() => handleGenerateDescription(exp.id, exp.position, exp.company, exp.industry)}
                      >
                        {isGenerating === exp.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                        AI Generate
                      </Button>
                    </div>
                    <Textarea 
                      value={exp.description} 
                      onChange={e => updateItem('experience', exp.id, { description: e.target.value })}
                      placeholder="List your key achievements and responsibilities..."
                      className="rounded-xl border-slate-200 bg-white min-h-[120px] text-sm leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Education */}
          <Card id="education" className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <GraduationCap className="h-6 w-6 text-primary" />
                Education
                {(!formData.education || formData.education.length === 0) && (
                  <span className="text-red-500 font-black animate-pulse">*</span>
                )}
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl"
                onClick={() => addItem('education', { id: Math.random().toString(36).substr(2, 9), school: '', degree: '', field: '', startDate: '', endDate: '', isCurrent: false })}
              >
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {formData.education?.map((edu) => (
                <div key={edu.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeItem('education', edu.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">School / University</label>
                      <Input 
                        value={edu.school} 
                        onChange={e => updateItem('education', edu.id, { school: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Degree</label>
                      <Input 
                        value={edu.degree} 
                        onChange={e => updateItem('education', edu.id, { degree: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Field of Study</label>
                      <Input 
                        value={edu.field} 
                        onChange={e => updateItem('education', edu.id, { field: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Start Date</label>
                      <Input 
                        type="month"
                        value={edu.startDate} 
                        onChange={e => updateItem('education', edu.id, { startDate: e.target.value })}
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">End Date</label>
                      <div className="flex flex-col gap-2">
                        <Input 
                          type="month"
                          value={edu.endDate || ''} 
                          disabled={edu.isCurrent}
                          onChange={e => updateItem('education', edu.id, { endDate: e.target.value })}
                          className="rounded-xl border-slate-200 bg-white"
                        />
                        <div className="flex items-center gap-2">
                          <input 
                            type="checkbox" 
                            id={`current-edu-${edu.id}`}
                            checked={edu.isCurrent} 
                            onChange={e => updateItem('education', edu.id, { isCurrent: e.target.checked, endDate: e.target.checked ? '' : edu.endDate })}
                            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <label htmlFor={`current-edu-${edu.id}`} className="text-xs font-bold text-slate-600">Currently study here</label>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Skills */}
          <Card id="skills" className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Wrench className="h-6 w-6 text-primary" />
                Professional Skills
                {(!formData.skills || formData.skills.length === 0) && (
                  <span className="text-red-500 font-black animate-pulse">*</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="flex flex-wrap gap-2">
                {formData.skills?.map((skill, index) => (
                  <div key={index} className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 group">
                    <span className="text-sm font-bold text-slate-700">{skill}</span>
                    <button 
                      onClick={() => setFormData({...formData, skills: formData.skills.filter((_, i) => i !== index)})}
                      className="text-slate-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="relative">
                <div className="flex gap-2">
                  <Input 
                    value={skillInput}
                    onChange={e => handleSkillInputChange(e.target.value)}
                    placeholder="Add a skill (e.g. React, Project Management)" 
                    className="rounded-xl border-slate-200"
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addSkill(skillInput);
                      }
                    }}
                  />
                  <Button onClick={() => addSkill(skillInput)} size="icon" className="rounded-xl">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                
                <AnimatePresence>
                  {skillSuggestions.length > 0 && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute z-10 w-full mt-2 p-2 bg-white border border-slate-100 rounded-2xl shadow-2xl max-h-48 overflow-y-auto"
                    >
                      {skillSuggestions.map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => addSkill(suggestion)}
                          className="w-full text-left px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 hover:text-primary rounded-xl transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </CardContent>
          </Card>

          {/* Languages */}
          <Card id="languages" className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Languages className="h-6 w-6 text-primary" />
                Languages
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl"
                onClick={() => addItem('languages', { id: Math.random().toString(36).substr(2, 9), name: '', proficiency: 'Fluent' })}
              >
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {formData.languages?.map((lang) => (
                  <div key={lang.id} className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100 group">
                    <Input 
                      value={lang.name} 
                      onChange={e => updateItem('languages', lang.id, { name: e.target.value })}
                      placeholder="Language Name"
                      className="rounded-xl border-slate-200 bg-white"
                    />
                    <select 
                      value={lang.proficiency}
                      onChange={e => updateItem('languages', lang.id, { proficiency: e.target.value })}
                      className="rounded-xl border-slate-200 bg-white h-10 px-3 text-sm font-medium"
                    >
                      <option>Basic</option>
                      <option>Intermediate</option>
                      <option>Fluent</option>
                      <option>Native</option>
                    </select>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-400 hover:text-red-500 shrink-0"
                      onClick={() => removeItem('languages', lang.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* References */}
          <Card id="references" className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8 flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                References
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl"
                onClick={() => addItem('references', { id: Math.random().toString(36).substr(2, 9), name: '', position: '', company: '', email: '', phone: '' })}
              >
                <Plus className="h-4 w-4 mr-2" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {formData.references?.map((ref) => (
                <div key={ref.id} className="p-6 bg-slate-50 rounded-2xl border border-slate-100 relative group">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute top-4 right-4 text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => removeItem('references', ref.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
                      <Input 
                        value={ref.name} 
                        onChange={e => updateItem('references', ref.id, { name: e.target.value })}
                        placeholder="Reference Name"
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Company (from Experience)</label>
                      <select 
                        value={ref.company}
                        onChange={e => updateItem('references', ref.id, { company: e.target.value })}
                        className="w-full rounded-xl border-slate-200 bg-white h-12 px-3 text-sm font-medium border"
                      >
                        <option value="">Select a company</option>
                        {formData.experience?.map(exp => (
                          <option key={exp.id} value={exp.company}>{exp.company}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Position</label>
                      <Input 
                        value={ref.position} 
                        onChange={e => updateItem('references', ref.id, { position: e.target.value })}
                        placeholder="e.g. HR Manager"
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email</label>
                      <Input 
                        value={ref.email} 
                        onChange={e => updateItem('references', ref.id, { email: e.target.value })}
                        placeholder="reference@company.com"
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Phone</label>
                      <Input 
                        value={ref.phone} 
                        onChange={e => updateItem('references', ref.id, { phone: e.target.value })}
                        placeholder="+60..."
                        className="rounded-xl border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Photo Upload Modal */}
      {formData && (
        <PhotoUploadModal
          isOpen={isPhotoModalOpen}
          onClose={() => setIsPhotoModalOpen(false)}
          uid={formData.uid}
          currentPhotoURL={formData.photoURL}
          onPhotoUpdated={(newUrl) => {
            setFormData(prev => prev ? { ...prev, photoURL: newUrl } : null);
          }}
        />
      )}
    </div>
  );
}
