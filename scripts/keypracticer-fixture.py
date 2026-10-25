# Writes src/practice/__tests__/keypracticer-fixture.json from Keypracticer theory.py.
# Usage: python3 -I scripts/keypracticer-fixture.py <path to keypracticer-content-gen> src/practice/__tests__/keypracticer-fixture.json
import json, sys
sys.path.insert(0, sys.argv[1])
import theory as T
PATTERNS = ["Up & down", "Up", "Groups of 3", "Thirds", "Groups of 4"]
out = []
# Eight keys cover sharp, flat and natural spellings and keep the file small.
for key in ("C", "Eb", "E", "F", "F#", "A", "Bb", "B"):
    for mode, names in (("scale", list(T.SCALES)), ("arpeggio", list(T.ARPEGGIOS))):
        for name in names:
            cfg0 = {"mode": mode, "key": key, "scale": name, "arpeggio": name, "position": 1}
            npos = T.n_positions(cfg0)
            pats = PATTERNS if key in ("A", "Bb") else ["Up & down"]
            for pos in range(1, npos + 1):
                for pat in pats:
                    cfg = {"mode": mode, "key": key, "scale": name, "arpeggio": name, "position": pos,
                           "pattern": pat, "note_value": "Eighth", "bpm": 80, "repeats": 1, "loop": True}
                    plan = T.build_plan(cfg)
                    enc = lambda n: f'{n["string"]}:{n["fret"]}:{n["name"]}:{n["interval"]}'
                    out.append({"mode": mode, "key": key, "name": name, "position": pos, "pattern": pat,
                                "title": plan["title"], "positions": npos,
                                "notes": " ".join(enc(n) for n in plan["notes"]),
                                "box": " ".join(enc(n) for n in plan["bars"][0]["map"]) if pat == "Up & down" else None})
json.dump(out, open(sys.argv[2], "w"), separators=(",", ":"))
print(len(out))
