import { Request, Response, NextFunction } from 'express';
import EmailRecordModel from '../models/EmailRecord';
import { AppError } from '../middleware/errorHandler';
import EmailProcessingService from '../services/emailProcessingService';
import { AuthRequest } from '../middleware/auth';
import mongoose from 'mongoose';

const emailProcessingService = new EmailProcessingService(process.env.GEMINI_API_KEY || '');

export const getStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const service = emailProcessingService;
    const stats = await service.getStatistics();
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

export const getEmailById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { emailId } = req.params;
    
    const record = await EmailRecordModel.findOne({ emailId });
    
    if (!record) {
      throw new AppError('Email record not found', 404);
    }
    
    res.status(200).json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
};

export const getProcessedEmails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { category, status, limit = 100, skip = 0 } = req.query;
    
    const filter: any = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (status) {
      filter['comparisonResult.status'] = status;
    }
    
    const records = await EmailRecordModel.find(filter)
      .sort({ processedAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip))
      .select('-__v');
    
    res.status(200).json({
      success: true,
      data: records,
      total: records.length
    });
  } catch (error) {
    next(error);
  }
};

export const getAllProcessedEmails = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const records = await EmailRecordModel.find().sort({ processedAt: -1 });
    
    res.status(200).json({
      success: true,
      data: records
    });
  } catch (error) {
    next(error);
  }
};

// ============================================================
// Extract Email Record by ID
// ============================================================

export const getEmailRecordByEmailId = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { emailId } = req.params;

    if (!emailId) {
      throw new AppError('Email ID is required', 400);
    }

    const result = await emailProcessingService.getEmailRecordByEmailId(emailId);

    if (!result) {
      throw new AppError('Email record not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        emailRecord: {
          emailId: result.emailRecord.emailId,
          from: result.emailRecord.from,
          subject: result.emailRecord.subject,
          body: result.emailRecord.body,
          category: result.emailRecord.category,
          attachments: result.emailRecord.attachments,
          processedAt: result.emailRecord.processedAt,
          processedBy: result.emailRecord.processedBy
        },
        document: result.document ? {
          _id: result.document._id.toString(),
          originalName: result.document.get("originalName"),
          fileName: result.document.get("fileName"),
          mimeType: result.document.get("mimeType"),
          size: result.document.get("size"),
          uploadedBy: result.document.get("uploadedBy"),
          createdAt: result.document.get("createdAt"),
          updatedAt: result.document.get("updatedAt")
        } : null,
        gridFsData: result.gridFsData
      }
    });
  } catch (error) {
    console.error('Error getting email record by emailId:', error);
    throw error;
  }
};

export const getEmailRecordByMongoId = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { id } = req.params;

    if (!id) {
      throw new AppError('Email record ID is required', 400);
    }

    const objectId = new mongoose.Types.ObjectId(id);
    const result = await emailProcessingService.getEmailRecordByMongoId(objectId);

    if (!result) {
      throw new AppError('Email record not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: {
        emailRecord: result.emailRecord,
        document: result.document,
        gridFsData: result.gridFsData
      }
    });
  } catch (error) {
    console.error('Error getting email record by MongoDB ID:', error);
    throw error;
  }
};

// ============================================================
// Extract Email Records with Filters
// ============================================================

export const getEmailRecordsByCategory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { category, limit = 100, skip = 0 } = req.query;

    const result = await emailProcessingService.getEmailRecordsByCategory(
      category as string,
      Number(limit),
      Number(skip)
    );

    if (!result) {
      throw new AppError('No email records found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result.emailRecords,
      total: result.total
    });
  } catch (error) {
    console.error('Error getting email records by category:', error);
    throw error;
  }
};

export const getEmailRecordsByStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { status, limit = 100, skip = 0 } = req.query;

    const result = await emailProcessingService.getEmailRecordsByStatus(
      status as 'pending' | 'processing' | 'completed' | 'failed',
      Number(limit),
      Number(skip)
    );

    if (!result) {
      throw new AppError('No email records found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result.emailRecords,
      total: result.total
    });
  } catch (error) {
    console.error('Error getting email records by status:', error);
    throw error;
  }
};

export const getEmailRecordsByDateRange = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { startDate, endDate, limit = 100 } = req.query;

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const result = await emailProcessingService.getEmailRecordsByDateRange(
      start,
      end,
      Number(limit)
    );

    if (!result) {
      throw new AppError('No email records found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result.emailRecords,
      total: result.total
    });
  } catch (error) {
    console.error('Error getting email records by date range:', error);
    throw error;
  }
};

export const getEmailRecordsByUser = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    if (!req.user) {
      throw new AppError('Not authenticated', 401);
    }

    const result = await emailProcessingService.getEmailRecordsByUser(
      req.user._id
    );

    if (!result) {
      throw new AppError('No email records found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result.emailRecords,
      total: result.total
    });
  } catch (error) {
    console.error('Error getting email records by user:', error);
    throw error;
  }
};

// ============================================================
// Extract Email Records with Comparison Results
// ============================================================

export const getEmailRecordsWithComparison = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { status, limit = 100 } = req.query;

    const result = await emailProcessingService.getEmailRecordsWithComparison(
      status as 'OK' | 'MISMATCH' | 'NEEDS_REVIEW',
      Number(limit)
    );

    if (!result) {
      throw new AppError('No email records found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result.emailRecords,
      total: result.total
    });
  } catch (error) {
    console.error('Error getting email records with comparison:', error);
    throw error;
  }
};

export const getEmailRecordsWithDefects = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { limit = 100 } = req.query;

    const result = await emailProcessingService.getEmailRecordsWithDefects(
      Number(limit)
    );

    if (!result) {
      throw new AppError('No email records with defects found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result.emailRecords,
      total: result.total
    });
  } catch (error) {
    console.error('Error getting email records with defects:', error);
    throw error;
  }
};

// ============================================================
// Export Email Records
// ============================================================

export const exportEmailRecord = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { emailId } = req.params;

    const result = await emailProcessingService.exportEmailRecord(emailId);

    if (!result) {
      throw new AppError('Email record not found', 404);
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error exporting email record:', error);
    throw error;
  }
};

export const exportEmailRecords = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { emailIds } = req.body;

    if (!emailIds || !Array.isArray(emailIds)) {
      throw new AppError('Email IDs array is required', 400);
    }

    const result = await emailProcessingService.exportEmailRecords(emailIds);

    if (!result) {
      throw new AppError('Failed to export email records', 500);
    }

    return res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error exporting email records:', error);
    throw error;
  }
};

// ============================================================
// Statistics Endpoints
// ============================================================

export const getEmailStatistics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const stats = await emailProcessingService.getComparisonStatistics();

    return res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting email statistics:', error);
    throw error;
  }
};

// ============================================================
// Batch Operations
// ============================================================

export const bulkGetEmailRecords = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<Response> => {
  try {
    const { emailIds } = req.query;

    if (!emailIds || !Array.isArray(emailIds)) {
      throw new AppError('Email IDs array is required', 400);
    }

    const results = await Promise.all(
      emailIds.map(emailId => emailProcessingService.getEmailRecordByEmailId(emailId as string))
    );

    const validResults = results.filter(r => r !== null);

    return res.status(200).json({
      success: true,
      data: validResults,
      total: validResults.length,
      requested: emailIds.length
    });
  } catch (error) {
    console.error('Error bulk getting email records:', error);
    throw error;
  }
}