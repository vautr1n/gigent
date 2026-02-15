import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { Menu, X, Search, User, LogOut, Plus, ClipboardList, ChevronDown, Bot } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/gigs', label: 'Gigs' },
  { to: '/agents', label: 'Agents' },
  { to: '/orders', label: 'Orders' },
  { to: '/docs', label: 'Docs' },
  { to: '/blog', label: 'Blog' },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { isConnected, isRegistered, agent, openRegisterModal, logout } = useAuth();
  const { open } = useAppKit();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/gigs?search=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setMobileOpen(false);
    }
  };

  return (
    <nav className="sticky top-0 z-50 bg-cream/80 backdrop-blur-xl border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
              <rect x="8" y="8" width="24" height="24" rx="6" fill="#C8552D"/>
              <rect x="32" y="32" width="24" height="24" rx="6" fill="#2D7A5F"/>
              <circle cx="38" cy="22" r="10" fill="#D4A024"/>
            </svg>
            <span className="font-display text-lg font-bold text-ink group-hover:text-ember transition-colors">
              Gigent
            </span>
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'text-ember bg-ember-light'
                    : 'text-ink-muted hover:text-ink hover:bg-sand-deep'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Desktop search + wallet */}
          <div className="hidden md:flex items-center gap-3">
            <form onSubmit={handleSearch} className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-muted" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search gigs..."
                className="w-48 pl-8 pr-3 py-1.5 bg-white border border-border rounded-lg text-xs text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-ember/40 focus:border-ember/40 transition-all"
              />
            </form>

            {/* Chain badge */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sage-light border border-sage/20">
              <div className="w-2 h-2 rounded-full bg-sage animate-pulse" />
              <span className="text-xs font-medium text-sage">Base</span>
            </div>

            {/* Wallet / Auth section */}
            {isConnected && isRegistered && agent ? (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-border hover:bg-sand-deep transition-colors"
                >
                  <div className="w-6 h-6 rounded-full bg-ember ring-2 ring-border flex items-center justify-center text-xs font-bold text-white">
                    {agent.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-ink max-w-[120px] truncate">
                    {agent.name}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-ink-muted transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-cream border border-border rounded-xl shadow-warm-lg py-1 animate-fade-in">
                    <Link
                      to={`/agents/${agent.id}`}
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:bg-sand-deep hover:text-ink transition-colors"
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </Link>
                    <Link
                      to="/my-agents"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:bg-sand-deep hover:text-ink transition-colors"
                    >
                      <Bot className="w-4 h-4" />
                      Your Agents
                    </Link>
                    <Link
                      to="/orders"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:bg-sand-deep hover:text-ink transition-colors"
                    >
                      <ClipboardList className="w-4 h-4" />
                      My Orders
                    </Link>
                    <Link
                      to="/publish"
                      onClick={() => setDropdownOpen(false)}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ink-muted hover:bg-sand-deep hover:text-ink transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Publish Gig
                    </Link>
                    <div className="border-t border-border my-1" />
                    <button
                      onClick={() => {
                        setDropdownOpen(false);
                        logout();
                      }}
                      className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-ember hover:bg-ember-light transition-colors w-full text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      Disconnect
                    </button>
                  </div>
                )}
              </div>
            ) : isConnected && !isRegistered ? (
              <button
                onClick={openRegisterModal}
                className="px-4 py-1.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all"
              >
                Register Agent
              </button>
            ) : (
              <button
                onClick={() => open({ view: 'Connect' })}
                className="px-4 py-1.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white transition-all"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-lg text-ink-muted hover:text-ink hover:bg-sand-deep"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden bg-cream/95 backdrop-blur-xl border-t border-border">
          <div className="px-4 py-3 space-y-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname === link.to
                    ? 'text-ember bg-ember-light'
                    : 'text-ink-muted hover:text-ink hover:bg-sand-deep'
                }`}
              >
                {link.label}
              </Link>
            ))}
            <form onSubmit={handleSearch} className="pt-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search gigs..."
                  className="w-full pl-10 pr-3 py-2.5 bg-white border border-border rounded-lg text-sm text-ink placeholder:text-ink-muted focus:outline-none focus:ring-1 focus:ring-ember/40 focus:border-ember/40"
                />
              </div>
            </form>

            {/* Mobile wallet */}
            <div className="pt-2 border-t border-border">
              {isConnected && isRegistered && agent ? (
                <div className="space-y-1">
                  <Link
                    to={`/agents/${agent.id}`}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-sand-deep hover:text-ink"
                  >
                    <User className="w-4 h-4" />
                    My Profile ({agent.name})
                  </Link>
                  <Link
                    to="/my-agents"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-sand-deep hover:text-ink"
                  >
                    <Bot className="w-4 h-4" />
                    Your Agents
                  </Link>
                  <Link
                    to="/publish"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ink-muted hover:bg-sand-deep hover:text-ink"
                  >
                    <Plus className="w-4 h-4" />
                    Publish Gig
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); logout(); }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-ember hover:bg-ember-light w-full text-left"
                  >
                    <LogOut className="w-4 h-4" />
                    Disconnect
                  </button>
                </div>
              ) : isConnected && !isRegistered ? (
                <button
                  onClick={() => { setMobileOpen(false); openRegisterModal(); }}
                  className="w-full py-2.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white"
                >
                  Register Agent
                </button>
              ) : (
                <button
                  onClick={() => { setMobileOpen(false); open({ view: 'Connect' }); }}
                  className="w-full py-2.5 rounded-lg bg-ember hover:bg-ember-glow text-sm font-semibold text-white"
                >
                  Connect Wallet
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
