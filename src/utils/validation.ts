import { z } from "zod";
import { ValidationError } from "./app-error.js";

export const parseSchema = <S extends z.ZodType>(schema: S, input: unknown): z.output<S> => {
  const result = schema.safeParse(input);
  if (!result.success) {
    const errors = result.error.issues.map(({ path, message }) => ({
      field: path.join("."),
      message,
    }));
    throw new ValidationError("Validasi gagal", errors);
  }
  return result.data;
};

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});
