export class Project {
  id: string;
  slug: string;
  title: string;
  description?: string;
  contentJSON?: string;
  techStack?: string;
  cover?: string;
  demoLink?: string;
  repoLink?: string;
  githubLink?: string;
  tags?: string;
  createdAt: Date;
}
