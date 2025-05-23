"use client";

import { FC, useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SettingsIcon } from "@/components/icons";

interface ColorOption {
  name: string;
  value: string;
  description: string;
}

const colorOptions: ColorOption[] = [
  {
    name: "Primary",
    value: "primary",
    description: "Main brand color used for primary actions and highlights"
  },
  {
    name: "Secondary",
    value: "secondary",
    description: "Secondary color used for less prominent elements"
  },
  {
    name: "Accent",
    value: "accent",
    description: "Accent color used for special highlights and interactions"
  },
  {
    name: "Background",
    value: "background",
    description: "Main background color of the application"
  },
  {
    name: "Foreground",
    value: "foreground",
    description: "Main text and icon color"
  }
];

const SettingsPage: FC = () => {
  const { theme, setTheme } = useTheme();
  const [colors, setColors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Load saved colors from localStorage
    const savedColors = localStorage.getItem("customColors");
    if (savedColors) {
      setColors(JSON.parse(savedColors));
    }
  }, []);

  const handleColorChange = (colorName: string, value: string) => {
    const newColors = { ...colors, [colorName]: value };
    setColors(newColors);
    localStorage.setItem("customColors", JSON.stringify(newColors));
    
    // Update CSS variables
    document.documentElement.style.setProperty(`--${colorName}`, value);
  };

  const resetColors = () => {
    setColors({});
    localStorage.removeItem("customColors");
    // Reset CSS variables to default values
    colorOptions.forEach(option => {
      document.documentElement.style.removeProperty(`--${option.value}`);
    });
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-2 mb-8">
        <SettingsIcon className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Choose your preferred theme mode</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Button
                variant={theme === "light" ? "default" : "outline"}
                onClick={() => setTheme("light")}
              >
                Light
              </Button>
              <Button
                variant={theme === "dark" ? "default" : "outline"}
                onClick={() => setTheme("dark")}
              >
                Dark
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color Palette</CardTitle>
            <CardDescription>Customize the colors of your application</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {colorOptions.map((option) => (
                <div key={option.value} className="space-y-2">
                  <Label htmlFor={option.value}>{option.name}</Label>
                  <div className="flex gap-4">
                    <Input
                      id={option.value}
                      type="color"
                      value={colors[option.value] || ""}
                      onChange={(e) => handleColorChange(option.value, e.target.value)}
                      className="w-20 h-10"
                    />
                    <Input
                      type="text"
                      value={colors[option.value] || ""}
                      onChange={(e) => handleColorChange(option.value, e.target.value)}
                      placeholder={`Enter ${option.name.toLowerCase()} color`}
                      className="flex-1"
                    />
                  </div>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              ))}
              <Button variant="outline" onClick={resetColors}>
                Reset Colors
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SettingsPage; 