export class Gallery {
    id: string;
    imageUrl: string;
    thumbnailUrl?: string;
    caption?: string;
    albumId?: string;
    tags?: string;
    views: number;
    sortOrder: number;
    blurHash?: string;
    width?: number;
    height?: number;
    exifData?: string;
    createdAt: Date;
    album?: {
        id: string;
        name: string;
        slug: string;
    };
}
