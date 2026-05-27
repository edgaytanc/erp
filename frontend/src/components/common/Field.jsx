export function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  placeholder = "",
  autoComplete,
  error,
  ...props
}) {
  return (
    <label className="field" htmlFor={id}>
      <span className="field__label">{label}</span>
      <input
        id={id}
        className={`field__input ${error ? "field__input--error" : ""}`}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...props}
      />
      {error ? <span className="field__error">{error}</span> : null}
    </label>
  );
}
