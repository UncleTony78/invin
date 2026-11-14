import "server-only";

/* Plain, readable emails in the sender's brand colour. Table layout so every mail client renders them. */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

function shell({ brand, business, preheader, body, button }: { brand: string; business: string; preheader: string; body: string; button?: { label: string; url: string } }) {
  return `<!doctype html><html><body style="margin:0;background:#F2F2EF;font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;color:#1A1916">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#fff;border-radius:14px;overflow:hidden">
<tr><td style="background:${brand};padding:20px 28px;color:#fff;font-weight:600;font-size:15px">${esc(business)}</td></tr>
<tr><td style="padding:28px;font-size:15px;line-height:1.6">${body}
${button ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="background:${brand};border-radius:8px"><a href="${button.url}" style="display:inline-block;padding:12px 20px;color:#fff;text-decoration:none;font-weight:600">${esc(button.label)}</a></td></tr></table>` : ""}
</td></tr></table>
<p style="font-size:12px;color:#6E6C66;margin-top:16px">Sent with InVin</p>
</td></tr></table></body></html>`;
}

const paragraphs = (text: string) => text.split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");

export function invoiceEmail(o: { brand: string; business: string; number: string; amount: string; due: string; message: string; url: string }) {
  const text = `${o.message}\n\nView, download or pay invoice ${o.number}: ${o.url}`;
  const html = shell({
    brand: o.brand,
    business: o.business,
    preheader: `Invoice ${o.number} for ${o.amount}, due ${o.due}`,
    body: `<p style="margin:0 0 4px;color:#6E6C66;font-size:13px">Invoice ${esc(o.number)}</p><p style="margin:0 0 18px;font-size:28px;font-weight:600;letter-spacing:-.02em">${esc(o.amount)}</p><p style="margin:0 0 20px;color:#6E6C66">Due ${esc(o.due)}</p>${paragraphs(o.message)}`,
    button: { label: "View invoice", url: o.url },
  });
  return { text, html };
}

export function reminderEmail(o: { brand: string; business: string; customer: string; number: string; left: string; dueLine: string; sender: string; url: string }) {
  const message = `Hi ${o.customer} team,\n\nA quick reminder that invoice ${o.number} for ${o.left} ${o.dueLine}. The bank details are on the invoice.\n\nThanks,\n${o.sender}`;
  return {
    text: `${message}\n\nView invoice: ${o.url}`,
    html: shell({ brand: o.brand, business: o.business, preheader: `Reminder: ${o.number} for ${o.left}`, body: paragraphs(message), button: { label: "View invoice", url: o.url } }),
  };
}

export function claimNotice(o: { customer: string; number: string; amount: string; paidOn: string; reference: string; note: string; url: string }) {
  const lines = [`${o.customer} says they paid ${o.amount} for invoice ${o.number} on ${o.paidOn}.`, o.reference && `Reference: ${o.reference}`, o.note && `Their note: ${o.note}`, "Check your bank, then confirm it in InVin. Nothing changes until you do."].filter(Boolean).join("\n\n");
  return {
    text: `${lines}\n\nOpen the invoice: ${o.url}`,
    html: shell({ brand: "#1A1916", business: "InVin", preheader: `${o.customer} says they paid ${o.amount}`, body: paragraphs(lines), button: { label: "Review payment", url: o.url } }),
  };
}

export function signInCodeEmail(code: string) {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `${spaced} is your InVin sign-in code`,
    text: `Your InVin sign-in code is ${spaced}.\n\nIt works for 10 minutes. If you didn't try to sign in, you can ignore this email.`,
    html: shell({
      brand: "#1A1916",
      business: "InVin",
      preheader: `Your sign-in code is ${spaced}`,
      body: `<p style="margin:0 0 6px;color:#6E6C66;font-size:13px">Your sign-in code</p><p style="margin:0 0 18px;font-size:34px;font-weight:600;letter-spacing:.12em;font-family:'IBM Plex Mono',Menlo,monospace">${esc(spaced)}</p><p style="margin:0">It works for 10 minutes. If you didn't try to sign in, you can ignore this email.</p>`,
    }),
  };
}

