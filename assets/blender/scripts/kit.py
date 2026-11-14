"""kit.py - small procedural modelling kit used to build the Astro Outpost asset pack in Blender.

Everything is authored in GAME coordinates (three.js): x = right, y = up, z = front (toward the
starting camera), 1 unit = 1 metre. Part.build() converts to Blender's Z-up space, so a glTF export
with +Y up lands back on the exact numbers used in js/base.js and js/actors.js.

Angles around the vertical axis use the game's convention: az = 0 faces +z (front), az = pi/2 faces +x.
"""
import bpy, bmesh, math, os, random, colorsys, json
from mathutils import Vector, Matrix, Quaternion, noise as mnoise

TAU = math.tau
PI = math.pi
ASSET_BLEND = 'astro_outpost_assets.blend'
REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
TEXDIR = os.path.join(REPO, 'assets', 'textures')
try:                                     # made by make_textures.py: where each label sits on the sheet, metres per texture repeat
    with open(os.path.join(TEXDIR, 'decals.json'), encoding='utf-8') as _f: _DEC = json.load(_f)
except OSError:
    _DEC = {'size': [1024, 1024], 'cells': {}, 'tile': {}}
DECALS = _DEC['cells']
TILE = _DEC['tile']

# ---------------------------------------------------------------- shared palette: grey metal, sparse accents
PANELS = [0xB9BEC5, 0xA9AFB7, 0xC6CBD1, 0x9DA3AC, 0xB2B7BE]   # light steel panels (vary per panel)
PANEL_L = 0xC2C7CD                 # pale panel
FRAME = 0x6C727B                   # gunmetal frames, ribs, posts
FRAME_D = 0x4A4F57                 # darker steel
UNDER = 0x2C3036                   # shadowed inner shells
STEEL = 0x8D949D                   # mid steel (bands, pipes, fittings)
STEEL_D = 0x5F656E
CHROME = 0xDCE0E5                  # rivets, knobs, polished bits
TIN = 0xC8CDD3                     # bright sheet metal
BLUESTEEL = 0x6E7F8C               # cool blue-grey sheets
BLUESTEEL_D = 0x56646F
LIGHT = 0xE4E6E9                   # off-white panels
DOOR = 0x5E6B77
CONCRETE = 0x8E9298
CABLE = 0x3C4047                   # former rope
STRAP = 0x454A52                   # former leather
STRAP_D = 0x33363C
DARK = 0x26282D
RED = 0xD0533F; RED_D = 0xA9402F   # accents only
ORANGE = 0xE07B39                  # safety stripe accent
RUBBER = 0x33313C                  # tyres


def guard():
    """Refuse to touch any .blend other than the asset file (or a new, unsaved one)."""
    fp = bpy.data.filepath
    if fp and os.path.basename(fp).lower() != ASSET_BLEND:
        raise RuntimeError('kit: the open file is %r, not %s. Open the asset file (or a new file) first.' % (fp, ASSET_BLEND))


# ---------------------------------------------------------------- colour
def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgb(h):
    if isinstance(h, int):
        return ((h >> 16 & 255) / 255.0, (h >> 8 & 255) / 255.0, (h & 255) / 255.0)
    return tuple(h[:3])


def shade(c, k):
    r, g, b = rgb(c)
    return (min(1.0, r * k), min(1.0, g * k), min(1.0, b * k))


def mixc(a, b, t):
    a = rgb(a); b = rgb(b)
    return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))


def jitter(c, rng, val=0.05, hue=0.008, sat=0.04):
    r, g, b = rgb(c)
    h, s, v = colorsys.rgb_to_hsv(r, g, b)
    h = (h + rng.uniform(-hue, hue)) % 1.0
    s = min(1.0, max(0.0, s * (1 + rng.uniform(-sat, sat))))
    v = min(1.0, max(0.0, v * (1 + rng.uniform(-val, val))))
    return colorsys.hsv_to_rgb(h, s, v)


# ---------------------------------------------------------------- transforms (game space)
def T(x=0.0, y=0.0, z=0.0):
    return Matrix.Translation((x, y, z))


def RX(a): return Matrix.Rotation(a, 4, 'X')
def RY(a): return Matrix.Rotation(a, 4, 'Y')
def RZ(a): return Matrix.Rotation(a, 4, 'Z')


def ROT(x=0.0, y=0.0, z=0.0):
    """Same order as three.js Euler 'XYZ' (object.rotation.set(x, y, z))."""
    return RX(x) @ RY(y) @ RZ(z)


def SC(x, y=None, z=None):
    if y is None: y = x
    if z is None: z = x
    return Matrix.Diagonal((x, y, z, 1.0))


def AZ(a, r=0.0, y=0.0):
    """Place at azimuth a (0 = front/+z, pi/2 = +x), radius r, height y. Local +z points outward."""
    return T(0, y, 0) @ RY(a) @ T(0, 0, r)


def ALIGN(d):
    """Rotation taking local +y onto direction d."""
    d = Vector(d).normalized()
    return Vector((0, 1, 0)).rotation_difference(d).to_matrix().to_4x4()


def g2b(v):
    return Vector((v[0], -v[2], v[1]))


# ---------------------------------------------------------------- primitive generators -> (verts, faces)
def _bm_lists(bm):
    bm.verts.index_update()
    return [tuple(v.co) for v in bm.verts], [[v.index for v in f.verts] for f in bm.faces]


_box_cache = {}


def g_box(w, h, d, bevel=0.0, top=(1.0, 1.0)):
    """Centred box. `top` scales the +y end in x and z (taper)."""
    key = (round(w, 4), round(h, 4), round(d, 4), round(bevel, 4), tuple(top))
    if key in _box_cache:
        return _box_cache[key]
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= w; v.co.y *= h; v.co.z *= d
        if v.co.y > 0:
            v.co.x *= top[0]; v.co.z *= top[1]
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, offset_type='OFFSET', segments=1, profile=0.5, affect='EDGES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    out = _bm_lists(bm)
    bm.free()
    _box_cache[key] = out
    return out


