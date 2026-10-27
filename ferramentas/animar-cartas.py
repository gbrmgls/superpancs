#!/usr/bin/env python3
"""Desenha os personagens das cartas em SVG (à mão, como o Pimentão) e gera um GIF de cada um
praticando o seu esporte.

Uso:
    python3 ferramentas/animar-cartas.py          # todas as cartas
    python3 ferramentas/animar-cartas.py 9 37     # só as cartas (arquivos) 9 e 37

Saída em img/animacoes/: <arquivo>-<nome>.svg (personagem parado) e <arquivo>-<nome>.gif.
Requer: ImageMagick (com librsvg).
O Pimentão (carta 19) tem script próprio: ferramentas/animar-boxe.py.

Como funciona:
  - Cada personagem é um boneco articulado: o corpo (a planta, desenhada com formas simples)
    fica preso no quadril, e braços e pernas são membros de dois segmentos
    (ombro → cotovelo → mão, quadril → joelho → pé).
  - Os ângulos dos membros são "de tela": 0 = para baixo, 90 = direita, -90 = esquerda,
    180 = para cima. Cada esporte define poses-chave no tempo e o script interpola entre elas
    (sempre pelo menor giro).
  - Coordenadas do corpo: quadril em (0, 0), o corpo sobe para y negativo.
"""
import math
import os
import shutil
import subprocess
import sys
import tempfile
from concurrent.futures import ThreadPoolExecutor

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'img', 'animacoes')

L, A = 640, 600          # tamanho do quadro
CHAO = 560               # linha do chão
BASE = (320, 432)        # quadril do personagem em pé
N_QUADROS = 60
ATRASO = 5               # centésimos de segundo por quadro (60 quadros = 3 s)
LARGURA_GIF = 480
TAU = 2 * math.pi

CONTORNO = '#1A1A1A'
BRANCO = '#FFFFFF'


# ---------- desenho básico ----------

def pt(p):
    return f'{p[0]:.1f},{p[1]:.1f}'


def curva(pts, fechada=True):
    """Caminho suave (Catmull-Rom) passando pelos pontos."""
    n = len(pts)
    if n < 3:
        return 'M' + ' L'.join(pt(p) for p in pts)
    d = [f'M{pt(pts[0])}']
    for i in range(n if fechada else n - 1):
        p0 = pts[(i - 1) % n] if (fechada or i > 0) else pts[0]
        p1, p2 = pts[i], pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if (fechada or i + 2 < n) else p2
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d.append(f'C{pt(c1)} {pt(c2)} {pt(p2)}')
    return ' '.join(d) + (' Z' if fechada else '')


def forma(pts, cor, sw=2.5, extra=''):
    return (f'<path d="{curva(pts)}" fill="{cor}" stroke="{CONTORNO}" stroke-width="{sw}" '
            f'stroke-linejoin="round" {extra}/>')


def poligono(pts, cor, sw=2.5):
    return (f'<path d="M{" L".join(pt(p) for p in pts)} Z" fill="{cor}" stroke="{CONTORNO}" '
            f'stroke-width="{sw}" stroke-linejoin="round"/>')


def linha(pts, cor=CONTORNO, sw=2.0, suave=True, opacidade=1.0):
    d = curva(pts, fechada=False) if suave else 'M' + ' L'.join(pt(p) for p in pts)
    return (f'<path d="{d}" fill="none" stroke="{cor}" stroke-width="{sw}" stroke-linecap="round" '
            f'stroke-linejoin="round" opacity="{opacidade}"/>')


def elipse(cx, cy, rx, ry, cor, sw=2.5, rot=0):
    return (f'<ellipse cx="{cx:.1f}" cy="{cy:.1f}" rx="{rx:.1f}" ry="{ry:.1f}" fill="{cor}" stroke="{CONTORNO}" '
            f'stroke-width="{sw}" transform="rotate({rot:.1f} {cx:.1f} {cy:.1f})"/>')


def circulo(cx, cy, r, cor, sw=2.5):
    return f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r:.1f}" fill="{cor}" stroke="{CONTORNO}" stroke-width="{sw}"/>'


def blob_ondulado(cx, cy, rx, ry, n, amp, cor, sw=2.5):
    """Forma arredondada com a borda em ondas (alface, repolho, couve)."""
    pts = []
    for i in range(2 * n):
        a = math.pi * i / n
        k = amp if i % 2 == 0 else -amp
        pts.append((cx + (rx + k) * math.cos(a), cy + (ry + k) * math.sin(a)))
    return forma(pts, cor, sw)


def folha(x, y, ang, comp, larg, cor, dentes=0, prof=0.3, nervura=None, larg_nervura=2.0, pelos=False, sw=2.2):
    """Folha com a base em (x, y), apontando para ang (graus, 0 = para cima, sentido horário)."""
    n = max(10, dentes * 2)
    lados = []
    for i in range(n + 1):
        u = i / n
        w = larg / 2 * math.sin(math.pi * u) ** 0.75
        if dentes and i % 2 == 1:
            w *= 1 - prof
        lados.append((w, -comp * u))
    pts = [(-w, yy) for w, yy in lados] + [(w, yy) for w, yy in reversed(lados[1:-1])]
    d = ('M' + ' L'.join(pt(p) for p in pts) + ' Z') if dentes else curva(pts)
    s = [f'<g transform="translate({x:.1f},{y:.1f}) rotate({ang:.1f})">']
    if pelos:
        s.append(f'<path d="{d}" fill="none" stroke="#DCE6D6" stroke-width="10" stroke-dasharray="1.5 4"/>')
    s.append(f'<path d="{d}" fill="{cor}" stroke="{CONTORNO}" stroke-width="{sw}" stroke-linejoin="round"/>')
    if nervura:
        s.append(f'<path d="M0,{-comp * 0.04:.1f} Q{larg * 0.04:.1f},{-comp * 0.5:.1f} 0,{-comp * 0.88:.1f}" fill="none" '
                 f'stroke="{nervura}" stroke-width="{larg_nervura}" stroke-linecap="round"/>')
        for k in (0.3, 0.5, 0.68):
            for sgn in (-1, 1):
                s.append(f'<line x1="0" y1="{-comp * k:.1f}" x2="{sgn * larg * 0.26:.1f}" y2="{-comp * (k + 0.11):.1f}" '
                         f'stroke="{nervura}" stroke-width="1.5" stroke-linecap="round"/>')
    s.append('</g>')
    return ''.join(s)


def petalas(cx, cy, n, r, comp, larg, cor, rot0=0, sw=2.0):
    return ''.join(
        f'<ellipse cx="0" cy="{-(r + comp / 2):.1f}" rx="{larg / 2:.1f}" ry="{comp / 2:.1f}" fill="{cor}" '
        f'stroke="{CONTORNO}" stroke-width="{sw}" transform="translate({cx:.1f},{cy:.1f}) rotate({rot0 + 360 * i / n:.1f})"/>'
        for i in range(n))


def coracao(cx, cy, tam, cor, rot=0, nervura=None):
    """Folha em forma de coração com a ponta para baixo."""
    k = tam / 100
    pts = [(0, -30), (-25, -50), (-50, -42), (-56, -8), (-36, 28), (0, 60), (36, 28), (56, -8), (50, -42), (25, -50)]
    s = f'<g transform="translate({cx:.1f},{cy:.1f}) rotate({rot:.1f}) scale({k:.3f})">{forma(pts, cor, 2.5 / k)}'
    if nervura:
        s += linha([(0, -28), (2, 10), (0, 52)], nervura, 2 / k)
        s += linha([(0, -5), (-30, -20)], nervura, 1.5 / k) + linha([(0, -5), (30, -20)], nervura, 1.5 / k)
        s += linha([(0, 18), (-26, 10)], nervura, 1.5 / k) + linha([(0, 18), (26, 10)], nervura, 1.5 / k)
    return s + '</g>'


def folha_redonda(cx, cy, r, cor, nervura='#2E7A2E'):
    """Folha redonda de capuchinha: nervuras saindo do centro."""
    s = circulo(cx, cy, r, cor)
    for i in range(7):
        a = TAU * i / 7 + 0.3
        s += linha([(cx, cy), (cx + r * 0.85 * math.cos(a), cy + r * 0.85 * math.sin(a))], nervura, 1.5)
    return s + f'<circle cx="{cx:.1f}" cy="{cy:.1f}" r="{r * 0.12:.1f}" fill="#F4F4E8"/>'


def camiseta(cor, topo=-150, ombro=60, cint=48, base=-4, gola=True):
    pts = [(-cint, base), (-ombro - 4, topo + 40), (-ombro + 8, topo + 4), (0, topo - 3),
           (ombro - 8, topo + 4), (ombro + 4, topo + 40), (cint, base), (0, base + 4)]
    s = forma(pts, cor)
    if gola:
        s += linha([(-18, topo + 1), (0, topo + 14), (18, topo + 1)], CONTORNO, 2)
    return s


def faixa_kimono(y, meia, cor):
    return (f'<rect x="{-meia}" y="{y - 9}" width="{2 * meia}" height="18" rx="4" fill="{cor}" stroke="{CONTORNO}" stroke-width="2"/>'
            + poligono([(-4, y + 6), (-16, y + 44), (-4, y + 44), (4, y + 8)], cor, 2)
            + poligono([(4, y + 6), (18, y + 40), (8, y + 42), (-2, y + 8)], cor, 2)
            + f'<rect x="-9" y="{y - 11}" width="18" height="22" rx="5" fill="{cor}" stroke="{CONTORNO}" stroke-width="2"/>')


def kimono(cor, faixa, topo=-150, ombro=60, cint=48, lapela=None):
    lapela = lapela or cor
    s = camiseta(cor, topo, ombro, cint, gola=False)
    s += poligono([(-30, topo + 2), (-16, topo + 2), (8, -46), (-6, -46)], lapela, 2)
    s += poligono([(30, topo + 2), (16, topo + 2), (-8, -46), (6, -46)], lapela, 2)
    return s + faixa_kimono(-38, cint + 4, faixa)


# ---------- rosto ----------

def rosto(x, y, e, s=1.0, sobr='normal', boca='sorriso', oculos=None, labios=False, bigode=False,
          barba=None, fechados=False, dist=16, nariz=True):
    boca = e.get('boca') or boca
    fechados = fechados or e.get('olhos') == 'fechados'
    ab = max(0.1, 1 - e.get('piscada', 0))
    o = [f'<g transform="translate({x:.1f},{y:.1f}) scale({s:.2f})">']
    if barba:
        o.append(forma([(-36, -4), (-32, 28), (-16, 46), (0, 50), (16, 46), (32, 28), (36, -4), (20, 12), (0, 16), (-20, 12)], barba, 2))
    for lado in (-1, 1):
        cx = lado * dist
        if fechados:
            o.append(f'<path d="M{cx - 8},0 Q{cx},7 {cx + 8},0" fill="none" stroke="{CONTORNO}" stroke-width="2.6" stroke-linecap="round"/>')
        else:
            o.append(f'<g transform="translate({cx},0) scale(1,{ab:.2f})">'
                     f'<ellipse rx="8" ry="10" fill="#fff" stroke="{CONTORNO}" stroke-width="2"/>'
                     f'<ellipse cx="0" cy="1.5" rx="4.2" ry="5.8" fill="{CONTORNO}"/>'
                     f'<circle cx="1.5" cy="-1" r="1.5" fill="#fff"/></g>')
        if sobr == 'brava':
            o.append(f'<path d="M{cx + lado * 10},-20 L{cx - lado * 7},-12" stroke="{CONTORNO}" stroke-width="3.6" stroke-linecap="round"/>')
        elif sobr == 'normal':
            o.append(f'<path d="M{cx - 8},-16 Q{cx},-21 {cx + 8},-16" fill="none" stroke="{CONTORNO}" stroke-width="2.5" stroke-linecap="round"/>')
        elif sobr == 'alegre':
            o.append(f'<path d="M{cx - 8},-18 Q{cx},-26 {cx + 8},-18" fill="none" stroke="{CONTORNO}" stroke-width="2.5" stroke-linecap="round"/>')
    if oculos:
        for lado in (-1, 1):
            cx = lado * dist
            o.append(f'<rect x="{cx - 12}" y="-12" width="24" height="23" rx="9" fill="#BFE6FF" fill-opacity="0.35" '
                     f'stroke="{oculos}" stroke-width="4.5"/>')
            o.append(f'<path d="M{lado * (dist + 12)},-1 L{lado * (dist + 34)},-5" stroke="{oculos}" stroke-width="4" stroke-linecap="round"/>')
        o.append(f'<path d="M{-dist + 12},-2 Q0,-6 {dist - 12},-2" fill="none" stroke="{oculos}" stroke-width="3.5"/>')
    if nariz:
        o.append(f'<path d="M-3,10 Q0,14 3,10" fill="none" stroke="{CONTORNO}" stroke-width="2" stroke-linecap="round"/>')
    if bigode:
        o.append(f'<path d="M-26,24 Q-14,8 0,18 Q14,8 26,24 Q14,17 0,23 Q-14,17 -26,24 Z" fill="{CONTORNO}"/>')
    if labios and boca in ('sorriso', 'reta'):
        o.append(f'<path d="M-12,26 Q-6,20 0,23 Q6,20 12,26 Q6,34 0,33 Q-6,34 -12,26 Z" fill="#C8323C" stroke="{CONTORNO}" stroke-width="1.5"/>')
        o.append(f'<path d="M-11,26.5 Q0,29 11,26.5" fill="none" stroke="#7A1A20" stroke-width="1.2"/>')
    elif boca == 'sorriso':
        o.append(f'<path d="M-11,24 Q0,34 11,24" fill="none" stroke="{CONTORNO}" stroke-width="2.6" stroke-linecap="round"/>')
    elif boca == 'aberta':
        o.append(f'<path d="M-12,23 Q0,44 12,23 Z" fill="#6B1E1E" stroke="{CONTORNO}" stroke-width="2"/>')
        o.append('<ellipse cx="0" cy="34" rx="5.5" ry="3.5" fill="#E26A6A"/>')
    elif boca == 'dentes':
        o.append(f'<path d="M-14,23 L14,23 Q0,40 -14,23 Z" fill="#fff" stroke="{CONTORNO}" stroke-width="2"/>')
        o.append(f'<path d="M-12,28 L12,28" stroke="{CONTORNO}" stroke-width="1.2"/>')
    elif boca == 'reta':
        o.append(f'<path d="M-9,28 L9,28" stroke="{CONTORNO}" stroke-width="2.6" stroke-linecap="round"/>')
    elif boca == 'o':
        o.append(f'<ellipse cx="0" cy="29" rx="5" ry="7" fill="#6B1E1E" stroke="{CONTORNO}" stroke-width="2"/>')
    o.append('</g>')
    return ''.join(o)


