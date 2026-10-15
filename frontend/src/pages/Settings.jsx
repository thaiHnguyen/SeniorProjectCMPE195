/**
 * Settings Page
 *
 * Data flow:
 *  api.js ->useSettings.js -> Settings.jsx ->ProfileCard.jsx
 *                                          ->ProfileModal.jsx
 *                                          ->ConfirmDialog.jsx
 *                                          ->Toast.jsx
 */
import React, { useState } from "react";
import "../styles/settings.css";

import ProfileCard from "../components/ProfileCard.jsx";
import ProfileModal from "../components/ProfileModal.jsx";
import ConfirmDialog from "../components/ConfirmDialog.jsx";
import Toast from "../components/Toast.jsx";
import useSettings from "../hooks/useSettings.js";

function Settings() {
    // Data + CRUD from hook
    const {
        profiles, activeProfile, loading, error,
        createProfile, updateProfile, deleteProfile,
        duplicateProfile, activateProfile,
    } = useSettings();

    // UI state
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [toast, setToast] = useState(null);

    // Show a toast for 2.5s
    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2500);
    };

    // Handlers

    // Open modal in create mode with defaults
    const handleCreate = () => {
        setEditingProfile({
            name: "", description: "",
            ph_min: 5.5, ph_max: 6.5,
            temp_min: 18, temp_max: 28,
            humidity_min: 50, humidity_max: 70,
            pressure_min: 990, pressure_max: 1030,   // NEW
            aqi_min: 1, aqi_max: 2,                  // NEW
        });
        setModalOpen(true);
    };

    // Open modal in edit mode with existing data
    const handleEdit = (profile) => {
        setEditingProfile({ ...profile });
        setModalOpen(true);
    };

    // Duplicate a profile
    const handleDuplicate = async (profile) => {
        try {
            await duplicateProfile(profile);
            showToast(`Duplicated "${profile.name}"`);
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    // Start delete flow -> show confirm dialog
    const handleDelete = (profile) => {
        if (profile.is_active) {
            showToast("Cannot delete the active profile", "error");
            return;
        }
        setConfirmDelete(profile);
    };

    // User confirmed deletion
    const handleConfirmDelete = async () => {
        try {
            await deleteProfile(confirmDelete.id);
            showToast(`Deleted "${confirmDelete.name}"`);
        } catch (err) {
            showToast(err.message, "error");
        } finally {
            setConfirmDelete(null);
        }
    };

    // Activate/apply a profile
    const handleActivate = async (profile) => {
        try {
            await activateProfile(profile.id);
            showToast(`Applied "${profile.name}"`);
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    // Save from modal — create or update depending on whether id exists
    const handleSave = async (formData) => {
        try {
            if (formData.id) {
                await updateProfile(formData.id, {
                    name: formData.name,
                    description: formData.description,
                    ph_min: formData.ph_min, ph_max: formData.ph_max,
                    temp_min: formData.temp_min, temp_max: formData.temp_max,
                    humidity_min: formData.humidity_min, humidity_max: formData.humidity_max,

                    pressure_min: formData.pressure_min, pressure_max: formData.pressure_max,  // NEW
                    aqi_min: formData.aqi_min, aqi_max: formData.aqi_max,                      // NEW
                    
                });
                showToast(`Updated "${formData.name}"`);
            } else {
                await createProfile(formData);
                showToast(`Created "${formData.name}"`);
            }
            setModalOpen(false);
            setEditingProfile(null);
        } catch (err) {
            showToast(err.message, "error");
        }
    };

    // Loading / Error
    if (loading) {
        return <div className="settings-page"><p style={{ color: "rgba(var(--fg-rgb), 0.5)" }}>Loading profiles...</p></div>;
    }
    if (error) {
        return <div className="settings-page"><p style={{ color: "red" }}>Error: {error}</p></div>;
    }

    // Render
    return (
        <div className="settings-page">
            {/* Header: title + create button */}
            <div className="settings-header">
                <h2 className="settings-title">Threshold Profiles</h2>
                <button className="btn-create" onClick={handleCreate}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                    New Profile
                </button>
            </div>

            {/* Profile list */}
            <div className="profile-list">
                {profiles.map((profile) => (
                    <ProfileCard
                        key={profile.id}
                        profile={profile}
                        onEdit={handleEdit}
                        onDuplicate={handleDuplicate}
                        onUse={handleActivate}
                        onDelete={handleDelete}
                    />
                ))}
                {profiles.length === 0 && (
                    <p className="empty-state">No profiles yet. Click "New Profile" to create one.</p>
                )}
            </div>

            {/* Create/Edit Modal */}
            {modalOpen && editingProfile && (
                <ProfileModal
                    profile={editingProfile}
                    onSave={handleSave}
                    onClose={() => { setModalOpen(false); setEditingProfile(null); }}
                />
            )}

            {/* Delete Confirmation */}
            {confirmDelete && (
                <ConfirmDialog
                    title="Delete Profile"
                    message={<>Are you sure you want to delete <strong>"{confirmDelete.name}"
                                </strong>? This action cannot be undone.
                            </>}
                    confirmLabel="Delete"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} />}
        </div>
    );
}

export default Settings;