import { HttpError } from '../utils/http-error.js';

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export const DEFAULT_ABOUT_PAGE_CONTENT = {
  whoWeAre: {
    label: 'ABOUT ZTALENT CODER',
    title: 'Empowering Talent. Building Technology. Shaping the Future.',
    body: 'Ztalent Coder is a technology-driven company committed to empowering individuals, advancing digital innovation, and building technology solutions that create meaningful impact.\n\nWe believe technology is more than just tools and systems; it is an opportunity to solve problems, unlock potential, connect communities, and create new possibilities.\n\nThrough a combination of technology, education, creativity, and collaboration, we aim to contribute to a future where individuals and organizations can use technology to grow, innovate, and achieve more.\n\nOur focus is on building meaningful solutions, developing technological skills, and creating opportunities that support sustainable digital growth.',
    isActive: true,
    sortOrder: 0,
  },
  story: {
    label: 'OUR JOURNEY',
    title: 'The Story Behind Ztalent Coder',
    subheading: 'Driven by Possibility. Inspired by Innovation.',
    body: 'Ztalent Coder was established around a simple but powerful belief: technology and human talent can work together to create meaningful change.\n\nWe recognize the growing importance of technology in education, business, communication, and everyday life. At the same time, we see the need for more opportunities for people to develop their skills, explore their potential, and participate in the digital world.\n\nThis inspired our commitment to bringing talent and technology together.\n\nWe envision Ztalent Coder as a platform where ideas can grow into practical solutions, individuals can develop their technological capabilities, and organizations can access innovative approaches to their challenges.\n\nOur journey is driven by a commitment to continuous learning, innovation, collaboration, and the belief that the future can be shaped through what we build today.',
    isActive: true,
    sortOrder: 1,
  },
  missionVision: {
    missionLabel: 'OUR MISSION',
    missionTitle: 'Creating Opportunities Through Technology and Talent.',
    missionDescription: 'Our mission is to empower individuals and organizations through technology, knowledge, and innovation by developing practical digital solutions, promoting technological skills, and creating opportunities for growth and positive impact.',
    visionLabel: 'OUR VISION',
    visionTitle: 'Becoming a Leading Force in Technology and Talent Development.',
    visionDescription: 'Our vision is to become a recognized technology company that contributes to digital transformation, nurtures technological talent, and delivers innovative solutions that create lasting value locally and globally.',
    isActive: true,
    sortOrder: 2,
  },
  coreValues: {
    label: 'WHAT WE STAND FOR',
    title: 'The Principles That Guide Us',
    description: 'The principles that shape our culture, decisions, relationships, and commitment to excellence.',
    values: [
      { title: 'INNOVATION', description: 'We embrace creativity, new ideas, and emerging technologies to develop better ways of solving problems.', icon: 'spark', sortOrder: 0, isActive: true },
      { title: 'EXCELLENCE', description: 'We strive for high standards in everything we do, continuously improving the quality of our work and the value we deliver.', icon: 'star', sortOrder: 1, isActive: true },
      { title: 'INTEGRITY', description: 'We believe in honesty, transparency, accountability, and building relationships based on trust.', icon: 'shield', sortOrder: 2, isActive: true },
      { title: 'COLLABORATION', description: 'We value teamwork, partnerships, and shared knowledge because meaningful progress is achieved when people work together.', icon: 'people', sortOrder: 3, isActive: true },
      { title: 'CONTINUOUS LEARNING', description: 'We encourage curiosity, knowledge sharing, and lifelong learning to remain adaptable in a constantly evolving technological world.', icon: 'learning', sortOrder: 4, isActive: true },
      { title: 'IMPACT', description: "We focus on creating solutions and opportunities that make a meaningful and positive difference in people's lives, businesses, and communities.", icon: 'impact', sortOrder: 5, isActive: true },
    ],
    isActive: true,
    sortOrder: 3,
  },
  philosophy: {
    label: 'OUR APPROACH',
    title: 'Technology with Purpose. Talent with Potential.',
    introduction: 'At Ztalent Coder, we believe that meaningful technological progress begins with understanding people, identifying real challenges, and developing solutions that make a difference.\n\nOur philosophy is built around three important ideas:',
    principles: [
      { title: 'PEOPLE FIRST', description: 'We believe that people are at the center of every meaningful innovation. Developing talent, sharing knowledge, and creating opportunities are essential to sustainable progress.', sortOrder: 0, isActive: true },
      { title: 'INNOVATION WITH PURPOSE', description: 'We do not believe in technology simply for the sake of technology. We believe in building solutions that address real needs, improve processes, and create practical value.', sortOrder: 1, isActive: true },
      { title: 'GROWTH THROUGH COLLABORATION', description: 'We believe that partnerships, teamwork, and knowledge sharing create stronger opportunities for individuals, businesses, and communities to grow together.', sortOrder: 2, isActive: true },
    ],
    closing: 'These principles shape how we think, work, innovate, and build relationships.',
    isActive: true,
    sortOrder: 4,
  },
  team: {
    label: 'THE PEOPLE BEHIND ZTALENT CODER',
    title: 'Meet the People Behind Our Vision',
    description: 'Behind every great idea is a team driven by passion, creativity, and a shared commitment to making a difference.',
    buttonLabel: 'Meet Our Team',
    destination: '/team',
    isActive: true,
    sortOrder: 5,
  },
  closing: {
    title: 'Building the Future Together.',
    body: "The future is shaped by the ideas we develop, the knowledge we share, and the solutions we create today.\n\nAt Ztalent Coder, we are committed to being part of that journey by empowering talent, advancing technology, and creating opportunities for meaningful progress.\n\nWe welcome individuals, businesses, institutions, and partners who share our belief in the power of technology and innovation.",
    finalStatement: "Together, let's empower talent, build technology, and shape the future.",
    isActive: true,
    sortOrder: 6,
  },
};

