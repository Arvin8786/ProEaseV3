import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  FileUp, 
  Download, 
  Sparkles, 
  PenTool, 
  Save,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Search,
  FileText,
  ZoomIn,
  ZoomOut,
  X,
  Type as TypeIcon,
  Bold,
  Italic,
  Trash2,
  Database,
  Calendar,
  Clock,
  Eye,
  ScanLine
} from 'lucide-react';
import { pdfjsLib } from '@/lib/pdfWorker';
import { PDFDocument, rgb } from 'pdf-lib';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';
import { DocumentGenerator } from './DocumentGenerator';
import { SignatureManager } from './SignatureManager';
import { ai, MODELS } from '@/lib/gemini';
import { Type } from "@google/genai";
import { motion, AnimatePresence } from 'motion/react';
import { getGeneratedDocs, GeneratedDoc as DocHistory, deleteGeneratedDoc, updateGeneratedDoc, saveGeneratedDoc } from '@/lib/documentStorage';
import { DocumentPreviewer } from './DocumentPreviewer';
import { extractProfileDetails } from '@/services/gemini';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';

interface DocElement {
  id: string;
  type: 'text' | 'signature';
  x: number;
  y: number;
  width?: number;
  height?: number;
  content: string; // text value or image dataUrl
  fontSize?: number;
  letterSpacing?: number;
  lineHeight?: number;
  fontWeight?: string;
  fontStyle?: string;
}

// Worker source is handled in useEffect to ensure it uses the correct version

interface DocumentEditorProps {
  profile: UserProfile | null;
}

