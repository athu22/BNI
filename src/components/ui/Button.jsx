import React from 'react';
import { cn } from '../../utils/cn';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

const Button = React.forwardRef(({ 
  className, 
  variant = 'primary', 
  size = 'md', 
  isLoading = false, 
  children, 
  disabled,
  ...props 
}, ref) => {
  const baseStyles = "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bni-red disabled:pointer-events-none disabled:opacity-50";
  
  const variants = {
    primary: "bg-bni-red text-white hover:bg-bni-darkRed shadow-sm",
    secondary: "bg-white text-gray-900 border border-gray-200 hover:bg-gray-100",
    outline: "border-2 border-bni-red text-bni-red hover:bg-bni-red hover:text-white",
    ghost: "hover:bg-gray-100 hover:text-gray-900 text-gray-600",
    danger: "bg-red-500 text-white hover:bg-red-600",
  };

  const sizes = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 py-2 text-sm",
    lg: "h-12 px-8 text-base",
    icon: "h-10 w-10",
  };

  return (
    <motion.button
      whileTap={{ scale: disabled || isLoading ? 1 : 0.98 }}
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled || isLoading}
      ref={ref}
      {...props}
    >
      {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {children}
    </motion.button>
  );
});

Button.displayName = "Button";

export { Button };
