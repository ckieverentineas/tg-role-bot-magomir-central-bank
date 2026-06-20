export function toMoneyNumber(value: { toNumber(): number } | number): number {
  return typeof value === "number" ? value : value.toNumber();
}

export function multiplyMoney(amount: { toNumber(): number } | number, quantity: number): number {
  return toMoneyNumber(amount) * quantity;
}
