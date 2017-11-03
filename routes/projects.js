"use strict";
const express = require('express');
const router = express.Router();
const userChecker = require('../helper/userchecker');
const crypto = require ('crypto')
const moment = require('moment')

module.exports = function(db) {
  /* GET home page. */
  //---------------------------------------------------------------//
  router.get('/', userChecker, function(req, res, next) {
    const cekRole = req.session.user.privilege === "Admin"
    let url = (req.url == "/") ? "/?page=1" : req.url;
    let page = Number(req.query.page) || 1
    if(url.indexOf('&submit=') != -1){
      page = 1;
    }
    url = url.replace('&submit=', '')
    //filter
    let filterQuery = [];
    let isFilter = false;
    let sqlQuery = 'SELECT count(*) as total FROM projects'

    if(req.query.cid && req.query.id) {
      filterQuery.push(`projectid = ${req.query.id}`)
      isFilter = true;
    }
    if(req.query.cname && req.query.name) {
      filterQuery.push(`name = '${req.query.name}'`)
      isFilter = true;
    }
    if(req.query.cmember && req.query.member) {
      filterQuery.push(`projectid IN(SELECT projectid FROM members WHERE userid = ${req.query.member})`)
      isFilter = true;
    }

    if(isFilter){
      sqlQuery += ' WHERE ' + filterQuery.join(' AND ')
    }


    //count records
    db.query(sqlQuery, (err, data) => {
      if (err) {
        console.error(err)
        return res.send(err);
      }

      //pagination
      let limit = 3
      let offset = (page-1) * 3
      let total = data.rows[0].total;
      let pages = (total == 0) ? 1 : Math.ceil(total/limit);

      sqlQuery = "SELECT * FROM projects";
      if(isFilter){
        sqlQuery += ' WHERE ' + filterQuery.join(' AND ')
      }

      sqlQuery += ` ORDER BY projectid ASC`;
      sqlQuery += ` LIMIT ${limit} OFFSET ${offset}`;

      // select with pagination
      db.query(sqlQuery, (err, projects) => {
        if (err) {
          console.error(err)
          return res.send(err);
        }

        sqlQuery = `SELECT members.projectid,
        users.firstname || ' ' || users.lastname AS name, users.role FROM members,
        users WHERE members.userid=users.userid;` //untuk munculin data nama depan, nama belakang dan role (position)
        db.query(sqlQuery, function(err, members) {
          if(err) {
            console.error(err);
            return res.send(err);
          }
          for(let x=0; x<projects.rows.length; x++) {
            projects.rows[x].members = members.rows.filter(function(item) {
              return item.projectid === projects.rows[x].projectid;
            });
          }

          db.query("SELECT * FROM users", function(err, userData) {
            if(err) {
              console.err(err);
            }
            res.render('projects/list', {
              title: 'List of Project',
              page: "project",
              pagination: {
                page: page,
                limit: limit,
                offset: offset,
                pages: pages,
                total: total,
                url: url
              },
              listData: projects.rows,
              userData: userData.rows,
              projectColumns: JSON.parse(req.session.user.projectcolumns),
              query: req.query,
              user: req.session.user,
              cekRole
            });
          });
        });
      });
    });
  });

  //---------------------------------------------------------------//
  router.post('/projectcolumn', userChecker, function(req, res) {
    let projectColumns = JSON.stringify(req.body);
    req.session.user.projectcolumns = projectColumns;
    db.query("UPDATE users SET projectcolumns = $1 WHERE userid = $2", [projectColumns, req.session.user.userid], function(err, data) {
      res.redirect('/projects')
    });
  });

  //---------------------------------------------------------------//
  router.get('/add', userChecker, function(req, res) {
    db.query("SELECT * FROM users", function(err, userData) {
      res.render('projects/add', {title: 'Add projects', page: "project", userData: userData.rows, user:req.session.user});
    });
  });

  //---------------------------------------------------------------//
  router.post('/add', userChecker, function(req, res) {

    db.query(`INSERT INTO projects(name) VALUES('${req.body.name}')`, function(err) {
      if(err) {
        console.error(err);
      }

      db.query("SELECT projectid FROM projects ORDER BY projectid DESC LIMIT 1", function(err, projectId) {
        let insertData = []
        for(var x = 0; x<req.body.members.length; x++) {
          insertData.push(`(${projectId.rows[0].projectid}, ${req.body.members[x]})`)
        }

        db.query(`INSERT INTO members(projectid, userid) VALUES ${insertData.join(',')}`, function(err) {
          if(err) {
            console.error(err);
          }
          res.redirect('/projects')

        })
      });
    })
  })
  //---------------------------------------------------------------//
  router.get('/delete/:id', userChecker, function(req, res) {
    db.query(`DELETE FROM issues WHERE projectid = ${req.params.id}`, function(error) {
      db.query(`DELETE FROM members WHERE projectid = ${req.params.id}`, function(error) {
        db.query(`DELETE FROM projects WHERE projectid = ${req.params.id}`, function(error) {
          res.redirect('/projects');
        });
      });
    }) ;
  });

  //---------------------------------------------------------------//
  router.get('/edit/:id', userChecker, function(req, res) {
    db.query("SELECT * FROM users", function(err, userData) {
      db.query(`SELECT projects.projectid, projects.name, members.userid FROM projects JOIN members ON projects.projectid=members.projectid WHERE projects.projectid= ${req.params.id}`, function(err, data) {
        console.log('ada data', data)
        res.render('projects/edit', {
          title: "Edit Project",
          page: "project",
          data: data.rows,
          userData: userData.rows,
          members: data.rows.map(function(item)
          {  return item.userid}),
          user:req.session.user
        })
      });
    })
  });

  //---------------------------------------------------------------//
  router.post('/edit/:id', userChecker, function(req, res) {
    db.query(`UPDATE projects SET name = '${req.body.name}' WHERE projectid = ${req.params.id}`, function(err) {
      db.query(`DELETE FROM members WHERE projectid = ${req.params.id}`, function(err) {
        let insertData = []
        for(var x = 0; x<req.body.members.length; x++) {
          insertData.push(`(${req.params.id}, ${req.body.members[x]})`)
        }
        db.query(`INSERT INTO members(projectid, userid) VALUES ${insertData.join(',')}`, function(error) {
          res.redirect('/projects')
        });
      })
    })
  });

  //---------------------------------------------------------------//
  router.get('/details/:id/overview', userChecker, function(req, res){
    let trackerQuery = `SELECT (SELECT count(*) FROM issues WHERE tracker = 'Bug') as Bug,(SELECT count(*) FROM issues WHERE tracker = 'Feature') as feature, (SELECT count(*) FROM issues WHERE tracker = 'Support') as Support`

    db.query(trackerQuery, function (err, tracker) {
      if (err){
        console.log(err);
      }
    })
    let query = `SELECT members.membersid, users.firstname ||' '|| users.lastname as membername, projects.name
    FROM members JOIN users ON members.userid = users.userid JOIN projects
    ON members.projectid = projects.projectid WHERE members.projectid = ${req.params.id}`
    db.query(query, function(err, members){
      res.render('projects/details/overview', {
        title: "Overview",
        page: "overview",
        idURL: req.params.id,
        // tracker:
        members: members.rows,
        user: req.session.user
      });
    })
  })

  //---------------------------------------------------------------//
  router.get('/details/:id/members', userChecker, function(req, res){
    const cekRole = req.session.user.privilege === "Admin"
    let filterQuery = [];
    let isFilter = false;

    //bagian query untuk nampilin , nama depan & belakang (sebagai members) dan role
    let sqlQuery = `SELECT members.membersid, users.userid, users.firstname || ' ' || users.lastname AS name, users.role FROM members
    JOIN users ON members.userid=users.userid
    JOIN projects ON members.projectid=projects.projectid
    WHERE projects.projectid = ${req.params.id}`

    if(req.query.cid && req.query.id) {
      filterQuery.push(`projectid = ${req.query.id}`)
      isFilter = true;
    }

    if(req.query.cname && req.query.name) {
      let queryName = req.query.name.split(' ').filter
      (function(deleteSpace){return deleteSpace !== ''})


      let tempQueryArray = [];
      let tempQuery = '';
      for(var x =  0; x<queryName.length; x++) {
        tempQueryArray.push(`users.firstname LIKE '%${queryName[x]}%'`)
        tempQueryArray.push(`users.lastname LIKE '%${queryName[x]}%'`)
      }
      tempQuery = `(${tempQueryArray.join(' OR ')})`
      filterQuery.push(tempQuery)
      isFilter = true;

    }
    if(req.query.cposition && req.query.position) {
      filterQuery.push(`users.role = '${req.query.position}'`)
      isFilter = true;
    }
    if(isFilter){
      sqlQuery += ' AND ' + filterQuery.join(' AND ')
    }
    sqlQuery += ` ORDER BY userid ASC`;

    db.query(sqlQuery, function(err, memberListData) {
      res.render('projects/details/members', {
        title: "Project Members",
        page: "project",
        idURL: req.params.id,
        query: req.query,
        memberListData: memberListData.rows,
        memberColumns: JSON.parse(req.session.user.membercolumns),
        user: req.session.user,
        cekRole
      });
    });
  });

  //---------------------------------------------------------------//
  router.post('/details/:id/members/membercoloumns', userChecker, function(req, res) {
    let memberColumns = JSON.stringify(req.body)
    req.session.user.membercolumns = memberColumns;
    let sqlQuery = `UPDATE users SET membercolumns = '${memberColumns}' WHERE userid = ${req.session.user.userid}`; //for updating data in membercolumns
    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err);
      }
      res.redirect(`/projects/details/${req.params.id}/members`);
    });
  });

  //---------------------------------------------------------------//
  router.get('/details/:id/members/delete/:iddelete', userChecker, function(req, res) {

    let sqlQuery = `SELECT * FROM projects WHERE projectid = ${req.params.id}`
    db.query(sqlQuery, function(err, projectData) {
      if(err) {
        console.error(err);
      }

      //for getting data project
      let nameproject = projectData.rows[0].name

      //for writing the activity
      let activityTitle = `${nameproject}`
      let activityDescription = "Delete members for Projects"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityDateNow = `${moment().format("YYYY-MM-DD")}`
      let activityHour = `${moment().format("HH:mm")}`
      let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
      VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }
      });

      let query = `DELETE FROM members WHERE membersid = ${req.params.iddelete}`
      db.query(query, function(err){

        res.redirect(`/projects/details/${req.params.id}/members`);
      });
    })
  });

  //---------------------------------------------------------------//
  router.get('/details/:id/members/addmembers', userChecker, function(req, res) {
    let query = 'SELECT * FROM users' //showing all data users in database
    db.query(query, function(err, userData) {
      if (err) {
        console.log(err);
      }
      let query2 = `SELECT projects.projectid, projects.name, members.userid FROM projects JOIN members ON projects.projectid=members.projectid WHERE projects.projectid= ${req.params.id}`
      db.query(query2, function (err, data) {
        console.log('ini adalah data:', query2);
        if (err){
          console.log(err);
        }
        res.render('projects/details/addmembers', {
          title: 'Add members project',
          page: "project",
          idURL: req.params.id,
          data: data.rows,
          userData: userData.rows,
          members: data.rows.map(function(item) {return item.userid}), //to giving checkbox automatic
          user:req.session.user
        });
      });
    });
  });

  //---------------------------------------------------------------//
  router.post('/details/:id/members/addmembers', userChecker, function(req, res) {
    let sqlQuery = `SELECT * FROM projects WHERE projectid = ${req.params.id}`
    db.query(sqlQuery, function(err, projectData) {
      if(err) {
        console.error(err);
      };

      let query3 = `INSERT INTO members(userid, projectid) VALUES(${req.body.member}, ${req.params.id})`
      db.query(query3, function(err) {
        if(err) {
          console.error(err);
        }

        //for getting data project
        let nameproject = projectData.rows[0].name

        //for writing the activity
        let activityTitle = `${nameproject}`
        let activityDescription = "Add members to Projects"
        let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
        let activityDateNow = `${moment().format("YYYY-MM-DD")}`
        let activityHour = `${moment().format("HH:mm")}`
        let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
        VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

        db.query(sqlQuery, function(err) {
          if(err) {
            console.error(err);
          }

          res.redirect(`/projects/details/${req.params.id}/members`)
        });
      });
    });
  });
  //---------------------------------------------------------------//
  router.get('/details/:id/issues', userChecker, function (req, res, next) {
    const cekRole = req.session.user.privilege === "Admin"
    //bagian query untuk nampilin , nama depan & belakang (sebagai members) dan role
    let sqlQuery = `SELECT members.membersid, users.userid, users.firstname || ' ' || users.lastname AS name, users.role FROM members
    JOIN users ON members.userid=users.userid
    JOIN projects ON members.projectid=projects.projectid
    WHERE projects.projectid = ${req.params.id}`

    db.query(sqlQuery, function (err, membersData) {
      if (err){
        console.log(err);
      }

      //filter
      let filterQuery = [];
      let isFilter = false;
      let sqlQuery = 'SELECT count(*) AS total from issues'

      if(req.query.cid && req.query.id) {
        filterQuery.push(`issueid = '${req.query.id}'`)
        isFilter = true;
      }

      if(req.query.csubject && req.query.subject) {
        filterQuery.push(`subject = '${req.query.subject}'`)
        isFilter = true;
      }

      if(req.query.ctracker && req.query.tracker) {
        filterQuery.push(`tracker = '${req.query.tracker}'`)
        isFilter = true;
      }

      if(req.query.cdescription && req.query.description) {
        filterQuery.push(`description = '${req.query.description}'`)
        isFilter = true;
      }

      if(req.query.cstatus && req.query.status) {
        filterQuery.push(`status = '${req.query.status}'`)
        isFilter = true;
      }

      if(req.query.cpriority && req.query.priority) {
        filterQuery.push(`priority = '${req.query.priority}'`)
        isFilter = true;
      }

      if(req.query.cassignee && req.query.assignee) {
        filterQuery.push(`assignee = '${req.query.assignee}'`)
        isFilter = true;
      }

      if(req.query.cstartdate && req.query.startdate) {
        filterQuery.push(`startdate = '${req.query.startdate}'`)
        isFilter = true;
      }

      if(req.query.cduedate && req.query.duedate) {
        filterQuery.push(`duedate = '${req.query.duedate}'`)
        isFilter = true;
      }

      if(req.query.cestimatedtime && req.query.estimatedtime) {
        filterQuery.push(`estimatedtime = '${req.query.estimatedtime}'`)
        isFilter = true;
      }

      if(req.query.codone && req.query.done) {
        filterQuery.push(`startdate = '${req.query.done}'`)
        isFilter = true;
      }

      if(isFilter){
        filterQuery.push(`projectid = '${req.params.id}'`) //karena kita akan push ke project juga
        sqlQuery += ` WHERE ${filterQuery.join(" AND ")}`
      }else {
        sqlQuery += ` WHERE projectid = '${req.params.id}'`;
      }

      //count records
      db.query(sqlQuery, function(err, countData) {

        //pagination
        let url = (req.url == "/") ? "/?page=1" : req.url;
        let page = Number(req.query.page) || 1;
        if(url.indexOf('&submit=') != -1){
          page = 1;
          url = url.replace('&submit=', '')
          url = url.split("/?page=", 1)
        }

        let limit = 3;
        let offset = (page-1) * 3;
        let total = countData.rows[0].total;
        let pages = (total == 0) ? 1 : Math.ceil(total/limit);
        let pagination = {page: page, limit: limit, offset: offset, pages: pages, total: total, url: url}

        sqlQuery = `SELECT * FROM issues`

        if(isFilter) {
          filterQuery.push(`projectid = ${req.params.id}`)
          sqlQuery += ` WHERE ${filterQuery.join(" AND ")}`
        } else {
          sqlQuery += ` WHERE projectid = ${req.params.id}`;
        }

        sqlQuery +=  ` ORDER BY issueid ASC LIMIT ${limit} OFFSET ${offset}`

        // select with pagination
        db.query(sqlQuery, function (err, issuesData){
          console.log('aaaaaaaaaaaaa', issuesData);
          res.render('projects/details/issues', {
            title: 'Get Issue Information',
            page: "project",
            idURL: req.params.id,
            rows: countData.rows,
            membersData: membersData.rows,
            issueData: issuesData.rows,
            pagination: pagination,
            issuecolumns: JSON.parse(req.session.user.issuecolumns),
            query: req.query,
            user:req.session.user,
            cekRole
          });
        });
      });
    });
  });

  //---------------------------------------------------------------//
  router.post('/details/:id/issues/issuescoloumns', userChecker, function(req, res) {
    let issuecolumns = JSON.stringify(req.body)
    req.session.user.issuecolumns = issuecolumns;
    let sqlQuery = `UPDATE users SET issuecolumns = $1 WHERE userid = ${req.session.user.userid}, [issuecolumns]` ; //for updating data in membercolumns
    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err);
      }
      res.redirect(`/projects/details/${req.params.id}/issues`);
    });
  });

  //---------------------------------------------------------------//
  router.get('/details/:id/issues/addissues', userChecker, function (req, res) {
    let query = `SELECT users.userid, users.firstname ||' '|| users.lastname as name from users, members WHERE users.userid = members.userid AND members.projectid = ${req.params.id}`
    db.query(query, function (err, membersData ) {
      if (err){
        console.log(err);
        return res.send(err);
      }
      res.render('projects/details/addissues', {
        title: 'Add new issues',
        page: 'project',
        query: req.query,
        idURL: req.params.id,
        membersData: membersData.rows,
        user: req.session.user
      })
    })
  })

  //---------------------------------------------------------------//
  router.post('/details/:id/issues/addissues', userChecker, function (req, res) {

    let query = `INSERT INTO issues(projectid, tracker, subject, description, status, priority, assignee, startdate, duedate, estimatedtime, done, files)
    VALUES (${req.params.id}, '${req.body.tracker}', '${req.body.subject}', '${req.body.description}', '${req.body.status}', '${req.body.priority}', ${req.body.assignee}, '${req.body.startdate}', '${req.body.duedate}', ${req.body.estimatedtime}, ${req.body.done}, '{}')`
    db.query(query, function (err) {
      if (err){
        console.log(err);
        return res.send(err);
      }
    })

    //for writing the activity
    let activityTitle = `${req.body.subject} ${req.body.tracker} #${req.params.id} (${req.body.status})`
    let activityDescription = "Add New Issue"
    let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
    let activityDateNow = `${moment().format("YYYY-MM-DD")}`
    let activityHour = `${moment().format("HH:mm")}`
    let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
    VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

    db.query(sqlQuery, function(err) {
      if(err) {
        console.error(err);
      }

      res.redirect(`/projects/details/${req.params.id}/issues`)
    })
  })

  //---------------------------------------------------------------//
  router.get('/details/:id/issues/delete/:issueid', userChecker, function (req, res) {
    //for giving authentication

    let sqlQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`;
    db.query(sqlQuery, function(err, issuesData) { //query untuk menampilkan semua issues
      if(err) {
        console.error(err);
      }

      //for getting data of subject, tracker, status
      let subject = issuesData.rows[0].subject
      let tracker = issuesData.rows[0].tracker
      let status = issuesData.rows[0].status

      //for writing the activity
      let activityTitle = `${subject} ${tracker} #${req.params.id} (${status})`
      let activityDescription = "Delete Issues"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityDateNow = `${moment().format("YYYY-MM-DD")}`
      let activityHour = `${moment().format("HH:mm")}`
      let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
      VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }
      })

      let query = `DELETE FROM issues WHERE issueid = ${req.params.issueid}`
      db.query(query, function (err) {
        res.redirect(`/projects/details/${req.params.id}/issues`)
      })
    })
  })

  //---------------------------------------------------------------//
  router.get('/details/:id/issues/editissues/:issueid', userChecker, function (req, res) {
    let issueQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`
    db.query(issueQuery, function (err, issuesData) {
      if (err){
        console.log(err);
        return res.send(err);
      }

      let sqlQuery = `SELECT members.membersid, users.userid, users.firstname || ' ' || users.lastname AS name, users.role FROM members
      JOIN users ON members.userid=users.userid
      JOIN projects ON members.projectid=projects.projectid
      WHERE projects.projectid = ${req.params.id};`
      console.log('ini data members;', sqlQuery );
      db.query(sqlQuery, function (err, membersData) {
        if(err){
          console.log(err);
        }
        let query = `SELECT firstname, lastname from users where usersid = ${issuesData.rows[0].assignee}`
        db.query(query, function (err, user) {

        })
        console.log('ini data members;', membersData );
        res.render('projects/details/editissues', {
          title: 'Edit Issues',
          page: 'project',
          query: req.query,
          idURL: req.params.id,
          membersData: membersData.rows,
          moment: moment,
          issuesData: issuesData.rows[0],
          user: req.session.user
        })
      })
    })
  })

  //---------------------------------------------------------------//
  router.post('/details/:id/issues/editissues/:issueid', userChecker, function (req, res) {
    let query = `UPDATE issues SET tracker = '${req.body.tracker}', subject = '${req.body.subject}', description = '${req.body.description}', status = '${req.body.status}', priority = '${req.body.priority}', assignee = ${req.body.assignee}, startdate = '${req.body.startdate}', duedate = '${req.body.duedate}', estimatedtime = '${req.body.estimatedtime}', done = ${req.body.done},
    spenttime = ${req.body.spenttime}, targetversion = ${req.body.targetversion}, author = ${req.body.author}, createddate = '${req.body.createddate}', updateddate = '${req.body.updateddate}', closeddate = '${req.body.closeddate}', files = '${req.body.files}' WHERE issueid = ${req.params.issueid}`;

    db.query(query, function (err, updateIssue) {
      if (err){
        console.log(err);
        return res.send(err);
      }

      //for writing the activity
      let activityTitle = `${req.body.subject} ${req.body.tracker} #${req.params.id} (${req.body.status})`
      let activityDescription = "Edit Issues"
      let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
      let activityDateNow = `${moment().format("YYYY-MM-DD")}`
      let activityHour = `${moment().format("HH:mm")}`
      let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
      VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }
        res.redirect(`/projects/details/${req.params.id}/issues`)
      })
    })
  })

  //---------------------------------------------------------------//
  router.get('/details/:id/issues/uploadfiles/:issueid', userChecker, function (req, res) {
    res.render('projects/details/uploadfile', {
      title: 'Upload Files To Issues',
      page: 'projects',
      idURL: req.params.id,
      issueidURL: req.params.issueid,
      user: req.session.user
    });
  });

  //---------------------------------------------------------------//
  router.post('/details/:id/issues/uploadfiles/:issueid', function (req, res) {
    if (!req.files){
      return res.status(400).send('No files were uploaded.');
    }

    let filename = crypto.randomBytes(5).toString('hex');
    let uploadfile = req.files.uploadfile;

    // cat.jpg => uploadfile.name
    // 'cat.jpg'.split('.')
    // ['cat', 'jpg']
    // jpg => extension

    let extension = uploadfile.name.split('.').pop();
    let sqlQuery = ''

    uploadfile.mv(`${__dirname}/../public/images/${filename}.${extension}`, function(err) {
      if (err){
        return res.status(500).send(err);
      }

      sqlQuery = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`;
      db.query(sqlQuery, function(err, issuesData) { //query untuk menampilkan semua issues
        if(err) {
          console.error(err);
        }

        // {} <= JSON.parse('{}')
        // '{namagambar: namagambar.jpg}'
        // JSON.parse('{namagambar: namagambar.jpg}') => {namagambar: namagambar.jpg}
        // fileIssueData // {namagambar: namagambar.jpg}
        // filename = firman //hasilcrypto
        // extension = .jpg
        //
        // fileIssueData['filename'] = filename.jpg
        // {namagambar: namagambar.jpg, firman: firman.jpg}

        //awal nya string di ubah ke object dlu (parse): lalu ...
        let fileIssueData = JSON.parse(issuesData.rows[0].files);
        fileIssueData[filename] = `${filename}.${extension}`

        //....hasilnya akan di ubah ke string (stringify):
        let insertedFile = JSON.stringify(fileIssueData);

        // lalu hasilnya akan di masukkan kedalam database
        sqlQuery = `UPDATE issues SET files = '${insertedFile}' WHERE issueid = ${req.params.issueid}`;
        db.query(sqlQuery, function(err) { //query untuk update files to database
          if(err) {
            console.error(err);
          }

          //for getting data of subject, tracker, status
          let subject = issuesData.rows[0].subject
          let tracker = issuesData.rows[0].tracker
          let status = issuesData.rows[0].status

          //for writing the activity
          let activityTitle = `${subject} ${tracker} #${req.params.id} (${status})`
          let activityDescription = "Uploaded Files"
          let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
          let activityDateNow = `${moment().format("YYYY-MM-DD")}`
          let activityHour = `${moment().format("HH:mm")}`
          let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
          VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

          db.query(sqlQuery, function(err) {
            if(err) {
              console.error(err);
            }
            res.redirect(`/projects/details/${req.params.id}/issues`)
          });
        });
      });
    });
  });

  //---------------------------------------------------------------//
  router.get('/details/:id/issues/editissues/:issueid/deleteimage/:imagename', userChecker, function (req, res) {
    let query = `SELECT * FROM issues WHERE issueid = ${req.params.issueid}`;
    let fileNameNoExt = req.params.imagename.replace(/\..+$/, '')

    db.query(query, function(err, issueData) {
      if(err) {
        console.error(err);
      }

      let fileIssueData = JSON.parse(issueData.rows[0].files);
      delete fileIssueData[fileNameNoExt]
      let insertedFile = JSON.stringify(fileIssueData);

      console.log('12345', issueData);
      let sqlQuery = `UPDATE issues SET files = '${insertedFile}' WHERE issueid = ${req.params.issueid}`
      db.query(sqlQuery, function(err) {
        if(err) {
          console.error(err);
        }

        //for getting data of subject, tracker, status
        let subject = issueData.rows[0].subject
        let tracker = issueData.rows[0].tracker
        let status = issueData.rows[0].status
        let projectid = issueData.rows[0].projectid

        //for writing the activity
        let activityTitle = `${subject} ${tracker} #${projectid} (${status})`
        let activityDescription = "Delete Images"
        let activityAuthor = `${req.session.user.firstname} ${req.session.user.lastname}`
        let activityDateNow = `${moment().format("YYYY-MM-DD")}`
        let activityHour = `${moment().format("HH:mm")}`
        let sqlQuery = `INSERT INTO activity(time, title, description, author, projectid, date, jam)
        VALUES(NOW(), '${activityTitle}', '${activityDescription}', '${activityAuthor}',  ${req.params.id}, '${activityDateNow}', '${activityHour}')`

        db.query(sqlQuery, function(err) {
          if(err) {
            console.error(err);
          }

          res.redirect(`/projects/details/${req.params.id}/issues/editissues/${req.params.issueid}`)
        })
      })
    })
  })

  //---------------------------------------------------------------//
  router.get('/details/:id/activity', userChecker, function (req, res) {
    let CurrentDate = `${moment().format('YYYY-MM-DD')}` //to get now date
    let AWeekAgo = `${moment().subtract(7, 'days').format('YYYY-MM-DD')}` // to get now date - (minus) 7 date after now (date)
    let sqlQuery = `SELECT * FROM activity WHERE projectid = ${req.params.id} AND date BETWEEN '${AWeekAgo}' AND '${CurrentDate}'`

    db.query(sqlQuery, function(err, data) {
      let activityData = data.rows;
      let dateViewData = [ [,], [,], [,], [,], [,], [,], [,] ]; //cause data have 7 array
      for(let x = 0; x< 7; x++) {
        dateViewData[x][0] = moment().subtract(x, 'days').format('YYYY-MM-DD');
        console.log('aaaaa',dateViewData[x][0]);
        dateViewData[x][1] = moment(dateViewData[x][0], 'YYYY-MM-DD').format('dddd, MMMM D, YYYY')

        dateViewData[x].push(activityData.filter(function(item){
          return moment(item.date).format('YYYY-MM-DD') === dateViewData[x][0]
        }));
      }
      res.render('projects/details/activity', {
        title: 'Track your Activity',
        page: "project",
        user:req.session.user,
        date: {today: moment().format('DD/MM/YYYY'),
        weekAgo: moment().subtract('days', 7).format('DD/MM/YYYY')},
        logDate: dateViewData,
        idURL: req.params.id
      });
    })
  })



  return router;
}
