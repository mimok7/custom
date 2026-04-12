'use client';

import React from 'react';

interface SectionBoxProps {
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export default function SectionBox({ title, icon, actions, children }: SectionBoxProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm mb-6">
      {(title || icon || actions) && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            {icon}
            {title}
          </h3>
          {actions}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}
