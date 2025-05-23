/**
 * Application providers component that wraps the application with necessary context providers.
 * Currently provides theme support through next-themes.
 */
"use client";

import type { ThemeProviderProps } from "next-themes";
import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

/**
 * Wraps the application with theme provider and other necessary context providers.
 * @param {ProvidersProps} props - Component props
 * @param {React.ReactNode} props.children - Child components to be wrapped
 * @param {ThemeProviderProps} [props.themeProps] - Optional theme provider configuration
 * @returns {JSX.Element} Provider-wrapped application
 */
export function Providers({ children, themeProps }: ProvidersProps) {
  return (
    <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
  );
}
