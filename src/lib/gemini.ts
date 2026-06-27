import { GoogleGenerativeAI } from '@google/generative-ai';
import type { Issue, IssueCategory, Priority } from '../types';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const isGeminiConfigured = () => {
  return !!(GEMINI_API_KEY && GEMINI_API_KEY !== 'your_gemini_api_key_here');
};

let genAI: GoogleGenerativeAI | null = null;
if (isGeminiConfigured()) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// ─── System prompt for event assistant ───────────────────────────────────────
const SYSTEM_PROMPT = `You are EventMind AI, a warm conversational AI assistant at a tech event/hackathon.

CRITICAL RULE: Ask only ONE question per message. Never list multiple questions or options in a single response.

Your personality:
- Warm, natural, and concise
- Never robotic or survey-like — feel like a real person chatting
- Keep every message to 1-2 short sentences maximum
- One thought, one question, then stop

Conversation flow:
- After user gives name: just say "Nice to meet you [name]! How's the event going so far?"
- Based on reply, ask one relevant follow-up
- If they report an issue, ask ONE clarifying question (location OR severity, not both)
- Once you have enough context, tell them you've flagged it and ask if there's anything else

Issue categories: wifi, food, power, venue, registration, washrooms, volunteers, security, 
accessibility, sessions, workshops, mentors, judging, networking, announcements, charging, 
appreciation, suggestion, complaint

When reporting an issue, ask only ONE of:
- "Where exactly is this happening?"
- "How badly is this affecting you?"

When you have enough info, say you've flagged it with organizers — keep it short.
Never dump all options or capabilities on the user at once.`;

// ─── Extract structured issue from conversation ───────────────────────────────
const EXTRACTION_PROMPT = `You are an AI that extracts structured issue data from event feedback conversations.

Given this conversation, extract the issue details as JSON.
Return ONLY valid JSON with these fields (no markdown, no explanation):
{
  "title": "brief issue title",
  "description": "full description",
  "category": "one of: wifi|food|power|venue|registration|washrooms|volunteers|security|accessibility|sessions|workshops|mentors|judging|networking|announcements|charging|appreciation|suggestion|complaint|other",
  "location": "location or 'Unknown'",
  "priority": "one of: low|medium|high|critical",
  "sentiment": "one of: positive|neutral|negative",
  "keywords": ["array", "of", "keywords"],
  "recommendedAction": "brief recommended action for organizers",
  "rootCause": "possible root cause"
}

If this is appreciation/suggestion (not a problem), use category "appreciation" or "suggestion" and priority "low".
If no clear issue, return null.`;

// ─── Mock responses for demo mode ────────────────────────────────────────────
const MOCK_RESPONSES: Record<string, { response: string; quickReplies?: string[] }> = {
  default_greeting: {
    response: "👋 Hi! I'm EventMind AI. Before we start — what's your name?",
  },
  after_name: {
    response: "How's the event going for you so far?",
    quickReplies: ['🚨 I have a problem', '😊 Going great!', '💡 A suggestion'],
  },
  wifi: {
    response: "Sorry to hear that! Wi-Fi issues are frustrating. Where exactly are you facing this?",
    quickReplies: ['Hall A', 'Hall B', 'Hall C', 'Registration Area', 'Cafeteria'],
  },
  food: {
    response: "Got it. What's the issue with the food — is it availability, quality, or something else?",
    quickReplies: ['Running out', 'Quality issue', 'Long wait', 'Other'],
  },
  resolved: {
    response: "✅ Got it — I've flagged this with the organizing team right away. Is there anything else on your mind?",
    quickReplies: ['Yes, another issue', 'No, all good!'],
  },
  appreciation: {
    response: "That's great to hear! 🌟 I'll pass that along to the team. Anything else you'd like to share?",
    quickReplies: ['Yes, something else', 'Nope, I\'m good!'],
  },
  generic: {
    response: "Thanks for sharing! Your feedback has been noted. Anything else I can help with?",
    quickReplies: ['Yes, another thing', 'No, thanks!'],
  },
  what_is_it: {
    response: "Sure! What is it?",
  },
  report_problem: {
    response: "Of course! What problem are you facing?",
  },
  suggestion_prompt: {
    response: "Happy to pass that along! What's your suggestion?",
  },
  goodbye: {
    response: "You're welcome! Hope the rest of the event goes great. 😊",
  },
};

function getMockResponse(userMessage: string, participantName: string | null): { response: string; quickReplies?: string[] } {
  const msg = userMessage.toLowerCase();

  if (!participantName) return MOCK_RESPONSES.default_greeting;

  // User wants to report a problem
  if (
    msg.includes('report a problem') || msg.includes('report an issue') ||
    msg.includes('i have a problem') || msg.includes('i have an issue') ||
    msg.includes('want to report') || msg.includes('facing a problem') ||
    msg === '🚨 i have a problem' || msg === 'i have a problem'
  ) {
    return MOCK_RESPONSES.report_problem;
  }

  // User wants to share a suggestion
  if (
    msg.includes('suggestion') || msg.includes('suggest') ||
    msg === '💡 a suggestion'
  ) {
    return MOCK_RESPONSES.suggestion_prompt;
  }

  // Affirmative follow-ups — user wants to share more
  if (
    msg === 'yes, another thing' || msg === 'yes, another issue' ||
    msg === 'yes, something else' || msg === 'report another issue' ||
    (msg.startsWith('yes') && (msg.includes('another') || msg.includes('more') || msg.includes('else'))) ||
    msg === 'yes'
  ) {
    return MOCK_RESPONSES.what_is_it;
  }

  // Goodbye / done
  if (
    msg.includes('no, thanks') || msg.includes('no, all good') ||
    msg.includes("i'm good") || msg.includes('nope') || msg.includes('all good') ||
    msg.includes('done') || msg.includes('bye')
  ) {
    return MOCK_RESPONSES.goodbye;
  }

  if (msg.includes('wifi') || msg.includes('wi-fi') || msg.includes('internet') || msg.includes('network')) {
    return MOCK_RESPONSES.wifi;
  }
  if (msg.includes('food') || msg.includes('eat') || msg.includes('drink') || msg.includes('snack') || msg.includes('coffee')) {
    return MOCK_RESPONSES.food;
  }
  if (msg.includes('great') || msg.includes('awesome') || msg.includes('amazing') || msg.includes('love') || msg.includes('thank') || msg.includes('good job') || msg.includes('going great')) {
    return MOCK_RESPONSES.appreciation;
  }
  if (msg.includes('hall a') || msg.includes('hall b') || msg.includes('hall c') || msg.includes('low') || msg.includes('medium') || msg.includes('high') || msg.includes('critical')) {
    return MOCK_RESPONSES.resolved;
  }

  return MOCK_RESPONSES.generic;
}

