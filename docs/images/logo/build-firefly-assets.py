#!/usr/bin/env python3
"""Generate the webapp-evidence firefly logo assets from one geometry definition.

The mascot is a firefly. The tool's job is to make a browser session produce its
own proof, and a firefly is the animal that carries its own light: the glowing
abdomen is drawn as a record dot with the light breaking outward from it, so the
mark reads both as an insect and as something that is recording.

Run this script to regenerate every asset after editing the geometry below:
    python3 build-firefly-assets.py
Outputs land beside this script (mark, dark variant, lockups, favicon, sheet).
Everything is flat polygons in one 128x128 coordinate system, four tones of a
single hue, no gradients and no strokes.

The wordmark in the lockups is outlined, not set as text: an SVG shown through
<img> — a README, a social card — draws <text> in whatever font the viewer has,
so the name looked different everywhere. Outlining needs fontTools and brotli
(pip install fonttools brotli) and the Inter font the site already installs
(pnpm install in webapp/).
"""
import math
import pathlib

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = pathlib.Path(__file__).resolve().parent

# Four tones of one lime hue: the colour of the light a firefly actually makes.
# The dark-background variant lifts every tone so the body does not sink into a
# near-black page, and so the lantern still reads as the brightest thing there.
LIGHT_BG = dict(deep="#2C4408", mid="#5C8F0F", light="#8FC91E", pale="#BFE05F")
DARK_BG  = dict(deep="#3F6110", mid="#74AE18", light="#A3DC33", pale="#D2F07E")

WORDMARK_INK = {"light": "#1F1E1D", "dark": "#F0EEE6"}
FONT = "Inter, 'SF Pro Display', 'Helvetica Neue', Arial, sans-serif"

# Vertical nudge keeping the wings-plus-lantern mass optically centred in the box.
DY = -4

# The lantern: a record dot on the abdomen tip, with the light breaking outward.
LANTERN = dict(cx=64, cy=105, r=13)          # the dot itself
GLOW = dict(inner=17.5, outer=23, half=11)   # ray band, half-width in degrees
# Rays sit on the sides and underneath only. A ray above the lantern would fall
# on the abdomen, where a light on top of the body reads as a blemish.
GLOW_ANGLES = (4, 47, 90, 133, 176)


def mirror(points):
    return [(128 - x, y) for x, y in reversed(points)]


def shift(points):
    return [(x, y + DY) for x, y in points]


def polygon(points, fill):
    pts = " ".join(f"{x:.1f},{y:.1f}" for x, y in shift(points))
    return f'<polygon points="{pts}" fill="{fill}"/>'


def both(points, fill):
    """The mark is symmetric about x=64; define the left side only."""
    return polygon(points, fill) + polygon(mirror(points), fill)


def ngon(cx, cy, r, sides=8, turn=22.5):
    """A regular polygon. The lantern is a facetted disc, not a circle, so it is
    built from the same straight edges as every other shape in the mark."""
    return [(cx + r * math.cos(math.radians(turn + i * 360 / sides)),
             cy + r * math.sin(math.radians(turn + i * 360 / sides)))
            for i in range(sides)]


def ray(angle):
    """One wedge of escaping light, drawn outward from the lantern."""
    a0, a1 = math.radians(angle - GLOW["half"]), math.radians(angle + GLOW["half"])
    cx, cy = LANTERN["cx"], LANTERN["cy"]
    ri, ro = GLOW["inner"], GLOW["outer"]
    return [(cx + ri * math.cos(a0), cy + ri * math.sin(a0)),
            (cx + ro * math.cos(a0), cy + ro * math.sin(a0)),
            (cx + ro * math.cos(a1), cy + ro * math.sin(a1)),
            (cx + ri * math.cos(a1), cy + ri * math.sin(a1))]


