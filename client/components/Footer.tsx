import { Link } from "react-router-dom";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-center px-4">
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>© {currentYear} Local SEO Ranker. All rights reserved.</span>
          <span className="text-muted-foreground/50">•</span>
          <Link
            to="/terms"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Terms
          </Link>
          <span className="text-muted-foreground/50">•</span>
          <Link
            to="/privacy"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Privacy
          </Link>
          <span className="text-muted-foreground/50">•</span>
          <Link
            to="/super-admin"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Super Admin
          </Link>
          <span className="text-muted-foreground/50">•</span>
          <Link
            to="/super-admin"
            className="hover:text-foreground transition-colors underline-offset-4 hover:underline"
          >
            Agency Admin
          </Link>
        </div>
      </div>
    </footer>
  );
}
