// MediSpace Premium Color System
export const Colors = {
  primary: '#0f172a',         // Modern Slate Navy
  primaryLight: '#1e293b',
  secondary: '#10b981',       // Emerald Green (Medical Health)
  secondaryLight: '#ecfdf5',
  accent: '#6366f1',          // Indigo Accent
  accentLight: '#eef2ff',
  background: '#f8fafc',
  surface: '#ffffff',
  surfaceContainer: '#f1f5f9',
  text: '#0f172a',
  textSecondary: '#475569',
  textMuted: '#94a3b8',
  border: '#e2e8f0',
  error: '#ef4444',
  success: '#10b981',
  warning: '#f59e0b',
  white: '#ffffff',
};

// Global Gradients for high-impact elements
export const Gradients = {
  primary: ['#0f172a', '#334155'] as const,
  secondary: ['#10b981', '#059669'] as const,
  accent: ['#6366f1', '#4f46e5'] as const,
  glass: ['rgba(255, 255, 255, 0.8)', 'rgba(255, 255, 255, 0.4)'] as const,
};

// Elevation & Shadow System
export const Shadows = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: '#64748b',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 6,
  },
  large: {
    shadowColor: '#0f172a',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 10,
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FontSizes = {
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};
