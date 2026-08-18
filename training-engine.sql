-- GhostFit — Training Engine migration
--
-- OPTIONAL. The program engine works without this: training preferences and
-- the mesocycle clock live in localStorage, and plan metadata rides inside the
-- existing `workout_plans.days` jsonb column.
--
-- Running this adds cross-device sync for the periodization clock, so signing
-- in on a new phone resumes week 3 of your block instead of restarting at
-- week 1. Safe to run more than once.

alter table profiles
  add column if not exists training_state jsonb;

comment on column profiles.training_state is
  'Program engine state: experience, trainingDays, sessionMinutes, programWeek, weekStartedAt, phaseOverride, layoff prompt bookkeeping.';
