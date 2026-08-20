export interface ImageWithFallbacks {
  url: string;
  metadata?: {
    fallbackUrls?: string[];
  };
}

export function getImageUrlWithFallback(photo: ImageWithFallbacks | string): string {
  if (typeof photo === 'string') {
    return photo;
  }
  
  return photo.url;
}

export function getImageFallbacks(photo: ImageWithFallbacks | string): string[] {
  if (typeof photo === 'string') {
    // Plain string URLs carry no alternate sources.
    return [];
  }
  
  return photo.metadata?.fallbackUrls || [];
}

export async function testImageUrl(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = url;
  });
}

export async function getWorkingImageUrl(photo: ImageWithFallbacks | string): Promise<string> {
  const primaryUrl = getImageUrlWithFallback(photo);
  
  // Test primary URL first
  if (await testImageUrl(primaryUrl)) {
    return primaryUrl;
  }
  
  // Try fallback URLs
  const fallbacks = getImageFallbacks(photo);
  for (const fallbackUrl of fallbacks) {
    if (await testImageUrl(fallbackUrl)) {
      return fallbackUrl;
    }
  }
  
  // Return primary URL as last resort (browser will show broken image)
  return primaryUrl;
}
