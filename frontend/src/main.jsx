import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'   // color variables for dark + light - load first
import './styles/index.css'
//Switch between these to test for mocking data and real data when connecting to backend
import App from './App.jsx'
import { TempUnitProvider } from "./contexts/TempUnitContext.jsx";
import { ThemeProvider } from "./contexts/ThemeContext.jsx";
import AppDemo from "./AppDemo.jsx";

createRoot(document.getElementById("root")).render(
    <StrictMode>
        <ThemeProvider>
            <TempUnitProvider>
                <App />
            </TempUnitProvider>
        </ThemeProvider>
    </StrictMode>
);