import React from "react";
import LoadingSpinner from "../LoadingSpinner";

const variantStyles = {
  default: "bg-primary-500 hover:bg-primary-600 text-white",
  destructive: "bg-red-500 hover:bg-red-600 text-white",
  outline: "border border-surface-300 dark:border-surface-600 hover:bg-surface-100 dark:hover:bg-surface-800",
  secondary: "bg-surface-200 dark:bg-surface-700 hover:bg-surface-300 dark:hover:bg-surface-600",
  ghost: "hover:bg-surface-100 dark:hover:bg-surface-800",
  link: "text-primary-500 hover:underline",
};

const sizeStyles = {
  default: "h-10 px-4 py-2",
  sm: "h-8 px-3 text-sm",
  lg: "h-12 px-6 text-lg",
  icon: "h-10 w-10 p-2",
};

const Button = React.forwardRef(
  ({ 
    className = "", 
    variant = "default", 
    size = "default", 
    asChild = false,
    disabled = false,
    isLoading = false,
    loadingText,
    children, 
    ...props 
  }, ref) => {
    const Comp = "button";
    
    // Determine the spinner color based on the variant
    const spinnerColor = 
      variant === "default" || variant === "destructive" 
        ? "white" 
        : "primary";
    
    return (
      <Comp
        className={`
          inline-flex items-center justify-center rounded-md text-sm font-medium
          transition-colors focus-visible:outline-none focus-visible:ring-2
          focus-visible:ring-primary-500 focus-visible:ring-offset-2
          disabled:opacity-50 disabled:pointer-events-none
          ${variantStyles[variant]} ${sizeStyles[size]} ${className}
        `}
        ref={ref}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading ? (
          <>
            <LoadingSpinner size="sm" color={spinnerColor} className="mr-2" />
            {loadingText || children}
          </>
        ) : (
          children
        )}
      </Comp>
    );
  }
);

Button.displayName = "Button";

export { Button }; 