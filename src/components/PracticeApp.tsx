import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookmarkCheck, ChevronLeft, ChevronRight, Eye, EyeOff, Shuffle } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useLocalStorageState } from "@/hooks/useLocalStorageState";
import type { Difficulty, InterviewQuestion } from "@/types/question";

const allDifficulties = ["all", "easy", "medium", "hard"] as const;
type DifficultyFilter = (typeof allDifficulties)[number];

type ProgressState = {
  totalViewed: number;
  lastSessionIndex: number;
  viewedIds: string[];
};

function shuffleList<T>(items: T[]) {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function normalizeIndex(index: number, total: number) {
  if (total === 0) return 0;
  return ((index % total) + total) % total;
}

export function PracticeApp() {
  const location = useLocation();
  const bookmarkRoute = location.pathname === "/bookmarks";
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [bookmarkedIds, setBookmarkedIds] = useLocalStorageState<string[]>("interview-pwa-bookmarks", []);
  const [progress, setProgress] = useLocalStorageState<ProgressState>("interview-pwa-progress", {
    totalViewed: 0,
    lastSessionIndex: 0,
    viewedIds: [],
  });
  const [tagFilter, setTagFilter] = useState("all");
  const [difficultyFilter, setDifficultyFilter] = useState<DifficultyFilter>("all");
  const [randomMode, setRandomMode] = useState(false);
  const [order, setOrder] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(progress.lastSessionIndex);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    let mounted = true;

    fetch("/questions.json")
      .then((response) => {
        if (!response.ok) throw new Error("Questions failed to load");
        return response.json() as Promise<InterviewQuestion[]>;
      })
      .then((data) => {
        if (!mounted) return;
        setQuestions(data);
        setLoadError(false);
      })
      .catch(() => {
        if (mounted) setLoadError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const tags = useMemo(() => Array.from(new Set(questions.flatMap((question) => question.tags))).sort(), [questions]);

  const filteredQuestions = useMemo(() => {
    return questions.filter((question) => {
      const matchesTag = tagFilter === "all" || question.tags.includes(tagFilter);
      const matchesDifficulty = difficultyFilter === "all" || question.difficulty === difficultyFilter;
      const matchesBookmarkRoute = !bookmarkRoute || bookmarkedIds.includes(question.id);
      return matchesTag && matchesDifficulty && matchesBookmarkRoute;
    });
  }, [bookmarkedIds, bookmarkRoute, difficultyFilter, tagFilter]);

  useEffect(() => {
    const ids = filteredQuestions.map((question) => question.id);
    setOrder(randomMode ? shuffleList(ids) : ids);
    setCurrentIndex((index) => normalizeIndex(index, ids.length));
    setShowAnswer(false);
  }, [filteredQuestions, randomMode]);

  const currentQuestion = useMemo(() => {
    const id = order[currentIndex];
    return filteredQuestions.find((question) => question.id === id) ?? filteredQuestions[0];
  }, [currentIndex, filteredQuestions, order]);

  useEffect(() => {
    if (!currentQuestion) return;

    setProgress((current) => {
      const hasViewed = current.viewedIds.includes(currentQuestion.id);
      return {
        totalViewed: hasViewed ? current.totalViewed : current.totalViewed + 1,
        lastSessionIndex: currentIndex,
        viewedIds: hasViewed ? current.viewedIds : [...current.viewedIds, currentQuestion.id],
      };
    });
  }, [currentIndex, currentQuestion, setProgress]);

  const goToQuestion = (direction: 1 | -1) => {
    setCurrentIndex((index) => normalizeIndex(index + direction, filteredQuestions.length));
    setShowAnswer(false);
  };

  const toggleBookmark = () => {
    if (!currentQuestion) return;
    setBookmarkedIds((ids) =>
      ids.includes(currentQuestion.id) ? ids.filter((id) => id !== currentQuestion.id) : [...ids, currentQuestion.id],
    );
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("select, input, textarea, button")) return;

      if (event.code === "Space") {
        event.preventDefault();
        setShowAnswer((visible) => !visible);
      }
      if (event.key === "ArrowRight") goToQuestion(1);
      if (event.key === "ArrowLeft") goToQuestion(-1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const isBookmarked = currentQuestion ? bookmarkedIds.includes(currentQuestion.id) : false;
  const position = filteredQuestions.length ? currentIndex + 1 : 0;

  return (
    <main className="min-h-screen px-4 py-5 sm:px-6 sm:py-8">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] w-full max-w-3xl flex-col justify-center gap-5 sm:min-h-[calc(100vh-4rem)]">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">Interview practice</p>
            <h1 className="text-2xl font-bold tracking-normal text-foreground sm:text-3xl">Daily question deck</h1>
          </div>
          <nav className="flex rounded-md border border-border bg-surface p-1 shadow-soft" aria-label="Practice navigation">
            <Link
              to="/"
              className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${!bookmarkRoute ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Practice
            </Link>
            <Link
              to="/bookmarks"
              className={`rounded-sm px-3 py-2 text-sm font-medium transition-colors ${bookmarkRoute ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              Bookmarks
            </Link>
          </nav>
        </header>

        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <label className="grid gap-1 text-sm font-medium text-muted-foreground">
            Tag
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="h-11 rounded-md border border-input bg-surface px-3 text-foreground outline-none ring-offset-background transition focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="all">All tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium text-muted-foreground">
            Difficulty
            <select
              value={difficultyFilter}
              onChange={(event) => setDifficultyFilter(event.target.value as Difficulty | "all")}
              className="h-11 rounded-md border border-input bg-surface px-3 text-foreground outline-none ring-offset-background transition focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {allDifficulties.map((difficulty) => (
                <option key={difficulty} value={difficulty}>
                  {difficulty === "all" ? "All levels" : difficulty}
                </option>
              ))}
            </select>
          </label>

          <Button
            type="button"
            variant={randomMode ? "practice" : "quiet"}
            className="mt-auto h-11"
            onClick={() => setRandomMode((enabled) => !enabled)}
            aria-pressed={randomMode}
          >
            <Shuffle />
            {randomMode ? "Random" : "Sequential"}
          </Button>
        </div>

        <article className="relative overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="absolute inset-x-0 top-0 h-1 bg-accent" aria-hidden="true" />
          <div className="p-5 sm:p-8">
            {loading ? (
              <div className="space-y-4 py-12 text-center">
                <h2 className="text-2xl font-bold text-card-foreground">Loading questions</h2>
                <p className="text-muted-foreground">Preparing your local practice deck.</p>
              </div>
            ) : loadError ? (
              <div className="space-y-4 py-12 text-center">
                <h2 className="text-2xl font-bold text-card-foreground">Questions unavailable</h2>
                <p className="text-muted-foreground">Check public/questions.json and reload the app.</p>
              </div>
            ) : currentQuestion ? (
              <div key={currentQuestion.id} className="animate-fade-slide space-y-6 motion-reduce:animate-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-sm bg-secondary px-2.5 py-1 text-xs font-semibold uppercase tracking-normal text-secondary-foreground">
                      {currentQuestion.difficulty}
                    </span>
                    {currentQuestion.tags.map((tag) => (
                      <span key={tag} className="rounded-sm border border-border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={toggleBookmark}
                    className="inline-flex size-10 items-center justify-center rounded-md text-muted-foreground transition hover:bg-secondary hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    aria-label={isBookmarked ? "Remove bookmark" : "Bookmark question"}
                  >
                    {isBookmarked ? <BookmarkCheck className="size-5 text-accent" /> : <Bookmark className="size-5" />}
                  </button>
                </div>

                <div className="space-y-5">
                  <p className="text-sm font-medium text-muted-foreground">
                    Question {position} of {filteredQuestions.length}
                  </p>
                  <h2 className="text-balance text-2xl font-bold leading-tight text-card-foreground sm:text-4xl">
                    {currentQuestion.question}
                  </h2>
                  <div
                    className={`grid transition-all duration-200 ${showAnswer ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
                  >
                    <div className="overflow-hidden">
                      <p className="rounded-md border border-border bg-surface-subtle p-4 text-lg leading-relaxed text-foreground">
                        {currentQuestion.answer}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <Button type="button" variant="quiet" onClick={() => goToQuestion(-1)}>
                    <ChevronLeft /> Previous
                  </Button>
                  <Button type="button" variant="practice" onClick={() => setShowAnswer((visible) => !visible)}>
                    {showAnswer ? <EyeOff /> : <Eye />}
                    {showAnswer ? "Hide Answer" : "Show Answer"}
                  </Button>
                  <Button type="button" variant="quiet" onClick={() => goToQuestion(1)}>
                    Next <ChevronRight />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4 py-12 text-center">
                <h2 className="text-2xl font-bold text-card-foreground">No questions found</h2>
                <p className="text-muted-foreground">Adjust filters or add questions in the JSON file.</p>
              </div>
            )}
          </div>
        </article>

        <footer className="grid gap-3 rounded-lg border border-border bg-surface/80 p-4 text-sm text-muted-foreground shadow-soft sm:grid-cols-3">
          <p>
            <span className="font-semibold text-foreground">Viewed:</span> {progress.totalViewed}
          </p>
          <p>
            <span className="font-semibold text-foreground">Bookmarked:</span> {bookmarkedIds.length}
          </p>
          <p>
            <span className="font-semibold text-foreground">Shortcuts:</span> Space · ← · →
          </p>
        </footer>
      </section>
    </main>
  );
}
