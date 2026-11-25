import { describe, expect, it, vi } from "vitest";
import { OrganizerService } from "../src/modules/organizer/organizer.service.js";
import { AdminService } from "../src/modules/admin/admin.service.js";
import { CartService } from "../src/modules/cart/cart.service.js";
import { NotificationService } from "../src/modules/notification/notification.service.js";
import { UserService } from "../src/modules/user/user.service.js";
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from "../src/utils/app-error.js";
import { documentStorage, EVENT_DOCUMENT_TYPES, ORGANIZER_DOCUMENT_TYPES } from "../src/utils/document-storage.js";

vi.mock("../src/lib/socket.js", () => ({ emitToAll: vi.fn(), emitToRole: vi.fn(), emitToUser: vi.fn() }));

const future = (hours: number) => new Date(Date.now() + hours * 3_600_000);
const storedDocument = { type: "nib", storage_key: "ukk-2026/doc", format: "pdf", original_name: "doc.pdf", mime_type: "application/pdf", size: 10, created_at: new Date(), updated_at: null };
const eventDocuments = EVENT_DOCUMENT_TYPES.map((type) => ({ ...storedDocument, type }));
const organizerDocuments = ORGANIZER_DOCUMENT_TYPES.map((type) => ({ ...storedDocument, type }));

