import { useState } from "react";

import logo from "../assets/logo.png";
import hydroponicBg from "../assets/hydroponic-bg.png";

import "../styles/LandingPage.css";

function LandingPage({ onLogin }) {
    const [showLogin, setShowLogin] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showCreateAccount, setShowCreateAccount] = useState(false);
    
    // =========================
    // SIGN IN
    // =========================
    const handleSubmit = (e) => {
        e.preventDefault();

        // For now, clicking Sign In opens the dashboard.
        // Later we can connect this to FastAPI authentication.
        onLogin();
    };

    // =========================
    // CREATE ACCOUNT
    // =========================
    const handleCreateAccount = (e) => {
        e.preventDefault();

        // Temporary:
        // Later connect this to FastAPI registration.
        alert("Account created successfully!");

        // Close Create Account
        setShowCreateAccount(false);

        // Open Sign In
        setShowLogin(true);
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
                        onClick={() => setShowLogin(true)}
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
                    <div className="landing-team-member">
                        <div className="team-avatar">
                            V
                        </div>

                        <div>
                            <p>Vy Lo Phuong Tran</p>
                            <span>@vlotran</span>
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

                            <a href="https://www.linkedin.com/in/thai-nguyen-43275617b/"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                LinkedIn: nguyenhoathai.nht@gmail.com
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

                        <form onSubmit={handleSubmit}>

                            <label htmlFor="email">
                                Email
                            </label>

                            <input
                                id="email"
                                type="email"
                                placeholder="Enter your email"
                                required
                            />

                            <label htmlFor="password">
                                Password
                            </label>

                            <div className="password-container">

                                <input
                                    id="password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Enter your password"
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

                                <label className="remember-me">
                                    <input type="checkbox" />
                                    <span>Remember me</span>
                                </label>

                                <button
                                    type="button"
                                    className="forgot-password"
                                >
                                    Forgot password?
                                </button>

                            </div>

                            <button
                                type="submit"
                                className="login-submit"
                            >
                                Sign In
                            </button>

                        </form>

                        {/* CREATE ACCOUNT LINK */}

                        <p className="create-account">

                            Don't have an account?{" "}

                            <button
                                type="button"
                                className="create-account-link"
                                onClick={() => {
                                    setShowLogin(false);
                                    setShowCreateAccount(true);
                                }}
                            >
                                Create account
                            </button>

                        </p>
                    </div>

                </div>

            )}
            {/* =========================
                CREATE ACCOUNT POPUP
            ========================= */}

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
                                type="text"
                                placeholder="Enter your full name"
                                required
                            />


                            {/* EMAIL */}

                            <label htmlFor="create-email">
                                Email
                            </label>

                            <input
                                id="create-email"
                                type="email"
                                placeholder="Enter your email"
                                required
                            />


                            {/* PASSWORD */}

                            <label htmlFor="create-password">
                                Password
                            </label>

                            <div className="password-container">

                                <input
                                    id="create-password"
                                    type={
                                        showPassword
                                            ? "text"
                                            : "password"
                                    }
                                    placeholder="Create a password"
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
                                type="password"
                                placeholder="Enter your password again"
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

                            <button
                                type="submit"
                                className="login-submit"
                            >
                                Create Account
                            </button>

                        </form>


                        {/* BACK TO SIGN IN */}

                        <p className="create-account">

                            Already have an account?{" "}

                            <button
                                type="button"
                                className="create-account-link"
                                onClick={() => {
                                    setShowCreateAccount(false);
                                    setShowLogin(true);
                                }}
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