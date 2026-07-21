'use client';
import BottomNav from '@/components/BottomNav';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { GroceryList, MealPlan } from '@/lib/types';
import { getCurrentMealPlan, getGroceryList, getNutritionProfile } from '@/lib/nutrition';

export default function GroceryPage() {
  const router = useRouter();
  const [plan, setPlan] = useState<MealPlan | null>(null);
  const [list, setList] = useState<GroceryList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mealPlan, np] = await Promise.all([getCurrentMealPlan(), getNutritionProfile()]);
      if (!mealPlan) { router.replace('/nutrition'); return; }
      setPlan(mealPlan);

      // Restore this plan's check-offs (device-local — it's a shopping trip)
      try {
        const saved = localStorage.getItem(`ghostfit_grocery_${mealPlan.id}`);
        if (saved) setChecked(new Set(JSON.parse(saved)));
      } catch { /* fresh list */ }

      setList(await getGroceryList(mealPlan, np?.countryName));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to build list');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      if (plan?.id) {
        localStorage.setItem(`ghostfit_grocery_${plan.id}`, JSON.stringify([...next]));
      }
      return next;
    });
  }

  const totalItems = list?.categories.reduce((a, c) => a + c.items.length, 0) ?? 0;
  const gathered = list?.categories.reduce(
    (a, c) => a + c.items.filter(i => checked.has(`${c.name}:${i.name}`)).length, 0
  ) ?? 0;
  const allDone = totalItems > 0 && gathered === totalItems;

  return (
    <>
      <header className="hdr">
        <Link href="/nutrition" className="hdr-back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
        </Link>
        <span className="hdr-logo">🛒 GROCERIES</span>
        <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>
          {list ? `${gathered}/${totalItems}` : ''}
        </span>
      </header>

      <div className="arena-body">
        {loading && (
          <div className="arena-empty" style={{ paddingTop: 60 }}>
            <div className="ghost-loader" style={{ fontSize: 44 }}>🛒</div>
            <h3>Building your list...</h3>
            <p>Adding up everything your week of meals needs — quantities merged and totaled.</p>
          </div>
        )}

        {error && (
          <div className="arena-empty" style={{ paddingTop: 60 }}>
            <div style={{ fontSize: 44 }}>😕</div>
            <h3>Couldn&apos;t build the list</h3>
            <p>{error}</p>
            <button className="btn-primary" style={{ marginTop: 16 }} onClick={load}>TRY AGAIN</button>
          </div>
        )}

        {list && !loading && (
          <>
            {/* Progress */}
            <div className="arena-card" style={{ padding: 14 }}>
              <div className="arena-race-row">
                <span className="arena-race-name you">GATHERED</span>
                <div className="arena-race-track">
                  <div className="arena-race-fill you" style={{ width: `${totalItems ? (gathered / totalItems) * 100 : 0}%` }} />
                </div>
                <span className="arena-race-score" style={{ fontSize: 13 }}>{gathered}/{totalItems}</span>
              </div>
              {allDone && (
                <p className="rhythm-alldone" style={{ color: 'var(--accent)' }}>
                  🛒 Fully stocked. The week is yours to win.
                </p>
              )}
            </div>

            {list.categories.map(cat => {
              const catDone = cat.items.every(i => checked.has(`${cat.name}:${i.name}`));
              return (
                <div key={cat.name} className={`grocery-cat ${catDone ? 'done' : ''}`}>
                  <h4 className="grocery-cat-title">{cat.emoji} {cat.name.toUpperCase()}
                    <span className="grocery-cat-count">
                      {cat.items.filter(i => checked.has(`${cat.name}:${i.name}`)).length}/{cat.items.length}
                    </span>
                  </h4>
                  {cat.items.map(item => {
                    const key = `${cat.name}:${item.name}`;
                    const isChecked = checked.has(key);
                    return (
                      <button key={key} className={`grocery-row ${isChecked ? 'checked' : ''}`} onClick={() => toggle(key)}>
                        <span className={`grocery-box ${isChecked ? 'checked' : ''}`}>{isChecked ? '✓' : ''}</span>
                        <span className="grocery-name">{item.name}</span>
                        <span className="grocery-qty">{item.quantity}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}

            <p className="arena-card-sub" style={{ textAlign: 'center' }}>
              Built from Week {plan?.weekNumber}&apos;s meals · updates automatically when you swap a meal
            </p>
          </>
        )}
      </div>

      <BottomNav active="fuel" />
    </>
  );
}
