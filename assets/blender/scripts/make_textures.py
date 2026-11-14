"""Make the machine textures: tileable surface sets and one sheet of labels (decals).

Run with ordinary Python 3 (numpy + Pillow), not inside Blender:
    python assets/blender/scripts/make_textures.py

Writes
  assets/textures/<set>_c.jpg   colour (grey "detail" for sets the vertex colours tint, real colour for the rest)
  assets/textures/<set>_n.jpg   normal map (OpenGL / three.js convention: green = up in the picture)
  assets/textures/<set>_r.jpg   roughness (grey)
  assets/textures/decals.png    the label sheet, with alpha; decals.json lists where each label is on it
  js/textures-data.js           all of them packed as data: URLs for the game (works when index.html is opened from disk)

Everything is made from seeded noise, so running it again gives the same pictures. Each set tiles seamlessly.
kit.py (Blender) reads decals.json and the set sizes in TILE below; js/models.js reads js/textures-data.js.
"""
import base64, io, json, math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
OUT = os.path.join(REPO, 'assets', 'textures')
JS = os.path.join(REPO, 'js', 'textures-data.js')
FONT = 'C:/Windows/Fonts/bahnschrift.ttf'

# metres covered by one repeat of each set (kit.py uses the same numbers for the UVs)
TILE = {'panel': 2.0, 'steel': 0.6, 'foil': 1.2, 'tread': 0.8, 'solar': 0.7, 'soil': 0.7, 'pad': 3.0}


# ---------------------------------------------------------------- tileable noise
def rng(seed):
    return np.random.default_rng(seed)


def fbm(n, beta=2.0, seed=0, lo=1.0, aniso=(1.0, 1.0)):
    """Periodic fractal noise in 0..1 (spectral synthesis: white noise shaped by 1/f^beta)."""
    w = rng(seed).standard_normal((n, n))
    fy = np.fft.fftfreq(n)[:, None] * n * aniso[1]
    fx = np.fft.fftfreq(n)[None, :] * n * aniso[0]
    f = np.sqrt(fx * fx + fy * fy)
    f[0, 0] = 1.0
    amp = 1.0 / np.maximum(f, lo) ** (beta / 2)
    amp[0, 0] = 0
    h = np.real(np.fft.ifft2(np.fft.fft2(w) * amp))
    h -= h.min(); h /= max(h.max(), 1e-9)
    return h


def blur(a, sigma):
    """Periodic gaussian blur (FFT)."""
    n0, n1 = a.shape
    fy = np.fft.fftfreq(n0)[:, None]; fx = np.fft.fftfreq(n1)[None, :]
    g = np.exp(-2 * (math.pi * sigma) ** 2 * (fx * fx + fy * fy))
    return np.real(np.fft.ifft2(np.fft.fft2(a) * g))


def worley(n, cells, seed=0):
    """Periodic Worley noise: (F1, F2, cell id) with `cells` x `cells` feature points."""
    r = rng(seed)
    jit = r.random((cells, cells, 2))
    ids = r.random((cells, cells))
    yy, xx = np.mgrid[0:n, 0:n] / n * cells
    cy = np.floor(yy).astype(int); cx = np.floor(xx).astype(int)
    f1 = np.full((n, n), 9.0); f2 = np.full((n, n), 9.0); idm = np.zeros((n, n)); near = np.zeros((n, n), int)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            gy = cy + dy; gx = cx + dx
            py = gy + jit[gy % cells, gx % cells, 0]; px = gx + jit[gy % cells, gx % cells, 1]
            d = np.sqrt((yy - py) ** 2 + (xx - px) ** 2)
            closer = d < f1
            f2 = np.where(closer, f1, np.minimum(f2, d))
            idm = np.where(closer, ids[gy % cells, gx % cells], idm)
            near = np.where(closer, (gy % cells) * cells + (gx % cells), near)
            f1 = np.where(closer, d, f1)
    worley.near = near
    return f1, f2, idm


def normal_map(h, strength):
    """Height (0..1, periodic) -> tangent-space normal map bytes. three.js: +x right, +y up in the picture."""
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nx = -dx; ny = dy; nz = np.ones_like(h)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.dstack([nx / ln, ny / ln, nz / ln]) * 0.5 + 0.5


