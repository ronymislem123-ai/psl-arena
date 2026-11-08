"""Per-landmark repeatability of the MediaPipe Face Landmarker under controlled image changes.

Usage: python3 -I scripts/research/repeatability.py <imgDir> <detDir> <out.json> <name> [<name> …]
Maps every detected landmark of every variant back to the source frame (inverse of the
known affine transform) and reports the per-landmark standard deviation in units of the
interpupillary distance (IPD), pooled over the faces. This is repeatability (precision
under nuisance changes), not accuracy against anatomy.
"""
import json
import math
import sys
from pathlib import Path

img_dir, det_dir, out_path, names = Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]), sys.argv[4:]
pooled = [[0.0, 0] for _ in range(478)]
pooled_z = [[0.0, 0] for _ in range(478)]
per_variant = {}
for name in names:
    meta = json.loads((img_dir / f"{name}__transforms.json").read_text())
    pts = {}
    for key, fwd in meta["transforms"].items():
        f = det_dir / f"{name}__{key}.json"
        if not f.exists():
            continue
        mesh = json.loads(f.read_text())["mesh"]
        (a, b, tx), (c, d, ty) = fwd
        det = a * d - b * c
        scale = math.sqrt(abs(det))
        back = []
        for x, y, z in mesh:
            u, v = x - tx, y - ty
            back.append(((d * u - b * v) / det, (-c * u + a * v) / det, z / scale))
        pts[key] = back
    ref = pts["original"]
    ipd = math.dist(ref[468][:2], ref[473][:2])
    keys = list(pts)
    per_variant[name] = {"variants": len(keys), "ipd": ipd}
    for i in range(478):
        xs = [pts[k][i][0] for k in keys]
        ys = [pts[k][i][1] for k in keys]
        zs = [pts[k][i][2] for k in keys]
        mx, my, mz = sum(xs) / len(xs), sum(ys) / len(ys), sum(zs) / len(zs)
        var = sum((x - mx) ** 2 + (y - my) ** 2 for x, y in zip(xs, ys)) / (2 * (len(xs) - 1))
        varz = sum((z - mz) ** 2 for z in zs) / (len(zs) - 1)
        pooled[i][0] += var / ipd**2
        pooled[i][1] += 1
        pooled_z[i][0] += varz / ipd**2
        pooled_z[i][1] += 1
sigma = [math.sqrt(s / n) for s, n in pooled]
sigma_z = [math.sqrt(s / n) for s, n in pooled_z]
groups = {
    "pupils/iris": list(range(468, 478)),
    "eye corners (33,133,263,362)": [33, 133, 263, 362],
    "nose tip/base (1,2,4,48,278)": [1, 2, 4, 48, 278],
    "mouth corners/lips (61,291,0,17,13,14)": [61, 291, 0, 17, 13, 14],
    "brows (52,282,70,300,105,334)": [52, 282, 70, 300, 105, 334],
    "cheek contour (127,234,93,356,454,323)": [127, 234, 93, 356, 454, 323],
    "jaw angle (58,172,136,288,397,365)": [58, 172, 136, 288, 397, 365],
    "chin (152,148,176,377,400)": [152, 148, 176, 377, 400],
    "forehead top (10,67,297)": [10, 67, 297],
}
summary = {g: round(sum(sigma[i] for i in idx) / len(idx), 5) for g, idx in groups.items()}
out_path.write_text(json.dumps({"method": "per-landmark SD (pooled x/y) after mapping back known transforms, in IPD units", "faces": per_variant, "sigmaIpd": [round(s, 5) for s in sigma], "sigmaZIpd": [round(s, 5) for s in sigma_z], "groups": summary}, indent=1))
print(json.dumps(per_variant))
for g, v in summary.items():
    print(f"{g:42s} {v:.4f} IPD")
print("median", sorted(sigma)[239], "max", max(sigma), "argmax", sigma.index(max(sigma)))
