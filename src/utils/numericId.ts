/** Random positive integer that fits both PostgreSQL bigint and JavaScript's safe range. */
export function numericId(): number {
  const words = crypto.getRandomValues(new Uint32Array(2));
  return (words[0] & 0x1fffff) * 0x100000000 + words[1] || 1;
}
