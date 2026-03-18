
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto border-t border-[rgba(79,209,255,0.06)] bg-[#1A1C22]">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-5">
        <div className="flex items-center justify-center gap-2">
          <div className="h-px w-8 bg-gradient-to-r from-transparent to-[#4FD1FF]/20"></div>
          <p className="text-xs sm:text-sm text-[#9CA3AF] font-medium tracking-wide">
            Made with ☕ By{' '}
            <a 
              href="https://www.facebook.com/hipnotismagic" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-[#4FD1FF] hover:text-[#4FD1FF]/80 transition-colors duration-200 font-semibold"
            >
              ~/DirgaX
            </a>
          </p>
          <div className="h-px w-8 bg-gradient-to-l from-transparent to-[#4FD1FF]/20"></div>
        </div>
      </div>
    </footer>
  );
};
