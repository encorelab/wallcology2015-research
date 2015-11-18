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
  app.currentUser = null;
  app.habitats = null;

  app.notesReadView = null;
  app.notesWriteView = null;
  app.relationshipsReadView = null;
  app.relationshipsWriteView = null;
  app.habitatsView = null;
  app.investigationsReadView = null;
  app.investigationsWriteView = null;

  app.keyCount = 0;
  app.autoSaveTimer = window.setTimeout(function() { } ,10);

  // put this in mongo at some point (and add to readme)
  app.noteTypes = {
    "Note Type": [],
    "Species": ["We observed that...","We wonder if...","It seems important that..."],
    "Relationships": ["We observed that...","We wonder about the connection between...","Something that doesn't make sense is..."],
    "Habitats": ["We observed that...","We wonder what would happen if...","Something that we still need to find out is..."],
    "Populations": ["We have noticed that...","We wonder about the connection between...","This species population has changed..."],
    "Real-world Connections": ["A real-world situation similar to this is...","This reminds me of...","This could help us understand..."],
    "Big Idea": ["One idea we need to focus on as a class is..."]
  };

  // SELECTOR-RELATED STUFF FROM TOM
  app.images = [ {selected: 'https://ltg.cs.uic.edu/WC/icons/species_00.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_00_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_01.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_01_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_02.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_02_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_03.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_03_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_04.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_04_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_05.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_05_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_06.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_06_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_07.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_07_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_08.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_08_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_09.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_09_0.svg'},
          {selected: 'https://ltg.cs.uic.edu/WC/icons/species_10.svg',
             unselected: 'https://ltg.cs.uic.edu/WC/icons/species_10_0.svg'}
         ];

  // app.images = [ {selected: 'img/species_00.svg',
  //            unselected: 'img/species_00_0.svg'},
  //         {selected: 'img/species_01.svg',
  //            unselected: 'img/species_01_0.svg'},
  //         {selected: 'img/species_02.svg',
  //            unselected: 'img/species_02_0.svg'},
  //         {selected: 'img/species_03.svg',
  //            unselected: 'img/species_03_0.svg'},
  //         {selected: 'img/species_04.svg',
  //            unselected: 'img/species_04_0.svg'},
  //         {selected: 'img/species_05.svg',
  //            unselected: 'img/species_05_0.svg'},
  //         {selected: 'img/species_06.svg',
  //            unselected: 'img/species_06_0.svg'},
  //         {selected: 'img/species_07.svg',
  //            unselected: 'img/species_07_0.svg'},
  //         {selected: 'img/species_08.svg',
  //            unselected: 'img/species_08_0.svg'},
  //         {selected: 'img/species_09.svg',
  //            unselected: 'img/species_09_0.svg'},
  //         {selected: 'img/species_10.svg',
  //            unselected: 'img/species_10_0.svg'}
  //        ];

  app.state = [];
  app.numSelected = null;
  app.habitatSelectorType = null;
  app.fixedIndex = null;
  app.clearSelectionsOnHabitatChange = null;

  var MAX_SELECTABLE_NOTES = 11;
  var MAX_SELECTABLE_RELATIONSHIPS = 2;

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

          app.currentUser = app.users.findWhere({username: app.username});

          if (app.currentUser) {
            jQuery('.username-display a').text(app.runId+"'s class - "+app.currentUser.get('display_name'));

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
      app.habitats = Skeletor.Model.awake.habitats;
      // for first time setup
      if (!app.habitats || app.habitats.length < 4) {
        for (var i = 1; i < 5; i++) {
          var m = new Model.Habitat();
          m.set('number',i);
          m.set('name','Ecosystem '+i);
          m.wake(app.config.wakeful.url);
          m.save();
          app.habitats.add(m);
        }
      }
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
        if (jQuery(this).hasClass('goto-notes-btn')) {
          app.hideAllContainers();
          app.resetAllSelectors();
          jQuery('#notes-nav-btn').addClass('active');
          jQuery('#notes-read-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-relationships-btn')) {
          // jQuery().toastmessage('showWarningToast', "Not yet, kids!");
          app.hideAllContainers();
          app.resetAllSelectors();
          jQuery('#relationships-nav-btn').addClass('active');
          jQuery('#relationships-read-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-populations-btn')) {
          // jQuery().toastmessage('showWarningToast', "Not yet, kids!");
          app.hideAllContainers();
          app.resetAllSelectors();
          jQuery('#populations-nav-btn').addClass('active');
          jQuery('#populations-screen').removeClass('hidden');
        } else if (jQuery(this).hasClass('goto-investigations-btn')) {
          // jQuery().toastmessage('showWarningToast', "Not yet, kids!");
          if (app.currentUser.get('habitat_group') || app.currentUser.get('user_role') === "smartboard") {
            app.hideAllContainers();
            jQuery('#investigations-nav-btn').addClass('active');
            jQuery('#investigations-read-screen').removeClass('hidden');
          } else {
            jQuery().toastmessage('showWarningToast', "You have not been assigned to a habitat group yet");
          }
        } else if (jQuery(this).hasClass('goto-habitats-btn')) {
          if (app.currentUser.get('user_role') === "teacher") {
            app.hideAllContainers();
            jQuery('#habitats-nav-btn').addClass('active');
            jQuery('#habitats-screen').removeClass('hidden');
          } else {
            jQuery().toastmessage('showWarningToast', "Teachers only!");
          }
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

    // not sure this belongs here, but for now... also likely want to move this to the config. But will this code snippet even last more than a couple days?
    var className = '';
    if (Skeletor.Mobile.runId === "mike") {
      className = "Mike&place=to";
    } else if (Skeletor.Mobile.runId === "ben") {
      className = "Ben&place=to";
    } else {
      className = Skeletor.Mobile.runId;
    }
    // var url = 'https://ltg.evl.uic.edu:57881/wallcology/default/runs/population-history/index.html?broker=ltg.evl.uic.edu&app_id=wallcology&run_id=' + className;
    var url = 'https://ltg.evl.uic.edu:57881/wallcology/default/runs/population-history/index.html?broker=ltg.evl.uic.edu&app_id=wallcology&run_id='+className;
    jQuery('#population-history-container').attr('src',url);

    if (app.notesReadView === null) {
      app.notesReadView = new app.View.NotesReadView({
        el: '#notes-read-screen',
        collection: Skeletor.Model.awake.notes
      });
      app.drawHabitatSelector('A1234', 0, true, 'notes-read-screen');
      app.drawSelectorBar('notes-read-screen');

      app.notesReadView.render();
    }

    if (app.notesWriteView === null) {
    app.notesWriteView = new app.View.NotesWriteView({
      el: '#notes-write-screen',
      collection: Skeletor.Model.awake.notes
    });
    app.drawHabitatSelector('A1234', 0, true, 'notes-write-screen');
    app.drawSelectorBar('notes-write-screen');
    }

    if (app.relationshipsReadView === null) {
      app.relationshipsReadView = new app.View.RelationshipsReadView({
        el: '#relationships-read-screen',
        collection: Skeletor.Model.awake.relationships
      });
      app.drawHabitatSelector('A1234', 0, true, 'relationships-read-screen');
      app.drawSelectorBar('relationships-read-screen');

      app.relationshipsReadView.render();
    }

    if (app.relationshipsWriteView === null) {
      app.relationshipsWriteView = new app.View.RelationshipsWriteView({
        el: '#relationships-write-screen',
        collection: Skeletor.Model.awake.relationships
      });
      app.drawHabitatSelector('?1234', 0, true, 'relationships-write-screen');
      app.drawSelectorBar('relationships-write-screen');
    }

    if (app.habitatsView === null) {
      app.habitatsView = new app.View.HabitatsView({
        el: '#habitats-screen'
      });

      app.habitatsView.render();
    }

    if (app.investigationsReadView === null) {
      app.investigationsReadView = new app.View.InvestigationsReadView({
        el: '#investigations-read-screen',
        collection: Skeletor.Model.awake.investigations
      });

      app.investigationsReadView.render();
    }

    if (app.investigationsWriteView === null) {
      app.investigationsWriteView = new app.View.InvestigationsWriteView({
        el: '#investigations-write-screen',
        collection: Skeletor.Model.awake.investigations
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

  app.getSpeciesValues = function(view) {
    var selectorValues = [];

    _.each(app.state, function(value, i) {
      if (value === "selected") {
        selectorValues.push(i);
      }
    });

    return selectorValues;
  };

  app.getHabitatObject = function(view) {
    var habitatObj = {
      name: jQuery('#'+view+' .habitat-selector :selected').data('name'),
      index: jQuery('#'+view+' .habitat-selector :selected').data('index')
    };

    return habitatObj;
  };

  app.getSpeciesObjectsArray = function() {
    var speciesArr = [];

    _.each(app.state, function(value, i) {
      if (value === "selected") {
        speciesArr.push({"index": i});
      }
    });

    return speciesArr;
  };

  app.setHabitat = function(view, habitatIndex) {
    // these will be undefined if nothing is selected from habitat/species
    if (typeof habitatIndex !== "undefined") {
      // hack since All Habitat is getting set to index 4 and it's too late to change that
      if (habitatIndex === 4) {
        jQuery('#'+view+' .habitat-selector').val("A");
      } else {
        jQuery('#'+view+' .habitat-selector').val(habitatIndex);
      }
    }
  };

  app.setSpecies = function(speciesArray) {
    _.each(speciesArray, function(i) {
      app.state[i] = 'selected';
      select(i);
      app.numSelected++;
      updateImage(i);
    });
  };

  // NB: this is a little sketchy, relying on contains string...
  app.resetSelectorValue = function(view) {
    jQuery('.note-type-selector').val('Note Type');

    if (jQuery('#'+view+' .habitat-selector :contains("Habitat ?")').length) {
      jQuery('#'+view+' .habitat-selector').val("?");
    } else if (jQuery('#'+view+' .habitat-selector :contains("All Habitats")').length) {
      jQuery('#'+view+' .habitat-selector').val("A");
    } else {
      console.error("An issue with resetSelectorValue");
    }

    _.each(app.state, function(selected, i) {
      app.state[i] = 'unselected';
      updateImage(i);
    });
    app.numSelected = 0;
  };

  app.resetAllSelectors = function() {
    app.resetSelectorValue("notes-read-screen");
    app.resetSelectorValue("notes-write-screen");
    app.resetSelectorValue("relationships-read-screen");
    app.resetSelectorValue("relationships-write-screen");
  };

  app.drawHabitatSelector = function(h, f, c, view) {
    var habitatSelectorType = h;
    var fixedIndex = f; // 0,1,2,3
    app.clearSelectionsOnHabitatChange = c; // Boolean

    var el = '';
    el += '<select class="habitat-selector">';

    if (habitatSelectorType === '?1234') {
      el += '<option selected data-index="-1" data-name="Habitat ?" value="?">Habitat ?</option>';
    }
    if (habitatSelectorType === 'A1234') {
      el += '<option selected data-index="4" data-name="All Habitats" value="A">All Habitats</option>';
    }
    if (habitatSelectorType === 'fixed') {
      el += '<option selected data-index="'+fixedIndex+'" data-name="Habitat '+(fixedIndex+1)+'" value="' + fixedIndex + '">Habitat ' + (fixedIndex+1) + '</option>';
    } else {
      for (var i=0; i<4; i++) {
        el += '<option data-index="'+i+'" data-name="Habitat '+(i+1)+'" value="' + i + '">Habitat ' + (i+1) + '</option>';
      }
    }
    el += '</select>';
    jQuery('#'+view+' .species-selector-container').append(el);
    // if (habitatSelectorType === 'fixed') {
    //   habitatSelect(fixedIndex);
    // }
  };

  app.habitatSelectorChange = function(view) {
    if (app.clearSelectionsOnHabitatChange) {
      for (var i=0; i<app.state.length; i++) {
        if (app.state[i] === 'selected') {
          app.clickHandler(i, view);
        }
      }
    }
    var x = jQuery('#'+view+' .habitat-selector :selected');
    var s = jQuery('#'+view+' .habitat-selector :selected').data('index');
    if (app.habitatSelectorType === '?1234' && x.val() === '?') {
      x.remove();
    }
    //habitatSelect(x[x.selectedIndex].value);
  };

  app.drawSelectorBar = function(view) {
    for (var x=0; x<app.images.length; x++) {
      app.state[x] = 'unselected';
    }
    app.numSelected = 0;
    for (var i=0; i<app.state.length; i++) {
      jQuery('#'+view+' .species-selector-container').append('<img class="species-button species-'+i+'" data-species-index="'+i+'" src="' + app.images[i][app.state[i]] + '" width="60" height="60">');
    }
  };

  app.clickHandler = function(species, view) {
    var maxSelectable;
    if (view === "notes-read-screen" || view === "notes-write-screen") {
      maxSelectable = MAX_SELECTABLE_NOTES;
    } else if (view === "relationships-read-screen" || view === "relationships-write-screen") {
      maxSelectable = MAX_SELECTABLE_RELATIONSHIPS;
    } else {
      console.error("Unknown view passed into clickHandler");
    }

    var x = jQuery('#'+view+' .habitat-selector').val();
    if (x !== '?') {
      if (app.state[species] === 'selected') {
        app.state[species] = 'unselected';
        deSelect(species);
        app.numSelected--;
      } else {
        if (app.numSelected < maxSelectable) {
          app.state[species] = 'selected';
          select(species);
          app.numSelected++;
        }
      }
      updateImage(species);
    }
  };

  var updateImage = function(i) {
    jQuery('.species-'+i).attr('src', app.images[i][app.state[i]]);
  };

  function select (species) { }       // code for when a species is selected
  function deSelect (species) { }     // code for when a species is deselected
  //function habitatSelect(habitat) { }   // code for when a habitat is selected

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
        app.currentUser = app.users.findWhere({username: app.username});

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
    if (instantSave || app.keyCount > 20) {
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

  this.Skeletor = Skeletor;

}).call(this);
