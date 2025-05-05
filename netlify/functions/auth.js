const express = require('express');
const serverless = require('serverless-http');
const passport = require('passport');
const session = require('express-session');
const { Strategy: GoogleStrategy } = require('passport-google-oauth20');
require('dotenv').config();

const app = express();

// Middleware: Session
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'default_secret',
    resave: false,
    saveUninitialized: true,
  })
);

// Middleware: Passport
app.use(passport.initialize());
app.use(passport.session());

// Passport Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/.netlify/functions/auth/callback',
    },
    (accessToken, refreshToken, profile, done) => {
      // Store the user profile in the session
      return done(null, profile);
    }
  )
);

// Serialize user to session
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((user, done) => done(null, user));

// Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

app.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    res.redirect('/');
  }
);

app.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).send('Error logging out');
    res.redirect('/');
  });
});

app.get('/', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ message: `Hello, ${req.user.displayName}` });
  } else {
    res.redirect('/auth/google');
  }
});

module.exports.handler = serverless(app);
