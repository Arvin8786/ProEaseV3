import { db } from './firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { DocumentRequest, AdminConfig, UserProfile } from '@/types';
import { saveGeneratedDoc, GeneratedDoc } from './documentStorage';
import { 
  generateResume, 
  generateTailoredResume,
  generateCoverLetter, 
  generateResignationLetter 
} from '@/services/gemini';
import { cleanDocumentAsterisks } from './limits';

export const DEFAULT_PRICING = {
  resume: 1, // RM 1.00
  cover_letter: 1, // RM 1.00
  tailored_resume: 1, // RM 1.00
  resignation: 1 // RM 1.00
};

export const DEFAULT_BANKING_DETAILS = {
  bankName: 'Maybank',
  accountNumber: '102037147223',
  accountHolder: 'Arvinderan A/L M Ganeson',
  duitNowNumber: '102037147223',
  instructions: 'Transfer RM 1.00 to Maybank (102037147223) or DuitNow: Arvinderan A/L M Ganeson. Put your Transaction ID as payment reference.'
};

export function getDocumentPrice(
  docType: 'resume' | 'cover_letter' | 'tailored_resume' | 'resignation',
  adminConfig?: AdminConfig | null
): number {
  if (adminConfig?.documentPricing && typeof adminConfig.documentPricing[docType] === 'number') {
    return adminConfig.documentPricing[docType];
  }
  return DEFAULT_PRICING[docType] ?? 1;
}

export function generateTransactionId(): string {
  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${dateStr}-${randomSuffix}`;
}

/**
 * Creates a new Document Request with a unique transaction ID and locked draft.
 */
export async function createDocumentRequest({
  userId,
  userEmail,
  userName,
  docType,
  title,
  amount,
  draftContent,
  params
}: {
  userId: string;
  userEmail: string;
  userName: string;
  docType: 'resume' | 'cover_letter' | 'tailored_resume' | 'resignation';
  title: string;
  amount: number;
  draftContent: string;
  params?: any;
}): Promise<DocumentRequest> {
  const reqRef = doc(collection(db, 'document_requests'));
  const transactionId = generateTransactionId();

  const newRequest: DocumentRequest = {
    id: reqRef.id,
    transactionId,
    userId,
    userEmail,
    userName: userName || userEmail.split('@')[0],
    docType,
    title,
    amount,
    currency: 'RM',
    status: 'pending_approval',
    paymentStatus: 'unpaid',
    draftContent,
    params: params || {},
    createdAt: new Date(),
    updatedAt: new Date()
  };

  await setDoc(reqRef, {
    ...newRequest,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return newRequest;
}

/**
 * Submits payment proof / reference for a transaction.
 */
export async function submitPaymentProof(
  requestId: string,
  paymentProofRef: string,
  paymentProofUrl?: string
): Promise<void> {
  const reqRef = doc(db, 'document_requests', requestId);
  await updateDoc(reqRef, {
    paymentStatus: 'paid',
    paymentProofRef,
    ...(paymentProofUrl ? { paymentProofUrl } : {}),
    updatedAt: serverTimestamp()
  });
}

/**
 * Admin action: Approves request and generates the official document & PDF.
 * Supports Admin Free Bypass option to waive charges completely.
 */
export async function approveAndGenerateOfficialDoc(
  request: DocumentRequest,
  adminEmail: string,
  profileData?: UserProfile | null,
  options?: { isFreeBypass?: boolean }
): Promise<{ success: boolean; docId?: string; error?: string }> {
  try {
    // Preserve the exact approved draft content without ripping off AI API quota
    let finalContent = cleanDocumentAsterisks(request.draftContent || '');

    // Fallback: If draftContent was somehow empty, only then generate fallback content
    if (!finalContent && profileData) {
      try {
        const p = request.params || {};
        if (request.docType === 'tailored_resume') {
          const targetRole = p.tailoredJobTitle || p.futureJobTitle || p.position || 'Target Position';
          const generated = await generateTailoredResume(profileData, targetRole, p.tailoredCompany, p.tailoredJobDesc);
          if (generated) finalContent = cleanDocumentAsterisks(generated);
        } else if (request.docType === 'resume') {
          const targetRole = p.futureJobTitle || p.position || p.jobTitle;
          const generated = await generateResume(profileData, targetRole);
          if (generated) finalContent = cleanDocumentAsterisks(generated);
        } else if (request.docType === 'cover_letter') {
          const generated = await generateCoverLetter(profileData, p.clCompany || '', p.clJobTitle || '');
          if (generated) finalContent = cleanDocumentAsterisks(generated);
        } else if (request.docType === 'resignation') {
          const generated = await generateResignationLetter(
            profileData, 
            p.resignCompany || '', 
            p.noticePeriod || '1 month', 
            p.resignReason || ''
          );
          if (generated) finalContent = cleanDocumentAsterisks(generated);
        }
      } catch (apiErr) {
        console.warn("Fallback generation encountered error:", apiErr);
      }
    }

    const isFreeBypass = Boolean(options?.isFreeBypass);

    // Save official unlocked document into user's repository
    const savedDocId = await saveGeneratedDoc(
      request.userId,
      {
        type: request.docType,
        title: request.title,
        content: finalContent,
        params: {
          ...request.params,
          transactionId: request.transactionId,
          amount: isFreeBypass ? 0 : request.amount,
          isFreeBypass,
          approvedBy: adminEmail,
          requestId: request.id
        }
      }
    );

    // Update document request in Firestore
    const reqRef = doc(db, 'document_requests', request.id);
    await updateDoc(reqRef, {
      status: 'approved',
      paymentStatus: isFreeBypass ? 'waived' : 'verified',
      isBypassed: isFreeBypass,
      finalContent,
      approvedAt: serverTimestamp(),
      approvedBy: adminEmail,
      updatedAt: serverTimestamp()
    });

    return { success: true, docId: savedDocId || request.id };
  } catch (err: any) {
    console.error("Error approving document request:", err);
    return { success: false, error: err.message || "Failed to approve and render document" };
  }
}

/**
 * Admin action: Rejects a document request with reason.
 */
export async function rejectDocumentRequest(
  requestId: string,
  reason: string,
  adminEmail: string
): Promise<void> {
  const reqRef = doc(db, 'document_requests', requestId);
  await updateDoc(reqRef, {
    status: 'rejected',
    rejectedReason: reason,
    approvedBy: adminEmail,
    updatedAt: serverTimestamp()
  });
}
