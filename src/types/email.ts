import { ObjectId } from 'mongodb';

export type EmailCategory = 
  | 'BL_COMPARISON' 
  | 'SI_REQUEST' 
  | 'INVOICE_QUERY' 
  | 'GENERAL' 
  | 'SPAM';

export type BLComparisonStatus = 'OK' | 'MISMATCH' | 'NEEDS_REVIEW';

export interface BLComparisonResult {
  status: BLComparisonStatus;
  hasDefect?: boolean;
  defectFields?: string[];
  reviewReason?: 
    | 'wrong_doc_type' 
    | 'missing_attachment' 
    | 'unreadable' 
    | 'missing_value';
  siFields?: Field[]; //FieldComparison[];
  blFields?: Field[]; //FieldComparison[];
}

export interface Field {
  field: string,
  value: string | null;
}

export interface FieldComparison {
  field: string;
  siValue: string | null;
  blValue: string | null;
  matched: boolean;
  siFieldName?: string;
  blFieldName?: string;
}

export interface EmailRecord {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  category: EmailCategory;
  attachments?: string[];
  siData?: Partial<ShippingInstruction>;
  blData?: Partial<BillOfLading>;
  comparisonResult?: BLComparisonResult;
  processedAt: Date;
  processedBy?: string;
  mongodbId?: ObjectId;
}

export interface ShippingInstruction {
  shipper?: string;
  consignee?: string;
  notifyParty?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  containerCount?: string | number;
  grossWeightKG?: string | number;
  // Additional fields that may appear
  [key: string]: unknown;
}

export interface BillOfLading {
  shipper?: string;
  consignee?: string;
  notifyParty?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  containerCount?: string | number;
  grossWeightKG?: string | number;
  // Additional fields that may appear
  [key: string]: unknown;
}

export interface ProcessedEmailRecord {
  _id: ObjectId;
  emailId: string;
  from: string;
  subject: string;
  body: string;
  category: EmailCategory;
  attachments?: string[];
  siData?: Partial<ShippingInstruction>;
  blData?: Partial<BillOfLading>;
  comparisonResult?: BLComparisonResult;
  processedAt: Date;
  processedBy?: string;
}
