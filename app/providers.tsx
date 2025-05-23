"use client";

import type { ThemeProviderProps } from "next-themes";
import * as React from "react";
// import { HeroUIProvider } from "@heroui/system"; // Removed
// import { useRouter } from "next/navigation"; // No longer needed if HeroUIProvider is removed and router isn't used otherwise here
import { ThemeProvider as NextThemesProvider } from "next-themes";

export interface ProvidersProps {
  children: React.ReactNode;
  themeProps?: ThemeProviderProps;
}

// Removed module declaration for "@react-types/shared"
// declare module "@react-types/shared" {
//   interface RouterConfig {
//     routerOptions: NonNullable<
//       Parameters<ReturnType<typeof useRouter>["push"]>[1]
//     >;
//   }
// }

export function Providers({ children, themeProps }: ProvidersProps) {
  // const router = useRouter(); // No longer needed

  return (
    // <HeroUIProvider navigate={router.push}> // Removed
      <NextThemesProvider {...themeProps}>{children}</NextThemesProvider>
    // </HeroUIProvider> // Removed
  );
}
