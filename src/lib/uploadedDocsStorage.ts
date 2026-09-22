import { 
  collection, 
  doc, 
  setDoc, 
  getDocs, 
  deleteDoc, 
  serverTimestamp, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { db } from './firebase';
import { UploadedDocument, UploadedDocCategory } from '@/types';

const LOCAL_STORAGE_KEY_PREFIX = 'careerforge_uploaded_docs_';
const IDB_NAME = 'careerforge_uploaded_docs_db';
const IDB_STORE = 'documents';
const IDB_VERSION = 1;

/**
 * Open IndexedDB safely for robust offline / large file binary persistence.
 */
function openIDB(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') {
      return resolve(null);
    }
    try {
      const request = indexedDB.open(IDB_NAME, IDB_VERSION);
      request.onupgradeneeded = () => {
        const dbInstance = request.result;
        if (!dbInstance.objectStoreNames.contains(IDB_STORE)) {
          dbInstance.createObjectStore(IDB_STORE, { keyPath: 'id' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => {
        console.warn("IndexedDB open failed, falling back to localStorage:", request.error);
        resolve(null);
      };
    } catch (e) {
      resolve(null);
    }
  });
}

async function saveToIDB(documentItem: UploadedDocument): Promise<void> {
  try {
    const idb = await openIDB();
    if (!idb) return;
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.put(documentItem);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not save to IndexedDB:", err);
  }
}

async function getFromIDB(id: string): Promise<UploadedDocument | null> {
  try {
    const idb = await openIDB();
    if (!idb) return null;
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get(id);
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

async function getAllFromIDB(): Promise<UploadedDocument[]> {
  try {
    const idb = await openIDB();
    if (!idb) return [];
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.getAll();
    return new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

async function deleteFromIDB(id: string): Promise<void> {
  try {
    const idb = await openIDB();
    if (!idb) return;
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    store.delete(id);
  } catch (err) {
    console.warn("Could not delete from IndexedDB:", err);
  }
}

/**
 * Remove all `undefined` values from an object before saving to Firestore.
 * Firestore setDoc() and updateDoc() throw an uncaught exception if any field is undefined.
 */
function sanitizeFirestorePayload(obj: Record<string, any>): Record<string, any> {
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue; // Skip undefined keys completely
    }
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
      // Check if it's a Firestore FieldValue like serverTimestamp()
      if ('_methodName' in value || '_delegate' in value || key.includes('Timestamp')) {
        sanitized[key] = value;
      } else {
        sanitized[key] = sanitizeFirestorePayload(value);
      }
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const CATEGORY_LABELS: Record<UploadedDocCategory, string> = {
  offer_letter: 'Offer Letter',
  payslip: 'Payslip / Salary Slip',
  employment_contract: 'Employment Contract',
  resignation_acceptance: 'Resignation Acceptance',
  education_cert: 'Academic / Degree Certificate',
  tax_ea_form: 'Tax / EA / SOCSO / EPF Form',
  other: 'Other Important Document'
};

export const CATEGORY_COLORS: Record<UploadedDocCategory, { bg: string; text: string; border: string }> = {
  offer_letter: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  payslip: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  employment_contract: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  resignation_acceptance: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  education_cert: { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  tax_ea_form: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  other: { bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200' }
};

/**
 * Save an uploaded document to Firestore in cloud and local cache.
 */
export async function saveUploadedDoc(
  userId: string,
  docData: Omit<UploadedDocument, 'id' | 'createdAt'>
): Promise<string> {
  const docId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const now = new Date().toISOString();

  // Normalize document with safe default strings to prevent any undefined values
  const newDoc: UploadedDocument = {
    id: docId,
    userId,
    category: docData.category,
    title: (docData.title || 'Untitled Document').trim(),
    description: (docData.description || '').trim(),
    fileName: docData.fileName || 'document.pdf',
    fileSize: docData.fileSize || 0,
    fileType: docData.fileType || 'application/octet-stream',
    fileData: docData.fileData || '',
    companyName: (docData.companyName || '').trim(),
    issueDate: (docData.issueDate || '').trim(),
    notes: (docData.notes || '').trim(),
    createdAt: now,
    updatedAt: now
  };

  // 1. Save full document to IndexedDB (handles files of any size without 5MB quota errors)
  await saveToIDB(newDoc);

  // 2. Save to local storage for quick access
  try {
    const localDocs = getLocalUploadedDocs(userId);
    const updated = [newDoc, ...localDocs.filter(d => d.id !== docId)];
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updated));
  } catch (err) {
    console.warn("Failed saving uploaded doc to localStorage:", err);
  }

  // 3. Persist to Firestore Cloud Database
  if (db && userId) {
    try {
      const docRef = doc(db, 'users', userId, 'uploaded_documents', docId);

      // Firestore document max limit is 1,048,576 bytes.
      // If fileData exceeds ~750KB Base64, we store metadata in Firestore and keep the binary in IDB.
      const isLargeFile = (newDoc.fileData?.length || 0) > 750000;
      const fileDataToPersist = isLargeFile ? '' : newDoc.fileData;

      const firestorePayload = sanitizeFirestorePayload({
        id: newDoc.id,
        userId: newDoc.userId,
        category: newDoc.category,
        title: newDoc.title,
        description: newDoc.description || '',
        fileName: newDoc.fileName,
        fileSize: newDoc.fileSize,
        fileType: newDoc.fileType,
        fileData: fileDataToPersist,
        isLargeFile: isLargeFile,
        companyName: newDoc.companyName || '',
        issueDate: newDoc.issueDate || '',
        notes: newDoc.notes || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      await setDoc(docRef, firestorePayload);
    } catch (err: any) {
      console.error("Error saving uploaded doc to Firestore:", err);
      // Re-throw with user-friendly context if needed
      throw new Error(`Cloud save warning: ${err.message || "Failed to persist document to Firestore"}`);
    }
  }

  return docId;
}

/**
 * Get all uploaded documents for a user.
 */
export async function getUploadedDocs(userId: string): Promise<UploadedDocument[]> {
  const localDocs = getLocalUploadedDocs(userId);
  const idbDocs = await getAllFromIDB();

  if (!db || !userId) {
    return localDocs.length > 0 ? localDocs : idbDocs;
  }

  try {
    const colRef = collection(db, 'users', userId, 'uploaded_documents');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const cloudDocs = await Promise.all(snapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let fileData = data.fileData || '';
        
        // If fileData is empty (large file), restore from IndexedDB or localDocs
        if (!fileData) {
          const idbMatch = await getFromIDB(docSnap.id);
          const localMatch = localDocs.find(d => d.id === docSnap.id);
          fileData = idbMatch?.fileData || localMatch?.fileData || '';
        }

        return {
          id: docSnap.id,
          userId: data.userId || userId,
          category: data.category || 'other',
          title: data.title || 'Untitled Document',
          fileName: data.fileName || 'document.pdf',
          fileSize: data.fileSize || 0,
          fileType: data.fileType || 'application/octet-stream',
          fileData,
          description: data.description || '',
          companyName: data.companyName || '',
          issueDate: data.issueDate || '',
          notes: data.notes || '',
          elements: data.elements || [],
          isLargeFile: Boolean(data.isLargeFile),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : data.createdAt || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().toISOString() : data.updatedAt || undefined
        } as UploadedDocument;
      }));

      // Update local cache
      try {
        localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(cloudDocs));
      } catch (e) {
        // quota exceeded fallback
      }

      return cloudDocs;
    }
  } catch (err) {
    console.warn("Error fetching uploaded docs from Firestore, using local cache:", err);
  }

  return localDocs.length > 0 ? localDocs : idbDocs;
}

/**
 * Get uploaded documents from local storage.
 */
export function getLocalUploadedDocs(userId: string): UploadedDocument[] {
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed to read local uploaded docs:", err);
  }
  return [];
}

/**
 * Update an existing uploaded document (e.g. after adding signatures, text overlays, or profile details).
 */
export async function updateUploadedDoc(
  userId: string,
  docId: string,
  updates: Partial<UploadedDocument>
): Promise<UploadedDocument> {
  const localDocs = getLocalUploadedDocs(userId);
  const idbDoc = await getFromIDB(docId);
  const existing = localDocs.find(d => d.id === docId) || idbDoc;

  const now = new Date().toISOString();
  const updatedDoc: UploadedDocument = {
    ...(existing || {}),
    ...updates,
    id: docId,
    userId,
    updatedAt: now
  } as UploadedDocument;

  // 1. Update in IndexedDB
  await saveToIDB(updatedDoc);

  // 2. Update in localStorage
  try {
    const updatedList = localDocs.map(d => d.id === docId ? updatedDoc : d);
    if (!localDocs.some(d => d.id === docId)) {
      updatedList.unshift(updatedDoc);
    }
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(updatedList));
  } catch (err) {
    console.warn("Failed updating local storage on edit:", err);
  }

  // 3. Update in Firestore
  if (db && userId) {
    try {
      const docRef = doc(db, 'users', userId, 'uploaded_documents', docId);
      const isLargeFile = (updatedDoc.fileData?.length || 0) > 750000;
      const fileDataToPersist = isLargeFile ? '' : updatedDoc.fileData;

      const firestorePayload = sanitizeFirestorePayload({
        userId: updatedDoc.userId,
        category: updatedDoc.category,
        title: updatedDoc.title,
        description: updatedDoc.description || '',
        fileName: updatedDoc.fileName,
        fileSize: updatedDoc.fileSize,
        fileType: updatedDoc.fileType,
        fileData: fileDataToPersist,
        isLargeFile,
        companyName: updatedDoc.companyName || '',
        issueDate: updatedDoc.issueDate || '',
        notes: updatedDoc.notes || '',
        elements: updatedDoc.elements || [],
        updatedAt: serverTimestamp()
      });

      await setDoc(docRef, firestorePayload, { merge: true });
    } catch (err: any) {
      console.error("Error updating uploaded doc in Firestore:", err);
      throw new Error(`Cloud update warning: ${err.message || "Failed to update document in Firestore"}`);
    }
  }

  return updatedDoc;
}

/**
 * Delete an uploaded document permanently.
 */
export async function deleteUploadedDoc(userId: string, docId: string): Promise<void> {
  // 1. Remove from IndexedDB
  await deleteFromIDB(docId);

  // 2. Remove from local storage
  try {
    const local = getLocalUploadedDocs(userId);
    const filtered = local.filter(d => d.id !== docId);
    localStorage.setItem(`${LOCAL_STORAGE_KEY_PREFIX}${userId}`, JSON.stringify(filtered));
  } catch (err) {
    console.warn("Failed updating local storage on delete:", err);
  }

  // 3. Remove from Firestore
  if (db && userId) {
    try {
      const docRef = doc(db, 'users', userId, 'uploaded_documents', docId);
      await deleteDoc(docRef);
    } catch (err) {
      console.error("Error deleting uploaded doc from Firestore:", err);
      throw err;
    }
  }
}

/**
 * Direct file download without using any AI API or quota.
 */
export function downloadUploadedDocFile(docItem: UploadedDocument): void {
  try {
    const link = document.createElement('a');
    link.href = docItem.fileData;
    link.download = docItem.fileName || `${docItem.title}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } catch (err) {
    console.error("Error initiating direct file download:", err);
    // Fallback: open in new tab
    const newWindow = window.open();
    if (newWindow) {
      newWindow.document.write(`<iframe src="${docItem.fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    }
  }
}

/**
 * Convert dataURL to Blob for sharing.
 */
export function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/octet-stream';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

/**
 * Share document directly to WhatsApp or social platforms.
 */
export async function shareUploadedDoc(
  docItem: UploadedDocument,
  platform: 'whatsapp' | 'email' | 'telegram' | 'native' | 'copy'
): Promise<{ success: boolean; message?: string }> {
  const categoryLabel = CATEGORY_LABELS[docItem.category] || 'Document';
  const companyInfo = docItem.companyName ? `\n🏢 *Company:* ${docItem.companyName}` : '';
  const dateInfo = docItem.issueDate ? `\n📅 *Issued / Dated:* ${docItem.issueDate}` : '';
  const descInfo = docItem.description ? `\n📝 *Notes:* ${docItem.description}` : '';

  const shareText = `📄 *${docItem.title}*\n📂 *Category:* ${categoryLabel}${companyInfo}${dateInfo}${descInfo}\n📎 *File:* ${docItem.fileName}`;

  if (platform === 'native') {
    if (navigator.share) {
      try {
        // Try sharing file object if supported
        const blob = dataURLtoBlob(docItem.fileData);
        const file = new File([blob], docItem.fileName, { type: docItem.fileType || blob.type });

        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: docItem.title,
            text: shareText
          });
          return { success: true };
        } else {
          await navigator.share({
            title: docItem.title,
            text: shareText
          });
          return { success: true };
        }
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return { success: true };
        }
        console.warn("Native share failed, falling back to WhatsApp link:", err);
      }
    }
    // Fall back to WhatsApp
    return shareUploadedDoc(docItem, 'whatsapp');
  }

  if (platform === 'whatsapp') {
    const encoded = encodeURIComponent(shareText);
    const whatsappUrl = `https://wa.me/?text=${encoded}`;
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    return { success: true };
  }

  if (platform === 'telegram') {
    const encoded = encodeURIComponent(shareText);
    const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.origin)}&text=${encoded}`;
    window.open(telegramUrl, '_blank', 'noopener,noreferrer');
    return { success: true };
  }

  if (platform === 'email') {
    const subject = encodeURIComponent(`${categoryLabel}: ${docItem.title}`);
    const body = encodeURIComponent(
      `Dear Sir/Madam,\n\nPlease find attached the details of my career document:\n\nDocument: ${docItem.title}\nCategory: ${categoryLabel}${docItem.companyName ? `\nCompany: ${docItem.companyName}` : ''}${docItem.issueDate ? `\nDate: ${docItem.issueDate}` : ''}${docItem.description ? `\nNotes: ${docItem.description}` : ''}\nFile Name: ${docItem.fileName}\n\nKind regards,\nShared via CareerForge`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    return { success: true };
  }

  if (platform === 'copy') {
    try {
      await navigator.clipboard.writeText(shareText);
      return { success: true, message: 'Document details copied to clipboard!' };
    } catch (err) {
      return { success: false, message: 'Could not copy to clipboard' };
    }
  }

  return { success: false };
}
