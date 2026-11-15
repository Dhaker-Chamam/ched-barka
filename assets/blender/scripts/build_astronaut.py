"""The astronaut, with real joints so the game can animate a natural walk, run and jump.

Node tree (pivot of each part in game space, metres before the game's 0.84 scale; 'L' parts are on -x):
  Astronaut
    astro_hips   (0, 0.86, 0)        lower torso, belt, waist bearing
      astro_legL/R  (+-0.2, 0.86, 0)  thigh  -> astro_shinL/R (+-0.2, 0.50, 0) knee -> astro_footL/R (+-0.2, 0.15, 0) ankle
      astro_body   (0, 0.98, 0)      chest, life-support pack and helmet: turns and leans at the waist bearing
        astro_armL/R  (+-0.58, 1.48, 0)  upper arm -> astro_foreL/R (+-0.58, 1.20, 0) elbow -> astro_handL/R (+-0.58, 0.97, 0) wrist
        astro_antennaTip, astro_drill -> astro_drillBit
js/actors.js uses the same numbers (RIG). Standing straight, the soles touch y = 0.
The suit fabric uses the tintable 'Suit' material; cuffs, bands, knee pads and the gauntlets use 'SuitAccent',
which the game sets to the player's suit colour."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *

SUIT = 0xFFFFFF; SUIT_D = 0xC9CDD3; SUIT_S = 0xB4B9C1          # white vertex colour x light-grey 'Suit' tint; seams, folds
GREY_M = 0xA8AEB6                                              # pack, pouches
GLOVE = 0xC3C8CF; BLUEGREY = 0x5E7C8C
ROLL = 0x707782; BOOT = 0x4F545C; SOLE = 0xC9CDD2; HELMET = 0xC5CAD1

AO = (0.0, 2.7)
HIP_X, HIP_Y = 0.2, 0.86
KNEE_Y, ANKLE_Y = 0.50, 0.15
WAIST_Y = 0.98
SH_X, SH_Y, ELB_Y, WR_Y = 0.58, 1.48, 1.20, 0.97
HY = 2.02                                                       # helmet centre
VIS_A, VIS_B, VIS_CY, VIS_R = 0.47, 0.32, 2.06, 0.545           # visor: half width, half height, centre height, glass radius


def visor_point(x, y, r=VIS_R):
    """The point of a sphere of radius r around the helmet centre that is seen at (x, y) from the front."""
    return Vector((x, y, math.sqrt(max(0.0, r * r - x * x - (y - HY) ** 2))))


def g_visor(nr=7, nt=32):
    """The visor glass: the front of a sphere a little bigger than the helmet, cut to a wide ellipse."""
    verts, faces = [tuple(visor_point(0, VIS_CY))], []
    for i in range(1, nr + 1):
        s = i / nr
        for j in range(nt):
            t = TAU * j / nt
            verts.append(tuple(visor_point(VIS_A * s * math.cos(t), VIS_CY + VIS_B * s * math.sin(t))))
    ring = lambda i, j: 1 + (i - 1) * nt + (j % nt)
    for j in range(nt):
        faces.append([0, ring(1, j), ring(1, j + 1)])
    for i in range(1, nr):
        for j in range(nt):
            faces.append([ring(i, j), ring(i + 1, j), ring(i + 1, j + 1), ring(i, j + 1)])
    return verts, faces


def rim(t, r=0.535):
    return visor_point(VIS_A * math.cos(t), VIS_CY + VIS_B * math.sin(t), r)


def build():
    coll = collection('A_astronaut')
    root = empty('Astronaut', coll)
    sk = dict(mat='Suit', smooth=True, jit=0, fjit=0.012)
    fold = dict(mat='Suit', smooth=True, jit=0, fjit=0.0)

    # ------------------------------------------------ hips: lower torso, belt, pouches, waist bearing
    h = Part('astro_hips', 1)
    h.add(g_lathe([(0.0, 0.60), (0.18, 0.605), (0.31, 0.65), (0.40, 0.73), (0.445, 0.83), (0.46, 0.93), (0.462, 1.0), (0.0, 1.01)], 18),
          SUIT, SC(1.0, 1.0, 0.86), **sk)
    h.add(g_torus(0.452, 0.012, 18, 4), SUIT_S, T(0, 0.70, 0) @ SC(1, 1, 0.86), **fold)                         # seam
    h.add(g_torus(0.468, 0.032, 22, 6), STEEL, T(0, 0.985, 0) @ SC(1, 1, 0.86), mat='Metal', smooth=True, jit=0)   # waist bearing
    h.add(g_torus(0.45, 0.05, 18, 6), STRAP, T(0, 0.86, 0) @ SC(1, 1, 0.86), smooth=True)                        # belt
    h.box(0.17, 0.12, 0.05, CHROME, at=(0, 0.86, 0.405), bevel=0.018, mat='Metal')
    h.box(0.09, 0.06, 0.06, STRAP_D, at=(0, 0.86, 0.41), bevel=0.01)
    for sx in (-1, 1):
        h.box(0.18, 0.2, 0.12, GREY_M, at=(sx * 0.4, 0.79, 0.19), rot=(0, sx * 1.0, 0), bevel=0.03)
        h.box(0.19, 0.065, 0.13, STRAP, at=(sx * 0.4, 0.875, 0.19), rot=(0, sx * 1.0, 0), bevel=0.014)
        h.box(0.035, 0.035, 0.03, CHROME, at=(sx * 0.455, 0.85, 0.225), rot=(0, sx * 1.0, 0), mat='Metal')
    hips = h.build(coll, origin=(0, HIP_Y, 0), parent=root, ao=0.2, ao_range=AO)

    # ------------------------------------------------ legs: thigh, shin (knee bellows, knee pad, boot shaft), foot
    def leg(sx, s):
        x = sx * HIP_X
        p = Part('astro_leg' + s, 4)
        p.add(g_lathe([(0.0, 0.46), (0.15, 0.47), (0.172, 0.54), (0.185, 0.66), (0.19, 0.78), (0.18, 0.88), (0.0, 0.93)], 12), SUIT, T(x, 0, 0), **sk)
        p.add(g_torus(0.188, 0.011, 12, 4), SUIT_S, T(x, 0.72, 0), **fold)                                          # seam
        p.box(0.06, 0.16, 0.17, GREY_M, at=(x + sx * 0.188, 0.64, 0.02), bevel=0.02)                                 # thigh pocket
        p.box(0.07, 0.05, 0.18, STRAP, at=(x + sx * 0.19, 0.725, 0.02), bevel=0.012)
        p.box(0.02, 0.03, 0.03, CHROME, at=(x + sx * 0.226, 0.70, 0.02), mat='Metal')
        thigh = p.build(coll, origin=(x, HIP_Y, 0), parent=hips, ao=0.2, ao_range=AO)

        p = Part('astro_shin' + s, 5)
        p.add(g_sphere(0.156, 12, 8), SUIT, T(x, KNEE_Y, 0), **sk)
        for i, y in enumerate((0.548, 0.50, 0.452)):                                                                  # knee bellows
            p.add(g_torus(0.155 + 0.006 * (i == 1), 0.03, 12, 6), SUIT_D, T(x, y, 0), **fold)
        p.box(0.2, 0.17, 0.07, 0xFFFFFF, at=(x, 0.50, 0.15), rot=(-0.12, 0, 0), bevel=0.032, mat='SuitAccent', jit=0, fjit=0)   # knee pad
        p.box(0.12, 0.09, 0.03, 0xD9D9D9, at=(x, 0.50, 0.19), rot=(-0.12, 0, 0), bevel=0.012, mat='SuitAccent', jit=0, fjit=0)
        p.add(g_lathe([(0.0, 0.25), (0.14, 0.255), (0.15, 0.33), (0.158, 0.44), (0.15, 0.5), (0.0, 0.52)], 12), SUIT, T(x, 0, 0), **sk)
        p.add(g_lathe([(0.0, 0.13), (0.152, 0.135), (0.16, 0.2), (0.163, 0.3), (0.0, 0.315)], 12), BOOT, T(x, 0, 0), mat='Cloth', smooth=True, jit=0)   # boot shaft
        p.add(g_torus(0.158, 0.045, 12, 6), 0xFFFFFF, T(x, 0.31, 0), mat='SuitAccent', smooth=True, jit=0, fjit=0)  # boot cuff
        p.add(g_torus(0.163, 0.018, 12, 4), STRAP, T(x, 0.215, 0), smooth=True)                                     # boot strap
        p.box(0.035, 0.045, 0.03, CHROME, at=(x + sx * 0.165, 0.215, 0.03), mat='Metal')
        shin = p.build(coll, origin=(x, KNEE_Y, 0), parent=thigh, ao=0.2, ao_range=AO)

        p = Part('astro_foot' + s, 6)
        p.add(g_sphere(0.15, 12, 7), BOOT, T(x, 0.16, 0) @ SC(1, 0.9, 1.05), mat='Cloth', smooth=True, jit=0)       # ankle
        p.box(0.3, 0.15, 0.4, BOOT, at=(x, 0.1, 0.1), bevel=0.06, top=(0.86, 0.72), mat='Cloth')                     # upper
        p.box(0.29, 0.1, 0.14, shade(BOOT, 0.78), at=(x, 0.085, 0.27), bevel=0.04, mat='Cloth')                     # toe cap
        p.box(0.28, 0.1, 0.08, shade(BOOT, 0.86), at=(x, 0.085, -0.1), bevel=0.03, mat='Cloth')                     # heel
        p.box(0.33, 0.06, 0.5, SOLE, at=(x, 0.04, 0.09), bevel=0.02)                                                 # sole
        for i in range(7):                                                                                          # tread
            p.box(0.31, 0.02, 0.035, DARK, at=(x, 0.012, -0.12 + i * 0.07), mat='Cloth', jit=0)
        p.box(0.31, 0.03, 0.08, STRAP, at=(x, 0.165, 0.1), rot=(-0.45, 0, 0), bevel=0.01)                           # instep strap
        p.box(0.03, 0.05, 0.05, CHROME, at=(x + sx * 0.155, 0.16, 0.1), mat='Metal')
        p.build(coll, origin=(x, ANKLE_Y, 0), parent=shin, ao=0.2, ao_range=AO)

    leg(-1, 'L'); leg(1, 'R')

    # ------------------------------------------------ upper body: chest, harness, control box, pack, helmet
    b = Part('astro_body', 2)
    b.add(g_lathe([(0.0, 0.94), (0.44, 0.945), (0.455, 1.0), (0.465, 1.24), (0.44, 1.44), (0.35, 1.6), (0.26, 1.68), (0.0, 1.70)], 18),
          SUIT, SC(1.0, 1.0, 0.86), **sk)
    b.add(g_torus(0.466, 0.012, 18, 4), SUIT_S, T(0, 1.08, 0) @ SC(1, 1, 0.86), **fold)                          # seam
    b.add(g_torus(0.455, 0.012, 18, 4), SUIT_S, T(0, 1.36, 0) @ SC(1, 1, 0.86), **fold)
    # chest control box: a screen and switches (decal), real knobs on its side
    b.box(0.44, 0.28, 0.14, TIN, at=(0, 1.2, 0.415), bevel=0.035, mat='Metal')
    b.box(0.4, 0.24, 0.02, DARK, at=(0, 1.2, 0.482))
    b.decal('panel', T(0, 1.2, 0.492), 0.38)
    for i in range(2):
        b.add(g_cyl(0.034, 0.03, 0.05, 8), CHROME, T(0.22, 1.24 - i * 0.08, 0.43) @ RZ(-PI / 2), mat='Metal', jit=0)
    for sx in (-1, 1):                                                                       # hoses from the box to the pack
        b.add(g_tube([(sx * 0.2, 1.1, 0.44), (sx * 0.36, 1.02, 0.34), (sx * 0.47, 1.0, 0.1), (sx * 0.44, 1.02, -0.2), (sx * 0.34, 1.05, -0.4)], 0.032, 6),
              0x4F5560, smooth=True)
    # harness straps over the shoulders
    for sx in (-1, 1):
        pts = [(sx * .2, .98, .392), (sx * .21, 1.1, .388), (sx * .23, 1.4, .362), (sx * .25, 1.6, .24), (sx * .25, 1.715, 0.0), (sx * .24, 1.58, -.27), (sx * .22, 1.4, -.37)]
        b.add(g_tube(pts, 0.042, 5), STRAP, smooth=True)
        b.box(0.07, 0.07, 0.04, CHROME, at=(sx * .225, 1.36, .385), mat='Metal', bevel=0.012)
    # mission patch on the left chest, name tag on the right
    Mp = T(-0.12, 1.47, 0.352) @ RY(-0.25) @ RX(-0.4)
    b.add(g_cyl(0.08, 0.08, 0.016, 16), LIGHT, Mp @ RX(PI / 2), jit=0)
    b.decal('patch', Mp @ T(0, 0, 0.017), 0.15)
    Mn = T(0.12, 1.47, 0.352) @ RY(0.25) @ RX(-0.4)
    b.add(g_box(0.17, 0.06, 0.016, 0.004), DARK, Mn @ T(0, 0, 0.008))
    b.add(g_box(0.13, 0.014, 0.01), LIGHT, Mn @ T(0, 0, 0.018))
    # backpack: life-support pack on a steel frame, rolled pad, two steel tanks
    b.box(0.64, 0.84, 0.34, GREY_M, at=(0, 1.2, -0.46), bevel=0.07)
    for sx in (-1, 1):
        b.box(0.065, 1.04, 0.075, FRAME, at=(sx * 0.3, 1.22, -0.635), bevel=0.014)
        b.add(g_cyl(0.1, 0.1, 0.62, 10, bevel=0.035), STEEL, T(sx * 0.42, 0.9, -0.47), mat='Metal', smooth=True)
        b.add(g_cyl(0.04, 0.03, 0.06, 6), CHROME, T(sx * 0.42, 1.52, -0.47), mat='Metal')
        b.add(g_cyl(0.05, 0.05, 0.03, 8), RED, T(sx * 0.42, 1.565, -0.47), jit=0)                                 # valve knob
        b.add(g_torus(0.104, 0.016, 10, 4), STRAP_D, T(sx * 0.42, 1.2, -0.47))
        b.add(g_torus(0.104, 0.016, 10, 4), STRAP_D, T(sx * 0.42, 1.0, -0.47))
    b.box(0.66, 0.065, 0.075, FRAME, at=(0, 0.84, -0.635), bevel=0.014)
    b.box(0.66, 0.065, 0.075, FRAME, at=(0, 1.56, -0.635), bevel=0.014)
    b.box(0.5, 0.3, 0.05, LIGHT, at=(0, 1.36, -0.645), bevel=0.02)                                   # flap
    b.box(0.05, 0.12, 0.03, STRAP, at=(-0.13, 1.25, -0.672)); b.box(0.05, 0.12, 0.03, STRAP, at=(0.13, 1.25, -0.672))
    b.box(0.36, 0.24, 0.09, shade(GREY_M, 0.86), at=(0, 1.02, -0.66), bevel=0.03)                        # pocket
    b.decal('vent', T(0, 1.02, -0.706) @ RY(PI), 0.26)
    b.box(0.13, 0.07, 0.03, 0, at=(0.2, 1.56, -0.685), mat='Glow_Green')                             # status light
    b.add(g_cyl(0.165, 0.165, 0.8, 12, bevel=0.035), ROLL, T(-0.4, 1.8, -0.45) @ RZ(-PI / 2), mat='Cloth', smooth=True)   # bedroll
    for x in (-0.22, 0.22):
        b.add(g_torus(0.17, 0.022, 12, 4), STRAP_D, T(x, 1.8, -0.45) @ RZ(PI / 2))
    b.add(g_cyl(0.035, 0.03, 0.08, 6), TIN, T(0.26, 1.6, -0.52), mat='Metal')
    b.add(g_tube([(0.26, 1.66, -0.52), (0.262, 1.95, -0.505), (0.26, 2.14, -0.5)], 0.013, 4), TIN, mat='Metal')
    # collar (the neck ring)
    b.add(g_torus(0.365, 0.08, 20, 7), STEEL, T(0, 1.655, 0), mat='Metal', smooth=True, jit=0)
    b.rivets(0.436, 1.655, 12, 0.022, CHROME, az0=PI / 12)
    # helmet shell
    b.add(g_sphere(0.52, 24, 14), HELMET, T(0, HY, 0), mat='Metal', smooth=True, jit=0, fjit=0.01)
    b.add(g_lathe([(0.235, 2.47), (0.21, 2.52), (0.11, 2.555), (0.06, 2.59), (0.065, 2.64), (0.0, 2.655)], 12), STEEL, mat='Metal', smooth=True)
    b.add(g_torus(0.526, 0.018, 28, 4), STEEL_D, T(0, HY, 0) @ RX(PI / 2), mat='Metal', smooth=True, jit=0)            # seam over the top, side to side
    # the big visor: gold glass, a steel frame along its edge with bolts, and a dark gasket inside the frame
    b.add(g_visor(), 0, mat='Visor', smooth=True)
    loop = [rim(TAU * i / 40) for i in range(41)]
    b.add(g_tube(loop, 0.04, 7, caps=False), STEEL, mat='Metal', smooth=True, jit=0)
    for i in range(16):
        th = TAU * (i + 0.5) / 16
        pos = rim(th)
        nrm = (pos - Vector((0, HY, 0))).normalized()
        b.add(g_lathe([(0.019, 0), (0.013, 0.012), (0, 0.017)], 6), CHROME, T(*(pos + nrm * 0.038)) @ ALIGN(nrm), mat='Metal', jit=0)
    # visor hinges (the round side caps) and two helmet lamps above the visor
    for sx in (-1, 1):
        b.add(g_cyl(0.17, 0.14, 0.075, 12), STEEL, T(sx * 0.485, HY, -0.04) @ RZ(-sx * PI / 2), mat='Metal')
        b.add(g_cyl(0.07, 0.06, 0.03, 10), CHROME, T(sx * 0.56, HY, -0.04) @ RZ(-sx * PI / 2), mat='Metal')
        b.add(g_tube([(sx * 0.52, HY + 0.04, 0.05), (sx * 0.5, HY + 0.1, 0.2), (sx * 0.47, HY + 0.13, 0.27)], 0.016, 5), STEEL_D, mat='Metal', jit=0)
        L = T(sx * 0.37, 2.34, 0.17)
        b.box(0.11, 0.1, 0.12, STEEL_D, at=(sx * 0.37, 2.34, 0.12), mat='Metal', bevel=0.02)
        b.add(g_cyl(0.068, 0.062, 0.14, 10), STEEL, L @ RX(PI / 2), mat='Metal')
        b.add(g_cyl(0.056, 0.056, 0.02, 10), 0, L @ T(0, 0, 0.135) @ RX(PI / 2), mat='Glow_Warm')
    body = b.build(coll, origin=(0, WAIST_Y, 0), parent=hips, ao=0.2, ao_range=AO)

    # ------------------------------------------------ arms: upper arm, forearm (elbow bellows), glove
    def arm(sx, s):
        x = sx * SH_X
        p = Part('astro_arm' + s, 7)
        p.add(g_sphere(0.19, 12, 8), SUIT, T(x, 1.47, 0), **sk)
        p.add(g_lathe([(0.0, 1.16), (0.13, 1.165), (0.152, 1.22), (0.165, 1.31), (0.17, 1.4), (0.0, 1.45)], 12), SUIT, T(x, 0, 0), **sk)
        p.add(g_torus(0.172, 0.022, 14, 5), STEEL, T(x, 1.40, 0), mat='Metal', smooth=True, jit=0)                  # arm bearing
        p.add(g_torus(0.164, 0.03, 12, 5), 0xFFFFFF, T(x, 1.21, 0), mat='SuitAccent', smooth=True, jit=0, fjit=0)
        if sx < 0:                                                                                                 # shoulder patch
            M = T(x - 0.158, 1.31, 0) @ RY(-PI / 2)
            p.add(g_cyl(0.065, 0.065, 0.02, 14), LIGHT, M @ RX(PI / 2), jit=0)
            p.decal('patch', M @ T(0, 0, 0.021), 0.12)
        upper = p.build(coll, origin=(x, SH_Y, 0), parent=body, ao=0.2, ao_range=AO)

        p = Part('astro_fore' + s, 8)
        p.add(g_sphere(0.148, 12, 8), SUIT, T(x, ELB_Y, 0), **sk)
        for i, y in enumerate((1.245, 1.2, 1.155)):                                                                 # elbow bellows
            p.add(g_torus(0.148 + 0.005 * (i == 1), 0.026, 12, 6), SUIT_D, T(x, y, 0), **fold)
        p.add(g_lathe([(0.0, 0.95), (0.122, 0.955), (0.138, 1.0), (0.146, 1.09), (0.15, 1.15), (0.0, 1.19)], 12), SUIT, T(x, 0, 0), **sk)
        p.add(g_torus(0.13, 0.022, 12, 5), STEEL, T(x, 0.99, 0), mat='Metal', smooth=True, jit=0)                   # wrist bearing
        if sx < 0:                                                                                                 # cuff checklist
            p.box(0.04, 0.13, 0.11, LIGHT, at=(x - 0.15, 1.07, 0.0), bevel=0.012)
            for k in range(3):
                p.box(0.006, 0.012, 0.07 - 0.015 * k, DARK, at=(x - 0.172, 1.105 - k * 0.03, -0.005))
            p.add(g_torus(0.152, 0.012, 12, 4), STRAP, T(x, 1.1, 0))
            p.add(g_torus(0.15, 0.012, 12, 4), STRAP, T(x, 1.03, 0))
        fore = p.build(coll, origin=(x, ELB_Y, 0), parent=upper, ao=0.2, ao_range=AO)

        p = Part('astro_hand' + s, 9)
        g = dict(mat='Cloth', smooth=True, jit=0, fjit=0.008)
        p.add(g_lathe([(0.0, 0.92), (0.118, 0.925), (0.148, 0.97), (0.155, 1.03), (0.0, 1.035)], 12), 0xFFFFFF, T(x, 0, 0),
              mat='SuitAccent', smooth=True, jit=0, fjit=0)                                                          # gauntlet
        p.box(0.09, 0.15, 0.155, GLOVE, at=(x, 0.85, 0.0), bevel=0.038, **g)                                         # palm
        p.box(0.03, 0.08, 0.1, shade(GLOVE, 0.86), at=(x + sx * 0.04, 0.86, -0.01), bevel=0.012, **g)              # back of the hand pad
        cin = -sx                                                                                                  # toward the body
        for z, ln in ((-0.052, 0.8), (-0.018, 0.95), (0.018, 1.0), (0.053, 0.92)):
            pts = [(x, 0.79, z), (x + cin * 0.004, 0.79 - 0.06 * ln, z), (x + cin * 0.03, 0.79 - 0.1 * ln, z), (x + cin * 0.05, 0.79 - 0.115 * ln, z)]
            p.add(g_tube(pts, 0.022, 6), GLOVE, **g)
        p.add(g_tube([(x + cin * 0.02, 0.88, 0.07), (x + cin * 0.035, 0.83, 0.1), (x + cin * 0.05, 0.79, 0.098)], 0.025, 6), GLOVE, **g)   # thumb
        p.build(coll, origin=(x, WR_Y, 0), parent=fore, ao=0.2, ao_range=AO)

    arm(-1, 'L'); arm(1, 'R')

    # ------------------------------------------------ antenna tip (the game pulses its glow)
    t = Part('astro_antennaTip', 10)
    t.add(g_sphere(0.06, 8, 6), 0, T(0.26, 2.17, -0.5), mat='Glow_Red', smooth=True)
    t.build(coll, origin=(0.26, 2.17, -0.5), parent=body, ao=0)

    # ------------------------------------------------ drill (hidden by the game until drilling)
    d = Part('astro_drill', 11)
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
    bit = Part('astro_drillBit', 12)
    prof = [(0.0, -0.9), (0.1, -0.62), (0.05, -0.615), (0.115, -0.34), (0.06, -0.335), (0.125, -0.06), (0.07, -0.02), (0.07, 0.02)]
    bit.add(g_lathe(prof, 6), 0xC2C8D2, T(0, 0.95, 0.7), mat='Metal')
    bo = bit.build(coll, origin=(0, 0.95, 0.7), parent=drill, ao=0)
    drill.hide_render = True; bo.hide_render = True
    return {'tris': stats('A_astronaut')['tris']}


RESULT = build()
