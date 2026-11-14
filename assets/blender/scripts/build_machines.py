"""The outpost machines, remade from the simple shapes in js/base.js with real-looking parts and textures:
the Air Maker, the charging rack (Solar Rack), the Greenhouse, the Science Lab and the Radio Dish, plus the
power socket and the intake funnel they share.

Same layout as before: every spot the game uses (funnels, sockets, beds, screen, fan, dish head...) sits where
js/base.js expects it, so only the look changes. Things the game moves or lights up stay in js/base.js
(glowing rims, ice, oxygen and water levels, plants, the lab screen and sample tubes, the dish's radio
waves); the models here give them a body. Coordinates are game space around each machine's own origin.

Nodes the game moves: air_fan (spins on z), lab_arm (turns on y), dish_head (aims the dish)."""
import sys, os, importlib
SCRIPTS = os.path.dirname(os.path.abspath(__file__))
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)
from kit import *

WHITE = 0xFFFFFF
INK = 0x23262C            # dark label paint
CHALK = 0xF1F1EE          # white label paint
YELLOW = 0xE2B12E         # safety yellow paint
COPPER = 0xB9763F
GREEN_D = 0x3E5A4C


# ---------------------------------------------------------------- small parts
def hexbolt(p, M, s=0.035, col=CHROME):
    p.add(g_cyl(s, s, s * 0.6, 6), col, M, mat='Metal', jit=0, fjit=0)


def bolt_circle(p, M, R, n, s=0.03, a0=0.0):
    """Bolt heads on a circle in the local xz plane, standing up along local +y."""
    for i in range(n):
        a = a0 + TAU * i / n
        hexbolt(p, M @ T(math.cos(a) * R, 0, math.sin(a) * R), s)


def flange(p, M, r, t=0.05, bolts=6, col=STEEL):
    """A pipe flange around local +y, with its bolts."""
    p.add(g_cyl(r, r, t, 12, bevel=0.01), col, M @ T(0, -t / 2, 0), mat='TexSteel', uv='cyl')
    bolt_circle(p, M @ T(0, t / 2, 0), r * 0.78, bolts, s=r * 0.12)


def pipe(p, pts, r, col=STEEL, mat='TexSteel', ends=True, n=8):
    p.add(g_tube(pts, r, n), col, mat=mat, smooth=True, jit=0.02)
    if ends:
        for a, b in ((pts[0], pts[1]), (pts[-1], pts[-2])):
            d = Vector(a) - Vector(b)
            flange(p, T(*a) @ ALIGN(d), r * 1.7, t=r * 0.6, bolts=4)


def handwheel(p, M, r=0.16, col=RED):
    """Valve handwheel lying in the local xz plane."""
    p.add(g_torus(r, r * 0.12, 14, 6), col, M, smooth=True, jit=0.02)
    for k in range(3):
        a = k * TAU / 3
        beam(p, M @ Vector((0, 0, 0)), M @ Vector((math.cos(a) * r, 0, math.sin(a) * r)), r * 0.1, r * 0.1, col)
    p.add(g_cyl(r * 0.22, r * 0.22, r * 0.25, 8), col, M @ T(0, -r * 0.12, 0))


def foot(p, x, z, y0=-0.3, y1=0.05, r=0.16):
    """Levelling foot: a threaded post on a round pad (reaches below ground for slopes)."""
    p.cyl(r, r * 0.9, 0.08, STEEL_D, at=(x, y0, z), n=10, mat='TexSteel')
    p.cyl(r * 0.35, r * 0.35, y1 - y0, CHROME, at=(x, y0, z), n=6, mat='TexSteel')


def louvres(p, M, w, h, n, col=FRAME_D):
    """Vent louvres in the local xy plane, facing +z."""
    p.add(g_box(w + 0.06, h + 0.06, 0.03), shade(col, 0.6), M @ T(0, 0, -0.01), mat='TexPanel')
    for k in range(n):
        y = -h / 2 + (k + 0.5) * h / n
        p.add(g_box(w, h / n * 0.7, 0.02), col, M @ T(0, y, 0.02) @ RX(-0.6), mat='TexSteel')


def rail_box(p, cx, cy, cz, w, h, d, t, col, mat='TexSteel'):
    """The 12 edges of a box, as square tubes."""
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.box(t, h, t, col, at=(cx + sx * (w / 2 - t / 2), cy, cz + sz * (d / 2 - t / 2)), mat=mat)
    for sy in (-1, 1):
        for sz in (-1, 1):
            p.box(w, t, t, col, at=(cx, cy + sy * (h / 2 - t / 2), cz + sz * (d / 2 - t / 2)), mat=mat)
        for sx in (-1, 1):
            p.box(t, t, d - 2 * t, col, at=(cx + sx * (w / 2 - t / 2), cy + sy * (h / 2 - t / 2), cz), mat=mat)


# ---------------------------------------------------------------- shared: funnel and socket
def hopper_model():
    """Intake funnel, radius 1 (the game scales it by the funnel's radius). Origin at its middle, rim at y = +0.5
    where the game draws the glowing ring. Rolled steel with stiffening ribs and a grate in the throat."""
    coll = collection('A_hopper')
    root = empty('Hopper', coll)
    p = Part('hopper_body', 41)
    p.lathe([(0.47, -0.5), (1.0, 0.47), (1.06, 0.47), (1.06, 0.52), (0.95, 0.52), (0.43, -0.44), (0.3, -0.5)], STEEL, n=24, caps=False,
            mat='TexSteel', smooth=True, jit=0)
    p.lathe([(0.32, -0.62), (0.47, -0.5)], STEEL_D, n=16, caps=False, mat='TexSteel', smooth=True)
    p.lathe([(0.0, -0.46), (0.31, -0.46)], DARK, n=16, mat='Paint')
    for k in range(8):
        a = TAU * k / 8 + TAU / 16
        d = Vector((math.sin(a), 0, math.cos(a)))
        beam(p, d * 0.52 + Vector((0, -0.42, 0)), d * 1.03 + Vector((0, 0.44, 0)), 0.035, 0.06, FRAME, mat='TexSteel')
    for a in (0.0, PI / 2):
        p.box(0.9, 0.03, 0.04, STEEL_D, at=(0, -0.3, 0), rot=(0, a, 0), mat='TexSteel')
    p.build(coll, parent=root, ao=0.25)
    return root


