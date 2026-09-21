import EmailRecordModel from '../models/EmailRecord';
import { parseEmailFile, ParsedEmail } from '../utils/fileParser';
import GeminiService, { BLComparisonResponse } from './geminiService';
import { FIELD_MAPPINGS, FieldMapping } from '../types/blComparison';
import { EmailRecord, BLComparisonResult } from '../types/email';

interface EmailProcessingOptions {
  geminiApiKey?: string;
  useGemini: boolean;
}

export interface ProcessedEmailResult {
  record: EmailRecord;
  mongodbId?: any;
}

export class EmailService {
  private geminiService: GeminiService | null;

  constructor(geminiApiKey?: string) {
    this.geminiService = geminiApiKey ? new GeminiService(geminiApiKey) : null;
  }

  async processEmailFile(filePath: string): Promise<ProcessedEmailResult[]> {
    const processedRecords: ProcessedEmailResult[] = [];
    
    try {
      const parsedEmail = await parseEmailFile(filePath);
      
      // Step 1: Classify email
      const emailData = await this.classifyEmail(parsedEmail);
      
      // Step 2: Process BL_COMPARISON emails
      if (emailData.category === 'BL_COMPARISON') {
        const comparisonResult = await this.processBLComparison(parsedEmail);
        
        const record: EmailRecord = {
          ...emailData,
          comparisonResult,
          attachments: emailData.attachments?.map(a => a.name)
        };
        
        const savedRecord = await this.saveEmailRecord(record);
        processedRecords.push({ record, mongodbId: savedRecord._id });
      }
      
      // Step 3: Create record for other categories
      else {
        const record: EmailRecord = {
          ...emailData,
          category: emailData.category,
          attachments: emailData.attachments?.map(a => a.name)
        };
        
        const savedRecord = await this.saveEmailRecord(record);
        processedRecords.push({ record, mongodbId: savedRecord._id });
      }
      
    } catch (error) {
      console.error('Error processing email file:', error);
      throw error;
    }
    
    return processedRecords;
  }

  async classifyEmail(parsedEmail: ParsedEmail): Promise<EmailRecord> {
    const emailData = await this.geminiService!.classifyEmail({
      emailId: parsedEmail.emailId,
      from: parsedEmail.from,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      attachments: parsedEmail.attachments.map(a => a.name)
    });
    
    return {
      emailId: parsedEmail.emailId,
      from: parsedEmail.from,
      subject: parsedEmail.subject,
      body: parsedEmail.body,
      category: emailData.category,
      attachments: parsedEmail.attachments.map(a => a.name)
    };
  }

  async processBLComparison(parsedEmail: ParsedEmail): Promise<BLComparisonResult> {
    const siAttachment = parsedEmail.attachments.find(a => 
      a.name.toLowerCase().includes('si') || 
      a.name.toLowerCase().includes('shipping instruction')
    );
    
    const blAttachment = parsedEmail.attachments.find(a => 
      a.name.toLowerCase().includes('bl') || 
      a.name.toLowerCase().includes('bill of lading')
    );
    
    if (!siAttachment || !blAttachment) {
      return {
        status: 'NEEDS_REVIEW',
        reviewReason: 'missing_attachment'
      };
    }
    
    // Parse attachments
    const siData = this.parseAttachment(siAttachment);
    const blData = this.parseAttachment(blAttachment);
    
    if (!siData || !blData) {
      return {
        status: 'NEEDS_REVIEW',
        reviewReason: 'unreadable'
      };
    }
    
    // Step 1: Extract fields using field mappings
    const siFields = this.extractFields(siData, 'si');
    const blFields = this.extractFields(blData, 'bl');
    
    // Step 2: Compare fields
    const comparisonResult = await this.geminiService!.compareDocuments({
      emailId: parsedEmail.emailId,
      siData: siFields,
      blData: blFields,
      attachments: parsedEmail.attachments.map(a => a.name)
    });
    
    // Step 3: Normalize and format result
    const result: BLComparisonResult = {
      status: comparisonResult.status,
      siFields: comparisonResult.siFields,
      blFields: comparisonResult.blFields
    };
    
    if (comparisonResult.status === 'MISMATCH' && comparisonResult.mismatchDetails) {
      result.hasDefect = true;
      result.defectFields = comparisonResult.mismatchDetails.map(d => d.field);
    }
    
    if (comparisonResult.status === 'NEEDS_REVIEW' && comparisonResult.reviewReason) {
      result.reviewReason = comparisonResult.reviewReason;
    }
    
    return result;
  }

  private extractFields(data: Record<string, unknown>, prefix: string): Record<string, string> {
    const fields: Record<string, string> = {};
    const requiredFields = ['shipper', 'consignee', 'notifyParty', 'portOfLoading', 'portOfDischarge', 'containerCount', 'grossWeightKG'];
    
    requiredFields.forEach(field => {
      const mappedFields = FIELD_MAPPINGS[field]?.siField || FIELD_MAPPINGS[field]?.blField || field;
      
      // Check direct field
      if (data[field]) {
        fields[field] = String(data[field]).trim();
        return;
      }
      
      // Check mapped field
      if (data[mappedFields]) {
        fields[field] = String(data[mappedFields]).trim();
        return;
      }
      
      fields[field] = null;
    });
    
    return fields;
  }

  private parseAttachment(attachment: { name: string; content: string; buffer?: Buffer }): Record<string, unknown> | null {
    if (!attachment.content) {
      return null;
    }
    
    try {
      // Try JSON first
      try {
        return JSON.parse(attachment.content);
      } catch {
        // Try text parsing
        const lines = attachment.content.split('\n').filter(line => line.trim());
        const data: Record<string, unknown> = {};
        
        lines.forEach(line => {
          if (line.includes(':')) {
            const [key, ...valueParts] = line.split(':');
            data[key.trim()] = valueParts.join(':').trim();
          }
        });
        
        return data;
      }
    } catch {
      return null;
    }
  }

  async saveEmailRecord(record: EmailRecord): Promise<any> {
    const existing = await EmailRecordModel.findOne({ emailId: record.emailId });
    
    if (existing) {
      return existing;
    }
    
    return EmailRecordModel.create({
      ...record,
      processedAt: new Date(),
      processedBy: 'system'
    });
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
    
    const byStatus = await EmailRecordModel.aggregate([
      {
        $match: {
          'comparisonResult.status': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$comparisonResult.status',
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
      byStatus: byStatus.reduce((acc, doc) => {
        acc[doc._id] = doc.count;
        return acc;
      }, {} as Record<string, number>)
    };
  }
}

export default EmailService;
