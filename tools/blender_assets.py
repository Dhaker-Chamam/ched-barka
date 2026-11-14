# Astro Outpost — surface detail made in Blender.
#
#   blender --background --python tools/blender_assets.py
#
# Builds, bakes and exports everything into js/assets.js (no model or image files to host):
#   * rocks      — chiselled, noise-displaced boulders, decimated, with ambient occlusion baked
#                  into their vertex colours
#   * mountains  — a ring of mountain ranges for each world (rounded lunar massifs, layered
#                  Martian highlands), ambient occlusion baked into vertex colours
#   * ground     — a tiling patch of regolith for each world, modelled as real geometry
#                  (grain, craterlets, ripples, hundreds of pebbles) and rendered from straight
#                  above with Cycles into a normal map and a shading map
#
# Written for Blender 4.2+ / 5.x. Uses only what ships with Blender.
import bpy, bmesh, math, random, base64, json, os, sys, struct, time
from mathutils import Vector, noise

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_JS = os.path.join(HERE, '..', 'js', 'assets.js')
TMP = os.path.join(HERE, '_bake')
os.makedirs(TMP, exist_ok=True)
T0 = time.time()


def log(*a):
    print('[assets %5.1fs]' % (time.time() - T0), *a)
    sys.stdout.flush()


# ----------------------------------------------------------------------------- scene set-up
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
try:
    scene.cycles.device = 'CPU'
    scene.cycles.use_denoising = False
except Exception as e:
    log('cycles settings:', e)
world = bpy.data.worlds.new('void')
scene.world = world


def link(obj):
    scene.collection.objects.link(obj)
    return obj


def clear_objects():
    for o in list(scene.collection.objects):
        bpy.data.objects.remove(o, do_unlink=True)


def only(obj):
    for o in scene.collection.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


def fbm(p, octaves=4, H=1.0):
    return noise.fractal(p, H, 2.0, octaves)


# ----------------------------------------------------------------------------- baking
plain = bpy.data.materials.new('plain')


def bake_ao(obj, samples=48):
    """Bake ambient occlusion into a per-vertex colour attribute. Returns a list of 0..1 values."""
    me = obj.data
    if not me.materials:
        me.materials.append(plain)
    attr = me.color_attributes.new(name='ao', type='FLOAT_COLOR', domain='POINT')
    try:
        me.color_attributes.active_color = attr
        me.color_attributes.render_color_index = me.color_attributes.find('ao')
    except Exception as e:
        log('colour attribute:', e)
    only(obj)
    scene.cycles.samples = samples
    scene.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    return [attr.data[i].color[0] for i in range(len(me.vertices))]


def fake_ao(me):
    """Fallback if baking is unavailable: darker in hollows and toward the base."""
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    zs = [v.co.z for v in bm.verts]; z0, z1 = min(zs), max(zs)
    out = []
    for v in bm.verts:
        if v.link_edges:
            avg = sum((e.other_vert(v).co for e in v.link_edges), Vector()) / len(v.link_edges)
            cav = (avg - v.co).dot(v.normal)
        else:
            cav = 0
        out.append(max(0.25, min(1.0, 0.62 + 0.38 * (v.co.z - z0) / max(1e-6, z1 - z0) - cav * 2.5)))
    bm.free()
    return out


def shade_of(obj, samples=48):
    try:
        return bake_ao(obj, samples), True
    except Exception as e:
        log('AO bake failed, using estimate:', e)
        return fake_ao(obj.data), False


# ----------------------------------------------------------------------------- export helpers
def pack(obj, shade, scale_hint=None):
    """Mesh -> compact dict. Blender (x, y, z-up) becomes three.js (x, y-up, z)."""
    me = obj.data
    me.calc_loop_triangles()
    verts = [(v.co.x, v.co.z, -v.co.y) for v in me.vertices]
    m = max(max(abs(c) for c in v) for v in verts)
    s = m / 32000.0
    pos = struct.pack('<%dh' % (len(verts) * 3), *[int(round(c / s)) for v in verts for c in v])
    col = bytes(max(0, min(255, int(round(x * 255)))) for x in shade)
    idx = []
    for t in me.loop_triangles:
        idx.extend((t.vertices[0], t.vertices[1], t.vertices[2]))
    fmt = 'H' if len(verts) < 65536 else 'I'
    ind = struct.pack('<%d%s' % (len(idx), fmt), *idx)
    return {'s': s, 'n': len(verts), 'w': 2 if fmt == 'H' else 4,
            'p': base64.b64encode(pos).decode(), 'c': base64.b64encode(col).decode(), 'i': base64.b64encode(ind).decode()}


