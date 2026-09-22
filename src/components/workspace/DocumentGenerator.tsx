import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, AdminConfig } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  FileText, 
  Sparkles, 
  Download, 
  Eye, 
  Loader2,
  CheckCircle2,
  AlertCircle,
  PenTool,
  ArrowRight,
  Wand2,
  History,
  Layout,
  Trash2,
  Lock,
  Receipt,
  CreditCard,
  Clock,
  ShieldCheck,
  ExternalLink,
  Zap,
  Copy,
  Check,
  Search,
  Filter,
  UploadCloud,
  FolderLock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { 
  generateResume, 
  generateTailoredResume,
  generateCoverLetter, 
  generateResignationLetter,
  professionalizeReason,
  generateResignationReason
} from '@/services/gemini';
import { DocumentPreviewer } from './DocumentPreviewer';
import { DeleteConfirmModal } from './DeleteConfirmModal';
import { ProtectedDocumentViewer } from './ProtectedDocumentViewer';
import { DocumentTransactionModal } from './DocumentTransactionModal';
import { UploadedDocumentsVault } from './UploadedDocumentsVault';
import { getGeneratedDocs, saveGeneratedDoc, findCachedDoc, deleteGeneratedDoc, updateGeneratedDoc, GeneratedDoc as DocHistory } from '@/lib/documentStorage';
import { logProfileActivity } from '@/lib/profileStorage';
import { cleanDocumentAsterisks, checkFeatureAccess, getMonthlyDocumentCount, FeatureAccessResult } from '@/lib/limits';
import { AppFeatureId } from '@/lib/constants';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc } from 'firebase/firestore';
import { createDocumentRequest, getDocumentPrice, submitPaymentProof, approveAndGenerateOfficialDoc, DEFAULT_PRICING, DEFAULT_BANKING_DETAILS } from '@/lib/documentRequests';
import { DocumentRequest } from '@/types';

interface DocumentGeneratorProps {
  profile: UserProfile | null;
}

type DocType = 'resume' | 'tailored_resume' | 'cover_letter' | 'resignation';

interface GeneratedDoc {
  type: DocType;
  date: string;
  id: string;
  content: string;
  position?: string;
}

