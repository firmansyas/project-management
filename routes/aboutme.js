var express = require('express');
var router = express.Router();
var userChecker = require('../helper/userchecker');

module.exports = function(db) {
  router.get('/', userChecker, function(req, res) {


    res.render('aboutme', {
      title: "All About Me",
      page: "aboutme",
      user: req.session.user
    });
  });
  return router
}
