import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lock, ShieldAlert, CreditCard, CheckCircle2, Clock, FileText, AlertTriangle, X, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentRequest, AdminConfig } from '@/types';

export interface ProtectedDocumentViewerProps {
  content?: string;
  isLocked?: boolean;
  request?: DocumentRequest | null;
  onPayOrSubmitApproval?: () => void;
  onRequestPayment?: () => void;
  onApprovedOpen?: () => void;
  onAdminBypass?: () => void;
  isAdmin?: boolean;
  title?: string;
  className?: string;
  isOpen?: boolean;
  onClose?: () => void;
  adminConfig?: AdminConfig | null;
}

export function ProtectedDocumentViewer({
  content,
  isLocked,
  request,
  onPayOrSubmitApproval,
  onRequestPayment,
  onApprovedOpen,
  onAdminBypass,
  isAdmin,
  title,
  className,
  isOpen,
  onClose,
  adminConfig
}: ProtectedDocumentViewerProps) {
  const [securityAlert, setSecurityAlert] = useState<string | null>(null);

  const effectiveContent = content || request?.draftContent || '';
  const effectiveLocked = isLocked !== undefined ? isLocked : (request?.status !== 'approved');
  const handlePay = onRequestPayment || onPayOrSubmitApproval;

  useEffect(() => {
    if (!effectiveLocked) return;

    // Prevent Print & Screenshot Shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Print Screen key
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        setSecurityAlert("Screenshot capture disabled for locked draft preview.");
        return false;
      }

      // Ctrl+P or Cmd+P (Print)
      if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        setSecurityAlert("Printing is restricted until approved and unlocked.");
        return false;
      }

      // Ctrl+S or Cmd+S (Save)
      if ((e.ctrlKey || e.metaKey) && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        setSecurityAlert("Direct saving is disabled for locked draft preview.");
        return false;
      }

      // Mac screenshot shortcuts (Cmd+Shift+3, 4, 5)
      if (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) {
        e.preventDefault();
        setSecurityAlert("Screenshot shortcuts are restricted.");
        return false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [effectiveLocked]);

  const viewerContent = (
    <div 
      className={cn(
        "relative rounded-2xl overflow-hidden border border-border bg-card",
        effectiveLocked && "select-none",
        className
      )}
      onContextMenu={(e) => {
        if (effectiveLocked) {
          e.preventDefault();
          setSecurityAlert("Right-click context menu is disabled for locked previews.");
        }
      }}
      onCopy={(e) => {
        if (effectiveLocked) {
          e.preventDefault();
          setSecurityAlert("Copying text is restricted until approved and unlocked.");
        }
      }}
    >
      {/* Security Alert Toast */}
      {securityAlert && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 text-red-200 border border-red-500/50 px-4 py-2 rounded-xl text-xs font-bold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
          <ShieldAlert className="h-4 w-4 text-red-400" />
          <span>{securityAlert}</span>
          <button 
            onClick={() => setSecurityAlert(null)} 
            className="ml-2 hover:text-white underline font-semibold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Locked Status Banner */}
      {effectiveLocked && (
        <div className="bg-amber-500/10 border-b border-amber-500/20 p-3 px-4 flex flex-wrap items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
              <Lock className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-xs uppercase tracking-wider">Preview Locked</span>
                {request && (
                  <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-700 dark:text-amber-300">
                    {request.transactionId}
                  </Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Right-click & copy disabled. Official PDF unlocked upon admin approval.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {request && (
              <Badge className="bg-amber-600 text-white font-bold text-xs px-2.5 py-1">
                RM {request.amount.toFixed(2)}
              </Badge>
            )}
            {isAdmin && request?.status !== 'approved' && onAdminBypass && (
              <Button
                size="sm"
                onClick={onAdminBypass}
                className="rounded-xl h-8 text-xs font-black bg-purple-700 hover:bg-purple-800 text-white shadow-sm border border-purple-400/30"
              >
                <Zap className="h-3.5 w-3.5 mr-1 text-yellow-300" />
                ⚡ Free Bypass
              </Button>
            )}
            {request?.status === 'approved' ? (
              <Button 
                size="sm" 
                onClick={onApprovedOpen}
                className="rounded-xl h-8 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                <FileText className="h-3.5 w-3.5 mr-1.5" />
                View & Edit Document
              </Button>
            ) : handlePay ? (
              <Button 
                size="sm" 
                onClick={handlePay}
                className="rounded-xl h-8 text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-sm"
              >
                <CreditCard className="h-3.5 w-3.5 mr-1.5" />
                {request?.paymentStatus === 'paid' ? 'Check Payment Status' : `Pay RM ${(request?.amount || 1).toFixed(2)} & Request Approval`}
              </Button>
            ) : null}
          </div>
        </div>
      )}

      {/* Main Document Content Canvas */}
      <div className="relative p-6 md:p-8 min-h-[400px]">
        {/* Repeating Watermark for Locked State */}
        {effectiveLocked && (
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-around items-center overflow-hidden opacity-15 select-none rotate-[-25deg] scale-125">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="text-slate-900 dark:text-white font-black text-sm tracking-[0.25em] uppercase whitespace-nowrap">
                PROEASE LOCKED PREVIEW • PENDING APPROVAL & PAYMENT (RM {request?.amount || 1}.00) • {request?.transactionId || 'PREVIEW'}
              </div>
            ))}
          </div>
        )}

        {/* Content with Blur when Locked */}
        <div 
          className={cn(
            "prose dark:prose-invert max-w-none text-sm font-sans leading-relaxed whitespace-pre-wrap transition-all",
            effectiveLocked && "filter blur-[2.5px] pointer-events-none opacity-80"
          )}
        >
          {effectiveContent}
        </div>

        {/* Locked Overlay Mask with Unlocking CTA */}
        {effectiveLocked && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-background/30 backdrop-blur-[1px]">
            <Card className="max-w-md w-full p-6 text-center shadow-2xl border-amber-500/30 bg-card/95 backdrop-blur-md">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center mb-3">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="font-black text-lg text-foreground tracking-tight">
                Document Draft Generated
              </h3>
              <p className="text-xs text-muted-foreground mt-1 mb-4 leading-relaxed">
                Your draft is ready and protected. Complete the payment of{' '}
                <span className="font-bold text-foreground">RM {request?.amount?.toFixed(2) || '1.00'}</span>{' '}
                to Maybank (102037147223 - Arvinderan A/L M Ganeson) to submit for approval. Once approved, the document is fully available to view, edit, and download.
              </p>

              <div className="space-y-2">
                {request && (
                  <div className="bg-muted/50 rounded-xl p-2.5 text-xs text-left flex justify-between items-center mb-2">
                    <span className="text-muted-foreground">Transaction ID:</span>
                    <span className="font-mono font-bold text-foreground">{request.transactionId}</span>
                  </div>
                )}
                {isAdmin && request?.status !== 'approved' && onAdminBypass && (
                  <Button
                    onClick={onAdminBypass}
                    className="w-full rounded-xl font-black h-10 bg-purple-700 hover:bg-purple-800 text-white shadow-lg border border-purple-400/30 mb-2"
                  >
                    <Zap className="h-4 w-4 mr-2 text-yellow-300" />
                    ⚡ Admin Free Bypass (Unlock Immediately)
                  </Button>
                )}
                {request?.status === 'approved' ? (
                  <Button 
                    onClick={onApprovedOpen} 
                    className="w-full rounded-xl font-bold h-10 bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Open Approved Document (View / Edit / Download)
                  </Button>
                ) : handlePay ? (
                  <Button 
                    onClick={handlePay} 
                    className="w-full rounded-xl font-bold h-10 bg-primary text-primary-foreground shadow-lg"
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {request?.paymentStatus === 'paid' ? 'View Payment & Request Status' : `Pay RM ${request?.amount?.toFixed(2) || '1.00'} & Submit Request`}
                  </Button>
                ) : null}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );

  if (isOpen !== undefined) {
    return (
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose?.()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 rounded-[2rem] border-none shadow-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-border/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-heading font-black tracking-tight flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-amber-500" />
                  {title || request?.title || 'Protected Document Draft'}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Anti-screenshot, right-click, and copy protections are enforced. Pay per document to unlock official generation.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="p-6">
            {viewerContent}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return viewerContent;
}
