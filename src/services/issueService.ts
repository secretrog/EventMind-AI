import {
  collection, doc, addDoc, updateDoc, getDocs,
  query, where, orderBy, onSnapshot,
  serverTimestamp, increment
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import type { Issue, IssueCategory, Priority, Participant, Alert, DashboardStats } from '../types';

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

let memoryIssues: Issue[] = loadData('eventmind_issues', i => ({
  ...i,
  reportedAt: new Date(i.reportedAt),
  updatedAt: new Date(i.updatedAt),
  resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : undefined,
}));
let memoryParticipants: Participant[] = loadData('eventmind_participants', p => ({
  ...p,
  joinedAt: new Date(p.joinedAt),
}));
let memoryAlerts: Alert[] = loadData('eventmind_alerts', a => ({
  ...a,
  createdAt: new Date(a.createdAt),
}));
let issueListeners: Array<(issues: Issue[]) => void> = [];
let alertListeners: Array<(alerts: Alert[]) => void> = [];

function notifyIssueListeners() {
  saveData('eventmind_issues', memoryIssues);
  issueListeners.forEach(cb => cb([...memoryIssues]));
}
function notifyAlertListeners() {
  saveData('eventmind_alerts', memoryAlerts);
  alertListeners.forEach(cb => cb([...memoryAlerts]));
}

// Listen for cross-tab changes in localStorage
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'eventmind_issues') {
      memoryIssues = loadData('eventmind_issues', i => ({
        ...i,
        reportedAt: new Date(i.reportedAt),
        updatedAt: new Date(i.updatedAt),
        resolvedAt: i.resolvedAt ? new Date(i.resolvedAt) : undefined,
      }));
      issueListeners.forEach(cb => cb([...memoryIssues]));
    }
    if (e.key === 'eventmind_alerts') {
      memoryAlerts = loadData('eventmind_alerts', a => ({
        ...a,
        createdAt: new Date(a.createdAt),
      }));
      alertListeners.forEach(cb => cb([...memoryAlerts]));
    }
    if (e.key === 'eventmind_participants') {
      memoryParticipants = loadData('eventmind_participants', p => ({
        ...p,
        joinedAt: new Date(p.joinedAt),
      }));
    }
  });
}

// ─── Duplicate detection ──────────────────────────────────────────────────────
function isSimilarIssue(existing: Issue, newCategory: IssueCategory, newLocation: string, eventId?: string): boolean {
  if (existing.eventId !== eventId) return false;
  const locationMatch = existing.location.toLowerCase() === newLocation.toLowerCase()
    || newLocation === 'Unknown' || existing.location === 'Unknown';
  return existing.category === newCategory && locationMatch && existing.status !== 'resolved';
}