export function DocumentGenerator({ profile }: DocumentGeneratorProps) {
  const [generating, setGenerating] = useState<DocType | null>(null);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDoc[]>([]);
  
  // Real-time admin config and usage limits
  const [adminConfig, setAdminConfig] = useState<AdminConfig | null>(null);
  const [monthlyDocCount, setMonthlyDocCount] = useState<number>(0);
  const [featurePermissions, setFeaturePermissions] = useState<Record<string, FeatureAccessResult>>({});
  
  // Deletion modal state
  const [docToDelete, setDocToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);

  // Modal States
  const [activeModal, setActiveModal] = useState<DocType | null>(null);
  const [previewDoc, setPreviewDoc] = useState<GeneratedDoc | null>(null);
  const [draftDoc, setDraftDoc] = useState<GeneratedDoc | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  
  // Resume Form
  const [resumeMode, setResumeMode] = useState<'current' | 'future'>('current');
  const [futureJobTitle, setFutureJobTitle] = useState('');
  
  // Tailored Resume Form
  const [tailoredJobTitle, setTailoredJobTitle] = useState('');
  const [tailoredCompany, setTailoredCompany] = useState('');
  const [tailoredJobDesc, setTailoredJobDesc] = useState('');

  // Cover Letter Form
  const [clCompany, setClCompany] = useState('');
  const [clJobTitle, setClJobTitle] = useState('');
  
  // Resignation Form
  const [resignCompany, setResignCompany] = useState('');
  const [noticePeriod, setNoticePeriod] = useState('1 month');
  const [resignReason, setResignReason] = useState('');
  const [isProfessionalizing, setIsProfessionalizing] = useState(false);
  const [isGeneratingReason, setIsGeneratingReason] = useState(false);

  // Pay-Per-Document & Locked Preview States
  const [userRequests, setUserRequests] = useState<DocumentRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<DocumentRequest | null>(null);
  const [isLockedViewerOpen, setIsLockedViewerOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [activeDocTab, setActiveDocTab] = useState<'templates' | 'generated' | 'uploads' | 'orders'>('templates');
  const [uploadedDocsCount, setUploadedDocsCount] = useState<number>(0);
  
  // Document Generated List Filter & Search State
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [copiedDocId, setCopiedDocId] = useState<string | null>(null);
  const [customResignCompany, setCustomResignCompany] = useState('');

  // Real-time listener for user's document requests
  useEffect(() => {
    if (!profile?.uid) return;
    const q = query(
      collection(db, 'document_requests'),
      where('userId', '==', profile.uid)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DocumentRequest[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
          approvedAt: data.approvedAt?.toDate ? data.approvedAt.toDate() : (data.approvedAt ? new Date(data.approvedAt) : undefined)
        } as DocumentRequest);
      });
      // Sort client-side by date descending
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUserRequests(list);

      // Keep selectedRequest updated in real-time if it's currently open
      setSelectedRequest((prev) => {
        if (!prev) return null;
        const updated = list.find((r) => r.id === prev.id);
        return updated || prev;
      });
    }, (err) => {
      console.warn("Could not listen to document requests:", err);
    });

    return () => unsub();
  }, [profile?.uid]);

  // Listen to Admin Configuration
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'admin_config', 'global'), (snap) => {
      if (snap.exists()) {
        setAdminConfig(snap.data() as AdminConfig);
      }
    }, (err) => {
      console.warn("Could not listen to admin config:", err);
    });
    return () => unsub();
  }, []);

  // Update monthly document usage
  const refreshDocCount = async () => {
    if (profile?.uid) {
      const count = await getMonthlyDocumentCount(profile.uid);
      setMonthlyDocCount(count);
    }
  };

  useEffect(() => {
    refreshDocCount();
  }, [profile?.uid]);

  // Reactive evaluation of feature permissions
  useEffect(() => {
    if (!profile) return;
    let isCurrent = true;

    const checkAll = async () => {
      const [resResume, resCL, resResign] = await Promise.all([
        checkFeatureAccess('resumeGeneration', profile, adminConfig, monthlyDocCount),
        checkFeatureAccess('coverLetterGeneration', profile, adminConfig, monthlyDocCount),
        checkFeatureAccess('resignationGeneration', profile, adminConfig, monthlyDocCount),
      ]);

      if (isCurrent) {
        setFeaturePermissions({
          resume: resResume,
          tailored_resume: resResume,
          cover_letter: resCL,
          resignation: resResign
        });
      }
    };

    checkAll();
    return () => { isCurrent = false; };
  }, [profile, adminConfig, monthlyDocCount]);

  useEffect(() => {
    const handleAiTrigger = (e: any) => {
      const type = e.detail?.type;
      if (type) {
        if (type === 'resume') setActiveModal('resume');
        else if (type === 'cover_letter') setActiveModal('cover_letter');
        else if (type === 'resignation_letter') setActiveModal('resignation');
      }
    };
    window.addEventListener('ai_generate_doc', handleAiTrigger);
    return () => window.removeEventListener('ai_generate_doc', handleAiTrigger);
  }, []);

  useEffect(() => {
    if (profile?.uid) {
      loadHistory();
    }
  }, [profile?.uid]);

  const loadHistory = async () => {
    if (!profile?.uid) return;
    try {
      const history = await getGeneratedDocs(profile.uid);
      setGeneratedDocs(history.map(h => ({
        id: h.id,
        type: h.type as DocType,
        content: h.content,
        date: h.createdAt instanceof Date ? h.createdAt.toLocaleDateString() : new Date(h.createdAt).toLocaleDateString(),
        position: h.title
      })));
    } catch (err) {
      console.warn("Failed to load generated docs history:", err);
    }
  };

  // Comprehensive list of all generated documents (combining saved collection + user requests with content)
  const allGeneratedDocs = useMemo(() => {
    const map = new Map<string, GeneratedDoc>();
    
    // 1. Add saved documents from Firestore generated_documents
    generatedDocs.forEach(d => map.set(d.id, d));
    
    // 2. Add approved/draft documents from userRequests if not already included
    userRequests.forEach(req => {
      const content = req.finalContent || req.draftContent;
      if (content && !map.has(req.id)) {
        map.set(req.id, {
          id: req.id,
          type: req.docType,
          date: req.createdAt instanceof Date ? req.createdAt.toLocaleDateString() : new Date(req.createdAt).toLocaleDateString(),
          content: cleanDocumentAsterisks(content),
          position: req.title
        });
      }
    });

    return Array.from(map.values());
  }, [generatedDocs, userRequests]);

  // Filtered generated documents list based on search and type filter
  const filteredGeneratedDocs = useMemo(() => {
    return allGeneratedDocs.filter(doc => {
      const matchesType = docTypeFilter === 'all' || doc.type === docTypeFilter;
      const matchesQuery = !docSearchQuery.trim() || 
        (doc.position || '').toLowerCase().includes(docSearchQuery.toLowerCase()) ||
        doc.type.toLowerCase().includes(docSearchQuery.toLowerCase()) ||
        doc.content.toLowerCase().includes(docSearchQuery.toLowerCase());
      return matchesType && matchesQuery;
    });
  }, [allGeneratedDocs, docTypeFilter, docSearchQuery]);

  const handleCopyDocText = async (doc: GeneratedDoc) => {
    try {
      await navigator.clipboard.writeText(cleanDocumentAsterisks(doc.content));
      setCopiedDocId(doc.id);
      setTimeout(() => setCopiedDocId(null), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  if (!profile) return null;

  const confirmDeleteDoc = async () => {
    if (!docToDelete || !profile?.uid) return;
    setIsDeletingDoc(true);
    const id = docToDelete.id;
    try {
      if (!id.startsWith('draft-')) {
        await deleteGeneratedDoc(profile.uid, id);
      }
      setGeneratedDocs(prev => prev.filter(d => d.id !== id));
      setDocToDelete(null);
      await refreshDocCount();
    } catch (error) {
      console.error("Delete failed:", error);
      setGeneratedDocs(prev => prev.filter(d => d.id !== id));
      setDocToDelete(null);
    } finally {
      setIsDeletingDoc(false);
    }
  };

  const handleOpenPreview = (doc: GeneratedDoc) => {
    setPreviewDoc(doc);
    setDraftDoc(null);
    setIsPreviewOpen(true);
  };

  const handleSaveDraft = async (updatedContent: string) => {
    if (!profile?.uid) return;
    
    try {
      const cleaned = cleanDocumentAsterisks(updatedContent);
      if (draftDoc) {
        const docId = await saveGeneratedDoc(profile.uid, {
          type: draftDoc.type as any,
          title: draftDoc.position || 'Generated Document',
          content: cleaned,
          params: {} 
        });

        const savedDoc: GeneratedDoc = {
          ...draftDoc,
          id: docId || Math.random().toString(36).substr(2, 9),
          content: cleaned
        };

        setGeneratedDocs(prev => [savedDoc, ...prev]);
        await refreshDocCount();
        
        // Log activity in Career Stream
        await logProfileActivity(
          profile.uid,
          'document',
          'generated',
          `Generated a new ${draftDoc.type.replace('_', ' ')} for ${draftDoc.position}`,
          '/#documents'
        );

        setDraftDoc(null);
        setPreviewDoc(null);
        setIsPreviewOpen(false);
      } else if (previewDoc) {
        // Handle update of existing document
        await updateGeneratedDoc(profile.uid, previewDoc.id, { content: cleaned });
        
        // Also persist update to Firestore document_requests collection if it's an approved request
        try {
          const reqRef = doc(db, 'document_requests', previewDoc.id);
          await updateDoc(reqRef, {
            finalContent: cleaned,
            updatedAt: new Date()
          });
        } catch (_) {}

        setGeneratedDocs(prev => prev.map(d => 
          d.id === previewDoc.id ? { ...d, content: cleaned } : d
        ));
        
        // Update local preview state instead of closing
        setPreviewDoc({ ...previewDoc, content: cleaned });
      }
    } catch (error) {
      console.error("Save/Update failed:", error);
    }
  };

  const handleGenerateReason = async () => {
    setIsGeneratingReason(true);
    try {
      const result = await generateResignationReason(); 
      setResignReason(result || '');
    } catch (error) {
      console.error("Generate reason failed:", error);
    } finally {
      setIsGeneratingReason(false);
    }
  };

  const handleGenerate = async (type: DocType) => {
    // 1. Enforce Admin Limits and Expiry before generating!
    const featureMap: Record<DocType, AppFeatureId> = {
      resume: 'resumeGeneration',
      tailored_resume: 'resumeGeneration',
      cover_letter: 'coverLetterGeneration',
      resignation: 'resignationGeneration'
    };
    const access = await checkFeatureAccess(featureMap[type], profile, adminConfig, monthlyDocCount);
    if (!access.allowed) {
      alert(`Limit or Access Restriction:\n${access.message}`);
      return;
    }

    setActiveModal(null);
    
    // Capture position title & effective resignation company
    const effectiveResignCompany = resignCompany === '__custom__' ? customResignCompany.trim() : (resignCompany.trim() || customResignCompany.trim());
    
    const position = type === 'resume' ? (resumeMode === 'future' && futureJobTitle.trim() ? futureJobTitle.trim() : 'Professional Resume') :
                     type === 'tailored_resume' ? (tailoredJobTitle.trim() ? `Tailored Resume - ${tailoredJobTitle.trim()}${tailoredCompany.trim() ? ` (${tailoredCompany.trim()})` : ''}` : 'Tailored Resume') :
                     type === 'cover_letter' ? (clJobTitle.trim() ? `Cover Letter - ${clJobTitle.trim()}${clCompany.trim() ? ` at ${clCompany.trim()}` : ''}` : 'Cover Letter') : 
                     type === 'resignation' ? `Resignation from ${effectiveResignCompany || 'Company'}` : 'Document';

    // Create a signature based on current parameters and profile state
    const params = {
      resumeMode,
      futureJobTitle: type === 'resume' ? futureJobTitle : '',
      tailoredJobTitle: type === 'tailored_resume' ? tailoredJobTitle : '',
      tailoredCompany: type === 'tailored_resume' ? tailoredCompany : '',
      tailoredJobDesc: type === 'tailored_resume' ? tailoredJobDesc : '',
      clCompany: type === 'cover_letter' ? clCompany : '',
      clJobTitle: type === 'cover_letter' ? clJobTitle : '',
      resignCompany: type === 'resignation' ? effectiveResignCompany : '',
      noticePeriod: type === 'resignation' ? noticePeriod : '',
      resignReason: type === 'resignation' ? resignReason : '',
      profileHash: JSON.stringify(profile)
    };
    
    setGenerating(type);
    
    try {
      // Check cache first
      const cached = await findCachedDoc(profile.uid, type, params);
      if (cached) {
        const cachedDoc: GeneratedDoc = {
          type,
          date: cached.createdAt instanceof Date ? cached.createdAt.toLocaleDateString() : new Date(cached.createdAt).toLocaleDateString(),
          id: cached.id,
          content: cleanDocumentAsterisks(cached.content),
          position: cached.title
        };
        // Move to top if already exists or just show
        setGeneratedDocs(prev => [cachedDoc, ...prev.filter(d => d.id !== cached.id)]);
        handleOpenPreview(cachedDoc);
        setGenerating(null);
        return;
      }

      let content = '';
      try {
        if (type === 'resume') {
          content = await generateResume(profile, resumeMode === 'future' ? futureJobTitle : undefined);
        } else if (type === 'tailored_resume') {
          const targetTitle = tailoredJobTitle.trim() || profile?.experience?.[0]?.position || 'Target Position';
          content = await generateTailoredResume(profile, targetTitle, tailoredCompany.trim(), tailoredJobDesc.trim());
        } else if (type === 'cover_letter') {
          const targetCompany = clCompany.trim() || 'Target Company';
          const targetRole = clJobTitle.trim() || profile?.experience?.[0]?.position || 'Target Position';
          content = await generateCoverLetter(profile, targetCompany, targetRole);
        } else if (type === 'resignation') {
          if (!effectiveResignCompany) {
            alert("Please provide or enter the Company Name for the Resignation Letter.");
            setGenerating(null);
            return;
          }
          content = await generateResignationLetter(profile, effectiveResignCompany, noticePeriod, resignReason);
        }
      } catch (aiErr: any) {
        console.error("AI Service Error:", aiErr);
        throw new Error(aiErr.message || "The AI was unable to generate content at this time. Please try again.");
      }

      if (!content) throw new Error("AI returned empty content. Please try again.");

      // Clean asterisks immediately upon generation
      const cleanedContent = cleanDocumentAsterisks(content);

      // Get individual document price from admin config (defaults to RM 1.00)
      const amount = getDocumentPrice(type, adminConfig);

      // Create unique DocumentRequest transaction in Firestore
      const newRequest = await createDocumentRequest({
        userId: profile.uid,
        userEmail: profile.email,
        userName: profile.displayName || profile.email.split('@')[0],
        docType: type,
        title: position,
        amount,
        draftContent: cleanedContent,
        params
      });

      // Immediately add to generatedDocs state so it is instantly in the Generated Documents list!
      const immediateDoc: GeneratedDoc = {
        id: newRequest.id,
        type,
        date: new Date().toLocaleDateString(),
        content: cleanedContent,
        position
      };
      setGeneratedDocs(prev => [immediateDoc, ...prev.filter(d => d.id !== newRequest.id)]);

      // Automatically open in Protected / Locked Document Viewer
      setSelectedRequest(newRequest);
      setIsLockedViewerOpen(true);
      
      // Log immediate generation in Career Stream
      await logProfileActivity(
        profile.uid,
        'document',
        'generated',
        `Generated draft ${type.replace('_', ' ')} for ${position} (Txn #${newRequest.transactionId} • RM ${amount}.00)`,
        '/#documents'
      );
      
      await refreshDocCount();
    } catch (error: any) {
      console.error("Generation failed:", error);
      alert(`Generation Failed: ${error.message || "Unknown AI error"}. Please check your connection or try a different role name.`);
    } finally {
      setGenerating(null);
    }
  };

  const handleAdminBypassRequest = async (req: DocumentRequest) => {
    try {
      await approveAndGenerateOfficialDoc(req, profile.email, null, { isFreeBypass: true });
      alert("Success! Document approved via Admin Free Bypass. It is now unlocked to view, edit, and download.");
      setIsLockedViewerOpen(false);
      setIsPaymentModalOpen(false);
      handleOpenApprovedDoc({
        ...req,
        status: 'approved',
        paymentStatus: 'waived',
        isBypassed: true
      });
    } catch (err: any) {
      console.error("Admin bypass error:", err);
      alert("Failed to bypass request: " + (err.message || "Unknown error"));
    }
  };

  const handleOpenApprovedDoc = (req: DocumentRequest) => {
    const finalContent = req.finalContent || req.draftContent;
    const docObj: GeneratedDoc = {
      id: req.id,
      type: req.docType,
      date: req.approvedAt ? new Date(req.approvedAt).toLocaleDateString() : new Date(req.createdAt).toLocaleDateString(),
      content: finalContent,
      position: req.title
    };
    setPreviewDoc(docObj);
    setIsPreviewOpen(true);
  };

  const handleOpenLockedDraft = (req: DocumentRequest) => {
    setSelectedRequest(req);
    setIsLockedViewerOpen(true);
  };

  const handleProfessionalize = async () => {
    if (!resignReason.trim()) return;
    setIsProfessionalizing(true);
    try {
      const betterReason = await professionalizeReason(resignReason);
      setResignReason(betterReason || resignReason);
    } catch (error) {
      console.error("Professionalize failed:", error);
    } finally {
      setIsProfessionalizing(false);
    }
  };

  const isAdmin = Boolean(profile.isAdmin || profile.role === 'admin' || profile.role === 'owner');

  const docTemplates = [
    { 
      id: 'resume', 
      title: 'Professional Resume', 
      description: 'A modern, ATS-friendly resume optimized for your industry.',
      icon: FileText,
      color: 'bg-blue-50 text-blue-600'
    },
    { 
      id: 'tailored_resume', 
      title: 'Tailored Resume', 
      description: 'Custom ATS resume matched precisely to your target job & company.',
      icon: Wand2,
      color: 'bg-emerald-50 text-emerald-600'
    },
    { 
      id: 'cover_letter', 
      title: 'Cover Letter', 
      description: 'A persuasive letter tailored to a specific job description.',
      icon: Sparkles,
      color: 'bg-purple-50 text-purple-600'
    },
    { 
      id: 'resignation', 
      title: 'Resignation Letter', 
      description: 'A professional and polite resignation letter for your current role.',
      icon: PenTool,
      color: 'bg-orange-50 text-orange-600'
    }
  ];

  return (
    <div className="space-y-10">
      {/* Pay-Per-Document Pricing, Bank Transfer & Free Bypass Workflow Banner */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 md:p-8 rounded-[2.5rem] text-white shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6 border border-slate-800">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1.5">
              <Sparkles className="h-3 w-3" /> Pay-Per-Document Model Active
            </span>
            <span className="bg-white/10 text-slate-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
              RM 1.00 Each
            </span>
            {isAdmin && (
              <span className="bg-purple-500/30 text-purple-200 border border-purple-400/40 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full flex items-center gap-1">
                <Zap className="h-3 w-3 text-yellow-300" /> Admin Free Bypass Ready
              </span>
            )}
          </div>
          <h2 className="text-2xl font-heading font-black tracking-tight text-white">
            Inspect First • Pay Individually (RM 1) • Unlock Full Access on Approval
          </h2>
          <p className="text-slate-300 text-sm max-w-2xl leading-relaxed">
            Generate and inspect your document draft in our secure preview. Transfer RM 1.00 to our verified Maybank account, or have an admin bypass charges for free to immediately unlock viewing, editing, and official ATS PDF downloads.
          </p>
          
          {/* Maybank Banking Details Strip */}
          <div className="mt-4 p-4 rounded-2xl bg-white/5 border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider block text-[10px]">Official Maybank Account</span>
              <span className="text-white font-black text-sm">Arvinderan A/L M Ganeson</span>
            </div>
            <div className="font-mono bg-white/10 px-3 py-1.5 rounded-xl border border-white/10 text-amber-300 font-black text-sm tracking-wider w-fit">
              102037147223 (Maybank)
            </div>
            <div className="text-slate-400 text-[11px] sm:text-right">
              Rate: <span className="text-emerald-400 font-bold">RM 1.00 / document</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3 shrink-0">
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Resume</span>
            <span className="text-lg font-black text-emerald-400">RM 1.00</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Tailored Resume</span>
            <span className="text-lg font-black text-emerald-400">RM 1.00</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Cover Letter</span>
            <span className="text-lg font-black text-indigo-300">RM 1.00</span>
          </div>
          <div className="bg-white/10 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/10 text-center">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Resignation</span>
            <span className="text-lg font-black text-amber-300">RM 1.00</span>
          </div>
        </div>
      </div>

      {/* Navigation Switcher: Document Studio vs Generated Documents vs Uploaded Vault vs Orders Queue */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit flex-wrap gap-1">
          <button
            onClick={() => setActiveDocTab('templates')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeDocTab === 'templates' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Layout className="h-4 w-4" /> Create Documents
          </button>
          
          <button
            onClick={() => setActiveDocTab('generated')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeDocTab === 'generated' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <FileText className="h-4 w-4" /> Generated Documents
            {allGeneratedDocs.length > 0 && (
              <span className="ml-1 bg-primary/10 text-primary text-[10px] font-black px-2 py-0.5 rounded-full">
                {allGeneratedDocs.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDocTab('uploads')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeDocTab === 'uploads' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <UploadCloud className="h-4 w-4" /> Uploaded Vault
            {uploadedDocsCount > 0 && (
              <span className="ml-1 bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-black px-2 py-0.5 rounded-full">
                {uploadedDocsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveDocTab('orders')}
            className={cn(
              "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all",
              activeDocTab === 'orders' ? "bg-white text-primary shadow-sm" : "text-slate-500 hover:text-slate-900"
            )}
          >
            <Receipt className="h-4 w-4" /> Orders & Transactions
            {userRequests.length > 0 && (
              <span className="ml-1 bg-slate-200 text-slate-700 text-[10px] font-black px-2 py-0.5 rounded-full">
                {userRequests.length}
              </span>
            )}
          </button>
        </div>

        {userRequests.filter(r => r.status === 'pending_approval' && r.paymentStatus === 'unpaid').length > 0 && (
          <div className="flex items-center gap-2 text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 px-4 py-2 rounded-xl">
            <Clock className="h-4 w-4 text-amber-600 shrink-0" />
            <span>You have {userRequests.filter(r => r.status === 'pending_approval' && r.paymentStatus === 'unpaid').length} unpaid draft(s) awaiting payment.</span>
          </div>
        )}
      </div>

      {activeDocTab === 'templates' ? (
        <div className="space-y-8">
          {/* Vault Quick Access Banner */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-3xl p-6 sm:p-7 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-5 relative overflow-hidden">
            <div className="flex items-center gap-4 relative z-10">
              <div className="bg-white/10 p-3.5 rounded-2xl text-primary border border-white/10 shrink-0">
                <UploadCloud className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-heading font-black text-lg text-white">
                  Have an Offer Letter, Payslip, or Contract to Store?
                </h4>
                <p className="text-slate-300 text-xs sm:text-sm mt-0.5 max-w-xl">
                  Safely upload your career documents to your private cloud vault. Download anytime and share directly to WhatsApp with 1 tap — zero AI quota used.
                </p>
              </div>
            </div>
            <Button
              className="rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white text-xs h-11 px-5 shrink-0 gap-2 shadow-md relative z-10 w-fit"
              onClick={() => setActiveDocTab('uploads')}
            >
              <UploadCloud className="h-4 w-4" /> Open Document Vault
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {docTemplates.map((template) => {
            const perm = featurePermissions[template.id];
            const isAllowed = perm ? perm.allowed : true;
            const lockReason = perm?.message;
            const price = getDocumentPrice(template.id as DocType, adminConfig);

            return (
              <Card key={template.id} className="border-none shadow-sm hover:shadow-2xl transition-all rounded-[3.5rem] overflow-hidden group bg-white relative flex flex-col justify-between">
                <div>
                  <div className="absolute top-6 right-6 z-10 flex items-center gap-2">
                    <span className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full shadow-md">
                      RM {price}.00 / doc
                    </span>
                    {!isAllowed && (
                      <div className="bg-amber-500/10 border border-amber-500/30 text-amber-700 text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1">
                        <Lock className="h-3 w-3" />
                        Locked
                      </div>
                    )}
                  </div>

                  <CardHeader className="p-10 pb-6">
                    <div className={cn(
                      "p-5 rounded-2xl w-fit mb-8 group-hover:scale-110 transition-transform shadow-xl",
                      template.id === 'resume' ? "bg-slate-900 text-primary shadow-slate-200" : 
                      template.id === 'cover_letter' ? "bg-primary text-white shadow-primary/20" : 
                      "bg-slate-100 text-slate-900 shadow-slate-100"
                    )}>
                      <template.icon className="h-10 w-10" />
                    </div>
                    <CardTitle className="text-3xl font-heading font-bold tracking-tight mb-2">{template.title}</CardTitle>
                    <CardDescription className="text-base leading-relaxed font-medium italic">{template.description}</CardDescription>
                  </CardHeader>
                </div>

                <CardContent className="p-10 pt-2">
                  <div className="mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
                    <span className="font-semibold">Fee per document:</span>
                    <span className="font-black text-slate-900">RM {price}.00 (Pay on review)</span>
                  </div>

                  <Button 
                    className={cn(
                      "w-full h-16 rounded-[2rem] font-bold text-lg shadow-2xl transition-all active:scale-95",
                      !isAllowed ? "bg-slate-200 text-slate-400 cursor-not-allowed shadow-none" :
                      template.id === 'resume' ? "bg-slate-900 hover:bg-slate-800 text-white shadow-slate-200" :
                      template.id === 'cover_letter' ? "bg-primary hover:bg-primary/90 text-white shadow-primary/20" :
                      "bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 shadow-slate-100"
                    )}
                    onClick={() => {
                      if (!isAllowed) {
                        alert(`Access Restriction:\n${lockReason || "Feature locked under current plan or limit"}`);
                        return;
                      }
                      setActiveModal(template.id as DocType);
                    }}
                    disabled={generating !== null || !isAllowed}
                  >
                    {generating === template.id ? (
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    ) : !isAllowed ? (
                      <Lock className="mr-2 h-5 w-5 text-slate-400" />
                    ) : (
                      <Sparkles className="mr-2 h-5 w-5" />
                    )}
                    {!isAllowed ? "Feature Locked" : `Generate Draft (RM ${price}.00)`}
                  </Button>

                  {!isAllowed && lockReason && (
                    <p className="text-[11px] font-semibold text-red-500/90 mt-3 text-center leading-snug">
                      {lockReason}
                    </p>
                  )}
                  
                  {/* Conditional Field Warnings */}
                  <div className="mt-4 space-y-1">
                    {template.id === 'resume' && (profile.skills?.length || 0) === 0 && (
                      <p className="text-[10px] font-bold text-orange-500 flex items-center gap-1 uppercase tracking-wider">
                        <AlertCircle className="h-3 w-3" /> Skills will be omitted (empty)
                      </p>
                    )}
                    {template.id === 'resume' && (profile.references?.length || 0) === 0 && (
                      <p className="text-[10px] font-bold text-orange-500 flex items-center gap-1 uppercase tracking-wider">
                        <AlertCircle className="h-3 w-3" /> References will be omitted (empty)
                      </p>
                    )}
                    {template.id === 'resume' && (profile.languages?.length || 0) === 0 && (
                      <p className="text-[10px] font-bold text-orange-500 flex items-center gap-1 uppercase tracking-wider">
                        <AlertCircle className="h-3 w-3" /> Languages will be omitted (empty)
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          </div>
        </div>
      ) : activeDocTab === 'generated' ? (
        /* Full Generated Documents Library View */
        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-xl text-primary">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                        Generated Documents Library
                      </CardTitle>
                      <CardDescription className="mt-0.5">
                        Access, view, edit, copy, and download PDFs of all your generated career documents.
                      </CardDescription>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Button 
                    className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
                    onClick={() => setActiveDocTab('templates')}
                  >
                    + Create New Document
                  </Button>
                </div>
              </div>

              {/* Search & Filter Controls */}
              <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-4 border-t border-slate-200/60">
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input 
                    placeholder="Search documents by title, role or keywords..." 
                    value={docSearchQuery}
                    onChange={(e) => setDocSearchQuery(e.target.value)}
                    className="pl-10 h-10 rounded-xl bg-white border-slate-200 text-sm"
                  />
                  {docSearchQuery && (
                    <button 
                      onClick={() => setDocSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  {[
                    { id: 'all', label: 'All', count: allGeneratedDocs.length },
                    { id: 'resume', label: 'Resumes', count: allGeneratedDocs.filter(d => d.type === 'resume').length },
                    { id: 'tailored_resume', label: 'Tailored', count: allGeneratedDocs.filter(d => d.type === 'tailored_resume').length },
                    { id: 'cover_letter', label: 'Cover Letters', count: allGeneratedDocs.filter(d => d.type === 'cover_letter').length },
                    { id: 'resignation', label: 'Resignation', count: allGeneratedDocs.filter(d => d.type === 'resignation').length },
                  ].map((filter) => (
                    <button
                      key={filter.id}
                      onClick={() => setDocTypeFilter(filter.id)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5",
                        docTypeFilter === filter.id
                          ? "bg-slate-900 text-white shadow-sm"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                      )}
                    >
                      <span>{filter.label}</span>
                      <span className={cn(
                        "text-[10px] px-1.5 py-0.2 rounded-full",
                        docTypeFilter === filter.id ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                      )}>
                        {filter.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6 md:p-8">
              {filteredGeneratedDocs.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <FileText className="h-8 w-8" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800">
                    {allGeneratedDocs.length === 0 ? "No documents generated yet" : "No matching documents found"}
                  </h3>
                  <p className="text-sm text-slate-500 max-w-md mx-auto">
                    {allGeneratedDocs.length === 0 
                      ? "Create your first professional ATS-ready resume, tailored application, cover letter, or resignation letter now."
                      : `Try adjusting your search query "${docSearchQuery}" or category filter.`}
                  </p>
                  <Button 
                    className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white mt-2"
                    onClick={() => {
                      setDocSearchQuery('');
                      setDocTypeFilter('all');
                      if (allGeneratedDocs.length === 0) setActiveDocTab('templates');
                    }}
                  >
                    {allGeneratedDocs.length === 0 ? "Create Document Now" : "Reset Filters"}
                  </Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredGeneratedDocs.map((doc) => {
                    const typeLabel = doc.type === 'tailored_resume' ? 'Tailored Resume' :
                                      doc.type === 'cover_letter' ? 'Cover Letter' :
                                      doc.type === 'resignation' ? 'Resignation Letter' : 'Standard Resume';
                    const badgeBg = doc.type === 'resume' ? 'bg-slate-900 text-primary' :
                                    doc.type === 'tailored_resume' ? 'bg-emerald-600 text-white' :
                                    doc.type === 'cover_letter' ? 'bg-indigo-600 text-white' :
                                    'bg-amber-600 text-white';

                    // Extract preview lines (strip markdown hashes and asterisks)
                    const previewSnippet = cleanDocumentAsterisks(doc.content)
                      .split('\n')
                      .filter(line => line.trim().length > 0 && !line.trim().startsWith('#'))
                      .slice(0, 3)
                      .join(' • ');

                    return (
                      <Card 
                        key={doc.id} 
                        className="rounded-2xl border border-slate-200/80 hover:border-primary/40 hover:shadow-xl transition-all flex flex-col justify-between overflow-hidden group bg-white"
                      >
                        <div className="p-6 space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn("text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full", badgeBg)}>
                              {typeLabel}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                              {doc.date}
                            </span>
                          </div>

                          <div>
                            <h4 className="text-lg font-bold text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                              {doc.position || typeLabel}
                            </h4>
                            <p className="text-xs text-slate-500 mt-2 line-clamp-3 leading-relaxed bg-slate-50 p-3 rounded-xl border border-slate-100 font-mono">
                              {previewSnippet || "Ready for download and editing."}
                            </p>
                          </div>
                        </div>

                        <div className="p-4 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-1">
                            <Button 
                              size="sm"
                              className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs h-9 px-3 flex-1"
                              onClick={() => handleOpenPreview(doc)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1.5" /> View & Edit
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-white text-xs h-9 px-2.5"
                              onClick={() => handleOpenPreview(doc)}
                              title="Download PDF"
                            >
                              <Download className="h-3.5 w-3.5" />
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              className={cn(
                                "rounded-xl font-bold border-slate-200 text-xs h-9 px-2.5 transition-all",
                                copiedDocId === doc.id ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "text-slate-700 hover:bg-white"
                              )}
                              onClick={() => handleCopyDocText(doc)}
                              title="Copy Document Text"
                            >
                              {copiedDocId === doc.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                            </Button>
                          </div>

                          <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-xl h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDocToDelete({ id: doc.id, title: doc.position || typeLabel })}
                            title="Delete Document"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      ) : activeDocTab === 'uploads' ? (
        <UploadedDocumentsVault 
          profile={profile} 
          onDocCountChange={setUploadedDocsCount} 
        />
      ) : (
        /* Orders and Requests List View */
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-2xl font-black tracking-tight text-slate-900">
                  Your Document Requests & Transactions
                </CardTitle>
                <CardDescription className="mt-1">
                  Track individual document payments, view anti-screenshot draft previews, and download approved official PDFs.
                </CardDescription>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                className="rounded-xl font-bold"
                onClick={() => setActiveDocTab('templates')}
              >
                + New Document
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {userRequests.length === 0 ? (
              <div className="p-16 text-center space-y-4">
                <Receipt className="h-12 w-12 text-slate-300 mx-auto" />
                <h3 className="text-lg font-bold text-slate-700">No document orders yet</h3>
                <p className="text-sm text-slate-400 max-w-md mx-auto">
                  Click on any template above to generate your first draft document. It will appear here with an individual transaction ID.
                </p>
                <Button className="rounded-xl font-bold" onClick={() => setActiveDocTab('templates')}>
                  Generate a Document
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 overflow-x-auto">
                {userRequests.map((req) => (
                  <div key={req.id} className="p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-slate-50/60 transition-colors">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-black bg-slate-100 text-slate-800 px-3 py-1 rounded-lg">
                          #{req.transactionId}
                        </span>
                        <span className="capitalize text-xs font-black bg-primary/10 text-primary px-3 py-1 rounded-full">
                          {req.docType.replace('_', ' ')}
                        </span>
                        
                        {req.status === 'approved' ? (
                          <span className={cn(
                            "text-xs font-black px-3 py-1 rounded-full flex items-center gap-1",
                            req.isBypassed || req.paymentStatus === 'waived' ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"
                          )}>
                            {req.isBypassed || req.paymentStatus === 'waived' ? (
                              <>
                                <Zap className="h-3.5 w-3.5 text-purple-600" /> Free Bypass Approved
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> Approved & Unlocked
                              </>
                            )}
                          </span>
                        ) : req.status === 'rejected' ? (
                          <span className="bg-red-100 text-red-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                            <AlertCircle className="h-3.5 w-3.5 text-red-600" /> Rejected
                          </span>
                        ) : req.paymentStatus === 'paid' ? (
                          <span className="bg-indigo-100 text-indigo-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5 text-indigo-600" /> Payment Submitted • Awaiting Approval
                          </span>
                        ) : (
                          <span className="bg-amber-100 text-amber-800 text-xs font-black px-3 py-1 rounded-full flex items-center gap-1">
                            <CreditCard className="h-3.5 w-3.5 text-amber-600" /> Unpaid Draft
                          </span>
                        )}
                      </div>

                      <h4 className="text-xl font-bold text-slate-900">{req.title || `${req.docType.replace('_', ' ')} Draft`}</h4>
                      
                      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 font-medium">
                        <span>Created: {new Date(req.createdAt).toLocaleDateString()}</span>
                        {req.paymentReference && (
                          <span className="text-slate-600 font-bold">Ref: {req.paymentReference}</span>
                        )}
                        {req.rejectionReason && (
                          <span className="text-red-500 font-bold">Reason: {req.rejectionReason}</span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <div className="text-right mr-2 hidden sm:block">
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Amount</span>
                        <span className="text-lg font-black text-slate-900">RM {req.amount}.00</span>
                      </div>

                      {req.status === 'approved' ? (
                        <Button 
                          className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/20 h-12 px-6"
                          onClick={() => handleOpenApprovedDoc(req)}
                        >
                          <FileText className="h-4 w-4 mr-2" /> View, Edit & Download PDF
                        </Button>
                      ) : (
                        <>
                          <Button 
                            variant="outline" 
                            className="rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-100 h-12 px-5"
                            onClick={() => handleOpenLockedDraft(req)}
                          >
                            <Eye className="h-4 w-4 mr-2 text-slate-500" /> View Locked Draft
                          </Button>

                          {isAdmin && (
                            <Button
                              className="rounded-xl font-black bg-purple-700 hover:bg-purple-800 text-white shadow-md h-12 px-4 text-xs border border-purple-400/30"
                              onClick={() => handleAdminBypassRequest(req)}
                            >
                              <Zap className="h-4 w-4 mr-1 text-yellow-300" /> ⚡ Free Bypass
                            </Button>
                          )}

                          {req.paymentStatus !== 'paid' && (
                            <Button 
                              className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20 h-12 px-6"
                              onClick={() => {
                                setSelectedRequest(req);
                                setIsPaymentModalOpen(true);
                              }}
                            >
                              <CreditCard className="h-4 w-4 mr-2" /> Pay RM {req.amount}.00
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Resume Modal */}
      <Dialog open={activeModal === 'resume'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">Resume Customization</DialogTitle>
            <DialogDescription>Choose how you want to generate your resume.</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <Button 
                variant={resumeMode === 'current' ? 'default' : 'outline'}
                className="h-24 rounded-2xl flex flex-col gap-2 font-bold"
                onClick={() => setResumeMode('current')}
              >
                <FileText className="h-6 w-6" />
                Current Profile
              </Button>
              <Button 
                variant={resumeMode === 'future' ? 'default' : 'outline'}
                className="h-24 rounded-2xl flex flex-col gap-2 font-bold"
                onClick={() => setResumeMode('future')}
              >
                <Sparkles className="h-6 w-6" />
                Future Job
              </Button>
            </div>
            
            {resumeMode === 'future' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-2"
              >
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">New Interview Job Title</Label>
                <Input 
                  placeholder="e.g. Senior Product Designer" 
                  value={futureJobTitle}
                  onChange={(e) => setFutureJobTitle(e.target.value)}
                  className="rounded-xl h-12"
                />
                <p className="text-[10px] text-slate-400 font-medium italic">
                  AI will alter your current job descriptions to match this future role.
                </p>
              </motion.div>
            )}
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl font-bold" onClick={() => handleGenerate('resume')}>
              Generate Resume
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Tailored Resume Modal */}
      <Dialog open={activeModal === 'tailored_resume'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-[550px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <Wand2 className="h-6 w-6 text-emerald-600" />
              Tailored Resume Generator
            </DialogTitle>
            <DialogDescription>
              Tailor your resume specifically for a target position, company, or job description (RM 1.00).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Target Job Title *</Label>
              <Input 
                placeholder="e.g. Senior Full Stack Engineer" 
                value={tailoredJobTitle}
                onChange={(e) => setTailoredJobTitle(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Target Company (Optional)</Label>
              <Input 
                placeholder="e.g. Maybank, Petronas, Grab" 
                value={tailoredCompany}
                onChange={(e) => setTailoredCompany(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Job Description / Requirements (Optional)</Label>
              <Textarea 
                placeholder="Paste key responsibilities or requirements from the job posting..." 
                value={tailoredJobDesc}
                onChange={(e) => setTailoredJobDesc(e.target.value)}
                className="rounded-xl min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              className="w-full h-12 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white" 
              onClick={() => handleGenerate('tailored_resume')}
              disabled={!tailoredJobTitle.trim()}
            >
              Generate Tailored Resume (RM 1.00)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cover Letter Modal */}
      <Dialog open={activeModal === 'cover_letter'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">Cover Letter Details</DialogTitle>
            <DialogDescription>Tell us about the job you're applying for.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Company Name</Label>
              <Input 
                placeholder="e.g. Google" 
                value={clCompany}
                onChange={(e) => setClCompany(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Job Title</Label>
              <Input 
                placeholder="e.g. Software Engineer" 
                value={clJobTitle}
                onChange={(e) => setClJobTitle(e.target.value)}
                className="rounded-xl h-12"
              />
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl font-bold" onClick={() => handleGenerate('cover_letter')}>
              Generate Tailored Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resignation Modal */}
      <Dialog open={activeModal === 'resignation'} onOpenChange={(open) => !open && setActiveModal(null)}>
        <DialogContent className="sm:max-w-[500px] rounded-[2rem]">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black tracking-tighter">Resignation Details</DialogTitle>
            <DialogDescription>Professionalize your departure.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Company to Resign From</Label>
              {profile.experience && profile.experience.length > 0 ? (
                <div className="space-y-2">
                  <Select onValueChange={(val) => {
                    setResignCompany(val);
                    if (val !== '__custom__') setCustomResignCompany('');
                  }} value={resignCompany}>
                    <SelectTrigger className="rounded-xl h-12">
                      <SelectValue placeholder="Select company from your profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {profile.experience.map(exp => (
                        <SelectItem key={exp.id} value={exp.company}>{exp.company}</SelectItem>
                      ))}
                      <SelectItem value="__custom__">+ Enter another company name...</SelectItem>
                    </SelectContent>
                  </Select>
                  {resignCompany === '__custom__' && (
                    <Input 
                      placeholder="e.g. Acme Corporation, Maybank, Grab" 
                      value={customResignCompany}
                      onChange={(e) => setCustomResignCompany(e.target.value)}
                      className="rounded-xl h-12"
                      autoFocus
                    />
                  )}
                </div>
              ) : (
                <Input 
                  placeholder="e.g. Acme Corporation, Maybank, Grab" 
                  value={customResignCompany || resignCompany}
                  onChange={(e) => {
                    setResignCompany(e.target.value);
                    setCustomResignCompany(e.target.value);
                  }}
                  className="rounded-xl h-12"
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Notice Period</Label>
              <Select onValueChange={setNoticePeriod} value={noticePeriod}>
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7 days">7 Days</SelectItem>
                  <SelectItem value="14 days">14 Days</SelectItem>
                  <SelectItem value="1 month">1 Month</SelectItem>
                  <SelectItem value="3 months">3 Months</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Reason for Leaving</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-6 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                  onClick={handleGenerateReason}
                  disabled={isGeneratingReason}
                >
                  {isGeneratingReason ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  AI Generate Reason
                </Button>
              </div>
              <div className="relative">
                <Textarea 
                  placeholder="e.g. I found a better opportunity..." 
                  value={resignReason}
                  onChange={(e) => setResignReason(e.target.value)}
                  className="rounded-xl min-h-[100px] pr-12"
                />
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="absolute bottom-2 right-2 h-8 w-8 text-primary hover:bg-primary/10"
                  onClick={handleProfessionalize}
                  disabled={isProfessionalizing || !resignReason.trim()}
                  title="Professionalize with AI"
                >
                  {isProfessionalizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-slate-400 font-medium italic">
                Click the wand to professionalize your reason.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button className="w-full h-12 rounded-xl font-bold" onClick={() => handleGenerate('resignation')}>
              Generate Resignation Letter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {activeDocTab === 'templates' && allGeneratedDocs.length > 0 && (
        <div className="space-y-6 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 p-2.5 rounded-2xl shadow-inner">
                <History className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-heading font-bold tracking-tight text-slate-900">Recently Generated Documents</h2>
                <p className="text-xs text-slate-500 font-medium">Quick access to your latest career documents</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              className="rounded-xl font-bold text-xs border-slate-300 text-slate-700 hover:bg-slate-100 w-fit"
              onClick={() => setActiveDocTab('generated')}
            >
              View All ({allGeneratedDocs.length}) <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {allGeneratedDocs.slice(0, 6).map((doc) => {
                const typeLabel = doc.type === 'tailored_resume' ? 'Tailored Resume' :
                                  doc.type === 'cover_letter' ? 'Cover Letter' :
                                  doc.type === 'resignation' ? 'Resignation Letter' : 'Standard Resume';
                return (
                  <motion.div
                    key={doc.id}
                    initial={{ opacity: 0, scale: 0.95, y: 15 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    whileHover={{ y: -3 }}
                    className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group"
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3.5">
                        <div className="bg-slate-900 p-3 rounded-2xl text-primary shrink-0 group-hover:scale-105 transition-transform">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-heading font-bold text-base text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                            {doc.position || typeLabel}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">{typeLabel}</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-[10px] text-slate-400 font-semibold">{doc.date}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-100">
                      <div className="flex items-center gap-1.5 flex-1">
                        <Button 
                          size="sm" 
                          className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs h-8 px-3 flex-1"
                          onClick={() => handleOpenPreview(doc)}
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" /> View & Edit
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="rounded-xl font-bold border-slate-200 text-xs h-8 px-2"
                          onClick={() => handleOpenPreview(doc)}
                          title="Download PDF"
                        >
                          <Download className="h-3.5 w-3.5 text-slate-600" />
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          className={cn(
                            "rounded-xl font-bold border-slate-200 text-xs h-8 px-2 transition-all",
                            copiedDocId === doc.id ? "bg-emerald-50 text-emerald-700 border-emerald-300" : "text-slate-700"
                          )}
                          onClick={() => handleCopyDocText(doc)}
                          title="Copy text"
                        >
                          {copiedDocId === doc.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-600" />}
                        </Button>
                      </div>
                      <Button 
                        size="icon" 
                        variant="ghost" 
                        className="rounded-xl h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={() => setDocToDelete({ id: doc.id, title: doc.position || typeLabel })}
                        title="Delete Document"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* In-app Document Deletion Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={!!docToDelete}
        onClose={() => setDocToDelete(null)}
        onConfirm={confirmDeleteDoc}
        title={docToDelete?.title || 'Document'}
        isDeleting={isDeletingDoc}
      />

      <DocumentPreviewer 
        isOpen={isPreviewOpen} 
        onClose={() => {
          setIsPreviewOpen(false);
          setDraftDoc(null);
        }} 
        document={previewDoc} 
        profile={profile}
        isDraft={!!draftDoc}
        onSave={handleSaveDraft}
      />

      {/* Pay-Per-Document Protected Viewer (Anti-Screenshot, Watermark & Locked View) */}
      {selectedRequest && (
        <ProtectedDocumentViewer
          isOpen={isLockedViewerOpen}
          onClose={() => setIsLockedViewerOpen(false)}
          request={selectedRequest}
          adminConfig={adminConfig}
          isAdmin={isAdmin}
          onAdminBypass={() => handleAdminBypassRequest(selectedRequest)}
          onRequestPayment={() => {
            setIsPaymentModalOpen(true);
          }}
          onApprovedOpen={() => {
            setIsLockedViewerOpen(false);
            handleOpenApprovedDoc(selectedRequest);
          }}
        />
      )}

      {/* Pay-Per-Document Payment Submission Modal */}
      {selectedRequest && (
        <DocumentTransactionModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          request={selectedRequest}
          adminConfig={adminConfig}
          isAdmin={isAdmin}
          onAdminBypass={() => handleAdminBypassRequest(selectedRequest)}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
          }}
        />
      )}
    </div>
  );
}
