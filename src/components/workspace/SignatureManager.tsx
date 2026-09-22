import React, { useRef, useState, useEffect } from 'react';
import SignaturePad from 'signature_pad';
import { Button } from '@/components/ui/button';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { 
  PenTool, 
  Camera, 
  Upload, 
  Trash2, 
  Check, 
  X, 
  Sparkles, 
  Loader2,
  RefreshCw
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from '@/lib/utils';

interface SignatureManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (signatureDataUrl: string) => void;
}

export function SignatureManager({ isOpen, onClose, onConfirm }: SignatureManagerProps) {
  const [activeTab, setActiveTab ] = useState('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sigPadRef = useRef<SignaturePad | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const resizeCanvas = () => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ratio = Math.max(window.devicePixelRatio || 1, 1);
      canvas.width = canvas.offsetWidth * ratio;
      canvas.height = canvas.offsetHeight * ratio;
      canvas.getContext("2d")?.scale(ratio, ratio);
      sigPadRef.current?.clear(); // This re-syncs the signature pad internal offsets
    }
  };

  useEffect(() => {
    if (activeTab === 'draw' && canvasRef.current && isOpen) {
      // Re-initialize to ensure it picks up the correct context
      sigPadRef.current = new SignaturePad(canvasRef.current, {
        backgroundColor: 'rgba(255, 255, 255, 0)',
        penColor: 'rgb(0, 0, 0)'
      });
      
      // Delay resize slightly to ensure DOM has settled (important inside Dialogs)
      const timeout = setTimeout(resizeCanvas, 50);
      window.addEventListener("resize", resizeCanvas);
      return () => {
        window.removeEventListener("resize", resizeCanvas);
        clearTimeout(timeout);
      };
    }
  }, [activeTab, isOpen]);

  const handleClear = () => sigPadRef.current?.clear();

  const handleDrawSubmit = () => {
    if (sigPadRef.current?.isEmpty()) return;
    onConfirm(sigPadRef.current?.toDataURL() || '');
  };

  const startCamera = async () => {
    setIsCameraActive(true);
    setCapturedImage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Camera error:", err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(videoRef.current, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => setCapturedImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const removeBackground = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(dataUrl);

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Background removal logic: threshold-based luminance transparency
        // We look for pixels close to white/light grey and make them transparent
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          // Simple luminance calculation
          const luminance = (r * 0.299 + g * 0.587 + b * 0.114);
          
          // If luminance is high (white/paper), set alpha to 0
          // Adjust threshold for different intensities (e.g., 200 is fairly strict for white)
          if (luminance > 220) { 
            data[i + 3] = 0;
          } else {
            // Enhance contrast for signatures by making dark pixels truly black
            if (luminance < 150) {
              data[i] = 0;
              data[i + 1] = 0;
              data[i + 2] = 0;
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.src = dataUrl;
    });
  };

  const handleImageSubmit = async () => {
    if (!capturedImage) return;
    setIsProcessing(true);
    try {
      const cleanImage = await removeBackground(capturedImage);
      onConfirm(cleanImage);
    } catch (err) {
      console.error("BG Removal fail:", err);
      onConfirm(capturedImage);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] rounded-[2.5rem] overflow-hidden">
        <DialogHeader className="p-2">
          <DialogTitle className="text-2xl font-black tracking-tighter">Signature Suite</DialogTitle>
          <DialogDescription>Create a clean, professional signature for your documents.</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="draw" className="w-full mt-4" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 rounded-2xl h-14">
            <TabsTrigger value="draw" className="rounded-xl font-bold flex gap-2 h-12">
              <PenTool className="h-4 w-4" /> Draw
            </TabsTrigger>
            <TabsTrigger value="photo" className="rounded-xl font-bold flex gap-2 h-12" onClick={startCamera}>
              <Camera className="h-4 w-4" /> Camera
            </TabsTrigger>
            <TabsTrigger value="upload" className="rounded-xl font-bold flex gap-2 h-12">
              <Upload className="h-4 w-4" /> Upload
            </TabsTrigger>
          </TabsList>

          <div className="mt-8 bg-slate-50 rounded-[2rem] border-2 border-dashed border-slate-200 min-h-[300px] flex items-center justify-center relative overflow-hidden">
            <TabsContent value="draw" className="w-full h-full m-0 p-6 flex flex-col items-center">
              <canvas 
                ref={canvasRef} 
                className="w-full h-[240px] bg-white rounded-2xl shadow-inner cursor-crosshair border border-slate-100" 
              />
              <div className="mt-4 flex gap-4">
                <Button variant="outline" size="sm" onClick={handleClear} className="rounded-xl font-bold">
                  <Trash2 className="h-4 w-4 mr-2" /> Clear
                </Button>
                <Button size="sm" onClick={handleDrawSubmit} className="rounded-xl font-bold px-8">
                  <Check className="h-4 w-4 mr-2" /> Save Signature
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="photo" className="w-full h-full m-0 flex flex-col items-center">
              {capturedImage ? (
                <div className="p-6 flex flex-col items-center space-y-4">
                  <img src={capturedImage} className="max-h-[220px] rounded-2xl shadow-xl" alt="Captured" />
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => { setCapturedImage(null); startCamera(); }} className="rounded-xl font-bold">
                      <RefreshCw className="h-4 w-4 mr-2" /> Retake
                    </Button>
                    <Button onClick={handleImageSubmit} disabled={isProcessing} className="rounded-xl font-bold px-8">
                      {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                      Remove BG & Save
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-[300px]">
                  <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover rounded-[2rem]"
                  />
                  <div className="absolute inset-x-0 bottom-6 flex justify-center">
                    <Button onClick={capturePhoto} className="h-16 w-16 rounded-full shadow-2xl bg-white text-primary hover:bg-white/90">
                      <div className="h-12 w-12 rounded-full border-4 border-primary" />
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="upload" className="w-full h-full m-0 flex flex-col items-center p-8">
               {capturedImage ? (
                  <div className="flex flex-col items-center space-y-6">
                    <img src={capturedImage} className="max-h-[200px] rounded-2xl shadow-xl" alt="Uploaded" />
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={() => setCapturedImage(null)} className="rounded-xl font-bold">
                        <Trash2 className="h-4 w-4 mr-2" /> Remove
                      </Button>
                      <Button onClick={handleImageSubmit} disabled={isProcessing} className="rounded-xl font-bold px-8">
                        {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
                        Remove BG & Save
                      </Button>
                    </div>
                  </div>
               ) : (
                 <div 
                   onClick={() => fileInputRef.current?.click()}
                   className="w-full h-[240px] border-2 border-dashed border-slate-300 rounded-[2rem] flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors"
                 >
                   <div className="bg-primary/10 p-4 rounded-2xl mb-4">
                     <Upload className="h-8 w-8 text-primary" />
                   </div>
                   <p className="font-bold text-slate-500">Click to upload signature photo</p>
                   <p className="text-xs text-slate-400 mt-1 uppercase font-black tracking-widest leading-relaxed">PNG or JPEG supported</p>
                   <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      onChange={handleFileUpload}
                   />
                 </div>
               )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
