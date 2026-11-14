export function reserveOne(stock: number): number {
  if (!Number.isInteger(stock) || stock < 0)
    throw new Error('Stock must be a non-negative integer');
  return Math.max(0, stock - 1);
}