def socket_model():
    """Power socket: steel post on a bolted base plate, an indicator box (the game's green charge lights sit in
    front of it at y 0.85) and a dark cup with contacts where the game puts the glowing ring and the cell."""
    coll = collection('A_socket')
    root = empty('Socket', coll)
    p = Part('socket_body', 42)
    p.box(0.86, 0.06, 0.86, STEEL_D, at=(0, 0.03, 0), bevel=0.01, mat='TexTread')
    for sx in (-1, 1):
        for sz in (-1, 1): hexbolt(p, T(sx * 0.33, 0.06, sz * 0.33), 0.035)
    p.cyl(0.32, 0.25, 0.95, PANELS[1], at=(0, 0.04, 0), n=14, mat='TexPanel', smooth=True)
    p.cyl(0.27, 0.27, 0.06, FRAME, at=(0, 0.06, 0), n=12, mat='TexSteel')
    # indicator box behind the three charge lights
    p.box(0.78, 0.26, 0.16, FRAME_D, at=(0, 0.83, 0.23), bevel=0.02, mat='TexPanel')
    p.box(0.7, 0.18, 0.02, DARK, at=(0, 0.83, 0.315))
    p.decal('battery', T(0, 0.42, 0.292) @ RX(-0.07), 0.2, col=CHALK)
    # the cup: dark housing with a yellow band and contacts on its floor
    p.lathe([(0.2, 0.93), (0.5, 0.97), (0.62, 1.38), (0.64, 1.44), (0.56, 1.44), (0.46, 1.22), (0.0, 1.22)], 0x2E3440, n=20,
            mat='TexPanel', smooth=True)
    p.lathe([(0.563, 1.17), (0.6, 1.33)], YELLOW, n=20, caps=False, mat='TexPanel', smooth=True)
    for k in range(3):
        a = TAU * k / 3
        p.cyl(0.035, 0.03, 0.08, COPPER, at=(math.cos(a) * 0.2, 1.22, math.sin(a) * 0.2), n=6, mat='Metal')
    p.build(coll, parent=root, ao=0.2)
    return root


# ---------------------------------------------------------------- Air Maker
def air_maker():
    """Oxygen maker (like the MOXIE experiment on Perseverance): a gold-foil insulated box in a steel frame on a
    tread-plate skid, fan and status light on the front, a pipe with a red valve to a caged oxygen tank."""
    coll = collection('A_airmaker')
    root = empty('AirMaker', coll)
    p = Part('air_body', 51)
    TX = 3.1                                   # oxygen tank axis
    # skid: deck under body and tank, I-beam rails, feet
    p.box(6.3, 0.08, 3.5, STEEL, at=(1.3, 0.26, 0), mat='TexTread')
    p.box(6.3, 0.22, 3.1, FRAME_D, at=(1.3, 0.11, 0), mat='TexPanel')
    for sz in (-1, 1):
        p.box(6.4, 0.04, 0.3, FRAME, at=(1.3, 0.22, sz * 1.55), mat='TexSteel')
        p.box(6.4, 0.18, 0.05, FRAME, at=(1.3, 0.11, sz * 1.575), mat='TexSteel')
        p.box(6.4, 0.04, 0.3, FRAME, at=(1.3, 0.0, sz * 1.55), mat='TexSteel')
        for x in (-1.6, 1.3, 4.2): foot(p, x, sz * 1.55)
    p.decal('hazard', T(1.3, 0.11, 1.6), 6.0, 0.15)
    # body: gold foil blanket in a steel frame
    p.box(2.88, 2.5, 2.88, WHITE, at=(0, 1.57, 0), bevel=0.07, mat='TexFoil', jit=0, fjit=0.0)
    rail_box(p, 0, 1.6, 0, 3.02, 2.62, 3.02, 0.14, FRAME)
    p.box(3.02, 0.1, 3.02, PANELS[0], at=(0, 2.92, 0), bevel=0.02, mat='TexPanel')
    p.cyl(0.72, 0.68, 0.14, FRAME_D, at=(0, 2.94, 0), n=20, mat='TexSteel')
    bolt_circle(p, T(0, 3.08, 0), 0.62, 10, 0.03)
    # straps holding the blanket
    for y in (0.72, 2.62):
        p.box(2.93, 0.08, 2.93, STRAP, at=(0, y, 0), mat='TexPanel')
    # front (z +1.5): fan shroud and grille, status light bezel, control panel, labels
    F = 1.51
    fx, fy = -0.9, 2.2
    p.lathe([(0.66, 0.0), (0.74, 0.0), (0.74, 0.2), (0.68, 0.24), (0.66, 0.22)], FRAME_D, at=(fx, fy, F - 0.06), rot=(PI / 2, 0, 0),
            n=24, mat='TexSteel', smooth=True)
    p.add(g_cyl(0.66, 0.66, 0.02, 24), DARK, T(fx, fy, F - 0.05) @ RX(PI / 2), mat='Paint')
    for r in (0.24, 0.42, 0.6): p.add(g_torus(r, 0.014, 24, 4), STEEL_D, T(fx, fy, F + 0.2) @ RX(PI / 2), mat='Metal')
    for k in range(4):
        a = k * PI / 4
        p.box(1.3, 0.025, 0.025, STEEL_D, at=(fx, fy, F + 0.2), rot=(0, 0, a), mat='Metal')
    for k in range(6):
        a = k * TAU / 6
        hexbolt(p, T(fx + math.cos(a) * 0.7, fy + math.sin(a) * 0.7, F + 0.2) @ RX(PI / 2), 0.03)
    p.box(1.38, 0.46, 0.05, DARK, at=(0.75, 2.2, F - 0.005), bevel=0.015)
    p.box(1.46, 0.06, 0.1, FRAME, at=(0.75, 2.46, F + 0.02), mat='TexSteel')
    p.decal('panel', T(0.75, 1.5, F + 0.02), 0.95)
    p.box(1.05, 0.7, 0.03, FRAME_D, at=(0.75, 1.5, F), bevel=0.01, mat='TexPanel')
    p.decal('o2', T(-0.9, 1.1, F + 0.02), 0.56, col=INK)
    p.decal('ao_am', T(0.45, 0.95, F + 0.02), 0.62, col=INK)
    p.decal('ice', T(0.3, 2.8, F + 0.03), 0.5, col=INK)
    p.decal('arrows', T(0.95, 2.8, F + 0.03) @ RZ(PI / 2), 0.3, col=YELLOW)
    p.decal('volt', T(1.15, 0.95, F + 0.02), 0.3)
    # left side (-x): big vent and the name
    louvres(p, T(-1.51, 1.75, 0.35) @ RY(-PI / 2), 1.3, 0.9, 7)
    p.decal('oxygen', T(-1.53, 0.95, 0.0) @ RY(-PI / 2), 1.6, col=INK)
    p.decal('patch', T(-1.53, 2.45, -0.95) @ RY(-PI / 2), 0.55)
    # back (-z): service hatch, gauge, conduit
    p.box(1.2, 1.1, 0.04, PANELS[2], at=(0.5, 1.6, -1.52), bevel=0.02, mat='TexPanel')
    for sx in (-1, 1):
        for sy in (-1, 1): hexbolt(p, T(0.5 + sx * 0.52, 1.6 + sy * 0.47, -1.55) @ RX(-PI / 2), 0.025)
    p.cyl(0.17, 0.17, 0.08, FRAME_D, at=(-0.7, 2.0, -1.5), rot=(-PI / 2, 0, 0), n=16, mat='TexSteel')
    p.decal('gauge', T(-0.7, 2.0, -1.59) @ RY(PI), 0.3)
    pipe(p, [(-1.25, 0.32, -1.62), (-1.25, 1.2, -1.62), (-1.25, 2.5, -1.62), (-1.25, 2.75, -1.35)], 0.06, ends=False)
    # vent stack on the roof, back corner
    p.add(g_tube([(-1.0, 2.95, -1.0), (-1.0, 3.6, -1.0), (-1.0, 3.75, -0.85)], 0.09, 8), STEEL, mat='TexSteel', smooth=True)
    p.cyl(0.16, 0.16, 0.05, FRAME_D, at=(-1.0, 3.78, -0.83), rot=(PI / 2.6, 0, 0), n=10, mat='TexSteel')
    # pipe with a valve to the tank
    pipe(p, [(1.5, 2.2, 0.0), (1.72, 2.2, 0.0), (1.98, 2.2, 0.0)], 0.12)
    p.box(0.26, 0.3, 0.3, RED_D, at=(1.75, 2.2, 0), bevel=0.03)
    p.cyl(0.04, 0.04, 0.22, STEEL, at=(1.75, 2.35, 0), n=6, mat='Metal')
    handwheel(p, T(1.75, 2.58, 0), 0.17)
    # oxygen tank: pedestal, cap with valve and gauge, guard cage, label plate
    p.lathe([(1.36, 0.3), (1.36, 0.4), (1.24, 0.48), (1.0, 0.48)], FRAME, at=(TX, 0, 0), n=28, mat='TexSteel', smooth=True)
    p.lathe([(1.18, 0.34), (1.18, 0.5)], STEEL_D, at=(TX, 0, 0), n=28, caps=False, mat='TexSteel', smooth=True)
    bolt_circle(p, T(TX, 0.4, 0), 1.3, 12, 0.03)
    p.lathe([(1.18, 5.28), (1.3, 5.3), (1.3, 5.46), (1.05, 5.62), (0.5, 5.74), (0.0, 5.76)], PANELS[0], at=(TX, 0, 0), n=28,
            mat='TexPanel', smooth=True)
    bolt_circle(p, T(TX, 5.47, 0), 1.24, 12, 0.03)
    p.cyl(0.1, 0.1, 0.3, STEEL, at=(TX, 5.72, 0), n=8, mat='TexSteel')
    p.cyl(0.16, 0.16, 0.12, RED_D, at=(TX, 5.98, 0), n=10)
    handwheel(p, T(TX + 0.0, 6.12, 0), 0.14)
    for k in range(8):
        a = TAU * k / 8 + TAU / 16
        p.box(0.07, 4.84, 0.07, FRAME, at=(TX + math.sin(a) * 1.24, 2.88, math.cos(a) * 1.24), rot=(0, a, 0), mat='TexSteel')
    for y in (1.7, 4.1):
        p.add(g_torus(1.24, 0.04, 28, 4), FRAME, T(TX, y, 0), mat='TexSteel')
    p.box(0.9, 0.62, 0.04, DOOR, at=(TX, 1.05, 1.19), bevel=0.01, mat='TexPanel')
    p.decal('o2', T(TX, 1.05, 1.21), 0.5, col=CHALK)
    p.cyl(0.21, 0.21, 0.1, FRAME_D, at=(TX, 3.0, 1.17), rot=(PI / 2, 0, 0), n=16, mat='TexSteel')
    p.decal('gauge', T(TX, 3.0, 1.27), 0.36)
    p.build(coll, parent=root, ao=0.22, ao_range=(0, 4.5))

    # the fan rotor (the game spins it): five swept blades on a hub, behind the grille
    f = Part('air_fan', 52)
    f.push(T(fx, fy, 1.56))
    f.cyl(0.13, 0.11, 0.14, STEEL, at=(0, 0, -0.04), rot=(PI / 2, 0, 0), n=12, mat='TexSteel')
    for k in range(5):
        a = k * TAU / 5
        f.add(g_box(0.5, 0.17, 0.025), STEEL, RZ(a) @ T(0.36, 0, 0) @ RX(0.45), mat='TexSteel', jit=0.02)
    f.pop()
    f.build(coll, origin=(fx, fy, 1.56), parent=root, ao=0)
    return root


