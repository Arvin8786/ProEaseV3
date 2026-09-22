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
import { ScheduledMessage } from '@/types';

const COLLECTION_NAME = 'scheduled_messages';

export async function scheduleMessage(userId: string, data: Omit<ScheduledMessage, 'id' | 'createdAt' | 'status' | 'userId'>) {
  const path = `users/${userId}/${COLLECTION_NAME}`;
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      userId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function getScheduledMessages(userId: string): Promise<ScheduledMessage[]> {
  const path = `users/${userId}/${COLLECTION_NAME}`;
  try {
    const q = query(
      collection(db, path),
      orderBy('scheduledAt', 'asc')
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      scheduledAt: doc.data().scheduledAt // Assuming it's already a ISO string from UI or we convert it
    })) as ScheduledMessage[];
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
}

export async function markMessageAsSent(userId: string, msgId: string) {
  const path = `users/${userId}/${COLLECTION_NAME}/${msgId}`;
  try {
    await updateDoc(doc(db, `users/${userId}/${COLLECTION_NAME}`, msgId), {
      status: 'sent'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function cancelMessage(userId: string, msgId: string) {
  const path = `users/${userId}/${COLLECTION_NAME}/${msgId}`;
  try {
    await updateDoc(doc(db, `users/${userId}/${COLLECTION_NAME}`, msgId), {
      status: 'cancelled'
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}
