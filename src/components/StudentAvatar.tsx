import React, { useState } from 'react';
import { AIStudentProfile } from '../types';
import { STUDENT_AVATAR_MAP, STUDENT_AVATAR_SPRITE_MAP } from '../data/studentImages';

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

  const sizeClasses = {
    sm: 'w-10 h-10 rounded-2xl text-xs',
    md: 'w-14 h-14 rounded-2xl text-sm',
    lg: 'w-24 h-24 rounded-3xl text-base',
    xl: 'w-28 h-28 sm:w-32 sm:h-32 rounded-3xl text-lg',
    custom: '',
  };

  const containerSizeClass = size === 'custom' ? '' : sizeClasses[size] || sizeClasses.md;
  const spriteAvatar = STUDENT_AVATAR_SPRITE_MAP[student.id];
  const avatarSrc = STUDENT_AVATAR_MAP[student.id] || student.avatarImage;
  const label = `${student.name} (${student.country})`;

  return (
    <div
      className={`relative overflow-hidden flex items-center justify-center select-none bg-amber-50 shadow-sm ${containerSizeClass} ${className} ${
        isSpeaking ? 'ring-4 ring-amber-400 ring-offset-2 scale-105 transition-all duration-300' : ''
      } ${
        isListening ? 'ring-4 ring-emerald-400 ring-offset-2 animate-pulse' : ''
      }`}
    >
      {spriteAvatar ? (
        <svg
          role="img"
          aria-label={label}
          viewBox={`${spriteAvatar.column * spriteAvatar.tileWidth} ${spriteAvatar.row * spriteAvatar.tileHeight} ${spriteAvatar.tileWidth} ${spriteAvatar.tileHeight}`}
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full transition-transform hover:scale-105"
        >
          <title>{label}</title>
          <image
            href={spriteAvatar.src}
            x="0"
            y="0"
            width={spriteAvatar.columns * spriteAvatar.tileWidth}
            height={spriteAvatar.rows * spriteAvatar.tileHeight}
            preserveAspectRatio="none"
          />
        </svg>
      ) : !imageError && avatarSrc ? (
        <img
          src={avatarSrc}
          alt={label}
          className="w-full h-full object-cover object-center transition-transform hover:scale-105"
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-tr from-sky-600 to-indigo-700 flex flex-col items-center justify-center text-white p-1 text-center">
          <span className="text-xl sm:text-2xl leading-none">{student.flag}</span>
          <span className="text-[10px] font-black truncate max-w-full mt-0.5">
            {student.name.split(' ')[0]}
          </span>
        </div>
      )}
    </div>
  );
};
