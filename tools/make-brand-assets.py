#!/usr/bin/env python3
"""
RateIt brand assets — generated from code.

Everything here is geometry: the finger, the rating scale, the +10 target and
the custom wordmark are all drawn as vector paths, so the identity scales
cleanly from a 16px favicon to a 1200x630 social card.

Run:
    python3 tools/make-brand-assets.py

Writes SVG files into public/brand/. Convert them to PNG with
tools/render-brand-pngs.cjs.

Palette (60–30–10)
    white   #FFFFFF   60%  negative space
    blue    #2563EB   30%  primary identity
    violet  #7C3AED   10%  the +10 rating and signature accents
    navy    #172554         supporting text only

The one idea everything hangs off: the violet dot the finger lands on in the
icon is the *same* dot that rides above the capital I in the wordmark. Your
finger presses the +10; the +10 is the dot of RateIt's I.
"""

import os

WHITE = "#FFFFFF"
BLUE = "#FF8500"
BLUE_MID = "#E87500"
VIOLET = "#0F0F0F"
NAVY = "#172554"
PALE_BLUE = "#DBEAFE"
PALE_BLUE_2 = "#BFDBFE"
PALE_VIOLET = "#FFD8A8"

FONT = ("ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, "
        "'DejaVu Sans', Helvetica, Arial, sans-serif")

OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "public", "brand")

# --------------------------------------------------------------------------
# Wordmark. A monoline rounded face drawn as strokes: cap height 100,
# x-height 72, stroke 20 — thick enough to feel bold, thin enough that the
# counters stay open and legible.
# --------------------------------------------------------------------------
SW = 20
X_HEIGHT = 28
BASELINE = 100


def letters():
    """Each letter as (advance, markup).

    Every letter is emitted in ONE shared coordinate space rather than in its
    own translated group. That matters: a userSpaceOnUse gradient resolves in
    the space of the element that references it, so per-letter transforms would
    restart the blue→violet sweep inside every letter.
    """
    def R(x):
        return (f'<path d="M {x + 10} 10 V 90"/>'
                f'<path d="M {x + 10} 10 H {x + 34} A 28 28 0 0 1 {x + 34} 66 H {x + 10}"/>'
                f'<path d="M {x + 37} 63 L {x + 62} 90"/>')

    def a(x):
        return (f'<circle cx="{x + 34}" cy="64" r="24"/>'
                f'<path d="M {x + 58} 40 V 90"/>')

    def t(x):
        return (f'<path d="M {x + 22} 16 V 90"/>'
                f'<path d="M {x + 10} 40 H {x + 34}"/>')

    def e(x):
        return (f'<path d="M {x + 10} 64 H {x + 58}"/>'
                f'<path d="M {x + 58} 64 A 24 24 0 1 0 {x + 46} 84.8"/>')

    def I(x):
        return f'<path d="M {x + 12} 10 V 90"/>'

    return [
        (72, R(0)),
        (68, a(86)),
        (44, t(168)),
        (68, e(226)),
        (24, I(308)),
        (44, t(346)),
    ]


WORDMARK_WIDTH = 390
DOT_X = 320  # sits above the I


def wordmark(transform="", dot=True):
    stroke = (f'fill="none" stroke="url(#rateitGrad)" stroke-width="{SW}" '
              f'stroke-linecap="round" stroke-linejoin="round"')
    body = "".join(markup for _, markup in letters())
    parts = [f'''<defs>
    <linearGradient id="rateitGrad" x1="0" y1="0" x2="{WORDMARK_WIDTH}" y2="0"
                    gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="{BLUE}"/>
      <stop offset="0.58" stop-color="{BLUE}"/>
      <stop offset="0.84" stop-color="{BLUE_MID}"/>
      <stop offset="1" stop-color="{VIOLET}"/>
    </linearGradient>
  </defs>''',
             f'<g {stroke}>{body}</g>']
    if dot:
        # The signature detail: the +10 press point, riding above the I.
        parts.append(f'<circle cx="{DOT_X}" cy="-26" r="11" fill="{VIOLET}"/>')
        parts.append(f'<circle cx="{DOT_X}" cy="-26" r="15.5" fill="none" '
                     f'stroke="{PALE_VIOLET}" stroke-width="3"/>')
    return f'<g transform="{transform}">' + "".join(parts) + "</g>"