function invalid(message = 'About page content is invalid.') {
  return new HttpError(400, 'VALIDATION_ERROR', message);
}

function parseObject(value, fields) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalid();
  if (Object.keys(value).some((key) => !fields.includes(key))) throw invalid('About page content contains unsupported fields.');
  return value;
}

function parseText(value, maxLength = 10000) {
  if (typeof value !== 'string') throw invalid('About page text fields must be strings.');
  const cleaned = value.replace(CONTROL_CHARACTERS, '').trim();
  if (!cleaned || cleaned.length > maxLength) throw invalid('About page text fields cannot be empty or exceed their character limit.');
  return cleaned;
}

function parseSection(section, fields, textFields) {
  parseObject(section, [...fields, 'isActive', 'sortOrder']);
  if (typeof section.isActive !== 'boolean') throw invalid('Section visibility must be true or false.');
  if (!Number.isSafeInteger(section.sortOrder) || section.sortOrder < 0) throw invalid('Section order must be a non-negative integer.');
  return Object.fromEntries([
    ...textFields.map((field) => [field, parseText(section[field])]),
    ['isActive', section.isActive],
    ['sortOrder', section.sortOrder],
  ]);
}

function parseItems(items, kind) {
  const fields = kind === 'value'
    ? ['title', 'description', 'icon', 'sortOrder', 'isActive']
    : ['title', 'description', 'sortOrder', 'isActive'];
  if (!Array.isArray(items) || items.length !== (kind === 'value' ? 6 : 3)) throw invalid('The About page has an invalid number of list items.');
  return items.map((item) => {
    parseObject(item, fields);
    if (typeof item.isActive !== 'boolean') throw invalid('Item visibility must be true or false.');
    if (!Number.isSafeInteger(item.sortOrder) || item.sortOrder < 0) throw invalid('Item order must be a non-negative integer.');
    const parsed = {
      title: parseText(item.title, 180),
      description: parseText(item.description),
      sortOrder: item.sortOrder,
      isActive: item.isActive,
    };
    if (kind === 'value') {
      if (!['spark', 'star', 'shield', 'people', 'learning', 'impact'].includes(item.icon)) throw invalid('A core value icon is invalid.');
      parsed.icon = item.icon;
    }
    return parsed;
  });
}

export function validateAboutPageContent(content) {
  parseObject(content, ['whoWeAre', 'story', 'missionVision', 'coreValues', 'philosophy', 'team', 'closing']);
  const parsed = {};
  parsed.whoWeAre = parseSection(content.whoWeAre, ['label', 'title', 'body'], ['label', 'title', 'body']);
  parsed.story = parseSection(content.story, ['label', 'title', 'subheading', 'body'], ['label', 'title', 'subheading', 'body']);
  parsed.missionVision = parseSection(content.missionVision,
    ['missionLabel', 'missionTitle', 'missionDescription', 'visionLabel', 'visionTitle', 'visionDescription'],
    ['missionLabel', 'missionTitle', 'missionDescription', 'visionLabel', 'visionTitle', 'visionDescription']);
  parsed.coreValues = parseSection(content.coreValues, ['label', 'title', 'description', 'values'], ['label', 'title', 'description']);
  parsed.coreValues.values = parseItems(content.coreValues.values, 'value');
  parsed.philosophy = parseSection(content.philosophy, ['label', 'title', 'introduction', 'principles', 'closing'], ['label', 'title', 'introduction', 'closing']);
  parsed.philosophy.principles = parseItems(content.philosophy.principles, 'principle');
  parsed.team = parseSection(content.team, ['label', 'title', 'description', 'buttonLabel', 'destination'], ['label', 'title', 'description', 'buttonLabel']);
  if (typeof content.team.destination !== 'string' || !/^\/(?!\/)[a-z0-9/_-]*$/i.test(content.team.destination)) {
    throw invalid('The team button destination must be a local path.');
  }
  parsed.team.destination = content.team.destination;
  parsed.closing = parseSection(content.closing, ['title', 'body', 'finalStatement'], ['title', 'body', 'finalStatement']);
  return parsed;
}

export function serializePublicAboutPage(content) {
  return Object.fromEntries(Object.entries(content)
    .filter(([key, section]) => key !== 'closing' && section.isActive)
    .sort(([, first], [, second]) => first.sortOrder - second.sortOrder)
    .map(([key, section]) => [key, {
      ...Object.fromEntries(Object.entries(section).filter(([field]) => !['isActive', 'sortOrder', 'values', 'principles'].includes(field))),
      displayOrder: section.sortOrder,
      ...(key === 'coreValues' ? { values: section.values.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(({ isActive, sortOrder, ...item }) => item) } : {}),
      ...(key === 'philosophy' ? { principles: section.principles.filter((item) => item.isActive).sort((a, b) => a.sortOrder - b.sortOrder).map(({ isActive, sortOrder, ...item }) => item) } : {}),
    }]));
}