# ---------- membros ----------

def ponto(o, ang, comp):
    a = math.radians(ang)
    return o[0] + comp * math.sin(a), o[1] + comp * math.cos(a)


def trecho(pts, f0, f1):
    """Pedaço da polilinha entre as frações f0 e f1 do comprimento."""
    segs = [(a, b, math.dist(a, b)) for a, b in zip(pts, pts[1:])]
    total = sum(s[2] for s in segs) or 1

    def em(f):
        alvo = f * total
        for i, (a, b, l) in enumerate(segs):
            if alvo <= l or i == len(segs) - 1:
                u = alvo / l if l else 0
                return a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u
            alvo -= l

    out, acum = [em(f0)], 0
    for a, b, l in segs[:-1]:
        acum += l
        if f0 * total < acum < f1 * total:
            out.append(b)
    out.append(em(f1))
    return out


def traco(pts, larg, cor, cap='round'):
    return (f'<path d="M{" L".join(pt(p) for p in pts)}" fill="none" stroke="{cor}" stroke-width="{larg:.1f}" '
            f'stroke-linecap="{cap}" stroke-linejoin="round"/>')


def tubo(pts, larg, cor):
    return traco(pts, larg + 5, CONTORNO) + traco(pts, larg, cor)


def mao(p, larg, pele):
    r = larg * 0.62
    return (f'<circle cx="{p[0]:.1f}" cy="{p[1]:.1f}" r="{r:.1f}" fill="{pele}" stroke="{CONTORNO}" stroke-width="2"/>')


def luva(p, ang, larg, cor):
    k = larg / 26
    return (f'<g transform="translate({p[0]:.1f},{p[1]:.1f}) rotate({90 - ang:.1f}) scale({k:.2f})">'
            f'<rect x="-10" y="-17" width="22" height="34" rx="3" fill="{cor}" stroke="{CONTORNO}" stroke-width="1.8"/>'
            f'<rect x="-5" y="-7" width="7" height="12" fill="none" stroke="{CONTORNO}" stroke-width="1.2"/>'
            f'<circle cx="30" cy="0" r="26" fill="{cor}" stroke="{CONTORNO}" stroke-width="2"/>'
            f'<ellipse cx="22" cy="14" rx="13" ry="9" fill="{cor}" stroke="{CONTORNO}" stroke-width="1.8"/>'
            f'<path d="M38,-14 Q46,-6 44,6" fill="none" stroke="#9a9a9a" stroke-width="1.5"/></g>')


def pe(p, ang, larg, sapato, pele, lado):
    k = larg / 26
    g = f'<g transform="translate({p[0]:.1f},{p[1]:.1f}) rotate({-ang:.1f}) scale({lado * k:.2f},{k:.2f})">'
    if sapato:
        return (g + f'<path d="M-14,-8 Q-16,14 -4,14 L30,14 Q40,13 38,4 Q34,-6 14,-8 Z" fill="{sapato}" stroke="{CONTORNO}" '
                f'stroke-width="2.2" stroke-linejoin="round"/>'
                f'<path d="M-12,10 L37,10" stroke="#F4F4F4" stroke-width="2.5"/></g>')
    return (g + f'<path d="M-12,-8 Q-14,12 -2,12 L28,12 Q36,11 34,3 Q28,-5 12,-8 Z" fill="{pele}" stroke="{CONTORNO}" '
            f'stroke-width="2" stroke-linejoin="round"/>'
            f'<path d="M26,4 L26,11 M20,4 L20,11" stroke="{CONTORNO}" stroke-width="1.2"/></g>')


def desenhar_membro(ch, nome, pts, ang2):
    braco = nome[0] == 'b'
    _, _, larg = ch['braco'] if braco else ch['perna']
    pele = ch['pele'] if braco else ch.get('pele_perna', ch['pele'])
    s = [tubo(pts, larg, pele)]
    roupa = ch.get('manga' if braco else 'calca')
    if roupa:
        cor, frac, extra = roupa
        s.append(tubo(trecho(pts, 0, frac), larg + extra, cor))
    if not braco and ch.get('meia') and ch.get('sapato'):
        s.append(tubo(trecho(pts, 0.78, 0.97), larg + 2, ch['meia']))
    if ch.get('faixas') and not (braco and ch.get('luvas')):
        s.append(tubo(trecho(pts, 0.84, 0.97), larg + 2, BRANCO))
    if braco:
        s.append(luva(pts[2], ang2, larg, ch['luvas']) if ch.get('luvas') else mao(pts[2], larg, pele))
    else:
        s.append(pe(pts[2], ang2, larg, ch.get('sapato'), pele, -1 if nome == 'pe' else 1))
    return ''.join(s)


# ---------- cinemática ----------

REPOUSO = dict(be=(-14, -8), bd=(14, 8), pe=(-5, -2), pd=(5, 2), x=0, y=0, rot=0, sx=1, sy=1)
POSE_BASE = dict(REPOUSO, frente=(), boca=None, olhos=None, piscada=0, grito=0,
                 pow_be=0, pow_bd=0, pow_pe=0, pow_pd=0, pow_je=0, pow_jd=0)
MEMBROS = ('be', 'bd', 'pe', 'pd')


def juntas(ch, pose):
    """{membro: (origem, cotovelo/joelho, mão/pé)} no referencial do corpo."""
    rot = pose['rot']
    out = {}
    for nome in MEMBROS:
        origem = ch['ombros' if nome[0] == 'b' else 'quadris'][0 if nome[1] == 'e' else 1]
        l1, l2, _ = ch['braco' if nome[0] == 'b' else 'perna']
        w1, w2 = pose[nome]
        meio = ponto(origem, w1 + rot, l1)
        out[nome] = (origem, meio, ponto(meio, w2 + rot, l2))
    return out


def no_mundo(pose, p):
    r = math.radians(pose['rot'])
    x, y = p[0] * pose['sx'], p[1] * pose['sy']
    return (BASE[0] + pose['x'] + x * math.cos(r) - y * math.sin(r),
            BASE[1] + pose['y'] + x * math.sin(r) + y * math.cos(r))


def ik(origem, alvo, l1, l2, dobra):
    """Ângulos (de tela) de um membro com a origem em `origem` e a ponta em `alvo`."""
    dx, dy = alvo[0] - origem[0], alvo[1] - origem[1]
    d = max(abs(l1 - l2) + 1, min(l1 + l2 - 0.5, math.hypot(dx, dy)))
    base = math.degrees(math.atan2(dx, dy))
    a = math.degrees(math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)))
    w1 = base + dobra * a
    meio = ponto(origem, w1, l1)
    return w1, math.degrees(math.atan2(alvo[0] - meio[0], alvo[1] - meio[1]))


def suave(u):
    return u * u * (3 - 2 * u)


def onda(t, inicio, fim):
    """0→1→0 suave entre inicio e fim."""
    if not inicio <= t <= fim:
        return 0.0
    return math.sin(math.pi * (t - inicio) / (fim - inicio))


def rampa(t, inicio, fim):
    if t <= inicio:
        return 0.0
    if t >= fim:
        return 1.0
    return suave((t - inicio) / (fim - inicio))


def lerp(a, b, u):
    return a + (b - a) * u


def lerp_p(a, b, u):
    return lerp(a[0], b[0], u), lerp(a[1], b[1], u)


def interpolar(chave, a, b, u):
    if chave in MEMBROS:
        return tuple(x + ((y - x + 180) % 360 - 180) * u for x, y in zip(a, b))
    if isinstance(a, (int, float)) and isinstance(b, (int, float)):
        return lerp(a, b, u)
    return a if u < 0.5 else b


def quadro_chave(t, chaves):
    """Pose no tempo t. chaves = [(tempo, campos)]; campos ausentes repetem a chave anterior."""
    completas, atual = [], dict(POSE_BASE)
    for tempo, campos in chaves:
        atual = {**atual, **campos}
        completas.append((tempo, atual))
    if completas[-1][0] < 1:
        completas.append((1.0, completas[0][1]))
    for (t0, a), (t1, b) in zip(completas, completas[1:]):
        if t0 <= t <= t1:
            u = suave((t - t0) / (t1 - t0)) if t1 > t0 else 1.0
            return {k: interpolar(k, a[k], b[k], u) for k in a}
    return dict(completas[-1][1])


TROCA = {'be': 'bd', 'bd': 'be', 'pe': 'pd', 'pd': 'pe', 'je': 'jd', 'jd': 'je'}


def espelhar(campos):
    m = {}
    for k, v in campos.items():
        if k in MEMBROS:
            m[TROCA[k]] = tuple(-a for a in v)
        elif k in ('x', 'rot'):
            m[k] = -v
        elif k == 'frente':
            m[k] = tuple(TROCA[x] for x in v)
        elif k.startswith('pow_'):
            m['pow_' + TROCA[k[4:]]] = v
        else:
            m[k] = v
    return m


def por_chaves(t, ch, chaves):
    if ch.get('lado', 1) < 0:
        chaves = [(tt, espelhar(c)) for tt, c in chaves]
    return quadro_chave(t, chaves)


# ---------- efeitos e objetos ----------

def estrela(x, y, escala, texto, cor='#FFD84A'):
    pts = ' '.join(f'{(50 if i % 2 == 0 else 29) * math.cos(math.pi * i / 8):.1f},'
                   f'{(50 if i % 2 == 0 else 29) * math.sin(math.pi * i / 8):.1f}' for i in range(16))
    return (f'<g transform="translate({x:.1f},{y:.1f}) scale({escala:.2f})">'
            f'<polygon points="{pts}" fill="{cor}" stroke="{CONTORNO}" stroke-width="2.5" stroke-linejoin="round"/>'
            f'<text x="0" y="6" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900" '
            f'font-size="{min(18, 88 / len(texto)):.1f}" fill="#C42415">{texto}</text></g>')


def tracos(x, y, dx, dy, forca, n=3, abertura=18):
    """Traços de velocidade atrás de (x, y), contrários ao movimento (dx, dy)."""
    if forca <= 0.02:
        return ''
    c = math.hypot(dx, dy) or 1
    ux, uy = dx / c, dy / c
    nx, ny = -uy, ux
    out = []
    for i in range(n):
        off = (i - (n - 1) / 2) * abertura
        comp = (50 if i % 2 == 0 else 72) * forca
        x0, y0 = x - ux * 34 + nx * off, y - uy * 34 + ny * off
        out.append(f'<line x1="{x0:.1f}" y1="{y0:.1f}" x2="{x0 - ux * comp:.1f}" y2="{y0 - uy * comp:.1f}" '
                   f'stroke="{CONTORNO}" stroke-width="3" stroke-linecap="round" opacity="{0.7 * forca:.2f}"/>')
    return ''.join(out)


