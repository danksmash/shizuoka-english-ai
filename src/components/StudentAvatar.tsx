import React, { useState } from 'react';
import { AIStudentProfile } from '../types';
import { STUDENT_AVATAR_MAP } from '../data/studentImages';

interface StudentAvatarProps {
  student: AIStudentProfile;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'custom';
  isSpeaking?: boolean;
  isListening?: boolean;
}

export const StudentAvatar: React.FC<StudentAvatarProps> = ({
  student,
  className = '',
  size = 'md',
  isSpeaking = false,
  isListening = false,
}) => {
  const [imageError, setImageError] = useState(false);

  // Size mapping
  const sizeClasses = {
    sm: 'w-10 h-10 rounded-2xl text-xs',
    md: 'w-14 h-14 rounded-2xl text-sm',
    lg: 'w-24 h-24 rounded-3xl text-base',
    xl: 'w-28 h-28 sm:w-32 sm:h-32 rounded-3xl text-lg',
    custom: '',
  };

  const containerSizeClass = size === 'custom' ? '' : sizeClasses[size] || sizeClasses.md;

  const resolveImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
      return url;
    }
    const clean = url.startsWith('/') ? url.slice(1) : url;
    const base = import.meta.env.BASE_URL || './';
    return `${base}${clean}`;
  };

  const avatarSrc = STUDENT_AVATAR_MAP[student.id] || resolveImageUrl(student.avatarImage);

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center select-none bg-slate-100 ${containerSizeClass} ${className} ${
        isSpeaking ? 'scale-105 transition-transform duration-300' : ''
      }`}
    >
      {!imageError && avatarSrc ? (
        <img
          src={avatarSrc}
          alt={`${student.name} (${student.country})`}
          className="w-full h-full object-cover object-center transition-transform"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-700 flex flex-col items-center justify-center text-white p-1 text-center">
          <span className="text-xl sm:text-2xl leading-none">{student.flag}</span>
          <span className="text-[10px] font-black truncate max-w-full mt-0.5">
            {student.name.split(' ')[0]}
          </span>
        </div>
      )}
    </div>
  );
};
