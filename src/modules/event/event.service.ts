import { EventRepository } from "./event.repository.js";
import type { EventQuery, EventListResult, EventDetail } from "./event.types.js";
import { NotFoundError } from "../../utils/app-error.js";

export class EventService {
  constructor(private readonly eventRepo: EventRepository = new EventRepository()) {}

  async getEvents(filters: EventQuery): Promise<EventListResult> {
    return this.eventRepo.findAll(filters);
  }

  async getEventById(id: bigint): Promise<EventDetail> {
    const event = await this.eventRepo.findById(id);
    if (!event) throw new NotFoundError("Event tidak ditemukan");
    return event;
  }
}
