import mongoose, { Document, Schema } from 'mongoose';
import {
  CourseCategory,
  CourseRecommendation,
  DropoutRisk,
  PerformancePrediction,
} from '../types';

export interface IEducationMindSession extends Document {
  sessionId: string;
  institutionId: string;
  studentId?: string;
  intent: string;
  context: {
    courseId?: string;
    semester?: string;
    grades?: Array<{
      courseId: string;
      courseName: string;
      category: string;
      credits: number;
      grade?: string;
      completedDate?: Date;
      status: string;
    }>;
  };
  analysis: {
    recommendations: CourseRecommendation[];
    riskAssessments: DropoutRisk[];
    performancePredictions: PerformancePrediction[];
  };
  sentiment?: number;
  createdAt: Date;
  updatedAt: Date;
}

const EducationMindSessionSchema = new Schema<IEducationMindSession>(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    institutionId: {
      type: String,
      required: true,
      index: true,
    },
    studentId: {
      type: String,
      index: true,
    },
    intent: {
      type: String,
      required: true,
      default: 'general_consultation',
    },
    context: {
      courseId: { type: String },
      semester: { type: String },
      grades: [{
        courseId: String,
        courseName: String,
        category: String,
        credits: Number,
        grade: String,
        completedDate: Date,
        status: String,
      }],
    },
    analysis: {
      recommendations: [{
        courseId: String,
        courseName: String,
        category: String,
        relevanceScore: Number,
        confidence: Number,
        reasoning: String,
        prerequisitesMet: Boolean,
        careerAlignment: [String],
      }],
      riskAssessments: [{
        riskId: String,
        studentId: String,
        institutionId: String,
        riskScore: Number,
        riskLevel: String,
        contributingFactors: [{
          category: String,
          factor: String,
          weight: Number,
          description: String,
        }],
        recommendations: [String],
        assessmentDate: Date,
        status: String,
      }],
      performancePredictions: [{
        predictionId: String,
        studentId: String,
        institutionId: String,
        courseId: String,
        predictedGrade: String,
        confidence: Number,
        riskFactors: [String],
        recommendations: [String],
        predictionDate: Date,
        actualGrade: String,
        accuracy: Number,
      }],
    },
    sentiment: {
      type: Number,
      min: -1,
      max: 1,
    },
  },
  {
    timestamps: true,
  }
);

// TTL index - sessions expire after 60 days
EducationMindSessionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 24 * 60 * 60 });

// Compound indexes
EducationMindSessionSchema.index({ institutionId: 1, studentId: 1 });
EducationMindSessionSchema.index({ institutionId: 1, createdAt: -1 });

// Static methods
EducationMindSessionSchema.statics.findByInstitution = function (institutionId: string, limit = 50) {
  return this.find({ institutionId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

EducationMindSessionSchema.statics.findByStudent = function (studentId: string, limit = 20) {
  return this.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .exec();
};

export const EducationMindSession = mongoose.model<IEducationMindSession>(
  'EducationMindSession',
  EducationMindSessionSchema
);

export default EducationMindSession;