# ----------------------------------------------------------------------------- rocks
def rock_mesh(seed, flat_top=False, detail=4, faces=260):
    """A boulder: a sphere chiselled by random planes, roughened with noise, then decimated."""
    rnd = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    off = Vector((rnd.uniform(-90, 90), rnd.uniform(-90, 90), rnd.uniform(-90, 90)))
    cuts = []
    for _ in range(rnd.randint(7, 12)):
        d = Vector((rnd.gauss(0, 1), rnd.gauss(0, 1), rnd.gauss(0, 0.8))).normalized()
        cuts.append((d, rnd.uniform(0.62, 0.95)))
    sx, sy, sz = rnd.uniform(0.85, 1.2), rnd.uniform(0.8, 1.15), rnd.uniform(0.62, 0.95)
    for v in bm.verts:
        p = v.co.normalized()
        r = 1.0
        for d, h in cuts:                                   # flat, angular faces
            k = p.dot(d)
            if k > 1e-4:
                r = min(r, h / k)
        r *= 1 + 0.16 * fbm(p * 1.4 + off, 3) + 0.06 * fbm(p * 5.0 + off, 3)     # lumps and roughness
        cell = noise.voronoi(p * 3.1 + off)[0]
        r *= 1 - 0.07 * (1 - smooth(0.0, 0.1, cell[1] - cell[0]))                 # cracks where cells meet
        v.co = Vector((p.x * r * sx, p.y * r * sy, p.z * r * sz))
        if flat_top:
            v.co.z = min(v.co.z, 0.36 + 0.03 * fbm(p * 3 + off, 2))
        v.co.z = max(v.co.z, -0.34 * sz)                    # sits on the ground
    zmin = min(v.co.z for v in bm.verts)
    for v in bm.verts:
        v.co.z -= zmin
    me = bpy.data.meshes.new('rock%d' % seed)
    bm.to_mesh(me); bm.free()
    obj = link(bpy.data.objects.new('rock%d' % seed, me))
    mod = obj.modifiers.new('dec', 'DECIMATE')
    mod.ratio = min(1.0, faces / max(1, len(me.polygons)))
    dg = bpy.context.evaluated_depsgraph_get()
    low = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    bpy.data.objects.remove(obj, do_unlink=True)
    return low


def build_rocks():
    out = []
    specs = [(11, False), (23, False), (37, False), (41, False), (58, False), (67, False), (72, False), (89, False)]
    for seed, flat in specs:
        clear_objects()
        obj = link(bpy.data.objects.new('rock', rock_mesh(seed, flat)))
        floor = bpy.data.meshes.new('floor')
        floor.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
        link(bpy.data.objects.new('floor', floor))        # so the base of the rock is in shadow
        shade, real = shade_of(obj)
        out.append(pack(obj, shade))
        log('rock', seed, len(obj.data.vertices), 'verts', 'baked' if real else 'estimated')
    clear_objects()
    seat = link(bpy.data.objects.new('seat', rock_mesh(105, True, faces=300)))
    floor = bpy.data.meshes.new('floor2')
    floor.from_pydata([(-6, -6, 0), (6, -6, 0), (6, 6, 0), (-6, 6, 0)], [], [(0, 1, 2, 3)])
    link(bpy.data.objects.new('floor', floor))
    shade, real = shade_of(seat)
    return out, pack(seat, shade)


# ----------------------------------------------------------------------------- mountains
# Directions in Blender's (x, y) for things in the game's (x, z): the game's +z ("south") is Blender's -y.
SUN_SIDE = math.atan2(-1.0, 0.0)            # on the Moon the Sun circles low around game-south
EARTH_SIDE = math.atan2(0.84, -0.5)         # where Earth hangs in the lunar sky (game direction -0.5, -0.84)


