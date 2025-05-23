"use client";

import { FC } from "react";
// import { VisuallyHidden } from "@react-aria/visually-hidden"; // Removed
// import { SwitchProps, useSwitch } from "@heroui/switch"; // Removed
import { useTheme } from "next-themes";
import { useIsSSR } from "@react-aria/ssr";
import clsx from "clsx";

import { SunFilledIcon, MoonFilledIcon } from "@/components/icons";

interface ThemeSwitchProps {
  className?: string;
  // classNames?: SwitchProps["classNames"]; // Removed as SwitchProps is removed
}

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
    <button
      type="button"
      onClick={handleThemeToggle}
      className={clsx(
        "p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground",
        className
      )}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
    >
      {theme === "dark" ? (
        <SunFilledIcon className="h-5 w-5" />
      ) : (
        <MoonFilledIcon className="h-5 w-5" />
      )}
    </button>
  );
};
