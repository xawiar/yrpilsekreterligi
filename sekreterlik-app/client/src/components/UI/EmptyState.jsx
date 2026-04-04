import React from 'react';
import Card from './Card';

const EmptyState = ({ icon, title = 'Kayıt bulunamadı', subtitle = 'Filtreleri değiştirerek tekrar deneyin.', description, action, card = false }) => {
  const content = (
    <div className="flex flex-col items-center justify-center text-center py-12">
      {icon && <div className="text-gray-400 dark:text-gray-500 mb-4">{icon}</div>}
      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">{title}</h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description || subtitle}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );

  if (card) {
    return <Card className="border border-gray-200 dark:border-gray-700">{content}</Card>;
  }
  return content;
};

export default EmptyState;


