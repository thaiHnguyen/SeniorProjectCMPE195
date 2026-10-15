/**
 * useSettings Hook
 *
 * Manages all threshold profile state for the Settings page.
 * Pattern: api.js -> hook (state) -> component (UI)
 *
 * Returns:
 *  - profiles: array of all configurations
 *  - activeProfile: the one with is_active === true
 *  - loading/error: for UI feedback
 *  - createProfile, updateProfile, deleteProfile, duplicateProfile, activateProfile
 */

import { useEffect, useState, useCallback } from "react";
import {
    fetchAllConfigurations,
    createConfiguration,
    updateConfiguration,
    deleteConfiguration,
    activateConfiguration,
} from "../services/api";

export default function useSettings() {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Load all profiles on mount 
    useEffect(() => {
    async function loadProfiles() {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchAllConfigurations();
            setProfiles(data);
        } catch (err) {
            // Backend not running — start with empty list
            // User can still create profiles in the UI
            console.warn("Could not load profiles from backend:", err.message);
            setProfiles([]);
        } finally {
            setLoading(false);
        }
    }
    loadProfiles();
}, []);

    // The one profile where is_active === true
    const activeProfile = profiles.find((p) => p.is_active) || null;

    // Create 
    const createProfile = useCallback(async (profileData) => {
        const result = await createConfiguration(profileData);
        // result.data = the newly created profile with its backend-assigned ID
        setProfiles((prev) => [...prev, result.data]);
        return result.data;
    }, []);

    //  Update 
    const updateProfile = useCallback(async (profileId, updateData) => {
        const result = await updateConfiguration(profileId, updateData);
        // Replace the old version in our local array
        setProfiles((prev) =>
            prev.map((p) => (p.id === profileId ? result.data : p))
        );
        return result.data;
    }, []);

    //  Delete 
    const deleteProfile = useCallback(async (profileId) => {
        await deleteConfiguration(profileId);
        setProfiles((prev) => prev.filter((p) => p.id !== profileId));
    }, []);

    // Duplicate 
    const duplicateProfile = useCallback(async (sourceProfile) => {
        const newProfileData = {
            name: `${sourceProfile.name} (Copy)`,
            description: sourceProfile.description || "",
            ph_min: sourceProfile.ph_min,
            ph_max: sourceProfile.ph_max,
            temp_min: sourceProfile.temp_min,
            temp_max: sourceProfile.temp_max,
            humidity_min: sourceProfile.humidity_min,
            humidity_max: sourceProfile.humidity_max,
            pressure_min: sourceProfile.pressure_min,   // NEW
            pressure_max: sourceProfile.pressure_max,   // NEW
            aqi_min: sourceProfile.aqi_min,             // NEW
            aqi_max: sourceProfile.aqi_max,             // NEW
        };
        return await createProfile(newProfileData);
    }, [createProfile]);

    // Activate- use profile
    const activateProfile = useCallback(async (profileId) => {
        await activateConfiguration(profileId);
        // Backend deactivates all others, so we mirror that locally
        setProfiles((prev) =>
            prev.map((p) => ({ ...p, is_active: p.id === profileId }))
        );
    }, []);

    // Reload 
    const reload = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await fetchAllConfigurations();
            setProfiles(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        profiles,
        activeProfile,
        loading,
        error,
        createProfile,
        updateProfile,
        deleteProfile,
        duplicateProfile,
        activateProfile,
        reload,
    };
}