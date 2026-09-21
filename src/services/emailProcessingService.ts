import mongoose from 'mongoose';
import EmailRecordModel, { IEmailRecord } from '../models/EmailRecord';
import DocumentModel, { IDocument } from '../models/Document';
import { parseEmailFile, ParsedEmail } from '../utils/fileParser';
import { FIELD_MAPPINGS } from '../types/blComparison';
import GeminiService from './geminiService';
import { BLComparisonResult, EmailRecord } from '../types/email';
import { UserService } from './userService';
import DocumentService from './documentService';
import { Readable, Writable } from 'stream';

export interface EmailProcessingResult {
  emailRecord: IEmailRecord;
  documentId?: mongoose.Types.ObjectId;
  processedAt: Date;
}

export interface EmailRecordResult {
  emailRecord: IEmailRecord;
  document?: mongoose.Document;
  gridFsData?: GridFsData;
}

export interface GridFsData {
  filename: string;
  bucketName: string;
  metadata?: any;
}

export class EmailProcessingService {
  private geminiService: GeminiService;

  constructor(geminiApiKey: string) {
    this.geminiService = new GeminiService(geminiApiKey);
  }

  async processEmail(
    emailContent: string,
    subject: string,
    from: string,
    attachments: Array<{
      filename: string;
      content: string;
      buffer?: Buffer;
    }>,
    uploadedBy: mongoose.Types.ObjectId
  ): Promise<EmailProcessingResult> {
    // Step 1: Parse email content
    const parsedEmail = await this.parseEmail(emailContent, subject, from, attachments.map(a => a.filename));

    // Step 2: Classify email
    const classification = await this.classifyEmail(parsedEmail);

    // Step 3: Process BL_COMPARISON emails if needed
    let comparisonResult = null;
    if (classification.category === 'BL_COMPARISON') {
      comparisonResult = await this.processBLComparison(parsedEmail);
    }

    // Step 4: Create EmailRecord
    const emailRecord = await EmailRecordModel.create({
      emailId: parsedEmail.emailId,
      from: parsedEmail.from,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      category: classification.category,
      attachments: parsedEmail.attachments,
      siData: comparisonResult?.siData || {},
      blData: comparisonResult?.blData || {},
      comparisonResult: comparisonResult,
      processedAt: new Date(),
      processedBy: 'system'
    });

    // Step 5: Create linked Document record
    const document = await this.createEmailDocument(
      parsedEmail.emailId,
      emailRecord._id,
      uploadedBy,
      classification.category
    );

    return {
      emailRecord,
      documentId: document._id,
      processedAt: new Date()
    };
  }

  async processEmailFile(
    filePath: string,
    uploadedBy: mongoose.Types.ObjectId
  ): Promise<EmailProcessingResult> {
    const parsedEmail = await parseEmailFile(filePath);
    return this.processEmail(
      parsedEmail.body,
      parsedEmail.subject,
      parsedEmail.from,
      parsedEmail.attachments.map(a => ({
        filename: a,
        content: '', // Will be loaded separately
        buffer: undefined
      })),
      uploadedBy
    );
  }

  async processEmailWithAttachments(
    emailContent: string,
    subject: string,
    from: string,
    attachments: Array<{ filename: string; content: string; buffer?: Buffer }>,
    uploadedBy: mongoose.Types.ObjectId
  ): Promise<EmailProcessingResult> {
    return this.processEmail(emailContent, subject, from, attachments, uploadedBy);
  }

  private async parseEmail(
    content: string,
    subject: string,
    from: string,
    attachmentNames: string[]
  ): Promise<ParsedEmail> {
    try {
      // Try to parse as JSON first (for JSON emails)
      try {
        const emailData = JSON.parse(content);
        return {
          emailId: emailData.email_id || emailData.id || `email_${Date.now()}`,
          from: emailData.from || from,
          subject: emailData.subject || subject,
          body: emailData.body || content,
          attachments: emailData.attachments || attachmentNames
        };
      } catch {
        // Fallback to manual parsing
        return {
          emailId: subject || from || `email_${Date.now()}`,
          from: from,
          subject: subject,
          body: content,
          attachments: attachmentNames
        };
      }
    } catch (error) {
      throw new Error(`Failed to parse email: ${error}`);
    }
  }

  private async classifyEmail(parsedEmail: ParsedEmail): Promise<{
    category: string;
    confidence: number;
  }> {
    const emailData = await this.geminiService.classifyEmail({
      emailId: parsedEmail.emailId,
      from: parsedEmail.from,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      attachments: parsedEmail.attachments
    });

    return {
      category: emailData.category,
      confidence: emailData.confidence
    };
  }

