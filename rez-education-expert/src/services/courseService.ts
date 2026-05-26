import { EDUCATION_KNOWLEDGE } from '../config/knowledge';
import { CourseRecommendation, CourseSearchParams, SearchResult } from '../types/tone';
import { randomInt, randomUUID } from 'crypto';

interface Course {
  id: string;
  title: string;
  description: string;
  provider: string;
  rating: number;
  reviews: number;
  duration: string;
  level: string;
  skills: string[];
  certification?: string;
  domain: string;
  category: string;
  format: string;
  price: string;
  students: number;
}

export class CourseService {
  private courses: Course[] = [];
  private initialized = false;

  constructor() {
    this.initializeCourses();
  }

  private initializeCourses(): void {
    if (this.initialized) return;

    for (const [domainKey, domain] of Object.entries(EDUCATION_KNOWLEDGE.domains)) {
      for (const category of domain.categories) {
        for (const skill of category.skills) {
          const course = this.createCourse(domainKey, domain.name, category, skill);
          this.courses.push(course);
        }
      }
    }

    this.initialized = true;
  }

  private createCourse(
    domainKey: string,
    domainName: string,
    category: { id: string; name: string; certifications?: { name: string; provider: string }[] },
    skill: string
  ): Course {
    const skillLower = skill.toLowerCase().replace(/\s+/g, '-');
    const baseStudents = Math.floor(randomInt(50000)) + 1000;
    const baseReviews = Math.floor(randomInt(5000)) + 100;

    return {
      id: `${category.id}-${skillLower}`,
      title: `${skill} ${category.name.includes('Development') ? 'Development' : 'Mastery'}`,
      description: `Comprehensive course covering ${skill} fundamentals to advanced concepts. Includes hands-on projects, real-world examples, and practical exercises.`,
      provider: this.getProviderForSkill(skill),
      rating: Math.round((3.5 + (randomInt(150) / 100)) * 10) / 10,
      reviews: baseReviews,
      duration: this.getDurationForSkill(skill),
      level: this.getLevelForSkill(skill),
      skills: [skill, ...this.getRelatedSkills(skill)],
      certification: category.certifications?.[0]?.name,
      domain: domainKey,
      category: category.id,
      format: this.getRandomFormat(),
      price: this.getPriceForLevel(this.getLevelForSkill(skill)),
      students: baseStudents
    };
  }

  private getProviderForSkill(skill: string): string {
    const providers: Record<string, string> = {
      'React': 'Meta',
      'Vue.js': 'Vue Mastery',
      'Angular': 'Google',
      'Node.js': 'Node.js Foundation',
      'Python': 'IBM',
      'Machine Learning': 'Stanford Online',
      'AWS': 'Amazon Web Services',
      'Azure': 'Microsoft',
      'Docker': 'Docker Inc.',
      'Kubernetes': 'CNCF',
      'SQL': 'Mode Analytics',
      'JavaScript': 'freeCodeCamp',
      'TypeScript': 'Microsoft',
      'TensorFlow': 'Google',
      'Pandas': 'DataCamp'
    };
    return providers[skill] || 'Coursera';
  }

  private getDurationForSkill(skill: string): string {
    const durations: Record<string, string> = {
      'React': '8 weeks',
      'Vue.js': '6 weeks',
      'Angular': '10 weeks',
      'Node.js': '7 weeks',
      'Python': '10 weeks',
      'Machine Learning': '12 weeks',
      'AWS': '6 weeks',
      'Docker': '4 weeks',
      'Kubernetes': '6 weeks',
      'SQL': '4 weeks',
      'JavaScript': '8 weeks',
      'TypeScript': '5 weeks'
    };
    return durations[skill] || '6 weeks';
  }

  private getLevelForSkill(skill: string): string {
    const advancedSkills = ['Machine Learning', 'Kubernetes', 'AWS', 'TensorFlow', 'GraphQL'];
    const intermediateSkills = ['React', 'Node.js', 'Python', 'Docker', 'TypeScript'];

    if (advancedSkills.includes(skill)) return 'advanced';
    if (intermediateSkills.includes(skill)) return 'intermediate';
    return 'beginner';
  }

  private getRelatedSkills(skill: string): string[] {
    const relations: Record<string, string[]> = {
      'React': ['JavaScript', 'HTML', 'CSS'],
      'Node.js': ['JavaScript', 'Express', 'MongoDB'],
      'Python': ['Pandas', 'NumPy', 'Jupyter'],
      'Machine Learning': ['Python', 'Statistics', 'TensorFlow'],
      'Docker': ['Linux', 'Containerization'],
      'Kubernetes': ['Docker', 'Cloud Computing'],
      'AWS': ['Cloud Computing', 'Linux'],
      'SQL': ['Database Design', 'PostgreSQL']
    };
    return relations[skill] || [];
  }

  private getRandomFormat(): string {
    const formats = ['video', 'interactive', 'project', 'reading'];
    return formats[randomInt(formats.length)];
  }

