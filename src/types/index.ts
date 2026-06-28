// Shared TypeScript types for EventMind AI

export interface Event {
  id: string;
  name: string;
  description: string;
  venue: string;
  date: string;
  createdAt: Date;
  isActive: boolean;
}

export type Priority = 'low' | 'medium' | 'high' | 'critical';
export type IssueStatus = 'open' | 'in_progress' | 'resolved' | 'escalated';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export type IssueCategory =
  | 'wifi' | 'food' | 'power' | 'venue' | 'registration'
  | 'washrooms' | 'volunteers' | 'security' | 'accessibility'
  | 'sessions' | 'workshops' | 'mentors' | 'judging'
  | 'networking' | 'announcements' | 'charging'
  | 'appreciation' | 'suggestion' | 'complaint' | 'other';

export interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
  timestamp: Date;
  quickReplies?: string[];
  isTyping?: boolean;
}

export interface Participant {
  sessionId: string;
  name: string;
  joinedAt: Date;
  issueIds: string[];
}

export interface Issue {
  id: string;
  eventId?: string;
  title: string;
  description: string;
  category: IssueCategory;
  location: string;
  priority: Priority;
  status: IssueStatus;
  sentiment: Sentiment;
  affectedParticipants: number;
  participantSessionIds: string[];
  participantNames: string[];
  reportedAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  recommendedAction?: string;
  rootCause?: string;
  keywords: string[];
  followupSent: boolean;
  followupResults?: {
    yes: number;
    partially: number;
    no: number;
  };
  rating?: number;
}

export interface Alert {
  id: string;
  issueId: string;
  message: string;
  priority: Priority;
  createdAt: Date;
  acknowledged: boolean;
  suggestedAction: string;
}

export interface Feedback {
  id: string;
  eventId?: string;
  participantName: string;
  participantSessionId: string;
  location: string;
  overallRating: number;
  overallExperience: string;
  venueRating?: number;
  foodRating?: number;
  wifiRating?: number;
  likes?: string;
  dislikes?: string;
  improvements?: string;
  recommendation?: string;
  additionalComments?: string;
  issueCategory: string[];
  sentiment: Sentiment;
  submittedAt: Date;
}

export interface DashboardStats {
  liveParticipants: number;
  totalConversations: number;
  openIssues: number;
  resolvedIssues: number;
  criticalAlerts: number;
  satisfactionScore: number;
  avgResponseTime: number;
  averageRating: number;
}

export interface ChatState {
  sessionId: string;
  participantName: string | null;
  messages: Message[];
  phase: 'name' | 'welcome' | 'chat';
  currentIssueContext: Partial<Issue> | null;
  isTyping: boolean;
}

export interface MemoryRecord {
  id: string;
  eventName: string;
  category: IssueCategory;
  location: string;
  solution: string;
  successRate: number;
  resolutionTimeMinutes: number;
  recommendation: string;
  createdAt: Date;
}
