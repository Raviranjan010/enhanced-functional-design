"use client";

import React, { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import AuthPanel from "@/components/AuthPanel";
import AdminConsole from "@/components/AdminConsole";
import { Toaster } from "sonner";

interface User {
  id: string;
  name: string;
  email: string;
  roles: string[];
}

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing authentication on mount
  useEffect(() => {
    const checkAuthStatus = () => {
      const storedToken = localStorage.getItem("auth_token") || localStorage.getItem("jwt");
      const expiry = localStorage.getItem("auth_token_expiry");
      
      if (storedToken && expiry) {
        const expiryTime = parseInt(expiry);
        if (Date.now() < expiryTime) {
          setToken(storedToken);
          setIsAuthenticated(true);
          // User data would be set by Header component when it fetches profile
        } else {
          // Token expired, clear storage
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_token_expiry");
          localStorage.removeItem("jwt");
        }
      }
      setIsLoading(false);
    };

    checkAuthStatus();
  }, []);

  const handleAuthenticated = useCallback((authToken: string, userData: User) => {
    setToken(authToken);
    setUser(userData);
    setIsAuthenticated(true);
    
    // Store token with JWT key for compatibility with other components
    localStorage.setItem("jwt", authToken);
  }, []);

  const handleSignOut = useCallback(() => {
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    
    // Clear all auth-related storage
    localStorage.removeItem("jwt");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("auth_token_expiry");
    sessionStorage.clear();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <Header className="border-b border-border" />
      
      {/* Main Content Area */}
      <main className="flex-1">
        {isAuthenticated ? (
          <AdminConsole 
            userRole={user?.roles?.includes("admin") ? "admin" : "faculty"}
            onSignOut={handleSignOut}
          />
        ) : (
          <AuthPanel 
            onAuthenticated={handleAuthenticated}
            className="pt-0"
          />
        )}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <span>&copy; 2024 College Management System</span>
              <span>•</span>
              <a href="#privacy" className="hover:text-foreground transition-colors">
                Privacy Policy
              </a>
              <span>•</span>
              <a href="#terms" className="hover:text-foreground transition-colors">
                Terms of Service
              </a>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <a href="#support" className="hover:text-foreground transition-colors">
                Support
              </a>
              <span>•</span>
              <a href="#docs" className="hover:text-foreground transition-colors">
                Documentation
              </a>
              <span>•</span>
              <a href="#status" className="hover:text-foreground transition-colors">
                System Status
              </a>
            </div>
          </div>
        </div>
      </footer>
      
      {/* Toast Notifications */}
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'hsl(var(--card))',
            color: 'hsl(var(--card-foreground))',
            border: '1px solid hsl(var(--border))',
          },
        }}
      />
    </div>
  );
}