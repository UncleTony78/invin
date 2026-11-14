"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, MorphLabel } from "@/components/ui/button";
import { Segmented, TextField } from "@/components/ui/form";
import { Icon } from "@/components/ui/icon";
import { Avatar } from "@/components/ui/identity";
import { Dialog, DialogClose, DialogContent, DialogTrigger, Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger } from "@/components/ui/overlay";
import { useToast } from "@/components/ui/toast";
import { changeRole, inviteMember, removeMember, resendInvite, revokeInvite } from "@/server/team-actions";

export type TeamMember = { id: string; name: string; email: string; role: string; you: boolean };
export type PendingInvite = { id: string; email: string; role: string; expiresAt: string; expired: boolean };

const ROLE_COPY: Record<string, string> = {
  owner: "Everything, including handing over the workspace",
  admin: "Everything except ownership: settings, bank details, the team",
  member: "Day-to-day billing: invoices, payments, customers",
};
const label = (r: string) => r[0].toUpperCase() + r.slice(1);

/** Who's on the team, what each person can do, and who's been invited. */
export function TeamSection({ team, invites, myRole }: { team: TeamMember[]; invites: PendingInvite[]; myRole: string }) {
  const router = useRouter();
  const toast = useToast();
  const canManage = myRole === "owner" || myRole === "admin";
  const [confirm, setConfirm] = useState<null | { kind: "remove" | "leave" | "owner"; m: TeamMember }>(null);
  const [busy, setBusy] = useState(false);
  const done = (title: string) => { toast({ title }); router.refresh(); };

  async function run() {
    if (!confirm) return;
    setBusy(true);
    const r = confirm.kind === "owner" ? await changeRole(confirm.m.id, "owner") : await removeMember(confirm.m.id);
    setBusy(false);
    setConfirm(null);
    if (!r.ok) return toast({ title: r.error });
    if (confirm.kind === "leave") { router.replace("/"); router.refresh(); return; }
    done(confirm.kind === "owner" ? `${confirm.m.name} is now the owner. You're an admin.` : `${confirm.m.name} was removed from the team`);
  }

  return (
    <div className="grid gap-4">
      <ul className="set-team">
        {team.map((m) => (
          <li key={m.id}>
            <Avatar name={m.name} size="md" />
            <span className="min-w-0 flex-1"><b>{m.name}{m.you && <span className="text-text-2 font-normal"> (you)</span>}</b><small>{m.email}</small></span>
            {canManage && !m.you && m.role !== "owner" ? (
              <Menu>
                <MenuTrigger>
                  <Button size="sm" variant="ghost">{label(m.role)}<Icon name="chevron" /></Button>
                </MenuTrigger>
                <MenuContent align="end">
                  <MenuLabel>Role</MenuLabel>
                  {(["admin", "member"] as const).map((r) => (
                    <MenuItem key={r} onClick={async () => { if (r === m.role) return; const res = await changeRole(m.id, r); if (!res.ok) return toast({ title: res.error }); done(`${m.name} is now ${r === "admin" ? "an admin" : "a member"}`); }}>
                      <span><b className="font-medium">{label(r)}</b><small>{ROLE_COPY[r]}</small></span>
                      {m.role === r && <span className="iv-right"><Icon name="check" /></span>}
                    </MenuItem>
                  ))}
                  {myRole === "owner" && (
                    <>
                      <MenuSeparator />
                      <MenuItem onClick={() => setConfirm({ kind: "owner", m })}><Icon name="users" />Make them the owner</MenuItem>
                    </>
                  )}
                  <MenuSeparator />
                  <MenuItem onClick={() => setConfirm({ kind: "remove", m })}><Icon name="trash" />Remove from team</MenuItem>
                </MenuContent>
              </Menu>
            ) : (
              <span className="team-role" title={ROLE_COPY[m.role]}>{label(m.role)}</span>
            )}
            {m.you && m.role !== "owner" && <Button size="sm" variant="ghost" onClick={() => setConfirm({ kind: "leave", m })}>Leave</Button>}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.id} className="team-invite">
            <span className="team-pending" aria-hidden="true"><Icon name="mail" size={14} /></span>
            <span className="min-w-0 flex-1">
              <b>{i.email}</b>
              <small>{i.expired ? "Invite expired" : `Invited as ${i.role === "admin" ? "an admin" : "a member"} · link works until ${new Date(i.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`}</small>
            </span>
            {canManage && (
              <>
                <Button size="sm" variant="ghost" onClick={async () => { const r = await resendInvite(i.id); if (!r.ok) return toast({ title: r.error }); done(`Invite sent again to ${i.email}`); }}>Resend</Button>
                <Button size="sm" variant="ghost" iconOnly icon="x" aria-label={`Withdraw the invite for ${i.email}`} onClick={async () => { await revokeInvite(i.id); done(`Invite for ${i.email} withdrawn`); }} />
              </>
            )}
          </li>
        ))}
      </ul>
      {canManage ? <InviteDialog onSent={(msg) => done(msg)} /> : <p className="iv-hint">Only owners and admins can invite people.</p>}

      <Dialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        {confirm && (
          <DialogContent
            title={confirm.kind === "owner" ? `Make ${confirm.m.name} the owner?` : confirm.kind === "leave" ? "Leave this workspace?" : `Remove ${confirm.m.name}?`}
            description={
              confirm.kind === "owner"
                ? "They'll be able to do everything, including handing it on. You'll become an admin. Only they can undo this."
                : confirm.kind === "leave"
                  ? "You'll lose access straight away. Someone will need to invite you again to come back."
                  : "They lose access straight away. Everything they did stays on record with their name."
            }
            footer={
              <>
                <span className="iv-sp" />
                <DialogClose render={<Button>Cancel</Button>} />
                <Button variant={confirm.kind === "owner" ? "primary" : "danger"} disabled={busy} onClick={run}>
                  {confirm.kind === "owner" ? "Make them the owner" : confirm.kind === "leave" ? "Leave workspace" : "Remove"}
                </Button>
              </>
            }
          />
        )}
      </Dialog>
    </div>
  );
}

