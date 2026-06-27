import type { Event } from '../types';

// ─── In-memory store (demo mode) ─────────────────────────────────────────────
const STORAGE_KEY = 'eventmind_events';

function loadEvents(): Event[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    return parsed.map((e: any) => ({
      ...e,
      createdAt: new Date(e.createdAt),
    }));
  } catch {
    return [];
  }
}

function saveEvents(events: Event[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
}

let memoryEvents: Event[] = loadEvents();
let eventListeners: Array<(events: Event[]) => void> = [];

function notifyEventListeners() {
  saveEvents(memoryEvents);
  eventListeners.forEach(cb => cb([...memoryEvents]));
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
  return () => {
    eventListeners = eventListeners.filter(cb => cb !== callback);
  };
}

// ─── Toggle event active state ────────────────────────────────────────────────
export function toggleEventActive(id: string) {
  const idx = memoryEvents.findIndex(e => e.id === id);
  if (idx !== -1) {
    memoryEvents[idx] = { ...memoryEvents[idx], isActive: !memoryEvents[idx].isActive };
    notifyEventListeners();
  }
}