def g_lathe(profile, n=16, az0=0.0, sweep=TAU, caps=True):
    """Revolve (radius, y) pairs around the y axis. Ascending profile => outward facing."""
    full = abs(sweep - TAU) < 1e-6
    al0 = PI / 2 - az0 - sweep
    cols = n if full else n + 1
    verts, rows = [], []
    for (r, y) in profile:
        if r <= 1e-6:
            rows.append([len(verts)]); verts.append((0.0, y, 0.0))
        else:
            ring = []
            for j in range(cols):
                a = al0 + sweep * j / n
                ring.append(len(verts)); verts.append((r * math.cos(a), y, r * math.sin(a)))
            rows.append(ring)
    faces = []
    for i in range(len(rows) - 1):
        A, B = rows[i], rows[i + 1]
        for j in range(n):
            j1 = (j + 1) % cols if full else j + 1
            f = [A[j] if len(A) > 1 else A[0], B[j] if len(B) > 1 else B[0],
                 B[j1] if len(B) > 1 else B[0], A[j1] if len(A) > 1 else A[0]]
            g = []
            for x in f:
                if x not in g: g.append(x)
            if len(g) >= 3: faces.append(g)
    if caps and full:
        if len(rows[0]) > 1: faces.append(list(rows[0]))
        if len(rows[-1]) > 1: faces.append(list(reversed(rows[-1])))
    return verts, faces


def g_cyl(r0, r1, h, n=12, bevel=0.0):
    """Cylinder/cone standing on y=0 (r0 bottom radius, r1 top radius)."""
    if bevel > 0:
        b = bevel
        prof = [(max(r0 - b, 0.001), 0), (r0 + (r1 - r0) * (b / h), b), (r1 + (r0 - r1) * (b / h), h - b), (max(r1 - b, 0.001), h)]
    else:
        prof = [(r0, 0), (r1, h)]
    return g_lathe(prof, n)


def g_sphere(r, n=14, m=8, t0=0.0, t1=PI, sy=1.0):
    """UV sphere centred on the origin; t0..t1 is the polar range measured from the bottom pole."""
    prof = []
    for i in range(m + 1):
        t = t0 + (t1 - t0) * i / m
        prof.append((abs(r * math.sin(t)) if 1e-6 < t < PI - 1e-6 else 0.0, -r * math.cos(t) * sy))
    return g_lathe(prof, n)


def g_torus(R, r, n=24, m=8, az0=0.0, sweep=TAU):
    """Ring around the y axis."""
    full = abs(sweep - TAU) < 1e-6
    al0 = PI / 2 - az0 - sweep
    cols = n if full else n + 1
    verts = []
    for i in range(cols):
        u = al0 + sweep * i / n
        for j in range(m):
            v = TAU * j / m
            verts.append(((R + r * math.cos(v)) * math.cos(u), r * math.sin(v), (R + r * math.cos(v)) * math.sin(u)))
    faces = []
    for i in range(n):
        i1 = (i + 1) % cols if full else i + 1
        for j in range(m):
            j1 = (j + 1) % m
            faces.append([i * m + j, i * m + j1, i1 * m + j1, i1 * m + j])
    if not full:
        faces.append([j for j in range(m)][::-1])
        faces.append([n * m + j for j in range(m)])
    return verts, faces


def g_tube(points, r, n=6, caps=True):
    """Sweep a circle along a polyline. r may be a number or a function of t in 0..1."""
    P = [Vector(p) for p in points]
    k = len(P)
    tang = []
    for i in range(k):
        a = P[max(i - 1, 0)]; b = P[min(i + 1, k - 1)]
        tang.append((b - a).normalized())
    t0 = tang[0]
    N = t0.orthogonal().normalized()
    verts = []
    for i in range(k):
        t = tang[i]
        if i > 0:
            q = tang[i - 1].rotation_difference(t)
            N = (q @ N).normalized()
        N = (N - t * N.dot(t)).normalized()
        Bn = t.cross(N)
        rr = r(i / (k - 1)) if callable(r) else r
        for j in range(n):
            a = TAU * j / n
            verts.append(tuple(P[i] + (N * math.cos(a) + Bn * math.sin(a)) * rr))
    faces = []
    for i in range(k - 1):
        for j in range(n):
            j1 = (j + 1) % n
            faces.append([i * n + j, i * n + j1, (i + 1) * n + j1, (i + 1) * n + j])
    if caps:
        faces.append([j for j in range(n)][::-1])
        faces.append([(k - 1) * n + j for j in range(n)])
    return verts, faces


def g_prism(poly, depth):
    """Extrude an (x, y) polygon along z, centred on z = 0."""
    n = len(poly)
    verts = [(x, y, depth / 2) for (x, y) in poly] + [(x, y, -depth / 2) for (x, y) in poly]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    for i in range(n):
        j = (i + 1) % n
        faces.append([i, n + i, n + j, j])
    return verts, faces


def g_grid(w, h, nx, ny, fn=None, double=True):
    """Sheet in the xy plane from x=0..w, y=-h/2..h/2 facing +z, displaced by fn(u, v) -> (dx, dy, dz)."""
    verts = []
    for j in range(ny + 1):
        for i in range(nx + 1):
            u = i / nx; v = j / ny
            d = fn(u, v) if fn else (0, 0, 0)
            verts.append((u * w + d[0], (v - 0.5) * h + d[1], d[2]))
    faces = []
    for j in range(ny):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append([a, a + 1, a + nx + 2, a + nx + 1])
    if double:
        off = len(verts)
        verts = verts + list(verts)
        faces = faces + [[off + i for i in reversed(f)] for f in faces]
    return verts, faces


def g_staves(profile, n, gap=0.12, thick=0.06, az0=0.0, sweep=TAU):
    """Panels (staves) following a (radius, y) profile, like hull plates or barrel staves. Returns one (verts, faces) per panel."""
    out = []
    da = sweep / n
    al_end = PI / 2 - az0
    for k in range(n):
        aL = al_end - (k + 1) * da + da * gap / 2
        aR = al_end - k * da - da * gap / 2
        verts, faces = [], []
        m = len(profile)
        for (r, y) in profile:
            for (a, rr) in ((aL, r), (aR, r), (aL, r - thick), (aR, r - thick)):
                verts.append((rr * math.cos(a), y, rr * math.sin(a)))
        for i in range(m - 1):
            OL, OR, IL, IR = 4 * i, 4 * i + 1, 4 * i + 2, 4 * i + 3
            OL1, OR1, IL1, IR1 = OL + 4, OR + 4, IL + 4, IR + 4
            faces.append([OL, OL1, OR1, OR])
            faces.append([OL, IL, IL1, OL1])
            faces.append([OR, OR1, IR1, IR])
        t = 4 * (m - 1)
        faces.append([0, 1, 3, 2])
        faces.append([t, t + 2, t + 3, t + 1])
        out.append((verts, faces))
    return out


