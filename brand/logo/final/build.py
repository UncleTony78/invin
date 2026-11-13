import math, json, os
T=math.tan(math.radians(15)); c15=math.cos(math.radians(15))
def f(v): return f"{v:.2f}".rstrip('0').rstrip('.')
st=22; h=st/2; XT=84; BL=200; RB=BL+2-h
def stem(x, round_top=False, y0=None):
    y0 = XT if y0 is None else y0
    top = f'M{x} {XT+h}A{h} {h} 0 0 1 {x+st} {XT+h}' if round_top else f'M{x} {y0}H{x+st}'
    return f'M{f(x) if False else x} {0}'[:0] + f'{top}V{f(RB)}A{h} {h} 0 0 1 {x} {f(RB)}Z'
def dot(cx): return f'M{f(cx-13)} 54a13 13 0 1 0 26 0a13 13 0 1 0-26 0Z'
def i(x): return stem(x, True)+dot(x+h)
def n(x):
    return (stem(x)+stem(x+74,y0=132)+
      f'M{x} 140V132A48 48 0 0 1 {x+96} 132V140H{x+74}V132A26 26 0 0 0 {x+st} 132V140Z')
def v(x, W=92, t=23):
    cx=x+W/2; ya=XT+(W-2*t)/(2*T)
    r=(W/2 - T*(BL+2-XT))/(1/c15 - T); cy=BL+2-r
    ty=cy+r*math.sin(math.radians(15)); tx=r*c15
    pts=[(x,XT),(x+t,XT),(cx,ya),(x+W-t,XT),(x+W,XT),(cx+tx,ty)]
    return 'M'+' L'.join(f'{f(a)} {f(b)}' for a,b in pts)+f'A{f(r)} {f(r)} 0 0 1 {f(cx-tx)} {f(ty)}Z'
WORD=i(0)+n(40)+v(148)+i(252)+n(292)     # x 0..388, y 41..202
WW=388

def tile(x0,y0,s,r,slot_w,slot_h,slot_cy):
    x1,y1=x0+s,y0+s
    t=(f'M{f(x0+r)} {f(y0)}H{f(x1-r)}A{f(r)} {f(r)} 0 0 1 {f(x1)} {f(y0+r)}V{f(y1-r)}A{f(r)} {f(r)} 0 0 1 {f(x1-r)} {f(y1)}'
       f'H{f(x0+r)}A{f(r)} {f(r)} 0 0 1 {f(x0)} {f(y1-r)}V{f(y0+r)}A{f(r)} {f(r)} 0 0 1 {f(x0+r)} {f(y0)}Z')
    cx=x0+s/2; sr=slot_h/2; sx0=cx-slot_w/2+sr; sx1=cx+slot_w/2-sr; sy0=slot_cy-sr; sy1=slot_cy+sr
    sl=f'M{f(sx0)} {f(sy0)}H{f(sx1)}A{f(sr)} {f(sr)} 0 0 1 {f(sx1)} {f(sy1)}H{f(sx0)}A{f(sr)} {f(sr)} 0 0 1 {f(sx0)} {f(sy0)}Z'
    return t+sl
# Master symbol: 160 tile on 256 canvas; slot 64x26 (matches wordmark stroke at lockup scale), in the upper third
SYM=tile(48,48,160,46,64,26,101)
# Small-size cut (<=32px): bigger slot, slightly tighter radius so the tile reads as a tile, not a blob
SYM_SMALL=tile(40,40,176,44,84,36,104)

C=dict(tangerine='#FF5A1F', ink='#16130F', paper='#F4F1EA', stone='#6B665E', white='#FFFFFF', paid='#127A43')
def svg(vb,body,title='InVin logo'): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}"><title>{title}</title>{body}</svg>\n'
def p(d,fill):
    if d.count('Z')==2:  # symbol: tile + real slot hole
        return f'<path fill="{fill}" fill-rule="evenodd" d="{d}"/>'
    parts=[x+'Z' for x in d.split('Z') if x.strip()]
    return f'<g fill="{fill}">'+''.join(f'<path d="{x}"/>' for x in parts)+'</g>'

# Lockup geometry. Symbol scale so the slot equals the stroke (26*s=22).
S=22/26                      # 0.846
tile_px=160*S                 # 135.4
GAP=round(tile_px*0.30)       # clear gap ≈ 0.3 tile
def horiz(sym_fill, word_fill, pad=0):
    # tile bottom on baseline (202 incl. overshoot -> 200 flat), word starts after gap
    tx=-48*S; ty=200-208*S
    wx=tile_px+GAP
    W=wx+WW; H=202
    body=(f'<g transform="translate({f(tx)} {f(ty)}) scale({f(S)})">{p(SYM,sym_fill)}</g>'
          f'<g transform="translate({f(wx)} 0)">{p(WORD,word_fill)}</g>')
    return svg(f'-24 17 {f(W+48)} 209', body), (W,H)
def stacked(sym_fill, word_fill):
    s=0.8; tw=160*s
    sx=(WW-tw)/2
    body=(f'<g transform="translate({f(sx-48*s)} {f(-48*s)}) scale({f(s)})">{p(SYM,sym_fill)}</g>'
          f'<g transform="translate(0 {f(tw+20)})">{p(WORD,word_fill)}</g>')
    return svg(f'-24 -24 {WW+48} {f(tw+20+202+48)}', body)

out={}
def w(name,s): open(name,'w').write(s)
w('symbol.svg', svg('0 0 256 256', p(SYM,C['tangerine'])))
w('symbol-ink.svg', svg('0 0 256 256', p(SYM,C['ink'])))
w('symbol-small.svg', svg('0 0 256 256', p(SYM_SMALL,C['tangerine'])))
w('wordmark.svg', svg(f'-20 17 {WW+40} 209', p(WORD,C['ink'])))
w('wordmark-white.svg', svg(f'-20 17 {WW+40} 209', p(WORD,C['white'])))
variants={'primary':(C['tangerine'],C['ink']),'reversed':(C['tangerine'],C['paper']),
          'ink':(C['ink'],C['ink']),'white':(C['white'],C['white'])}
for k,(a,b) in variants.items():
    w(f'lockup-horizontal-{k}.svg', horiz(a,b)[0])
    w(f'lockup-stacked-{k}.svg', stacked(a,b))
json.dump({'SYM':SYM,'SYM_SMALL':SYM_SMALL,'WORD':WORD,'S':S,'GAP':GAP,'C':C},open('parts.json','w'))
print('gap',GAP,'scale',S)
