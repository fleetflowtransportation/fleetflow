import { useEffect } from 'react';

// Counter to track number of active modals across the application
let activeLockCount = 0;
let previousBodyOverflow = '';
let previousBodyPosition = '';
let previousBodyTop = '';
let previousBodyWidth = '';
let previousBodyTouchAction = '';
let previousHtmlOverflow = '';
let scrollYPosition = 0;

/**
 * Universally locks body scroll across mobile browsers (iOS Safari, Android Chrome, WebView)
 * Uses position: fixed on body to completely eliminate background scroll chaining and rubber-banding.
 */
export function lockBodyScroll() {
  if (typeof document === 'undefined') return;

  if (activeLockCount === 0) {
    scrollYPosition = window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
    previousBodyOverflow = document.body.style.overflow;
    previousBodyPosition = document.body.style.position;
    previousBodyTop = document.body.style.top;
    previousBodyWidth = document.body.style.width;
    previousBodyTouchAction = document.body.style.touchAction;
    previousHtmlOverflow = document.documentElement.style.overflow;

    // Lock body scroll completely on mobile
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollYPosition}px`;
    document.body.style.width = '100%';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
  }
  activeLockCount++;
}

/**
 * Restores body scroll once all modals have closed, returning user to their exact scroll position.
 */
export function unlockBodyScroll() {
  if (typeof document === 'undefined') return;

  activeLockCount = Math.max(0, activeLockCount - 1);
  if (activeLockCount === 0) {
    document.body.style.overflow = previousBodyOverflow;
    document.body.style.position = previousBodyPosition;
    document.body.style.top = previousBodyTop;
    document.body.style.width = previousBodyWidth;
    document.body.style.touchAction = previousBodyTouchAction;
    document.documentElement.style.overflow = previousHtmlOverflow;

    // Restore original scroll offset
    window.scrollTo(0, scrollYPosition);
  }
}

/**
 * React hook to lock body scrolling whenever a modal is open.
 */
export function useBodyScrollLock(isLocked: boolean) {
  useEffect(() => {
    if (!isLocked) return;

    lockBodyScroll();

    return () => {
      unlockBodyScroll();
    };
  }, [isLocked]);
}

export default useBodyScrollLock;