// ─── Create or merge issue ────────────────────────────────────────────────────
export async function createOrMergeIssue(
  issueData: Partial<Issue>,
  participantSessionId: string,
  participantName: string,
  eventId?: string
): Promise<Issue> {
  const category = issueData.category || 'other';
  const location = issueData.location || 'Unknown';

  if (isFirebaseConfigured() && db) {
    // Firebase path
    const issuesRef = collection(db, 'issues');
    const q = query(issuesRef,
      where('category', '==', category)
    );
    const snapshot = await getDocs(q);
    const existing = snapshot.docs.find(d => {
      const data = d.data() as Issue;
      if (data.status !== 'open' && data.status !== 'in_progress') return false;
      return isSimilarIssue(data, category, location, eventId);
    });

    if (existing) {
      const existingData = existing.data() as Issue;
      if (!existingData.participantSessionIds?.includes(participantSessionId)) {
        await updateDoc(existing.ref, {
          affectedParticipants: increment(1),
          participantSessionIds: [...(existingData.participantSessionIds || []), participantSessionId],
          participantNames: [...(existingData.participantNames || []), participantName],
          updatedAt: serverTimestamp(),
          priority: escalatePriority(existingData.priority as Priority, existingData.affectedParticipants + 1),
        });
      }
      return { ...existingData, id: existing.id };
    }

    const newIssue: Omit<Issue, 'id'> = {
      eventId,
      title: issueData.title || 'General Issue',
      description: issueData.description || '',
      category,
      location,
      priority: issueData.priority || 'medium',
      status: 'open',
      sentiment: issueData.sentiment || 'negative',
      affectedParticipants: 1,
      participantSessionIds: [participantSessionId],
      participantNames: [participantName],
      reportedAt: new Date(),
      updatedAt: new Date(),
      keywords: issueData.keywords || [],
      recommendedAction: issueData.recommendedAction || '',
      rootCause: issueData.rootCause || '',
      followupSent: false,
      rating: issueData.rating,
    };

    const docRef = await addDoc(issuesRef, {
      ...newIssue,
      reportedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return { ...newIssue, id: docRef.id };
  }

  // Demo mode
  const existingIdx = memoryIssues.findIndex(i =>
    isSimilarIssue(i, category, location, eventId)
  );

  if (existingIdx !== -1) {
    const existing = memoryIssues[existingIdx];
    
    // Removed strict session check to allow testing duplicate counts easily
    // if (existing.participantSessionIds.includes(participantSessionId)) {
    //   return existing;
    // }

    const updated: Issue = {
      ...existing,
      affectedParticipants: existing.affectedParticipants + 1,
      participantSessionIds: [...existing.participantSessionIds, participantSessionId],
      participantNames: [...existing.participantNames, participantName],
      updatedAt: new Date(),
      priority: escalatePriority(existing.priority, existing.affectedParticipants + 1),
    };
    memoryIssues[existingIdx] = updated;
    notifyIssueListeners();

    // Check for critical alert
    if (updated.affectedParticipants >= 3 && updated.priority === 'critical') {
      createAlert(updated);
    }

    return updated;
  }

  const newIssue: Issue = {
    id: `issue_${Date.now()}`,
    eventId,
    title: issueData.title || 'General Issue',
    description: issueData.description || '',
    category,
    location,
    priority: issueData.priority || 'medium',
    status: 'open',
    sentiment: issueData.sentiment || 'negative',
    affectedParticipants: 1,
    participantSessionIds: [participantSessionId],
    participantNames: [participantName],
    reportedAt: new Date(),
    updatedAt: new Date(),
    keywords: issueData.keywords || [],
    recommendedAction: issueData.recommendedAction || 'Investigate and address the reported issue',
    rootCause: issueData.rootCause || 'Participant-reported problem',
    followupSent: false,
    rating: issueData.rating,
  };

  memoryIssues.push(newIssue);
  notifyIssueListeners();
  return newIssue;
}

function escalatePriority(current: Priority, count: number): Priority {
  if (count >= 10) return 'critical';
  if (count >= 5) return current === 'low' ? 'medium' : current === 'medium' ? 'high' : 'critical';
  if (count >= 3 && current === 'low') return 'medium';
  return current;
}

function createAlert(issue: Issue) {
  const alert: Alert = {
    id: `alert_${Date.now()}`,
    issueId: issue.id,
    message: `🚨 ${issue.affectedParticipants} participants affected by ${issue.title}`,
    priority: issue.priority,
    createdAt: new Date(),
    acknowledged: false,
    suggestedAction: issue.recommendedAction || 'Immediate attention required',
  };
  memoryAlerts.unshift(alert);
  notifyAlertListeners();
}

// ─── Subscribe to issues (real-time) ─────────────────────────────────────────
export function subscribeToIssues(callback: (issues: Issue[]) => void, eventId?: string): () => void {
  if (isFirebaseConfigured() && db) {
    const q = query(collection(db, 'issues'), orderBy('reportedAt', 'desc'));
    return onSnapshot(q, snapshot => {
      let issues = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          reportedAt: data.reportedAt?.toDate ? data.reportedAt.toDate() : new Date(data.reportedAt || Date.now()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt || Date.now()),
          resolvedAt: data.resolvedAt?.toDate ? data.resolvedAt.toDate() : data.resolvedAt ? new Date(data.resolvedAt) : undefined,
        } as Issue;
      });
      if (eventId) issues = issues.filter(i => i.eventId === eventId);
      callback(issues);
    });
  }

  // Demo mode
  const wrappedCallback = (issues: Issue[]) => {
    callback(eventId ? issues.filter(i => i.eventId === eventId) : issues);
  };
  issueListeners.push(wrappedCallback);
  wrappedCallback([...memoryIssues]);
  return () => {
    issueListeners = issueListeners.filter(cb => cb !== wrappedCallback);
  };
}

