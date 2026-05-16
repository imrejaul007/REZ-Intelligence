/**
 * Career Graph Types
 * Extends Universal User Graph with career/education data
 */

import { z } from 'zod';

// ─── Career Enums ─────────────────────────────────────────────────────────────

export enum EducationLevel {
  HIGH_SCHOOL = 'high_school',
  DIPLOMA = 'diploma',
  BACHELORS = 'bachelors',
  MASTERS = 'masters',
  PHD = 'phd',
  POST_DOCTORAL = 'post_doctoral',
}

export enum ExperienceLevel {
  FRESHER = 'fresher',
  JUNIOR = 'junior',
  MID = 'mid',
  SENIOR = 'senior',
  LEAD = 'lead',
  MANAGER = 'manager',
  DIRECTOR = 'director',
  EXECUTIVE = 'executive',
}

export enum WorkType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
  FREELANCE = 'freelance',
  REMOTE = 'remote',
}

export enum JobSearchStatus {
  ACTIVE = 'active',
  PASSIVE = 'passive',
  NOT_LOOKING = 'not_looking',
}

// ─── Career Schemas ──────────────────────────────────────────────────────────

export const EducationSchema = z.object({
  institution: z.string(),
  degree: z.string(),
  field: z.string(),
  level: z.nativeEnum(EducationLevel),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  grade: z.string().optional(),
  activities: z.array(z.string()).optional(),
  description: z.string().optional(),
});

export const ExperienceSchema = z.object({
  company: z.string(),
  companyId: z.string().optional(),
  title: z.string(),
  type: z.nativeEnum(WorkType),
  location: z.string().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  salary: z.object({
    amount: z.number(),
    currency: z.string().default('INR'),
    period: z.enum(['monthly', 'yearly']).default('yearly'),
  }).optional(),
  description: z.string().optional(),
  skills: z.array(z.string()).optional(),
});

export const SkillSchema = z.object({
  name: z.string(),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('intermediate'),
  yearsOfExperience: z.number().optional(),
  verified: z.boolean().default(false),
  endorsements: z.number().default(0),
});

export const CertificationSchema = z.object({
  name: z.string(),
  issuer: z.string(),
  issueDate: z.string(),
  expiryDate: z.string().optional(),
  credentialId: z.string().optional(),
  credentialUrl: z.string().url().optional(),
  verified: z.boolean().default(false),
});

export const ProjectSchema = z.object({
  title: z.string(),
  description: z.string(),
  url: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  skills: z.array(z.string()),
  collaborators: z.array(z.string()).optional(),
});

export const InternshipSchema = z.object({
  company: z.string(),
  companyId: z.string().optional(),
  role: z.string(),
  startDate: z.string(),
  endDate: z.string().optional(),
  current: z.boolean().optional(),
  stipend: z.number().optional(),
  offer: z.enum(['pre_conversion', 'conversion', 'rejected', 'pending']).optional(),
  converted: z.boolean().optional(),
});

export const PortfolioSchema = z.object({
  type: z.enum(['github', 'dribbble', 'behance', 'portfolio', 'other']),
  url: z.string().url(),
  title: z.string().optional(),
  followers: z.number().optional(),
  verified: z.boolean().default(false),
});

export const SocialProfileSchema = z.object({
  platform: z.enum(['linkedin', 'twitter', 'github', 'medium', 'other']),
  url: z.string().url(),
  handle: z.string().optional(),
  verified: z.boolean().default(false),
});

// ─── Career Profile ─────────────────────────────────────────────────────────

export const CareerProfileSchema = z.object({
  headline: z.string().optional(),
  summary: z.string().optional(),
  education: z.array(EducationSchema),
  experience: z.array(ExperienceSchema),
  skills: z.array(SkillSchema),
  certifications: z.array(CertificationSchema).default([]),
  projects: z.array(ProjectSchema).default([]),
  internships: z.array(InternshipSchema).default([]),
  portfolio: z.array(PortfolioSchema).default([]),
  socialProfiles: z.array(SocialProfileSchema).default([]),
  languages: z.array(z.object({
    language: z.string(),
    proficiency: z.enum(['native', 'fluent', 'professional', 'conversational', 'basic']).default('conversational'),
  })).default([]),
});

