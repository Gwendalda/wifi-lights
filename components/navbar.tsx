/**
 * Navbar component that provides the main navigation interface for the application.
 * Includes responsive design with mobile menu support and theme switching.
 */
"use client";

import { useState, FC } from "react";
import NextLink from "next/link";
import * as NavigationMenu from "@radix-ui/react-navigation-menu";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Button } from "@/components/ui/button";
import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo, SettingsIcon, MenuIcon, XIcon } from "@/components/icons";

interface NavLinkProps {
  href: string;
  label: string;
  onClick?: () => void;
}

/**
 * Renders a navigation link with consistent styling.
 * @param {NavLinkProps} props - Component props
 * @returns {JSX.Element} Navigation link
 */
const NavLink: FC<NavLinkProps> = ({ href, label, onClick }) => (
  <NavigationMenu.Link asChild>
    <NextLink
      href={href}
      className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
      onClick={onClick}
    >
      {label}
    </NextLink>
  </NavigationMenu.Link>
);

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems?: Array<{ href: string; label: string }>;
}

/**
 * Renders the mobile navigation menu.
 * @param {MobileMenuProps} props - Component props
 * @returns {JSX.Element | null} Mobile menu or null if closed
 */
const MobileMenu: FC<MobileMenuProps> = ({ isOpen, onClose, menuItems }) => {
  if (!isOpen) return null;

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={onClose}>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="sm:hidden absolute top-full left-0 w-full bg-background border-b border-border shadow-md"
          sideOffset={5}
        >
          <div className="px-4 py-3 space-y-1">
            {menuItems && menuItems.length > 0 ? (
              menuItems.map((item, index) => (
                <DropdownMenu.Item key={`${item.href}-${index}`} asChild>
                  <NavLink
                    href={item.href}
                    label={item.label}
                    onClick={onClose}
                  />
                </DropdownMenu.Item>
              ))
            ) : (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                No menu items configured.
              </p>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

interface NavButtonProps {
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
  href?: string;
}

/**
 * Renders a navigation button that can optionally be a link.
 * @param {NavButtonProps} props - Component props
 * @returns {JSX.Element} Navigation button
 */
const NavButton: FC<NavButtonProps> = ({ 
  onClick, 
  ariaLabel, 
  className = "", 
  children,
  href
}) => {
  const buttonContent = (
    <Button 
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={ariaLabel}
      className={className}
    >
      {children}
    </Button>
  );

  if (href) {
    return (
      <NextLink href={href} aria-label={ariaLabel}>
        {buttonContent}
      </NextLink>
    );
  }

  return buttonContent;
};

/**
 * Renders the main navigation bar with responsive design.
 * @returns {JSX.Element} Navigation bar
 */
export const Navbar: FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <NavigationMenu.Root className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
        <NavigationMenu.Item>
          <NextLink 
            href="/" 
            className="flex items-center gap-2 mr-auto" 
            aria-label={siteConfig.name}
          >
            <Logo />
            <span className="font-bold text-foreground sm:inline-block hidden">
              {siteConfig.name}
            </span>
          </NextLink>
        </NavigationMenu.Item>

        {/* Desktop Menu Items */}
        <NavigationMenu.List className="hidden sm:flex items-center gap-3">
          <NavigationMenu.Item>
            <NavButton 
              ariaLabel="Settings"
              href="/settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </NavButton>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <ThemeSwitch />
          </NavigationMenu.Item>
        </NavigationMenu.List>

        {/* Mobile Menu Toggle Button */}
        <NavigationMenu.List className="sm:hidden flex items-center">
          <NavigationMenu.Item>
            <NavButton 
              ariaLabel="Settings"
              className="mr-2"
              href="/settings"
            >
              <SettingsIcon className="h-5 w-5" />
            </NavButton>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <ThemeSwitch />
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavButton
              onClick={handleMobileMenuToggle}
              ariaLabel={isMobileMenuOpen ? "Close menu" : "Open menu"}
              className="ml-2"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">
                {isMobileMenuOpen ? "Close menu" : "Open menu"}
              </span>
              {isMobileMenuOpen ? (
                <XIcon className="h-6 w-6" />
              ) : (
                <MenuIcon className="h-6 w-6" />
              )}
            </NavButton>
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </div>

      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={handleMobileMenuClose}
        menuItems={siteConfig.navMenuItems}
      />
    </NavigationMenu.Root>
  );
};
