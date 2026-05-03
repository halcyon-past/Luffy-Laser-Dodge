export function isMobile() {
  if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') return false;
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
}