def sombra(x, rx, opacidade=0.13):
    return f'<ellipse cx="{x:.1f}" cy="{CHAO + 2}" rx="{rx:.1f}" ry="{rx * 0.13:.1f}" fill="#000" opacity="{opacidade:.2f}"/>'


def gotas_suor(x, y, t, n=3):
    out = []
    for i in range(n):
        u = (t * 2 + i / n) % 1
        gx = x + (i - 1) * 26 + (i - 1) * 30 * u
        gy = y + 50 * u * u - 10
        out.append(f'<path d="M{gx:.1f},{gy - 9:.1f} Q{gx + 6:.1f},{gy + 2:.1f} {gx:.1f},{gy + 5:.1f} '
                   f'Q{gx - 6:.1f},{gy + 2:.1f} {gx:.1f},{gy - 9:.1f} Z" fill="#7CC8F0" stroke="#2A6F9B" '
                   f'stroke-width="1.5" opacity="{1 - u:.2f}"/>')
    return ''.join(out)


def notas_musicais(x, y, t, n=4, cores=('#E84A8A', '#7A4AE8', '#2EA0E8', '#F2A01E')):
    y = max(y, 140)
    out = []
    for i in range(n):
        u = (t * 1.5 + i / n) % 1
        nx = x + (i - n / 2 + 0.5) * 70 + 20 * math.sin(u * 6 + i)
        ny = y - 110 * u
        cor = cores[i % len(cores)]
        out.append(f'<g transform="translate({nx:.1f},{ny:.1f}) rotate({-15 + 30 * math.sin(u * 5):.1f})" opacity="{onda(u, 0, 1):.2f}">'
                   f'<ellipse cx="0" cy="0" rx="9" ry="6.5" fill="{cor}" transform="rotate(-25)"/>'
                   f'<path d="M8,-2 L8,-32 Q15,-26 22,-28" fill="none" stroke="{cor}" stroke-width="3.2" stroke-linecap="round"/></g>')
    return ''.join(out)


def brilhos(x, y, t, n=5, raio=150, cor='#9BD7A8'):
    out = []
    for i in range(n):
        u = (t + i / n) % 1
        a = TAU * i / n + t * TAU * 0.25
        bx, by = x + raio * math.cos(a), y + raio * 0.6 * math.sin(a) - 30 * u
        s = 4 + 8 * onda(u, 0, 1)
        out.append(f'<path d="M{bx:.1f},{by - s:.1f} Q{bx:.1f},{by:.1f} {bx + s:.1f},{by:.1f} Q{bx:.1f},{by:.1f} {bx:.1f},{by + s:.1f} '
                   f'Q{bx:.1f},{by:.1f} {bx - s:.1f},{by:.1f} Q{bx:.1f},{by:.1f} {bx:.1f},{by - s:.1f} Z" fill="{cor}" '
                   f'opacity="{0.4 + 0.6 * onda(u, 0, 1):.2f}"/>')
    return ''.join(out)


def tapete(x0, x1, cor='#7FB8A4'):
    return (f'<rect x="{x0:.1f}" y="{CHAO - 8}" width="{x1 - x0:.1f}" height="13" rx="6" fill="{cor}" '
            f'stroke="{CONTORNO}" stroke-width="2"/>')


def bola_futebol(x, y, r=26, giro=0.0):
    pent = ' '.join(f'{0.4 * r * math.sin(math.radians(72 * i)):.1f},{-0.4 * r * math.cos(math.radians(72 * i)):.1f}' for i in range(5))
    s = [f'<g transform="translate({x:.1f},{y:.1f}) rotate({giro:.1f})"><clipPath id="cf"><circle r="{r}"/></clipPath>',
         f'<circle r="{r}" fill="#fff"/><g clip-path="url(#cf)">']
    for i in range(5):
        a = math.radians(72 * i + 36)
        s.append(f'<circle cx="{r * 1.02 * math.sin(a):.1f}" cy="{-r * 1.02 * math.cos(a):.1f}" r="{r * 0.34:.1f}" fill="{CONTORNO}"/>')
        b = math.radians(72 * i)
        s.append(f'<line x1="{0.4 * r * math.sin(b):.1f}" y1="{-0.4 * r * math.cos(b):.1f}" x2="{r * math.sin(b):.1f}" '
                 f'y2="{-r * math.cos(b):.1f}" stroke="{CONTORNO}" stroke-width="1.6"/>')
    s.append(f'</g><polygon points="{pent}" fill="{CONTORNO}"/>'
             f'<circle r="{r}" fill="none" stroke="{CONTORNO}" stroke-width="2.5"/></g>')
    return ''.join(s)


def bola_basquete(x, y, r=26, giro=0.0, escala=1.0):
    return (f'<g transform="translate({x:.1f},{y:.1f}) rotate({giro:.1f}) scale({escala:.2f})">'
            f'<circle r="{r}" fill="#E8762D" stroke="{CONTORNO}" stroke-width="2.5"/>'
            f'<path d="M0,{-r} L0,{r} M{-r},0 L{r},0 M{-r * 0.72},{-r * 0.7} Q0,{-r * 0.1} {r * 0.72},{-r * 0.7} '
            f'M{-r * 0.72},{r * 0.7} Q0,{r * 0.1} {r * 0.72},{r * 0.7}" fill="none" stroke="{CONTORNO}" stroke-width="2"/></g>')


def bola_volei(x, y, r=26, giro=0.0):
    return (f'<g transform="translate({x:.1f},{y:.1f}) rotate({giro:.1f})"><clipPath id="cv"><circle r="{r}"/></clipPath>'
            f'<circle r="{r}" fill="#F8F8F2"/><g clip-path="url(#cv)">'
            f'<path d="M{-r},{-r * 0.2} Q0,{-r * 0.75} {r},{-r * 0.2}" fill="none" stroke="#F2C230" stroke-width="{r * 0.42:.1f}"/>'
            f'<path d="M{-r},{r * 0.55} Q0,{r * 0.05} {r},{r * 0.55}" fill="none" stroke="#2E6FD0" stroke-width="{r * 0.42:.1f}"/></g>'
            f'<path d="M{-r},{-r * 0.2} Q0,{-r * 0.75} {r},{-r * 0.2} M{-r},{r * 0.55} Q0,{r * 0.05} {r},{r * 0.55}" fill="none" '
            f'stroke="{CONTORNO}" stroke-width="1.4"/>'
            f'<circle r="{r}" fill="none" stroke="{CONTORNO}" stroke-width="2.5"/></g>')


def bola_handebol(x, y, r=22, giro=0.0, escala=1.0):
    return (f'<g transform="translate({x:.1f},{y:.1f}) rotate({giro:.1f}) scale({escala:.2f})"><clipPath id="ch"><circle r="{r}"/></clipPath>'
            f'<circle r="{r}" fill="#F8F8F2"/><g clip-path="url(#ch)">'
            f'<path d="M{-r},{-r * 0.4} Q{-r * 0.2},{-r * 0.1} {-r * 0.1},{r}" fill="none" stroke="#2E6FD0" stroke-width="{r * 0.5:.1f}"/>'
            f'<path d="M{r},{-r * 0.6} Q{r * 0.2},{-r * 0.2} {r * 0.4},{r}" fill="none" stroke="#D63A3A" stroke-width="{r * 0.4:.1f}"/></g>'
            f'<circle r="{r}" fill="none" stroke="{CONTORNO}" stroke-width="2.5"/></g>')


def cesta_fundo(x, y):
    return (f'<rect x="{x - 7}" y="{y - 40}" width="14" height="{CHAO - y + 40}" fill="#9A9A9A" stroke="{CONTORNO}" stroke-width="2"/>'
            f'<rect x="{x - 64}" y="{y - 92}" width="128" height="84" rx="4" fill="#fff" stroke="{CONTORNO}" stroke-width="3"/>'
            f'<rect x="{x - 24}" y="{y - 52}" width="48" height="34" fill="none" stroke="#D63A3A" stroke-width="3"/>')


