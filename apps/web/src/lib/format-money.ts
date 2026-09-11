const malotiNumber = new Intl.NumberFormat("en-LS", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatMaloti(value: string | number): string {
  return `M${malotiNumber.format(Number(value))}`;
}
