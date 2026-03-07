
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-cyan-900/30 bg-[hsl(220,45%,8%)]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-center gap-2">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-cyan-500/40"></div>
          <p className="text-xs sm:text-sm text-slate-500 font-medium tracking-wide">
            Made with ☕ By{' '}
            <a 
              href="https://www.facebook.com/hipnotismagic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 transition-colors duration-200 font-semibold"
            >
              ~/Pajar
            </a>
          </p>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-cyan-500/40"></div>
        </div>
      </div>
    </footer>
  );
};
