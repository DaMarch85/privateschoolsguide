-- Corrected safe patch for school attributes: urn, age_min, age_max, day_boarding, pupil_numbers
-- Your public.schools table has a UNIQUE constraint on urn.
-- Some prep/junior rows in GIAS share a parent school's URN, so those URNs must be skipped.
--
-- This version:
--   * fills missing values only
--   * matches by slug
--   * skips any URN duplicated inside this patch
--   * skips any URN already used by a different row in public.schools
--   * still applies age/day/pupil updates normally
--
-- If the earlier query failed with a duplicate-URN error, that failed UPDATE statement did not apply its changes.

with patch(slug, urn, age_min, age_max, day_boarding, pupil_numbers) as (
  values
    ('appleford-school', 126535, NULL, NULL, NULL, NULL),
    ('ardingly-college', NULL, NULL, NULL, NULL, 1048),
    ('avondale-preparatory-school', 126523, NULL, NULL, NULL, NULL),
    ('ballard-school', 116524, NULL, NULL, NULL, 475),
    ('bedales-pre-prep', 116527, NULL, NULL, NULL, NULL),
    ('bedales-prep-school', 116527, NULL, NULL, NULL, NULL),
    ('bedales-school', NULL, NULL, NULL, NULL, 768),
    ('boundary-oak-school', 116558, NULL, NULL, NULL, 484),
    ('bournemouth-collegiate-school', 113937, NULL, NULL, NULL, 385),
    ('bower-lodge-school', 150911, NULL, NULL, NULL, 13),
    ('brambletye-school', 126150, NULL, NULL, NULL, 309),
    ('brighton-college-prep-handcross', 126143, NULL, NULL, NULL, 431),
    ('brockwood-park-school-and-inwoods-small-school', NULL, NULL, NULL, NULL, 79),
    ('brunel-college', 144514, NULL, NULL, NULL, NULL),
    ('bryanston-school', NULL, NULL, NULL, NULL, 778),
    ('burgess-hill-girls', NULL, NULL, NULL, NULL, 474),
    ('canford-school', 113922, NULL, NULL, NULL, 646),
    ('castle-court-school', 113931, NULL, NULL, NULL, 259),
    ('chafyn-grove-school', 126517, NULL, NULL, NULL, NULL),
    ('charlton-house-independent-school', 116567, NULL, NULL, NULL, 44),
    ('christs-hospital-school', NULL, NULL, NULL, NULL, 846),
    ('churchers-college', NULL, NULL, NULL, NULL, 1332),
    ('clayesmore-school', NULL, NULL, NULL, NULL, 489),
    ('connie-rothman-school', NULL, NULL, NULL, NULL, 32),
    ('copthorne-prep-school', 125406, NULL, NULL, NULL, 161),
    ('cottesmore-school', 126106, NULL, NULL, NULL, 188),
    ('courtlands-independent-special-school', 149890, NULL, NULL, NULL, 23),
    ('cricklade-manor-prep-school', 126533, NULL, NULL, NULL, NULL),
    ('cumnor-house-sussex', 114623, NULL, NULL, NULL, 425),
    ('dibden-park-school', 149863, NULL, NULL, NULL, 38),
    ('ditcham-park-school', 116575, NULL, NULL, NULL, 415),
    ('dorset-house-school', 126109, NULL, NULL, NULL, 126),
    ('dumpton-school', 113923, NULL, NULL, NULL, 339),
    ('durlston-prep-and-senior-school', 116522, NULL, NULL, NULL, 254),
    ('embley', NULL, NULL, NULL, NULL, 688),
    ('emmaus-school', 131743, NULL, NULL, NULL, NULL),
    ('farleigh-school', 116542, NULL, NULL, NULL, 448),
    ('farlington-school', NULL, NULL, NULL, NULL, 411),
    ('farnborough-hill', NULL, NULL, NULL, NULL, 502),
    ('forres-sandle-manor', 116519, NULL, NULL, NULL, 199),
    ('great-ballard', 126130, NULL, NULL, NULL, 242),
    ('great-walstead', 126135, NULL, NULL, NULL, 299),
    ('hambrook-school', 149912, 5, 18, 'Day', 50),
    ('hanford-school', 113911, NULL, NULL, NULL, 69),
    ('heywood-prep', 126524, NULL, NULL, NULL, NULL),
    ('highfield-and-brookham-school', 126151, NULL, NULL, NULL, 448),
    ('hove-micro-school', 150990, NULL, NULL, NULL, 12),
    ('hurst-lodge-school', 110150, NULL, NULL, NULL, 188),
    ('hurstpierpoint-college', NULL, NULL, NULL, NULL, 1317),
    ('hurstpierpoint-college-preparatory-school', 126136, NULL, NULL, NULL, NULL),
    ('jubilee-school', 135105, NULL, NULL, NULL, 47),
    ('king-edward-vi-preparatory-school', 116528, NULL, NULL, NULL, 276),
    ('king-edward-vi-school', NULL, NULL, NULL, NULL, 992),
    ('kingfisher-school', NULL, NULL, NULL, NULL, 2),
    ('kings-bournemouth', 138333, NULL, NULL, NULL, 74),
    ('lancing-college', NULL, NULL, NULL, NULL, 612),
    ('lancing-college-preparatory-school-worthing', 126114, NULL, NULL, NULL, 219),
    ('leehurst-swan-school', 126528, NULL, NULL, NULL, NULL),
    ('leweston-school', NULL, NULL, NULL, NULL, 576),
    ('lord-wandsworth-college', NULL, NULL, NULL, NULL, 706),
    ('luccombe-hub', NULL, NULL, NULL, NULL, 29),
    ('lumiar-stowford', 146654, NULL, NULL, NULL, NULL),
    ('lvs-hassocks', 135930, NULL, NULL, NULL, 88),
    ('manor-house-school', 131139, 5, 18, 'Day', 68),
    ('maranatha-christian-school', 126536, NULL, NULL, NULL, NULL),
    ('mayville-high-school', 116573, NULL, NULL, NULL, 458),
    ('meoncross-school', 116563, NULL, NULL, NULL, 295),
    ('milton-abbey-school', NULL, NULL, NULL, NULL, 218),
    ('moyles-court-school', 116559, NULL, NULL, NULL, 186),
    ('napier-school', 149858, NULL, NULL, NULL, 44),
    ('oakwood-prep-school', 126104, NULL, NULL, NULL, 308),
    ('oneschool-global-uk-salisbury-campus', 134460, NULL, NULL, NULL, NULL),
    ('our-lady-of-sion-school', NULL, NULL, NULL, NULL, 314),
    ('park-school-bournemouth', 113939, NULL, NULL, NULL, 349),
    ('pennthorpe-school', 126111, NULL, NULL, NULL, 253),
    ('pinewood-school', 123301, NULL, NULL, NULL, NULL),
    ('port-regis', 113915, NULL, NULL, NULL, 317),
    ('portsmouth-high-school-gdst', NULL, NULL, NULL, NULL, 463),
    ('princes-mead-school', 116552, NULL, NULL, NULL, 290),
    ('rookwood-school', NULL, NULL, NULL, NULL, 269),
    ('salesian-college', NULL, NULL, NULL, NULL, 566),
    ('salisbury-cathedral-school', 126518, NULL, NULL, NULL, NULL),
    ('sandroyd-school', 126521, NULL, NULL, NULL, NULL),
    ('seaford-college', NULL, NULL, NULL, NULL, 962),
    ('sherborne-girls', NULL, NULL, NULL, NULL, 466),
    ('sherborne-house-school', 116514, NULL, NULL, NULL, 295),
    ('sherborne-preparatory-school', 113917, NULL, NULL, NULL, 198),
    ('sherborne-school', NULL, NULL, NULL, NULL, 573),
    ('sherfield-school', NULL, NULL, NULL, NULL, 547),
    ('shoreham-college', 126112, NULL, NULL, NULL, 352),
    ('slindon-college', 126119, NULL, NULL, NULL, 112),
    ('sompting-abbotts-school', 126121, NULL, NULL, NULL, 106),
    ('st-francis-school', 126526, NULL, NULL, NULL, NULL),
    ('st-margarets-preparatory-school', 126513, NULL, NULL, NULL, NULL),
    ('st-martins-school', 113940, NULL, NULL, NULL, 78),
    ('st-neots-preparatory-school', 116516, NULL, NULL, NULL, 339),
    ('st-nicholas-school-fleet', 116518, NULL, NULL, NULL, 320),
    ('st-swithuns-prep-school', 116534, NULL, NULL, NULL, NULL),
    ('st-swithuns-school', NULL, NULL, NULL, NULL, 715),
    ('sunninghill-prep-school', 113927, NULL, NULL, NULL, 171),
    ('talbot-heath-school', 113945, NULL, NULL, NULL, 499),
    ('the-gregg-preparatory-school', 116569, NULL, NULL, NULL, 71),
    ('the-gregg-school', 116568, NULL, NULL, NULL, 343),
    ('the-kings-school-eastleigh', 116595, NULL, NULL, NULL, 236),
    ('the-lion-works-school', NULL, NULL, NULL, NULL, 42),
    ('the-new-forest-small-school', 136112, NULL, NULL, NULL, 65),
    ('the-pilgrims-school', 116535, NULL, NULL, NULL, 229),
    ('the-portsmouth-grammar-school', NULL, NULL, NULL, NULL, 1142),
    ('the-prebendal-school', 126122, NULL, NULL, NULL, 138),
    ('the-rikkyo-school-in-england', 126132, NULL, NULL, NULL, 190),
    ('the-stable-school', 147198, NULL, NULL, NULL, 58),
    ('the-white-house-school', 149536, NULL, NULL, NULL, 39),
    ('twyford-school', 116536, NULL, NULL, NULL, 422),
    ('walhampton-school', 116525, NULL, NULL, NULL, 344),
    ('wellesley-prep-school', 116550, NULL, NULL, NULL, 289),
    ('west-hill-park', 116551, NULL, NULL, NULL, 201),
    ('westbourne-house', 126105, NULL, NULL, NULL, 343),
    ('winchester-college', NULL, NULL, NULL, NULL, 734),
    ('windlesham-house-school', 126113, NULL, NULL, NULL, 315),
    ('worth-school', NULL, NULL, NULL, NULL, 655),
    ('yarrells-school-and-nursery', 113914, NULL, NULL, NULL, 258),
    ('yarrow-heights-school', 148599, NULL, NULL, NULL, 130),
    ('yateley-manor-school', 116553, NULL, NULL, NULL, 245)
),
patch_urn_duplicates as (
  select urn
  from patch
  where urn is not null
  group by urn
  having count(*) > 1
),
validated_patch as (
  select
    p.slug,
    case
      when p.urn is null then null
      when exists (
        select 1
        from patch_urn_duplicates d
        where d.urn = p.urn
      ) then null
      when exists (
        select 1
        from public.schools s2
        where s2.urn = p.urn
          and s2.slug <> p.slug
      ) then null
      else p.urn
    end as safe_urn,
    p.age_min,
    p.age_max,
    p.day_boarding,
    p.pupil_numbers
  from patch p
)
update public.schools s
set
  urn = case when s.urn is null and vp.safe_urn is not null then vp.safe_urn else s.urn end,
  age_min = case when s.age_min is null and vp.age_min is not null then vp.age_min else s.age_min end,
  age_max = case when s.age_max is null and vp.age_max is not null then vp.age_max else s.age_max end,
  day_boarding = case when (s.day_boarding is null or btrim(s.day_boarding) = '') and vp.day_boarding is not null then vp.day_boarding else s.day_boarding end,
  pupil_numbers = case when s.pupil_numbers is null and vp.pupil_numbers is not null then vp.pupil_numbers else s.pupil_numbers end,
  updated_at = now()
