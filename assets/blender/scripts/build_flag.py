"""Flags. 'Flag' is the big one by the habitat (pole 4.4 m, cloth 1.6 x 1.0 m, same spot as in js/base.js);
'FlagMarker' is the small one planted at finished science sites. The cloth is its own node, hinged on
the pole, so the game can keep waving it with rotation.y."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *


def rock_col(c, n):
    t = n.y
    base = 0xFFFAF2 if t > 0.6 else 0xC4C3D0 if t > 0.15 else 0x9494AA if t > -0.35 else 0x66667E
    return base


def flag(coll, root, prefix, H, cw, ch, main, stripe, emblem=True, seed=1):
    p = Part(prefix + '_pole', seed)
    r0 = 0.075 * (0.6 + 0.4 * H / 4.4); r1 = r0 * 0.72
    # pole: slightly crooked sapling, in two tones
    pts = [(0, -0.1, 0), (0.012, H * 0.3, 0.008), (-0.01, H * 0.62, -0.006), (0.0, H, 0.0)]
    p.add(g_tube(pts, lambda t: r0 + (r1 - r0) * t, 7), TIN, mat='Metal', smooth=True, fjit=0.02)
    p.add(g_sphere(r1 * 1.9, 8, 6), CHROME, T(0, H + r1 * 1.3, 0), mat='Metal', smooth=True)
    p.add(g_cyl(r1 * 1.5, r1 * 1.2, r1 * 0.9, 8), CHROME, T(0, H - r1 * 0.2, 0), mat='Metal')
    # cable lashings where the cloth is tied on, and a wrap low on the pole
    for y in (H - 0.08, H - 0.08 - ch * 0.5, H - 0.08 - ch):
        for k in range(3):
            p.add(g_torus(r1 * 1.18, 0.014, 8, 4), CABLE, T(0, y - 0.025 + k * 0.025, 0), jit=0.03)
    for k in range(4):
        p.add(g_torus(r0 * 1.08, 0.016, 8, 4), CABLE, T(0, H * 0.22 + k * 0.03, 0), jit=0.03)
    # cairn of stones holding it up
    rr = random.Random(seed)
    for k in range(5):
        a = k * TAU / 5 + 0.3; s = (0.2 + 0.1 * rr.random()) * (0.55 + 0.45 * H / 4.4)
        geo = g_rock(seed=seed * 10 + k, detail=1, cuts=7, squash=(1.1, 0.8, 0.9))
        M = AZ(a, s * 1.15, s * 0.3) @ RY(rr.uniform(0, 6)) @ SC(s)
        p.add(([tuple(M @ Vector(v)) for v in geo[0]], geo[1]), rock_col, mat='Rock', fjit=0.04)
    pole = p.build(coll, parent=root, ao=0.25, ao_range=(0, H * 0.5))

    # cloth: hangs off the +x side of the pole, swallow-tailed, gently rippled
    c = Part(prefix + '_cloth', seed + 1)
    x0 = r1 + 0.01
    nx, ny = 12, 6

    def wave(u, v):
        dz = 0.085 * cw / 1.6 * math.sin(u * 7.5 + v * 1.4) * u * u + 0.03 * math.sin(u * 15 + 1.0) * u * u
        dx = -0.26 * cw / 1.6 * max(0.0, 1 - abs(2 * v - 1) * 1.5) * max(0.0, (u - 0.72) / 0.28) ** 2    # swallow tail
        dy = -0.07 * ch * u * u + 0.02 * math.sin(u * 9) * u
        return (dx, dy, dz)

    def colr(ctr, n):
        u = ctr.x / cw; v = ctr.y / ch + 0.5
        if u < 0.1: return stripe
        if v > 0.84 or v < 0.16: return shade(main, 0.84)
        return main

    c.add(g_grid(cw, ch, nx, ny, wave), colr, T(x0, H - 0.08 - ch / 2, 0), mat='Cloth', fjit=0.012, smooth=True)
    if emblem:      # a ringed planet, stitched on both sides near the hoist where the cloth is flattest
        for sz in (1, -1):
            M = T(x0 + cw * 0.33, H - 0.08 - ch / 2 - 0.012, sz * 0.03) @ RX(sz * PI / 2)
            c.add(g_cyl(ch * 0.22, ch * 0.22, 0.008, 14), LIGHT, M, mat='Cloth', jit=0, fjit=0)
            c.add(g_torus(ch * 0.33, ch * 0.028, 18, 4), 0x55707F, M @ T(0, 0.006, 0) @ RY(0.5) @ SC(1, 0.3, 0.42), mat='Cloth', jit=0, fjit=0)
    cl = c.build(coll, origin=(0, H - 0.08 - ch / 2, 0), parent=root, ao=0.0, top=0.0)
    return pole, cl


def build():
    coll = collection('A_flag')
    root = empty('Flag', coll)
    flag(coll, root, 'flag', 4.4, 1.6, 1.0, 0xE8553D, LIGHT, True, 3)
    coll2 = collection('A_flag_marker')
    root2 = empty('FlagMarker', coll2)
    flag(coll2, root2, 'marker', 2.2, 0.8, 0.5, 0x46D97B, LIGHT, False, 5)
    root2.location.x = 3.0
    return {'flag': stats('A_flag')['tris'], 'marker': stats('A_flag_marker')['tris']}


RESULT = build()
