import DocumentModel from '../models/Document';
import { IDocument } from '../models/Document';
import { parseEmailFile, ParsedEmail } from '../utils/fileParser';
import { FIELD_MAPPINGS } from '../types/blComparison';

export interface ClassificationResult {
  documentType: 'EMAIL' | 'ATTACHMENT' | 'OTHER';
  category?: 'BL_COMPARISON' | 'SI_REQUEST' | 'INVOICE_QUERY' | 'GENERAL' | 'SPAM';
  isEmail: boolean;
  parsedData?: ParsedEmail;
}

export interface EmailClassificationResult {
  category: 'BL_COMPARISON' | 'SI_REQUEST' | 'INVOICE_QUERY' | 'GENERAL' | 'SPAM';
  confidence: number;
}

export class DocumentClassificationService {
  
  async classifyDocument(
    originalName: string,
    mimeType: string,
    content?: string
  ): Promise<ClassificationResult> {
    const lowerName = originalName.toLowerCase();
    const lowerMimeType = mimeType.toLowerCase();
    
    // Check if it's an email file
    if (lowerMimeType.includes('json') || lowerName.endsWith('.json')) {
      return this.classifyEmailFile(originalName, content || '');
    }
    
    // Check if it's a text/email content
    if (lowerMimeType.includes('text') && lowerMimeType.includes('plain')) {
      return this.classifyTextContent(originalName, content || '');
    }
    
    // Check attachment types
    if (lowerName.includes('si') || lowerName.includes('shipping') || lowerName.includes('instruction')) {
      return {
        documentType: 'ATTACHMENT',
        category: 'BL_COMPARISON',
        isEmail: false,
        parsedData: undefined
      };
    }
    
    if (lowerName.includes('bl') || lowerName.includes('bill') || lowerName.includes('lading')) {
      return {
        documentType: 'ATTACHMENT',
        category: 'BL_COMPARISON',
        isEmail: false,
        parsedData: undefined
      };
    }
    
    if (lowerName.includes('invoice')) {
      return {
        documentType: 'ATTACHMENT',
        category: 'INVOICE_QUERY',
        isEmail: false,
        parsedData: undefined
      };
    }
    
    // Default classification
    return {
      documentType: 'OTHER',
      category: 'GENERAL',
      isEmail: false,
      parsedData: undefined
    };
  }
  
  async classifyEmailFile(
    filename: string,
    content: string
  ): Promise<ClassificationResult> {
    try {
      // Parse the email file
      const parsedEmail = await parseEmailFile(filename);
      
      // Determine category based on subject/body content
      const category = this.extractEmailCategory(parsedEmail.subject, parsedEmail.body);
      
      return {
        documentType: 'EMAIL',
        category,
        isEmail: true,
        parsedData: parsedEmail
      };
    } catch (error) {
      console.error('Error parsing email file:', error);
      return {
        documentType: 'OTHER',
        category: 'GENERAL',
        isEmail: false,
        parsedData: undefined
      };
    }
  }
  
  async classifyTextContent(
    filename: string,
    content: string
  ): Promise<ClassificationResult> {
    // Check for email-like content
    const emailPatterns = [
      /From:\s*/i,
      /Subject:\s*/i,
      /\b(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/i,
      /Dear\s+/i,
      /Best\s+Regards\s*/i
    ];
    
    const isEmailLike = emailPatterns.some(pattern => pattern.test(content));
    
    if (isEmailLike) {
      return {
        documentType: 'EMAIL',
        category: 'GENERAL',
        isEmail: true,
        parsedData: {
          emailId: filename,
          from: '',
          subject: '',
          body: content,
          attachments: []
        }
      };
    }
    
    return {
      documentType: 'ATTACHMENT',
      category: 'GENERAL',
      isEmail: false,
      parsedData: undefined
    };
  }
  
  private extractEmailCategory(subject: string, body: string): 'BL_COMPARISON' | 'SI_REQUEST' | 'INVOICE_QUERY' | 'GENERAL' | 'SPAM' {
    const subjectLower = subject.toLowerCase();
    const bodyLower = body.toLowerCase();
    
    // Check for BL comparison indicators
    if (subjectLower.includes('bl') && subjectLower.includes('si')) {
      return 'BL_COMPARISON';
    }
    if (bodyLower.includes('compare') || bodyLower.includes('verify') || bodyLower.includes('check')) {
      return 'BL_COMPARISON';
    }
    
    // Check for SI request indicators
    if (subjectLower.includes('request') || bodyLower.includes('please send') || bodyLower.includes('need si')) {
      return 'SI_REQUEST';
    }
    
    // Check for invoice indicators
    if (subjectLower.includes('invoice') || bodyLower.includes('billing') || bodyLower.includes('payment')) {
      return 'INVOICE_QUERY';
    }
    
    // Check for spam indicators
    if (bodyLower.includes('warning') || bodyLower.includes('unsubscribe') || bodyLower.includes('click here')) {
      return 'SPAM';
    }
    
    // Default to GENERAL
    return 'GENERAL';
  }
  
  async classifyAndProcessEmail(
    emailData: ParsedEmail,
    attachments: Array<{ name: string; content: string; buffer?: Buffer }>
  ): Promise<ClassificationResult> {
    // Step 1: Classify the email
    const classification = await this.classifyEmailFile(emailData.emailId, emailData.body);
    
    // Step 2: If BL_COMPARISON, check for attachments
    if (classification.category === 'BL_COMPARISON') {
      const siAttachment = attachments.find(a => 
        a.name.toLowerCase().includes('si') || 
        a.name.toLowerCase().includes('shipping instruction')
      );
      
      const blAttachment = attachments.find(a => 
        a.name.toLowerCase().includes('bl') || 
        a.name.toLowerCase().includes('bill of lading')
      );
      
      // Extract data from attachments for comparison
      if (siAttachment && blAttachment) {
        const siData = this.parseAttachment(siAttachment);
        const blData = this.parseAttachment(blAttachment);
        
        if (siData && blData) {
          const comparisonResult = await this.compareDocuments(siData, blData);
          
          classification.category = 'BL_COMPARISON';
          classification.parsedData = emailData;
        }
      }
    }
    
    return classification;
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
  
  private compareDocuments(
    siData: Record<string, unknown>,
    blData: Record<string, unknown>
  ): Record<string, unknown> {
    // This would integrate with Gemini API for intelligent comparison
    // For now, return a basic comparison structure
    return {
      status: 'OK',
      siFields: [
        { field: 'shipper', value: String(siData.shipper || '') },
        { field: 'consignee', value: String(siData.consignee || '') },
        { field: 'notifyParty', value: String(siData.notifyParty || '') },
        { field: 'portOfLoading', value: String(siData.portOfLoading || '') },
        { field: 'portOfDischarge', value: String(siData.portOfDischarge || '') },
        { field: 'containerCount', value: String(siData.containerCount || '') },
        { field: 'grossWeightKG', value: String(siData.grossWeightKG || '') }
      ],
      blFields: [
        { field: 'shipper', value: String(blData.shipper || '') },
        { field: 'consignee', value: String(blData.consignee || '') },
        { field: 'notifyParty', value: String(blData.notifyParty || '') },
        { field: 'portOfLoading', value: String(blData.portOfLoading || '') },
        { field: 'portOfDischarge', value: String(blData.portOfDischarge || '') },
        { field: 'containerCount', value: String(blData.containerCount || '') },
        { field: 'grossWeightKG', value: String(blData.grossWeightKG || '') }
      ]
    };
  }
}

export default DocumentClassificationService;