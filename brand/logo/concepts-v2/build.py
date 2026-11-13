import math
T=math.tan(math.radians(15))
def f(v): return f"{v:.2f}".rstrip('0').rstrip('.')
st=22; XT=84; BL=200
def i(x, dot='fill'):
    s=f'<rect x="{x}" y="{XT}" width="{st}" height="{BL-XT}"/>'
    cx=x+st/2
    if dot=='fill': s+=f'<circle cx="{f(cx)}" cy="56" r="13"/>'
    elif dot=='ring': s+=f'<path fill-rule="evenodd" d="M{f(cx-15)} 54a15 15 0 1 0 30 0a15 15 0 1 0-30 0ZM{f(cx-8)} 54a8 8 0 1 0 16 0a8 8 0 1 0-16 0Z"/>'
    elif dot=='big': s+=f'<circle cx="{f(cx)}" cy="54" r="15"/>'
    return s
def n(x):
    return (f'<rect x="{x}" y="{XT}" width="{st}" height="{BL-XT}"/>'
            f'<path d="M{x} {BL}V132A48 48 0 0 1 {x+96} 132V{BL}H{x+74}V132A26 26 0 0 0 {x+st} 132V{BL}Z"/>')
def v(x, W=92, t=23):
    d=(BL-XT)*T; ya=XT+(W-2*t)/(2*T)
    p=[(x,XT),(x+t,XT),(x+W/2,ya),(x+W-t,XT),(x+W,XT),(x+W-d,BL),(x+d,BL)]
    return '<path d="M'+' L'.join(f'{f(a)} {f(b)}' for a,b in p)+'Z"/>'
def word(d1='fill', d2='fill'):
    return i(0,d1)+n(40)+v(148)+i(252,d2)+n(292)
WW=388  # wordmark width, ink spans y 41..200
# --- symbols (256 canvas) ---
sym={}
sym['a']='<path fill-rule="evenodd" d="M96 48H160A48 48 0 0 1 208 96V160A48 48 0 0 1 160 208H96A48 48 0 0 1 48 160V96A48 48 0 0 1 96 48ZM98 92H158A10 10 0 0 1 158 112H98A10 10 0 0 1 98 92Z"/>'
# B: tile with concave corner; coin resting in it
o=-18
def P(x,y): return f'{f(x+o)} {f(y+o)}'
R=100; C=(216,216)
tile=f'<path d="M{P(80,40)}H{P(176,40)[:0]}{f(176+o)}A40 40 0 0 1 {P(216,80)}V{f(116+o)}A{R} {R} 0 0 0 {P(116,216)}H{f(80+o)}A40 40 0 0 1 {P(40,176)}V{f(80+o)}A40 40 0 0 1 {P(80,40)}Z"/>'
coin=f'<circle cx="{f(206+o)}" cy="{f(206+o)}" r="58"/>'
sym['b']=tile+coin
# C: open ring -> settled dot (status, in the i-dots)
sym['c']='<path fill-rule="evenodd" d="M36 128a46 46 0 1 0 92 0a46 46 0 1 0-92 0ZM62 128a20 20 0 1 0 40 0a20 20 0 1 0-40 0Z"/><circle cx="174" cy="128" r="46"/>'
dots={'a':('fill','fill'),'b':('fill','fill'),'c':('ring','big')}
for k,s in sym.items():
    open(f'{k}-symbol.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>invin</title><g fill="#111">{s}</g></svg>\n')
    d1,d2=dots[k]
    open(f'{k}-wordmark.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 0 {WW+40} 240"><title>invin</title><g fill="#111">{word(d1,d2)}</g></svg>\n')
    # lockup: symbol at x-height-ish scale, then wordmark
    open(f'{k}-lockup.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 256"><title>invin</title><g fill="#111"><g transform="translate(8,40) scale(0.66)">{s}</g><g transform="translate(212,8)">{word(d1,d2)}</g></g></svg>\n')
