import { Request, Response, NextFunction } from 'express';
import EmailRecordModel from '../models/EmailRecord';
import { EmailService, ProcessedEmailResult } from '../services/emailService';
import { AppError } from '../middleware/errorHandler';

export const processEmailFile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { filePath } = req.body;
    
    if (!filePath) {
      throw new AppError('File path is required', 400);
    }
    
    const service = new EmailService();
    const results = await service.processEmailFile(filePath);
    
    res.status(200).json({
      success: true,
      message: `Processed ${results.length} email(s)`,
      data: results.map(r => ({
        emailId: r.record.emailId,
        category: r.record.category,
        comparisonResult: r.record.comparisonResult,
        mongodbId: r.mongodbId
      }))
    });
  } catch (error) {
    next(error);
  }
};

export const getStatistics = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const service = new EmailService();
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