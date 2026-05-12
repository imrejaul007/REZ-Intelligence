import { EDUCATION_KNOWLEDGE } from '../config/knowledge';
import { CourseRecommendation, LearningPath, LearningPathStep } from '../types/tone';

export class ExpertiseService {
  private domains = EDUCATION_KNOWLEDGE.domains;

  async getCourseRecommendations(
    userInterests: string[],
    currentLevel: string,
    goals: string[]
  ): Promise<CourseRecommendation[]> {
    const recommendations: CourseRecommendation[] = [];

    for (const domain of Object.values(this.domains)) {
      for (const category of domain.categories) {
        for (const skill of category.skills) {
          const skillMatch = this.calculateSkillMatch(skill, userInterests, goals);
          if (skillMatch > 0.3) {
            const course = this.createCourseRecommendation(category, skill, skillMatch, currentLevel);
            recommendations.push(course);
          }
        }
      }
    }

    return recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }

  private calculateSkillMatch(
    skill: string,
    interests: string[],
    goals: string[]
  ): number {
    const normalizedSkill = skill.toLowerCase();
    let score = 0;

    for (const interest of interests) {
      if (normalizedSkill.includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(normalizedSkill)) {
        score += 0.5;
      }
    }

    for (const goal of goals) {
      if (normalizedSkill.includes(goal.toLowerCase()) ||
          goal.toLowerCase().includes(normalizedSkill)) {
        score += 0.5;
      }
    }

    return Math.min(score, 1);
  }

  private createCourseRecommendation(
    category: any,
    skill: string,
    matchScore: number,
    userLevel: string
  ): CourseRecommendation {
    return {
      courseId: `${category.id}-${skill.toLowerCase().replace(/\s+/g, '-')}`,
      title: `${skill} ${category.name.includes('Development') ? 'Development' : 'Fundamentals'}`,
      description: `Master ${skill} with this comprehensive course covering core concepts, practical applications, and real-world projects.`,
      provider: this.getProviderForSkill(skill),
      rating: Math.round((3.5 + Math.random() * 1.5) * 100) / 100,
      duration: this.getDurationForLevel(skill, userLevel),
      level: this.adjustLevelForSkill(skill, userLevel),
      skills: [skill],
      certification: category.certifications?.[0]?.name,
      matchScore: Math.round(matchScore * 100) / 100,
      reason: this.generateRecommendationReason(skill, category.name, matchScore)
    };
  }

  private getProviderForSkill(skill: string): string {
    const providerMap: Record<string, string> = {
      'React': 'Meta',
      'Python': 'IBM',
      'AWS': 'Amazon Web Services',
      'Azure': 'Microsoft',
      'JavaScript': 'freeCodeCamp',
      'TypeScript': 'Microsoft',
      'Docker': 'Docker Inc.',
      'Kubernetes': 'CNCF',
      'Machine Learning': 'Stanford Online',
      'SQL': 'Mode Analytics'
    };
    return providerMap[skill] || 'Coursera';
  }

  private getDurationForLevel(skill: string, level: string): string {
    const durations: Record<string, string> = {
      beginner: '4-6 weeks',
      intermediate: '6-8 weeks',
      advanced: '8-12 weeks'
    };
    return durations[level] || '6 weeks';
  }

  private adjustLevelForSkill(skill: string, userLevel: string): string {
    return userLevel;
  }

  private generateRecommendationReason(
    skill: string,
    categoryName: string,
    matchScore: number
  ): string {
    if (matchScore > 0.8) {
      return `This is a perfect match for your interests! ${skill} is highly valued in ${categoryName}.`;
    } else if (matchScore > 0.6) {
      return `Great choice! ${skill} aligns well with your learning goals in ${categoryName}.`;
    } else {
      return `${skill} is an excellent skill to add to your portfolio in ${categoryName}.`;
    }
  }

  async createLearningPath(
    targetSkills: string[],
    currentLevel: string,
    timeCommitment: string
  ): Promise<LearningPath> {
    const pathSteps: LearningPathStep[] = [];
    let order = 1;

    for (const skill of targetSkills) {
      const prerequisites = this.getPrerequisitesForSkill(skill);
      for (const prereq of prerequisites) {
        if (!pathSteps.find(s => s.title.includes(prereq))) {
          pathSteps.push(this.createPathStep(order++, prereq, 'beginner', true));
        }
      }
      pathSteps.push(this.createPathStep(order++, skill, currentLevel, true));
    }

    const totalDuration = this.calculatePathDuration(pathSteps, timeCommitment);

    return {
      pathId: `path-${targetSkills.join('-').toLowerCase()}-${Date.now()}`,
      title: `${targetSkills.join(' & ')} Learning Path`,
      description: `A comprehensive learning path to master ${targetSkills.join(', ')} from ${currentLevel} to advanced level.`,
      totalDuration,
      skillLevel: currentLevel,
      steps: pathSteps,
      certifications: this.getCertificationsForSkills(targetSkills),
      careerOutcomes: this.getCareerOutcomes(targetSkills)
    };
  }

