// Prisma Decimal (atau angka biasa) -> number; null/undefined -> 0.
export const toNumber = (value: unknown): number =>
  typeof value === "object" && value !== null && "toNumber" in value
    ? (value as { toNumber(): number }).toNumber()
    : Number(value ?? 0);

const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Contoh: 150000 -> "Rp 150.000". NBSP dari Intl diganti spasi biasa agar aman dibandingkan di frontend.
export const formatRupiah = (value: number | { toString(): string }) =>
  rupiah.format(Number(value)).replace(/ /g, " ");