# ---------------------------------------------------------------- charging rack (Solar Rack)
def charge_rack():
    """Battery charging station: a louvred cabinet with four charging cradles, a panelled back wall with a
    breaker box, bus bar and conduits, and a yellow canopy on brackets. The charge tube stands on its own plinth."""
    coll = collection('A_chargerack')
    root = empty('ChargeRack', coll)
    p = Part('rack_body', 61)
    BODY = 0x4A5566
    p.box(5.2, 0.5, 1.7, BODY, at=(0, 0.25, 0), bevel=0.03, mat='TexPanel')
    p.box(5.24, 0.06, 1.74, STEEL, at=(0, 0.47, 0), mat='TexTread')
    p.box(5.3, 0.1, 1.8, FRAME_D, at=(0, -0.02, 0), mat='TexSteel')
    for x in (-2.4, 0, 2.4):
        for z in (-0.7, 0.7): foot(p, x, z, y0=-0.32, y1=-0.05)
    for x in (-1.5, 1.5): louvres(p, T(x, 0.24, 0.86), 1.4, 0.28, 4, col=FRAME)
    p.decal('hazard', T(0, 0.43, 0.861), 5.1, 0.08)
    # four charging cradles
    for i in range(4):
        x = -1.65 + i * 1.1
        p.cyl(0.46, 0.46, 0.05, FRAME_D, at=(x, 0.5, 0.15), n=20, mat='TexSteel')
        p.lathe([(0.44, 0.52), (0.44, 0.76), (0.39, 0.78), (0.37, 0.7), (0.0, 0.7)], STEEL, at=(x, 0, 0.15), n=20, mat='TexSteel', smooth=True)
        p.add(g_torus(0.415, 0.02, 20, 4), YELLOW, T(x, 0.775, 0.15), mat='Paint')
        for k in range(3):
            a = TAU * k / 3 + 0.5
            p.cyl(0.03, 0.025, 0.06, COPPER, at=(x + math.cos(a) * 0.18, 0.7, 0.15 + math.sin(a) * 0.18), n=6, mat='Metal')
    # back wall: posts, panels, bus bar, breaker box, conduits
    p.box(5.0, 2.2, 0.22, PANELS[1], at=(0, 1.5, -0.7), bevel=0.02, mat='TexPanel')
    for x in (-2.52, 2.52):
        p.box(0.2, 2.62, 0.32, FRAME, at=(x, 1.31, -0.7), bevel=0.02, mat='TexSteel')
    p.box(5.24, 0.14, 0.3, FRAME, at=(0, 0.6, -0.7), mat='TexSteel')
    p.box(4.6, 0.08, 0.05, COPPER, at=(0, 1.15, -0.57), mat='Metal')
    for k in range(9): hexbolt(p, T(-2.2 + k * 0.55, 1.15, -0.545) @ RX(PI / 2), 0.025)
    for i in range(4):
        x = -1.65 + i * 1.1
        p.add(g_tube([(x + 0.25, 1.15, -0.55), (x + 0.25, 0.9, -0.48), (x + 0.2, 0.62, -0.3), (x + 0.1, 0.6, -0.05)], 0.035, 6), 0x2A2D33, smooth=True)
    p.box(0.8, 0.62, 0.24, PANEL_L, at=(-1.75, 1.85, -0.47), bevel=0.03, mat='TexPanel')
    p.box(0.06, 0.4, 0.04, FRAME_D, at=(-1.42, 1.85, -0.34), mat='TexSteel')
    p.decal('volt', T(-1.85, 1.86, -0.345), 0.36)
    pipe(p, [(-1.6, 1.54, -0.47), (-1.6, 1.25, -0.47), (-1.6, 0.68, -0.47)], 0.05, ends=False)
    p.decal('power', T(1.25, 1.92, -0.585), 1.1, col=INK)
    p.decal('battery', T(2.05, 1.92, -0.585), 0.38, col=INK)
    p.decal('ao_pr', T(1.25, 1.62, -0.585), 0.6, col=INK)
    p.box(1.38, 0.34, 0.06, DARK, at=(0, 2.3, -0.565), bevel=0.015)
    # canopy on brackets
    p.box(5.5, 0.12, 2.1, YELLOW, at=(0, 2.64, -0.1), bevel=0.02, mat='TexPanel')
    p.box(5.56, 0.05, 2.16, FRAME_D, at=(0, 2.565, -0.1), mat='TexSteel')
    p.decal('hazard', T(0, 2.64, 0.951), 5.4, 0.09)
    for x in (-2.3, -0.9, 0.9, 2.3):
        beam(p, (x, 2.0, -0.6), (x, 2.53, 0.7), 0.07, 0.07, FRAME, mat='TexSteel')
        p.box(0.1, 0.06, 1.9, FRAME, at=(x, 2.51, -0.1), mat='TexSteel')
    # the charge tube's plinth, caps and bracket
    p.box(0.56, 0.5, 0.56, BODY, at=(2.95, 0.25, 0.2), bevel=0.03, mat='TexPanel')
    p.cyl(0.27, 0.27, 0.1, FRAME_D, at=(2.95, 0.48, 0.2), n=16, mat='TexSteel')
    p.cyl(0.27, 0.25, 0.14, FRAME_D, at=(2.95, 2.38, 0.2), n=16, mat='TexSteel')
    p.cyl(0.06, 0.06, 0.14, RED_D, at=(2.95, 2.52, 0.2), n=8)
    for y in (1.0, 1.9):
        p.add(g_torus(0.22, 0.025, 16, 4), STEEL, T(2.95, y, 0.2), mat='TexSteel')
        beam(p, (2.58, y, -0.62), (2.86, y, 0.0), 0.06, 0.06, STEEL, mat='TexSteel')
    p.build(coll, parent=root, ao=0.22, ao_range=(0, 2.7))
    return root


