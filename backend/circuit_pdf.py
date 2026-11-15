"""Extracts records from the official CircuitInformation.pdf text layer."""
import io
import re

ENTRY = re.compile(
    r"(?P<name>.+?) \((?P<nation>[A-Z]{3})\) (?:(?P<time>\d+'\d{2}\.\d{3}) )?"
    r"(?P<speed>\d+(?:\.\d+)?) Km/h(?P<year>\d{4})?\s*$"
)
LABELS = ("All-Time Lap Record ", "Top Speed ", "Best Lap ")
CATEGORIES = ("MotoGP", "Moto2", "Moto3")
CURRENT = ("all_time_lap", "best_race_lap", "best_pole", "top_speed")
PREVIOUS = ("best_lap", "race_fastest_lap", "pole", "top_speed")


def _entries(text: str):
    out = []
    for line in text.splitlines():
        match = ENTRY.search(line.strip())
        if not match:
            continue
        name = match["name"]
        for label in LABELS:
            if name.startswith(label):
                name = name[len(label):]
        out.append({
            # shortcut: the PDF font maps Ñ to U+FFFD; other accented capitals would be mislabelled the same way
            "rider": name.replace("�", "Ñ").strip(), "nation": match["nation"], "time": match["time"],
            "speed": float(match["speed"]), "year": int(match["year"]) if match["year"] else None,
        })
    return out


def _section(entries, keys):
    if len(entries) < 12:
        return {}
    for i, entry in enumerate(entries[:12]):
        if (entry["time"] is None) != (i % 4 == 3):  # only the 4th slot (top speed) has no lap time
            return {}
    return {cat: dict(zip(keys, entries[i * 4:i * 4 + 4])) for i, cat in enumerate(CATEGORIES)}


def parse_circuit_text(text: str) -> dict:
    entries = _entries(text)
    return {"records": _section(entries[:12], CURRENT), "previous": _section(entries[12:24], PREVIOUS)}


def parse_circuit_pdf(content: bytes) -> dict:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(content))
    return parse_circuit_text(reader.pages[0].extract_text() or "") if reader.pages else parse_circuit_text("")
