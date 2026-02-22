export function validateRisk({ lot }) {
  const MAX_LOT = Number(process.env.MAX_LOT || 2);
  if (lot > MAX_LOT) throw new Error('Lot exceeds risk');
}
