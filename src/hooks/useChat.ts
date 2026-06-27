import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Message, ChatState } from '../types';
import { sendChatMessage, extractIssueFromConversation } from '../lib/gemini';
import { createOrMergeIssue, registerParticipant } from '../services/issueService';

const SESSION_KEY = 'eventmind_session';

function getOrCreateSession(): string {
  let session = sessionStorage.getItem(SESSION_KEY);
  if (!session) {
    session = uuidv4();
    sessionStorage.setItem(SESSION_KEY, session);
  }
  return session;
}

export function useChat(eventId?: string) {
  const sessionId = useRef(getOrCreateSession());
  const eventIdRef = useRef(eventId);
  const [state, setState] = useState<ChatState>({
    sessionId: sessionId.current,
    participantName: null,
    messages: [],
    phase: 'name',
    currentIssueContext: null,
    isTyping: false,
  });

  const historyRef = useRef<Array<{ role: 'user' | 'model'; parts: string }>>([]);
  const conversationBuffer = useRef<string>('');
  const issueExtractTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Send initial AI greeting
  useEffect(() => {
    const timer = setTimeout(() => {
      const welcome: Message = {
        id: uuidv4(),
        role: 'ai',
        content: "👋 Hi there! I'm **EventMind AI**, your event experience assistant.\n\nBefore we begin — could I know your name?",
        timestamp: new Date(),
      };
      setState(prev => ({ ...prev, messages: [welcome] }));
    }, 600);
    return () => clearTimeout(timer);
  }, []);

  const addMessage = useCallback((msg: Message) => {
    setState(prev => ({
      ...prev,
      messages: [...prev.messages, msg],
      isTyping: false,
    }));
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return;

    // Add user message
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

    // Handle name phase
    if (state.phase === 'name' || !state.participantName) {
      const name = text.trim().split(' ')[0];
      // Capitalize
      const cleanName = name.charAt(0).toUpperCase() + name.slice(1);

      registerParticipant(sessionId.current, cleanName);

      // Welcome message
      await new Promise(r => setTimeout(r, 1200));

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
        messages: [...prev.messages, userMsg, welcomeMsg],
        isTyping: false,
      }));

      historyRef.current.push({ role: 'model', parts: welcomeMsg.content });
      return;
    }

    // Normal chat phase
    try {
      const result = await sendChatMessage(text, historyRef.current, state.participantName);

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

      // Try issue extraction after enough context (debounced)
      if (issueExtractTimer.current) clearTimeout(issueExtractTimer.current);
      issueExtractTimer.current = setTimeout(async () => {
        if (conversationBuffer.current.trim().length > 0) {
          const issue = await extractIssueFromConversation(conversationBuffer.current);
          if (issue && issue.category && issue.category !== 'appreciation' && issue.category !== 'suggestion') {
            await createOrMergeIssue(issue, sessionId.current, state.participantName || 'Anonymous', eventIdRef.current);
          }
        }
      }, 1000);

    } catch (err) {
      console.error('Chat error:', err);
      const errMsg: Message = {
        id: uuidv4(),
        role: 'ai',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      addMessage(errMsg);
    }
  }, [state.phase, state.participantName, addMessage]);

  return {
    ...state,
    sendMessage,
  };
}
