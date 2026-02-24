import { useWindowDimensions } from 'react-native';

interface ResponsiveScales {
  fontScale: number;
  thumbScale: number;
  spacingScale: number;
  windowWidth: number;
  windowHeight: number;
}

export function useResponsive(): ResponsiveScales {
  const { width, height } = useWindowDimensions();

  if (width >= 1200) {
    // Desktop
    return { fontScale: 1.4, thumbScale: 1.75, spacingScale: 1.3, windowWidth: width, windowHeight: height };
  }
  if (width >= 768) {
    // Tablet
    return { fontScale: 1.25, thumbScale: 1.4, spacingScale: 1.15, windowWidth: width, windowHeight: height };
  }
  // Mobile
  return { fontScale: 1, thumbScale: 1, spacingScale: 1, windowWidth: width, windowHeight: height };
}