export function DocumentEditor({ profile }: DocumentEditorProps) {
  const [view, setView] = useState<'editor' | 'generator' | 'vault'>('generator');
  const [file, setFile] = useState<File | null>(null);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Interactive Editor States
  const [elements, setElements] = useState<DocElement[]>([]);
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [showScanEdit, setShowScanEdit] = useState(false);
  const [baseContent, setBaseContent] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  // Vault States
  const [vaultDocs, setVaultDocs] = useState<DocHistory[]>([]);
  const [isVaultLoading, setIsVaultLoading] = useState(false);
  const [isSavingToVault, setIsSavingToVault] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewVaultDoc, setPreviewVaultDoc] = useState<any>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Extraction State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<any>(null);
  const [showExtractionConfirm, setShowExtractionConfirm] = useState(false);

  useEffect(() => {
    if (view === 'vault' && profile?.uid) {
      loadVault();
    }
  }, [view, profile?.uid]);

  const handleApplyExtraction = async () => {
    if (!profile?.uid || !extractedProfile) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', profile.uid);
      await updateDoc(userRef, {
        experience: extractedProfile.experience || profile.experience,
        education: extractedProfile.education || profile.education,
        skills: [...new Set([...(profile.skills || []), ...(extractedProfile.skills || [])])],
        updatedAt: new Date().toISOString()
      });
      setShowExtractionConfirm(false);
      setExtractedProfile(null);
      // Reload page or show success
      window.location.reload(); 
    } catch (error) {
      console.error("Failed to update profile from extraction:", error);
    } finally {
      setLoading(false);
    }
  };

  const startExtraction = async () => {
    let textToParse = baseContent || '';
    if (!textToParse && pdfDoc) {
      // If it's a PDF, we might need a way to get all text. 
      // Mammoth/XLSX already put text in baseContent. 
      // For PDF, we can try to extract text using a loop if possible, or just use what's visible.
      // For now, let's assume if baseContent is empty, we try to gather from elements if AI fill was used.
    }
    
    if (!textToParse) {
      alert("No extractable text found in this document. Please use a file that contains textual data (Word, Text, or AI-Processed Image).");
      return;
    }

    setIsExtracting(true);
    try {
      const result = await extractProfileDetails(textToParse);
      if (result) {
        setExtractedProfile(result);
        setShowExtractionConfirm(true);
      }
    } catch (e) {
      console.error("Extraction failed:", e);
    } finally {
      setIsExtracting(false);
    }
  };

  // Automatically trigger extraction suggestion if profile is empty
  useEffect(() => {
    if (profile && (profile.experience?.length === 0 || !profile.professionalSummary) && baseContent && view === 'editor' && !isExtracting && !extractedProfile) {
       // Only if we haven't offered yet in this session
       const hasOffered = sessionStorage.getItem('extraction_offered');
       if (!hasOffered) {
         sessionStorage.setItem('extraction_offered', 'true');
         setTimeout(() => {
            if (confirm("I noticed your professional profile is mostly empty. Would you like ProEase AI to extract your details from this document and automatically fill your Career Vault?")) {
              startExtraction();
            }
         }, 2000);
       }
    }
  }, [profile, baseContent, view]);

  const loadVault = async () => {
    if (!profile?.uid) return;
    setIsVaultLoading(true);
    const docs = await getGeneratedDocs(profile.uid);
    setVaultDocs(docs);
    setIsVaultLoading(false);
  };

  const addTextElement = (content: string, isBase = true) => {
    if (isBase) {
      setBaseContent(content);
      setImageUrl(null);
      setPdfDoc(null);
      setNumPages(1);
      setCurrentPage(1);
    } else {
      const newElement: DocElement = {
        id: Math.random().toString(36).substr(2, 9),
        type: 'text',
        x: 10,
        y: 10,
        content: content.substring(0, 5000), 
        fontSize: 14,
        letterSpacing: 0,
        lineHeight: 1.2,
        fontWeight: 'normal',
        fontStyle: 'normal'
      };
      setElements(prev => [...prev, newElement]);
    }
  };

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setPdfDoc(null);
    setImageUrl(null);
    setBaseContent(null);
    setNumPages(0);
    setElements([]); 

    try {
      if (selectedFile.type === 'application/pdf') {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ 
          data: arrayBuffer,
          cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@5.6.205/cmaps/',
          cMapPacked: true,
        });
        const pdf = await loadingTask.promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } else if (selectedFile.type.startsWith('image/')) {
        const url = URL.createObjectURL(selectedFile);
        setImageUrl(url);
        setNumPages(1);
        setCurrentPage(1);
      } else if (selectedFile.type === 'text/plain') {
        const text = await selectedFile.text();
        addTextElement(text);
      } else if (selectedFile.name.endsWith('.docx') || selectedFile.name.endsWith('.doc')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        addTextElement(result.value);
      } else if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer);
        let extractedText = '';
        workbook.SheetNames.forEach(sheetName => {
          const worksheet = workbook.Sheets[sheetName];
          extractedText += `Sheet: ${sheetName}\n`;
          extractedText += XLSX.utils.sheet_to_txt(worksheet) + '\n\n';
        });
        addTextElement(extractedText);
      } else {
        // Fallback for other files: try as text
        try {
          const text = await selectedFile.text();
          addTextElement(text);
        } catch (e) {
          console.error("Unsupported file format for rendering", e);
        }
      }
    } catch (error) {
      console.error("File Load Error:", error);
    } finally {
      setLoading(false);
    }
  };

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;
    
    // Clear canvas before rendering new page/zoom
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (context) context.clearRect(0, 0, canvas.width, canvas.height);

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.5 * zoom });
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;

    const renderContext = {
      canvasContext: context!,
      viewport: viewport,
    };
    await page.render(renderContext).promise;
  };

  useEffect(() => {
    if (pdfDoc) {
      renderPage(currentPage);
    }
  }, [pdfDoc, currentPage, zoom]);

  const handleAiAutoFill = async () => {
    if (!canvasRef.current && !imageUrl && elements.length === 0) return;
    setIsAiProcessing(true);
    
    try {
      // Capture the current view as an image if available
      let dataUrl = '';
      if (canvasRef.current) {
        dataUrl = canvasRef.current.toDataURL('image/png').split(',')[1];
      } else if (imageUrl) {
        // Fetch image and convert to base64
        const resp = await fetch(imageUrl);
        const blob = await resp.blob();
        dataUrl = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
          reader.readAsDataURL(blob);
        });
      }

      const prompt = `Analyze this document. Identify common form fields (Name, Date, Signature, Address, Skills) or specific labels that need to be filled.
                      Based on the user's profile:
                      - Name: ${profile?.displayName || ''}
                      - Email: ${profile?.email || ''}
                      - Summary: ${profile?.professionalSummary || ''}
                      - Skills: ${profile?.skills?.join(', ') || ''}
                      
                      ${dataUrl ? 'Return a JSON array of fields with their approximate coordinates (percentage x and y relative to image size) and the mapped value from the profile.' : 'The document content is provided as text. Return a JSON array of fields that should be suggested for this document.'}
                      
                      FORMAT: [{ "id": "uuid", "type": "text", "x": 10, "y": 20, "content": "John Doe", "fontSize": 12 }]`;

      const contents = dataUrl ? [
        {
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: "image/png",
                data: dataUrl
              }
            }
          ]
        }
      ] : [
        {
          parts: [
            { text: prompt + "\n\nDOCUMENT CONTENT:\n" + (baseContent || elements.map(el => el.content).join('\n')) }
          ]
        }
      ];

      const result = await ai.models.generateContent({
        model: MODELS.flash,
        contents,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                id: { type: "STRING" },
                type: { type: "STRING" },
                x: { type: "NUMBER" },
                y: { type: "NUMBER" },
                content: { type: "STRING" },
                fontSize: { type: "NUMBER" }
              }
            }
          } as any
        }
      } as any);

      const detectedFields = JSON.parse(result.text || "[]");
      setElements(prev => [...prev, ...detectedFields.map((f: any) => ({
        ...f,
        id: Math.random().toString(36).substr(2, 9),
        letterSpacing: 0,
        lineHeight: 1.2,
        fontWeight: 'normal',
        fontStyle: 'normal'
      }))]);
    } catch (error) {
      console.error("AI Auto-fill Error:", error);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const addText = () => {
    const newElement: DocElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'text',
      x: 10,
      y: 10,
      content: 'New Text',
      fontSize: 16,
      letterSpacing: 0,
      lineHeight: 1.2,
      fontWeight: 'normal',
      fontStyle: 'normal'
    };
    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
  };

  const handleAddSignature = (signatureDataUrl: string) => {
    const newElement: DocElement = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'signature',
      x: 10,
      y: 10,
      content: signatureDataUrl,
      width: 150,
      height: 60
    };
    setElements([...elements, newElement]);
    setSelectedElementId(newElement.id);
    setIsSignatureModalOpen(false);
  };

  const updateElement = (id: string, updates: Partial<DocElement>) => {
    setElements(elements.map(el => el.id === id ? { ...el, ...updates } : el));
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(el => el.id !== id));
    setSelectedElementId(null);
  };

  const handleDownload = async () => {
    if (!editorRef.current || !file) return;
    setIsDownloading(true);
    try {
      const canvas = await html2canvas(editorRef.current, {
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
      pdf.save(`Edited_${file.name.split('.')[0]}.pdf`);
    } catch (error) {
      console.error("Download failed:", error);
      alert("Failed to export document. Your browser might be blocking canvas operations.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSaveToVault = async () => {
    if (!profile?.uid || !file) return;
    setIsSavingToVault(true);
    try {
      // Capture a visual representation for the content field 
      // In a real app we might store the JSON state (elements) but for simplicity 
      // we'll store a note that it's a signed/edited document and use content for text if available
      const content = baseContent || `Document with ${elements.length} interactive elements added.`;
      
      await saveGeneratedDoc(profile.uid, {
        type: 'resume', // Default to resume for file imports, or based on filename
        title: `Edited: ${file.name}`,
        content: content,
        params: {
          originalName: file.name,
          elements: elements, // Store the overlays
          isEditedImport: true
        }
      });
      alert("Document with all edits successfully saved to your Career Vault.");
      setView('vault');
    } catch (error) {
      console.error("Save to vault failed:", error);
      alert("System Error: Unable to save edited document to vault.");
    } finally {
      setIsSavingToVault(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Document Vault</h1>
          <p className="text-slate-500 text-lg">Generate, store, and manage your professional credentials.</p>
        </div>
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-fit">
          <Button 
            variant={view === 'generator' ? 'secondary' : 'ghost'} 
            className={cn("rounded-xl font-bold px-6", view === 'generator' && "bg-white shadow-sm")}
            onClick={() => setView('generator')}
          >
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            AI Generator
          </Button>
          <Button 
            variant={view === 'vault' ? 'secondary' : 'ghost'} 
            className={cn("rounded-xl font-bold px-6 border-2 border-transparent", view === 'vault' && "bg-white shadow-sm border-primary/20")}
            onClick={() => {
              setView('vault');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          >
            <Database className="mr-2 h-4 w-4 text-primary" />
            Active Vault
          </Button>
          <Button 
            variant={view === 'editor' ? 'secondary' : 'ghost'} 
            className={cn("rounded-xl font-bold px-6", view === 'editor' && "bg-white shadow-sm")}
            onClick={() => setView('editor')}
          >
            <FileText className="mr-2 h-4 w-4 text-primary" />
            Editor
          </Button>
        </div>
      </div>

      {view === 'generator' ? (
        <DocumentGenerator profile={profile} />
      ) : view === 'vault' ? (
        <div className="space-y-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-2xl">
                 <Database className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-3xl font-black tracking-tighter">Document Vault</h2>
                <p className="text-slate-500 text-sm font-medium">Your historical records and generated professional assets.</p>
              </div>
            </div>
            {isVaultLoading && (
              <div className="flex items-center gap-2 text-primary font-bold text-sm bg-primary/5 px-4 py-2 rounded-full animate-pulse">
                <Loader2 className="h-4 w-4 animate-spin" />
                Updating Vault...
              </div>
            )}
          </div>

          {vaultDocs.length === 0 && !isVaultLoading ? (
            <Card className="border-none shadow-[0_32px_64px_-16px_rgba(0,0,0,0.05)] flex flex-col items-center justify-center p-24 text-center bg-white rounded-[4rem]">
              <div className="bg-slate-50 p-12 rounded-[3.5rem] mb-10 shadow-inner border border-slate-100 relative group overflow-hidden">
                <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
                <Database className="h-20 w-20 text-primary/30 relative z-10" />
              </div>
              <CardTitle className="mb-4 text-4xl font-black tracking-tighter text-slate-900">Your Vault is Empty</CardTitle>
              <CardDescription className="max-w-md mx-auto text-xl leading-relaxed text-slate-500 font-medium">
                Generate your first professional assets using the AI Generator to begin building your career vault.
              </CardDescription>
              <Button 
                onClick={() => setView('generator')} 
                className="mt-10 rounded-[2rem] h-16 px-10 font-bold text-lg shadow-2xl shadow-primary/20 hover:scale-105 transition-transform"
              >
                Go to AI Generator
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {vaultDocs.map((doc) => (
                <motion.div
                  key={doc.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -8 }}
                  className="bg-white p-8 rounded-[3rem] shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] border border-slate-100 group relative flex flex-col h-full"
                >
                  <div className="flex items-start justify-between mb-8">
                    <div className={cn(
                      "p-5 rounded-[1.75rem] transition-all group-hover:rotate-6 shadow-sm",
                      doc.type === 'resume' ? 'bg-blue-50 text-blue-600 border border-blue-100/50' :
                      doc.type === 'cover_letter' ? 'bg-purple-50 text-purple-600 border border-purple-100/50' :
                      'bg-orange-50 text-orange-600 border border-orange-100/50'
                    )}>
                      <FileText className="h-8 w-8" />
                    </div>
                    <div className="bg-slate-50 px-4 py-2 rounded-2xl border border-slate-100 flex flex-col items-end">
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {doc.createdAt instanceof Date ? doc.createdAt.toLocaleDateString() : 'Just now'}
                      </div>
                      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">
                        <Clock className="h-3 w-3" />
                        {doc.createdAt instanceof Date ? doc.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-4 right-4 h-8 w-8 rounded-full text-slate-300 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all z-10"
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm('Delete this document from vault?')) {
                          try {
                            await deleteGeneratedDoc(profile!.uid, doc.id);
                            loadVault();
                          } catch (error) {
                            console.error("Delete failed:", error);
                            alert("Unable to delete document. Access might be restricted or network is offline.");
                          }
                        }
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="flex-1">
                    <h3 className="text-2xl font-black tracking-tight text-slate-900 mb-2 capitalize truncate">
                      {doc.type.replace('_', ' ')}
                    </h3>
                    <p className="text-base text-slate-400 font-medium mb-8 line-clamp-2">
                      {doc.title || 'Generated Document'}
                    </p>
                  </div>

                  <div className="flex gap-4 pt-6 border-t border-slate-50 mt-auto">
                    <Button 
                      className="flex-1 h-14 rounded-2xl font-black text-sm tracking-tight shadow-xl shadow-primary/10"
                      onClick={() => {
                        setPreviewVaultDoc({
                          id: doc.id,
                          type: doc.type,
                          content: doc.content,
                          position: doc.title,
                          date: doc.createdAt instanceof Date ? doc.createdAt.toLocaleDateString() : ''
                        });
                        setIsPreviewOpen(true);
                      }}
                    >
                      <Eye className="mr-2 h-5 w-5" />
                      View Full
                    </Button>
                    <Button 
                      variant="outline"
                      size="lg"
                      className="rounded-2xl border-slate-200 h-14 px-6 shrink-0 hover:bg-red-500 hover:text-white hover:border-red-500 transition-all group/del active:scale-95 shadow-sm"
                      onClick={async () => {
                        if (confirm('CRITICAL: Are you sure you want to PERMANENTLY delete this document from your secure vault? This cannot be undone.')) {
                          try {
                            await deleteGeneratedDoc(profile!.uid, doc.id);
                            loadVault();
                          } catch (error) {
                            console.error("Delete failed:", error);
                            alert("Unable to delete document from vault. Access might be restricted or network is offline.");
                          }
                        }
                      }}
                    >
                      <Trash2 className="h-5 w-5 mr-2 text-red-500 group-hover/del:text-white transition-colors" />
                      Delete
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          <DocumentPreviewer 
            isOpen={isPreviewOpen} 
            onClose={() => setIsPreviewOpen(false)} 
            document={previewVaultDoc} 
            profile={profile}
            onSave={async (newContent) => {
              if (previewVaultDoc?.id && profile?.uid) {
                await updateGeneratedDoc(profile.uid, previewVaultDoc.id, { content: newContent });
                loadVault(); // Reload list to show updated content
                setPreviewVaultDoc((prev: any) => ({ ...prev, content: newContent }));
                alert("Changes saved to vault successfully.");
              }
            }}
          />
        </div>
      ) : (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div />
              <div className="flex gap-2">
                <Input
                  type="file"
                  onChange={onFileChange}
                  className="hidden"
                  id="document-upload"
                  accept=".pdf,image/*,.txt,.doc,.docx,.xls,.xlsx"
                />
                <label 
                  htmlFor="document-upload" 
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-2.5 text-sm font-bold hover:bg-slate-50 cursor-pointer transition-all shadow-sm"
                >
                  <FileUp className="mr-2 h-4 w-4 text-primary" />
                  Import Document
                </label>
                
                <Button 
                  disabled={!file || isDownloading} 
                  className="rounded-xl font-bold px-6 bg-slate-900 hover:bg-slate-800" 
                  onClick={handleDownload}
                >
                  {isDownloading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                  Download PDF
                </Button>

                <Button 
                  disabled={!file || isSavingToVault} 
                  className="rounded-xl font-bold px-6 bg-primary shadow-lg shadow-primary/20" 
                  onClick={handleSaveToVault}
                >
                  {isSavingToVault ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save to Vault
                </Button>
                
                {baseContent && (
                  <Button 
                    variant="outline"
                    className="rounded-xl border-primary/20 bg-primary/5 text-primary font-bold px-6 hover:bg-primary/10"
                    onClick={startExtraction}
                    disabled={isExtracting}
                  >
                    {isExtracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Sync to Profile
                  </Button>
                )}
              </div>
            </div>

            <Dialog open={showExtractionConfirm} onOpenChange={setShowExtractionConfirm}>
              <DialogContent className="max-w-2xl rounded-[2.5rem]">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black tracking-tighter">Review Extracted Data</DialogTitle>
                </DialogHeader>
                <div className="space-y-6 py-4 max-h-[60vh] overflow-y-auto pr-2">
                  <p className="text-slate-500 font-medium">We've extracted the following details from your document. Would you like to update your profile with this information? <span className="text-red-500 font-bold">Existing experience and education will be replaced.</span></p>
                  
                  {extractedProfile?.experience?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary">Experience</h4>
                      {extractedProfile.experience.map((exp: any, i: number) => (
                        <div key={i} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 italic text-sm">
                          <span className="font-bold text-slate-900 not-italic">{exp.position}</span> at {exp.company}
                        </div>
                      ))}
                    </div>
                  )}

                  {extractedProfile?.skills?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary">Skills Detected</h4>
                      <div className="flex flex-wrap gap-2">
                        {extractedProfile.skills.map((skill: string, i: number) => (
                          <span key={i} className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-bold border border-blue-100">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter className="gap-2">
                  <Button variant="outline" className="rounded-xl font-bold" onClick={() => setShowExtractionConfirm(false)}>Cancel</Button>
                  <Button className="rounded-xl font-bold px-8 shadow-lg shadow-primary/20" onClick={handleApplyExtraction}>Apply to My Profile</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {!file ? (
              <Card className="border-none shadow-sm flex flex-col items-center justify-center p-24 text-center bg-white rounded-[3rem]">
                <div className="bg-slate-50 p-10 rounded-[2.5rem] mb-8 shadow-inner border border-slate-100">
                  <FileText className="h-16 w-16 text-primary/40" />
                </div>
                <CardTitle className="mb-4 text-3xl font-black tracking-tighter">No Document Ready</CardTitle>
                <CardDescription className="max-w-sm mx-auto mb-10 text-lg leading-relaxed">
                  Import a PDF, Image, Word, or Text document to start your professional workflow. Use AI to detect fields and automate your paperwork.
                </CardDescription>
                <label 
                  htmlFor="document-upload" 
                  className="inline-flex items-center justify-center rounded-2xl bg-primary text-primary-foreground px-12 py-4 text-lg font-bold hover:bg-primary/90 cursor-pointer transition-all shadow-xl shadow-primary/20 active:scale-95"
                >
                  Select File
                </label>
              </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <Card className="lg:col-span-9 overflow-hidden bg-slate-900 flex flex-col items-center p-6 rounded-[2.5rem] shadow-2xl border-none min-h-[85vh]">
                <div className="w-full flex items-center justify-between mb-6 text-white/70">
                  <div className="flex items-center gap-4 bg-white/5 p-1 rounded-2xl border border-white/10">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      disabled={currentPage <= 1}
                      onClick={() => setCurrentPage(prev => prev - 1)}
                      className="text-white hover:bg-white/10 rounded-xl"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <span className="text-sm font-black tracking-widest uppercase">
                      Page {currentPage} / {numPages}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      disabled={currentPage >= numPages}
                      onClick={() => setCurrentPage(prev => prev + 1)}
                      className="text-white hover:bg-white/10 rounded-xl"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                  </div>
                  <div className="flex gap-3">
                    <div className="flex items-center bg-white/5 rounded-xl p-1 border border-white/10">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-white hover:bg-white/10"
                        onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
                      >
                        <ZoomOut className="h-4 w-4" />
                      </Button>
                      <span className="text-[10px] font-black w-14 text-center uppercase tracking-widest text-white">
                        {Math.round(zoom * 100)}%
                      </span>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-white hover:bg-white/10"
                        onClick={() => setZoom(prev => Math.min(3, prev + 0.1))}
                      >
                        <ZoomIn className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                  <div className="relative bg-white shadow-2xl rounded-xl overflow-auto max-h-[75vh] w-full flex justify-center border-8 border-slate-800">
                    {loading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white/50 z-10 backdrop-blur-sm">
                        <Loader2 className="h-10 w-10 animate-spin text-primary" />
                      </div>
                    )}

                    <div ref={editorRef} className="relative inline-block">
                      {pdfDoc ? (
                        <canvas ref={canvasRef} className="max-w-full h-auto" />
                      ) : imageUrl ? (
                        <img src={imageUrl} alt="Uploaded document" className="max-w-full h-auto" />
                      ) : baseContent ? (
                        <div 
                          className="bg-white p-12 text-slate-900 overflow-auto text-left" 
                          style={{ 
                            width: '800px', 
                            height: '1100px', 
                            maxWidth: '100%',
                            zoom: zoom 
                          }} 
                        >
                          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                            {baseContent}
                          </pre>
                        </div>
                      ) : elements.length > 0 ? (
                        <div 
                          className="bg-white shadow-sm" 
                          style={{ 
                            width: '800px', 
                            height: '1100px', 
                            maxWidth: '100%',
                            zoom: zoom 
                          }} 
                        />
                      ) : (
                        <div className="p-12 text-slate-400 font-bold uppercase tracking-widest text-xs flex flex-col items-center gap-4">
                          <FileText className="h-12 w-12 opacity-20" />
                          <span>No background rendering available. Use AI to extract text fields.</span>
                        </div>
                      )}

                      {/* Element Overlay */}
                      {elements.map((el) => (
                        <motion.div
                          key={el.id}
                          drag
                          dragMomentum={false}
                          dragConstraints={editorRef}
                          onDragEnd={(_, info) => {
                            const rect = editorRef.current?.getBoundingClientRect();
                            if (rect) {
                              // Approximate percentage update
                              const newX = el.x + (info.offset.x / rect.width) * 100;
                              const newY = el.y + (info.offset.y / rect.height) * 100;
                              updateElement(el.id, { x: newX, y: newY });
                            }
                          }}
                          onClick={() => setSelectedElementId(el.id)}
                          style={{
                            position: 'absolute',
                            left: `${el.x}%`,
                            top: `${el.y}%`,
                            cursor: 'move',
                            zIndex: 20,
                          }}
                          className={cn(
                            "group",
                            selectedElementId === el.id && "ring-2 ring-primary ring-offset-2 rounded-sm"
                          )}
                        >
                          {el.type === 'text' ? (
                            <div className="relative">
                               <input 
                                value={el.content}
                                onChange={(e) => updateElement(el.id, { content: e.target.value })}
                                style={{
                                  fontSize: `${el.fontSize}px`,
                                  fontWeight: el.fontWeight,
                                  fontStyle: el.fontStyle,
                                  letterSpacing: `${el.letterSpacing}px`,
                                  lineHeight: el.lineHeight,
                                  background: 'transparent',
                                  border: 'none',
                                  outline: 'none',
                                  color: 'black',
                                  fontFamily: 'inherit',
                                  width: 'auto',
                                  minWidth: '20px'
                                }}
                                className="focus:bg-primary/5 p-1 rounded transition-colors text-slate-900"
                              />
                              <Button 
                                variant="destructive" 
                                size="icon" 
                                className="h-5 w-5 absolute -top-6 -right-6 hidden group-hover:flex" 
                                onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ) : (
                            <div className="relative group">
                              <img 
                                src={el.content} 
                                alt="Signature" 
                                draggable={false}
                                style={{ width: el.width, height: el.height }}
                                className="object-contain pointer-events-none"
                              />
                               <Button 
                                variant="destructive" 
                                size="icon" 
                                className="h-6 w-6 absolute -top-8 -right-8 hidden group-hover:flex" 
                                onClick={(e) => { e.stopPropagation(); removeElement(el.id); }}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </div>
              </Card>

              <div className="lg:col-span-3 space-y-6">
                {/* Spacing & Style Editor (Only shown when a text element is selected) */}
                {selectedElementId && elements.find(e => e.id === selectedElementId)?.type === 'text' && (
                  <Card className="border-none shadow-xl bg-slate-900 text-white rounded-[2rem] overflow-hidden">
                    <CardHeader className="p-6 border-b border-white/10">
                      <CardTitle className="text-sm font-black uppercase tracking-widest text-primary font-mono flex items-center gap-2">
                        <TypeIcon className="h-4 w-4" />
                        Text Controller
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          variant={elements.find(e => e.id === selectedElementId)?.fontWeight === 'bold' ? 'secondary' : 'outline'}
                          className="flex-1 rounded-xl font-black text-xs h-10 border-white/10"
                          onClick={() => {
                            const current = elements.find(e => e.id === selectedElementId)?.fontWeight;
                            updateElement(selectedElementId, { fontWeight: current === 'bold' ? 'normal' : 'bold' });
                          }}
                        >
                          <Bold className="h-4 w-4 mr-1" />
                          Bold
                        </Button>
                        <Button 
                          size="sm" 
                          variant={elements.find(e => e.id === selectedElementId)?.fontStyle === 'italic' ? 'secondary' : 'outline'}
                          className="flex-1 rounded-xl font-black text-xs h-10 border-white/10"
                          onClick={() => {
                            const current = elements.find(e => e.id === selectedElementId)?.fontStyle;
                            updateElement(selectedElementId, { fontStyle: current === 'italic' ? 'normal' : 'italic' });
                          }}
                        >
                          <Italic className="h-4 w-4 mr-1" />
                          Italic
                        </Button>
                        <Button 
                          size="sm" 
                          variant="destructive"
                          className="rounded-xl font-black text-xs h-10"
                          onClick={() => removeElement(selectedElementId)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                          <span>Font Size</span>
                          <span className="text-white">{elements.find(e => e.id === selectedElementId)?.fontSize}px</span>
                        </div>
                        <input 
                          type="range" min="8" max="72" 
                          value={elements.find(e => e.id === selectedElementId)?.fontSize || 16}
                          onChange={(e) => updateElement(selectedElementId, { fontSize: parseInt(e.target.value) })}
                          className="w-full accent-primary bg-white/10 h-1 rounded-full appearance-none"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                          <span>Letter Spacing</span>
                          <span className="text-white">{elements.find(e => e.id === selectedElementId)?.letterSpacing}px</span>
                        </div>
                        <input 
                          type="range" min="-5" max="20" step="0.5"
                          value={elements.find(e => e.id === selectedElementId)?.letterSpacing || 0}
                          onChange={(e) => updateElement(selectedElementId, { letterSpacing: parseFloat(e.target.value) })}
                          className="w-full accent-primary bg-white/10 h-1 rounded-full appearance-none"
                        />
                      </div>
                      <div className="space-y-3">
                        <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/40">
                          <span>Line Height</span>
                          <span className="text-white">{elements.find(e => e.id === selectedElementId)?.lineHeight}</span>
                        </div>
                        <input 
                          type="range" min="0.5" max="3" step="0.1" 
                          value={elements.find(e => e.id === selectedElementId)?.lineHeight || 1.2}
                          onChange={(e) => updateElement(selectedElementId, { lineHeight: parseFloat(e.target.value) })}
                          className="w-full accent-primary bg-white/10 h-1 rounded-full appearance-none"
                        />
                      </div>
                      <Button variant="ghost" className="w-full text-white/60 hover:text-white hover:bg-white/5 rounded-xl text-xs font-black uppercase tracking-widest" onClick={() => setSelectedElementId(null)}>
                        Done Editing
                      </Button>
                    </CardContent>
                  </Card>
                )}

                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">AI Intelligence</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    <Button 
                      className="w-full h-14 justify-start rounded-2xl font-bold text-base shadow-lg shadow-primary/10" 
                      onClick={handleAiAutoFill}
                      disabled={isAiProcessing}
                    >
                      {isAiProcessing ? <Loader2 className="mr-3 h-5 w-5 animate-spin" /> : <Sparkles className="mr-3 h-5 w-5" />}
                      AI Auto-fill
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-14 justify-start rounded-2xl font-bold text-base border-slate-200"
                      onClick={async () => {
                        const q = prompt("What would you like the AI to solve or analyze on this document?");
                        if (!q) return;
                        setIsAiProcessing(true);
                        try {
                           // Reuse logic from handleAiAutoFill but for a general query
                           let dataUrl = '';
                           if (canvasRef.current) {
                             dataUrl = canvasRef.current.toDataURL('image/png').split(',')[1];
                           } else if (imageUrl) {
                             const resp = await fetch(imageUrl);
                             const blob = await resp.blob();
                             dataUrl = await new Promise((resolve) => {
                               const reader = new FileReader();
                               reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
                               reader.readAsDataURL(blob);
                             });
                           }

                           const promptText = `Based on this document, answer the following request: ${q}`;
                           const contents = dataUrl ? [
                             {
                               parts: [
                                 { text: promptText },
                                 { inlineData: { mimeType: "image/png", data: dataUrl } }
                               ]
                             }
                           ] : [
                             {
                               parts: [
                                 { text: promptText + "\n\nDOCUMENT CONTENT:\n" + (baseContent || elements.map(el => el.content).join('\n')) }
                               ]
                             }
                           ];

                           const result = await ai.models.generateContent({
                             model: MODELS.flash,
                             contents
                           });
                           alert(result.text);
                        } finally {
                          setIsAiProcessing(false);
                        }
                      }}
                    >
                      <Search className="mr-3 h-5 w-5 text-primary" />
                      AI Solver
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white rounded-3xl overflow-hidden">
                  <CardHeader className="bg-slate-50/50 border-b border-slate-100">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Professional Tools</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 space-y-3">
                    <Button variant="outline" className="w-full h-14 justify-start rounded-2xl font-bold text-base border-slate-200" onClick={addText}>
                      <TypeIcon className="mr-3 h-5 w-5 text-primary" />
                      Add Text
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-14 justify-start rounded-2xl font-bold text-base border-slate-200 relative group"
                      onClick={() => setIsSignatureModalOpen(true)}
                    >
                      <PenTool className="mr-3 h-5 w-5 text-primary" />
                      Add Signature
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full h-14 justify-start rounded-2xl font-bold text-base border-slate-200 relative group"
                      onClick={() => setShowScanEdit(true)}
                    >
                      <ScanLine className="mr-3 h-5 w-5 text-primary" />
                      Scan & Edit Text
                    </Button>
                  </CardContent>
                </Card>

                <SignatureManager 
                  isOpen={isSignatureModalOpen}
                  onClose={() => setIsSignatureModalOpen(false)}
                  onConfirm={handleAddSignature}
                />

                <Dialog open={showScanEdit} onOpenChange={setShowScanEdit}>
                  <DialogContent className="max-w-4xl h-[80vh] flex flex-col p-0 overflow-hidden border-none rounded-[2.5rem] shadow-2xl">
                    <DialogHeader className="p-8 bg-slate-900 text-white shrink-0">
                       <div className="flex items-center justify-between">
                         <div>
                            <DialogTitle className="text-2xl font-black tracking-tight flex items-center gap-2">
                               <ScanLine className="h-6 w-6 text-primary" />
                               Document Scan & Edit
                            </DialogTitle>
                            <p className="text-white/60 font-medium text-sm">Extract textual content and refine it directly. Changes here will update the base document text.</p>
                         </div>
                         <Button variant="ghost" className="text-white/40 hover:text-white" onClick={() => setShowScanEdit(false)}>
                            <X className="h-6 w-6" />
                         </Button>
                       </div>
                    </DialogHeader>
                    <div className="flex-1 p-8 bg-white overflow-hidden flex flex-col gap-6">
                       <div className="flex-1 bg-slate-50 rounded-3xl border-2 border-slate-100 p-6 flex flex-col">
                          <textarea
                            className="flex-1 w-full bg-transparent resize-none focus:outline-none font-mono text-sm leading-relaxed text-slate-700"
                            value={baseContent || ''}
                            onChange={(e) => setBaseContent(e.target.value)}
                            placeholder="Scanning document content..."
                          />
                       </div>
                       <div className="flex justify-end gap-3 shrink-0">
                          <Button variant="outline" className="rounded-2xl font-bold h-12" onClick={() => setShowScanEdit(false)}>Discard</Button>
                          <Button className="rounded-2xl font-bold h-12 px-8" onClick={() => setShowScanEdit(false)}>Apply Changes</Button>
                       </div>
                    </div>
                  </DialogContent>
                </Dialog>

                <Card className="border-none shadow-sm bg-slate-900 text-white rounded-3xl overflow-hidden">
                  <CardHeader className="border-b border-white/10">
                    <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-white/40">Document Info</CardTitle>
                  </CardHeader>
                  <CardContent className="p-6 text-sm space-y-3 font-medium">
                    <div className="flex justify-between">
                      <span className="text-white/40">Name</span>
                      <span className="truncate max-w-[120px]">{file.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Size</span>
                      <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/40">Pages</span>
                      <span>{numPages}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
