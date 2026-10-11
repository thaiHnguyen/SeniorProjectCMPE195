/**
 * Notification popup that will fade after 2.5s - 2500
 * 
 * prop:
 *  - message
 *  - type: 'success' | 'error'
 * 
 * Usage:
 *  - const(toast, setToast) = useState;
 *  - setToast(...)
 */

import React from "react";
import "../styles/toast.css";

function Toast({message, type = "sucess"} ) {
    return (
        <div className={`toast ${type}`}>{message}</div>
    );
}

export default Toast;