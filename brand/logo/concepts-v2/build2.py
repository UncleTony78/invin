import math
T=math.tan(math.radians(15)); c15=math.cos(math.radians(15))
def f(v): return f"{v:.2f}".rstrip('0').rstrip('.')
st=22; h=st/2; XT=84; BL=200; RB=BL+2-h   # round-bottom centre (2px overshoot)
def stem(x, round_top=False, y0=None):
    y0 = XT if y0 is None else y0
    top = f'M{x} {XT+h}A{h} {h} 0 0 1 {x+st} {XT+h}' if round_top else f'M{x} {y0}H{x+st}'
    return f'<path d="{top}V{f(RB)}A{h} {h} 0 0 1 {x} {f(RB)}Z"/>'
def dot(cx, kind):
    if kind=='ring': return f'<path fill-rule="evenodd" d="M{f(cx-15)} 52a15 15 0 1 0 30 0a15 15 0 1 0-30 0ZM{f(cx-7.5)} 52a7.5 7.5 0 1 0 15 0a7.5 7.5 0 1 0-15 0Z"/>'
    if kind=='big': return f'<circle class="paid" cx="{f(cx)}" cy="52" r="15"/>'
    return f'<circle cx="{f(cx)}" cy="54" r="13"/>'
def i(x, kind='fill'): return stem(x, True)+dot(x+h, kind)
def n(x):
    return (stem(x)+stem(x+74,y0=132)+
      f'<path d="M{x} 140V132A48 48 0 0 1 {x+96} 132V140H{x+74}V132A26 26 0 0 0 {x+st} 132V140Z"/>')
def v(x, W=92, t=23):
    cx=x+W/2; ya=XT+(W-2*t)/(2*T)
    r=(W/2-T*(BL+2-XT))/(c15/ c15*1/ c15 - T) if False else None
    # tangent circle to both outer edges with bottom at BL+2
    r=(W/2 - T*(BL+2-XT))/(1/c15 - T); cy=BL+2-r
    ty=cy+r*math.sin(math.radians(15)); tx=r*c15
    pts=[(x,XT),(x+t,XT),(cx,ya),(x+W-t,XT),(x+W,XT),(cx+tx,ty)]
    d='M'+' L'.join(f'{f(a)} {f(b)}' for a,b in pts)+f'A{f(r)} {f(r)} 0 0 1 {f(cx-tx)} {f(ty)}Z'
    return f'<path d="{d}"/>'
def word(d1='fill', d2='fill'): return i(0,d1)+n(40)+v(148)+i(252,d2)+n(292)
WW=388
sym={
 'a':'<path fill-rule="evenodd" d="M96 48H160A48 48 0 0 1 208 96V160A48 48 0 0 1 160 208H96A48 48 0 0 1 48 160V96A48 48 0 0 1 96 48ZM98 90H158A11 11 0 0 1 158 112H98A11 11 0 0 1 98 90Z"/>',
 'b':'<path class="tile" d="M70 22H158A40 40 0 0 1 198 62V98A100 100 0 0 0 98 198H70A40 40 0 0 1 30 158V62A40 40 0 0 1 70 22Z"/><circle class="coin" cx="188" cy="188" r="58"/>',
 'c':'<path fill-rule="evenodd" d="M30 128a48 48 0 1 0 96 0a48 48 0 1 0-96 0ZM55 128a23 23 0 1 0 46 0a23 23 0 1 0-46 0Z"/><circle class="paid" cx="178" cy="128" r="48"/>',
}
dots={'a':('fill','fill'),'b':('fill','fill'),'c':('ring','big')}
import json
out={}
for k,s in sym.items():
    d1,d2=dots[k]; w=word(d1,d2)
    out[k]={'sym':s,'word':w}
    open(f'{k}-symbol.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><title>invin</title><g fill="#111">{s}</g></svg>\n')
    open(f'{k}-wordmark.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="-20 0 {WW+40} 240"><title>invin</title><g fill="#111">{w}</g></svg>\n')
    # lockup: symbol spans ~ the x-height+dot zone, baseline aligned
    open(f'{k}-lockup.svg','w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 660 256"><title>invin</title><g fill="#111"><g transform="translate(10,36) scale(0.70)">{s}</g><g transform="translate(232,8)">{w}</g></g></svg>\n')
json.dump(out,open('parts.json','w'))
