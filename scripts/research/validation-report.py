"""Model validation, part 2: compares engine 2.0 with engine 1.x on the cases of
tests/research/validation.test.ts and writes docs/research/model-validation.json.

Usage: python3 -I scripts/research/validation-report.py <outDir> [<json out>]
"""
import json
import math
import statistics as st
import sys
from pathlib import Path

out_dir = Path(sys.argv[1])
dst = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).resolve().parents[2] / "docs" / "research" / "model-validation.json"
new = {r["id"]: r for r in json.loads((out_dir / "results-new.json").read_text())}
old = {r["id"]: r for r in json.loads((out_dir / "results-old.json").read_text())}
E = {"new": new, "old": old}


def val(eng, cid, key="overall"):
    r = E[eng].get(cid)
    if not r or r.get("error") or r.get(key) is None:
        return None
    return r[key]


def sd(xs):
    xs = [x for x in xs if x is not None]
    return st.stdev(xs) if len(xs) > 1 else None


def r3(x):
    return None if x is None else round(x, 3)


report = {"cases": len(new), "engines": {"old": "1.x (commit 6391a18)", "new": "2.0.0 / rubric 2.0.0"}}

# ---------------------------------------------------------------- A: test–retest
A = {}
for face in ("portrait-a", "portrait-b"):
    ids = [k for k in new if k.startswith(f"A:{face}:")]
    row = {"variants": len(ids)}
    for eng in ("old", "new"):
        ov = [val(eng, i) for i in ids]
        ps = [val(eng, i, "psl") for i in ids]
        mc = [val(eng, i, "overallSigma") for i in ids]
        mc = [m for m in mc if m is not None]
        row[eng] = {"overallMean": r3(st.mean([x for x in ov if x is not None])), "overallSD": r3(sd(ov)), "pslSD": r3(sd(ps)), "meanMcSigma": r3(st.mean(mc)) if mc else None, "mcOverEmpirical": r3(st.mean(mc) / sd(ov)) if mc and sd(ov) else None}
    A[face] = row
noise = {eng: math.sqrt(st.mean([A[f][eng]["overallSD"] ** 2 for f in A])) for eng in ("old", "new")}
noise_psl = {eng: math.sqrt(st.mean([A[f][eng]["pslSD"] ** 2 for f in A])) for eng in ("old", "new")}
report["A_testRetest"] = {"faces": A, "pooledOverallSD": {k: r3(v) for k, v in noise.items()}, "pooledPslSD": {k: r3(v) for k, v in noise_psl.items()}}

# ---------------------------------------------------------------- B: controlled deformations
B = []
for cid in new:
    if not cid.startswith("B:") or not cid.endswith(":0"):
        continue
    _, face, op, _ = cid.split(":")
    ids = [f"B:{face}:{op}:{k}" for k in (-2, -1, 0, 1, 2)]
    row = {"face": face, "op": op}
    for eng in ("old", "new"):
        ov = [val(eng, i) for i in ids]
        ps = [val(eng, i, "psl") for i in ids]
        amp = max(ov) - min(ov)
        row[eng] = {"overall": [r3(x) for x in ov], "psl": [r3(x) for x in ps], "amplitude": r3(amp), "pslAmplitude": r3(max(ps) - min(ps)), "discrimination": r3(amp / noise[eng])}
    B.append(row)
for eng in ("old", "new"):
    d = [r[eng]["discrimination"] for r in B]
    report.setdefault("B_deformations_summary", {})[eng] = {
        "medianDiscrimination": r3(st.median(d)),
        "shareDetectable(>2 noise SD)": r3(sum(1 for x in d if x > 2) / len(d)),
        "medianPslAmplitude": r3(st.median([r[eng]["pslAmplitude"] for r in B])),
    }
report["B_deformations"] = B

# ---------------------------------------------------------------- C: different faces
C = {}
for cid in new:
    if cid.startswith("C:"):
        C[cid[2:]] = {eng: {"overall": r3(val(eng, cid)), "psl": r3(val(eng, cid, "psl")), "pslSigma": r3(val(eng, cid, "pslSigma")), "analyzable": E[eng][cid].get("analyzable")} for eng in ("old", "new")}
for eng in ("old", "new"):
    ps = [C[f][eng]["psl"] for f in C if C[f][eng]["psl"] is not None]
    ov = [C[f][eng]["overall"] for f in C if C[f][eng]["overall"] is not None]
    report.setdefault("C_differentFaces_summary", {})[eng] = {"pslRange": r3(max(ps) - min(ps)), "pslSD": r3(st.stdev(ps)), "overallSD": r3(st.stdev(ov)), "betweenFaceSNR": r3(st.stdev(ov) / noise[eng])}