  private getPrerequisitesForSkill(skill: string): string[] {
    const prereqMap: Record<string, string[]> = {
      'React': ['JavaScript', 'HTML', 'CSS'],
      'Machine Learning': ['Python', 'Statistics'],
      'Kubernetes': ['Docker', 'Linux'],
      'AWS': ['Cloud Fundamentals'],
      'Node.js': ['JavaScript']
    };
    return prereqMap[skill] || [];
  }

  private createPathStep(
    order: number,
    title: string,
    level: string,
    isRequired: boolean
  ): LearningPathStep {
    return {
      order,
      courseId: `course-${title.toLowerCase().replace(/\s+/g, '-')}`,
      title,
      duration: this.getDurationForLevel(title, level),
      skills: [title],
      isRequired
    };
  }

  private calculatePathDuration(steps: LearningPathStep[], commitment: string): string {
    const baseWeeks = steps.length * 4;
    const multiplier = commitment === 'full-time' ? 1 : commitment === 'part-time' ? 2 : 3;
    const totalWeeks = baseWeeks * multiplier;

    if (totalWeeks < 8) return `${totalWeeks} weeks`;
    const months = Math.ceil(totalWeeks / 4);
    return `${months} months`;
  }

  private getCertificationsForSkills(skills: string[]): string[] {
    const certs: string[] = [];
    for (const domain of Object.values(this.domains)) {
      for (const category of domain.categories) {
        for (const skill of skills) {
          if (category.skills.includes(skill) && category.certifications) {
            certs.push(...category.certifications.map(c => c.name));
          }
        }
      }
    }
    return [...new Set(certs)].slice(0, 3);
  }

  private getCareerOutcomes(skills: string[]): string[] {
    const outcomes: Record<string, string[]> = {
      'React': ['Frontend Developer', 'Full Stack Developer', 'UI Engineer'],
      'Python': ['Data Scientist', 'ML Engineer', 'Backend Developer'],
      'AWS': ['Cloud Architect', 'DevOps Engineer', 'Solutions Architect'],
      'Machine Learning': ['AI Engineer', 'Research Scientist', 'Data Analyst'],
      'Docker': ['DevOps Engineer', 'Site Reliability Engineer', 'Cloud Developer']
    };

    const result: string[] = [];
    for (const skill of skills) {
      if (outcomes[skill]) {
        result.push(...outcomes[skill]);
      }
    }
    return [...new Set(result)].slice(0, 5);
  }

  async compareCourses(courseIds: string[]): Promise<{
    courses: CourseRecommendation[];
    comparison: {
      byRating: CourseRecommendation[];
      byDuration: CourseRecommendation[];
      byComprehensive: CourseRecommendation[];
    };
    winner: string;
  }> {
    const courses = courseIds.map(id => this.getCourseById(id)).filter(Boolean) as CourseRecommendation[];

    return {
      courses,
      comparison: {
        byRating: [...courses].sort((a, b) => b.rating - a.rating),
        byDuration: [...courses].sort((a, b) => {
          const aDuration = parseInt(a.duration);
          const bDuration = parseInt(b.duration);
          return aDuration - bDuration;
        }),
        byComprehensive: courses.sort((a, b) => {
          const scoreA = a.rating * 0.6 + (1 - a.matchScore) * 0.4;
          const scoreB = b.rating * 0.6 + (1 - b.matchScore) * 0.4;
          return scoreB - scoreA;
        })
      },
      winner: courses.sort((a, b) => b.rating - a.rating)[0]?.courseId || ''
    };
  }

  private getCourseById(courseId: string): CourseRecommendation | null {
    for (const domain of Object.values(this.domains)) {
      for (const category of domain.categories) {
        for (const skill of category.skills) {
          const id = `${category.id}-${skill.toLowerCase().replace(/\s+/g, '-')}`;
          if (id === courseId) {
            return {
              courseId: id,
              title: skill,
              description: `Course on ${skill}`,
              provider: this.getProviderForSkill(skill),
              rating: 4 + Math.random(),
              duration: '6 weeks',
              level: 'intermediate',
              skills: [skill],
              matchScore: 0.7,
              reason: ''
            };
          }
        }
      }
    }
    return null;
  }
}

export const expertiseService = new ExpertiseService();
