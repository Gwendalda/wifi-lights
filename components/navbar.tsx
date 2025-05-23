"use client";

import { useState, FC } from "react";
import NextLink from "next/link";
import { clsx } from "clsx";

import { siteConfig } from "@/config/site";
import { ThemeSwitch } from "@/components/theme-switch";
import { Logo, SettingsIcon, MenuIcon, XIcon } from "@/components/icons";

interface NavLinkProps {
  href: string;
  label: string;
  onClick?: () => void;
}

const NavLink: FC<NavLinkProps> = ({ href, label, onClick }) => (
  <NextLink
    href={href}
    className="block px-3 py-2 rounded-md text-base font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
    onClick={onClick}
  >
    {label}
  </NextLink>
);

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
  menuItems?: Array<{ href: string; label: string }>;
}

const MobileMenu: FC<MobileMenuProps> = ({ isOpen, onClose, menuItems }) => {
  if (!isOpen) return null;

  return (
    <div 
      id="mobile-menu" 
      className={clsx(
        "sm:hidden absolute top-full left-0 w-full bg-background border-b border-border shadow-md",
        isOpen ? "block" : "hidden"
      )}
    >
      <div className="px-4 py-3 space-y-1">
        {menuItems && menuItems.length > 0 ? (
          menuItems.map((item, index) => (
            <NavLink
              key={`${item.href}-${index}`}
              href={item.href}
              label={item.label}
              onClick={onClose}
            />
          ))
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No menu items configured.
          </p>
        )}
      </div>
    </div>
  );
};

interface NavButtonProps {
  onClick?: () => void;
  ariaLabel: string;
  className?: string;
  children: React.ReactNode;
  href?: string;
}

const NavButton: FC<NavButtonProps> = ({ 
  onClick, 
  ariaLabel, 
  className = "", 
  children,
  href
}) => {
  const buttonContent = (
    <button 
      type="button" 
      onClick={onClick}
      aria-label={ariaLabel}
      className={clsx(
        "p-2 rounded-md hover:bg-accent hover:text-accent-foreground text-muted-foreground",
        className
      )}
    >
      {children}
    </button>
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

export const Navbar: FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(prev => !prev);
  };

  const handleMobileMenuClose = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand / Logo */}
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

        {/* Desktop Menu Items */}
        <div className="hidden sm:flex items-center gap-3">
          <NavButton 
            ariaLabel="Settings"
            href="/settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </NavButton>
          <ThemeSwitch />
        </div>

        {/* Mobile Menu Toggle Button */}
        <div className="sm:hidden flex items-center">
          <NavButton 
            ariaLabel="Settings"
            className="mr-2"
            href="/settings"
          >
            <SettingsIcon className="h-5 w-5" />
          </NavButton>
          <ThemeSwitch />
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
        </div>
      </div>

      <MobileMenu 
        isOpen={isMobileMenuOpen}
        onClose={handleMobileMenuClose}
        menuItems={siteConfig.navMenuItems}
      />
    </nav>
  );
};
