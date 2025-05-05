import React from 'react';

export function SignInForm() {
  const handleGoogleSignIn = () => {
    window.location.href = '/auth/google'; // Redirect to Google OAuth2
  };

  return (
    <div className="signin-container">
      <button onClick={handleGoogleSignIn} className="auth-button">
        Sign in with Google
      </button>
    </div>
  );
}
