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

// ─── System prompt ─────────────────────────────────────────────────────────────
// Gemini acts as a friendly event assistant that collects problems and files them.
// It signals readiness to report using a hidden JSON block so we can extract structured data.
const SYSTEM_PROMPT = `You are EventMind AI — a professional Event Experience Assistant at a tech event/hackathon.
You do NOT behave like a normal chatbot. You chat naturally with participants to ensure they are having a great time, and to collect feedback or issues.

## CRITICAL RULES
1. Be friendly and empathetic.
2. Never ask too many questions. Ask only ONE follow-up question at a time.
3. Never feel like a survey. Keep conversations natural.
4. Never overwhelm participants. Keep responses SHORT — 1-2 sentences max.
5. Always thank participants for sharing.
6. Always reassure that their feedback matters.

## CONVERSATION FLOW

**If the user reports a problem or feedback:**
- Empathize first.
- Ask exactly ONE clarifying question (e.g., "Where exactly is this happening?" OR "How badly is this affecting you?").
- Once you know (a) what the issue is, and (b) roughly where/severity, tell them you've flagged it with the organizers.
- You MUST say exactly: "Thank you for your feedback" as part of your final confirming message.
- Append this exact JSON block on a new line (the system will parse and remove it):

ISSUE_REPORT::{"title":"brief title","description":"full detail","category":"CATEGORY","location":"LOCATION","priority":"PRIORITY","sentiment":"SENTIMENT","keywords":["k1","k2"],"recommendedAction":"action for organizers","rootCause":"why this happened"}

**Category options:** wifi | food | power | venue | registration | washrooms | volunteers | security | accessibility | sessions | workshops | mentors | judging | networking | announcements | charging | appreciation | suggestion | complaint | other

**Priority rules:**
- critical: affects many people or blocks the event
- high: significant disruption to 1 person
- medium: moderate inconvenience
- low: minor suggestion or appreciation (use 'low' for all 'appreciation')

**Sentiment:** positive | neutral | negative`;

// ─── Extract quick replies from AI response ───────────────────────────────────
// Gemini can optionally append [Option1, Option2] for chip suggestions
function parseQuickReplies(text: string): { clean: string; quickReplies?: string[] } {
  const chipMatch = text.match(/\[([^\]]+)\]\s*$/);
  if (!chipMatch) return { clean: text.trim() };
  const quickReplies = chipMatch[1]
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const clean = text.slice(0, text.lastIndexOf(chipMatch[0])).trim();
  return { clean, quickReplies };
}

// ─── Parse issue report signal from AI response ──────────────────────────────
export interface ParsedIssueSignal {
  response: string;       // the visible part of the AI message
  quickReplies?: string[];
  issueData?: Partial<Issue>; // parsed from ISSUE_REPORT:: block, if present
}

function parseIssueReport(rawText: string): ParsedIssueSignal {
  const issueMarker = 'ISSUE_REPORT::';
  const markerIdx = rawText.indexOf(issueMarker);

  let visibleText = rawText;
  let issueData: Partial<Issue> | undefined;

  if (markerIdx !== -1) {
    visibleText = rawText.slice(0, markerIdx).trim();
    const jsonStr = rawText.slice(markerIdx + issueMarker.length).trim();
    try {
      issueData = JSON.parse(jsonStr) as Partial<Issue>;
    } catch {
      console.warn('Failed to parse ISSUE_REPORT block:', jsonStr);
    }
  }

  const { clean, quickReplies } = parseQuickReplies(visibleText);
  return { response: clean, quickReplies, issueData };
}

// ─── Mock responses (demo / fallback mode) ────────────────────────────────────
interface MockResp { response: string; quickReplies?: string[]; issueData?: Partial<Issue> }