def g_rock(seed=1, detail=2, cuts=9, rough=0.16, squash=(1.0, 0.8, 1.0), flat_base=0.35):
    """Chiselled boulder of roughly unit radius: an icosphere cut by random planes, lightly dented."""
    rng = random.Random(seed)
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=detail, radius=1.0)
    off = Vector((rng.uniform(0, 50), rng.uniform(0, 50), rng.uniform(0, 50)))
    for v in bm.verts:
        nrm = v.co.normalized()
        v.co = nrm * (1.0 + rough * (mnoise.noise(nrm * 1.3 + off) * 1.0))
    for _ in range(cuts):
        nrm = Vector((rng.uniform(-1, 1), rng.uniform(-0.5, 1), rng.uniform(-1, 1))).normalized()
        d = rng.uniform(0.62, 0.9)
        for v in bm.verts:
            e = v.co.dot(nrm) - d
            if e > 0: v.co -= nrm * e
    for v in bm.verts:
        v.co.x *= squash[0]; v.co.y *= squash[1]; v.co.z *= squash[2]
        if v.co.y < -flat_base: v.co.y = -flat_base
    bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=0.02)
    bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(5), verts=bm.verts[:], edges=bm.edges[:])
    bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 4])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    out = _bm_lists(bm)
    bm.free()
    return out


def _closed(faces):
    cnt = {}
    for f in faces:
        k = len(f)
        for i in range(k):
            e = (f[i], f[(i + 1) % k])
            e = e if e[0] < e[1] else (e[1], e[0])
            cnt[e] = cnt.get(e, 0) + 1
    return all(c == 2 for c in cnt.values())


def _signed_volume(verts, faces):
    c = Vector((0, 0, 0))
    for v in verts: c += Vector(v)
    c /= max(1, len(verts))
    vol = 0.0
    for f in faces:
        p0 = Vector(verts[f[0]]) - c
        for k in range(1, len(f) - 1):
            vol += p0.dot((Vector(verts[f[k]]) - c).cross(Vector(verts[f[k + 1]]) - c))
    return vol


# ---------------------------------------------------------------- materials
MATS = {
    'Paint':      dict(vcol=True, rough=0.5, metal=0.3),     # painted / brushed metal panels
    'Metal':      dict(vcol=True, rough=0.34, metal=0.6),    # bare steel; the game gives model materials a small environment map
    'Cloth':      dict(vcol=True, rough=0.92, metal=0.0),    # fabric, rubber, food
    'Suit':       dict(vcol=True, rough=0.85, metal=0.0, tint=0xE3E6EA),     # suit fabric (light grey)
    'SuitAccent': dict(vcol=True, rough=0.7, metal=0.0, tint=0xE8873A),      # cuffs and bands: the game sets this to the chosen suit colour
    'Rock':       dict(vcol=True, rough=0.95, metal=0.0, tint=0x9A9EA6),
    'Visor':      dict(color=0xFFB733, rough=0.14, metal=0.9, emit=0.35, ecolor=0x6B4A08),
    'DarkGlass':  dict(color=0x10182C, rough=0.16, metal=0.3),
    'SolarGlass': dict(vcol=True, rough=1.0, metal=0.15, tex='solar', nrm=0.8, emit=0.3, ecolor=0x1B3F96),   # solar cells (texture); the game tints material.color for dust
    'Glow_Warm':  dict(color=0xFFC766, emit=2.6),
    'Glow_Cool':  dict(color=0x7FE6FF, emit=2.2),
    'Glow_Green': dict(color=0x4DFF9A, emit=2.4),
    'Glow_Door':  dict(color=0x4DFF9A, emit=2.4),     # habitat door light: its own material so the game can turn it red in a storm
    'Glow_Red':   dict(color=0xFF5A4A, emit=2.6),
    'Glow_Gold':  dict(color=0xFFD23F, emit=1.6),
    'Glow_Socket': dict(color=0xFFD23F, emit=1.4),   # rover charging ring: own material, the game recolours it
    'Glow_Core':  dict(color=0xFFD23F, emit=1.3),    # core sample cap: the game colours it by sample quality
    'Glow_Inst':  dict(color=0x5CF0FF, emit=0.9),    # instrument band: the game colours it per instrument
    'Sack':       dict(vcol=True, rough=0.95, metal=0.0, tint=0xB8926A),   # soil bag: tint per site
    'Ice':        dict(color=0xDFF7FF, rough=0.15, metal=0.0, emit=0.9, ecolor=0x58C8FF),
    # ---- textured (the machines): `tex` names a set made by make_textures.py; its roughness map holds the real
    # roughness, so `rough` only scales it. Colour comes from the vertex colours times the texture.
    'TexPanel':   dict(vcol=True, rough=1.0, metal=0.35, tex='panel', nrm=1.0),     # painted metal sheeting
    'TexSteel':   dict(vcol=True, rough=1.0, metal=0.7, tex='steel', nrm=0.6),      # brushed / bare steel
    'TexFoil':    dict(vcol=True, rough=1.0, metal=0.85, tex='foil', nrm=1.0),      # gold insulation blanket (paint it white)
    'TexTread':   dict(vcol=True, rough=1.0, metal=0.55, tex='tread', nrm=1.0),     # diamond tread plate decks
    'TexPad':     dict(vcol=True, rough=1.0, metal=0.0, tex='pad', nrm=1.0),        # sintered regolith pavers
    'TexSoil':    dict(vcol=True, rough=1.0, metal=0.0, tex='soil', nrm=1.0),       # growing medium (paint it white)
    'Decal':      dict(vcol=True, rough=0.6, metal=0.1, tex='decals', alpha=0.45),  # labels: colour = vertex colour x the sheet
    'Glass':      dict(color=0xCFEFFF, rough=0.05, metal=0.1, opacity=0.2),         # see-through panes (no shadow)
}


def _tex_node(nt, path, loc, colour=True):
    img = bpy.data.images.get(os.path.basename(path))
    if img is None and os.path.exists(path):
        img = bpy.data.images.load(path, check_existing=True)
    n = nt.nodes.new('ShaderNodeTexImage'); n.location = loc
    if img is not None:
        n.image = img
        img.colorspace_settings.name = 'sRGB' if colour else 'Non-Color'
    uv = nt.nodes.new('ShaderNodeUVMap'); uv.uv_map = 'UVMap'; uv.location = (loc[0] - 220, loc[1])
    nt.links.new(uv.outputs['UV'], n.inputs['Vector'])
    return n


