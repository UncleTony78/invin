import json
P = json.load(open('parts.json'))
SYM, SMALL, WORD, S, GAP, C = P['SYM'], P['SYM_SMALL'], P['WORD'], P['S'], P['GAP'], P['C']
T, I, Pp, St, Pd = C['tangerine'], C['ink'], C['paper'], C['stone'], C['paid']


def word_paths(fill):
    return f'<g fill="{fill}">' + ''.join(f'<path d="{x}Z"/>' for x in WORD.split('Z') if x.strip()) + '</g>'


def sym(fill, small=False, size=None):
    sz = f' width="{size}" height="{size}"' if size else ''
    return f'<svg viewBox="0 0 256 256"{sz}><path fill="{fill}" fill-rule="evenodd" d="{SMALL if small else SYM}"/></svg>'


tp = 160 * S


def lock(sf, wf, h=60, style=''):
    tx = -48 * S; ty = 200 - 208 * S; wx = tp + GAP; W = wx + 388
    w = h * W / 161
    return (f'<svg style="{style}" viewBox="0 41 {W:.1f} 161" height="{h}" width="{w:.0f}">'
            f'<g transform="translate({tx:.2f} {ty:.2f}) scale({S:.4f})"><path fill="{sf}" fill-rule="evenodd" d="{SYM}"/></g>'
            f'<g transform="translate({wx:.2f} 0)">{word_paths(wf)}</g></svg>')


def stack(sf, wf, h=150):
    s = 0.8; tw = 160 * s; sx = (388 - tw) / 2
    return (f'<svg viewBox="0 0 388 {tw + 20 + 161 + 10:.0f}" height="{h}">'
            f'<g transform="translate({sx - 48 * s:.1f} {-48 * s:.1f}) scale({s})"><path fill="{sf}" fill-rule="evenodd" d="{SYM}"/></g>'
            f'<g transform="translate(0 {tw + 30 - 41:.0f})">{word_paths(wf)}</g></svg>')


construction = f'''<svg viewBox="0 0 256 256" width="300" height="300">
 <defs><pattern id="g" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M16 0H0V16" fill="none" stroke="#e2ddd2" stroke-width="1"/></pattern></defs>
 <rect width="256" height="256" fill="url(#g)"/>
 <path fill="{T}" fill-rule="evenodd" d="{SYM}"/>
 <g fill="none" stroke="{I}" stroke-width="1" stroke-dasharray="3 3">
  <circle cx="94" cy="94" r="46"/><circle cx="162" cy="162" r="46"/>
  <line x1="40" y1="101" x2="216" y2="101"/><line x1="128" y1="36" x2="128" y2="220"/>
 </g>
 <g font-family="Geist Mono,monospace" font-size="8.5" fill="{I}">
  <text x="48" y="238">tile 160 · corner r46</text><text x="48" y="28">slot 64×26 = word stroke</text>
 </g></svg>'''


def sw(name, hexv, job, ratio, dark=False):
    return (f'<div class="sw"><div class="chip" style="background:{hexv};{"color:#fff" if dark else ""}"><span>{ratio}</span></div>'
            f'<b>{name}</b><code>{hexv}</code><p>{job}</p></div>')


rows = [('Acme Corp', 'INV-0124', '$2,450.00', 'Paid', '#E3F1E8', Pd),
        ('Studio Nine', 'INV-0123', '$880.00', 'Sent', '#F1EEE8', I),
        ('Lumen Labs', 'INV-0122', '$4,100.00', 'Overdue', '#FDE7DE', '#A8360C'),
        ('Northwind', 'INV-0121', '$1,200.00', 'Paid', '#E3F1E8', Pd),
        ('Bloom & Co', 'INV-0120', '$640.00', 'Draft', '#F6F4EF', St)]
rows_html = ''.join(
    f'<div class="rowi"><span>{c}</span><span class="mono" style="color:{St}">{n}</span><span class="mono">{a}</span>'
    f'<span class="pill" style="background:{bg};color:{fg}">{s}</span></div>' for c, n, a, s, bg, fg in rows)
