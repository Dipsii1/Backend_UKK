import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { env } from "../config/env.js";
import { AppError } from "./app-error.js";

export const ORGANIZER_DOCUMENT_TYPES = ["business_entity", "nib", "npwp", "pic_ktp"] as const;
export const EVENT_DOCUMENT_TYPES = [
  "cooperation_agreement",
  "venue_permit",
  "crowd_permit",
  "artist_confirmation",
  "liability_statement",
] as const;

export const DOCUMENT_MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 10 * 60;

export type DocumentFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export type StoredDocument = {
  storage_key: string;
  format: string;
  original_name: string;
  mime_type: string;
  size: number;
};

type DocumentRecord = StoredDocument & { type: string; created_at: Date; updated_at: Date | null };

const configure = () => {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(503, "STORAGE_UNAVAILABLE", "Penyimpanan berkas belum dikonfigurasi");
  }
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
    secure: true,
  });
};

// PDF, JPG, dan PNG adalah resource "image" di Cloudinary; type "private" membuat file hanya bisa diunduh lewat signed URL.
export const documentStorage = {
  async upload(file: DocumentFile, folder: string): Promise<StoredDocument> {
    configure();
    const result = await new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `ukk-2026/${folder}`, resource_type: "image", type: "private" }, (error, response) =>
          error || !response ? reject(error ?? new Error("Upload Cloudinary gagal")) : resolve(response),
        )
        .end(file.buffer);
    });
    return {
      storage_key: result.public_id,
      format: result.format,
      original_name: file.originalname.slice(0, 255),
      mime_type: file.mimetype,
      size: file.size,
    };
  },

  async remove(storageKey: string) {
    configure();
    await cloudinary.uploader.destroy(storageKey, { resource_type: "image", type: "private", invalidate: true });
  },

  signedUrl(storageKey: string, format: string) {
    configure();
    return cloudinary.utils.private_download_url(storageKey, format, {
      resource_type: "image",
      type: "private",
      expires_at: Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS,
    });
  },

  // Bentuk response: storage_key tidak dikirim, hanya signed URL berumur pendek.
  toOutput(document: DocumentRecord) {
    return {
      type: document.type,
      original_name: document.original_name,
      mime_type: document.mime_type,
      size: document.size,
      uploaded_at: document.updated_at ?? document.created_at,
      url: documentStorage.signedUrl(document.storage_key, document.format),
    };
  },

  // Upload paralel; bila salah satu gagal, file yang sudah terunggah dihapus agar tidak yatim.
  async uploadAll<T extends string>(files: [T, DocumentFile][], folder: string) {
    const results = await Promise.allSettled(files.map(([, file]) => documentStorage.upload(file, folder)));
    const failed = results.find((result) => result.status === "rejected");
    if (failed) {
      await documentStorage.removeAll(results.flatMap((result) => (result.status === "fulfilled" ? [result.value.storage_key] : [])));
      throw failed.reason;
    }
    return files.map(([type], index) => ({ type, ...(results[index] as PromiseFulfilledResult<StoredDocument>).value }));
  },

  async removeAll(storageKeys: string[]) {
    await Promise.allSettled(storageKeys.map((key) => documentStorage.remove(key)));
  },
};
