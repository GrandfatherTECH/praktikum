import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

type HealthResponse = {
  status: string;
};

function App() {
  const [health, setHealth] = useState<string>("checking");

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch("/api/v1/health");
        if (!response.ok) {
          setHealth("error");
          return;
        }
        const data = (await response.json()) as HealthResponse;
        setHealth(data.status);
      } catch {
        setHealth("unreachable");
      }
    };

    void fetchHealth();
  }, []);

  return (
    <main style={{ fontFamily: "Arial, sans-serif", margin: "2rem" }}>
      <h1>Система документооборота запущена</h1>
      <p>Проверка backend: {health}</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
