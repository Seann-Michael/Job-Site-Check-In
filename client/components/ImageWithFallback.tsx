import React, { useState, useEffect } from 'react';
import { getImageUrlWithFallback, getImageFallbacks } from '@/lib/imageUtils';

interface ImageWithFallbackProps {
  photo: any; // Could be string or object with url and metadata
  alt: string;
  className?: string;
  onClick?: () => void;
}

export function ImageWithFallback({ photo, alt, className, onClick }: ImageWithFallbackProps) {
  const [currentUrl, setCurrentUrl] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [attemptedUrls, setAttemptedUrls] = useState<string[]>([]);

  // Derive the URL string so the effect only re-runs when the URL itself changes,
  // not when the photo object reference changes (e.g. after a state update).
  const primaryUrl = getImageUrlWithFallback(photo);

  useEffect(() => {
    setCurrentUrl(primaryUrl);
    setIsLoading(true);
    setError(false);
    setAttemptedUrls([]);
  }, [primaryUrl]);

  const handleImageError = () => {
    const fallbacks = getImageFallbacks(photo);
    const nextUrl = fallbacks.find(url => !attemptedUrls.includes(url));
    
    if (nextUrl) {
      setAttemptedUrls(prev => [...prev, currentUrl]);
      setCurrentUrl(nextUrl);
      setError(false);
    } else {
      setError(true);
      setIsLoading(false);
    }
  };

  const handleImageLoad = () => {
    setIsLoading(false);
    setError(false);
  };

  if (error && attemptedUrls.length > 0) {
    return (
      <div className={`bg-gray-200 flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-500 p-4">
          <div className="text-sm">Image not available</div>
          <div className="text-xs mt-1">Tried {attemptedUrls.length + 1} URLs</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-gray-100 animate-pulse flex items-center justify-center">
          <div className="text-gray-400 text-sm">Loading...</div>
        </div>
      )}
      <img
        src={currentUrl}
        alt={alt}
        className={`w-full h-full object-cover ${isLoading ? 'opacity-0' : 'opacity-100'} transition-opacity`}
        onError={handleImageError}
        onLoad={handleImageLoad}
        onClick={onClick}
      />
    </div>
  );
}