def cesta_frente(x, y, estica=1.0):
    s = []
    fundo = y + 58 * estica
    for i in range(7):
        u = i / 6
        x0 = x - 40 + 80 * u
        x1 = x - 25 + 50 * u
        s.append(f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{fundo:.1f}" stroke="#E8E8E8" stroke-width="2.5"/>')
        s.append(f'<line x1="{x0:.1f}" y1="{y:.1f}" x2="{x1:.1f}" y2="{fundo:.1f}" stroke="#9A9A9A" stroke-width="1"/>')
    for k in (0.35, 0.7):
        w = 40 - 15 * k
        s.append(f'<path d="M{x - w:.1f},{y + 58 * estica * k:.1f} Q{x:.1f},{y + 58 * estica * k + 6:.1f} {x + w:.1f},{y + 58 * estica * k:.1f}" '
                 f'fill="none" stroke="#B0B0B0" stroke-width="1.6"/>')
    s.append(f'<ellipse cx="{x}" cy="{y}" rx="42" ry="9" fill="none" stroke="{CONTORNO}" stroke-width="7.5"/>'
             f'<ellipse cx="{x}" cy="{y}" rx="42" ry="9" fill="none" stroke="#E8622D" stroke-width="4.5"/>')
    return ''.join(s)


def barra(p1, p2):
    ang = math.degrees(math.atan2(p2[1] - p1[1], p2[0] - p1[0]))
    d = math.dist(p1, p2)
    m = lerp_p(p1, p2, 0.5)
    s = [f'<g transform="translate({m[0]:.1f},{m[1]:.1f}) rotate({ang:.1f})">',
         f'<rect x="{-d / 2 - 92:.1f}" y="-4.5" width="{d + 184:.1f}" height="9" rx="3" fill="#8A8A8A" stroke="{CONTORNO}" stroke-width="2"/>']
    for sgn in (-1, 1):
        for off, w, h in ((52, 20, 92), (74, 16, 70)):
            cx = sgn * (d / 2 + off)
            s.append(f'<rect x="{cx - w / 2:.1f}" y="{-h / 2}" width="{w}" height="{h}" rx="4" fill="#5A5A5A" stroke="{CONTORNO}" stroke-width="2"/>')
    return ''.join(s) + '</g>'


def halter(p, ang):
    return (f'<g transform="translate({p[0]:.1f},{p[1]:.1f}) rotate({90 - ang:.1f})">'
            f'<rect x="-4" y="-30" width="8" height="60" rx="3" fill="#8A8A8A" stroke="{CONTORNO}" stroke-width="1.8"/>'
            f'<rect x="-11" y="-38" width="22" height="16" rx="4" fill="#5A5A5A" stroke="{CONTORNO}" stroke-width="2"/>'
            f'<rect x="-11" y="22" width="22" height="16" rx="4" fill="#5A5A5A" stroke="{CONTORNO}" stroke-width="2"/></g>')


def agua(y, t, frente):
    fase = TAU * t * 2 + (0 if frente else 1.5)
    amp = 9 if frente else 7
    y0 = y if frente else y - 18
    pts = ' '.join(f'L{x},{y0 + amp * math.sin(x / 38 + fase):.1f}' for x in range(0, L + 10, 10))
    cor, op = ('#3FA9F5', 0.66) if frente else ('#9ED8F7', 0.95)
    return f'<path d="M0,{A} {pts} L{L},{A} Z" fill="{cor}" opacity="{op}" stroke="#1E7FC2" stroke-width="2"/>'


def impactos(pose, J, textos=None):
    """Estrelas de impacto nos membros com pow_<membro> alto (pow_je/pow_jd = joelhos)."""
    textos = textos or {}
    out = []
    hx = BASE[0] + pose['x']
    for chave, v in pose.items():
        if not chave.startswith('pow_') or v < 0.55:
            continue
        alvo = chave[4:]
        p = no_mundo(pose, J['p' + alvo[1]][1] if alvo[0] == 'j' else J[alvo][2])
        lado = 1 if p[0] >= hx else -1
        texto = textos.get(alvo, {'be': 'POW!', 'bd': 'BAM!'}.get(alvo, 'TUM!'))
        out.append(tracos(p[0], p[1], lado, 0, v))
        out.append(estrela(p[0] + lado * 66, p[1] - 34, 0.5 + 0.45 * v, texto))
    return ''.join(out)


def topo_mundo(ch, pose):
    return no_mundo(pose, (0, ch.get('topo', -340)))


def mao_mundo(ch, pose, nome):
    """(ponta, articulação do meio) do membro, no mundo."""
    J = juntas(ch, pose)
    return no_mundo(pose, J[nome][2]), no_mundo(pose, J[nome][1])


def na_mao(ch, pose, nome, r):
    """Centro de uma bola segura na ponta do braço."""
    p, cot = mao_mundo(ch, pose, nome)
    d = math.dist(p, cot) or 1
    return p[0] + (p[0] - cot[0]) / d * (r + 6), p[1] + (p[1] - cot[1]) / d * (r + 6)


# ---------- esportes ----------
# Cada função recebe t (0..1, um ciclo) e o personagem e devolve a pose do quadro, com
# 'antes'/'depois' = SVG desenhado atrás/na frente do personagem.

GUARDA = dict(REPOUSO, be=(-20, 165), bd=(20, -165), frente=('be', 'bd'), pe=(-14, -6), pd=(14, 6),
              pow_be=0, pow_bd=0, pow_pe=0, pow_pd=0, pow_jd=0, boca=None)
JAB = dict(be=(-88, 270), rot=-6, x=-8, y=0, pow_be=1, boca='aberta')
DIRETO = dict(bd=(88, -270), rot=7, x=8, y=0, pow_bd=1, boca='aberta')


def boxe(t, ch):
    chaves = [(0.00, GUARDA), (0.07, {'y': -7}), (0.12, JAB), (0.20, {}), (0.28, GUARDA), (0.36, {'y': -7}),
              (0.42, DIRETO), (0.50, {}), (0.58, GUARDA), (0.64, JAB), (0.69, GUARDA), (0.74, DIRETO), (0.80, {}),
              (0.88, GUARDA), (0.94, {'y': -7})]
    pose = por_chaves(t, ch, chaves)
    pose['depois'] = impactos(pose, juntas(ch, pose))
    return pose


def muay_thai(t, ch):
    joelhada = dict(pd=(105, -5), rot=-8, y=-10, be=(-10, 150), bd=(10, -150), pow_jd=1, boca='aberta')
    chute = dict(pd=(108, 100), rot=-15, y=0, pow_pd=1, pow_jd=0, boca='aberta')
    chaves = [(0.00, GUARDA), (0.06, {'y': -6}), (0.12, DIRETO), (0.19, {}), (0.27, GUARDA), (0.36, joelhada),
              (0.44, {}), (0.54, GUARDA), (0.64, chute), (0.72, {}), (0.84, GUARDA)]
    pose = por_chaves(t, ch, chaves)
    pose['depois'] = impactos(pose, juntas(ch, pose), {'jd': 'POW!', 'je': 'POW!'})
    return pose


def kickboxing(t, ch):
    cruzado = dict(be=(60, 90), rot=10, x=10, pow_be=1, boca='aberta')
    recolhe = dict(pd=(70, -40), rot=-6, pow_pd=0, boca=None)
    chute = dict(pd=(118, 118), rot=-18, pow_pd=1, boca='aberta')
    chaves = [(0.00, GUARDA), (0.06, {'y': -6}), (0.11, dict(DIRETO, rot=6)), (0.17, {}), (0.22, GUARDA),
              (0.28, cruzado), (0.34, {}), (0.40, GUARDA), (0.50, recolhe), (0.58, chute), (0.68, {}),
              (0.76, recolhe), (0.86, GUARDA)]
    pose = por_chaves(t, ch, chaves)
    pose['depois'] = impactos(pose, juntas(ch, pose))
    return pose


def lutas(t, ch, final, grito):
    s1 = dict(REPOUSO, x=-14, rot=-3, pe=(-20, -8), pd=(14, 6), be=(-35, 60), bd=(35, -60),
              frente=('be', 'bd'), boca=None, grito=0, sy=1)
    s2 = dict(x=14, rot=3, pe=(-14, -6), pd=(20, 8), be=(-65, -10), bd=(65, 10))
    chaves = [(0.00, s1), (0.12, s2), (0.24, s1), (0.36, s2), (0.48, s1), (0.56, {'y': 12, 'sy': 0.94}),
              (0.64, dict(final, y=-24, sy=1, x=0, rot=0, boca='aberta', grito=1)), (0.78, {}), (0.90, s1)]
    pose = por_chaves(t, ch, chaves)
    if pose['grito'] > 0.5:
        tx, ty = topo_mundo(ch, pose)
        pose['depois'] = estrela(tx + 120, ty + 50, 0.6 + 0.4 * pose['grito'], grito)
    return pose


def jiu_jitsu(t, ch):
    return lutas(t, ch, dict(be=(-30, 100), bd=(30, -100), frente=('be', 'bd')), 'OSS!')


def judo(t, ch):
    return lutas(t, ch, dict(bd=(170, 180), be=(-30, -20), frente=('be', 'bd')), 'IPPON!')


def futebol(t, ch):
    lado = ch.get('lado', 1)
    rep = dict(REPOUSO, be=(-18, -10), bd=(18, 10), pow_pd=0, boca=None)
    chaves = [(0.00, rep), (0.08, {'y': -4}), (0.16, dict(pd=(-35, -15), be=(-70, -60), bd=(45, 30), rot=5, y=0)),
              (0.24, dict(pd=(70, 85), rot=-10, x=-8, be=(-90, -110), bd=(25, 15), pow_pd=1, boca='aberta')),
              (0.32, dict(pd=(95, 110))), (0.44, rep), (0.62, {'y': -4}), (0.72, rep)]
    pose = por_chaves(t, ch, chaves)
    b0 = (BASE[0] + lado * 100, CHAO - 26)
    if t < 0.22:
        bola = b0, 0
    elif t < 0.5:
        u = (t - 0.22) / 0.28
        bola = (b0[0] + lado * 470 * u, b0[1] - 330 * u + 250 * u * u), lado * 720 * u
    elif t < 0.6:
        bola = None
    else:
        u = rampa(t, 0.6, 0.95)
        bola = (b0[0] + lado * 380 * (1 - u), b0[1]), lado * 380 * (1 - u) / 26 * 57
    pose['depois'] = ((bola_futebol(bola[0][0], bola[0][1], 26, bola[1]) if bola else '') +
                      impactos(pose, juntas(ch, pose), {'pd': 'PAF!', 'pe': 'PAF!'}))
    return pose


def basquete(t, ch):
    lado = ch.get('lado', 1)
    braco = 'bd' if lado > 0 else 'be'
    drible = dict(REPOUSO, bd=(35, 20), boca=None, sy=1, sx=1)
    chaves = [(0.00, drible), (0.08, {'bd': (35, 45), 'y': -3}), (0.15, {'bd': (35, 20), 'y': 0}),
              (0.23, {'bd': (35, 45), 'y': -3}), (0.30, {'bd': (35, 20), 'y': 0}),
              (0.36, {'y': 18, 'sy': 0.93, 'sx': 1.04, 'bd': (150, 170), 'be': (-120, -150)}),
              (0.46, {'y': -55, 'sy': 1, 'sx': 1, 'bd': (172, 180), 'be': (-150, -175), 'pe': (-30, 15), 'pd': (30, -15)}),
              (0.52, {'bd': (165, 140), 'boca': 'aberta'}),
              (0.62, {'y': 0, 'pe': REPOUSO['pe'], 'pd': REPOUSO['pd'], 'be': (-25, -15), 'bd': (25, 15)}),
              (0.67, {'y': 12, 'sy': 0.95, 'boca': None}), (0.75, drible)]
    pose = por_chaves(t, ch, chaves)
    cx, cy = BASE[0] + lado * 238, 190
    r = 25
    estica = 1.0
    if t < 0.30:
        mx, my = mao_mundo(ch, pose, braco)[0]
        p = (t / 0.30) * 2
        bola = (mx + lado * 6, my + r + 6 + (CHAO - r - my - r - 6) * abs(math.sin(math.pi * p)))
    elif t < 0.48:
        bola = na_mao(ch, pose, braco, r)
    elif t < 0.66:
        u = (t - 0.48) / 0.18
        p0 = na_mao(ch, por_chaves(0.48, ch, chaves), braco, r)
        bola = (lerp(p0[0], cx, u), lerp(p0[1], cy - 14, u) - 110 * 4 * u * (1 - u))
    elif t < 0.76:
        u = (t - 0.66) / 0.10
        bola = (cx, cy - 14 + 80 * u)
        estica = 1 + 0.35 * onda(t, 0.66, 0.76)
    elif t < 0.86:
        u = ((t - 0.76) / 0.10) ** 2
        bola = (cx, lerp(cy + 66, CHAO - r, u))
    else:
        u = (t - 0.86) / 0.14
        m0 = mao_mundo(ch, por_chaves(0.0, ch, chaves), braco)[0]
        alvo = (m0[0] + lado * 6, m0[1] + r + 6)
        bola = (lerp(cx, alvo[0], u), lerp(CHAO - r, alvo[1], u) - 120 * 4 * u * (1 - u))
    pose['antes'] = cesta_fundo(cx, cy)
    pose['depois'] = bola_basquete(bola[0], bola[1], r, t * 900) + cesta_frente(cx, cy, estica)
    if 0.66 < t < 0.88:
        pose['depois'] += estrela(cx, cy - 130, 0.7 + 0.4 * onda(t, 0.66, 0.88), 'CESTA!', '#FF9A3C')
    return pose


def volei(t, ch):
    lado = ch.get('lado', 1)
    braco = 'bd' if lado > 0 else 'be'
    rep = dict(REPOUSO, sy=1, sx=1, boca=None, pow_bd=0)
    chaves = [(0.00, rep), (0.12, {'y': 16, 'sy': 0.93, 'sx': 1.04, 'be': (-40, -50), 'bd': (40, 50)}),
              (0.26, {'y': -60, 'sy': 1, 'sx': 1, 'be': (-165, -180), 'bd': (160, 200), 'pe': (-20, 20), 'pd': (20, -20)}),
              (0.34, {'bd': (150, 215), 'y': -64}),
              (0.40, {'bd': (105, 80), 'rot': 8, 'pow_bd': 1, 'boca': 'aberta', 'y': -58}),
              (0.47, {'bd': (60, 40), 'pow_bd': 0, 'y': -30}),
              (0.56, {'y': 14, 'sy': 0.94, 'rot': 0, 'pe': REPOUSO['pe'], 'pd': REPOUSO['pd'], 'boca': None,
                      'be': (-30, -20)}),
              (0.66, rep)]
    pose = por_chaves(t, ch, chaves)
    r = 26
    contato = mao_mundo(ch, por_chaves(0.40, ch, chaves), braco)[0]
    contato = (contato[0] + lado * 14, contato[1] - 30)
    bola = None
    if t < 0.40:
        u = t / 0.40
        bola = (contato[0], lerp(-60, contato[1], u * u)), 400 * u
    elif t < 0.50:
        u = (t - 0.40) / 0.10
        bola = lerp_p(contato, (BASE[0] + lado * 270, CHAO - r), u), 400 + 600 * u
    elif t < 0.62:
        u = (t - 0.50) / 0.12
        bola = (BASE[0] + lado * (270 + 170 * u), CHAO - r - 260 * u + 80 * u * u), 1000 + 400 * u
    pose['depois'] = bola_volei(bola[0][0], bola[0][1], r, bola[1]) if bola else ''
    if 0.40 <= t < 0.50:
        pose['depois'] += tracos(bola[0][0], bola[0][1], lado, 1.4, 1 - (t - 0.40) / 0.10)
    pose['depois'] += impactos(pose, juntas(ch, pose), {'bd': 'PÁ!', 'be': 'PÁ!'})
    return pose


def handebol(t, ch):
    lado = ch.get('lado', 1)
    braco = 'bd' if lado > 0 else 'be'
    segura = dict(REPOUSO, bd=(30, 25), sy=1, boca=None)
    chaves = [(0.00, segura), (0.10, {'y': -12, 'pe': (-25, 15), 'pd': (10, 0)}),
              (0.18, {'y': 0, 'pe': (-5, -2), 'pd': (20, -10)}),
              (0.27, {'y': -50, 'bd': (150, 235), 'be': (-70, -50), 'pe': (-30, 25), 'pd': (25, -30), 'rot': -6}),
              (0.34, {'bd': (75, 85), 'rot': 9, 'x': 14, 'boca': 'aberta', 'y': -55}),
              (0.42, {'bd': (35, 25), 'y': -25}),
              (0.52, {'y': 12, 'sy': 0.95, 'rot': 0, 'x': 0, 'boca': None, 'pe': REPOUSO['pe'], 'pd': REPOUSO['pd'],
                      'be': REPOUSO['be']}),
              (0.62, segura)]
    pose = por_chaves(t, ch, chaves)
    r = 22
    pose['depois'] = ''
    if t < 0.33 or t >= 0.85:
        esc = 1 if t < 0.33 else rampa(t, 0.85, 0.97)
        b = na_mao(ch, pose, braco, r)
        pose['depois'] = bola_handebol(b[0], b[1], r, 0, esc)
    elif t < 0.46:
        u = (t - 0.33) / 0.13
        p0 = na_mao(ch, por_chaves(0.33, ch, chaves), braco, r)
        b = (p0[0] + lado * 520 * u, p0[1] + 50 * u * u)
        pose['depois'] = bola_handebol(b[0], b[1], r, lado * 900 * u) + tracos(b[0], b[1], lado, 0.1, 1 - u * 0.5)
    return pose


def natacao(t, ch):
    p = t * 2
    ae = -90 - 360 * p
    ad = 90 + 360 * (p + 0.5)
    pose = dict(POSE_BASE, rot=6 * math.sin(TAU * p), y=10 + 6 * math.sin(2 * TAU * p),
                be=(ae, ae - 15), bd=(ad, ad + 15),
                pe=(-8 + 12 * math.sin(4 * TAU * t), -8), pd=(8 - 12 * math.sin(4 * TAU * t), 8),
                boca='aberta' if math.sin(TAU * p) > 0.6 else None, sombra=False)
    nivel = BASE[1] - 95
    respingos = []
    for nome in ('be', 'bd'):
        m = mao_mundo(ch, pose, nome)[0]
        if abs(m[1] - nivel) < 30:
            for i in range(4):
                a = math.pi * (0.15 + 0.7 * i / 3)
                respingos.append(f'<circle cx="{m[0] + 26 * math.cos(a):.1f}" cy="{nivel - 6 - 22 * math.sin(a):.1f}" r="4" '
                                 f'fill="#9ED8F7" stroke="#1E7FC2" stroke-width="1.5"/>')
    bolhas = []
    for i in range(6):
        u = (t * 2 + i / 6) % 1
        bx = BASE[0] + (i - 2.5) * 60 + 8 * math.sin(u * 9)
        by = A - 20 - (A - 40 - nivel) * u
        bolhas.append(f'<circle cx="{bx:.1f}" cy="{by:.1f}" r="{3 + i % 3 * 2}" fill="none" stroke="#FFFFFF" '
                      f'stroke-width="2" opacity="{0.8 * (1 - u):.2f}"/>')
    pose['antes'] = agua(nivel, t, False)
    pose['depois'] = agua(nivel, t, True) + ''.join(bolhas) + ''.join(respingos)
    return pose


def capoeira(t, ch):
    g1 = dict(REPOUSO, x=-22, rot=-5, y=0, pe=(-32, -20), pd=(8, 4), be=(-35, 170), bd=(45, 30), frente=('be',))
    g2 = dict(x=22, rot=5, pe=(-8, -4), pd=(32, 20), be=(-45, -30), bd=(35, -170), frente=('bd',))
    chaves = [(0.00, g1), (0.14, g2), (0.28, g1), (0.40, g2), (0.48, dict(g1, y=6)),
              (0.54, dict(pd=(-50, -40), rot=-8, x=-10, y=0, be=(-90, -110), bd=(70, 60), frente=())),
              (0.60, dict(pd=(-140, -150), rot=-14)), (0.66, dict(pd=(160, 150), rot=-12)),
              (0.72, dict(pd=(80, 70), rot=-6)), (0.82, g2), (0.94, g1)]
    pose = por_chaves(t, ch, chaves)
    tx, ty = topo_mundo(ch, pose)
    pose['depois'] = notas_musicais(BASE[0], ty + 20, t, cores=('#2E7D32', '#F2A01E', '#C62828', '#6D4C41'))
    return pose


def zumba(t, ch):
    a = dict(x=-16, rot=-7, y=-8, pe=(-55, 15), pd=(5, 2), be=(-165, -185), bd=(80, 120), boca='aberta')
    b = dict(REPOUSO, be=(-70, -110), bd=(70, 110), boca=None)
    c = espelhar(a)
    d = dict(x=0, rot=0, y=-16, pe=(-12, -4), pd=(12, 4), be=(-150, -195), bd=(150, 195), boca='aberta')
    chaves = [(0.0, b), (0.125, a), (0.25, b), (0.375, c), (0.5, b), (0.625, d), (0.6875, b), (0.75, d), (0.875, b)]
    pose = quadro_chave(t, chaves)
    tx, ty = topo_mundo(ch, pose)
    pose['depois'] = notas_musicais(BASE[0], ty + 30, t)
    return pose


def yoga(t, ch):
    arvore = dict(pe=(0, 0), pd=(50, -80), olhos='fechados', x=12)
    baixo = dict(arvore, be=(-25, -15), bd=(25, 15), frente=())
    abertos = dict(be=(-90, -95), bd=(90, 95), frente=())
    prece = dict(be=(-35, 107), bd=(35, -107), frente=('be', 'bd'))  # mãos juntas na frente do peito
    pose = quadro_chave(t, [(0.0, baixo), (0.14, abertos), (0.28, prece), (0.62, prece), (0.76, abertos), (0.9, baixo)])
    resp = math.sin(TAU * t)
    pose['sy'] = 1 + 0.025 * resp
    px = BASE[0] + pose['x']
    tx, ty = topo_mundo(ch, pose)
    cy = (CHAO + ty) / 2
    texto = 'inspira…' if resp > 0 else 'expira…'
    pose['antes'] = (tapete(px - 120, px + 120) +
                     f'<ellipse cx="{px}" cy="{cy:.1f}" rx="{190 + 12 * resp:.1f}" ry="{(CHAO - ty) / 2 + 40 + 12 * resp:.1f}" '
                     f'fill="#BFE8C6" opacity="{0.3 + 0.12 * resp:.2f}"/>')
    pose['depois'] = (brilhos(px, cy, t, n=6, raio=210) +
                      f'<text x="{px}" y="{A - 8}" text-anchor="middle" font-family="Arial, sans-serif" font-style="italic" '
                      f'font-size="24" fill="#3C8C4E" opacity="{abs(resp):.2f}">{texto}</text>')
    return pose


def musculacao(t, ch):
    if ch.get('halteres'):
        fe = 0.5 - 0.5 * math.cos(TAU * 2 * t)
        fd = 0.5 - 0.5 * math.cos(TAU * 2 * t + math.pi)
        pose = dict(POSE_BASE, be=(-25, lerp(-30, -165, fe)), bd=(25, lerp(30, 165, fd)), frente=('be', 'bd'),
                    boca='dentes' if max(fe, fd) > 0.85 else None, y=-3 * max(fe, fd))
        extra = ''.join(halter(mao_mundo(ch, pose, n)[0], pose[n][1]) for n in ('be', 'bd'))
    else:
        baixo = dict(REPOUSO, be=(-60, 180), bd=(60, 180), frente=('be', 'bd'), boca=None, y=0)
        cima = dict(be=(-165, -170), bd=(165, 170), boca='dentes', y=-6)
        pose = quadro_chave(t, [(0, baixo), (0.2, cima), (0.3, cima), (0.5, baixo), (0.7, cima), (0.8, cima)])
        extra = barra(mao_mundo(ch, pose, 'be')[0], mao_mundo(ch, pose, 'bd')[0])
    tx, ty = topo_mundo(ch, pose)
    pose['depois'] = extra + gotas_suor(tx + 60, ty + 70, t)
    return pose


def funcional(t, ch):
    """Flexões de braço: corpo na diagonal, pés fixos no chão."""
    lado = ch.get('lado', 1)
    l1, l2, _ = ch['braco']
    lp = ch['perna'][0] + ch['perna'][1]
    pes = (BASE[0] - lado * 175, CHAO - 14)

    def montar(rep):
        rot = lado * (70 + 9 * rep)
        r = math.radians(rot)
        quadril = (pes[0] + lp * math.sin(r), pes[1] - lp * math.cos(r))
        return dict(POSE_BASE, x=quadril[0] - BASE[0], y=quadril[1] - BASE[1], rot=rot, pe=(-rot, -rot),
                    pd=(-rot, -rot), sombra=False, frente=('bd',) if lado > 0 else ('be',))

    rep = 0.5 - 0.5 * math.cos(TAU * 2 * t)
    pose = montar(rep)
    p0 = montar(0)
    for nome, ombro in (('be', ch['ombros'][0]), ('bd', ch['ombros'][1])):
        alvo = (no_mundo(p0, ombro)[0] + lado * 6, CHAO - 14)
        pose[nome] = ik(no_mundo(pose, ombro), alvo, l1, l2, -lado)
    pose['boca'] = 'dentes' if rep > 0.6 else None
    s = no_mundo(pose, ch['ombros'][1])
    x0, x1 = sorted((pes[0] - lado * 50, s[0] + lado * 80))
    pose['antes'] = tapete(x0, x1) + sombra((pes[0] + s[0]) / 2, 180, 0.1)
    pose['depois'] = gotas_suor(s[0], s[1] - 120, t, 2)
    if rep > 0.3:
        pose['depois'] += (f'<text x="{s[0]:.1f}" y="{s[1] - 150 - 25 * rep:.1f}" text-anchor="middle" '
                           f'font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="44" fill="#F2A01E" '
                           f'stroke="{CONTORNO}" stroke-width="1.8" opacity="{rep:.2f}">{1 + int(t * 2)}</text>')
    return pose


def pilates(t, ch):
    """Deitado de costas, pernas apoiadas na bola, sobe uma perna de cada vez."""
    lado = ch.get('lado', 1)
    rot = -lado * 72
    quadril = (BASE[0] + lado * 60, CHAO - ch.get('meia_largura', 100))
    pose = dict(POSE_BASE, x=quadril[0] - BASE[0], y=quadril[1] - BASE[1], rot=rot, sombra=False, olhos='fechados')
    bola = (quadril[0] + lado * 170, CHAO - 74, 74)
    l1, l2, _ = ch['perna']
    resp = 0.5 - 0.5 * math.cos(TAU * t)
    for i, nome in enumerate(('pe', 'pd') if lado > 0 else ('pd', 'pe')):
        quad = no_mundo(pose, ch['quadris'][0 if nome == 'pe' else 1])
        apoio = (bola[0] - lado * (12 + 18 * i), bola[1] - bola[2] - 8)
        cima = (quad[0] + lado * 70, quad[1] - 200)
        f = onda(t, 0.04, 0.46) if i == 0 else onda(t, 0.54, 0.96)
        pose[nome] = ik(quad, lerp_p(apoio, cima, f), l1, l2, lado)
    b1, b2, _ = ch['braco']
    pulso = 10 * math.sin(TAU * 6 * t)
    for nome, ombro in (('be', ch['ombros'][0]), ('bd', ch['ombros'][1])):
        o = no_mundo(pose, ombro)
        pose[nome] = ik(o, (o[0] + lado * 115, o[1] + 35 + pulso), b1, b2, lado)
    x0, x1 = sorted((quadril[0] - lado * 340, bola[0] + lado * 60))
    pose['antes'] = (tapete(x0, x1) + sombra(bola[0], 70, 0.12) +
                     f'<circle cx="{bola[0]:.1f}" cy="{bola[1]:.1f}" r="{bola[2]}" fill="{ch.get("cor_bola", "#2E9BDB")}" '
                     f'stroke="{CONTORNO}" stroke-width="2.5"/>'
                     f'<path d="M{bola[0] - 40:.1f},{bola[1] - 45:.1f} Q{bola[0] - 10:.1f},{bola[1] - 62:.1f} {bola[0] + 22:.1f},{bola[1] - 55:.1f}" '
                     f'fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.6"/>')
    pose['depois'] = brilhos(BASE[0], CHAO - 200, t, n=5, raio=240, cor='#C9A6E8')
    pose['sy'] = 1 + 0.015 * resp
    return pose


ESPORTES = {
    'Boxe': boxe, 'Muay Thai': muay_thai, 'Kickboxing': kickboxing, 'Jiu-Jitsu': jiu_jitsu, 'Judô': judo,
    'Futebol': futebol, 'Basquete': basquete, 'Vôlei': volei, 'Handebol': handebol, 'Natação': natacao,
    'Capoeira': capoeira, 'Zumba': zumba, 'Yoga': yoga, 'Musculação': musculacao, 'Funcional': funcional,
    'Pilates': pilates,
}


# ---------- personagens ----------
# Cada corpo é desenhado no referencial do corpo (quadril em 0,0) e recebe `e`, a expressão
# do quadro (boca, olhos, piscada).

def corpo_couve(e):
    veias = [[(0, -30), (0, -290)], [(0, -90), (-82, -150)], [(0, -90), (82, -150)],
             [(0, -170), (-74, -250)], [(0, -170), (74, -250)]]
    return (blob_ondulado(0, -165, 118, 150, 14, 9, '#3FA45B') +
            ''.join(linha(v, '#1F6E35', 3) for v in veias) +
            faixa_kimono(-46, 100, BRANCO) +
            rosto(0, -185, e, 1.3, sobr='brava', boca='reta'))


def corpo_alface(e):
    return (camiseta('#E6E2DA', topo=-150, ombro=60, cint=48) +
            linha([(-34, -140), (-30, -10)], '#BDB8AC', 3) + linha([(34, -140), (30, -10)], '#BDB8AC', 3) +
            blob_ondulado(0, -238, 110, 88, 20, 7, '#2E9B3C') +
            blob_ondulado(0, -232, 80, 62, 16, 5, '#3DB04A', sw=1.5) +
            rosto(0, -226, e, 1.2, sobr='alegre', boca='aberta'))


def corpo_abobrinha(e):
    corpo = forma([(-50, -6), (-58, -120), (-56, -250), (-44, -320), (0, -342), (44, -320), (56, -250), (58, -120),
                   (50, -6), (0, 4)], '#9CCB9F')
    listras = ''.join(linha([(x * 0.8, -30), (x, -170), (x * 0.8, -290)], '#6FA878', 3) for x in (-30, 0, 30))
    touca = forma([(-60, -262), (-52, -318), (0, -352), (52, -318), (60, -262), (0, -280)], '#1F8CC8')
    brilho = linha([(-30, -320), (0, -336), (24, -326)], '#7CC4EC', 4)
    return corpo + listras + touca + brilho + rosto(0, -232, e, 1.15, sobr='nenhuma', boca='aberta', oculos='#1D9C9C')


def corpo_chicoria(e):
    return (folha(-10, -20, -22, 360, 250, '#1F6B35', dentes=9, prof=0.4, nervura='#8BC26B', larg_nervura=9) +
            camiseta('#E4E1DA', topo=-150, ombro=58, cint=46) +
            f'<rect x="-50" y="-26" width="100" height="12" rx="5" fill="#7DBB5A" stroke="{CONTORNO}" stroke-width="2"/>' +
            circulo(0, -208, 42, '#D9B48C') +
            forma([(-44, -210), (-40, -242), (-12, -258), (20, -255), (42, -238), (44, -212), (22, -232), (-20, -234)], '#222222') +
            rosto(0, -200, e, 0.85, sobr='nenhuma', boca='sorriso', fechados=True))


def corpo_rucula(e):
    return (folha(0, 4, 0, 350, 175, '#6E8B4E', dentes=7, prof=0.3, nervura='#4E6B35', larg_nervura=5) +
            rosto(0, -200, e, 1.15, sobr='brava', boca='reta'))


FLORETES = [(-80, -245, 26), (-40, -250, 28), (0, -252, 28), (40, -250, 28), (80, -245, 26), (-95, -275, 22),
            (-60, -285, 28), (-20, -290, 30), (20, -290, 30), (60, -285, 28), (95, -275, 22), (-70, -318, 24),
            (-30, -325, 28), (10, -328, 28), (50, -320, 26), (-5, -352, 22)]


def corpo_brocolis(e):
    s = [camiseta('#1E8C45', topo=-150, ombro=58, cint=46),
         forma([(-28, -140), (-34, -200), (-62, -236), (62, -236), (34, -200), (28, -140)], '#8CC07A')]
    for x, y, r in sorted(FLORETES, key=lambda f: f[1]):
        s.append(circulo(x, y, r, '#237A3B', 2))
        s.append(f'<circle cx="{x - r * 0.25:.1f}" cy="{y - r * 0.25:.1f}" r="{r * 0.45:.1f}" fill="#2F9448"/>')
    s.append(rosto(0, -180, e, 0.95, sobr='normal', boca='sorriso'))
    return ''.join(s)


def corpo_cebolinha(e):
    folhas = [(-16, 300), (16, 300), (-11, 340), (11, 340), (-6, 372), (6, 372), (-2, 330), (2, 350)]
    s = [folha(ang * 1.6, -6, ang, comp, 46, '#3FA33F' if i % 2 else '#36963A', nervura='#2C7A2C')
         for i, (ang, comp) in enumerate(folhas)]
    s.append(rosto(0, -170, e, 0.95, sobr='normal', boca='aberta'))
    return ''.join(s)


def corpo_quiabo(e):
    return (forma([(-26, -4), (-36, -60), (-55, -160), (-62, -250), (-55, -300), (0, -312), (55, -300), (62, -250),
                   (55, -160), (36, -60), (26, -4)], '#5E9E5A') +
            forma([(0, -30), (-14, -120), (-20, -250), (0, -296), (20, -250), (14, -120)], '#8DB955', sw=1.5) +
            forma([(-8, -340), (-6, -372), (4, -382), (10, -342)], '#4F8A3A', 2) +
            forma([(-60, -294), (-50, -330), (0, -348), (50, -330), (60, -294), (0, -308)], '#4F8A3A') +
            rosto(0, -242, e, 1.05, sobr='alegre', boca='aberta'))


def corpo_espinafre(e):
    s = [camiseta('#1E88C8', topo=-140, ombro=56, cint=44)]
    for ang, comp, larg in [(-38, 250, 110), (38, 250, 110), (-20, 300, 120), (20, 300, 120), (0, 330, 130)]:
        s.append(folha(0, -60, ang, comp, larg, '#3E9B3A', nervura='#2B7A2A', larg_nervura=4))
    s.append(rosto(0, -230, e, 1.05, sobr='normal', boca='sorriso'))
    return ''.join(s)


def corpo_tomate(e):
    s = [blob_ondulado(0, -140, 122, 128, 10, 3, '#DD2A3B'),
         '<ellipse cx="-55" cy="-200" rx="28" ry="15" fill="#F27B86" opacity="0.75" transform="rotate(-35 -55 -200)"/>']
    for ang in (-110, -72, -36, 36, 72, 110):
        s.append(folha(0, -262, ang, 80, 30, '#2FA33A', nervura='#1E7A2A'))
    s.append(forma([(-6, -262), (-8, -292), (4, -300), (8, -262)], '#2B8A33', 2))
    s.append(rosto(0, -130, e, 1.25, sobr='brava', boca='dentes', oculos='#6E6E6E'))
    return ''.join(s)


def corpo_agriao(e):
    discos = [(-50, -60, 40), (50, -60, 40), (0, -80, 44), (-62, -130, 42), (62, -130, 42), (0, -150, 48),
              (-58, -205, 44), (58, -205, 44), (-50, -288, 40), (50, -288, 40), (0, -312, 44)]
    s = []
    for x, y, r in sorted(discos, key=lambda d: -d[1]):
        s.append(circulo(x, y, r, '#2DA14F'))
        s.append(linha([(x - r * 0.5, y + r * 0.3), (x, y - r * 0.1), (x + r * 0.45, y - r * 0.5)], '#1E7A3A', 2))
    s.append(circulo(0, -232, 60, '#34B058'))
    s.append(f'<path d="M-58,-296 Q0,-280 58,-296" fill="none" stroke="{CONTORNO}" stroke-width="12" stroke-linecap="round"/>'
             f'<path d="M-58,-296 Q0,-280 58,-296" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>'
             f'<path d="M40,-292 Q74,-340 104,-330" fill="none" stroke="{CONTORNO}" stroke-width="10" stroke-linecap="round"/>'
             f'<path d="M40,-292 Q74,-340 104,-330" fill="none" stroke="#FFFFFF" stroke-width="6" stroke-linecap="round"/>')
    s.append(rosto(0, -232, e, 1.1, sobr='brava', boca='reta'))
    return ''.join(s)


def corpo_repolho(e):
    return (camiseta('#7B3A1C', topo=-150, ombro=60, cint=46, gola=False) +
            linha([(-40, -110), (-18, -100), (-4, -108)], '#4E220E', 2.5) + linha([(40, -110), (18, -100), (4, -108)], '#4E220E', 2.5) +
            blob_ondulado(0, -250, 100, 82, 16, 4, '#3FA34D') +
            linha([(-80, -230), (-55, -300), (0, -322)], '#2C7F38', 2.5) + linha([(80, -230), (55, -300), (0, -322)], '#2C7F38', 2.5) +
            blob_ondulado(0, -244, 62, 52, 12, 3, '#6CC06A', sw=2) +
            rosto(0, -244, e, 1.0, sobr='brava', boca='reta'))


def corpo_pepino(e):
    s = [forma([(-56, -6), (-62, -100), (-62, -250), (-50, -320), (0, -340), (50, -320), (62, -250), (62, -100),
                (56, -6), (0, 4)], '#C5CC6E')]
    for x, y in [(-40, -60), (30, -100), (-20, -150), (40, -190), (-42, -230), (10, -40), (20, -250), (-10, -310)]:
        s.append(f'<path d="M{x - 6},{y} Q{x},{y - 8} {x + 6},{y}" fill="none" stroke="#8E9A3A" stroke-width="2.2" stroke-linecap="round"/>')
    s.append(linha([(-30, -20), (-34, -170), (-28, -300)], '#A9B256', 2.5))
    s.append(linha([(30, -20), (34, -170), (28, -300)], '#A9B256', 2.5))
    s.append(rosto(0, -270, e, 0.95, sobr='brava', boca='reta'))
    return ''.join(s)


def corpo_salsa(e):
    s = [kimono('#E4E1DA', '#1A1A1A', topo=-150, ombro=60, cint=48)]
    for ang, comp in [(-75, 120), (75, 120), (-45, 140), (45, 140), (-18, 150), (18, 150), (0, 140)]:
        s.append(folha(0, -175, ang, comp, 90, '#3E8E6A', dentes=6, prof=0.4, nervura='#2C6B4E'))
    s.append(blob_ondulado(0, -215, 54, 50, 10, 4, '#4A9C76'))
    s.append(rosto(0, -215, e, 1.05, sobr='normal', boca='aberta'))
    return ''.join(s)


def corpo_chuchu(e):
    return (folha(-10, -320, -40, 100, 54, '#5E9E3A', nervura='#3E7A2A') +
            linha([(12, -325), (28, -350), (20, -366), (8, -358), (16, -348)], '#5E9E3A', 3) +
            forma([(-100, -10), (-115, -90), (-98, -190), (-70, -280), (-35, -322), (0, -330), (35, -322), (70, -280),
                   (98, -190), (115, -90), (100, -10), (0, 6)], '#9DC56B') +
            linha([(-60, -20), (-82, -150), (-46, -296)], '#6E9A43', 2.5) +
            linha([(0, -10), (-8, -160), (0, -320)], '#6E9A43', 2.5) +
            linha([(60, -20), (82, -150), (46, -296)], '#6E9A43', 2.5) +
            rosto(0, -235, e, 1.0, sobr='nenhuma', boca='sorriso', labios=True, fechados=True))


def corpo_caruru(e):
    s = [folha(0, -60, -60, 230, 110, '#4E7A4A', nervura='#355A33'), folha(0, -60, 60, 230, 110, '#4E7A4A', nervura='#355A33'),
         folha(0, -90, -25, 250, 100, '#5A8A55', nervura='#355A33'), folha(0, -90, 25, 250, 100, '#5A8A55', nervura='#355A33'),
         camiseta('#E8894A', topo=-170, ombro=58, cint=46)]
    for k in range(6):
        y = -262 - k * 20
        n = 5 - (k + 1) // 2
        for i in range(n):
            x = (i - (n - 1) / 2) * 22
            s.append(circulo(x, y, 13, '#C8D88A', 1.8))
    s.append(circulo(0, -222, 42, '#E8C29E'))
    s.append(rosto(0, -218, e, 0.85, sobr='normal', boca='sorriso'))
    return ''.join(s)


def corpo_serralha(e):
    return (linha([(-30, -200), (-104, -276)], CONTORNO, 9) + linha([(-30, -200), (-104, -276)], '#6E8E2E', 5) +
            petalas(-112, -290, 16, 8, 30, 12, '#F5D63A') + circulo(-112, -290, 14, '#E8B020', 2) +
            folha(0, 4, 0, 350, 250, '#9DBB55', dentes=11, prof=0.3, nervura='#6E8E2E', larg_nervura=5) +
            rosto(8, -212, e, 1.15, sobr='brava', boca='reta', barba='#8A4A2E'))


def corpo_dente(e):
    return (folha(0, 4, 0, 330, 190, '#8DBA2E', dentes=9, prof=0.35, nervura='#5E8A1E', larg_nervura=4) +
            petalas(0, -334, 18, 6, 34, 12, '#F5D63A') + circulo(0, -334, 15, '#E8B020', 2) +
            rosto(0, -200, e, 1.05, sobr='alegre', boca='aberta'))


def corpo_almeirao(e):
    s = [camiseta('#F2E35A', topo=-150, ombro=58, cint=46)]
    for i in range(12):
        s.append(folha(0, -212, i * 30 + 15, 145, 36, '#6B7F35', nervura='#7A3E5A'))
    s.append(circulo(0, -212, 52, '#7A8F3E'))
    s.append(rosto(0, -212, e, 1.0, sobr='brava', boca='sorriso'))
    return ''.join(s)


def corpo_peixinho(e):
    return (folha(0, -10, 0, 330, 150, '#5E8C6A', pelos=True, nervura='#3E6B4A', larg_nervura=4) +
            rosto(0, -205, e, 1.0, sobr='normal', boca='sorriso', labios=True))


def corpo_maria(e):
    s = [forma([(-30, -4), (-36, -60), (-20, -120), (20, -120), (36, -60), (30, -4)], '#3E9B45')]
    s += [folha(0, -50, ang, comp, larg, '#3E9B45', nervura='#2A7A32')
          for ang, comp, larg in [(-55, 180, 70), (55, 180, 70), (-22, 230, 80), (22, 230, 80), (0, 200, 70)]]
    for (x0, y0), (x1, y1), cor, r in [((30, -200), (88, -300), '#E8743A', 12), ((30, -200), (104, -262), '#C0262D', 10),
                                       ((20, -200), (58, -326), '#C0262D', 9)]:
        s.append(linha([(x0, y0), (x1, y1)], '#3E8E3A', 3))
        s.append(circulo(x1, y1, r, cor, 2))
    ab = max(0.1, 1 - e.get('piscada', 0))
    for (x0, y0), (x1, y1) in [((-20, -200), (-56, -296)), ((0, -200), (-6, -308))]:
        s.append(linha([(x0, y0), (x1, y1)], CONTORNO, 7) + linha([(x0, y0), (x1, y1)], '#3E8E3A', 4))
        s.append(petalas(x1, y1, 10, 14, 14, 10, '#E8E06A', sw=1.5))
        s.append(f'<g transform="translate({x1},{y1}) scale(1,{ab:.2f})"><ellipse rx="10" ry="12" fill="#fff" stroke="{CONTORNO}" '
                 f'stroke-width="2"/><ellipse cx="0" cy="2" rx="5" ry="7" fill="#2E8BC0"/><circle cx="0" cy="2" r="2.5" fill="{CONTORNO}"/></g>')
    s.append(petalas(30, -232, 5, 10, 72, 54, '#E87FB0'))
    s.append(circulo(30, -232, 14, '#F5D63A', 2))
    if e.get('boca') == 'aberta':
        s.append(f'<ellipse cx="-34" cy="-250" rx="9" ry="11" fill="#6B1E1E" stroke="{CONTORNO}" stroke-width="2"/>')
    else:
        s.append(f'<path d="M-46,-252 Q-40,-258 -34,-254 Q-28,-258 -22,-252 Q-28,-244 -34,-245 Q-40,-244 -46,-252 Z" '
                 f'fill="#C8323C" stroke="{CONTORNO}" stroke-width="1.5"/>')
    return ''.join(s)


def corpo_beldroega(e):
    s = [camiseta('#E4E1DA', topo=-150, ombro=58, cint=46),
         f'<rect x="-50" y="-28" width="100" height="12" rx="5" fill="#A23B4A" stroke="{CONTORNO}" stroke-width="2"/>']
    for x, y, rx, ry, rot in [(-84, -120, 26, 40, -30), (88, -130, 26, 40, 30), (-98, -232, 28, 42, -60),
                              (98, -240, 28, 42, 60), (-44, -318, 26, 40, -20), (46, -322, 26, 40, 20), (0, -344, 24, 36, 0)]:
        s.append(elipse(x, y, rx, ry, '#4F7A3E', 2, rot))
        s.append(f'<line x1="{x}" y1="{y + ry * 0.7:.1f}" x2="{x}" y2="{y - ry * 0.7:.1f}" stroke="#2F5A26" stroke-width="1.5" '
                 f'transform="rotate({rot} {x} {y})"/>')
    s.append(petalas(0, -236, 8, 30, 44, 42, '#EADB8E'))
    s.append(circulo(0, -236, 38, '#5A3A2A'))
    s.append(forma([(-38, -244), (-32, -268), (0, -280), (32, -268), (38, -244), (0, -254)], '#1A1A1A'))
    s.append(rosto(0, -228, e, 0.85, sobr='nenhuma', boca='sorriso', nariz=False))
    return ''.join(s)


def corpo_ora(e):
    s = [folha(-10, -30, -100, 170, 80, '#1E8C3A', nervura='#14662A'), folha(10, -30, 100, 170, 80, '#1E8C3A', nervura='#14662A')]
    for ang in range(0, 360, 40):
        s.append(folha(0, -185, ang, 125, 58, '#FFFFFF', nervura='#E2E2E2'))
    for ang in range(20, 380, 40):
        s.append(folha(0, -185, ang, 95, 46, '#F7F7F7', nervura='#E2E2E2'))
    s.append(circulo(0, -185, 50, '#F2A2B8'))
    for i in range(12):
        a = TAU * i / 12
        s.append(circulo(56 * math.cos(a), -185 + 56 * math.sin(a), 6, '#F2D23A', 1.5))
    s.append(rosto(0, -185, e, 0.95, sobr='nenhuma', boca='sorriso', fechados=True))
    return ''.join(s)


def corpo_capuchinha(e):
    s = [camiseta('#F2DC6A', topo=-150, ombro=58, cint=46)]
    for x, y, r in [(-98, -222, 40), (-74, -112, 34), (96, -180, 38)]:
        s.append(linha([(0, -150), (x, y)], CONTORNO, 7) + linha([(0, -150), (x, y)], '#3A8B3A', 4))
        s.append(folha_redonda(x, y, r, '#3A9B3A'))
    s.append(petalas(0, -246, 5, 30, 62, 74, '#E9786A'))
    s.append(circulo(0, -246, 44, '#F5D84A'))
    s.append(rosto(0, -246, e, 1.0, sobr='alegre', boca='aberta'))
    return ''.join(s)


def corpo_bertalha(e):
    return (linha([(0, -6), (-10, -90), (4, -180)], CONTORNO, 15) + linha([(0, -6), (-10, -90), (4, -180)], '#4E8F7E', 10) +
            coracao(-62, -100, 50, '#6BAE9E', rot=-40, nervura='#3E7E6E') +
            coracao(62, -132, 50, '#6BAE9E', rot=40, nervura='#3E7E6E') +
            coracao(0, -228, 118, '#6BAE9E', nervura='#3E7E6E') +
            forma([(-62, -268), (-52, -310), (0, -334), (52, -310), (62, -268), (0, -284)], '#1F7FB0') +
            linha([(-30, -310), (0, -322), (24, -314)], '#7CC4EC', 4) +
            rosto(0, -238, e, 1.05, sobr='nenhuma', boca='aberta', oculos='#7B4A9E'))


def corpo_major(e):
    s = [camiseta('#E6E2DA', topo=-150, ombro=60, cint=48)]
    for y in (-118, -66):
        for sgn in (-1, 1):
            s.append(folha(sgn * 4, y, sgn * 82, 66, 34, '#1E9B3E', nervura='#127A2E'))
    s.append(forma([(-16, -150), (-14, -175), (14, -175), (16, -150)], '#8CC07A', 2))
    for (x1, y1), cor in [((-56, -300), '#E8E06A'), ((-26, -320), '#C2368A'), ((6, -330), '#E8E06A'),
                          ((36, -318), '#C2368A'), ((62, -296), '#E8E06A'), ((-70, -270), '#C2368A')]:
        s.append(linha([(0, -240), (x1 * 0.6, (y1 - 240) / 2 - 8), (x1, y1)], '#3E5A2E', 2.5))
        s.append(petalas(x1, y1, 5, 3, 9, 8, cor, sw=1.2))
    s.append(elipse(0, -210, 42, 48, '#D9C9A8'))
    s.append(rosto(0, -212, e, 0.9, sobr='brava', boca='reta', bigode=True))
    return ''.join(s)


def corpo_taioba(e):
    cabeca = [(0, -165), (-40, -190), (-62, -240), (-70, -300), (-50, -334), (-25, -300), (0, -262), (25, -300),
              (50, -334), (70, -300), (62, -240), (40, -190)]
    return (kimono('#E4E1DA', '#1A1A1A', topo=-150, ombro=60, cint=48) +
            forma(cabeca, '#5E9E2E') +
            linha([(0, -170), (0, -258)], '#3E7A1E', 3) + linha([(0, -258), (-48, -320)], '#3E7A1E', 2.5) +
            linha([(0, -258), (48, -320)], '#3E7A1E', 2.5) +
            rosto(0, -215, e, 1.0, sobr='brava', boca='reta'))


def corpo_jambu(e):
    return (kimono('#3558B5', '#1A1A1A', topo=-150, ombro=60, cint=48, lapela='#2A4590') +
            folha(-30, -70, -40, 110, 56, '#3E9B3A', dentes=5, nervura='#2A7A2A') +
            folha(30, -70, 40, 110, 56, '#3E9B3A', dentes=5, nervura='#2A7A2A') +
            petalas(0, -236, 12, 44, 40, 28, '#F5D63A') +
            circulo(56, -272, 12, '#A8323A', 2) + circulo(70, -262, 12, '#A8323A', 2) + circulo(64, -284, 12, '#A8323A', 2) +
            blob_ondulado(0, -236, 52, 52, 18, 4, '#E87A68') +
            rosto(0, -234, e, 0.95, sobr='alegre', boca='sorriso'))


def corpo_vinagreira(e):
    s = [folha(0, -170, ang, 160, 62, '#7BBF7B', dentes=6, nervura='#4E9A4E') for ang in (-100, -60, 60, 100)]
    s.append(camiseta('#E5C29F', topo=-150, ombro=58, cint=46, gola=False))
    s.append(linha([(-36, -112), (-16, -102), (-4, -110)], '#B88E6A', 2.5) + linha([(36, -112), (16, -102), (4, -110)], '#B88E6A', 2.5))
    s.append(forma([(-14, -146), (-10, -190), (10, -190), (14, -146)], '#7A3A2A', 2))
    s.append(forma([(0, -180), (-48, -205), (-58, -250), (-40, -300), (0, -348), (40, -300), (58, -250), (48, -205)], '#D3263A'))
    for x in (-30, 0, 30):
        s.append(linha([(x * 0.6, -190), (x, -250), (x * 0.4, -330)], '#A01828', 2.5))
    s.append(f'<path d="M-52,-284 Q0,-272 52,-284" fill="none" stroke="{CONTORNO}" stroke-width="12" stroke-linecap="round"/>'
             f'<path d="M-52,-284 Q0,-272 52,-284" fill="none" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/>'
             f'<path d="M-48,-282 Q-80,-300 -88,-270" fill="none" stroke="{CONTORNO}" stroke-width="9" stroke-linecap="round"/>'
             f'<path d="M-48,-282 Q-80,-300 -88,-270" fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round"/>')
    s.append(rosto(0, -240, e, 0.95, sobr='brava', boca='reta'))
    return ''.join(s)


def corpo_azedinha(e):
    s = [folha(0, -10, ang, comp, 110, '#6B9B2A', nervura='#4A7A1A', larg_nervura=3.5)
         for ang, comp in [(-42, 250), (42, 250), (-20, 300), (20, 300), (0, 330)]]
    s.append(rosto(0, -200, e, 1.0, sobr='nenhuma', boca='sorriso', labios=True, fechados=True))
    return ''.join(s)


def corpo_pequi(e):
    # saia de folhas serrilhadas descendo do cálice até o quadril
    s = [folha(0, -120, ang, comp, larg, '#3E9B3A', dentes=9, prof=0.14, nervura='#2B7A2A', larg_nervura=3)
         for ang, comp, larg in [(-118, 170, 120), (118, 170, 120), (-150, 150, 110), (150, 150, 110), (180, 150, 115)]]
    # cálice verde
    s.append(elipse(0, -128, 92, 44, '#2E9E5A'))
    s.append(f'<path d="M-84,-142 Q0,-112 84,-142" fill="none" stroke="#5CC27E" stroke-width="7" stroke-linecap="round"/>')
    # fruto aberto em três gomos, com os caroços amarelos
    gomos = [(-44, -196, 50), (44, -196, 50), (0, -236, 52), (0, -176, 60)]
    contorno = ''.join(f'<circle cx="{x}" cy="{y}" r="{r + 2.5}" fill="{CONTORNO}"/>' for x, y, r in gomos)
    miolo = ''.join(f'<circle cx="{x}" cy="{y}" r="{r}" fill="#C9A464"/>' for x, y, r in gomos)
    s.append(contorno + miolo)
    for x, y, r in [(-40, -196, 30), (40, -196, 30), (0, -170, 32)]:
        s.append(circulo(x, y, r, '#E6D44C'))
        s.append(f'<ellipse cx="{x - 9}" cy="{y - 11}" rx="9" ry="5" fill="#F6EC9A" transform="rotate(-30 {x - 9} {y - 11})"/>')
    s.append(rosto(0, -246, e, 0.8, sobr='nenhuma', boca='sorriso', fechados=True, nariz=False))
    return ''.join(s)


def personagem(nome, esporte, corpo, pele='#E5C29F', ombros=(60, -150), quadris=24, braco=(55, 50, 22), perna=(58, 58, 26),
               shorts=None, **kw):
    ch = dict(nome=nome, esporte=esporte, corpo=corpo, pele=pele, braco=braco, perna=perna,
              ombros=((-ombros[0], ombros[1]), (ombros[0], ombros[1])), quadris=((-quadris, 0), (quadris, 0)))
    if shorts:
        ch['cintura'] = shorts
        ch['calca'] = (shorts, 0.34, 12)
    ch.update(kw)
    return ch


PELE_CLARA, PELE_MEDIA, PELE_ESCURA = '#E8C4A6', '#DDB48A', '#7B3A1C'
GI_BRANCO = ('#E4E1DA', 1.0, 12)

PERSONAGENS = {
    1: personagem('couve', 'Jiu-Jitsu', corpo_couve, PELE_CLARA, ombros=(96, -130), calca=('#1E90D6', 1.0, 12),
                  manga=('#1E90D6', 0.8, 8)),
    3: personagem('alface', 'Basquete', corpo_alface, PELE_MEDIA, ombros=(56, -130), shorts='#D6D2C8', sapato='#3A3A3A',
                  meia=BRANCO, lado=-1),
    5: personagem('abobrinha', 'Natação', corpo_abobrinha, PELE_MEDIA, ombros=(48, -175)),
    7: personagem('chicoria', 'Capoeira', corpo_chicoria, '#D9B48C', ombros=(56, -135), calca=GI_BRANCO,
                  manga=('#E4E1DA', 0.3, 8)),
    9: personagem('rucula', 'Futebol', corpo_rucula, PELE_MEDIA, ombros=(56, -140), shorts='#1F1F1F', sapato='#1F1F1F',
                  meia=BRANCO, manga=('#D0312D', 0.3, 8), lado=-1),
    11: personagem('brocolis', 'Handebol', corpo_brocolis, PELE_MEDIA, ombros=(56, -130), shorts='#E2DED6', sapato='#5A6266',
                   meia=BRANCO, manga=('#1E8C45', 0.25, 8), lado=-1),
    13: personagem('cebolinha', 'Zumba', corpo_cebolinha, '#D4AF86', ombros=(38, -130), shorts='#E3DFD5', sapato='#4A4A4A',
                   topo=-372),
    15: personagem('quiabo', 'Vôlei', corpo_quiabo, PELE_MEDIA, ombros=(50, -185), pele_perna='#5E9E5A', sapato='#C9A0A6',
                   lado=-1, topo=-380),
    17: personagem('espinafre', 'Yoga', corpo_espinafre, PELE_CLARA, ombros=(56, -130), calca=('#1E88C8', 1.0, 8),
                   manga=('#1E88C8', 0.85, 6), topo=-390),
    21: personagem('tomate', 'Musculação', corpo_tomate, PELE_CLARA, ombros=(96, -200), braco=(55, 50, 30), shorts='#2A2A2A',
                   topo=-300),
    23: personagem('agriao', 'Muay Thai', corpo_agriao, PELE_MEDIA, ombros=(60, -170), shorts='#C62828', luvas=BRANCO,
                   faixas=True, lado=-1),
    25: personagem('repolho', 'Kickboxing', corpo_repolho, PELE_ESCURA, ombros=(58, -135), shorts='#1F5C8A', faixas=True,
                   lado=-1),
    27: personagem('pepino', 'Funcional', corpo_pepino, PELE_MEDIA, ombros=(8, -235), quadris=8, shorts='#E07A2E',
                   sapato='#4A4A4A', lado=1),
    29: personagem('salsa', 'Judô', corpo_salsa, PELE_CLARA, ombros=(60, -135), calca=GI_BRANCO, manga=('#E4E1DA', 0.8, 8)),
    31: personagem('chuchu', 'Pilates', corpo_chuchu, PELE_CLARA, ombros=(70, -150), calca=('#A27FC8', 0.95, 6),
                   sapato='#F2F2F2', lado=1, meia_largura=118),
    33: personagem('caruru', 'Funcional', corpo_caruru, '#E8C29E', ombros=(8, -150), quadris=8, calca=('#B14A4A', 1.0, 8),
                   manga=('#E8894A', 0.3, 8), sapato='#4A4A4A', lado=-1, topo=-370),
    35: personagem('serralha', 'Boxe', corpo_serralha, PELE_CLARA, ombros=(84, -140), shorts='#2B6CB0', luvas=BRANCO),
    37: personagem('dente-de-leao', 'Basquete', corpo_dente, PELE_MEDIA, ombros=(56, -150), shorts='#E5E1D8',
                   sapato='#3A3A3A', meia=BRANCO, lado=1, topo=-370),
    39: personagem('almeirao-roxo', 'Futebol', corpo_almeirao, PELE_MEDIA, ombros=(56, -135), shorts='#5B2D82',
                   sapato='#1F1F1F', meia=BRANCO, manga=('#F2E35A', 0.28, 8), lado=1, topo=-360),
    41: personagem('peixinho-da-horta', 'Zumba', corpo_peixinho, PELE_CLARA, ombros=(46, -150), shorts='#E2DED6'),
    43: personagem('maria-gorda', 'Kickboxing', corpo_maria, PELE_CLARA, ombros=(54, -140), shorts='#C0262D', faixas=True,
                   lado=1),
    45: personagem('beldroega', 'Capoeira', corpo_beldroega, '#5A3A2A', ombros=(56, -135), calca=GI_BRANCO,
                   manga=('#E4E1DA', 0.3, 8)),
    47: personagem('ora-pro-nobis', 'Musculação', corpo_ora, PELE_CLARA, ombros=(66, -150), shorts='#1E8C3A', halteres=True,
                   topo=-310),
    49: personagem('capuchinha', 'Vôlei', corpo_capuchinha, PELE_CLARA, ombros=(56, -135), shorts='#2E8BC0',
                   sapato='#C98A8A', manga=('#F2DC6A', 0.28, 8), lado=1),
    51: personagem('bertalha', 'Natação', corpo_bertalha, '#D9B48C', ombros=(40, -185), pele_perna='#4E8F7E'),
    53: personagem('major-gomes', 'Handebol', corpo_major, PELE_MEDIA, ombros=(58, -135), shorts='#CFCFCF', sapato='#5A6266',
                   meia=BRANCO, manga=('#E6E2DA', 0.28, 8), lado=1),
    55: personagem('taioba', 'Judô', corpo_taioba, PELE_CLARA, ombros=(60, -135), calca=GI_BRANCO, manga=('#E4E1DA', 0.8, 8)),
    57: personagem('jambu', 'Jiu-Jitsu', corpo_jambu, PELE_CLARA, ombros=(60, -135), calca=('#3558B5', 1.0, 12),
                   manga=('#3558B5', 0.8, 8)),
    59: personagem('vinagreira', 'Muay Thai', corpo_vinagreira, PELE_CLARA, ombros=(56, -135), shorts='#2E9BD6',
                   luvas=BRANCO, faixas=True, lado=1),
    61: personagem('azedinha', 'Pilates', corpo_azedinha, PELE_CLARA, ombros=(50, -150), calca=('#A27FC8', 0.95, 6),
                   sapato='#F2F2F2', lado=-1, meia_largura=70),
    63: personagem('pequi', 'Yoga', corpo_pequi, PELE_CLARA, ombros=(62, -150), calca=('#7A4A9E', 1.0, 6),
                   manga=('#E79AC0', 0.85, 6), sapato='#2E8BC0', topo=-350, bracos_frente=True),
}


# ---------- montagem ----------

def desenhar(ch, pose, t, fundo=True):
    rot = pose['rot']
    J = juntas(ch, pose)
    e = dict(boca=pose.get('boca'), olhos=pose.get('olhos'),
             piscada=pose.get('piscada') or (1.0 if 0.90 < t < 0.935 else 0.0))
    s = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{L}" height="{A}" viewBox="0 0 {L} {A}">']
    if fundo:
        s.append(f'<rect width="{L}" height="{A}" fill="#FFFFFF"/>')
    s.append(pose.get('antes', ''))
    if pose.get('sombra', True):
        altura = max(0.0, -pose['y'])
        s.append(sombra(BASE[0] + pose['x'], 100 * (1 - min(0.5, altura / 300))))
    s.append(f'<g transform="translate({BASE[0] + pose["x"]:.1f},{BASE[1] + pose["y"]:.1f}) rotate({rot:.2f}) '
             f'scale({pose["sx"]:.3f},{pose["sy"]:.3f})">')
    membros = {n: desenhar_membro(ch, n, J[n], pose[n][1] + rot) for n in MEMBROS}
    frente = ('be', 'bd') if ch.get('bracos_frente') else pose.get('frente') or ()
    s += [membros[n] for n in ('be', 'bd') if n not in frente]
    s += [membros['pe'], membros['pd']]
    if ch.get('cintura'):
        w = ch['quadris'][1][0] + ch['perna'][2] / 2 + 10
        s.append(f'<rect x="{-w}" y="-18" width="{2 * w}" height="36" rx="9" fill="{ch["cintura"]}" stroke="{CONTORNO}" stroke-width="2.5"/>')
    s.append(ch['corpo'](e))
    s += [membros[n] for n in ('be', 'bd') if n in frente]
    s.append('</g>')
    s.append(pose.get('depois', ''))
    s.append('</svg>')
    return ''.join(s)


def gerar(arquivo, ch):
    nome = f'{arquivo}-{ch["nome"]}'
    esporte = ESPORTES[ch['esporte']]
    with open(os.path.join(SAIDA, nome + '.svg'), 'w') as f:
        f.write(desenhar(ch, dict(POSE_BASE), 0, fundo=False))
    tmp = tempfile.mkdtemp()
    try:
        def render(i):
            t = i / N_QUADROS
            svg, png = os.path.join(tmp, f'q{i:03d}.svg'), os.path.join(tmp, f'q{i:03d}.png')
            with open(svg, 'w') as f:
                f.write(desenhar(ch, esporte(t, ch), t))
            subprocess.run(['magick', '-density', '144', svg, '-resize', f'{LARGURA_GIF}x', png], check=True)
            return png

        with ThreadPoolExecutor(os.cpu_count()) as ex:
            pngs = list(ex.map(render, range(N_QUADROS)))
        gif = os.path.join(SAIDA, nome + '.gif')
        subprocess.run(['magick', '-delay', str(ATRASO), '-loop', '0', *pngs, '-fuzz', '2%', '+dither', '-colors', '64',
                        '-layers', 'Optimize', gif], check=True)
        print(f'{nome}: {os.path.getsize(gif) // 1024} KB')
    finally:
        shutil.rmtree(tmp)


def main():
    os.makedirs(SAIDA, exist_ok=True)
    escolhidas = [int(a) for a in sys.argv[1:]] or sorted(PERSONAGENS)
    for arquivo in escolhidas:
        gerar(arquivo, PERSONAGENS[arquivo])


if __name__ == '__main__':
    main()
