/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true, strict:true */
/*global  Backbone, Skeletor, _, jQuery, Rollcall, google, Paho */

(function() {
  "use strict";
  var Skeletor = this.Skeletor || {};
  this.Skeletor.Mobile = this.Skeletor.Mobile || new Skeletor.App();
  var Model = this.Skeletor.Model;
  Skeletor.Model = Model;
  var app = this.Skeletor.Mobile;


  app.config = null;
  app.requiredConfig = {
    drowsy: {
      url: 'string',
      db: 'string',
      username: 'string',
      password: 'string'
    },
    wakeful: {
      url: 'string'
    },
    mqtt: {
      url: 'string',
      ws_port: 'number'
    },
    login_picker:'boolean',
    runs:'object'
  };

  var DATABASE = null;

  //app.mqtt = null;
  app.rollcall = null;
  app.runId = null;
  app.runState = null;
  app.users = null;
  app.username = null;

  app.newProjectView = null;
  app.proposalsView = null;
  app.chiTestView = null;
  app.notesReadView = null;
  app.notesWriteView = null;
  app.relationshipsReadView = null;
  app.relationshipsWriteView = null;
  app.projectNewPosterView = null;
  app.reviewsView = null;
  app.reviewDetailsView = null;

  app.keyCount = 0;
  app.autoSaveTimer = window.setTimeout(function() { } ,10);

  // put this in mongo at some point (and add to readme)
  app.noteTypes = {
    "Note Type": [],
    "Species": ["We observed that...","We wonder if...","It seems important that..."],
    "Relationships": ["We observed that...","We wonder about the connection between...","Something that doesn't make sense is..."],
    "Habitats": ["We observed that...","We wonder what would happen if...","Something that we still need to find out is..."],
    "Real-world Connections": ["A real-world situation similar to this is...","This reminds me of...","This could help us understand..."],
    "Big Idea": ["One idea we need to focus on as a class is..."],
  };

  app.init = function() {
    /* CONFIG */
    app.loadConfig('../config.json');
    app.verifyConfig(app.config, app.requiredConfig);

    // Adding BasicAuth to the XHR header in order to authenticate with drowsy database
    // this is not really big security but a start
    var basicAuthHash = btoa(app.config.drowsy.username + ':' + app.config.drowsy.password);
    Backbone.$.ajaxSetup({
      beforeSend: function(xhr) {
        return xhr.setRequestHeader('Authorization',
            // 'Basic ' + btoa(username + ':' + password));
            'Basic ' + basicAuthHash);
      }
    });

    // hide all rows initially
    app.hideAllContainers();

    app.handleLogin();
  };

  app.handleLogin = function () {
    if (jQuery.url().param('runId') && jQuery.url().param('username')) {
      console.log ("URL parameter correct :)");
      app.runId = jQuery.url().param('runId');
      app.username = jQuery.url().param('username');
    } else {
      // retrieve user name from cookie if possible otherwise ask user to choose name
      app.runId = jQuery.cookie('brainstorm_mobile_runId');
      app.username = jQuery.cookie('brainstorm_mobile_username');
    }

    if (app.username && app.runId) {
      // We have a user in cookies so we show stuff
      console.log('We found user: '+app.username);

      // this needs runId
      setDatabaseAndRollcallCollection();

      // make sure the app.users collection is always filled
      app.rollcall.usersWithTags([app.runId])
      .done(function (usersInRun) {
        console.log(usersInRun);

        if (usersInRun && usersInRun.length > 0) {
          app.users = usersInRun;

          // sort the collection by username
          app.users.comparator = function(model) {
            return model.get('username');
          };
          app.users.sort();

          var currentUser = app.users.findWhere({username: app.username});

          if (currentUser) {
            jQuery('.username-display a').text(app.runId+"'s class - "+currentUser.get('display_name'));

            hideLogin();
            showUsername();

            app.setup();
          } else {
            console.log('User '+usersInRun+' not found in run '+app.runId+'. Show login picker!');
            logoutUser();
          }
        } else {
          console.log("Either run is wrong or run has no users. Wrong URL or Cookie? Show login");
          // fill modal dialog with user login buttons
          logoutUser();
        }
      });
    } else {
      console.log('No user or run found so prompt for username and runId');
      hideUsername();
      // fill modal dialog with user login buttons
      if (app.config.login_picker) {
        hideLogin();
        showRunPicker();
      } else {
        showLogin();
        hideUserLoginPicker();
      }
    }

    // click listener that sets username
    jQuery('#login-button').click(function() {
      app.loginUser(jQuery('#username').val());
      // prevent bubbling events that lead to reload
      return false;
    });
  };

  app.setup = function() {
    Skeletor.Model.init(app.config.drowsy.url, DATABASE)
    .then(function () {
      console.log('Model initialized - now waking up');
      return Skeletor.Model.wake(app.config.wakeful.url);
    })
    .then(function() {
      // run state used for pausing/locking the tablet
      console.log('State model initialized - now waking up');
      app.runState = Skeletor.getState('RUN');
      app.runState.wake(app.config.wakeful.url);
      app.runState.on('change', app.reflectRunState);
    })
    .then(function() {
      // TODO - add me to config.json
      //app.mqtt = connect(app.config.mqtt.url, app.config.mqtt.ws_port, generateRandomClientId());
    })
    .done(function () {
      ready();
      console.log('Models are awake - now calling ready...');
    });
  };

  var ready = function() {
    setUpUI();
    setUpClickListeners();
    wireUpViews();

    // decide on which screens to show/hide
    app.hideAllContainers();

    app.reflectRunState();
  };

  var setUpUI = function() {
    /* MISC */
    jQuery().toastmessage({
      position : 'middle-center'
    });

    jQuery('.brand').text("Wallcology 2015");
  };

  var setUpClickListeners = function () {
    // click listener that logs user out
    jQuery('#logout-user').click(function() {
      logoutUser();
    });

    // this is a or binding to both classes
    jQuery('.top-nav-btn, .todo-btn').click(function() {
      if (app.username) {
        jQuery('.top-nav-btn').removeClass('active');     // unmark all nav items
        // app.hideAllContainers();
        // if (jQuery(this).hasClass('goto-proposal-btn')) {
        //   jQuery('#proposal-nav-btn').addClass('active');
        //   jQuery('#proposal-screen').removeClass('hidden');
        //   app.proposalsView.render();
        // }
        if (jQuery(this).hasClass('goto-notes-btn')) {
          app.hideAllContainers();
          jQuery('#notes-nav-btn').addClass('active');
          jQuery('#notes-read-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-relationships-btn')) {
          jQuery().toastmessage('showWarningToast', "Not yet, kids!");
          // app.hideAllContainers();
          // jQuery('#relationships-nav-btn').addClass('active');
          // jQuery('#relationships-read-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-populations-btn')) {
          jQuery().toastmessage('showWarningToast', "Not yet, kids!");
          // jQuery('#populations-nav-btn').addClass('active');
          // jQuery('#populations-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-investigations-btn')) {
          jQuery().toastmessage('showWarningToast', "Not yet, kids!");
          // jQuery('#investigations-nav-btn').addClass('active');
          // jQuery('#investigations-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-chi-test-btn')) {
          jQuery('#chi-test-nav-btn').addClass('active');
          jQuery('#chi-test-screen').removeClass('hidden');
        }
        else {
          console.log('ERROR: unknown nav button');
        }
      }
    });
  };

  var wireUpViews = function() {
    /* ======================================================
     * Setting up the Backbone Views to render data
     * coming from Collections and Models.
     * This also takes care of making the nav items clickable,
     * so these can only be called when everything is set up
     * ======================================================
     */

     if (app.notesReadView === null) {
       app.notesReadView = new app.View.NotesReadView({
         el: '#notes-read-screen',
         collection: Skeletor.Model.awake.notes
       });
       app.notesReadView.render();
     }

     // if (app.notesWriteView === null) {
     //   app.notesWriteView = new app.View.NotesWriteView({
     //     el: '#notes-write-screen',
     //     collection: Skeletor.Model.awake.notes
     //   });
     // }

     // if (app.relationshipsReadView === null) {
     //   app.relationshipsReadView = new app.View.RelationshipsReadView({
     //     el: '#relationships-read-screen',
     //     collection: Skeletor.Model.awake.relationships
     //   });
     //   app.relationshipsReadView.render();
     // }

     // if (app.relationshipsWriteView === null) {
     //   app.relationshipsWriteView = new app.View.RelationshipsWriteView({
     //     el: '#relationships-write-screen',
     //     collection: Skeletor.Model.awake.relationships
     //   });
     // }



     // if (app.newProjectView === null) {
     //   app.newProjectView = new app.View.NewProjectView({
     //     el: '#new-project-screen',
     //     collection: Skeletor.Model.awake.projects
     //   });
     // }

     // if (app.proposalsView === null) {
     //   app.proposalsView = new app.View.ProposalsView({
     //     el: '#proposal-screen',
     //     collection: Skeletor.Model.awake.projects
     //   });
     // }

     if (app.projectNewPosterView === null) {
       app.projectNewPosterView = new app.View.ProjectNewPosterView({
         el: '#project-new-poster-screen'
       });
     }

    if (app.reviewsView === null) {
      app.reviewsView = new app.View.ReviewsView({
        el: '#review-overview-screen',
        collection: Skeletor.Model.awake.projects
      });
    }

    // should this just be instantiated in the reviewsView?
    if (app.reviewDetailsView === null) {
      app.reviewDetailsView = new app.View.ReviewDetailsView({
        el: '#review-details-screen'
      });
    }
  };


  //*************** HELPER FUNCTIONS ***************//

  app.photoOrVideo = function(url) {
    var type = null;

    var extension = app.parseExtension(url);
    if (extension === "jpg" || extension === "gif" || extension === "jpeg" || extension === "png") {
      type = "photo";
    } else if (extension === "mp4" || extension === "m4v" || extension === "mov") {
      type = "video";
    } else {
      type = "unknown";
    }

    return type;
  };

  app.parseExtension = function(url) {
    //url.split('.').pop().toLowerCase();
    return url.substr(url.lastIndexOf('.') + 1).toLowerCase();
  };

  var idToTimestamp = function(id) {
    var timestamp = id.substring(0,8);
    var seconds = parseInt(timestamp, 16);
    return seconds;
  };

  app.convertStringArrayToIntArray = function(arr) {
    var result = arr.map(function (x) {
      return parseInt(x, 10);
    });
    return result;
  };

  // wrappers for the species selector polymer component - spending so much time on this!
  app.getSelectorValue = function(view, kind) {
    var selectorValue;

    // if (kind === "habitat") {
    //   selectorValue = _.clone(document.querySelector(view+' .ws').currentToggle);
    //   // since items is extremely redundant and just clutters things up
    //   delete selectorValue.items;
    // } else if (kind === "species") {
    //   selectorValue = document.querySelector(view+' .ws').selectedItems;
    // } else {
    //   throw "Error returning selector type";
    // }

    return selectorValue;
  };

  app.setSelectorValues = function(view, habitatIndex, speciesIndexArray) {
    // these will be undefined if nothing is selected from habitat/species
    if (typeof habitatIndex !== "undefined" && typeof speciesIndexArray !== "undefined") {
      document.querySelector(view+' .ws').switchToggleAndButtonSelectors(habitatIndex, app.convertStringArrayToIntArray(speciesIndexArray));
    }
  };

  app.resetSelectorValue = function(view) {
    document.querySelector(view+' .ws').switchToggleAndButtonSelectors(4, []);
    //document.querySelector(view+' .ws').switchToggleAndButtonSelectors(-1, []);
    // TODO! What can we do for this - hope to convince them to not remove Habitat ?    or else this needs an all
  };

  //TODO - parameterize all of this!
  // var connect = function(host, port, clientId) {
  //   var intervalTime = 10000;
  //   // Create client
  //   var client = new Paho.MQTT.Client(host, Number(port), clientId);
  //   // set connect interval to 10s
  //   var connectTimer = setTimeout(tryConnect, intervalTime);
  //   // var reconnectTimer = null;

  //   // Register callback for connection lost
  //   client.onConnectionLost = function(responseObject) {
  //     console.log("Connection lost: " + responseObject.errorMessage);
  //     console.log("Trying to reconnect ...");

  //     // set reconnect interval
  //     connectTimer = setTimeout(tryConnect, intervalTime);
  //   };
  //   // Register callback for received message
  //   client.onMessageArrived = function(message) {
  //     // check if this is a delete msg, otherwise ignore it (for now)
  //     //var jsonMsg = JSON.parse(message.payloadString);
  //     console.log("Heard a message...");
  //   };
  //   // Connect
  //   function tryConnect() {
  //     // Connect
  //     client.connect({
  //       timeout: 90,
  //       keepAliveInterval: 30,
  //       onSuccess: function() {
  //         // abortInterval();
  //         var receiveChannel = "IAMPOSTEROUT";
  //         console.log("Connected to channel: " + receiveChannel);
  //         client.subscribe(receiveChannel, {qos: 0});
  //       },
  //       onFailure: function (e) {
  //         // abortInterval();
  //         // We tried to connect and failed. We should try again but have a pause inbetween
  //         console.error('Reconnect to MQTT client failed: '+e.errorCode+' - '+e.errorMessage);
  //         jQuery().toastmessage('showErrorToast', "MQTT failure: Check WiFi and reload browser");
  //         // grow interval value to lower frequency
  //         intervalTime += 2000;
  //         connectTimer = setTimeout(tryConnect, intervalTime);
  //       }
  //     });
  //   }

  //   function abortInterval() { // to be called when you want to stop the timer
  //     clearTimeout(connectTimer);
  //     // clearInterval(reconnectTimer);
  //   }

  //   // client.connect({
  //   //   timeout: 90,
  //   //   keepAliveInterval: 30,
  //   //   onSuccess: function() {
  //   //     var receiveChannel = "IAMPOSTEROUT";
  //   //     console.log("Connected to channel: " + receiveChannel);
  //   //     client.subscribe(receiveChannel, {qos: 0});
  //   //   },
  //   //   onFailure: function (e) {
  //   //     // We tried to connect and failed. We should try again but have a pause inbetween
  //   //     console.error('Reconnect to MQTT client failed: '+e.errorCode+' - '+e.errorMessage);
  //   //     jQuery().toastmessage('showErrorToast', "MQTT failure: Check WiFi and reload browser");
  //   //   }
  //   // });
  //   client.publish = function(channel, message) {
  //     var m = new Paho.MQTT.Message(message);
  //     m.destinationName = channel;
  //     try {
  //       // throws an error if mqtt client is disconnected
  //       // https://www.eclipse.org/paho/files/jsdoc/symbols/Paho.MQTT.Client.html#send
  //       client.send(m);
  //     } catch (e) {
  //       console.error('Problem sending MQTT message: ' + e.message + '+++++++' + e.name);
  //       jQuery().toastmessage('showErrorToast', "MQTT failure: Logout of your poster app and reload browser!");
  //     }
  //   };
  //   return client;
  // };

  var generateRandomClientId = function() {
    var length = 22;
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = '';
    for (var i = length; i > 0; --i) {
      result += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return result;
  };

  //*************** LOGIN FUNCTIONS ***************//

  app.loginUser = function (username) {
    // retrieve user with given username
    app.rollcall.user(username)
    .done(function (user) {
      if (user) {
        console.log(user.toJSON());

        app.username = user.get('username');

        jQuery.cookie('brainstorm_mobile_username', app.username, { expires: 1, path: '/' });
        jQuery('.username-display a').text(app.runId+"'s class - "+app.username);

        hideLogin();
        hideUserLoginPicker();
        showUsername();

        app.setup();
      } else {
        console.log('User '+username+' not found!');
        if (confirm('User '+username+' not found! Do you want to create the user to continue?')) {
            // Create user and continue!
            console.log('Create user and continue!');
        } else {
            // Do nothing!
            console.log('No user logged in!');
        }
      }
    });
  };

  var logoutUser = function () {
    jQuery.removeCookie('brainstorm_mobile_username',  { path: '/' });
    jQuery.removeCookie('brainstorm_mobile_runId',  { path: '/' });

    // to make reload not log us in again after logout is called we need to remove URL parameters
    if (window.location.search && window.location.search !== "") {
      var reloadUrl = window.location.origin + window.location.pathname;
      window.location.replace(reloadUrl);
    } else {
      window.location.reload();
    }
    return true;
  };

  var showLogin = function () {
    jQuery('#login-button').removeAttr('disabled');
    jQuery('#username').removeAttr('disabled');
  };

  var hideLogin = function () {
    jQuery('#login-button').attr('disabled','disabled');
    jQuery('#username').attr('disabled','disabled');
  };

  var hideUserLoginPicker = function () {
    // hide modal dialog
    jQuery('#login-picker').modal('hide');
  };

  var showUsername = function () {
    jQuery('.username-display').removeClass('hidden');
  };

  var hideUsername = function() {
    jQuery('.username-display').addClass('hidden');
  };

  var showRunPicker = function(runs) {
    jQuery('.login-buttons').html(''); //clear the house
    console.log(app.config.runs);

    // change header
    jQuery('#login-picker .modal-header h3').text("Select your teacher's name");

    _.each(app.config.runs, function(run) {
      var button = jQuery('<button class="btn btn-default btn-base login-button">');
      button.val(run);
      button.text(run);
      jQuery('.login-buttons').append(button);
    });

    // register click listeners
    jQuery('.login-button').click(function() {
      app.runId = jQuery(this).val();
      setDatabaseAndRollcallCollection();

      jQuery.cookie('brainstorm_mobile_runId', app.runId, { expires: 1, path: '/' });
      // jQuery('#login-picker').modal("hide");
      showUserLoginPicker(app.runId);
    });

    // show modal dialog
    jQuery('#login-picker').modal({keyboard: false, backdrop: 'static'});
  };

  var showUserLoginPicker = function(runId) {
    // change header
    jQuery('#login-picker .modal-header h3').text('Please login with your username');

    // retrieve all users that have runId
    // TODO: now that the users collection is within a run... why are the users being tagged with a run? Superfluous...
    app.rollcall.usersWithTags([runId])
    .done(function (availableUsers) {
      jQuery('.login-buttons').html(''); //clear the house
      app.users = availableUsers;

      if (app.users.length > 0) {
        // sort the collection by username
        app.users.comparator = function(model) {
          return model.get('display_name');
        };
        app.users.sort();

        app.users.each(function(user) {
          var button = jQuery('<button class="btn btn-default btn-base login-button">');
          button.val(user.get('username'));
          button.text(user.get('display_name'));
          jQuery('.login-buttons').append(button);
        });

        // register click listeners
        jQuery('.login-button').click(function() {
          var clickedUserName = jQuery(this).val();
          app.loginUser(clickedUserName);
        });
      } else {
        console.warn('Users collection is empty! Check database: '+DATABASE);
      }
    });
  };

  var setDatabaseAndRollcallCollection = function() {
    // set both of these globals. This function called from multiple places
    DATABASE = app.config.drowsy.db+'-'+app.runId;
    if (app.rollcall === null) {
      app.rollcall = new Rollcall(app.config.drowsy.url, DATABASE);
    }
  };

  // WARNING: 'runstate' is a bit misleading, since this does more than run state now - this might want to be multiple functions
  // takes an optional parameter ("new" or an object id), if not being used with
  // this desperately needs to be broken up into several functions
  app.reflectRunState = function() {
    // checking paused status
    if (app.runState.get('paused') === true) {
      console.log('Locking screen...');
      jQuery('#lock-screen').removeClass('hidden');
      jQuery('.user-screen').addClass('hidden');
    } else if (app.runState.get('paused') === false) {
      jQuery('#lock-screen').addClass('hidden');
      jQuery('#todo-screen').removeClass('hidden');
    }
  };

  app.resetToSplashScreen = function() {
    app.hideAllContainers();
    jQuery('#proposal-nav-btn').addClass('active');
    jQuery('#todo-screen').removeClass('hidden');
  };

  app.hideAllContainers = function() {
    jQuery('.container-fluid').each(function (){
      jQuery(this).addClass('hidden');
    });
  };

  app.autoSave = function(model, inputKey, inputValue, instantSave, nested) {
    app.keyCount++;
    if (instantSave || app.keyCount > 9) {
      console.log('Autosaved...');
      // TODO: clean this out if nested isn't needed!
      if (nested === "proposal") {
        // think about using _.clone here (eg http://www.crittercism.com/blog/nested-attributes-in-backbone-js-models)
        var nestedObj = model.get(nested);
        nestedObj[inputKey] = inputValue;
        model.set(nested,nestedObj);
      } else {
        model.set(inputKey, inputValue);
      }
      model.save(null, {silent:true});
      app.keyCount = 0;
    }
  };

  app.clearAutoSaveTimer = function () {
    if (app.autoSaveTimer) {
      window.clearTimeout(app.autoSaveTimer);
    }
  };

  /**
    Function that is called on each keypress on username input field (in a form).
    If the 'return' key is pressed we call loginUser with the value of the input field.
    To avoid further bubbling, form submission and reload of page we have to return false.
    See also: http://stackoverflow.com/questions/905222/enter-key-press-event-in-javascript
  **/
  app.interceptKeypress = function(e) {
    if (e.which === 13 || e.keyCode === 13) {
      app.loginUser(jQuery('#username').val());
      return false;
    }
  };

  app.turnUrlsToLinks = function(text) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    var urlText = text.replace(urlRegex, '<a href="$1">$1</a>');
    return urlText;
  };









  /********************* POSSIBLY USEFUL LATER ***********************/

  var showProjectPicker = function() {
    // get collection of projects?
    jQuery('.projects-holder').html('');

    // get a list of projects that user is involved with
    var myProjectsList = Skeletor.Model.awake.projects.filter(function(proj) {
      return ( _.contains(proj.get('associated_users'), app.username) );
    });

    // sort list by oldest to newest (note append below)
    myProjectsList.comparator = function(model) {
      return model.get('created_at');
    };

    // create the html for each of these projects
    _.each(myProjectsList, function(project) {
      var button = jQuery('<button class="btn project-button btn-default btn-base">');
      button.val(project.get('_id'));
      button.text("Work on " + project.get('name'));
      jQuery('.projects-holder').append(button);
    });

    // set up the click listeners for the projects
    jQuery('#project-picker button').click(function() {
      jQuery('#project-picker').modal('hide');
      if (jQuery(this).val() === "new") {
        setupProject("new");
      } else {
        // check if the state is paused and update screens accordingly - unhiding the start screen is now handled in reflectRunState
        setupProject(jQuery(this).val());
      }
      return false;
    });

    jQuery('#project-picker').modal({keyboard: false, backdrop: 'static'});
  };

  var setupProject = function(projectId) {
    var p = null;

    if (projectId === "new") {
      p = new Model.Project();
      // we're going to make an (admittedly feeble) attempt at avoiding collisions here. Project names get overwritten pretty quickly, in principle, but...
      var d = new Date();
      var projName = "untitled project #" + d.getSeconds() + d.getMilliseconds();
      p.set('name',projName);
      p.wake(app.config.wakeful.url);
      p.save();
      Skeletor.Model.awake.projects.add(p);
    } else {
      // resume the previous project
      p = Skeletor.Model.awake.projects.get(projectId);
    }

    app.project = p;
    app.project.wake(app.config.wakeful.url);

    // note that this is done again in newProjectView (think about making this awake?)
    //app.groupname = p.get('name');
    //jQuery('.username-display a').text(app.groupname);

    // Render here?
    app.notesReadView.render();

    //app.reflectRunState(projectId); ????
  };



  this.Skeletor = Skeletor;

}).call(this);
