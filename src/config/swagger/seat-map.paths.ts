const auth = [{ bearerAuth: [] }];
const id = {
  name: "id",
  in: "path",
  required: true,
  schema: { type: "string", example: "1" },
};
const response = (description: string) => ({
  description,
  content: {
    "application/json": {
      schema: { type: "object" },
    },
  },
});

export const seatMapPaths = {
  "/events/{id}/seat-map": {
    get: {
      tags: ["Seat maps"],
      summary: "Ambil denah kursi event published",
      parameters: [
        id,
        { name: "x", in: "query", schema: { type: "integer" } },
        { name: "y", in: "query", schema: { type: "integer" } },
        { name: "width", in: "query", schema: { type: "integer" } },
        { name: "height", in: "query", schema: { type: "integer" } },
      ],
      responses: {
        "200": response("Primitive SVG untuk viewport yang diminta"),
        "404": response("Denah tidak ditemukan"),
      },
    },
  },
  "/organizer/event/{id}/seat-map": {
    get: {
      tags: ["Seat maps"],
      security: auth,
      summary: "Ambil denah untuk editor organizer",
      parameters: [id],
      responses: { "200": response("Denah editor") },
    },
    put: {
      tags: ["Seat maps"],
      security: auth,
      summary: "Simpan denah kursi terstruktur",
      parameters: [id],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["width", "height", "sections", "seats"],
            },
          },
        },
      },
      responses: {
        "200": response("Denah tersimpan"),
        "409": response("Denah sudah terkunci"),
      },
    },
  },
  "/seat-maps/{id}/reservations": {
    post: {
      tags: ["Seat maps"],
      security: auth,
      summary: "Tahan kursi buyer selama 5 menit dan tambahkan ke cart",
      parameters: [id],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["seat_ids"],
              properties: {
                seat_ids: {
                  type: "array",
                  items: { type: "string" },
                },
              },
            },
          },
        },
      },
      responses: {
        "201": response("Kursi ditahan"),
        "409": response("Kursi tidak tersedia"),
      },
    },
  },
} as const;
