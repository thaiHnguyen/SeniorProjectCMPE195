/**
 * Modal shown when any sensor enters DANGER. (for test purpose right now)
 * Dismissal is per-session. closing hides the alert until the page reloads.
 */
import React from "react";

function AlertModal({ alerts, onClose }) {
    if (!alerts.length) return null;

    return (
        <div className="alert-modal-backdrop" onClick={onClose}>
            <div
                className="alert-modal"
                role="alertdialog"
                aria-labelledby="alert-modal-title"
                onClick={(e) => e.stopPropagation()}   // don't close on inner clicks
            >
                <h2 id="alert-modal-title" className="alert-modal-title">
                    ⚠ Danger{alerts.length > 1 ? ` (${alerts.length})` : ""}
                </h2>

                <ul className="alert-modal-list">
                    {alerts.map((a) => (
                        <li key={a.id} className="alert-modal-item">
                            <p className="alert-modal-message">{a.message}</p>
                            <time className="alert-modal-time">
                                {new Date(a.created_at).toLocaleString()}
                            </time>
                        </li>
                    ))}
                </ul>

                <button className="alert-modal-close" onClick={onClose} autoFocus>
                    Close
                </button>
            </div>
        </div>
    );
}

export default AlertModal;