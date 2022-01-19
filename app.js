
require("dotenv").config()
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
//You can see more on passport documentation.
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate')

const app = express();

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  secret: "Our little secret.",
  resave: false,
  saveUninitialized: false,
}));

//we initialize passport.
app.use(passport.initialize());

//We use passport to manage our session.
app.use(passport.session());

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema ({
  email: String,
  password: String,
  googleId: String
});

//We setup userSchema to use passportLocalMongoose to use as a plugin.
userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = new mongoose.model("User", userSchema);

//Notice the order of code here it is really important here.
passport.use(User.createStrategy());

// use static serialize and deserialize of model for passport session support
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  function(accessToken, refreshToken, profile, cb) {

  // console.log(profile);

    User.findOrCreate({ googleId: profile.id }, function (err, user) {
      return cb(err, user);
    });
  }
));

app.get("/", function(req, res){
  res.render("home");
});

app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);

app.get("/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function(req, res) {
    // Successful authentication, redirect to secrets.
    res.redirect("/secrets");
  });

app.get("/login", function(req, res){
  res.render("login");
});

app.get("/register", function(req, res){
  res.render("register");
});

app.get("/secrets", function(req, res){
  // Here we will check if a user is logged in if it is not then
  // we will redirect it to a login page.

  if(req.isAuthenticated()) {
    res.render("secrets");
  } else {
    res.redirect("/login");
  }
});

app.get("/logout", function(req, res){
  // To end the session of a user for more see passport documentation on login and logout.
  req.logout();
  res.redirect("/");
});

/*
From passport-local-mongoose:-

User.register({username:'username', active: false}, 'password', function(err, user) {
if (err) { ... }

var authenticate = User.authenticate();
authenticate('username', 'password', function(err, result) {
if (err) { ... }

// Value 'result' is set to false. The user could not be authenticated since the user is not active
});

*/

app.post("/register", function(req, res){

  User.register({username: req.body.username}, req.body.password, function(err, user){
    if(err) {
      console.log(err);
      res.redirect("/register");
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets");
      })
    }
  });
});

app.post("/login", function(req, res){
  const user = new User({
    username: req.body.username,
    password: req.body.password
  });
  // We can use login method from passport
  req.login(user, function(err){
    if(err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function(){
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(3000, function(){
  console.log("Server started on port 3000");
});