# ---------------------------------------------------------------- Greenhouse
GR, GY, GZ = 3.3, 0.3, 0.9           # vault radius and the axis (y, z) it bends around
GA = PI / 2 + 0.25                   # how far the vault bends: from the back foot over the top to the front


def arc_pt(a, r=GR):
    """A point on the vault at angle a (0 = back foot, pi/2 = top)."""
    return (GY + r * math.sin(a), GZ - r * math.cos(a))


def greenhouse():
    """Lean-to greenhouse: aluminium box-section ribs and purlins over glass, framed glass ends with a door,
    front posts and a header with the sign, hydroponic trays on legs with a drip line, a grow-light fixture,
    and a caged water tank on its own pad."""
    coll = collection('A_greenhouse')
    root = empty('Greenhouse', coll)
    p = Part('greenhouse_body', 71)
    ALU = 0xC9CDD3
    xs = (-5.1, -2.55, 0.0, 2.55, 5.1)
    # foundation: regolith pavers with a steel edge
    p.box(10.5, 0.3, 4.6, 0xB7B2AA, at=(0, 0.15, -0.6), mat='TexPad')
    p.box(10.6, 0.08, 4.7, FRAME_D, at=(0, 0.0, -0.6), mat='TexSteel')
    p.box(10.5, 0.04, 0.05, FRAME, at=(0, 0.31, 1.68), mat='TexSteel')
    # ribs (box section following the vault) and the front posts under their ends
    steps = 16
    for x in xs:
        pts = []; nrm = []
        for k in range(steps + 1):
            a = GA * k / steps
            y, z = arc_pt(a, GR - 0.07)
            pts.append((x, y, z)); nrm.append((0, math.sin(a), -math.cos(a)))
        p.add(g_ribbon(pts, nrm, 0.12, 0.14), ALU, mat='TexSteel', jit=0.02)
        y1, z1 = arc_pt(GA, GR)
        p.box(0.12, y1 - 0.3, 0.12, ALU, at=(x, 0.3 + (y1 - 0.3) / 2, z1 - 0.02), mat='TexSteel')
        p.box(0.3, 0.06, 0.3, FRAME_D, at=(x, 0.33, z1 - 0.02), mat='TexSteel')
        p.box(0.28, 0.06, 0.2, FRAME_D, at=(x, 0.33, arc_pt(0)[1] + 0.05), mat='TexSteel')
    # purlins along the vault, and the front header
    for a in (0.12, 0.5, 0.88, 1.22, 1.55, GA - 0.04):
        y, z = arc_pt(a, GR - 0.02)
        p.box(10.32, 0.07, 0.07, ALU, at=(0, y, z), rot=(a - PI / 2, 0, 0), mat='TexSteel')
    y1, z1 = arc_pt(GA, GR)
    p.box(10.36, 0.16, 0.14, ALU, at=(0, y1 - 0.06, z1 - 0.02), mat='TexSteel')
    # sign on the header
    p.box(2.7, 0.5, 0.05, GREEN_D, at=(-1.4, y1 + 0.2, z1 + 0.09), bevel=0.01, mat='TexPanel')
    p.decal('greenhouse', T(-1.15, y1 + 0.2, z1 + 0.12), 2.0, col=CHALK)
    p.decal('leaf', T(-2.45, y1 + 0.2, z1 + 0.12), 0.38, col=0x9BE07A)
    p.decal('ao_gh', T(1.4, y1 + 0.02, z1 + 0.06), 0.62, col=INK)
    # glass: the vault, then the two ends
    gl = Part('greenhouse_glass', 72)
    vs, fs = [], []
    n = 24
    for k in range(n + 1):
        a = GA * k / n
        y, z = arc_pt(a, GR - 0.01)
        vs.append((-5.1, y, z)); vs.append((5.1, y, z))
    for k in range(n):
        fs.append([2 * k, 2 * k + 1, 2 * k + 3, 2 * k + 2])
    gl.add((vs, fs), 0xCFEFFF, mat='Glass', jit=0, fjit=0)
    for x in (-5.1, 5.1):
        poly = []
        for k in range(n + 1):
            y, z = arc_pt(GA * k / n, GR - 0.01)
            poly.append((x, y, z))
        poly.append((x, GY, z1))
        gl.add((poly, [list(range(len(poly)))]), 0xCFEFFF, mat='Glass', jit=0, fjit=0)
    # end frames: mullions, transom, and a door on the +x end
    for x in (-5.1, 5.1):
        for z in (-1.3, -0.1, 1.0):
            top = GY + math.sqrt(max(0.0, GR * GR - (z - GZ) ** 2)) - 0.03
            p.box(0.08, top - 0.3, 0.08, ALU, at=(x, 0.3 + (top - 0.3) / 2, z), mat='TexSteel')
        p.box(0.08, 0.08, 3.65, ALU, at=(x, 1.9, -0.125), mat='TexSteel')
        p.box(0.06, 0.06, 4.1, ALU, at=(x, 0.36, -0.35), mat='TexSteel')
    for z in (-0.95, -0.05):
        p.box(0.12, 2.35, 0.1, FRAME, at=(5.13, 1.48, z), mat='TexSteel')
    p.box(0.12, 0.1, 1.0, FRAME, at=(5.13, 2.65, -0.5), mat='TexSteel')
    p.box(0.08, 0.06, 0.26, CHROME, at=(5.2, 1.4, -0.2), mat='Metal')
    p.decal('nostep', T(5.17, 0.6, -0.5) @ RY(PI / 2), 0.5, col=INK)
    # grow light: side lips and hangers around the game's glowing strip
    for dz in (-0.18, 0.18):
        p.box(10.3, 0.12, 0.04, FRAME_D, at=(0, 3.3, -0.3 + dz), mat='TexSteel')
    # four hydroponic trays on legs, with a shelf and a nutrient tank under each
    for i in range(4):
        bx = -3.6 + i * 2.4
        p.box(2.0, 0.34, 1.7, LIGHT, at=(bx, 0.85, 0.2), bevel=0.03, mat='TexPanel')
        p.box(2.06, 0.05, 1.76, ALU, at=(bx, 1.03, 0.2), mat='TexSteel')
        p.box(1.86, 0.1, 1.56, WHITE, at=(bx, 1.03, 0.2), mat='TexSoil', jit=0.0)
        for sx in (-1, 1):
            for sz in (-1, 1):
                p.box(0.08, 0.4, 0.08, ALU, at=(bx + sx * 0.92, 0.5, 0.2 + sz * 0.78), mat='TexSteel')
        p.box(1.9, 0.04, 1.6, FRAME, at=(bx, 0.42, 0.2), mat='TexTread')
        p.box(0.8, 0.2, 0.5, 0x6E8A9C, at=(bx - 0.4, 0.54, 0.0), bevel=0.04, mat='TexPanel')
        p.cyl(0.05, 0.05, 0.05, RED_D, at=(bx - 0.4, 0.64, 0.0), n=8)
        p.decal('leaf', T(bx + 0.6, 0.85, 1.054), 0.22, col=0x5FA05A)
        # drip line from the back pipe into the tray
        p.add(g_tube([(bx, 1.32, -0.75), (bx, 1.32, -0.45), (bx, 1.12, -0.35)], 0.025, 6), 0x2A2D33, smooth=True)
    pipe(p, [(-5.0, 1.32, -0.75), (0, 1.32, -0.75), (4.7, 1.32, -0.75)], 0.05, ends=False)
    # water tank on its pad, cage, caps, pipe into the greenhouse
    WX, WZ = -6.6, 0.2
    p.cyl(1.32, 1.32, 0.2, 0xB7B2AA, at=(WX, 0.0, WZ), n=24, mat='TexPad')
    p.lathe([(1.12, 0.2), (1.12, 0.32), (1.03, 0.36), (0.9, 0.36)], FRAME, at=(WX, 0, WZ), n=24, mat='TexSteel', smooth=True)
    p.lathe([(0.9, 2.74), (1.03, 2.74), (1.12, 2.78), (1.12, 2.9), (0.6, 2.9)], FRAME, at=(WX, 0, WZ), n=24, mat='TexSteel', smooth=True)
    bolt_circle(p, T(WX, 2.9, WZ), 1.04, 10, 0.028)
    for k in range(6):
        a = TAU * k / 6
        p.box(0.06, 2.45, 0.06, FRAME, at=(WX + math.sin(a) * 1.08, 1.58, WZ + math.cos(a) * 1.08), rot=(0, a, 0), mat='TexSteel')
    p.add(g_torus(1.08, 0.035, 24, 4), FRAME, T(WX, 1.6, WZ), mat='TexSteel')
    p.box(0.8, 0.6, 0.04, 0x2F5D8A, at=(WX, 0.98, WZ + 1.1), bevel=0.01, mat='TexPanel')
    p.decal('h2o', T(WX, 1.06, WZ + 1.125), 0.46, col=CHALK)
    p.decal('water', T(WX, 0.86, WZ + 1.125), 0.5, col=CHALK)
    pipe(p, [(-5.55, 0.62, -0.2), (-5.3, 0.62, -0.2), (-5.3, 0.62, -0.75), (-5.3, 1.32, -0.75), (-5.0, 1.32, -0.75)], 0.06)
    p.build(coll, parent=root, ao=0.2, ao_range=(0, 3.6))
    gl.build(coll, parent=root, ao=0)
    return root


