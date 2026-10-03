# Borough boundaries

`london-boroughs.geojson` contains the 32 London boroughs and the City of London,
from the Greater London Authority's [London Boroughs dataset](https://data.london.gov.uk/dataset/london-boroughs-e55pw).

Source: [London_Boroughs.gpkg](https://data.london.gov.uk/download/e55pw/9502cdec-5df0-46e3-8aa1-2b5c5233a31f/London_Boroughs.gpkg), downloaded 2026-10-03.
The source uses EPSG:27700; the vendored geometry uses EPSG:4326, rounded to six
decimal places. Shapes are not simplified. `ons_inner` supplies the inner/outer
classification; the GSS code is the stable borough ID.

Contains public sector information licensed under the
[Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/).
Contains Ordnance Survey data © Crown copyright and database right 2018.

To reproduce the conversion:

```sh
uv run --with shapely --with pyproj python scripts/vendor-boroughs.py
```

Venues outside these polygons remain in the data with `outside-london` as their
borough, and are reported in build diagnostics. They are never silently assigned
to the nearest borough.

`memberships.ts` maps venues to membership/discount programmes. This indicates
venue eligibility; it does not guarantee coverage of every screening or format.
