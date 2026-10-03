"""Reproduce the vendored borough geometry; needs shapely and pyproj (see README)."""
import json
import sqlite3
import tempfile
import urllib.request
from pathlib import Path

from shapely import wkb
from shapely.geometry import mapping
from shapely.ops import transform
from pyproj import Transformer

SOURCE = "https://data.london.gov.uk/download/e55pw/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/London_Boroughs.gpkg"
OUTPUT = Path(__file__).resolve().parent.parent / "src/data/london-boroughs.geojson"


def rounded(value):
    if isinstance(value, (tuple, list)):
        return [rounded(item) for item in value]
    return round(value, 6) if isinstance(value, float) else value


with tempfile.TemporaryDirectory() as temporary:
    source = Path(temporary) / "boroughs.gpkg"
    urllib.request.urlretrieve(SOURCE, source)
    projection = Transformer.from_crs(27700, 4326, always_xy=True)
    features = []
    with sqlite3.connect(source) as connection:
        rows = connection.execute("SELECT geom, name, gss_code, ons_inner FROM london_boroughs ORDER BY gss_code")
        for blob, name, code, inner in rows:
            envelope = (blob[3] >> 1) & 7
            offset = 8 + {0: 0, 1: 32, 2: 48, 3: 48, 4: 64}[envelope]
            geometry = transform(projection.transform, wkb.loads(blob[offset:]))
            features.append({
                "type": "Feature",
                "properties": {"code": code, "name": name, "region": "inner" if inner == "T" else "outer"},
                "bbox": rounded(geometry.bounds),
                "geometry": {"type": geometry.geom_type, "coordinates": rounded(mapping(geometry)["coordinates"])},
            })
    if len(features) != 33:
        raise ValueError(f"Expected 33 boroughs, received {len(features)}")
    OUTPUT.write_text(json.dumps({"type": "FeatureCollection", "features": features}, separators=(",", ":")) + "\n")
    print(f"Wrote {len(features)} boroughs to {OUTPUT}")