def _textured(m, spec):
    """Blender preview of a textured material (the game builds its own from the same pictures)."""
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; ca.location = (-520, 420)
    t = spec['tex']
    if t == 'decals':
        c = _tex_node(nt, os.path.join(TEXDIR, 'decals.png'), (-520, 160))
        nt.links.new(c.outputs['Alpha'], bsdf.inputs['Alpha'])
        try: m.surface_render_method = 'DITHERED'
        except Exception: pass
    else:
        c = _tex_node(nt, os.path.join(TEXDIR, t + '_c.jpg'), (-520, 160))
        r = _tex_node(nt, os.path.join(TEXDIR, t + '_r.jpg'), (-520, -100), colour=False)
        nm = _tex_node(nt, os.path.join(TEXDIR, t + '_n.jpg'), (-520, -360), colour=False)
        nn = nt.nodes.new('ShaderNodeNormalMap'); nn.location = (-240, -360); nn.inputs['Strength'].default_value = spec.get('nrm', 1.0)
        nt.links.new(nm.outputs['Color'], nn.inputs['Color']); nt.links.new(nn.outputs['Normal'], bsdf.inputs['Normal'])
        nt.links.new(r.outputs['Color'], bsdf.inputs['Roughness'])
    mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.location = (-240, 300)
    mx.inputs[0].default_value = 1.0
    nt.links.new(ca.outputs['Color'], mx.inputs[6]); nt.links.new(c.outputs['Color'], mx.inputs[7])
    nt.links.new(mx.outputs[2], bsdf.inputs['Base Color'])
    bsdf.inputs['Metallic'].default_value = spec.get('metal', 0.0)
    if spec.get('emit'):
        bsdf.inputs['Emission Color'].default_value = tuple(_lin(c) for c in rgb(spec['ecolor'])) + (1.0,)
        bsdf.inputs['Emission Strength'].default_value = spec['emit']
    m.use_backface_culling = True
    return m


def get_mat(name):
    m = bpy.data.materials.get(name)
    if m: return m
    spec = MATS[name]
    if spec.get('tex'):
        m = bpy.data.materials.new(name)
        if not m.node_tree: m.use_nodes = True
        return _textured(m, spec)
    m = bpy.data.materials.new(name)
    if not m.node_tree: m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Roughness'].default_value = spec.get('rough', 0.5)
    bsdf.inputs['Metallic'].default_value = spec.get('metal', 0.0)
    if spec.get('vcol'):
        ca = nt.nodes.new('ShaderNodeVertexColor'); ca.layer_name = 'Col'; ca.location = (-520, 300)
        if spec.get('tint') is not None:
            mx = nt.nodes.new('ShaderNodeMix'); mx.data_type = 'RGBA'; mx.blend_type = 'MULTIPLY'; mx.location = (-260, 300)
            mx.inputs[0].default_value = 1.0
            nt.links.new(ca.outputs['Color'], mx.inputs[6])
            mx.inputs[7].default_value = tuple(_lin(c) for c in rgb(spec['tint'])) + (1.0,)
            nt.links.new(mx.outputs[2], bsdf.inputs['Base Color'])
        else:
            nt.links.new(ca.outputs['Color'], bsdf.inputs['Base Color'])
        if spec.get('emit'):
            bsdf.inputs['Emission Color'].default_value = tuple(_lin(c) for c in rgb(spec['ecolor'])) + (1.0,)
            bsdf.inputs['Emission Strength'].default_value = spec['emit']
    else:
        col = tuple(_lin(c) for c in rgb(spec['color'])) + (1.0,)
        bsdf.inputs['Base Color'].default_value = col
        if spec.get('emit'):
            ec = tuple(_lin(c) for c in rgb(spec.get('ecolor', spec['color']))) + (1.0,)
            bsdf.inputs['Emission Color'].default_value = ec
            bsdf.inputs['Emission Strength'].default_value = spec['emit']
            if 'rough' not in spec: bsdf.inputs['Roughness'].default_value = 0.4
        m.diffuse_color = tuple(rgb(spec['color'])) + (1.0,)
        if spec.get('opacity') is not None:
            bsdf.inputs['Alpha'].default_value = spec['opacity']
            try: m.surface_render_method = 'BLENDED'
            except Exception: pass
    m.use_backface_culling = spec.get('opacity') is None
    return m


def textured(mat):
    return bool(MATS.get(mat, {}).get('tex'))


# ---------------------------------------------------------------- texture coordinates
def _face_normal(pts):
    nx = ny = nz = 0.0
    k = len(pts)
    for i in range(k):
        a = pts[i]; b = pts[(i + 1) % k]
        nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1])
    ln = math.sqrt(nx * nx + ny * ny + nz * nz)
    return (nx / ln, ny / ln, nz / ln) if ln > 0 else (0.0, 1.0, 0.0)


def uv_box(pts):
    """Project a face on the axis plane it faces most (metres), oriented as seen from outside."""
    nx, ny, nz = _face_normal(pts)
    ax, ay, az = abs(nx), abs(ny), abs(nz)
    if ax >= ay and ax >= az:
        s = 1 if nx > 0 else -1
        return [(-p[2] * s, p[1]) for p in pts]
    if az >= ay:
        s = 1 if nz > 0 else -1
        return [(p[0] * s, p[1]) for p in pts]
    s = 1 if ny > 0 else -1
    return [(p[0], -p[2] * s) for p in pts]


def uv_cyl(pts):
    """Wrap around the local y axis (metres along the surface); flat caps get a top-down projection."""
    nx, ny, nz = _face_normal(pts)
    if abs(ny) > 0.75:
        s = 1 if ny > 0 else -1
        return [(p[0], -p[2] * s) for p in pts]
    angs = [math.atan2(p[0], p[2]) for p in pts]
    if max(angs) - min(angs) > PI:
        angs = [a + TAU if a < 0 else a for a in angs]
    rad = sum(math.hypot(p[0], p[2]) for p in pts) / len(pts)
    return [(a * rad, p[1]) for a, p in zip(angs, pts)]


