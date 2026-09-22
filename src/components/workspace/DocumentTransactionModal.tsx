import React, { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { 
  CreditCard, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  QrCode, 
  Copy, 
  Check, 
  Loader2,
  FileText,
  ShieldCheck,
  Building2,
  PhoneCall,
  Zap
} from 'lucide-react';
import { DocumentRequest, AdminConfig } from '@/types';
import { submitPaymentProof, DEFAULT_BANKING_DETAILS } from '@/lib/documentRequests';

interface DocumentTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  request: DocumentRequest | null;
  adminConfig?: AdminConfig | null;
  isAdmin?: boolean;
  onAdminBypass?: () => void;
  onSuccess?: () => void;
}

export function DocumentTransactionModal({
  isOpen,
  onClose,
  request,
  adminConfig,
  isAdmin,
  onAdminBypass,
  onSuccess
}: DocumentTransactionModalProps) {
  const [paymentRef, setPaymentRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);

  if (!request) return null;

  const paymentInfo = adminConfig?.paymentInfo || {
    duitNowNumber: DEFAULT_BANKING_DETAILS.duitNowNumber,
    bankName: DEFAULT_BANKING_DETAILS.bankName,
    accountNumber: DEFAULT_BANKING_DETAILS.accountNumber,
    accountHolder: DEFAULT_BANKING_DETAILS.accountHolder,
    instructions: DEFAULT_BANKING_DETAILS.instructions
  };

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmitProof = async () => {
    if (!paymentRef.trim()) {
      alert("Please enter your payment reference number or bank transaction ID.");
      return;
    }

    setSubmitting(true);
    try {
      await submitPaymentProof(request.id, paymentRef.trim());
      setSubmittedSuccess(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to submit payment proof:", err);
      alert("Failed to submit payment reference. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg rounded-3xl p-6 sm:p-8 bg-card border-border shadow-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
              {request.transactionId}
            </Badge>
            <Badge 
              className={
                request.status === 'approved' 
                  ? 'bg-emerald-600 text-white' 
                  : request.status === 'rejected'
                  ? 'bg-rose-600 text-white'
                  : request.paymentStatus === 'paid'
                  ? 'bg-amber-600 text-white'
                  : 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
              }
            >
              {request.status === 'approved' 
                ? 'Approved' 
                : request.status === 'rejected'
                ? 'Rejected'
                : request.paymentStatus === 'paid'
                ? 'Pending Admin Approval'
                : 'Pending Payment'}
            </Badge>
          </div>
          <DialogTitle className="text-2xl font-black tracking-tight text-foreground">
            Document Fee & Approval
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Pay-per-document checkout for <span className="font-bold text-foreground">{request.title}</span> ({request.docType.replace('_', ' ')}).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 my-2">
          {/* Amount Due Card */}
          <div className="bg-primary/5 border border-primary/15 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Amount Due</span>
              <div className="text-3xl font-black text-foreground">
                RM {request.amount.toFixed(2)}
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs text-muted-foreground">Document Type</span>
              <div className="text-sm font-bold text-foreground capitalize">
                {request.docType.replace('_', ' ')}
              </div>
            </div>
          </div>

          {/* Payment Method Details */}
          <Card className="p-4 rounded-2xl space-y-3 bg-muted/40 border-border">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground uppercase tracking-wider">
              <Building2 className="h-4 w-4 text-primary" />
              <span>Payment Details (Malaysia / DuitNow)</span>
            </div>

            {adminConfig?.paymentQrUrl && (
              <div className="text-center py-2">
                <img 
                  src={adminConfig.paymentQrUrl} 
                  alt="DuitNow QR" 
                  className="h-36 w-36 mx-auto rounded-xl border border-border object-contain shadow-sm" 
                />
                <span className="text-[11px] text-muted-foreground block mt-1">Scan via DuitNow / Any Bank App</span>
              </div>
            )}

            <div className="space-y-2 text-xs">
              {paymentInfo.duitNowNumber && (
                <div className="flex items-center justify-between bg-card p-2 rounded-xl border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <PhoneCall className="h-3.5 w-3.5 text-primary" /> DuitNow:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{paymentInfo.duitNowNumber}</span>
                    <button 
                      onClick={() => copyToClipboard(paymentInfo.duitNowNumber!, 'duitnow')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedField === 'duitnow' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {paymentInfo.accountNumber && (
                <div className="flex items-center justify-between bg-card p-2 rounded-xl border border-border">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    <Building2 className="h-3.5 w-3.5 text-primary" /> {paymentInfo.bankName || 'Bank'}:
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-foreground">{paymentInfo.accountNumber}</span>
                    <button 
                      onClick={() => copyToClipboard(paymentInfo.accountNumber!, 'account')}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      {copiedField === 'account' ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              )}

              {paymentInfo.accountHolder && (
                <div className="text-[11px] text-muted-foreground px-1">
                  Recipient: <span className="font-semibold text-foreground">{paymentInfo.accountHolder}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Submission / Status Section */}
          {request.status === 'approved' ? (
            <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3 text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="h-6 w-6 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Approved & Unlocked!</p>
                <p className="text-xs text-muted-foreground">The administrator has approved your request and rendered the official PDF via API.</p>
              </div>
            </div>
          ) : request.status === 'rejected' ? (
            <div className="bg-rose-500/10 border border-rose-500/20 p-4 rounded-2xl flex items-center gap-3 text-rose-900 dark:text-rose-200">
              <AlertCircle className="h-6 w-6 text-rose-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-sm">Request Rejected</p>
                <p className="text-xs text-muted-foreground">{request.rejectedReason || "Payment could not be verified."}</p>
              </div>
            </div>
          ) : (request.paymentStatus === 'paid' || submittedSuccess) ? (
            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl flex items-center gap-3 text-amber-900 dark:text-amber-200">
              <Clock className="h-6 w-6 text-amber-600 flex-shrink-0 animate-pulse" />
              <div>
                <p className="font-bold text-sm">Payment Submitted • Waiting for Approval</p>
                <p className="text-xs text-muted-foreground">
                  Your reference (<span className="font-mono font-semibold">{paymentRef || request.paymentProofRef}</span>) is queued under Doc's Requests. Once verified, your document will be rendered and unlocked.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="paymentRef" className="text-xs font-bold text-foreground">
                Payment Reference Number / Transaction ID
              </Label>
              <Input 
                id="paymentRef"
                placeholder="e.g. DuitNow Ref 20260916-12345 or Maybank Ref" 
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="rounded-xl h-11 border-border font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the reference number shown in your banking receipt or confirmation SMS.
              </p>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center justify-between gap-3">
          {isAdmin && request.status !== 'approved' && onAdminBypass ? (
            <Button
              type="button"
              onClick={() => {
                onAdminBypass();
                onClose();
              }}
              className="w-full sm:w-auto rounded-xl font-black bg-purple-700 hover:bg-purple-800 text-white shadow-md border border-purple-400/30 text-xs py-2 px-3"
            >
              <Zap className="h-3.5 w-3.5 mr-1.5 text-yellow-300" />
              ⚡ Admin Free Bypass (Approve Free)
            </Button>
          ) : <div />}

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button variant="outline" onClick={onClose} className="rounded-xl font-bold">
              Close
            </Button>

            {request.status !== 'approved' && request.paymentStatus !== 'paid' && !submittedSuccess && (
              <Button 
                onClick={handleSubmitProof} 
                disabled={submitting || !paymentRef.trim()}
                className="rounded-xl font-bold bg-primary text-primary-foreground shadow-md"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Submit Payment & Request Approval
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