# ---------------------------------------------------------------- Science Lab
HC = Vector((0, 2.8, -0.6))           # hull axis centre; the hull lies along x
HR = 2.2


def on_hull(x, ang, r=HR):
    """Point on the hull surface at axial x and angle ang (0 = front/+z, pi/2 = up)."""
    return Vector((x, HC.y + r * math.sin(ang), HC.z + r * math.cos(ang)))


def hull_M(x, ang, r=HR):
    """Frame on the hull: local +z = outward normal, local +y = along the surface toward the top."""
    return T(*on_hull(x, ang, r)) @ RX(-ang)


# lathe around the hull axis: a lathe's angle a lands at on_hull(.., a) (0 = front, pi/2 = up)
HM = T(*HC) @ RZ(-PI / 2) @ RY(-PI / 2)


def hull_arc(a0, a1):
    """az0 / sweep for a partial lathe around the hull covering hull angles a0 .. a1 (a1 > a0)."""
    sweep = a1 - a0
    return PI / 2 - a0 - sweep, sweep


def lab():
    """Horizontal science module: white panelled hull with orange structural rings, a hatch at one end and a
    window at the other, landing legs with footpads, a rooftop observatory with its telescope, a radiator,
    handrails, a console around the game's screen and a workbench with the sample rack."""
    coll = collection('A_lab')
    root = empty('Lab', coll)
    p = Part('lab_body', 81)
    HULL = LIGHT
    # hull: cylinder with shallow domed ends (same 8.6 m length as before)
    prof = [(0.0, -4.3)]
    for k in range(1, 7):
        t = k / 6 * PI / 2
        prof.append((HR * math.sin(t), -2.7 - 1.6 * math.cos(t)))
    prof += [(HR, -1.0), (HR, 1.0)]
    for k in range(6, -1, -1):
        t = k / 6 * PI / 2
        prof.append((HR * math.sin(t), 2.7 + 1.6 * math.cos(t)))
    p.add(g_lathe(prof, 28), HULL, HM, mat='TexPanel', smooth=True, uv='cyl', jit=0.02)
    # orange rings where they were; the one at x 1.7 stops at the console (the screen is mounted over it)
    ring = [(HR - 0.02, -0.11), (HR + 0.1, -0.09), (HR + 0.12, 0.0), (HR + 0.1, 0.09), (HR - 0.02, 0.11)]
    for x in (-1.7, 0.0, 1.7):
        if x > 1:
            a0, a1 = 0.36, TAU - 0.27
            az0, sw = hull_arc(a0, a1)
            p.add(g_lathe(ring, 30, az0, sw, caps=False), ORANGE, HM @ T(0, x, 0), mat='TexPanel', smooth=True, uv='cyl')
        else:
            a0, a1 = 0.0, TAU
            p.add(g_lathe(ring, 32, caps=False), ORANGE, HM @ T(0, x, 0), mat='TexPanel', smooth=True, uv='cyl')
        for k in range(12):
            a = TAU * (k + 0.5) / 12
            if not (a0 <= a <= a1): continue
            hexbolt(p, T(*on_hull(x, a, HR + 0.115)) @ RX(PI / 2 - a), 0.03)
    # hatch at the -x end, window and antenna at the +x end
    p.add(g_torus(0.85, 0.09, 24, 6), FRAME, T(-4.25, HC.y, HC.z) @ RZ(PI / 2), mat='TexSteel', smooth=True)
    p.add(g_cyl(0.8, 0.78, 0.08, 24), PANELS[2], T(-4.3, HC.y, HC.z) @ RZ(PI / 2), mat='TexPanel')
    p.box(0.08, 0.1, 0.9, CHROME, at=(-4.4, HC.y, HC.z), mat='Metal')
    for dz in (-0.45, 0.45): p.box(0.08, 0.3, 0.08, CHROME, at=(-4.37, HC.y, HC.z + dz), mat='Metal')
    p.box(0.12, 0.35, 0.14, FRAME_D, at=(-4.32, HC.y + 0.86, HC.z), mat='TexSteel')
    porthole(p, T(4.26, HC.y + 0.2, HC.z) @ RY(PI / 2), R=0.5, glow='Glow_Cool', bars=False, rivets=8)
    p.add(g_tube([(3.4, HC.y + 1.6, HC.z - 0.4), (3.5, HC.y + 2.6, HC.z - 0.4)], 0.025, 6), STEEL, mat='Metal')
    p.add(g_sphere(0.05, 8, 5), RED, T(3.5, HC.y + 2.65, HC.z - 0.4), mat='Glow_Red')
    # landing legs: strut, brace and footpad at each of the old leg spots
    for x in (-2.2, 2.2):
        for z in (-1.6, 0.4):
            dz = 1 if z > HC.z else -1
            top = Vector((x, 1.1, z * 0.92 + HC.z * 0.08)); fp = Vector((x + (0.25 if x > 0 else -0.25), 0.06, z + dz * 0.35))
            beam(p, top, fp, 0.14, 0.14, FRAME, mat='TexSteel')
            beam(p, Vector((x * 0.6, 0.95, z)), fp + Vector((0, 0.1, 0)), 0.07, 0.07, STEEL, mat='TexSteel')
            p.cyl(0.36, 0.3, 0.1, STEEL_D, at=(fp.x, -0.04, fp.z), n=14, mat='TexSteel')
            p.cyl(0.1, 0.1, 0.12, CHROME, at=(fp.x, 0.05, fp.z), n=8, mat='Metal')
    # rooftop observatory: drum, dome (where the old one was) with its slit and rails, telescope
    OX, OY, OZ = 1.4, 4.92, -0.6
    p.cyl(1.08, 1.08, OY - 4.6, PANELS[0], at=(OX, 4.6, OZ), n=24, mat='TexPanel')
    p.add(g_torus(1.08, 0.05, 24, 4), ORANGE, T(OX, OY, OZ), mat='Paint')
    p.add(g_sphere(1.0, 24, 8, t0=PI / 2, t1=PI), HULL, T(OX, OY, OZ), mat='TexPanel', smooth=True, uv='y')
    pts = []; nrm = []
    for k in range(10):
        b = 0.35 + (PI / 2 + 0.25 - 0.35) * k / 9
        pts.append((OX, OY + math.sin(b) * 0.995, OZ + math.cos(b) * 0.995)); nrm.append((0, math.sin(b), math.cos(b)))
    p.add(g_ribbon(pts, nrm, 0.36, 0.02), DARK, mat='Paint', jit=0)
    for sx in (-1, 1):
        p.add(g_torus(1.0, 0.025, 24, 4, az0=-PI / 2, sweep=PI), STEEL, T(OX + sx * 0.21, OY, OZ) @ RY(PI / 2) @ RX(-PI / 2), mat='Metal')
    tel = T(OX, 5.8, -0.3) @ RX(0.6)
    p.add(g_cyl(0.27, 0.3, 1.9, 16), FRAME_D, tel @ T(0, -0.95, 0), mat='TexSteel', smooth=True, uv='cyl')
    p.add(g_cyl(0.32, 0.32, 0.45, 16), DARK, tel @ T(0, 0.75, 0), mat='TexSteel', smooth=True, uv='cyl')
    p.add(g_cyl(0.24, 0.24, 0.02, 16), 0, tel @ T(0, 1.2, 0), mat='DarkGlass')
    for y in (-0.6, 0.3): p.add(g_torus(0.3, 0.03, 16, 4), STEEL, tel @ T(0, y, 0), mat='Metal')
    # radiator on the back, on two struts
    for x in (-2.6, -0.6):
        beam(p, (x, 4.3, -2.1), (x, 4.95, -2.85), 0.08, 0.08, FRAME, mat='TexSteel')
    p.box(2.8, 0.05, 1.3, 0xE8EAEE, at=(-1.6, 5.0, -3.1), rot=(0.35, 0, 0), mat='TexPanel')
    for k in range(9):
        p.box(0.025, 0.07, 1.26, STEEL, at=(-2.85 + k * 0.31, 5.04, -3.08), rot=(0.35, 0, 0), mat='Metal')
    # handrails (gold, like the space station's)
    for (x0, x1, ang) in ((-2.4, -0.3, 1.0), (0.3, 1.5, 0.78), (-2.4, -0.3, 2.2)):
        a = on_hull(x0, ang, HR + 0.02); b = on_hull(x1, ang, HR + 0.02)
        oa = on_hull(x0, ang, HR + 0.2); ob = on_hull(x1, ang, HR + 0.2)
        p.add(g_tube([a, oa, ob, b], 0.03, 6), 0xD7A83A, mat='Metal', smooth=True)
    # console around the game's screen (screen 1.9 x 1.1 at x 1.2, y 2.9, z 1.62)
    p.box(2.16, 1.36, 0.2, FRAME_D, at=(1.2, 2.9, 1.5), bevel=0.03, mat='TexPanel')
    p.box(2.0, 1.2, 0.01, DARK, at=(1.2, 2.9, 1.605))
    for sx in (-1, 1):
        for sy in (-1, 1): hexbolt(p, T(1.2 + sx * 1.0, 2.9 + sy * 0.6, 1.6) @ RX(PI / 2), 0.025)
    p.box(2.2, 0.12, 0.45, FRAME, at=(1.2, 3.62, 1.4), mat='TexSteel')
    # labels on the hull
    p.decal('lab', hull_M(-0.85, 0.52, HR + 0.012), 1.5, col=INK)
    p.decal('patch', hull_M(-2.2, 0.05, HR + 0.012), 0.6)
    p.decal('hazard', hull_M(-0.85, 0.12, HR + 0.012), 1.4, 0.12)
    p.decal('ao_lb', hull_M(1.2, -0.42, HR + 0.012), 0.7, col=INK)
    p.decal('nostep', hull_M(-1.35, 1.45, HR + 0.012), 0.6, col=INK)
    # arm mount under the arm's shoulder
    p.box(0.46, 0.36, 0.42, FRAME_D, at=(-0.4, 1.78, 1.44), bevel=0.04, mat='TexPanel')
    # workbench (where the old table was), sample cabinet, rack under the game's glowing tubes
    p.box(2.3, 0.1, 1.5, STEEL, at=(-1.6, 1.05, 2.5), bevel=0.02, mat='TexTread')
    p.box(2.36, 0.08, 1.56, FRAME, at=(-1.6, 0.97, 2.5), mat='TexSteel')
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.box(0.08, 0.95, 0.08, FRAME, at=(-1.6 + sx * 1.08, 0.48, 2.5 + sz * 0.68), mat='TexSteel')
    p.box(2.2, 0.04, 1.4, FRAME_D, at=(-1.6, 0.3, 2.5), mat='TexTread')
    p.box(0.9, 0.55, 0.6, 0x6E7F8C, at=(-2.1, 0.6, 2.55), bevel=0.04, mat='TexPanel')
    p.decal('samples', T(-2.1, 0.62, 2.855), 0.6, col=CHALK)
    p.box(1.5, 0.06, 0.26, FRAME_D, at=(-1.6, 1.08, 1.75), mat='TexSteel')
    p.box(1.5, 0.3, 0.04, FRAME_D, at=(-1.6, 1.22, 1.63), mat='TexSteel')
    for i in range(4):
        p.add(g_torus(0.13, 0.02, 12, 4), STEEL, T(-2.1 + i * 0.33, 1.12, 1.75), mat='Metal')
    p.build(coll, parent=root, ao=0.22, ao_range=(0, 5.0))

    # the robot arm (the game swings it): shoulder, two segments, wrist and an orange tool
    a = Part('lab_arm', 82)
    a.push(T(-0.4, 2.1, 1.5))
    a.cyl(0.2, 0.2, 0.3, FRAME_D, at=(0, -0.15, 0), n=14, mat='TexSteel')
    a.add(g_cyl(0.13, 0.13, 0.36, 12), STEEL, T(0, 0, 0.12) @ RZ(PI / 2) @ T(0, -0.18, 0), mat='TexSteel')
    a.box(0.18, 0.18, 0.8, PANELS[0], at=(0, 0.05, 0.45), bevel=0.03, mat='TexPanel')
    a.add(g_cyl(0.11, 0.11, 0.3, 12), STEEL, T(0, 0.05, 0.86) @ RZ(PI / 2) @ T(0, -0.15, 0), mat='TexSteel')
    a.box(0.14, 0.14, 0.5, PANELS[0], at=(0, 0.0, 1.1), rot=(0.25, 0, 0), bevel=0.03, mat='TexPanel')
    a.cyl(0.09, 0.09, 0.12, FRAME_D, at=(0, -0.06, 1.36), rot=(PI / 2, 0, 0), n=10, mat='TexSteel')
    for sx in (-1, 1): a.box(0.03, 0.05, 0.16, CHROME, at=(sx * 0.05, -0.06, 1.5), mat='Metal')
    a.add(g_sphere(0.12, 10, 6), ORANGE, T(0, 0.02, 1.42), mat='Paint', smooth=True)
    a.pop()
    a.build(coll, origin=(-0.4, 2.1, 1.5), parent=root, ao=0)
    return root