# ---------------------------------------------------------------- Part: accumulates one mesh object
class Part:
    def __init__(self, name, seed=1):
        self.name = name
        self.rng = random.Random(seed)
        self.V, self.F, self.C, self.M, self.S, self.U = [], [], [], [], [], []
        self.stack = [Matrix.Identity(4)]

    # transform stack
    def push(self, M): self.stack.append(self.stack[-1] @ M)
    def pop(self): self.stack.pop()

    def add(self, geo, col, M=None, mat='Paint', smooth=False, jit=0.05, fjit=0.02, flip=False, uv=None):
        """uv (textured materials only): None = box projection of the finished shape; 'cyl' = wrapped around the
        shape's own y axis (lathes, cylinders); 'lbox' = box projection in the shape's own axes (turns with it);
        'y' = straight down the shape's own y axis (dishes, domes seen from above).
        Labels use decal() instead."""
        verts, faces = geo
        if _closed(faces):
            if _signed_volume(verts, faces) < 0: faces = [f[::-1] for f in faces]
        if flip: faces = [f[::-1] for f in faces]
        X = self.stack[-1] @ M if M is not None else self.stack[-1]
        if X.to_3x3().determinant() < 0: faces = [f[::-1] for f in faces]
        base = len(self.V)
        lv = [Vector(v) for v in verts]
        self.V.extend(X @ v for v in lv)
        pc = None if callable(col) else jitter(col, self.rng, jit)
        for f in faces:
            if callable(col):
                c = Vector((0, 0, 0))
                for i in f: c += lv[i]
                c /= len(f)
                nrm = Vector((0, 0, 0))
                for i in range(len(f)):
                    a = lv[f[i]]; b = lv[f[(i + 1) % len(f)]]
                    nrm += Vector(((a.y - b.y) * (a.z + b.z), (a.z - b.z) * (a.x + b.x), (a.x - b.x) * (a.y + b.y)))
                if nrm.length > 0: nrm.normalize()
                fc = jitter(col(c, nrm), self.rng, fjit)
            else:
                fc = jitter(pc, self.rng, fjit) if fjit else pc
            self.F.append([base + i for i in f]); self.C.append(fc); self.M.append(mat); self.S.append(smooth)
            if not textured(mat) or uv is None: self.U.append(None)
            elif uv == 'cyl': self.U.append(('m', uv_cyl([lv[i] for i in f])))
            elif uv == 'lbox': self.U.append(('m', uv_box([lv[i] for i in f])))
            elif uv == 'y': self.U.append(('m', [(lv[i][0], -lv[i][2]) for i in f]))
            else: self.U.append(None)
        return self

    def stamp(self, other, M=None, jit=0.0):
        """Copy another Part's geometry in (already coloured), transformed by M."""
        X = self.stack[-1] @ M if M is not None else self.stack[-1]
        base = len(self.V)
        self.V.extend(X @ v for v in other.V)
        neg = X.to_3x3().determinant() < 0
        k = 1 + self.rng.uniform(-jit, jit) if jit else 1.0
        for f, c, m, s in zip(other.F, other.C, other.M, other.S):
            idx = [base + i for i in f]
            if neg: idx.reverse()
            self.F.append(idx); self.C.append(shade(c, k)); self.M.append(m); self.S.append(s)
        self.U.extend(other.U)
        return self

    def decal(self, cell, M, w, h=None, col=0xFFFFFF, lift=0.004, mat='Decal'):
        """A label from the decal sheet: a w x h quad in the local xy plane, facing local +z, lifted off the surface."""
        u0, v0, u1, v1 = DECALS[cell]
        if h is None:
            W, H = _DEC['size']
            h = w * ((v1 - v0) * H) / ((u1 - u0) * W)
        X = (self.stack[-1] @ M if M is not None else self.stack[-1]) @ T(0, 0, lift)
        base = len(self.V)
        for (x, y) in ((-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)):
            self.V.append(X @ Vector((x, y, 0)))
        f = [base, base + 1, base + 2, base + 3]
        if X.to_3x3().determinant() < 0: f.reverse()
        self.F.append(f); self.C.append(rgb(col)); self.M.append(mat); self.S.append(False)
        uvs = [(u0, v0), (u1, v0), (u1, v1), (u0, v1)]
        if X.to_3x3().determinant() < 0: uvs.reverse()
        self.U.append(('a', uvs))
        return self

    # shortcuts ---------------------------------------------------------
    def box(self, w, h, d, col, at=(0, 0, 0), rot=(0, 0, 0), bevel=0.0, top=(1.0, 1.0), **kw):
        return self.add(g_box(w, h, d, bevel, top), col, T(*at) @ ROT(*rot), **kw)

    def cyl(self, r0, r1, h, col, at=(0, 0, 0), rot=(0, 0, 0), n=12, bevel=0.0, **kw):
        kw.setdefault('uv', 'cyl')
        return self.add(g_cyl(r0, r1, h, n, bevel), col, T(*at) @ ROT(*rot), **kw)

    def lathe(self, profile, col, at=(0, 0, 0), rot=(0, 0, 0), n=16, az0=0.0, sweep=TAU, caps=True, **kw):
        kw.setdefault('uv', 'cyl')
        return self.add(g_lathe(profile, n, az0, sweep, caps), col, T(*at) @ ROT(*rot), **kw)

    def sphere(self, r, col, at=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), n=14, m=8, t0=0.0, t1=PI, **kw):
        return self.add(g_sphere(r, n, m, t0, t1), col, T(*at) @ ROT(*rot) @ SC(*scale), **kw)

    def torus(self, R, r, col, at=(0, 0, 0), rot=(0, 0, 0), n=24, m=6, az0=0.0, sweep=TAU, **kw):
        return self.add(g_torus(R, r, n, m, az0, sweep), col, T(*at) @ ROT(*rot), **kw)

    def tube(self, pts, r, col, n=6, **kw):
        return self.add(g_tube(pts, r, n), col, **kw)

    def rivets(self, R, y, count, size, col, az0=0.0, sweep=TAU, mat='Metal'):
        geo = g_lathe([(size, 0), (size * 0.72, size * 0.5), (0, size * 0.75)], 5)
        full = abs(sweep - TAU) < 1e-6
        for i in range(count):
            a = az0 + sweep * (i / count if full else i / max(1, count - 1))
            self.add(geo, col, AZ(a, R, y) @ RX(PI / 2), mat=mat, jit=0.03, fjit=0.0)
        return self

    # build -----------------------------------------------------------
    def build(self, coll, origin=(0, 0, 0), parent=None, ao=0.2, top=0.1, sharp=42, ao_range=None):
        o = Vector(origin)
        V = self.V
        ys = [v.y for v in V]
        y0, y1 = (min(ys), max(ys)) if ao_range is None else ao_range
        H = max(1e-6, y1 - y0)
        mesh = bpy.data.meshes.new(self.name)
        mesh.from_pydata([g2b(v - o) for v in V], [], self.F)
        if len(mesh.polygons) != len(self.F):
            raise RuntimeError('%s: polygon count mismatch' % self.name)
        names = []
        for m in self.M:
            if m not in names: names.append(m)
        for nme in names: mesh.materials.append(get_mat(nme))
        mesh.polygons.foreach_set('material_index', [names.index(m) for m in self.M])
        mesh.polygons.foreach_set('use_smooth', self.S)
        if any(textured(m) for m in names):
            # texture coordinates, in repeats of each material's texture; every face is shifted by whole repeats
            # so the numbers stay small (the game packs them as 16-bit integers)
            uvl = mesh.uv_layers.new(name='UVMap')
            flat = []
            for fi, f in enumerate(self.F):
                mt = self.M[fi]
                if not textured(mt):
                    flat.extend((0.0, 0.0) * len(f)); continue
                u = self.U[fi]
                if u is None: kind, pts = 'm', uv_box([V[i] for i in f])
                else: kind, pts = u
                if kind == 'm':
                    tl = TILE.get(MATS[mt]['tex'], 1.0)
                    pts = [(a / tl, b / tl) for (a, b) in pts]
                    du = math.floor(min(a for a, _ in pts)); dv = math.floor(min(b for _, b in pts))
                    pts = [(a - du, b - dv) for (a, b) in pts]
                for (a, b) in pts: flat.extend((a, b))
            uvl.data.foreach_set('uv', flat)
        attr = mesh.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
        data = []
        for fi, f in enumerate(self.F):
            nrm_y = 0.0
            nx = ny = nz = 0.0
            for i in range(len(f)):
                a = V[f[i]]; b = V[f[(i + 1) % len(f)]]
                nx += (a.y - b.y) * (a.z + b.z); ny += (a.z - b.z) * (a.x + b.x); nz += (a.x - b.x) * (a.y + b.y)
            ln = math.sqrt(nx * nx + ny * ny + nz * nz)
            if ln > 0: nrm_y = ny / ln
            kn = 1.0 + top * nrm_y
            c = self.C[fi]
            l0, l1, l2 = _lin(c[0]), _lin(c[1]), _lin(c[2])
            for vi in f:
                t = min(1.0, max(0.0, (V[vi].y - y0) / H))
                k = kn * (1.0 - ao * (1.0 - t) ** 2)
                data.extend((l0 * k, l1 * k, l2 * k, 1.0))
        attr.data.foreach_set('color', data)
        mesh.update()
        if any(self.S):
            mesh.set_sharp_from_angle(angle=math.radians(sharp))
        obj = bpy.data.objects.new(self.name, mesh)
        coll.objects.link(obj)
        po = Vector(parent['gorigin']) if parent is not None else Vector((0, 0, 0))
        obj.location = g2b(o - po)
        obj['gorigin'] = tuple(o)
        if parent is not None: obj.parent = parent
        return obj

    def tris(self):
        return sum(len(f) - 2 for f in self.F)


