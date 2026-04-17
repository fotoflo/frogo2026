# File Size Distribution — 2026-04-16

| Bucket     | Count |
|------------|-------|
| <=50       | 67    |
| 51-150     | 80    |
| 151-300    | 30    |
| 301-500    | 5     |
| 501-1000   | 1     |
| 1001-2000  | 0     |
| 2000+      | 0     |

- **Total files:** 183
- **Over 500 lines:** 1
- **Largest:** src/app/admin/channels/edit/[...slug]/ChannelEditor.tsx (507 lines)

## Delta vs previous 2026-04-16 (earlier) snapshot

- Total files: 173 → 183 (+10)
- 51-150 bucket: 72 → 80 (+8)
- 151-300 bucket: 27 → 30 (+3)
- 501-1000 bucket: 2 → 1 (-1)
- Over 500 lines: 2 → 1 (-1)
- Largest file shifted: TVClient.tsx (721) → ChannelEditor.tsx (507) — TVClient.tsx was split (new TVOverlays.tsx + six extracted hooks in src/lib/use*.ts)
- New hook files land in 51-150; SearchResults.tsx and test files add to 51-150 / 151-300
- src/lib/youtube-api.ts (277 lines) stays inside the 151-300 bucket — did not push any bucket up
- No files over the 300-line cap except the 5 legacy 301-500 files and ChannelEditor.tsx (507) — cap violations unchanged in count