/** Sent to the customer after a payment is recorded. */
export function receiptEmail(o: { brand: string; business: string; customer: string; number: string; amount: string; paidOn: string; method: string; left: string | null; url: string }) {
  const status = o.left ? `${o.left} is still left to pay on this invoice.` : `Invoice ${o.number} is now paid in full.`;
  const message = `Hi ${o.customer},\n\nThanks, we've received your payment of ${o.amount} for invoice ${o.number}.\n\n${status}`;
  return {
    subject: `Receipt for ${o.amount} · invoice ${o.number}`,
    text: `${message}\n\nPaid on ${o.paidOn} by ${o.method.toLowerCase()}.\n\nView the invoice: ${o.url}`,
    html: shell({
      brand: o.brand,
      business: o.business,
      preheader: `Payment of ${o.amount} received`,
      body: `<p style="margin:0 0 4px;color:#6E6C66;font-size:13px">Payment received</p><p style="margin:0 0 6px;font-size:28px;font-weight:600;letter-spacing:-.02em">${esc(o.amount)}</p><p style="margin:0 0 20px;color:#6E6C66">${esc(o.paidOn)} · ${esc(o.method)}</p>${paragraphs(message)}`,
      button: { label: "View invoice", url: o.url },
    }),
  };
}

/** To the business: a recurring series made a draft that's waiting for review. */
export function draftReadyNotice(o: { number: string; customer: string; amount: string; url: string }) {
  const text = `Your recurring invoice for ${o.customer} is ready as a draft: ${o.number} for ${o.amount}.\n\nCheck it, change anything you need, then send it.`;
  return {
    subject: `Draft ${o.number} for ${o.customer} is ready to review`,
    text: `${text}\n\nOpen it: ${o.url}`,
    html: shell({ brand: "#1A1916", business: "InVin", preheader: `${o.number} for ${o.amount} is ready`, body: paragraphs(text), button: { label: "Review draft", url: o.url } }),
  };
}

/** A statement sent to a customer; the PDF is attached. */
export function statementEmail(o: { brand: string; business: string; period: string; balance: string; message: string }) {
  return {
    subject: `Your statement from ${o.business} · ${o.period}`,
    text: `${o.message}\n\nBalance at the end of the period: ${o.balance}. The full statement is attached as a PDF.`,
    html: shell({
      brand: o.brand,
      business: o.business,
      preheader: `Statement for ${o.period}, balance ${o.balance}`,
      body: `<p style="margin:0 0 4px;color:#6E6C66;font-size:13px">Statement · ${esc(o.period)}</p><p style="margin:0 0 18px;font-size:28px;font-weight:600;letter-spacing:-.02em">${esc(o.balance)}</p>${paragraphs(o.message)}<p style="margin:0;color:#6E6C66;font-size:13px">The full statement is attached as a PDF.</p>`,
    }),
  };
}

/** An estimate sent to a customer, with a button to review and accept it. */
export function estimateEmail(o: { brand: string; business: string; number: string; amount: string; validUntil: string; message: string; url: string }) {
  return {
    text: `${o.message}\n\nReview and accept estimate ${o.number}: ${o.url}`,
    html: shell({
      brand: o.brand,
      business: o.business,
      preheader: `Estimate ${o.number} for ${o.amount}, valid until ${o.validUntil}`,
      body: `<p style="margin:0 0 4px;color:#6E6C66;font-size:13px">Estimate ${esc(o.number)}</p><p style="margin:0 0 18px;font-size:28px;font-weight:600;letter-spacing:-.02em">${esc(o.amount)}</p><p style="margin:0 0 20px;color:#6E6C66">Valid until ${esc(o.validUntil)}</p>${paragraphs(o.message)}`,
      button: { label: "Review estimate", url: o.url },
    }),
  };
}