# ---------------------------------------------------------------- scene helpers
def collection(name, clear=True):
    guard()
    c = bpy.data.collections.get(name)
    if c is None:
        c = bpy.data.collections.new(name)
        bpy.context.scene.collection.children.link(c)
    elif clear:
        for o in list(c.objects):
            me = o.data if o.type == 'MESH' else None
            bpy.data.objects.remove(o, do_unlink=True)
            if me is not None and me.users == 0: bpy.data.meshes.remove(me)
    return c


def empty(name, coll, at=(0, 0, 0), parent=None, size=0.3):
    e = bpy.data.objects.new(name, None)
    e.empty_display_size = size
    coll.objects.link(e)
    po = Vector(parent['gorigin']) if parent is not None else Vector((0, 0, 0))
    e.location = g2b(Vector(at) - po)
    e['gorigin'] = tuple(at)
    if parent is not None: e.parent = parent
    return e


def studio():
    """Camera, lights, backdrop and render settings used for the preview pictures."""
    guard()
    sc = bpy.context.scene
    c = bpy.data.collections.get('Studio')
    if c is None:
        c = bpy.data.collections.new('Studio'); sc.collection.children.link(c)
    def obj(name, data):
        o = bpy.data.objects.get(name)
        if o is None:
            o = bpy.data.objects.new(name, data); c.objects.link(o)
        return o
    cam = obj('StudioCam', bpy.data.cameras.get('StudioCam') or bpy.data.cameras.new('StudioCam'))
    cam.data.lens = 50; cam.data.clip_start = 0.05; cam.data.clip_end = 2000
    sc.camera = cam
    key = obj('StudioKey', bpy.data.lights.get('StudioKey') or bpy.data.lights.new('StudioKey', 'SUN'))
    key.data.energy = 5.0; key.data.color = (1.0, 0.88, 0.72); key.data.angle = math.radians(1.5)
    rim = obj('StudioRim', bpy.data.lights.get('StudioRim') or bpy.data.lights.new('StudioRim', 'SUN'))
    rim.data.energy = 1.6; rim.data.color = (0.55, 0.7, 1.0); rim.data.angle = math.radians(8)
    gm = bpy.data.meshes.get('StudioGround')
    if gm is None:
        gm = bpy.data.meshes.new('StudioGround')
        n = 48
        gm.from_pydata([(math.cos(TAU * i / n), math.sin(TAU * i / n), 0) for i in range(n)], [], [list(range(n))])
        mt = bpy.data.materials.new('StudioGroundMat')
        if not mt.node_tree: mt.use_nodes = True
        b = next(nd for nd in mt.node_tree.nodes if nd.type == 'BSDF_PRINCIPLED')
        b.inputs['Base Color'].default_value = (0.05, 0.06, 0.105, 1); b.inputs['Roughness'].default_value = 1.0
        gm.materials.append(mt)
    next(nd for nd in gm.materials[0].node_tree.nodes if nd.type == 'BSDF_PRINCIPLED').inputs['Base Color'].default_value = (0.05, 0.06, 0.105, 1)
    obj('StudioGround', gm)
    w = sc.world or bpy.data.worlds.new('StudioWorld')
    sc.world = w
    if not w.node_tree: w.use_nodes = True
    nt = w.node_tree
    if 'SkyRamp' in nt.nodes:
        for nd in [n for n in nt.nodes if n.type != 'BACKGROUND' and n.type != 'OUTPUT_WORLD']: nt.nodes.remove(nd)
    if 'SkyRamp' not in nt.nodes:
        bg = next(nd for nd in nt.nodes if nd.type == 'BACKGROUND')
        tc = nt.nodes.new('ShaderNodeTexCoord'); sp = nt.nodes.new('ShaderNodeSeparateXYZ')
        ramp = nt.nodes.new('ShaderNodeValToRGB'); ramp.name = 'SkyRamp'
        nt.links.new(tc.outputs['Generated'], sp.inputs[0])
        nt.links.new(sp.outputs['Z'], ramp.inputs[0])
        e = ramp.color_ramp.elements
        e[0].position = 0.0; e[0].color = (0.15, 0.2, 0.4, 1)
        e[1].position = 1.0; e[1].color = (0.004, 0.008, 0.04, 1)
        for pos, colr in ((0.1, (0.05, 0.1, 0.3, 1)), (0.4, (0.012, 0.03, 0.13, 1))):
            el = e.new(pos); el.color = colr
        vor = nt.nodes.new('ShaderNodeTexVoronoi'); vor.inputs['Scale'].default_value = 260.0
        lt = nt.nodes.new('ShaderNodeMath'); lt.operation = 'LESS_THAN'; lt.inputs[1].default_value = 0.035
        up = nt.nodes.new('ShaderNodeMath'); up.operation = 'GREATER_THAN'; up.inputs[1].default_value = 0.06
        mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'
        mulb = nt.nodes.new('ShaderNodeMath'); mulb.operation = 'MULTIPLY'; mulb.inputs[1].default_value = 2.2
        addc = nt.nodes.new('ShaderNodeMix'); addc.data_type = 'RGBA'; addc.blend_type = 'ADD'; addc.inputs[0].default_value = 1.0
        nt.links.new(tc.outputs['Generated'], vor.inputs['Vector'])
        nt.links.new(vor.outputs['Distance'], lt.inputs[0]); nt.links.new(sp.outputs['Z'], up.inputs[0])
        nt.links.new(lt.outputs[0], mul.inputs[0]); nt.links.new(up.outputs[0], mul.inputs[1]); nt.links.new(mul.outputs[0], mulb.inputs[0])
        nt.links.new(ramp.outputs['Color'], addc.inputs[6]); nt.links.new(mulb.outputs[0], addc.inputs[7])
        nt.links.new(addc.outputs[2], bg.inputs['Color'])
        bg.inputs['Strength'].default_value = 0.8
    sc.render.engine = 'BLENDER_EEVEE'
    sc.view_settings.view_transform = 'Standard'
    try: sc.eevee.taa_render_samples = 96
    except Exception: pass
    sc.render.image_settings.file_format = 'PNG'
    sc.render.film_transparent = False
    return cam


