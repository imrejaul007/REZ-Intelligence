import mongoose, { Document, Schema } from 'mongoose';
import { CourseCategory, PredictionType } from '../types';

export interface IPerformancePrediction extends Document {
  predictionId: string;
  studentId: string;
  institutionId: string;
  courseId?: string;
  courseName?: string;
  category?: CourseCategory;
  predictedGrade: string;
  confidence: number;
  riskFactors: string[];
  recommendations: string[];
  predictionType: PredictionType;
  predictionDate: Date;
  actualGrade?: string;
  accuracy?: number;
  metricsSnapshot?: {
    attendanceRate: number;
    assignmentCompletion: number;
    quizAverage: number;
    examAverage: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const PerformancePredictionSchema = new Schema<IPerformancePrediction>(
  {
    predictionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    studentId: {
      type: String,
      required: true,
      index: true,
    },
    institutionId: {
      type: String,
      required: true,
      index: true,
    },
    courseId: { type: String },
    courseName: { type: String },
    category: { type: String, enum: Object.values(CourseCategory) },
    predictedGrade: {
      type: String,
      required: true,
      enum: ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F'],
    },
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.75,
    },
    riskFactors: {
      type: [String],
      default: [],
    },
    recommendations: {
      type: [String],
      default: [],
    },
    predictionType: {
      type: String,
      enum: Object.values(PredictionType),
      default: PredictionType.GRADE,
    },
    predictionDate: {
      type: Date,
      required: true,
    },
    actualGrade: { type: String },
    accuracy: {
      type: Number,
      min: 0,
      max: 100,
    },
    metricsSnapshot: {
      attendanceRate: Number,
      assignmentCompletion: Number,
      quizAverage: Number,
      examAverage: Number,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes
PerformancePredictionSchema.index({ institutionId: 1, studentId: 1 });
PerformancePredictionSchema.index({ institutionId: 1, predictionDate: -1 });
PerformancePredictionSchema.index({ studentId: 1, predictionDate: -1 });

// TTL index - predictions expire after 180 days
PerformancePredictionSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 180 * 24 * 60 * 60 }
);

// Static methods
PerformancePredictionSchema.statics.findByStudent = function (studentId: string, limit = 20) {
  return this.find({ studentId })
    .sort({ predictionDate: -1 })
    .limit(limit)
    .exec();
};

PerformancePredictionSchema.statics.findByInstitution = function (institutionId: string, limit = 100) {
  return this.find({ institutionId })
    .sort({ predictionDate: -1 })
    .limit(limit)
    .exec();
};

PerformancePredictionSchema.statics.findByCourse = function (institutionId: string, courseId: string) {
  return this.find({ institutionId, courseId })
    .sort({ predictionDate: -1 })
    .exec();
};

PerformancePredictionSchema.statics.updateActualGrade = async function (
  predictionId: string,
  actualGrade: string
) {
  const prediction = await this.findOne({ predictionId });
  if (!prediction) return null;

  const gradePoints: Record<string, number> = {
    'A+': 4.0, 'A': 4.0, 'A-': 3.7,
    'B+': 3.3, 'B': 3.0, 'B-': 2.7,
    'C+': 2.3, 'C': 2.0, 'C-': 1.7,
    'D': 1.0, 'F': 0.0,
  };

  const predictedPoints = gradePoints[prediction.predictedGrade] || 0;
  const actualPoints = gradePoints[actualGrade] || 0;
  const accuracy = Math.max(0, 100 - Math.abs(predictedPoints - actualPoints) * 25);

  return this.findOneAndUpdate(
    { predictionId },
    { actualGrade, accuracy, updatedAt: new Date() },
    { new: true }
  );
};

PerformancePredictionSchema.statics.getPerformanceDistribution = async function (institutionId: string) {
  const results = await this.aggregate([
    { $match: { institutionId, actualGrade: { $exists: true } } },
    {
      $group: {
        _id: '$predictedGrade',
        count: { $sum: 1 },
        avgAccuracy: { $avg: '$accuracy' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return results.map(r => ({
    grade: r._id,
    count: r.count,
    avgAccuracy: Math.round(r.avgAccuracy * 10) / 10,
  }));
};

export const PerformancePrediction = mongoose.model<IPerformancePrediction>(
  'PerformancePrediction',
  PerformancePredictionSchema
);

export default PerformancePrediction;