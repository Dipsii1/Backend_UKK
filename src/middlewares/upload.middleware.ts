import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { ValidationError } from "../utils/app-error.js";
import { DOCUMENT_MAX_BYTES } from "../utils/document-storage.js";

// Tipe file ditentukan dari magic bytes, bukan dari Content-Type kiriman client.
const SIGNATURES: [string, number[]][] = [
  ["application/pdf", [0x25, 0x50, 0x44, 0x46]],
  ["image/png", [0x89, 0x50, 0x4e, 0x47]],
  ["image/jpeg", [0xff, 0xd8, 0xff]],
];

export const detectDocumentMime = (buffer: Buffer) =>
  SIGNATURES.find(([, signature]) => signature.every((byte, index) => buffer[index] === byte))?.[0];

const MULTER_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: "Ukuran berkas maksimal 5 MB",
  LIMIT_UNEXPECTED_FILE: "Field berkas tidak dikenal atau lebih dari satu file",
  LIMIT_FILE_COUNT: "Jumlah berkas melebihi batas",
};

// Semua field wajib berisi tepat satu berkas PDF/JPG/PNG.
export const uploadDocuments = (fields: readonly string[]) => {
  const parse = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: DOCUMENT_MAX_BYTES, files: fields.length, fields: 20 },
  }).fields(fields.map((name) => ({ name, maxCount: 1 })));

  return (req: Request, res: Response, next: NextFunction) => {
    parse(req, res, (error: unknown) => {
      if (error instanceof multer.MulterError) {
        next(new ValidationError("Berkas tidak valid", [{ field: error.field ?? "file", message: MULTER_MESSAGES[error.code] ?? error.message }]));
        return;
      }
      if (error) {
        next(error);
        return;
      }

      const files = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
      const errors = fields.flatMap((field) => {
        const file = files[field]?.[0];
        if (!file) return [{ field, message: "Berkas wajib diunggah" }];
        const mime = detectDocumentMime(file.buffer);
        if (!mime) return [{ field, message: "Berkas harus PDF, JPG, atau PNG" }];
        file.mimetype = mime;
        return [];
      });
      if (errors.length > 0) {
        next(new ValidationError("Berkas tidak valid", errors));
        return;
      }
      next();
    });
  };
};
