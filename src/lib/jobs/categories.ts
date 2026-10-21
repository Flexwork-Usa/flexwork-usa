export type JobSubcategory = {
  id: string;
  name: string;
  description: string;
  keywords: string[];
};

export type JobCategory = {
  id: string;
  name: string;
  subcategories: JobSubcategory[];
};

export type TaxonomySelection = {
  categoryId: string | null;
  subcategoryId: string | null;
};

export const JOB_CATEGORIES: JobCategory[] = [
  {
    id: "ai-automation",
    name: "AI & Automation",
    subcategories: [
      { id: "artificial-intelligence", name: "Artificial Intelligence", description: "Work on cutting-edge AI projects", keywords: ["artificial intelligence", "rlhf"] },
      { id: "ai-model-training", name: "AI Model Training", description: "Label, train, and fine-tune AI models", keywords: ["model training", "fine-tune", "fine tune", "ai training"] },
      { id: "ai-content-creation", name: "AI Content Creation", description: "Write and edit AI-assisted content", keywords: ["ai content", "ai-assisted"] },
      { id: "ai-writing", name: "AI Writing", description: "Write with and about AI", keywords: ["ai writing"] },
      { id: "chatbot", name: "Chatbot", description: "Deploy conversational bots", keywords: ["chatbot", "conversational bot"] },
      { id: "ai-generated-video", name: "AI Generated Video", description: "Create AI-powered video content", keywords: ["ai video", "ai-generated video"] },
      { id: "prompt-engineering", name: "Prompt Engineering", description: "Craft prompts for better AI outputs", keywords: ["prompt engineering"] },
      { id: "generative-ai", name: "Generative AI", description: "Build with generative AI tools", keywords: ["generative ai"] },
      { id: "automation", name: "Automation", description: "Workflows that cut manual work", keywords: ["automation", "workflow"] },
      { id: "chatgpt", name: "ChatGPT", description: "Projects using ChatGPT and OpenAI", keywords: ["chatgpt", "openai"] },
    ],
  },
  {
    id: "development-it",
    name: "Development & IT",
    subcategories: [
      { id: "website-development", name: "Website Development", description: "Sites from scratch or templates", keywords: ["website development", "web development"] },
      { id: "software-development", name: "Software Development", description: "Build software products and tools", keywords: ["software development", "software"] },
      { id: "frontend-development", name: "Frontend Development", description: "Build interfaces users love", keywords: ["frontend", "front-end", "front end"] },
      { id: "react-js", name: "React JS", description: "Build dynamic UIs with React", keywords: ["react js", "react"] },
      { id: "full-stack-development", name: "Full Stack Development", description: "Full front and back end development", keywords: ["full stack", "fullstack"] },
      { id: "coding", name: "Coding", description: "Coding across languages and stacks", keywords: ["coding", "programmer"] },
      { id: "python", name: "Python", description: "Scripting, automation, Python", keywords: ["python"] },
      { id: "web-design", name: "Web Design", description: "Design clean, functional websites", keywords: ["web design"] },
      { id: "wordpress", name: "WordPress", description: "Build and maintain WordPress sites", keywords: ["wordpress"] },
      { id: "shopify", name: "Shopify", description: "Build and customize Shopify stores", keywords: ["shopify"] },
    ],
  },
  {
    id: "marketing",
    name: "Marketing",
    subcategories: [
      { id: "pay-per-click", name: "Pay Per Click", description: "Manage paid search and display ads", keywords: ["pay per click", "ppc"] },
      { id: "digital-marketing", name: "Digital Marketing", description: "Full-funnel marketing, all channels", keywords: ["digital marketing"] },
      { id: "affiliate-marketing", name: "Affiliate Marketing", description: "Build and manage affiliate programs", keywords: ["affiliate marketing", "affiliate"] },
      { id: "email-marketing", name: "Email Marketing", description: "Campaigns written to convert", keywords: ["email marketing"] },
      { id: "google-ads", name: "Google Ads", description: "Run and optimize Google ads", keywords: ["google ads"] },
      { id: "social-media-marketing", name: "Social Media Marketing", description: "Grow audiences on social platforms", keywords: ["social media marketing"] },
      { id: "social-media-management", name: "Social Media Management", description: "Manage accounts, content, community", keywords: ["social media management", "community management"] },
      { id: "seo", name: "SEO", description: "Improve rankings, organic traffic", keywords: ["seo", "search engine"] },
      { id: "lead-generation", name: "Lead Generation", description: "Find and qualify sales prospects", keywords: ["lead generation", "leads"] },
      { id: "influencer-marketing", name: "Influencer Marketing", description: "Connect brands with top creators", keywords: ["influencer"] },
    ],
  },
  {
    id: "design-creative",
    name: "Design & Creative",
    subcategories: [
      { id: "graphic-design", name: "Graphic Design", description: "Visual assets for brands and campaigns", keywords: ["graphic design", "graphics"] },
      { id: "illustration", name: "Illustration", description: "Custom artwork for any use case", keywords: ["illustration", "illustrator"] },
      { id: "canva", name: "Canva", description: "Social graphics and decks in Canva", keywords: ["canva"] },
      { id: "presentation-design", name: "Presentation Design", description: "Decks that communicate clearly", keywords: ["presentation", "slide deck"] },
      { id: "cad-design", name: "CAD Design", description: "Technical drawings and CAD models", keywords: ["cad"] },
      { id: "logo-design", name: "Logo Design", description: "Marks and wordmarks for brands", keywords: ["logo"] },
      { id: "photo-editing", name: "Photo Editing", description: "Retouch, composite, color-correct", keywords: ["photo editing", "retouch"] },
      { id: "ux-ui-design", name: "UX/UI Design", description: "Intuitive digital experiences", keywords: ["ux/ui", "ux", "ui design", "usability"] },
      { id: "3d-modeling", name: "3D Modeling", description: "Create 3D assets and renders", keywords: ["3d", "three d"] },
      { id: "interior-design", name: "Interior Design", description: "Space planning, interior concepts", keywords: ["interior design"] },
    ],
  },
  {
    id: "video-audio",
    name: "Video & Audio",
    subcategories: [
      { id: "video-editing", name: "Video Editing", description: "Cut and polish video, any platform", keywords: ["video editing", "video editor"] },
      { id: "voice-acting", name: "Voice Acting", description: "Bring characters and scripts alive", keywords: ["voice acting"] },
      { id: "narration", name: "Narration", description: "Clear, engaging spoken content", keywords: ["narration", "narrator"] },
      { id: "videography", name: "Videography", description: "Shoot and produce pro video", keywords: ["videography", "videographer"] },
      { id: "audio-production", name: "Audio Production", description: "Record, mix, and master audio", keywords: ["audio", "speech"] },
      { id: "voice-over", name: "Voice Over", description: "Pro voice recording, any project", keywords: ["voice over", "voiceover"] },
      { id: "animation", name: "Animation", description: "Characters, logos, explainers", keywords: ["animation", "animator"] },
      { id: "subtitling", name: "Subtitling", description: "Add captions and subtitles to video", keywords: ["subtitle", "caption"] },
      { id: "motion-graphics", name: "Motion Graphics", description: "Animated graphics for video and social", keywords: ["motion graphics"] },
      { id: "podcasting", name: "Podcasting", description: "Produce and edit podcast content", keywords: ["podcast"] },
    ],
  },
  {
    id: "writing-content",
    name: "Writing & Content",
    subcategories: [
      { id: "writing", name: "Writing", description: "Writing across topics and formats", keywords: ["writing"] },
      { id: "ghostwriting", name: "Ghostwriting", description: "Write content under another's name", keywords: ["ghostwriting", "ghostwriter"] },
      { id: "content-writing", name: "Content Writing", description: "Blog posts, articles, web content", keywords: ["content writing", "blog"] },
      { id: "scriptwriting", name: "Scriptwriting", description: "Scripts for video, film, and audio", keywords: ["scriptwriting", "script"] },
      { id: "creative-writing", name: "Creative Writing", description: "Fiction, stories, creative work", keywords: ["creative writing", "fiction"] },
      { id: "copywriting", name: "Copywriting", description: "Persuasive copy for ads and web", keywords: ["copywriting", "copywriter"] },
      { id: "proofreading", name: "Proofreading", description: "Catch errors before going live", keywords: ["proofreading", "proofread"] },
      { id: "technical-writing", name: "Technical Writing", description: "Docs and guides for complex topics", keywords: ["technical writing", "documentation"] },
      { id: "article-writing", name: "Article Writing", description: "Research-backed articles, any topic", keywords: ["article"] },
      { id: "resume-writing", name: "Resume Writing", description: "Help job seekers land interviews", keywords: ["resume", "cv"] },
    ],
  },
  {
    id: "admin-support",
    name: "Admin & Support",
    subcategories: [
      { id: "data-entry", name: "Data Entry", description: "Fast, accurate data processing work", keywords: ["data entry"] },
      { id: "chat-support", name: "Chat Support", description: "Real-time customer chat support", keywords: ["chat support", "live chat"] },
      { id: "transcription", name: "Transcription", description: "Convert audio and video to text", keywords: ["transcription", "transcribe"] },
      { id: "customer-service", name: "Customer Service", description: "Support customers across channels", keywords: ["customer service", "customer support"] },
      { id: "executive-assistant", name: "Executive Assistant", description: "High-level support for executives", keywords: ["executive assistant"] },
      { id: "virtual-assistant", name: "Virtual Assistant", description: "Remote support for professionals", keywords: ["virtual assistant", "calendar"] },
      { id: "data-annotation", name: "Data Annotation", description: "Label data that trains AI models", keywords: ["annotation", "annotator", "label", "catalog", "survey coder"] },
      { id: "microsoft-excel", name: "Microsoft Excel", description: "Spreadsheets, formulas, cleanup", keywords: ["excel", "spreadsheet"] },
      { id: "appointment-setting", name: "Appointment Setting", description: "Book meetings for sales and service", keywords: ["appointment"] },
      { id: "email-support", name: "Email Support", description: "Handle customer inquiries by email", keywords: ["email support"] },
    ],
  },
];