def build_mountains(site):
    """A ring of mountains around the play area, 400 m to 1000 m from the outpost."""
    clear_objects()
    moon = site == 'moon'
    NA, NR = 200, 22
    rnd = random.Random(7 if moon else 19)
    off = Vector((rnd.uniform(0, 50), rnd.uniform(0, 50), rnd.uniform(0, 50)))
    craters = [(rnd.uniform(0, math.tau), rnd.uniform(520, 800), rnd.uniform(35, 95)) for _ in range(16 if moon else 5)]
    gap = math.atan2(1250, 300)                 # Mars: keep the giant volcano on the horizon in view
    verts, faces, tints = [], [], []
    for ia in range(NA):
        a = ia / NA * math.tau
        for ir in range(NR):
            u = ir / (NR - 1)
            r = 400 + 600 * (u ** 1.25)
            x, y = math.cos(a) * r, math.sin(a) * r
            env = smooth(400, 500, r) * (1 - 0.8 * smooth(640, 1000, r))
            p = Vector((x, y, 0))
            if moon:
                # old, rounded massifs: broad swells with softer lumps on top
                big = 0.5 + 0.5 * fbm(p * 0.0022 + off, 2)
                h = 22 + 150 * (big ** 1.7) + 22 * fbm(p * 0.008 + off, 3)
                for ca, cr, cs in craters:                 # a few craters punched into the hills
                    d = math.hypot(x - math.cos(ca) * cr, y - math.sin(ca) * cr) / cs
                    if d < 1.6:
                        h += (-0.38 * cs * (1 - d * d) if d < 1 else 0) + 0.1 * cs * math.exp(-((d - 1) / 0.22) ** 2)
                # stay low where the Sun skims the horizon (game south) and leave a saddle for Earth to hang in
                d_sun = abs((a - SUN_SIDE + math.pi) % math.tau - math.pi)
                d_earth = abs((a - EARTH_SIDE + math.pi) % math.tau - math.pi)
                env *= (0.2 + 0.8 * smooth(1.15, 1.75, d_sun)) * (0.3 + 0.7 * smooth(0.14, 0.5, d_earth))
            else:
                # layered highlands: sharp ridges, stepped into mesas
                ridge = noise.ridged_multi_fractal(p * 0.0034 + off, 1.0, 2.0, 4, 1.0, 2.0)
                h = 18 + 62 * ridge + 30 * fbm(p * 0.006 + off, 3)
                step = 26
                h = h * 0.45 + (math.floor(h / step) + smooth(0.55, 0.95, (h / step) % 1)) * step * 0.55
                da = abs((a - gap + math.pi) % math.tau - math.pi)
                env *= 0.3 + 0.7 * smooth(0.25, 0.6, da)
            z = 22 + max(0.0, h) * env
            verts.append((x, y, z))
            # the rock itself is not one flat colour: mottled on the Moon, banded in layers on Mars
            if moon:
                tints.append(0.86 + 0.14 * fbm(p * 0.012 + off * 2, 3))
            else:
                band = math.sin(z * 0.19 + 2.0 * fbm(p * 0.004 + off, 2))
                tints.append(0.82 + 0.13 * band + 0.06 * fbm(p * 0.02 + off, 2))
    for ia in range(NA):
        ib = (ia + 1) % NA
        for ir in range(NR - 1):
            faces.append((ia * NR + ir, ib * NR + ir, ib * NR + ir + 1, ia * NR + ir + 1))
    me = bpy.data.meshes.new('mountains_' + site)
    me.from_pydata(verts, [], faces); me.update()
    obj = link(bpy.data.objects.new('mountains', me))
    shade, real = shade_of(obj, 32)
    shade = [max(0.0, min(1.0, s * t)) for s, t in zip(shade, tints)]
    log('mountains', site, len(verts), 'verts', 'baked' if real else 'estimated')
    return pack(obj, shade)


# ----------------------------------------------------------------------------- ground tile
TILE = 12.0          # metres; the texture repeats every 12 m
GRID = 300


