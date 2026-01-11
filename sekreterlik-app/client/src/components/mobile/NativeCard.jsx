/**
 * Native Mobile App Style Card Component
 * Gerçek native mobil uygulama görünümü için kart bileşeni
 */
import React from 'react';

const NativeCard = ({ 
  children, 
  className = '', 
  onClick,
  swipeActions = null,
  ...props 
}) => {
  return (
    <div
      className={`
        bg-white dark:bg-gray-800
        rounded-2xl
        shadow-sm
        border border-gray-100 dark:border-gray-700
        p-4
        mb-3
        transition-all duration-200
        ${onClick ? 'cursor-pointer active:scale-[0.98] active:shadow-md' : ''}
        ${className}
      `}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
};

export default NativeCard;

