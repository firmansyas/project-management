var express = require('express');
var router = express.Router();
var userChecker = require('../helper/userchecker')
var passwordHash = require('password-hash');

module.exports = function(db) {
  /* GET users listing. */

  router.get('/profile', userChecker, function(req, res, next) {
    db.query (`select * from users where userid = ${req.session.user.userid}`, (err, data) => {
      console.log('bbbbbb', data);
      res.render('users/profile', {title: "User Profile", page: "profile", user:req.session.user, item: data.rows[0]});
    })
  });

  router.post('/profile', userChecker, function(req, res) {
    let email = req.body.email;
    let password = req.body.password;
    let firstname = req.body.firstname;
    let lastname = req.body.lastname;
    let role = req.body.position; //manager, dll
    let isFullTime = (req.body.isfulltime ? true : false);
    let privilege = req.body.privilege;
    let sqlQuery = '';
    console.log("isfulltime:", isFullTime);
    console.log("password:", password);
    console.log("privilege:", privilege);

    //getting FN, LN, Role, FT data
    req.session.user.firstname = firstname
    req.session.user.lastname = lastname
    req.session.user.role = role
    req.session.user.isfulltime = isFullTime
    req.session.user.privilege = privilege

    if(req.body.password) {
      password = passwordHash.generate(req.body.password);
      sqlQuery = `UPDATE users SET password = '${password}', firstname = '${firstname}',
      lastname = '${lastname}', role = '${role}', isfulltime = ${isFullTime} WHERE
      userid = '${req.session.user.userid}'`;

      db.query(sqlQuery, function() {
        res.redirect('/users/profile')
      });

    } else {
      sqlQuery = `UPDATE users SET firstname = '${firstname}',
      lastname = '${lastname}', role = '${role}', isfulltime = ${isFullTime} WHERE
      userid = '${req.session.user.userid}'`;

      db.query(sqlQuery, function() {
        res.redirect('/users/profile')
      });
    }
  });

  return router;
}
