import type { Reservation, VisibilityPrefs } from './types';

/** Tutte le case trovate nel CSV, ordinate per numero di prenotazioni (desc) */
export function getAllLocals(reservations: Reservation[]): string[] {
  const counts: Record<string, number> = {};
  for (const r of reservations) {
    const l = (r.local_name ?? '').trim();
    if (!l) continue;
    counts[l] = (counts[l] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([l]) => l);
}

/** Tutti gli anni trovati, ordinati crescenti */
export function getAllYears(reservations: Reservation[]): number[] {
  const s = new Set<number>();
  for (const r of reservations) {
    if (r.year) s.add(r.year);
  }
  return [...s].sort();
}

/** Case effettivamente da mostrare nell'UI secondo preferenze utente */
export function getVisibleLocals(reservations: Reservation[], vis: VisibilityPrefs): string[] {
  const all = getAllLocals(reservations);
  // Se visible_locals è settato esplicitamente, usalo (filtrato a quelli esistenti)
  if (vis.visible_locals && vis.visible_locals.length > 0) {
    return vis.visible_locals.filter((l) => all.includes(l));
  }
  // Altrimenti tutti tranne quelli hidden
  return all.filter((l) => !vis.hidden_locals.includes(l));
}

/** Anni da mostrare nell'UI */
export function getVisibleYears(reservations: Reservation[], vis: VisibilityPrefs): number[] {
  const all = getAllYears(reservations);
  if (vis.visible_years && vis.visible_years.length > 0) {
    return vis.visible_years.filter((y) => all.includes(y));
  }
  return all.filter((y) => !vis.hidden_years.includes(y));
}

/** Filtra le reservations in base alle preferenze di visibilità */
export function filterReservationsByVisibility(
  reservations: Reservation[],
  vis: VisibilityPrefs,
): Reservation[] {
  const locals = getVisibleLocals(reservations, vis);
  const years = getVisibleYears(reservations, vis);
  const localsSet = new Set(locals);
  const yearsSet = new Set(years);
  return reservations.filter(
    (r) => localsSet.has(r.local_name) && (r.year ? yearsSet.has(r.year) : true)
  );
}
