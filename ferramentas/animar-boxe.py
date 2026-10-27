#!/usr/bin/env python3
"""Gera o Pimentão (carta 19, Boxe) vetorizado em SVG e um GIF dele dando socos.

Uso: python3 ferramentas/animar-boxe.py
Saída: img/animacoes/19-pimentao.svg e img/animacoes/19-pimentao.gif
Requer: ImageMagick (com librsvg).
"""
import math
import os
import shutil
import subprocess
import tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAIDA = os.path.join(RAIZ, 'img', 'animacoes')

L, A = 780, 470          # tamanho do quadro
DX, DY = 160, 30          # deslocamento do desenho original dentro do quadro

VERMELHO = '#E8301F'
VERMELHO_ESC = '#C42415'
VERDE = '#2E8B4E'
PELE = '#E9C6A8'
LUVA = '#FFFFFF'
CONTORNO = '#1A1A1A'


def p(x, y):
    return x + DX, y + DY


# ---------- partes ----------

def caule():
    return f'''
  <path d="M{p(232,92)[0]},{p(232,92)[1]} C{p(228,60)[0]},{p(228,60)[1]} {p(236,30)[0]},{p(236,30)[1]} {p(262,18)[0]},{p(262,18)[1]}
           L{p(272,30)[0]},{p(272,30)[1]} C{p(252,42)[0]},{p(252,42)[1]} {p(248,66)[0]},{p(248,66)[1]} {p(252,92)[0]},{p(252,92)[1]} Z"
        fill="{VERDE}" stroke="{CONTORNO}" stroke-width="2.5" stroke-linejoin="round"/>
  <path d="M{p(178,108)[0]},{p(178,108)[1]} Q{p(205,80)[0]},{p(205,80)[1]} {p(242,84)[0]},{p(242,84)[1]}
           Q{p(282,80)[0]},{p(282,80)[1]} {p(300,106)[0]},{p(300,106)[1]}
           Q{p(242,118)[0]},{p(242,118)[1]} {p(178,108)[0]},{p(178,108)[1]} Z"
        fill="{VERDE}" stroke="{CONTORNO}" stroke-width="2.5" stroke-linejoin="round"/>'''


def elipse(cx, cy, rx, ry, cor=VERMELHO, sw=2.5):
    x, y = p(cx, cy)
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="{cor}" stroke="{CONTORNO}" stroke-width="{sw}"/>'


def corpo():
    # gomos de trás para frente; o contorno de cada gomo vira a linha interna do pimentão
    return '\n  '.join([
        elipse(168, 140, 56, 50),
        elipse(290, 132, 62, 48),
        elipse(150, 262, 50, 120),
        elipse(296, 255, 52, 126),
        elipse(225, 132, 58, 34),
        elipse(222, 264, 76, 124),
    ])


def rosto(piscada=0.0):
    ex, ey = p(0, 0)
    # piscada: 0 = aberto, 1 = fechado
    ab = max(0.08, 1 - piscada)
    return f'''
  <g transform="translate({ex},{ey})">
    <!-- olho esquerdo -->
    <g transform="translate(178,192) scale(1,{ab:.2f})">
      <path d="M-20,-4 Q0,-14 18,2 Q2,12 -20,-4 Z" fill="#fff" stroke="{CONTORNO}" stroke-width="2"/>
      <ellipse cx="4" cy="1" rx="5" ry="7" fill="{CONTORNO}"/>
    </g>
    <path d="M154,172 L196,190" stroke="{CONTORNO}" stroke-width="3.5" stroke-linecap="round"/>
    <!-- olho direito -->
    <g transform="translate(244,186) scale(1,{ab:.2f})">
      <path d="M-18,0 Q-2,-12 20,-6 Q4,10 -18,0 Z" fill="#fff" stroke="{CONTORNO}" stroke-width="2"/>
      <ellipse cx="-4" cy="0" rx="5" ry="7" fill="{CONTORNO}"/>
    </g>
    <path d="M224,180 L262,170" stroke="{CONTORNO}" stroke-width="3.5" stroke-linecap="round"/>
    <!-- nariz e boca -->
    <path d="M198,218 Q205,226 212,218" fill="none" stroke="{CONTORNO}" stroke-width="2"/>
    <path d="M200,242 Q212,248 224,240" fill="none" stroke="{CONTORNO}" stroke-width="2.2" stroke-linecap="round"/>
    <!-- bochecha estufada -->
    <path d="M226,226 Q252,224 250,248 Q246,262 228,254" fill="none" stroke="{CONTORNO}" stroke-width="2"/>
  </g>'''