def full_mark(t):
    """The primary mark: a beetle seen from above, wings out, abdomen tip lit.

    A firefly is a beetle, so the body carries hard wing cases split down the
    middle rather than the open fan of a butterfly, and the flight wings behind
    them are two narrow blades. Keeping that silhouette is what stops the mark
    reading as a generic winged insect.
    """
    return "".join([
        both([(52, 44), (14, 34), (4, 56), (32, 78), (50, 66)], t["light"]),
        both([(52, 44), (14, 34), (17, 41), (50, 49)], t["mid"]),
        both([(52, 44), (63, 44), (63, 88), (56, 95), (46, 76), (46, 52)], t["mid"]),
        both([(48, 54), (52, 54), (56, 86), (52, 88)], t["deep"]),
        both([(57, 23), (59, 20), (35, 5), (33, 9)], t["mid"]),
        polygon([(58, 19), (70, 19), (71, 28), (57, 28)], t["mid"]),
        polygon([(54, 28), (74, 28), (77, 43), (51, 43)], t["deep"]),
        polygon([(56, 86), (72, 86), (71, 104), (57, 104)], t["deep"]),
        "".join(polygon(ray(a), t["pale"]) for a in GLOW_ANGLES),
        polygon(ngon(**LANTERN), t["pale"]),
    ])


def reduced_mark(t):
    """Favicon build: solid body, two wing blades, no legs, no rays, a big lantern.

    A mascot cannot simply be scaled down — small facets turn to mud below about
    24px, so the small size gets its own drawing with fewer, larger shapes. The
    rays and the legs are the first things to go: below 24px they close up into a
    blur around the body and cost the lantern its shape.
    """
    # The antennae stay in the reduced drawing even though they nearly vanish:
    # without them the body reads as an anonymous capsule at 16px, with them the
    # silhouette still says insect.
    return "".join([
        both([(50, 40), (8, 26), (0, 54), (32, 80), (48, 64)], t["light"]),
        both([(50, 36), (62, 36), (62, 86), (52, 94), (44, 72), (44, 46)], t["mid"]),
        both([(55, 14), (57, 10), (33, 0), (31, 5)], t["mid"]),
        polygon([(50, 12), (78, 12), (80, 40), (48, 40)], t["deep"]),
        polygon([(52, 82), (76, 82), (74, 102), (54, 102)], t["deep"]),
        polygon(ngon(64, 104, 21), t["pale"]),
    ])


# --- contact sheet -----------------------------------------------------------
# One image showing every variant on both grounds, so the brand page is a single
# look rather than a folder of files to open one by one. Each panel paints its
# own background, so the sheet reads correctly whatever theme the viewer is in.

SHEET_W, PANEL_H = 1120, 300
PANEL = [
    dict(name="On light", bg="#FFFFFF", label="#57534E", tones=LIGHT_BG, ink=WORDMARK_INK["light"]),
    dict(name="On dark",  bg="#12140D", label="#A8A29E", tones=DARK_BG,  ink=WORDMARK_INK["dark"]),
]

# The product's name as a brand, in two weights: the kind of thing, then what it
# gives you. Commands and packages keep the handle webapp-evidence.
WORDMARK = (("Webapp", 400), (" ", 400), ("Evidence", 600))
BRAND = "".join(part for part, _ in WORDMARK)
WORD_SIZE = 46
WORD_X = 138
WORD_BASELINE = 82
WORD_TRACKING = -1        # units of the SVG, per letter, as the text version had
LOCKUP_PAD = 20           # room after the last letter

INTER = OUT.parents[2] / "webapp/node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2"


def _font(weight, cache={}):
    if weight not in cache:
        if not INTER.exists():
            raise SystemExit(f"{INTER} not found: run pnpm install in webapp/ first")
        cache[weight] = instantiateVariableFont(TTFont(INTER), {"wght": weight})
    return cache[weight]


def _kerning(font):
    """Pair adjustments from the font's GPOS, for the pairs a name this short needs."""
    pairs, classed = {}, []
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, "ExtSubTable", sub)
            if getattr(sub, "LookupType", None) != 2 and type(sub).__name__ != "PairPos":
                continue
            first = sub.Coverage.glyphs
            if sub.Format == 1:
                for i, left in enumerate(first):
                    for record in sub.PairSet[i].PairValueRecord:
                        value = getattr(record.Value1, "XAdvance", 0) if record.Value1 else 0
                        pairs.setdefault((left, record.SecondGlyph), value)
            elif sub.Format == 2:
                classed.append((set(first), sub))
    return pairs, classed


def _kern(font, left, right, table):
    pairs, classed = table
    if (left, right) in pairs:
        return pairs[(left, right)]
    for coverage, sub in classed:
        if left not in coverage:
            continue
        c1 = sub.ClassDef1.classDefs.get(left, 0)
        c2 = sub.ClassDef2.classDefs.get(right, 0)
        value = sub.Class1Record[c1].Class2Record[c2].Value1
        if value and getattr(value, "XAdvance", 0):
            return value.XAdvance
    return 0


