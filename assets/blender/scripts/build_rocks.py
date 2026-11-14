"""Rocks, pebbles and ice crystals. Unit-sized (radius ~1 m) so the game can scale them per boulder.
Vertex colours are neutral light/dark values; the 'Rock' material multiplies them by a tint, so the
game can recolour the same rocks for the Moon (grey) or Mars (rust) with material.color."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *


def rock_col(c, n):
    t = n.y
    if t > 0.6: base = 0xFFFAF2
    elif t > 0.15: base = 0xC4C3D0
    elif t > -0.35: base = 0x9494AA
    else: base = 0x66667E
    return shade(base, 0.95 + 0.05 * math.sin(c.y * 8.0 + c.x * 2.0))


def xgeo(geo, M):
    return [tuple(M @ Vector(v)) for v in geo[0]], geo[1]


def rock(p, seed, M=None, **kw):
    geo = g_rock(seed=seed, **kw)
    if M is not None: geo = xgeo(geo, M)
    p.add(geo, rock_col, mat='Rock', fjit=0.045)


def build():
    coll = collection('A_rocks')
    root = empty('Rocks', coll)
    out = []
    specs = [
        ('Rock_A', dict(seed=11, detail=3, cuts=13, squash=(1.0, 0.82, 0.95))),
        ('Rock_B', dict(seed=23, detail=3, cuts=15, squash=(0.72, 1.45, 0.7), flat_base=0.5)),
        ('Rock_C', dict(seed=37, detail=3, cuts=11, squash=(1.3, 0.46, 1.05), flat_base=0.16)),
        ('Rock_D', dict(seed=41, detail=3, cuts=20, rough=0.1, squash=(0.95, 0.95, 0.9))),
    ]
    for i, (name, kw) in enumerate(specs):
        p = Part(name, seed=i + 1)
        base = kw.get('flat_base', 0.35)
        rock(p, M=T(0, base - 0.12, 0), **kw)
        out.append(p)
    # leaning shard
    p = Part('Rock_E', 5)
    rock(p, 53, M=T(0.1, 0.7, 0) @ ROT(0.0, 0.4, 0.42), cuts=14, squash=(0.55, 1.55, 0.6), flat_base=0.9)
    rock(p, 54, M=T(-0.55, 0.12, 0.3) @ SC(0.42), cuts=8, squash=(1.0, 0.7, 1.0))
    out.append(p)
    # cluster of three
    p = Part('Rock_F', 6)
    rock(p, 61, M=T(-0.35, 0.3, -0.1) @ SC(0.8), cuts=10, squash=(1.0, 0.9, 1.0))
    rock(p, 62, M=T(0.62, 0.16, 0.25) @ ROT(0, 1.1, 0) @ SC(0.52), cuts=9, squash=(1.1, 0.75, 0.9))
    rock(p, 63, M=T(0.1, 0.08, 0.72) @ ROT(0, 2.3, 0) @ SC(0.34), cuts=8, squash=(1.2, 0.6, 1.0))
    out.append(p)
    # scattered pebbles
    p = Part('Pebbles', 7)
    r = random.Random(7)
    for k in range(7):
        a = k * 2.4; d = 0.25 + 0.75 * math.sqrt(k / 7)
        s = r.uniform(0.1, 0.24)
        rock(p, 70 + k, M=T(math.cos(a) * d, s * 0.25, math.sin(a) * d) @ ROT(0, r.uniform(0, 6), 0) @ SC(s), detail=1, cuts=6, squash=(1.1, 0.7, 0.9))
    out.append(p)
    # ice crystals (glowing, for the ice crater)
    p = Part('IceCrystals', 8)
    r = random.Random(8)
    for k, (x, z, h, rad, tilt) in enumerate([(0, 0, 1.25, 0.34, 0.06), (0.45, 0.12, 0.8, 0.24, 0.42), (-0.4, 0.2, 0.68, 0.22, -0.48),
                                              (0.1, -0.42, 0.56, 0.2, 0.3), (-0.18, 0.5, 0.4, 0.16, -0.2), (0.5, -0.36, 0.36, 0.14, 0.6)]):
        prof = [(rad * 0.82, -0.15), (rad, h * 0.25), (rad * 0.9, h * 0.72), (0.0, h)]
        az = r.uniform(0, TAU)
        p.add(g_lathe(prof, 6), 0xDFF7FF, T(x, 0, z) @ RY(az) @ RZ(tilt) @ RY(r.uniform(0, 1)), mat='Ice', jit=0, fjit=0)
    out.append(p)

    res = {}
    for i, p in enumerate(out):
        o = p.build(coll, parent=root, ao=0.28, top=0.0)
        o.location.x = (i - (len(out) - 1) / 2) * 3.2
        res[p.name] = p.tris()
    return res


RESULT = build()
