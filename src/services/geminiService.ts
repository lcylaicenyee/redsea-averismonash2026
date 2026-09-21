import { GoogleGenerativeAI } from '@google/generative-ai';

export interface EmailClassificationRequest {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  attachments?: string[];
}

export interface EmailClassificationResponse {
  category: 'BL_COMPARISON' | 'SI_REQUEST' | 'INVOICE_QUERY' | 'GENERAL' | 'SPAM';
  confidence: number;
  reason?: string;
}

export interface BLComparisonRequest {
  emailId: string;
  siData: Record<string, unknown>;
  blData: Record<string, unknown>;
  attachments?: string[];
}

export interface BLComparisonResponse {
  status: 'OK' | 'MISMATCH' | 'NEEDS_REVIEW';
  siFields: {
    field: string;
    value: string | null;
  }[];
  blFields: {
    field: string;
    value: string | null;
  }[];
  mismatchDetails?: {
    field: string;
    siValue: string;
    blValue: string;
  }[];
  reviewReason?: 'wrong_doc_type' | 'missing_attachment' | 'unreadable' | 'missing_value';
}

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: 'gemini-1.5-pro' });
  }

  async classifyEmail(request: EmailClassificationRequest): Promise<EmailClassificationResponse> {
    const prompt = `
      You are an email classifier. Classify the following email into one of these categories:
      1. BL_COMPARISON: Email contains Shipping Instruction (SI) and/or Bill of Lading (BL) for comparison
      2. SI_REQUEST: Email requests a Shipping Instruction
      3. INVOICE_QUERY: Email queries or discusses an invoice
      4. GENERAL: General correspondence, not related to shipping documents
      5. SPAM: Unsolicited or suspicious email
      
      Email data:
      - From: ${request.from}
      - Subject: ${request.subject}
      - Body: ${request.body}
      
      Provide JSON response: {"category": "CATEGORY_NAME", "confidence": 0.0-1.0, "reason": "brief explanation"}
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from response
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Failed to parse Gemini response');
    }
    
    return JSON.parse(match[0]);
  }

  async compareDocuments(request: BLComparisonRequest): Promise<BLComparisonResponse> {
    const siText = this.formatDocumentData(request.siData);
    const blText = this.formatDocumentData(request.blData);
    
    const prompt = `
      Compare the following Shipping Instruction (SI) with Bill of Lading (BL) document.
      
      SI Data:
      ${siText}
      
      BL Data:
      ${blText}
      
      Compare these 7 critical fields (align by meaning, not just field name):
      1. Shipper / Consignor
      2. Consignee
      3. Notify Party
      4. Port of Loading (may be labeled as Load Port, POL, Place of Receipt)
      5. Port of Discharge (may be labeled as Discharge Port, POD, Destination)
      6. Container Count (may be labeled as No. of Containers, Container Count)
      7. Gross Weight in KG (may be labeled as Gross Weight, Total Weight, Gross Mass)
      
      Return JSON response:
      {
        "status": "OK" | "MISMATCH" | "NEEDS_REVIEW",
        "siFields": [{"field": "field_name", "value": "value"}],
        "blFields": [{"field": "field_name", "value": "value"}],
        "mismatchDetails": [{"field": "field_name", "siValue": "value", "blValue": "value"}] (only if MISMATCH),
        "reviewReason": "wrong_doc_type" | "missing_attachment" | "unreadable" | "missing_value" (only if NEEDS_REVIEW)
      }
      
      Rules:
      - "OK": All 7 critical fields match
      - "MISMATCH": 1 or more fields differ
      - "NEEDS_REVIEW": Cannot determine (wrong doc type, missing attachment, unreadable, or missing values)
    `;

    const result = await this.model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error('Failed to parse Gemini response');
    }
    
    const parsed = JSON.parse(match[0]);
    
    // Normalize the response
    return {
      status: parsed.status,
      siFields: parsed.siFields,
      blFields: parsed.blFields,
      mismatchDetails: parsed.mismatchDetails,
      reviewReason: parsed.reviewReason
    };
  }

  private formatDocumentData(data: Record<string, unknown>): string {
    const fields = [
      'shipper', 'consignee', 'notifyParty', 'portOfLoading', 
      'portOfDischarge', 'containerCount', 'grossWeightKG'
    ];
    
    return fields.map(field => {
      const value = data[field];
      return value ? `${field}: ${value}` : `${field}: ${value}`;
    }).join('\n');
  }
}

export default GeminiService;