def _outline():
    """The wordmark as one path, in lockup units, and where it ends."""
    x, paths, prev = WORD_X, [], None
    for text, weight in WORDMARK:
        font = _font(weight)
        scale = WORD_SIZE / font["head"].unitsPerEm
        cmap, glyphs, table = font.getBestCmap(), font.getGlyphSet(), _kerning(font)
        for ch in text:
            name = cmap[ord(ch)]
            if prev and prev[1] is font:
                x += _kern(font, prev[0], name, table) * scale
            pen = SVGPathPen(glyphs)
            glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, WORD_BASELINE)))
            if pen.getCommands():
                paths.append(pen.getCommands())
            x += glyphs[name].width * scale + WORD_TRACKING
            prev = (name, font)
    return " ".join(paths), x - WORD_TRACKING


WORD_PATH, WORD_END = _outline()
LOCKUP_W = math.ceil(WORD_END + LOCKUP_PAD)


def _label(x, y, text, fill, size=13, weight="500"):
    return (f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" '
            f'font-weight="{weight}" fill="{fill}" letter-spacing=".02em">{text}</text>')


def _wordmark(ink):
    return f'<path d="{WORD_PATH}" fill="{ink}"/>'


def _panel(p, dy):
    t, out = p["tones"], [f'<rect x="0" y="{dy}" width="{SHEET_W}" height="{PANEL_H}" fill="{p["bg"]}"/>']
    out.append(_label(48, dy + 44, p["name"].upper(), p["label"], 11, "600"))

    # the mark, at its native 128
    out.append(f'<g transform="translate(64 {dy + 92})">{full_mark(t)}</g>')
    out.append(_label(64, dy + 254, "mark &#183; 128px", p["label"]))

    # the lockup, scaled to 420 wide
    k = 420 / LOCKUP_W
    out.append(f'<g transform="translate(248 {dy + 92}) scale({k:.4f})">'
               f'{full_mark(t)}{_wordmark(p["ink"])}</g>')
    out.append(_label(248, dy + 254, "lockup &#183; 420px wide", p["label"]))

    # the favicon drawing at the sizes it actually gets used at
    x = 740
    for size in (32, 24, 16):
        k = size / 128
        out.append(f'<g transform="translate({x} {dy + 160 - size}) scale({k:.4f})">'
                   f'{reduced_mark(t)}</g>')
        x += size + 22
    out.append(_label(740, dy + 254, "favicon &#183; 32 / 24 / 16px", p["label"]))

    # the four tones, named
    for i, key in enumerate(("deep", "mid", "light", "pale")):
        y = dy + 100 + i * 34
        out.append(f'<rect x="920" y="{y}" width="24" height="24" rx="3" fill="{t[key]}"/>')
        out.append(_label(956, y + 17, f'{key} &#183; {t[key]}', p["label"], 12, "400"))
    out.append(_label(920, dy + 254, "tones", p["label"]))
    return "".join(out)


def sheet_svg():
    panels = "".join(_panel(p, i * PANEL_H) for i, p in enumerate(PANEL))
    return ('<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {SHEET_W} {PANEL_H * len(PANEL)}" role="img" '
            f'aria-label="{BRAND} logo variants on light and dark grounds">\n'
            f'  {panels}\n</svg>\n')


def icon_svg(body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" '
            f'role="img" aria-label="{BRAND}">\n  {body}\n</svg>\n')


def lockup_svg(body, ink):
    return ('<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {LOCKUP_W} 128" role="img" aria-label="{BRAND}">\n'
            f'  {body}\n  {_wordmark(ink)}\n</svg>\n')


def main():
    """Write every asset. Guarded so other build scripts can import the geometry."""
    for name, content in {
        "logo.svg":             icon_svg(full_mark(LIGHT_BG)),
        "logo-dark.svg":        icon_svg(full_mark(DARK_BG)),
        "favicon.svg":          icon_svg(reduced_mark(LIGHT_BG)),
        "logo-lockup.svg":      lockup_svg(full_mark(LIGHT_BG), WORDMARK_INK["light"]),
        "logo-lockup-dark.svg": lockup_svg(full_mark(DARK_BG), WORDMARK_INK["dark"]),
        "brand-sheet.svg":      sheet_svg(),
    }.items():
        (OUT / name).write_text(content)
        print("wrote", name)


if __name__ == "__main__":
    main()