function getMockResponse(
  userMessage: string,
  participantName: string | null,
  conversationBuffer: string
): MockResp {
  const msg = userMessage.toLowerCase();
  const buf = conversationBuffer.toLowerCase();

  if (!participantName) {
    return { response: "👋 Hi! I'm EventMind AI. Before we start — what's your name?" };
  }

  // Goodbye / done
  if (msg.includes('no, thanks') || msg.includes('no, all good') || msg.includes("i'm good") ||
      msg.includes('nope') || msg.includes('all good') || msg.includes('done') || msg.includes('bye')) {
    return { response: "You're welcome! Hope the rest of the event goes great. 😊" };
  }

  // User wants to report another issue
  if (msg === 'yes, another issue' || msg === 'yes, something else' || msg === 'yes' || msg === 'yeah') {
    return { response: "Of course! What's the problem?", quickReplies: ['WiFi issue', 'Food issue', 'Power issue', 'Other'] };
  }

  // User wants to report a specific problem
  if (msg === 'i have a problem' || msg === '🚨 i have a problem') {
    return { response: "Of course — what problem are you facing?", quickReplies: ['WiFi issue', 'Food issue', 'Power/charging', 'Venue issue', 'Other'] };
  }

  // Suggestions
  if (msg.includes('suggestion') || msg.includes('suggest') || msg === '💡 a suggestion') {
    return { response: "Happy to pass that along! What's your suggestion?" };
  }

  // WiFi — ask location
  if ((msg.includes('wifi') || msg.includes('wi-fi') || msg.includes('internet') || msg.includes('network')) && !buf.includes('hall')) {
    return { response: "Sorry about that! Where exactly are you — which hall or area?", quickReplies: ['Hall A', 'Hall B', 'Hall C', 'Registration area'] };
  }

  // WiFi + location → file issue
  if ((buf.includes('wifi') || buf.includes('internet')) && (msg.includes('hall') || msg.includes('area') || msg.includes('registration') || msg.includes('lobby'))) {
    const location = msg.includes('hall a') ? 'Hall A' : msg.includes('hall b') ? 'Hall B' : msg.includes('hall c') ? 'Hall C' : 'Registration Area';
    return {
      response: `Thank you for your feedback`,
      quickReplies: ['Yes, another issue', 'No, all good!'],
      issueData: {
        title: `Wi-Fi Connectivity Issue in ${location}`,
        description: `Participant reported Wi-Fi connectivity problems in ${location}`,
        category: 'wifi',
        location,
        priority: 'high',
        sentiment: 'negative',
        keywords: ['wifi', 'connectivity', location.toLowerCase()],
        recommendedAction: `Check and restart router in ${location}`,
        rootCause: 'Router overload or configuration issue',
      },
    };
  }

  // Food
  if (msg.includes('food') || msg.includes('eat') || msg.includes('drink') || msg.includes('snack') || msg.includes('coffee')) {
    if (buf.includes('running out') || buf.includes('no food') || buf.includes('empty')) {
      return {
        response: "Thank you for your feedback",
        quickReplies: ['Yes, another issue', 'No, all good!'],
        issueData: {
          title: 'Food/Refreshment Running Out',
          description: 'Participant reported food and refreshments are running out',
          category: 'food',
          location: 'Cafeteria / Refreshment Area',
          priority: 'high',
          sentiment: 'negative',
          keywords: ['food', 'refreshments', 'running out'],
          recommendedAction: 'Restock refreshments immediately',
          rootCause: 'Underestimated participant count for catering',
        },
      };
    }
    return { response: "What's the issue — running out, quality, or long wait?", quickReplies: ['Running out', 'Quality issue', 'Long wait'] };
  }

  // Power/charging
  if (msg.includes('power') || msg.includes('charging') || msg.includes('outlet') || msg.includes('plug') || msg.includes('electricity')) {
    return {
      response: "Thank you for your feedback",
      quickReplies: ['Yes, another issue', 'No, all good!'],
      issueData: {
        title: 'Power/Charging Issue',
        description: 'Participant reported insufficient power outlets or charging issues',
        category: 'power',
        location: 'Unknown',
        priority: 'high',
        sentiment: 'negative',
        keywords: ['power', 'charging', 'outlet'],
        recommendedAction: 'Bring in extension cords and power strips',
        rootCause: 'Insufficient power outlets for participant count',
      },
    };
  }

  // Appreciation
  if (msg.includes('great') || msg.includes('awesome') || msg.includes('amazing') || msg.includes('love') ||
      msg.includes('thank') || msg.includes('good job') || msg === '😊 going great!') {
    return { response: "That's wonderful to hear! 🌟 I'll pass it on to the team. Is there anything else?", quickReplies: ['Yes, something else', "Nope, I'm good!"] };
  }

  return { response: "Thanks for sharing! Is there anything else I can help with?", quickReplies: ['Yes, another issue', "No, I'm good!"] };
}

