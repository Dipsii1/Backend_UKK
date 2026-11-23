const rupiah = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

// Contoh: 150000 -> "Rp 150.000". NBSP dari Intl diganti spasi biasa agar aman dibandingkan di frontend.
export const formatRupiah = (value: number | { toString(): string }) =>
  rupiah.format(Number(value)).replace(/ /g, " ");
