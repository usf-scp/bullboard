import { GoogleGenAI } from "@google/genai";
import eventsData from "../data/events.json";

// Types shared across the app

export interface CampusEvent {
  id: number;
  title: string;
  org: string;
  category: string;
  tags: string[];
  date: string;
  time: string;
  location: string;
  description: string;
  capacity: number;
  registered: number;
}

export interface UserProfile {
  interests: string[];
  bio: string;
  preferences: string;
}

export interface SearchStats {
  apiCalls: number;
  totalTokensEstimated: number;
  totalLatencyMs: number;
  estimatedCost: number;
  strategy: string;
  modelUsed: string;
  eventsInPrompt: number;
  tokensPerEvent: number;
}

export interface SearchResult {
  events: CampusEvent[];
  stats: SearchStats;
}

// Gemini client setup

const events: CampusEvent[] = eventsData as CampusEvent[];
let genai: GoogleGenAI | null = null;

export function initClient(apiKey?: string) {
  const key = apiKey ?? import.meta.env.VITE_GEMINI_API_KEY;
  if (!key) throw new Error("No API key found. Set VITE_GEMINI_API_KEY in your .env file.");
  genai = new GoogleGenAI({ apiKey: key });
}

// Stats tracking for the cost dashboard

let globalStats: SearchStats = emptyStats();

function emptyStats(): SearchStats {
  return {
    apiCalls: 0,
    totalTokensEstimated: 0,
    totalLatencyMs: 0,
    estimatedCost: 0,
    strategy: "",
    modelUsed: "",
    eventsInPrompt: 0,
    tokensPerEvent: 0,
  };
}

export function resetStats() {
  globalStats = emptyStats();
}

export function getGlobalStats(): SearchStats {
  return { ...globalStats };
}

// Pricing table for cost estimation

const PRICING: Record<string, { input: number; output: number }> = {
  "gemini-2.5-flash": { input: 0.30, output: 2.50 },
  "gemini-2.5-flash-lite": { input: 0.10, output: 0.40 },
};

// Basic local search used by the "Search" button
// No AI involved. Pure keyword matching.

export function localSearch(query: string): CampusEvent[] {
  if (!query.trim()) return events;

  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);

  return events
    .map((event) => {
      const searchable = (
        event.title + " " +
        event.tags.join(" ") + " " +
        event.description + " " +
        event.category + " " +
        event.org
      ).toLowerCase();
      const matches = tokens.filter((t) => searchable.includes(t));
      const score = tokens.length > 0 ? matches.length / tokens.length : 0;
      return { event, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((s) => s.event);
}

// The "Original" (unoptimized) recommendation path
// Sends the full profile and all 50 events to Gemini every time.
// This works out of the box — it's the expensive baseline we'll optimize against.

export async function recommend(profile: UserProfile): Promise<SearchResult> {
  if (!genai) throw new Error("API client not initialized");

  const start = Date.now();

  const prompt = `You are a campus event recommendation engine.

Here is the student's profile:
- Interests: ${profile.interests.join(", ")}
- Bio: ${profile.bio}
- Preferences: ${profile.preferences}

Here is the complete list of campus events:
${JSON.stringify(events, null, 2)}

Based on this student's profile, recommend the top 5 most relevant events.
Return ONLY a JSON array of event IDs, like [1, 5, 12].
Do not include any explanation or other text.`;

  const response = await genai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
  });

  const latency = Date.now() - start;

  const eventsJson = JSON.stringify(events, null, 2);
  const tokensEstimated = Math.ceil(prompt.length / 4);
  const tokensPerEvent = Math.ceil(eventsJson.length / events.length / 4);

  const cleaned = (response.text ?? "[]").replace(/```json|```/g, "").trim();
  let matchedIds: number[] = [];
  try {
    matchedIds = JSON.parse(cleaned);
  } catch {
    matchedIds = [];
  }

  const matchedEvents = matchedIds
    .map((id) => events.find((e) => e.id === id))
    .filter(Boolean) as CampusEvent[];

  const pricing = PRICING["gemini-2.5-flash"];
  globalStats.apiCalls += 1;
  globalStats.totalTokensEstimated += tokensEstimated;
  globalStats.totalLatencyMs += latency;
  globalStats.estimatedCost += (tokensEstimated / 1_000_000) * pricing.input;
  globalStats.strategy = "full profile + all events sent to AI";
  globalStats.modelUsed = "gemini-2.5-flash";
  globalStats.eventsInPrompt = events.length;
  globalStats.tokensPerEvent = tokensPerEvent;

  return {
    events: matchedEvents.length > 0 ? matchedEvents : events,
    stats: getGlobalStats(),
  };
}