def to8(a):
    return np.clip(np.round(a * 255), 0, 255).astype(np.uint8)


def stamp_disc(h, cx, cy, r, amp, n):
    """Add a soft dome (rivet, bolt) at (cx, cy) with wrap-around."""
    R = int(math.ceil(r)) + 1
    for yy in range(-R, R + 1):
        for xx in range(-R, R + 1):
            d = math.hypot(xx, yy) / r
            if d < 1:
                h[(cy + yy) % n, (cx + xx) % n] += amp * math.sqrt(1 - d * d)


def lines(n, count, seed, length=(20, 120), width=1):
    """A mask of thin random scratches."""
    img = Image.new('L', (n * 3, n * 3), 0)
    dr = ImageDraw.Draw(img)
    r = rng(seed)
    for _ in range(count):
        x0, y0 = r.random() * n + n, r.random() * n + n
        a = r.random() * math.pi
        if r.random() < 0.6: a = r.normal(0.1, 0.25)       # most scratches run roughly the same way
        L = r.uniform(*length)
        dr.line([(x0, y0), (x0 + math.cos(a) * L, y0 + math.sin(a) * L)], fill=int(r.uniform(90, 255)), width=width)
    a = np.asarray(img, dtype=np.float32) / 255
    return _fold(a, n)


def _fold(a, n):
    """Fold a 3n x 3n canvas back onto n x n so shapes crossing the edge wrap around."""
    out = np.zeros((n, n), np.float32)
    for i in range(3):
        for j in range(3):
            out = np.maximum(out, a[i * n:(i + 1) * n, j * n:(j + 1) * n])
    return out


# ---------------------------------------------------------------- the sets
def panel(n=512):
    """Painted metal sheeting, 2 m square: panels, seams, rivets, scuffs, grime. Grey detail (vertex colours tint it)."""
    r = rng(11)
    h = np.zeros((n, n)); tone = np.ones((n, n)); seam = np.zeros((n, n))
    # columns of 1 m, each split into panels of different heights, columns shifted so seams do not line up
    cols = 2; cw = n // cols
    for c in range(cols):
        x0 = c * cw
        y = int(r.integers(0, n)); ys = []
        acc = 0
        for step in [128, 192, 192]:               # three panels per column: 0.5, 0.75 and 0.75 m tall
            ys.append((y + acc) % n); acc += step
        for yv in ys:
            seam[(yv + np.arange(-1, 2)) % n, x0:x0 + cw] = 1
        seam[:, (x0 + np.arange(-1, 2)) % n] = 1
        # panel tones between the cuts
        bounds = sorted(ys) + [sorted(ys)[0] + n]
        for k in range(len(bounds) - 1):
            a, b = bounds[k], bounds[k + 1]
            tone[np.arange(a, b) % n, x0:x0 + cw] = 1 + r.uniform(-0.045, 0.045)
        for yv in ys:
            for xx in range(x0 + 10, x0 + cw - 6, 22):
                stamp_disc(h, xx, (yv + 6) % n, 2.2, 0.55, n); stamp_disc(h, xx, (yv - 6) % n, 2.2, 0.55, n)
        for yy in range(0, n, 22):
            stamp_disc(h, (x0 + 6) % n, yy, 2.2, 0.55, n); stamp_disc(h, (x0 - 6) % n, yy, 2.2, 0.55, n)
    seam_soft = blur(seam, 1.0)
    h -= seam_soft * 1.4
    # a few access hatches: an inset rectangle with screws
    for _ in range(3):
        w, hh = int(r.integers(50, 90)), int(r.integers(40, 70))
        x, y = int(r.integers(0, n)), int(r.integers(0, n))
        m = np.zeros((n, n))
        rows = np.arange(y, y + hh) % n; cls = np.arange(x, x + w) % n
        m[np.ix_(rows, cls)] = 1
        edge = m - blur(m, 1.2)
        h -= np.clip(edge, 0, None) * 1.5
        for (sx, sy) in ((x + 5, y + 5), (x + w - 5, y + 5), (x + 5, y + hh - 5), (x + w - 5, y + hh - 5)):
            stamp_disc(h, sx % n, sy % n, 1.8, 0.4, n)
    dents = fbm(n, 3.2, seed=12) - 0.5
    h += dents * 0.6
    scratches = lines(n, 70, seed=13, length=(10, 90))
    grime = fbm(n, 2.4, seed=14)
    grime = np.clip((grime - 0.45) * 2.2, 0, 1) * 0.5 + blur(seam, 4.0) * 1.6
    speck = (rng(15).random((n, n)) > 0.996).astype(float)
    col = tone * (0.93 + (fbm(n, 1.4, seed=16) - 0.5) * 0.06)
    col *= 1 - np.clip(grime, 0, 1) * 0.22
    col = col - seam_soft * 0.28 + scratches * 0.10 - speck * 0.15
    rough = 0.52 + np.clip(grime, 0, 1) * 0.2 - scratches * 0.18 + (fbm(n, 2.0, seed=17) - 0.5) * 0.08
    return np.clip(col, 0, 1), normal_map(h, 1.2), np.clip(rough, 0, 1)


