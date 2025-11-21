/**
 * Native Mobile App Style List Component
 * Gerçek native mobil uygulama görünümü için liste bileşeni
 */
import React from 'react';
import NativeCard from './NativeCard';

const NativeList = ({ 
  items = [],
  renderItem,
  emptyMessage = 'Henüz öğe yok',
  className = '',
  ...props 
}) => {
  if (items.length === 0) {
    return (
      <div className={`text-center py-12 ${className}`}>
        <p className="text-gray-500 dark:text-gray-400 text-base">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`} {...props}>
      {items.map((item, index) => (
        <NativeCard key={item.id || index}>
          {renderItem(item, index)}
        </NativeCard>
      ))}
    </div>
  );
};

export default NativeList;