// ─── Main chat function ───────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  participantName: string | null
): Promise<{ response: string; quickReplies?: string[] }> {
  if (!isGeminiConfigured() || !genAI) {
    // Simulate a small delay for realism
    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));
    return getMockResponse(userMessage, participantName);
  }

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SYSTEM_PROMPT,
    });

    const chat = model.startChat({
      history: history.map(h => ({
        role: h.role,
        parts: [{ text: h.parts }],
      })),
    });

    const result = await chat.sendMessage(userMessage);
    const text = result.response.text();

    // Extract quick replies if AI included them in brackets like [Option1, Option2]
    const chipMatch = text.match(/\[([^\]]+)\]/g);
    let quickReplies: string[] | undefined;
    let cleanResponse = text;

    if (chipMatch) {
      const lastChipBlock = chipMatch[chipMatch.length - 1];
      quickReplies = lastChipBlock
        .replace(/[\[\]]/g, '')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean);
      cleanResponse = text.replace(lastChipBlock, '').trim();
    }

    return { response: cleanResponse, quickReplies };
  } catch (error) {
    console.error('Gemini error:', error);
    await new Promise(r => setTimeout(r, 600));
    return getMockResponse(userMessage, participantName);
  }
}

// ─── Issue extraction ─────────────────────────────────────────────────────────
export async function extractIssueFromConversation(
  conversation: string
): Promise<Partial<Issue> | null> {
  if (!isGeminiConfigured() || !genAI) {
    // Mock extraction for demo
    return extractIssueMock(conversation);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(
      EXTRACTION_PROMPT + '\n\nConversation:\n' + conversation
    );
    const text = result.response.text().trim();

    if (text === 'null') return null;

    const parsed = JSON.parse(text);
    return parsed as Partial<Issue>;
  } catch {
    return extractIssueMock(conversation);
  }
}

function extractIssueMock(conversation: string): Partial<Issue> | null {
  const conv = conversation.toLowerCase();

  const categoryMap: Record<string, IssueCategory> = {
    'wifi': 'wifi', 'wi-fi': 'wifi', 'internet': 'wifi', 'network': 'wifi',
    'food': 'food', 'eating': 'food', 'drink': 'food',
    'power': 'power', 'electricity': 'power', 'outlet': 'power',
    'charging': 'charging', 'charger': 'charging',
    'washroom': 'washrooms', 'toilet': 'washrooms', 'bathroom': 'washrooms',
    'security': 'security', 'volunteer': 'volunteers',
    'registration': 'registration', 'register': 'registration',
    'mentor': 'mentors', 'judge': 'judging',
    'venue': 'venue', 'hall': 'venue', 'room': 'venue',
    'session': 'sessions', 'workshop': 'workshops',
    'great': 'appreciation', 'amazing': 'appreciation', 'awesome': 'appreciation',
  };

  let detectedCategory: IssueCategory = 'other';
  for (const [keyword, cat] of Object.entries(categoryMap)) {
    if (conv.includes(keyword)) {
      detectedCategory = cat;
      break;
    }
  }

  if (detectedCategory === 'appreciation') return null; // Not an issue

  const locationMatch = conv.match(/hall [abc]|registration area|cafeteria|entrance|exit|stage/i);
  const location = locationMatch ? locationMatch[0] : 'Unknown';

  let priority: Priority = 'medium';
  if (conv.includes('critical') || conv.includes('very') || conv.includes('urgent')) priority = 'critical';
  else if (conv.includes('high')) priority = 'high';
  else if (conv.includes('low') || conv.includes('minor')) priority = 'low';

  const titleMap: Record<string, string> = {
    wifi: 'Wi-Fi Connectivity Issue',
    food: 'Food/Refreshment Issue',
    power: 'Power/Electricity Issue',
    charging: 'Charging Station Issue',
    washrooms: 'Washroom Issue',
    venue: 'Venue Issue',
    registration: 'Registration Issue',
    volunteers: 'Volunteer Support Issue',
    sessions: 'Session Issue',
    workshops: 'Workshop Issue',
    mentors: 'Mentor Availability Issue',
  };

  return {
    title: titleMap[detectedCategory] || 'General Issue',
    description: conversation.slice(0, 200),
    category: detectedCategory,
    location,
    priority,
    sentiment: 'negative',
    keywords: [detectedCategory, location.toLowerCase()].filter(Boolean),
    recommendedAction: `Address the ${detectedCategory} issue at ${location}`,
    rootCause: `Participant-reported ${detectedCategory} problem`,
  };
}
