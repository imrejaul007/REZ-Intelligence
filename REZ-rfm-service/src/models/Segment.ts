import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISegment } from '../types/index.js';

export interface ISegmentDocument extends ISegment, Document {}

export interface ISegmentModel extends Model<ISegmentDocument> {
  findByCode(code: string): Promise<ISegmentDocument | null>;
  findByRFMCode(rfmCode: string): Promise<ISegmentDocument | null>;
  getAllOrdered(): Promise<ISegmentDocument[]>;
}

const SegmentSchema = new Schema<ISegmentDocument>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    rfmCodes: {
      type: [String],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    color: {
      type: String,
      required: true,
      default: '#94a3b8',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: Record<string, unknown>) => {
        const { _id, __v, ...rest } = ret;
        return { id: _id, ...rest };
      },
    },
  }
);

// Static method to find by code
SegmentSchema.statics.findByCode = async function (
  code: string
): Promise<ISegmentDocument | null> {
  return this.findOne({ code });
};

// Static method to find segment by RFM code
SegmentSchema.statics.findByRFMCode = async function (
  rfmCode: string
): Promise<ISegmentDocument | null> {
  return this.findOne({ rfmCodes: rfmCode });
};

// Static method to get all segments ordered by importance
SegmentSchema.statics.getAllOrdered = async function (): Promise<ISegmentDocument[]> {
  return this.find().sort({ code: 1 });
};

export const Segment = mongoose.model<ISegmentDocument, ISegmentModel>(
  'Segment',
  SegmentSchema
);
