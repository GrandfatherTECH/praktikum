import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";

type HealthResponse = {
  status: string;
};

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";
const healthUrl = `${apiBaseUrl}/api/v1/health`;

function App() {
  const [health, setHealth] = useState<string>("checking");

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const response = await fetch(healthUrl);
        if (!response.ok) {
          setHealth(`error (HTTP ${response.status})`);
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
      <p>URL проверки: {healthUrl}</p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
