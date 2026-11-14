"""Spread the asset roots out in the .blend so nothing overlaps (exports ignore these offsets)."""
import bpy, os

SPOTS = {  # root name: (x, y, z) in Blender units (y negative = toward the front)
    'Rocket': (-24, 16, 0), 'Habitat': (0, 12, 0), 'Rover': (13, 2, 0), 'SolarPanel': (22, 12, 0),
    'Astronaut': (0, 0, 0), 'Buddy': (1.9, 0, 1.7), 'Flag': (4.5, 1, 0), 'FlagMarker': (7, 0, 0), 'Telescope': (-3.5, 0.5, 0),
    'PathLantern': (-5.5, 0, 0),
    'PowerCell': (-6, -4, 0.4), 'FoodCrate': (-4.2, -4, 0.25), 'SupplyCase': (-2.4, -4, 0.25), 'SoilBag': (-0.6, -4, 0.3),
    'CoreSample': (1.0, -4, 0.35), 'Instrument': (2.4, -4, 0.35),
    'Rocks': (0, -9, 0),
}


def apply():
    fp = bpy.data.filepath
    if fp and os.path.basename(fp).lower() != 'astro_outpost_assets.blend':
        raise RuntimeError('layout: not the asset file: %r' % fp)
    for name, loc in SPOTS.items():
        o = bpy.data.objects.get(name)
        if o is not None: o.location = loc


apply()
