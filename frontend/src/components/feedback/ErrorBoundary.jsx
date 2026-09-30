import { Component } from "react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: "",
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || "Ocurrió un error inesperado en la aplicación.",
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary capturó un error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="card"
          style={{
            maxWidth: "600px",
            margin: "2rem auto",
            padding: "1.5rem",
          }}
        >
          <div className="card__header" style={{ marginBottom: "1rem" }}>
            <h2 className="card__title" style={{ color: "#991b1b" }}>
              Ha ocurrido un error inesperado
            </h2>
          </div>
          <div className="card__body" style={{ padding: 0 }}>
            <p className="card__subtitle" style={{ marginBottom: "1rem" }}>
              Se produjo un fallo al renderizar esta sección. Puedes recargar la
              página para intentar restablecer la aplicación.
            </p>
            <div
              className="alert alert--error"
              style={{ marginBottom: "1.25rem" }}
            >
              {this.state.errorMessage || "Error de renderizado no especificado."}
            </div>
            <button
              type="button"
              className="btn btn--primary"
              onClick={this.handleReload}
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
