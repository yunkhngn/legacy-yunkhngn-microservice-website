import { extractImagesFromJsonContent } from './image-extractor.util';

describe('extractImagesFromJsonContent', () => {
  it('should extract src from TipTap image nodes', () => {
    const content = JSON.stringify({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [] },
        {
          type: 'image',
          attrs: { src: 'https://res.cloudinary.com/test/image1.jpg' },
        },
      ],
    });
    expect(extractImagesFromJsonContent(content)).toEqual([
      'https://res.cloudinary.com/test/image1.jpg',
    ]);
  });

  it('should handle raw html strings containing images', () => {
    const html = '<img src="https://res.cloudinary.com/test/image2.jpg" />';
    expect(extractImagesFromJsonContent(html)).toEqual([
      'https://res.cloudinary.com/test/image2.jpg',
    ]);
  });
});
