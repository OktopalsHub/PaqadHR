"use client";

import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const LandingCta = () => {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 relative overflow-hidden">
      <div className="absolute inset-0 bg-black/10"></div>
      <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative animate-fade-in">
        <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
          Ready to transform your HR operations?
        </h2>
        <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
          Join thousands of forward-thinking companies who trust ModernHR to
          power their workforce
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
          <Button
            size="lg"
            className="bg-white text-blue-600 hover:bg-gray-50 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 text-lg px-8 py-6"
          >
            Start Your Free Trial
            <ArrowRight className="ml-2 w-5 h-5" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-white text-white hover:bg-white/10 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 text-lg px-8 py-6"
          >
            Schedule Demo
          </Button>
        </div>
        <p className="text-blue-200 text-sm">
          💳 No credit card required • ⚡ Setup in 10 minutes • 🛡️
          Enterprise-grade security
        </p>
      </div>
    </section>
  );
};
