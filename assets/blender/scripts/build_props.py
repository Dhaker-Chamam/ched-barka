"""Small props. The carryable ones are centred on their origin and sized like itemMesh() in js/actors.js
(the game moves them by their centre): PowerCell, FoodCrate, SupplyCase, SoilBag, CoreSample, Instrument.
Standing props have their origin on the ground: PathLantern, SolarPanel (post + tilting panel), Telescope."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *


def one(coll_name, root_name, part_name, fn, ao=0.2, **kw):
    coll = collection(coll_name)
    root = empty(root_name, coll)
    p = Part(part_name, sum(ord(ch) for ch in part_name))
    extra = fn(p) or []
    main = p.build(coll, parent=root, ao=ao, **kw)
    for (q, origin) in extra:
        q.build(coll, origin=origin, parent=root, ao=0)
    return root


def power_cell(p):
    p.add(g_cyl(0.255, 0.255, 0.56, 12), 0, T(0, -0.28, 0), mat='Glow_Gold')
    for sy in (-1, 1):
        p.add(g_cyl(0.32, 0.3, 0.14, 12, bevel=0.03), STEEL, T(0, 0.26, 0) if sy > 0 else T(0, -0.26, 0) @ RX(PI), mat='Metal')
    for k in range(4):
        a = k * TAU / 4 + PI / 4
        p.box(0.05, 0.56, 0.05, STEEL_D, at=(math.sin(a) * 0.28, 0, math.cos(a) * 0.28), rot=(0, a, 0), mat='Metal')
    p.add(g_cyl(0.12, 0.1, 0.09, 8), CHROME, T(0, 0.4, 0), mat='Metal')
    p.add(g_torus(0.2, 0.025, 12, 4, az0=-PI / 2, sweep=PI), STRAP, T(0, 0.4, 0) @ RX(-PI / 2))


def food_crate(p):
    p.box(0.85, 0.06, 0.62, FRAME, at=(0, -0.22, 0))
    for sz in (-1, 1):
        for y in (-0.12, 0.1): p.box(0.85, 0.19, 0.05, PANELS[0], at=(0, y, sz * 0.285), jit=0.08)
    for sx in (-1, 1):
        for y in (-0.12, 0.1): p.box(0.05, 0.19, 0.62, PANELS[2], at=(sx * 0.4, y, 0), jit=0.08)
        for sz in (-1, 1): p.box(0.07, 0.5, 0.07, FRAME, at=(sx * 0.4, 0, sz * 0.285))
    cols = (0x5FCF5A, 0xE0503C, 0xF0A63A, 0x5FCF5A, 0xE0503C)
    for k in range(5):
        p.add(g_sphere(0.16, 8, 6), cols[k], T(-0.27 + (k % 3) * 0.27, 0.2 + (0.03 if k % 2 else 0), -0.13 if k < 3 else 0.14), mat='Cloth', smooth=True, jit=0.03)
        p.add(g_cyl(0.02, 0.012, 0.07, 5), 0x4F8A3A, T(-0.27 + (k % 3) * 0.27, 0.35, -0.13 if k < 3 else 0.14))


def supply_case(p):
    p.box(1.0, 0.5, 0.7, 0x8F969F, at=(0, 0, 0), bevel=0.05)
    p.box(1.03, 0.07, 0.73, ORANGE, at=(0, 0.07, 0), bevel=0.01)
    for x in (-0.3, 0.3): p.box(0.1, 0.53, 0.73, STRAP, at=(x, 0, 0), bevel=0.012)
    for x in (-0.3, 0.3): p.box(0.12, 0.1, 0.03, CHROME, at=(x, 0.0, 0.37), mat='Metal')
    for sx in (-1, 1):
        for sy in (-1, 1):
            for sz in (-1, 1):
                p.box(0.14, 0.14, 0.14, STEEL, at=(sx * 0.445, sy * 0.195, sz * 0.295), bevel=0.03, mat='Metal')
    p.add(g_torus(0.16, 0.03, 10, 4, az0=-PI / 2, sweep=PI), STRAP, T(0, 0.25, 0) @ RX(-PI / 2))


def soil_bag(p):
    def col(c, n): return 0xFFFFFF if n.y > 0.3 else 0xDAD2C8 if n.y > -0.3 else 0xB0A79C
    p.add(g_sphere(0.5, 9, 6), col, SC(1.15, 0.6, 0.8), mat='Sack', smooth=True, fjit=0.03)
    p.add(g_lathe([(0.1, 0.0), (0.07, 0.1), (0.14, 0.2), (0.0, 0.17)], 7), 0xE6DED4, T(0.52, 0.02, 0) @ RZ(-1.2), mat='Sack')
    for k in range(2): p.add(g_torus(0.085, 0.02, 7, 4), CABLE, T(0.6 + k * 0.03, 0.05 + k * 0.012, 0) @ RZ(-1.2))
    p.box(0.3, 0.012, 0.22, LIGHT, at=(-0.1, 0.298, 0.05), rot=(0, 0.3, 0))        # stencilled label


def core_sample(p):
    p.add(g_cyl(0.13, 0.13, 0.7, 10), 0xC2C8D2, T(0, -0.35, 0), mat='Metal', smooth=True)
    for y in (-0.3, -0.05, 0.2): p.add(g_torus(0.135, 0.018, 10, 4), STEEL_D, T(0, y, 0), mat='Metal')
    q = Part('core_cap', 5)
    q.add(g_cyl(0.155, 0.155, 0.16, 10, bevel=0.025), 0, T(0, 0.28, 0), mat='Glow_Core')
    return [(q, (0, 0.36, 0))]


def instrument(p):
    p.box(0.8, 0.7, 0.8, PANELS[2], at=(0, 0, 0), bevel=0.05)
    for sx in (-1, 1):
        for sz in (-1, 1): p.box(0.1, 0.72, 0.1, FRAME, at=(sx * 0.37, 0, sz * 0.37), bevel=0.015)
    p.add(g_torus(0.2, 0.035, 10, 4, az0=-PI / 2, sweep=PI), STEEL, T(0, 0.35, 0) @ RX(-PI / 2), mat='Metal')
    p.add(g_cyl(0.11, 0.11, 0.03, 10), CHROME, T(0.2, 0.12, 0.405) @ RX(PI / 2), mat='Metal')
    p.add(g_cyl(0.085, 0.085, 0.035, 10), LIGHT, T(0.2, 0.12, 0.405) @ RX(PI / 2), jit=0)
    q = Part('instrument_band', 6)
    q.box(0.84, 0.16, 0.84, 0, at=(0, -0.08, 0), mat='Glow_Inst')
    return [(q, (0, -0.08, 0))]


def path_lantern(p):
    p.add(g_tube([(0, -0.15, 0), (0.012, 0.3, 0.008), (0, 0.6, 0)], lambda t: 0.055 - 0.012 * t, 6), PANELS[1], smooth=True)
    for k in range(3): p.add(g_torus(0.055, 0.012, 6, 4), CABLE, T(0, 0.5 + k * 0.022, 0))
    lantern(p, T(0, 0.6, 0), 1.0)


def solar_panel(p):
    # post: a braced steel mast with a ball joint on top (pivot at y = 3.8)
    # footing: a sintered regolith pad with a bolted base plate
    p.add(g_cyl(1.25, 1.15, 0.16, 12), 0xB7B2AA, T(0, -0.1, 0), mat='TexPad', uv='cyl')
    p.add(g_cyl(0.45, 0.45, 0.05, 12), FRAME_D, T(0, 0.06, 0), mat='TexSteel', uv='cyl')
    for k in range(6):
        a = k * TAU / 6
        p.add(g_cyl(0.035, 0.035, 0.04, 6), CHROME, T(math.sin(a) * 0.37, 0.11, math.cos(a) * 0.37), mat='Metal', jit=0)
    p.add(g_tube([(0, -0.2, 0), (0.01, 1.8, 0.0), (0, 3.62, 0)], lambda t: 0.2 - 0.07 * t, 8), PANELS[1], mat='TexPanel', smooth=True, fjit=0.03)
    for k in range(3):
        a = k * TAU / 3 + 0.5
        beam(p, (math.sin(a) * 1.0, 0.0, math.cos(a) * 1.0), (math.sin(a) * 0.1, 1.5, math.cos(a) * 0.1), 0.12, 0.12, FRAME, jit=0.06, mat='TexSteel')
    for k in range(4): p.add(g_torus(0.185, 0.02, 8, 4), CABLE, T(0, 1.42 + k * 0.035, 0), jit=0.03)
    # tracker motor and its cable down the mast
    p.add(g_box(0.34, 0.4, 0.26, 0.03), PANELS[0], T(0.0, 2.4, 0.25), mat='TexPanel')     # low enough to clear the tilting panel
    p.add(g_tube([(0.0, 2.2, 0.3), (0.05, 1.6, 0.21), (0.05, 0.4, 0.19), (0.3, 0.02, 0.5)], 0.025, 5), CABLE, smooth=True)
    p.add(g_cyl(0.2, 0.1, 0.22, 8), STEEL, T(0, 3.5, 0), mat='Metal')
    p.add(g_sphere(0.085, 10, 6), STEEL_D, T(0, 3.8, 0), mat='Metal', smooth=True)   # the joint stays inside the panel when it tilts
    q = Part('solar_panel', 7)
    q.push(T(0, 3.8, 0))
    q.box(5.8, 0.14, 3.6, FRAME, at=(0, 0, 0), bevel=0.03, mat='TexSteel')
    q.box(5.6, 0.06, 3.4, 0xFFFFFF, at=(0, 0.06, 0), mat='SolarGlass', jit=0, fjit=0.0)
    for i in range(1, 4): q.box(0.05, 0.02, 3.4, STEEL, at=(-2.8 + i * 1.4, 0.1, 0), mat='Metal')
    for i in range(1, 3): q.box(5.6, 0.02, 0.05, STEEL, at=(0, 0.1, -1.7 + i * 1.133), mat='Metal')
    for sx in (-1, 1):
        for sz in (-1, 1): q.box(0.3, 0.17, 0.3, STEEL, at=(sx * 2.78, 0, sz * 1.68), bevel=0.03, mat='Metal')
    # torque tube, purlins and the junction box under the panel
    q.add(g_cyl(0.11, 0.11, 5.4, 10), FRAME_D, T(-2.7, -0.17, 0) @ RZ(-PI / 2), mat='TexSteel', uv='cyl')
    for z in (-1.2, 1.2): q.box(5.4, 0.08, 0.1, FRAME, at=(0, -0.11, z), mat='TexSteel')
    q.box(0.5, 0.12, 2.6, FRAME_D, at=(0, -0.1, 0), mat='TexSteel')
    q.box(0.42, 0.1, 0.3, DARK, at=(1.4, -0.12, 0.7), bevel=0.02)
    q.decal('volt', T(1.4, -0.172, 0.7) @ RX(PI / 2), 0.16)
    q.pop()
    return [(q, (0, 3.8, 0))]


def telescope(p):
    for k in range(3):                                           # tripod
        a = k * TAU / 3 + 0.3
        beam(p, (math.sin(a) * 0.62, -0.05, math.cos(a) * 0.62), (math.sin(a) * 0.07, 1.22, math.cos(a) * 0.07), 0.07, 0.07, PANELS[k], jit=0.06)
        p.add(g_cyl(0.05, 0.03, 0.1, 5), STEEL_D, T(math.sin(a) * 0.62, -0.05, math.cos(a) * 0.62), mat='Metal')
    p.add(g_torus(0.37, 0.012, 3, 4), CABLE, T(0, 0.5, 0) @ RY(0.3))
    p.add(g_cyl(0.11, 0.09, 0.14, 8), STEEL, T(0, 1.2, 0), mat='Metal')
    p.add(g_sphere(0.1, 8, 6), CHROME, T(0, 1.4, 0), mat='Metal', smooth=True)
    d = Vector((0.0, math.sin(0.62), math.cos(0.62)))
    M = T(0, 1.4, 0) @ ALIGN(d) @ T(0, -0.62, 0)
    p.add(g_lathe([(0.075, 0.0), (0.075, 0.25), (0.115, 0.28), (0.115, 1.05), (0.15, 1.08), (0.15, 1.6), (0.175, 1.62), (0.175, 1.8), (0.14, 1.8), (0.14, 1.72)], 12),
          CHROME, M, mat='Metal', smooth=True, jit=0)
    p.add(g_cyl(0.142, 0.142, 0.02, 12), 0, M @ T(0, 1.705, 0), mat='DarkGlass')
    for y in (0.28, 1.08, 1.62): p.add(g_torus(0.13 if y < 1 else 0.165, 0.02, 12, 4), STEEL, M @ T(0, y, 0), mat='Metal')
    p.add(g_cyl(0.05, 0.04, 0.09, 8), DARK, M @ T(0, -0.08, 0))
    p.add(g_cyl(0.035, 0.035, 0.5, 6), STEEL_D, M @ T(0.17, 0.5, 0), mat='Metal')
    p.add(g_box(0.04, 0.04, 0.2), STEEL_D, M @ T(0.1, 0.62, 0), mat='Metal')


def build():
    out = {}
    specs = [('A_powercell', 'PowerCell', 'cell_body', power_cell, dict(ao=0.0)),
             ('A_foodcrate', 'FoodCrate', 'foodcrate_body', food_crate, dict(ao=0.15)),
             ('A_supplycase', 'SupplyCase', 'case_body', supply_case, dict(ao=0.15)),
             ('A_soilbag', 'SoilBag', 'soilbag_body', soil_bag, dict(ao=0.25, top=0.0)),
             ('A_coresample', 'CoreSample', 'core_body', core_sample, dict(ao=0.0)),
             ('A_instrument', 'Instrument', 'instrument_body', instrument, dict(ao=0.15)),
             ('A_pathlantern', 'PathLantern', 'lantern_body', path_lantern, dict(ao=0.2)),
             ('A_solarpanel', 'SolarPanel', 'solar_post', solar_panel, dict(ao=0.25)),
             ('A_telescope', 'Telescope', 'telescope_body', telescope, dict(ao=0.2))]
    for cn, rn, pn, fn, kw in specs:
        one(cn, rn, pn, fn, **kw)
        out[rn] = stats(cn)['tris']
    return out


RESULT = build()
