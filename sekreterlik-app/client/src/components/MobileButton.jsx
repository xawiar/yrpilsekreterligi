import React from 'react';

/**
 * Mobil için optimize edilmiş button component
 * - Minimum 44x44px touch target (Apple HIG standard)
 * - Daha büyük fontlar
 * - Active state feedback
 */
const MobileButton = ({ 
  children, 
  className = '', 
  variant = 'primary',
  size = 'md',
  ...props 
}) => {
  const baseClasses = `
    inline-flex items-center justify-center
    font-semibold
    rounded-xl
    transition-all duration-200
    active:scale-95
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const sizeClasses = {
    sm: 'px-4 py-2.5 text-sm min-h-[44px]',
    md: 'px-6 py-3 text-base min-h-[48px]',
    lg: 'px-8 py-4 text-lg min-h-[52px]',
  };

  const variantClasses = {
    primary: `
      bg-indigo-600 text-white
      hover:bg-indigo-700
      focus:ring-indigo-500
      shadow-md hover:shadow-lg
    `,
    secondary: `
      bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100
      hover:bg-gray-300 dark:hover:bg-gray-600
      focus:ring-gray-500
    `,
    danger: `
      bg-red-600 text-white
      hover:bg-red-700
      focus:ring-red-500
      shadow-md hover:shadow-lg
    `,
    outline: `
      border-2 border-indigo-600 text-indigo-600 dark:text-indigo-400
      hover:bg-indigo-50 dark:hover:bg-indigo-900/30
      focus:ring-indigo-500
    `,
  };

  const classes = `
    ${baseClasses}
    ${sizeClasses[size]}
    ${variantClasses[variant]}
    ${className}
  `;

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  );
};

export default MobileButton;

