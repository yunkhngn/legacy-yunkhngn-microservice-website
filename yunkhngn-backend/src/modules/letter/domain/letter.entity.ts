export class LetterPage {
    id: string;
    letterId: string;
    imageUrl: string;
    revealMapUrl?: string;
    width: number;
    height: number;
    sortOrder: number;
    createdAt: Date;
}

export class Letter {
    id: string;
    code: string;
    title: string;
    password?: string;
    views: number;
    isActive: boolean;
    status: string;
    enableAnimation: boolean;
    createdAt: Date;
    updatedAt: Date;
    pages?: LetterPage[];
}
