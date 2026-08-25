import { portfolioKnowledge } from '@/data/portfolioKnowledge';
import type { NavigationAction, PortfolioProject } from '@/types';

/**
 * Pattern-matches a visitor's question against `portfolioKnowledge` and
 * produces a grounded reply. Every sentence here traces back to a field in
 * `portfolioKnowledge.ts` -- nothing is synthesized beyond stitching
 * documented facts into prose. When the resume genuinely doesn't say
 * something (experience, internships, AI work), the reply says so instead
 * of staying silent or guessing.
 *
 * This is a placeholder for what a real backend/LLM will eventually do with
 * retrieved context -- the shape (`{ text, actions }`) is exactly what
 * `ChatTransport` already expects, so swapping this out for a real
 * retrieval-augmented backend later doesn't change the transport contract.
 */

const RESUME_ACTION: NavigationAction = {
  id: 'action-resume',
  label: 'View resume',
  kind: 'external-link',
  target: '/resume-jabez.pdf',
};

const GITHUB_ACTION: NavigationAction = {
  id: 'action-github',
  label: 'View GitHub',
  kind: 'external-link',
  target: portfolioKnowledge.contact.github,
};

const EMAIL_ACTION: NavigationAction = {
  id: 'action-email',
  label: 'Email Jabez',
  kind: 'external-link',
  target: `mailto:${portfolioKnowledge.contact.email}`,
};

function projectAction(project: PortfolioProject): NavigationAction | null {
  if (!project.link) return null;
  return {
    id: `action-project-${project.id}`,
    label: `Open ${project.name}`,
    kind: 'external-link',
    target: project.link,
  };
}

interface KnowledgeReply {
  text: string;
  actions: NavigationAction[];
}

function matchesAny(text: string, keywords: string[]): boolean {
  return keywords.some((k) => text.includes(k));
}

function aboutReply(): KnowledgeReply {
  const { about, education } = portfolioKnowledge;
  return {
    text:
      `${about.name} is based in ${about.location}, currently pursuing a ${education.program} at ` +
      `${education.institution} (${education.period}). His work spans web apps, blockchain/smart-contract ` +
      `projects, and a couple of hackathon builds -- ask about any of those specifically.`,
    actions: [GITHUB_ACTION],
  };
}

function blockchainReply(): KnowledgeReply {
  const blockchainProjects = portfolioKnowledge.projects.filter((p) => p.category === 'blockchain');
  const blockchainAchievement = portfolioKnowledge.achievements.find((a) => a.id === 'ach-skillexify');

  const lines = blockchainProjects.map(
    (p) => `${p.name} -- ${p.summary} Stack: ${p.techStack.join(', ')}.`,
  );
  if (blockchainAchievement) {
    lines.push(
      `He also built ${blockchainAchievement.name} (${blockchainAchievement.event}, ${blockchainAchievement.result}) -- ${blockchainAchievement.summary[0]}`,
    );
  }

  const actions: NavigationAction[] = [];
  for (const p of blockchainProjects) {
    const a = projectAction(p);
    if (a) actions.push(a);
  }
  if (blockchainAchievement?.link) {
    actions.push({
      id: `action-achievement-${blockchainAchievement.id}`,
      label: `Open ${blockchainAchievement.name}`,
      kind: 'external-link',
      target: blockchainAchievement.link,
    });
  }
  actions.push(GITHUB_ACTION);

  return { text: lines.join('\n\n'), actions };
}

function skillsReply(): KnowledgeReply {
  const { stated } = portfolioKnowledge.skills;
  return {
    text:
      `Core languages: ${stated.programming.join(', ')}. Frameworks/tools he's used across his listed projects ` +
      `include React, Next.js, Node.js, Solidity, Hardhat, React Native, and WebSockets/encryption for secure apps -- ` +
      `the specific stack varies a lot by project, so ask about a particular one for detail. He also speaks ` +
      `${stated.spokenLanguages.length} languages, native in Tamil.`,
    actions: [GITHUB_ACTION],
  };
}

function whyHireReply(): KnowledgeReply {
  const top15 = portfolioKnowledge.achievements.find((a) => a.id === 'ach-ctrlalthack');
  const scamshield = portfolioKnowledge.projects.find((p) => p.id === 'proj-scamshield');
  return {
    text:
      `A few concrete data points rather than a sales pitch: he was ${top15?.result.toLowerCase()} at ` +
      `${top15?.event} (${top15?.date}); he shipped a WCAG 2.1 AA-compliant app and measurably improved its ` +
      `accessibility score from 65 to 95 (${scamshield?.name}); and he's built and deployed real Solidity smart ` +
      `contracts on a live testnet, not just tutorials. He's currently an undergrad, so weigh that against what ` +
      `you need -- happy to point you to his GitHub or resume for the rest.`,
    actions: [RESUME_ACTION, GITHUB_ACTION],
  };
}

function projectsReply(): KnowledgeReply {
  const { projects } = portfolioKnowledge;
  const lines = projects.map((p) => `${p.name} -- ${p.summary}`);
  const actions: NavigationAction[] = [];
  for (const p of projects) {
    const a = projectAction(p);
    if (a) actions.push(a);
  }
  actions.push(GITHUB_ACTION);

  const siteNote = portfolioKnowledge.navigation.portfolioSiteLive
    ? ''
    : "\n\n(His full portfolio site isn't live yet -- GitHub and the live project links above are the best way to see the work right now.)";

  return { text: lines.join('\n\n') + siteNote, actions };
}

function contactReply(): KnowledgeReply {
  return {
    text: `The best way to reach him is by email -- ${portfolioKnowledge.contact.email} -- or through GitHub.`,
    actions: [EMAIL_ACTION, GITHUB_ACTION],
  };
}

function experienceReply(): KnowledgeReply {
  return {
    text:
      "That's not documented on his resume -- there's no formal work-experience or internship history listed, " +
      "just his coursework, personal/hackathon projects, and achievements. His projects are the best evidence " +
      'of what he can build.',
    actions: [RESUME_ACTION, GITHUB_ACTION],
  };
}

const FALLBACK_REPLY =
  "I'm running on placeholder responses for now -- the real assistant connects once the backend lands. " +
  'I can talk about his projects, blockchain work, technologies, or how to get in touch, though -- try one of those.';

/**
 * Returns null when nothing in the knowledge base matches -- callers fall
 * back to a generic reply rather than forcing a bad match.
 */
export function answerFromKnowledge(question: string): KnowledgeReply {
  const q = question.toLowerCase();

  if (matchesAny(q, ['who is', 'about jabez', 'tell me about', 'introduce'])) return aboutReply();
  if (matchesAny(q, ['blockchain', 'web3', 'smart contract', 'solidity', 'crypto project', 'nft'])) {
    return blockchainReply();
  }
  if (matchesAny(q, ['technolog', 'tech stack', 'skill', 'programming language', 'what does he know', 'what can he do'])) {
    return skillsReply();
  }
  if (matchesAny(q, ['why should i hire', 'why hire', 'why choose him', 'should i hire'])) return whyHireReply();
  if (matchesAny(q, ['experience', 'internship', 'work history', 'job history'])) return experienceReply();
  if (matchesAny(q, ['project', 'built', 'portfolio', 'take me to', 'show me'])) return projectsReply();
  if (matchesAny(q, ['contact', 'reach him', 'get in touch', 'email him', 'i want to contact'])) return contactReply();
  if (matchesAny(q, ['freelance', 'available', 'hire him for'])) return contactReply();

  return { text: FALLBACK_REPLY, actions: [] };
}
