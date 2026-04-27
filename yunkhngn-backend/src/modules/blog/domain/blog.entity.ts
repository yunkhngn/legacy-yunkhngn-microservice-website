export class Blog {
  id: string;
  title: string;
  slug: string;
  thumbnail?: string;
  tags?: string;
  contentJSON: string;
  status: string;
  seoTitle?: string;
  seoDescription?: string;
  seoImage?: string;
  imageSettings?: string;
  views?: number;
  createdAt: Date;
  updatedAt: Date;
}
