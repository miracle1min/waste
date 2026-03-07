import { cn } from "@/lib/utils";
import { Box, Coffee, Cookie, Factory } from "lucide-react";

type Category = "NOODLE" | "DIMSUM" | "BAR" | "PRODUKSI";

interface CategorySelectorProps {
  selectedCategory: Category | null;
  onSelect: (category: Category) => void;
  className?: string;
}

const categoryConfig = {
  NOODLE: {
    icon: Cookie,
    label: "Noodle",
    description: "Mie dan produk mie",
    color: "noodle"
  },
  DIMSUM: {
    icon: Box,
    label: "Dim Sum",
    description: "Produk dim sum",
    color: "dimsum"
  },
  BAR: {
    icon: Coffee,
    label: "Bar",
    description: "Minuman dan bar items",
    color: "bar"
  },
  PRODUKSI: {
    icon: Factory,
    label: "Produksi",
    description: "Bahan produksi",
    color: "produksi"
  }
};

export function CategorySelector({ selectedCategory, onSelect, className }: CategorySelectorProps) {
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4", className)}>
      {Object.entries(categoryConfig).map(([key, config]) => {
        const category = key as Category;
        const Icon = config.icon;
        const isSelected = selectedCategory === category;

        return (
          <button
            key={category}
            onClick={() => onSelect(category)}
            className={cn(
              "category-card w-full text-left transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50",
              config.color,
              isSelected && "selected"
            )}
          >
            <div className="flex items-center space-x-3 sm:space-x-4 p-4 sm:p-5">
              <div className={cn(
                "p-2.5 sm:p-3 rounded-lg flex-shrink-0",
                isSelected 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-background/60 text-foreground"
              )}>
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-base sm:text-lg truncate">{config.label}</h3>
                <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2">{config.description}</p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 sm:w-6 sm:h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 sm:w-4 sm:h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}