export function SaleErrorBanner({ message }) {
  if (!message) {
    return null;
  }

  return (
    <div className="pos-error-banner" role="alert">
      {message}
    </div>
  );
}