# --------------------------------------------------------------------------
# The finger, as one reusable shape. Origin = top-centre, pointing down.
# --------------------------------------------------------------------------
def finger(length, half_top, half_tip, tip_r, top=0, crease=True, on="blue"):
    """A gently tapered finger ending in a rounded pad.

    `on="blue"` gives a white finger for use on the blue tile; `on="white"`
    gives a blue finger for use on white, where a white one would vanish.
    """
    y = top + length
    x1, x2 = -half_top, half_top
    x3, x4 = -half_tip, half_tip
    # down the right side, round the pad, back up the left
    body = (f'M {x1} {top} L {x2} {top} L {x4} {y} '
            f'A {tip_r} {tip_r} 0 0 1 {x3} {y} Z')
    out = f'<path d="{body}" fill="url(#{"fingerOnBlue" if on == "blue" else "fingerOnWhite"})"/>'
    if crease:
        ink = "rgba(37,99,235,0.20)" if on == "blue" else "rgba(255,255,255,0.34)"
        out += (f'<path d="M {x1 + 8} {y - 54} Q 0 {y - 44} {x2 - 8} {y - 54}" '
                f'fill="none" stroke="{ink}" stroke-width="3" '
                f'stroke-linecap="round"/>')
    return out


def finger_defs():
    return f'''<defs>
    <linearGradient id="fingerOnBlue" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{WHITE}"/>
      <stop offset="0.66" stop-color="{WHITE}"/>
      <stop offset="1" stop-color="#E8F0FF"/>
    </linearGradient>
    <linearGradient id="fingerOnWhite" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="{BLUE}"/>
      <stop offset="0.72" stop-color="{BLUE}"/>
      <stop offset="1" stop-color="#1D4ED8"/>
    </linearGradient>
  </defs>'''


# --------------------------------------------------------------------------
# 1. App icon / profile picture — the finger landing on +10.
# --------------------------------------------------------------------------
def mark_inner(numbers=True, ripples=True, tile=True):
    cx, dot_y, r = 96, 88, 11
    parts = []
    if tile:
        parts.append(f'<rect width="128" height="128" rx="30" fill="{BLUE}"/>')

    parts.append(f'<rect x="14" y="{dot_y - 3.5}" width="82" height="7" rx="3.5" '
                 f'fill="{WHITE}" opacity="0.28"/>')
    for i in range(6):
        x = 14 + i * (82 / 6)
        parts.append(f'<rect x="{x - 1.6:.2f}" y="{dot_y - 6}" width="3.2" height="12" '
                     f'rx="1.6" fill="{WHITE}" opacity="0.5"/>')

    if ripples:
        for rr, op in ((15, 0.45), (21, 0.22)):
            parts.append(f'<path d="M {cx - rr} {dot_y} A {rr} {rr} 0 0 0 {cx + rr} {dot_y}" '
                         f'fill="none" stroke="{WHITE}" stroke-width="2.4" '
                         f'stroke-linecap="round" opacity="{op}"/>')

    parts.append(f'<circle cx="{cx}" cy="{dot_y}" r="{r}" fill="{VIOLET}" '
                 f'stroke="{WHITE}" stroke-width="3"/>')
    parts.append(f'<g transform="translate({cx},6)">'
                 + finger(length=58, half_top=15, half_tip=15, tip_r=15, crease=False)
                 + '</g>')

    if numbers:
        parts.append(f'<text x="14" y="122" text-anchor="middle" font-size="11" '
                     f'font-weight="700" fill="{WHITE}" opacity="0.8" '
                     f'font-family="{FONT}">−5</text>')
        parts.append(f'<text x="{cx}" y="122" text-anchor="middle" font-size="11" '
                     f'font-weight="700" fill="{WHITE}" opacity="0.8" '
                     f'font-family="{FONT}">+10</text>')
    return "".join(parts)


def mark(size=128, numbers=True, ripples=True, tile=True):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" '
            f'width="{size}" height="{size}" role="img" aria-label="RateIt">'
            + finger_defs()
            + mark_inner(numbers=numbers, ripples=ripples, tile=tile)
            + "</svg>")


# --------------------------------------------------------------------------
# 2. Favicon — the same idea, simplified so it survives 16px.
# --------------------------------------------------------------------------
def favicon(size=64):
    cx, dot_y, r = 48, 44, 6.5
    parts = [f'<rect width="64" height="64" rx="15" fill="{BLUE}"/>',
             f'<rect x="7" y="{dot_y - 2}" width="41" height="4" rx="2" '
             f'fill="{WHITE}" opacity="0.28"/>']
    for i in range(3):
        x = 7 + i * (41 / 3)
        parts.append(f'<rect x="{x - 1.2:.2f}" y="{dot_y - 4}" width="2.4" height="8" '
                     f'rx="1.2" fill="{WHITE}" opacity="0.5"/>')
    parts.append(f'<circle cx="{cx}" cy="{dot_y}" r="{r}" fill="{VIOLET}" '
                 f'stroke="{WHITE}" stroke-width="2"/>')
    parts.append(f'<g transform="translate({cx},3)">'
                 + finger(length=29, half_top=9, half_tip=9, tip_r=9, crease=False)
                 + '</g>')
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" '
            f'width="{size}" height="{size}" role="img" aria-label="RateIt">'
            + finger_defs() + "".join(parts) + "</svg>")


