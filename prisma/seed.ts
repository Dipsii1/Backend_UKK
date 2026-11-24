import "dotenv/config";
import bcrypt from "bcrypt";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const PASSWORD = "12345678";
const DAY = 24 * 60 * 60 * 1000;
const now = Date.now();
const at = (days: number, hours = 0) => new Date(now + days * DAY + hours * 60 * 60 * 1000);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const qrToken = () => randomBytes(32).toString("base64url");

async function main() {
  const password = await bcrypt.hash(PASSWORD, 10);

  // ── Master data ─────────────────────────────────────────────
  const [adminRole, organizerRole, buyerRole] = await Promise.all(
    ["admin", "organizer", "buyer"].map((name) => prisma.roles.create({ data: { name } })),
  );

  const indonesia = await prisma.countries.create({ data: { code: "ID", name: "Indonesia" } });
  const jakarta = await prisma.provinces.create({
    data: {
      country_id: indonesia.id,
      code: "31",
      name: "DKI Jakarta",
      cities: { create: [{ code: "3171", name: "Jakarta Selatan" }, { code: "3173", name: "Jakarta Pusat" }] },
    },
    include: { cities: true },
  });
  const jabar = await prisma.provinces.create({
    data: {
      country_id: indonesia.id,
      code: "32",
      name: "Jawa Barat",
      cities: { create: [{ code: "3273", name: "Bandung" }, { code: "3275", name: "Bekasi" }] },
    },
    include: { cities: true },
  });
  const jatim = await prisma.provinces.create({
    data: {
      country_id: indonesia.id,
      code: "35",
      name: "Jawa Timur",
      cities: { create: [{ code: "3578", name: "Surabaya" }, { code: "3573", name: "Malang" }] },
    },
    include: { cities: true },
  });
  const [jaksel, jakpus] = jakarta.cities;
  const [bandung] = jabar.cities;
  const [surabaya] = jatim.cities;

  // ── Users ───────────────────────────────────────────────────
  const createUser = (email: string, roleId: bigint, fullName: string, extra: { phone?: string; gender?: "male" | "female"; city?: typeof jaksel } = {}) =>
    prisma.users.create({
      data: {
        email,
        password,
        role_id: roleId,
        email_verified: true,
        userProfiles: {
          create: {
            full_name: fullName,
            phone: extra.phone,
            gender: extra.gender,
            birth_date: new Date("2000-01-15"),
            province_id: extra.city?.province_id,
            city_id: extra.city?.id,
            address: extra.city ? `Jl. Contoh No. 1, ${extra.city.name}` : undefined,
          },
        },
      },
    });

  const admin = await createUser("admin@ukk.test", adminRole.id, "Admin UKK", { phone: "081200000001", gender: "male", city: jakpus });
  const organizerUser1 = await createUser("organizer@ukk.test", organizerRole.id, "Rina Organizer", { phone: "081200000002", gender: "female", city: jaksel });
  const organizerUser2 = await createUser("organizer2@ukk.test", organizerRole.id, "Budi Organizer", { phone: "081200000003", gender: "male", city: bandung });
  const buyer1 = await createUser("buyer@ukk.test", buyerRole.id, "Andi Pembeli", { phone: "081200000004", gender: "male", city: jaksel });
  const buyer2 = await createUser("buyer2@ukk.test", buyerRole.id, "Siti Pembeli", { phone: "081200000005", gender: "female", city: bandung });
  const buyer3 = await createUser("buyer3@ukk.test", buyerRole.id, "Dewi Pembeli", { phone: "081200000006", gender: "female", city: surabaya });

  // Token one-time disimpan sebagai hash; nilai mentah tidak dipakai lagi (sudah dikonsumsi).
  await prisma.email_verifications.createMany({
    data: [admin, organizerUser1, organizerUser2, buyer1, buyer2, buyer3].map((user) => ({
      user_id: user.id,
      token: hash(randomUUID()),
      expired_at: at(1),
      verified_at: new Date(),
    })),
  });
  await prisma.password_resets.create({ data: { user_id: buyer2.id, token: hash(randomUUID()), expired_at: at(-1), used_at: at(-2) } });
  await prisma.refresh_tokens.create({ data: { user_id: buyer1.id, token: hash(randomUUID()), expired_at: at(-1), revoked_at: at(-2) } });

  // ── Organizer ───────────────────────────────────────────────
  const organizer1 = await prisma.organizers.create({
    data: {
      user_id: organizerUser1.id,
      company_name: "Nusantara Live",
      slug: "nusantara-live",
      email: "halo@nusantaralive.test",
      phone: "0215550001",
      website: "https://nusantaralive.test",
      description: "Promotor konser dan festival musik.",
      address: "Jl. Sudirman No. 10, Jakarta Selatan",
      status: "verified",
      verified_at: at(-30),
    },
  });
  await prisma.organizers.create({
    data: {
      user_id: organizerUser2.id,
      company_name: "Bandung Edu Event",
      slug: "bandung-edu-event",
      email: "info@bandungedu.test",
      description: "Penyelenggara seminar dan workshop teknologi.",
      status: "pending",
    },
  });

  // ── Kategori, tag, venue ────────────────────────────────────
  const [musik, seminar, olahraga] = await Promise.all(
    [
      ["Musik", "musik"],
      ["Seminar", "seminar"],
      ["Olahraga", "olahraga"],
    ].map(([name, slug]) => prisma.event_categories.create({ data: { name, slug } })),
  );
  const [tagFestival, tagOutdoor, tagTeknologi] = await Promise.all(
    [
      ["Festival", "festival"],
      ["Outdoor", "outdoor"],
      ["Teknologi", "teknologi"],
    ].map(([name, slug]) => prisma.tags.create({ data: { name, slug } })),
  );

  const gbk = await prisma.venues.create({
    data: {
      city_id: jakpus.id,
      name: "Stadion Utama GBK",
      slug: "stadion-utama-gbk",
      address: "Jl. Pintu Satu Senayan, Jakarta Pusat",
      latitude: "-6.218335",
      longitude: "106.802216",
      google_maps_url: "https://maps.google.com/?q=-6.218335,106.802216",
      capacity: 70000,
    },
  });
  const hall = await prisma.venues.create({
    data: {
      city_id: bandung.id,
      name: "Bandung Convention Hall",
      slug: "bandung-convention-hall",
      address: "Jl. Soekarno-Hatta No. 1, Bandung",
      capacity: 2000,
    },
  });
  const arena = await prisma.venues.create({
    data: { city_id: surabaya.id, name: "Surabaya Arena", slug: "surabaya-arena", address: "Jl. Ahmad Yani, Surabaya", capacity: 5000 },
  });

  // ── Events ──────────────────────────────────────────────────
  const concert = await prisma.events.create({
    data: {
      organizer_id: organizer1.id,
      category_id: musik.id,
      venue_id: gbk.id,
      title: "Festival Musik Nusantara 2026",
      slug: "festival-musik-nusantara-2026",
      summary: "Festival musik dua hari dengan musisi terbaik Indonesia.",
      description: "Nikmati penampilan lebih dari 20 musisi di panggung utama GBK.",
      banner: "https://picsum.photos/seed/fmn-banner/1200/400",
      thumbnail: "https://picsum.photos/seed/fmn-thumb/400/400",
      poster: "https://picsum.photos/seed/fmn-poster/600/900",
      minimum_age: 17,
      dress_code: "Bebas rapi",
      gate_open_at: at(30, -2),
      start_at: at(30),
      end_at: at(31),
      sales_start_at: at(-10),
      sales_end_at: at(29),
      status: "published",
      is_published: true,
      is_featured: true,
      approved_by: admin.id,
      approved_at: at(-11),
      images: { create: [{ image_url: "https://picsum.photos/seed/fmn-1/800/600", alt_text: "Panggung utama", sort_order: 1 }] },
      information: { create: [{ title: "Fasilitas", content: "Food court, mushola, dan area parkir.", sort_order: 1 }] },
      terms: { create: [{ title: "Tiket", content: "Tiket yang sudah dibeli tidak dapat dikembalikan.", sort_order: 1 }] },
      faqs: { create: [{ question: "Apakah anak di bawah 17 tahun boleh masuk?", answer: "Tidak, minimal usia 17 tahun.", sort_order: 1 }] },
      schedules: {
        create: [
          { title: "Open Gate", start_at: at(30, -2), end_at: at(30), sort_order: 1 },
          { title: "Penampilan Utama", description: "Headliner malam pertama", start_at: at(30, 3), end_at: at(30, 5), sort_order: 2 },
        ],
      },
      contacts: { create: [{ contact_name: "Panitia FMN", phone: "0215550001", email: "panitia@nusantaralive.test" }] },
      socials: { create: [{ platform: "instagram", url: "https://instagram.com/nusantaralive" }] },
      sponsors: { create: [{ name: "Bank Contoh", logo: "https://picsum.photos/seed/sponsor/200/100", website: "https://bank.test" }] },
      checkinDevices: { create: [{ name: "Gate A - Scanner 1", device_code: "GBK-GATE-A-01" }] },
      eventTags: { create: [{ tag_id: tagFestival.id }, { tag_id: tagOutdoor.id }] },
    },
  });

  // Event yang sedang berlangsung agar check-in bisa langsung dicoba.
  const liveEvent = await prisma.events.create({
    data: {
      organizer_id: organizer1.id,
      category_id: olahraga.id,
      venue_id: arena.id,
      title: "Surabaya Fun Run 2026",
      slug: "surabaya-fun-run-2026",
      summary: "Lari santai 5K keliling Surabaya.",
      gate_open_at: at(0, -2),
      start_at: at(0, -1),
      end_at: at(0, 6),
      sales_start_at: at(-20),
      sales_end_at: at(0, -1),
      status: "published",
      is_published: true,
      approved_by: admin.id,
      approved_at: at(-21),
      eventTags: { create: [{ tag_id: tagOutdoor.id }] },
    },
  });

  await prisma.events.create({
    data: {
      organizer_id: organizer1.id,
      category_id: seminar.id,
      venue_id: hall.id,
      title: "Tech Conference Bandung",
      slug: "tech-conference-bandung",
      summary: "Konferensi teknologi tahunan.",
      start_at: at(60),
      end_at: at(60, 8),
      status: "pending_review",
      eventTags: { create: [{ tag_id: tagTeknologi.id }] },
      ticketTypes: { create: [{ name: "Regular", price: "150000", quota: 300 }] },
    },
  });
  await prisma.events.create({
    data: {
      organizer_id: organizer1.id,
      category_id: seminar.id,
      venue_id: hall.id,
      title: "Workshop UI/UX (Draft)",
      slug: "workshop-ui-ux-draft",
      start_at: at(75),
      end_at: at(75, 4),
      status: "draft",
      ticketTypes: { create: [{ name: "Peserta", price: "75000", quota: 50 }] },
    },
  });
  await prisma.events.create({
    data: {
      organizer_id: organizer1.id,
      category_id: musik.id,
      venue_id: gbk.id,
      title: "Konser Akhir Tahun 2025",
      slug: "konser-akhir-tahun-2025",
      start_at: at(-300),
      end_at: at(-300, 5),
      status: "completed",
      is_published: true,
      approved_by: admin.id,
      approved_at: at(-330),
    },
  });

  // ── Ticket types ────────────────────────────────────────────
  // sold = jumlah unit di order pending + paid (lihat CartRepository.checkout).
  const vip = await prisma.ticket_types.create({
    data: { event_id: concert.id, name: "VIP", description: "Kursi bernomor dekat panggung", price: "1500000", quota: 20, sold: 2, max_purchase: 4, sale_start_at: at(-10), sale_end_at: at(29) },
  });
  const presale = await prisma.ticket_types.create({
    data: { event_id: concert.id, name: "Festival Presale", price: "350000", quota: 500, sold: 2, max_purchase: 5, wave: 1, sale_start_at: at(-10), sale_end_at: at(29) },
  });
  await prisma.ticket_types.create({
    data: { event_id: concert.id, name: "Festival Normal", price: "500000", quota: 1000, max_purchase: 5, wave: 2, sale_start_at: at(-10), sale_end_at: at(29) },
  });
  const runTicket = await prisma.ticket_types.create({
    data: { event_id: liveEvent.id, name: "Peserta 5K", price: "100000", quota: 200, sold: 2, max_purchase: 2, sale_start_at: at(-20), sale_end_at: at(0, -1) },
  });

  // ── Seat map (VIP) ──────────────────────────────────────────
  const seatMap = await prisma.seat_maps.create({ data: { event_id: concert.id, width: 800, height: 400 } });
  const vipSection = await prisma.seat_sections.create({
    data: { seat_map_id: seatMap.id, ticket_type_id: vip.id, label: "VIP", x: 100, y: 100, width: 600, height: 200, sort_order: 1 },
  });
  await prisma.seats.createMany({
    data: ["A", "B"].flatMap((row, r) =>
      Array.from({ length: 10 }, (_, i) => ({
        seat_map_id: seatMap.id,
        section_id: vipSection.id,
        ticket_type_id: vip.id,
        label: `${row}${i + 1}`,
        row_label: row,
        seat_number: i + 1,
        x: 120 + i * 56,
        y: 140 + r * 60,
      })),
    ),
  });
  const seat = (label: string) => prisma.seats.findUniqueOrThrow({ where: { seat_map_id_label: { seat_map_id: seatMap.id, label } } });
  const [seatA1, seatA2, seatB1] = await Promise.all([seat("A1"), seat("A2"), seat("B1")]);
  await prisma.seats.update({ where: { id: seatA1.id }, data: { status: "sold" } });
  await prisma.seats.update({ where: { id: seatA2.id }, data: { status: "held" } });
  await prisma.seats.update({ where: { id: seatB1.id }, data: { status: "held" } });
  await prisma.seats.update({ where: { seat_map_id_label: { seat_map_id: seatMap.id, label: "B10" } }, data: { status: "blocked" } });

  // ── Voucher ─────────────────────────────────────────────────
  const voucher = await prisma.vouchers.create({
    data: { code: "UKK2026", discount_type: "percentage", discount_value: "10", max_discount: "100000", quota: 100, start_at: at(-30), end_at: at(60) },
  });
  await prisma.vouchers.create({ data: { code: "HEMAT50K", discount_type: "fixed", discount_value: "50000", quota: 50, start_at: at(-30), end_at: at(60) } });

  // ── Order paid (buyer1): 1 VIP kursi A1 + 2 presale, voucher UKK2026 ─
  const paidOrder = await prisma.orders.create({
    data: {
      user_id: buyer1.id,
      order_number: `ORD-${randomUUID()}`,
      subtotal: "2200000",
      discount: "100000",
      total: "2100000",
      status: "paid",
      expired_at: at(-5),
      orderItems: {
        create: [
          { ticket_type_id: vip.id, quantity: 1, price: "1500000", subtotal: "1500000" },
          { ticket_type_id: presale.id, quantity: 2, price: "350000", subtotal: "700000" },
        ],
      },
    },
    include: { orderItems: true },
  });
  await prisma.voucher_usages.create({ data: { voucher_id: voucher.id, user_id: buyer1.id, order_id: paidOrder.id } });
  await prisma.payments.create({
    data: {
      order_id: paidOrder.id,
      provider: "midtrans",
      payment_method: "bank_transfer",
      provider_transaction_id: randomUUID(),
      snap_token: randomUUID(),
      redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/seed",
      gross_amount: "2100000",
      status: "settlement",
      paid_at: at(-5),
      logs: { create: [{ payload: { transaction_status: "settlement", order_id: paidOrder.order_number, gross_amount: "2100000.00" }, response: { ok: true } }] },
    },
  });
  await prisma.seat_reservations.create({ data: { seat_id: seatA1.id, order_id: paidOrder.id, user_id: buyer1.id } });
  const [vipItem, presaleItem] = paidOrder.orderItems;
  const issue = (item: typeof vipItem, sequence: number, seatId?: bigint) => ({
    order_id: paidOrder.id,
    order_item_id: item.id,
    ticket_type_id: item.ticket_type_id,
    owner_id: buyer1.id,
    sequence,
    ticket_code: `TCK-${randomUUID()}`,
    qr_token: qrToken(),
    attendee_name: "Andi Pembeli",
    seat_id: seatId,
  });
  await prisma.tickets.createMany({ data: [issue(vipItem, 1, seatA1.id), issue(presaleItem, 1), issue(presaleItem, 2)] });

  // ── Order paid (buyer2) untuk event berlangsung: 1 tiket sudah check-in ─
  const runOrder = await prisma.orders.create({
    data: {
      user_id: buyer2.id,
      order_number: `ORD-${randomUUID()}`,
      subtotal: "200000",
      total: "200000",
      status: "paid",
      expired_at: at(-3),
      orderItems: { create: [{ ticket_type_id: runTicket.id, quantity: 2, price: "100000", subtotal: "200000" }] },
    },
    include: { orderItems: true },
  });
  await prisma.payments.create({
    data: { order_id: runOrder.id, provider: "midtrans", payment_method: "qris", provider_transaction_id: randomUUID(), gross_amount: "200000", status: "settlement", paid_at: at(-3) },
  });
  const runItem = runOrder.orderItems[0];
  const checkedIn = await prisma.tickets.create({
    data: {
      order_id: runOrder.id,
      order_item_id: runItem.id,
      ticket_type_id: runTicket.id,
      owner_id: buyer2.id,
      sequence: 1,
      ticket_code: `TCK-${randomUUID()}`,
      qr_token: qrToken(),
      attendee_name: "Siti Pembeli",
      status: "checked_in",
      checked_in_at: at(0, -1),
      checked_in_by: organizerUser1.id,
    },
  });
  await prisma.tickets.create({
    data: {
      order_id: runOrder.id,
      order_item_id: runItem.id,
      ticket_type_id: runTicket.id,
      owner_id: buyer2.id,
      sequence: 2,
      ticket_code: `TCK-${randomUUID()}`,
      qr_token: qrToken(),
      attendee_name: "Teman Siti",
    },
  });
  await prisma.ticket_scans.createMany({
    data: [
      { ticket_id: checkedIn.id, scanned_by: organizerUser1.id, event_id: liveEvent.id, gate: "Gate 1", device: "Scanner 1", scan_result: "success", scanned_at: at(0, -1) },
      { ticket_id: checkedIn.id, scanned_by: organizerUser1.id, event_id: liveEvent.id, gate: "Gate 1", device: "Scanner 1", scan_result: "duplicate" },
    ],
  });

  // ── Order pending (buyer2): 1 VIP kursi A2, menunggu pembayaran ─
  const pendingOrder = await prisma.orders.create({
    data: {
      user_id: buyer2.id,
      order_number: `ORD-${randomUUID()}`,
      subtotal: "1500000",
      total: "1500000",
      status: "pending",
      expired_at: at(0, 1),
      orderItems: { create: [{ ticket_type_id: vip.id, quantity: 1, price: "1500000", subtotal: "1500000" }] },
    },
  });
  await prisma.payments.create({
    data: { order_id: pendingOrder.id, provider: "midtrans", snap_token: randomUUID(), redirect_url: "https://app.sandbox.midtrans.com/snap/v4/redirection/seed-pending", gross_amount: "1500000", status: "pending" },
  });
  await prisma.seat_reservations.create({ data: { seat_id: seatA2.id, order_id: pendingOrder.id, user_id: buyer2.id } });

  // ── Order expired (buyer3): stok sudah dilepas, tidak dihitung di sold ─
  const expiredOrder = await prisma.orders.create({
    data: {
      user_id: buyer3.id,
      order_number: `ORD-${randomUUID()}`,
      subtotal: "350000",
      total: "350000",
      status: "expired",
      expired_at: at(-1),
      orderItems: { create: [{ ticket_type_id: presale.id, quantity: 1, price: "350000", subtotal: "350000" }] },
    },
  });
  await prisma.payments.create({ data: { order_id: expiredOrder.id, provider: "midtrans", gross_amount: "350000", status: "expired" } });

  // ── Cart aktif (buyer3): 2 presale + kursi B1 tertahan ───────
  const cart = await prisma.carts.create({ data: { user_id: buyer3.id } });
  await prisma.cart_items.create({ data: { cart_id: cart.id, ticket_type_id: presale.id, quantity: 2, unit_price: "350000", subtotal: "700000" } });
  await prisma.ticket_locks.create({ data: { cart_id: cart.id, ticket_type_id: presale.id, quantity: 2, expires_at: at(0, 0.25) } });
  await prisma.seat_reservations.create({ data: { seat_id: seatB1.id, cart_id: cart.id, user_id: buyer3.id, expires_at: at(0, 5 / 60) } });
  await prisma.carts.create({ data: { user_id: buyer1.id } });

  // ── Notifikasi, push token, banner ──────────────────────────
  await prisma.notifications.createMany({
    data: [
      { user_id: buyer1.id, title: "Pembayaran berhasil", message: "E-ticket Festival Musik Nusantara 2026 sudah terbit.", type: "payment", reference_type: "order", reference_id: paidOrder.id },
      { user_id: buyer2.id, title: "Menunggu pembayaran", message: "Selesaikan pembayaran sebelum batas waktu.", type: "order", reference_type: "order", reference_id: pendingOrder.id },
      { user_id: buyer3.id, title: "Order kadaluarsa", message: "Order kamu telah kadaluarsa.", type: "order", reference_type: "order", reference_id: expiredOrder.id, is_read: true, read_at: at(-1) },
      { user_id: organizerUser1.id, title: "Event disetujui", message: "Festival Musik Nusantara 2026 telah dipublikasikan.", type: "event", reference_type: "event", reference_id: concert.id },
      { user_id: buyer1.id, title: "Selamat datang", message: "Terima kasih telah bergabung.", type: "system" },
    ],
  });
  await prisma.push_tokens.create({ data: { user_id: buyer1.id, token: "ExponentPushToken[seed-buyer-device-0001]" } });
  await prisma.banners.createMany({
    data: [
      { title: "Festival Musik Nusantara 2026", image: "https://picsum.photos/seed/banner-1/1200/400", url: `/events/${concert.slug}`, sort_order: 1 },
      { title: "Promo UKK2026", image: "https://picsum.photos/seed/banner-2/1200/400", sort_order: 2 },
    ],
  });

  // ── Audit & activity log ────────────────────────────────────
  await prisma.audit_logs.createMany({
    data: [
      { user_id: admin.id, action: "update", table_name: "organizers", record_id: organizer1.id, old_data: { status: "pending" }, new_data: { status: "verified" } },
      { user_id: admin.id, action: "update", table_name: "events", record_id: concert.id, old_data: { status: "pending_review" }, new_data: { status: "published" } },
      { user_id: null, action: "update", table_name: "orders", record_id: paidOrder.id, old_data: { status: "pending" }, new_data: { status: "paid" } },
      { user_id: organizerUser1.id, action: "update", table_name: "tickets", record_id: checkedIn.id, old_data: { status: "issued" }, new_data: { status: "checked_in" } },
    ],
  });
  await prisma.activity_logs.createMany({
    data: [
      { user_id: buyer1.id, activity: "checkout", reference_type: "order", reference_id: paidOrder.id },
      { user_id: organizerUser1.id, activity: "check_in", reference_type: "ticket", reference_id: checkedIn.id },
    ],
  });
}

main()
  .then(() => console.info(`Seed selesai. Semua akun memakai password "${PASSWORD}".`))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