// ─── Subscribe to alerts ──────────────────────────────────────────────────────
export function subscribeToAlerts(callback: (alerts: Alert[]) => void): () => void {
  if (isFirebaseConfigured() && db) {
    const q = query(collection(db, 'alerts'), orderBy('createdAt', 'desc'));
    return onSnapshot(q, snapshot => {
      const alerts = snapshot.docs.map(d => {
        const data = d.data();
        return {
          ...data,
          id: d.id,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        } as Alert;
      });
      callback(alerts);
    });
  }

  alertListeners.push(callback);
  callback([...memoryAlerts]);
  return () => {
    alertListeners = alertListeners.filter(cb => cb !== callback);
  };
}

// ─── Update issue status ──────────────────────────────────────────────────────
export async function updateIssueStatus(
  issueId: string,
  status: Issue['status'],
  assignedTo?: string
): Promise<void> {
  if (isFirebaseConfigured() && db) {
    const ref = doc(db, 'issues', issueId);
    await updateDoc(ref, {
      status,
      assignedTo: assignedTo || null,
      updatedAt: serverTimestamp(),
      ...(status === 'resolved' ? { resolvedAt: serverTimestamp() } : {}),
    });
    return;
  }

  const idx = memoryIssues.findIndex(i => i.id === issueId);
  if (idx !== -1) {
    memoryIssues[idx] = {
      ...memoryIssues[idx],
      status,
      assignedTo,
      updatedAt: new Date(),
      ...(status === 'resolved' ? { resolvedAt: new Date() } : {}),
    };
    notifyIssueListeners();
  }
}

// ─── Get dashboard stats ──────────────────────────────────────────────────────
export function getDashboardStats(issues: Issue[]): DashboardStats {
  const open = issues.filter(i => i.status === 'open' || i.status === 'in_progress');
  const resolved = issues.filter(i => i.status === 'resolved');
  const critical = issues.filter(i => i.priority === 'critical' && i.status !== 'resolved');
  const totalParticipants = new Set(issues.flatMap(i => i.participantSessionIds)).size;

  const satisfactionScore = resolved.length > 0
    ? Math.min(98, Math.round(60 + (resolved.length / Math.max(issues.length, 1)) * 40))
    : 72;

  const ratedIssues = issues.filter(i => i.rating !== undefined);
  const averageRating = ratedIssues.length > 0
    ? Number((ratedIssues.reduce((sum, i) => sum + (i.rating || 0), 0) / ratedIssues.length).toFixed(1))
    : 0;

  return {
    liveParticipants: Math.max(totalParticipants, memoryParticipants.length),
    totalConversations: Math.max(totalParticipants, memoryParticipants.length),
    openIssues: open.length,
    resolvedIssues: resolved.length,
    criticalAlerts: critical.length,
    satisfactionScore,
    avgResponseTime: 3.2,
    averageRating,
  };
}

// ─── Register participant ─────────────────────────────────────────────────────
export function registerParticipant(sessionId: string, name: string) {
  const participant: Participant = {
    sessionId,
    name,
    joinedAt: new Date(),
    issueIds: [],
  };
  if (!memoryParticipants.find(p => p.sessionId === sessionId)) {
    memoryParticipants.push(participant);
    saveData('eventmind_participants', memoryParticipants);
  }
}

