"""Render the preview pictures in assets/previews/ from the built scene (run build_all.py first)."""
import bpy, os, sys, importlib

SCRIPTS = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(os.path.dirname(os.path.dirname(SCRIPTS)), 'previews')
if SCRIPTS not in sys.path: sys.path.insert(0, SCRIPTS)
import kit; importlib.reload(kit)

CARRY = ['A_powercell', 'A_foodcrate', 'A_supplycase', 'A_soilbag', 'A_coresample', 'A_instrument']
SHOTS = [  # file, collections, az, el, resolution, pad
    ('rocket_front', 'A_rocket', 28, 9, (1000, 1150), 0.95),
    ('rocket_back', 'A_rocket', 200, 24, (1000, 1000), 0.95),
    ('habitat_front', 'A_habitat', 30, 14, (1200, 900), 1.0),
    ('habitat_back', 'A_habitat', 215, 20, (1200, 900), 1.0),
    ('astronaut_front', 'A_astronaut', 28, 10, (820, 1000), 1.1),
    ('astronaut_back', 'A_astronaut', 205, 12, (820, 1000), 1.1),
    ('rover_front', 'A_rover', 38, 16, (1100, 800), 0.95),
    ('rover_back', 'A_rover', 215, 22, (1100, 800), 0.95),
    ('buddy', 'A_buddy', 25, 8, (700, 760), 1.0),
    ('flag', ['A_flag', 'A_flag_marker'], 20, 8, (820, 1000), 1.1),
    ('rocks', 'A_rocks', 14, 17, (1500, 480), 1.06),
    ('props_carry', CARRY, 12, 22, (1500, 520), 1.0),
    ('props_stand', ['A_pathlantern', 'A_telescope'], 30, 12, (900, 800), 1.0),
    ('solar_panel', 'A_solarpanel', 35, 10, (900, 800), 0.95),
]


def render_all():
    os.makedirs(OUT, exist_ok=True)
    done = []
    for name, colls, az, el, res, pad in SHOTS:
        kit.preview(colls, os.path.join(OUT, name + '.png'), az=az, el=el, res=res, pad=pad)
        done.append(name)
    everything = [c.name for c in bpy.context.scene.collection.children if c.name.startswith('A_')]
    kit.preview(everything, os.path.join(OUT, 'all_assets.png'), az=6, el=30, res=(1600, 900), pad=0.98)
    done.append('all_assets')
    for c in bpy.context.scene.collection.children:          # leave every asset renderable again
        if c.name.startswith('A_'): c.hide_render = False
    return done


if __name__ == '__main__':
    RESULT = render_all()
    print('PREVIEWS ' + ', '.join(RESULT))
    if bpy.app.background and os.path.basename(bpy.data.filepath).lower() == kit.ASSET_BLEND:
        bpy.ops.wm.save_mainfile()          # keeps the 'everything renderable' state in the file
