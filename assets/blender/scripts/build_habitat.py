"""The habitat: a panelled steel dome with ribs on a concrete footing, with a porch airlock, pantry chute and a
telescope through the roof. Footprint and key points match hab() in js/base.js:
dome radius 5.3 on a 1.3 m footing, airlock x +-1.5 / z 4.6..8.8 with the door at z = 8.83,
windows at the same five bearings, pantry hopper rim at (5.9, 2.9, 1.2), beacon at y = 9.2.
Nodes: hab_main (everything static), hab_doorLight (own material, turns red in storms), hab_beacon."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *


R = 5.3; Y0 = 1.3


def dp(t, r=R):
    return (r * math.cos(t), Y0 + r * math.sin(t))


def on_dome(a, t, r=R):
    rr, y = dp(t, r)
    return Vector((rr * math.sin(a), y, rr * math.cos(a)))


def dome_n(a, t):
    return Vector((math.cos(t) * math.sin(a), math.sin(t), math.cos(t) * math.cos(a)))


def build():
    coll = collection('A_habitat')
    root = empty('Habitat', coll)
    h = Part('hab_main', 1)
    rng = h.rng

    # ---------------- footing: two staggered courses of concrete blocks, steel sill on top
    for geo in g_staves([(5.82, -0.1), (5.76, 0.64)], 20, gap=0.07, thick=0.4): h.add(geo, CONCRETE, jit=0.09, fjit=0.02)
    for geo in g_staves([(5.72, 0.67), (5.6, 1.3)], 20, gap=0.07, thick=0.4, az0=TAU / 40): h.add(geo, CONCRETE, jit=0.09, fjit=0.02)
    h.add(g_lathe([(5.56, -0.1), (5.42, 1.29)], 20, caps=False), shade(CONCRETE, 0.42), jit=0)
    h.add(g_lathe([(5.2, 1.3), (5.64, 1.3), (5.64, 1.47), (5.2, 1.47)], 28), FRAME, jit=0.03, fjit=0.05)

    # ---------------- dome: dark under-shell, rows of steel panels between ribs, a few patch panels
    NS, NC, TMAX = 14, 7, math.radians(74)
    da = TAU / NS
    h.add(g_lathe([dp(0.02 + (TMAX - 0.02) * i / 10, R - 0.07) for i in range(11)], 28, caps=False), UNDER, smooth=True, jit=0, fjit=0)
    for k in range(NS):
        for j in range(NC):
            t0 = TMAX * j / NC + 0.007; t1 = TMAX * (j + 1) / NC - 0.007
            u = rng.random()
            if u < 0.09: col, mat = TIN, 'Metal'
            elif u < 0.16: col, mat = LIGHT, 'Paint'
            else: col, mat = rng.choice(PANELS), 'Paint'
            h.add(g_lathe([dp(t0), dp((t0 + t1) / 2, R + 0.025), dp(t1)], 2, az0=k * da + 0.03, sweep=da - 0.06, caps=False),
                  col, mat=mat, jit=0.07, fjit=0.012)
    for k in range(NS):
        a = k * da
        pts = [on_dome(a, (TMAX + 0.06) * i / 9, R - 0.03) for i in range(10)]
        nrm = [dome_n(a, (TMAX + 0.06) * i / 9) for i in range(10)]
        h.add(g_ribbon(pts, nrm, 0.2, 0.17), FRAME, jit=0.06, fjit=0.02)
    tb = TMAX * 4 / NC                                                   # steel strap round the dome, riveted at each rib
    rb, yb = dp(tb, R + 0.11)
    h.add(g_torus(rb, 0.05, 42, 4), STEEL, T(0, yb, 0), mat='Metal', jit=0.02)
    h.rivets(rb + 0.05, yb, NS, 0.06, CHROME)

    # ---------------- crown, mast and aerial
    rc, yc = dp(TMAX)
    h.add(g_lathe([(rc + 0.14, yc - 0.07), (rc + 0.17, yc + 0.05), (1.05, 6.6), (0.5, 6.76), (0.0, 6.8)], 16), STEEL, mat='Metal', smooth=True, jit=0)
    h.rivets(rc + 0.18, yc, 14, 0.055, CHROME, az0=da / 2)
    h.add(g_cyl(0.2, 0.15, 0.3, 8), STEEL_D, T(0, 6.72, 0), mat='Metal')
    h.add(g_tube([(0, 6.9, 0), (0.015, 8.0, 0.01), (0, 9.02, 0)], lambda t: 0.075 - 0.03 * t, 6), STEEL, mat='Metal', smooth=True)
    beam(h, (-0.7, 8.25, 0), (0.7, 8.25, 0), 0.035, 0.035, STEEL, mat='Metal')
    beam(h, (-0.45, 8.62, 0), (0.45, 8.62, 0), 0.03, 0.03, STEEL, mat='Metal')
    for x in (-0.7, 0.7): beam(h, (x, 8.25, 0), (x * 0.64, 8.62, 0), 0.02, 0.02, STEEL, mat='Metal')
    for k in range(3): h.add(g_torus(0.07, 0.014, 6, 4), CABLE, T(0, 8.2 + k * 0.03, 0))
    h.add(g_cyl(0.13, 0.17, 0.09, 8), STEEL, T(0, 8.98, 0), mat='Metal')

    # ---------------- porthole windows (same bearings and height as the game's glowing windows)
    tw = math.asin((3.9 - Y0) / R)
    for a in (-1.25, -0.55, 0.55, 2.4, 3.6):
        pos = on_dome(a, tw, R + 0.05)
        M = T(*pos) @ RY(a) @ RX(-tw)
        h.add(g_cyl(0.84, 0.84, 0.1, 12), FRAME_D, M @ T(0, 0, -0.14) @ RX(PI / 2), jit=0.03)
        porthole(h, M, 0.62, frame=STEEL)

    # ---------------- telescope through the roof (front right) and a stove pipe (back left)
    at, tt = 1.25, math.radians(57)
    ps = on_dome(at, tt); nn = dome_n(at, tt)
    dirv = dome_n(at, math.radians(47))
    h.add(g_box(1.5, 0.34, 1.5, 0.04), FRAME, T(*(ps + nn * 0.1)) @ ALIGN(nn) @ RY(0.3), jit=0.05)
    h.add(g_box(1.2, 0.3, 1.2, 0.03), STEEL_D, T(*(ps + nn * 0.22)) @ ALIGN(nn) @ RY(0.3), mat='Metal')
    Mt = T(*(ps - dirv * 0.5)) @ ALIGN(dirv)
    h.add(g_lathe([(0.34, 0.0), (0.34, 2.0), (0.4, 2.03), (0.4, 2.9), (0.46, 2.93), (0.46, 3.3), (0.39, 3.3), (0.39, 3.18)], 12), CHROME, Mt, mat='Metal', smooth=True, jit=0)
    h.add(g_cyl(0.395, 0.395, 0.03, 12), 0, Mt @ T(0, 3.17, 0), mat='DarkGlass')
    for y in (1.0, 2.0, 2.9): h.add(g_torus(0.36 if y < 2 else 0.42, 0.04, 12, 4), STEEL, Mt @ T(0, y, 0), mat='Metal')
    h.add(g_cyl(0.07, 0.07, 0.9, 6), STEEL_D, Mt @ T(0.42, 1.2, 0), mat='Metal')            # finder scope
    asp, tsp = -2.0, math.radians(40)
    p0 = on_dome(asp, tsp, R - 0.2); n0 = dome_n(asp, tsp)
    p1 = p0 + n0 * 0.75; p2 = p1 + n0 * 0.25 + Vector((0, 0.3, 0)); p3 = p2 + Vector((0, 1.5, 0))
    h.add(g_tube([p0, p1, p2, p3], 0.17, 8), STEEL, mat='Metal', smooth=True)
    h.add(g_torus(0.19, 0.035, 8, 4), STEEL_D, T(*p2), mat='Metal')
    h.add(g_lathe([(0.34, 0.0), (0.2, 0.2), (0.0, 0.3)], 8), BLUESTEEL, T(*(p3 + Vector((0, 0.12, 0)))), mat='Metal')
    for k in range(3):
        aa = k * TAU / 3
        beam(h, p3 + Vector((math.cos(aa) * 0.15, -0.02, math.sin(aa) * 0.15)), p3 + Vector((math.cos(aa) * 0.22, 0.14, math.sin(aa) * 0.22)), 0.025, 0.025, STEEL_D, mat='Metal')

    # ---------------- airlock porch
    for sx in (-1, 1):
        z = 4.85
        while z < 8.72:
            w = min(0.31 + rng.uniform(-0.04, 0.04), 8.74 - z)
            hg = 2.5 + rng.uniform(-0.02, 0.06)
            h.box(0.13, hg, w - 0.025, rng.choice(PANELS), at=(sx * 1.5, hg / 2, z + w / 2), jit=0.08, fjit=0.02)
            z += w
        h.box(0.24, 2.72, 0.24, FRAME, at=(sx * 1.5, 1.36, 8.8), bevel=0.03)              # corner post
        h.box(0.2, 2.36, 0.2, FRAME, at=(sx * 0.92, 1.18, 8.8), bevel=0.025)              # door post
        h.box(0.4, 2.36, 0.11, rng.choice(PANELS), at=(sx * 1.21, 1.18, 8.78), jit=0.08)    # panel beside the door
        beam(h, (sx * 1.56, 2.5, 4.9), (sx * 1.56, 2.5, 8.95), 0.16, 0.16, FRAME)         # wall plate
        porthole(h, T(sx * 1.585, 1.55, 6.9) @ RY(sx * PI / 2), 0.34, frame=STEEL, rivets=6)
    h.box(2.1, 0.22, 0.24, FRAME, at=(0, 2.46, 8.8), bevel=0.03)                          # lintel
    h.box(3.3, 0.2, 0.26, FRAME, at=(0, 2.62, 8.82), bevel=0.03)                          # tie beam
    h.box(1.9, 0.1, 0.5, FRAME_D, at=(0, 0.03, 8.95), bevel=0.02)                          # threshold
    x = -1.42
    while x < 1.42:                                                                       # gable boards under the curved roof
        w = min(0.3, 1.42 - x); xc = x + w / 2
        top = 2.45 + 0.55 * math.sqrt(max(0.0, 1.85 ** 2 - xc ** 2)) - 0.1
        if top > 2.74: h.box(w - 0.02, top - 2.7, 0.1, rng.choice(PANELS), at=(xc, (top + 2.7) / 2, 8.78), jit=0.08)
        x += w
    Mr = T(0, 2.5, 9.15) @ SC(1, 0.55, 1) @ RX(-PI / 2)                                     # barrel roof of tin sheets
    for i, geo in enumerate(g_staves([(1.88, 0.0), (1.88, 4.4)], 9, gap=0.04, thick=0.08, az0=-PI / 2, sweep=PI)):
        h.add(geo, STEEL if i == 6 else BLUESTEEL, Mr, mat='Metal', jit=0.06, fjit=0.015)
    for zz in (0.06, 2.1, 4.2):
        h.add(g_torus(1.9, 0.055, 14, 4, az0=-PI / 2, sweep=PI), BLUESTEEL_D, Mr @ T(0, zz, 0), mat='Metal')
    # door: five boards, iron straps, porthole, ring handle
    for i in range(5):
        h.box(0.3, 2.2, 0.09, DOOR, at=(-0.64 + i * 0.32, 1.17, 8.84), jit=0.07, fjit=0.02)
    for y in (0.5, 1.95):
        h.box(1.5, 0.12, 0.04, DARK, at=(0, y, 8.9))
        for xx in (-0.6, -0.2, 0.2, 0.6): h.add(g_lathe([(0.03, 0), (0.02, 0.02), (0, 0.03)], 5), TIN, T(xx, y, 8.92) @ RX(PI / 2), mat='Metal', jit=0)
    porthole(h, T(0, 1.42, 8.9), 0.27, frame=CHROME, rivets=6)
    h.add(g_torus(0.085, 0.02, 10, 4), CHROME, T(0.56, 1.02, 8.93) @ RX(PI / 2), mat='Metal')
    h.box(1.9, 0.07, 0.36, FRAME, at=(0, 2.83, 9.02), rot=(0.25, 0, 0))                   # hood over the door light
    beam(h, (1.5, 2.3, 8.9), (1.5, 2.3, 9.4), 0.06, 0.06, FRAME_D)                         # lantern bracket
    beam(h, (1.5, 2.28, 9.34), (1.5, 2.14, 9.34), 0.015, 0.015, DARK)
    lantern(h, T(1.5, 1.66, 9.34), 1.0)

    # ---------------- pantry chute on the east side
    Mp = T(5.72, 0, 1.2)
    crate(h, Mp, 1.7, 1.9, 1.5, col=PANELS[0], band=FRAME)
    h.box(1.86, 0.1, 1.66, BLUESTEEL, at=(5.72, 1.95, 1.2), mat='Metal')
    h.box(1.1, 0.42, 0.06, 0, at=(5.72, 1.3, 1.975), mat='Glow_Green')
    h.box(1.26, 0.58, 0.05, FRAME_D, at=(5.72, 1.3, 1.96))
    h.add(g_lathe([(0.45, 1.95), (1.0, 2.9)], 16, caps=False), STEEL, T(5.9, 0, 1.2), mat='Metal', smooth=True, jit=0)
    h.add(g_lathe([(0.93, 2.89), (0.4, 1.97)], 16, caps=False), STEEL_D, T(5.9, 0, 1.2), mat='Metal', smooth=True, jit=0)
    h.add(g_torus(1.0, 0.085, 20, 6), 0, T(5.9, 2.9, 1.2), mat='Glow_Green', smooth=True)

    # ---------------- things lying about: barrel, crates, a ladder up the roof
    barrel(h, T(-2.36, 0, 5.78))
    barrel(h, T(-3.02, 0, 5.36) @ RY(0.6), r=0.33, h=0.8, col=BLUESTEEL)
    crate(h, T(2.5, 0, 5.82) @ RY(0.25), 0.9, 0.7, 0.8)
    crate(h, T(2.46, 0.72, 5.8) @ RY(-0.3), 0.55, 0.45, 0.5, col=PANEL_L)
    ag = -0.92
    ladder(h, (6.38 * math.sin(ag), 0, 6.38 * math.cos(ag)), on_dome(ag, 0.78, R + 0.2), width=0.6, rungs=9)

    main = h.build(coll, parent=root, ao=0.26, ao_range=(0, 5.0))

    # ---------------- game-driven lights
    d = Part('hab_doorLight', 2)
    d.box(1.5, 0.17, 0.1, 0, at=(0, 2.66, 8.97), mat='Glow_Door')
    d.build(coll, origin=(0, 2.66, 8.97), parent=root, ao=0)
    bc = Part('hab_beacon', 3)
    bc.add(g_sphere(0.2, 10, 8), 0, T(0, 9.2, 0), mat='Glow_Red', smooth=True)
    bc.build(coll, origin=(0, 9.2, 0), parent=root, ao=0)
    return {'tris': stats('A_habitat')['tris']}


RESULT = build()
