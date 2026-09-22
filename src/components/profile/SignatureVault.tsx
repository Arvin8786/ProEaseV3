import React, { useState, useRef } from 'react';
import { UserProfile, UserActivity } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  PenTool, 
  Upload, 
  Trash2, 
  CheckCircle2, 
  Sparkles,
  Loader2,
  Eraser,
  Download
} from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { db } from '@/lib/firebase';
import { updateLocalProfileField } from '@/lib/profileStorage';
import { extractSignatureFromImage } from '@/services/gemini';
import { motion } from 'motion/react';

interface SignatureVaultProps {
  profile: UserProfile | null;
}

export function SignatureVault({ profile }: SignatureVaultProps) {
  const [isDrawing, setIsDrawing] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  if (!profile) return null;

  const handleSaveSignature = async () => {
    if (sigCanvas.current?.isEmpty()) return;

    if (profile.signatureURL) {
      if (!window.confirm("WARNING: Adding a new signature will permanently replace your current one. Do you want to proceed?")) {
        return;
      }
    }
    
    const signatureData = sigCanvas.current?.getTrimmedCanvas().toDataURL('image/png');
    if (signatureData) {
      await updateLocalProfileField(profile!.uid, {
        signatureURL: signatureData,
        activities: [
          {
            id: Math.random().toString(36).substr(2, 9),
            type: 'signature',
            action: profile.signatureURL ? 'replaced' : 'added',
            detail: `${profile.signatureURL ? 'Replaced current' : 'Added new'} digital signature`,
            timestamp: new Date()
          } as UserActivity,
          ...(profile.activities || [])
        ].slice(0, 50),
        updatedAt: new Date()
      });
      setIsDrawing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (profile.signatureURL) {
      if (!window.confirm("WARNING: Uploading a new signature photo will replace your current signature once AI extraction is complete. Continue?")) {
        return;
      }
    }

    setIsExtracting(true);
    try {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(file);
      });

      const extractedSig = await extractSignatureFromImage(base64, file.type);
      
      if (extractedSig) {
        await updateLocalProfileField(profile!.uid, {
          signatureURL: extractedSig,
          activities: [
            {
              id: Math.random().toString(36).substr(2, 9),
              type: 'signature',
              action: 'extracted',
              detail: "Extracted digital signature from photo using AI",
              timestamp: new Date()
            } as UserActivity,
            ...(profile.activities || [])
          ].slice(0, 50),
          updatedAt: new Date()
        });
      } else {
        alert("AI was unable to extract a clear signature from this photo. Please ensure it is well-lit and on a plain background.");
      }
    } catch (error) {
      console.error("AI Signature Extraction Failed:", error);
      alert("Something went wrong during AI analysis. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDeleteSignature = async () => {
    if (window.confirm("Are you sure you want to remove your signature?")) {
      await updateLocalProfileField(profile!.uid, {
        signatureURL: null,
        activities: [
          {
            id: Math.random().toString(36).substr(2, 9),
            type: 'signature',
            action: 'deleted',
            detail: "Removed digital signature from vault",
            timestamp: new Date()
          } as UserActivity,
          ...(profile.activities || [])
        ].slice(0, 50),
        updatedAt: new Date()
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <PenTool className="h-5 w-5 text-primary" />
            Signature Vault
          </h2>
          <p className="text-sm text-muted-foreground">Manage your digital signatures for document signing.</p>
          {profile.signatureURL && (
            <p className="text-[10px] text-orange-600 font-bold uppercase mt-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3" /> Note: Only 1 signature allowed. New ones will replace current.
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsDrawing(true)}>
            <PenTool className="mr-2 h-4 w-4" />
            Draw New
          </Button>
          <div className="relative">
            <Input 
              type="file" 
              className="hidden" 
              id="sig-upload" 
              accept="image/*"
              onChange={handleFileUpload}
            />
            <label 
              htmlFor="sig-upload" 
              className="inline-flex items-center justify-center rounded-lg border border-border bg-background px-3 py-1 text-sm font-medium hover:bg-muted cursor-pointer transition-colors h-9"
            >
              <Upload className="mr-2 h-4 w-4" />
              AI Extract
            </label>
          </div>
        </div>
      </div>

      {isDrawing && (
        <Card className="border-primary/20 bg-slate-50">
          <CardContent className="p-6 space-y-4">
            <div className="bg-white rounded-xl border-2 border-dashed border-slate-200 overflow-hidden h-48">
              <SignatureCanvas 
                ref={sigCanvas}
                penColor="black"
                canvasProps={{ className: 'w-full h-full cursor-crosshair' }}
              />
            </div>
            <div className="flex justify-between items-center">
              <Button variant="ghost" size="sm" onClick={() => sigCanvas.current?.clear()}>
                <Eraser className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsDrawing(false)}>Cancel</Button>
                <Button size="sm" onClick={handleSaveSignature}>Save Signature</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isExtracting && (
        <Card className="border-primary/20 bg-primary/5 animate-pulse">
          <CardContent className="p-12 flex flex-col items-center justify-center text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <CardTitle className="text-lg mb-2">AI Extraction in Progress</CardTitle>
            <CardDescription>
              Gemini is identifying signature lines and removing the paper background...
            </CardDescription>
          </CardContent>
        </Card>
      )}

      {profile.signatureURL ? (
        <Card className="group relative overflow-hidden">
          <CardContent className="p-6 flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 w-48 h-24 flex items-center justify-center">
                <img src={profile.signatureURL} alt="Signature" className="max-w-full max-h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-bold">Primary Signature</h3>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">Verified</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Last updated {new Date(profile.updatedAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon"><Download className="h-4 w-4" /></Button>
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-destructive"
                onClick={handleDeleteSignature}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 p-2">
            <Sparkles className="h-4 w-4 text-primary/20" />
          </div>
        </Card>
      ) : (
        !isDrawing && !isExtracting && (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <PenTool className="mx-auto h-12 w-12 text-slate-300 mb-4" />
            <p className="text-slate-500">No signature saved yet. Draw one or upload a photo for AI extraction.</p>
          </div>
        )
      )}
    </div>
  );
}

function Badge({ children, variant, className }: { children: React.ReactNode, variant?: string, className?: string }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${className}`}>
      {children}
    </span>
  );
}
