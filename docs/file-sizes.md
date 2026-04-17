# File Size Distribution — 2026-04-17

| Bucket     | Count |
|------------|-------|
| <=50       | 66    |
| 51-150     | 82    |
| 151-300    | 31    |
| 301-500    | 5     |
| 501-1000   | 1     |
| 1001-2000  | 0     |
| 2000+      | 0     |

- **Total files:** 185
- **Over 500 lines:** 1
- **Largest:** src/app/admin/channels/edit/[...slug]/ChannelEditor.tsx (507 lines)

## Delta vs previous 2026-04-16 snapshot

- Total files: 183 → 185 (+2)
- <=50 bucket: 67 → 66 (-1)
- 51-150 bucket: 80 → 82 (+2)
- 151-300 bucket: 30 → 31 (+1)
- 301-500 bucket: 5 → 5 (unchanged)
- 501-1000 bucket: 1 → 1 (unchanged)
- New test files (oauth/register, oauth/token, mcp-auth) likely account for the +2 net new files landing in 51-150 / 151-300
- ChannelEditor.tsx remains the only over-500 file at 507 lines — cap violations unchanged
