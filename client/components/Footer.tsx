export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-center px-4">
        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
          <span>© {currentYear} Local SEO Ranker. All rights reserved.</span>
        </div>
      </div>
    </footer>
  );
}
