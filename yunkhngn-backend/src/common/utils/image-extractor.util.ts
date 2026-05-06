export function extractImagesFromJsonContent(content: string): string[] {
  if (!content) return [];

  const urls: string[] = [];

  // Try parsing as TipTap JSON first
  try {
    const parsed = JSON.parse(content);

    // Recursive function to find image nodes
    const findImages = (node: any) => {
      if (!node) return;
      if (node.type === 'image' && node.attrs && node.attrs.src) {
        urls.push(node.attrs.src);
      }
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(findImages);
      }
    };

    findImages(parsed);
    return urls;
  } catch {
    // If not valid JSON, it might be raw HTML
    const imgRegex = /<img[^>]+src="?([^"\s]+)"?\s*[^>]*>/g;
    let match;
    while ((match = imgRegex.exec(content)) !== null) {
      if (match[1]) urls.push(match[1]);
    }
    return urls;
  }
}