def _asset_colls():
    return [c for c in bpy.context.scene.collection.children if c.name.startswith('A_')]


def bounds(objs):
    bpy.context.view_layer.update()
    lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
    for o in objs:
        if o.type != 'MESH' or o.hide_render: continue
        for corner in o.bound_box:
            p = o.matrix_world @ Vector(corner)
            for i in range(3):
                lo[i] = min(lo[i], p[i]); hi[i] = max(hi[i], p[i])
    return lo, hi


def preview(coll_names, path, az=32.0, el=14.0, res=(1000, 760), pad=1.12, look_up=0.0):
    """Render the given asset collection(s) alone. az: 0 = straight on to the front, + = from the viewer's right."""
    if isinstance(coll_names, str): coll_names = [coll_names]
    cam = studio()
    sc = bpy.context.scene
    for c in _asset_colls(): c.hide_render = c.name not in coll_names
    objs = []
    for nme in coll_names: objs += list(bpy.data.collections[nme].all_objects)
    lo, hi = bounds(objs)
    ctr = (lo + hi) / 2
    rad = (hi - lo).length / 2
    sc.render.resolution_x, sc.render.resolution_y = res
    sc.render.resolution_percentage = 100
    aspect = res[0] / res[1]
    th = math.tan(math.atan(18.0 / cam.data.lens))          # half-angle tangent along the wider side
    tx, ty = (th, th / aspect) if aspect >= 1 else (th * aspect, th)
    a = math.radians(az); e = math.radians(el)
    d = Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)))
    right = Vector((math.cos(a), math.sin(a), 0.0))
    up = d.cross(right) * -1.0
    if up.z < 0: up = -up
    corners = [Vector((x, y, z)) for x in (lo.x, hi.x) for y in (lo.y, hi.y) for z in (lo.z, hi.z)]
    xs = [(c - ctr).dot(right) for c in corners]; ys = [(c - ctr).dot(up) for c in corners]
    tgt = ctr + right * ((min(xs) + max(xs)) / 2) + up * ((min(ys) + max(ys)) / 2 + rad * look_up)
    dist = 0.0
    for c in corners:
        v = c - tgt
        dist = max(dist, v.dot(d) + abs(v.dot(right)) / tx, v.dot(d) + abs(v.dot(up)) / ty)
    dist *= pad
    cam.location = tgt + d * dist
    cam.rotation_euler = (-d).to_track_quat('-Z', 'Y').to_euler()
    key = bpy.data.objects['StudioKey']; rim = bpy.data.objects['StudioRim']
    key.rotation_euler = (right * -0.62 + d * 0.55 + Vector((0, 0, 0.8))).to_track_quat('Z', 'Y').to_euler()   # from the viewer's upper left
    rim.rotation_euler = (right * 0.75 - d * 0.8 + Vector((0, 0, 0.45))).to_track_quat('Z', 'Y').to_euler()    # cool light from behind, right
    g = bpy.data.objects['StudioGround']
    g.location = (ctr.x, ctr.y, lo.z - 0.002); g.scale = (rad * 14 + 20, rad * 14 + 20, 1)
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    return {'center': tuple(round(x, 2) for x in ctr), 'size': tuple(round(x, 2) for x in (hi - lo))}


def export_glb(root, path):
    """Export a root object and everything under it as one .glb, with the root at the origin."""
    guard()
    objs = [root] + list(root.children_recursive)
    saved = root.location.copy(); saved_rot = root.rotation_euler.copy()
    hidden = []
    try:                                            # whatever happens, the root goes back where it was
        root.location = (0, 0, 0); root.rotation_euler = (0, 0, 0)
        vl = bpy.context.view_layer
        vl.update()
        for o in list(vl.objects):
            if o is not None: o.select_set(False)
        for o in objs:
            if o.hide_get(): hidden.append(o); o.hide_set(False)
            o.select_set(True)
        vl.objects.active = root
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True,
                                  export_vertex_color='MATERIAL', export_cameras=False, export_lights=False,
                                  export_animations=False, export_extras=False)
    finally:
        for o in hidden: o.hide_set(True)
        root.location = saved; root.rotation_euler = saved_rot
    return path


