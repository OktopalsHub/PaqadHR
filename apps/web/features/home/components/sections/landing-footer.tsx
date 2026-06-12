"use client";

import Link from "next/link";
import { links } from "../../constants";

export const LandingFooter = () => {
  return (
    <footer className="bg-slate-900 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          <div>
            <h3 className="font-bold text-lg mb-4">Product</h3>
            <ul className="space-y-2 text-slate-400">
              {links?.products?.map((link) => (
                <li key={link.placeHolder}>
                  <Link
                    href={link.link}
                    className="hover:text-white transition-colors"
                  >
                    {link.placeHolder}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Solutions</h3>
            <ul className="space-y-2 text-slate-400">
              {links?.solutions?.map((link) => (
                <li key={link?.placeHolder}>
                  <Link
                    href={link?.link}
                    className="hover:text-white transition-colors"
                  >
                    {link?.placeHolder}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Resources</h3>
            <ul className="space-y-2 text-slate-400">
              {links?.resources?.map((link) => (
                <li key={link?.placeHolder}>
                  <Link
                    href={link?.link}
                    className="hover:text-white transition-colors"
                  >
                    {link?.placeHolder}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-bold text-lg mb-4">Company</h3>
            <ul className="space-y-2 text-slate-400">
              {links?.company?.map((link) => (
                <li key={link?.placeHolder}>
                  <Link
                    href={link?.link}
                    className="hover:text-white transition-colors"
                  >
                    {link?.placeHolder}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <span className="text-white font-bold text-lg">H</span>
              </div>
              <span className="text-xl font-bold">ModernHR</span>
            </div>
            <p className="text-slate-400 text-sm">
              © {new Date().getFullYear()} ModernHR. All rights reserved.
              Built with ❤️ for modern teams.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
};
