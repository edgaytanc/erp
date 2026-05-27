export function ErrorAlert({ message }) {
  if (!message) {
    return null;
  }

  return <div className="alert alert--error">{message}</div>;
}
