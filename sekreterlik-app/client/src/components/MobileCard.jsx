import React from 'react';

/**
 * Mobil için optimize edilmiş card component
 * - Daha büyük touch target'lar
 * - Daha büyük fontlar
 * - Mobil-friendly spacing
 */
const MobileCard = ({ 
  children, 
  className = '', 
  onClick,
  href,
  ...props 
}) => {
  const baseClasses = `
    bg-white dark:bg-gray-800 
    rounded-xl 
    shadow-sm border border-gray-200 dark:border-gray-700 
    p-4 sm:p-6
    transition-all duration-200
    ${onClick || href ? 'cursor-pointer active:scale-[0.98] active:shadow-md' : ''}
    ${className}
  `;

  if (href) {
    return (
      <a href={href} className={baseClasses} {...props}>
        {children}
      </a>
    );
  }

  if (onClick) {
    return (
      <div onClick={onClick} className={baseClasses} {...props}>
        {children}
      </div>
    );
  }

  return (
    <div className={baseClasses} {...props}>
      {children}
    </div>
  );
};

export default MobileCard;

