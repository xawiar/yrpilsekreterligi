import React from 'react';

const regionColors = [
  'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-300',
  'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
  'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-300',
  'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300',
  'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
];

const hashCode = (str) => {
  if (!str) return 0;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash;
};

const getRegionColor = (region) => {
  return regionColors[Math.abs(hashCode(region)) % regionColors.length];
};

const RegionBadge = ({ region }) => {
  return (
    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getRegionColor(region)}`}>
      {region}
    </span>
  );
};

export default RegionBadge;