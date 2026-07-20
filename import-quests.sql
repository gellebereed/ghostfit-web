-- ─────────────────────────────────────────────────────────────────────────────
-- GhostFit: one-time import of your Notion Workshop goals & open tasks
-- Run AFTER setup.sql section 10 (quests tables), in the Supabase SQL editor.
-- Safe to run once; running twice would duplicate quests.
--
-- Imported from Notion on 2026-07-21:
--   🎯 Goals  — all goals with status Active (or unset)
--   ✅ Tasks  — open tasks that are real work (Notion-system upkeep tasks like
--               "set up recurring templates" / "fill check-in row" were skipped,
--               since GhostFit Quests replaces that system)
-- Past due-dates were reset to today so they surface in the Today view.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_user uuid;
  q_elite uuid;
  q_umrah uuid;
  q_masters uuid;
  q_tech uuid;
  q_retail_q uuid;
  q_retail_m uuid;
  q_deen uuid;
begin
  select id into v_user from auth.users where email = 'ahgbered10@gmail.com';
  if v_user is null then
    raise exception 'User ahgbered10@gmail.com not found in auth.users';
  end if;

  -- ── Yearly North Stars ──
  insert into quests (user_id, title, why, quest_type, status, target_date)
  values (v_user, 'Reposition Elite Kitchen post-franchise',
          'The ''stuck in the middle'' problem is bleeding margin every month it''s unresolved. Decision delay = decision made by default.',
          'north_star', 'active', '2026-12-31')
  returning id into q_elite;

  insert into quests (user_id, title, why, quest_type, status, target_date)
  values (v_user, 'Perform Umrah with my family', null, 'north_star', 'active', '2026-12-31')
  returning id into q_umrah;

  insert into quests (user_id, title, why, quest_type, status, target_date)
  values (v_user, 'Finish my Masters degree',
          'Closes the academic chapter, unlocks senior data roles, validates the LLM x telecom intersection as a credible niche.',
          'north_star', 'active', '2026-09-30')
  returning id into q_masters;

  insert into quests (user_id, title, why, quest_type, status, target_date)
  values (v_user, 'Launch a tech business',
          'Launch a successful tech business that has an MRR of $10k',
          'north_star', 'active', '2026-12-31')
  returning id into q_tech;

  -- ── Quarterly Theme ──
  insert into quests (user_id, parent_id, title, why, quest_type, status, target_date)
  values (v_user, q_tech, 'RetailGPT: dynamic AI SQL pipeline live in the main cockpit',
          'The cockpit only answers one query type (revenue_by_period) live. Every other analytics question is mocked. This is the gap between demo and real product — and the biggest lever on hitting $10k MRR.',
          'quarterly', 'active', '2026-09-30')
  returning id into q_retail_q;

  -- ── Monthly Milestones ──
  insert into quests (user_id, parent_id, title, why, quest_type, status, target_date)
  values (v_user, q_retail_q, 'Launch RetailGPT',
          'The month''s target: get RetailGPT live. The real gate: SQL Lab passes evaluation, the Answer formatter bridges it to the cockpit, then dynamic SQL connects to /api/ask. Working on it almost daily with cofounder.',
          'monthly', 'active', '2026-07-31')
  returning id into q_retail_m;

  insert into quests (user_id, title, why, quest_type, status, target_date)
  values (v_user, 'Deen & Body — daily rhythm',
          'Fajr on time, stay at the mosque till Ishraq, Surah Al-Baqarah daily, at least 1 juz or hizb of Qur''an, Sabah wal Masa adhkar, 10 min of Salawat and dhikr. Plus a minimum 1hr walk every day — lose weight and burn belly fat.',
          'monthly', 'active', '2026-07-31')
  returning id into q_deen;

  -- ── Open tasks (Launch RetailGPT) ──
  insert into quest_tasks (user_id, quest_id, title, note, priority, do_date, sort_order) values
    (v_user, q_retail_m, 'SQL Lab — run full safe/unsafe test batch (11 questions incl. drop tables, raw rows, phone numbers)',
     'Test at /inspector/sql-lab and /inspector/practice. Confirm tenant-scoped SQL, LIMIT<=100, server-resolved params, unsafe questions blocked before execution.',
     1, current_date, 0),
    (v_user, q_retail_m, 'Scaffold evaluation runner — target 50-100 questions with expected resultMode/tables/blocked flags',
     'Without this, every future AI/code change can silently break prior behavior.',
     1, current_date, 1),
    (v_user, q_retail_m, 'Cofounder session — RetailGPT (SQL Lab eval / formatter)',
     'Continue wherever the SQL Lab eval batch / evaluation runner scaffold left off.',
     1, current_date, 2),
    (v_user, q_retail_m, 'Draft SQL result → cockpit Answer payload formatter (headline, metric, insights, chart, rows, steps)',
     'This is the bridge from SQL Lab to the real product. Do not start until the P1 tasks pass.',
     2, current_date + 1, 3);

  -- ── Open tasks (other quests) ──
  insert into quest_tasks (user_id, quest_id, title, note, priority, do_date, sort_order) values
    (v_user, q_elite, 'Talk to Abdikafi about the customer incident', null, 1, current_date, 0),
    (v_user, q_tech, 'Pick one AI prediction for a 90-minute validation spike',
     'Default candidate: Vibe-Code QA Layer (high confidence, build difficulty 2). Define buyer, pain, and smallest demo before coding.',
     2, current_date + 2, 0);

  raise notice 'Imported 7 quests and 6 tasks for %', v_user;
end $$;
