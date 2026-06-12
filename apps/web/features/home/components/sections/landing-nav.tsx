"use client";

import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type LandingNavProps = {
  isScrolled: boolean;
};

export const LandingNav = ({ isScrolled }: LandingNavProps) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav
      className={`fixed top-0 w-full z-50 transition-all duration-300 ${
        isScrolled
          ? "bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-lg"
          : "bg-white/80 backdrop-blur-md border-b border-slate-200"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center gap-3 animate-fade-in">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center transform hover:scale-110 transition-transform duration-200">
              <span className="text-white font-bold text-lg">H</span>
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              ModernHR
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <a
              href="#features"
              className="text-slate-600 hover:text-blue-600 transition-colors duration-200 hover:scale-105 transform"
            >
              Features
            </a>
            <a
              href="#solutions"
              className="text-slate-600 hover:text-blue-600 transition-colors duration-200 hover:scale-105 transform"
            >
              Solutions
            </a>
            <a
              href="#pricing"
              className="text-slate-600 hover:text-blue-600 transition-colors duration-200 hover:scale-105 transform"
            >
              Pricing
            </a>
            <a
              href="#testimonials"
              className="text-slate-600 hover:text-blue-600 transition-colors duration-200 hover:scale-105 transform"
            >
              Reviews
            </a>
            <Button
              variant="outline"
              className="hover:scale-105 transform transition-all duration-200"
              asChild
            >
              <Link href="/signin">Sign In</Link>
            </Button>
            <Button
              asChild
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:scale-105 transform transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              <Link href="/signup">Start Free Trial</Link>
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200 shadow-lg animate-fade-in">
          <div className="px-4 py-4 space-y-4">
            <a
              href="#features"
              className="block text-slate-600 hover:text-blue-600 transition-colors"
            >
              Features
            </a>
            <a
              href="#solutions"
              className="block text-slate-600 hover:text-blue-600 transition-colors"
            >
              Solutions
            </a>
            <a
              href="#pricing"
              className="block text-slate-600 hover:text-blue-600 transition-colors"
            >
              Pricing
            </a>
            <a
              href="#testimonials"
              className="block text-slate-600 hover:text-blue-600 transition-colors"
            >
              Reviews
            </a>
            <div className="flex flex-col gap-2 pt-4">
              <Button asChild variant="outline" className="w-full">
                <Link href="/signin">Sign In</Link>
              </Button>
              <Button
                asChild
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600"
              >
                <Link href="/signup">Start Free Trial</Link>
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
