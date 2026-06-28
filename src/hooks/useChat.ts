import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import type { Message, ChatState } from '../types';
import { sendChatMessage, extractIssueFromConversation } from '../lib/gemini';
import { createOrMergeIssue, registerParticipant, saveChatMessages } from '../services/issueService';

const SESSION_KEY = 'eventmind_session';

function getOrCreateSession(): string {
  let session = sessionStorage.getItem(SESSION_KEY);
  if (!session) {
    session = uuidv4();
    sessionStorage.setItem(SESSION_KEY, session);
  }
  return session;
}

export function useChat(eventId?: string, externalSessionId?: string, prefilledName?: string) {
  const sessionId = useRef(externalSessionId || getOrCreateSession());
  const eventIdRef = useRef(eventId);

  useEffect(() => { eventIdRef.current = eventId; }, [eventId]);
  useEffect(() => {
    if (externalSessionId) sessionId.current = externalSessionId;
  }, [externalSessionId]);

  // If name is pre-filled (Google auth), skip name phase
  const initialPhase = prefilledName ? 'chat' : 'name';

  const [state, setState] = useState<ChatState>({
    sessionId: sessionId.current,
    participantName: prefilledName || null,
    messages: [],
    phase: initialPhase,
    currentIssueContext: null,
    isTyping: false,
  });

  const historyRef = useRef<Array<{ role: 'user' | 'model'; parts: string }>>([]);
  const conversationBuffer = useRef<string>('');
  const fallbackExtractTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const issueFiledRef = useRef<Set<string>>(new Set()); // track filed issues to avoid duplicates

  // ── Initial greeting ─────────────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      const isReturning = !!prefilledName;
      const content = isReturning
        ? `👋 Welcome back, **${prefilledName}**! Great to see you.\n\nHow's your experience at the event going so far?`
        : "👋 Hi there! I'm **EventMind AI**, your event assistant.\n\nCould I know your name before we begin?";

      const quickReplies = isReturning
        ? ['🚨 I have a problem', '😊 Going great!', '💡 A suggestion']
        : undefined;

      if (isReturning) {
        registerParticipant(sessionId.current, prefilledName!);
      }

      setState(prev => ({
        ...prev,
        messages: [{
          id: uuidv4(),
          role: 'ai',
          content,
          timestamp: new Date(),
          quickReplies,
        }],
      }));
    }, 600);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save chat to Firestore (debounced) ──────────────────────────────────
  useEffect(() => {
    if (!externalSessionId || state.messages.length === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveChatMessages(
        externalSessionId,
        state.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp.toISOString(),
        }))
      );
    }, 2000);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [state.messages, externalSessionId]);

  // ── File issue to management ─────────────────────────────────────────────────
  const fileIssueToManagement = useCallback(async (
    issueData: Parameters<typeof createOrMergeIssue>[0],
    participantName: string
  ) => {
    // Dedup: use category+location as key
    const key = `${issueData.category}-${issueData.location}`;
    if (issueFiledRef.current.has(key)) return;
    issueFiledRef.current.add(key);

    try {
      await createOrMergeIssue(issueData, sessionId.current, participantName, eventIdRef.current);

      // 🔔 Show management-side notification toast
      toast.success(
        `📋 Issue reported to management: ${issueData.title || 'New issue'}`,
        {
          duration: 4000,
          style: {
            borderRadius: '14px',
            background: '#0f172a',
            color: '#e2e8f0',
            border: '1px solid rgba(99,102,241,0.4)',
            fontSize: '13px',
          },
          icon: '🚨',
        }
      );
    } catch (err) {
      console.error('Failed to file issue:', err);
    }
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, msg],
      isTyping: false,
    }));
  }, []);

  // ── Main sendMessage ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: uuidv4(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    setState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      isTyping: true,
    }));

    historyRef.current.push({ role: 'user', parts: text });
    conversationBuffer.current += `\nParticipant: ${text}`;

    // ── Name phase ───────────────────────────────────────────────────────────
    if (state.phase === 'name' || !state.participantName) {
      const raw = text.trim().split(/\s+/)[0];
      const cleanName = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();

      registerParticipant(sessionId.current, cleanName);
      await new Promise(r => setTimeout(r, 1000));

      const welcomeMsg: Message = {
        id: uuidv4(),
        role: 'ai',
        content: `Nice to meet you, **${cleanName}**! 👋\n\nHow's your experience at the event going so far?`,
        timestamp: new Date(),
        quickReplies: ['🚨 I have a problem', '😊 Going great!', '💡 A suggestion'],
      };

      setState(prev => ({
        ...prev,
        participantName: cleanName,
        phase: 'chat',
        messages: [...prev.messages, welcomeMsg],
        isTyping: false,
      }));

      historyRef.current.push({ role: 'model', parts: welcomeMsg.content });
      return;
    }

    // ── Chat phase — call Gemini ─────────────────────────────────────────────
    try {
      const result = await sendChatMessage(
        text,
        historyRef.current,
        state.participantName,
        conversationBuffer.current
      );

      const aiMsg: Message = {
        id: uuidv4(),
        role: 'ai',
        content: result.response,
        timestamp: new Date(),
        quickReplies: result.quickReplies,
      };

      addMessage(aiMsg);
      historyRef.current.push({ role: 'model', parts: result.response });
      conversationBuffer.current += `\nAI: ${result.response}`;

      // ── PRIMARY: Gemini signalled an issue directly ──────────────────────
      if (result.issueData?.category &&
          result.issueData.category !== 'appreciation' &&
          result.issueData.category !== 'suggestion') {
        await fileIssueToManagement(result.issueData, state.participantName || 'Anonymous');
      } else if (result.issueData?.category === 'suggestion') {
        // Suggestions also get filed (lower priority)
        await fileIssueToManagement(result.issueData, state.participantName || 'Anonymous');
      } else {
        // ── FALLBACK: run extraction after 3+ exchanges with no signal ────
        const exchangeCount = historyRef.current.filter(h => h.role === 'user').length;
        if (exchangeCount >= 2) {
          if (fallbackExtractTimer.current) clearTimeout(fallbackExtractTimer.current);
          fallbackExtractTimer.current = setTimeout(async () => {
            const issue = await extractIssueFromConversation(conversationBuffer.current);
            if (issue?.category && issue.category !== 'appreciation') {
              await fileIssueToManagement(issue, state.participantName || 'Anonymous');
            }
          }, 1500);
        }
      }

    } catch (err) {
      console.error('Chat error:', err);
      addMessage({
        id: uuidv4(),
        role: 'ai',
        content: "I'm sorry, I'm having trouble right now. Please try again in a moment.",
        timestamp: new Date(),
      });
    }
  }, [state.phase, state.participantName, addMessage, fileIssueToManagement]);

  return { ...state, sendMessage };
}