  private async processBLComparison(parsedEmail: ParsedEmail): Promise<{
    status: 'OK' | 'MISMATCH' | 'NEEDS_REVIEW'; 
    siData: Record<string, unknown>;
    blData: Record<string, unknown>;
    comparisonResult: any;
  }> {
    const siAttachment = parsedEmail.attachments.find(a =>
      a.toLowerCase().includes('si') ||
      a.toLowerCase().includes('shipping instruction')
    );

    const blAttachment = parsedEmail.attachments.find(a =>
      a.toLowerCase().includes('bl') ||
      a.toLowerCase().includes('bill of lading')
    );

    if (!siAttachment || !blAttachment) {
      return {
        status: 'NEEDS_REVIEW',
        siData: {},
        blData: {},
        comparisonResult: {
          status: 'NEEDS_REVIEW',
          reviewReason: 'missing_attachment'
        }
      };
    }

    // Load attachment content
    const siContent = await this.loadAttachmentContent(siAttachment);
    const blContent = await this.loadAttachmentContent(blAttachment);

    if (!siContent || !blContent) {
      return {
        status: 'NEEDS_REVIEW',
        siData: {},
        blData: {},
        comparisonResult: {
          status: 'NEEDS_REVIEW',
          reviewReason: 'unreadable'
        }
      };
    }

    // Parse attachments
    const siData = this.parseAttachment(siContent);
    const blData = this.parseAttachment(blContent);

    if (!siData || !blData) {
      return {
        status: 'NEEDS_REVIEW',
        siData: {},
        blData: {},
        comparisonResult: {
          status: 'NEEDS_REVIEW',
          reviewReason: 'missing_value'
        }
      };
    }

    // Use Gemini to compare
    const comparison = await this.geminiService.compareDocuments({
      emailId: parsedEmail.emailId,
      siData: siData,
      blData: blData,
      attachments: parsedEmail.attachments
    });

    return {
      status: comparison.status,
      siData,
      blData,
      comparisonResult: comparison
    };
  }

  private async loadAttachmentContent(filename: string): Promise<string> {
      return new Promise((resolve, reject) => {
      // In production, this would read from storage/GridFS
      // For now, return empty string - implement based on your storage
      try{
          const db = mongoose.connection.db;

          if (!db) {
            return reject(new Error('Database connection is not ready'));
          }

          const bucket = new mongoose.mongo.GridFSBucket(db, {
            bucketName: 'documents'
          });


          const downloadStream = bucket.openDownloadStreamByName(filename, {});
          const document = new Writable();

          let string = ""

          document._write = (chunk, enc, next) => {
            string += chunk.toString();
            next();
          }

          Readable.from(downloadStream).pipe(document);
          
          document.on('finish', () => {
            return resolve(string);
          })

          document.on('error', () => {
            return reject(new Error(`File cannot be parsed: ${filename}`));
          })
      }
      catch {
        return reject(new Error(`Attachment not found: ${filename}`));
      }
    })
  }

  private parseAttachment(content: string): Record<string, unknown> {
    try {
      // Try JSON first
      try {
        return JSON.parse(content);
      } catch {
        // Try text parsing
        const lines = content.split('\n').filter(line => line.trim());
        const data: Record<string, unknown> = {};

        lines.forEach(line => {
          if (line.includes(':')) {
            const [key, ...valueParts] = line.split(':');
            data[key.trim()] = valueParts.join(':').trim();
          }
        });

        return data;
      }
    } catch (error) {
      return {};
    }
  }

  private async createEmailDocument(
    emailId: string,
    emailRecordId: mongoose.Types.ObjectId,
    uploadedBy: mongoose.Types.ObjectId,
    category: string
  ): Promise<mongoose.Document> {
    return DocumentModel.create({
      originalName: `email_${emailId}.json`,
      fileName: `email_${emailId}.json`,
      mimeType: 'application/json',
      size: 0, // Will be updated
      gridFsId: new mongoose.Types.ObjectId(), // Will be updated
      uploadedBy,
      documentType: 'EMAIL',
      emailRecordId,
      emailId,
      subject: 'email', // Will be updated
      from: 'email', // Will be updated
      category,
      processedAt: new Date(),
      processingStatus: 'completed'
    });
  }

  async getProcessedEmails(limit = 100, skip = 0): Promise<IEmailRecord[]> {
    return EmailRecordModel
      .find()
      .sort({ processedAt: -1 })
      .skip(skip)
      .limit(limit);
  }

