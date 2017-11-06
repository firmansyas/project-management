'use strict'
const express = require('express');
const router = express.Router();
const userChecker = require('../helper/userchecker');
const passwordHash = require('password-hash');

module.exports = function(db) {
  router.get('/', function(req, res, next) {
    //frontpage
    var message = new Array(req.flash('loginMessage')[0])
    res.render('login', { title: 'Login Page', message: message } );
  });

  router.post('/', function(req, res, next) {
    db.query(`SELECT * FROM users WHERE email = '${req.body.email}'`, (err, data) => {
      if(err) {
        console.error(err);
        req.flash('loginMessage', 'something wrong please call administrator');
        return res.redirect('/')
      }
      if(data.rows.length > 0) {
        //login masuk
        if(passwordHash.verify(req.body.pass, data.rows[0].password)) {
          delete data.rows[0].password;
          req.session.user = data.rows[0]
          return res.redirect('/home')

        } else {
          req.flash('loginMessage', 'password is not match');
          return res.redirect('/')
        }

      } else {
        req.flash('loginMessage', "email is not exist")
        return res.redirect('/')
      }
    });
  });

  //daftar user
  router.get('/register', function(req, res, next) {
    var message = new Array(req.flash('registerMessage')[0])
    res.render('register', { title: 'Register Account', message: message } );
  });

  router.post('/register', function(req, res, next) {
    if(req.body.pass !== req.body.repass) {
      req.flash('registerMessage', 'password is not match');
      return res.redirect('/register')
    }

    db.query(`SELECT email FROM users WHERE email = '${req.body.email}'`, (err, data) => {
      console.log('0');
      if(err) {
        console.error(err);
        req.flash('registerMessage', 'something wrong please call administrator');
        return res.redirect('/register')
      }
      if(data.rows.length > 0) {
        console.log('data', data.rows);
        req.flash('registerMessage', 'email already registered');
        return res.redirect('/register')
      } else {
        console.log('2');
        const sqlinsert = `INSERT INTO users( email, password, firstname, lastname, projectcolumns, membercolumns, issuecolumns, privilege) VALUES('${req.body.email}','${passwordHash.generate(req.body.pass)}','${req.body.firstname}','${req.body.lastname}', '{}', '{}', '{}', 'User')`;
        console.log(sqlinsert,'sql');
        db.query(sqlinsert, (err, data) => {
          if(err) {
            console.error(err);
            req.flash('registerMessage', 'something wrong please call administrator');
            return res.redirect('/register')
          }
          req.flash('registerMessage', 'registration successful, please log into your account');
          return res.redirect('/register')
        });
      }
    });
  });

  router.get('/home', function(req, res) {

    res.render('home', { title: 'Welcome', page: "home", user: req.session.user} );
  });


  router.get('/logout', function(req, res, next) {
    req.session.destroy(function() {
      res.redirect('/');
    });
  });

  return router;
}
/* GET home page. */
