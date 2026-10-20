import { useState } from "react";

import { loginUser, registerUser } from "../services/api.js";   // NEW: login

import logo from "../assets/logo.png";
import hydroponicBg from "../assets/hydroponic-bg.png";

import "../styles/LandingPage.css";

function LandingPage({ onLogin }) {
    const [showLogin, setShowLogin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showCreateAccount, setShowCreateAccount] = useState(false);

    // NEW (login): form feedback
    const [authError, setAuthError] = useState("");     // red message in the open popup
    const [notice, setNotice] = useState("");           // green "account created" message
    const [busy, setBusy] = useState(false);            // disables the submit button while waiting
    const [signInEmail, setSignInEmail] = useState(""); // pre-fills Sign In after creating an account

    // Switch popups and clear any old message
    const openLogin = () => { setAuthError(""); setShowCreateAccount(false); setShowLogin(true); };
    const openCreateAccount = () => { setAuthError(""); setNotice(""); setShowLogin(false); setShowCreateAccount(true); };

    // =========================
    // SIGN IN
    // =========================

    // CHANGED: checks the email + password with the backend (POST /api/auth/login).
    // Inputs are read by their `name` attribute, so the JSX below stays the same.

    const handleSubmit = async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);

        setBusy(true);
        setAuthError("");
        try {
            const user = await loginUser({
                email: form.get("email"),
                password: form.get("password"),
                remember: form.get("remember") === "on",
            });
            onLogin(user);   // App.jsx switches to the dashboard
        } catch (err) {
            setAuthError(err.message || "Sign in failed. Please try again.");
            setBusy(false);
        }
    };

    // =========================
    // CREATE ACCOUNT
    // =========================

    // CHANGED: creates the account on the backend (POST /api/auth/register),
    // then opens Sign In with the email already filled in.
    
    const handleCreateAccount = async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const password = form.get("password");

        // Checked here so the user gets the message before anything is sent
        if (password !== form.get("confirmPassword")) {
            setAuthError("Passwords do not match.");
            return;
        }

        setBusy(true);
        setAuthError("");
        try {
            await registerUser({
                name: form.get("name"),
                email: form.get("email"),
                password,
            });
            setSignInEmail(form.get("email"));
            setNotice("Account created! Sign in to continue.");
            openLogin();
        } catch (err) {
            setAuthError(err.message || "Could not create account. Please try again.");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="landing-page">

            {/* Header */}
            <header className="landing-header">
                <div className="landing-brand">
                    <img
                        src={logo}
                        alt="HydroGarden Logo"
                        className="landing-logo"
                    />

                    <span>HydroGarden</span>
                </div>
            </header>

            {/* Hero */}
            <main className="landing-hero">

                {/* Left side */}
                <div className="landing-content">

                    <p className="landing-eyebrow">
                        SMART HYDROPONIC GARDEN
                    </p>

                    <h1>
                        Grow Smarter.
                        <br />

                        <span>Grow Healthier.</span>
                    </h1>

                    <p className="landing-description">
                        Smart monitoring for your hydroponic garden.
                        Monitor pH, humidity, and system status in real time.
                    </p>

                    <button
                        className="get-started-button"
                        onClick={openLogin}
                    >
                        Get Started
                        <span>→</span>
                    </button>

                </div>

                {/* Right side */}
                <div className="landing-image-container">
                    <div className="landing-image-glow"></div>

                    <img
                        src={hydroponicBg}
                        alt="Smart Hydroponic Garden"
                        className="landing-image"
                    />
                </div>

            </main>

            {/* Bottom */}
            <section className="landing-bottom">

                <h2>
                    Your plants. Your data. Your control.
                </h2>

                <p className="team-heading">
                    MEET THE TEAM
                </p>

                <div className="landing-team">

                    <div className="landing-team-member team-member-detailed">
                        <div className="team-avatar">
                            H
                        </div>

                        <div className="team-info">
                            <p className="team-name">
                                Hoa Tuong Minh Nguyen
                            </p>

                            <div className="team-links">
                                <a
                                    href="https://github.com/MinhHoaNguyen"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    GitHub: MinhHoaNguyen
                                </a>

                                <a href="mailto:hoatuongminh@gmail.com">
                                    Gmail: hoatuongminh@gmail.com
                                </a>

                                <a
                                    href="https://www.linkedin.com/in/hoa-nguyen-m1000/"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    LinkedIn: Hoa Nguyen
                                </a>
                            </div>
                        </div>
                    </div>
                <div className="landing-team-member team-member-detailed">
                    <div className="team-avatar">
                        V
                    </div>

                    <div className="team-info">
                        <p className="team-name">
                            Vy Lo Phuong Tran
                        </p>

                        <div className="team-links">
                            <a
                                href="https://github.com/vlotran"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                GitHub: vlotran
                            </a>

                            <a href="mailto:vylophuong.tran@sjsu.edu">
                                Email: vylophuong.tran@sjsu.edu
                            </a>

                            <a
                                href="https://www.linkedin.com/in/vylotran"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                LinkedIn: Vy Lo Phuong Tran
                            </a>
                        </div>
                    </div>
                </div>
                <div className="landing-team-member team-member-detailed">
                    <div className="team-avatar">
                        T
                    </div>

                    <div className="team-info">
                        <p className="team-name">Thai Nguyen</p>

                        <div className="team-links">
                            <a
                                href="https://github.com/thaiHnguyen"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                GitHub: thaiHnguyen
                            </a>

                            <a href="mailto:thai.nguyen02@sjsu.edu">
                                Gmail: thai.nguyen02@sjsu.edu
                            </a>

                            <a href="https://linkedin.com/in/thaih-nguyen"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                LinkedIn: Thai Nguyen
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            </section>

            {/* Login Popup */}
            {showLogin && (

                <div
                    className="login-overlay"
                    onClick={() => setShowLogin(false)}
                >

                    <div
                        className="login-box"
                        onClick={(e) => e.stopPropagation()}
                    >

                        {/* Close */}
                        <button
                            className="login-close"
                            onClick={() => setShowLogin(false)}
                        >
                            ×
                        </button>

                        {/* Logo */}
                        <img
                            src={logo}
                            alt="HydroGarden"
                            className="login-logo"
                        />

                        <h2>
                            Welcome Back
                        </h2>

                        <p className="login-subtitle">
                            Sign in to your HydroGarden
                        </p>

                        {/* NEW: "account created" message */}
                        {notice && (
                            <p className="login-notice" role="status">{notice}</p>
                        )}

                        <form onSubmit={handleSubmit}>

                            <label htmlFor="email">
                                Email
                            </label>

                            <input
                                id="email"
                                name="email"
                                type="email"
                                placeholder="Enter your email"
                                defaultValue={signInEmail}
                                autoComplete="email"
                                required
                            />

                            <label htmlFor="password">
                                Password
                            </label>

                            <div className="password-container">

                                <input
                                    id="password"
                                    name="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Enter your password"
                                    autoComplete="current-password"
                                    required
                                />

                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>

                            </div>

                            <div className="login-options">

                                {/* Checked: stay signed in for 6 hours, even after closing the browser.
                                    Unchecked: signed out when the browser closes. */}
                                <label className="remember-me">
                                    <input type="checkbox" name="remember" />
                                    <span>Remember me</span>
                                </label>

                                <button
                                    type="button"
                                    className="forgot-password"
                                >
                                    Forgot password?
                                </button>

                            </div>

                            {/* NEW: error from the backend (e.g. wrong password) */}
                            {authError && (
                                <p className="login-error" role="alert">{authError}</p>
                            )}

                            <button
                                type="submit"
                                className="login-submit"
                                disabled={busy}
                            >
                                {busy ? "Signing in..." : "Sign In"}
                            </button>

                        </form>

                        {/* CREATE ACCOUNT LINK */}

                        <p className="create-account">

                            Don't have an account?{" "}

                            <button
                                type="button"
                                className="create-account-link"
                                onClick={openCreateAccount}
                            >
                                Create account
                            </button>

                        </p>
                    </div>

                </div>

            )}
            {/*CREATE ACCOUNT POPUP*/}

            {showCreateAccount && (

                <div
                    className="login-overlay"
                    onClick={() =>
                        setShowCreateAccount(false)
                    }
                >

                    <div
                        className="login-box create-account-box"
                        onClick={(e) =>
                            e.stopPropagation()
                        }
                    >

                        {/* CLOSE */}

                        <button
                            className="login-close"
                            onClick={() =>
                                setShowCreateAccount(false)
                            }
                        >
                            ×
                        </button>


                        {/* LOGO */}

                        <img
                            src={logo}
                            alt="HydroGarden"
                            className="login-logo"
                        />


                        <h2>
                            Create Account
                        </h2>


                        <p className="login-subtitle">
                            Start growing smarter with HydroGarden.
                        </p>


                        {/* CREATE ACCOUNT FORM */}

                        <form
                            onSubmit={handleCreateAccount}
                        >

                            {/* FULL NAME */}

                            <label htmlFor="create-name">
                                Full Name
                            </label>

                            <input
                                id="create-name"
                                name="name"
                                type="text"
                                placeholder="Enter your full name"
                                autoComplete="name"
                                maxLength={80}
                                required
                            />


                            {/* EMAIL */}

                            <label htmlFor="create-email">
                                Email
                            </label>

                            <input
                                id="create-email"
                                name="email"
                                type="email"
                                placeholder="Enter your email"
                                autoComplete="email"
                                required
                            />


                            {/* PASSWORD */}

                            <label htmlFor="create-password">
                                Password
                            </label>

                            <div className="password-container">

                                <input
                                    id="create-password"
                                    name="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="At least 8 characters"
                                    autoComplete="new-password"
                                    minLength={8}
                                    required
                                />


                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() =>
                                        setShowPassword(!showPassword)
                                    }
                                >
                                    {showPassword
                                        ? "Hide"
                                        : "Show"}
                                </button>

                            </div>


                            {/* CONFIRM PASSWORD */}

                            <label htmlFor="confirm-password">
                                Confirm Password
                            </label>

                            <input
                                id="confirm-password"
                                name="confirmPassword"
                                type="password"
                                placeholder="Enter your password again"
                                autoComplete="new-password"
                                required
                            />


                            {/* TERMS */}

                            <label className="terms-checkbox">

                                <input
                                    type="checkbox"
                                    required
                                />

                                <span>
                                    I agree to the Terms & Conditions
                                </span>

                            </label>


                            {/* CREATE ACCOUNT */}

                            {/* NEW: error from the backend (email already used) */}
                            {authError && (
                                <p className="login-error" role="alert">{authError}</p>
                            )}

                            <button
                                type="submit"
                                className="login-submit"
                                disabled={busy}
                            >
                                {busy ? "Creating account..." : "Create Account"}
                            </button>

                        </form>


                        {/* BACK TO SIGN IN */}

                        <p className="create-account">

                            Already have an account?{" "}

                            <button
                                type="button"
                                className="create-account-link"
                                onClick={openLogin}
                            >
                                Sign In
                            </button>

                        </p>

                    </div>

                </div>

            )}

        </div>
    );
}

export default LandingPage;