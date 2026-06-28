import {
  collection, addDoc, getDocs,
  query, orderBy, onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import type { Feedback } from '../types';

// ─── In-memory store for demo mode ───────────────────────────────────────────
function loadData<T>(key: string, parseDates: (data: any) => any = d => d): T[] {
  try {
    const data = localStorage.getItem(key);
    if (!data) return [];
    return JSON.parse(data).map(parseDates);
  } catch {
    return [];
  }
}

function saveData(key: string, data: any) {
  localStorage.setItem(key, JSON.stringify(data));
}

let memoryFeedbacks: Feedback[] = loadData('eventmind_feedbacks', f => ({
  ...f,
  submittedAt: new Date(f.submittedAt),
}));

let feedbackListeners: Array<(feedbacks: Feedback[]) => void> = [];

function notifyFeedbackListeners() {
  saveData('eventmind_feedbacks', memoryFeedbacks);
  feedbackListeners.forEach(cb => cb([...memoryFeedbacks]));
}

// Listen for cross-tab changes
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'eventmind_feedbacks') {
      memoryFeedbacks = loadData('eventmind_feedbacks', f => ({
        ...f,
        submittedAt: new Date(f.submittedAt),
      }));
      feedbackListeners.forEach(cb => cb([...memoryFeedbacks]));
    }
  });
}

// ─── Submit Feedback ─────────────────────────────────────────────────────────
export async function submitFeedback(feedbackData: Omit<Feedback, 'id' | 'submittedAt'>): Promise<Feedback> {
  if (isFirebaseConfigured() && db) {
    const feedbacksRef = collection(db, 'feedbacks');
    
    const docRef = await addDoc(feedbacksRef, {
      ...feedbackData,
      submittedAt: serverTimestamp(),
    });
    
    return { 
      ...feedbackData, 
      id: docRef.id, 
      submittedAt: new Date() 
    } as Feedback;
  }

  // Demo mode
  const newFeedback: Feedback = {
    ...feedbackData,
    id: `fb_${Date.now()}`,
    submittedAt: new Date(),
  };

  memoryFeedbacks = [newFeedback, ...memoryFeedbacks];
  notifyFeedbackListeners();
  return newFeedback;
}

// ─── Listen to Feedback ──────────────────────────────────────────────────────
export function subscribeToFeedbacks(callback: (feedbacks: Feedback[]) => void) {
  if (isFirebaseConfigured() && db) {
    const q = query(collection(db, 'feedbacks'), orderBy('submittedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const feedbacks = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          submittedAt: data.submittedAt?.toDate() || new Date(),
        } as Feedback;
      });
      callback(feedbacks);
    }, (error) => {
      console.error("Error fetching feedbacks:", error);
      callback([]);
    });
  }

  // Demo mode
  feedbackListeners.push(callback);
  callback([...memoryFeedbacks]);
  
  return () => {
    feedbackListeners = feedbackListeners.filter(cb => cb !== callback);
  };
}
