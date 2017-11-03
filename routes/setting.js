"use strict";
const express = require('express');
const router = express.Router();
const userChecker = require('../helper/userchecker')

module.exports = function(db) {
  router.get('/', userChecker, function(req, res) {
    //for giving authentication
    //select the query
    let sqlQuery = `SELECT * FROM users`
    db.query(sqlQuery, function(err, listUsers) {

      res.render('projects/details/setting', {
        title: "Authentication",
        page: "setting",
        listUsers: req.session.user,
        listUsers: listUsers.rows,
        user: req.session.user
      });
    });
  });

  router.post('/', userChecker, function(req, res) {
    let sqlQuery = `UPDATE users SET privilege = '${req.body.privilege}' WHERE userid = ${req.body.user}`
    console.log(sqlQuery);
    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err)
      }
      res.redirect('/projects')
    })
  });

  return router;
}
