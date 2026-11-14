"""The rocket, its launch pad and the gantry tower. Sizes follow rocket() in js/base.js:
hull about 2.5-2.9 m radius from y = 3.3 to 16.4, nose tip at 22.1, legs landing at radius 4.4,
door at y 7..9 on the front (+z), windows at y 11.4 and 13.4 (the landing film looks out between them, 2.95 m from the axis),
cargo basket at (0, 0.8, 4.9),
gantry at (-5.6, 0, -1.5) when the rocket faces +z, pad radius 11.5-12.
Nodes: rocket_ship (everything that lifts off), rocket_pad, rocket_gantry, rocket_towerLight."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *

HULL = [(2.05, 3.3), (2.6, 4.2), (2.82, 6.5), (2.86, 9.0), (2.72, 12.0), (2.45, 14.6), (2.15, 16.4)]
NOSE = [(2.2, 16.3), (2.22, 16.6), (2.02, 17.6), (1.64, 18.9), (1.12, 20.3), (0.56, 21.4), (0.2, 21.95), (0.0, 22.1)]


def interp(prof, y):
    if y <= prof[0][1]: return prof[0][0]
    for (r0, y0), (r1, y1) in zip(prof, prof[1:]):
        if y <= y1: return r0 + (r1 - r0) * (y - y0) / (y1 - y0)
    return prof[-1][0]


def hr(y): return interp(HULL, y)


def on_hull(a, y, off=0.0):
    r = hr(y) + off
    return Vector((r * math.sin(a), y, r * math.cos(a)))


def build_ship(coll, root):
    s = Part('rocket_ship', 1)
    rng = s.rng
    # ---------------- hull: steel panels over a dark shell, steel hoops, a riveted belt
    s.add(g_lathe([(r - 0.09, y) for (r, y) in HULL], 22), UNDER, jit=0, fjit=0)
    for geo in g_staves(HULL, 22, gap=0.05, thick=0.12):
        s.add(geo, rng.choice(PANELS), jit=0.09, fjit=0.012)
    for y in (5.2, 14.6):
        s.add(g_torus(hr(y) + 0.03, 0.115, 28, 6), STEEL, T(0, y, 0), mat='Metal', smooth=True, jit=0.02)
        s.rivets(hr(y) + 0.14, y, 22, 0.05, CHROME, az0=TAU / 44)
    s.add(g_lathe([(hr(9.72) + 0.05, 9.72), (hr(10.28) + 0.05, 10.28)], 22, caps=False), TIN, mat='Metal', jit=0.02, fjit=0.03)
    for y in (9.82, 10.18): s.rivets(hr(y) + 0.06, y, 22, 0.045, STEEL_D, az0=TAU / 44)

    def patch(a0, a1, y0, y1, col, mat='Metal'):
        ym = (y0 + y1) / 2
        s.add(g_lathe([(hr(y0) + 0.04, y0), (hr(ym) + 0.045, ym), (hr(y1) + 0.04, y1)], 3, az0=a0, sweep=a1 - a0, caps=False), col, mat=mat, jit=0.05)
        for y in (y0 + 0.12, y1 - 0.12): s.rivets(hr(y) + 0.05, y, 4, 0.04, CHROME, az0=a0 + 0.04, sweep=a1 - a0 - 0.08)
    patch(0.95, 1.55, 10.9, 12.9, BLUESTEEL)
    patch(-2.3, -1.6, 6.1, 7.7, STEEL)
    patch(2.5, 3.0, 12.2, 13.6, LIGHT, 'Paint')
    patch(-0.75, -0.35, 5.6, 6.6, TIN)

    # ---------------- nose: painted tin gores with riveted seams, lookout porthole, spike and pennant
    def gore(c, n):
        k = int(((math.atan2(c.x, c.z) + TAU + TAU / 16) % TAU) / (TAU / 8))
        if c.y < 16.62: return STEEL
        return RED if k in (0, 4) else (0xBCC1C7 if k % 2 else 0xD3D7DC)
    s.add(g_lathe(NOSE, 24), gore, mat='Metal', smooth=True, fjit=0.012)
    for k in range(8):
        a = (k + 0.5) * TAU / 8
        pts = [(interp(NOSE, y) + 0.015) for y in (16.7, 17.6, 18.9, 20.3, 21.4, 21.9)]
        ys = (16.7, 17.6, 18.9, 20.3, 21.4, 21.9)
        s.add(g_tube([(r * math.sin(a), y, r * math.cos(a)) for r, y in zip(pts, ys)], 0.035, 4), STEEL_D, mat='Metal')
    s.add(g_torus(2.24, 0.14, 28, 6), STEEL, T(0, 16.42, 0), mat='Metal', smooth=True, jit=0.02)
    s.rivets(2.37, 16.42, 24, 0.055, CHROME)
    porthole(s, T(0, 18.3, 1.86) @ RX(-0.29), 0.42, frame=CHROME, glow='Glow_Cool', rivets=6)
    s.add(g_lathe([(0.24, 21.9), (0.13, 22.3), (0.045, 22.9), (0.0, 23.0)], 8), CHROME, mat='Metal', smooth=True)
    s.add(g_sphere(0.1, 8, 6), CHROME, T(0, 23.05, 0), mat='Metal', smooth=True)
    tri = [(0.05, 22.86, 0.0), (0.05, 22.46, 0.0), (0.85, 22.6, 0.07)]
    s.add((tri, [[0, 1, 2]]), RED); s.add((tri, [[2, 1, 0]]), RED)

    # ---------------- windows
    for y in (11.4, 13.4):
        porthole(s, T(0, y, hr(y) + 0.06) @ RX(-0.09), 0.62, frame=STEEL, glow='Glow_Cool')
    for a in (-1.95, 1.95, PI):
        porthole(s, T(*on_hull(a, 12.4, 0.05)) @ RY(a) @ RX(-0.07), 0.48, frame=STEEL, glow='Glow_Cool', rivets=6)

    # ---------------- door, landing, ladder, cargo basket (no crane: the landing film looks down from the window above)
    s.box(1.9, 2.5, 0.5, FRAME, at=(0, 8.05, 2.66), bevel=0.06)
    for i in range(4):
        s.box(0.36, 2.0, 0.08, DOOR, at=(-0.57 + i * 0.38, 8.02, 2.93), jit=0.07, fjit=0.02)
    for y in (7.4, 8.9): s.box(1.52, 0.11, 0.04, DARK, at=(0, y, 2.985))
    porthole(s, T(0, 8.35, 2.99), 0.25, frame=CHROME, glow='Glow_Cool', rivets=6)
    s.add(g_torus(0.08, 0.02, 10, 4), CHROME, T(0.5, 7.85, 3.0) @ RX(PI / 2), mat='Metal')
    s.box(2.1, 0.07, 0.5, BLUESTEEL, at=(0, 9.38, 2.92), rot=(0.32, 0, 0), mat='Metal')    # short hood: the landing film looks down past it
    for i in range(5):
        s.box(2.0, 0.1, 0.19, rng.choice(PANELS), at=(0, 6.93, 2.82 + i * 0.2), jit=0.08)
    for sx in (-1, 1):
        beam(s, (sx * 0.85, 6.88, 3.62), (sx * 0.85, 6.0, 2.8), 0.1, 0.1, FRAME)
        s.box(0.09, 1.0, 0.09, FRAME, at=(sx * 0.96, 7.45, 3.66))
        beam(s, (sx * 0.96, 7.9, 2.9), (sx * 0.96, 7.9, 3.7), 0.07, 0.07, FRAME)
        s.add(g_tube([(sx * 0.96, 7.9, 3.66), (sx * 0.7, 7.62, 3.68), (sx * 0.44, 7.9, 3.66)], 0.022, 4), CABLE)
    ladder(s, (0, 0.3, 3.98), (0, 6.98, 3.74), width=0.82, rungs=15)
    beam(s, (1.15, 9.0, 2.7), (1.15, 9.0, 3.3), 0.06, 0.06, FRAME_D)
    beam(s, (1.15, 8.98, 3.24), (1.15, 8.86, 3.24), 0.015, 0.015, DARK)
    lantern(s, T(1.15, 8.38, 3.24), 1.0)
    # cargo basket: an open slatted bin
    s.push(T(0, 0.3, 4.9))
    BSK = PANEL_L
    s.box(1.7, 0.08, 1.7, FRAME, at=(0, 0.04, 0))
    for sx in (-1, 1):
        for i in range(3):
            s.box(0.09, 0.3, 1.7, BSK, at=(sx * 0.81, 0.2 + i * 0.33, 0), jit=0.08)
            s.box(1.7, 0.3, 0.09, BSK, at=(0, 0.2 + i * 0.33, sx * 0.81), jit=0.08)
        for sz in (-1, 1): s.box(0.15, 1.08, 0.15, FRAME, at=(sx * 0.81, 0.54, sz * 0.81), bevel=0.02)
    s.pop()

    # ---------------- engine
    s.add(g_cyl(2.1, 2.1, 0.14, 22), DARK, T(0, 3.22, 0))
    s.add(g_cyl(1.5, 1.25, 0.4, 14), STEEL_D, T(0, 2.9, 0), mat='Metal')
    s.add(g_lathe([(2.0, 1.45), (1.9, 1.75), (1.55, 2.5), (1.15, 3.1), (1.0, 3.5)], 18, caps=False), STEEL, mat='Metal', smooth=True, jit=0, fjit=0.012)
    s.add(g_lathe([(0.93, 3.5), (1.08, 3.1), (1.47, 2.5), (1.82, 1.75), (1.93, 1.45)], 18, caps=False), 0x2A2C30, smooth=True, jit=0)
    s.add(g_torus(1.97, 0.075, 18, 5), STEEL_D, T(0, 1.45, 0), mat='Metal')
    s.add(g_torus(1.72, 0.05, 18, 4), STEEL_D, T(0, 2.2, 0), mat='Metal')
    s.add(g_torus(1.3, 0.05, 18, 4), STEEL_D, T(0, 2.9, 0), mat='Metal')
    for k in range(4):
        a = k * PI / 2
        s.add(g_lathe([(0.36, 2.3), (0.3, 2.66), (0.2, 3.02), (0.18, 3.3)], 8), STEEL_D, T(math.sin(a) * 1.66, 0, math.cos(a) * 1.66), mat='Metal', smooth=True)

    # ---------------- fins that carry the landing legs
    for k in range(4):
        a = PI / 4 + k * PI / 2
        s.push(RY(a - PI / 2))                                   # local +x points outward
        s.add(g_prism([(2.6, 9.3), (2.80, 9.3), (3.25, 7.9), (3.775, 6.3), (2.6, 6.3)], 0.24), FRAME, jit=0.04)
        s.add(g_prism([(2.6, 6.3), (3.775, 6.3), (4.30, 4.7), (4.50, 2.5), (3.95, 2.8), (3.3, 4.3), (2.4, 4.1)], 0.24), rng.choice(PANELS), jit=0.06)
        s.add(g_prism([(2.6, 6.45), (3.73, 6.45), (3.82, 6.15), (2.6, 6.15)], 0.27), ORANGE, jit=0.02)
        edge = [(2.80, 9.36), (3.3, 7.9), (4.36, 4.7), (4.56, 2.5)]
        for p0, p1 in zip(edge, edge[1:]):
            beam(s, (p0[0], p0[1], 0), (p1[0], p1[1], 0), 0.12, 0.32, TIN, mat='Metal', jit=0.04)
        beam(s, (2.25, 3.62, 0), (4.15, 2.78, 0), 0.2, 0.2, FRAME)
        for kk in range(3): s.add(g_torus(0.15, 0.03, 6, 4), CABLE, T(3.9 + kk * 0.07, 2.89 - kk * 0.031, 0) @ RZ(1.15))
        s.add(g_cyl(0.24, 0.24, 0.75, 8), DARK, T(4.42, 2.1, 0))
        s.add(g_cyl(0.13, 0.15, 1.75, 8), TIN, T(4.42, 0.5, 0), mat='Metal', smooth=True)
        s.add(g_sphere(0.2, 8, 6), STEEL, T(4.42, 0.56, 0), mat='Metal', smooth=True)
        s.add(g_cyl(0.78, 0.62, 0.22, 10, bevel=0.05), STEEL_D, T(4.42, 0.3, 0), mat='Metal')
        s.pop()

    # ---------------- pipe up the side
    ap = -1.0
    pts = [on_hull(ap, 4.5, -0.15)] + [on_hull(ap, y, 0.17) for y in (4.9, 6.5, 9.0, 12.0, 13.9)] + [on_hull(ap, 14.25, -0.15)]
    s.add(g_tube(pts, 0.09, 6), STEEL, mat='Metal', smooth=True)
    for y in (6.5, 9.0, 12.0):
        s.add(g_box(0.3, 0.14, 0.14), STEEL_D, T(*on_hull(ap, y, 0.12)) @ RY(ap), mat='Metal')
    return s.build(coll, parent=root, ao=0.25, ao_range=(0.0, 12.0))


def build_pad(coll, root):
    p = Part('rocket_pad', 2)
    rng = p.rng
    p.add(g_lathe([(12.0, -0.15), (11.6, 0.26), (0.0, 0.26)], 40), shade(CONCRETE, 0.5), jit=0)
    p.add(g_lathe([(12.02, -0.15), (11.62, 0.3), (11.2, 0.3)], 40, caps=False), shade(CONCRETE, 0.8), fjit=0.07)
    rings = [(11.15, 9.5, 40, CONCRETE), (8.95, 6.7, 32, CONCRETE), (6.65, 4.3, 24, shade(CONCRETE, 0.9)), (4.25, 1.9, 16, shade(CONCRETE, 0.72))]
    for i, (ro, ri, n, col) in enumerate(rings):
        p.add(g_lathe([(ro, 0.3), (ri, 0.3)], n, az0=i * 0.07, caps=False), col, jit=0, fjit=0.09)
    p.add(g_lathe([(1.85, 0.3), (0.0, 0.3)], 12, caps=False), shade(CONCRETE, 0.5), jit=0, fjit=0.05)
    p.add(g_lathe([(9.42, 0.31), (9.03, 0.31)], 48, caps=False), 0, mat='Glow_Gold')
    return p.build(coll, parent=root, ao=0.0, top=0.0)


def build_gantry(coll, root):
    g = Part('rocket_gantry', 3)
    rng = g.rng
    O = (-5.6, 0.0, -1.5)
    g.push(T(*O))
    for sx in (-1, 1):
        for sz in (-1, 1):
            g.box(0.19, 17.0, 0.19, rng.choice(PANELS), at=(sx * 0.62, 8.5, sz * 0.62), jit=0.07)
    lv = [1.5 + i * 2.2 for i in range(8)]
    for i, y in enumerate(lv):
        for s in (-1, 1):
            beam(g, (-0.7, y, s * 0.62), (0.7, y, s * 0.62), 0.12, 0.12, rng.choice(PANELS), jit=0.08)
            beam(g, (s * 0.62, y, -0.7), (s * 0.62, y, 0.7), 0.12, 0.12, rng.choice(PANELS), jit=0.08)
        if i < len(lv) - 1:
            d = 1 if i % 2 else -1
            beam(g, (-0.62 * d, y, -0.66), (0.62 * d, y + 2.2, -0.66), 0.07, 0.07, FRAME, jit=0.06)
            beam(g, (0.62 * d, y, 0.66), (-0.62 * d, y + 2.2, 0.66), 0.07, 0.07, FRAME, jit=0.06)
            beam(g, (-0.66, y, 0.62 * d), (-0.66, y + 2.2, -0.62 * d), 0.07, 0.07, FRAME, jit=0.06)
            beam(g, (0.66, y, -0.62 * d), (0.66, y + 2.2, 0.62 * d), 0.07, 0.07, FRAME, jit=0.06)
    for i in range(6):
        g.box(0.3, 0.09, 1.86, rng.choice(PANELS), at=(-0.78 + i * 0.312, 16.95, 0), jit=0.08)
    g.add(g_cyl(0.2, 0.28, 0.16, 8), STEEL, T(0, 17.0, 0), mat='Metal')
    ladder(g, (0, 0.3, 0.76), (0, 16.9, 0.76), width=0.5, rungs=30, col=FRAME, rail=0.06)
    # swing arm reaching for the hull, with a fuel hose
    beam(g, (0.6, 10.9, 0.16), (2.25, 10.9, 0.6), 0.17, 0.17, PANELS[1])
    beam(g, (0.66, 9.3, 0.18), (1.9, 10.8, 0.5), 0.1, 0.1, FRAME)
    g.add(g_tube([(2.2, 10.82, 0.59), (2.5, 10.15, 0.67), (2.75, 10.05, 0.73), (2.93, 10.3, 0.78)], 0.075, 6), DARK, smooth=True)
    g.add(g_tube([(0.7, 10.75, 0.3), (1.4, 10.6, 0.42), (2.2, 10.82, 0.59)], 0.06, 5), DARK, smooth=True)
    # stores at the foot of the tower
    barrel(g, T(1.3, 0.3, -0.25), col=BLUESTEEL, hoop=TIN)
    barrel(g, T(1.22, 0.3, 0.62) @ RY(0.8), r=0.33, h=0.82)
    crate(g, T(-0.15, 0.3, 1.5) @ RY(0.2), 0.9, 0.6, 0.7)
    g.pop()
    go = g.build(coll, origin=O, parent=root, ao=0.22, ao_range=(0.0, 9.0))
    t = Part('rocket_towerLight', 4)
    t.add(g_sphere(0.24, 10, 8), 0, T(O[0], 17.3, O[2]), mat='Glow_Red', smooth=True)
    t.build(coll, origin=(O[0], 17.3, O[2]), parent=go, ao=0)
    return go


def build():
    coll = collection('A_rocket')
    root = empty('Rocket', coll)
    build_ship(coll, root)
    build_pad(coll, root)
    build_gantry(coll, root)
    return {'tris': stats('A_rocket')['tris']}


RESULT = build()
