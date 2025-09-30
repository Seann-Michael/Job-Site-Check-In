import React, { createContext, useContext, useEffect, useState } from "react";

import React, { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  actualTheme: "dark" | "light";
};

const initialState: ThemeProviderState = {
  theme: "light",
  setTheme: () => null,
  actualTheme: "light",
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "light",
  storageKey = "vite-ui-theme",
  ...props
}: ThemeProviderProps) {
  // Safe initialization that works with SSR
  const [theme, setTheme] = useState<Theme>(defaultTheme);
  const [actualTheme, setActualTheme] = useState<"dark" | "light">("light");
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize theme from localStorage after component mounts
  useEffect(() => {
    try {
      const storedTheme = localStorage.getItem(storageKey) as Theme;
      if (
        storedTheme &&
        (storedTheme === "dark" ||
          storedTheme === "light" ||
          storedTheme === "system")
      ) {
        setTheme(storedTheme);
      }
    } catch (error) {
      console.warn("Failed to read theme from localStorage:", error);
    }
    setIsInitialized(true);
  }, [storageKey]);

  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove("light", "dark");

    let resolvedTheme: "dark" | "light";

    if (theme === "system") {
      resolvedTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      resolvedTheme = theme;
    }

    root.classList.add(resolvedTheme);
    setActualTheme(resolvedTheme);

    // Update meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute(
        "content",
        resolvedTheme === "dark" ? "#0f172a" : "#ffffff",
      );
    }
  }, [theme]);

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const resolvedTheme = mediaQuery.matches ? "dark" : "light";
      const root = window.document.documentElement;
      root.classList.remove("light", "dark");
      root.classList.add(resolvedTheme);
      setActualTheme(resolvedTheme);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme]);

  const value = {
    theme,
    setTheme: (theme: Theme) => {
      try {
        localStorage.setItem(storageKey, theme);
      } catch (error) {
        console.warn("Failed to save theme to localStorage:", error);
      }
      setTheme(theme);
    },
    actualTheme,
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
};

// Theme toggle component
export function ThemeToggle() {
  const { theme, setTheme, actualTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(actualTheme === "light" ? "dark" : "light");
  };

  const getIcon = () => {
    // Show icon for what it will SWITCH TO (opposite of current theme)
    if (actualTheme === "light") {
      // In light mode, show moon to indicate clicking will switch to dark
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      );
    } else {
      // In dark mode, show sun to indicate clicking will switch to light
      return (
        <svg
          className="h-4 w-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      );
    }
  };

  const getLabel = () => {
    return actualTheme === "light"
      ? "Switch to dark mode"
      : "Switch to light mode";
  };

  return (
    <button
      onClick={toggleTheme}
      className="h-10 w-10 rounded-md hover:bg-muted/80 text-foreground transition-colors flex items-center justify-center"
      aria-label={getLabel()}
      title={getLabel()}
    >
      {getIcon()}
    </button>
  );
}

// Theme-aware optimization for images
export function useThemeOptimizedImage(lightSrc: string, darkSrc?: string) {
  const { actualTheme } = useTheme();
  return darkSrc && actualTheme === "dark" ? darkSrc : lightSrc;
}

// Theme transition helper
export function useThemeTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);

  const startTransition = () => {
    setIsTransitioning(true);
    document.documentElement.classList.add("theme-transitioning");

    setTimeout(() => {
      setIsTransitioning(false);
      document.documentElement.classList.remove("theme-transitioning");
    }, 200);
  };

  return { isTransitioning, startTransition };
}
