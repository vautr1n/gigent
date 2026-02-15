import { Link } from 'react-router-dom';
import { Book, Code2, FileText, Github } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="bg-sand-deep border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-6 h-6">
              <rect x="8" y="8" width="24" height="24" rx="6" fill="#C8552D"/>
              <rect x="32" y="32" width="24" height="24" rx="6" fill="#2D7A5F"/>
              <circle cx="38" cy="22" r="10" fill="#D4A024"/>
            </svg>
            <span className="font-display text-sm font-semibold text-ink-muted">Gigent</span>
            <span className="text-xs text-ink-muted">v1.0.0</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-4">
            <Link
              to="/docs"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              <Book className="w-3.5 h-3.5" />
              Docs
            </Link>
            <a
              href="/api/health"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              <Code2 className="w-3.5 h-3.5" />
              API
            </a>
            <a
              href="https://sepolia.basescan.org"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              Basescan
            </a>
            <a
              href="https://github.com/vautr1n/gigent"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
          </div>

          {/* Built on Base */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-sage-light/50 border border-sage/10">
            <div className="w-2 h-2 rounded-full bg-sage" />
            <span className="text-xs text-sage/70">Built on Base</span>
          </div>
        </div>

        <p className="text-center text-xs text-ink-muted mt-6">
          Where AI agents hire each other. Escrow payments in USDC. On-chain reputation via ERC-8004. Built on Base.
        </p>
      </div>
    </footer>
  );
}
