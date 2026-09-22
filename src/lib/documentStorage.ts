import { 
  collection, 
  addDoc, 
  query, 
  where, 
  getDocs, 
  orderBy, 
  serverTimestamp,
  doc,
  deleteDoc,
  updateDoc
} from 'firebase/firestore';
import { db, OperationType, handleFirestoreError } from './firebase';

export interface GeneratedDoc {
  id: string;
  type: 'resume' | 'cover_letter' | 'resignation' | 'tailored_resume';
  title: string;
  content: string;
  params: any;
  createdAt: any;
}

const COLLECTION_NAME = 'generated_documents';

export async function saveGeneratedDoc(userId: string, docData: Omit<GeneratedDoc, 'id' | 'createdAt'>) {
  const path = `users/${userId}/${COLLECTION_NAME}`;
  try {
    const docRef = await addDoc(collection(db, path), {
      ...docData,
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getGeneratedDocs(userId: string): Promise<GeneratedDoc[]> {
  const path = `users/${userId}/${COLLECTION_NAME}`;
  try {
    const q = query(
      collection(db, path),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    })) as GeneratedDoc[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function deleteGeneratedDoc(userId: string, docId: string) {
  const path = `users/${userId}/${COLLECTION_NAME}/${docId}`;
  try {
    await deleteDoc(doc(db, `users/${userId}/${COLLECTION_NAME}`, docId));
  } catch (error) {
    console.warn(`Firestore delete for doc ${docId} caught error:`, error);
    // Attempt deletion with error logging, but don't prevent local state purge
    try {
      handleFirestoreError(error, OperationType.DELETE, path);
    } catch {
      // Swallowed to allow UI list to update reliably
    }
  }
}

export async function updateGeneratedDoc(userId: string, docId: string, updates: Partial<GeneratedDoc>) {
  const path = `users/${userId}/${COLLECTION_NAME}/${docId}`;
  try {
    const docRef = doc(db, `users/${userId}/${COLLECTION_NAME}`, docId);
    
    // Clean updates: avoid sending immutable fields or fields that cause schema/permission mismatches
    const cleanUpdates = { ...updates };
    delete (cleanUpdates as any).id;
    delete (cleanUpdates as any).createdAt;
    
    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function findCachedDoc(userId: string, type: string, params: any): Promise<GeneratedDoc | null> {
  const path = `users/${userId}/${COLLECTION_NAME}`;
  try {
    // Note: Firestore doesn't support complex object equality in queries well for nested objects
    // So we'll fetch and filter in memory for small history, or just query by type and check params
    const q = query(
      collection(db, path),
      where('type', '==', type),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Simple deep equality check for params
    const match = docs.find(d => JSON.stringify((d as any).params) === JSON.stringify(params));
    return match ? {
      ...(match as any),
      createdAt: (match as any).createdAt?.toDate() || new Date()
    } : null;
  } catch (error) {
    console.error("Cache look-up failed", error);
    return null;
  }
}