# --------------------------------------------------------------------------
# 3. Hero illustration — the full −5…+10 scale with the finger landing on +10.
#    Self-contained in a 640x300 box so it can be centred anywhere.
# --------------------------------------------------------------------------
def hero_illustration():
    """640 x 290, so it can be centred and scaled anywhere."""
    x0, x1, y = 100, 520, 170
    step = (x1 - x0) / 15.0
    parts = [finger_defs(),
             f'<rect x="{x0}" y="{y - 4}" width="{x1 - x0}" height="8" rx="4" '
             f'fill="{PALE_BLUE}"/>']
    for i in range(16):
        x = x0 + i * step
        parts.append(f'<rect x="{x - 1.6:.2f}" y="{y - 17}" width="3.2" height="34" '
                     f'rx="1.6" fill="{PALE_BLUE_2}"/>')
    for x, label in ((x0, "−5"), (x0 + 5 * step, "0"), (x1, "+10")):
        parts.append(f'<text x="{x:.1f}" y="{y + 92}" text-anchor="middle" '
                     f'font-size="21" font-weight="700" fill="{NAVY}" opacity="0.55" '
                     f'font-family="{FONT}">{label}</text>')

    parts.append(f'<circle cx="{x1}" cy="{y}" r="34" fill="none" '
                 f'stroke="{PALE_VIOLET}" stroke-width="3"/>')
    parts.append(f'<circle cx="{x1}" cy="{y}" r="22" fill="{VIOLET}" '
                 f'stroke="{WHITE}" stroke-width="4"/>')
    for rr, op in ((40, 0.32), (52, 0.16)):
        parts.append(f'<path d="M {x1 - rr} {y} A {rr} {rr} 0 0 0 {x1 + rr} {y}" '
                     f'fill="none" stroke="{PALE_VIOLET}" stroke-width="3" '
                     f'stroke-linecap="round" opacity="{op}"/>')

    parts.append(f'<ellipse cx="{x1}" cy="{y - 30}" rx="30" ry="7" '
                 f'fill="rgba(23,37,84,0.10)"/>')
    # The finger enters from the top edge of the composition, so the flat top
    # reads as "continuing out of frame" rather than as a cut-off shape.
    parts.append(f'<g transform="translate({x1},0)">'
                 + finger(length=124, half_top=26, half_tip=20, tip_r=26, on="white")
                 + '</g>')
    return "".join(parts)


# --------------------------------------------------------------------------
# 4. Horizontal lockup — website header, docs, email.
# --------------------------------------------------------------------------
def logo_horizontal():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 160"
     width="600" height="160" role="img" aria-label="RateIt">
  <title>RateIt</title>
  {finger_defs()}
  <g transform="translate(14,42) scale(0.8125)">
    {mark_inner(numbers=False, ripples=False)}
  </g>
  {wordmark(transform="translate(172,46)", dot=True)}
</svg>'''


# --------------------------------------------------------------------------
# 5. Stacked lockup — the full brand composition with the tagline.
# --------------------------------------------------------------------------
def logo_stacked():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 700"
     width="640" height="700" role="img" aria-label="RateIt">
  <title>RateIt — Post anything. Rate everything.</title>
  <g transform="translate(0,0)">{hero_illustration()}</g>
  {wordmark(transform="translate(96,445) scale(1.15)", dot=True)}
  <text x="320" y="650" text-anchor="middle" font-size="27" font-weight="500"
        letter-spacing="3" fill="{NAVY}" opacity="0.78"
        font-family="{FONT}">Post anything. Rate everything.</text>
</svg>'''


# --------------------------------------------------------------------------
# 6. Social card — 1200x630.
# --------------------------------------------------------------------------
def social_card():
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630"
     width="1200" height="630" role="img" aria-label="RateIt">
  <title>RateIt</title>
  <rect width="1200" height="630" fill="{WHITE}"/>
  <rect x="0" y="0" width="990" height="10" fill="{BLUE}"/>
  <rect x="990" y="0" width="210" height="10" fill="{VIOLET}"/>
  <g transform="translate(264,12) scale(1.05)">{hero_illustration()}</g>
  {wordmark(transform="translate(356,405) scale(1.25)", dot=True)}
  <text x="600" y="595" text-anchor="middle" font-size="26" font-weight="500"
        letter-spacing="3" fill="{NAVY}" opacity="0.78"
        font-family="{FONT}">Post anything. Rate everything.</text>
</svg>'''


def main():
    os.makedirs(OUT, exist_ok=True)
    files = {
        "mark.svg": mark(size=128),
        "favicon.svg": favicon(size=64),
        "logo-horizontal.svg": logo_horizontal(),
        "logo-stacked.svg": logo_stacked(),
        "social-card.svg": social_card(),
    }
    for name, content in files.items():
        with open(os.path.join(OUT, name), "w", encoding="utf-8") as fh:
            fh.write(content + "\n")
        print(f"wrote public/brand/{name} ({len(content)} bytes)")


if __name__ == "__main__":
    main()
