export const colors = {
  primary: '#7C3AED',
  secondary: '#EC4899',
  success: '#10B981',
  dark: '#1E1B4B',
  background: '#F0F0FF',
  card: '#FFFFFF',
  textPrimary: '#1E1B4B',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  // Retro accents
  slimeGreen: '#7ED321',
  crtBlue: '#00D4FF',
  vhsRed: '#FF3131',
  // Network brand colors
  nickelodeonOrange: '#FF6600',
  cartoonNetworkCyan: '#00CFCF',
  disneyBlue: '#1A1AFF',
  pbsGreen: '#5CB85C',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
} as const;

export const fontFamilies = {
  heading: 'PressStart2P_400Regular',
  body: 'Fredoka_400Regular',
  bodySemiBold: 'Fredoka_600SemiBold',
  bodyBold: 'Fredoka_700Bold',
  // System fallbacks used when custom fonts haven't loaded yet
  headingFallback: 'monospace',
  bodyFallback: 'System',
} as const;

export const typography = {
  heading: {
    fontFamily: fontFamilies.heading,
    fontSize: 14,
    letterSpacing: 1,
  },
  subheading: {
    fontFamily: fontFamilies.bodySemiBold,
    fontSize: 20,
  },
  body: {
    fontFamily: fontFamilies.body,
    fontSize: 16,
  },
  caption: {
    fontFamily: fontFamilies.body,
    fontSize: 12,
  },
  button: {
    fontFamily: fontFamilies.bodyBold,
    fontSize: 18,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
} as const;
