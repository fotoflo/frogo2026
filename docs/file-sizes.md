# File Size Distribution — 2026-04-16

| Bucket     | Count |
|------------|-------|
| <=50       | 67    |
| 51-150     | 72    |
| 151-300    | 27    |
| 301-500    | 5     |
| 501-1000   | 2     |
| 1001-2000  | 0     |
| 2000+      | 0     |

- **Total files:** 173
- **Over 500 lines:** 2
- **Largest:** src/app/watch/[...slug]/TVClient.tsx (721 lines)

## Delta vs previous 2026-04-12 snapshot

- Total files: 144 → 173 (+29)
- <=50 bucket: 63 → 67 (+4)
- 51-150 bucket: 52 → 72 (+20)
- 151-300 bucket: 20 → 27 (+7)
- 501-1000 bucket: 4 → 2 (-2)
- Over 500 lines: 4 → 2 (-2)
- ClassicHUD.tsx (571 lines) refactored into an 8-file folder, each <200 lines — exited the 501-1000 bucket, new pieces land in 51-150 / 151-300
- mcp/route.ts (969 lines) also dropped out of the 501-1000 bucket since last snapshot
- Largest file shifted: mcp/route.ts (969) → TVClient.tsx (721)
