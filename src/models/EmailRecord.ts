import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmailRecord extends Document {
  emailId: string;
  from: string;
  subject: string;
  body: string;
  category: string;
  attachments: string[];
  siData: mongoose.Document;
  blData: mongoose.Document;
  comparisonResult: mongoose.Document;
  processedAt: Date;
  processedBy?: string;
}

const emailRecordSchema = new Schema<IEmailRecord>(
  {
    emailId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    from: {
      type: String,
      required: true,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    body: {
      type: String,
      required: true,
      trim: true
    },
    category: {
      type: String,
      enum: ['BL_COMPARISON', 'SI_REQUEST', 'INVOICE_QUERY', 'GENERAL', 'SPAM'],
      default: 'GENERAL'
    },
    attachments: {
      type: [String],
      default: []
    },
    siData: {
      type: Schema.Types.Mixed,
      default: {}
    },
    blData: {
      type: Schema.Types.Mixed,
      default: {}
    },
    comparisonResult: {
      type: Schema.Types.Mixed,
      default: {}
    },
    processedAt: {
      type: Date,
      default: Date.now
    },
    processedBy: {
      type: String,
      default: 'system'
    }
  },
  {
    timestamps: true
  }
);

const EmailRecordModel = mongoose.model<IEmailRecord>('EmailRecord', emailRecordSchema);

export default EmailRecordModel;