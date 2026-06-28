import type { Event } from '../types';

// ─── Storage keys ─────────────────────────────────────────────────────────────
let STORAGE_KEY = 'eventmind_events';
let TRASH_KEY = 'eventmind_events_trash';

export function initializeEventStore(email: string | null) {
  STORAGE_KEY = email ? `eventmind_events_${email}` : 'eventmind_events_demo';
  TRASH_KEY = email ? `eventmind_events_trash_${email}` : 'eventmind_events_trash_demo';
  
  memoryEvents = loadEvents();
  memoryTrash = loadTrash();
  
  eventListeners.forEach(cb => cb([...memoryEvents]));
  trashListeners.forEach(cb => cb([...memoryTrash]));
}

// ─── Types ────────────────────────────────────────────────────────────────────
export interface TrashedEvent {
  event: Event;
  deletedAt: Date;
  /** snapshot of issue count at time of deletion */
  issueCount: number;
}

// ─── Loaders ──────────────────────────────────────────────────────────────────
function loadEvents(): Event[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data).map((e: any) => ({
      ...e,
      createdAt: new Date(e.createdAt),
    }));
  } catch { return []; }
}

function loadTrash(): TrashedEvent[] {
  try {
    const data = localStorage.getItem(TRASH_KEY);
    if (!data) return [];
    return JSON.parse(data).map((t: any) => ({
      ...t,
      deletedAt: new Date(t.deletedAt),
      event: { ...t.event, createdAt: new Date(t.event.createdAt) },
    }));
  } catch { return []; }
}

function saveEvents(events: Event[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

function saveTrash(trash: TrashedEvent[]) {
  localStorage.setItem(TRASH_KEY, JSON.stringify(trash));
}

// ─── In-memory stores ─────────────────────────────────────────────────────────
let memoryEvents: Event[] = loadEvents();
let memoryTrash: TrashedEvent[] = loadTrash();
let eventListeners: Array<(events: Event[]) => void> = [];
let trashListeners: Array<(trash: TrashedEvent[]) => void> = [];

function notifyEventListeners() {
  saveEvents(memoryEvents);
  eventListeners.forEach(cb => cb([...memoryEvents]));
}

function notifyTrashListeners() {
  saveTrash(memoryTrash);
  trashListeners.forEach(cb => cb([...memoryTrash]));
}

// Cross-tab sync
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === STORAGE_KEY) {
      memoryEvents = loadEvents();
      eventListeners.forEach(cb => cb([...memoryEvents]));
    }
    if (e.key === TRASH_KEY) {
      memoryTrash = loadTrash();
      trashListeners.forEach(cb => cb([...memoryTrash]));
    }
  });
}

// ─── Create event ─────────────────────────────────────────────────────────────
export function createEvent(data: { name: string; description: string; venue: string; date: string }): Event {
  const newEvent: Event = {
    id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: data.name,
    description: data.description,
    venue: data.venue,
    date: data.date,
    createdAt: new Date(),
    isActive: true,
  };
  memoryEvents.unshift(newEvent);
  notifyEventListeners();
  return newEvent;
}

// ─── Get event by ID ──────────────────────────────────────────────────────────
export function getEventById(id: string): Event | undefined {
  return memoryEvents.find(e => e.id === id);
}

// ─── Subscribe to events ──────────────────────────────────────────────────────
export function subscribeToEvents(callback: (events: Event[]) => void): () => void {
  eventListeners.push(callback);
  callback([...memoryEvents]);
  return () => { eventListeners = eventListeners.filter(cb => cb !== callback); };
}

// ─── Subscribe to trash ───────────────────────────────────────────────────────
export function subscribeToTrash(callback: (trash: TrashedEvent[]) => void): () => void {
  trashListeners.push(callback);
  callback([...memoryTrash]);
  return () => { trashListeners = trashListeners.filter(cb => cb !== callback); };
}

