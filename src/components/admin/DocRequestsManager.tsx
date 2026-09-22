import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { DocumentRequest, AdminConfig } from '@/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  FileText, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Search, 
  CreditCard, 
  Sparkles, 
  Loader2, 
  Eye, 
  Trash2, 
  AlertCircle,
  ExternalLink,
  DollarSign,
  Building2,
  Save,
  Filter,
  Zap
} from 'lucide-react';
import { 
  approveAndGenerateOfficialDoc, 
  rejectDocumentRequest,
  DEFAULT_PRICING,
  DEFAULT_BANKING_DETAILS 
} from '@/lib/documentRequests';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';

interface DocRequestsManagerProps {
  adminEmail: string;
  adminConfig: AdminConfig | null;
  onUpdatePricing?: (pricing: { resume: number; cover_letter: number; tailored_resume?: number; resignation: number }, paymentInfo: any) => Promise<void>;
}

export function DocRequestsManager({ adminEmail, adminConfig, onUpdatePricing }: DocRequestsManagerProps) {
  const [requests, setRequests] = useState<DocumentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [searchQuery, setSearchQuery] = useState('');
  
  // Action states
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [inspectRequest, setInspectRequest] = useState<DocumentRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<DocumentRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Pricing & Payment Settings (Default RM 1.00 each & Maybank details)
  const [resumePrice, setResumePrice] = useState<number>(adminConfig?.documentPricing?.resume ?? 1);
  const [coverLetterPrice, setCoverLetterPrice] = useState<number>(adminConfig?.documentPricing?.cover_letter ?? 1);
  const [tailoredResumePrice, setTailoredResumePrice] = useState<number>(adminConfig?.documentPricing?.tailored_resume ?? 1);
  const [resignationPrice, setResignationPrice] = useState<number>(adminConfig?.documentPricing?.resignation ?? 1);
  const [duitNow, setDuitNow] = useState<string>(adminConfig?.paymentInfo?.duitNowNumber || DEFAULT_BANKING_DETAILS.duitNowNumber);
  const [bankName, setBankName] = useState<string>(adminConfig?.paymentInfo?.bankName || DEFAULT_BANKING_DETAILS.bankName);
  const [accountNumber, setAccountNumber] = useState<string>(adminConfig?.paymentInfo?.accountNumber || DEFAULT_BANKING_DETAILS.accountNumber);
  const [accountHolder, setAccountHolder] = useState<string>(adminConfig?.paymentInfo?.accountHolder || DEFAULT_BANKING_DETAILS.accountHolder);
  const [paymentQrUrl, setPaymentQrUrl] = useState<string>(adminConfig?.paymentQrUrl || '');
  const [savingSettings, setSavingSettings] = useState(false);

  // Sync settings when adminConfig changes
  useEffect(() => {
    if (adminConfig?.documentPricing) {
      setResumePrice(adminConfig.documentPricing.resume ?? 1);
      setCoverLetterPrice(adminConfig.documentPricing.cover_letter ?? 1);
      setTailoredResumePrice(adminConfig.documentPricing.tailored_resume ?? 1);
      setResignationPrice(adminConfig.documentPricing.resignation ?? 1);
    }
    if (adminConfig?.paymentInfo) {
      setDuitNow(adminConfig.paymentInfo.duitNowNumber || DEFAULT_BANKING_DETAILS.duitNowNumber);
      setBankName(adminConfig.paymentInfo.bankName || DEFAULT_BANKING_DETAILS.bankName);
      setAccountNumber(adminConfig.paymentInfo.accountNumber || DEFAULT_BANKING_DETAILS.accountNumber);
      setAccountHolder(adminConfig.paymentInfo.accountHolder || DEFAULT_BANKING_DETAILS.accountHolder);
    }
    if (adminConfig?.paymentQrUrl) {
      setPaymentQrUrl(adminConfig.paymentQrUrl);
    }
  }, [adminConfig]);

  // Real-time listener for document requests
  useEffect(() => {
    const q = query(collection(db, 'document_requests'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DocumentRequest[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data
        } as DocumentRequest);
      });
      setRequests(list);
      setLoading(false);
    }, (err) => {
      console.error("Failed to load document requests:", err);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const handleApprove = async (req: DocumentRequest) => {
    setProcessingId(req.id);
    try {
      const res = await approveAndGenerateOfficialDoc(req, adminEmail);
      if (res.success) {
        alert(`Document request approved! The official document has been unlocked for ${req.userEmail} to view, edit, and download.`);
      } else {
        alert(`Approval warning: ${res.error}`);
      }
    } catch (err: any) {
      console.error("Approve error:", err);
      alert(`Approval failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleBypassApprove = async (req: DocumentRequest) => {
    setProcessingId(req.id);
    try {
      const res = await approveAndGenerateOfficialDoc(req, adminEmail, null, { isFreeBypass: true });
      if (res.success) {
        alert(`⚡ Admin Free Bypass Approved! Charges have been waived (RM 0.00). The document is now immediately available for ${req.userEmail} to view, edit, and download.`);
      } else {
        alert(`Bypass warning: ${res.error}`);
      }
    } catch (err: any) {
      console.error("Bypass error:", err);
      alert(`Bypass failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectingRequest) return;
    setProcessingId(rejectingRequest.id);
    try {
      await rejectDocumentRequest(rejectingRequest.id, rejectReason || "Payment not verified or incomplete.", adminEmail);
      setRejectingRequest(null);
      setRejectReason('');
    } catch (err: any) {
      console.error("Reject error:", err);
      alert(`Reject failed: ${err.message}`);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDelete = async (requestId: string) => {
    if (!confirm("Are you sure you want to delete this document request?")) return;
    try {
      await deleteDoc(doc(db, 'document_requests', requestId));
    } catch (err) {
      console.error("Failed to delete request:", err);
    }
  };

  const handleSaveSettings = async () => {
    if (!onUpdatePricing) return;
    setSavingSettings(true);
    try {
      await onUpdatePricing(
        {
          resume: Number(resumePrice) || 1,
          cover_letter: Number(coverLetterPrice) || 1,
          tailored_resume: Number(tailoredResumePrice) || 1,
          resignation: Number(resignationPrice) || 1
        },
        {
          duitNowNumber: duitNow || DEFAULT_BANKING_DETAILS.duitNowNumber,
          bankName: bankName || DEFAULT_BANKING_DETAILS.bankName,
          accountNumber: accountNumber || DEFAULT_BANKING_DETAILS.accountNumber,
          accountHolder: accountHolder || DEFAULT_BANKING_DETAILS.accountHolder,
          qrCodeUrl: paymentQrUrl,
          instructions: 'Transfer RM 1.00 via Maybank (102037147223) or DuitNow to Arvinderan A/L M Ganeson.'
        }
      );
      alert("Per-document pricing and payment info updated successfully!");
    } catch (err) {
      console.error("Failed to update pricing settings:", err);
      alert("Failed to save pricing settings.");
    } finally {
      setSavingSettings(false);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filter === 'pending' && r.status !== 'pending_approval') return false;
    if (filter === 'approved' && r.status !== 'approved') return false;
    if (filter === 'rejected' && r.status !== 'rejected') return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchEmail = r.userEmail?.toLowerCase().includes(q);
      const matchName = r.userName?.toLowerCase().includes(q);
      const matchTxn = r.transactionId?.toLowerCase().includes(q);
      const matchTitle = r.title?.toLowerCase().includes(q);
      const matchRef = r.paymentProofRef?.toLowerCase().includes(q);
      return matchEmail || matchName || matchTxn || matchTitle || matchRef;
    }
    return true;
  });

  const pendingCount = requests.filter(r => r.status === 'pending_approval').length;

  return (
    <div className="space-y-8">
      {/* Top Banner & Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-3xl border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-black tracking-tight text-foreground">Doc's Requests & Approvals</h2>
            {pendingCount > 0 && (
              <Badge className="bg-amber-600 text-white font-bold px-2.5 py-0.5 animate-pulse">
                {pendingCount} Pending
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Pay-per-doc queue (RM 1.00 each). Verify Maybank transfers or click <strong>Admin Bypass</strong> to approve requests for free.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-3 py-1.5 font-bold border-border">
            Total Requests: {requests.length}
          </Badge>
        </div>
      </div>

      {/* Per-Document Pricing & Bank Config */}
      <Card className="rounded-3xl border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/30 border-b border-border">
          <CardTitle className="text-lg font-bold flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Per-Document Pricing (RM 1 each) & Maybank Details
          </CardTitle>
          <CardDescription className="text-xs">
            Configured for RM 1.00 per document (Resume, Cover Letter, Tailored Resume, Resignation Letter) and Maybank account details.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Resume Fee (RM)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">RM</span>
                <Input 
                  type="number"
                  min="0"
                  step="0.5"
                  value={resumePrice}
                  onChange={(e) => setResumePrice(parseFloat(e.target.value) || 0)}
                  className="pl-10 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Cover Letter Fee (RM)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">RM</span>
                <Input 
                  type="number"
                  min="0"
                  step="0.5"
                  value={coverLetterPrice}
                  onChange={(e) => setCoverLetterPrice(parseFloat(e.target.value) || 0)}
                  className="pl-10 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Tailored Resume Fee (RM)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">RM</span>
                <Input 
                  type="number"
                  min="0"
                  step="0.5"
                  value={tailoredResumePrice}
                  onChange={(e) => setTailoredResumePrice(parseFloat(e.target.value) || 0)}
                  className="pl-10 rounded-xl font-bold"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Resignation Fee (RM)</Label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-xs font-bold text-muted-foreground">RM</span>
                <Input 
                  type="number"
                  min="0"
                  step="0.5"
                  value={resignationPrice}
                  onChange={(e) => setResignationPrice(parseFloat(e.target.value) || 0)}
                  className="pl-10 rounded-xl font-bold"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-border">
            <div className="space-y-2">
              <Label className="text-xs font-bold">Bank Name</Label>
              <Input 
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="Maybank"
                className="rounded-xl font-mono text-xs font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Account Number / DuitNow</Label>
              <Input 
                value={accountNumber}
                onChange={(e) => {
                  setAccountNumber(e.target.value);
                  setDuitNow(e.target.value);
                }}
                placeholder="102037147223"
                className="rounded-xl font-mono text-xs font-bold"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold">Account Holder Name</Label>
              <Input 
                value={accountHolder}
                onChange={(e) => setAccountHolder(e.target.value)}
                placeholder="Arvinderan A/L M Ganeson"
                className="rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <Button 
              onClick={handleSaveSettings} 
              disabled={savingSettings}
              className="rounded-xl font-bold bg-primary text-primary-foreground text-xs shadow-md"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Pricing & Payment Settings
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-2xl border border-border w-full sm:w-auto">
          <Button
            size="sm"
            variant={filter === 'pending' ? 'default' : 'ghost'}
            onClick={() => setFilter('pending')}
            className="rounded-xl text-xs font-bold h-8"
          >
            Pending ({requests.filter(r => r.status === 'pending_approval').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'approved' ? 'default' : 'ghost'}
            onClick={() => setFilter('approved')}
            className="rounded-xl text-xs font-bold h-8"
          >
            Approved ({requests.filter(r => r.status === 'approved').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'rejected' ? 'default' : 'ghost'}
            onClick={() => setFilter('rejected')}
            className="rounded-xl text-xs font-bold h-8"
          >
            Rejected ({requests.filter(r => r.status === 'rejected').length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'all' ? 'default' : 'ghost'}
            onClick={() => setFilter('all')}
            className="rounded-xl text-xs font-bold h-8"
          >
            All ({requests.length})
          </Button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input 
            placeholder="Search email, txn, ref..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 rounded-xl text-xs h-9 border-border"
          />
        </div>
      </div>

      {/* Requests List */}
      {loading ? (
        <div className="p-12 text-center text-muted-foreground flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-semibold">Loading document requests...</p>
        </div>
      ) : filteredRequests.length === 0 ? (
        <Card className="rounded-3xl p-12 text-center border-border bg-card">
          <div className="h-12 w-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-foreground">No Document Requests Found</h3>
          <p className="text-xs text-muted-foreground mt-1">
            {filter === 'pending' 
              ? "All requests have been reviewed or no pending requests are queued."
              : "No requests match the selected filters."}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((req) => (
            <Card key={req.id} className="rounded-2xl border-border bg-card shadow-sm overflow-hidden hover:border-primary/40 transition-colors">
              <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Left details */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-foreground text-sm">{req.title}</span>
                    <Badge variant="outline" className="capitalize text-[10px] font-semibold">
                      {req.docType.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                      {req.transactionId}
                    </Badge>
                    <Badge className="bg-primary/10 text-primary font-bold text-xs border border-primary/20">
                      RM {req.amount.toFixed(2)}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div>
                      User: <span className="font-semibold text-foreground">{req.userName}</span> ({req.userEmail})
                    </div>
                    <div>
                      Date: <span className="font-mono">{req.createdAt?.toDate ? req.createdAt.toDate().toLocaleString() : new Date(req.createdAt).toLocaleString()}</span>
                    </div>
                    {req.paymentProofRef && (
                      <div className="bg-amber-500/10 text-amber-900 dark:text-amber-200 px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-amber-500/20">
                        Payment Ref: {req.paymentProofRef}
                      </div>
                    )}
                  </div>
                </div>

                {/* Status & Action Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge 
                    className={
                      req.status === 'approved' 
                        ? (req.isBypassed || req.paymentStatus === 'waived' ? 'bg-purple-600 text-white font-bold' : 'bg-emerald-600 text-white font-bold')
                        : req.status === 'rejected'
                        ? 'bg-rose-600 text-white'
                        : req.paymentStatus === 'paid'
                        ? 'bg-amber-600 text-white'
                        : 'bg-slate-700 text-white'
                    }
                  >
                    {req.status === 'approved' 
                      ? (req.isBypassed || req.paymentStatus === 'waived' ? '⚡ Approved (Free Bypass)' : 'Approved & Rendered') 
                      : req.status === 'rejected'
                      ? 'Rejected'
                      : req.paymentStatus === 'paid'
                      ? 'Payment Submitted'
                      : 'Pending Payment'}
                  </Badge>

                  {/* Inspect Draft */}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setInspectRequest(req)}
                    className="rounded-xl h-9 text-xs font-bold border-border"
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Inspect Draft
                  </Button>

                  {/* Actions for Pending */}
                  {req.status === 'pending_approval' && (
                    <>
                      {/* Admin Bypass (Free Approval) */}
                      <Button
                        size="sm"
                        disabled={processingId === req.id}
                        onClick={() => handleBypassApprove(req)}
                        className="rounded-xl h-9 text-xs font-black bg-purple-700 hover:bg-purple-800 text-white shadow-sm border border-purple-500/30"
                        title="Admin Free Bypass: Waive charges and unlock document for user immediately"
                      >
                        {processingId === req.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Zap className="h-3.5 w-3.5 mr-1 text-yellow-300" />
                        )}
                        ⚡ Free Bypass
                      </Button>

                      {/* Regular Paid Approval */}
                      <Button
                        size="sm"
                        disabled={processingId === req.id}
                        onClick={() => handleApprove(req)}
                        className="rounded-xl h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                      >
                        {processingId === req.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5 mr-1" />
                        )}
                        Approve (Paid)
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        disabled={processingId === req.id}
                        onClick={() => setRejectingRequest(req)}
                        className="rounded-xl h-9 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </>
                  )}

                  {/* Delete Request */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDelete(req.id)}
                    className="h-9 w-9 p-0 rounded-xl text-muted-foreground hover:text-rose-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Inspect Draft Modal */}
      {inspectRequest && (
        <Dialog open={!!inspectRequest} onOpenChange={() => setInspectRequest(null)}>
          <DialogContent className="max-w-2xl rounded-3xl p-6 bg-card border-border max-h-[85vh] flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono">{inspectRequest.transactionId}</Badge>
                <Badge className="font-bold">RM {inspectRequest.amount.toFixed(2)}</Badge>
              </div>
              <DialogTitle className="text-xl font-black">{inspectRequest.title}</DialogTitle>
              <DialogDescription className="text-xs">
                Draft content requested by {inspectRequest.userName} ({inspectRequest.userEmail}).
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto my-4 p-4 rounded-xl bg-muted/40 border border-border text-xs font-mono whitespace-pre-wrap leading-relaxed">
              {inspectRequest.finalContent || inspectRequest.draftContent || "No draft content provided."}
            </div>

            <DialogFooter className="gap-2 flex-wrap sm:justify-end">
              <Button variant="outline" onClick={() => setInspectRequest(null)} className="rounded-xl font-bold">
                Close
              </Button>
              {inspectRequest.status === 'pending_approval' && (
                <>
                  <Button 
                    onClick={() => {
                      const req = inspectRequest;
                      setInspectRequest(null);
                      handleBypassApprove(req);
                    }}
                    className="rounded-xl font-bold bg-purple-700 hover:bg-purple-800 text-white"
                  >
                    <Zap className="h-4 w-4 mr-1.5 text-yellow-300" />
                    ⚡ Free Bypass (RM 0.00)
                  </Button>
                  <Button 
                    onClick={() => {
                      const req = inspectRequest;
                      setInspectRequest(null);
                      handleApprove(req);
                    }}
                    className="rounded-xl font-bold bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    <Sparkles className="h-4 w-4 mr-1.5" />
                    Approve (Paid)
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Reject Modal */}
      {rejectingRequest && (
        <Dialog open={!!rejectingRequest} onOpenChange={() => setRejectingRequest(null)}>
          <DialogContent className="max-w-md rounded-3xl p-6 bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-rose-600">Reject Document Request</DialogTitle>
              <DialogDescription className="text-xs">
                Provide a reason for rejecting the request for {rejectingRequest.title}.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 my-3">
              <Label className="text-xs font-bold">Rejection Reason</Label>
              <Input 
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Payment reference not found in bank statement"
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setRejectingRequest(null)} className="rounded-xl font-bold">
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleRejectConfirm}
                disabled={processingId === rejectingRequest.id}
                className="rounded-xl font-bold"
              >
                {processingId === rejectingRequest.id ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
