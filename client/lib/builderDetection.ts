// Centralized Builder.io environment detection
export const isBuilderIoEditor = (): boolean => {
  try {
    if (typeof window === 'undefined') {
      return false;
    }

    // Multiple ways to detect Builder.io editor environment
    const checks = [
      window.location.href.includes('builder.io'),
      window.parent !== window, // Running in iframe
      document.referrer.includes('builder.io'),
      window.location.hostname.includes('builder.io'),
      // Check for Builder.io specific variables
      (window as any).__BUILDER_IO_EDITOR__ === true,
      // Check URL params that Builder.io might use
      window.location.search.includes('builder.io'),
      // Check for Builder.io CSS classes
      document.body.classList.contains('builder-editor'),
    ];

    const isEditor = checks.some(check => check);
    
    if (isEditor) {
      console.log('🔧 Builder.io editor environment detected');
    }

    return isEditor;
  } catch (error) {
    console.warn('Error detecting Builder.io environment:', error);
    return false;
  }
};

// Log detection result for debugging
export const logBuilderDetection = (context: string): boolean => {
  const result = isBuilderIoEditor();
  console.log(`${context}: Builder.io detected = ${result}`);
  if (result) {
    console.log(`${context}: URL = ${window.location.href}`);
    console.log(`${context}: In iframe = ${window.parent !== window}`);
    console.log(`${context}: Referrer = ${document.referrer}`);
  }
  return result;
};