// ─── Toggle event active state ────────────────────────────────────────────────
export function toggleEventActive(id: string) {
  const idx = memoryEvents.findIndex(e => e.id === id);
  if (idx !== -1) {
    memoryEvents[idx] = { ...memoryEvents[idx], isActive: !memoryEvents[idx].isActive };
    notifyEventListeners();
  }
}

// ─── Soft-delete event → moves to trash + wipes all related data ──────────────
export function deleteEvent(id: string, issueCount: number = 0) {
  const idx = memoryEvents.findIndex(e => e.id === id);
  if (idx === -1) return;

  const event = memoryEvents[idx];

  // Move to trash (keep only the last 5 deleted events)
  const trashedItem: TrashedEvent = {
    event,
    deletedAt: new Date(),
    issueCount,
  };
  memoryTrash = [trashedItem, ...memoryTrash].slice(0, 5);
  notifyTrashListeners();

  // Remove from active events
  memoryEvents.splice(idx, 1);
  notifyEventListeners();

  // Wipe all associated localStorage data
  _wipeEventData(id);
}

/** Remove all issues, alerts and chat sessions linked to an event from localStorage */
function _wipeEventData(eventId: string) {
  // Issues
  try {
    const raw = localStorage.getItem('eventmind_issues');
    if (raw) {
      const issues = JSON.parse(raw);
      const filtered = issues.filter((i: any) => i.eventId !== eventId);
      localStorage.setItem('eventmind_issues', JSON.stringify(filtered));
    }
  } catch {}

  // Alerts (filter by issueIds that belonged to this event — we wipe all alerts for simplicity since alerts are session-level)
  try {
    const raw = localStorage.getItem('eventmind_alerts');
    if (raw) {
      const alerts = JSON.parse(raw);
      // Keep alerts that aren't tied to this event (we can't easily tell, so keep all)
      // For a clean slate approach per event, we remove all alerts when the only event is deleted
      const issuesLeft = (() => {
        try { return JSON.parse(localStorage.getItem('eventmind_issues') || '[]'); } catch { return []; }
      })();
      if (issuesLeft.length === 0) {
        localStorage.removeItem('eventmind_alerts');
      } else {
        localStorage.setItem('eventmind_alerts', JSON.stringify(alerts));
      }
    }
  } catch {}

  // Chat sessions linked to event participants (best-effort: remove sessions whose sessionIds
  // match participants that only chatted in this event — we clear all chat sessions for the event)
  try {
    // Participants by email who were linked to this event
    const partRaw = localStorage.getItem('eventmind_participants');
    if (partRaw) {
      const parts = JSON.parse(partRaw);
      // Remove participant records that have no remaining issues
      const issuesLeft = (() => {
        try { return JSON.parse(localStorage.getItem('eventmind_issues') || '[]'); } catch { return []; }
      })();
      const activeSessionIds = new Set(issuesLeft.flatMap((i: any) => i.participantSessionIds || []));
      const filtered = parts.filter((p: any) => activeSessionIds.has(p.sessionId));
      localStorage.setItem('eventmind_participants', JSON.stringify(filtered));
    }
  } catch {}
}

// ─── Restore event from trash ─────────────────────────────────────────────────
export function restoreEvent(eventId: string): Event | null {
  const idx = memoryTrash.findIndex(t => t.event.id === eventId);
  if (idx === -1) return null;

  const { event } = memoryTrash[idx];
  memoryTrash.splice(idx, 1);
  notifyTrashListeners();

  memoryEvents.unshift(event);
  notifyEventListeners();

  return event;
}

// ─── Permanently delete from trash ───────────────────────────────────────────
export function permanentlyDeleteEvent(eventId: string) {
  memoryTrash = memoryTrash.filter(t => t.event.id !== eventId);
  notifyTrashListeners();
  // Data was already wiped on soft-delete, nothing more to do
}

// ─── Clear all trash ──────────────────────────────────────────────────────────
export function emptyTrash() {
  memoryTrash = [];
  notifyTrashListeners();
}
