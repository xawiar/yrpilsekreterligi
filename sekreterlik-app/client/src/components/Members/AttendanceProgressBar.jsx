import React from 'react';
import { getAttendanceColor } from './membersUtils';

const AttendanceProgressBar = ({ percentage }) => {
  return (
    <div className="flex items-center">
      <div className="w-16 bg-gray-200 rounded-full h-1.5 mr-2">
        <div
          className={`h-1.5 rounded-full ${getAttendanceColor(percentage)}`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
      <span className="text-xs text-gray-500">{percentage}%</span>
    </div>
  );
};

export default AttendanceProgressBar;