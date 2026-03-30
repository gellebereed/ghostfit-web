// Equipment icon SVG paths for dark-themed equipment cards
// Each maps to an inline SVG viewBox="0 0 24 24"

export const EQUIPMENT_ICONS: Record<string, string> = {
  'Dumbbells': 'M6.5 11h11M4 9v6m16-6v6M2 10v4m20-4v4M9 8v8m6-8v8',
  'Barbell': 'M3 12h18M5 8v8m14-8v8M7 10v4m10-4v4',
  'Pull-up Bar': 'M2 6h20M5 6v4M19 6v4M8 10v6m8-6v6M12 10v8',
  'Bench': 'M4 16h16M6 12h12M6 8h12M8 8v4m8-4v4M4 16v2m16-2v2',
  'Resistance Bands': 'M4 6c4 6 4 12 8 12s4-6 8-12M4 6c4-2 12-2 16 0',
  'Kettlebell': 'M8 7a4 4 0 0 1 8 0M10 7v2m4-2v2M8 12a4 4 0 0 0 8 0M8 12v4a4 4 0 0 0 8 0v-4',
  'Cable Machine': 'M4 4v16m16-16v16M4 8h4m8 0h4M8 8v8M16 8v8M8 12h8',
  'Treadmill': 'M3 18h18M5 14l14-6M5 14v4m14-10v10M9 12v6m6-8v8',
  'Rowing Machine': 'M2 16h20M4 12h8l6 4M6 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4',
  'Leg Press': 'M4 18h16M6 10l6 8M18 10l-6 8M6 10h12M8 6h8',
  'Smith Machine': 'M6 4v16m12-16v16M6 10h12M9 10v4m6-4v4',
  'EZ Curl Bar': 'M2 12c2-2 4 2 6 0s4 2 6 0 4 2 6 0 4 2 6 0',
  'Jump Rope': 'M8 4c-4 0-4 6 0 6s4 6 0 6M16 4c4 0 4 6 0 6s-4 6 0 6',
  'Yoga Mat': 'M4 16h16v2H4zM6 12l2 4m8-4-2 4M4 12h16M8 8h8',
  'Medicine Ball': 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 4v16M4 12h16',
  'Bodyweight Only': 'M12 4a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM12 8v5m-3 0h6M9 13v5m6-5v5M9 18l-1 2m8-2 1 2',
  'Spin Bike': 'M5 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 17a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM5 14h14M12 7l-4 7M12 7h3',
};

export const ALL_EQUIPMENT = [
  'Dumbbells', 'Barbell', 'Pull-up Bar', 'Bench', 'Resistance Bands',
  'Kettlebell', 'Cable Machine', 'Treadmill', 'Rowing Machine', 'Leg Press',
  'Smith Machine', 'EZ Curl Bar', 'Jump Rope', 'Yoga Mat', 'Medicine Ball',
  'Bodyweight Only', 'Spin Bike'
];
