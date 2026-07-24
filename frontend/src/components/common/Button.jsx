export function Button({
  children,
  type = "button",
  variant = "primary",
  disabled = false,
  ...props
}) {
  return (
    <button
      type={type}
      className={`btn btn--${variant}`}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