/** To the business: the customer accepted or declined an estimate. */
export function estimateDecisionNotice(o: { customer: string; number: string; amount: string; accepted: boolean; by?: string; reason?: string; url: string }) {
  const text = o.accepted
    ? `${o.customer} accepted estimate ${o.number} for ${o.amount}${o.by ? `, signed by ${o.by}` : ""}.\n\nTurn it into an invoice when you're ready.`
    : `${o.customer} declined estimate ${o.number} for ${o.amount}.${o.reason ? `\n\nTheir reason: ${o.reason}` : ""}`;
  return {
    subject: `${o.customer} ${o.accepted ? "accepted" : "declined"} estimate ${o.number}`,
    text: `${text}\n\nOpen it: ${o.url}`,
    html: shell({ brand: "#1A1916", business: "InVin", preheader: `${o.customer} ${o.accepted ? "accepted" : "declined"} ${o.number}`, body: paragraphs(text), button: { label: "Open estimate", url: o.url } }),
  };
}

/** Invitation to join a workspace. */
export function inviteEmail(o: { inviter: string; business: string; role: string; url: string }) {
  const text = `${o.inviter} invited you to ${o.business} on InVin as ${o.role === "admin" ? "an admin" : "a member"}.\n\nYou'll be able to create and send invoices, record payments and see what's owed. The link works for 14 days.`;
  return {
    subject: `${o.inviter} invited you to ${o.business} on InVin`,
    text: `${text}\n\nJoin: ${o.url}`,
    html: shell({ brand: "#1A1916", business: "InVin", preheader: `Join ${o.business} on InVin`, body: paragraphs(text), button: { label: `Join ${o.business}`, url: o.url } }),
  };
}

/** The member's daily or weekly summary of the workspace. `stats` are already formatted. */
export function digestEmail(o: { subject: string; business: string; period: string; stats: { label: string; value: string; note?: string }[]; events: string[]; url: string; settingsUrl: string }) {
  const cell = (st: { label: string; value: string; note?: string }) =>
    `<td style="padding:12px 14px;background:#F6F6F3;border-radius:10px;vertical-align:top" width="50%"><div style="font-size:12px;color:#6E6C66">${esc(st.label)}</div><div style="font-size:20px;font-weight:600;margin-top:2px">${esc(st.value)}</div>${st.note ? `<div style="font-size:12px;color:#6E6C66;margin-top:2px">${esc(st.note)}</div>` : ""}</td>`;
  const rows: string[] = [];
  for (let i = 0; i < o.stats.length; i += 2) rows.push(`<tr>${cell(o.stats[i])}<td width="8"></td>${o.stats[i + 1] ? cell(o.stats[i + 1]) : "<td></td>"}</tr><tr><td height="8"></td></tr>`);
  const list = o.events.length
    ? `<p style="margin:20px 0 8px;font-weight:600">What happened</p><ul style="margin:0;padding-left:18px">${o.events.map((e) => `<li style="margin:0 0 6px">${esc(e)}</li>`).join("")}</ul>`
    : "";
  const body = `<p style="margin:0 0 16px">Here's ${esc(o.period)} at ${esc(o.business)}.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows.join("")}</table>${list}
<p style="margin:20px 0 0;font-size:12px;color:#6E6C66">Change how often you get this in <a href="${o.settingsUrl}" style="color:#6E6C66">Settings</a>.</p>`;
  const text = [`Here's ${o.period} at ${o.business}.`, "", ...o.stats.map((st) => `${st.label}: ${st.value}${st.note ? ` (${st.note})` : ""}`), ...(o.events.length ? ["", "What happened:", ...o.events.map((e) => `- ${e}`)] : []), "", `Open InVin: ${o.url}`, `Change how often you get this: ${o.settingsUrl}`].join("\n");
  return {
    subject: o.subject,
    text,
    html: shell({ brand: "#1A1916", business: "InVin", preheader: o.stats.map((st) => `${st.label} ${st.value}`).join(" · "), body, button: { label: "Open InVin", url: o.url } }),
  };
}
