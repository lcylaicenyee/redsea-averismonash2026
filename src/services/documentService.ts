import mongoose from 'mongoose';
import { Readable } from 'stream';

export interface UploadDocumentInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
}

export const saveDocumentToGridFS = (
  input: UploadDocumentInput
): Promise<mongoose.Types.ObjectId> => {
  return new Promise((resolve, reject) => {
    const db = mongoose.connection.db;

    if (!db) {
      return reject(new Error('Database connection is not ready'));
    }

    const bucket = new mongoose.mongo.GridFSBucket(db, {
      bucketName: 'documents'
    });

    const uploadStream = bucket.openUploadStream(input.filename, {
      metadata: {
        mimeType: input.mimeType,
        uploadedBy: input.uploadedBy
      }
    });

    uploadStream.on('finish', () => {
      resolve(uploadStream.id);
    });

    uploadStream.on('error', reject);

    Readable.from(input.buffer).pipe(uploadStream);
  });
};