const categoryById = new Map(JOB_CATEGORIES.map((category) => [category.id, category]));

const subcategoryById = new Map(
  JOB_CATEGORIES.flatMap((category) => category.subcategories.map((subcategory) => [subcategory.id, { category, subcategory }] as const)),
);

export const PLATFORM_SUBCATEGORIES: Record<string, string[]> = {
  outlier: ["ai-model-training", "artificial-intelligence", "data-annotation"],
  dataannotation: ["ai-model-training", "data-annotation"],
  alignerr: ["ai-model-training", "artificial-intelligence"],
  telus: ["ai-model-training", "data-annotation"],
  oneforma: ["ai-model-training", "data-annotation"],
  remotasks: ["ai-model-training", "data-annotation"],
  handshake: ["artificial-intelligence", "ai-model-training"],
  ethos: ["artificial-intelligence", "ai-model-training"],
  micro1: ["artificial-intelligence", "ai-model-training", "software-development"],
  mercor: ["artificial-intelligence", "ai-model-training"],
  crowdgen: ["ai-model-training", "data-annotation"],
  mindrift: ["ai-model-training", "data-annotation"],
  clickworker: ["data-annotation", "data-entry", "ai-model-training"],
  turing: ["software-development", "coding", "ai-model-training"],
  mturk: ["data-annotation", "data-entry"],
  upwork: ["website-development", "software-development", "graphic-design", "content-writing", "digital-marketing", "virtual-assistant"],
  fiverr: ["graphic-design", "logo-design", "video-editing", "content-writing", "voice-over"],
  toptal: ["software-development", "frontend-development", "full-stack-development"],
  contra: ["graphic-design", "website-development", "content-writing"],
  freelancer: ["website-development", "graphic-design", "content-writing", "data-entry"],
  prolific: ["data-annotation"],
  cloudresearch: ["data-annotation"],
  usertesting: ["ux-ui-design"],
  respondent: ["ux-ui-design"],
  userinterviews: ["ux-ui-design"],
};

