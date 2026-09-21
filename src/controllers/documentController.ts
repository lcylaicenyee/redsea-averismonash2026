import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AuthRequest } from '../middleware/auth';
import DocumentModel from '../models/Document';
import EmailRecordModel from '../models/EmailRecord';
import { DocumentService } from '../services/documentService';
import { EmailProcessingService, EmailProcessingResult } from '../services/emailProcessingService';
import { AppError } from '../middleware/errorHandler';

const documentService = new DocumentService(process.env.GEMINI_API_KEY || '');

export const uploadDocument = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.file) {
      throw new AppError('No document uploaded', 400);
    }

    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const result = await documentService.uploadDocument({
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      uploadedBy: new mongoose.Types.ObjectId(req.user._id)
    });

    return res.status(201).json({
      success: true,
      message: 'Document uploaded and processed successfully',
      data: {
        id: result.document._id,
        originalName: result.document.originalName,
        fileName: result.document.fileName,
        mimeType: result.document.mimeType,
        size: result.document.size,
        documentType: result.document.documentType,
        category: result.emailRecord?.category || "N/A",
        emailRecordId: result.emailRecord?._id || "N/A",
        processedAt: result.emailRecord?.processedAt || "N/A",
        processingStatus: result.emailRecord?.comparisonResult || "N/A"
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    throw error;
  }
};

export const getDocumentById = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const { id } = req.params;

    const document = await DocumentModel
      .findById(id)
      .populate('uploadedBy', 'email username')
      .populate('emailRecordId', 'emailId subject body category comparisonResult processedAt');

    if (!document) {
      throw new AppError('Document not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: document
    });
  } catch (error) {
    console.error('Error getting document:', error);
    throw error;
  }
};

export const getDocumentsByUser = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const documents = await DocumentModel
      .find({ uploadedBy: req.user._id })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'email username')
      .populate('emailRecordId', 'emailId subject body category comparisonResult processedAt');

    return res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('Error getting user documents:', error);
    throw error;
  }
};

export const getStatistics = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    const stats = await documentService.getStatistics();

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    throw error;
  }
};

export const getProcessedEmails = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { limit = 100, skip = 0, category } = req.query;

    const filter: any = {
      documentType: 'EMAIL',
      processingStatus: { $in: ['completed', 'failed'] }
    };

    if (category) {
      filter.category = category;
    }

    const documents = await DocumentModel
      .find(filter)
      .populate('emailRecordId', 'emailId subject body category comparisonResult processedAt')
      .sort({ processedAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    return res.status(200).json({
      success: true,
      data: documents,
      total: documents.length
    });
  } catch (error) {
    console.error('Error getting processed emails:', error);
    throw error;
  }
};

export const getProcessedEmailsDirect = async (
  req: AuthRequest,
  res: Response
): Promise<Response> => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const { limit = 100, skip = 0, category } = req.query;

    const filter: any = {};

    if (category) {
      filter.category = category;
    }

    const emailRecords = await EmailRecordModel
      .find(filter)
      .sort({ processedAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));

    return res.status(200).json({
      success: true,
      data: emailRecords,
      total: emailRecords.length
    });
  } catch (error) {
    console.error('Error getting processed emails:', error);
    throw error;
  }
};
