/**
 * Typed shape of Jabez's real portfolio content, extracted from
 * `resume_jabez (3).pdf` (the authoritative source -- see
 * `data/portfolioKnowledge.ts`). Fields are `null` where the resume simply
 * doesn't document something (experience, internships, AI work) rather than
 * omitted or guessed -- callers can tell "not asked" apart from "asked and
 * genuinely unknown."
 */

export type ProjectCategory = 'web' | 'blockchain' | 'security' | 'game' | 'mobile';

export interface PortfolioProject {
  id: string;
  name: string;
  summary: string;
  highlights: string[];
  techStack: string[];
  location?: string;
  /** A real, live link -- only set when the resume actually gives one. */
  link?: string;
  category: ProjectCategory;
}

export interface PortfolioAchievement {
  id: string;
  name: string;
  /** The competition/platform, when named. Not every entry names one. */
  event?: string;
  /** Verbatim result as documented -- e.g. "Selected in the top 15", "Participation". Never upgraded to "won". */
  result: string;
  date: string;
  location?: string;
  summary: string[];
  techStack: string[];
  link?: string;
}

export interface PortfolioKnowledge {
  about: {
    name: string;
    location: string;
    educationStatus: string;
  };
  education: {
    institution: string;
    location: string;
    program: string;
    period: string;
    coursework: string[];
  };
  skills: {
    /** As stated in the resume's own "Skills" section -- narrower than what the projects actually use. */
    stated: {
      programming: string[];
      softwareAndFrameworks: string[];
      spokenLanguages: { language: string; level: string }[];
    };
    /** Aggregated, de-duplicated tech stack pulled from every project + achievement -- broader and more accurate. */
    fromProjects: string[];
  };
  projects: PortfolioProject[];
  achievements: PortfolioAchievement[];
  /** Not documented on the resume at all -- no Experience or Internships section exists. */
  experience: null;
  internships: null;
  /** No AI/ML work is mentioned anywhere on the resume. */
  aiWork: null;
  interests: string[];
  contact: {
    email: string;
    github: string;
    /** Deliberately not exposed to the bot -- see portfolioKnowledge.ts. */
    phonePublic: false;
  };
  navigation: {
    /** The portfolio site is listed as "[WORKING]" on the resume -- not live yet. */
    portfolioSiteLive: false;
  };
}
