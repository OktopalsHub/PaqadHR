interface ToastMessageProps {
  title: string;
  description?: string;
}
export const ToastMessage = ({ title, description }: ToastMessageProps) => {
  return (
    <div>
      <h6>{title}</h6>
      <p className="text-muted-foreground text-xs">{description}</p>
    </div>
  );
};
