/**
 * AppDemo.jsx - Demo version of App with hardcoded mock data
 * 
 * Used for testing the UI without the backend running.
 * Switch between this and App.jsx in main.jsx
 */
import { useState } from "react";
import "./styles/App.css";

import Navbar from "./components/Navbar.jsx";
import TabBar from "./components/TabBar.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProfileCard from "./components/ProfileCard.jsx";
import ProfileModal from "./components/ProfileModal.jsx";
import ConfirmDialog from "./components/ConfirmDialog.jsx";
import Toast from "./components/Toast.jsx";

import "./styles/settings.css";

/**
 * MOCK DATA
 * These simulate what the backend would return.
 * Switch to App.jsx, this data comes from the API instead.
 */
const MOCK_PROFILES = [
    {
        id: 1,
        name: "Lettuce",
        description: "Optimal ranges for leafy greens",
        ph_min: 5.5, ph_max: 6.5,
        temp_min: 15, temp_max: 25,
        humidity_min: 50, humidity_max: 70,
        pressure_min: 990, pressure_max: 1030,   
        aqi_min: 1, aqi_max: 2,                  
        is_active: true,
    },
    {
        id: 2,
        name: "Tomato",
        description: "For fruiting vegetables",
        ph_min: 5.8, ph_max: 6.8,
        temp_min: 20, temp_max: 30,
        humidity_min: 60, humidity_max: 80,
        pressure_min: 995, pressure_max: 1025,   
        aqi_min: 1, aqi_max: 2,                  
        is_active: false,
    },
    {
        id: 3,
        name: "Basil",
        description: "Herb-optimized profile",
        ph_min: 5.5, ph_max: 6.5,
        temp_min: 18, temp_max: 28,
        humidity_min: 40, humidity_max: 60,
        pressure_min: 990, pressure_max: 1030,   
        aqi_min: 1, aqi_max: 1,                 
        is_active: false,
    },
];

/** Mock sensor readings */
const MOCK_CURRENT = {
    temperature: 30,
    humidity: 49.9,
    ph: 6.9,
    pressure: 1013.25,   
    aqi_score: 3,       
};

/** Mock chart history */
const MOCK_CHARTS = {
    temperature: { data: [21, 24, 25, 26, 28, 27, 29] },
    humidity:    { data: [33, 55, 58, 60, 57, 62] },
    ph:          { data: [4.0, 6.1, 6.3, 6.5, 6.4] },
    pressure:    { data: [1011.2, 1012.0, 1013.4, 1012.8, 1014.1, 1013.25] },   
    aqi_score:   { data: [1, 1, 2, 2, 3, 2, 3] },                              
};

