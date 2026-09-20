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
    }
  },
  {
    timestamps: true
  }
);

const DocumentModel = mongoose.model<IDocument>('Document', documentSchema);

export default DocumentModel;