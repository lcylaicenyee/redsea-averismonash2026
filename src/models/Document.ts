import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IDocument extends Document {
  originalName: string;
  fileName: string;
  mimeType: string;
  size: number;
  gridFsId: Types.ObjectId;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
  documentType: 'EMAIL' | 'ATTACHMENT' | 'OTHER';
  emailRecordId?: Types.ObjectId; // Reference to EmailRecord for EMAIL documents
}

const documentSchema = new Schema<IDocument>(
  {
    originalName: {
      type: String,
      required: true,
      trim: true
    },
    fileName: {
      type: String,
      required: true
    },
    mimeType: {
      type: String,
      required: true
    },
    size: {
      type: Number,
      required: true
    },
    gridFsId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    documentType: {
      type: String,
      enum: ['EMAIL', 'ATTACHMENT', 'OTHER'],
      default: 'OTHER'
    },
    emailRecordId: {
      type: Schema.Types.ObjectId,
      ref: 'EmailRecordModel',
      index: true
    }
  },
  {
    timestamps: true
  }
);

const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);

/* // Indexes for efficient querying
DocumentModel.index({ emailRecordId: 1, createdAt: -1 });
DocumentModel.index({ category: 1, documentType: 1 });
DocumentModel.index({ emailId: 1, unique: true });
 */
export default DocumentModel;