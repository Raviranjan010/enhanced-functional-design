"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { EyeOff, View, LogIn, KeyRound, UserRoundCheck, TriangleAlert, LockKeyhole } from "lucide-react";

interface AuthPanelProps {
  onAuthenticated?: (token: string, user: any) => void;
  className?: string;
}

interface LoginData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface RegisterData {
  email: string;
  password: string;
  confirmPassword: string;
}

interface AuthResponse {
  token?: string;
  user?: any;
  message?: string;
  error?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "/api";

export default function AuthPanel({ onAuthenticated, className = "" }: AuthPanelProps) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  
  // Form data
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
    rememberMe: false,
  });
  
  const [registerData, setRegisterData] = useState<RegisterData>({
    email: "",
    password: "",
    confirmPassword: "",
  });
  
  const [forgotEmail, setForgotEmail] = useState("");
  
  // Validation states
  const [loginErrors, setLoginErrors] = useState<Partial<LoginData>>({});
  const [registerErrors, setRegisterErrors] = useState<Partial<RegisterData & { strength: string }>>({});
  const [forgotError, setForgotError] = useState("");

  // Token management
  const storeToken = useCallback((token: string, rememberMe: boolean = false) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("auth_token", token);
      const expiryTime = Date.now() + (rememberMe ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000); // 30 days or 24 hours
      localStorage.setItem("auth_token_expiry", expiryTime.toString());
    }
  }, []);

  const getStoredToken = useCallback(() => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("auth_token");
      const expiry = localStorage.getItem("auth_token_expiry");
      
      if (token && expiry) {
        const expiryTime = parseInt(expiry);
        if (Date.now() < expiryTime) {
          return token;
        } else {
          localStorage.removeItem("auth_token");
          localStorage.removeItem("auth_token_expiry");
        }
      }
    }
    return null;
  }, []);

  const clearToken = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("auth_token_expiry");
    }
  }, []);

  // Check for existing session on mount
  useEffect(() => {
    const token = getStoredToken();
    if (token && onAuthenticated) {
      // Verify token with server
      fetch(`${API_BASE_URL}/auth/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "API-Version": "1.0",
        },
      })
        .then(response => response.json())
        .then(data => {
          if (data.valid) {
            onAuthenticated(token, data.user);
          } else {
            clearToken();
          }
        })
        .catch(() => {
          clearToken();
        })
        .finally(() => {
          setIsCheckingSession(false);
        });
    } else {
      setIsCheckingSession(false);
    }
  }, [getStoredToken, clearToken, onAuthenticated]);

  // Token expiry watcher
  useEffect(() => {
    const checkTokenExpiry = () => {
      if (typeof window !== "undefined") {
        const expiry = localStorage.getItem("auth_token_expiry");
        if (expiry) {
          const expiryTime = parseInt(expiry);
          const timeUntilExpiry = expiryTime - Date.now();
          
          // Show warning 5 minutes before expiry
          if (timeUntilExpiry > 0 && timeUntilExpiry <= 5 * 60 * 1000) {
            toast.warning("Your session will expire soon. Please save your work.");
          }
          
          // Clear token if expired
          if (timeUntilExpiry <= 0) {
            clearToken();
            toast.error("Your session has expired. Please log in again.");
          }
        }
      }
    };

    const interval = setInterval(checkTokenExpiry, 60000); // Check every minute
    return () => clearInterval(interval);
  }, [clearToken]);

  // Validation functions
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string): { isValid: boolean; strength: string } => {
    if (password.length < 8) {
      return { isValid: false, strength: "Password must be at least 8 characters" };
    }
    
    const hasUppercase = /[A-Z]/.test(password);
    const hasLowercase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
    
    const score = [hasUppercase, hasLowercase, hasNumbers, hasSpecial].filter(Boolean).length;
    
    if (score < 3) {
      return { isValid: false, strength: "Password should include uppercase, lowercase, numbers, and special characters" };
    }
    
    return { isValid: true, strength: score === 4 ? "Strong" : "Good" };
  };

  // API call helper
  const apiCall = async (endpoint: string, data: any): Promise<AuthResponse> => {
    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-Version": "1.0",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.message || "An error occurred");
      }
      
      return result;
    } catch (error) {
      console.error("API Error:", error);
      
      // Map common errors to friendly messages
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      
      if (errorMessage.includes("fetch")) {
        throw new Error("Unable to connect to server. Please check your internet connection.");
      }
      
      if (errorMessage.includes("401") || errorMessage.includes("unauthorized")) {
        throw new Error("Invalid email or password. Please try again.");
      }
      
      if (errorMessage.includes("409") || errorMessage.includes("already exists")) {
        throw new Error("User is already registered. Please login to the application.");
      }
      
      throw new Error(errorMessage);
    }
  };

  // Form handlers
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const errors: Partial<LoginData> = {};
    if (!validateEmail(loginData.email)) {
      errors.email = "Please enter a valid email address";
    }
    if (!loginData.password) {
      errors.password = "Password is required";
    }
    
    setLoginErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      // Focus first invalid field
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      element?.focus();
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await apiCall("/auth/login", {
        email: loginData.email,
        password: loginData.password,
      });
      
      if (result.token) {
        storeToken(result.token, loginData.rememberMe);
        toast.success("Welcome back! Redirecting to dashboard...");
        
        if (onAuthenticated) {
          onAuthenticated(result.token, result.user);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Login failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const errors: Partial<RegisterData & { strength: string }> = {};
    
    if (!validateEmail(registerData.email)) {
      errors.email = "Please enter a valid email address";
    }
    
    const passwordValidation = validatePassword(registerData.password);
    if (!passwordValidation.isValid) {
      errors.password = passwordValidation.strength;
    }
    
    if (registerData.password !== registerData.confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }
    
    setRegisterErrors(errors);
    
    if (Object.keys(errors).length > 0) {
      // Focus first invalid field
      const firstErrorField = Object.keys(errors)[0];
      const element = document.querySelector(`[name="${firstErrorField}"]`) as HTMLElement;
      element?.focus();
      return;
    }

    setIsLoading(true);
    
    try {
      const result = await apiCall("/auth/register", {
        email: registerData.email,
        password: registerData.password,
      });
      
      if (result.token) {
        storeToken(result.token, false);
        toast.success("Account created successfully! Welcome to the platform.");
        
        if (onAuthenticated) {
          onAuthenticated(result.token, result.user);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Registration failed";
      
      if (message.includes("already registered")) {
        toast.error(message, {
          action: {
            label: "Go to login",
            onClick: () => setMode("login"),
          },
        });
      } else {
        toast.error(message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateEmail(forgotEmail)) {
      setForgotError("Please enter a valid email address");
      return;
    }
    
    setForgotError("");
    setIsLoading(true);
    
    try {
      await apiCall("/auth/forgot-password", { email: forgotEmail });
      toast.success("Password reset instructions have been sent to your email.");
      setMode("login");
      setForgotEmail("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to send reset email";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingSession) {
    return (
      <div className={`min-h-screen bg-background flex items-center justify-center ${className}`}>
        <Card className="w-full max-w-md">
          <CardContent className="p-8">
            <div className="flex flex-col items-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="text-muted-foreground">Checking your session...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-background flex items-center justify-center p-4 ${className}`}>
      <div className="w-full max-w-6xl grid lg:grid-cols-2 gap-8 items-center">
        {/* Left side - Benefits and branding */}
        <div className="space-y-8 lg:pr-8">
          <div className="space-y-4">
            <h1 className="text-4xl lg:text-5xl font-display font-bold">
              College Management Made Simple
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Streamline student records, course management, and administrative tasks with our comprehensive platform.
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="flex items-start space-x-4">
              <div className="bg-accent rounded-lg p-2 mt-1">
                <UserRoundCheck className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Student Management</h3>
                <p className="text-muted-foreground">Efficiently manage student enrollment, records, and academic progress.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-accent rounded-lg p-2 mt-1">
                <LockKeyhole className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Secure & Reliable</h3>
                <p className="text-muted-foreground">Enterprise-grade security with encrypted data and regular backups.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-4">
              <div className="bg-accent rounded-lg p-2 mt-1">
                <TriangleAlert className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <h3 className="font-semibold">Real-time Analytics</h3>
                <p className="text-muted-foreground">Get insights into student performance and institutional metrics.</p>
              </div>
            </div>
          </div>
          
          <div className="bg-card border rounded-lg p-6">
            <p className="text-sm text-muted-foreground mb-2">Trusted by educators</p>
            <p className="font-semibold">"This platform has transformed how we manage our institution. Highly recommended!"</p>
            <p className="text-sm text-muted-foreground mt-2">- Dr. Sarah Johnson, Academic Director</p>
          </div>
        </div>

        {/* Right side - Auth forms */}
        <div className="w-full max-w-md mx-auto lg:mx-0">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-display">
                {mode === "login" && "Welcome Back"}
                {mode === "register" && "Create Account"}
                {mode === "forgot" && "Reset Password"}
              </CardTitle>
              <CardDescription>
                {mode === "login" && "Sign in to access your dashboard"}
                {mode === "register" && "Join our platform to get started"}
                {mode === "forgot" && "Enter your email to receive reset instructions"}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="space-y-6">
              {mode === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      value={loginData.email}
                      onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                      placeholder="Enter your email"
                      disabled={isLoading}
                      aria-invalid={!!loginErrors.email}
                      className={loginErrors.email ? "border-destructive" : ""}
                    />
                    {loginErrors.email && (
                      <p className="text-sm text-destructive" role="alert">
                        {loginErrors.email}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        placeholder="Enter your password"
                        disabled={isLoading}
                        aria-invalid={!!loginErrors.password}
                        className={loginErrors.password ? "border-destructive pr-10" : "pr-10"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-label="Hide password" />
                        ) : (
                          <View className="h-4 w-4" aria-label="Show password" />
                        )}
                      </Button>
                    </div>
                    {loginErrors.password && (
                      <p className="text-sm text-destructive" role="alert">
                        {loginErrors.password}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="remember"
                        checked={loginData.rememberMe}
                        onCheckedChange={(checked) => 
                          setLoginData({ ...loginData, rememberMe: !!checked })
                        }
                        disabled={isLoading}
                      />
                      <Label htmlFor="remember" className="text-sm">
                        Remember me
                      </Label>
                    </div>
                    
                    <Button
                      type="button"
                      variant="link"
                      className="px-0 text-sm"
                      onClick={() => setMode("forgot")}
                      disabled={isLoading}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Signing in...
                      </>
                    ) : (
                      <>
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>
              )}

              {mode === "register" && (
                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <Input
                      id="reg-email"
                      name="email"
                      type="email"
                      value={registerData.email}
                      onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
                      placeholder="Enter your email"
                      disabled={isLoading}
                      aria-invalid={!!registerErrors.email}
                      className={registerErrors.email ? "border-destructive" : ""}
                    />
                    {registerErrors.email && (
                      <p className="text-sm text-destructive" role="alert">
                        {registerErrors.email}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="reg-password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        value={registerData.password}
                        onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
                        placeholder="Create a password"
                        disabled={isLoading}
                        aria-invalid={!!registerErrors.password}
                        className={registerErrors.password ? "border-destructive pr-10" : "pr-10"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" aria-label="Hide password" />
                        ) : (
                          <View className="h-4 w-4" aria-label="Show password" />
                        )}
                      </Button>
                    </div>
                    {registerErrors.password && (
                      <p className="text-sm text-destructive" role="alert">
                        {registerErrors.password}
                      </p>
                    )}
                    {registerData.password && !registerErrors.password && (
                      <p className="text-sm text-success">
                        Password strength: {validatePassword(registerData.password).strength}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="confirm-password">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={registerData.confirmPassword}
                        onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
                        placeholder="Confirm your password"
                        disabled={isLoading}
                        aria-invalid={!!registerErrors.confirmPassword}
                        className={registerErrors.confirmPassword ? "border-destructive pr-10" : "pr-10"}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isLoading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" aria-label="Hide password" />
                        ) : (
                          <View className="h-4 w-4" aria-label="Show password" />
                        )}
                      </Button>
                    </div>
                    {registerErrors.confirmPassword && (
                      <p className="text-sm text-destructive" role="alert">
                        {registerErrors.confirmPassword}
                      </p>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Creating account...
                      </>
                    ) : (
                      <>
                        <UserRoundCheck className="h-4 w-4 mr-2" />
                        Create Account
                      </>
                    )}
                  </Button>
                </form>
              )}

              {mode === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <Input
                      id="forgot-email"
                      name="forgotEmail"
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="Enter your email"
                      disabled={isLoading}
                      aria-invalid={!!forgotError}
                      className={forgotError ? "border-destructive" : ""}
                    />
                    {forgotError && (
                      <p className="text-sm text-destructive" role="alert">
                        {forgotError}
                      </p>
                    )}
                  </div>
                  
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <KeyRound className="h-4 w-4 mr-2" />
                        Send Reset Instructions
                      </>
                    )}
                  </Button>
                </form>
              )}

              <div className="text-center space-y-2">
                {mode === "login" && (
                  <p className="text-sm text-muted-foreground">
                    Don't have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto font-semibold"
                      onClick={() => setMode("register")}
                      disabled={isLoading}
                    >
                      Create one here
                    </Button>
                  </p>
                )}
                
                {(mode === "register" || mode === "forgot") && (
                  <p className="text-sm text-muted-foreground">
                    Already have an account?{" "}
                    <Button
                      type="button"
                      variant="link"
                      className="p-0 h-auto font-semibold"
                      onClick={() => setMode("login")}
                      disabled={isLoading}
                    >
                      Sign in here
                    </Button>
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}