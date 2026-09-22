import React, { useState, useEffect } from 'react';
import { UserProfile, AdminConfig, WhiteListEntry } from '@/types';
import { APP_FEATURES, PLAN_TIERS, AppFeatureId, PlanId } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  ShieldCheck, 
  Lock, 
  Users, 
  FileText, 
  Settings, 
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  UserPlus,
  Trash2,
  Mail,
  Receipt,
  History,
  QrCode,
  ImageIcon,
  Check,
  X as XIcon,
  ExternalLink,
  MessageSquare,
  Upload,
  Eye,
  EyeOff,
  Copy
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '@/lib/firebase';
import { doc, getDoc, updateDoc, collection, getDocs, setDoc, deleteDoc, query, where, orderBy } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { PaymentRequest } from '@/types';
import { DocRequestsManager } from './DocRequestsManager';

interface AdminPanelProps {
  profile: UserProfile | null;
}

export function AdminPanel({ profile }: AdminPanelProps) {
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [whitelist, setWhitelist] = useState<WhiteListEntry[]>([]);
  const [blockedEmails, setBlockedEmails] = useState<any[]>([]);
  const [payments, setPayments] = useState<PaymentRequest[]>([]);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAddingEmail, setIsAddingEmail] = useState(false);
  const [isUpdatingQr, setIsUpdatingQr] = useState(false);
  const [activeAdminTab, setActiveAdminTab] = useState<'users' | 'tiers' | 'expiry' | 'whitelist' | 'payments' | 'logs' | 'requests' | 'keys' | 'doc_requests'>('users');
  const [accessRequests, setAccessRequests] = useState<any[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [isUpdatingKey, setIsUpdatingKey] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  const isOwner = profile?.email === "arvin8786@gmail.com";
  const isModerator = isOwner || profile?.role === "moderator";

  // Simple Switch replacement since shadcn switch might be missing
  const Switch = ({ checked, onCheckedChange }: { checked: boolean, onCheckedChange: (val: boolean) => void }) => (
    <button 
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none",
        checked ? "bg-primary" : "bg-slate-200"
      )}
    >
      <span className={cn(
        "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
        checked ? "translate-x-6" : "translate-x-1"
      )} />
    </button>
  );

  useEffect(() => {
    const fetchAdminData = async () => {
      try {
        const configSnap = await getDoc(doc(db, 'admin_config', 'global'));
        if (configSnap.exists()) {
          setConfig(configSnap.data() as AdminConfig);
        } else {
          console.warn("Admin config not found");
        }

        const usersSnap = await getDocs(collection(db, 'users'));
        setUsers(usersSnap.docs.map(doc => doc.data() as UserProfile));

        const whitelistSnap = await getDocs(collection(db, 'whitelist'));
        setWhitelist(whitelistSnap.docs.map(doc => doc.data() as WhiteListEntry));

        const paymentsSnap = await getDocs(query(collection(db, 'payment_requests'), orderBy('requestedAt', 'desc')));
        setPayments(paymentsSnap.docs.map(doc => doc.data() as PaymentRequest));

        const requestsSnap = await getDocs(query(collection(db, 'access_requests'), orderBy('requestedAt', 'desc')));
        setAccessRequests(requestsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));

        const blockedSnap = await getDocs(collection(db, 'blocked_emails'));
        setBlockedEmails(blockedSnap.docs.map(doc => doc.data()));

        // Fetch all user activities for systemic logs
        const allUsers = usersSnap.docs.map(doc => doc.data() as UserProfile);
        const logs: any[] = [];
        allUsers.forEach(u => {
          if (u.activities) {
            u.activities.forEach(a => {
              logs.push({ ...a, userEmail: u.email, userDisplayName: u.displayName });
            });
          }
        });
        setSystemLogs(logs.sort((a, b) => b.timestamp?.toMillis ? b.timestamp.toMillis() - a.timestamp.toMillis() : new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 100));
      } catch (error) {
        console.error("Error fetching admin data:", error);
        handleFirestoreError(error, OperationType.LIST, 'users');
      } finally {
        setLoading(false);
      }
    };

    if (profile?.isAdmin) {
      fetchAdminData();
    } else {
      setLoading(false);
    }
  }, [profile?.isAdmin]);

  useEffect(() => {
    if (config?.geminiApiKey) {
      setTempApiKey(config.geminiApiKey);
    }
  }, [config?.geminiApiKey]);

  const updateConfig = async (updates: Partial<AdminConfig>) => {
    if (!config) return;
    const isKeyUpdate = 'geminiApiKey' in updates;
    if (isKeyUpdate) setIsUpdatingKey(true);
    
    try {
      const newConfig = { ...config, ...updates };
      setConfig(newConfig);
      await setDoc(doc(db, 'admin_config', 'global'), {
        ...newConfig,
        updatedAt: new Date()
      }, { merge: true });
      if (isKeyUpdate) alert("API Key updated successfully.");
    } catch (error) {
      console.error("Config update failed:", error);
      alert("Failed to update system configuration.");
    } finally {
      if (isKeyUpdate) setIsUpdatingKey(false);
    }
  };

  const updateUserPlan = async (userId: string, plan: string, expiry?: Date) => {
    const userDoc = doc(db, 'users', userId);
    await updateDoc(userDoc, {
      plan,
      subscriptionExpiry: expiry || null,
      updatedAt: new Date()
    });
    setUsers(prev => prev.map(u => u.uid === userId ? { ...u, plan: plan as any, subscriptionExpiry: expiry } : u));
  };

  const updateUserRole = async (userId: string, role: string) => {
    const userDoc = doc(db, 'users', userId);
    await updateDoc(userDoc, {
      role,
      updatedAt: new Date()
    });
    setUsers(prev => prev.map(u => u.uid === userId ? { ...u, role: role as any } : u));
  };

  const addToWhitelist = async () => {
    if (!newEmail.trim() || !profile) return;
    setIsAddingEmail(true);
    try {
      const email = newEmail.trim().toLowerCase();
      const whitelistDoc = doc(db, 'whitelist', email);
      const entry: WhiteListEntry = {
        email,
        addedBy: profile.email,
        addedAt: new Date()
      };
      await setDoc(whitelistDoc, entry);
      setWhitelist(prev => [...prev, entry]);
      setNewEmail('');
    } catch (error) {
      console.error("Error adding to whitelist:", error);
      handleFirestoreError(error, OperationType.CREATE, 'whitelist');
    } finally {
      setIsAddingEmail(false);
    }
  };

  const removeFromWhitelist = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'whitelist', email));
      setWhitelist(prev => prev.filter(e => e.email !== email));
    } catch (error) {
      console.error("Error removing from whitelist:", error);
      handleFirestoreError(error, OperationType.DELETE, `whitelist/${email}`);
    }
  };

  const removeFromBlocked = async (email: string) => {
    try {
      await deleteDoc(doc(db, 'blocked_emails', email));
      setBlockedEmails(prev => prev.filter(e => e.email !== email));
    } catch (error) {
      console.error("Error removing from blocked list:", error);
      handleFirestoreError(error, OperationType.DELETE, `blocked_emails/${email}`);
    }
  };

  const handleApprovePayment = async (request: PaymentRequest) => {
    try {
      const userRef = doc(db, 'users', request.uid);
      const expiryDays = Number(config?.featureExpiryDays?.pro ?? 30);
      const expiryDate = expiryDays > 0 ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) : null;

      await updateDoc(userRef, {
        plan: 'pro',
        subscriptionExpiry: expiryDate,
        updatedAt: new Date()
      });

      await updateDoc(doc(db, 'payment_requests', request.id), {
        status: 'approved',
        processedAt: new Date()
      });

      setPayments(prev => prev.map(p => p.id === request.id ? { ...p, status: 'approved' } : p));
      setUsers(prev => prev.map(u => u.uid === request.uid ? { ...u, plan: 'pro', subscriptionExpiry: expiryDate } : u));
    } catch (error) {
      console.error("Error approving payment:", error);
    }
  };

  const handleRejectPayment = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'payment_requests', requestId), {
        status: 'rejected',
        processedAt: new Date()
      });
      setPayments(prev => prev.map(p => p.id === requestId ? { ...p, status: 'rejected' } : p));
    } catch (error) {
      console.error("Error rejecting payment:", error);
    }
  };

  const handleApproveRequest = async (request: any) => {
    try {
      const email = request.email.toLowerCase().trim();
      // 1. Add to whitelist
      await setDoc(doc(db, 'whitelist', email), {
        email,
        addedBy: profile?.email || 'admin',
        addedAt: new Date()
      });
      // 2. Remove from requests
      await deleteDoc(doc(db, 'access_requests', email));
      // 3. Update state
      setAccessRequests(prev => prev.filter(r => r.email !== email));
      setWhitelist(prev => [...prev, { email, addedBy: profile?.email || 'admin', addedAt: new Date() }]);
    } catch (error) {
      console.error("Error approving request:", error);
    }
  };

  const handleRejectRequest = async (request: any) => {
    try {
      const email = request.email.toLowerCase().trim();
      // 1. Add to blocked
      await setDoc(doc(db, 'blocked_emails', email), {
        email,
        blockedBy: profile?.email || 'admin',
        blockedAt: new Date()
      });
      // 2. Remove from requests
      await deleteDoc(doc(db, 'access_requests', email));
      // 3. Update state
      setAccessRequests(prev => prev.filter(r => r.email !== email));
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  const handleSyncKeys = async () => {
    setIsSyncing(true);
    try {
      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        alert("Action failed: No user currently authenticated.");
        setIsSyncing(false);
        return;
      }
      const response = await fetch('/api/admin/sync-keys', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        alert(`Synchronized ${data.count} keys to server.`);
      } else {
        alert("Sync failed.");
      }
    } catch (error) {
      console.error("Sync error:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="h-10 w-10 animate-spin text-primary" /></div>;

  if (!isModerator) {
    return (
      <div className="flex flex-col items-center justify-center p-20 space-y-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h2 className="text-2xl font-bold">Access Denied</h2>
        <p className="text-slate-500">You do not have permission to view the Admin Control Center.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black tracking-tighter">Admin Control Center</h1>
          <p className="text-slate-500 text-lg">Manage features, user plans, and global application settings.</p>
        </div>
        <div className="flex gap-3">
          <Button 
            variant={activeAdminTab === 'logs' ? 'default' : 'outline'} 
            className="rounded-xl h-12 font-bold" 
            onClick={() => setActiveAdminTab('logs')}
          >
            <History className="mr-2 h-4 w-4" /> System Logs
          </Button>
        </div>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit mb-8 overflow-x-auto max-w-full">
        {[
          { id: 'users', label: 'Users', icon: Users, ownerOnly: false },
          { id: 'doc_requests', label: "Doc's Requests", icon: FileText, ownerOnly: false },
          { id: 'requests', label: 'Access Requests', icon: MessageSquare, ownerOnly: false },
          { id: 'payments', label: 'Payments', icon: Receipt, ownerOnly: false },
          { id: 'tiers', label: 'Tiers & Features', icon: ShieldCheck, ownerOnly: true },
          { id: 'expiry', label: 'Expiry Limits', icon: Clock, ownerOnly: true },
          { id: 'whitelist', label: 'Whitelist', icon: UserPlus, ownerOnly: false },
          { id: 'logs', label: 'History', icon: History, ownerOnly: false }
        ].filter(tab => !tab.ownerOnly || isOwner).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveAdminTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest transition-all",
              activeAdminTab === tab.id 
                ? "bg-white text-primary shadow-sm" 
                : "text-slate-500 hover:text-slate-900"
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        {activeAdminTab === 'doc_requests' && (
          <DocRequestsManager 
            adminEmail={profile?.email || 'admin'} 
            adminConfig={config}
            onUpdatePricing={async (pricing, paymentInfo) => {
              await updateConfig({ documentPricing: pricing, paymentInfo });
            }}
          />
        )}

        {activeAdminTab === 'requests' && (
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
              <CardTitle className="flex items-center gap-3">
                <MessageSquare className="h-6 w-6 text-primary" />
                Access Requests
              </CardTitle>
              <CardDescription>Review and approve new user access requests to the platform.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100">
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Email Address</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Requested Date</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accessRequests.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="p-10 text-center text-slate-400">No pending access requests.</td>
                      </tr>
                    ) : (
                      accessRequests.map(req => (
                        <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-6">
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <Mail className="h-4 w-4 text-slate-300" />
                              {req.email}
                            </div>
                          </td>
                          <td className="p-6 text-sm text-slate-500">
                            {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleString() : new Date(req.requestedAt).toLocaleString()}
                          </td>
                          <td className="p-6 text-right">
                            <div className="flex justify-end gap-2">
                              <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 rounded-xl px-4"
                                onClick={() => handleApproveRequest(req)}
                              >
                                <Check className="h-4 w-4 mr-2" /> Approve
                              </Button>
                              <Button 
                                size="sm" 
                                variant="outline" 
                                className="text-red-500 border-red-200 hover:bg-red-50 rounded-xl px-4"
                                onClick={() => handleRejectRequest(req)}
                              >
                                <XIcon className="h-4 w-4 mr-2" /> Reject
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeAdminTab === 'payments' && (
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <CardTitle className="flex items-center gap-3">
                    <QrCode className="h-6 w-6 text-primary" />
                    Payment QR Configuration
                  </CardTitle>
                  <div className="flex gap-2 w-full md:w-auto">
                    <div className="relative group">
                      <Input 
                        type="file"
                        id="qr-upload"
                        className="hidden"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            const base64String = reader.result as string;
                            updateConfig({ paymentQrUrl: base64String });
                          };
                          reader.readAsDataURL(file);
                        }}
                      />
                      <label 
                        htmlFor="qr-upload"
                        className="inline-flex items-center justify-center gap-2 px-6 py-2 bg-primary text-white rounded-xl font-bold cursor-pointer hover:bg-primary/90 transition-all text-sm h-11"
                      >
                        <Upload className="h-4 w-4" />
                        Upload QR Image
                      </label>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-8">
                <div className="flex flex-col md:flex-row gap-8 items-center">
                  <div className="w-48 h-48 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden">
                    {config?.paymentQrUrl ? (
                      <img src={config.paymentQrUrl} alt="Payment QR" className="w-full h-full object-contain" />
                    ) : (
                      <QrCode className="h-12 w-12 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1 space-y-4">
                    <h3 className="font-bold text-lg">Active Payment Method</h3>
                    <p className="text-slate-500 text-sm">
                      Users will see this QR code in their dashboard when their trial expires or when they click "Upgrade to Pro". 
                      They will then upload proof of payment for your manual verification.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <CardTitle className="flex items-center gap-3">
                  <Receipt className="h-6 w-6 text-primary" />
                  Subscription Requests
                </CardTitle>
                <CardDescription>Verify and approve user payment proofs for manual plan upgrades.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100">
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">User</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Proof</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Date</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-10 text-center text-slate-400">No payment requests found.</td>
                        </tr>
                      ) : (
                        payments.map(req => (
                          <tr key={req.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                            <td className="p-6">
                              <p className="font-bold">{req.displayName}</p>
                              <p className="text-xs text-slate-500">{req.email}</p>
                            </td>
                            <td className="p-6">
                              <a href={req.proofUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-primary font-bold hover:underline">
                                <ImageIcon className="h-4 w-4" /> View Proof
                              </a>
                            </td>
                            <td className="p-6 text-sm text-slate-500">
                              {req.requestedAt?.toDate ? req.requestedAt.toDate().toLocaleString() : new Date(req.requestedAt).toLocaleString()}
                            </td>
                            <td className="p-6">
                              <span className={cn(
                                "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                                req.status === 'approved' ? "bg-green-100 text-green-700" :
                                req.status === 'rejected' ? "bg-red-100 text-red-700" : "bg-orange-100 text-orange-700"
                              )}>
                                {req.status}
                              </span>
                            </td>
                            <td className="p-6 text-right">
                              {req.status === 'pending' && (
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    size="sm" 
                                    className="bg-green-600 hover:bg-green-700 rounded-xl"
                                    onClick={() => handleApprovePayment(req)}
                                  >
                                    <Check className="h-4 w-4 mr-1" /> Approve
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="text-red-500 border-red-200 hover:bg-red-50 rounded-xl"
                                    onClick={() => handleRejectPayment(req.id)}
                                  >
                                    <XIcon className="h-4 w-4 mr-1" /> Reject
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {activeAdminTab === 'logs' && (
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
              <CardTitle className="flex items-center gap-3">
                <History className="h-6 w-6 text-primary" />
                Actions (System Logs)
              </CardTitle>
              <CardDescription>Real-time monitor of user behaviors and document generations across the platform.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100">
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">User</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Action Type</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Details</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Timestamp</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Link</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemLogs.map((log, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <p className="font-bold text-slate-900">{log.userDisplayName}</p>
                          <p className="text-[10px] text-slate-500">{log.userEmail}</p>
                        </td>
                        <td className="p-6">
                           <span className={cn(
                             "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-tighter",
                             log.type === 'document' ? "bg-blue-100 text-blue-700" :
                             log.type === 'payment' ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-600"
                           )}>
                             {log.type}
                           </span>
                        </td>
                        <td className="p-6">
                          <p className="text-sm font-medium text-slate-800">{log.detail}</p>
                          <p className="text-[10px] text-slate-400 italic capitalize">{log.action}</p>
                        </td>
                        <td className="p-6 text-xs text-slate-500 whitespace-nowrap">
                          {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString() : new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="p-6 text-right">
                          {log.link && (
                            <a href={log.link} target="_blank" rel="noreferrer">
                              <Button size="icon" variant="ghost" className="rounded-full h-8 w-8 text-primary">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeAdminTab === 'users' && (
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
              <CardTitle className="flex items-center gap-3">
                <Users className="h-6 w-6 text-primary" />
                User Management
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100">
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">User</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Current Plan</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Expiry</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">System Role</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(user => (
                      <tr key={user.uid} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-6">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden">
                              <img src={user.photoURL} alt="" className="w-full h-full object-cover" />
                            </div>
                            <div>
                              <p className="font-bold text-slate-900">{user.displayName}</p>
                              <p className="text-xs text-slate-500">{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-6">
                          <span className={cn(
                            "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                            user.plan === 'pro' ? "bg-blue-100 text-blue-700" : 
                            user.plan === 'freeTrial' ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-700"
                          )}>
                            {user.plan}
                          </span>
                        </td>
                        <td className="p-6 text-sm text-slate-500">
                          {user.subscriptionExpiry ? new Date(user.subscriptionExpiry).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="p-6">
                           <div className="flex gap-1.5">
                              {['user', 'moderator'].map(role => (
                                <button
                                  key={role}
                                  disabled={!isOwner || user.email === "arvin8786@gmail.com"}
                                  onClick={() => updateUserRole(user.uid, role)}
                                  className={cn(
                                    "px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter border transition-all",
                                    user.role === role || (!user.role && role === 'user')
                                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                                      : "bg-white text-slate-400 border-slate-200 hover:border-indigo-600 hover:text-indigo-600",
                                    (!isOwner || user.email === "arvin8786@gmail.com") && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  {role}
                                </button>
                              ))}
                              {user.email === "arvin8786@gmail.com" && (
                                <div className="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-black rounded-md border border-amber-200">
                                  OWNER
                                </div>
                              )}
                           </div>
                        </td>
                        <td className="p-6">
                          <div className="flex justify-center gap-1.5">
                            {PLAN_TIERS.map(tier => (
                                <button 
                                  key={tier.id}
                                  onClick={() => {
                                    const expiryDays = config?.featureExpiryDays?.[tier.id] || 0;
                                    const expiryDate = expiryDays > 0 
                                      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000) 
                                      : undefined;
                                    updateUserPlan(user.uid, tier.id, expiryDate);
                                  }}
                                  className={cn(
                                    "px-1.5 py-1 rounded-md text-[9px] font-black uppercase tracking-tighter border transition-all shrink-0",
                                    user.plan === tier.id 
                                      ? "bg-primary text-white border-primary" 
                                      : "bg-white text-slate-400 border-slate-200 hover:border-primary hover:text-primary"
                                  )}
                                >
                                  {tier.name.split(' ')[0]}
                                </button>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeAdminTab === 'whitelist' && (
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  Access Control (Whitelist)
                </CardTitle>
                <div className="flex gap-2 w-full md:w-auto">
                  <Input 
                    placeholder="User email address" 
                    value={newEmail}
                    onChange={e => setNewEmail(e.target.value)}
                    className="flex-1 md:w-64 rounded-xl border-slate-200"
                  />
                  <Button onClick={addToWhitelist} disabled={isAddingEmail} className="rounded-xl font-bold">
                    {isAddingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4 mr-2" />}
                    Add User
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100">
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Allowed Email</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Added By</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Date Added</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {whitelist.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-400 font-medium italic">
                          No users whitelisted. Only super-admins can access the tool.
                        </td>
                      </tr>
                    ) : (
                      whitelist.map(entry => (
                        <tr key={entry.email} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-6">
                            <div className="flex items-center gap-2 font-bold text-slate-900">
                              <Mail className="h-4 w-4 text-slate-300" />
                              {entry.email}
                            </div>
                          </td>
                          <td className="p-6 text-sm text-slate-500">{entry.addedBy}</td>
                          <td className="p-6 text-sm text-slate-500">
                            {entry.addedAt?.toDate ? entry.addedAt.toDate().toLocaleDateString() : new Date(entry.addedAt).toLocaleDateString()}
                          </td>
                          <td className="p-6 text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600"
                              onClick={() => removeFromWhitelist(entry.email)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden mt-8">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
              <CardTitle className="flex items-center gap-3">
                <AlertCircle className="h-6 w-6 text-red-500" />
                Blocked List
              </CardTitle>
              <CardDescription>Users who have been rejected or manually blocked from accessing the platform.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/30 border-b border-slate-100">
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Blocked Email</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Blocked By</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Date Blocked</th>
                      <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blockedEmails.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="p-10 text-center text-slate-400 font-medium italic">
                          No users blocked.
                        </td>
                      </tr>
                    ) : (
                      blockedEmails.map(entry => (
                        <tr key={entry.email} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-6 font-bold text-slate-900">{entry.email}</td>
                          <td className="p-6 text-sm text-slate-500">{entry.blockedBy}</td>
                          <td className="p-6 text-sm text-slate-500">
                            {entry.blockedAt?.toDate ? entry.blockedAt.toDate().toLocaleDateString() : new Date(entry.blockedAt).toLocaleDateString()}
                          </td>
                          <td className="p-6 text-right">
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="text-primary font-bold hover:bg-primary/5 rounded-xl px-4"
                              onClick={() => removeFromBlocked(entry.email)}
                            >
                              Unblock
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
        {activeAdminTab === 'tiers' && (
          <div className="space-y-8">
            <Card className="border border-amber-200/80 bg-amber-50/40 rounded-[2rem] p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5 text-amber-600" />
                    <h4 className="font-bold text-slate-900">Enforce Limits & Expiry on Administrator (Testing Mode)</h4>
                  </div>
                  <p className="text-xs text-slate-600 max-w-2xl">
                    When active, feature checkmarks, monthly document limits, and expiry dates strictly apply to your admin account based on your selected plan. This enables you to verify feature restriction behavior in real time.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">
                    {(config as any)?.enforceLimitsOnAdmin !== false ? 'Active' : 'Bypassed'}
                  </span>
                  <Switch 
                    checked={(config as any)?.enforceLimitsOnAdmin !== false} 
                    onCheckedChange={(val) => updateConfig({ enforceLimitsOnAdmin: val } as any)} 
                  />
                </div>
              </div>
            </Card>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <CardTitle className="flex items-center gap-3">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                  Three-Tier Feature Matrix
                </CardTitle>
                <CardDescription>Configure which plans have access to specific app functionalities.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/30 border-b border-slate-100">
                        <th className="p-6 text-xs font-black uppercase tracking-widest text-slate-400">Feature</th>
                        {PLAN_TIERS.filter(p => ['freeTrial', 'free', 'pro'].includes(p.id)).map(tier => (
                          <th key={tier.id} className="p-6 text-xs font-black uppercase tracking-widest text-slate-400 text-center">
                            {tier.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {APP_FEATURES.map(feature => (
                        <tr key={feature.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                          <td className="p-6">
                            <p className="font-bold text-slate-900">{feature.name}</p>
                            <p className="text-xs text-slate-500">{feature.description}</p>
                          </td>
                          {['freeTrial', 'free', 'pro'].map(tierId => {
                            const isChecked = config?.featureTiers?.[feature.id]?.includes(tierId);
                            return (
                              <td key={tierId} className="p-6 text-center">
                                <input 
                                  type="checkbox"
                                  checked={!!isChecked}
                                  onChange={(e) => {
                                    const currentTiers = config?.featureTiers?.[feature.id] || [];
                                    const newTiers = e.target.checked 
                                      ? [...currentTiers, tierId]
                                      : currentTiers.filter(t => t !== tierId);
                                    
                                    updateConfig({
                                      featureTiers: {
                                        ...(config?.featureTiers || {}),
                                        [feature.id]: newTiers
                                      }
                                    });
                                  }}
                                  className="h-5 w-5 rounded-md border-slate-300 text-primary focus:ring-primary cursor-pointer"
                                />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="p-8">
                <CardTitle>Plan Usage Limits</CardTitle>
                <CardDescription>Set document generation caps for each plan type. Once reached, document generation stops.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 pt-0 grid grid-cols-1 md:grid-cols-3 gap-6">
                {['freeTrial', 'free', 'pro'].map(tierId => (
                  <div key={tierId} className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 capitalize">{tierId} Docs/Month</label>
                    <Input 
                      type="number" 
                      min="0"
                      value={config?.planLimits?.[tierId as keyof typeof config.planLimits]?.docsPerMonth ?? ''} 
                      onChange={e => {
                        const raw = e.target.value;
                        const val = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                        updateConfig({
                          planLimits: {
                            ...(config?.planLimits || {}),
                            [tierId]: { docsPerMonth: val }
                          } as any
                        });
                      }}
                      className="rounded-xl border-slate-200"
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {activeAdminTab === 'expiry' && (
          <div className="space-y-8">
            <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden">
              <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-8">
                <CardTitle className="flex items-center gap-3">
                  <Clock className="h-6 w-6 text-primary" />
                  Feature & Plan Expiry Settings
                </CardTitle>
                <CardDescription>Set how many days a trial, plan, or specific feature should last. Once expired, features will stop working.</CardDescription>
              </CardHeader>
              <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary">Base Plan Expiry</h3>
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Free Trial Duration (Days)</label>
                      <Input 
                        type="number"
                        min="0"
                        placeholder="0 = Never"
                        value={config?.featureExpiryDays?.freeTrial ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                          updateConfig({
                            featureExpiryDays: { ...(config?.featureExpiryDays || {}), freeTrial: val }
                          });
                        }}
                        className="rounded-xl border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Free Plan Duration (Days)</label>
                      <Input 
                        type="number"
                        min="0"
                        placeholder="0 = Never"
                        value={config?.featureExpiryDays?.free ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                          updateConfig({
                            featureExpiryDays: { ...(config?.featureExpiryDays || {}), free: val }
                          });
                        }}
                        className="rounded-xl border-slate-200"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Pro Plan Duration (Days)</label>
                      <Input 
                        type="number"
                        min="0"
                        placeholder="0 = Never"
                        value={config?.featureExpiryDays?.pro ?? 0}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const val = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                          updateConfig({
                            featureExpiryDays: { ...(config?.featureExpiryDays || {}), pro: val }
                          });
                        }}
                        className="rounded-xl border-slate-200"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="space-y-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-primary">Feature Specific Timeouts</h3>
                  <div className="max-h-[400px] overflow-y-auto pr-4 space-y-4">
                    {APP_FEATURES.map(feature => (
                      <div key={feature.id} className="flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 truncate">{feature.name}</p>
                          <p className="text-[10px] text-slate-500">Days until access expires (0 = Never)</p>
                        </div>
                        <Input 
                          type="number"
                          min="0"
                          placeholder="0 = Never"
                          value={config?.featureExpiryDays?.[feature.id] ?? 0}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const val = raw === '' ? 0 : Math.max(0, parseInt(raw) || 0);
                            updateConfig({
                              featureExpiryDays: { ...(config?.featureExpiryDays || {}), [feature.id]: val }
                            });
                          }}
                          className="w-24 rounded-xl border-slate-200"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
