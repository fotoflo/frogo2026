-- Add an explicit ordering column to channels so admins can set channel
-- numbers (which drive 1–9 keyboard shortcuts + the TV channel index).
-- Nulls sort last so legacy/new channels still appear even before being ordered.

alter table channels
  add column if not exists position int;

-- Seed existing channels with positions in current alphabetical order so
-- behavior is unchanged until the admin reorders them.
with ordered as (
  select id, row_number() over (order by name) as rn
  from channels
  where position is null
)
update channels c
set position = o.rn
from ordered o
where c.id = o.id;

create index if not exists channels_position_idx on channels (position);
