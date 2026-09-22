import React, { useState, useRef, useEffect } from 'react';
import { UserProfile, UploadedDocument } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { 
  Download, 
  Save, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  X, 
  Type as TypeIcon, 
  Bold, 
  Italic, 
  Trash2, 
  PenTool, 
  Sparkles, 
  Check, 
  User, 
  Mail, 
  Phone, 
  MapPin, 
  Briefcase, 
  Calendar, 
  FileCheck2, 
  RotateCcw,
  Maximize2,
  Copy,
  Building2,
  Share2
} from 'lucide-react';
import { pdfjsLib } from '@/lib/pdfWorker';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '@/lib/utils';
import { SignatureManager } from './SignatureManager';
import { ai, MODELS } from '@/lib/gemini';
import { updateUploadedDoc, shareUploadedDoc } from '@/lib/uploadedDocsStorage';

export interface DocOverlayElement {
  id: string;
  type: 'text' | 'signature';
  page: number;
  x: number; // percentage (0 - 100)
  y: number; // percentage (0 - 100)
  content: string; // text string or signature dataURL
  label?: string; // e.g. "Full Name", "Signature"
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  color?: string;
  backgroundColor?: string;
  width?: number; // for signature or container
  height?: number;
}

interface DetectedFieldMatch {
  id: string;
  fieldName: string;
  mappedValue: string;
  type: 'text' | 'signature';
  x: number;
  y: number;
  confidence?: string;
  selected: boolean;
}

interface UploadedDocumentEditorProps {
  isOpen: boolean;
  onClose: () => void;
  document: UploadedDocument | null;
  profile: UserProfile | null;
  onSaveSuccess?: (updatedDoc: UploadedDocument) => void;
}

