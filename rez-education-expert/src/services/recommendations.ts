import { expertiseService } from './expertise';
import { courseService } from './courseService';
import { progressService } from './progressService';
import { randomBytes } from 'crypto';
import { CourseRecommendation, LearningPath, SkillProfile } from '../types/tone';

/**
 * Generate a random number between 0 and 1 using crypto
 */
function cryptoRandom(): number {
  return Number(randomBytes(4).readUInt32BE(0)) / 0xFFFFFFFF;
}

interface UserProfile {
  userId: string;
  interests: string[];
  currentSkills: string[];
  skillLevel: string;
  goals: string[];
  completedCourses: string[];
  timeCommitment: string;
  preferredFormat?: string[];
}

export class RecommendationsService {
  async getPersonalizedRecommendations(userProfile: UserProfile): Promise<{
    recommendedCourses: CourseRecommendation[];
    suggestedPaths: LearningPath[];
    missingSkills: string[];
    reason: string;
  }> {
    const { interests, currentSkills, skillLevel, goals, completedCourses } = userProfile;

    const targetSkills = this.identifyTargetSkills(interests, goals);
    const recommendedCourses = await expertiseService.getCourseRecommendations(
      interests,
      skillLevel,
      goals
    );

    const filteredCourses = recommendedCourses.filter(
      course => !completedCourses.includes(course.courseId)
    );

    const suggestedPaths = await expertiseService.createLearningPath(
      targetSkills,
      skillLevel,
      userProfile.timeCommitment || 'part-time'
    );

    const missingSkills = this.identifyMissingSkills(
      targetSkills,
      currentSkills,
      filteredCourses
    );

    return {
      recommendedCourses: filteredCourses.slice(0, 5),
      suggestedPaths: [suggestedPaths],
      missingSkills,
      reason: this.generateRecommendationReason(userProfile)
    };
  }

  private identifyTargetSkills(interests: string[], goals: string[]): string[] {
    const targetSkills: string[] = [];
    const seen = new Set<string>();

    for (const interest of interests) {
      targetSkills.push(interest);
      seen.add(interest.toLowerCase());
    }

    for (const goal of goals) {
      if (!seen.has(goal.toLowerCase())) {
        targetSkills.push(goal);
        seen.add(goal.toLowerCase());
      }
    }

    return targetSkills.slice(0, 5);
  }

  private identifyMissingSkills(
    targetSkills: string[],
    currentSkills: string[],
    recommendedCourses: CourseRecommendation[]
  ): string[] {
    const missing: string[] = [];
    const currentLower = currentSkills.map(s => s.toLowerCase());

    for (const course of recommendedCourses) {
      for (const skill of course.skills) {
        if (!currentLower.includes(skill.toLowerCase()) && !missing.includes(skill)) {
          missing.push(skill);
        }
      }
    }

    return missing.slice(0, 5);
  }

  private generateRecommendationReason(profile: UserProfile): string {
    const parts: string[] = [];

    if (profile.interests.length > 0) {
      parts.push(`Based on your interest in ${profile.interests.join(', ')}`);
    }

    if (profile.goals.length > 0) {
      parts.push(`and your goal to ${profile.goals.join(', ')}`);
    }

    parts.push(`I've curated courses that match your ${profile.skillLevel} level`);

    return parts.join(' ');
  }

  async getNextCourseRecommendations(
    userId: string,
    courseId: string
  ): Promise<CourseRecommendation[]> {
    const currentProgress = await progressService.getProgress(userId, courseId);

    if (!currentProgress) {
      return [];
    }

    const currentCourse = await courseService.getCourseById(courseId);
    if (!currentCourse) {
      return [];
    }

    const searchResult = await courseService.searchCourses({
      query: currentCourse.skills[0],
      limit: 10
    });

    const nextCourses = searchResult.courses.filter(
      c => c.courseId !== courseId && c.level === currentCourse.level
    );

    return nextCourses.slice(0, 3);
  }

