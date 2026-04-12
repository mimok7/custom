import { InboxIcon } from 'lucide-react';

interface EmptyStateProps {
  message?: string;
  icon?: React.ReactNode;
}

export default function EmptyState({
  message = '데이터가 없습니다',
  icon,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
      {icon ?? <InboxIcon className="h-12 w-12 mb-3" />}
      <p className="text-sm">{message}</p>
    </div>
  );
}
