import type { OrganizerStatus, OrderStatus } from "../../generated/prisma/client.js";

export type PaginationQuery = {
  page: number;
  limit: number;
};

export type UserQuery = PaginationQuery & {
  search?: string;
  role?: string;
  is_active?: boolean;
};

export type OrganizerQuery = PaginationQuery & {
  search?: string;
  status?: OrganizerStatus;
};

export type TransactionLogQuery = PaginationQuery & {
  status?: OrderStatus;
  start_date?: Date;
  end_date?: Date;
};
