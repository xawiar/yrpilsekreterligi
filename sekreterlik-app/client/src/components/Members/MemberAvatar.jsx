import React from 'react';
import { normalizePhotoUrl } from '../../utils/photoUrlHelper';

const MemberAvatar = ({ name, photo }) => {
  const normalizedPhoto = photo ? normalizePhotoUrl(photo) : null;
  
  return (
    <div className="flex-shrink-0 h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
      {normalizedPhoto ? (
        <img
          src={normalizedPhoto}
          alt={name}
          className="h-8 w-8 rounded-full object-cover"
          loading="lazy"
          onError={(e) => {
            e.target.style.display = 'none';
            if (e.target.nextSibling) {
              e.target.nextSibling.style.display = 'flex';
            }
          }}
        />
      ) : null}
      <span className={`text-indigo-800 text-xs font-medium ${normalizedPhoto ? 'hidden' : ''}`}>
        {name ? name.charAt(0) : '?'}
      </span>
    </div>
  );
};

export default MemberAvatar;