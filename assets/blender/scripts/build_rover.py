"""The rover and the robot buddy. Layout follows buildRover()/buildBuddy() in js/actors.js:
six wheels (radius 0.62) at x +-1.25, z -1.6 / 0 / 1.6, driver seat around (0, 1.3, 0.25), cargo bed behind
the seat (item slots at y 1.6), charging socket at the back (0, 1.25, -2.55), headlights at the front (+z).
Nodes: rover_body, rover_wheel_0..5 (same order as the game: back pair, middle pair, front pair; each
spins about its own x axis), rover_socketRing (own material, the game recolours it).
Buddy nodes: buddy_body, buddy_eyeL, buddy_eyeR (scale y to blink), buddy_ring (spin about y)."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *


def build_rover():
    coll = collection('A_rover')
    root = empty('Rover', coll)
    b = Part('rover_body', 1)
    rng = b.rng
    # frame, axles, slatted deck
    for sx in (-1, 1): b.box(0.22, 0.26, 4.5, FRAME, at=(sx * 0.78, 0.86, 0), bevel=0.03)
    for z in (-1.6, 0, 1.6):
        b.add(g_cyl(0.085, 0.085, 2.2, 6), STEEL_D, T(-1.1, 0.62, z) @ RZ(-PI / 2), mat='Metal')
        for sx in (-1, 1): b.box(0.2, 0.26, 0.24, DARK, at=(sx * 0.78, 0.66, z))
    z = -2.3
    while z < 2.28:
        w = min(0.36 + rng.uniform(-0.04, 0.04), 2.3 - z)
        b.box(2.3, 0.13, w - 0.02, rng.choice(PANELS), at=(0, 1.03, z + w / 2), jit=0.08, fjit=0.02)
        z += w
    # hood: curved steel sheets, radiator plate, lamps, bumper
    Mh = T(0, 1.09, 2.1) @ SC(1.0, 0.52, 1) @ RX(-PI / 2)
    for i, geo in enumerate(g_staves([(1.02, 0.0), (1.02, 1.5)], 7, gap=0.04, thick=0.07, az0=-PI / 2, sweep=PI)):
        b.add(geo, BLUESTEEL if i == 2 else STEEL, Mh, mat='Metal', jit=0.05, fjit=0.012)
    for zz in (0.04, 0.75, 1.46):
        b.add(g_torus(1.035, 0.04, 12, 4, az0=-PI / 2, sweep=PI), STEEL_D, Mh @ T(0, zz, 0), mat='Metal')
    half = [(1.0 * math.cos(PI * i / 10), 0.51 * math.sin(PI * i / 10)) for i in range(11)]
    b.add(g_prism(half, 0.1), STEEL_D, T(0, 1.09, 2.06), mat='Metal')
    b.add(g_prism(half, 0.1), FRAME, T(0, 1.09, 0.62))
    for i in range(4): b.box(0.07, 0.3, 0.04, DARK, at=(-0.27 + i * 0.18, 1.3, 2.12))
    for sx in (-1, 1):
        b.add(g_cyl(0.21, 0.19, 0.22, 10), STEEL, T(sx * 0.72, 1.3, 2.08) @ RX(PI / 2), mat='Metal')
        b.add(g_cyl(0.165, 0.165, 0.03, 10), 0, T(sx * 0.72, 1.3, 2.29) @ RX(PI / 2), mat='Glow_Warm')
        b.add(g_cyl(0.07, 0.07, 0.02, 8), CHROME, T(sx * 0.3, 1.36, 0.56) @ RX(-PI / 2), mat='Metal')        # dash gauges
        beam(b, (sx * 0.78, 0.86, 2.2), (sx * 0.78, 0.86, 2.4), 0.12, 0.12, STEEL_D, mat='Metal')
    b.box(2.36, 0.2, 0.2, FRAME, at=(0, 0.86, 2.42), bevel=0.04)
    # bench seat (a chest with a cushion), backrest, steering wheel
    b.box(1.5, 0.5, 0.85, PANELS[1], at=(0, 1.35, 0.25), bevel=0.03)
    b.box(1.54, 0.08, 0.89, FRAME, at=(0, 1.14, 0.25)); b.box(0.12, 0.14, 0.04, CHROME, at=(0, 1.42, 0.69), mat='Metal')
    b.box(1.42, 0.1, 0.78, 0x5A6069, at=(0, 1.64, 0.25), bevel=0.04, mat='Cloth')
    for i in range(3):
        b.box(1.5, 0.26, 0.1, rng.choice(PANELS), at=(0, 1.78 + i * 0.29, -0.22), rot=(-0.08, 0, 0), jit=0.08)
    for sx in (-1, 1): b.box(0.1, 1.0, 0.12, FRAME, at=(sx * 0.72, 2.02, -0.3), rot=(-0.08, 0, 0))
    b.add(g_tube([(0, 1.5, 0.66), (0, 2.1, 0.98)], 0.035, 6), STEEL_D, mat='Metal')
    Mw = T(0, 2.12, 1.0) @ RX(PI / 2 - 0.6)
    b.add(g_torus(0.3, 0.04, 14, 5), FRAME, Mw, smooth=True)
    for k in range(3):
        a = k * TAU / 3
        b.add(g_box(0.04, 0.03, 0.3), CHROME, Mw @ RY(a) @ T(0, 0, 0.15), mat='Metal')
    # roll bar, rolled tarp, lantern, aerial with a pennant
    b.add(g_tube([(-1.05, 1.1, -0.38), (-1.05, 2.62, -0.38), (-0.82, 2.86, -0.38), (0.82, 2.86, -0.38), (1.05, 2.62, -0.38), (1.05, 1.1, -0.38)], 0.065, 6),
          STEEL, mat='Metal', smooth=True)
    b.add(g_cyl(0.15, 0.15, 1.5, 9, bevel=0.03), 0x8A919A, T(-0.75, 3.06, -0.38) @ RZ(-PI / 2), mat='Cloth', smooth=True)
    for x in (-0.45, 0.45): b.add(g_torus(0.156, 0.022, 9, 4), STRAP, T(x, 3.06, -0.38) @ RZ(PI / 2))
    beam(b, (1.05, 2.5, -0.38), (1.05, 2.5, 0.0), 0.04, 0.04, STEEL_D, mat='Metal')
    lantern(b, T(1.05, 1.98, -0.04), 0.9)
    b.add(g_tube([(0.95, 2.7, -0.38), (0.955, 3.6, -0.37), (0.95, 4.36, -0.38)], 0.02, 4), TIN, mat='Metal')
    tri = [(0.97, 4.25, -0.38), (0.97, 3.95, -0.38), (1.5, 4.08, -0.34)]
    b.add((tri, [[0, 1, 2]]), RED); b.add((tri, [[2, 1, 0]]), RED)
    b.add(g_sphere(0.07, 8, 6), 0, T(0.95, 4.42, -0.38), mat='Glow_Red', smooth=True)
    # cargo bed
    for sx in (-1, 1):
        for y in (1.27, 1.52):
            b.box(0.09, 0.2, 1.62, PANEL_L, at=(sx * 1.09, y, -1.27), jit=0.08)
        for zz in (-0.46, -2.08): b.box(0.13, 0.66, 0.13, FRAME, at=(sx * 1.09, 1.4, zz), bevel=0.02)
    for y in (1.27, 1.52): b.box(2.1, 0.2, 0.09, PANEL_L, at=(0, y, -2.08), jit=0.08)
    # charging socket (the glow ring is its own node)
    beam(b, (0, 0.98, -2.25), (0, 0.98, -2.62), 0.3, 0.14, FRAME)
    b.add(g_lathe([(0.34, 1.05), (0.45, 1.16), (0.45, 1.42), (0.39, 1.45), (0.3, 1.2)], 12), STEEL, T(0, 0, -2.55), mat='Metal')
    # tools on the sides: shovel, cable coil
    beam(b, (1.2, 1.42, -0.55), (1.2, 1.46, -1.7), 0.05, 0.05, PANELS[2])
    b.add(g_prism([(-0.14, 0), (0.14, 0), (0.16, -0.3), (0, -0.42), (-0.16, -0.3)], 0.03), TIN, T(1.2, 1.47, -1.7) @ Matrix(((0, 0, 1, 0), (1, 0, 0, 0), (0, 1, 0, 0), (0, 0, 0, 1))), mat='Metal')
    for k in range(4): b.add(g_torus(0.2 - k * 0.012, 0.035, 10, 4), CABLE, T(-1.17 - k * 0.045, 1.42, -1.25) @ RZ(PI / 2), jit=0.04)
    body = b.build(coll, parent=root, ao=0.24, ao_range=(0.4, 3.0))

    r = Part('rover_socketRing', 2)
    r.add(g_torus(0.46, 0.07, 16, 6), 0, T(0, 1.46, -2.55), mat='Glow_Socket', smooth=True)
    r.build(coll, origin=(0, 1.46, -2.55), parent=root, ao=0)

    i = 0
    for z in (-1.6, 0, 1.6):
        for x in (-1.25, 1.25):
            w = Part('rover_wheel_%d' % i, 10 + i)
            w.push(T(x, 0.62, z) @ RZ(PI / 2))                    # wheel axis (local y) -> along x
            w.add(g_lathe([(0.4, -0.21), (0.56, -0.21), (0.62, -0.14), (0.62, 0.14), (0.56, 0.21), (0.4, 0.21)], 14), RUBBER, jit=0, fjit=0.03)
            for k in range(14):
                w.add(g_box(0.13, 0.4, 0.07), 0x25232C, RY(k * TAU / 14 + 0.1) @ T(0, 0, 0.63), jit=0.04)
            w.add(g_cyl(0.42, 0.42, 0.3, 12), PANELS[i % 5], T(0, -0.15, 0), jit=0.05, fjit=0.04)
            for s in (-1, 1):
                for a in (0.0, PI / 2):
                    w.add(g_box(0.12, 0.03, 0.8), FRAME, T(0, s * 0.16, 0) @ RY(a))
                w.add(g_cyl(0.15, 0.11, 0.07, 8), STEEL, T(0, s * 0.15, 0) @ (SC(1, 1, 1) if s > 0 else RX(PI)), mat='Metal')
            w.add(g_torus(0.41, 0.03, 14, 4), STEEL_D, T(0, 0.15, 0), mat='Metal'); w.add(g_torus(0.41, 0.03, 14, 4), STEEL_D, T(0, -0.15, 0), mat='Metal')
            w.pop()
            w.build(coll, origin=(x, 0.62, z), parent=root, ao=0.0)
            i += 1
    return stats('A_rover')['tris']


def build_buddy():
    coll = collection('A_buddy')
    root = empty('Buddy', coll)
    b = Part('buddy_body', 1)
    b.add(g_sphere(0.38, 18, 12), LIGHT, mat='Paint', smooth=True, jit=0, fjit=0.01)
    b.add(g_torus(0.382, 0.022, 20, 4), STEEL, mat='Metal', smooth=True, jit=0)
    b.rivets(0.4, 0.0, 10, 0.022, CHROME, az0=1.0, sweep=TAU - 2.0)
    # face: dark glass bulge in a steel bezel
    b.add(g_sphere(0.33, 16, 6, t0=PI / 2, t1=PI), 0, T(0, 0.02, 0.11) @ SC(1, 0.7, 0.9) @ RX(PI / 2), mat='DarkGlass', smooth=True)
    loop = []
    for i in range(21):
        th = TAU * i / 20
        loop.append((0.305 * math.cos(th), 0.02 + 0.215 * math.sin(th), 0.24 + 0.085 * math.sin(th) ** 2))
    b.add(g_tube(loop, 0.03, 6, caps=False), STEEL, mat='Metal', smooth=True, jit=0)
    # ears, top handle, aerial, thruster
    for sx in (-1, 1):
        b.add(g_cyl(0.12, 0.09, 0.06, 8), STEEL, T(sx * 0.36, 0, 0) @ RZ(-sx * PI / 2), mat='Metal')
        b.add(g_cyl(0.045, 0.045, 0.05, 6), CHROME, T(sx * 0.41, 0, 0) @ RZ(-sx * PI / 2), mat='Metal')
    b.add(g_torus(0.13, 0.02, 12, 4, az0=-PI / 2, sweep=PI), STEEL_D, T(0, 0.34, 0.0) @ RX(-PI / 2), mat='Metal')
    b.add(g_cyl(0.05, 0.035, 0.06, 6), STEEL, T(0, 0.37, 0.06), mat='Metal')
    b.add(g_tube([(0, 0.4, 0.06), (0.005, 0.52, 0.062), (0, 0.6, 0.06)], 0.012, 4), TIN, mat='Metal')
    b.add(g_sphere(0.055, 8, 6), 0, T(0, 0.65, 0.06), mat='Glow_Gold', smooth=True)
    b.add(g_lathe([(0.2, -0.5), (0.13, -0.42), (0.16, -0.34), (0.1, -0.3)], 10), STEEL_D, mat='Metal')
    body = b.build(coll, parent=root, ao=0.18)
    for sx, name in ((-1, 'buddy_eyeL'), (1, 'buddy_eyeR')):
        e = Part(name, 2)
        e.add(g_sphere(0.065, 10, 8), 0, T(sx * 0.13, 0.05, 0.385), mat='Glow_Cool', smooth=True)
        e.build(coll, origin=(sx * 0.13, 0.05, 0.385), parent=body, ao=0)
    r = Part('buddy_ring', 3)
    r.add(g_torus(0.46, 0.035, 24, 5), 0, T(0, -0.32, 0), mat='Glow_Cool', smooth=True)
    for k in range(3):
        r.add(g_box(0.09, 0.07, 0.12, 0.015), STEEL, T(0, -0.32, 0) @ RY(k * TAU / 3) @ T(0, 0, 0.46), mat='Metal')
    r.build(coll, origin=(0, -0.32, 0), parent=body, ao=0)
    return stats('A_buddy')['tris']


RESULT = {'rover': build_rover(), 'buddy': build_buddy()}
