
import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-card/50 backdrop-blur-sm border-t border-border mt-auto">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            Made with ☕ By{' '}
            <span className="font-bold text-green-600 dark:text-green-400">
              (~/Marko)
            </span>
          </p>
        </div>
      </div>
    </footer>
  );
};