def stats(coll_name):
    tris = 0; names = []
    for o in bpy.data.collections[coll_name].all_objects:
        names.append(o.name)
        if o.type == 'MESH':
            tris += sum(len(p.vertices) - 2 for p in o.data.polygons)
    return {'tris': tris, 'objects': names}


# ---------------------------------------------------------------- shared sub-assemblies
def beam(p, a, b, w, d, col, bevel=0.0, **kw):
    """Box stretched between two points (w and d are its two cross-section sizes)."""
    a = Vector(a); b = Vector(b)
    p.add(g_box(w, (b - a).length, d, bevel), col, T(*((a + b) / 2)) @ ALIGN(b - a), **kw)


def g_ribbon(points, normals, width, thick):
    """Four-sided beam following a path; each section spans +-width/2 sideways and 0..thick along its normal."""
    P = [Vector(q) for q in points]; N = [Vector(q).normalized() for q in normals]; k = len(P)
    verts = []
    for i in range(k):
        t = (P[min(i + 1, k - 1)] - P[max(i - 1, 0)]).normalized()
        s = t.cross(N[i]).normalized()
        for (a, b) in ((-0.5, 0), (0.5, 0), (0.5, 1), (-0.5, 1)):
            verts.append(tuple(P[i] + s * (a * width) + N[i] * (b * thick)))
    faces = []
    for i in range(k - 1):
        for j in range(4):
            j1 = (j + 1) % 4
            faces.append([i * 4 + j, i * 4 + j1, (i + 1) * 4 + j1, (i + 1) * 4 + j])
    faces.append([0, 1, 2, 3]); faces.append([(k - 1) * 4 + 3, (k - 1) * 4 + 2, (k - 1) * 4 + 1, (k - 1) * 4])
    return verts, faces


def porthole(p, M, R=0.6, frame=STEEL, glow='Glow_Warm', bars=True, rivets=8, fmat='Metal'):
    """Round window facing local +z."""
    X = M @ RX(PI / 2)
    p.add(g_torus(R, R * 0.17, 16, 6), frame, X, mat=fmat, smooth=True, jit=0.02)
    p.add(g_cyl(R * 0.98, R * 0.98, R * 0.08, 16), 0, X @ T(0, -R * 0.04, 0), mat=glow)
    if bars:
        p.add(g_box(R * 2, R * 0.09, R * 0.09), frame, M @ T(0, 0, R * 0.06), mat=fmat)
        p.add(g_box(R * 0.09, R * 2, R * 0.09), frame, M @ T(0, 0, R * 0.06), mat=fmat)
    for i in range(rivets):
        a = TAU * (i + 0.5) / rivets
        p.add(g_lathe([(R * 0.055, 0), (R * 0.04, R * 0.035), (0, R * 0.05)], 5), CHROME,
              M @ T(math.cos(a) * R, math.sin(a) * R, R * 0.15) @ RX(PI / 2), mat='Metal', jit=0)


def lantern(p, M, s=1.0, glow='Glow_Warm', hang=True):
    """Small storm lantern standing on the local origin, about 0.45*s tall."""
    c = STEEL; d = FRAME_D
    p.add(g_cyl(0.15 * s, 0.13 * s, 0.06 * s, 8), d, M, mat='Metal')
    p.add(g_cyl(0.095 * s, 0.095 * s, 0.24 * s, 8), 0, M @ T(0, 0.06 * s, 0), mat=glow)
    for k in range(4):
        a = TAU * k / 4 + PI / 4
        p.add(g_box(0.022 * s, 0.26 * s, 0.022 * s), d, M @ T(math.cos(a) * 0.118 * s, 0.19 * s, math.sin(a) * 0.118 * s), mat='Metal', jit=0)
    p.add(g_lathe([(0.17 * s, 0.30 * s), (0.09 * s, 0.38 * s), (0.03 * s, 0.42 * s), (0.0, 0.43 * s)], 8), c, M, mat='Metal')
    if hang:
        p.add(g_torus(0.05 * s, 0.012 * s, 8, 4), d, M @ T(0, 0.47 * s, 0) @ RX(PI / 2), mat='Metal')


def crate(p, M, w=0.9, h=0.7, d=0.7, col=PANELS[1], band=FRAME):
    """Slatted crate standing on the local origin."""
    p.add(g_box(w, h, d, 0.02), col, M @ T(0, h / 2, 0), fjit=0.04)
    t = min(w, h, d) * 0.13
    for sx in (-1, 1):
        for sz in (-1, 1):
            p.add(g_box(t, h + 0.02, t), band, M @ T(sx * (w / 2 - t / 2 + 0.012), h / 2, sz * (d / 2 - t / 2 + 0.012)))
    for sy in (0, 1):
        for sz in (-1, 1):
            p.add(g_box(w + 0.02, t, t), band, M @ T(0, t / 2 + sy * (h - t), sz * (d / 2 - t / 2 + 0.014)))
        for sx in (-1, 1):
            p.add(g_box(t, t, d + 0.02), band, M @ T(sx * (w / 2 - t / 2 + 0.014), t / 2 + sy * (h - t), 0))


def barrel(p, M, r=0.38, h=0.95, col=0x7D848D, hoop=TIN, n=12):
    prof = [(r * 0.86, 0), (r, h * 0.3), (r, h * 0.7), (r * 0.86, h)]
    for geo in g_staves(prof, n, gap=0.06, thick=0.05):
        p.add(geo, col, M, jit=0.08, fjit=0.01)
    p.add(g_cyl(r * 0.84, r * 0.84, h * 0.95, n), shade(col, 0.6), M @ T(0, h * 0.02, 0))
    for y in (h * 0.16, h * 0.84):
        p.add(g_torus(r * 0.95, r * 0.04, n, 4), hoop, M @ T(0, y, 0), mat='Metal')


def ladder(p, a, b, width=0.5, rungs=8, col=STEEL, rail=0.07):
    a = Vector(a); b = Vector(b); d = b - a
    side = d.normalized().cross(Vector((0, 1, 0)))
    if side.length < 1e-4: side = Vector((1, 0, 0))
    side.normalize()
    for s in (-1, 1):
        beam(p, a + side * (s * width / 2), b + side * (s * width / 2), rail, rail, col, jit=0.04, mat='Metal')
    for i in range(rungs):
        c = a + d * ((i + 0.7) / (rungs + 0.4))
        beam(p, c - side * (width / 2), c + side * (width / 2), rail * 0.7, rail * 0.7, shade(col, 0.85), jit=0.04, mat='Metal')
