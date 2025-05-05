const isAuthenticated = (req: any, res: any, next: any) => {
  if (req.isAuthenticated()) {
    return next();
  }
  res.redirect('/auth/google'); // Redirect to Google OAuth2
};

app.get('/protected', isAuthenticated, (req, res) => {
  res.send('This is a protected route, accessible only to authenticated users.');
});
