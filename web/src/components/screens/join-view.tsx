"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InVinMark } from "@/components/brand/mark";
import { Button, MorphLabel } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { authClient } from "@/lib/auth-client";
import { acceptInvite } from "@/server/team-actions";

type Base = { token: string; workspace: { name: string; mark: string; brand: string }; inviter: string; role: string; email: string; you: string };
type State = { kind: "missing" } | ({ kind: "ready" | "used" | "expired" | "wrong-email" } & Base);

/** Where an invite link lands: who invited you, to what, as what, and one button to join. */
export function JoinView({ state }: { state: State }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "join" | "done">("");
  const [error, setError] = useState("");
  const signOut = async () => {
    await authClient.signOut();
    router.replace(state.kind === "missing" ? "/sign-in" : `/sign-in?next=/join/${state.token}`);
  };

  return (
    <main className="auth">
      <div className="auth-card join">
        {state.kind === "missing" ? (
          <>
            <InVinMark size={36} />
            <h1>This invite link doesn&apos;t work</h1>
            <p className="auth-sub">It may have been copied wrongly or withdrawn. Ask whoever invited you to send a new one.</p>
            <Link className="iv-btn iv-btn--secondary auth-go" href="/">Go to InVin</Link>
          </>
        ) : (
          <>
            <span className="join-mk" style={{ background: state.workspace.brand }}>{state.workspace.mark}</span>
            <h1>Join {state.workspace.name}</h1>
            <p className="auth-sub">
              {state.inviter} invited you as {state.role === "admin" ? "an admin" : "a member"}.{" "}
              {state.role === "admin" ? "You'll be able to send invoices and change settings and the team." : "You'll be able to create and send invoices, record payments and see what's owed."}
            </p>
            {state.kind === "ready" && (
              <Button
                variant="primary"
                className="auth-go"
                disabled={!!busy}
                onClick={async () => {
                  setBusy("join");
                  setError("");
                  const r = await acceptInvite(state.token);
                  if (!r.ok) {
                    setBusy("");
                    return setError(r.error);
                  }
                  setBusy("done");
                  setTimeout(() => {
                    router.replace("/");
                    router.refresh();
                  }, 500);
                }}
              >
                <MorphLabel id={busy || "idle"}>{busy === "join" ? "Joining…" : busy === "done" ? <><Icon name="check" />You&apos;re in</> : `Join ${state.workspace.name}`}</MorphLabel>
              </Button>
            )}
            {state.kind === "wrong-email" && (
              <>
                <p className="auth-err"><Icon name="alert" size={14} />This invite is for {state.email}, and you&apos;re signed in as {state.you}.</p>
                <Button variant="primary" className="auth-go" onClick={signOut}>Sign in as {state.email}</Button>
              </>
            )}
            {state.kind === "expired" && <p className="auth-err"><Icon name="alert" size={14} />This invite has expired. Ask {state.inviter} to send a new one.</p>}
            {state.kind === "used" && (
              <>
                <p className="auth-note"><Icon name="check" size={14} />This invite has already been used.</p>
                <Link className="iv-btn iv-btn--secondary auth-go" href="/">Go to InVin</Link>
              </>
            )}
            {error && <p className="auth-err"><Icon name="alert" size={14} />{error}</p>}
            <p className="auth-fine">Signed in as {state.you}</p>
          </>
        )}
      </div>
    </main>
  );
}