def braco(ombro, cotovelo, punho, escala_luva=1.0, lado=1):
    """Braço de duas partes (bíceps + antebraço) com luva de boxe no punho."""
    o, c, w = p(*ombro), p(*cotovelo), p(*punho)
    trajeto = f'M{o[0]:.1f},{o[1]:.1f} L{c[0]:.1f},{c[1]:.1f} L{w[0]:.1f},{w[1]:.1f}'
    # músculo do bíceps: elipse no meio do braço, deslocada para fora
    mx, my = (o[0] + c[0]) / 2, (o[1] + c[1]) / 2
    ang = math.degrees(math.atan2(c[1] - o[1], c[0] - o[0]))
    comp = math.hypot(c[0] - o[0], c[1] - o[1])
    biceps = (f'<g transform="translate({mx:.1f},{my:.1f}) rotate({ang:.1f})">'
              f'<ellipse cx="0" cy="{-6 * lado}" rx="{comp * 0.5:.1f}" ry="31" fill="{PELE}" stroke="{CONTORNO}" stroke-width="2"/></g>')
    # luva aponta na direção do antebraço
    ang_l = math.degrees(math.atan2(w[1] - c[1], w[0] - c[0]))
    s = escala_luva
    luva = f'''<g transform="translate({w[0]:.1f},{w[1]:.1f}) rotate({ang_l:.1f}) scale({s:.2f})">
      <rect x="-10" y="-17" width="22" height="34" rx="3" fill="{LUVA}" stroke="{CONTORNO}" stroke-width="1.8"/>
      <rect x="-5" y="-7" width="7" height="12" fill="none" stroke="{CONTORNO}" stroke-width="1.2"/>
      <circle cx="30" cy="0" r="26" fill="{LUVA}" stroke="{CONTORNO}" stroke-width="2"/>
      <ellipse cx="22" cy="{14 * lado}" rx="13" ry="9" fill="{LUVA}" stroke="{CONTORNO}" stroke-width="1.8"/>
      <path d="M38,-14 Q46,-6 44,6" fill="none" stroke="#9a9a9a" stroke-width="1.5"/>
    </g>'''
    return f'''
  <g>
    <path d="{trajeto}" fill="none" stroke="{CONTORNO}" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="{trajeto}" fill="none" stroke="{PELE}" stroke-width="36" stroke-linecap="round" stroke-linejoin="round"/>
    {biceps}
    {luva}
  </g>'''


def pow_(x, y, escala=1.0, texto='POW!'):
    x, y = p(x, y)
    pts = []
    for i in range(16):
        r = 58 if i % 2 == 0 else 34
        a = math.pi * 2 * i / 16
        pts.append(f'{r * math.cos(a):.1f},{r * math.sin(a):.1f}')
    return f'''
  <g transform="translate({x:.1f},{y:.1f}) scale({escala:.2f})">
    <polygon points="{' '.join(pts)}" fill="#FFD84A" stroke="{CONTORNO}" stroke-width="2.5" stroke-linejoin="round"/>
    <text x="0" y="7" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-weight="900"
          font-size="19" fill="{VERMELHO_ESC}" stroke="{CONTORNO}" stroke-width="0.8">{texto}</text>
  </g>'''


