/**
 * Native Mobile App Style Button Component
 * Gerçek native mobil uygulama görünümü için buton bileşeni
 */
import React from 'react';

const NativeButton = ({ 
  children, 
  variant = 'primary', // 'primary', 'secondary', 'outline', 'danger'
  size = 'md', // 'sm', 'md', 'lg'
  fullWidth = false,
  icon = null,
  iconPosition = 'left', // 'left', 'right'
  className = '',
  disabled = false,
  loading = false,
  ...props 
}) => {
  const baseClasses = `
    font-semibold
    rounded-xl
    transition-all duration-200
    active:scale-[0.97]
    disabled:opacity-50
    disabled:cursor-not-allowed
    disabled:active:scale-100
    flex items-center justify-center
    ${fullWidth ? 'w-full' : ''}
  `;

  const sizeClasses = {
    sm: 'px-4 py-2.5 text-sm min-h-[44px]',
    md: 'px-6 py-3.5 text-base min-h-[48px]',
    lg: 'px-8 py-4 text-lg min-h-[52px]',
  };

  const variantClasses = {
    primary: 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl',
    secondary: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-200 dark:hover:bg-gray-600',
    outline: 'border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:text-indigo-400 dark:hover:bg-indigo-900/20',
    danger: 'bg-gradient-to-r from-red-600 to-pink-600 hover:from-red-700 hover:to-pink-700 text-white shadow-lg hover:shadow-xl',
  };

  const iconSpacing = icon ? (iconPosition === 'left' ? 'mr-2' : 'ml-2') : '';

  return (
    <button
      className={`
        ${baseClasses}
        ${sizeClasses[size]}
        ${variantClasses[variant]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <>
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Yükleniyor...
        </>
      ) : (
        <>
          {icon && iconPosition === 'left' && <span className={iconSpacing}>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span className={iconSpacing}>{icon}</span>}
        </>
      )}
    </button>
  );
};

export default NativeButton;

