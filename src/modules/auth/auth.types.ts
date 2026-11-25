import type { DocumentFile, ORGANIZER_DOCUMENT_TYPES, StoredDocument } from "../../utils/document-storage.js";

export type OrganizerDocumentType = (typeof ORGANIZER_DOCUMENT_TYPES)[number];
export type OrganizerDocumentFiles = [OrganizerDocumentType, DocumentFile][];
export type OrganizerDocumentData = StoredDocument & { type: OrganizerDocumentType };

export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
};

export type RegisterOrganizerInput = RegisterInput & {
  companyName: string;
  slug: string;
  phone?: string;
  website?: string;
  description?: string;
};

export type RegisterResult = {
  user: {
    public_id: string;
    email: string;
    full_name: string;
  };
  message: string;
};

export type RegisterOrganizerResult = RegisterResult & {
  organizer: {
    public_id: string;
    company_name: string;
    slug: string;
    status: "pending";
  };
};

export type LoginInput = {
  email: string;
  password: string;
  role?: "admin" | "organizer" | "buyer";
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  user: {
    public_id: string;
    email: string;
    full_name: string;
    role: string;
  };
};

export type ProfileResult = {
  public_id: string;
  email: string;
  role: string;
  full_name: string | null;
  phone: string | null;
  gender: string | null;
  birth_date: Date | null;
  avatar: string | null;
  address: string | null;
  province_id: bigint | null;
  city_id: bigint | null;
};

export type UpdateProfileInput = {
  full_name?: string;
  phone?: string | null;
  gender?: "male" | "female" | "other" | null;
  birth_date?: Date | null;
  address?: string | null;
};

export type RefreshResult = {
  accessToken: string;
  refreshToken: string;
};

export type ResetPasswordInput = {
  token: string;
  newPassword: string;
};

export type ResetPasswordResult = {
  message: string;
};