def steel(n=256):
    """Brushed / bare steel, 0.6 m square: long streaks, a few scratches."""
    streak = fbm(n, 2.2, seed=21, aniso=(1.0, 14.0))
    fine = fbm(n, 1.0, seed=22, aniso=(1.0, 30.0))
    scratches = lines(n, 30, seed=23, length=(10, 70))
    h = streak * 0.6 + fine * 0.3 - scratches * 0.4
    col = 0.86 + (streak - 0.5) * 0.12 + (fine - 0.5) * 0.08 + scratches * 0.06
    rough = 0.38 + (streak - 0.5) * 0.12 - scratches * 0.1
    return np.clip(col, 0, 1), normal_map(h, 1.0), np.clip(rough, 0, 1)


def foil(n=512):
    """Gold multi-layer insulation, 1.2 m square: crumpled into flat facets at two sizes, fine wrinkles,
    and kapton tape seams. Real colour. The facets tilt every which way, so the light breaks up like real foil."""
    def facets(cells, seed, amp):
        f1, f2, _ = worley(n, cells, seed)
        sl = rng(seed + 100).normal(0, amp, (cells * cells, 2))
        idx = worley.near
        return sl[idx, 0], sl[idx, 1], np.clip(1 - (f2 - f1) * 8, 0, 1)
    ax, ay, e1 = facets(7, 31, 0.42)
    bx, by, e2 = facets(19, 32, 0.26)
    w = fbm(n, 2.8, seed=33)
    wx = (np.roll(w, -1, 1) - np.roll(w, 1, 1)) * 11; wy = (np.roll(w, -1, 0) - np.roll(w, 1, 0)) * 11
    sx = ax + bx + wx; sy = ay + by + wy
    tape = np.zeros((n, n))
    for y in (n // 4, 3 * n // 4):
        tape[(y + np.arange(-8, 9)) % n, :] = 1
    tape = blur(tape, 0.8)
    sx *= 1 - tape * 0.85; sy *= 1 - tape * 0.85
    nx, ny = blur(-sx, 0.6), blur(sy, 0.6)
    ln = np.sqrt(nx * nx + ny * ny + 1)
    nm = np.dstack([nx / ln, ny / ln, 1 / ln]) * 0.5 + 0.5
    light = np.clip(0.92 + sx * 0.18 - sy * 0.12 - e1 * 0.08 - e2 * 0.04, 0.6, 1.15)
    gold = np.array([0.93, 0.71, 0.29]); tapec = np.array([0.78, 0.50, 0.17])
    col = light[..., None] * gold[None, None, :]
    col = col * (1 - tape[..., None]) + tapec[None, None, :] * tape[..., None]
    rough = 0.24 + e1 * 0.1 + e2 * 0.06 + tape * 0.18
    return np.clip(col, 0, 1), nm, np.clip(rough, 0, 1)


def tread(n=512):
    """Diamond tread plate, 0.8 m square: raised lentils in a herringbone. Grey detail."""
    h = np.zeros((n, n))
    cell = 32
    yy, xx = np.mgrid[0:cell * 2, 0:cell * 2]
    lens = np.zeros((cell * 2, cell * 2))
    for (cx, cy, ang) in ((cell * 0.5, cell * 0.5, 0.785), (cell * 1.5, cell * 1.5, 0.785), (cell * 1.5, cell * 0.5, -0.785), (cell * 0.5, cell * 1.5, -0.785)):
        dx = xx - cx; dy = yy - cy
        u = dx * math.cos(ang) + dy * math.sin(ang); v = -dx * math.sin(ang) + dy * math.cos(ang)
        d = (u / 12.0) ** 2 + (v / 3.2) ** 2
        lens = np.maximum(lens, np.sqrt(np.clip(1 - d, 0, 1)))
    h = np.tile(lens, (n // (cell * 2), n // (cell * 2)))
    wear = fbm(n, 2.2, seed=41)
    grime = np.clip((fbm(n, 2.0, seed=42) - 0.4) * 2, 0, 1)
    scratches = lines(n, 50, seed=43, length=(10, 80))
    col = 0.74 + h * 0.16 * (0.6 + wear * 0.6) - (1 - h) * grime * 0.18 + scratches * 0.08
    rough = 0.55 - h * 0.2 + grime * 0.15 - scratches * 0.1
    return np.clip(col, 0, 1), normal_map(h * 2.2 + (fbm(n, 3, seed=44) - 0.5) * 0.4, 1.4), np.clip(rough, 0, 1)


def solar(n=512):
    """Monocrystalline solar cells, 0.7 m square = 4 x 4 cells. Real colour (the game tints it with dust)."""
    c = n // 4
    yy, xx = np.mgrid[0:n, 0:n]
    lx = xx % c; ly = yy % c
    gap = 3; ch = 16                                  # gap between cells, cut corners
    inside = (lx >= gap) & (lx < c - gap) & (ly >= gap) & (ly < c - gap)
    cx = np.minimum(lx - gap, c - gap - 1 - lx); cy = np.minimum(ly - gap, c - gap - 1 - ly)
    inside &= (cx + cy) >= ch
    crystal = fbm(n, 1.6, seed=51)
    cellc = np.array([0.055, 0.085, 0.20])
    col = np.where(inside[..., None], cellc[None, None, :] * (0.85 + crystal[..., None] * 0.35), np.array([0.82, 0.84, 0.88])[None, None, :])
    # fingers (fine horizontal lines) and three bus bars per cell
    fingers = inside & (ly % 6 == 0)
    col = np.where(fingers[..., None], col * 0.7 + 0.3 * np.array([0.40, 0.44, 0.52]), col)
    bus = np.zeros((n, n), bool)
    for b in (0.25, 0.5, 0.75):
        bx = int(c * b)
        bus |= (np.abs(lx - bx) <= 1) & inside
    col = np.where(bus[..., None], np.array([0.78, 0.80, 0.84])[None, None, :], col)
    h = inside * 0.3 + bus * 0.4 + fingers * 0.1
    rough = np.where(inside, 0.42, 0.52) + bus * 0.08       # satin, so a panel facing the Sun does not flash white
    return np.clip(col, 0, 1), normal_map(blur(h, 0.6), 2.0), np.clip(rough, 0, 1)


def soil(n=256):
    """Growing medium, 0.7 m square: dark crumbs, clumps, white perlite bits. Real colour."""
    f1, f2, idm = worley(n, 18, seed=61)
    clump = np.clip(1 - f1 * 1.6, 0, 1)
    fine = fbm(n, 1.2, seed=62)
    h = clump * 0.8 + fine * 0.5
    base = np.array([0.20, 0.13, 0.085])
    col = base[None, None, :] * (0.6 + h[..., None] * 0.7 + (idm[..., None] - 0.5) * 0.3)
    r = rng(63)
    perl = np.zeros((n, n))
    for _ in range(140):
        stamp_disc(perl, int(r.integers(0, n)), int(r.integers(0, n)), r.uniform(1.0, 2.2), 1.0, n)
    perl = np.clip(perl, 0, 1)
    col = col * (1 - perl[..., None]) + np.array([0.86, 0.85, 0.80])[None, None, :] * perl[..., None]
    h = h + perl * 0.6
    rough = 0.92 - perl * 0.25
    return np.clip(col, 0, 1), normal_map(h, 2.0), np.clip(rough, 0, 1)


def pad(n=512):
    """Sintered regolith pavers, 3 m square = 4 x 4 slabs: gaps, cracks, pits, dust. Grey detail."""
    c = n // 4
    yy, xx = np.mgrid[0:n, 0:n]
    lx = xx % c; ly = yy % c
    edge = np.minimum(np.minimum(lx, c - 1 - lx), np.minimum(ly, c - 1 - ly)).astype(float)
    groove = np.clip(1 - edge / 3.0, 0, 1)
    slab = (xx // c) * 4 + (yy // c)
    tone = 1 + (rng(71).random(16)[slab] - 0.5) * 0.08
    pits = np.clip((fbm(n, 1.0, seed=72) - 0.62) * 6, 0, 1)
    cr = lines(n, 14, seed=73, length=(20, 110))
    big = fbm(n, 2.6, seed=74)
    h = -groove * 1.2 - pits * 0.4 - cr * 0.5 + (big - 0.5) * 0.6 + (fbm(n, 1.3, seed=75) - 0.5) * 0.3
    col = tone * (0.86 + (big - 0.5) * 0.12) - groove * 0.25 - pits * 0.12 - cr * 0.15
    rough = 0.9 + pits * 0.05
    return np.clip(col, 0, 1), normal_map(blur(h, 0.7), 1.6), np.clip(rough, 0, 1)


SETS = {'panel': panel, 'steel': steel, 'foil': foil, 'tread': tread, 'solar': solar, 'soil': soil, 'pad': pad}
GREY = {'panel', 'steel', 'tread', 'pad'}          # detail maps: saved grey, the vertex colours give the colour


# ---------------------------------------------------------------- the label sheet
def font(size, weight='Bold'):
    f = ImageFont.truetype(FONT, size)
    try: f.set_variation_by_name(weight)
    except Exception: pass
    return f


def worn(alpha, seed, amount=0.25):
    """Rub some paint off a label's alpha (worn stencil)."""
    a = np.asarray(alpha, dtype=np.float32) / 255
    n0, n1 = a.shape
    k = max(n0, n1)
    nz = fbm(256, 1.6, seed=seed)
    nz = np.asarray(Image.fromarray(to8(nz)).resize((n1, n0), Image.BILINEAR), dtype=np.float32) / 255
    a = a * np.clip((nz - amount) * 4, 0, 1)
    return Image.fromarray(to8(a))


def decals():
    W, H = 1024, 1024
    sheet = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    cells = {}
    rows = []                                   # shelves: [y, height, next free x]

    def place(name, im):
        """Puts a label on the first shelf with room for it (or a new shelf below); it must fit on the sheet."""
        w, h = im.size
        for r in rows:
            if r[2] + w <= W and h <= r[1]: break
        else:
            y = rows[-1][0] + rows[-1][1] + 4 if rows else 0
            r = [y, h, 0]; rows.append(r)
        x, y = r[2], r[0]
        if y + h > H: raise RuntimeError('decal sheet full at %r' % name)
        sheet.alpha_composite(im, (x, y))
        cells[name] = [x / W, 1 - (y + h) / H, (x + w) / W, 1 - y / H]     # u0, v0, u1, v1 (v up, three.js flipY)
        r[2] = x + w + 4

    def text(name, s, size, w=None, h=None, seed=1, weight='Bold', pad=8, wear=0.22):
        f = font(size, weight)
        box = ImageDraw.Draw(Image.new('L', (8, 8))).textbbox((0, 0), s, font=f)
        tw, th = box[2] - box[0], box[3] - box[1]
        w = w or tw + pad * 2; h = h or th + pad * 2
        a = Image.new('L', (w, h), 0)
        ImageDraw.Draw(a).text(((w - tw) / 2 - box[0], (h - th) / 2 - box[1]), s, font=f, fill=255)
        a = worn(a, seed, wear)
        im = Image.new('RGBA', (w, h), (255, 255, 255, 0)); im.putalpha(a)
        place(name, im)

    def sub(name, a, b, size, seed=1, tail='', pad=10):
        """Text with a subscript number (the font has no subscript characters)."""
        f = font(size); fs = font(int(size * 0.58))
        la, lb, lt = f.getlength(a), fs.getlength(b), f.getlength(tail)
        asc, desc = f.getmetrics()
        w = int(la + lb + lt + pad * 2 + size * 0.1); h = int(asc + desc + pad * 2)
        m = Image.new('L', (w, h), 0); d = ImageDraw.Draw(m)
        d.text((pad, pad), a, font=f, fill=255)
        d.text((pad + la + size * 0.02, pad + asc * 0.55), b, font=fs, fill=255)
        if tail: d.text((pad + la + lb + size * 0.06, pad), tail, font=f, fill=255)
        bb = m.getbbox(); m = m.crop((max(0, bb[0] - pad), max(0, bb[1] - pad), min(w, bb[2] + pad), min(h, bb[3] + pad)))
        im = Image.new('RGBA', m.size, (255, 255, 255, 0)); im.putalpha(worn(m, seed, 0.22)); place(name, im)

    # hazard stripes (opaque, yellow and black, worn)
    w, h = 512, 64
    st = Image.new('RGBA', (w, h), (240, 186, 30, 255)); d = ImageDraw.Draw(st)
    for x in range(-h, w + h, 48):
        d.polygon([(x, h), (x + 24, h), (x + 24 + h, 0), (x + h, 0)], fill=(28, 28, 30, 255))
    g = np.asarray(st, dtype=np.float32)
    nz = np.asarray(Image.fromarray(to8(fbm(256, 1.4, seed=81))).resize((w, h)), dtype=np.float32)[..., None] / 255
    g[..., :3] = g[..., :3] * (0.82 + nz * 0.25)
    place('hazard', Image.fromarray(np.clip(g, 0, 255).astype(np.uint8), 'RGBA'))

    sub('o2', 'O', '2', 200, seed=2)
    text('oxygen', 'OXYGEN', 96, seed=3)
    sub('h2o', 'H', '2', 150, seed=4, tail='O')
    text('lab', 'SCIENCE LAB', 92, seed=5)
    text('comms', 'COMMS', 96, seed=6)
    text('greenhouse', 'GREENHOUSE', 80, seed=7)
    text('power', 'POWER', 96, seed=8)
    text('ao_am', 'AO-AM-01', 48, seed=9, weight='SemiBold')
    text('ao_gh', 'AO-GH-02', 48, seed=10, weight='SemiBold')
    text('ao_lb', 'AO-LB-03', 48, seed=11, weight='SemiBold')
    text('ao_rd', 'AO-RD-04', 48, seed=12, weight='SemiBold')
    text('ao_pr', 'AO-PR-05', 48, seed=13, weight='SemiBold')
    text('nostep', 'NO STEP', 44, seed=14, weight='SemiBold')
    text('ice', 'ICE IN', 64, seed=15)
    text('samples', 'SAMPLES', 64, seed=16)
    text('water', 'WATER IN', 64, seed=17)

    # high-voltage warning triangle (colour)
    s = 160
    tri = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(tri)
    pts = [(s / 2, 8), (s - 6, s - 14), (6, s - 14)]
    d.polygon(pts, fill=(25, 25, 28, 255))
    inner = [(s / 2, 30), (s - 26, s - 26), (26, s - 26)]
    d.polygon(inner, fill=(245, 192, 35, 255))
    d.polygon([(s * 0.53, 46), (s * 0.40, 92), (s * 0.50, 92), (s * 0.44, s - 36), (s * 0.62, 82), (s * 0.52, 82), (s * 0.60, 46)], fill=(25, 25, 28, 255))
    place('volt', tri)

    # pressure gauge (colour, round)
    s = 128
    gg = Image.new('RGBA', (s, s), (0, 0, 0, 0)); d = ImageDraw.Draw(gg)
    d.ellipse([2, 2, s - 3, s - 3], fill=(40, 42, 46, 255)); d.ellipse([10, 10, s - 11, s - 11], fill=(236, 236, 230, 255))
    for k in range(11):
        a = math.radians(225 - k * 27)
        r0, r1 = (36, 48) if k % 5 == 0 else (41, 48)
        d.line([(s / 2 + math.cos(a) * r0, s / 2 - math.sin(a) * r0), (s / 2 + math.cos(a) * r1, s / 2 - math.sin(a) * r1)], fill=(30, 30, 30, 255), width=3 if k % 5 == 0 else 2)
    d.arc([18, 18, s - 19, s - 19], start=-45 - 22, end=-45 + 5, fill=(205, 50, 40, 255), width=6)
    a = math.radians(150)
    d.line([(s / 2, s / 2), (s / 2 + math.cos(a) * 40, s / 2 - math.sin(a) * 40)], fill=(200, 40, 30, 255), width=4)
    d.ellipse([s / 2 - 6, s / 2 - 6, s / 2 + 6, s / 2 + 6], fill=(30, 30, 30, 255))
    place('gauge', gg)

    # small control panel: switches, lights, a readout (colour, opaque)
    w, h = 256, 160
    cp = Image.new('RGBA', (w, h), (52, 56, 62, 255)); d = ImageDraw.Draw(cp)
    d.rectangle([3, 3, w - 4, h - 4], outline=(110, 116, 124, 255), width=3)
    d.rectangle([16, 16, 150, 62], fill=(14, 22, 20, 255)); d.text((24, 22), '02 98.4', font=font(30, 'SemiBold'), fill=(90, 240, 160, 255))
    for k, cl in enumerate([(70, 230, 120), (70, 230, 120), (250, 190, 40), (90, 90, 96)]):
        d.ellipse([170 + (k % 2) * 36, 18 + (k // 2) * 30, 192 + (k % 2) * 36, 40 + (k // 2) * 30], fill=cl + (255,))
    for k in range(5):
        x = 22 + k * 46
        d.rectangle([x, 84, x + 26, 140], fill=(28, 30, 34, 255)); d.rectangle([x + 6, 90 if k % 2 else 112, x + 20, 112 if k % 2 else 134], fill=(200, 204, 210, 255))
    place('panel', cp)

    # chevron arrows (white)
    w, h = 192, 64
    ar = Image.new('L', (w, h), 0); d = ImageDraw.Draw(ar)
    for k in range(3):
        x = 14 + k * 58
        d.polygon([(x, 8), (x + 24, 8), (x + 50, h / 2), (x + 24, h - 8), (x, h - 8), (x + 26, h / 2)], fill=255)
    im = Image.new('RGBA', (w, h), (255, 255, 255, 0)); im.putalpha(worn(ar, 18, 0.2)); place('arrows', im)

    # vent slots (dark, with alpha)
    w, h = 192, 96
    vt = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(vt)
    for k in range(7):
        y = 8 + k * 12
        d.rounded_rectangle([8, y, w - 9, y + 6], radius=3, fill=(18, 20, 24, 255))
    place('vent', vt)

    # mission patch (colour, round): an original "Astro Outpost" badge
    s = 256
    mask = Image.new('L', (s, s), 0); ImageDraw.Draw(mask).ellipse([12, 12, s - 13, s - 13], fill=255)
    planet = Image.new('RGBA', (s, s), (0, 0, 0, 0)); ImageDraw.Draw(planet).ellipse([30, 150, 226, 346], fill=(205, 92, 52, 255))
    base = Image.new('RGBA', (s, s), (0, 0, 0, 0)); ImageDraw.Draw(base).ellipse([2, 2, s - 3, s - 3], fill=(30, 40, 78, 255))
    inner = Image.new('RGBA', (s, s), (22, 56, 120, 255)); inner.alpha_composite(planet)
    for (x, y, r) in ((70, 70, 3), (180, 60, 2), (150, 100, 2), (95, 115, 2), (200, 120, 3)):
        ImageDraw.Draw(inner).ellipse([x - r, y - r, x + r, y + r], fill=(255, 245, 200, 255))
    dd = ImageDraw.Draw(inner)
    dd.polygon([(128, 40), (142, 80), (142, 130), (114, 130), (114, 80)], fill=(235, 238, 242, 255))
    dd.polygon([(114, 112), (100, 138), (114, 130)], fill=(208, 83, 63, 255)); dd.polygon([(142, 112), (156, 138), (142, 130)], fill=(208, 83, 63, 255))
    dd.ellipse([122, 70, 134, 82], fill=(90, 170, 255, 255))
    dd.polygon([(118, 132), (138, 132), (128, 158)], fill=(255, 190, 70, 255))
    base.paste(inner, (0, 0), mask)
    ImageDraw.Draw(base).ellipse([12, 12, s - 13, s - 13], outline=(232, 190, 80, 255), width=5)
    f = font(24, 'Bold')
    for i, ch in enumerate('ASTRO OUTPOST'):
        a = math.radians(205 - i * 10.8)
        x = s / 2 + math.cos(a) * 100; y = s / 2 - math.sin(a) * 100
        g2 = Image.new('RGBA', (30, 30), (0, 0, 0, 0)); ImageDraw.Draw(g2).text((15, 15), ch, font=f, fill=(245, 236, 210, 255), anchor='mm')
        g2 = g2.rotate(math.degrees(a) - 90, resample=Image.BICUBIC)
        base.alpha_composite(g2, (int(x - 15), int(y - 15)))
    place('patch', base.resize((180, 180), Image.LANCZOS))   # small enough for the free corner of the top shelf

    # battery icon (white)
    w, h = 128, 72
    bt = Image.new('L', (w, h), 0); d = ImageDraw.Draw(bt)
    d.rounded_rectangle([6, 8, w - 22, h - 8], radius=8, outline=255, width=7); d.rectangle([w - 22, 24, w - 10, h - 24], fill=255)
    for k in range(3): d.rectangle([18 + k * 26, 20, 36 + k * 26, h - 20], fill=255)
    im = Image.new('RGBA', (w, h), (255, 255, 255, 0)); im.putalpha(worn(bt, 19, 0.15)); place('battery', im)

    # leaf icon (white) for the greenhouse
    s = 96
    lf = Image.new('L', (s * 2, s * 2), 0); d = ImageDraw.Draw(lf)
    d.ellipse([s * 0.55, s * 0.68, s * 1.65, s * 1.32], fill=255)                 # the leaf, drawn flat then turned
    d.line([(s * 0.62, s), (s * 1.5, s)], fill=0, width=7)                          # its middle vein
    lf = lf.rotate(38, resample=Image.BICUBIC, center=(s, s))
    d = ImageDraw.Draw(lf); d.line([(s * 0.52, s * 1.5), (s * 0.68, s * 1.3)], fill=255, width=9)   # stem
    lf = lf.resize((s, s), Image.LANCZOS)
    im = Image.new('RGBA', (s, s), (255, 255, 255, 0)); im.putalpha(worn(lf, 20, 0.15)); place('leaf', im)
    return sheet, cells


# ---------------------------------------------------------------- write
def jpeg(arr, q=84):
    b = io.BytesIO()
    im = Image.fromarray(to8(arr)) if arr.ndim == 2 else Image.fromarray(to8(arr), 'RGB')
    im.save(b, 'JPEG', quality=q, optimize=True, progressive=False)
    return b.getvalue()


def main():
    os.makedirs(OUT, exist_ok=True)
    data = {}
    for name, fn in SETS.items():
        c, nm, ro = fn()
        if name in GREY and c.ndim == 3: c = c.mean(-1)
        for suffix, arr, q in (('c', c, 84), ('n', nm, 88), ('r', ro, 80)):
            raw = jpeg(arr, q)
            with open(os.path.join(OUT, '%s_%s.jpg' % (name, suffix)), 'wb') as f: f.write(raw)
            data['%s_%s' % (name, suffix)] = 'data:image/jpeg;base64,' + base64.b64encode(raw).decode('ascii')
    sheet, cells = decals()
    b = io.BytesIO(); sheet.save(b, 'PNG', optimize=True); raw = b.getvalue()
    with open(os.path.join(OUT, 'decals.png'), 'wb') as f: f.write(raw)
    with open(os.path.join(OUT, 'decals.json'), 'w', encoding='utf-8', newline='\n') as f:
        json.dump({'size': list(sheet.size), 'cells': {k: [round(x, 5) for x in v] for k, v in cells.items()}, 'tile': TILE}, f, indent=1)
    data['decals'] = 'data:image/png;base64,' + base64.b64encode(raw).decode('ascii')
    body = json.dumps(data, separators=(',', ':'))
    with open(JS, 'w', encoding='utf-8', newline='\n') as f:
        f.write('/* Astro Outpost - machine textures. GENERATED by assets/blender/scripts/make_textures.py - do not edit by hand.\n'
                '   Tileable surface sets (<set>_c colour, _n normal, _r roughness) and the label sheet; used by js/models.js. */\n')
        f.write('window.JA_TEXTURES = ' + body + ';\n')
    print('TEXTURES ok: %d images, js %.2f MB' % (len(data), os.path.getsize(JS) / 1048576))


if __name__ == '__main__':
    main()
