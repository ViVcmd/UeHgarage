import React from 'react';
import { BrowserRouter as Router, Route, Redirect } from 'react-router-dom';

function App() {
  const isAuthenticated = !!document.cookie.includes('connect.sid'); // Example check for session cookie

  return (
    <Router>
      <Route exact path="/">
        {isAuthenticated ? (
          <div>Welcome to the app!</div>
        ) : (
          <Redirect to="/auth/google" />
        )}
      </Route>
    </Router>
  );
}

export default App;
