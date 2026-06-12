"use client";

import {
  ArrowRight,
  Play,
  Check,
  Clock,
  DollarSign,
  Award,
  Target,
  TrendingUp,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const LandingHero = () => {
  return (
    <section className="relative overflow-hidden pt-24 pb-20  lg:pb-32">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 via-purple-600/5 to-indigo-600/5"></div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-in">
            <Badge className="mb-6 bg-gradient-to-r from-blue-100 to-purple-100 text-blue-700 hover:from-blue-200 hover:to-purple-200 animate-scale-in border-0">
              🚀 Trusted by 10,000+ Companies Worldwide
            </Badge>
            <h1 className="text-4xl lg:text-7xl font-bold text-slate-900 mb-6 leading-tight">
              The Future of
              <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent animate-pulse">
                {" "}
                Workforce{" "}
              </span>
              Management
            </h1>
            <p className="text-xl lg:text-2xl text-slate-600 mb-8 leading-relaxed">
              Power your entire HR operations with AI-driven insights, crypto
              payroll, global compliance, and seamless employee experiences.
              From startup to enterprise - we scale with you.
            </p>

            {/* Enhanced CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 mb-12">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 text-lg px-8 py-6"
              >
                Start Free 30-Day Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-2 hover:bg-slate-50 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 text-lg px-8 py-6"
              >
                <Play className="mr-2 w-5 h-5" />
                Watch 3-Min Demo
              </Button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Setup in under 10 minutes
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                Cancel anytime, no questions
              </div>
            </div>
          </div>

          {/* Enhanced Dashboard Preview */}
          <div className="relative animate-scale-in">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20 rounded-3xl blur-3xl animate-pulse"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl p-6 border transform hover:scale-105 transition-all duration-500">
              <div className="space-y-6">
                {/* Live Metrics Header */}
                <div className="flex items-center justify-between p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center animate-pulse">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-lg">
                        Live Dashboard
                      </p>
                      <p className="text-sm text-slate-600">
                        Real-time workforce insights
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-slate-800">2,847</p>
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      +23% this month
                    </p>
                  </div>
                </div>

                {/* Enhanced Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl transform hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-6 h-6 text-green-600" />
                      <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    </div>
                    <p className="font-semibold text-slate-800">Attendance</p>
                    <p className="text-2xl font-bold text-green-600">98.7%</p>
                    <p className="text-xs text-green-700">
                      ↗ +2.1% vs last week
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-violet-50 rounded-xl transform hover:scale-105 transition-all duration-300">
                    <div className="flex items-center gap-2 mb-2">
                      <DollarSign className="w-6 h-6 text-purple-600" />
                      <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                    </div>
                    <p className="font-semibold text-slate-800">Payroll</p>
                    <p className="text-2xl font-bold text-purple-600">$2.4M</p>
                    <p className="text-xs text-purple-700">
                      Multi-currency ready
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl transform hover:scale-105 transition-all duration-300">
                    <Award className="w-6 h-6 text-blue-600 mb-2" />
                    <p className="font-semibold text-slate-800">Performance</p>
                    <p className="text-2xl font-bold text-blue-600">4.8/5.0</p>
                    <p className="text-xs text-blue-700">
                      Employee satisfaction
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-red-50 rounded-xl transform hover:scale-105 transition-all duration-300">
                    <Target className="w-6 h-6 text-orange-600 mb-2" />
                    <p className="font-semibold text-slate-800">Goals</p>
                    <p className="text-2xl font-bold text-orange-600">87%</p>
                    <p className="text-xs text-orange-700">
                      On track completion
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
        <ChevronDown className="w-6 h-6 text-slate-400" />
      </div>
    </section>
  );
};
