import { Response } from 'express';
import mongoose from 'mongoose';
import DocumentModel from '../models/Document';
import { AuthRequest } from '../middleware/auth';
import { saveDocumentToGridFS } from '../services/documentService';
import { AppError } from '../middleware/errorHandler';

export const uploadDocument = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  if (!req.file) {
    throw new AppError('No document uploaded', 400);
  }

  if (!req.user) {
    throw new AppError('Not authenticated', 401);
  }

  const gridFsId = await saveDocumentToGridFS({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    mimeType: req.file.mimetype,
    uploadedBy: new mongoose.Types.ObjectId(req.user._id)
  });

  const document = await DocumentModel.create({
    originalName: req.file.originalname,
    fileName: req.file.originalname,
    mimeType: req.file.mimetype,
    size: req.file.size,
    gridFsId,
    uploadedBy: req.user._id
  });

  return res.status(201).json({
    success: true,
    message: 'Document uploaded successfully',
    data: {
      id: document._id,
      originalName: document.originalName,
      mimeType: document.mimeType,
      size: document.size,
      uploadedAt: document.createdAt
    }
  });
};