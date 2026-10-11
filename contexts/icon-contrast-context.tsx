import React, { createContext, useContext } from 'react';

export interface IconContrastContextValue {
  /**
   * When true, dynamic icons inside this tree should not apply accent/rainbow
   * palette colors and must instead inherit the container's currentColor.
   * Used for buttons with solid background colors (e.g. primary, destructive)
   * to guarantee WCAG-compliant contrast in all themes.
   */
  inheritColor?: boolean;
}

export const IconContrastContext = createContext<IconContrastContextValue>({});

export function useIconContrast(): IconContrastContextValue {
  return useContext(IconContrastContext);
}
