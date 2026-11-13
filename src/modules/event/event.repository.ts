import { prisma } from "../../lib/prisma.js";
import type { Prisma } from "../../generated/prisma/client.js";
import type { EventQuery, EventListResult, EventDetail } from "./event.types.js";

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) return 0;
  if (typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return typeof value === "number" ? value : 0;
};

export class EventRepository {
  async findAll(params: EventQuery): Promise<EventListResult> {
    const { page, limit, search, location, date, category, min_price, max_price } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.eventsWhereInput = {
      status: "published",
      is_published: true,
    };

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { summary: { contains: search, mode: "insensitive" } },
        { description: { contains: search, mode: "insensitive" } },
      ];
    }

    if (location) {
      where.venue = {
        city: {
          OR: [
            { name: { contains: location, mode: "insensitive" } },
            { province: { name: { contains: location, mode: "insensitive" } } },
          ],
        },
      };
    }

    if (date) {
      const start = new Date(`${date}T00:00:00.000Z`);
      const end = new Date(`${date}T23:59:59.999Z`);
      where.start_at = { gte: start, lte: end };
    }

    if (category) {
      where.category = {
        OR: [
          { slug: { equals: category, mode: "insensitive" } },
          { name: { contains: category, mode: "insensitive" } },
        ],
      };
    }

    if (min_price !== undefined || max_price !== undefined) {
      const priceFilter: Prisma.DecimalFilter = {};
      if (min_price !== undefined) priceFilter.gte = min_price;
      if (max_price !== undefined) priceFilter.lte = max_price;
      where.ticketTypes = { some: { price: priceFilter } };
    }

    const [events, total] = await prisma.$transaction([
      prisma.events.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ is_featured: "desc" }, { start_at: "asc" }],
        select: {
          id: true,
          public_id: true,
          title: true,
          slug: true,
          summary: true,
          banner: true,
          thumbnail: true,
          start_at: true,
          end_at: true,
          is_featured: true,
          created_at: true,
          category: { select: { id: true, public_id: true, name: true, slug: true } },
          venue: {
            select: {
              id: true,
              public_id: true,
              name: true,
              slug: true,
              address: true,
              city: {
                select: {
                  id: true,
                  name: true,
                  province: { select: { id: true, name: true } },
                },
              },
            },
          },
          ticketTypes: {
            select: {
              id: true,
              public_id: true,
              name: true,
              description: true,
              price: true,
              quota: true,
              sold: true,
              max_purchase: true,
              sale_start_at: true,
              sale_end_at: true,
              status: true,
            },
            where: { status: "active" },
          },
        },
      }),
      prisma.events.count({ where }),
    ]);

    return {
      data: events.map((event) => ({
        ...event,
        ticketTypes: (event.ticketTypes ?? []).map((t) => ({
          ...t,
          price: toNumber(t.price),
        })),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findById(id: bigint): Promise<EventDetail | null> {
    const event = await prisma.events.findFirst({
      where: { id, status: "published", is_published: true },
      select: {
        id: true,
        public_id: true,
        title: true,
        slug: true,
        summary: true,
        description: true,
        banner: true,
        thumbnail: true,
        poster: true,
        minimum_age: true,
        dress_code: true,
        gate_open_at: true,
        start_at: true,
        end_at: true,
        sales_start_at: true,
        sales_end_at: true,
        status: true,
        is_featured: true,
        is_published: true,
        created_at: true,
        updated_at: true,
        category: { select: { id: true, public_id: true, name: true, slug: true } },
        venue: {
          select: {
            id: true,
            public_id: true,
            name: true,
            slug: true,
            image: true,
            address: true,
            latitude: true,
            longitude: true,
            google_maps_url: true,
            capacity: true,
            is_active: true,
            city: {
              select: {
                id: true,
                code: true,
                name: true,
                province: {
                  select: {
                    id: true,
                    code: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
        ticketTypes: {
          select: {
            id: true,
            public_id: true,
            name: true,
            description: true,
            price: true,
            quota: true,
            sold: true,
            max_purchase: true,
            sale_start_at: true,
            sale_end_at: true,
            status: true,
            created_at: true,
            updated_at: true,
          },
          orderBy: { price: "asc" },
        },
      },
    });

    if (!event) return null;

    return {
      ...event,
      venue: {
        ...event.venue,
        latitude: toNumber(event.venue.latitude),
        longitude: toNumber(event.venue.longitude),
      },
      ticketTypes: event.ticketTypes.map((t) => ({
        ...t,
        price: toNumber(t.price),
      })),
    } as EventDetail;
  }
}