def tracos_velocidade(x, y, direcao, forca):
    if forca <= 0:
        return ''
    x, y = p(x, y)
    linhas = []
    for dy, comp in ((-34, 50), (-26, 70), (30, 60), (40, 40)):
        x0 = x - direcao * 40
        x1 = x0 - direcao * comp * forca
        linhas.append(f'<line x1="{x0:.1f}" y1="{y + dy:.1f}" x2="{x1:.1f}" y2="{y + dy:.1f}" '
                      f'stroke="{CONTORNO}" stroke-width="3" stroke-linecap="round" opacity="{0.7 * forca:.2f}"/>')
    return '\n  '.join(linhas)


# ---------- poses ----------

# guarda (pose da carta)
ESQ_GUARDA = dict(ombro=(130, 225), cotovelo=(52, 282), punho=(140, 296))
DIR_GUARDA = dict(ombro=(300, 252), cotovelo=(372, 300), punho=(392, 176))
# soco esticado
ESQ_SOCO = dict(ombro=(130, 225), cotovelo=(45, 222), punho=(-30, 214))
DIR_SOCO = dict(ombro=(300, 236), cotovelo=(392, 226), punho=(470, 210))


def lerp(a, b, t):
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(len(a)))


def pose(guarda, soco, t):
    return {k: lerp(guarda[k], soco[k], t) for k in guarda}


def quadro(t_esq=0.0, t_dir=0.0, piscada=0.0, pulo=0.0, fundo=True):
    """t_esq/t_dir: 0 = guarda, 1 = soco totalmente esticado."""
    inclina = (-7 * t_esq + 7 * t_dir)
    desliza = (-14 * t_esq + 14 * t_dir)
    cx, cy = p(222, 300)
    esq = pose(ESQ_GUARDA, ESQ_SOCO, t_esq)
    dir_ = pose(DIR_GUARDA, DIR_SOCO, t_dir)
    partes = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{L}" height="{A}" viewBox="0 0 {L} {A}">',
        f'<rect width="{L}" height="{A}" fill="#FFFFFF"/>' if fundo else '',
        # sombra no chão
        f'<ellipse cx="{p(222, 412)[0] + desliza:.1f}" cy="{p(222, 412)[1]}" rx="{120 - pulo * 1.5:.1f}" ry="12" fill="#000" opacity="0.12"/>',
        f'<g transform="translate({desliza:.1f},{-pulo:.1f}) rotate({inclina:.1f} {cx} {cy})">',
        braco(**esq, escala_luva=1 + 0.25 * t_esq, lado=-1),
        braco(**dir_, escala_luva=1 + 0.25 * t_dir, lado=1),
        caule(),
        corpo(),
        rosto(piscada),
        '</g>',
    ]
    # na guarda o antebraço esquerdo cruza na frente do corpo: redesenha a luva por cima
    if t_esq < 0.35:
        partes.insert(-1, _so_luva(esq, -1))
    if t_esq > 0.85:
        partes.append(tracos_velocidade(esq['punho'][0] - 40, esq['punho'][1], -1, (t_esq - 0.85) / 0.15))
        partes.append(pow_(esq['punho'][0] - 95, esq['punho'][1] - 25, 0.7 + 0.5 * (t_esq - 0.85) / 0.15))
    if t_dir > 0.85:
        partes.append(tracos_velocidade(dir_['punho'][0] + 40, dir_['punho'][1], 1, (t_dir - 0.85) / 0.15))
        partes.append(pow_(dir_['punho'][0] + 95, dir_['punho'][1] - 25, 0.7 + 0.5 * (t_dir - 0.85) / 0.15, 'BAM!'))
    partes.append('</svg>')
    return '\n'.join(x for x in partes if x)


