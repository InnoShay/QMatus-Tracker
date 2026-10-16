-- Dark is QMatus's main theme (DECISIONS D-028). New profiles start in dark;
-- anyone can still choose light or system in Settings. Existing rows keep
-- whatever they have.
alter table public.profiles alter column theme set default 'dark';
