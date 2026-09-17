# Updating the standings

Replace [`standings.json`](standings.json) with the JSON produced by your ETL. The page calculates totals, rankings, player count, round count, search results, and pair estimates from this file. No HTML edits are needed for a new round.

The ETL output should have this shape (the real file contains all players and rounds):

```json
{
  "competition": "Ljetna liga",
  "brandSeason": "Masters 2026",
  "pageTitle": "Poredak | Modesto Masters 2025/26",
  "footerText": "Modesto Padel Club — Ljetna liga Modesto 2025 / 2026",
  "players": [
    { "id": "123", "name": "Bareo Matić" },
    { "id": "456", "name": "Ivan Grijesi" }
  ],
  "rounds": [
    {
      "date": "2026-09-15",
      "scores": {
        "123": 120,
        "456": 100
      }
    }
  ]
}
```

Append one object to `rounds` for each new round. Use an ISO date (`YYYY-MM-DD`) and numeric scores. Omit players who did not play; a recorded score of `0` remains visible as zero. Every score key must match a player ID in `players`. Add new players to that list with their ID and display name. IDs must be unique and stable; use strings, especially for long numeric IDs. The list order breaks ties in total points. Names are used only for display and search, so a name correction does not affect scores. The page runs on GitHub Pages without a backend.

The existing `standings.json` still uses names as keys and remains supported during migration. Replace the whole file with ID-based data from your ETL when those IDs are available; do not mix name and ID entries in one file.

For local preview, serve the project directory over HTTP (for example, `python -m http.server 8000`) and open `http://localhost:8000/`. Browser security blocks loading the JSON when `index.html` is opened directly as a `file://` page.
