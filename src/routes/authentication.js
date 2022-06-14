const express = require('express');
const router = express.Router();
const passport = require('passport');
const { isLoggedIn } = require('../lib/auth');

// SIGNUP (cadastro)
router.get('/signup', (req, res) => { 
  res.render('auth/signup');
});

router.post('/signup', passport.authenticate('local.signup', {
  successRedirect: '/profile',
  failureRedirect: '/signup',
  failureFlash: true
}));

// SINGIN
router.get('/signin', (req, res) => {
  res.render('auth/signin');
});

router.post('/signin', (req, res, next) => {

  passport.authenticate('local.signin', {
    successRedirect: '/profile',
    failureRedirect: '/signin',
    failureFlash: true
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logOut();
  res.redirect('/signin');
});

router.get('/profile', isLoggedIn,  (req, res) => {
  res.render('profile');
});

module.exports = router;
