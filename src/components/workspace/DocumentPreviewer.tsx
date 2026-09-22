import React, { useRef, useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Download, Printer, X, FileText, Search, ZoomIn, ZoomOut, Share2, MessageSquare, Send as TelegramIcon, Mail, Loader2, CalendarClock, Phone, Save, PenTool, Sparkles, Eye, Eraser } from 'lucide-react';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import { UserProfile } from '@/types';
import { scheduleMessage } from '@/lib/scheduling';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { generateShareMessage } from '@/services/gemini';
import { cleanDocumentAsterisks } from '@/lib/limits';

interface DocumentPreviewerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (updatedContent: string) => void;
  isDraft?: boolean;
  document: {
    id?: string;
    type: string;
    content: string;
    date: string;
    position?: string;
  } | null;
  profile: UserProfile | null;
}

export function DocumentPreviewer({ isOpen, onClose, onSave, isDraft, document, profile }: DocumentPreviewerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(100);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Auto-fit zoom on mount and resize
  useEffect(() => {
    if (!isOpen) return;
    const updateZoom = () => {
      const width = window.innerWidth;
      if (width < 768) setZoom(60);
      else if (width < 1024) setZoom(80);
      else if (width < 1440) setZoom(100);
      else if (width < 1920) setZoom(110);
      else setZoom(125);
    };
    updateZoom();
    window.addEventListener('resize', updateZoom);
    return () => window.removeEventListener('resize', updateZoom);
  }, [isOpen]);

  // Update editedContent when document changes, automatically stripping markdown asterisks
  React.useEffect(() => {
    if (document) {
      const cleaned = cleanDocumentAsterisks(document.content);
      setEditedContent(cleaned);
      setHasUnsavedChanges(false);
      setIsEditing(Boolean(isDraft));
    }
  }, [document, isDraft]);

  const handleContentChange = (content: string) => {
    setEditedContent(content);
    if (document && content !== document.content) {
      setHasUnsavedChanges(true);
    } else {
      setHasUnsavedChanges(false);
    }
  };

  const handleCleanAsterisks = () => {
    const cleaned = cleanDocumentAsterisks(editedContent);
    setEditedContent(cleaned);
    setHasUnsavedChanges(true);
  };

  const handleClose = () => {
    onClose();
  };

  const handleSaveDoc = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      // Clean all markdown asterisks before saving
      const cleaned = cleanDocumentAsterisks(editedContent);
      await onSave(cleaned);
      setEditedContent(cleaned);
      if (document) {
        document.content = cleaned;
      }
      setHasUnsavedChanges(false);
      setIsEditing(false);
    } catch (err) {
      console.error("Save failed:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Scheduling States
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [customMessage, setCustomMessage] = useState('');
  const [isScheduling, setIsScheduling] = useState(false);
  const [isGeneratingMessage, setIsGeneratingMessage] = useState(false);

  if (!document) return null;

  const handleGenerateAIMessage = async () => {
    if (!profile || !document) return;
    setIsGeneratingMessage(true);
    try {
      const message = await generateShareMessage(profile, document);
      if (message) {
        setCustomMessage(message);
      }
    } catch (error) {
      console.error("Failed to generate AI message:", error);
    } finally {
      setIsGeneratingMessage(false);
    }
  };

  const handleOpenSchedule = () => {
    setCustomMessage(getShareMessage());
    setShowScheduleDialog(true);
  };

  const handleConfirmSchedule = async () => {
    if (!profile?.uid || !recipientPhone || !scheduledDate || !scheduledTime) {
      alert("Please fill in all scheduling details.");
      return;
    }

    setIsScheduling(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      await scheduleMessage(profile.uid, {
        recipientPhone,
        message: customMessage,
        scheduledAt,
        docId: (document as any).id,
        docType: document.type
      });
      setShowScheduleDialog(false);
      alert("Message scheduled successfully! You will receive a notification when it's time to send.");
    } catch (error) {
      console.error("Scheduling failed:", error);
    } finally {
      setIsScheduling(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!contentRef.current) return;
    setIsExporting(true);
    
    try {
      // Create high-quality canvas of the document
      const canvas = await html2canvas(contentRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        onclone: (clonedDoc) => {
          // Final safety check: ensure markdown container has clear colors for the renderer
          const container = clonedDoc.querySelector('.markdown-body') as HTMLElement;
          if (container) {
            container.style.color = '#334155';
            container.querySelectorAll('h1, h2, h3').forEach((h: any) => {
              h.style.color = '#1e293b';
            });
          }
        }
      });
      
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      // If document is longer than one A4 page, we split it
      const pageHeight = 297; // A4 height in mm
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight, undefined, 'FAST');
        heightLeft -= pageHeight;
      }

      pdf.save(`ProEase_${document.type}_${document.date.replace(/\//g, '-')}.pdf`);
    } catch (err) {
      console.error("PDF Export failed:", err);
      // Native print as ultimate fallback
      window.print();
    } finally {
      setIsExporting(false);
    }
  };

  const getShareMessage = () => {
    const typeLabel = document.type.replace('_', ' ');
    const name = profile?.displayName || 'Candidate';
    const position = document.position || 'Professional Role';
    
    if (document.type === 'resignation_letter') {
      return `Dear HR/Management,\n\nPlease find my formal resignation letter attached for your records and review. I deeply appreciate the professional opportunities and support provided during my tenure at the company.\n\nThank you for your understanding. I am committed to ensuring a smooth transition.\n\nBest regards,\n${name}`;
    }

    if (document.type === 'cover_letter') {
      return `Dear Hiring Manager,\n\nI am reaching out to formally submit my application for the ${position} position. Attached is my tailored cover letter, which provides detailed insights into my career achievements and how they align with the strategic goals of your team.\n\nI look forward to the possibility of discussing my candidacy in an interview.\n\nBest regards,\n${name}`;
    }

    return `Dear Talent Acquisition Team,\n\nI am sharing my resume for your review regarding the ${position} role. Please accept this as a formal submission in a dedicated professional tone. My background includes specific industry expertise and measurable successes that I am confident will contribute value to your organization.\n\nThank you for your time and professional consideration.\n\nBest regards,\n${name}`;
  };

  const handleShare = async (platform: 'whatsapp' | 'telegram' | 'email' | 'system') => {
    const messageText = customMessage || getShareMessage();
    const typeLabel = document.type.replace('_', ' ');
    const subject = `Professional ${typeLabel} - ProEase`;

    if (platform === 'system') {
      try {
        if (navigator.share) {
          await navigator.share({
            title: subject,
            text: `${messageText}\n\n(Generated via ProEase AI)`
          });
        } else {
          throw new Error("navigator.share is not supported in this browser");
        }
      } catch (err) {
        console.error("System share failed, falling back to clipboard:", err);
        const fullShareText = `${subject}\n\n${messageText}\n\n(Generated via ProEase AI)`;
        try {
          await navigator.clipboard.writeText(fullShareText);
          alert("Sharing via system failed (possibly due to browser permissions). The message has been copied to your clipboard instead.");
        } catch (clipboardErr) {
          console.error("Clipboard fallback failed:", clipboardErr);
          alert("Sharing is blocked in your current browser context. Please try using the direct Email/WhatsApp options.");
        }
      }
      return;
    }

    const fullText = `${messageText}\n\n---\n${document.type.toUpperCase()} CONTENT:\n${document.content}\n\n(Generated via ProEase AI)`;
    const message = encodeURIComponent(fullText);
    const encodedSubject = encodeURIComponent(subject);
    
    switch (platform) {
      case 'whatsapp':
        window.open(`https://wa.me/?text=${message}`, '_blank');
        break;
      case 'telegram':
        window.open(`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${message}`, '_blank');
        break;
      case 'email':
        window.location.href = `mailto:?subject=${encodedSubject}&body=${message}`;
        break;
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-none w-screen h-screen p-0 m-0 overflow-hidden flex flex-col rounded-none border-none shadow-none z-[100] top-0 left-0 translate-x-0 translate-y-0 sm:max-w-none transition-none">
        <DialogHeader className="p-4 md:p-6 border-b bg-white/95 backdrop-blur-md sticky top-0 z-50 shrink-0 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 w-full px-4">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-2.5 rounded-2xl text-primary shadow-sm hover:scale-110 transition-transform cursor-pointer" onClick={handleClose}>
                <X className="h-6 w-6" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-black tracking-tighter capitalize text-slate-900 flex items-center gap-3">
                  {(document.type || 'Document').replace('_', ' ').replace('resignation', 'Resignation Letter')}
                  <div className="flex items-center gap-2">
                    {hasUnsavedChanges && (
                      <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 animate-pulse">
                        Unsaved Changes
                      </Badge>
                    )}
                    {isDraft && <Badge className="bg-amber-100 text-amber-700 border-amber-200">Draft</Badge>}
                  </div>
                </DialogTitle>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                  Live Preview • {document.date}
                </p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-100 rounded-xl p-1 border border-slate-200">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg hover:bg-white" 
                  onClick={() => setZoom(prev => Math.max(50, prev - 10))}
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-[10px] font-black w-12 text-center uppercase tracking-widest text-slate-600">{zoom}%</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-lg hover:bg-white" 
                  onClick={() => setZoom(prev => Math.min(200, prev + 10))}
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>

              <div className="h-8 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-slate-400 hover:text-primary hover:bg-slate-100" onClick={() => handleShare('system')} title="System Share (Share as Image/PDF)">
                  <Share2 className="h-5 w-5" />
                </Button>

                {/* Direct Edit / View Toggle */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "rounded-lg font-bold text-xs h-9 px-3",
                      !isEditing && "bg-white shadow-sm text-primary"
                    )}
                    onClick={() => setIsEditing(false)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1.5" />
                    Preview
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "rounded-lg font-bold text-xs h-9 px-3",
                      isEditing && "bg-white shadow-sm text-primary"
                    )}
                    onClick={() => setIsEditing(true)}
                  >
                    <PenTool className="h-3.5 w-3.5 mr-1.5" />
                    Direct Edit
                  </Button>
                </div>

                {/* Clean Asterisks Button */}
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl font-bold h-11 px-3 border-slate-200 text-slate-700 hover:bg-slate-50 text-xs"
                  onClick={handleCleanAsterisks}
                  title="Strip markdown asterisks from content"
                >
                  <Eraser className="h-4 w-4 mr-1.5 text-amber-500" />
                  Clean Asterisks
                </Button>

                {onSave && (
                  <Button 
                    size="sm" 
                    className="rounded-xl font-bold h-11 px-6 bg-primary hover:opacity-90 shadow-xl shadow-primary/20 text-white transition-all active:scale-95" 
                    onClick={handleSaveDoc}
                    disabled={isSaving}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                    {isDraft ? "Archive to Vault" : (hasUnsavedChanges ? "Save Changes *" : "Save Document")}
                  </Button>
                )}
                
                <div className="h-8 w-px bg-slate-200" />
                
                <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
                   <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50" onClick={handleOpenSchedule} title="Schedule Distribution">
                     <CalendarClock className="h-4 w-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleShare('whatsapp')} title="Share via WhatsApp">
                     <MessageSquare className="h-4 w-4" />
                   </Button>
                   <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-blue-500 hover:text-blue-600 hover:bg-blue-50" onClick={() => handleShare('telegram')} title="Share via Telegram">
                     <TelegramIcon className="h-4 w-4" />
                   </Button>
                </div>

                <div className="h-8 w-px bg-slate-200 hidden md:block" />
                
                <Button size="lg" className="rounded-xl font-black h-11 px-8 shadow-2xl shadow-primary/30 bg-primary text-white hover:scale-[1.02] active:scale-95 transition-all" onClick={handleDownloadPDF} disabled={isExporting}>
                   {isExporting ? <Loader2 className="h-5 w-5 mr-3 animate-spin" /> : <Download className="h-5 w-5 mr-3" />}
                   {isExporting ? "Exporting..." : "Download PDF"}
                </Button>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto bg-[#f8fafc] p-4 md:p-8 custom-scrollbar border-t border-slate-200">
          {/* Document Paper Representation */}
          <div 
            className="flex flex-col items-center transition-all duration-300 origin-top pb-32"
            style={{ 
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center'
            }}
          >
            <div 
              ref={contentRef}
              className="bg-white shadow-[0_25px_60px_-15px_rgba(15,23,42,0.15)] border border-slate-200/80 w-[210mm] min-h-[297mm] p-[25mm] prose prose-slate max-w-none print:shadow-none print:p-0 print:m-0 print-content overflow-visible relative rounded-sm"
              style={{ 
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                lineHeight: '1.65',
                color: '#0f172a'
              }}
            >
              {/* Luxury Header Accent */}
              <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-primary/40 via-primary to-primary/40 opacity-50" />
              
              <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
                 <FileText className="h-48 w-48 rotate-12" />
              </div>

              <div className="markdown-body relative z-10 text-justify">
                {isEditing ? (
                  <div className="relative">
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-2 flex items-center gap-1.5 no-print">
                      <PenTool className="h-3 w-3" />
                      Direct Edit Mode — Type directly below to modify document:
                    </div>
                    <Textarea
                      value={editedContent}
                      onChange={(e) => handleContentChange(e.target.value)}
                      className="w-full h-full min-h-[850px] border border-slate-200 focus:border-primary/40 rounded-xl p-4 text-slate-900 text-[11pt] leading-relaxed resize-y font-sans bg-slate-50/50 focus:bg-white shadow-inner"
                      placeholder="Enter document content (Markdown or plain text)..."
                    />
                  </div>
                ) : (
                  <div 
                    onClick={() => setIsEditing(true)}
                    title="Click anywhere to edit directly"
                    className="cursor-text hover:outline hover:outline-2 hover:outline-primary/20 hover:outline-dashed rounded p-1 transition-all"
                  >
                    <ReactMarkdown>{editedContent || document.content}</ReactMarkdown>
                  </div>
                )}
              </div>
              
              {/* Footer Page Marking */}
              <div className="mt-20 pt-8 border-t border-slate-100 flex justify-between items-center text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] relative z-10 no-print">
                <span>{profile?.displayName || 'Executive'} • {document.type.replace('_', ' ')}</span>
                <span>ProEase Elite • Digitally Generated</span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>

      <style>{`
        .markdown-body {
          font-size: 11pt;
          color: #1e293b;
        }
        .markdown-body h1 { 
          font-family: 'Playfair Display', serif;
          font-weight: 700; 
          font-size: 28pt; 
          border-bottom: 1.5pt solid #e2e8f0; 
          padding-bottom: 0.75rem; 
          margin-bottom: 2rem; 
          color: #0f172a;
          text-align: center;
        }
        .markdown-body h2 { 
          font-family: 'Inter', sans-serif;
          font-weight: 800; 
          font-size: 14pt; 
          margin-top: 2.5rem; 
          margin-bottom: 1.25rem; 
          color: #334155; 
          text-transform: uppercase;
          letter-spacing: 0.1em;
          border-left: 3pt solid var(--primary);
          padding-left: 1rem;
        }
        .markdown-body h3 {
          font-weight: 700;
          font-size: 12pt;
          margin-top: 1.5rem;
          margin-bottom: 0.5rem;
          color: #475569;
        }
        .markdown-body p { 
          margin-bottom: 1.25rem; 
          line-height: 1.7;
        }
        .markdown-body ul { 
          list-style-type: none; 
          padding-left: 0; 
          margin-bottom: 2rem; 
        }
        .markdown-body li { 
          margin-bottom: 0.75rem; 
          position: relative;
          padding-left: 1.5rem;
        }
        .markdown-body li::before {
          content: "—";
          position: absolute;
          left: 0;
          color: var(--primary);
          font-weight: bold;
        }
        .markdown-body strong { color: #0f172a; font-weight: 700; }
        
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
          }
          .print-content {
            box-shadow: none !important;
            padding: 25mm !important;
            width: 210mm !important;
            min-height: 297mm !important;
          }
        }
      `}</style>
    </Dialog>

    <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
      <DialogContent className="max-w-md rounded-[2.5rem]">
        <DialogHeader>
          <DialogTitle className="text-2xl font-black tracking-tighter">Schedule Distribution</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-4">
          <div className="space-y-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recipient Phone (WhatsApp)</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="+60123456789" 
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Date</Label>
                <Input 
                  type="date" 
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Time</Label>
                <Input 
                  type="time" 
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="rounded-xl"
                />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Outreach Message</Label>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10"
                onClick={handleGenerateAIMessage}
                disabled={isGeneratingMessage}
              >
                {isGeneratingMessage ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Sparkles className="h-3 w-3 mr-1" />}
                Generate with AI
              </Button>
            </div>
            <Textarea 
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="rounded-xl min-h-[120px] text-sm"
              placeholder="Write your professional outreach message here..."
            />
            <p className="text-[10px] text-slate-400 font-medium">This message along with the document summary will be shared.</p>
          </div>
          
          <div className="flex flex-col gap-2 pt-4">
            <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Share Directly</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button variant="outline" className="rounded-xl flex-col gap-2 h-20 text-green-600 border-green-100 hover:bg-green-50" onClick={() => handleShare('whatsapp')}>
                <MessageSquare className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase">WhatsApp</span>
              </Button>
              <Button variant="outline" className="rounded-xl flex-col gap-2 h-20 text-blue-500 border-blue-100 hover:bg-blue-50" onClick={() => handleShare('telegram')}>
                <TelegramIcon className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase">Telegram</span>
              </Button>
              <Button variant="outline" className="rounded-xl flex-col gap-2 h-20 text-slate-600 border-slate-100 hover:bg-slate-50" onClick={() => handleShare('email')}>
                <Mail className="h-5 w-5" />
                <span className="text-[10px] font-black uppercase">Email</span>
              </Button>
            </div>
          </div>
        </div>
        <DialogFooter className="bg-slate-50 p-6">
          <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setShowScheduleDialog(false)}>Cancel</Button>
          <Button 
            className="rounded-xl font-bold px-8 shadow-lg shadow-indigo-200" 
            onClick={handleConfirmSchedule}
            disabled={isScheduling}
          >
            {isScheduling ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CalendarClock className="h-4 w-4 mr-2" />}
            Save Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
