import React from "react";
import ReactDOM from "react-dom/client";

import { AppProviders } from "./app/AppProviders";
import { AppRouter } from "./routes/AppRouter";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppProviders>
      <AppRouter />
    </AppProviders>
  </React.StrictMode>,
);