  private getPriceForLevel(level: string): string {
    const prices: Record<string, string> = {
      beginner: '$0 - $49',
      intermediate: '$49 - $149',
      advanced: '$99 - $299'
    };
    return prices[level] || '$79';
  }

  async searchCourses(params: CourseSearchParams): Promise<SearchResult> {
    let filteredCourses = [...this.courses];

    if (params.query) {
      const query = params.query.toLowerCase();
      filteredCourses = filteredCourses.filter(
        course =>
          course.title.toLowerCase().includes(query) ||
          course.description.toLowerCase().includes(query) ||
          course.skills.some(skill => skill.toLowerCase().includes(query))
      );
    }

    if (params.domain) {
      filteredCourses = filteredCourses.filter(c => c.domain === params.domain);
    }

    if (params.category) {
      filteredCourses = filteredCourses.filter(c => c.category === params.category);
    }

    if (params.level) {
      filteredCourses = filteredCourses.filter(c => c.level === params.level);
    }

    if (params.format && params.format.length > 0) {
      filteredCourses = filteredCourses.filter(c => params.format!.includes(c.format));
    }

    if (params.certification !== undefined) {
      filteredCourses = filteredCourses.filter(c =>
        params.certification ? c.certification : !c.certification
      );
    }

    const sortFunctions: Record<string, (a: Course, b: Course) => number> = {
      relevance: (a, b) => b.students - a.students,
      rating: (a, b) => b.rating - a.rating,
      duration: (a, b) => parseInt(a.duration) - parseInt(b.duration),
      popularity: (a, b) => b.students - a.students
    };

    const sortBy = params.sortBy || 'relevance';
    filteredCourses.sort(sortFunctions[sortBy]);

    const page = params.page || 1;
    const limit = params.limit || 10;
    const total = filteredCourses.length;
    const totalPages = Math.ceil(total / limit);
    const start = (page - 1) * limit;
    const paginatedCourses = filteredCourses.slice(start, start + limit);

    const recommendations: CourseRecommendation[] = paginatedCourses.map(course => ({
      courseId: course.id,
      title: course.title,
      description: course.description,
      provider: course.provider,
      rating: course.rating,
      duration: course.duration,
      level: course.level,
      skills: course.skills,
      certification: course.certification,
      matchScore: 0.8,
      reason: `${course.title} - ${course.provider}`
    }));

    const domains = [...new Set(this.courses.map(c => c.domain))];
    const levels = [...new Set(this.courses.map(c => c.level))];
    const formats = [...new Set(this.courses.map(c => c.format))];

    return {
      courses: recommendations,
      total,
      page,
      totalPages,
      filters: {
        availableDomains: domains,
        availableLevels: levels,
        availableFormats: formats
      }
    };
  }

  async getCourseById(courseId: string): Promise<CourseRecommendation | null> {
    const course = this.courses.find(c => c.id === courseId);
    if (!course) return null;

    return {
      courseId: course.id,
      title: course.title,
      description: course.description,
      provider: course.provider,
      rating: course.rating,
      duration: course.duration,
      level: course.level,
      skills: course.skills,
      certification: course.certification,
      matchScore: 1,
      reason: 'Direct course match'
    };
  }

  async getCoursesBySkill(skill: string): Promise<CourseRecommendation[]> {
    const courses = this.courses.filter(c =>
      c.skills.some(s => s.toLowerCase().includes(skill.toLowerCase()))
    );

    return courses.map(course => ({
      courseId: course.id,
      title: course.title,
      description: course.description,
      provider: course.provider,
      rating: course.rating,
      duration: course.duration,
      level: course.level,
      skills: course.skills,
      certification: course.certification,
      matchScore: course.skills.includes(skill) ? 1 : 0.7,
      reason: `Course covering ${skill}`
    }));
  }

  async getTrendingCourses(limit: number = 5): Promise<CourseRecommendation[]> {
    const sorted = [...this.courses]
      .sort((a, b) => b.students - a.students)
      .slice(0, limit);

    return sorted.map(course => ({
      courseId: course.id,
      title: course.title,
      description: course.description,
      provider: course.provider,
      rating: course.rating,
      duration: course.duration,
      level: course.level,
      skills: course.skills,
      certification: course.certification,
      matchScore: 0.9,
      reason: `Popular course with ${course.students.toLocaleString()} students`
    }));
  }

  async getDomains(): Promise<{ id: string; name: string; courseCount: number }[]> {
    const domainCounts: Record<string, { name: string; count: number }> = {};

    for (const [key, domain] of Object.entries(EDUCATION_KNOWLEDGE.domains)) {
      domainCounts[key] = {
        name: domain.name,
        count: this.courses.filter(c => c.domain === key).length
      };
    }

    return Object.entries(domainCounts).map(([id, data]) => ({
      id,
      name: data.name,
      courseCount: data.count
    }));
  }
}

export const courseService = new CourseService();