function InviteDialog({ onSent }: { onSent: (msg: string) => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [state, setState] = useState<"idle" | "sending">("idle");
  const [error, setError] = useState("");
  async function send() {
    setError("");
    setState("sending");
    const r = await inviteMember(email, role);
    setState("idle");
    if (!r.ok) return setError(r.error);
    setOpen(false);
    onSent(r.delivery === "failed" ? `Invite saved, but the email failed. See Sent emails.` : r.again ? `New invite link sent to ${email.trim()}` : `Invite sent to ${email.trim()}`);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) { setEmail(""); setRole("member"); setError(""); } }}>
      <DialogTrigger><Button icon="plus" className="justify-self-start">Invite a teammate</Button></DialogTrigger>
      <DialogContent
        title="Invite a teammate"
        description="They get an email with a link to join. It works for 14 days, and only for this email address."
        footer={
          <>
            <span className="iv-sp" />
            <DialogClose render={<Button>Cancel</Button>} />
            <Button variant="primary" disabled={state === "sending"} style={{ minWidth: 130 }} onClick={send}>
              <MorphLabel id={state}>{state === "sending" ? "Sending…" : <><Icon name="send" />Send invite</>}</MorphLabel>
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); send(); }}>
          <TextField label="Email" type="email" autoFocus placeholder="name@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </form>
        <div className="iv-field">
          <span className="iv-label">Role</span>
          <Segmented fill label="Role" value={role} onChange={setRole} options={[{ value: "member", label: "Member" }, { value: "admin", label: "Admin" }]} />
          <span className="iv-hint">{ROLE_COPY[role]}.</span>
        </div>
        {error && <div className="form-error"><Icon name="alert" />{error}</div>}
      </DialogContent>
    </Dialog>
  );
}
