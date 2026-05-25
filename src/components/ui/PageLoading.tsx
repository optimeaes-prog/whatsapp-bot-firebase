type Props = {
  message?: string;
  className?: string;
};

export function PageLoading({ message, className }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center gap-4 py-16 ${className ?? ""}`}>
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary-500" />
      {message ? <p className="font-medium text-gray-500">{message}</p> : null}
    </div>
  );
}