describe("OrganizerService rules", () => {
  const verified = { id: 9n, status: "verified" };
  const draftEvent = { id: 5n, status: "draft", start_at: future(24), end_at: future(30), sales_start_at: null, sales_end_at: null, ticketTypes: [] as { sold: number }[] };
  const ticket = { id: 7n, sold: 3, quota: 10, sale_start_at: null, sale_end_at: null, event: { status: "draft" } };

  const make = (overrides: Record<string, unknown> = {}) => {
    const repository = {
      findByOwnerId: vi.fn().mockResolvedValue(verified),
      findEvents: vi.fn().mockResolvedValue({ data: [], total: 21 }),
      findEventByIdAndOrganizer: vi.fn().mockResolvedValue(draftEvent),
      createEvent: vi.fn().mockResolvedValue({ id: 5n }),
      updateEvent: vi.fn().mockResolvedValue({ id: 5n }),
      deleteEvent: vi.fn(),
      countOrderItemsByEvent: vi.fn().mockResolvedValue(0),
      countOrderItemsByTicket: vi.fn().mockResolvedValue(0),
      findTicketsByEvent: vi.fn().mockResolvedValue([]),
      findTicketByIdAndOrganizer: vi.fn().mockResolvedValue(ticket),
      createTicket: vi.fn().mockResolvedValue({ id: 7n }),
      updateTicket: vi.fn().mockResolvedValue({ id: 7n }),
      deleteTicket: vi.fn(),
      findEventDocuments: vi.fn().mockResolvedValue(eventDocuments),
      findEventDocument: vi.fn().mockResolvedValue(null),
      upsertEventDocument: vi.fn().mockResolvedValue(storedDocument),
      ...overrides,
    };
    return { repository, service: new OrganizerService(repository as never) };
  };
  const eventInput = { category_id: 1n, venue_id: 1n, title: "Festival", slug: "festival", start_at: future(24), end_at: future(30) };

  it("requires an organizer account, and a verified one for writes", async () => {
    await expect(make({ findByOwnerId: vi.fn().mockResolvedValue(null) }).service.listEvents(1n, 1, 10)).rejects.toBeInstanceOf(ForbiddenError);
    await expect(make({ findByOwnerId: vi.fn().mockResolvedValue({ id: 9n, status: "pending" }) }).service.createEvent(1n, eventInput)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("paginates the organizer's events", async () => {
    await expect(make().service.listEvents(1n, 2, 10)).resolves.toMatchObject({ page: 2, limit: 10, totalPages: 3 });
  });

  it("hides events and tickets owned by other organizers", async () => {
    const { service } = make({ findEventByIdAndOrganizer: vi.fn().mockResolvedValue(null), findTicketByIdAndOrganizer: vi.fn().mockResolvedValue(null) });
    await expect(service.getEvent(1n, 5n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.updateEvent(1n, 5n, { title: "x" })).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.getTicket(1n, 7n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(service.deleteTicket(1n, 7n)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("validates event and sales dates", async () => {
    const { service, repository } = make();
    await expect(service.createEvent(1n, { ...eventInput, end_at: eventInput.start_at })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.createEvent(1n, { ...eventInput, sales_start_at: future(5), sales_end_at: future(4) })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.updateEvent(1n, 5n, { end_at: future(1) })).rejects.toBeInstanceOf(ValidationError);
    await service.createEvent(1n, eventInput);
    expect(repository.createEvent).toHaveBeenCalledWith({ ...eventInput, organizer_id: 9n });
  });

  it("only edits, submits, or deletes events in draft/rejected", async () => {
    const submitted = make({ findEventByIdAndOrganizer: vi.fn().mockResolvedValue({ ...draftEvent, status: "pending_review" }) });
    await expect(submitted.service.updateEvent(1n, 5n, { title: "x" })).rejects.toBeInstanceOf(ConflictError);
    await expect(submitted.service.submitEvent(1n, 5n)).rejects.toBeInstanceOf(ConflictError);

    const { service, repository } = make();
    await service.updateEvent(1n, 5n, { title: "Baru" });
    expect(repository.updateEvent).toHaveBeenCalledWith(5n, { title: "Baru" });
  });

  it("requires at least one ticket type before submitting for review", async () => {
    await expect(make().service.submitEvent(1n, 5n)).rejects.toBeInstanceOf(ConflictError);

    const { service, repository } = make({ findEventByIdAndOrganizer: vi.fn().mockResolvedValue({ ...draftEvent, ticketTypes: [{ sold: 0 }] }) });
    await service.submitEvent(1n, 5n);
    expect(repository.updateEvent).toHaveBeenCalledWith(5n, { status: "pending_review", rejected_reason: null });
  });

  it("requires every verification document before submitting for review", async () => {
    const withTickets = { ...draftEvent, ticketTypes: [{ sold: 0 }] };
    const { service, repository } = make({
      findEventByIdAndOrganizer: vi.fn().mockResolvedValue(withTickets),
      findEventDocuments: vi.fn().mockResolvedValue(eventDocuments.slice(1)),
    });
    await expect(service.submitEvent(1n, 5n)).rejects.toThrow("cooperation_agreement");
    expect(repository.updateEvent).not.toHaveBeenCalled();
  });

  it("uploads event documents only while draft/rejected and replaces the old file", async () => {
    const file = { buffer: Buffer.from("%PDF"), originalname: "pks.pdf", mimetype: "application/pdf", size: 4 };
    const upload = vi.spyOn(documentStorage, "upload").mockResolvedValue({ storage_key: "new", format: "pdf", original_name: "pks.pdf", mime_type: "application/pdf", size: 4 });
    const remove = vi.spyOn(documentStorage, "remove").mockResolvedValue(undefined);
    vi.spyOn(documentStorage, "signedUrl").mockReturnValue("https://signed");

    const submitted = make({ findEventByIdAndOrganizer: vi.fn().mockResolvedValue({ ...draftEvent, status: "pending_review" }) });
    await expect(submitted.service.uploadEventDocument(1n, 5n, "cooperation_agreement", file)).rejects.toBeInstanceOf(ConflictError);
    expect(upload).not.toHaveBeenCalled();

    const { service, repository } = make({ findEventDocument: vi.fn().mockResolvedValue({ storage_key: "old" }) });
    await expect(service.uploadEventDocument(1n, 5n, "cooperation_agreement", file)).resolves.toMatchObject({ url: "https://signed" });
    expect(repository.upsertEventDocument).toHaveBeenCalledWith(5n, "cooperation_agreement", expect.objectContaining({ storage_key: "new" }));
    expect(remove).toHaveBeenCalledWith("old");

    remove.mockClear();
    const failing = make({ upsertEventDocument: vi.fn().mockRejectedValue(new Error("db down")) });
    await expect(failing.service.uploadEventDocument(1n, 5n, "cooperation_agreement", file)).rejects.toThrow("db down");
    expect(remove).toHaveBeenCalledWith("new");
  });

  it("refuses to delete events with sold tickets or orders", async () => {
    await expect(make({ findEventByIdAndOrganizer: vi.fn().mockResolvedValue({ ...draftEvent, ticketTypes: [{ sold: 1 }] }) }).service.deleteEvent(1n, 5n)).rejects.toBeInstanceOf(ConflictError);
    await expect(make({ countOrderItemsByEvent: vi.fn().mockResolvedValue(2) }).service.deleteEvent(1n, 5n)).rejects.toBeInstanceOf(ConflictError);

    const { service, repository } = make();
    await service.deleteEvent(1n, 5n);
    expect(repository.deleteEvent).toHaveBeenCalledWith(5n);
  });

  it("lists tickets of an owned event", async () => {
    const { service, repository } = make();
    await service.listTickets(1n, 5n);
    expect(repository.findTicketsByEvent).toHaveBeenCalledWith(5n, 9n);
  });

  it("creates tickets with a valid sale window and marks zero quota as sold out", async () => {
    const { service, repository } = make();
    const input = { event_id: 5n, name: "VIP", price: 100000, quota: 0 };
    await expect(service.createTicket(1n, { ...input, quota: 5, sale_start_at: future(5), sale_end_at: future(4) })).rejects.toBeInstanceOf(ValidationError);

    await service.createTicket(1n, input);
    expect(repository.createTicket).toHaveBeenCalledWith({ ...input, status: "sold_out" });
    await service.createTicket(1n, { ...input, quota: 5, status: "inactive" });
    expect(repository.createTicket).toHaveBeenLastCalledWith({ ...input, quota: 5, status: "inactive" });
  });

  it("locks the price after submission but still allows quota changes", async () => {
    const submitted = make({ findTicketByIdAndOrganizer: vi.fn().mockResolvedValue({ ...ticket, event: { status: "published" } }) });
    await expect(submitted.service.updateTicket(1n, 7n, { price: 1 })).rejects.toBeInstanceOf(ConflictError);
    await submitted.service.updateTicket(1n, 7n, { quota: 12 });
    expect(submitted.repository.updateTicket).toHaveBeenCalledWith(7n, { quota: 12 });
  });

  it("marks a ticket sold out when the quota drops to the sold count", async () => {
    const { service, repository } = make();
    await service.updateTicket(1n, 7n, { quota: 3, status: "active" });
    expect(repository.updateTicket).toHaveBeenCalledWith(7n, { quota: 3, status: "sold_out" });
    await expect(service.updateTicket(1n, 7n, { sale_start_at: future(5), sale_end_at: future(4) })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to delete tickets that are sold, ordered, or locked by submission", async () => {
    await expect(make().service.deleteTicket(1n, 7n)).rejects.toBeInstanceOf(ConflictError);
    const unsold = { ...ticket, sold: 0 };
    await expect(make({ findTicketByIdAndOrganizer: vi.fn().mockResolvedValue(unsold), countOrderItemsByTicket: vi.fn().mockResolvedValue(1) }).service.deleteTicket(1n, 7n)).rejects.toBeInstanceOf(ConflictError);
    await expect(make({ findTicketByIdAndOrganizer: vi.fn().mockResolvedValue({ ...unsold, event: { status: "published" } }) }).service.deleteTicket(1n, 7n)).rejects.toBeInstanceOf(ConflictError);

    const { service, repository } = make({ findTicketByIdAndOrganizer: vi.fn().mockResolvedValue(unsold) });
    await service.deleteTicket(1n, 7n);
    expect(repository.deleteTicket).toHaveBeenCalledWith(7n);
  });

  it("returns not found for sales of an event the organizer does not own", async () => {
    await expect(make({ findSalesByEvent: vi.fn().mockResolvedValue(null) }).service.getSales(1n, 5n)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("AdminService rules", () => {
  const make = (overrides: Record<string, unknown> = {}) => {
    const repository = {
      approveEvent: vi.fn(),
      findUsers: vi.fn().mockResolvedValue({ data: [], total: 11 }),
      setUserActive: vi.fn().mockResolvedValue({ id: 4n }),
      findOrganizers: vi.fn().mockResolvedValue({ data: [], total: 5 }),
      setOrganizerStatus: vi.fn().mockResolvedValue({ id: 4n }),
      findOrganizerDocuments: vi.fn().mockResolvedValue({ id: 4n, documents: organizerDocuments }),
      findEventDocuments: vi.fn().mockResolvedValue({ id: 5n, documents: eventDocuments }),
      getDashboard: vi.fn().mockResolvedValue({ users: 1 }),
      findTransactionLogs: vi.fn().mockResolvedValue({ data: [], total: 0 }),
      ...overrides,
    };
    return { repository, service: new AdminService(repository as never) };
  };

  it("rejects approval of missing events, wrong status, or unverified organizers", async () => {
    await expect(make({ approveEvent: vi.fn().mockResolvedValue(null) }).service.approveEvent(5n, 2n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(make({ approveEvent: vi.fn().mockResolvedValue({ event: null, currentStatus: "draft" }) }).service.approveEvent(5n, 2n)).rejects.toBeInstanceOf(ConflictError);
    await expect(make({ approveEvent: vi.fn().mockResolvedValue({ event: null, currentStatus: "pending_review" }) }).service.approveEvent(5n, 2n)).rejects.toThrow("Organizer event belum terverifikasi");
  });

  it("requires complete documents to verify an organizer or approve an event", async () => {
    const incomplete = make({ findOrganizerDocuments: vi.fn().mockResolvedValue({ id: 4n, documents: organizerDocuments.slice(1) }) });
    await expect(incomplete.service.updateOrganizerStatus(4n, "verified", 2n)).rejects.toBeInstanceOf(ConflictError);
    expect(incomplete.repository.setOrganizerStatus).not.toHaveBeenCalled();
    await expect(incomplete.service.updateOrganizerStatus(4n, "suspended", 2n)).resolves.toEqual({ id: 4n });
    await expect(make({ findOrganizerDocuments: vi.fn().mockResolvedValue(null) }).service.updateOrganizerStatus(4n, "verified", 2n)).rejects.toBeInstanceOf(NotFoundError);

    const approve = vi.fn().mockResolvedValue({ event: null, currentStatus: "pending_review", organizerStatus: "verified", missingDocuments: true });
    await expect(make({ approveEvent: approve }).service.approveEvent(5n, 2n)).rejects.toThrow("Berkas verifikasi event belum lengkap");
  });

  it("returns documents with signed URLs and 404 for unknown owners", async () => {
    vi.spyOn(documentStorage, "signedUrl").mockReturnValue("https://signed");
    const { service } = make();
    const documents = await service.getOrganizerDocuments(4n);
    expect(documents).toHaveLength(4);
    expect(documents[0]).toMatchObject({ url: "https://signed" });
    expect(documents[0]).not.toHaveProperty("storage_key");
    await expect(service.getEventDocuments(5n)).resolves.toHaveLength(5);
    await expect(make({ findEventDocuments: vi.fn().mockResolvedValue(null) }).service.getEventDocuments(5n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(make({ findOrganizerDocuments: vi.fn().mockResolvedValue(null) }).service.getOrganizerDocuments(4n)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("paginates users and organizers", async () => {
    const { service } = make();
    await expect(service.listUsers({ page: 1, limit: 5 })).resolves.toMatchObject({ totalPages: 3 });
    await expect(service.listOrganizers({ page: 1, limit: 5 })).resolves.toMatchObject({ totalPages: 1 });
  });

  it("prevents admins from deactivating themselves and reports missing users", async () => {
    await expect(make().service.updateUserStatus(2n, false, 2n)).rejects.toBeInstanceOf(ConflictError);
    await expect(make({ setUserActive: vi.fn().mockResolvedValue(null) }).service.updateUserStatus(4n, true, 2n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(make().service.updateUserStatus(4n, false, 2n)).resolves.toEqual({ id: 4n });
  });

  it("reports missing organizers on status change", async () => {
    await expect(make({ setOrganizerStatus: vi.fn().mockResolvedValue(null) }).service.updateOrganizerStatus(4n, "verified", 2n)).rejects.toBeInstanceOf(NotFoundError);
    await expect(make().service.updateOrganizerStatus(4n, "verified", 2n)).resolves.toEqual({ id: 4n });
  });

  it("returns the dashboard and rejects an inverted transaction log date range", async () => {
    const { service, repository } = make();
    await expect(service.getDashboard()).resolves.toEqual({ users: 1 });
    await expect(service.listTransactionLogs({ page: 1, limit: 10, start_date: new Date("2026-12-02"), end_date: new Date("2026-12-01") })).rejects.toBeInstanceOf(ValidationError);
    await expect(service.listTransactionLogs({ page: 1, limit: 10 })).resolves.toMatchObject({ totalPages: 0 });
    expect(repository.findTransactionLogs).toHaveBeenCalledTimes(1);
  });
});

describe("CartService rejection reasons", () => {
  it.each([
    ["not_found", NotFoundError],
    ["unavailable", ConflictError],
    ["max_purchase", ConflictError],
  ])("maps add-to-cart reason %s to an HTTP error", async (reason, error) => {
    const service = new CartService({ upsertItem: vi.fn().mockResolvedValue({ reason, maxPurchase: 5 }) } as never);
    await expect(service.setItem(1n, { ticket_type_id: 2n, quantity: 1 })).rejects.toBeInstanceOf(error);
  });

  it.each(["empty", "unavailable", "invalid_voucher", "max_purchase"])("rejects checkout when the reason is %s", async (reason) => {
    const service = new CartService({ checkout: vi.fn().mockResolvedValue({ reason, maxPurchase: 5 }) } as never);
    await expect(service.checkout(1n, {})).rejects.toBeInstanceOf(ConflictError);
  });

  it("returns the updated cart after reserving and 404s when removing a missing item", async () => {
    const expiresAt = future(1);
    const repository = { upsertItem: vi.fn().mockResolvedValue({ reason: "ok", expiresAt }), getCart: vi.fn().mockResolvedValue(null), removeItem: vi.fn().mockResolvedValue(false) };
    const service = new CartService(repository as never);

    await expect(service.setItem(1n, { ticket_type_id: 2n, quantity: 1 })).resolves.toEqual({ cart: { items: [], subtotal: 0, subtotal_formatted: "Rp 0" }, lock_expires_at: expiresAt });
    await expect(service.removeItem(1n, 2n)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("NotificationService reads", () => {
  it("paginates notifications and only marks unread ones", async () => {
    const repository = {
      findByUser: vi.fn().mockResolvedValue({ data: [], total: 15, unread: 3 }),
      findByIdAndUser: vi.fn().mockResolvedValueOnce({ id: 4n, is_read: true }).mockResolvedValueOnce({ id: 5n, is_read: false }),
      markRead: vi.fn().mockResolvedValue({ id: 5n, is_read: true }),
      upsertPushToken: vi.fn(),
      deletePushToken: vi.fn().mockResolvedValue(1),
    };
    const service = new NotificationService(repository as never);

    await expect(service.getMine(1n, 1, 10)).resolves.toMatchObject({ unread: 3, totalPages: 2 });
    await expect(service.markRead(1n, 4n)).resolves.toEqual({ id: 4n, is_read: true });
    expect(repository.markRead).not.toHaveBeenCalled();
    await expect(service.markRead(1n, 5n)).resolves.toEqual({ id: 5n, is_read: true });
    await service.registerPushToken(1n, "ExponentPushToken[a]");
    expect(repository.upsertPushToken).toHaveBeenCalledWith(1n, "ExponentPushToken[a]");
    await expect(service.removePushToken(1n, "ExponentPushToken[a]")).resolves.toBeUndefined();
  });
});

describe("UserService role changes", () => {
  it("lets only admins change roles and skips no-op updates", async () => {
    const repository = { findById: vi.fn().mockResolvedValue({ id: 4n, email: "a@example.com" }), changeRole: vi.fn(), update: vi.fn() };
    const service = new UserService(repository as never, { requestEmailVerification: vi.fn() });

    await service.update(4n, { email: "a@example.com" }, "buyer", 1n);
    expect(repository.update).not.toHaveBeenCalled();
    await service.update(4n, { role_id: 3n }, "admin", 2n);
    expect(repository.changeRole).toHaveBeenCalledWith(4n, 3n, 2n);
  });
});