  async getProcessedEmailsByCategory(category: string): Promise<IEmailRecord[]> {
    return EmailRecordModel
      .find({ category })
      .sort({ processedAt: -1 });
  }

  async getStatistics(): Promise<{
    total: number;
    byCategory: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const total = await EmailRecordModel.countDocuments();

    const byCategory = await EmailRecordModel.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      }
    ]);

    return {
      total,
      byCategory: byCategory.reduce((acc, doc) => {
        acc[doc._id] = doc.count;
        return acc;
      }, {} as Record<string, number>),
      byStatus: {}
    };
  }

    // ============================================================
  // Extract Email Record by ID
  // ============================================================

  async getEmailRecordByEmailId(emailId: string): Promise<EmailRecordResult | null> {
    try {
      // Find email record by emailId
      const emailRecord = await EmailRecordModel.findOne({ emailId })
        .populate('processedBy', 'email username')
        .select('-__v');

      if (!emailRecord) {
        return null;
      }

      // Find linked document
      const document = await DocumentModel.findOne({ emailId })
        .populate('uploadedBy', 'email username')
        .populate('emailRecordId', 'emailId subject category comparisonResult')
        .select('-__v');

      // Get GridFS data if available
      let gridFsData = undefined;
      if (document?.gridFsId) {
        gridFsData = await this.getGridFsData(document.gridFsId);
      }

      return {
        emailRecord,
        document: document || undefined,
        gridFsData
      };
    } catch (error) {
      console.error('Error fetching email record by emailId:', error);
      throw error;
    }
  }

  async getEmailRecordByMongoId(id: mongoose.Types.ObjectId): Promise<EmailRecordResult | null> {
    try {
      const emailRecord = await EmailRecordModel.findById(id)
        .populate('processedBy', 'email username')
        .select('-__v');

      if (!emailRecord) {
        return null;
      }

      const document: IDocument = await DocumentModel.findOne({ emailRecordId: id })
        .populate('uploadedBy', 'email username')
        .select('-__v');

      let gridFsData = undefined;
      if (document?.gridFsId) {
        gridFsData = await this.getGridFsData(document.gridFsId);
      }

      return {
        emailRecord,
        document: document || undefined,
        gridFsData
      };
    } catch (error) {
      console.error('Error fetching email record by MongoDB ID:', error);
      throw error;
    }
  }

  async getEmailRecordWithDocuments(emailId: string): Promise<EmailRecordResult | null> {
    try {
      // Find primary email record
      const emailRecord = await EmailRecordModel.findOne({ emailId })
        .populate('processedBy', 'email username')
        .select('-__v');

      if (!emailRecord) {
        return null;
      }

      // Find all related documents
      const documents: IDocument[] = await DocumentModel.find({ emailRecordId: emailRecord._id })
        .populate('uploadedBy', 'email username')
        .sort({ createdAt: -1 })
        .select('-__v');

      // Get GridFS data for each document
      const documentsWithGridFs = await Promise.all(
        documents.map(async (doc) => {
          const gridFsData = doc.gridFsId ? await this.getGridFsData(doc.gridFsId) : null;
          return { ...doc.toObject(), gridFsData };
        })
      );

      return {
        emailRecord,
        document: documentsWithGridFs[0] || undefined,
        gridFsData: documentsWithGridFs[0]?.gridFsData || undefined
      };
    } catch (error) {
      console.error('Error fetching email record with documents:', error);
      throw error;
    }
  }

  // ============================================================
  // Extract Email Records with Filters
  // ============================================================

  async getEmailRecordsByCategory(
    category: string,
    limit: number = 100,
    skip: number = 0
  ): Promise<{ emailRecords: mongoose.Document[]; total: number } | null> {
    try {
      const total = await EmailRecordModel.countDocuments({ category });
      const emailRecords = await EmailRecordModel
        .find({ category })
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('processedBy', 'email username')
        .select('-__v');

      return { emailRecords, total };
    } catch (error) {
      console.error('Error fetching email records by category:', error);
      throw error;
    }
  }

  async getEmailRecordsByStatus(
    status: 'pending' | 'processing' | 'completed' | 'failed',
    limit: number = 100,
    skip: number = 0
  ): Promise<{ emailRecords: mongoose.Document[]; total: number } | null> {
    try {
      const total = await EmailRecordModel.countDocuments({
        processingStatus: status
      });

      const emailRecords = await EmailRecordModel
        .find({ processingStatus: status })
        .sort({ processedAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('processedBy', 'email username')
        .select('-__v');

      return { emailRecords, total };
    } catch (error) {
      console.error('Error fetching email records by status:', error);
      throw error;
    }
  }

  async getEmailRecordsByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 100
  ): Promise<{ emailRecords: mongoose.Document[]; total: number } | null> {
    try {
      const total = await EmailRecordModel.countDocuments({
        processedAt: {
          $gte: startDate,
          $lte: endDate
        }
      });

      const emailRecords = await EmailRecordModel
        .find({
          processedAt: {
            $gte: startDate,
            $lte: endDate
          }
        })
        .sort({ processedAt: -1 })
        .limit(limit)
        .populate('processedBy', 'email username')
        .select('-__v');

      return { emailRecords, total };
    } catch (error) {
      console.error('Error fetching email records by date range:', error);
      throw error;
    }
  }

  async getEmailRecordsByUser(userId: mongoose.Types.ObjectId): Promise<{ emailRecords: mongoose.Document[]; total: number } | null> {
    try {
      // Find documents uploaded by user
      const documentIds = await DocumentModel.distinct('emailRecordId', { uploadedBy: userId });
      
      const total = await EmailRecordModel.countDocuments({ _id: { $in: documentIds } });
      const emailRecords = await EmailRecordModel
        .find({ _id: { $in: documentIds } })
        .sort({ processedAt: -1 })
        .populate('processedBy', 'email username')
        .select('-__v');

      return { emailRecords, total };
    } catch (error) {
      console.error('Error fetching email records by user:', error);
      throw error;
    }
  }

  // ============================================================
  // Extract Email Records with Comparison Results
  // ============================================================

  async getEmailRecordsWithComparison(
    status: 'OK' | 'MISMATCH' | 'NEEDS_REVIEW',
    limit: number = 100
  ): Promise<{ emailRecords: mongoose.Document[]; total: number } | null> {
    try {
      const total = await EmailRecordModel.countDocuments({
        'comparisonResult.status': status
      });

      const emailRecords = await EmailRecordModel
        .find({ 'comparisonResult.status': status })
        .sort({ processedAt: -1 })
        .populate('processedBy', 'email username')
        .select('-__v')
        .limit(limit);

      return { emailRecords, total };
    } catch (error) {
      console.error('Error fetching email records with comparison:', error);
      throw error;
    }
  }

  async getEmailRecordsWithDefects(limit: number = 100): Promise<{ emailRecords: mongoose.Document[]; total: number } | null> {
    try {
      const total = await EmailRecordModel.countDocuments({
        'comparisonResult.hasDefect': true
      });

      const emailRecords = await EmailRecordModel
        .find({ 'comparisonResult.hasDefect': true })
        .sort({ processedAt: -1 })
        .populate('processedBy', 'email username')
        .select('-__v')
        .limit(limit);

      return { emailRecords, total };
    } catch (error) {
      console.error('Error fetching email records with defects:', error);
      throw error;
    }
  }

  // ============================================================
  // Extract Email Record with Full Details
  // ============================================================

  async getFullEmailRecord(emailId: string): Promise<FullEmailRecordResult | null> {
    try {
      const result = await this.getEmailRecordByEmailId(emailId);
      
      if (!result) {
        return null;
      }

      // Get full comparison details
      const comparisonDetails = result.emailRecord.comparisonResult;
      
      // Get related attachments
      const attachments = await this.getAttachmentsByEmailId(emailId);
      
      // Get statistics
      const statistics = await this.getComparisonStatistics();
      
      return {
        ...result,
        comparisonDetails: {
          status: comparisonDetails.get("status"),
          hasDefect: comparisonDetails.get("hasDefect"),
          defectFields: comparisonDetails.get("defectFields"),
          reviewReason: comparisonDetails.get("reviewReason"),
          siFields: comparisonDetails.get("siFields"),
          blFields: comparisonDetails.get("biFields")
        },
        attachments,
        statistics
      };
    } catch (error) {
      console.error('Error fetching full email record:', error);
      throw error;
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  private async getGridFsData(gridFsId: mongoose.Types.ObjectId): Promise<GridFsData | undefined> {
    try {
      const db = mongoose.connection.db;
      if (!db) {
        return undefined;
      }

      const bucket = new mongoose.mongo.GridFSBucket(db, {
        bucketName: 'documents'
      });

      const file = await bucket.find({ _id: gridFsId }).toArray();
      
      if (file.length === 0) {
        return undefined;
      }

      return {
        filename: file[0].filename,
        bucketName: 'documents',
        metadata: file[0].metadata || undefined
      };
    } catch (error) {
      console.error('Error fetching GridFS data:', error);
      return undefined;
    }
  }

  private async getAttachmentsByEmailId(emailId: string): Promise<any[]> {
    try {
      // This would query attachments stored with the email
      // For now, return empty array - implement based on your storage
      return [];
    } catch (error) {
      console.error('Error fetching attachments:', error);
      return [];
    }
  }

  public async getComparisonStatistics(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    try {
      const total = await EmailRecordModel.countDocuments();

      const byStatus = await EmailRecordModel.aggregate([
        {
          $match: { 'comparisonResult.status': { $exists: true } }
        },
        {
          $group: {
            _id: '$comparisonResult.status',
            count: { $sum: 1 }
          }
        }
      ]);

      const byCategory = await EmailRecordModel.aggregate([
        {
          $group: {
            _id: '$category',
            count: { $sum: 1 }
          }
        }
      ]);

      return {
        total,
        byStatus: byStatus.reduce((acc, doc) => {
          acc[doc._id] = doc.count;
          return acc;
        }, {} as Record<string, number>),
        byCategory: byCategory.reduce((acc, doc) => {
          acc[doc._id] = doc.count;
          return acc;
        }, {} as Record<string, number>)
      };
    } catch (error) {
      console.error('Error fetching comparison statistics:', error);
      return { total: 0, byStatus: {}, byCategory: {} };
    }
  }

  // ============================================================
  // Export Functions
  // ============================================================

  async exportEmailRecord(emailId: string): Promise<ExportedEmailRecord | null> {
    try {
      const result = await this.getFullEmailRecord(emailId);
      
      if (!result) {
        return null;
      }

      return {
        emailId: result.emailRecord.emailId,
        from: result.emailRecord.from,
        subject: result.emailRecord.subject,
        body: result.emailRecord.body,
        category: result.emailRecord.category,
        attachments: result.emailRecord.attachments,
        comparisonResult: result.comparisonDetails,
        processedAt: result.emailRecord.processedAt,
        processedBy: result.emailRecord.processedBy,
        document: result.document ? {
          _id: result.document._id.toString(),
          originalName: result.document.get("originalName"),
          fileName: result.document.get("fileName"),
          mimeType: result.document.get("mimeType"),
          size: result.document.get("size"),
          uploadedBy: result.document.get("uploadedBy").toString(),
          createdAt: result.document.get("createdAt"),
          updatedAt: result.document.get("updatedAt")
        } : undefined,
        statistics: result.statistics
      };
    } catch (error) {
      console.error('Error exporting email record:', error);
      throw error;
    }
  }

  async exportEmailRecords(
    emailIds: string[],
  ): Promise<ExportedEmailRecords | null> {
    try {
      const results = await Promise.all(
        emailIds.map(emailId => this.exportEmailRecord(emailId))
      );

      const filtered = results.filter(r => r !== null);

      return {
        emailIds: emailIds.map(id => id),
        records: filtered,
        total: filtered.length,
        exportedAt: new Date()
      };
    } catch (error) {
      console.error('Error exporting email records:', error);
      throw error;
    }
  }
}

// ============================================================
// Export Types
// ============================================================

export interface FullEmailRecordResult extends EmailRecordResult {
  comparisonDetails?: {
    status: 'OK' | 'MISMATCH' | 'NEEDS_REVIEW';
    hasDefect?: boolean;
    defectFields?: string[];
    reviewReason?: 'wrong_doc_type' | 'missing_attachment' | 'unreadable' | 'missing_value';
    siFields?: Array<{ field: string; value: string | null }>;
    blFields?: Array<{ field: string; value: string | null }>;
  };
  attachments?: any[];
  statistics?: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export interface ExportedEmailRecord {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  category: string;
  attachments: string[];
  comparisonResult?: {
    status: 'OK' | 'MISMATCH' | 'NEEDS_REVIEW';
    hasDefect?: boolean;
    defectFields?: string[];
    reviewReason?: 'wrong_doc_type' | 'missing_attachment' | 'unreadable' | 'missing_value';
    siFields?: Array<{ field: string; value: string | null }>;
    blFields?: Array<{ field: string; value: string | null }>;
  };
  processedAt: Date;
  processedBy?: string;
  document?: {
    _id: string;
    originalName: string;
    fileName: string;
    mimeType: string;
    size: number;
    uploadedBy: string;
    createdAt: Date;
    updatedAt: Date;
  };
  statistics?: {
    total: number;
    byStatus: Record<string, number>;
    byCategory: Record<string, number>;
  };
}

export interface ExportedEmailRecords {
  emailIds: string[];
  records: ExportedEmailRecord[];
  total: number;
  exportedAt: Date;
}

export default EmailProcessingService;
