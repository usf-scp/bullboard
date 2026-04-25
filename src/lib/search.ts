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

Based on this student's profile, recommend the top 10 most relevant events.
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
  // Boilerplate: turn the profile and the event into bags of words.
  const profileTokens = (
    profile.interests.join(" ") + " " +
    profile.bio + " " +
    profile.preferences
  ).toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  const eventText = (
    event.title + " " +
    event.tags.join(" ") + " " +
    event.description + " " +
    event.category
  ).toLowerCase();

  if (profileTokens.length === 0) return 0;

  // TODO: Score this event against the profile.
  // Count how many profileTokens appear anywhere in eventText,
  // then return that count divided by profileTokens.length.
  // Hint: use Array.filter with String.includes.
  return 0;
}

// ACT 2 — SHRINK THE CALL (outer pruning)
// Remove events the AI shouldn't even see: past dates, full capacity,
// and categories outside the user's interests.

export function preFilterForProfile(profile: UserProfile): CampusEvent[] {
  const today = new Date().toISOString().split("T")[0];

  // TODO: Filter the events array to drop the ones that can't help.
  // Three checks, each one prunes a branch:
  //   1. Drop events whose date is before today (past events)
  //   2. Drop events where registered >= capacity (full events)
  //   3. If profile.interests is non-empty, keep only events whose
  //      category is in that list — but skip this narrow if it would
  //      empty the result.
  let filtered = events;

  return filtered;
}

// ACT 2 — SHRINK THE CALL (inner pruning)
// Strip each event down to only the fields the AI needs for ranking.
// Removes location, time, capacity, registered count, org — tokens we don't pay for.

export function slimEvent(event: CampusEvent) {
  // TODO: Return an object with only id, title, tags, category, description.
  return event;
}

// ACT 3 TRACK A — SURVIVE RATE LIMITS
// Try each API key in order. On a 429, advance to the next one.
// If all keys are exhausted, fall back to local scoring so the app never dies.

export async function callWithFallback(
  prompt: string,
  profile: UserProfile
): Promise<CampusEvent[]> {
  // Boilerplate: collect available keys, fall back to the primary if no rotation keys are set.
  const keys = [
    import.meta.env.VITE_GEMINI_KEY_1,
    import.meta.env.VITE_GEMINI_KEY_2,
    import.meta.env.VITE_GEMINI_KEY_3,
  ].filter(Boolean) as string[];

  if (keys.length === 0) {
    const primary = import.meta.env.VITE_GEMINI_API_KEY;
    if (primary) keys.push(primary);
  }

  // TODO: Loop through the keys, trying each one until something works.
  //   For each key:
  //     - Create a new GoogleGenAI client with that key
  //     - Try generateContent with model "gemini-2.5-flash" and the prompt
  //     - If it succeeds: parse the JSON, look up the matched events, return them
  //     - If it fails with status 429: log a warning, continue to the next key
  //     - If it fails with anything else: re-throw (don't mask real bugs)
  //
  // The parse + lookup boilerplate looks like this — you'll need it inside the try block:
  //
  //   const cleaned = (response.text ?? "[]").replace(/```json|```/g, "").trim();
  //   const ids: number[] = JSON.parse(cleaned);
  //   const matched = ids
  //     .map((id) => events.find((e) => e.id === id))
  //     .filter(Boolean) as CampusEvent[];
  //   return matched.length > 0 ? matched : [];

  // All keys exhausted — fall back to local scoring so the app never dies.
  console.warn("All keys rate-limited, falling back to local scoring");
  const scored = events
    .map((event) => ({ event, score: scoreForProfile(profile, event) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  return scored.map((s) => s.event);
}

// The optimized path the workshop builds toward.
// This stub uses preFilterForProfile and scoreForProfile from above.
// When those are still stubs returning defaults, this function falls through
// to recommend() — so Optimized mode behaves exactly like Original mode.
// As you implement each function during the workshop, the dashboard changes
// to reflect what's happening.

const LOCAL_MATCH_THRESHOLD = 0.4;

export async function optimizedRecommend(profile: UserProfile): Promise<SearchResult> {
  const start = Date.now();

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
      events: scored.slice(0, 10).map((s) => s.event),
      stats: getGlobalStats(),
    };
  }

  // Step 4: no strong local match — call the AI with a slimmed, fallback-protected request.
  // TODO (end of workshop): Wire the optimization functions together here.
  //   1. Build slimCandidates by mapping candidates through slimEvent
  //   2. Replace the prompt below to send slimCandidates instead of all 50 events
  //   3. Call callWithFallback with the new prompt to get matchedEvents
  //
  // For now we delegate to recommend() so Optimized mode still works end-to-end —
  // it just behaves like Original mode until you fill this in.
  return recommend(profile);

  /* Once you've wired the three steps above, the rest of this function
     updates the dashboard to reflect the smaller prompt. Uncomment when ready:

  const slimJson = JSON.stringify(slimCandidates);
  const tokensEstimated = Math.ceil(prompt.length / 4);
  const tokensPerEvent = slimCandidates.length > 0
    ? Math.ceil(slimJson.length / slimCandidates.length / 4)
    : 0;
  const latency = Date.now() - start;

  const pricing = PRICING["gemini-2.5-flash"];
  globalStats.apiCalls += 1;
  globalStats.totalTokensEstimated += tokensEstimated;
  globalStats.totalLatencyMs += latency;
  globalStats.estimatedCost += (tokensEstimated / 1_000_000) * pricing.input;
  globalStats.strategy = "pre-filtered + slimmed events + key fallback";
  globalStats.modelUsed = "gemini-2.5-flash";
  globalStats.eventsInPrompt = slimCandidates.length;
  globalStats.tokensPerEvent = tokensPerEvent;

  return {
    events: matchedEvents.length > 0 ? matchedEvents : candidates,
    stats: getGlobalStats(),
  };
  */
}