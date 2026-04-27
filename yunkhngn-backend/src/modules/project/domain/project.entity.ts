export class Project {
    id: string;
    slug: string;
    title: string;
    description?: string;
    content?: string;
    cover?: string;
    demoLink?: string;
    githubLink?: string;
    tags?: string;
    createdAt: Date;
}
