import React, { useRef, useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Send, Sparkles } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useChat } from '../hooks/useChat';
import { getEventById } from '../services/eventService';
import type { Message } from '../types';

// ─── Typing Indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 animate-fade-in">
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-lg">
        <Sparkles className="w-4 h-4 text-white" />
      </div>
      <div className="bubble-ai flex items-center gap-1 py-4 px-5">
        <div className="typing-dot" />
        <div className="typing-dot" />
        <div className="typing-dot" />
      </div>
    </div>
  );
}

// ─── Chat Bubble ─────────────────────────────────────────────────────────────
function ChatBubble({ message, participantName }: { message: Message; participantName: string | null }) {
  const isAI = message.role === 'ai';
  const initial = participantName ? participantName[0].toUpperCase() : '?';

  return (
    <div className={`flex items-end gap-3 message-in ${isAI ? 'flex-row' : 'flex-row-reverse'}`}>
      {/* Avatar */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 shadow-md ${
        isAI
          ? 'bg-gradient-to-br from-brand-500 to-violet-600'
          : 'bg-gradient-to-br from-blue-500 to-cyan-500'
      }`}>
        {isAI
          ? <Sparkles className="w-4 h-4 text-white" />
          : <span className="text-white text-xs font-bold">{initial}</span>
        }
      </div>

      {/* Bubble */}
      <div className={`flex flex-col gap-2 ${isAI ? 'items-start' : 'items-end'} max-w-[85%]`}>
        <div className={isAI ? 'bubble-ai' : 'bubble-user'}>
          {isAI ? (
            <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:mb-2 [&>p:last-child]:mb-0 [&>ul]:mt-1 [&>ul]:mb-1">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{message.content}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 px-1">
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  );
}

// ─── Quick Reply Chips ────────────────────────────────────────────────────────
function QuickReplies({ replies, onSelect }: { replies: string[]; onSelect: (r: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 mt-1 ml-11">
      {replies.map((reply, i) => (
        <button
          key={i}
          onClick={() => onSelect(reply)}
          className="chip text-xs"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}



// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [searchParams] = useSearchParams();
  const eventId = searchParams.get('eventId') || undefined;
  const event = eventId ? getEventById(eventId) : undefined;
  const { messages, isTyping, sendMessage, participantName, phase } = useChat(eventId);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    const text = inputValue.trim();
    if (!text || sending) return;
    setInputValue('');
    setSending(true);
    await sendMessage(text);
    setSending(false);
    inputRef.current?.focus();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickReply = (reply: string) => {
    // Strip emoji prefixes for cleaner messages
    const clean = reply.replace(/^[^\w\s]*\s*/, '').trim();
    sendMessage(clean || reply);
  };

  const lastAIMessage = [...messages].reverse().find(m => m.role === 'ai');

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-slate-50 via-white to-brand-50/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 glass border-b border-gray-100 dark:border-gray-800 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-lg animate-glow">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-gray-900 dark:text-white text-sm leading-none">EventMind AI</h1>
            <p className="text-xs text-brand-500 dark:text-brand-400 font-medium mt-0.5">
              {event ? event.name : participantName ? `Chatting as ${participantName}` : 'Event Assistant'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 font-medium">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            Live
          </span>
        </div>
      </header>

      {/* Messages area */}
      <main className="flex-1 overflow-y-auto px-4 py-6 space-y-5 scrollbar-hide">
        {/* Empty state suggestions */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in-up">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 flex items-center justify-center shadow-xl animate-float">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">EventMind AI</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm">Starting your session...</p>
            </div>
          </div>
        )}

        {/* Chat messages */}
        {messages.map((msg, i) => (
          <div key={msg.id}>
            <ChatBubble message={msg} participantName={participantName} />
            {/* Quick replies for last AI message only */}
            {msg.role === 'ai' && msg.quickReplies && i === messages.length - 1 && !isTyping && (
              <QuickReplies replies={msg.quickReplies} onSelect={handleQuickReply} />
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="mt-2">
            <TypingIndicator />
          </div>
        )}

        {/* Show suggestion chips when ready and no typing */}
        {phase === 'chat' && !isTyping && messages.length > 2 && !lastAIMessage?.quickReplies && (
          <div className="flex flex-wrap gap-2 ml-11 mt-2">
            <button onClick={() => handleQuickReply('I want to report a problem')} className="chip text-xs">🚨 Report Issue</button>
            <button onClick={() => handleQuickReply('I have a suggestion')} className="chip text-xs">💡 Suggest</button>
            <button onClick={() => handleQuickReply('Everything is great!')} className="chip text-xs">❤️ Appreciate</button>
          </div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* Input area */}
      <footer className="px-4 pb-6 pt-3 glass border-t border-gray-100 dark:border-gray-800">
        {/* Suggestions for first interaction */}
        {phase === 'name' && messages.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {['Ammu', 'Rahul', 'Priya', 'Karthik'].map(name => (
              <button key={name} onClick={() => sendMessage(name)} className="chip text-xs">
                {name}
              </button>
            ))}
          </div>
        )}

        <div className="relative flex items-end gap-3 max-w-3xl mx-auto">
          <div className="relative flex-1">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKey}
              placeholder={phase === 'name' ? 'Type your name...' : 'Type a message...'}
              rows={1}
              className="chat-input min-h-[52px] max-h-32"
              style={{ height: 'auto' }}
              onInput={e => {
                const el = e.currentTarget;
                el.style.height = 'auto';
                el.style.height = Math.min(el.scrollHeight, 128) + 'px';
              }}
            />
          </div>

          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || sending}
            id="send-button"
            className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-200 shadow-lg ${
              inputValue.trim() && !sending
                ? 'bg-gradient-to-br from-brand-500 to-violet-600 text-white hover:scale-110 hover:shadow-brand-500/40 active:scale-95'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 dark:text-gray-600 mt-3">
          🔒 Your feedback is anonymous · EventMind AI
        </p>
      </footer>
    </div>
  );
}