// ─── Get or create participant by Email ──────────────────────────────────────────
export async function syncParticipantByEmail(email: string, name: string): Promise<string> {
  const cleanEmail = email.toLowerCase().trim();
  const cleanName = name.trim() || 'Anonymous';
  
  if (isFirebaseConfigured() && db) {
    try {
      const participantsRef = collection(db, 'participants');
      const q = query(participantsRef, where('email', '==', cleanEmail));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        // Return existing session ID to resume user state
        const existingDoc = snapshot.docs[0];
        return existingDoc.data().sessionId;
      } else {
        // Create new participant mapping
        const newSessionId = uuidv4();
        await addDoc(participantsRef, {
          email: cleanEmail,
          name: cleanName,
          sessionId: newSessionId,
          createdAt: serverTimestamp(),
        });
        return newSessionId;
      }
    } catch (err) {
      console.error('Error syncing participant by email:', err);
    }
  }

  // Demo mode / Fallback using localStorage
  const localParticipants: Array<{ email: string; name: string; sessionId: string }> = JSON.parse(
    localStorage.getItem('eventmind_participants_by_email') || '[]'
  );
  const match = localParticipants.find(p => p.email === cleanEmail);
  if (match) {
    return match.sessionId;
  } else {
    const newSessionId = uuidv4();
    localParticipants.push({ email: cleanEmail, name: cleanName, sessionId: newSessionId });
    localStorage.setItem('eventmind_participants_by_email', JSON.stringify(localParticipants));
    return newSessionId;
  }
}

