-- GhostFit — Training Engine migration
--
-- OPTIONAL but recommended. Everything works without it: training preferences
-- and the mesocycle clock live in localStorage, plan metadata rides inside the
-- existing `workout_plans.days` jsonb column, and the ghost falls back to
-- resolving lift identity from the exercise name.
--
-- Safe to run more than once.

-- 1. Cross-device sync for the periodization clock. Without this, signing in on
--    a new phone restarts at week 1 instead of resuming week 3 of your block.
alter table profiles
  add column if not exists training_state jsonb;

comment on column profiles.training_state is
  'Program engine state: experience, trainingDays, trainingDayIndices, sessionMinutes, programWeek, weekStartedAt, phaseOverride, layoff prompt bookkeeping.';

-- 2. Stable lift identity on logged sessions.
--
--    The mesocycle deliberately rotates variations between blocks — Barbell
--    Bench Press becomes Dumbbell Bench Press — and the exercise *name* changes
--    with it. Storing the library id and movement pattern lets the adaptive
--    ghost keep its history on the same lift and carry momentum across
--    variations of the same pattern.
--
--    Without these columns the app infers both from the exercise name at read
--    time, which works but is less precise for custom exercises.
alter table ghost_sessions
  add column if not exists library_id text,
  add column if not exists movement_pattern text;

comment on column ghost_sessions.library_id is
  'Exercise library id. Survives variation rotation, unlike exercise_name.';
comment on column ghost_sessions.movement_pattern is
  'Movement pattern (horizontal_push, hinge, squat, ...). Lets the ghost carry momentum across variations.';

-- Indexes for the identity lookups the ghost performs on every exercise open.
create index if not exists ghost_sessions_user_library_idx
  on ghost_sessions (user_id, library_id, date desc);
create index if not exists ghost_sessions_user_pattern_idx
  on ghost_sessions (user_id, movement_pattern, date desc);

-- 3. Backfill: stamp identity onto history logged before these columns existed.
--    Name matching covers the library's canonical names; anything unmatched is
--    left null and resolved from the name at read time as before.
update ghost_sessions set library_id = 'bb-bench-press',       movement_pattern = 'horizontal_push' where library_id is null and lower(exercise_name) = 'barbell bench press';
update ghost_sessions set library_id = 'db-bench-press',       movement_pattern = 'horizontal_push' where library_id is null and lower(exercise_name) = 'dumbbell bench press';
update ghost_sessions set library_id = 'pushup',               movement_pattern = 'horizontal_push' where library_id is null and lower(exercise_name) in ('push-up', 'pushup', 'pushups', 'push ups');
update ghost_sessions set library_id = 'bb-overhead-press',    movement_pattern = 'vertical_push'   where library_id is null and lower(exercise_name) = 'barbell overhead press';
update ghost_sessions set library_id = 'db-shoulder-press',    movement_pattern = 'vertical_push'   where library_id is null and lower(exercise_name) in ('dumbbell shoulder press', 'shoulder press');
update ghost_sessions set library_id = 'pullup',               movement_pattern = 'vertical_pull'   where library_id is null and lower(exercise_name) in ('pull-up', 'pullup', 'pullups', 'pull ups');
update ghost_sessions set library_id = 'chinup',               movement_pattern = 'vertical_pull'   where library_id is null and lower(exercise_name) in ('chin-up', 'chinup', 'chinups');
update ghost_sessions set library_id = 'cable-lat-pulldown',   movement_pattern = 'vertical_pull'   where library_id is null and lower(exercise_name) in ('lat pulldown', 'lat pulldowns');
update ghost_sessions set library_id = 'bb-bent-row',          movement_pattern = 'horizontal_pull' where library_id is null and lower(exercise_name) = 'barbell bent-over row';
update ghost_sessions set library_id = 'db-row',               movement_pattern = 'horizontal_pull' where library_id is null and lower(exercise_name) in ('dumbbell row', 'db row');
update ghost_sessions set library_id = 'bb-back-squat',        movement_pattern = 'squat'           where library_id is null and lower(exercise_name) = 'barbell back squat';
update ghost_sessions set library_id = 'goblet-squat',         movement_pattern = 'squat'           where library_id is null and lower(exercise_name) = 'goblet squat';
update ghost_sessions set library_id = 'bodyweight-squat',     movement_pattern = 'squat'           where library_id is null and lower(exercise_name) in ('bodyweight squat', 'squats', 'squat');
update ghost_sessions set library_id = 'bb-deadlift',          movement_pattern = 'hinge'           where library_id is null and lower(exercise_name) in ('barbell deadlift', 'deadlift');
update ghost_sessions set library_id = 'bb-rdl',               movement_pattern = 'hinge'           where library_id is null and lower(exercise_name) = 'barbell romanian deadlift';
update ghost_sessions set library_id = 'db-rdl',               movement_pattern = 'hinge'           where library_id is null and lower(exercise_name) = 'dumbbell romanian deadlift';
update ghost_sessions set library_id = 'reverse-lunge',        movement_pattern = 'lunge'           where library_id is null and lower(exercise_name) in ('reverse lunge', 'lunge', 'lunges');
update ghost_sessions set library_id = 'db-curl',              movement_pattern = 'isolation_arm'   where library_id is null and lower(exercise_name) in ('dumbbell curl', 'bicep curls', 'bicep curl');
update ghost_sessions set library_id = 'cable-pushdown',       movement_pattern = 'isolation_arm'   where library_id is null and lower(exercise_name) in ('triceps pushdown', 'tricep pulldowns');
update ghost_sessions set library_id = 'plank',                movement_pattern = 'core_anti_extension' where library_id is null and lower(exercise_name) = 'plank';
update ghost_sessions set library_id = 'treadmill-intervals',  movement_pattern = 'conditioning'    where library_id is null and lower(exercise_name) in ('treadmill intervals', 'treadmill (run)', 'treadmill run');
update ghost_sessions set library_id = 'rower-steady',         movement_pattern = 'conditioning'    where library_id is null and lower(exercise_name) in ('rowing machine', 'rowing machine steady state');
update ghost_sessions set library_id = 'spin-intervals',       movement_pattern = 'conditioning'    where library_id is null and lower(exercise_name) in ('spin bike', 'spin bike intervals');
