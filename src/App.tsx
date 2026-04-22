import { useState, useCallback, useEffect } from "react";
import {
  initClient,
  localSearch,
  recommend,
  optimizedRecommend,
  resetStats,
  getGlobalStats,
  type CampusEvent,
  type UserProfile,
  type SearchStats,
} from "./lib/search";
import CostDashboard from "./components/CostDashboard";
import EventCard from "./components/EventCard";

const ALL_INTERESTS = ["tech", "career", "sports", "wellness", "social", "academic"];

function loadProfile(): UserProfile | null {
  try {
    const saved = localStorage.getItem("bullboard-profile");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
}

function saveProfile(profile: UserProfile) {
  localStorage.setItem("bullboard-profile", JSON.stringify(profile));
}

export default function App() {
  const [profile, setProfile] = useState<UserProfile | null>(loadProfile);
  const [editingProfile, setEditingProfile] = useState(profile === null);
  const [draftInterests, setDraftInterests] = useState<string[]>(profile?.interests ?? []);
  const [draftBio, setDraftBio] = useState(profile?.bio ?? "");
  const [draftPrefs, setDraftPrefs] = useState(profile?.preferences ?? "");

  const [mode, setMode] = useState<"original" | "optimized">("original");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<CampusEvent[]>([]);
  const [stats, setStats] = useState<SearchStats>(getGlobalStats());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initError, setInitError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<"search" | "foryou">("search");

  useEffect(() => {
    try {
      initClient();
    } catch (err: any) {
      setInitError(err.message);
    }
  }, []);

  const handleSaveProfile = () => {
    const newProfile: UserProfile = {
      interests: draftInterests,
      bio: draftBio,
      preferences: draftPrefs,
    };
    setProfile(newProfile);
    saveProfile(newProfile);
    setEditingProfile(false);
  };

  // Local keyword search — no AI, just filtering
  const handleSearch = useCallback(
    (q?: string) => {
      const query = q ?? searchQuery;
      const searchResults = localSearch(query);
      setResults(searchResults);
      setActiveView("search");
      resetStats();
      setStats(getGlobalStats());
    },
    [searchQuery]
  );

  // "For You" recommendation — this is where AI gets used
  const handleForYou = useCallback(async () => {
    if (!profile) {
      setEditingProfile(true);
      return;
    }
    setLoading(true);
    setError(null);
    setActiveView("foryou");
    try {
      const result =
        mode === "original"
          ? await recommend(profile)
          : await optimizedRecommend(profile);
      setResults(result.events);
      setStats(result.stats);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [profile, mode]);

  const handleModeSwitch = (newMode: "original" | "optimized") => {
    setMode(newMode);
    resetStats();
    setResults([]);
    setStats(getGlobalStats());
    setError(null);
  };

  const handleReset = () => {
    resetStats();
    setResults([]);
    setStats(getGlobalStats());
    setError(null);
  };

  const toggleInterest = (interest: string) => {
    setDraftInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  if (initError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-950 p-4">
        <div className="w-full max-w-md space-y-4 text-center">
          <h1 className="text-3xl font-bold text-white">🐂 BullBoard</h1>
          <div className="rounded-lg border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-300">
            <p className="mb-2 font-semibold">Missing API Key</p>
            <p>{initError}</p>
            <p className="mt-3 text-xs text-red-400">
              Create a <code className="rounded bg-neutral-800 px-1">.env</code> file
              in the project root:
            </p>
            <code className="mt-2 block rounded bg-neutral-800 px-3 py-2 text-xs text-neutral-300">
              VITE_GEMINI_API_KEY=your_key_here
            </code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="mx-auto max-w-4xl p-4 md:p-8">

        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">🐂 BullBoard</h1>
            <p className="text-xs text-neutral-500">Campus Event Finder</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (!editingProfile) {
                  setDraftInterests(profile?.interests ?? []);
                  setDraftBio(profile?.bio ?? "");
                  setDraftPrefs(profile?.preferences ?? "");
                }
                setEditingProfile(!editingProfile);
              }}
              className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
            >
              {editingProfile ? "▲ Close Profile" : profile ? "▼ Edit Profile" : "▼ Set Up Profile"}
            </button>
            {activeView === "foryou" && (
              <button
                onClick={handleReset}
                className="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs text-neutral-400 hover:bg-neutral-800"
              >
                Reset Stats
              </button>
            )}
          </div>
        </div>

        {editingProfile && (
          <div className="mb-6 rounded-xl border border-neutral-700 bg-neutral-900 p-5">
            <h2 className="mb-4 text-sm font-semibold text-neutral-200">
              Your Profile
            </h2>

            <div className="mb-4">
              <label className="mb-2 block text-xs text-neutral-400">
                Interests (select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_INTERESTS.map((interest) => (
                  <button
                    key={interest}
                    onClick={() => toggleInterest(interest)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      draftInterests.includes(interest)
                        ? "bg-blue-600 text-white"
                        : "border border-neutral-600 text-neutral-400 hover:border-neutral-400"
                    }`}
                  >
                    {interest}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs text-neutral-400">
                Short bio
              </label>
              <input
                type="text"
                value={draftBio}
                onChange={(e) => setDraftBio(e.target.value)}
                placeholder="CS sophomore, love hackathons and free food"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="mb-4">
              <label className="mb-2 block text-xs text-neutral-400">
                Preferences (anything goes)
              </label>
              <textarea
                value={draftPrefs}
                onChange={(e) => setDraftPrefs(e.target.value)}
                placeholder="I prefer evening events, nothing before 10am, interested in anything AI-related"
                rows={2}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSaveProfile}
                disabled={draftInterests.length === 0 && !draftBio.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:opacity-50"
              >
                Save Profile
              </button>
            </div>
          </div>
        )}

        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder='Search events... (e.g., "free food", "tech workshops")'
            className="flex-1 rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-3 text-sm text-white placeholder-neutral-500 focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={() => handleSearch()}
            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-blue-500"
          >
            Search
          </button>
        </div>

        <div className="mb-6 rounded-xl border border-neutral-800 bg-neutral-900/50 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-neutral-200">
                ✨ For You
              </h2>
              <p className="text-xs text-neutral-500">
                {profile
                  ? `AI-powered recommendations based on your profile`
                  : "Set up your profile to get personalized recommendations"}
              </p>
            </div>
          </div>

          <div className="mb-3 flex gap-2 rounded-lg border border-neutral-800 bg-neutral-900 p-1">
            <button
              onClick={() => handleModeSwitch("original")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "original"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Original
            </button>
            <button
              onClick={() => handleModeSwitch("optimized")}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === "optimized"
                  ? "bg-blue-600 text-white"
                  : "text-neutral-400 hover:text-white"
              }`}
            >
              Optimized
            </button>
          </div>

          <button
            onClick={handleForYou}
            disabled={loading || !profile}
            className="w-full rounded-lg bg-neutral-800 px-4 py-2.5 text-sm font-medium text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
          >
            {loading
              ? "Analyzing your profile..."
              : !profile
                ? "Set up profile first"
                : "Get Recommendations"}
          </button>
        </div>

        {activeView === "foryou" && stats.apiCalls > 0 && (
          <div className="mb-6">
            <CostDashboard stats={stats} mode={mode} />
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-950/30 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {results.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-neutral-400">
              {activeView === "search" ? "Search Results" : "Recommended for You"}{" "}
              ({results.length})
            </h2>
            {results.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}

        <div className="mt-12 border-t border-neutral-800 pt-6 text-center text-xs text-neutral-600">
          <p>BullBoard — Campus Event Finder</p>
        </div>
      </div>
    </div>
  );
}