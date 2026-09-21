import mongoose from 'mongoose';
import { Readable } from 'stream';
import DocumentModel, { IDocument } from '../models/Document';
import { GridFSBucket } from 'mongodb';
import EmailRecordModel, { IEmailRecord } from '../models/EmailRecord';
import { EmailProcessingService } from './emailProcessingService';
import { EmailRecord } from '../types/email';

export interface UploadDocumentInput {
  buffer: Buffer;
  filename: string;
  mimeType: string;
  uploadedBy: mongoose.Types.ObjectId;
  fileContent?: string;
  emailContent?: string;
  emailSubject?: string;
  emailFrom?: string;
  emailAttachments?: Array<{ filename: string; content: string; buffer?: Buffer }>;
}

export interface GridFSUploadResult {
  gridFsId: mongoose.Types.ObjectId;
  filename: string;
  bucketName: string;
}

export class DocumentService {
  private emailProcessingService: EmailProcessingService;

  constructor(geminiApiKey: string) {
    this.emailProcessingService = new EmailProcessingService(geminiApiKey);
  }

  async saveDocumentToGridFS(
    input: UploadDocumentInput
  ): Promise<GridFSUploadResult> {
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
          uploadedBy: input.uploadedBy.toString(),
          documentType: 'FILE'
        }
      });

      uploadStream.on('finish', () => {
        resolve({
          gridFsId: uploadStream.id as mongoose.Types.ObjectId,
          filename: input.filename,
          bucketName: 'documents'
        });
      });

      uploadStream.on('error', reject);

      Readable.from(input.buffer).pipe(uploadStream);
    });
  }

  async loadDocumentFromGridFS(
    filename: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const db = mongoose.connection.db;

      if (!db) {
        return reject(new Error('Database connection is not ready'));
      }

      const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: 'documents'
      });

      const downloadStream = bucket.openDownloadStreamByName(filename, {});

      downloadStream.on('finish', () => {
        resolve(downloadStream.read());
      });

      downloadStream.on('error', reject);
    });
  }

  async processDocument(input: UploadDocumentInput): Promise<{
    document: IDocument;
    emailRecord?: IEmailRecord;
  }> {
    try {
      // Step 1: Save to GridFS
      const gridFsResult = await this.saveDocumentToGridFS(input);

      // Step 2: Determine document type
      const documentType = this.classifyDocumentType(input.filename, input.mimeType);

      // Step 3: Create document record
      const document = await DocumentModel.create({
        originalName: input.filename,
        fileName: input.filename,
        mimeType: input.mimeType,
        size: input.buffer.length,
        gridFsId: gridFsResult.gridFsId,
        uploadedBy: input.uploadedBy,
        documentType,
        processedAt: new Date(),
        processingStatus: 'completed'
      });

      // Step 4: If email, process through email pipeline
      if (documentType === 'EMAIL' || input.emailContent) {
        const emailInput: UploadDocumentInput = {
          ...input,
          emailContent: input.emailContent || '',
          emailSubject: input.emailSubject || '',
          emailFrom: input.emailFrom || '',
          emailAttachments: input.emailAttachments || []
        };

        const emailResult = await this.emailProcessingService.processEmailWithAttachments(
          emailInput.emailContent || '',
          emailInput.emailSubject || '',
          emailInput.emailFrom || '',
          emailInput.emailAttachments || [],
          input.uploadedBy
        );

        return {
          document,
          emailRecord: emailResult.emailRecord
        };
      }

      // Step 5: Update document with type
      await DocumentModel.updateOne(
        { _id: document._id },
        { documentType }
      );

      return { document };
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  private classifyDocumentType(
    filename: string,
    mimeType: string
  ): 'EMAIL' | 'ATTACHMENT' | 'OTHER' {
    const lowerName = filename.toLowerCase();
    const lowerMimeType = mimeType.toLowerCase();

    // Check for email files
    if (lowerMimeType.includes('json') || lowerName.endsWith('.json')) {
      return 'EMAIL';
    }

    // Check for email content patterns
    if (lowerMimeType.includes('text') && lowerMimeType.includes('plain')) {
      const isEmailLike = /from:|subject:|@/i.test(filename);
      if (isEmailLike) {
        return 'EMAIL';
      }
    }

    // Check attachment types
    if (lowerName.includes('si') || lowerName.includes('shipping')) {
      return 'ATTACHMENT';
    }

    if (lowerName.includes('bl') || lowerName.includes('bill')) {
      return 'ATTACHMENT';
    }

    if (lowerName.includes('invoice')) {
      return 'ATTACHMENT';
    }

    return 'OTHER';
  }

  async uploadDocument(input: UploadDocumentInput): Promise<{
    document: IDocument;
    emailRecord?: IEmailRecord;
  }> {
    return this.processDocument(input);
  }

  async getDocumentById(id: mongoose.Types.ObjectId): Promise<mongoose.Document | null> {
    return DocumentModel.findById(id).populate('uploadedBy', 'email username');
  }

  async getDocumentsByUser(userId: mongoose.Types.ObjectId): Promise<mongoose.Document[]> {
    return DocumentModel
      .find({ uploadedBy: userId })
      .sort({ createdAt: -1 })
      .populate('uploadedBy', 'email username')
      .populate('emailRecordId', 'emailId subject category comparisonResult');
  }

  async getDocumentsByType(
    documentType: 'EMAIL' | 'ATTACHMENT' | 'OTHER'
  ): Promise<mongoose.Document[]> {
    return DocumentModel
      .find({ documentType })
      .sort({ createdAt: -1 })
      .populate('emailRecordId', 'emailId subject category comparisonResult');
  }

  async getProcessedEmails(limit = 100, skip = 0): Promise<mongoose.Document[]> {
    const documents = await DocumentModel
      .find({
        documentType: 'EMAIL',
        processingStatus: { $in: ['completed', 'failed'] }
      })
      .populate('emailRecordId', 'emailId subject category comparisonResult')
      .sort({ processedAt: -1 })
      .limit(limit)
      .skip(skip);

    return documents;
  }

  async getStatistics(): Promise<{
    total: number;
    byType: Record<string, number>;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const total = await DocumentModel.countDocuments();

    const byType = await DocumentModel.aggregate([
      {
        $group: {
          _id: '$documentType',
          count: { $sum: 1 }
        }
      }
    ]);

    const byCategory = await DocumentModel.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    const byStatus = await DocumentModel.aggregate([
      {
        $group: {
          _id: '$processingStatus',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      total,
      byType: byType.reduce((acc, doc) => {
        acc[doc._id] = doc.count;
        return acc;
      }, {} as Record<string, number>),
      byCategory: byCategory.reduce((acc, doc) => {
        acc[doc._id] = doc.count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: byStatus.reduce((acc, doc) => {
        acc[doc._id] = doc.count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export default DocumentService;