import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Witz AI Studio" },
      {
        name: "description",
        content:
          "Sign in to Witz AI Studio to save your chat history, attachments and generated code across devices.",
      },
      { property: "og:title", content: "Sign in — Witz AI Studio" },
      {
        property: "og:description",
        content: "Sign in to save your Witz AI Studio sessions and generated code.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    setMsg(null);
    if (mode === "signup") {
      const { error: e } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (e) setError(e.message);
      else setMsg("Check your inbox to confirm your email, then sign in.");
    } else {
      const { error: e } = await supabase.auth.signInWithPassword({ email, password });
      if (e) setError(e.message);
    }
    setBusy(false);
  };

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) setError("Google sign-in failed. Please try again.");
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="glass-strong glow-ring w-full max-w-md rounded-4xl p-7">
        <Link to="/" className="font-display text-gradient text-2xl font-bold">
          Witz AI Studio
        </Link>
        <h1 className="mt-6 text-2xl font-bold">
          {mode === "signin" ? "Welcome back" : "Create your studio"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in and every session, attachment and artifact gets saved automatically.
        </p>

        <button
          onClick={google}
          className="glass glow-hover mt-6 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold"
        >
          <Sparkles className="size-4 text-primary" /> Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-border" />
          <span className="label-mono text-muted-foreground">or</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@studio.ai"
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/60"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            placeholder="Password"
            className="glass w-full rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/60"
          />
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{error}</p>}
        {msg && <p className="mt-3 text-xs text-primary">{msg}</p>}

        <button
          onClick={submit}
          disabled={busy || !email || !password}
          className="btn-glow mt-5 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold disabled:opacity-40"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        <button
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-4 w-full text-xs text-muted-foreground hover:text-primary"
        >
          {mode === "signin" ? "No account yet? Sign up" : "Already have an account? Sign in"}
        </button>
        <Link to="/" className="mt-3 block w-full text-center text-xs text-muted-foreground hover:text-primary">
          Continue without saving chats
        </Link>
      </div>
    </div>
  );
}