def _so_luva(esq, lado):
    """Antebraço + luva esquerdos desenhados à frente do corpo (como na carta)."""
    c, w = p(*esq['cotovelo']), p(*esq['punho'])
    # só o trecho final do antebraço, para não cobrir o rosto
    mx, my = c[0] + (w[0] - c[0]) * 0.55, c[1] + (w[1] - c[1]) * 0.55
    trajeto = f'M{mx:.1f},{my:.1f} L{w[0]:.1f},{w[1]:.1f}'
    ang_l = math.degrees(math.atan2(w[1] - c[1], w[0] - c[0]))
    return f'''
  <path d="{trajeto}" fill="none" stroke="{CONTORNO}" stroke-width="40" stroke-linecap="butt"/>
  <path d="{trajeto}" fill="none" stroke="{PELE}" stroke-width="36" stroke-linecap="butt"/>
  <g transform="translate({w[0]:.1f},{w[1]:.1f}) rotate({ang_l:.1f})">
    <rect x="-10" y="-17" width="22" height="34" rx="3" fill="{LUVA}" stroke="{CONTORNO}" stroke-width="1.8"/>
    <rect x="-5" y="-7" width="7" height="12" fill="none" stroke="{CONTORNO}" stroke-width="1.2"/>
    <circle cx="30" cy="0" r="26" fill="{LUVA}" stroke="{CONTORNO}" stroke-width="2"/>
    <ellipse cx="22" cy="{14 * lado}" rx="13" ry="9" fill="{LUVA}" stroke="{CONTORNO}" stroke-width="1.8"/>
  </g>'''


# ---------- roteiro ----------

def soco(n_ida=3, n_pausa=3, n_volta=5):
    """Curva 0→1→0: ida rápida, segura no impacto, volta suave."""
    ida = [1 - (1 - (i + 1) / n_ida) ** 2 for i in range(n_ida)]
    pausa = [1.0] * n_pausa
    volta = [1 - ((i + 1) / n_volta) ** 0.8 for i in range(n_volta)]
    return ida + pausa + volta


def roteiro():
    q = []
    # gingado na guarda
    for i in range(8):
        q.append(dict(pulo=6 * abs(math.sin(i / 8 * math.pi * 2))))
    for t in soco():
        q.append(dict(t_esq=t))
    for i in range(4):
        q.append(dict(pulo=6 * abs(math.sin(i / 4 * math.pi))))
    for t in soco():
        q.append(dict(t_dir=t))
    # combo 1-2
    for t in soco(3, 1, 3):
        q.append(dict(t_esq=t))
    for t in soco(3, 4, 5):
        q.append(dict(t_dir=t))
    # gingado + piscada
    for i in range(10):
        q.append(dict(pulo=6 * abs(math.sin(i / 10 * math.pi * 2)), piscada=1.0 if i in (4, 5) else 0.0))
    return q


def main():
    os.makedirs(SAIDA, exist_ok=True)
    with open(os.path.join(SAIDA, '19-pimentao.svg'), 'w') as f:
        f.write(quadro(fundo=False))

    tmp = tempfile.mkdtemp()
    try:
        pngs = []
        for i, params in enumerate(roteiro()):
            svg = os.path.join(tmp, f'q{i:03d}.svg')
            png = os.path.join(tmp, f'q{i:03d}.png')
            with open(svg, 'w') as f:
                f.write(quadro(**params))
            subprocess.run(['magick', '-density', '144', svg, '-resize', f'{L}x{A}', png], check=True)
            pngs.append(png)
        gif = os.path.join(SAIDA, '19-pimentao.gif')
        subprocess.run(['magick', '-delay', '5', '-loop', '0', *pngs, '-resize', '520x',
                        '-fuzz', '2%', '+dither', '-colors', '48', '-layers', 'Optimize', gif], check=True)
        print(f'{len(pngs)} quadros → {gif}')
    finally:
        shutil.rmtree(tmp)


if __name__ == '__main__':
    main()
