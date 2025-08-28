"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Search, User, LogOut, Settings, UserCircle, AlertCircle, Menu, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  roles: string[];
}

interface HeaderProps {
  className?: string;
}

export default function Header({ className = "" }: HeaderProps) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [tokenExpired, setTokenExpired] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Get API base URL from environment
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3001/api";

  // Check authentication status on mount
  useEffect(() => {
    const checkAuth = () => {
      const token = localStorage.getItem("jwt");
      if (token) {
        try {
          // Basic JWT validation (check if not expired)
          const payload = JSON.parse(atob(token.split(".")[1]));
          const currentTime = Date.now() / 1000;
          
          if (payload.exp && payload.exp < currentTime) {
            setTokenExpired(true);
            setIsAuthenticated(false);
          } else {
            setIsAuthenticated(true);
            fetchUserProfile(token);
          }
        } catch {
          // Invalid token
          localStorage.removeItem("jwt");
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    };

    checkAuth();
  }, []);

  const fetchUserProfile = useCallback(async (token: string) => {
    setProfileLoading(true);
    setProfileError(null);
    
    try {
      const response = await fetch(`${apiBaseUrl}/profile`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (response.status === 401) {
        setTokenExpired(true);
        setIsAuthenticated(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to fetch profile");
      }

      const profileData: UserProfile = await response.json();
      setUser(profileData);
      setTokenExpired(false);
    } catch (error) {
      setProfileError("Unable to load profile");
      console.error("Profile fetch error:", error);
    } finally {
      setProfileLoading(false);
    }
  }, [apiBaseUrl]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("jwt");
    sessionStorage.clear();
    setUser(null);
    setIsAuthenticated(false);
    setTokenExpired(false);
    setProfileError(null);
    toast.success("Successfully logged out");
  }, []);

  const handleReLogin = useCallback(() => {
    localStorage.removeItem("jwt");
    setIsAuthenticated(false);
    setTokenExpired(false);
    // Navigate to auth panel - this would be handled by parent routing
    window.location.hash = "#login";
  }, []);

  const handleLogin = useCallback(() => {
    window.location.hash = "#login";
  }, []);

  const handleGetStarted = useCallback(() => {
    window.location.hash = "#register";
  }, []);

  const handleSearch = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      // Emit search event or update hash
      window.dispatchEvent(new CustomEvent("global-search", { detail: { query: searchQuery } }));
      window.location.hash = `#search?q=${encodeURIComponent(searchQuery)}`;
    }
  }, [searchQuery]);

  const userInitials = useMemo(() => {
    if (!user?.name) return "U";
    return user.name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }, [user?.name]);

  const navigationLinks = [
    { label: "Use cases", href: "#use-cases" },
    { label: "Company", href: "#company" },
    { label: "Docs", href: "#docs" },
    { label: "Reports", href: "#reports" },
  ];

  return (
    <header className={`bg-card border-b border-border sticky top-0 z-50 ${className}`}>
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo/Brand */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => (window.location.hash = "#dashboard")}
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <div className="w-8 h-8 bg-brand text-brand-contrast rounded-md flex items-center justify-center font-display font-bold text-sm">
                CMS
              </div>
              <span className="font-display font-semibold text-lg text-foreground">
                College Management
              </span>
            </button>
          </div>

          {/* Center Navigation - Desktop */}
          <nav className="hidden md:flex items-center space-x-8">
            {navigationLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Right Side */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <form onSubmit={handleSearch} className="hidden sm:flex">
              <div className="relative">
                <Input
                  type="search"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => setSearchExpanded(false)}
                  className={`transition-all duration-200 ${
                    searchExpanded ? "w-64" : "w-40"
                  } pl-9 text-sm`}
                />
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              </div>
            </form>

            {/* Authentication Section */}
            {isAuthenticated && user ? (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2 p-2">
                    <div className="relative">
                      <Avatar className="w-8 h-8">
                        {profileLoading ? (
                          <AvatarFallback>
                            <div className="w-full h-full bg-muted animate-pulse rounded-full" />
                          </AvatarFallback>
                        ) : (
                          <>
                            <AvatarImage src={user.avatar} alt={user.name} />
                            <AvatarFallback className="text-xs">{userInitials}</AvatarFallback>
                          </>
                        )}
                      </Avatar>
                      {tokenExpired && (
                        <Badge
                          variant="destructive"
                          className="absolute -top-1 -right-1 w-3 h-3 p-0 flex items-center justify-center"
                        >
                          <AlertCircle className="w-2 h-2" />
                        </Badge>
                      )}
                    </div>
                    {!profileLoading && (
                      <span className="hidden md:inline-block text-sm font-medium truncate max-w-32">
                        {profileError ? "Error" : user.name}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-0" align="end">
                  <div className="p-4 border-b border-border">
                    <div className="flex items-center space-x-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage src={user.avatar} alt={user.name} />
                        <AvatarFallback>{userInitials}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                    </div>
                    {tokenExpired && (
                      <div className="mt-3">
                        <div className="flex items-center space-x-2 text-xs text-destructive">
                          <AlertCircle className="w-3 h-3" />
                          <span>Session expired</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleReLogin}
                          className="mt-2 w-full text-xs"
                        >
                          Re-login
                        </Button>
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm h-9"
                      onClick={() => (window.location.hash = "#profile")}
                    >
                      <UserCircle className="w-4 h-4 mr-2" />
                      Profile
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm h-9"
                      onClick={() => (window.location.hash = "#settings")}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Settings
                    </Button>
                    {user.roles.length > 1 && (
                      <Button
                        variant="ghost"
                        className="w-full justify-start text-sm h-9"
                        onClick={() => (window.location.hash = "#switch-role")}
                      >
                        <User className="w-4 h-4 mr-2" />
                        Switch Role
                      </Button>
                    )}
                    <Separator className="my-2" />
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-sm h-9 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleLogout}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Logout
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
            ) : (
              <div className="hidden md:flex items-center space-x-3">
                <Button variant="secondary" onClick={handleLogin} className="text-sm">
                  Log in
                </Button>
                <Button onClick={handleGetStarted} className="text-sm">
                  Get started
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <Popover open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <Menu className="w-5 h-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-0" align="end">
                  <div className="p-4">
                    {/* Mobile Search */}
                    <form onSubmit={handleSearch} className="mb-4">
                      <div className="relative">
                        <Input
                          type="search"
                          placeholder="Search..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-9 text-sm"
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                      </div>
                    </form>

                    {/* Mobile Navigation */}
                    <nav className="space-y-2 mb-4">
                      {navigationLinks.map((link) => (
                        <a
                          key={link.label}
                          href={link.href}
                          className="block px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          {link.label}
                        </a>
                      ))}
                    </nav>

                    {/* Mobile Auth */}
                    {!isAuthenticated && (
                      <div className="space-y-2 pt-4 border-t border-border">
                        <Button
                          variant="secondary"
                          className="w-full text-sm"
                          onClick={() => {
                            handleLogin();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Log in
                        </Button>
                        <Button
                          className="w-full text-sm"
                          onClick={() => {
                            handleGetStarted();
                            setMobileMenuOpen(false);
                          }}
                        >
                          Get started
                        </Button>
                      </div>
                    )}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}