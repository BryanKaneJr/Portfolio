-- Glows become animated scenes (owner, 2026-10-07: "what we have is boring", Matrix
-- code rain as one of them). Ids stay; the names follow the new looks. Three new
-- glows join the chests (owner: "they all sound more premium").
update public.cosmetic_items set name = 'Fireflies' where id = 'ring.plum';
update public.cosmetic_items set name = 'Ripple' where id = 'ring.silver';
update public.cosmetic_items set name = 'Bubbles' where id = 'ring.ocean';
update public.cosmetic_items set name = 'Sunburst' where id = 'ring.gold';
update public.cosmetic_items set name = 'Embers' where id = 'ring.flame';
update public.cosmetic_items set name = 'Code Rain' where id = 'ring.prism';
insert into public.cosmetic_items (id, kind, tier, name) values
  ('ring.equations', 'ring', 'epic', 'Equations'),
  ('ring.constellation', 'ring', 'epic', 'Constellation'),
  ('ring.neural', 'ring', 'legendary', 'Neural Net'),
  ('ring.music', 'ring', 'legendary', 'Sheet Music');