function AppDemo() {
    // Tab state
    const [activeTab, setActiveTab] = useState("dashboard");

    // Settings state (local mock — no API calls)
    const [profiles, setProfiles] = useState(MOCK_PROFILES);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [toast, setToast] = useState(null);

    // Find the active profile — used by both Dashboard and Settings
    const activeProfile = profiles.find((p) => p.is_active) || null;

    // Build thresholds object from active profile for Dashboard
    const thresholds = {
        temperature: {
            min: activeProfile?.temp_min ?? 24,
            max: activeProfile?.temp_max ?? 33,
        },
        humidity: {
            min: activeProfile?.humidity_min ?? 50,
            max: activeProfile?.humidity_max ?? 80,
        },
        ph: {
            min: activeProfile?.ph_min ?? 5.5,
            max: activeProfile?.ph_max ?? 7.0,
        },
        // NEW
        pressure: {
            min: activeProfile?.pressure_min ?? 990,
            max: activeProfile?.pressure_max ?? 1030,
        },
        aqi_score: {
            min: activeProfile?.aqi_min ?? 1,
            max: activeProfile?.aqi_max ?? 2,
        },
    };

    // Toast helper
    const showToast = (message, type = "success") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2500);
    };

    // Settings CRUD handlers
    const handleCreate = () => {
        setEditingProfile({
            name: "",
            description: "",
            ph_min: 5.5, ph_max: 6.5,
            temp_min: 18, temp_max: 28,
            humidity_min: 50, humidity_max: 70,
            pressure_min: 990, pressure_max: 1030,   
            aqi_min: 1, aqi_max: 2,                  
        });
        setModalOpen(true);
    };

    const handleEdit = (profile) => {
        setEditingProfile({ ...profile });
        setModalOpen(true);
    };

    const handleDuplicate = (profile) => {
        const dup = {
            ...profile,
            id: Date.now(),
            name: `${profile.name} (Copy)`,
            is_active: false,
        };
        setProfiles((prev) => [...prev, dup]);
        showToast(`Duplicated "${profile.name}"`);
    };

    const handleDelete = (profile) => {
        if (profile.is_active) {
            showToast("Cannot delete the active profile", "error");
            return;
        }
        setConfirmDelete(profile);
    };

    const handleConfirmDelete = () => {
        setProfiles((prev) => prev.filter((p) => p.id !== confirmDelete.id));
        showToast(`Deleted "${confirmDelete.name}"`);
        setConfirmDelete(null);
    };

    const handleUse = (profile) => {
        setProfiles((prev) =>
            prev.map((p) => ({ ...p, is_active: p.id === profile.id }))
        );
        showToast(`Now using "${profile.name}"`);
    };

    const handleSave = (formData) => {
        if (formData.id) {
            // Edit existing
            setProfiles((prev) =>
                prev.map((p) => (p.id === formData.id ? { ...p, ...formData } : p))
            );
            showToast(`Updated "${formData.name}"`);
        } else {
            // Create new
            const newProfile = {
                ...formData,
                id: Date.now(),
                is_active: false,
            };
            setProfiles((prev) => [...prev, newProfile]);
            showToast(`Created "${formData.name}"`);
        }
        setModalOpen(false);
        setEditingProfile(null);
    };

    // Render
    return (
        <>
            <Navbar deviceName="Raspberry Pi 5" status="online" />
            <TabBar activeTab={activeTab} onTabChange={setActiveTab} />

            {activeTab === "dashboard" ? (
                // Dashboard Tab — uses the same Dashboard page component
                <Dashboard
                    current={MOCK_CURRENT}
                    thresholds={thresholds}
                    charts={MOCK_CHARTS}
                />
            ) : (
                // Settings Tab
                <main className="dashboard">
                    <div className="settings-page">
                        <div className="settings-header">
                            <h2 className="settings-title">Threshold Profiles</h2>
                            <button className="btn-create" onClick={handleCreate}>
                                + New Profile
                            </button>
                        </div>

                        <div className="profile-list">
                            {profiles.map((profile) => (
                                <ProfileCard
                                    key={profile.id}
                                    profile={profile}
                                    onEdit={handleEdit}
                                    onDuplicate={handleDuplicate}
                                    onUse={handleUse}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </div>
                    </div>
                </main>
            )}

            {/* Create/Edit Modal */}
            {modalOpen && editingProfile && (
                <ProfileModal
                    profile={editingProfile}
                    onSave={handleSave}
                    onClose={() => {
                        setModalOpen(false);
                        setEditingProfile(null);
                    }}
                />
            )}

            {/* Delete Confirmation */}
            {confirmDelete && (
                <ConfirmDialog
                    title="Delete Profile"
                    message={
                        <>
                            Are you sure you want to delete{" "}
                            <strong>"{confirmDelete.name}"</strong>?
                            This action cannot be undone.
                        </>
                    }
                    confirmLabel="Delete"
                    onConfirm={handleConfirmDelete}
                    onCancel={() => setConfirmDelete(null)}
                />
            )}

            {/* Toast */}
            {toast && <Toast message={toast.message} type={toast.type} />}
        </>
    );
}

export default AppDemo;