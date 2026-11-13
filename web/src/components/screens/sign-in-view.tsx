"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { InVinMark } from "@/components/brand/mark";
import { Button, MorphLabel } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";

const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/**
 * Two steps on one card: email, then the 6-digit code.
 * The card slides left to the code and back right to the email, along the same path.
 */
export function SignInView({ next, testInbox }: { next: string; testInbox: string | null }) {
  const router = useRouter();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function sendCode() {
    setError("");
    if (!emailOk(email)) return setError("That email looks incomplete. Check it and try again.");
    setState("busy");
    const res = await authClient.emailOtp.sendVerificationOtp({ email: email.trim().toLowerCase(), type: "sign-in" });
    setState("idle");
    if (res.error) return setError(res.error.status === 429 ? "Too many tries. Wait a minute, then try again." : "We couldn't send a code just now. Try again in a moment.");
    setCooldown(30);
    setStep("code");
  }

  async function verify(code: string) {
    setError("");
    setState("busy");
    const res = await authClient.signIn.emailOtp({ email: email.trim().toLowerCase(), otp: code });
    if (res.error) {
      setState("idle");
      const msg = (res.error.message ?? "").toLowerCase();
      setError(msg.includes("expired") ? "That code has expired. Send a new one." : msg.includes("attempt") ? "Too many wrong tries. Send a new code." : "That code didn't match. Check the email and try again.");
      return false;
    }
    setState("done");
    router.replace(next);
    router.refresh();
    return true;
  }

  const slide = (dir: 1 | -1) => (reduce ? { opacity: 0 } : { opacity: 0, x: 24 * dir });

  return (
    <main className="auth">
      <div className="auth-card">
        <InVinMark size={36} />
        <AnimatePresence mode="popLayout" initial={false}>
          {step === "email" ? (
            <motion.form
              key="email"
              initial={slide(-1)}
              animate={{ opacity: 1, x: 0 }}
              exit={slide(-1)}
              transition={SPRING}
              onSubmit={(e) => {
                e.preventDefault();
                sendCode();
              }}
            >
              <h1>Sign in to InVin</h1>
              <p className="auth-sub">Enter your email and we&apos;ll send you a 6-digit code. No password to remember.</p>
              <label className="iv-field">
                <span className="iv-label">Email</span>
                <input
                  className="iv-input"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                  placeholder="you@business.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError("");
                  }}
                  aria-invalid={!!error || undefined}
                />
              </label>
              {error && <p className="auth-err" role="alert"><Icon name="alert" size={14} />{error}</p>}
              <Button type="submit" variant="primary" className="auth-go" disabled={state === "busy"}>
                <MorphLabel id={state}>{state === "busy" ? "Sending code…" : "Continue"}</MorphLabel>
              </Button>
              <p className="auth-fine">New here? The same code creates your account.</p>
            </motion.form>
          ) : (
            <motion.div key="code" initial={slide(1)} animate={{ opacity: 1, x: 0 }} exit={slide(1)} transition={SPRING}>
              <h1>Check your email</h1>
              <p className="auth-sub">
                We sent a code to <b>{email.trim().toLowerCase()}</b>. It works for 10 minutes.
              </p>
              {testInbox && (
                <p className="auth-note"><Icon name="mail" size={14} />Test mode: the email goes to {testInbox}.</p>
              )}
              <CodeInput disabled={state !== "idle"} error={!!error} onComplete={verify} onType={() => setError("")} />
              {error && <p className="auth-err" role="alert"><Icon name="alert" size={14} />{error}</p>}
              {state !== "idle" && (
                <p className="auth-status" aria-live="polite">
                  <MorphLabel id={state}>{state === "busy" ? "Checking…" : <><Icon name="check" size={14} />Signed in</>}</MorphLabel>
                </p>
              )}
              <div className="auth-links">
                <button type="button" onClick={() => { setStep("email"); setError(""); }}>Use a different email</button>
                <button type="button" disabled={cooldown > 0 || state !== "idle"} onClick={sendCode}>
                  {cooldown > 0 ? `Send a new code in ${cooldown}s` : "Send a new code"}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="auth-foot">Customers never need an account. They open invoices from the link you send.</p>
    </main>
  );
}

/** Six boxes that behave like one field: type, paste, backspace across boxes. Submits itself when full. */
function CodeInput({ disabled, error, onComplete, onType }: { disabled: boolean; error: boolean; onComplete: (code: string) => Promise<boolean>; onType: () => void }) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const [shake, setShake] = useState(0);

  async function fill(next: string[], focus: number) {
    setDigits(next);
    onType();
    refs.current[Math.min(focus, 5)]?.focus();
    if (next.every(Boolean)) {
      const ok = await onComplete(next.join(""));
      if (!ok) {
        setShake((n) => n + 1);
        setDigits(Array(6).fill(""));
        requestAnimationFrame(() => refs.current[0]?.focus());
      }
    }
  }

  return (
    <motion.div
      className="auth-code"
      data-error={error || undefined}
      key={shake}
      animate={shake ? { x: [0, -6, 6, -4, 4, 0] } : undefined}
      transition={{ duration: 0.32 }}
      role="group"
      aria-label="6-digit code"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={i === 0 ? 6 : 1}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (!v) return fill(digits.map((x, k) => (k === i ? "" : x)), i);
            // Pasted or autofilled several digits: spread them across the boxes
            const next = [...digits];
            v.split("").slice(0, 6 - i).forEach((c, k) => (next[i + k] = c));
            fill(next, i + v.length);
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digits[i] && i > 0) {
              e.preventDefault();
              fill(digits.map((x, k) => (k === i - 1 ? "" : x)), i - 1);
            }
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          onPaste={(e) => {
            const v = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
            if (!v) return;
            e.preventDefault();
            const next = Array(6).fill("").map((_, k) => v[k] ?? "");
            fill(next, v.length);
          }}
        />
      ))}
    </motion.div>
  );
}
