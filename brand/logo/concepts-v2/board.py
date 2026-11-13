import json
P=json.load(open('parts.json'))
C={
 'a':dict(name='Slot',idea='Every invoice is a slot money drops into. The symbol is a tile with a coin slot: simple, a little playful, and ownable as an app icon.',
          bg='#FF5A1F',ink='#111111',tile='#111111',coin='#111111',paid='#111111',iconbg='#111111',iconfg='#FF5A1F',ui='#FF5A1F'),
 'b':dict(name='Landing',idea='A coin settles into the corner of a page: the moment an invoice gets paid. Bauhaus-simple geometry that stays clear at 16 px.',
          bg='#0E3B2E',ink='#F2EEE4',tile='#F2EEE4',coin='#CDEB5B',paid='#F2EEE4',iconbg='#0E3B2E',iconfg='#F2EEE4',ui='#0E3B2E'),
 'c':dict(name='Settled',idea='The two i-dots tell the story: an open ring (sent, unpaid) becomes a solid green dot (paid). The symbol is that pair, so the status system is the brand.',
          bg='#F2EEE4',ink='#111111',tile='#111111',coin='#111111',paid='#1F9D55',iconbg='#111111',iconfg='#F2EEE4',ui='#111111'),
}
def svg(k,part,vb,cls=''):
    return f'<svg class="{cls}" viewBox="{vb}" xmlns="http://www.w3.org/2000/svg">{P[k][part]}</svg>'
rows=[]
for idx,(k,c) in enumerate(C.items()):
    st=f"--bg:{c['bg']};--ink:{c['ink']};--tile:{c['tile']};--coin:{c['coin']};--paid:{c['paid']};--ibg:{c['iconbg']};--ifg:{c['iconfg']};--ui:{c['ui']}"
    rows.append(f'''
<section class="row" style="{st}">
  <div class="meta"><span class="k">{chr(65+idx)}</span><h2>{c['name']}</h2><p>{c['idea']}</p></div>
  <div class="hero"><div class="lock">{svg(k,'sym','0 0 256 256','sym')}{svg(k,'word','-4 30 400 180','word')}</div></div>
  <div class="col">
    <div class="icon"><div class="app">{svg(k,'sym','0 0 256 256','sym')}</div><div class="sizes">
      <div class="fav f32">{svg(k,'sym','0 0 256 256','sym')}</div><div class="fav f16">{svg(k,'sym','0 0 256 256','sym')}</div>
      <span>32 · 16 px</span></div></div>
    <div class="mock">
      <div class="tab"><div class="fav f16">{svg(k,'sym','0 0 256 256','sym')}</div>INV-0124 · invin</div>
      <div class="inv"><div class="ih"><div class="mini">{svg(k,'sym','0 0 256 256','sym')}{svg(k,'word','-4 30 400 180','word')}</div><span class="pill">Paid</span></div>
      <div class="ln"></div><div class="ln s"></div><div class="tot"><span>Total</span><b>$2,450.00</b></div></div>
    </div>
  </div>
</section>''')
html=f'''<!doctype html><html><head><meta charset="utf-8"><style>
*{{box-sizing:border-box;margin:0}}
body{{font-family:Inter,Segoe UI,system-ui,sans-serif;background:#ECEAE4;padding:56px;width:1600px;color:#111}}
h1{{font-size:34px;letter-spacing:-.02em}} .sub{{color:#666;margin:8px 0 36px;font-size:17px}}
.row{{display:grid;grid-template-columns:300px 1fr 420px;gap:20px;margin-bottom:28px;align-items:stretch}}
.meta{{padding:8px 4px}} .k{{display:inline-grid;place-items:center;width:30px;height:30px;border-radius:99px;background:#111;color:#fff;font-weight:600;font-size:14px}}
.meta h2{{font-size:26px;margin:14px 0 10px;letter-spacing:-.01em}} .meta p{{color:#444;line-height:1.5;font-size:16px}}
.hero{{background:var(--bg);border-radius:22px;min-height:340px;display:grid;place-items:center}}
.lock{{display:flex;align-items:center;gap:22px}} .lock .sym{{width:96px;height:96px}} .lock .word{{height:96px;width:auto}}
svg{{fill:var(--ink);display:block}} .sym{{fill:var(--tile)}} .sym .coin{{fill:var(--coin)}} .paid{{fill:var(--paid)}}
.col{{display:grid;grid-template-rows:auto 1fr;gap:20px}}
.icon{{background:#fff;border-radius:22px;padding:22px;display:flex;gap:24px;align-items:center}}
.app{{width:112px;height:112px;border-radius:26px;background:var(--ibg);display:grid;place-items:center;box-shadow:0 1px 2px rgba(0,0,0,.08),0 8px 24px rgba(0,0,0,.08)}}
.app .sym{{width:72px;height:72px;fill:var(--ifg)}} .app .sym .coin{{fill:var(--coin)}} .app .paid{{fill:{'var(--paid)'}}}
.sizes{{display:flex;align-items:center;gap:14px;color:#888;font-size:13px}}
.fav{{background:var(--ibg);display:grid;place-items:center}} .fav .sym{{fill:var(--ifg)}} .fav .sym .coin{{fill:var(--coin)}}
.f32{{width:32px;height:32px;border-radius:7px}} .f32 svg{{width:26px;height:26px}}
.f16{{width:16px;height:16px;border-radius:4px}} .f16 svg{{width:14px;height:14px}}
.mock{{background:#fff;border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:12px}}
.tab{{display:flex;align-items:center;gap:8px;font-size:13px;color:#333;background:#F1F1EF;border-radius:10px;padding:8px 10px;width:max-content}}
.inv{{border:1px solid #eee;border-radius:14px;padding:16px;flex:1}}
.ih{{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}}
.mini{{display:flex;align-items:center;gap:8px;--ink:#111;--tile:var(--ui)}} .mini .sym{{width:22px;height:22px}} .mini .word{{height:22px;width:auto;fill:#111}}
.pill{{font-size:12px;font-weight:600;color:#147a42;background:#E3F5EA;padding:4px 10px;border-radius:99px}}
.ln{{height:8px;background:#F0F0EE;border-radius:4px;margin:8px 0;width:100%}} .ln.s{{width:62%}}
.tot{{display:flex;justify-content:space-between;margin-top:14px;font-size:14px;color:#666}} .tot b{{color:#111;font-variant-numeric:tabular-nums}}
</style></head><body><h1>InVin logo concepts · round 2</h1><p class="sub">Custom lowercase wordmark + small symbol, shown in colour and in context. Pick one, or mix (e.g. B's symbol with C's dots).</p>
{''.join(rows)}</body></html>'''
open('board.html','w',encoding='utf-8').write(html)