// ACT 1 — SKIP THE CALL
// Score each event against the user's profile using keyword matching.
// Returns a number between 0 and 1 — higher means stronger match.
// When the top event scores above a threshold, we skip the AI entirely.

export function scoreForProfile(profile: UserProfile, event: CampusEvent): number {
  // TODO: Implement local scoring
  // 1. Combine profile.interests, profile.bio, and profile.preferences into one lowercase string
  // 2. Split into tokens, filter out tokens shorter than 3 characters
  // 3. Combine event title, tags, description, and category into one lowercase string
  // 4. Count how many profile tokens appear in the event text
  // 5. Return matches / total tokens (handle the empty case)
  return 0;
}

// ACT 2 — SHRINK THE CALL (outer pruning)
// Remove events the AI shouldn't even see: past dates, full capacity,
// and categories outside the user's interests.

export function preFilterForProfile(profile: UserProfile): CampusEvent[] {
  // TODO: Implement pre-filtering
  // 1. Get today's date in YYYY-MM-DD format
  // 2. Filter out events where event.date < today (past events)
  // 3. Filter out events where event.registered >= event.capacity (full events)
  // 4. If profile.interests is non-empty, keep only events whose category is in it
  //    (but if that would empty the list, don't narrow)
  return events;
}

// ACT 2 — SHRINK THE CALL (inner pruning)
// Strip each event down to only the fields the AI needs for ranking.
// Removes location, time, capacity, registered count, org — tokens we don't pay for.

export function slimEvent(event: CampusEvent) {
  // TODO: Return an object with only id, title, tags, category, description
  return event;
}

// ACT 3 TRACK A — SURVIVE RATE LIMITS
// Try each API key in order. On a 429, advance to the next one.
// If all keys are exhausted, fall back to local scoring so the app never dies.

export async function callWithFallback(
  prompt: string,
  profile: UserProfile
): Promise<CampusEvent[]> {
  // TODO: Implement fallback chain
  // 1. Build an array of keys from import.meta.env (KEY_1, KEY_2, KEY_3)
  // 2. Loop through each key, create a client, try the Gemini call
  // 3. On a 429 error, log a warning and continue to the next key
  // 4. On any other error, re-throw (don't mask real bugs)
  // 5. If all keys fail, return a sensible fallback based on profile
  return [];
}

// The optimized path the workshop builds toward.
// This stub uses preFilterForProfile and scoreForProfile from above.
// When those are still stubs returning defaults, this function falls through
// to recommend() — so Optimized mode behaves exactly like Original mode.
// As you implement each function during the workshop, the dashboard changes
// to reflect what's happening.

const LOCAL_MATCH_THRESHOLD = 0.4;

export async function optimizedRecommend(profile: UserProfile): Promise<SearchResult> {
  // Step 1: narrow the candidate pool (ACT 2)
  const candidates = preFilterForProfile(profile);

  // Step 2: score the candidates locally (ACT 1)
  const scored = candidates
    .map((event) => ({ event, score: scoreForProfile(profile, event) }))
    .sort((a, b) => b.score - a.score);

  // Step 3: if local scoring already gives us a strong match, skip the AI
  if (scored.length > 0 && scored[0].score >= LOCAL_MATCH_THRESHOLD) {
    globalStats.strategy = "local match — no AI needed";
    globalStats.modelUsed = "none (local scoring)";
    globalStats.eventsInPrompt = 0;
    globalStats.tokensPerEvent = 0;
    return {
      events: scored.map((s) => s.event),
      stats: getGlobalStats(),
    };
  }

  // Step 4: no strong local match — we need to call the AI.
  // TODO (Act 3, end of workshop): Replace the line below with a slimmed,
  // fallback-protected AI call.
  // 1. Map candidates through slimEvent to drop unneeded fields
  // 2. Build a prompt string containing the profile and the slimmed events
  // 3. Pass the prompt to callWithFallback to get AI recommendations
  // 4. Update globalStats so the dashboard shows the smaller prompt size
  // 5. Return the recommended events
  //
  // For now, delegate to recommend() so the app still works end-to-end.
  return recommend(profile);
}