export const CareerPreferencesSchema = z.object({
  desiredRoles: z.array(z.string()).default([]),
  desiredIndustries: z.array(z.string()).default([]),
  desiredLocations: z.array(z.string()).default([]),
  workType: z.array(z.nativeEnum(WorkType)).default([]),
  expectedSalary: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string().default('INR'),
    period: z.enum(['monthly', 'yearly']).default('yearly'),
  }).optional(),
  remote: z.boolean().optional(),
  willingToRelocate: z.boolean().optional(),
  noticePeriod: z.string().optional(),
  jobSearchStatus: z.nativeEnum(JobSearchStatus).default(JobSearchStatus.PASSIVE),
});

// ─── Career Graph Document ────────────────────────────────────────────────────

export const CareerGraphSchema = z.object({
  // User reference
  userId: z.string(),

  // Career profile
  careerProfile: CareerProfileSchema,

  // Preferences
  preferences: CareerPreferencesSchema,

  // Derived data
  derived: z.object({
    totalExperience: z.number(), // in years
    skillScore: z.number().min(0).max(100),
    educationScore: z.number().min(0).max(100),
    verificationScore: z.number().min(0).max(100),
    overallScore: z.number().min(0).max(100),
    topSkills: z.array(z.string()),
    topIndustries: z.array(z.string()),
  }),

  // Visibility settings
  visibility: z.object({
    showExperience: z.boolean().default(true),
    showSalary: z.boolean().default(false),
    showContactInfo: z.boolean().default(true),
    anonymousMode: z.boolean().default(false),
  }),

  // Metadata
  lastUpdated: z.string().datetime(),
  createdAt: z.string().datetime(),
  verifiedAt: z.string().datetime().optional(),
  source: z.enum(['manual', 'linkedin', 'naukri', 'internshala', 'resume_parser']).default('manual'),
});

// ─── TypeScript Interfaces ────────────────────────────────────────────────────

export type Education = z.infer<typeof EducationSchema>;
export type Experience = z.infer<typeof ExperienceSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Certification = z.infer<typeof CertificationSchema>;
export type Project = z.infer<typeof ProjectSchema>;
export type Internship = z.infer<typeof InternshipSchema>;
export type Portfolio = z.infer<typeof PortfolioSchema>;
export type SocialProfile = z.infer<typeof SocialProfileSchema>;
export type CareerProfile = z.infer<typeof CareerProfileSchema>;
export type CareerPreferences = z.infer<typeof CareerPreferencesSchema>;
export type CareerGraph = z.infer<typeof CareerGraphSchema>;

// ─── Default Factory ─────────────────────────────────────────────────────────

export function createDefaultCareerProfile(): CareerProfile {
  return {
    headline: '',
    summary: '',
    education: [],
    experience: [],
    skills: [],
    certifications: [],
    projects: [],
    internships: [],
    portfolio: [],
    socialProfiles: [],
    languages: [],
  };
}

export function createDefaultCareerPreferences(): CareerPreferences {
  return {
    desiredRoles: [],
    desiredIndustries: [],
    desiredLocations: [],
    workType: [],
    jobSearchStatus: JobSearchStatus.PASSIVE,
  };
}

export function createDefaultCareerGraph(userId: string): Omit<CareerGraph, 'derived'> {
  return {
    userId,
    careerProfile: createDefaultCareerProfile(),
    preferences: createDefaultCareerPreferences(),
    visibility: {
      showExperience: true,
      showSalary: false,
      showContactInfo: true,
      anonymousMode: false,
    },
    lastUpdated: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    source: 'manual',
  };
}