export function getCategory(id: string | null | undefined) {
  if (!id) return null;
  return categoryById.get(id) ?? null;
}

export function getSubcategory(id: string | null | undefined) {
  if (!id) return null;
  return subcategoryById.get(id) ?? null;
}

function includesTerm(haystack: string, term: string) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:[^a-z0-9]|$)`, "i").test(haystack);
}

export function subcategoryIdsForText(text: string) {
  const haystack = text.toLowerCase();
  const matches: string[] = [];
  for (const category of JOB_CATEGORIES) {
    for (const subcategory of category.subcategories) {
      if (subcategory.keywords.some((keyword) => includesTerm(haystack, keyword))) {
        matches.push(subcategory.id);
      }
    }
  }
  return matches;
}

export function primarySubcategory(text: string) {
  const haystack = text.toLowerCase();
  let best: { id: string; length: number } | null = null;
  for (const category of JOB_CATEGORIES) {
    for (const subcategory of category.subcategories) {
      for (const keyword of subcategory.keywords) {
        if (!includesTerm(haystack, keyword)) continue;
        if (!best || keyword.length > best.length) best = { id: subcategory.id, length: keyword.length };
      }
    }
  }
  return best ? getSubcategory(best.id) : null;
}

export function subcategoryIdsForPlatform(platformId: string, text = "") {
  const mapped = PLATFORM_SUBCATEGORIES[platformId];
  if (mapped?.length) return mapped;
  return subcategoryIdsForText(text);
}

export function matchesTaxonomy(subcategoryIds: string[], selection: TaxonomySelection) {
  if (!selection.categoryId && !selection.subcategoryId) return true;
  if (selection.subcategoryId) return subcategoryIds.includes(selection.subcategoryId);
  const category = getCategory(selection.categoryId);
  if (!category) return true;
  const allowed = new Set(category.subcategories.map((subcategory) => subcategory.id));
  return subcategoryIds.some((id) => allowed.has(id));
}

export function taxonomyLabel(subcategoryIds: string[]) {
  const match = subcategoryIds.map((id) => getSubcategory(id)).find(Boolean);
  if (!match) return null;
  return `${match.category.name} · ${match.subcategory.name}`;
}
