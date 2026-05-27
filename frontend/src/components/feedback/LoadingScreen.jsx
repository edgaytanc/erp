export function LoadingScreen({ text = "Cargando..." }) {
  return (
    <div className="loading-screen">
      <div className="loading-screen__spinner" />
      <p>{text}</p>
    </div>
  );
}