# ---------------------------------------------------------------- Radio Dish
DK = 0.16                              # dish depth: y = DK * r^2, as before (focus at y = 1 / (4 * DK) = 1.56)


def radio_dish():
    """Dish antenna on a lattice tower: concrete footing (the old base's shape), braced steel tower with a caged
    ladder, a round top deck, a turntable and an equipment cabinet at the foot. The head (dish_head, aimed by
    the game) has a panelled reflector, ribbed back frame, rim, hub and a four-legged feed support."""
    coll = collection('A_radiodish')
    root = empty('RadioDish', coll)
    p = Part('dish_body', 91)
    p.lathe([(1.8, -0.3), (1.8, 0.05), (1.4, 0.7), (0.0, 0.7)], 0xB7B2AA, n=10, mat='TexPad')
    p.cyl(1.05, 1.05, 0.06, FRAME_D, at=(0, 0.7, 0), n=20, mat='TexSteel')
    bolt_circle(p, T(0, 0.76, 0), 0.92, 8, 0.045)

    def leg(y, sx, sz):
        w = 0.72 - (y - 0.76) / 6.74 * 0.2
        return Vector((sx * w, y, sz * w))
    corners = [(-1, -1), (1, -1), (1, 1), (-1, 1)]
    for sx, sz in corners:
        beam(p, leg(0.76, sx, sz), leg(7.45, sx, sz), 0.12, 0.12, FRAME, mat='TexSteel')
        p.box(0.26, 0.04, 0.26, FRAME_D, at=tuple(leg(0.78, sx, sz)), mat='TexSteel')
    levels = [0.9 + k * 1.09 for k in range(7)]
    for i, y in enumerate(levels):
        for k in range(4):
            a = corners[k]; b = corners[(k + 1) % 4]
            beam(p, leg(y, *a), leg(y, *b), 0.07, 0.07, STEEL, mat='TexSteel')
            if i + 1 < len(levels):
                y2 = levels[i + 1]
                beam(p, leg(y, *a), leg(y2, *b), 0.05, 0.05, STEEL_D, mat='TexSteel')
                beam(p, leg(y, *b), leg(y2, *a), 0.05, 0.05, STEEL_D, mat='TexSteel')
    # round deck, turntable and pedestal up to the head's pivot
    p.cyl(0.8, 0.8, 0.08, STEEL, at=(0, 7.36, 0), n=20, mat='TexTread')
    p.add(g_torus(0.8, 0.03, 20, 4), YELLOW, T(0, 7.44, 0), mat='Paint')
    p.cyl(0.55, 0.55, 0.22, FRAME_D, at=(0, 7.44, 0), n=20, mat='TexSteel')
    bolt_circle(p, T(0, 7.66, 0), 0.47, 10, 0.03)
    p.cyl(0.3, 0.26, 0.42, STEEL, at=(0, 7.66, 0), n=14, mat='TexSteel')
    # caged ladder on the front face
    ladder(p, (0, 0.76, 0.78), (0, 7.36, 0.58), width=0.5, rungs=17, col=STEEL)
    for k in range(5):
        y = 3.0 + k * 1.0
        zz = 0.78 - (y - 0.76) / 6.6 * 0.2
        p.add(g_torus(0.36, 0.022, 14, 4, az0=-PI / 2, sweep=PI), YELLOW, T(0, y, zz + 0.04), mat='TexPanel')
    for sx in (-1, 0, 1):
        x = sx * 0.36
        z = 0.36 if sx == 0 else 0.0
        p.add(g_tube([(x, 3.0, 0.8 - 0.07 + z), (x, 7.0, 0.68 - 0.07 + z)], 0.018, 4), YELLOW, mat='TexPanel')
    # cable down the back-left leg and across to the equipment cabinet
    cab = []
    for y in (7.3, 0.85):
        w = 0.72 - (y - 0.76) / 6.74 * 0.2
        cab.append((-(w + 0.09), y, -w))
    cab += [(-1.15, 0.78, -0.7), (-1.45, 0.76, -0.1), (-1.9, 0.12, 0.25), (-2.05, 0.12, 0.45), (-2.05, 0.4, 0.5)]
    p.add(g_tube(cab, 0.04, 6), 0x2A2D33, smooth=True)
    CX, CZ = -2.25, 0.7
    p.box(0.9, 1.3, 0.7, PANELS[1], at=(CX, 0.65, CZ), bevel=0.04, mat='TexPanel')
    p.box(1.0, 0.08, 0.8, FRAME_D, at=(CX, 1.33, CZ), mat='TexSteel')
    p.box(1.0, 0.1, 0.8, FRAME_D, at=(CX, 0.02, CZ), mat='TexSteel')
    p.decal('comms', T(CX, 1.0, CZ + 0.355), 0.72, col=INK)
    p.decal('volt', T(CX - 0.2, 0.55, CZ + 0.355), 0.3)
    louvres(p, T(CX - 0.452, 0.65, CZ) @ RY(-PI / 2), 0.45, 0.6, 5)
    p.decal('ao_rd', T(CX + 0.12, 0.25, CZ + 0.355), 0.5, col=INK)
    p.box(0.06, 0.24, 0.05, CHROME, at=(CX + 0.3, 0.6, CZ + 0.37), mat='Metal')
    p.build(coll, parent=root, ao=0.22, ao_range=(0, 8.0))

    # the head, built around its pivot, which the game turns
    h = Part('dish_head', 92)
    h.push(T(0, 8.0, 0))
    front = [(0.3, DK * 0.09)]
    for k in range(1, 13):
        r = 0.3 + (3.1 - 0.3) * k / 12
        front.append((r, DK * r * r))
    rim = front[-1]
    back = [(r, y - 0.07) for (r, y) in reversed(front)]
    h.lathe(front + [(rim[0] + 0.02, rim[1] - 0.035)] + back, 0xEEF0F2, n=36, mat='TexPanel', smooth=True, uv='y', jit=0.01)
    h.add(g_torus(3.12, 0.05, 36, 6), FRAME, T(0, rim[1] - 0.03, 0), mat='TexSteel', smooth=True)
    for k in range(12):                    # back ribs
        a = TAU * k / 12
        d = Vector((math.sin(a), 0, math.cos(a)))
        pts = []; nrm = []
        for j in range(7):
            r = 0.45 + (2.95 - 0.45) * j / 6
            pts.append(tuple(d * r + Vector((0, DK * r * r - 0.08, 0)))); nrm.append(tuple(Vector((0, -1, 0)) + d * (2 * DK * r)))
        h.add(g_ribbon(pts, nrm, 0.06, 0.16), FRAME, mat='TexSteel', jit=0.02)
    for r in (1.4, 2.4):
        h.add(g_torus(r, 0.035, 36, 4), STEEL_D, T(0, DK * r * r - 0.2, 0), mat='TexSteel')
    h.cyl(0.42, 0.36, 0.5, FRAME_D, at=(0, -0.42, 0), n=16, mat='TexSteel')
    h.add(g_sphere(0.32, 14, 6), STEEL, T(0, -0.42, 0), mat='TexSteel', smooth=True)
    for sx in (-1, 1):
        h.cyl(0.22, 0.22, 0.25, FRAME_D, at=(sx * 0.42, -0.42, 0), rot=(0, 0, PI / 2), n=12, mat='TexSteel')
    # feed support: four struts from the reflector to the feed housing (the game's beacon sits on top at y 2.2)
    FY = 1.56
    for k in range(4):
        a = TAU * k / 4 + PI / 4
        r = 2.85
        beam(h, Vector((math.sin(a) * r, DK * r * r + 0.02, math.cos(a) * r)), Vector((math.sin(a) * 0.12, FY + 0.3, math.cos(a) * 0.12)),
             0.05, 0.05, STEEL, mat='TexSteel')
    h.lathe([(0.2, FY), (0.11, FY + 0.32)], CHROME, n=12, caps=False, mat='TexSteel', smooth=True)
    h.lathe([(0.0, FY + 0.02), (0.18, FY + 0.02)], DARK, n=12, mat='Paint')
    h.box(0.32, 0.26, 0.32, PANELS[0], at=(0, FY + 0.45, 0), bevel=0.03, mat='TexPanel')
    h.pop()
    h.build(coll, origin=(0, 8.0, 0), parent=root, ao=0)
    return root


def build():
    out = {}
    for name, fn, cn in (('Hopper', hopper_model, 'A_hopper'), ('Socket', socket_model, 'A_socket'), ('AirMaker', air_maker, 'A_airmaker'),
                         ('ChargeRack', charge_rack, 'A_chargerack'), ('Greenhouse', greenhouse, 'A_greenhouse'), ('Lab', lab, 'A_lab'),
                         ('RadioDish', radio_dish, 'A_radiodish')):
        fn()
        out[name] = stats(cn)['tris']
    return out


RESULT = build()