from validated_patch vp
where s.slug = vp.slug
  and (
    (s.urn is null and vp.safe_urn is not null)
    or (s.age_min is null and vp.age_min is not null)
    or (s.age_max is null and vp.age_max is not null)
    or ((s.day_boarding is null or btrim(s.day_boarding) = '') and vp.day_boarding is not null)
    or (s.pupil_numbers is null and vp.pupil_numbers is not null)
  );

-- URN rows deliberately skipped because they would violate the unique-URN rule
with patch(slug, urn) as (
  values
    ('appleford-school', 126535),
    ('ardingly-college', NULL),
    ('avondale-preparatory-school', 126523),
    ('ballard-school', 116524),
    ('bedales-pre-prep', 116527),
    ('bedales-prep-school', 116527),
    ('bedales-school', NULL),
    ('boundary-oak-school', 116558),
    ('bournemouth-collegiate-school', 113937),
    ('bower-lodge-school', 150911),
    ('brambletye-school', 126150),
    ('brighton-college-prep-handcross', 126143),
    ('brockwood-park-school-and-inwoods-small-school', NULL),
    ('brunel-college', 144514),
    ('bryanston-school', NULL),
    ('burgess-hill-girls', NULL),
    ('canford-school', 113922),
    ('castle-court-school', 113931),
    ('chafyn-grove-school', 126517),
    ('charlton-house-independent-school', 116567),
    ('christs-hospital-school', NULL),
    ('churchers-college', NULL),
    ('clayesmore-school', NULL),
    ('connie-rothman-school', NULL),
    ('copthorne-prep-school', 125406),
    ('cottesmore-school', 126106),
    ('courtlands-independent-special-school', 149890),
    ('cricklade-manor-prep-school', 126533),
    ('cumnor-house-sussex', 114623),
    ('dibden-park-school', 149863),
    ('ditcham-park-school', 116575),
    ('dorset-house-school', 126109),
    ('dumpton-school', 113923),
    ('durlston-prep-and-senior-school', 116522),
    ('embley', NULL),
    ('emmaus-school', 131743),
    ('farleigh-school', 116542),
    ('farlington-school', NULL),
    ('farnborough-hill', NULL),
    ('forres-sandle-manor', 116519),
    ('great-ballard', 126130),
    ('great-walstead', 126135),
    ('hambrook-school', 149912),
    ('hanford-school', 113911),
    ('heywood-prep', 126524),
    ('highfield-and-brookham-school', 126151),
    ('hove-micro-school', 150990),
    ('hurst-lodge-school', 110150),
    ('hurstpierpoint-college', NULL),
    ('hurstpierpoint-college-preparatory-school', 126136),
    ('jubilee-school', 135105),
    ('king-edward-vi-preparatory-school', 116528),
    ('king-edward-vi-school', NULL),
    ('kingfisher-school', NULL),
    ('kings-bournemouth', 138333),
    ('lancing-college', NULL),
    ('lancing-college-preparatory-school-worthing', 126114),
    ('leehurst-swan-school', 126528),
    ('leweston-school', NULL),
    ('lord-wandsworth-college', NULL),
    ('luccombe-hub', NULL),
    ('lumiar-stowford', 146654),
    ('lvs-hassocks', 135930),
    ('manor-house-school', 131139),
    ('maranatha-christian-school', 126536),
    ('mayville-high-school', 116573),
    ('meoncross-school', 116563),
    ('milton-abbey-school', NULL),
    ('moyles-court-school', 116559),
    ('napier-school', 149858),
    ('oakwood-prep-school', 126104),
    ('oneschool-global-uk-salisbury-campus', 134460),
    ('our-lady-of-sion-school', NULL),
    ('park-school-bournemouth', 113939),
    ('pennthorpe-school', 126111),
    ('pinewood-school', 123301),
    ('port-regis', 113915),
    ('portsmouth-high-school-gdst', NULL),
    ('princes-mead-school', 116552),
    ('rookwood-school', NULL),
    ('salesian-college', NULL),
    ('salisbury-cathedral-school', 126518),
    ('sandroyd-school', 126521),
    ('seaford-college', NULL),
    ('sherborne-girls', NULL),
    ('sherborne-house-school', 116514),
    ('sherborne-preparatory-school', 113917),
    ('sherborne-school', NULL),
    ('sherfield-school', NULL),
    ('shoreham-college', 126112),
    ('slindon-college', 126119),
    ('sompting-abbotts-school', 126121),
    ('st-francis-school', 126526),
    ('st-margarets-preparatory-school', 126513),
    ('st-martins-school', 113940),
    ('st-neots-preparatory-school', 116516),
    ('st-nicholas-school-fleet', 116518),
    ('st-swithuns-prep-school', 116534),
    ('st-swithuns-school', NULL),
    ('sunninghill-prep-school', 113927),
    ('talbot-heath-school', 113945),
    ('the-gregg-preparatory-school', 116569),
    ('the-gregg-school', 116568),
    ('the-kings-school-eastleigh', 116595),
    ('the-lion-works-school', NULL),
    ('the-new-forest-small-school', 136112),
    ('the-pilgrims-school', 116535),
    ('the-portsmouth-grammar-school', NULL),
    ('the-prebendal-school', 126122),
    ('the-rikkyo-school-in-england', 126132),
    ('the-stable-school', 147198),
    ('the-white-house-school', 149536),
    ('twyford-school', 116536),
    ('walhampton-school', 116525),
    ('wellesley-prep-school', 116550),
    ('west-hill-park', 116551),
    ('westbourne-house', 126105),
    ('winchester-college', NULL),
    ('windlesham-house-school', 126113),
    ('worth-school', NULL),
    ('yarrells-school-and-nursery', 113914),
    ('yarrow-heights-school', 148599),
    ('yateley-manor-school', 116553)
),
patch_urn_duplicates as (
  select urn
  from patch
  where urn is not null
  group by urn
  having count(*) > 1
)
select
  p.slug,
  p.urn,
  case
    when exists (select 1 from patch_urn_duplicates d where d.urn = p.urn) then 'duplicate within patch'
    when exists (select 1 from public.schools s2 where s2.urn = p.urn and s2.slug <> p.slug) then 'already used by another school'
  end as skip_reason
from patch p
where p.urn is not null
  and (
    exists (select 1 from patch_urn_duplicates d where d.urn = p.urn)
    or exists (select 1 from public.schools s2 where s2.urn = p.urn and s2.slug <> p.slug)
  )
order by p.urn, p.slug;

-- Audit query
select
  count(*) filter (where urn is null) as missing_urn,
  count(*) filter (where age_min is null) as missing_age_min,
  count(*) filter (where age_max is null) as missing_age_max,
  count(*) filter (where day_boarding is null or btrim(day_boarding) = '') as missing_day_boarding,
  count(*) filter (where pupil_numbers is null) as missing_pupil_numbers
from public.schools;

-- Rows still missing after this corrected patch
select id, name, slug, provision_category, urn, age_min, age_max, day_boarding, pupil_numbers
from public.schools
where urn is null
   or age_min is null
   or age_max is null
   or day_boarding is null or btrim(day_boarding) = ''
   or pupil_numbers is null
order by slug;
