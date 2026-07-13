import React from 'react';

export const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

export const Avatar = ({ user, sm = false }: { user: { name: string }; sm?: boolean }) => {
  return (
    <span className={`avatar ${sm ? 'sm' : ''}`} title={user.name}>
      {initials(user.name)}
    </span>
  );
};
