export class Contact {
    id: string;
    name: string;
    email: string;
    phone?: string;
    company?: string;
    subject: string;
    message: string;
    category: string;
    status: string;
    adminResponse?: string;
    respondedAt?: Date;
    createdAt: Date;
}
