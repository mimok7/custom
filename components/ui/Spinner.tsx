export default function Spinner({ className, size }: { className?: string; size?: 'sm' | 'md' }) {
  if (size === 'sm') {
    return <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />;
  }
  return (
    <div className={`flex justify-center items-center ${className ?? 'h-72'}`}>
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
    </div>
  );
}