  async assessSkillLevel(
    userId: string,
    skills: string[]
  ): Promise<SkillProfile & { recommendations: string[] }> {
    const userProgress = await progressService.getUserAllProgress(userId);

    const skillRatings: { skillId: string; skillName: string; level: number; endorsements: number }[] = [];

    for (const skill of skills) {
      const coursesForSkill = userProgress.filter(p =>
        p.courseId.includes(skill.toLowerCase())
      );

      let level = 0;
      let endorsements = 0;

      if (coursesForSkill.length > 0) {
        const avgProgress = coursesForSkill.reduce((sum, p) => sum + p.progress, 0) / coursesForSkill.length;
        level = Math.round(avgProgress / 20);
        endorsements = coursesForSkill.filter(p => p.status === 'completed').length;
      }

      skillRatings.push({
        skillId: skill.toLowerCase().replace(/\s+/g, '-'),
        skillName: skill,
        level,
        endorsements
      });
    }

    const recommendations: string[] = [];

    for (const rating of skillRatings) {
      if (rating.level < 2) {
        recommendations.push(`${rating.skillName} - Start with fundamentals`);
      } else if (rating.level < 4) {
        recommendations.push(`${rating.skillName} - Try intermediate projects`);
      } else {
        recommendations.push(`${rating.skillName} - Consider advanced certifications`);
      }
    }

    return {
      userId,
      currentSkills: skillRatings,
      targetSkills: skills,
      assessedAt: new Date(),
      recommendations
    };
  }

  async getSkillGapAnalysis(
    userId: string,
    targetRole: string
  ): Promise<{
    targetRole: string;
    currentSkills: string[];
    requiredSkills: string[];
    skillGap: { skill: string; status: 'mastered' | 'in_progress' | 'missing' }[];
    recommendations: CourseRecommendation[];
  }> {
    const requiredSkillsMap: Record<string, string[]> = {
      'frontend-developer': ['HTML', 'CSS', 'JavaScript', 'React', 'TypeScript'],
      'backend-developer': ['Node.js', 'Python', 'SQL', 'API Design', 'Cloud Basics'],
      'data-scientist': ['Python', 'Statistics', 'Machine Learning', 'SQL', 'Data Visualization'],
      'devops-engineer': ['Docker', 'Kubernetes', 'CI/CD', 'AWS', 'Linux'],
      'ux-designer': ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'Usability Testing'],
      'product-manager': ['Agile', 'Data Analysis', 'User Research', 'Roadmapping', 'Communication']
    };

    const requiredSkills = requiredSkillsMap[targetRole] || [];
    const userProgress = await progressService.getUserAllProgress(userId);
    const currentSkills: string[] = [];

    for (const progress of userProgress) {
      if (progress.status === 'completed') {
        const course = await courseService.getCourseById(progress.courseId);
        if (course) {
          currentSkills.push(...course.skills);
        }
      }
    }

    const uniqueCurrentSkills = [...new Set(currentSkills)];
    const skillGap: { skill: string; status: 'mastered' | 'in_progress' | 'missing' }[] = [];

    for (const skill of requiredSkills) {
      const inProgress = userProgress.some(p => {
        const course = courseService.getCourseById(p.courseId);
        return course && course.skills.includes(skill) && p.status === 'in_progress';
      });

      const completed = uniqueCurrentSkills.includes(skill);

      skillGap.push({
        skill,
        status: completed ? 'mastered' : inProgress ? 'in_progress' : 'missing'
      });
    }

    const missingSkills = skillGap
      .filter(g => g.status === 'missing')
      .map(g => g.skill);

    const recommendations = await expertiseService.getCourseRecommendations(
      missingSkills,
      'intermediate',
      [targetRole]
    );

    return {
      targetRole,
      currentSkills: uniqueCurrentSkills,
      requiredSkills,
      skillGap,
      recommendations: recommendations.slice(0, 3)
    };
  }

  async getDailyRecommendations(userId: string): Promise<{
    course: CourseRecommendation | null;
    tip: string;
    motivation: string;
  }> {
    const tips = [
      'Break complex topics into smaller, manageable chunks for better retention.',
      'Practice active recall by testing yourself without looking at materials.',
      'Join study groups to discuss concepts and learn from others.',
      'Apply what you learn through real-world projects.',
      'Take regular breaks to prevent burnout and maintain focus.',
      'Review previous lessons before starting new ones.',
      'Set specific, measurable goals for each study session.'
    ];

    const motivations = [
      'Every expert was once a beginner. Keep going!',
      'Your dedication today shapes your success tomorrow.',
      'Learning is the foundation of all growth.',
      'Small steps lead to big achievements.',
      'You are investing in your future self.'
    ];

    const userProgress = await progressService.getUserAllProgress(userId);
    const inProgressCourses = userProgress.filter(p => p.status === 'in_progress');

    let recommendedCourse: CourseRecommendation | null = null;

    if (inProgressCourses.length > 0) {
      const nextCourse = await this.getNextCourseRecommendations(
        userId,
        inProgressCourses[0].courseId
      );
      recommendedCourse = nextCourse[0] || null;
    }

    return {
      course: recommendedCourse,
      tip: tips[Math.floor(cryptoRandom() * tips.length)],
      motivation: motivations[Math.floor(cryptoRandom() * motivations.length)]
    };
  }
}

export const recommendationsService = new RecommendationsService();
