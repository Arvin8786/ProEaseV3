import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  UploadCloud, 
  FileText, 
  Eye, 
  Download, 
  Share2, 
  Trash2, 
  Plus, 
  Search, 
  Filter, 
  Calendar, 
  Building2, 
  X, 
  MessageSquare, 
  Mail, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  ShieldCheck,
  Send,
  FileCheck2,
  FolderLock,
  Printer,
  PenTool
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  UploadedDocument, 
  UploadedDocCategory, 
  UserProfile 
} from '@/types';
import { 
  getUploadedDocs, 
  saveUploadedDoc, 
  deleteUploadedDoc, 
  downloadUploadedDocFile, 
  shareUploadedDoc,
  CATEGORY_LABELS,
  CATEGORY_COLORS
} from '@/lib/uploadedDocsStorage';
import { cn } from '@/lib/utils';
import { UploadedDocumentEditor } from './UploadedDocumentEditor';

interface UploadedDocumentsVaultProps {
  profile: UserProfile | null;
  onDocCountChange?: (count: number) => void;
}

export function UploadedDocumentsVault({ profile, onDocCountChange }: UploadedDocumentsVaultProps) {
  const [docs, setDocs] = useState<UploadedDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | UploadedDocCategory>('all');
  const [docToEdit, setDocToEdit] = useState<UploadedDocument | null>(null);
  
  // Upload modal state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  
  // Upload form fields
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [docCategory, setDocCategory] = useState<UploadedDocCategory>('offer_letter');
  const [docTitle, setDocTitle] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [issueDate, setIssueDate] = useState('');
  const [docDescription, setDocDescription] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview & Delete state
  const [activePreviewDoc, setActivePreviewDoc] = useState<UploadedDocument | null>(null);
  const [docToDelete, setDocToDelete] = useState<UploadedDocument | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load uploaded documents on mount or profile change
  useEffect(() => {
    let isMounted = true;
    async function loadDocuments() {
      if (!profile?.uid) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const loaded = await getUploadedDocs(profile.uid);
        if (isMounted) {
          setDocs(loaded);
          onDocCountChange?.(loaded.length);
        }
      } catch (err) {
        console.error("Failed to load uploaded documents:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }
    loadDocuments();
    return () => { isMounted = false; };
  }, [profile?.uid]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return docs.filter(doc => {
      const matchesCategory = categoryFilter === 'all' || doc.category === categoryFilter;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;

      const titleMatch = doc.title?.toLowerCase().includes(query);
      const companyMatch = doc.companyName?.toLowerCase().includes(query);
      const fileMatch = doc.fileName?.toLowerCase().includes(query);
      const descMatch = doc.description?.toLowerCase().includes(query);
      return matchesCategory && (titleMatch || companyMatch || fileMatch || descMatch);
    });
  }, [docs, categoryFilter, searchQuery]);

  // Handle file selection
  const handleFileChange = (file: File) => {
    setUploadError(null);
    // 8MB limit for Firestore Base64 encoding safety
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("File size exceeds 8MB limit. Please upload a compressed PDF or image.");
      return;
    }

    setFileToUpload(file);
    // Automatically set a sensible title if empty
    if (!docTitle) {
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      setDocTitle(cleanName.charAt(0).toUpperCase() + cleanName.slice(1));
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  // Convert file to Base64 data URL
  const fileToDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Submit upload
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.uid) {
      setUploadError("You must be logged in to upload documents.");
      return;
    }
    if (!fileToUpload) {
      setUploadError("Please select a document file to upload.");
      return;
    }
    if (!docTitle.trim()) {
      setUploadError("Please provide a title for this document.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);

    try {
      const fileData = await fileToDataURL(fileToUpload);
      const newDocId = await saveUploadedDoc(profile.uid, {
        userId: profile.uid,
        category: docCategory,
        title: docTitle.trim(),
        description: docDescription.trim(),
        fileName: fileToUpload.name,
        fileSize: fileToUpload.size,
        fileType: fileToUpload.type || 'application/octet-stream',
        fileData,
        companyName: companyName.trim(),
        issueDate: issueDate.trim(),
      });

      // Reload list
      const updated = await getUploadedDocs(profile.uid);
      setDocs(updated);
      onDocCountChange?.(updated.length);

      // Reset modal
      setIsUploadModalOpen(false);
      setFileToUpload(null);
      setDocTitle('');
      setCompanyName('');
      setIssueDate('');
      setDocDescription('');
      setDocCategory('offer_letter');
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(err.message || "Failed to upload document to cloud storage.");
    } finally {
      setIsUploading(false);
    }
  };

  // Delete document
  const handleConfirmDelete = async () => {
    if (!docToDelete || !profile?.uid) return;
    setIsDeleting(true);
    try {
      await deleteUploadedDoc(profile.uid, docToDelete.id);
      const updated = docs.filter(d => d.id !== docToDelete.id);
      setDocs(updated);
      onDocCountChange?.(updated.length);
      setDocToDelete(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setIsDeleting(false);
    }
  };

  // Direct share handler
  const handleShare = async (doc: UploadedDocument, platform: 'whatsapp' | 'email' | 'telegram' | 'native' | 'copy') => {
    const res = await shareUploadedDoc(doc, platform);
    if (platform === 'copy' && res.success) {
      setCopiedId(doc.id);
      setTimeout(() => setCopiedId(null), 2500);
    }
  };

  // Format file size
  const formatFileSize = (bytes: number): string => {
    if (!bytes || bytes === 0) return '0 KB';
    const kb = bytes / 1024;
    if (kb < 1024) return `${Math.round(kb)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-8" id="uploaded-documents-vault">
      {/* Top Banner & Action */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-8 sm:p-10 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-10 -translate-y-10 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/15 text-xs font-bold tracking-wider uppercase backdrop-blur-md">
              <FolderLock className="h-3.5 w-3.5 text-primary" />
              Secure Career Document Vault
            </div>
            <h2 className="text-3xl sm:text-4xl font-heading font-black tracking-tight text-white">
              Important Career Documents
            </h2>
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed">
              Upload your Offer Letters, Payslips, Employment Contracts, and Certifications. All documents are safely preserved in your private cloud, accessible anytime for instant download or 1-tap WhatsApp sharing without using AI quotas.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
            <Button 
              size="lg"
              className="rounded-2xl font-bold bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25 h-13 px-6 gap-2"
              onClick={() => setIsUploadModalOpen(true)}
            >
              <Plus className="h-5 w-5" />
              Upload Document
            </Button>
          </div>
        </div>

        {/* Quick Vault Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-8 border-t border-white/10">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Vault Docs</p>
            <p className="text-2xl font-black text-white mt-1">{docs.length}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Offer Letters</p>
            <p className="text-2xl font-black text-emerald-400 mt-1">
              {docs.filter(d => d.category === 'offer_letter').length}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Payslips</p>
            <p className="text-2xl font-black text-blue-400 mt-1">
              {docs.filter(d => d.category === 'payslip').length}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Contracts & Certs</p>
            <p className="text-2xl font-black text-purple-400 mt-1">
              {docs.filter(d => ['employment_contract', 'education_cert'].includes(d.category)).length}
            </p>
          </div>
        </div>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center">
          {/* Search Bar */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Search by title, company, or file name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 rounded-2xl bg-white border-slate-200 text-sm shadow-sm"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="text-xs font-bold text-slate-500 flex items-center gap-2 self-end sm:self-center">
            <span>Showing {filteredDocs.length} of {docs.length} documents</span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          <Button
            size="sm"
            variant={categoryFilter === 'all' ? 'default' : 'outline'}
            className={cn(
              "rounded-full text-xs font-bold shrink-0 h-8",
              categoryFilter === 'all' 
                ? "bg-slate-900 text-white" 
                : "border-slate-200 text-slate-600 hover:bg-slate-100"
            )}
            onClick={() => setCategoryFilter('all')}
          >
            All Vault Files ({docs.length})
          </Button>

          {(Object.keys(CATEGORY_LABELS) as UploadedDocCategory[]).map(cat => {
            const count = docs.filter(d => d.category === cat).length;
            const isSelected = categoryFilter === cat;
            return (
              <Button
                key={cat}
                size="sm"
                variant={isSelected ? 'default' : 'outline'}
                className={cn(
                  "rounded-full text-xs font-bold shrink-0 h-8",
                  isSelected 
                    ? "bg-primary text-white" 
                    : "border-slate-200 text-slate-600 hover:bg-slate-100"
                )}
                onClick={() => setCategoryFilter(cat)}
              >
                {CATEGORY_LABELS[cat]} {count > 0 && `(${count})`}
              </Button>
            );
          })}
        </div>
      </div>

      {/* Document Grid / Empty States */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center p-16 bg-white rounded-3xl border border-slate-100">
          <Loader2 className="h-8 w-8 text-primary animate-spin mb-3" />
          <p className="text-slate-600 font-semibold text-sm">Loading your private document vault...</p>
        </div>
      ) : filteredDocs.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center p-14 bg-white rounded-3xl border-2 border-dashed border-slate-200">
          <div className="bg-slate-100 p-4 rounded-full mb-4 text-slate-400">
            <UploadCloud className="h-8 w-8" />
          </div>
          <h3 className="font-heading font-bold text-lg text-slate-800">
            {searchQuery || categoryFilter !== 'all' ? 'No matching documents found' : 'No documents uploaded yet'}
          </h3>
          <p className="text-sm text-slate-500 max-w-md mt-1 mb-6">
            {searchQuery || categoryFilter !== 'all' 
              ? 'Try changing your search keywords or switching category filters.'
              : 'Safely store your Offer Letters, Salary Payslips, and Certificates here. They can be downloaded or shared to WhatsApp anytime.'}
          </p>
          <Button 
            className="rounded-2xl font-bold bg-primary text-white"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" /> Upload First Document
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence>
            {filteredDocs.map((docItem) => {
              const colors = CATEGORY_COLORS[docItem.category] || CATEGORY_COLORS.other;
              const isPdf = docItem.fileType.includes('pdf') || docItem.fileName.toLowerCase().endsWith('.pdf');
              const isImage = docItem.fileType.startsWith('image/');

              return (
                <motion.div
                  key={docItem.id}
                  initial={{ opacity: 0, scale: 0.95, y: 15 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  whileHover={{ y: -3 }}
                  className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200/80 hover:shadow-md hover:border-primary/40 transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="space-y-4">
                    {/* Top Row: Category Badge & Format */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full border",
                        colors.bg, colors.text, colors.border
                      )}>
                        {CATEGORY_LABELS[docItem.category]}
                      </span>
                      <span className="text-[10px] font-mono font-bold uppercase text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                        {isPdf ? 'PDF' : isImage ? 'IMAGE' : 'DOC'} • {formatFileSize(docItem.fileSize)}
                      </span>
                    </div>

                    {/* Main Title & Details */}
                    <div>
                      <h4 className="font-heading font-bold text-lg text-slate-900 line-clamp-1 group-hover:text-primary transition-colors">
                        {docItem.title}
                      </h4>
                      {docItem.companyName && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold mt-1">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{docItem.companyName}</span>
                        </div>
                      )}
                      {docItem.issueDate && (
                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Dated: {docItem.issueDate}</span>
                        </div>
                      )}
                      {docItem.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 mt-2 bg-slate-50 p-2 rounded-xl">
                          {docItem.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Bottom Action Section */}
                  <div className="pt-4 mt-4 border-t border-slate-100 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Edit & Sign Button */}
                      <Button
                        size="sm"
                        className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs h-9 gap-1.5 shadow-sm"
                        onClick={() => setDocToEdit(docItem)}
                        title="Edit document, add signature, text, or push profile details"
                      >
                        <PenTool className="h-3.5 w-3.5" /> Edit & Sign
                      </Button>

                      {/* View Button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl font-bold border-slate-200 text-slate-800 hover:bg-slate-100 text-xs h-9 gap-1.5"
                        onClick={() => setActivePreviewDoc(docItem)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Download Button (Zero API) */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-xl font-bold border-slate-200 text-slate-700 hover:bg-slate-100 text-xs h-8 flex-1 gap-1.5"
                        onClick={() => downloadUploadedDocFile(docItem)}
                        title="Download original file directly from cloud"
                      >
                        <Download className="h-3.5 w-3.5 text-slate-600" />
                        <span>Download</span>
                      </Button>

                      {/* WhatsApp Share Button */}
                      <Button
                        size="sm"
                        className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 flex-1 gap-1.5"
                        onClick={() => handleShare(docItem, 'whatsapp')}
                        title="Share directly to WhatsApp"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        <span>WhatsApp</span>
                      </Button>
                    </div>

                    {/* Secondary Actions: Native Share, Copy, and Delete */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleShare(docItem, 'native')}
                          className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                          title="Share to social apps"
                        >
                          <Share2 className="h-3 w-3" /> More Share
                        </button>
                        <span>•</span>
                        <button
                          onClick={() => handleShare(docItem, 'copy')}
                          className="hover:text-primary transition-colors flex items-center gap-1 font-semibold"
                          title="Copy document details"
                        >
                          {copiedId === docItem.id ? (
                            <>
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" /> Copy
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={() => setDocToDelete(docItem)}
                        className="text-slate-400 hover:text-red-600 transition-colors p-1"
                        title="Delete from Vault"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Upload Document Modal */}
      <Dialog open={isUploadModalOpen} onOpenChange={(open) => !open && setIsUploadModalOpen(false)}>
        <DialogContent className="sm:max-w-[550px] rounded-[2rem] p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black font-heading tracking-tight flex items-center gap-2.5">
              <UploadCloud className="h-6 w-6 text-primary" />
              Upload Career Document
            </DialogTitle>
            <DialogDescription>
              Upload an important document (Offer Letter, Payslip, Contract, Certificate). It is stored securely in your private cloud and can be accessed or shared anytime.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleUploadSubmit} className="space-y-5 pt-3">
            {uploadError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-2.5 text-xs text-red-700 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Drag & Drop File Zone */}
            <div 
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-3xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-3",
                isDragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-slate-200 bg-slate-50/50 hover:bg-slate-50 hover:border-slate-300",
                fileToUpload && "border-emerald-400 bg-emerald-50/30"
              )}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])} 
                accept=".pdf,.png,.jpg,.jpeg,.webp,.docx,.txt"
                className="hidden" 
              />
              {fileToUpload ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700">
                    <FileCheck2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">{fileToUpload.name}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">{formatFileSize(fileToUpload.size)}</p>
                  </div>
                  <span className="text-[11px] text-emerald-700 font-semibold underline">Click to change file</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="bg-primary/10 p-3 rounded-2xl text-primary">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-800 text-sm">Click to upload or drag & drop</p>
                    <p className="text-xs text-slate-500 mt-1">Supports PDF, PNG, JPG, DOCX, TXT (Max 8MB)</p>
                  </div>
                </div>
              )}
            </div>

            {/* Document Category */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Document Type / Category *</Label>
              <Select value={docCategory} onValueChange={(val: UploadedDocCategory) => setDocCategory(val)}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue placeholder="Select document type" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(CATEGORY_LABELS) as UploadedDocCategory[]).map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {CATEGORY_LABELS[cat]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Document Title *</Label>
              <Input
                placeholder="e.g. Maybank Senior Engineer Offer Letter, Jan 2026 Payslip"
                value={docTitle}
                onChange={(e) => setDocTitle(e.target.value)}
                required
                className="h-12 rounded-xl"
              />
            </div>

            {/* Company & Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Company / Organization</Label>
                <Input
                  placeholder="e.g. Maybank, Grab, Intel"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Issue / Document Date</Label>
                <Input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="h-12 rounded-xl"
                />
              </div>
            </div>

            {/* Optional Notes */}
            <div className="space-y-2">
              <Label className="text-xs font-black uppercase tracking-wider text-slate-500">Notes / Remarks (Optional)</Label>
              <Textarea
                placeholder="Add any reminders, reference numbers, or context..."
                value={docDescription}
                onChange={(e) => setDocDescription(e.target.value)}
                rows={2}
                className="rounded-xl resize-none text-sm"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl font-bold"
                onClick={() => setIsUploadModalOpen(false)}
                disabled={isUploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white min-w-[140px] h-12"
                disabled={isUploading || !fileToUpload || !docTitle.trim()}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Saving to Cloud...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Save to Vault
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview In-App Document Modal */}
      <Dialog open={!!activePreviewDoc} onOpenChange={(open) => !open && setActivePreviewDoc(null)}>
        <DialogContent className="sm:max-w-[850px] max-h-[92vh] rounded-[2rem] p-6 flex flex-col">
          {activePreviewDoc && (
            <>
              <DialogHeader className="border-b border-slate-100 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <DialogTitle className="text-xl font-bold text-slate-900">
                      {activePreviewDoc.title}
                    </DialogTitle>
                    <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 font-medium">
                      <span>{CATEGORY_LABELS[activePreviewDoc.category]}</span>
                      {activePreviewDoc.companyName && (
                        <>
                          <span>•</span>
                          <span>{activePreviewDoc.companyName}</span>
                        </>
                      )}
                      <span>•</span>
                      <span>{formatFileSize(activePreviewDoc.fileSize)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      className="rounded-xl font-bold bg-primary hover:bg-primary/90 text-white text-xs h-9 px-3 gap-1.5 shadow-sm"
                      onClick={() => {
                        const target = activePreviewDoc;
                        setActivePreviewDoc(null);
                        setDocToEdit(target);
                      }}
                      title="Edit this document, sign, add text, or push profile details"
                    >
                      <PenTool className="h-3.5 w-3.5" /> Edit & Sign
                    </Button>
                    <Button
                      size="sm"
                      className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9 px-3 gap-1.5"
                      onClick={() => handleShare(activePreviewDoc, 'whatsapp')}
                    >
                      <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-xl font-bold border-slate-200 text-slate-700 text-xs h-9 px-3 gap-1.5"
                      onClick={() => downloadUploadedDocFile(activePreviewDoc)}
                    >
                      <Download className="h-3.5 w-3.5" /> Download
                    </Button>
                  </div>
                </div>
              </DialogHeader>

              {/* Viewer Body */}
              <div className="flex-1 overflow-auto my-4 bg-slate-100 rounded-2xl p-2 min-h-[420px] flex items-center justify-center">
                {activePreviewDoc.fileType.startsWith('image/') ? (
                  <img 
                    src={activePreviewDoc.fileData} 
                    alt={activePreviewDoc.title} 
                    className="max-h-[70vh] w-auto object-contain rounded-xl shadow"
                  />
                ) : activePreviewDoc.fileType.includes('pdf') || activePreviewDoc.fileName.toLowerCase().endsWith('.pdf') ? (
                  <iframe 
                    src={activePreviewDoc.fileData} 
                    title={activePreviewDoc.title}
                    className="w-full h-[65vh] rounded-xl bg-white border-0 shadow"
                  />
                ) : (
                  <div className="text-center p-8 bg-white rounded-2xl shadow max-w-md">
                    <FileText className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                    <p className="font-bold text-slate-800 text-base">{activePreviewDoc.fileName}</p>
                    <p className="text-xs text-slate-500 mt-1 mb-4">Preview not directly embeddable for this file format.</p>
                    <Button 
                      className="rounded-xl font-bold bg-primary text-white"
                      onClick={() => downloadUploadedDocFile(activePreviewDoc)}
                    >
                      <Download className="h-4 w-4 mr-2" /> Download Document
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="border-t border-slate-100 pt-3 flex flex-row items-center justify-between">
                <p className="text-xs text-slate-400 font-medium">
                  Stored securely in cloud • Zero AI API key usage
                </p>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="rounded-xl font-bold text-xs" 
                  onClick={() => setActivePreviewDoc(null)}
                >
                  Close Viewer
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!docToDelete} onOpenChange={(open) => !open && setDocToDelete(null)}>
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] p-6">
          <DialogHeader>
            <div className="bg-red-100 text-red-600 p-3 rounded-2xl w-fit mb-2">
              <Trash2 className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-bold text-slate-900">
              Delete Document?
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{docToDelete?.title}"</span>? This will permanently remove it from your private cloud vault.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="pt-4 gap-2">
            <Button
              variant="outline"
              className="rounded-xl font-bold"
              onClick={() => setDocToDelete(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="rounded-xl font-bold bg-red-600 hover:bg-red-700 text-white"
              onClick={handleConfirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : null}
              Permanently Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Interactive Document Editor & Sign Studio */}
      <UploadedDocumentEditor
        isOpen={!!docToEdit}
        onClose={() => setDocToEdit(null)}
        document={docToEdit}
        profile={profile}
        onSaveSuccess={(updatedDoc) => {
          setDocs(prev => prev.map(d => d.id === updatedDoc.id ? updatedDoc : d));
          setDocToEdit(updatedDoc);
        }}
      />
    </div>
  );
}