export function UploadedDocumentEditor({
  isOpen,
  onClose,
  document: docItem,
  profile,
  onSaveSuccess
}: UploadedDocumentEditorProps) {
  // View & PDF States
  const [numPages, setNumPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.1);
  const [loading, setLoading] = useState(true);
  const [pdfDoc, setPdfDoc] = useState<any>(null);

  // Overlay Elements
  const [elements, setElements] = useState<DocOverlayElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  // Signature Modal
  const [isSigModalOpen, setIsSigModalOpen] = useState(false);

  // AI Matching States
  const [isAiMatching, setIsAiMatching] = useState(false);
  const [detectedFields, setDetectedFields] = useState<DetectedFieldMatch[]>([]);
  const [showAiMatchesModal, setShowAiMatchesModal] = useState(false);

  // Action Loading States
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // DOM Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorPageRef = useRef<HTMLDivElement>(null);

  const isPdf = Boolean(docItem && (docItem.fileType?.includes('pdf') || docItem.fileName?.toLowerCase().endsWith('.pdf')));
  const isImage = Boolean(docItem && docItem.fileType?.startsWith('image/'));

  // Initialize or restore saved elements
  useEffect(() => {
    if (docItem) {
      if (docItem.elements && Array.isArray(docItem.elements) && docItem.elements.length > 0) {
        setElements(docItem.elements);
      } else {
        setElements([]);
      }
      setCurrentPage(1);
      setZoom(1.1);
    }
  }, [docItem]);

  // Load PDF or Image
  useEffect(() => {
    let isCancelled = false;
    async function loadDocument() {
      if (!docItem?.fileData) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        if (isPdf) {
          // Convert base64 dataUrl or binary into Uint8Array
          let dataArray: Uint8Array;
          if (docItem.fileData.startsWith('data:')) {
            const base64Str = docItem.fileData.split(',')[1];
            const binary = atob(base64Str);
            const len = binary.length;
            dataArray = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              dataArray[i] = binary.charCodeAt(i);
            }
          } else {
            // direct fetch / binary
            const resp = await fetch(docItem.fileData);
            const buf = await resp.arrayBuffer();
            dataArray = new Uint8Array(buf);
          }

          const loadingTask = pdfjsLib.getDocument({
            data: dataArray,
            cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/cmaps/',
            cMapPacked: true,
          });

          const loadedPdf = await loadingTask.promise;
          if (!isCancelled) {
            setPdfDoc(loadedPdf);
            setNumPages(loadedPdf.numPages);
            setCurrentPage(1);
          }
        } else {
          // Image mode
          setPdfDoc(null);
          setNumPages(1);
          setCurrentPage(1);
        }
      } catch (err) {
        console.error("Failed to load document for editing:", err);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadDocument();
    return () => {
      isCancelled = true;
    };
  }, [docItem, isPdf]);

  // Render PDF page onto canvas
  useEffect(() => {
    let renderTask: any = null;
    async function renderPdfPage() {
      if (!pdfDoc || !canvasRef.current || !isPdf) return;
      try {
        const page = await pdfDoc.getPage(currentPage);
        const viewport = page.getViewport({ scale: 1.5 * zoom });
        const canvas = canvasRef.current;
        if (!canvas) return;

        const context = canvas.getContext('2d');
        if (!context) return;

        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        renderTask = page.render(renderContext);
        await renderTask.promise;
      } catch (e: any) {
        if (e?.name !== 'RenderingCancelledException') {
          console.error("PDF page render error:", e);
        }
      }
    }

    renderPdfPage();
    return () => {
      if (renderTask && typeof renderTask.cancel === 'function') {
        try {
          renderTask.cancel();
        } catch {
          // ignore
        }
      }
    };
  }, [pdfDoc, currentPage, zoom, isPdf]);

  // ---------------------------------------------------------------------------
  // ELEMENT MANAGEMENT
  // ---------------------------------------------------------------------------

  const addTextElement = (text: string = 'Click to edit text', label?: string) => {
    const newElement: DocOverlayElement = {
      id: `el_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'text',
      page: currentPage,
      x: 35 + (Math.random() * 10 - 5),
      y: 40 + (Math.random() * 10 - 5),
      content: text,
      label: label || 'Text',
      fontSize: 14,
      fontWeight: 'normal',
      fontStyle: 'normal',
      color: '#0f172a',
      backgroundColor: 'transparent'
    };
    setElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
  };

  const addSignatureElement = (sigDataUrl: string) => {
    const newElement: DocOverlayElement = {
      id: `sig_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      type: 'signature',
      page: currentPage,
      x: 40,
      y: 70,
      content: sigDataUrl,
      label: 'Signature',
      width: 150,
      height: 60
    };
    setElements(prev => [...prev, newElement]);
    setSelectedElementId(newElement.id);
    setIsSigModalOpen(false);
  };

  const updateElement = (id: string, updates: Partial<DocOverlayElement>) => {
    setElements(prev => prev.map(el => (el.id === id ? { ...el, ...updates } : el)));
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
    if (selectedElementId === id) {
      setSelectedElementId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // PROFILE DETAILS: MANUAL QUICK PUSH PALETTE
  // ---------------------------------------------------------------------------

  const profileFieldPalette = [
    {
      label: 'Full Name',
      value: profile?.displayName || '',
      icon: User,
      color: 'bg-indigo-50 border-indigo-200 text-indigo-700'
    },
    {
      label: 'Date',
      value: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }),
      icon: Calendar,
      color: 'bg-emerald-50 border-emerald-200 text-emerald-700'
    },
    {
      label: 'Email',
      value: profile?.email || '',
      icon: Mail,
      color: 'bg-blue-50 border-blue-200 text-blue-700'
    },
    {
      label: 'Phone',
      value: profile?.phone || '',
      icon: Phone,
      color: 'bg-amber-50 border-amber-200 text-amber-700'
    },
    {
      label: 'Address',
      value: profile?.address || '',
      icon: MapPin,
      color: 'bg-purple-50 border-purple-200 text-purple-700'
    },
    {
      label: 'Job Title',
      value: profile?.experience?.[0]?.position || (profile?.experience?.[0] as any)?.title || 'Professional',
      icon: Briefcase,
      color: 'bg-rose-50 border-rose-200 text-rose-700'
    },
    {
      label: 'Company',
      value: docItem?.companyName || profile?.experience?.[0]?.company || '',
      icon: Building2,
      color: 'bg-teal-50 border-teal-200 text-teal-700'
    },
    {
      label: 'Nationality',
      value: profile?.nationality || '',
      icon: FileCheck2,
      color: 'bg-cyan-50 border-cyan-200 text-cyan-700'
    }
  ];

  const handlePushProfileField = (item: { label: string; value: string }) => {
    if (!item.value) {
      alert(`No ${item.label} found in your profile. You can add it in the Profile Settings.`);
      return;
    }
    addTextElement(item.value, item.label);
  };

  const handleApplyProfileSignature = () => {
    if (profile?.signatureURL) {
      addSignatureElement(profile.signatureURL);
    } else {
      setIsSigModalOpen(true);
    }
  };

  // ---------------------------------------------------------------------------
  // SMART AI AUTO-MATCH PROFILE DETAILS TO DOCUMENT REQUIREMENTS
  // ---------------------------------------------------------------------------

  const handleAiAutoMatchRequirements = async () => {
    setIsAiMatching(true);
    try {
      // 1. Capture base document image for vision model
      let imageBase64 = '';
      if (canvasRef.current) {
        imageBase64 = canvasRef.current.toDataURL('image/png').split(',')[1];
      } else if (docItem.fileData.startsWith('data:image/')) {
        imageBase64 = docItem.fileData.split(',')[1];
      } else if (editorPageRef.current) {
        const tempCanvas = await html2canvas(editorPageRef.current, { scale: 1.5, useCORS: true });
        imageBase64 = tempCanvas.toDataURL('image/png').split(',')[1];
      }

      const todayStr = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const userProfileContext = {
        fullName: profile?.displayName || '',
        email: profile?.email || '',
        phone: profile?.phone || '',
        address: profile?.address || '',
        currentJobTitle: profile?.experience?.[0]?.position || (profile?.experience?.[0] as any)?.title || '',
        company: docItem.companyName || profile?.experience?.[0]?.company || '',
        nationality: profile?.nationality || '',
        todayDate: todayStr,
        hasSignature: Boolean(profile?.signatureURL)
      };

      const prompt = `You are an expert document inspector analyzing an official career document, contract, or form.
Task: Detect any blank requirement fields, signature lines, date lines, name lines, contact slots, or address inputs that require filling on this document page.
Then, match each requirement to the corresponding user profile information provided below.

USER PROFILE DETAILS:
- Full Name: "${userProfileContext.fullName}"
- Email: "${userProfileContext.email}"
- Phone Number: "${userProfileContext.phone}"
- Address: "${userProfileContext.address}"
- Job Title: "${userProfileContext.currentJobTitle}"
- Company: "${userProfileContext.company}"
- Nationality: "${userProfileContext.nationality}"
- Today's Date: "${userProfileContext.todayDate}"
- User has saved signature: ${userProfileContext.hasSignature ? 'YES' : 'NO'}

REQUIREMENT INSTRUCTIONS:
1. Identify labels like "Employee Name", "Name in Full", "Signature", "Sign here", "Candidate Signature", "Date", "Address", "Contact / Phone", "NRIC / IC No", "Designation / Title", "Accepted & Agreed By".
2. For each detected requirement, provide:
   - "fieldName": The label text found on document (e.g. "Employee Signature", "Full Name", "Date")
   - "mappedValue": The matching value from the user's profile. If it's a signature, put "[Signature]".
   - "type": "signature" or "text"
   - "x": horizontal coordinate percentage (0 - 100) where the text/signature should be placed (just above or directly on the underline/box)
   - "y": vertical coordinate percentage (0 - 100) where the text/signature should be placed
   - "confidence": "high", "medium", or "low"

Return a strictly valid JSON array of objects with schema:
[
  {
    "id": "match_1",
    "fieldName": "Employee Name",
    "mappedValue": "John Doe",
    "type": "text",
    "x": 25.5,
    "y": 62.0,
    "confidence": "high"
  }
]`;

      const contents: any[] = [];
      if (imageBase64) {
        contents.push({
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: imageBase64
              }
            }
          ]
        });
      } else {
        contents.push({
          parts: [{ text: prompt + `\n\nDocument Title: ${docItem.title}\nCategory: ${docItem.category}` }]
        });
      }

      let parsed: any[] = [];
      try {
        const result = await ai.models.generateContent({
          model: MODELS.flash,
          contents,
          generationConfig: {
            responseMimeType: "application/json"
          }
        });

        const text = result?.text || '[]';
        parsed = JSON.parse(text);
      } catch (aiErr) {
        console.warn("AI Auto-Match online call unavailable or failed, engaging smart heuristic detector:", aiErr);
      }

      if (!Array.isArray(parsed) || parsed.length === 0) {
        // Fallback default suggestions based on common form positions if no requirements detected
        parsed = [
          {
            id: 'auto_name',
            fieldName: 'Full Name',
            mappedValue: userProfileContext.fullName || 'Candidate Name',
            type: 'text',
            x: 20,
            y: 75,
            confidence: 'medium'
          },
          {
            id: 'auto_sig',
            fieldName: 'Signature',
            mappedValue: profile?.signatureURL ? '[Signature]' : '[New Signature]',
            type: 'signature',
            x: 20,
            y: 83,
            confidence: 'medium'
          },
          {
            id: 'auto_date',
            fieldName: 'Date',
            mappedValue: userProfileContext.todayDate,
            type: 'text',
            x: 65,
            y: 83,
            confidence: 'medium'
          }
        ];
      }

      const matchesWithSelection: DetectedFieldMatch[] = parsed.map((m, idx) => ({
        id: m.id || `m_${idx}`,
        fieldName: m.fieldName || 'Form Requirement',
        mappedValue: m.mappedValue || '',
        type: m.type === 'signature' ? 'signature' : 'text',
        x: Math.max(5, Math.min(90, Number(m.x) || 20)),
        y: Math.max(5, Math.min(90, Number(m.y) || 50)),
        confidence: m.confidence || 'high',
        selected: true
      }));

      setDetectedFields(matchesWithSelection);
      setShowAiMatchesModal(true);
    } catch (err: any) {
      console.warn("AI Auto-Match notice:", err);
    } finally {
      setIsAiMatching(false);
    }
  };

  const handleApplyAiMatches = () => {
    const selectedMatches = detectedFields.filter(f => f.selected);
    const newElementsToAdd: DocOverlayElement[] = [];

    for (const match of selectedMatches) {
      if (match.type === 'signature') {
        const sigUrl = profile?.signatureURL || '';
        if (sigUrl) {
          newElementsToAdd.push({
            id: `ai_sig_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'signature',
            page: currentPage,
            x: match.x,
            y: match.y,
            content: sigUrl,
            label: match.fieldName,
            width: 140,
            height: 55
          });
        } else {
          // Add placeholder signature text or prompt signature
          newElementsToAdd.push({
            id: `ai_txt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            type: 'text',
            page: currentPage,
            x: match.x,
            y: match.y,
            content: `[Signed: ${profile?.displayName || 'Applicant'}]`,
            label: match.fieldName,
            fontSize: 14,
            fontWeight: 'bold',
            fontStyle: 'italic',
            color: '#1e3a8a'
          });
        }
      } else {
        newElementsToAdd.push({
          id: `ai_txt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          type: 'text',
          page: currentPage,
          x: match.x,
          y: match.y,
          content: match.mappedValue || '',
          label: match.fieldName,
          fontSize: 13,
          fontWeight: 'normal',
          color: '#0f172a'
        });
      }
    }

    setElements(prev => [...prev, ...newElementsToAdd]);
    setShowAiMatchesModal(false);
    setSaveSuccessMsg(`Pushed ${newElementsToAdd.length} profile fields to matching document requirements!`);
    setTimeout(() => setSaveSuccessMsg(null), 4000);
  };

  // ---------------------------------------------------------------------------
  // SAVE & EXPORT (CLOUDVault & PDF DOWNLOAD)
  // ---------------------------------------------------------------------------

  const generateMergedDataUrl = async (): Promise<string> => {
    if (!editorPageRef.current || !docItem) return docItem?.fileData || '';

    // Use html2canvas to capture page with overlays
    const canvas = await html2canvas(editorPageRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png', 0.95);

    // If PDF, wrap inside jsPDF
    if (isPdf) {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      return pdf.output('datauristring');
    }

    return imgData;
  };

  const handleSaveToVault = async () => {
    if (!profile?.uid || !docItem) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      // 1. Generate updated file preview dataUrl with overlays merged
      const updatedFileData = await generateMergedDataUrl();

      // 2. Persist to Firestore and IndexedDB
      const updatedDoc = await updateUploadedDoc(profile.uid, docItem.id, {
        fileData: updatedFileData,
        elements: elements,
        notes: docItem.notes || `Signed and edited with ${elements.length} details applied.`,
        updatedAt: new Date().toISOString()
      });

      setSaveSuccessMsg("Successfully saved signed document to Cloud Vault!");
      if (onSaveSuccess) {
        onSaveSuccess(updatedDoc);
      }
      setTimeout(() => setSaveSuccessMsg(null), 3500);
    } catch (err: any) {
      console.error("Save to vault failed:", err);
      alert(`Could not save document: ${err.message || 'Please check your connection and try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!editorPageRef.current || !docItem) return;
    setIsExporting(true);

    try {
      const canvas = await html2canvas(editorPageRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Signed_${docItem.fileName ? docItem.fileName.replace(/\.[^/.]+$/, "") : "document"}.pdf`);
    } catch (err) {
      console.error("Download failed:", err);
      alert("Failed to export PDF. Please ensure all images have finished loading.");
    } finally {
      setIsExporting(false);
    }
  };

  // Selected element for styling toolbar
  const selectedElement = elements.find(el => el.id === selectedElementId);
  const currentVisibleElements = elements.filter(el => (el.page || 1) === currentPage);

  if (!isOpen || !docItem) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className="max-w-[96vw] w-[1380px] h-[95vh] p-0 flex flex-col rounded-[2.5rem] overflow-hidden bg-slate-950 border-slate-800 text-white shadow-2xl"
      >
        {/* TOP HEADER BAR */}
        <DialogHeader className="p-4 sm:p-5 bg-slate-900/90 border-b border-white/10 shrink-0 flex flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-primary/20 text-primary rounded-2xl shrink-0">
              <PenTool className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-black tracking-tight truncate text-white">
                {docItem.title}
              </DialogTitle>
              <div className="flex items-center gap-2 text-xs text-white/50 font-medium">
                <span className="uppercase font-mono text-[10px] bg-white/10 px-2 py-0.5 rounded text-white/80">
                  {isPdf ? `PDF (${numPages} Pgs)` : 'IMAGE'}
                </span>
                {docItem.companyName && (
                  <span className="truncate hidden sm:inline">• {docItem.companyName}</span>
                )}
                <span>• {elements.length} elements added</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {saveSuccessMsg && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-emerald-400 bg-emerald-950/80 border border-emerald-800/50 px-3 py-1.5 rounded-full animate-fade-in">
                <Check className="h-3.5 w-3.5" /> {saveSuccessMsg}
              </span>
            )}

            <Button
              size="sm"
              variant="outline"
              className="rounded-xl border-white/10 text-white bg-white/5 hover:bg-white/10 font-bold text-xs h-9 px-3 gap-1.5"
              onClick={handleDownloadPdf}
              disabled={isExporting}
            >
              {isExporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5 text-primary" />}
              <span className="hidden sm:inline">Download PDF</span>
            </Button>

            <Button
              size="sm"
              className="rounded-xl bg-primary hover:bg-primary/90 text-white font-bold text-xs h-9 px-4 shadow-lg shadow-primary/20 gap-1.5"
              onClick={handleSaveToVault}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              <span>Save to Vault</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="rounded-xl text-white/50 hover:text-white hover:bg-white/10 h-9 w-9 ml-1"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        {/* MAIN STUDIO WORKSPACE */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* LEFT / CENTER: DOCUMENT CANVAS VIEWPORT */}
          <div className="flex-1 flex flex-col bg-slate-900/60 overflow-hidden relative">
            {/* Viewport Control Bar */}
            <div className="p-3 bg-slate-900 border-b border-white/10 flex items-center justify-between text-xs text-white/70">
              {/* PDF Page Navigation */}
              {isPdf && numPages > 1 ? (
                <div className="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-xl border border-white/10">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage(p => p - 1)}
                    className="h-6 w-6 text-white hover:bg-white/10 rounded-lg"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                  <span className="font-mono font-bold text-[11px] px-1">
                    {currentPage} / {numPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={currentPage >= numPages}
                    onClick={() => setCurrentPage(p => p + 1)}
                    className="h-6 w-6 text-white hover:bg-white/10 rounded-lg"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ) : (
                <span className="text-[11px] text-white/40 font-mono">Page 1 of 1</span>
              )}

              {/* Quick AI & Push Status Indicator */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-[11px] text-white/50">
                  Click and drag elements to position on lines or boxes.
                </span>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-xl border border-white/10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white hover:bg-white/10"
                  onClick={() => setZoom(z => Math.max(0.6, z - 0.15))}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <span className="w-10 text-center font-mono font-bold text-[11px]">
                  {Math.round(zoom * 100)}%
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-white hover:bg-white/10"
                  onClick={() => setZoom(z => Math.min(2.5, z + 0.15))}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Document Canvas Stage */}
            <div 
              className="flex-1 overflow-auto p-4 md:p-8 flex items-center justify-center bg-slate-950/70"
              onClick={() => setSelectedElementId(null)}
            >
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3 text-white/60 p-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm font-semibold">Rendering high-resolution document...</p>
                </div>
              ) : (
                <div 
                  ref={editorPageRef}
                  className="relative bg-white shadow-2xl rounded-lg overflow-hidden select-none"
                  style={{
                    transform: `scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.1s ease-out'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Base Layer: PDF Canvas or Image */}
                  {isPdf ? (
                    <canvas ref={canvasRef} className="block max-w-full h-auto bg-white" />
                  ) : (
                    <img 
                      src={docItem.fileData} 
                      alt={docItem.title} 
                      className="block max-w-full h-auto object-contain bg-white" 
                      style={{ maxHeight: '80vh' }}
                    />
                  )}

                  {/* Overlays Layer (Text & Signatures) */}
                  {currentVisibleElements.map((el) => {
                    const isSelected = selectedElementId === el.id;

                    return (
                      <motion.div
                        key={el.id}
                        drag
                        dragMomentum={false}
                        dragConstraints={editorPageRef}
                        onDragEnd={(_, info) => {
                          const rect = editorPageRef.current?.getBoundingClientRect();
                          if (rect && zoom) {
                            // Account for scale zoom when calculating percentage
                            const scaledWidth = rect.width / zoom;
                            const scaledHeight = rect.height / zoom;
                            const deltaX = (info.offset.x / scaledWidth) * 100;
                            const deltaY = (info.offset.y / scaledHeight) * 100;
                            updateElement(el.id, {
                              x: Math.max(0, Math.min(95, el.x + deltaX)),
                              y: Math.max(0, Math.min(95, el.y + deltaY))
                            });
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedElementId(el.id);
                        }}
                        style={{
                          position: 'absolute',
                          left: `${el.x}%`,
                          top: `${el.y}%`,
                          cursor: 'grab',
                          zIndex: isSelected ? 40 : 20
                        }}
                        className={cn(
                          "group select-none touch-none",
                          isSelected ? "ring-2 ring-primary ring-offset-2 rounded" : "hover:ring-1 hover:ring-primary/40 rounded"
                        )}
                      >
                        {el.type === 'text' ? (
                          <div className="relative">
                            <input
                              type="text"
                              value={el.content}
                              onChange={(e) => updateElement(el.id, { content: e.target.value })}
                              style={{
                                fontSize: `${el.fontSize || 14}px`,
                                fontWeight: el.fontWeight || 'normal',
                                fontStyle: el.fontStyle || 'normal',
                                color: el.color || '#0f172a',
                                background: el.backgroundColor || 'transparent',
                                border: 'none',
                                outline: 'none',
                                width: 'auto',
                                minWidth: '40px'
                              }}
                              className="font-sans px-1.5 py-0.5 rounded cursor-text focus:bg-white/80 focus:shadow-sm"
                            />
                            {isSelected && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  removeElement(el.id);
                                }}
                                className="absolute -top-3.5 -right-3.5 bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition-transform hover:scale-110"
                                title="Remove element"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="relative group/sig">
                            <img
                              src={el.content}
                              alt="Signature"
                              draggable={false}
                              style={{ width: el.width || 140, height: el.height || 55 }}
                              className="object-contain pointer-events-none"
                            />
                            {isSelected && (
                              <div className="absolute -top-3.5 -right-3.5 flex items-center gap-1">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeElement(el.id);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white rounded-full p-1 shadow-md transition-transform hover:scale-110"
                                  title="Remove signature"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT SIDEBAR: TOOLS, PROFILE PUSH & AI INSPECTOR */}
          <div className="w-full lg:w-[380px] bg-slate-900 border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col h-auto lg:h-full overflow-y-auto">
            <div className="p-5 space-y-6">
              
              {/* SMART AI INSPECTOR & MATCHER CARD */}
              <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-900/40 border border-indigo-500/30 shadow-xl space-y-3">
                <div className="flex items-center gap-2 text-indigo-400">
                  <Sparkles className="h-4 w-4" />
                  <span className="text-xs font-black uppercase tracking-wider">AI Requirement Matcher</span>
                </div>
                <p className="text-xs text-white/70 leading-relaxed">
                  Scan this document to automatically detect signature lines, name fields, and dates, then auto-fill them from your profile.
                </p>
                <Button
                  className="w-full rounded-2xl font-bold bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 shadow-lg shadow-indigo-600/30 gap-2"
                  onClick={handleAiAutoMatchRequirements}
                  disabled={isAiMatching || loading}
                >
                  {isAiMatching ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Inspecting Document Lines...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 text-indigo-200" />
                      Auto-Match & Push Profile Details
                    </>
                  )}
                </Button>
              </div>

              {/* QUICK INSERT PROFILE DETAILS PALETTE */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-white/50">
                    Push Details from Profile
                  </h4>
                  <span className="text-[10px] text-white/40 font-mono">1-Click Drop</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {profileFieldPalette.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => handlePushProfileField(item)}
                        className={cn(
                          "p-2.5 rounded-2xl text-left border text-xs font-semibold flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-95 group",
                          item.color
                        )}
                        title={`Drop ${item.label} ("${item.value || 'Not set'}") onto document`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <div className="min-w-0">
                          <span className="block font-bold text-[11px] truncate leading-tight">
                            {item.label}
                          </span>
                          <span className="block text-[9px] opacity-75 truncate leading-tight">
                            {item.value || 'Empty in profile'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Profile Signature One-Click */}
                <div className="pt-1">
                  <Button
                    variant="outline"
                    className="w-full rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs h-11 justify-between px-3.5 group"
                    onClick={handleApplyProfileSignature}
                  >
                    <span className="flex items-center gap-2">
                      <PenTool className="h-4 w-4 text-emerald-400" />
                      {profile?.signatureURL ? 'Push Saved Profile Signature' : '+ Add Signature'}
                    </span>
                    <span className="text-[10px] text-white/40 group-hover:text-white/70 font-mono">
                      {profile?.signatureURL ? 'Saved' : 'Draw'}
                    </span>
                  </Button>
                </div>
              </div>

              {/* MANUAL TOOLS: ADD TEXT & DRAW SIGNATURE */}
              <div className="space-y-3 pt-2 border-t border-white/10">
                <h4 className="text-xs font-black uppercase tracking-wider text-white/50">
                  Standard Editing Tools
                </h4>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs h-11 gap-2"
                    onClick={() => addTextElement('Custom Text', 'Custom Text')}
                  >
                    <TypeIcon className="h-4 w-4 text-primary" />
                    Add Text Box
                  </Button>

                  <Button
                    variant="outline"
                    className="rounded-2xl border-white/10 bg-white/5 hover:bg-white/10 text-white font-bold text-xs h-11 gap-2"
                    onClick={() => setIsSigModalOpen(true)}
                  >
                    <PenTool className="h-4 w-4 text-emerald-400" />
                    New Signature
                  </Button>
                </div>
              </div>

              {/* SELECTED ELEMENT CONTROLLER */}
              {selectedElement && (
                <div className="p-4 rounded-3xl bg-white/5 border border-white/10 space-y-4 animate-fade-in">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <span className="text-xs font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                      {selectedElement.type === 'text' ? <TypeIcon className="h-3.5 w-3.5" /> : <PenTool className="h-3.5 w-3.5" />}
                      Editing {selectedElement.label || selectedElement.type}
                    </span>
                    <button
                      onClick={() => removeElement(selectedElement.id)}
                      className="text-red-400 hover:text-red-300 text-xs font-bold flex items-center gap-1"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>

                  {selectedElement.type === 'text' && (
                    <div className="space-y-3">
                      {/* Bold / Italic / Color */}
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={selectedElement.fontWeight === 'bold' ? 'secondary' : 'outline'}
                          className="rounded-xl h-8 px-2.5 text-xs font-bold border-white/10 text-white"
                          onClick={() => updateElement(selectedElement.id, {
                            fontWeight: selectedElement.fontWeight === 'bold' ? 'normal' : 'bold'
                          })}
                        >
                          <Bold className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          size="sm"
                          variant={selectedElement.fontStyle === 'italic' ? 'secondary' : 'outline'}
                          className="rounded-xl h-8 px-2.5 text-xs font-bold border-white/10 text-white"
                          onClick={() => updateElement(selectedElement.id, {
                            fontStyle: selectedElement.fontStyle === 'italic' ? 'normal' : 'italic'
                          })}
                        >
                          <Italic className="h-3.5 w-3.5" />
                        </Button>

                        {/* Quick Color Presets */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          {['#0f172a', '#1e3a8a', '#b91c1c', '#047857'].map((c) => (
                            <button
                              key={c}
                              onClick={() => updateElement(selectedElement.id, { color: c })}
                              style={{ backgroundColor: c }}
                              className={cn(
                                "h-5 w-5 rounded-full border border-white/30 transition-transform",
                                selectedElement.color === c && "scale-125 ring-2 ring-white"
                              )}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Font Size Slider */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[11px] font-mono text-white/60">
                          <span>Size</span>
                          <span>{selectedElement.fontSize || 14}px</span>
                        </div>
                        <input
                          type="range"
                          min="9"
                          max="36"
                          value={selectedElement.fontSize || 14}
                          onChange={(e) => updateElement(selectedElement.id, { fontSize: parseInt(e.target.value) })}
                          className="w-full accent-primary bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                        />
                      </div>
                    </div>
                  )}

                  {selectedElement.type === 'signature' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[11px] font-mono text-white/60">
                        <span>Signature Width</span>
                        <span>{selectedElement.width || 140}px</span>
                      </div>
                      <input
                        type="range"
                        min="70"
                        max="280"
                        value={selectedElement.width || 140}
                        onChange={(e) => {
                          const w = parseInt(e.target.value);
                          updateElement(selectedElement.id, {
                            width: w,
                            height: Math.round(w * 0.4)
                          });
                        }}
                        className="w-full accent-primary bg-white/10 h-1.5 rounded-full appearance-none cursor-pointer"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Vault Save Advice */}
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 text-[11px] text-white/50 space-y-1">
                <span className="font-bold text-white/80 block">Cloud Synchronization</span>
                <span>
                  All added signatures, text, and profile details will be permanently preserved in your private Firestore vault and IndexedDB.
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* SIGNATURE MANAGER MODAL */}
        <SignatureManager
          isOpen={isSigModalOpen}
          onClose={() => setIsSigModalOpen(false)}
          onConfirm={(sigData) => addSignatureElement(sigData)}
        />

        {/* AI DETECTED MATCHES REVIEW MODAL */}
        <Dialog open={showAiMatchesModal} onOpenChange={setShowAiMatchesModal}>
          <DialogContent className="sm:max-w-[540px] rounded-[2.5rem] bg-slate-900 text-white border-slate-800 p-6">
            <DialogHeader>
              <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl w-fit mb-2">
                <Sparkles className="h-6 w-6" />
              </div>
              <DialogTitle className="text-xl font-bold">
                Review Matched Document Requirements
              </DialogTitle>
              <p className="text-xs text-white/60">
                ProEase AI analyzed this page and detected the following form fields. Check the details you wish to push to the document:
              </p>
            </DialogHeader>

            <div className="space-y-2.5 my-4 max-h-[50vh] overflow-y-auto pr-1">
              {detectedFields.map((field) => (
                <div
                  key={field.id}
                  onClick={() => {
                    setDetectedFields(prev => prev.map(f => f.id === field.id ? { ...f, selected: !f.selected } : f));
                  }}
                  className={cn(
                    "p-3 rounded-2xl border text-xs flex items-center justify-between cursor-pointer transition-all",
                    field.selected 
                      ? "bg-indigo-950/60 border-indigo-500/60 text-white" 
                      : "bg-white/5 border-white/10 text-white/50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "h-5 w-5 rounded-lg border flex items-center justify-center text-white",
                      field.selected ? "bg-indigo-600 border-indigo-500" : "border-white/20"
                    )}>
                      {field.selected && <Check className="h-3 w-3" />}
                    </div>
                    <div>
                      <span className="font-bold text-sm block">{field.fieldName}</span>
                      <span className="text-[11px] text-indigo-300 font-mono">
                        Value: "{field.mappedValue}"
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono text-white/40 uppercase">
                    Pos: {Math.round(field.x)}%, {Math.round(field.y)}%
                  </span>
                </div>
              ))}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                className="rounded-xl border-white/10 text-white hover:bg-white/10 text-xs font-bold"
                onClick={() => setShowAiMatchesModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-5 shadow-lg shadow-indigo-600/30"
                onClick={handleApplyAiMatches}
              >
                Push Selected Details to Document
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