// ─── Main chat function ───────────────────────────────────────────────────────
interface ChatMessage {
  role: 'user' | 'model';
  parts: string;
}

export async function sendChatMessage(
  userMessage: string,
  history: ChatMessage[],
  participantName: string | null,
  conversationBuffer: string = ''
): Promise<ParsedIssueSignal> {
  if (!isGeminiConfigured() || !genAI) {
    await new Promise(r => setTimeout(r, 700 + Math.random() * 500));
    return getMockResponse(userMessage, participantName, conversationBuffer);
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
    const rawText = result.response.text();

    return parseIssueReport(rawText);
  } catch (error: any) {
    console.error('Gemini error:', error);
    await new Promise(r => setTimeout(r, 500));
    return getMockResponse(userMessage, participantName, conversationBuffer);
  }
}

// ─── Standalone issue extraction (backup for complex conversations) ────────────
const EXTRACTION_PROMPT = `You are an AI that extracts structured issue data from event feedback conversations.

Given this conversation, extract the issue as JSON.
Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "brief issue title",
  "description": "full participant description",
  "category": "wifi|food|power|venue|registration|washrooms|volunteers|security|accessibility|sessions|workshops|mentors|judging|networking|announcements|charging|appreciation|suggestion|complaint|other",
  "location": "location string or 'Unknown'",
  "priority": "low|medium|high|critical",
  "sentiment": "positive|neutral|negative",
  "keywords": ["keyword1", "keyword2"],
  "recommendedAction": "what organizers should do",
  "rootCause": "likely root cause"
}

Rules:
- If no actionable issue exists, return null
- For appreciation/compliments: return null
- For suggestions: use category "suggestion", priority "low"
- Priority critical = affects many people or blocks event
- Priority high = significant personal disruption`;

export async function extractIssueFromConversation(conversation: string): Promise<Partial<Issue> | null> {
  if (!isGeminiConfigured() || !genAI) {
    return extractIssueMock(conversation);
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    const result = await model.generateContent(EXTRACTION_PROMPT + '\n\nConversation:\n' + conversation);
    const text = result.response.text().trim()
      .replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();

    if (text === 'null' || !text) return null;
    return JSON.parse(text) as Partial<Issue>;
  } catch {
    return extractIssueMock(conversation);
  }
}

function extractIssueMock(conversation: string): Partial<Issue> | null {
  const conv = conversation.toLowerCase();

  const categoryMap: Record<string, IssueCategory> = {
    'wifi': 'wifi', 'wi-fi': 'wifi', 'internet': 'wifi', 'network': 'wifi',
    'food': 'food', 'eating': 'food', 'drink': 'food', 'snack': 'food',
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
    if (conv.includes(keyword)) { detectedCategory = cat; break; }
  }
  if (detectedCategory === 'appreciation') return null;

  const locationMatch = conv.match(/hall [a-z]|registration|cafeteria|entrance|exit|stage|room [0-9]+|gate|lobby/i);
  const location = locationMatch ? locationMatch[0].toUpperCase() : 'Unknown';

  let priority: Priority = 'medium';
  if (conv.includes('critical') || conv.includes('urgent')) priority = 'critical';
  else if (conv.includes('very') || conv.includes('high')) priority = 'high';
  else if (conv.includes('low') || conv.includes('minor')) priority = 'low';

  const titleMap: Record<string, string> = {
    wifi: 'Wi-Fi Connectivity Issue', food: 'Food/Refreshment Issue',
    power: 'Power/Electricity Issue', charging: 'Charging Station Issue',
    washrooms: 'Washroom Issue', venue: 'Venue Issue',
    registration: 'Registration Issue', volunteers: 'Volunteer Support Issue',
    sessions: 'Session Issue', workshops: 'Workshop Issue',
    mentors: 'Mentor Availability Issue',
  };

  return {
    title: titleMap[detectedCategory] || 'General Issue',
    description: conversation.slice(0, 300),
    category: detectedCategory,
    location,
    priority,
    sentiment: 'negative',
    keywords: [detectedCategory, location.toLowerCase()].filter(Boolean),
    recommendedAction: `Address the ${detectedCategory} issue at ${location}`,
    rootCause: `Participant-reported ${detectedCategory} problem`,
  };
}
