"""Write js/models-data.js: the asset meshes packed for the game, so they load with no extra files or
network requests (works when index.html is opened straight from disk, like js/assets.js).

Run inside Blender on the asset file (build_all.py calls it after exporting the .glb files):
    blender -b assets/blender/astro_outpost_assets.blend --python assets/blender/scripts/export_js.py

Format (decoded by js/models.js):
  JA_MODELS = { made, materials: {name: {c, r, m, e?, ei?, vc}}, models: {name: {s, nodes: [...]}} }
  node = { n: name, p: parent index (-1 = root), t: [x, y, z] offset from the parent, g: [primitive, ...] }
  primitive = { m: material, P: Int16 positions * s, N: Int8 normals / 127, C: sRGB bytes (vc materials only),
                I: triangle indices, w: 2 (Uint16) or 4 (Uint32) }   -- all base64, game space (+Y up, metres).
"""
import bpy, os, sys, json, base64, importlib
import numpy as np

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(SCRIPTS)))
OUT = os.path.join(REPO, 'js', 'models-data.js')
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)

# root object in the .blend -> name the game asks for
MODELS = [('Rocket', 'rocket'), ('Habitat', 'habitat'), ('Astronaut', 'astronaut'), ('Flag', 'flag'), ('FlagMarker', 'flag_marker'),
          ('Rover', 'rover'), ('Buddy', 'buddy'), ('PowerCell', 'power_cell'), ('FoodCrate', 'food_crate'), ('SupplyCase', 'supply_case'),
          ('SoilBag', 'soil_bag'), ('CoreSample', 'core_sample'), ('Instrument', 'instrument'), ('PathLantern', 'path_lantern'),
          ('SolarPanel', 'solar_panel'), ('Telescope', 'telescope')]


def b64(a):
    return base64.b64encode(np.ascontiguousarray(a).tobytes()).decode('ascii')


def lin_to_srgb(x):
    x = np.clip(x, 0.0, 1.0)
    return np.where(x <= 0.0031308, x * 12.92, 1.055 * np.power(x, 1 / 2.4) - 0.055)


def to_game(a):            # Blender (x, y, z) -> game (x, z, -y)
    return np.stack([a[:, 0], a[:, 2], -a[:, 1]], axis=1)


def mesh_arrays(obj):
    me = obj.data
    me.calc_loop_triangles()
    nt, nl, nv = len(me.loop_triangles), len(me.loops), len(me.vertices)
    tri = np.empty(nt * 3, np.int32); me.loop_triangles.foreach_get('loops', tri)
    tmat = np.empty(nt, np.int32); me.loop_triangles.foreach_get('material_index', tmat)
    lv = np.empty(nl, np.int32); me.loops.foreach_get('vertex_index', lv)
    co = np.empty(nv * 3, np.float32); me.vertices.foreach_get('co', co)
    cn = np.empty(nl * 3, np.float32); me.corner_normals.foreach_get('vector', cn)
    col = np.empty(nl * 4, np.float32); me.color_attributes['Col'].data.foreach_get('color', col)
    pos = to_game(co.reshape(-1, 3)[lv]); nrm = to_game(cn.reshape(-1, 3)); col = col.reshape(-1, 4)[:, :3]
    return tri.reshape(-1, 3), tmat, pos, nrm, col, [m.name for m in me.materials]


def material_table():
    out = {}
    for name, spec in kit.MATS.items():
        vc = bool(spec.get('vcol'))
        base = spec['tint'] if spec.get('tint') is not None else (0xFFFFFF if vc else spec['color'])
        d = {'c': [round(kit._lin(c), 5) for c in kit.rgb(base)], 'r': spec.get('rough', 0.4 if spec.get('emit') else 0.5),
             'm': spec.get('metal', 0.0), 'vc': 1 if vc else 0}
        if spec.get('emit'):
            d['e'] = [round(kit._lin(c), 5) for c in kit.rgb(spec.get('ecolor', spec.get('color', 0xFFFFFF)))]
            d['ei'] = spec['emit']
        out[name] = d
    return out


def export_model(root):
    objs = [root] + [o for o in root.children_recursive]
    meshes = {o.name: mesh_arrays(o) for o in objs if o.type == 'MESH'}
    lim = max([float(np.abs(a[2]).max()) for a in meshes.values()] + [1e-3])
    s = lim / 32767.0
    index = {root.name: 0}
    nodes = []
    for o in objs:
        index[o.name] = len(nodes)
        loc = o.location
        node = {'n': o.name, 'p': -1 if o is root else index[o.parent.name],
                't': [0, 0, 0] if o is root else [round(loc.x, 4), round(loc.z, 4), round(-loc.y, 4)], 'g': []}
        if o.name in meshes:
            tri, tmat, pos, nrm, col, mnames = meshes[o.name]
            qp = np.round(pos / s).astype(np.int16)
            qn = np.clip(np.round(nrm * 127), -127, 127).astype(np.int8)
            qc = np.round(lin_to_srgb(col) * 255).astype(np.uint8)
            for mi, mname in enumerate(mnames):
                sel = tmat == mi
                if not sel.any(): continue
                loops = tri[sel].reshape(-1)
                vc = bool(kit.MATS[mname].get('vcol'))
                key = np.concatenate([qp[loops].view(np.uint8).reshape(len(loops), -1), qn[loops].view(np.uint8).reshape(len(loops), -1)]
                                     + ([qc[loops]] if vc else []), axis=1)
                uniq, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)
                src = loops[first]
                w = 2 if len(uniq) < 65536 else 4
                prim = {'m': mname, 'P': b64(qp[src]), 'N': b64(qn[src]),
                        'I': b64(inv.reshape(-1).astype(np.uint16 if w == 2 else np.uint32)), 'w': w}
                if vc: prim['C'] = b64(qc[src])
                node['g'].append(prim)
        nodes.append(node)
    return {'s': s, 'nodes': nodes}


def export_all():
    kit.guard()
    data = {'made': 'Blender ' + bpy.app.version_string, 'materials': material_table(), 'models': {}}
    for root_name, name in MODELS:
        data['models'][name] = export_model(bpy.data.objects[root_name])
    body = json.dumps(data, separators=(',', ':'))
    with open(OUT, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/* Astro Outpost - outpost models made in Blender. GENERATED by assets/blender/scripts/export_js.py - do not edit by hand.\n'
                '   Rocket, habitat, astronaut, rover, robot buddy, flags, solar panels and carried items; decoded by js/models.js. */\n')
        f.write('window.JA_MODELS = ' + body + ';\n')
    return OUT, os.path.getsize(OUT)


if __name__ == '__main__':
    path, size = export_all()
    print('EXPORT_JS ok: %s (%.2f MB)' % (path, size / 1048576))
