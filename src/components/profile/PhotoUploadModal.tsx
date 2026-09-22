import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Link as LinkIcon, Camera, Loader2, Check, AlertCircle, Trash2 } from 'lucide-react';
import { updateLocalProfileField } from '@/lib/profileStorage';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  currentPhotoURL?: string;
  onPhotoUpdated?: (newUrl: string) => void;
}

export function PhotoUploadModal({
  isOpen,
  onClose,
  uid,
  currentPhotoURL,
  onPhotoUpdated
}: PhotoUploadModalProps) {
  const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
  const [urlInput, setUrlInput] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset states when opened
  React.useEffect(() => {
    if (isOpen) {
      setPreviewUrl(currentPhotoURL || null);
      setUrlInput('');
      setError(null);
      setIsProcessing(false);
    }
  }, [isOpen, currentPhotoURL]);

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file (JPG, PNG, WebP).');
      return;
    }

    setError(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          // Resize & compress to max 400x400 to prevent large Firestore documents
          const canvas = document.createElement('canvas');
          const maxDim = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
          } else {
            if (height > maxDim) {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            setPreviewUrl(compressedBase64);
          } else {
            setPreviewUrl(e.target?.result as string);
          }
        } catch (err) {
          console.warn("Canvas compression failed, using direct data URL", err);
          setPreviewUrl(e.target?.result as string);
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setError('Failed to process image file. Please try another image.');
        setIsProcessing(false);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleApplyUrl = () => {
    if (!urlInput.trim()) {
      setError('Please enter a valid image URL.');
      return;
    }
    setError(null);
    setPreviewUrl(urlInput.trim());
  };

  const handleSavePhoto = async () => {
    if (!uid) return;
    setIsProcessing(true);
    setError(null);

    const finalPhoto = previewUrl || '';

    try {
      // 1. Update local profile storage immediately
      await updateLocalProfileField(uid, {
        photoURL: finalPhoto,
        updatedAt: new Date()
      });

      // 2. Directly sync to Firestore users collection
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        photoURL: finalPhoto,
        updatedAt: new Date()
      });

      // 3. Trigger callback if supplied
      if (onPhotoUpdated) {
        onPhotoUpdated(finalPhoto);
      }

      // 4. Close modal
      onClose();
    } catch (err: any) {
      console.error("Failed to save profile photo:", err);
      setError(err?.message || "Failed to update profile photo in cloud database.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemovePhoto = async () => {
    setPreviewUrl('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6 bg-white rounded-3xl border border-slate-200 shadow-2xl">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
            <Camera className="h-6 w-6 text-primary" />
            Update Profile Photo
          </DialogTitle>
          <p className="text-sm text-slate-500 font-medium">
            Upload an image from your device or specify an image URL.
          </p>
        </DialogHeader>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Live Preview */}
        <div className="flex flex-col items-center justify-center my-4">
          <div className="relative group">
            <div className="h-32 w-32 rounded-3xl bg-slate-100 border-4 border-slate-100 shadow-md overflow-hidden flex items-center justify-center">
              {previewUrl ? (
                <img 
                  src={previewUrl} 
                  alt="Preview" 
                  className="h-full w-full object-cover" 
                  referrerPolicy="no-referrer" 
                />
              ) : (
                <Camera className="h-12 w-12 text-slate-300" />
              )}
            </div>
            {previewUrl && (
              <Button
                size="icon"
                variant="destructive"
                className="absolute -top-2 -right-2 h-7 w-7 rounded-full shadow-md"
                onClick={handleRemovePhoto}
                title="Remove photo"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mt-2">
            Photo Preview
          </p>
        </div>

        {/* Tabs: Upload File vs Web URL */}
        <div className="flex bg-slate-100 p-1 rounded-2xl gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`flex-1 rounded-xl font-bold text-xs ${activeTab === 'upload' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            onClick={() => setActiveTab('upload')}
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            Upload File
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className={`flex-1 rounded-xl font-bold text-xs ${activeTab === 'url' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500'}`}
            onClick={() => setActiveTab('url')}
          >
            <LinkIcon className="h-3.5 w-3.5 mr-1.5" />
            Image URL
          </Button>
        </div>

        {activeTab === 'upload' ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-primary/50 bg-slate-50/50 hover:bg-slate-50 rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2"
          >
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">
                Click to browse or drag & drop
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Supports JPG, PNG, or WebP (max 5MB)
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-slate-700">Image Web Link</Label>
              <div className="flex gap-2">
                <Input
                  type="url"
                  placeholder="https://example.com/my-photo.jpg"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  className="rounded-xl border-slate-200 text-sm"
                />
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={handleApplyUrl}
                  className="rounded-xl font-bold"
                >
                  Load
                </Button>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-100">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="rounded-xl font-bold border-slate-200"
            disabled={isProcessing}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSavePhoto} 
            className="rounded-xl font-bold bg-primary text-white hover:opacity-90"
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                Save Profile Photo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
