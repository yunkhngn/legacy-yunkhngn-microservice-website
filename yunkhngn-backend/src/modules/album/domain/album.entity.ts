export class Album {
    id: string;
    name: string;
    slug: string;
    description?: string;
    coverPhotoId?: string;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
    photoCount?: number;
    photos?: any[];
}
