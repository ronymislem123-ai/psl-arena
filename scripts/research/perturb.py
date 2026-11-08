"""Creates controlled variants of a photo (known affine transform + photometric changes).

Usage: python3 -I scripts/research/perturb.py <image> <outDir>
Writes <outDir>/<name>__<variant>.jpg and <outDir>/<name>__transforms.json with the
2x3 affine matrix (source px -> variant px) of every variant, so detected landmarks
can be mapped back to the source frame for repeatability analysis.
"""
import json
import math
import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageFilter

src, out = Path(sys.argv[1]), Path(sys.argv[2])
out.mkdir(parents=True, exist_ok=True)
img = Image.open(src).convert("RGB")
W, H = img.size
name = src.stem


def affine_variant(scale=1.0, rot_deg=0.0, dx=0.0, dy=0.0):
    """Returns (image, forward matrix) for a similarity transform about the image centre."""
    cx, cy = W / 2, H / 2
    a = math.radians(rot_deg)
    c, s = math.cos(a) * scale, math.sin(a) * scale
    # forward: p' = M p + t (rotation about the centre, then shift)
    tx = cx - c * cx + s * cy + dx
    ty = cy - s * cx - c * cy + dy
    fwd = [[c, -s, tx], [s, c, ty]]
    # PIL needs the inverse mapping (output -> input)
    det = c * c + s * s
    ic, is_ = c / det, -s / det
    inv = [ic, -is_, -(ic * tx - is_ * ty), is_, ic, -(is_ * tx + ic * ty)]
    im = img.transform((W, H), Image.AFFINE, inv, resample=Image.BICUBIC, fillcolor=(128, 128, 128))
    return im, fwd


identity = [[1, 0, 0], [0, 1, 0]]
variants = {}
for i, (dx, dy) in enumerate([(0.37, 0.0), (0.0, 0.61), (-0.53, 0.29), (2.5, -1.5)]):
    variants[f"shift{i}"] = affine_variant(dx=dx, dy=dy)
for sc in (0.85, 0.93, 1.07):
    variants[f"scale{int(sc*100)}"] = affine_variant(scale=sc)
for r in (-4, -2, 2, 4):
    variants[f"rot{r:+d}"] = affine_variant(rot_deg=r)
variants["jpeg60"] = (img, identity)
variants["jpeg80"] = (img, identity)
variants["bright085"] = (ImageEnhance.Brightness(img).enhance(0.85), identity)
variants["bright115"] = (ImageEnhance.Brightness(img).enhance(1.15), identity)
variants["contrast080"] = (ImageEnhance.Contrast(img).enhance(0.8), identity)
variants["blur1"] = (img.filter(ImageFilter.GaussianBlur(1.0)), identity)
variants["original"] = (img, identity)

transforms = {}
for key, (im, fwd) in variants.items():
    q = 60 if key == "jpeg60" else 80 if key == "jpeg80" else 95
    im.save(out / f"{name}__{key}.jpg", quality=q)
    transforms[key] = fwd
(out / f"{name}__transforms.json").write_text(json.dumps({"width": W, "height": H, "transforms": transforms}))
print(f"{name}: {len(variants)} variants")