def tile_noise(x, y, f, off, octaves=3):
    """Noise that repeats exactly every TILE metres (four shifted copies, cross-faded)."""
    u, v = x / TILE, y / TILE
    def n(dx, dy):
        return fbm(Vector(((x - dx) * f, (y - dy) * f, 0)) + off, octaves)
    return (n(0, 0) * (1 - u) * (1 - v) + n(TILE, 0) * u * (1 - v) + n(0, TILE) * (1 - u) * v + n(TILE, TILE) * u * v)


def wrap_d(a, b):
    d = abs(a - b) % TILE
    return min(d, TILE - d)


def build_ground(site):
    clear_objects()
    moon = site == 'moon'
    rnd = random.Random(3 if moon else 5)
    off = Vector((rnd.uniform(0, 40), rnd.uniform(0, 40), rnd.uniform(0, 40)))
    craters = [(rnd.uniform(0, TILE), rnd.uniform(0, TILE), rnd.uniform(0.1, 0.4) * (2.3 if rnd.random() < 0.16 else 1.0))
               for _ in range(24 if moon else 6)]
    verts, faces = [], []
    N = GRID
    for j in range(N + 1):
        y = j / N * TILE
        for i in range(N + 1):
            x = i / N * TILE
            h = 0.045 * tile_noise(x, y, 0.55, off, 2)                  # gentle swells
            h += 0.012 * tile_noise(x, y, 5.0, off, 3)                  # clods
            h += 0.004 * tile_noise(x, y, 22.0, off, 2)                 # grain
            if not moon:                                                # wind ripples on Mars
                ph = (x / TILE * 15 + y / TILE * 4) * math.tau + 2.6 * tile_noise(x, y, 0.5, off + Vector((9, 9, 9)), 2)
                h += 0.02 * (0.5 + 0.5 * math.sin(ph)) ** 1.6 * (0.55 + 0.45 * tile_noise(x, y, 0.4, off + Vector((5, 1, 3)), 2))
            for cx, cy, cr in craters:
                d = math.hypot(wrap_d(x, cx), wrap_d(y, cy)) / cr
                if d < 1.8:
                    if d < 1:
                        h -= 0.26 * cr * (1 - d * d)
                    h += 0.06 * cr * math.exp(-((d - 1) / 0.24) ** 2)
            verts.append((x - TILE / 2, y - TILE / 2, h))
    for j in range(N):
        for i in range(N):
            a = j * (N + 1) + i
            faces.append((a, a + 1, a + N + 2, a + N + 1))
    me = bpy.data.meshes.new('ground_' + site)
    me.from_pydata(verts, [], faces); me.update()
    try:
        me.shade_smooth()
    except Exception:
        me.polygons.foreach_set('use_smooth', [True] * len(me.polygons))
    ground = link(bpy.data.objects.new('ground', me))

    # pebbles and small stones, half buried; copies near an edge re-appear on the opposite side
    stones = [rock_mesh(200 + k, detail=2, faces=80) for k in range(6)]
    count = 150 if moon else 230
    for k in range(count):
        x, y = rnd.uniform(-TILE / 2, TILE / 2), rnd.uniform(-TILE / 2, TILE / 2)
        s = 0.018 + (rnd.random() ** 3.2) * (0.2 if moon else 0.15)
        rot = (rnd.uniform(-0.4, 0.4), rnd.uniform(-0.4, 0.4), rnd.uniform(0, math.tau))
        sc = (s * rnd.uniform(0.8, 1.3), s * rnd.uniform(0.8, 1.3), s * rnd.uniform(0.6, 1.0))
        me_s = stones[k % len(stones)]
        for dx in (-TILE, 0, TILE):
            for dy in (-TILE, 0, TILE):
                px, py = x + dx, y + dy
                if abs(px) > TILE / 2 + s * 2 or abs(py) > TILE / 2 + s * 2:
                    continue
                o = link(bpy.data.objects.new('stone', me_s))
                o.location = (px, py, -s * 0.28)
                o.rotation_euler = rot; o.scale = sc

    # camera straight above, seeing exactly one tile
    cam_data = bpy.data.cameras.new('cam'); cam_data.type = 'ORTHO'; cam_data.ortho_scale = TILE
    cam_data.clip_start = 0.1; cam_data.clip_end = 50
    cam = link(bpy.data.objects.new('cam', cam_data)); cam.location = (0, 0, 10)
    scene.camera = cam
    r = scene.render
    r.resolution_x = r.resolution_y = 1024; r.resolution_percentage = 100
    r.film_transparent = False
    try:
        r.dither_intensity = 0
    except Exception:
        pass
    r.image_settings.file_format = 'JPEG'; r.image_settings.color_mode = 'RGB'; r.image_settings.quality = 90
    vs = scene.view_settings
    vs.look = 'None'; vs.exposure = 0; vs.gamma = 1

    def shader(name, build):
        m = bpy.data.materials.new(name); m.use_nodes = True
        nt = m.node_tree; nt.nodes.clear()
        out = nt.nodes.new('ShaderNodeOutputMaterial'); em = nt.nodes.new('ShaderNodeEmission')
        nt.links.new(em.outputs[0], out.inputs[0])
        build(nt, em)
        return m

    def normal_nodes(nt, em):               # colour = normal * 0.5 + 0.5
        geo = nt.nodes.new('ShaderNodeNewGeometry'); vm = nt.nodes.new('ShaderNodeVectorMath')
        vm.operation = 'MULTIPLY_ADD'
        vm.inputs[1].default_value = (0.5, 0.5, 0.5); vm.inputs[2].default_value = (0.5, 0.5, 0.5)
        nt.links.new(geo.outputs['Normal'], vm.inputs[0]); nt.links.new(vm.outputs[0], em.inputs[0])

    def ao_nodes(nt, em):                   # brightness = how open each point is to the sky
        ao = nt.nodes.new('ShaderNodeAmbientOcclusion'); ao.inputs['Distance'].default_value = 0.5
        try:
            ao.samples = 16
        except Exception:
            pass
        nt.links.new(ao.outputs['AO'], em.inputs[0])

    res = {}
    for key, build, view, spp, size, q in (('n', normal_nodes, 'Raw', 8, 1024, 90), ('a', ao_nodes, 'Standard', 96, 512, 86)):
        bpy.context.view_layer.material_override = shader(key + site, build)
        vs.view_transform = view
        scene.cycles.samples = spp
        r.resolution_x = r.resolution_y = size; r.image_settings.quality = q
        path = os.path.join(TMP, 'ground_%s_%s.jpg' % (site, key))
        r.filepath = path
        bpy.ops.render.render(write_still=True)
        with open(path, 'rb') as f:
            data = f.read()
        res[key] = 'data:image/jpeg;base64,' + base64.b64encode(data).decode()
        log('ground', site, key, len(data) // 1024, 'KB')
    bpy.context.view_layer.material_override = None
    res['tile'] = TILE
    return res


# ----------------------------------------------------------------------------- run
log('Blender', bpy.app.version_string)
rocks, seat = build_rocks()
assets = {
    'made': 'Blender ' + bpy.app.version_string, 'rocks': rocks, 'seat': seat,
    'mountains': {s: build_mountains(s) for s in ('moon', 'mars')},
    'ground': {s: build_ground(s) for s in ('moon', 'mars')},
}
with open(OUT_JS, 'w', encoding='utf-8') as f:
    f.write('/* Astro Outpost — surface detail made in Blender. GENERATED by tools/blender_assets.py — do not edit by hand.\n'
            '   rocks + mountains: meshes with ambient occlusion baked into vertex colours (positions are Int16 * s).\n'
            '   ground: a tiling patch of regolith, rendered from real geometry into a normal map (n) and a shading map (a). */\n')
    f.write('window.JA_ASSETS = ' + json.dumps(assets, separators=(',', ':')) + ';\n')
log('wrote', os.path.normpath(OUT_JS), os.path.getsize(OUT_JS) // 1024, 'KB')
if '--keep' not in sys.argv:                 # the renders are embedded in assets.js; pass --keep after "--" to inspect them
    import shutil
    shutil.rmtree(TMP, ignore_errors=True)
