// Daily totals built from the matched and not-yet-scanned lists, so both database modes share the same logic.
export function summarize(matchedRows, pendingRows) {
  const byWard = new Map();
  const byUser = new Map();
  const ward = (name) => {
    const key = name || 'ไม่ระบุหอผู้ป่วย';
    if (!byWard.has(key)) byWard.set(key, { ward: key, matched: 0, pending: 0 });
    return byWard.get(key);
  };
  for (const r of matchedRows) {
    ward(r.wardName).matched++;
    const user = r.matchedBy || 'ไม่ระบุ';
    byUser.set(user, (byUser.get(user) ?? 0) + 1);
  }
  for (const r of pendingRows) ward(r.wardName).pending++;

  return {
    matched: matchedRows.length,
    pending: pendingRows.length,
    total: matchedRows.length + pendingRows.length,
    byWard: [...byWard.values()].sort((a, b) => b.matched + b.pending - (a.matched + a.pending)),
    byUser: [...byUser].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count),
  };
}
