import mongoose, { Schema, Document, Model } from 'mongoose';
import { ISegment } from '../types/index.js';

export interface ISegmentDocument extends ISegment, Document {}

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
      transform: (_doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        return ret;
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

export const Segment: Model<ISegmentDocument> = mongoose.model<ISegmentDocument>(
  'Segment',
  SegmentSchema
);