lines_html = ''.join(
    f'<div style="display:flex;justify-content:space-between;padding:9px 0;border-bottom:1px solid #f0ede7"><span>{a}</span><span class="mono">{b}</span></div>'
    for a, b in [('Brand refresh · 8 h', '$720.00'), ('Asset export', '$160.00')])

html = f'''<!doctype html><html><head><meta charset="utf-8"><title>InVin brand kit</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
*{{box-sizing:border-box;margin:0}}
body{{background:{Pp};font-family:Inter,'Segoe UI',system-ui,sans-serif;color:{I};width:1600px;padding:56px;-webkit-font-smoothing:antialiased}}
.grid{{display:grid;gap:20px}}
.card{{background:#fff;border-radius:28px;padding:36px;position:relative;overflow:hidden}}
.lbl{{position:absolute;left:28px;top:22px;font:500 12px 'Geist Mono',monospace;color:{St}}}
.hero{{background:{T};height:440px;display:flex;align-items:center;justify-content:center;border-radius:32px}}
.row3{{grid-template-columns:1.1fr 1fr 1fr}} .row2{{grid-template-columns:1fr 1fr}}
.center{{display:flex;align-items:center;justify-content:center;min-height:270px}}
.sw{{font-size:13px}}
.sw .chip{{height:130px;border-radius:18px;margin-bottom:12px;display:flex;align-items:flex-end;padding:12px;font:500 11px 'Geist Mono',monospace;box-shadow:inset 0 0 0 1px rgba(0,0,0,.06)}}
.sw b{{display:block;font-size:15px}} .sw code{{font:500 12px 'Geist Mono',monospace;color:{St}}}
.sw p{{color:{St};margin-top:6px;line-height:1.4}}
.pal{{display:grid;grid-template-columns:repeat(5,1fr);gap:18px}}
.type .big{{font-size:64px;font-weight:600;letter-spacing:-.035em;line-height:1}}
.type p{{color:{St};font-size:14px;line-height:1.5}}
.mono{{font-family:'Geist Mono',ui-monospace,'Cascadia Mono',Consolas,monospace;font-variant-numeric:tabular-nums}}
.sizes{{display:flex;align-items:flex-end;gap:28px}}
.sizes>div{{text-align:center;font:500 11px 'Geist Mono',monospace;color:{St}}}
.sizes svg,.sizes img{{display:block;margin:0 auto 10px}}
.app{{display:grid;grid-template-columns:220px 1fr;height:340px;border-radius:18px;overflow:hidden;box-shadow:0 0 0 1px #e8e4dc}}
.side{{background:#FAF8F4;padding:20px 14px;font-size:13px}}
.side .it{{padding:7px 10px;border-radius:8px;color:#3a3630;display:flex;gap:9px;align-items:center}}
.side .it.on{{background:#fff;box-shadow:0 0 0 1px #ebe7df;font-weight:500}}
.side .dot{{width:12px;height:12px;border-radius:4px;background:#e5e0d6}}
.side .sec{{font-size:11px;color:#9a948a;margin:16px 10px 6px;letter-spacing:.04em}}
.main{{padding:22px 26px;background:#fff}} .main h2{{font-size:20px;letter-spacing:-.02em}}
.rowi{{display:grid;grid-template-columns:1.4fr 1fr .8fr .7fr;font-size:13px;padding:11px 0;border-bottom:1px solid #f0ede7;align-items:center}}
.pill{{font-size:11px;font-weight:500;padding:3px 9px;border-radius:99px;justify-self:start}}
.inv{{background:#fff;border-radius:16px;box-shadow:0 1px 0 #e8e4dc,0 20px 40px -20px rgba(22,19,15,.25);padding:30px;width:420px;font-size:13px}}
.btn{{background:{T};color:{I};font-weight:600;text-align:center;padding:13px;border-radius:12px;margin-top:18px}}
.bc{{width:350px;height:200px;border-radius:14px;box-shadow:0 18px 40px -16px rgba(0,0,0,.35);padding:26px;display:flex;flex-direction:column;justify-content:space-between}}
.dont{{display:grid;grid-template-columns:repeat(5,1fr);gap:16px}}
.dont .d{{background:#fff;border-radius:18px;height:150px;display:flex;align-items:center;justify-content:center;position:relative;overflow:hidden}}
.dont .x{{font-size:12px;color:{St};margin-top:8px}}
.dont .d:after{{content:"✕";position:absolute;right:14px;top:10px;color:#C23B22;font-weight:700}}
h3{{font-size:13px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:{St};margin:12px 0 12px}}
</style></head><body>
<div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:28px">
 <div style="font-size:40px;font-weight:600;letter-spacing:-.03em">InVin brand kit <span style="color:{St};font-weight:400">· v1.0</span></div>
 <div style="font-size:14px;color:{St};max-width:620px;text-align:right;line-height:1.5">For freelancers, creators and small businesses, InVin is the invoicing app that makes getting paid feel calm, quick and a little bit delightful.</div>
</div>
<div class="grid">
 <div class="hero">{lock(I, I, 150)}</div>
 <div class="grid row3">
  <div class="card center" style="flex-direction:column;gap:16px;padding-top:52px"><span class="lbl">01 · construction</span>{construction}
   <p style="font-size:13px;color:{St};max-width:340px;text-align:center;line-height:1.5">A tile with a coin slot: every invoice is a slot money drops into. The slot is cut at the wordmark's stroke weight, so symbol and word read as one family.</p></div>
  <div class="card center" style="background:{I}"><span class="lbl" style="color:#8d877d">02 · reversed</span>{lock(T, Pp, 62)}</div>
  <div class="card center"><span class="lbl">03 · stacked</span>{stack(T, I, 200)}</div>
 </div>
 <div class="card"><span class="lbl">04 · colour</span><div class="pal" style="margin-top:26px">
  {sw('Tangerine', T, 'The brand. Symbol, primary buttons (ink label), highlights. Never for body text.', 'ink on it 5.9:1')}
  {sw('Ink', I, 'Wordmark, text, dark surfaces. A warm black, not pure #000.', 'on paper 16.4:1', True)}
  {sw('Paper', Pp, 'App canvas and brand backgrounds. Warmer than white, easier to read.', 'ink on it 16.4:1')}
  {sw('Stone', St, 'Secondary text, labels, metadata.', 'on paper 5.1:1', True)}
  {sw('Paid green', Pd, 'Status only: paid, success, money in. Never decorative.', 'on white 5.4:1', True)}
 </div></div>
 <div class="grid row2">
  <div class="card type"><span class="lbl">05 · type</span><div style="margin-top:24px;display:grid;grid-template-columns:1.3fr 1fr;gap:30px">
   <div><div class="big">Get paid, calmly.</div><p style="margin-top:14px"><b style="color:{I}">Inter</b> · 400 / 500 / 600 · SIL OFL. Headings tight (−3%), body 15/24. Scale ×1.25: 12 · 15 · 19 · 23 · 29 · 37 · 46.</p></div>
   <div><div class="mono" style="font-size:34px;letter-spacing:-.02em;line-height:1.15">$2,450.00<br><span style="font-size:17px;color:{St}">INV-0124 · NET 14</span></div><p style="margin-top:14px"><b style="color:{I}">Geist Mono</b> · 400 / 500 · SIL OFL. Amounts, invoice numbers, dates: tabular figures that line up.</p></div>
  </div></div>
  <div class="card"><span class="lbl">06 · small sizes</span><div class="sizes" style="margin-top:40px">
   <div>{sym(T, False, 96)}96</div><div>{sym(T, False, 48)}48</div><div>{sym(T, True, 32)}32 small cut</div><div>{sym(T, True, 24)}24</div><div>{sym(T, True, 16)}16</div>
   <div><img src="icons/icon-192.png" width="96" style="border-radius:22px">app icon</div></div>
   <p style="font-size:13px;color:{St};margin-top:22px;line-height:1.5">At 32 px and below use the small cut (bigger slot). Minimum lockup width: 72 px on screen, 18 mm in print. Clear space: one slot height on every side.</p></div>
 </div>
 <div class="grid" style="grid-template-columns:1.35fr 1fr">
  <div class="card" style="padding-top:56px"><span class="lbl">07 · in the app</span>
   <div class="app"><div class="side">{lock(T, I, 22)}
    <div style="height:18px"></div>
    <div class="it">Home</div><div class="it on">Invoices</div><div class="it">Recurring</div><div class="it">Customers</div><div class="it">Payments</div>
    <div class="sec">PINNED</div><div class="it"><span class="dot" style="background:{T}"></span>Acme retainer</div><div class="it"><span class="dot"></span>Studio Nine</div></div>
    <div class="main"><h2>Invoices</h2><div style="margin-top:14px">{rows_html}</div></div></div></div>
  <div class="card center" style="background:#EDE9E0;padding-top:56px"><span class="lbl">08 · hosted invoice</span>
   <div class="inv"><div style="display:flex;justify-content:space-between;align-items:center">{lock(T, I, 24)}<span class="pill" style="background:#F1EEE8">Due Dec 1</span></div>
    <div style="margin-top:22px;color:{St}">Studio Nine · invoice from Ada Obi</div><div class="mono" style="font-size:40px;letter-spacing:-.03em;margin-top:4px">$880.00</div>
    <div style="margin-top:16px;border-top:1px solid #f0ede7">{lines_html}</div>
    <div class="btn">Download PDF</div><div style="text-align:center;font-size:12px;color:{St};margin-top:12px">Sent with invin</div></div></div>
 </div>
 <div class="grid" style="grid-template-columns:1fr 1fr 1fr">
  <div class="card center" style="background:#E7E2D8;padding-top:56px"><span class="lbl">09 · business card</span>
   <div class="bc" style="background:{T};align-items:center;justify-content:center">{lock(I, I, 44)}</div></div>
  <div class="card center" style="background:#E7E2D8;padding-top:56px"><span class="lbl">10 · card back</span>
   <div class="bc" style="background:{Pp}"><div style="font-weight:600;font-size:17px">Ada Obi</div><div style="font-size:12px;color:{St};line-height:1.6">Founder<br><span class="mono">hello@invin.app</span></div>{lock(T, I, 18)}</div></div>
  <div class="card center" style="padding-top:56px;gap:26px"><span class="lbl">11 · social + email</span>
   <div style="width:140px;height:140px;border-radius:50%;background:{T};display:flex;align-items:center;justify-content:center;flex:none">{sym(I, False, 110)}</div>
   <div style="width:230px;background:#fff;border-radius:14px;box-shadow:0 0 0 1px #ebe7df;padding:16px;font-size:12px">
    <div style="display:flex;gap:10px;align-items:center">{sym(T, True, 30)}<div><b>invin</b><div style="color:{St}">Invoice INV-0123 from Ada</div></div></div>
    <div class="mono" style="font-size:22px;margin-top:12px">$880.00</div><div class="btn" style="padding:9px;font-size:12px;margin-top:10px">View invoice</div></div></div>
 </div>
 <div><h3>12 · don'ts</h3><div class="dont">
  <div><div class="d">{lock(T, I, 26, 'transform:scale(1.5,.75)')}</div><div class="x">Don't stretch or squash</div></div>
  <div><div class="d" style="background:#3F7FD9">{lock(T, Pp, 26)}</div><div class="x">Don't place on clashing colours</div></div>
  <div><div class="d">{lock('#7C5CFF', '#7C5CFF', 26)}</div><div class="x">Don't recolour outside the palette</div></div>
  <div><div class="d">{lock(T, I, 26, 'filter:drop-shadow(4px 6px 4px rgba(0,0,0,.45))')}</div><div class="x">No shadows, glows or gradients</div></div>
  <div><div class="d"><span style="font:600 34px Inter;letter-spacing:-.02em;display:flex;gap:10px;align-items:center">{sym(T, False, 40)}InVin</span></div><div class="x">Don't retype the wordmark in a font</div></div>
 </div></div>
</div></body></html>'''
open('board.html', 'w', encoding='utf-8').write(html)
print('ok')
