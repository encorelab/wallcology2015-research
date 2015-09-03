/*jshint debug:true, noarg:true, noempty:true, eqeqeq:true, bitwise:true, undef:true, curly:true, browser: true, devel: true, jquery:true, strict:false */
/*global Backbone, _, jQuery, Sail, google */

(function() {
  "use strict";
  var Skeletor = this.Skeletor || {};
  this.Skeletor.Mobile = this.Skeletor.Mobile || {};
  var app = this.Skeletor.Mobile;
  var Model = this.Skeletor.Model;
  Skeletor.Model = Model;
  app.View = {};


  /**
    NewProjectView
  **/
  app.View.NewProjectView = Backbone.View.extend({

    initialize: function () {
      var view = this;
      console.log('Initializing NewProjectView...', view.el);
    },

    events: {
      'click #submit-partners-btn' : 'addPartnersToProject',
      'click .project-theme-button': 'addThemeToProject'
    },

    addPartnersToProject: function() {
      var view = this;

      // put all selecteds into the project
      var partners = [];
      _.each(jQuery('.selected'), function(b) {
        partners.push(jQuery(b).val());
      });
      app.project.set('associated_users',partners);
      app.project.save();

      // move to the next screen
      jQuery('#new-project-student-picker').addClass('hidden');
      jQuery('#new-project-theme-picker').removeClass('hidden');
    },

    addThemeToProject: function(ev) {
      var view = this;

      app.project.set('theme',jQuery(ev.target).val());
      app.project.save();

      jQuery().toastmessage('showSuccessToast', "You have created a new project!");

      // complete the newProject section and move to proposal section
      jQuery('#new-project-theme-picker').addClass('hidden');
      jQuery('#proposal-screen').removeClass('hidden');
      jQuery('#proposal-nav-btn').addClass('active');
    },

    render: function () {
      var view = this;
      console.log("Rendering NewProjectView...");

      // ADD THE USERS
      jQuery('.project-partner-holder').html('');
      if (app.users.length > 0) {
        // sort the collection by username
        app.users.comparator = function(model) {
          return model.get('display_name');
        };
        app.users.sort();

        app.users.each(function(user) {
          var button = jQuery('<button class="btn project-partner-button btn-default btn-base">');
          button.val(user.get('username'));
          button.text(user.get('display_name'));
          jQuery('.project-partner-holder').append(button);

          // add the logged in user to the project
          if (user.get('username') === app.username) {
            button.addClass('selected');
            button.addClass('disabled');
          }
        });

        //register click listeners
        jQuery('.project-partner-button').click(function() {
          jQuery(this).toggleClass('selected');
        });
      } else {
        console.warn('Users collection is empty!');
      }

      // ADD THE THEMES AKA TAGS
      jQuery('.project-theme-holder').html('');
      if (Skeletor.Model.awake.tags.length > 0) {
        Skeletor.Model.awake.tags.each(function(tag) {
          var button = jQuery('<button class="btn project-theme-button btn-default btn-base">');
          button.val(tag.get('name'));
          button.text(tag.get('name'));
          jQuery('.project-theme-holder').append(button);
        });
      } else {
        console.warn('Tags collection is empty!');
      }
    }

  });


  /**
    ProposalsView
  **/
  app.View.ProposalsView = Backbone.View.extend({

    initialize: function () {
      var view = this;
      console.log('Initializing ProposalsView...', view.el);

      view.collection.on('change', function(n) {
        if (n.id === app.project.id) {
          view.render();
        }
      });
    },

    events: {
      'click #publish-proposal-btn' : 'publishProposal',
      'click .nav-splash-btn'       : 'switchToSplashView',
      'keyup :input'                : 'checkForAutoSave'
    },

    switchToSplashView: function() {
      app.resetToSplashScreen();
    },

    publishProposal: function() {
      var view = this;
      var name = jQuery('#proposal-screen [name=name]').val();

      if (name.length > 0) {
        var researchQuestionVal = jQuery('#proposal-screen [name=research_question]').val();
        var needToKnowsVal = jQuery('#proposal-screen [name=need_to_knows]').val();

        app.clearAutoSaveTimer();
        app.project.set('name',name);
        var proposal = app.project.get('proposal');
        proposal.research_question = researchQuestionVal;
        proposal.need_to_knows = needToKnowsVal;
        proposal.published = true;
        app.project.set('proposal',proposal);
        app.project.save();

        // show who is 'logged in' as the group, since that's our 'user' in this case
        app.groupname = name;
        jQuery('.username-display a').text(app.groupname);

        // delete all previous proposal tiles for this project
        // Skeletor.Model.awake.tiles.where({ 'project_id': app.project.id, 'from_proposal': true }).forEach(function(tile) {
        //   tile.destroy();
        // });

        // create the new proposal tiles
        view.createProposalTile("Foundational knowledge", needToKnowsVal);
        view.createProposalTile("Research question(s)", researchQuestionVal);

        jQuery().toastmessage('showSuccessToast', "Your proposal has been published. You can come back and edit any time...");

        app.resetToSplashScreen();
      } else {
        jQuery().toastmessage('showErrorToast', "Please enter a title!");
      }
    },

    createProposalTile: function(titleText, bodyText) {
      var view = this;

      var preexistingTile = Skeletor.Model.awake.tiles.where({ 'project_id': app.project.id, 'from_proposal': true, 'title': titleText })[0];

      if (preexistingTile) {
        preexistingTile.set('body',bodyText);
        preexistingTile.save();
      } else {
        var m = new Model.Tile();
        m.set('project_id', app.project.id);
        m.set('author', app.username);
        m.set('type', "text");
        m.set('title', titleText);
        m.set('body', bodyText);
        m.set('favourite', true);
        m.set('from_proposal', true);
        m.set('published', true);
        m.wake(app.config.wakeful.url);
        m.save();
        Skeletor.Model.awake.tiles.add(m);
      }
    },

    // this version of autosave works with nested content. The nested structure must be spelled out *in the html*
    // eg <textarea data-nested="proposal" name="research_question" placeholder="1."></textarea>
    checkForAutoSave: function(ev) {
      var view = this,
          field = ev.target.name,
          input = ev.target.value;
      // clear timer on keyup so that a save doesn't happen while typing
      app.clearAutoSaveTimer();

      // save after 10 keystrokes
      app.autoSave(app.project, field, input, false, jQuery(ev.target).data("nested"));

      // setting up a timer so that if we stop typing we save stuff after 5 seconds
      app.autoSaveTimer = setTimeout(function(){
        app.autoSave(app.project, field, input, true, jQuery(ev.target).data("nested"));
      }, 5000);
    },

    render: function () {
      var view = this;
      console.log("Rendering ProposalsView...");

      jQuery('#proposal-screen [name=name]').text(app.project.get('name'));
      jQuery('#proposal-screen [name=research_question]').text(app.project.get('proposal').research_question);
      jQuery('#proposal-screen [name=need_to_knows]').text(app.project.get('proposal').need_to_knows);

      // they can't be allowed to change the name of their project once they've first created it, since it's now the unique identifier (le sigh)
      if (app.project && app.project.get('proposal').published === true) {
        jQuery('#proposal-screen [name=name]').addClass('disabled');
      } else {
        jQuery('#proposal-screen [name=name]').removeClass('disabled');
      }
    }

  });


  /**
   ** Tile View
   **/
  app.View.Tile = Backbone.View.extend({
    textTemplate: "#text-tile-template",
    photoTemplate: "#photo-tile-template",
    videoTemplate: "#video-tile-template",

    events: {
      'click'   : 'editTile'
    },

    initialize: function () {
      var view = this;

      view.model.on('change', function () {
        view.render();
      });

      return view;
    },

    render: function () {
      var view = this,
        tile = view.model,
        listItemTemplate,
        listItem;

      // different types - different tiles
      if (tile.get('type') === "text") {
        // if class is not set do it
        if (!view.$el.hasClass('text-tile-container')) {
          view.$el.addClass('text-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.textTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'title': tile.get('title'), 'body': tile.get('body'), 'star': (tile.get('favourite') ? 'fa-star' : 'fa-star-o') });
      } else if (tile.get('type') === "media" && app.photoOrVideo(tile.get('url')) === "photo") {
        // if class is not set do it
        if (!view.$el.hasClass('photo-tile-container')) {
          view.$el.addClass('photo-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.photoTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'url': app.config.pikachu.url + tile.get('url'), 'star': (tile.get('favourite') ? 'fa-star' : 'fa-star-o') });
      } else if (tile.get('type') === "media" && app.photoOrVideo(tile.get('url')) === "video") {
        // if class is not set do it
        if (!view.$el.hasClass('video-tile-container')) {
          view.$el.addClass('video-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.videoTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'url': app.config.pikachu.url + tile.get('url'), 'star': (tile.get('favourite') ? 'fa-star' : 'fa-star-o') });
      } else {
        throw "Unknown tile type!";
      }

      // Add the newly generated DOM elements to the vies's part of the DOM
      view.$el.html(listItem);

      return view;
    },

    editTile: function(ev) {
      var view = this;

      app.hideAllContainers();

      if (view.model.get('type') === "text") {
        app.projectWriteView.model = view.model;
        // app.projectWriteView.model.wake(app.config.wakeful.url);
        jQuery('#project-write-screen').removeClass('hidden');
        app.projectWriteView.render();
      } else {
        app.projectMediaView.model = view.model;
        // app.projectMediaView.model.wake(app.config.wakeful.url);

        jQuery('#project-media-screen').removeClass('hidden');
        app.projectMediaView.render();
      }
    },

    newOrResumeOrEditMediaTile: function(ev) {
      var view = this;

      app.projectMediaView.model = view.model;
      // app.projectMediaView.model.wake(app.config.wakeful.url);

      app.hideAllContainers();
      jQuery('#project-media-screen').removeClass('hidden');
      app.projectMediaView.render();
    }
  });

  /**
   ** Tiles View
   **/

  /**
    ProjectReadView
  **/
  app.View.ProjectReadView = Backbone.View.extend({
    initialize: function () {
      var view = this;
      console.log('Initializing ProjectReadView...', view.el);

      /* We should not have to listen to change on collection but on add. However, due to wakefulness
      ** and published false first we would see the element with add and see it getting created. Also not sure
      ** how delete would do and so on.
      ** IMPORTANT: in addOne we check if the id of the model to be added exists in the DOM and only add it to the DOM if it is new
      */
      view.collection.on('change', function(n) {
        if (app.project && n.get('project_id') === app.project.id && n.get('published') === true) {
          view.addOne(n);
        }
      });

      /*
      ** See above, but mostly we would want add and change in the tile view. But due to wakeness and published flag
      ** we are better of with using change and filtering to react only if published true.
      ** IMPORTANT: in addOne we check that id isn't already in the DOM
      */
      view.collection.on('add', function(n) {
        // If the add fires while project not chosen yet we get an error
        if (app.project && n.get('project_id') === app.project.id && n.get('published') === true) {
          view.addOne(n);
        }
      });

      return view;
    },

    events: {
      'click #nav-write-btn'         : 'createTextTile',
      'click #nav-media-btn'         : 'createMediaTile',
      'click #nav-poster-btn'        : 'switchToPosterView'
    },

    createTextTile: function(ev) {
      var view = this;
      var m;

      // check if we need to resume
      // BIG NB! We use author here! This is the only place where we care about app.username in addition to app.project (we want you only to be able to resume your own notes)
      var tileToResume = view.collection.findWhere({project_id: app.project.id, author: app.username, type: "text", published: false});

      if (tileToResume) {
        // RESUME TILE
        console.log("Resuming...");
        m = tileToResume;
      } else {
        // NEW TILE
        console.log("Starting a new text tile...");
        m = new Model.Tile();
        m.set('project_id', app.project.id);
        m.set('author', app.username);
        m.set('type', "text");
        m.set('from_proposal', false);
        m.wake(app.config.wakeful.url);
        m.save();
        view.collection.add(m);
      }

      app.projectWriteView.model = m;
      app.projectWriteView.model.wake(app.config.wakeful.url);

      app.hideAllContainers();
      jQuery('#project-write-screen').removeClass('hidden');
      app.projectWriteView.render();
    },

    createMediaTile: function(ev) {
      var view = this;
      var m;

      // check if we need to resume
      // BIG NB! We use author here! This is the only place where we care about app.username in addition to app.project (we want you only to be able to resume your own notes)
      var tileToResume = view.collection.findWhere({project_id: app.project.id, author: app.username, type: "media", published: false});

      if (tileToResume) {
        // RESUME TILE
        console.log('Resuming...');
        m = tileToResume;
      } else {
        // NEW TILE
        console.log('Starting a new media tile...');
        m = new Model.Tile();
        m.set('project_id',app.project.id);
        m.set('author', app.username);
        m.set('type', "media");
        m.set('from_proposal', false);
        m.set('url', '');
        m.wake(app.config.wakeful.url);
        m.save();
        view.collection.add(m);
     }

      app.projectMediaView.model = m;
      app.projectMediaView.model.wake(app.config.wakeful.url);

      app.hideAllContainers();
      jQuery('#project-media-screen').removeClass('hidden');
      app.projectMediaView.render();
    },

    switchToPosterView: function() {
      // jQuery().toastmessage('showErrorToast', "It is not time for this yet, kids");
      app.hideAllContainers();
      // if there's a poster for this project already, go to chunk screen, else go to new poster screen
      if (app.project.get('poster_title') && app.project.get('poster_title').length > 0) {
        app.projectPosterChunkView.render();
        jQuery('#project-poster-chunk-screen').removeClass('hidden');
      } else {
        app.projectNewPosterView.render();
        jQuery('#project-new-poster-screen').removeClass('hidden');
      }
    },

    addOne: function(tileModel) {
      var view = this;

      // check if the tile already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (view.$el.find("[data-id='" + tileModel.id + "']").length === 0 ) {
        // wake up the project model
        tileModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        var tileContainer = null;
        if (tileModel.get('originator') === "self") {
          tileContainer = jQuery('<li class="tile-container self col-xs-12 col-sm-4 col-lg-3" data-id="'+tileModel.id+'"></li>');
        } else {
          tileContainer = jQuery('<li class="tile-container col-xs-12 col-sm-4 col-lg-3" data-id="'+tileModel.id+'"></li>');
        }

        // handling new citation concept
        if (tileModel.get('cited_from_user_uuid') && tileModel.get('cited_from_poster_uuid') && tileModel.get('cited_from_poster_item_uuid')) {
          tileContainer.addClass('cited');
        }

        var tileView = new app.View.Tile({el: tileContainer, model: tileModel});
        var listToAddTo = view.$el.find('.tiles-list');
        listToAddTo.prepend(tileView.render().el);
      } else {
        console.log("The tile with id <"+tileModel.id+"> wasn't added since it already exists in the DOM");
      }


    },

    render: function() {
      var view = this;
      console.log("Rendering ProjectReadView...");

      // sort newest to oldest (prepend!)
      view.collection.comparator = function(model) {
        return model.get('created_at');
      };

      var myPublishedTiles = view.collection.sort().where({published: true, project_id: app.project.id});

      // clear the house
      view.$el.find('.tiles-list').html("");

      myPublishedTiles.forEach(function (tile) {
        view.addOne(tile);
      });
    }
  });


  /**
    ProjectWriteView
  **/
  app.View.ProjectWriteView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing ProjectWriteView...', view.el);
    },

    events: {
      'click .nav-read-btn'               : 'switchToReadView',
      // 'click .cancel-tile-btn'            : 'cancelTile',
      'click .publish-tile-btn'           : 'publishTile',
      'click #lightbulb-icon'             : 'showSentenceStarters',
      'click .favourite-icon'             : 'toggleFavouriteStatus',
      'click .sentence-starter'           : 'appendSentenceStarter',
      'keyup :input'                      : 'checkForAutoSave'
    },

    showSentenceStarters: function() {
      jQuery('#sentence-starter-modal').modal({keyboard: true, backdrop: true});
    },

    appendSentenceStarter: function(ev) {
      // add the sentence starter text to the current body (note that this won't start the autoSave trigger)
      var bodyText = jQuery('#tile-body-input').val();
      bodyText += jQuery(ev.target).text();
      jQuery('#tile-body-input').val(bodyText);

      jQuery('#sentence-starter-modal').modal('hide');
    },

    toggleFavouriteStatus: function(ev) {
      var view = this;

      jQuery('#project-write-screen .favourite-icon').addClass('hidden');

      if (jQuery(ev.target).hasClass('favourite-icon-unselected')) {
        jQuery('#project-write-screen .favourite-icon-selected').removeClass('hidden');
        view.model.set('favourite',true);
        view.model.save();
      } else {
        jQuery('#project-write-screen .favourite-icon-unselected').removeClass('hidden');
        view.model.set('favourite',false);
        view.model.save();
      }
    },

    checkForAutoSave: function(ev) {
      var view = this,
          field = ev.target.name,
          input = ev.target.value;
      // clear timer on keyup so that a save doesn't happen while typing
      app.clearAutoSaveTimer();

      // save after 10 keystrokes
      app.autoSave(view.model, field, input, false);

      // setting up a timer so that if we stop typing we save stuff after 5 seconds
      app.autoSaveTimer = setTimeout(function(){
        app.autoSave(view.model, field, input, true);
      }, 5000);
    },

    // destroy a model, if there's something to destroy
    // cancelTile: function() {
    //   var view = this;

    //   // if there is a tile
    //   if (view.model) {
    //     // confirm delete
    //     if (confirm("Are you sure you want to delete this tile?")) {
    //       app.clearAutoSaveTimer();
    //       view.model.destroy();
    //       // and we need to set it to null to 'remove' it from the local collection
    //       view.model = null;
    //       jQuery('.input-field').val('');
    //       view.switchToReadView();
    //     }
    //   }
    // },

    publishTile: function() {
      var view = this;
      var title = jQuery('#tile-title-input').val();
      var body = jQuery('#tile-body-input').val();

      if (title.length > 0 && body.length > 0) {
        app.clearAutoSaveTimer();
        view.model.set('title',title);
        view.model.set('body',body);
        view.model.set('published', true);
        view.model.set('modified_at', new Date());
        view.model.save();
        jQuery().toastmessage('showSuccessToast', "Published to the tile wall!");

        view.model = null;
        jQuery('.input-field').val('');
        view.switchToReadView();
      } else {
        jQuery().toastmessage('showErrorToast', "You need to complete both fields to submit your tile...");
      }
    },

    switchToReadView: function() {
      app.hideAllContainers();
      jQuery('#project-read-screen').removeClass('hidden');
    },

    render: function () {
      var view = this;
      console.log("Rendering ProjectWriteView...");

      jQuery('.favourite-icon').addClass('hidden');
      if (view.model.get('favourite') === true) {
        jQuery('.favourite-icon-selected').removeClass('hidden');
      } else {
        jQuery('.favourite-icon-unselected').removeClass('hidden');
      }

      jQuery('#tile-title-input').val(view.model.get('title'));
      jQuery('#tile-body-input').val(view.model.get('body'));
    }
  });


  /**
    ProjectMediaView
  **/
  app.View.ProjectMediaView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing ProjectMediaView...', view.el);
    },

    events: {
      'click .nav-read-btn'               : 'switchToReadView',
      // 'click .cancel-tile-btn'            : 'cancelTile',
      'click .publish-tile-btn'           : 'publishTile',
      'click .favourite-icon'             : 'toggleFavouriteStatus',
      'click .originator-btn'             : 'toggleOriginator',
      'change #photo-file'                : 'uploadPhoto'
    },

    toggleFavouriteStatus: function(ev) {
      var view = this;

      jQuery('#project-media-screen .favourite-icon').addClass('hidden');

      if (jQuery(ev.target).hasClass('favourite-icon-unselected')) {
        jQuery('#project-media-screen .favourite-icon-selected').removeClass('hidden');
        view.model.set('favourite',true);
        view.model.save();
      } else {
        jQuery('#project-media-screen .favourite-icon-unselected').removeClass('hidden');
        view.model.set('favourite',false);
        view.model.save();
      }
    },

    toggleOriginator: function(ev) {
      var view = this;

      jQuery('.originator-btn').removeClass('disabled');
      jQuery('.originator-btn').removeClass('selected');
      jQuery(ev.target).addClass('disabled');
      jQuery(ev.target).addClass('selected');

      view.model.set('originator',jQuery(ev.target).data('originator'));
      view.model.save();
    },

    // another nother attempt at this - now trigger on change so that the user only has to ever do one thing (remove enable upload)
    uploadPhoto: function() {
      var view = this;

      var file = jQuery('#photo-file')[0].files.item(0);
      var formData = new FormData();
      formData.append('file', file);

      jQuery('#photo-upload-spinner').removeClass('hidden');
      jQuery('.camera-icon-label').addClass('invisible');

      jQuery.ajax({
        url: app.config.pikachu.url,
        type: 'POST',
        success: success,
        error: failure,
        data: formData,
        cache: false,
        contentType: false,
        processData: false
      });

      function failure(err) {
        jQuery('#photo-upload-spinner').addClass('hidden');
        jQuery('.camera-icon-label').removeClass('invisible');
        jQuery().toastmessage('showErrorToast', "Photo could not be uploaded. Please try again");
      }

      function success(data, status, xhr) {
        jQuery('#photo-upload-spinner').addClass('hidden');
        jQuery('.camera-icon-label').removeClass('invisible');
        console.log("UPLOAD SUCCEEDED!");
        console.log(xhr.getAllResponseHeaders());
        // add it to the model
        view.model.set('url',data.url);
        view.model.save();
        view.render();
      }
    },

    // cancelTile: function() {
    //   var view = this;

    //   // if there is a tile
    //   if (view.model) {
    //     // confirm delete
    //     if (confirm("Are you sure you want to delete this tile?")) {
    //       app.clearAutoSaveTimer();
    //       view.model.destroy();
    //       // and we need to set it to null to 'remove' it from the local collection
    //       view.model = null;
    //       jQuery('.input-field').val('');
    //       // clears the value of the photo input. Adapted from http://stackoverflow.com/questions/1043957/clearing-input-type-file-using-jquery
    //       jQuery('#photo-file').replaceWith(jQuery('#photo-file').clone());
    //       view.switchToReadView();
    //     }
    //   }
    // },

    publishTile: function() {
      var view = this;

      if (view.model.get('url') && view.model.get('originator')) {
        view.model.set('published', true);
        view.model.set('modified_at', new Date());
        view.model.save();
        jQuery().toastmessage('showSuccessToast', "Published to the tile wall!");

        view.model = null;
        jQuery('.input-field').val('');
        // clears the value of the photo input. Adapted from http://stackoverflow.com/questions/1043957/clearing-input-type-file-using-jquery
        jQuery('#photo-file').replaceWith(jQuery('#photo-file').clone());
        view.switchToReadView();
      } else {
        jQuery().toastmessage('showErrorToast', "Please add a picture or video and confirm whether this is your own drawing, model, or other form of representation...");
      }
    },

    switchToReadView: function() {
      app.hideAllContainers();
      jQuery('#project-read-screen').removeClass('hidden');
    },

    render: function() {
      var view = this;
      console.log("Rendering ProjectMediaView...");

      // favourite button (the star)
      jQuery('.favourite-icon').addClass('hidden');
      if (view.model.get('favourite') === true) {
        jQuery('.favourite-icon-selected').removeClass('hidden');
      } else {
        jQuery('.favourite-icon-unselected').removeClass('hidden');
      }

      // originator buttons
      // doing it this way since I don't want to deal with radio buttons
      jQuery('.originator-btn').removeClass('disabled');
      jQuery('.originator-btn').removeClass('selected');
      if (view.model.get('originator') === "self") {
        jQuery('#self-originator-btn').addClass('disabled');
        jQuery('#self-originator-btn').addClass('selected');
      } else if (view.model.get('originator') === "other") {
        jQuery('#others-originator-btn').addClass('disabled');
        jQuery('#others-originator-btn').addClass('selected');
      }

      // photo
      if (view.model.get('url') && app.photoOrVideo(view.model.get('url')) === "photo") {
        jQuery('.camera-icon').replaceWith(jQuery('<img src="' + app.config.pikachu.url + view.model.get('url') + '" class="camera-icon img-responsive" />'));
      } else if (view.model.get('url') && app.photoOrVideo(view.model.get('url')) === "video") {
        jQuery('.camera-icon').replaceWith(jQuery('<video src="' + app.config.pikachu.url + view.model.get('url') + '" class="camera-icon img-responsive" controls />'));
      } else {
        jQuery('.camera-icon').replaceWith(jQuery('<img src="img/camera_icon.png" class="camera-icon img-responsive" alt="camera icon" />'));
      }
    }
  });


  /**
    ProjectNewPosterScreen
  **/
  app.View.ProjectNewPosterView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing ProjectNewPosterView...', view.el);
    },

    events: {
      'click .create-poster-btn'              : 'createPoster',
      'click .new-poster-theme-button'        : 'toggleThemeButtonStatus'
    },

    toggleThemeButtonStatus: function(ev) {
      jQuery(ev.target).toggleClass('selected');
    },

    createPoster: function() {
      var view = this;
      var posterTitle = jQuery('#project-new-poster-screen [name=poster_title]').val();

      if (jQuery('#project-new-poster-screen [name=poster_title]').val().length > 0) {
        jQuery('.create-poster-btn').addClass('disabled');
        // create all the relevant stuff in the UIC DB (poster and group)
        // (note poster id is project id)
        var posterObj = JSON.stringify({
                          "name": posterTitle,
                          "uuid": app.project.id + '-poster',
                          "created_at" : new Date()
                        });

        var groupObj = JSON.stringify({
                         "classname": app.runId,
                         "name": app.project.get('name'),
                         "nameTags": app.project.get('associated_users'),
                         "posters" : [ app.project.id + '-poster' ],         // always one element in here
                         "uuid" : app.project.id + '-gruser',
                         "created_at": new Date()
                       });

        // We encounter rar cases of user and poster entries with the same UUID. We check via a selector if the UUIDs already exist
        // The UIC drowsy need the URL to be formatted in a certain way to have selectors work (see below)
        // https://ltg.evl.uic.edu/drowsy/poster/user?selector=%7B%22uuid%22:%22552be88b7ea25d29c4000000-gruser%22%7D
        var checkForUUIDinUser = jQuery.get(Skeletor.Mobile.config.drowsy.uic_url + '/user?selector=%7B%22uuid%22:%22' + app.project.id + '-gruser%22%7D');
        var checkForUUIDinPoster = jQuery.get(Skeletor.Mobile.config.drowsy.uic_url + '/poster?selector=%7B%22uuid%22:%22' + app.project.id + '-poster%22%7D');

        jQuery.when( checkForUUIDinUser, checkForUUIDinPoster )
        .done(function (v1, v2) {
          // wonderful syntax. Just easy to read (hello C)
          // We take the result array [0] of both gets (v1 and v2) and ensure they came back empty, aka there is no entry with that UUID
          if (v1[0].length === 0 && v2[0].length === 0) {
            var postPoster = jQuery.post(Skeletor.Mobile.config.drowsy.uic_url + "/poster", posterObj);
            var postUser = jQuery.post(Skeletor.Mobile.config.drowsy.uic_url + "/user", groupObj);

            jQuery.when( postPoster, postUser )
            .done(function (v1, v2) {
              var posterThemes = [];

              // add to the project object in the OISE DB
              app.project.set('poster_title', posterTitle);
              // from the object returned by drowsy, we need to get the mongo id for later
              app.project.set('poster_mongo_id',v1[0]._id.$oid);        // lol, classic mongo syntax. Probably a nicer way of doing this?

              jQuery('#project-new-poster-screen .selected').each(function() {
                posterThemes.push(jQuery(this).val());
              });
              app.project.set('poster_themes', posterThemes);
              app.project.save();

              jQuery().toastmessage('showSuccessToast', "You have started your poster!");
              app.hideAllContainers();
              jQuery('#project-poster-chunk-screen').removeClass('hidden');
              jQuery('.create-poster-btn').removeClass('disabled');
            })
            .fail(function (v1) {
              jQuery().toastmessage('showErrorToast', "There has been an error with poster creation! Please request technical support");
              console.error("There has been an error with poster creation! Please request technical support");
              // handle the error here - deleting from Tony's DB whichever (or both) that failed
              jQuery('.create-poster-btn').removeClass('disabled');
            });
          } else {
            console.warn("The poster and/or user with the following UUID exits: " + app.project.id +"-poster/gruser! Cannot create poster since it is already there!");
            jQuery().toastmessage('showErrorToast', "The poster and/or user with the following UUID exits: " + app.project.id +"-poster/gruser! Cannot create poster since it is already there!");
            jQuery('.create-poster-btn').removeClass('disabled');
          }
        })
        .fail(function (v1) {
          jQuery().toastmessage('showErrorToast', "There has been an error with poster creation! Please request technical support (2)");
          console.error("There has been an error with poster creation! Please request technical support (2)");
          jQuery('.create-poster-btn').removeClass('disabled');
        });


      } else {
        jQuery().toastmessage('showErrorToast', "Please add a title to your poster...");
      }
    },

    switchToReadView: function() {
      app.hideAllContainers();
      jQuery('#project-read-screen').removeClass('hidden');
    },

    render: function() {
      var view = this;
      console.log("Rendering ProjectNewPosterView...");

      // add the theme buttons - need to be careful of random rerenders here, will mess us up
      jQuery('.new-poster-theme-holder').html('');
      if (Skeletor.Model.awake.tags.length > 0) {
        Skeletor.Model.awake.tags.each(function(tag) {
          var button = jQuery('<button class="btn new-poster-theme-button btn-default btn-base" data-name="' + tag.get('name') + '">');
          button.val(tag.get('name'));
          button.text(tag.get('name'));
          jQuery('.new-poster-theme-holder').append(button);
        });
      } else {
        console.warn('Tags collection is empty!');
      }

      jQuery('.new-poster-theme-holder [data-name="' + app.project.get('theme') + '"]').addClass('selected');
    }
  });


  /**
   ** Chunk View
   **/
  app.View.Chunk = Backbone.View.extend({
    template: "#chunk-list-template",

    events: {
      'click' : 'editChunk'
    },

    initialize: function () {
      var view = this;

      view.model.on('change', function () {
        view.render();
      });

      return view;
    },

    render: function () {
      var view = this,
        tile = view.model,
        listItemTemplate,
        listItem;


      listItemTemplate = _.template(jQuery(view.template).text());
      listItem = listItemTemplate(view.model.toJSON());

      // Add the newly generated DOM elements to the view's part of the DOM
      view.$el.html(listItem);

      return view;
    },

    editChunk: function(ev) {
      var view = this;

      app.hideAllContainers();

      if (view.model.get('type') === "text") {
        app.projectPosterTextChunkView.model = view.model;
        // app.projectWriteView.model.wake(app.config.wakeful.url);
        jQuery('#project-poster-text-chunk-screen').removeClass('hidden');
        app.projectPosterTextChunkView.render();
      } else {
        app.projectPosterMediaChunkView.model = view.model;
        // app.projectMediaView.model.wake(app.config.wakeful.url);

        jQuery('#project-poster-media-chunk-screen').removeClass('hidden');
        app.projectPosterMediaChunkView.render();
      }

    }
  });

  /**
    ProjectPosterChunkView
  **/
  app.View.ProjectPosterChunkView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing ProjectPosterChunkView...', view.el);

      view.collection.on('change', function (m) {
        if (app.project && m.get('project_id') === app.project.id && m.get('published') === true) {
          view.addOne(m);
        }
      });

      view.collection.on('add', function (m) {
        if (app.project && m.get('project_id') === app.project.id && m.get('published') === true) {
          view.addOne(m);
        }
      });

      view.collection.on('destroy', function (m) {
        if (app.project && m.get('project_id') === app.project.id && m.get('published') === true) {
          view.render();
        }
      });
    },

    events: {
      'click #create-text-chunk-btn'            : 'createChunk',
      'click #create-media-chunk-btn'           : 'createChunk',
      'click .nav-read-btn'                     : 'switchToReadView'
    },

    createChunk: function(ev) {
      var view = this;
      var m;
      var type = jQuery(ev.target).data('type');

      // check if we need to resume
      var tileToResume = view.collection.findWhere({project_id: app.project.id, author: app.username, type: type, published: false});

      if (tileToResume) {
        console.log('Resuming...');
        m = tileToResume;
      } else {
        console.log('Starting a new media chunk...');
        m = new Model.Chunk();
        m.set('project_id',app.project.id);
        m.set('project_name',app.project.get('name'));
        m.set('associated_users',app.project.get('associated_users'));
        m.set('author', app.username);
        m.set('type', type);
        m.wake(app.config.wakeful.url);
        m.save();
        view.collection.add(m);
      }

      app.hideAllContainers();
      if (type === "text") {
        app.projectPosterTextChunkView.model = m;
        app.projectPosterTextChunkView.model.wake(app.config.wakeful.url);
        jQuery('#project-poster-text-chunk-screen').removeClass('hidden');
        app.projectPosterTextChunkView.render();
      } else if (type === "media") {
        app.projectPosterMediaChunkView.model = m;
        app.projectPosterMediaChunkView.model.wake(app.config.wakeful.url);
        jQuery('#project-poster-media-chunk-screen').removeClass('hidden');
        app.projectPosterMediaChunkView.render();
      } else {
        console.error("Unknown type for new chunk");
      }
    },

    switchToReadView: function() {
      app.hideAllContainers();
      jQuery('#project-read-screen').removeClass('hidden');
    },

    addOne: function (chunkModel) {
      var view = this;

      // check if the chunk already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (jQuery("#poster-chunk-holder").find("[data-id='" + chunkModel.id + "']").length === 0 ) {
        // wake up the project model
        chunkModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        // var chunkContainer = jQuery("#poster-chunk-holder");

        var chunkView = new app.View.Chunk({model: chunkModel});
        var listToAddTo = view.$el.find('#poster-chunk-holder');
        listToAddTo.prepend(chunkView.render().el);
      } else {
        console.log("The tile with id <"+chunkModel.id+"> wasn't added since it already exists in the DOM");
      }
    },

    addAll: function (view) {
      // sort newest to oldest (prepend!)
      view.collection.comparator = function(model) {
        return model.get('created_at');
      };

      var myPublishedChunks = view.collection.sort().where({published: true, project_id: app.project.id});

      // clear the house
      view.$el.find('#poster-chunk-holder').html("");

      myPublishedChunks.forEach(function (chunk) {
        view.addOne(chunk);
      });
    },

    render: function() {
      var view = this;
      console.log("Rendering ProjectPosterChunkView...");

      view.addAll(view);
    }
  });


  /**
   ** PosterTile View
   **/
  app.View.PosterTile = Backbone.View.extend({
    textTemplate: "#text-tile-template",
    photoTemplate: "#photo-tile-template",
    videoTemplate: "#video-tile-template",

    events: {
      'click'   : 'copyTile'
    },

    initialize: function () {
      var view = this;

      view.model.on('change', function () {
        view.render();
      });

      return view;
    },

    render: function () {
      var view = this,
        tile = view.model,
        listItemTemplate,
        listItem;

      // different types - different tiles
      if (tile.get('type') === "text") {
        // if class is not set do it
        if (!view.$el.hasClass('text-tile-container')) {
          view.$el.addClass('text-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.textTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'title': tile.get('title'), 'body': tile.get('body'), 'star': (tile.get('favourite') ? 'fa-star' : 'fa-star-o') });
      } else if (tile.get('type') === "media" && app.photoOrVideo(tile.get('url')) === "photo") {
        // if class is not set do it
        if (!view.$el.hasClass('photo-tile-container')) {
          view.$el.addClass('photo-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.photoTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'url': app.config.pikachu.url + tile.get('url'), 'star': (tile.get('favourite') ? 'fa-star' : 'fa-star-o') });
      } else if (tile.get('type') === "media" && app.photoOrVideo(tile.get('url')) === "video") {
        // if class is not set do it
        if (!view.$el.hasClass('video-tile-container')) {
          view.$el.addClass('video-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.videoTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'url': app.config.pikachu.url + tile.get('url'), 'star': (tile.get('favourite') ? 'fa-star' : 'fa-star-o') });
      } else {
        throw "Unknown tile type!";
      }

      // handling originator
      if (tile.get('originator') === "self") {
        view.$el.addClass('self');
      }

      // handling new cited concept
      if (tile.get('cited_from_user_uuid') && tile.get('cited_from_poster_uuid') && tile.get('cited_from_poster_item_uuid')) {
        view.$el.addClass('cited');
      }

      // Add the newly generated DOM elements to the view's part of the DOM
      view.$el.html(listItem);

      return view;
    },

    copyTile: function(ev) {
      var view = this;

      // if the clicked tile is text
      if (view.model.get('type') === "text") {
        if (confirm("Would you like to paste this text into your poster content section?")) {
          var text = jQuery('#text-chunk-body-input').val();
          text += ' ' + view.model.get('body');
          jQuery('#text-chunk-body-input').val(text);
        }
      }
      // if the clicked tile is a photo
      else if (view.model.get('type') === "media" && app.photoOrVideo(view.model.get('url')) === "photo") {
        jQuery('#media-chunk-media-holder').html('<img src="' + app.config.pikachu.url + view.model.get('url') + '"/>');
      }
      // if the clicked tile is a video
      else if (view.model.get('type') === "media" && app.photoOrVideo(view.model.get('url')) === "video") {
        //jQuery().toastmessage('showErrorToast', "Video to poster uploading is currently under development...");
        jQuery('#media-chunk-media-holder').html('<video src="' + app.config.pikachu.url + view.model.get('url') + '" controls />');
      } else {
        console.error("Unknown chunk type!");
      }

      if (view.model.get('cited_from_user_uuid') && view.model.get('cited_from_poster_uuid') && view.model.get('cited_from_poster_item_uuid')) {
        if (view.model.get('type') === "text") {
          jQuery('#text-chunk-body-input').data(
            "citation",
            {
              "cited_from_user_uuid" : view.model.get('cited_from_user_uuid'),
              "cited_from_poster_uuid" : view.model.get('cited_from_poster_uuid'),
              "cited_from_poster_item_uuid" : view.model.get('cited_from_poster_item_uuid')
            });
        } else if (view.model.get('type') === "media") {
          jQuery('#media-chunk-body-input').data(
            "citation",
            {
              "cited_from_user_uuid" : view.model.get('cited_from_user_uuid'),
              "cited_from_poster_uuid" : view.model.get('cited_from_poster_uuid'),
              "cited_from_poster_item_uuid" : view.model.get('cited_from_poster_item_uuid')
            });
        } else {
          console.error("Cannot add citation information, unknown tile type");
        }
      }
    }
  });

  /**
    ProjectPosterTextChunkView
  **/
  app.View.ProjectPosterTextChunkView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing ProjectPosterTextChunkView...', view.el);
    },

    events: {
      'click .publish-chunk-btn'            : 'publishChunk',
      'click .nav-chunk-btn'                : 'switchToChunkView',
      'keyup :input'                        : 'checkForAutoSave'
    },


    // NOTE: edit does not need to resend the posterObj

    publishChunk: function() {
      var view = this;
      //var titleText = jQuery('#text-chunk-title-input').val();
      var bodyText = jQuery('#text-chunk-body-input').val();

      if (bodyText.length > 0) {
        app.clearAutoSaveTimer();
        // add the loader to prevent them from spamming the submit button (which is a possible source of duplicate poster_items for Tony's side... could also be a network issue)
        jQuery('#text-chunk-upload-spinner').removeClass('hidden');

        /** New plan. We don't care about deletions on the poster and will always write poster items into new documents with new UUIDs
         *  Sequence:
         *  1) write poster item and get OID from DB
         *  2) Use OID from step 1) and write it into UUID field of poster item
         *  3) read posterItemsArray from poster collection
         *  4) add OID from step 1) to posterItems Array and patch poster collection with new array
         *  5) Send MQTT message to poster software and store changes in own DB
        **/

        // 1)
        var posterItemTxtObj = null;
        var citationInfo = jQuery('#text-chunk-body-input').data("citation");
        if (citationInfo) {
          posterItemTxtObj = JSON.stringify({
                             "content" : bodyText,
                             "type" : "txt",
                             "uuid" : 'not set yet',
                             "created_at" : new Date(),
                             "cited_from_user_uuid" : citationInfo.cited_from_user_uuid,
                             "cited_from_poster_uuid" : citationInfo.cited_from_poster_uuid,
                             "cited_from_poster_item_uuid" : citationInfo.cited_from_poster_item_uuid
          });
        } else {
          posterItemTxtObj = JSON.stringify({
                            "content" : bodyText,
                            "type" : "txt",
                            "uuid" : 'not set yet',
                            "created_at" : new Date()
          });
        }


        jQuery.ajax({
          url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/",
          type: 'POST',
          data: posterItemTxtObj
        })
        .done(function (posterItemRes) {
          var returnedOID = posterItemRes._id.$oid;
          // 2)
          posterItemRes.uuid = returnedOID;
          var patchPosterItem = jQuery.ajax({
            url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/" + returnedOID,
            type: 'PATCH',
            data: posterItemRes
          });

          // 3)
          var getPoster = jQuery.get(Skeletor.Mobile.config.drowsy.uic_url + "/poster/" + app.project.get('poster_mongo_id'));

          jQuery.when (patchPosterItem, getPoster)
          .done(function (v1, v2) {
            // 4)
            var posterItems = v2[0].posterItems;
            if (Array.isArray(posterItems)) {
              posterItems.push(returnedOID);
            } else {
              // new poster so we create the array since posterItems for UIC poster collection is not existant
              posterItems = [];
              posterItems.push(returnedOID);
            }


            var posterObj = JSON.stringify({
                          "uuid": app.project.id + '-poster',
                          "posterItems": _.uniq(posterItems),
                          "modified_at": new Date()
            });
            // we're patching here
            jQuery.ajax({
              url: Skeletor.Mobile.config.drowsy.uic_url + "/poster/" + app.project.get('poster_mongo_id'),
              type: 'PATCH',
              data: posterObj
            })
            .done(function(data){
              // 5)
              // sending out the msg for UIC
              var itemUpdateObj = {
                "action":"ADD",
                "posterUuid": app.project.id + '-poster',
                "userUuid": app.project.id + '-gruser',
                "posterItemId": returnedOID,
                "type":"POSTER_ITEM"
              };

              // dealing with OISE end
              //view.model.set('title', titleText);
              // when we get back the mongo id, we add it to the object so that we can patch later
              //view.model.set('item_mongo_txt_id', returnedOId);
              view.model.set('body', bodyText);
              view.model.set('published', true);
              view.model.set('modified_at', new Date());
              view.model.save().done(function () {
                jQuery('#text-chunk-upload-spinner').addClass('hidden');
                jQuery().toastmessage('showSuccessToast', "Saved to your poster!");
                view.model = null;
                jQuery('.input-field').val('');
                view.switchToChunkView();
                // FIXME: This is a huge trouble source. Connection is wonky and if we disconnected this call breaks which means we think the note is still unpublished.
                Skeletor.Mobile.mqtt.publish('IAMPOSTERIN',JSON.stringify(itemUpdateObj));
              });
            });
          });
        });
      } else {
        jQuery().toastmessage('showErrorToast', "Please add some content before submitting to the poster...");
      }
    },

    checkForAutoSave: function(ev) {
      var view = this,
          field = ev.target.name,
          input = ev.target.value;
      // clear timer on keyup so that a save doesn't happen while typing
      app.clearAutoSaveTimer();

      // save after 10 keystrokes
      app.autoSave(view.model, field, input, false);

      // setting up a timer so that if we stop typing we save stuff after 5 seconds
      app.autoSaveTimer = setTimeout(function(){
        app.autoSave(view.model, field, input, true);
      }, 5000);
    },

    switchToChunkView: function() {
      app.hideAllContainers();
      jQuery('#project-poster-chunk-screen').removeClass('hidden');
    },

    addOne: function (tileModel) {
      var view = this;

      // check if the chunk already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (view.$el.find("[data-id='" + tileModel.id + "']").length === 0 ) {
        // wake up the project model
        tileModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        var tileContainer = jQuery('<li class="tile-container col-xs-12 col-sm-4 col-lg-3" data-id="'+tileModel.id+'"></li>');

        var posterTileView = new app.View.PosterTile({el: tileContainer, model: tileModel});
        var listToAddTo = view.$el.find('.tiles-list');
        listToAddTo.prepend(posterTileView.render().el);
      } else {
        console.log("The tile with id <"+tileModel.id+"> wasn't added since it already exists in the DOM");
      }
    },

    addAll: function (view) {
      // sort newest to oldest (prepend!)
      Skeletor.Model.awake.tiles.comparator = function(model) {
        return model.get('created_at');
      };

      // var myPublishedTextTiles = view.collection.sort().where({published: true, project_id: app.project.id});
      var myPublishedTextTiles = Skeletor.Model.awake.tiles.sort().where({published: true, project_id: app.project.id, type: 'text'});

      // clear the house
      view.$el.find('.tiles-list').html("");

      myPublishedTextTiles.forEach(function (textTile) {
        view.addOne(textTile);
      });
    },

    render: function() {
      var view = this;
      console.log("Rendering ProjectPosterTextChunkView...");

      //jQuery('#text-chunk-title-input').val(view.model.get('title'));
      jQuery('#text-chunk-body-input').val(view.model.get('body'));

      view.addAll(view);
    }
  });


  /**
    ProjectPosterMediaChunkView
  **/
  app.View.ProjectPosterMediaChunkView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing ProjectPosterMediaChunkView...', view.el);
    },

    events: {
      'click .publish-chunk-btn'            : 'publishChunk',
      'click .nav-chunk-btn'                : 'switchToChunkView',
      'keyup :input'                        : 'checkForAutoSave'
    },

    publishChunk: function() {
      var view = this;
      var bodyText = jQuery('#media-chunk-body-input').val();
      var url = jQuery('#media-chunk-media-holder').children().first().attr('src');
      var mediaType = null;
      if (app.photoOrVideo(url) === "photo") {
        mediaType = "img";
      } else if (app.photoOrVideo(url) === "video") {
        mediaType = "vid";
      } else {
        // docx or similar and we are done here :(
        console.error("Unknown media type for this chunk!");
        throw "Unknown media type for this chunk!";
      }

      // add locking mechanism here (also remember that this needs to be added to text)
      if (bodyText.length > 0 && jQuery('#media-chunk-media-holder').children().length > 0) {
        app.clearAutoSaveTimer();
        jQuery('#media-chunk-upload-spinner').removeClass('hidden');

        /** New plan. We don't care about deletions on the poster and will always write poster items into new documents with new UUIDs
         *  Sequence:
         *  1) write poster items and get OIDs from DB
         *  2) Use OIDs from step 1) and write it into UUID field of poster item
         *  3) read posterItemsArray from poster collection
         *  4) add OID from step 1) to posterItems Array and patch poster collection with new array
         *  5) Send MQTT message to poster software and store changes in own DB
        **/

        // 1)
        var posterItemTxtObj = null;
        var posterItemMediaObj = null;
        var citationInfo = jQuery('#media-chunk-body-input').data("citation");
        if (citationInfo) {
          posterItemTxtObj = JSON.stringify({
                             "content" : bodyText,
                             "type" : "txt",
                             "uuid" : 'not set yet',
                             "created_at" : new Date(),
                             "cited_from_user_uuid" : citationInfo.cited_from_user_uuid,
                             "cited_from_poster_uuid" : citationInfo.cited_from_poster_uuid,
                             "cited_from_poster_item_uuid" : citationInfo.cited_from_poster_item_uuid

          });

          posterItemMediaObj = JSON.stringify({
                             "content" : url,
                             "type" : mediaType,
                             "uuid" : 'not set yet',
                             "created_at" : new Date(),
                             "cited_from_user_uuid" : citationInfo.cited_from_user_uuid,
                             "cited_from_poster_uuid" : citationInfo.cited_from_poster_uuid,
                             "cited_from_poster_item_uuid" : citationInfo.cited_from_poster_item_uuid
          });

        } else {
          posterItemTxtObj = JSON.stringify({
                            "content" : bodyText,
                            "type" : "txt",
                            "uuid" : 'not set yet',
                            "created_at" : new Date()
          });

          posterItemMediaObj = JSON.stringify({
                             "content" : url,
                             "type" : mediaType,
                             "uuid" : 'not set yet',
                             "created_at" : new Date()
          });
        }

        var postPosterTxtItem = jQuery.ajax({
          url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/",
          type: 'POST',
          data: posterItemTxtObj
        });

        var postPosterMediaItem = jQuery.ajax({
          url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/",
          type: 'POST',
          data: posterItemMediaObj
        });

        jQuery.when(postPosterTxtItem, postPosterMediaItem)
        .done(function (v1, v2) {
          var posterTxtItemRes = v1[0];
          var posterMediaItemRes = v2[0];
          var returnedTxtItemOID = posterTxtItemRes._id.$oid;
          var returnedMediaItemOID = posterMediaItemRes._id.$oid;
          // 2)
          posterTxtItemRes.uuid = returnedTxtItemOID;
          var patchPosterTxtItem = jQuery.ajax({
            url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/" + returnedTxtItemOID,
            type: 'PATCH',
            data: posterTxtItemRes
          });

          posterMediaItemRes.uuid = returnedMediaItemOID;
          var patchPosterMediaItem = jQuery.ajax({
            url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/" + returnedMediaItemOID,
            type: 'PATCH',
            data: posterMediaItemRes
          });

          // 3)
          var getPoster = jQuery.get(Skeletor.Mobile.config.drowsy.uic_url + "/poster/" + app.project.get('poster_mongo_id'));

          jQuery.when (patchPosterTxtItem, patchPosterMediaItem, getPoster)
          .done(function (v1, v2, v3) {
            // 4)
            var posterItems = v3[0].posterItems;
            if (Array.isArray(posterItems)) {
              posterItems.push(returnedTxtItemOID);
              posterItems.push(returnedMediaItemOID);
            } else {
              // new poster so we create the array since posterItems for UIC poster collection is not existant
              posterItems = [];
              posterItems.push(returnedTxtItemOID);
              posterItems.push(returnedMediaItemOID);
            }

            var posterObj = JSON.stringify({
                          "uuid": app.project.id + '-poster',
                          "posterItems": _.uniq(posterItems),
                          "modified_at": new Date()
            });
            // we're patching here
            jQuery.ajax({
              url: Skeletor.Mobile.config.drowsy.uic_url + "/poster/" + app.project.get('poster_mongo_id'),
              type: 'PATCH',
              data: posterObj
            })
            .done(function(data){
              // 5)
              // dealing with OISE end
              // when we get back the mongo id, we add it to the object so that we can patch later
              // view.model.set('item_mongo_txt_id', returnedTxtItemOID);
              // view.model.set('item_mongo_media_id', returnedMediaItemOID);
              view.model.set('body', bodyText);
              view.model.set('url', url);
              view.model.set('published', true);
              view.model.set('modified_at', new Date());
              view.model.save().done(function () {
                jQuery('#media-chunk-upload-spinner').addClass('hidden');
                jQuery().toastmessage('showSuccessToast', "Sent to your poster!");

                view.model = null;
                jQuery('.input-field').val('');
                jQuery('#media-chunk-media-holder').html('');
                view.switchToChunkView();

                // sending out the msg for UIC
                var textItemUpdateObj = {
                  "action":"ADD",
                  "posterUuid": app.project.id + '-poster',
                  "userUuid": app.project.id + '-gruser',
                  "posterItemId": returnedTxtItemOID,
                  "type":"POSTER_ITEM"
                };
                Skeletor.Mobile.mqtt.publish('IAMPOSTERIN',JSON.stringify(textItemUpdateObj));

                var mediaItemUpdateObj = {
                  "action":"ADD",
                  "posterUuid": app.project.id + '-poster',
                  "userUuid": app.project.id + '-gruser',
                  "posterItemId": returnedMediaItemOID,
                  "type":"POSTER_ITEM"
                };
                Skeletor.Mobile.mqtt.publish('IAMPOSTERIN',JSON.stringify(mediaItemUpdateObj));
              });
            });
          });
        });

        // Ok, this insanity:
        // cause of the hoops we need to jump through to deal with UIC data structures, we need to keep track of all chunks that belong to a poster
        // var posterItems = [];
        // // get all published chunks
        // var posterItems = app.rebuildPosterItemsArray(app.project.id);
        // // var myPublishedTextChunks = Skeletor.Model.awake.chunks.where({published: true, project_id: app.project.id, type: "text"});
        // // var myPublishedMediaChunks = Skeletor.Model.awake.chunks.where({published: true, project_id: app.project.id, type: "media"});
        // // _.each(myPublishedTextChunks, function(c) { posterItems.push(c.id + '-txtitem'); });
        // // _.each(myPublishedMediaChunks, function(c) { posterItems.push(c.id + '-mediaitem'); posterItems.push(c.id + '-txtitem'); });
        // // add the new chunk to the array
        // posterItems.push(view.model.id + '-txtitem');
        // posterItems.push(view.model.id + '-mediaitem');

        // // we are getting very close to the deadline, things are getting ugly. Probably better for everyone's sanity if you don't look at the following ~80 lines of code
        // // ADDING UNIQ HERE TO REMOVE ANY RANDOM DUPLICATES (from semi-unknown bug on May 6)
        // var posterObj = {
        //               "uuid": app.project.id + '-poster',
        //               "posterItems": _.uniq(posterItems)
        // };

        // // sometimes this will need to be a patch, sometimes a post
        // var posterItemTxtObj = {
        //                   "content" : bodyText,
        //                   "type" : "txt",
        //                   "uuid" : view.model.id + '-txtitem'
        //                 };


        // var posterItemMediaObj = {
        //                   "content" : url,
        //                   "type" : mediaType,
        //                   "uuid" : view.model.id + '-mediaitem'
        //                 };

        // // we're patching here
        // var postPoster = jQuery.ajax({
        //   url: Skeletor.Mobile.config.drowsy.uic_url + "/poster/" + app.project.get('poster_mongo_id'),
        //   type: 'PATCH',
        //   data: posterObj
        // });

        // // decide if we're editing (PATCH) or sending a new one (POST)
        // var postPosterTxtItem = null;
        // if (view.model.get('item_mongo_txt_id')) {
        //   postPosterTxtItem = jQuery.ajax({
        //     url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/" + view.model.get('item_mongo_txt_id'),
        //     type: 'PATCH',
        //     data: posterItemTxtObj
        //   });
        // } else {
        //   postPosterTxtItem = jQuery.ajax({
        //     url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/",
        //     type: 'POST',
        //     data: posterItemTxtObj
        //   });
        // }

        // var postPosterMediaItem = null;
        // if (view.model.get('item_mongo_media_id')) {
        //   postPosterMediaItem = jQuery.ajax({
        //     url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/" + view.model.get('item_mongo_media_id'),
        //     type: 'PATCH',
        //     data: posterItemMediaObj
        //   });
        // } else {
        //   postPosterMediaItem = jQuery.ajax({
        //     url: Skeletor.Mobile.config.drowsy.uic_url + "/poster_item/",
        //     type: 'POST',
        //     data: posterItemMediaObj
        //   });
        // }

        // jQuery.when( postPoster, postPosterTxtItem, postPosterMediaItem )
        // .done(function (v1, v2, v3) {
        //   var returnedTextOId = v2[0]._id.$oid;
        //   var returnedMediaOId = v3[0]._id.$oid;
        //   // sending out the msg for UIC
        //   var textItemUpdateObj = {
        //     "action":"ADD",
        //     "posterUuid": app.project.id + '-poster',
        //     "userUuid": app.project.id + '-gruser',
        //     "posterItemId": returnedTextOId,
        //     "type":"POSTER_ITEM"
        //   };
        //   Skeletor.Mobile.mqtt.publish('IAMPOSTERIN',JSON.stringify(textItemUpdateObj));
        //   var mediaItemUpdateObj = {
        //     "action":"ADD",
        //     "posterUuid": app.project.id + '-poster',
        //     "userUuid": app.project.id + '-gruser',
        //     "posterItemId": returnedMediaOId,
        //     "type":"POSTER_ITEM"
        //   };
        //   Skeletor.Mobile.mqtt.publish('IAMPOSTERIN',JSON.stringify(mediaItemUpdateObj));

        //   // dealing with OISE end
        //   // when we get back the mongo id, we add it to the object so that we can patch later
        //   view.model.set('item_mongo_txt_id', returnedTextOId);
        //   view.model.set('item_mongo_media_id', returnedMediaOId);
        //   view.model.set('body', bodyText);
        //   view.model.set('url', url);
        //   view.model.set('published', true);
        //   view.model.set('modified_at', new Date());
        //   view.model.save();
        //   jQuery('#media-chunk-upload-spinner').addClass('hidden');
        //   jQuery().toastmessage('showSuccessToast', "Sent to your poster!");

        //   view.model = null;
        //   jQuery('.input-field').val('');
        //   jQuery('#media-chunk-media-holder').html('');
        //   view.switchToChunkView();
        // })
        // .fail(function (v1) {
        //   jQuery('#media-chunk-upload-spinner').addClass('hidden');
        //   jQuery().toastmessage('showErrorToast', "There has been an error with poster creation! Please request technical support");

        //   //handle the error here - deleting from Tony's DB
        // });
      } else {
        jQuery().toastmessage('showErrorToast', "Please select media and add a caption...");
      }
    },

    checkForAutoSave: function(ev) {
      var view = this,
          field = ev.target.name,
          input = ev.target.value;
      // clear timer on keyup so that a save doesn't happen while typing
      app.clearAutoSaveTimer();

      // save after 10 keystrokes
      app.autoSave(view.model, field, input, false);

      // setting up a timer so that if we stop typing we save stuff after 5 seconds
      app.autoSaveTimer = setTimeout(function(){
        app.autoSave(view.model, field, input, true);
      }, 5000);
    },

    switchToChunkView: function() {
      app.hideAllContainers();
      jQuery('#project-poster-chunk-screen').removeClass('hidden');
    },

    addOne: function (tileModel) {
      var view = this;

      // check if the chunk already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (view.$el.find("[data-id='" + tileModel.id + "']").length === 0 ) {
        // wake up the project model
        tileModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        var tileContainer = jQuery('<li class="tile-container col-xs-12 col-sm-4 col-lg-3" data-id="'+tileModel.id+'"></li>');

        var posterTileView = new app.View.PosterTile({el: tileContainer, model: tileModel});
        var listToAddTo = view.$el.find('.tiles-list');
        listToAddTo.prepend(posterTileView.render().el);
      } else {
        console.log("The tile with id <"+tileModel.id+"> wasn't added since it already exists in the DOM");
      }
    },

    addAll: function (view) {
      // sort newest to oldest (prepend!)
      Skeletor.Model.awake.tiles.comparator = function(model) {
        return model.get('created_at');
      };

      var myPublishedMediaTiles = Skeletor.Model.awake.tiles.sort().where({published: true, project_id: app.project.id, type: 'media'});

      // clear the house
      view.$el.find('.tiles-list').html("");

      myPublishedMediaTiles.forEach(function (mediaTile) {
        view.addOne(mediaTile);
      });
    },

    render: function() {
      var view = this;
      console.log("Rendering ProjectPosterMediaChunkView...");

      // need to clear img/vid because this may not hit either if...
      jQuery('#media-chunk-media-holder').html('');

      jQuery('#media-chunk-body-input').val(view.model.get('body'));
      if (view.model.get('type') === "media" && view.model.get('url') && app.photoOrVideo(view.model.get('url')) === "photo") {
        jQuery('#media-chunk-media-holder').html('<img src="' + view.model.get('url') + '"/>');
        // WARNING: chunks are currently saved *with the pikachu part in the url*. This is inconsistent with the rest of what we do - TODO!
      } else if (view.model.get('type') === "media" && view.model.get('url') && app.photoOrVideo(view.model.get('url')) === "video") {
        jQuery('#media-chunk-media-holder').html('<video src="' + view.model.get('url') + '" controls />');
        // WARNING: chunks are currently saved *with the pikachu part in the url*. This is inconsistent with the rest of what we do - TODO!
      }

      view.addAll(view);
    }
  });


  /**
    ReviewView
    This is one part of ReviewsView which shows many parts
  **/
  app.View.ReviewView = Backbone.View.extend({
    template: _.template("<button class='project-to-review-btn btn' data-id='<%= _id %>'><%= theme %> - <%= name %></button>"),

    events: {
      'click .project-to-review-btn' : 'switchToProjectDetailsView',
    },

    render: function() {
      var view = this;
      // remove all classes from root element
      view.$el.removeClass();

      // hiding unpublished proposals
      if (view.model.get('proposal').published === false) {
        view.$el.addClass('hidden');
      }

      // here we decide on where to show the review
      if (view.model.get('proposal').review_published === true) { // Is review published
        view.$el.addClass('box4');
      } else if (view.model.get('proposal').review_published === false && !view.model.get('proposal').write_lock) { // unpublished and without write lock --> up for grabs!
        view.$el.addClass('box2');
      } else if (view.model.get('proposal').review_published === false && view.model.get('proposal').write_lock === app.project.get('name')) { // unpublished and with write lock from our project
        view.$el.addClass('box1');
      } else if (view.model.get('proposal').review_published === false && view.model.get('proposal').write_lock && view.model.get('proposal').write_lock !== app.project.get('name')) { // unpublished and with write lock from other projects
        view.$el.addClass('box3');
      } else {
        view.$el.addClass('fail');
      }

      view.$el.html(this.template(view.model.toJSON()));

      // Treat review of own project differently
      if (app.project && view.model.get('name') === app.project.get('name')) {
        // set a class to a) lock the project from being edited by us
        view.$el.find('button').addClass('own-review');
      }

      return this;
    },

    initialize: function () {
      var view = this;
      //console.log('Initializing ReviewView...', view.el);

      view.model.on('change', view.render, view);

      return view;
    },

    switchToProjectDetailsView: function(ev) {
      var view = this;
      // would it be better to instantiate a new model/view here each time?
      // app.reviewDetailsView.model = Skeletor.Model.awake.projects.get(jQuery(ev.target).data("id"));
      app.reviewDetailsView.model = view.model;
      jQuery('#review-overview-screen').addClass('hidden');
      jQuery('#review-details-screen').removeClass('hidden');
      app.reviewDetailsView.render();
    }
  });

  /**
    ReviewsView
  **/
  app.View.ReviewsView = Backbone.View.extend({
    template: _.template('<h2 class="box1">Reviews locked by our project team but not finished</h2><h2 class="box2">Select a proposal to review</h2><h2 class="box3">Reviews locked by other project teams but not finished</h2><h2 class="box4">Completed reviews</h2>'),

    initialize: function() {
      var view = this;
      // console.log('Initializing ReviewsView...', view.el);

      // TODO: This has to be here since elements that are unpublished are not show but add fires on creation. So we have to catch the change :(
      view.collection.on('change', function(n) {
        view.render();
      });

      view.collection.on('add', function(n) {
        // view.addOne(n);
        view.render();
      });

      return view;
    },

    events: {
      'click .project-to-review-btn' : 'switchToProjectDetailsView',
    },


    addOne: function(proj) {
      var view = this;
      // wake up the project model
      proj.wake(app.config.wakeful.url);
      var reviewItemView = new app.View.ReviewView({model: proj});
      var listToAddTo = view.$el.find('.inner-wrapper');
      listToAddTo.append(reviewItemView.render().el);
    },

    render: function () {
      var view = this;
      console.log("Rendering ReviewsView...");

      // clear the area
      view.$el.find('.inner-wrapper').html('');

      // add the headers
      var headers = view.template();
      view.$el.find('.inner-wrapper').append(headers);

      // sort by theme
      view.collection.comparator = function(model) {
        return model.get('theme');
      };

      var publishedProjectProposals = view.collection.sort().filter(function(proj) {
        return (app.project && proj.get('proposal').published === true && proj.get('theme'));
      });

      publishedProjectProposals.forEach(function(proposal) {
        view.addOne(proposal);
      });
    }

  });


  /**
    ReviewDetailsView
  **/
  app.View.ReviewDetailsView = Backbone.View.extend({
    template: '',
    // template: '#review-details-template',

    initialize: function () {
      var view = this;
      console.log('Initializing ReviewDetailsView...', view.el);

      view.template = _.template(jQuery('#review-details-template').text());

      return view;
    },

    events: {
      'click #return-to-overview-btn' : 'switchToProjectOverviewView',
      'click #publish-review-btn'     : 'publishReview',
      'click #cancel-review-btn'      : 'cancelReview',
      'keyup :input'                  : 'startModifying'
    },

    publishReview: function() {
      var view = this;

      var reviewResearchQuestion = jQuery('#review-details-screen [name=review_research_question]').val();
      var reviewNeedToKnows = jQuery('#review-details-screen [name=review_need_to_knows]').val();

      if (reviewResearchQuestion.length > 0 && reviewNeedToKnows.length > 0) {
        app.clearAutoSaveTimer();
        var proposal = view.model.get('proposal');
        proposal.review_research_question = jQuery('#review-details-screen [name=review_research_question]').val();
        proposal.review_need_to_knows = jQuery('#review-details-screen [name=review_need_to_knows]').val();
        proposal.reviewer = app.groupname;
        proposal.review_published = true;
        view.model.set('proposal',proposal);
        // view.switchToProjectOverviewView();
        view.model.save();
        jQuery().toastmessage('showSuccessToast', "Your review has been sent!");
        view.switchToProjectOverviewView();
      } else {
        jQuery().toastmessage('showErrorToast', "Please complete your review before submitting...");
      }
    },

    cancelReview: function() {
      var view = this;

      if (confirm("Are you sure you want to delete this review?")) {
        app.clearAutoSaveTimer();
        var proposal = view.model.get('proposal');
        proposal.review_research_question = "";
        proposal.review_need_to_knows = "";
        // Also remove the lock
        delete proposal.write_lock;
        view.model.set('proposal',proposal);
        view.model.save();
        jQuery('.input-field').val('');
        view.switchToProjectOverviewView();
      }
    },

    switchToProjectOverviewView: function(ev) {
      var view = this;
      // view.model = null;
      jQuery('#review-details-screen').addClass('hidden');
      jQuery('#review-overview-screen').removeClass('hidden');
      app.reviewsView.render(); // I hate this but somehow all other clients rerender but not ourselves
    },

    startModifying: function(ev) {
      var view = this;

      // set a write lock on the model
      var proposal = view.model.get('proposal');
      proposal.write_lock = app.project.get('name');
      view.model.save();

      view.checkForAutoSave(ev);
    },

    checkForAutoSave: function(ev) {
      var view = this,
          field = ev.target.name,
          input = ev.target.value;
      // clear timer on keyup so that a save doesn't happen while typing
      app.clearAutoSaveTimer();

      // save after 10 keystrokes
      app.autoSave(view.model, field, input, false, jQuery(ev.target).data("nested"));

      // setting up a timer so that if we stop typing we save stuff after 5 seconds
      app.autoSaveTimer = setTimeout(function(){
        app.autoSave(view.model, field, input, true, jQuery(ev.target).data("nested"));
      }, 5000);
    },

    render: function () {
      var view = this;
      console.log("Rendering ReviewDetailsView...");
      // clearing the root element of the view
      view.$el.html("");
      // create json object from model
      var modJson = view.model.toJSON();
      var pWriteLock = view.model.get('proposal').write_lock;
      // if the proposal has a write lock
      if (typeof pWriteLock === 'undefined' || pWriteLock === null || pWriteLock === app.project.get('name')) {
        modJson.write_lock = false;
      } else {
        modJson.write_lock = true;
      }

      // We now show reviews for our own projects and when a user enters we treat it as if it locked but we don;t use the lock
      if (!modJson.write_lock && app.project && view.model.get('name') === app.project.get('name')) {
        modJson.write_lock = true;
      }

      // create everything by rendering a template
      view.$el.html(view.template(modJson));
      return view;
    }

  });

  this.Skeletor = Skeletor;
}).call(this);
