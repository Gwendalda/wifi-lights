/**
 * ThemeSwitch component that allows users to toggle between light and dark themes.
 * Uses next-themes for theme management and provides a button with sun/moon icons.
 */
"use client";

import { FC } from "react";
// import { VisuallyHidden } from "@react-aria/visually-hidden"; // Removed
// import { SwitchProps, useSwitch } from "@heroui/switch"; // Removed
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";
import { Button } from "@/components/ui/button";
import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

interface ThemeSwitchProps {
  className?: string;
  // classNames?: SwitchProps["classNames"]; // Removed as SwitchProps is removed
}

/**
 * Renders a theme switch button that toggles between light and dark themes.
 * @param {ThemeSwitchProps} props - Component props
 * @param {string} [props.className] - Optional CSS class name for styling
 * @returns {JSX.Element | null} The theme switch button or null if server-side rendering
 */
export const ThemeSwitch: FC<ThemeSwitchProps> = ({ className }) => {
  const { theme, setTheme } = useTheme();
  const isSSR = useIsSSR();

  const handleThemeToggle = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  if (isSSR) {
    return null;
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleThemeToggle}
      className={className}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <SunFilledIcon className="h-5 w-5" />
      ) : (
        <MoonFilledIcon className="h-5 w-5" />
      )}
    </Button>
  );
};