report["C_differentFaces"] = C

# ---------------------------------------------------------------- D: compensation
D = {cid[2:]: {eng: {"overall": r3(val(eng, cid)), "psl": r3(val(eng, cid, "psl")), "penalty": r3(val(eng, cid, "penalty")) if eng == "new" else None} for eng in ("old", "new")} for cid in new if cid.startswith("D:")}
for eng in ("old", "new"):
    g_weak = D["oneExcellent"][eng]["overall"] - D["allWeak"][eng]["overall"]
    g_ideal = D["ideal"][eng]["overall"] - D["eyesOnlyWeak"][eng]["overall"]
    report.setdefault("D_compensation_summary", {})[eng] = {
        "gainFixingEyes_othersWeak": r3(g_weak),
        "gainFixingEyes_othersIdeal": r3(g_ideal),
        "ratio": r3(g_weak / g_ideal) if g_ideal else None,
        "balancedMinusOneExcellent": r3(D["balanced"][eng]["overall"] - D["oneExcellent"][eng]["overall"]),
    }
report["D_compensation"] = D

# ---------------------------------------------------------------- E: pose and symmetry
Epose = {}
for face in ("ideal", "obama"):
    base = {eng: val(eng, f"E:{face}:yaw0") for eng in ("old", "new")}
    rows = {}
    for cid in new:
        if cid.startswith(f"E:{face}:") and any(t in cid for t in ("yaw", "pitch", "roll")):
            rows[cid.split(":")[2]] = {eng: {"overall": r3(val(eng, cid)), "delta": r3(val(eng, cid) - base[eng]) if val(eng, cid) is not None and base[eng] is not None else None, "analyzable": E[eng][cid].get("analyzable"), "yawMeasured": r3((E[eng][cid].get("pose") or {}).get("yaw"))} for eng in ("old", "new")}
    Epose[face] = rows
for eng in ("old", "new"):
    worst = {}
    for face, rows in Epose.items():
        for k in ("yaw10", "yaw20", "pitch-10", "pitch10", "roll90", "roll180"):
            d = rows[k][eng]["delta"]
            worst[f"{face}:{k}"] = d
    report.setdefault("E_pose_summary", {})[eng] = worst
report["E_pose"] = Epose
Esym = {cid[2:]: {eng: {"symmetry": r3(val(eng, cid, "symmetry")), "overall": r3(val(eng, cid))} for eng in ("old", "new")} for cid in new if cid.startswith("E:obama:sym") or cid.startswith("E:obama:asym")}
report["E_symmetry"] = Esym

# ---------------------------------------------------------------- parameter sensitivity
sens_file = out_dir / "sensitivity.json"
if sens_file.exists():
    sens = json.loads(sens_file.read_text())
    rows = {r["id"]: {k: r3(v) for k, v in r.items() if k != "id"} for r in sens}

    def ranks(key):
        ids = [i for i in rows if i.startswith("C:")]
        order = sorted(ids, key=lambda i: -rows[i][key])
        return [i[2:] for i in order]

    report["sensitivity"] = {
        "cases": rows,
        "rankC": {k: ranks(k) for k in ("p=1", "p=0.5", "p=0.25", "equalWeights", "noReliability")},
        "maxAbsChangeVsDefault": {k: r3(max(abs(rows[i][k] - rows[i]["p=0.5"]) for i in rows)) for k in ("p=1", "p=0.25", "equalWeights", "noReliability")},
    }

# reports never carry a real person's name next to a score: neutral labels for the fixtures
NEUTRAL = {"obama": "portrait-a", "biden": "portrait-b", "ai-face": "ai-face-1", "ai-upper": "ai-face-2", "mp-portrait-rot": "rotated-portrait"}


def neutral(x):
    if isinstance(x, dict):
        return {neutral(k): neutral(v) for k, v in x.items()}
    if isinstance(x, list):
        return [neutral(v) for v in x]
    if isinstance(x, str):
        for a, b in NEUTRAL.items():
            x = x.replace(a, b)
    return x


report = neutral(report)
dst.write_text(json.dumps(report, indent=1, ensure_ascii=False))
print(json.dumps({k: v for k, v in report.items() if k.endswith("summary") or k.startswith("A_") or k in ("C_differentFaces", "D_compensation", "E_symmetry")}, indent=1))
