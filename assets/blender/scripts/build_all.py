"""One entry point: rebuild every asset, lay them out, export the .glb files, save the .blend and write js/models-data.js.
Run inside Blender 5.x:  blender --python assets/blender/scripts/build_all.py   (or from the Text editor)."""
import bpy, os, sys, runpy, importlib

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.dirname(os.path.dirname(SCRIPTS))
MODELS = os.path.join(ASSETS, 'models')
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)

BUILD = ['build_rocks', 'build_flag', 'build_astronaut', 'build_habitat', 'build_rocket', 'build_rover', 'build_props']
EXPORT = [  # root object -> file name
    ('Rocket', 'rocket'), ('Habitat', 'habitat'), ('Astronaut', 'astronaut'), ('Flag', 'flag'), ('FlagMarker', 'flag_marker'),
    ('Rocks', 'rocks'), ('Rover', 'rover'), ('Buddy', 'buddy'), ('PowerCell', 'power_cell'), ('FoodCrate', 'food_crate'),
    ('SupplyCase', 'supply_case'), ('SoilBag', 'soil_bag'), ('CoreSample', 'core_sample'), ('Instrument', 'instrument'),
    ('PathLantern', 'path_lantern'), ('SolarPanel', 'solar_panel'), ('Telescope', 'telescope'),
]


def clear_startup():
    """In a brand-new unsaved file, remove Blender's default Cube/Camera/Light. Never touches a saved file."""
    if not bpy.data.filepath and set(o.name for o in bpy.data.objects) == {'Cube', 'Camera', 'Light'}:
        for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
        c = bpy.data.collections.get('Collection')
        if c is not None and not c.all_objects: bpy.data.collections.remove(c)


def build_all():
    import kit
    kit.guard()
    clear_startup()
    out = {}
    for name in BUILD:
        out[name] = runpy.run_path(os.path.join(SCRIPTS, name + '.py'))['RESULT']
    runpy.run_path(os.path.join(SCRIPTS, 'layout.py'))
    return out


def export_all():
    import kit
    os.makedirs(MODELS, exist_ok=True)
    sizes = {}
    for root_name, fname in EXPORT:
        root = bpy.data.objects[root_name]
        kids = [(c, c.location.copy()) for c in root.children] if root_name == 'Rocks' else []
        path = os.path.join(MODELS, fname + '.glb')
        try:
            for c, _ in kids: c.location = (0, 0, 0)      # rock variants all sit on the origin in the file
            kit.export_glb(root, path)
        finally:
            for c, loc in kids: c.location = loc
        sizes[fname] = os.path.getsize(path)
    return sizes


def save_blend():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type == 'VIEW_3D':
                for sp in area.spaces:
                    if sp.type == 'VIEW_3D': sp.shading.type = 'MATERIAL'
    path = os.path.join(ASSETS, 'blender', 'astro_outpost_assets.blend')
    bpy.ops.wm.save_as_mainfile(filepath=path)
    return path


def export_game_js():
    """Pack the models into js/models-data.js for the game."""
    return runpy.run_path(os.path.join(SCRIPTS, 'export_js.py'))['export_all']()


if __name__ == '__main__':
    RESULT = {'built': build_all(), 'exported': export_all(), 'saved': save_blend(), 'js': export_game_js()}
    print('BUILD_ALL ok: %d models exported, %.2f MB, saved %s' % (len(RESULT['exported']), sum(RESULT['exported'].values()) / 1048576, RESULT['saved']))
    print('GAME_JS ok: %s (%.2f MB)' % (RESULT['js'][0], RESULT['js'][1] / 1048576))
