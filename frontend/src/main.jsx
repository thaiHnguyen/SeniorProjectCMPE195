import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
//Switch between these to test for mocking data and real data when connecting to backend
import App from './App.jsx'
import { TempUnitProvider } from "./contexts/TempUnitContext.jsx";
import AppDemo from "./AppDemo.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <TempUnitProvider>
            <App />
        </TempUnitProvider>
    </StrictMode>
);