// ─── Save & load chat messages by session (Gmail-linked, cross-device) ────────
export async function saveChatMessages(
  sessionId: string,
  messages: Array<{ role: string; content: string; timestamp: string }>
): Promise<void> {
  if (isFirebaseConfigured() && db) {
    try {
      const ref = collection(db, 'chatSessions');
      const q = query(ref, where('sessionId', '==', sessionId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        await updateDoc(snapshot.docs[0].ref, {
          messages,
          updatedAt: serverTimestamp(),
        });
      } else {
        await addDoc(ref, {
          sessionId,
          messages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('Error saving chat messages:', err);
    }
    return;
  }
  // Fallback: localStorage
  localStorage.setItem(`eventmind_chat_${sessionId}`, JSON.stringify(messages));
}

export async function loadChatMessages(
  sessionId: string
): Promise<Array<{ role: string; content: string; timestamp: string }> | null> {
  if (isFirebaseConfigured() && db) {
    try {
      const ref = collection(db, 'chatSessions');
      const q = query(ref, where('sessionId', '==', sessionId));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        return snapshot.docs[0].data().messages || null;
      }
    } catch (err) {
      console.error('Error loading chat messages:', err);
    }
    return null;
  }
  // Fallback: localStorage
  const saved = localStorage.getItem(`eventmind_chat_${sessionId}`);
  return saved ? JSON.parse(saved) : null;
}

// ─── Seed demo data ───────────────────────────────────────────────────────────
export function seedDemoData() {
  if (memoryIssues.length > 0) return;

  const now = new Date();
  const issues: Issue[] = [
    {
      id: 'demo_1',
      title: 'Wi-Fi Connectivity Issue',
      description: 'Multiple participants reporting slow or no Wi-Fi in Hall B',
      category: 'wifi',
      location: 'Hall B',
      priority: 'critical',
      status: 'in_progress',
      sentiment: 'negative',
      affectedParticipants: 14,
      participantSessionIds: Array.from({ length: 14 }, (_, i) => `s${i}`),
      participantNames: ['Priya', 'Rahul', 'Anjali', 'Karthik', 'Meera', 'Dev', 'Sana', 'Arjun', 'Nisha', 'Vikram', 'Pooja', 'Rohit', 'Divya', 'Arun'],
      reportedAt: new Date(now.getTime() - 45 * 60000),
      updatedAt: new Date(now.getTime() - 10 * 60000),
      keywords: ['wifi', 'hall b', 'slow', 'disconnecting'],
      recommendedAction: 'Deploy additional WiFi router in Hall B immediately',
      rootCause: 'Router overload due to high participant density',
      followupSent: false,
      assignedTo: 'Tech Team',
    },
    {
      id: 'demo_2',
      title: 'Food Availability Issue',
      description: 'Snacks and beverages running out near registration',
      category: 'food',
      location: 'Registration Area',
      priority: 'high',
      status: 'open',
      sentiment: 'negative',
      affectedParticipants: 7,
      participantSessionIds: Array.from({ length: 7 }, (_, i) => `fs${i}`),
      participantNames: ['Aisha', 'Rohan', 'Kavya', 'Nikhil', 'Preethi', 'Suraj', 'Lata'],
      reportedAt: new Date(now.getTime() - 25 * 60000),
      updatedAt: new Date(now.getTime() - 5 * 60000),
      keywords: ['food', 'snacks', 'beverages', 'running out'],
      recommendedAction: 'Restock refreshments at registration area',
      rootCause: 'Underestimated participant count for catering',
      followupSent: false,
    },
    {
      id: 'demo_3',
      title: 'Power Outlet Shortage',
      description: 'Not enough power outlets for laptop charging in Hall A',
      category: 'power',
      location: 'Hall A',
      priority: 'high',
      status: 'open',
      sentiment: 'negative',
      affectedParticipants: 5,
      participantSessionIds: Array.from({ length: 5 }, (_, i) => `ps${i}`),
      participantNames: ['Raj', 'Sunita', 'Anand', 'Deepa', 'Kiran'],
      reportedAt: new Date(now.getTime() - 60 * 60000),
      updatedAt: new Date(now.getTime() - 60 * 60000),
      keywords: ['power', 'charging', 'outlet', 'hall a'],
      recommendedAction: 'Bring in extension cords and power strips',
      rootCause: 'Insufficient power outlets for current participant count',
      followupSent: false,
    },
    {
      id: 'demo_4',
      title: 'Session Audio Quality',
      description: 'Speaker audio is low and hard to hear in the back rows',
      category: 'sessions',
      location: 'Hall C',
      priority: 'medium',
      status: 'open',
      sentiment: 'negative',
      affectedParticipants: 3,
      participantSessionIds: Array.from({ length: 3 }, (_, i) => `as${i}`),
      participantNames: ['Sindhu', 'Mahesh', 'Bhavana'],
      reportedAt: new Date(now.getTime() - 20 * 60000),
      updatedAt: new Date(now.getTime() - 20 * 60000),
      keywords: ['audio', 'speaker', 'sound', 'hall c'],
      recommendedAction: 'Adjust speaker volume or add additional speakers',
      rootCause: 'Audio system calibration needed',
      followupSent: false,
    },
    {
      id: 'demo_5',
      title: 'Excellent Mentor Support',
      description: 'Participants appreciating the quality of mentor guidance',
      category: 'appreciation',
      location: 'All Halls',
      priority: 'low',
      status: 'resolved',
      sentiment: 'positive',
      affectedParticipants: 12,
      participantSessionIds: Array.from({ length: 12 }, (_, i) => `ms${i}`),
      participantNames: ['Team Alpha', 'Team Beta', 'Team Gamma'],
      reportedAt: new Date(now.getTime() - 90 * 60000),
      updatedAt: new Date(now.getTime() - 30 * 60000),
      resolvedAt: new Date(now.getTime() - 30 * 60000),
      keywords: ['mentors', 'appreciation', 'great'],
      recommendedAction: 'Acknowledge mentor team',
      rootCause: 'Positive feedback',
      followupSent: true,
    },
  ];

  memoryIssues = issues;
  notifyIssueListeners();

  // Add a critical alert
  const criticalIssue = issues[0];
  memoryAlerts = [{
    id: 'alert_demo_1',
    issueId: criticalIssue.id,
    message: `🚨 Critical: 14 participants affected by Wi-Fi issues in Hall B`,
    priority: 'critical',
    createdAt: new Date(now.getTime() - 10 * 60000),
    acknowledged: false,
    suggestedAction: 'Deploy additional router to Hall B immediately',
  }];
  notifyAlertListeners();
}
