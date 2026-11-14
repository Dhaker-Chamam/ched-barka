"""The astronaut. Same size, pivots and part names as buildAstronaut() in js/actors.js:
body (torso + pack + helmet), armL/armR pivot at (+-0.58, 1.48, 0), legL/legR pivot at (+-0.22, 0.74, 0),
drill at (0, 0.95, 0.7). The game scales the whole thing by 0.84.
The suit fabric uses the tintable 'Suit' material so the player's suit colour still works."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *

SUIT = 0xFFFFFF; SUIT_D = 0xC9CDD3          # white vertex colour x light-grey 'Suit' tint
GREY_M = 0xA8AEB6                            # pack, pouches
GLOVE = 0xC3C8CF; BLUEGREY = 0x5E7C8C
ROLL = 0x707782; BOOT = 0x4F545C; SOLE = 0xC9CDD2; HELMET = 0xC5CAD1


AO = (0.0, 2.7)
HY = 2.02


def build():
    coll = collection('A_astronaut')
    root = empty('Astronaut', coll)
    sk = dict(mat='Suit', smooth=True, jit=0, fjit=0.012)

    # ------------------------------------------------ body
    b = Part('astro_body', 1)
    torso = [(0.0, 0.40), (0.26, 0.42), (0.42, 0.54), (0.47, 0.76), (0.455, 1.0), (0.465, 1.24), (0.44, 1.44), (0.35, 1.6), (0.26, 1.68), (0.0, 1.70)]
    b.add(g_lathe(torso, 18), SUIT, SC(1.0, 1.0, 0.86), **sk)
    b.add(g_torus(0.466, 0.014, 18, 4), SUIT_D, T(0, 1.02, 0) @ SC(1, 1, 0.86), mat='Suit', smooth=True)          # waist seam
    # belt, buckle, hip pouches
    b.add(g_torus(0.462, 0.055, 18, 6), STRAP, T(0, 0.74, 0) @ SC(1, 1, 0.86), smooth=True)
    b.box(0.17, 0.14, 0.05, CHROME, at=(0, 0.74, 0.435), bevel=0.018, mat='Metal')
    b.box(0.09, 0.07, 0.06, STRAP_D, at=(0, 0.74, 0.44), bevel=0.01)
    for sx in (-1, 1):
        b.box(0.18, 0.21, 0.12, GREY_M, at=(sx * 0.405, 0.69, 0.2), rot=(0, sx * 1.0, 0), bevel=0.03)
        b.box(0.19, 0.07, 0.13, STRAP, at=(sx * 0.405, 0.775, 0.2), rot=(0, sx * 1.0, 0), bevel=0.014)
        b.box(0.035, 0.035, 0.03, CHROME, at=(sx * 0.46, 0.75, 0.235), rot=(0, sx * 1.0, 0), mat='Metal')
    # chest control box
    b.box(0.44, 0.28, 0.14, TIN, at=(0, 1.2, 0.415), bevel=0.035, mat='Metal')
    b.box(0.36, 0.2, 0.02, DARK, at=(0, 1.2, 0.487))
    for i, c in enumerate((0xE0503C, LIGHT, BLUEGREY)):
        b.add(g_cyl(0.034, 0.028, 0.045, 8), c, T(-0.11 + i * 0.11, 1.145, 0.49) @ RX(PI / 2), jit=0)
    b.add(g_cyl(0.062, 0.062, 0.03, 10), CHROME, T(-0.09, 1.245, 0.49) @ RX(PI / 2), mat='Metal')
    b.add(g_cyl(0.048, 0.048, 0.034, 10), LIGHT, T(-0.09, 1.245, 0.49) @ RX(PI / 2), jit=0)
    b.box(0.15, 0.045, 0.02, 0, at=(0.085, 1.25, 0.5), mat='Glow_Green')
    for sx in (-1, 1):                                                                       # hoses from the box to the pack
        b.add(g_tube([(sx * 0.2, 1.1, 0.44), (sx * 0.36, 1.02, 0.34), (sx * 0.47, 1.0, 0.1), (sx * 0.44, 1.02, -0.2), (sx * 0.34, 1.05, -0.4)], 0.032, 6),
              0x4F5560, smooth=True)
    # harness straps over the shoulders
    for sx in (-1, 1):
        pts = [(sx * .2, .8, .395), (sx * .21, 1.1, .388), (sx * .23, 1.4, .362), (sx * .25, 1.6, .24), (sx * .25, 1.715, 0.0), (sx * .24, 1.58, -.27), (sx * .22, 1.4, -.37)]
        b.add(g_tube(pts, 0.042, 5), STRAP, smooth=True)
        b.box(0.07, 0.07, 0.04, CHROME, at=(sx * .225, 1.36, .385), mat='Metal', bevel=0.012)
    # mission patch on the left chest
    Mp = T(-0.232, 1.47, 0.318) @ RY(-0.6) @ RX(PI / 2 - 0.22)
    b.add(g_cyl(0.09, 0.09, 0.014, 12), LIGHT, Mp, jit=0)
    b.add(g_cyl(0.058, 0.058, 0.02, 10), BLUEGREY, Mp, jit=0)
    b.add(g_cyl(0.024, 0.024, 0.026, 6), CHROME, Mp @ T(0.018, 0, -0.012), jit=0)
    # backpack: life-support pack on a steel frame, rolled pad, two steel tanks
    b.box(0.64, 0.84, 0.34, GREY_M, at=(0, 1.2, -0.46), bevel=0.07)
    for sx in (-1, 1):
        b.box(0.065, 1.04, 0.075, FRAME, at=(sx * 0.3, 1.22, -0.635), bevel=0.014)
        b.add(g_cyl(0.1, 0.1, 0.62, 9, bevel=0.035), STEEL, T(sx * 0.42, 0.9, -0.47), mat='Metal', smooth=True)
        b.add(g_cyl(0.04, 0.03, 0.06, 6), CHROME, T(sx * 0.42, 1.52, -0.47), mat='Metal')
        b.add(g_torus(0.104, 0.016, 9, 4), STRAP_D, T(sx * 0.42, 1.2, -0.47))
    b.box(0.66, 0.065, 0.075, FRAME, at=(0, 0.84, -0.635), bevel=0.014)
    b.box(0.66, 0.065, 0.075, FRAME, at=(0, 1.56, -0.635), bevel=0.014)
    b.box(0.5, 0.3, 0.05, LIGHT, at=(0, 1.36, -0.645), bevel=0.02)                                   # flap
    b.box(0.05, 0.12, 0.03, STRAP, at=(-0.13, 1.25, -0.672)); b.box(0.05, 0.12, 0.03, STRAP, at=(0.13, 1.25, -0.672))
    b.box(0.36, 0.24, 0.09, shade(GREY_M, 0.86), at=(0, 1.02, -0.66), bevel=0.03)                        # pocket
    b.box(0.13, 0.07, 0.03, 0, at=(0.2, 1.56, -0.685), mat='Glow_Green')                             # status light
    b.add(g_cyl(0.165, 0.165, 0.8, 10, bevel=0.035), ROLL, T(-0.4, 1.8, -0.45) @ RZ(-PI / 2), mat='Cloth', smooth=True)   # bedroll
    for x in (-0.22, 0.22):
        b.add(g_torus(0.17, 0.022, 10, 4), STRAP_D, T(x, 1.8, -0.45) @ RZ(PI / 2))
    b.add(g_cyl(0.035, 0.03, 0.08, 6), TIN, T(0.26, 1.6, -0.52), mat='Metal')
    b.add(g_tube([(0.26, 1.66, -0.52), (0.262, 1.95, -0.505), (0.26, 2.14, -0.5)], 0.013, 4), TIN, mat='Metal')
    # collar
    b.add(g_torus(0.365, 0.08, 18, 7), STEEL, T(0, 1.655, 0), mat='Metal', smooth=True, jit=0)
    b.rivets(0.436, 1.655, 10, 0.024, CHROME, az0=PI / 10)
    # helmet shell
    b.add(g_sphere(0.52, 20, 12), HELMET, T(0, HY, 0), mat='Metal', smooth=True, jit=0, fjit=0.012)
    b.add(g_lathe([(0.235, 2.47), (0.21, 2.52), (0.11, 2.555), (0.06, 2.59), (0.065, 2.64), (0.0, 2.655)], 10), STEEL, mat='Metal', smooth=True)
    b.add(g_torus(0.526, 0.018, 24, 4), STEEL_D, T(0, HY, 0) @ RZ(PI / 2), mat='Metal', smooth=True, jit=0)            # seam running over the top, side to side
    # visor: glass bulge + frame that follows where the bulge leaves the shell
    b.add(g_sphere(0.42, 18, 6, t0=PI / 2, t1=PI), 0, T(0, HY, 0.21) @ SC(1, 0.78, 0.92) @ RX(PI / 2), mat='Visor', smooth=True)
    loop = []
    for i in range(25):
        th = TAU * i / 24
        loop.append((0.4 * math.cos(th), HY + 0.258 * math.sin(th), 0.345 + 0.118 * math.sin(th) ** 2))
    b.add(g_tube(loop, 0.043, 6, caps=False), STEEL, mat='Metal', smooth=True, jit=0)
    for i in range(12):
        th = TAU * (i + 0.5) / 12
        pos = Vector((0.4 * math.cos(th), HY + 0.258 * math.sin(th), 0.345 + 0.118 * math.sin(th) ** 2))
        nrm = (pos - Vector((0, HY, 0.1))).normalized()
        b.add(g_lathe([(0.02, 0), (0.014, 0.012), (0, 0.018)], 5), CHROME, T(*(pos + nrm * 0.04)) @ ALIGN(nrm), mat='Metal', jit=0)
    # ear caps, lamp, chin vent
    for sx in (-1, 1):
        b.add(g_cyl(0.18, 0.15, 0.075, 10), STEEL, T(sx * 0.485, HY, 0) @ RZ(-sx * PI / 2), mat='Metal')
        b.add(g_cyl(0.07, 0.06, 0.03, 8), CHROME, T(sx * 0.56, HY, 0) @ RZ(-sx * PI / 2), mat='Metal')
    b.box(0.07, 0.07, 0.1, STEEL_D, at=(0.345, 2.33, 0.2), mat='Metal')
    b.add(g_cyl(0.085, 0.07, 0.15, 8), STEEL, T(0.36, 2.36, 0.22) @ RX(PI / 2), mat='Metal')
    b.add(g_cyl(0.068, 0.068, 0.02, 8), 0, T(0.36, 2.36, 0.37) @ RX(PI / 2), mat='Glow_Warm')
    b.box(0.22, 0.1, 0.09, TIN, at=(0, 1.745, 0.425), bevel=0.02, mat='Metal')
    for i in range(3):
        b.box(0.035, 0.07, 0.02, DARK, at=(-0.06 + i * 0.06, 1.745, 0.468))
    body = b.build(coll, parent=root, ao=0.2, ao_range=AO)

    # ------------------------------------------------ arms
    def arm(sx, name):
        p = Part(name, 3)
        p.push(T(sx * 0.58, 1.48, 0))
        p.add(g_sphere(0.2, 12, 8), SUIT, T(0, -0.02, 0), **sk)
        p.add(g_lathe([(0.0, -0.47), (0.13, -0.46), (0.158, -0.36), (0.172, -0.2), (0.165, -0.06), (0.0, 0.0)], 10), SUIT, **sk)
        p.add(g_torus(0.168, 0.03, 10, 5), 0xFFFFFF, T(0, -0.13, 0), mat='SuitAccent', smooth=True, jit=0, fjit=0)
        p.add(g_torus(0.166, 0.016, 10, 4), SUIT_D, T(0, -0.27, 0), mat='Suit', smooth=True)
        p.add(g_torus(0.14, 0.052, 10, 6), 0xFFFFFF, T(0, -0.44, 0), mat='SuitAccent', smooth=True, jit=0, fjit=0)
        p.add(g_sphere(0.165, 10, 7), GLOVE, T(0, -0.6, 0.012) @ SC(0.95, 1.08, 1.1), mat='Cloth', smooth=True, jit=0, fjit=0.01)
        p.add(g_sphere(0.072, 8, 5), GLOVE, T(-sx * 0.125, -0.565, 0.085), mat='Cloth', smooth=True, jit=0, fjit=0.01)
        p.pop()
        return p.build(coll, origin=(sx * 0.58, 1.48, 0), parent=body, ao=0.2, ao_range=AO)

    arm(-1, 'astro_armL'); arm(1, 'astro_armR')

    # ------------------------------------------------ legs
    def leg(sx, name):
        p = Part(name, 4)
        p.push(T(sx * 0.22, 0.74, 0))
        p.add(g_lathe([(0.0, -0.52), (0.14, -0.5), (0.185, -0.36), (0.2, -0.16), (0.17, 0.02), (0.0, 0.08)], 10), SUIT, **sk)
        p.add(g_torus(0.152, 0.05, 10, 6), 0xFFFFFF, T(0, -0.455, 0), mat='SuitAccent', smooth=True, jit=0, fjit=0)
        p.box(0.33, 0.25, 0.5, BOOT, at=(0, -0.585, 0.07), bevel=0.07, top=(0.84, 0.74))
        p.box(0.3, 0.13, 0.17, shade(BOOT, 0.78), at=(0, -0.63, 0.26), bevel=0.04)
        p.box(0.365, 0.075, 0.56, SOLE, at=(0, -0.7025, 0.075), bevel=0.022)
        p.pop()
        return p.build(coll, origin=(sx * 0.22, 0.74, 0), parent=body, ao=0.2, ao_range=AO)

    leg(-1, 'astro_legL'); leg(1, 'astro_legR')

    # ------------------------------------------------ antenna tip (the game pulses its glow)
    t = Part('astro_antennaTip', 5)
    t.add(g_sphere(0.06, 8, 6), 0, T(0.26, 2.17, -0.5), mat='Glow_Red', smooth=True)
    t.build(coll, origin=(0.26, 2.17, -0.5), parent=body, ao=0)

    # ------------------------------------------------ drill (hidden by the game until drilling)
    d = Part('astro_drill', 6)
    d.push(T(0, 0.95, 0.7))
    d.box(0.3, 0.36, 0.3, 0x9AA0A8, at=(0, 0.26, 0), bevel=0.05, mat='Metal')
    d.box(0.31, 0.06, 0.31, ORANGE, at=(0, 0.34, 0))
    d.box(0.32, 0.07, 0.32, DARK, at=(0, 0.2, 0), bevel=0.01)
    d.add(g_cyl(0.12, 0.09, 0.12, 8), TIN, T(0, -0.02, 0), mat='Metal')
    d.add(g_cyl(0.1, 0.12, 0.08, 8), STEEL, T(0, 0.44, 0), mat='Metal')
    for sx in (-1, 1):
        d.add(g_cyl(0.035, 0.035, 0.16, 6), STRAP_D, T(sx * 0.15, 0.3, 0) @ RZ(-sx * PI / 2))
    d.pop()
    drill = d.build(coll, origin=(0, 0.95, 0.7), parent=body, ao=0)
    bit = Part('astro_drillBit', 7)
    prof = [(0.0, -0.9), (0.1, -0.62), (0.05, -0.615), (0.115, -0.34), (0.06, -0.335), (0.125, -0.06), (0.07, -0.02), (0.07, 0.02)]
    bit.add(g_lathe(prof, 6), 0xC2C8D2, T(0, 0.95, 0.7), mat='Metal')
    bo = bit.build(coll, origin=(0, 0.95, 0.7), parent=drill, ao=0)
    drill.hide_render = True; bo.hide_render = True
    return {'tris': stats('A_astronaut')['tris']}


RESULT = build()
