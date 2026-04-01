alter table public.locations
  add column if not exists local_insights_title text,
  add column if not exists local_insights_body text,
  add column if not exists faq_items jsonb not null default '[]'::jsonb;

update public.locations
set hero_image = coalesce(nullif(trim(hero_image), ''), '/assets/img/bath/bath-location-hero.jpg'),
    hero_image_alt = coalesce(nullif(trim(hero_image_alt), ''), name || ' private schools'),
    hero_subtitle = coalesce(nullif(trim(hero_subtitle), ''), name || ' and surrounding areas')
where is_live = true;
