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
  var MAX_FILE_SIZE = 20971520;     // 20 Mb


  /***********************************************************
   ***********************************************************
   *********************** NOTES VIEWS ***********************
   ***********************************************************
   ***********************************************************/

   /**
    ** Note View
    **/
   app.View.Note = Backbone.View.extend({
     textTemplate: "#text-note-template",
     photoTemplate: "#photo-note-template",
     videoTemplate: "#video-note-template",

     events: {
       'click' : 'editNote'
     },

     initialize: function () {
       var view = this;

       view.model.on('change', function () {
         view.render();
       });

       return view;
     },

     editNote: function(ev) {
       var view = this;

       app.hideAllContainers();

       app.notesWriteView.model = view.model;
       jQuery('#notes-write-screen').removeClass('hidden');
       app.notesWriteView.render();
     },

     render: function () {
       var view = this,
           note = view.model,
           noteType,
           firstMediaUrl,
           listItemTemplate,
           listItem;

       // determine what kind of note this is, ie what kind of template do we want to use
       if (note.get('media').length === 0) {
         noteType = "text";
       } else if (note.get('media').length > 0) {
         firstMediaUrl = note.get('media')[0];
         if (app.photoOrVideo(firstMediaUrl) === "photo") {
           noteType = "photo";
         } else if (app.photoOrVideo(firstMediaUrl) === "video") {
           noteType = "video";
         } else {
           jQuery().toastmessage('showErrorToast', "You have uploaded a file that is not a supported file type! How did you manage to sneak it in there? Talk to Colin to resolve the issue...");
         }
       } else {
         throw "Unknown note type!";
       }

       var date = new Date(view.model.get('created_at'));
       date = date.toLocaleString();

       if (noteType === "text") {
         //if class is not set do it
         if (!view.$el.hasClass('note-container')) {
           view.$el.addClass('note-container');
         }
         listItemTemplate = _.template(jQuery(view.textTemplate).text());
         listItem = listItemTemplate({ 'id': note.get('_id'), 'title': note.get('title'), 'body': note.get('body'), 'author': '- '+note.get('author'), 'date': date });
       } else if (noteType === "photo") {
         // if class is not set do it
         if (!view.$el.hasClass('photo-note-container')) {
           view.$el.addClass('photo-note-container');
         }
         listItemTemplate = _.template(jQuery(view.photoTemplate).text());
         listItem = listItemTemplate({ 'id': note.get('_id'), 'title': note.get('title'), 'url': app.config.pikachu.url + firstMediaUrl, 'author': '- '+note.get('author'), 'date': date });
       } else if (noteType === "video") {
         // if class is not set do it
         if (!view.$el.hasClass('video-note-container')) {
           view.$el.addClass('video-note-container');
         }
         listItemTemplate = _.template(jQuery(view.videoTemplate).text());
         listItem = listItemTemplate({ 'id': note.get('_id'), 'title': note.get('title'), 'url': app.config.pikachu.url + firstMediaUrl, 'author': '- '+note.get('author'), 'date': date });
       }
       else {
         throw "Unknown note type!";
       }

       // add the myNote class if needed
       if (note.get('note_type_tag') === "Big Idea") {
         view.$el.addClass('classNote');
       } else if (note.get('author') === app.username) {
         view.$el.addClass('myNote');
       }

       // Add the newly generated DOM elements to the view's part of the DOM
       view.$el.html(listItem);

       return view;
     }
   });



  /**
    NotesReadView
  **/
  app.View.NotesReadView = Backbone.View.extend({
    initialize: function () {
      var view = this;
      console.log('Initializing NotesReadView...', view.el);

      // populate the dropdown
      jQuery('#notes-read-screen .note-type-selector').html('');
      _.each(app.noteTypes, function(k, v) {
        jQuery('#notes-read-screen .note-type-selector').append('<option value="'+v+'">'+v+'</option>');
      });

      /* We should not have to listen to change on collection but on add. However, due to wakefulness
      ** and published false first we would see the element with add and see it getting created. Also not sure
      ** how delete would do and so on.
      ** IMPORTANT: in addOne we check if the id of the model to be added exists in the DOM and only add it to the DOM if it is new
      */
      view.collection.on('change', function(n) {
        if (n.get('published') === true) {
          view.addOne(n);
        }
      });

      /*
      ** See above, but mostly we would want add and change in the note view. But due to wakeness and published flag
      ** we are better off with using change and filtering to react only if published true.
      ** IMPORTANT: in addOne we check that id isn't already in the DOM
      */
      view.collection.on('add', function(n) {
        if (n.get('published') === true) {
          view.addOne(n);
        }
      });

      return view;
    },

    events: {
      'click .nav-write-btn'              : 'createNote',
      'change .habitat-selector'          : 'habitatChanged',
      'click .species-button'             : 'speciesSelected',
      'change .note-type-selector'        : 'render'
    },

    habitatChanged: function() {
      var view = this;
      app.habitatSelectorChange("notes-read-screen");
      app.setHabitat("notes-write-screen", jQuery('#notes-read-screen .habitat-selector').val());       // Tom request
      view.render();
    },

    speciesSelected: function(ev) {
      var view = this;
      app.clickHandler(jQuery(ev.target).data('species-index'), "notes-read-screen");
      view.render();
    },

    createNote: function(ev) {
      var view = this;
      var m;

      // check if we need to resume
      // BIG NB! We use author here! This is the only place where we care about app.username (we want you only to be able to resume your own notes)
      var noteToResume = view.collection.findWhere({author: app.username, published: false});

      if (noteToResume) {
        // RESUME NOTE
        console.log("Resuming...");
        m = noteToResume;
      } else {
        // NEW NOTE
        console.log("Starting a new note...");
        m = new Model.Note();
        m.set('author', app.username);
        m.set('note_type_tag', "Note Type");        // set these all to the default
        m.wake(app.config.wakeful.url);
        m.save();
        view.collection.add(m);
      }

      app.notesWriteView.model = m;
      app.notesWriteView.model.wake(app.config.wakeful.url);

      app.hideAllContainers();
      jQuery('#notes-write-screen').removeClass('hidden');
      //app.resetSelectorValue("notes-write-screen");         // Tom request
      app.notesWriteView.render();
    },

    addOne: function(noteModel) {
      var view = this;

      // check if the note already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (view.$el.find("[data-id='" + noteModel.id + "']").length === 0 ) {
        // wake up the project model
        noteModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        var noteContainer = jQuery('<li class="note-container col-xs-12 col-sm-4 col-lg-3" data-id="'+noteModel.id+'"></li>');

        var noteView = new app.View.Note({el: noteContainer, model: noteModel});
        var listToAddTo = view.$el.find('.notes-list');
        listToAddTo.prepend(noteView.render().el);
      } else {
        console.log("The note with id <"+noteModel.id+"> wasn't added since it already exists in the DOM");
      }
    },

    render: function() {
      var view = this;
      console.log("Rendering NotesReadView...");

      // sort newest to oldest (prepend!)
      view.collection.comparator = function(model) {
        return model.get('created_at');
      };

      var criteria = {published: true};
      // if note type has pull down has a value
      var noteType = jQuery('#notes-read-screen .note-type-selector :selected').val();
      if (noteType !== "Note Type") {
        criteria.note_type_tag = noteType;
      }
      var noteTypeFilteredCollection = view.collection.sort().where(criteria);

      var screenId = "#notes-read-screen";
      // if a habitat has been selected
      var habitatFilteredCollection = null;
      var targetIndex = jQuery('#notes-read-screen .habitat-selector :selected').val();
      if (targetIndex === "A") {
        // all notes
        habitatFilteredCollection = noteTypeFilteredCollection;
      } else if (targetIndex === "?") {
        // no notes
        habitatFilteredCollection = null;
      } else {
        // filter for habitat number
        habitatFilteredCollection = noteTypeFilteredCollection.filter(function(model) {
          return model.get('habitat_tag') && model.get('habitat_tag').index === parseInt(targetIndex);
        });
      }

      // if one or more species have been selected (uses AND)
      var speciesFilteredCollection = null;
      var speciesIndexArray = app.getSpeciesValues(screenId);
      if (speciesIndexArray.length > 0) {
        speciesFilteredCollection = habitatFilteredCollection.filter(function(model) {
          console.log(model);
          // all value in selector must be in species_tags
          if (_.difference(speciesIndexArray, _.pluck(model.get("species_tags"), "index")).length === 0) {
            return model;
          }
        });
      } else {
        speciesFilteredCollection = habitatFilteredCollection;
      }

      // clear the house
      view.$el.find('.notes-list').html("");

      // if the collection is not empty (eg habitat ?)
      if (habitatFilteredCollection) {
        speciesFilteredCollection.forEach(function (note) {
          view.addOne(note);
        });
      }
    }
  });


  /**
    NotesWriteView
  **/
  app.View.NotesWriteView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing NotesWriteView...', view.el);

      // populate the dropdown (maybe move this since, it'll be used a lot of places)
      jQuery('#notes-write-screen .note-type-selector').html('');
      _.each(app.noteTypes, function(k, v) {
        jQuery('#notes-write-screen .note-type-selector').append('<option value="'+v+'">'+v+'</option>');
      });
    },

    events: {
      'click .nav-read-btn'               : 'switchToReadView',
      'change .note-type-selector'        : 'updateNoteType',
      'change .habitat-selector'          : 'habitatChanged',
      'click .species-button'             : 'speciesSelected',
      'change #photo-file'                : 'uploadMedia',
      'click .remove-btn'                 : 'removeOneMedia',
      'click .publish-note-btn'           : 'publishNote',
      'click #lightbulb-icon'             : 'showSentenceStarters',
      'click .sentence-starter'           : 'appendSentenceStarter',
      'click .photo-container'            : 'openPhotoModal',
      'keyup :input'                      : 'checkForAutoSave'
    },

    habitatChanged: function() {
      var view = this;
      app.habitatSelectorChange("notes-write-screen");
      view.model.set('habitat_tag', app.getHabitatObject("notes-write-screen"));
      view.model.save();

      app.setHabitat("notes-read-screen", jQuery('#notes-write-screen .habitat-selector').val());         // Tom request
    },

    speciesSelected: function(ev) {
      var view = this;
      app.clickHandler(jQuery(ev.target).data('species-index'), "notes-write-screen");
      view.model.set('species_tags', app.getSpeciesObjectsArray());
      view.model.save();
    },

    updateNoteType: function(ev) {
      var view = this;
      var noteType = jQuery('#notes-write-screen .note-type-selector :selected').val();
      view.model.set('note_type_tag', noteType);
      view.model.save();

      jQuery('#sentence-starter-modal .modal-body').html('');
      if (app.noteTypes[noteType]) {
        _.each(app.noteTypes[noteType], function(s) {
          jQuery('#sentence-starter-modal .modal-body').append('<div><button class="btn sentence-starter">'+s+'</button></div>');
        });
      } else {
        console.error('No sentence starters for this note type!');
      }

      // Big Idea colour
      if (noteType === "Big Idea") {
        jQuery('#notes-write-screen .input-field').css('border', '1px solid #DB67E6');
        jQuery('#note-body-input').attr('placeholder', 'Anyone can edit this note...');
      } else {
        jQuery('#notes-write-screen .input-field').css('border', '1px solid #237599');
        jQuery('#note-body-input').attr('placeholder', '');
      }
    },

    showSentenceStarters: function() {
      jQuery('#sentence-starter-modal').modal({keyboard: true, backdrop: true});
    },

    openPhotoModal: function(ev) {
      var view = this;
      var url = jQuery(ev.target).attr('src');
      //the fileName isn't working for unknown reasons - so we can't add metadata to the photo file name, or make them more human readable. Also probably doesn't need the app.parseExtension(url)
      //var fileName = view.model.get('author') + '_' + view.model.get('title').slice(0,8) + '.' + app.parseExtension(url);
      jQuery('#photo-modal .photo-content').attr('src', url);
      jQuery('#photo-modal .download-photo-btn a').attr('href',url);
      //jQuery('#photo-modal .download-photo-btn a').attr('download',fileName);
      jQuery('#photo-modal').modal({keyboard: true, backdrop: true});
    },

    appendSentenceStarter: function(ev) {
      // add the sentence starter text to the current body (note that this won't start the autoSave trigger)
      var bodyText = jQuery('#note-body-input').val();
      bodyText += jQuery(ev.target).text();
      jQuery('#note-body-input').val(bodyText);

      jQuery('#sentence-starter-modal').modal('hide');
    },

    uploadMedia: function() {
      var view = this;

      var file = jQuery('#photo-file')[0].files.item(0);
      var formData = new FormData();
      formData.append('file', file);

      if (file.size < MAX_FILE_SIZE) {
        jQuery('#photo-upload-spinner').removeClass('hidden');
        jQuery('.upload-icon').addClass('invisible');
        jQuery('.publish-note-btn').addClass('disabled');

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
      } else {
        jQuery().toastmessage('showErrorToast', "Max file size of 20MB exceeded");
        jQuery('.upload-icon').val('');
      }

      function failure(err) {
        jQuery('#photo-upload-spinner').addClass('hidden');
        jQuery('.upload-icon').removeClass('invisible');
        jQuery('.publish-note-btn').removeClass('disabled');
        jQuery().toastmessage('showErrorToast', "Photo could not be uploaded. Please try again");
      }

      function success(data, status, xhr) {
        jQuery('#photo-upload-spinner').addClass('hidden');
        jQuery('.upload-icon').removeClass('invisible');
        jQuery('.publish-note-btn').removeClass('disabled');
        console.log("UPLOAD SUCCEEDED!");
        console.log(xhr.getAllResponseHeaders());

        // clear out the label value if they for some reason want to upload the same thing...
        jQuery('.upload-icon').val('');

        // update the model
        var mediaArray = view.model.get('media');
        mediaArray.push(data.url);
        view.model.set('media', mediaArray);
        view.model.save();
        // update the view (TODO: bind this to an add event, eg do it right)
        view.appendOneMedia(data.url);

        // one lightweight way of doing captions for this wallcology - but only do it once (eg if length is one)
        if (mediaArray.length === 1) {
          var noteBodyText = jQuery('#note-body-input').val();
          jQuery('#note-body-input').val(noteBodyText + '\n\nNotes on pictures and videos: ');
        }
      }

    },

    checkForAutoSave: function(ev) {
      var view = this,
          field = ev.target.name,
          input = ev.target.value;
      // clear timer on keyup so that a save doesn't happen while typing
      app.clearAutoSaveTimer();

      // save after 10 keystrokes - now 20
      app.autoSave(view.model, field, input, false);

      // setting up a timer so that if we stop typing we save stuff after 5 seconds
      app.autoSaveTimer = setTimeout(function(){
        app.autoSave(view.model, field, input, true);
      }, 5000);
    },

    publishNote: function() {
      var view = this;
      var title = jQuery('#note-title-input').val();
      var body = jQuery('#note-body-input').val();
      var noteType = jQuery('#notes-write-screen .note-type-selector :selected').val();

      if (title.length > 0 && body.length > 0 && noteType !== "Note Type") {
        app.clearAutoSaveTimer();
        view.model.set('title',title);
        view.model.set('body',body);
        view.model.set('habitat_tag', app.getHabitatObject("notes-write-screen"));        // Tom request
        view.model.set('species_tags', app.getSpeciesObjectsArray());                     // Tom request
        view.model.set('published', true);
        view.model.set('modified_at', new Date());

        if (noteType === "Big Idea") {
          view.model.set('write_lock', "");
          view.model.set('author','class note');
        }

        view.model.save();
        jQuery().toastmessage('showSuccessToast', "Published to the note wall!");

        view.switchToReadView();
      } else {
        jQuery().toastmessage('showErrorToast', "You must complete both fields and select a note type to submit your note...");
      }
    },

    switchToReadView: function() {
      var view = this;
      app.hideAllContainers();
      jQuery('#notes-read-screen').removeClass('hidden');
      // needs to unlock on back button as well
      if (view.model.get('note_type_tag') === "Big Idea" && view.model.get('write_lock') === app.username) {
        view.model.set('write_lock', "");
        view.model.set('author','class note');
        view.model.save();
      }

      view.model = null;
      jQuery('.input-field').val('');
      // resets in the case of Big Idea
      jQuery('#notes-write-screen .input-field').css('border', '1px solid #237599');
      jQuery('#note-body-input').attr('placeholder', '');

      // app.resetSelectorValue("notes-write-screen");        // Tom request
      // app.resetSelectorValue("notes-read-screen");         // Tom request

      // rerender everything
      app.notesReadView.render();
    },

    // TODO: this can be done more cleanly/backbonely with views for the media containers
    appendOneMedia: function(url) {
      var el;

      if (app.photoOrVideo(url) === "photo") {
        el = '<span class="media-container" data-url="'+url+'"><img src="'+app.config.pikachu.url+url+'" class="media photo-container img-responsive"></img><i class="fa fa-times fa-2x remove-btn editable" data-url="'+url+'"/></span>';
      } else if (app.photoOrVideo(url) === "video") {
        el = '<span class="media-container" data-url="'+url+'"><video src="' + app.config.pikachu.url+url + '" class="camera-icon img-responsive" controls /><i class="fa fa-times fa-2x remove-btn editable" data-url="'+url+'"/></span>';
      } else {
        el = '<img src="img/camera_icon.png" class="media img-responsive" alt="camera icon" />';
        throw "Error trying to append media - unknown media type!";
      }
      jQuery('#note-media-container').append(el);
    },

    removeOneMedia: function(ev) {
      var view = this;
      var targetUrl = jQuery(ev.target).data('url');
      var mediaArray = view.model.get('media');
      var newMediaArray = [];
      _.each(mediaArray, function(url, i) {
        if (mediaArray[i] !== targetUrl) {
          newMediaArray.push(mediaArray[i]);
        }
      });
      view.model.set('media', newMediaArray);
      view.model.save();

      jQuery('.media-container[data-url="'+targetUrl+'"]').remove();
      // clearing this out so the change event for this can be used (eg if they upload the same thing)
      jQuery('.upload-icon').val('');
    },

    render: function () {
      var view = this;
      console.log("Rendering NotesWriteView...");

      // FOR BRENDA - CAN BE REMOVED IN A COUPLE DAYS
      var date = new Date(view.model.get('created_at'));
      jQuery('#date-container').text(date.toLocaleString());

      if (view.model.get('habitat_tag')) {
        app.setHabitat("notes-write-screen", view.model.get('habitat_tag').index);
      }
      if (view.model.get('species_tags')) {
        app.setSpecies(_.pluck(view.model.get('species_tags'), 'index'));
      }

      jQuery('#notes-write-screen .note-type-selector').val(view.model.get('note_type_tag'));
      jQuery('#note-title-input').val(view.model.get('title'));
      jQuery('#note-body-input').val(view.model.get('body'));
      jQuery('#note-media-container').html('');
      view.model.get('media').forEach(function(url) {
        view.appendOneMedia(url);
      });

      // check is this user is allowed to edit this note
      if (view.model.get('author') === app.username || (view.model.get('note_type_tag') === "Big Idea" && view.model.get('write_lock') === "")) {
        jQuery('#notes-write-screen .editable.input-field').removeClass('uneditable');
        jQuery('#notes-write-screen .editable.input-field').prop("disabled", false);
        jQuery(jQuery('#notes-write-screen .selector-container .editable').children()).prop("disabled", false);
        jQuery('#notes-write-screen .editable').removeClass('disabled');
        if (view.model.get('note_type_tag') === "Big Idea") {
          view.model.set('write_lock', app.username);
          view.model.set('author', app.username+' is editing...');
          view.model.save();
        }
      } else {
        jQuery('#notes-write-screen .editable.input-field').addClass('uneditable');
        jQuery('#notes-write-screen .editable.input-field').prop("disabled", true);
        jQuery(jQuery('#notes-write-screen .selector-container .editable').children()).prop("disabled", true);
        jQuery('#notes-write-screen .editable').addClass('disabled');
      }
    }
  });



  /***********************************************************
   ***********************************************************
   ******************** RELATIONSHIP VIEWS *******************
   ***********************************************************
   ***********************************************************/


  /**
   ** Relationship View
   **/
  app.View.Relationship = Backbone.View.extend({
    textTemplate: "#text-relationship-template",
    photoTemplate: "#photo-relationship-template",
    videoTemplate: "#video-relationship-template",

    events: {
      'click' : 'editRelationship'
    },

    initialize: function () {
      var view = this;

      view.model.on('change', function () {
        view.render();
      });

      return view;
    },

    editRelationship: function(ev) {
      var view = this;

      app.hideAllContainers();

      app.relationshipsWriteView.model = view.model;
      jQuery('#relationships-write-screen').removeClass('hidden');
      app.relationshipsWriteView.render();
    },

    render: function () {
      var view = this,
          relationship = view.model,
          relationshipType,
          firstMediaUrl,
          listItemTemplate,
          listItem;

      // determine what kind of relationship this is, ie what kind of template do we want to use
      if (relationship.get('media').length === 0) {
        relationshipType = "text";
      } else if (relationship.get('media').length > 0) {
        firstMediaUrl = relationship.get('media')[0];
        if (app.photoOrVideo(firstMediaUrl) === "photo") {
          relationshipType = "photo";
        } else if (app.photoOrVideo(firstMediaUrl) === "video") {
          relationshipType = "video";
        } else {
          jQuery().toastmessage('showErrorToast', "You have uploaded a file that is not a supported file type! How did you manage to sneak it in there? Talk to Colin to resolve the issue...");
        }
      } else {
        throw "Unknown relationship type!";
      }

      var date = new Date(view.model.get('created_at'));
      date = date.toLocaleString();

      if (relationshipType === "text") {
        //if class is not set do it
        if (!view.$el.hasClass('relationship-container')) {
          view.$el.addClass('relationship-container');
        }
        listItemTemplate = _.template(jQuery(view.textTemplate).text());
        listItem = listItemTemplate({ 'id': relationship.get('_id'), 'title': relationship.get('title'), 'body': relationship.get('body'), 'author': '- '+relationship.get('author'), 'date': date });
      } else if (relationshipType === "photo") {
        // if class is not set do it
        if (!view.$el.hasClass('photo-relationship-container')) {
          view.$el.addClass('photo-relationship-container');
        }
        listItemTemplate = _.template(jQuery(view.photoTemplate).text());
        listItem = listItemTemplate({ 'id': relationship.get('_id'), 'title': relationship.get('title'), 'url': app.config.pikachu.url + firstMediaUrl, 'author': '- '+relationship.get('author'), 'date': date });
      } else if (relationshipType === "video") {
        // if class is not set do it
        if (!view.$el.hasClass('video-relationship-container')) {
          view.$el.addClass('video-relationship-container');
        }
        listItemTemplate = _.template(jQuery(view.videoTemplate).text());
        listItem = listItemTemplate({ 'id': relationship.get('_id'), 'title': relationship.get('title'), 'url': app.config.pikachu.url + firstMediaUrl, 'author': '- '+relationship.get('author'), 'date': date });
      }
      else {
        throw "Unknown relationship type!";
      }

      // add the myRelationship class if needed
      if (relationship.get('author') === app.username) {
        view.$el.addClass('myRelationship');
      }

      // Add the newly generated DOM elements to the view's part of the DOM
      view.$el.html(listItem);

      return view;
    }
  });



  /**
    RelationshipsReadView
  **/
  app.View.RelationshipsReadView = Backbone.View.extend({
    initialize: function () {
      var view = this;
      console.log('Initializing RelationshipsReadView...', view.el);

      /* We should not have to listen to change on collection but on add. However, due to wakefulness
      ** and published false first we would see the element with add and see it getting created. Also not sure
      ** how delete would do and so on.
      ** IMPORTANT: in addOne we check if the id of the model to be added exists in the DOM and only add it to the DOM if it is new
      */
      view.collection.on('change', function(n) {
        if (n.get('published') === true) {
          view.addOne(n);
          view.createAggregateTable();
        }
      });

      /*
      ** See above, but mostly we would want add and change in the relationship view. But due to wakeness and published flag
      ** we are better off with using change and filtering to react only if published true.
      ** IMPORTANT: in addOne we check that id isn't already in the DOM
      */
      view.collection.on('add', function(n) {
        if (n.get('published') === true) {
          view.addOne(n);
        }
      });

      return view;
    },

    events: {
      'click .nav-write-btn'               : 'createRelationship',
      'change .relationship-type-selector' : 'render',
      'change .habitat-selector'           : 'habitatChanged',
      'click .species-button'              : 'speciesSelected'
    },

    habitatChanged: function() {
      var view = this;
      app.habitatSelectorChange("relationships-read-screen");
      view.render();
    },

    speciesSelected: function(ev) {
      var view = this;
      app.clickHandler(jQuery(ev.target).data('species-index'), "relationships-read-screen");
      view.render();
    },

    createRelationship: function(ev) {
      var view = this;
      var m;

      // check if we need to resume
      // BIG NB! We use author here! This is the only place where we care about app.username (we want you only to be able to resume your own relationships)
      var relationshipToResume = view.collection.findWhere({author: app.username, published: false});

      if (relationshipToResume) {
        // RESUME NOTE
        console.log("Resuming...");
        m = relationshipToResume;
      } else {
        // NEW NOTE
        console.log("Starting a new relationship...");
        m = new Model.Relationship();
        m.set('author', app.username);
        m.set('from_species_index', '');
        m.set('to_species_index', '');
        m.wake(app.config.wakeful.url);
        m.save();
        view.collection.add(m);
      }

      app.relationshipsWriteView.model = m;
      app.relationshipsWriteView.model.wake(app.config.wakeful.url);

      app.hideAllContainers();
      jQuery('#relationships-write-screen').removeClass('hidden');
      app.resetSelectorValue("relationships-write-screen");
      app.relationshipsWriteView.render();
    },

    addOne: function(relationshipModel) {
      var view = this;

      // check if the relationship already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (view.$el.find("[data-id='" + relationshipModel.id + "']").length === 0 ) {
        // wake up the project model
        relationshipModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        var relationshipContainer = jQuery('<li class="relationship-container col-xs-12 col-sm-4 col-lg-3" data-id="'+relationshipModel.id+'"></li>');

        var relationshipView = new app.View.Relationship({el: relationshipContainer, model: relationshipModel});
        var listToAddTo = view.$el.find('.relationships-list');
        listToAddTo.prepend(relationshipView.render().el);
      } else {
        console.log("The relationship with id <"+relationshipModel.id+"> wasn't added since it already exists in the DOM");
      }
    },

    createAggregateTable: function() {
      var view = this;
      var screenId = "#relationships-read-screen";
      var habitatObj = app.getHabitatObject("relationships-read-screen");
      var pageSpeciesArr = [];
      var ourSpeciesArr = app.getSpeciesObjectsArray();

      // create an array of objects with index and url (a lot of this is legacy from the old selector)
      _.each(_.pluck(app.images, "selected"), function(img, i) {
        pageSpeciesArr.push({"index":i, "imgUrl":img});
      });

      var publishedCollection = view.collection.where({published: true});
      var habitatFilteredCollection;
      if (jQuery('#relationships-read-screen .habitat-selector :selected').val() === "A") {
        habitatFilteredCollection = publishedCollection;
      } else {
        habitatFilteredCollection = publishedCollection.filter(function(model) {
          return model.get('habitat_tag') && model.get('habitat_tag').index && model.get('habitat_tag').index === habitatObj.index;
        });
      }

      jQuery('#relationships-aggregate').html('');
      var table = '<table class="table table-bordered table-hover"></table>';

      // create the header row
      var headerRow = '<tr><td class="aggregate-cell"></td>';
      _.each(pageSpeciesArr, function(i) {
        headerRow += '<td class="aggregate-cell"><img class="species-box" src="'+i.imgUrl+'"></img></td>';
      });
      headerRow += '</tr>';

      // create all of the other rows
      var remainingRows = '';
      _.each(pageSpeciesArr, function(i) {
        remainingRows += '<tr><td class="aggregate-cell"><img class="species-box" src="'+i.imgUrl+'"></img></td>';
        _.each(pageSpeciesArr, function(j) {
          remainingRows += '<td class="aggregate-cell">';
          var toSpeciesArr = habitatFilteredCollection.filter(function(model) {
            return parseInt(model.get('from_species_index')) === i.index && parseInt(model.get('to_species_index')) === j.index;
          });
          if (toSpeciesArr.length > 0) {
            remainingRows += toSpeciesArr.length;
          }
          remainingRows += '</td>';
        });
        remainingRows += '</tr>';
      });

      jQuery('#relationships-aggregate').html(jQuery(table).html(headerRow+remainingRows));
    },

    render: function() {
      var view = this;
      console.log("Rendering RelationshipsReadView...");
      var screenId = "#relationships-read-screen";

      /************ AGGREGATE *************/

      var habitatObj = app.getHabitatObject("relationships-read-screen");
      if (habitatObj.index !== -1) {
        view.createAggregateTable();
      }

      /************ NOTES LIST ************/

      // sort newest to oldest (prepend!)
      view.collection.comparator = function(model) {
        return model.get('created_at');
      };

      var publishedCollection = view.collection.sort().where({published: true});

      var targetIndex = app.getHabitatObject("relationships-read-screen").index;
      var habitatFilteredCollection = null;
      if (targetIndex === 4) {
        // all notes
        habitatFilteredCollection = publishedCollection;
      } else if (targetIndex === -1) {
        // no notes
        habitatFilteredCollection = null;
      } else {
        // filter for habitat number
        habitatFilteredCollection = publishedCollection.filter(function(model) {
          return model.get('habitat_tag') && model.get('habitat_tag').index && model.get('habitat_tag').index === targetIndex;
        });
      }

      // if one or more species have been selected (uses AND)
      var speciesFilteredCollection = null;
      var speciesArr = app.getSpeciesObjectsArray();
      if (speciesArr.length > 0) {
        speciesFilteredCollection = habitatFilteredCollection.filter(function(model) {
          console.log(model);
          // all value in selector must be in species_tags
          var modelSpeciesIndexArr = [];
          modelSpeciesIndexArr.push(model.get('from_species_index'));
          modelSpeciesIndexArr.push(model.get('to_species_index'));
          if (_.difference(_.pluck(speciesArr, "index"), modelSpeciesIndexArr).length === 0) {
            return model;
          }
        });
      } else {
        speciesFilteredCollection = habitatFilteredCollection;
      }

      // clear the house
      view.$el.find('.relationships-list').html("");

      if (speciesFilteredCollection) {
        speciesFilteredCollection.forEach(function (relationship) {
          view.addOne(relationship);
        });
      }
    }
  });


  /**
    RelationshipsWriteView
  **/
  app.View.RelationshipsWriteView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing RelationshipsWriteView...', view.el);
    },

    events: {
      'click .nav-read-btn'               : 'switchToReadView',
      'change .habitat-selector'          : 'habitatChanged',
      'click .species-button'             : 'speciesSelected',
      'change #relationship-photo-file'   : 'uploadMedia',
      'click .remove-btn'                 : 'removeOneMedia',
      'click .photo-container'            : 'openPhotoModal',
      'click .publish-relationship-btn'   : 'publishRelationship',
      'keyup :input'                      : 'checkForAutoSave'
    },

    habitatChanged: function() {
      var view = this;
      app.habitatSelectorChange("relationships-write-screen");
      jQuery('#exchange-habitat').text("In "+app.getHabitatObject("relationships-write-screen").name);
      view.model.set('habitat_tag', app.getHabitatObject("relationships-write-screen"));

      // clear out the data values and imgs to avoid confusion
      jQuery('.exchange-species-container').data('species-index','');
      jQuery('.exchange-species-container').html('');
      view.model.set('from_species_index', '');
      view.model.set('to_species_index', '');
      view.model.save();
    },

    speciesSelected: function(ev) {
      var view = this;

      // click effect should only go through if they've selected a habitat
      if (jQuery('#relationships-write-screen .habitat-selector').val() !== "?") {
        app.clickHandler(jQuery(ev.target).data('species-index'), "relationships-write-screen");
        var index, tappedOn, url;

        index = jQuery(ev.target).data('species-index');
        url = jQuery(ev.target).attr('src');

        if (app.state[jQuery(ev.target).data('species-index')] === "selected") {
          tappedOn = true;
        } else if (app.state[jQuery(ev.target).data('species-index')] === "unselected") {
          tappedOn = false;
        } else {
          throw "app.state is out of whack or there isnt an index here";
        }

        if (index > -1) {
          if (tappedOn) {
            if (jQuery('#from-species-container').data('species-index').length === 0) {
              // add to from_box
              jQuery('#from-species-container').data('species-index',index);
              jQuery('#from-species-container').html('<img src='+url+'></img>');
              view.model.set('from_species_index', index);
            } else if (jQuery('#to-species-container').data('species-index').length === 0) {
              // add to to_box
              jQuery('#to-species-container').data('species-index',index);
              jQuery('#to-species-container').html('<img src='+url+'></img>');
              view.model.set('to_species_index', index);
            } else {
              console.log('Exceeded max selection');
            }
          } else if (!tappedOn) {
            if (jQuery('#from-species-container').data('species-index') === index) {
              // remove from from box
              jQuery('#from-species-container').data('species-index','');
              jQuery('#from-species-container').html('');
              view.model.set('from_species_index', '');
            } else if (jQuery('#to-species-container').data('species-index') === index) {
              // remove from to box
              jQuery('#to-species-container').data('species-index','');
              jQuery('#to-species-container').html('');
              view.model.set('to_species_index', '');
            } else {
              console.log('Exceeded max selection');
            }
          } else {
            throw "Species button does not produce tappedOn value - maybe the html value changed";
          }
        } else {
          throw "Cannot get index of selected species - the html structure probably changed";
        }
        view.model.save();
      } else {
        jQuery().toastmessage('showWarningToast', "Please select a habitat first");
      }
    },

    openPhotoModal: function(ev) {
      var view = this;
      var url = jQuery(ev.target).attr('src');
      //the fileName isn't working for unknown reasons - so we can't add metadata to the photo file name, or make them more human readable. Also probably doesn't need the app.parseExtension(url)
      //var fileName = view.model.get('author') + '_' + view.model.get('title').slice(0,8) + '.' + app.parseExtension(url);
      jQuery('#relationship-photo-modal .photo-content').attr('src', url);
      jQuery('#relationship-photo-modal .download-photo-btn a').attr('href',url);
      //jQuery('#relationship-photo-modal .download-photo-btn a').attr('download',fileName);
      jQuery('#relationship-photo-modal').modal({keyboard: true, backdrop: true});
    },

    uploadMedia: function() {
      var view = this;

      var file = jQuery('#relationship-photo-file')[0].files.item(0);
      var formData = new FormData();
      formData.append('file', file);

      if (file.size < MAX_FILE_SIZE) {
        jQuery('#relationship-photo-upload-spinner').removeClass('hidden');
        jQuery('.upload-icon').addClass('invisible');
        jQuery('.publish-relationship-btn').addClass('disabled');

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
      } else {
        jQuery().toastmessage('showErrorToast', "Max file size of 20MB exceeded");
        jQuery('.upload-icon').val('');
      }

      function failure(err) {
        jQuery('#relationship-photo-upload-spinner').addClass('hidden');
        jQuery('.upload-icon').removeClass('invisible');
        jQuery('.publish-relationship-btn').removeClass('disabled');
        jQuery().toastmessage('showErrorToast', "Photo could not be uploaded. Please try again");
      }

      function success(data, status, xhr) {
        jQuery('#relationship-photo-upload-spinner').addClass('hidden');
        jQuery('.upload-icon').removeClass('invisible');
        jQuery('.publish-relationship-btn').removeClass('disabled');
        console.log("UPLOAD SUCCEEDED!");
        console.log(xhr.getAllResponseHeaders());

        // clear out the label value if they for some reason want to upload the same thing...
        jQuery('.upload-icon').val('');

        // update the model
        var mediaArray = view.model.get('media');
        mediaArray.push(data.url);
        view.model.set('media', mediaArray);
        view.model.save();
        // update the view (TODO: bind this to an add event, eg do it right)
        view.appendOneMedia(data.url);

        // one lightweight way of doing captions for this wallcology - but only do it once (eg if length is one)
        if (mediaArray.length === 1) {
          var relationshipBodyText = jQuery('#relationship-body-input').val();
          jQuery('#relationship-body-input').val(relationshipBodyText + '\n\nNotes on pictures and videos: ');
        }
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

    publishRelationship: function() {
      var view = this;
      var title = jQuery('#relationship-title-input').val();
      var body = jQuery('#relationship-body-input').val();

      if (title.length > 0 && body.length > 0 && jQuery('#from-species-container').data('species-index') !== "" && jQuery('#to-species-container').data('species-index') !== "") {
        app.clearAutoSaveTimer();
        view.model.set('title',title);
        view.model.set('body',body);
        view.model.set('published', true);
        view.model.set('modified_at', new Date());
        view.model.save();
        jQuery().toastmessage('showSuccessToast', "Published to food web wall!");

        view.switchToReadView();

        view.model = null;
        jQuery('.input-field').val('');
        jQuery('.exchange-species-container').html('');
        jQuery('.exchange-species-container').data('species-index','');

      } else {
        jQuery().toastmessage('showErrorToast', "You must complete all fields to submit your relationship...");
      }
    },

    switchToReadView: function() {
      var view = this;
      app.hideAllContainers();
      jQuery('#relationships-read-screen').removeClass('hidden');

      app.resetSelectorValue("relationships-write-screen");
      app.resetSelectorValue("relationships-read-screen");

      app.relationshipsReadView.render();
    },

    // TODO: this can be done more cleanly/backbonely with views for the media containers
    appendOneMedia: function(url) {
      var el;

      if (app.photoOrVideo(url) === "photo") {
        el = '<span class="media-container" data-url="'+url+'"><img src="'+app.config.pikachu.url+url+'" class="media photo-container img-responsive"></img><i class="fa fa-times fa-2x remove-btn editable" data-url="'+url+'"/></span>';
      } else if (app.photoOrVideo(url) === "video") {
        el = '<span class="media-container" data-url="'+url+'"><video src="' + app.config.pikachu.url+url + '" class="camera-icon img-responsive" controls /><i class="fa fa-times fa-2x remove-btn editable" data-url="'+url+'"/></span>';
      } else {
        el = '<img src="img/camera_icon.png" class="media img-responsive" alt="camera icon" />';
        throw "Error trying to append media - unknown media type!";
      }
      jQuery('#relationship-media-container').append(el);
    },

    removeOneMedia: function(ev) {
      var view = this;
      var targetUrl = jQuery(ev.target).data('url');
      var mediaArray = view.model.get('media');
      var newMediaArray = [];
      _.each(mediaArray, function(url, i) {
        if (mediaArray[i] !== targetUrl) {
          newMediaArray.push(mediaArray[i]);
        }
      });
      view.model.set('media', newMediaArray);
      view.model.save();

      jQuery('.media-container[data-url="'+targetUrl+'"]').remove();
      // clearing this out so the change event for this can be used (eg if they upload the same thing)
      jQuery('.upload-icon').val('');
    },

    render: function () {
      var view = this;
      console.log("Rendering RelationshipsWriteView...");

      // var habitatObj = app.getHabitatObject("relationships-write-screen");
      // if (habitatObj.name) {
      //   jQuery('#exchange-habitat').text("In "+habitatObj.name);
      // }
      if (view.model.get('habitat_tag')) {
        jQuery('#exchange-habitat').text("In "+view.model.get('habitat_tag').name);
        app.setHabitat("relationships-write-screen", view.model.get('habitat_tag').index);
      } else {
        jQuery('#exchange-habitat').text("In Habitat ?");
      }

      var speciesIndexArray = [];
      var fromIndex = view.model.get('from_species_index');
      if (fromIndex !== "") {
        speciesIndexArray.push(fromIndex);
        jQuery('#from-species-container').data('species-index',fromIndex);
        jQuery('#from-species-container').html('<img src="'+app.images[fromIndex].selected+'"></img>');
      } else {
        jQuery('#from-species-container').data('species-index','');
        jQuery('#from-species-container').html('');
      }

      var toIndex = view.model.get('to_species_index');
      if (toIndex !== "") {
        speciesIndexArray.push(view.model.get('to_species_index'));
        jQuery('#to-species-container').data('species-index',toIndex);
        jQuery('#to-species-container').html('<img src="'+app.images[toIndex].selected+'"></img>');
      } else {
        jQuery('#to-species-container').data('species-index','');
        jQuery('#to-species-container').html('');
      }

      app.setSpecies(speciesIndexArray);

      jQuery('#relationship-title-input').val(view.model.get('title'));
      jQuery('#relationship-body-input').val(view.model.get('body'));
      jQuery('#relationship-media-container').html('');
      view.model.get('media').forEach(function(url) {
        view.appendOneMedia(url);
      });

      // check if this user is allowed to edit this relationship
      if (view.model.get('author') === app.username) {
        jQuery('#relationships-write-screen .editable.input-field').removeClass('uneditable');
        jQuery('#relationships-write-screen .editable.input-field').prop("disabled", false);
        jQuery(jQuery('#relationships-write-screen .selector-container .editable').children()).prop("disabled", false);
        jQuery('#relationships-write-screen .editable').removeClass('disabled');
      } else {
        jQuery('#relationships-write-screen .editable.input-field').addClass('uneditable');
        jQuery('#relationships-write-screen .editable.input-field').prop("disabled", true);
        jQuery(jQuery('#relationships-write-screen .selector-container .editable').children()).prop("disabled", true);
        jQuery('#relationships-write-screen .editable').addClass('disabled');
      }
    }
  });


  /***********************************************************
   ***********************************************************
   ********************** HABITATS VIEW **********************
   ***********************************************************
   ***********************************************************/

  /**
    HabitatsView
  **/
  app.View.HabitatsView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing HabitatsView...', view.el);

      // user buttons
      app.users.forEach(function(user) {
        if (user.get('user_role') !== "teacher" && user.get('user_role') !== "smartboard") {
          var button = jQuery('<button class="btn btn-default btn-base student-button">');
          button.text(user.get('username'));
          var listItem = jQuery('<li>').append(button);
          if (!user.get('habitat_group') || user.get('habitat_group') === "") {
            // if the user has no group
            jQuery('.class-info .students-names').append(listItem);
          } else  if (user.get('habitat_group') > 0) {
            // if the user has a group
            var targetHab = jQuery(".habitats-list-item .habitat-thumbnail[data-number="+user.get('habitat_group')+"]").siblings()[0];      // eeeewwwwww. FIXME
            jQuery(targetHab).append(listItem);
          } else {
            console.error('User habitat group error');
          }
        }
      });
    },

    events: {
      'click .habitat-title'   : 'showHabitatNameEntry',
      'click .student-button'  : 'selectStudent',
      'click .habitat-group'   : 'chooseGroup',
      'click .class-info'      : 'ungroupStudent'
    },

    showHabitatNameEntry: function(ev) {
      // opens and closes the text entry box for entering habitat names. Also sets and saves those names
      var view = this;
      var textEntryEl = jQuery(ev.target).siblings()[1];

      var model = app.habitats.findWhere({'number': jQuery(ev.target).data('number')});
      if (jQuery(textEntryEl).val()) {
        model.set('name',jQuery(textEntryEl).val());
        model.save();
      }

      jQuery(textEntryEl).toggleClass('hidden');
      view.render();
    },

    selectStudent: function(ev) {
      jQuery('.student-button').removeClass('selected');
      jQuery(ev.target).addClass('selected');

      // to prevent propagation. Otherwise jQuery gets confused and removes the element (!) because it can't figure out what to do with the default click event
      return false;
    },

    chooseGroup: function(ev) {
      // if there is a student selected
      if (jQuery('.student-button.selected').length > 0) {
        // update the user model
        var user = app.users.findWhere({'username': jQuery('.student-button.selected').text()});
        user.set('habitat_group',jQuery(ev.target).data('number'));
        user.save();

        // update the UI
        jQuery('.student-button.selected').detach().appendTo(jQuery(jQuery(ev.target).parent().find('ul')));
        jQuery('.student-button').removeClass('selected');
      }
    },

    ungroupStudent: function(ev) {
      if (jQuery('.student-button.selected').length > 0) {
        // update the user model
        var user = app.users.findWhere({'username': jQuery('.student-button.selected').text()});
        user.set('habitat_group',"");
        user.save();

        // update the UI
        jQuery('.student-button.selected').detach().appendTo(jQuery('.class-info .students-names'));
        jQuery('.student-button').removeClass('selected');
      }
    },

    render: function() {
      var view = this;

      // habitat names
      app.habitats.forEach(function(h) {
        if (h.get('name')) {
          jQuery(".habitat-name[data-number="+h.get('number')+"]").text(h.get('name'));
        }
      });
    }
  });



  /***********************************************************
   ***********************************************************
   ******************* INVESTIGATIONS VIEW *******************
   ***********************************************************
   ***********************************************************/

   /**
    ** Investigation View
    **/
   app.View.Investigation = Backbone.View.extend({
     textTemplate: "#text-investigation-template",
     photoTemplate: "#photo-investigation-template",
     videoTemplate: "#video-investigation-template",

     events: {
       'click' : 'editInvestigation'
     },

     initialize: function () {
       var view = this;

       view.model.on('change', function () {
         view.render();
       });

       return view;
     },

     editInvestigation: function(ev) {
       var view = this;

       app.hideAllContainers();

       app.investigationsWriteView.model = view.model;
       jQuery('#investigations-write-screen').removeClass('hidden');
       app.investigationsWriteView.render();
     },

     render: function () {
       var view = this,
           investigation = view.model,
           investigationType,
           firstMediaUrl,
           listItemTemplate,
           listItem;

       // determine what kind of investigation this is, ie what kind of template do we want to use
       // CHECKME: do we want 'plan' here?
       if (investigation.get('plan_media').length === 0) {
         investigationType = "text";
       } else if (investigation.get('plan_media').length > 0) {
         firstMediaUrl = investigation.get('plan_media')[0];
         if (app.photoOrVideo(firstMediaUrl) === "photo") {
           investigationType = "photo";
         } else if (app.photoOrVideo(firstMediaUrl) === "video") {
           investigationType = "video";
         } else {
           jQuery().toastmessage('showErrorToast', "You have uploaded a file that is not a supported file type! How did you manage to sneak it in there? Talk to Colin to resolve the issue...");
         }
       } else {
         throw "Unknown investigation type!";
       }

       if (investigationType === "text") {
         //if class is not set do it
         if (!view.$el.hasClass('investigation-container')) {
           view.$el.addClass('investigation-container');
         }
         listItemTemplate = _.template(jQuery(view.textTemplate).text());
         listItem = listItemTemplate({ 'id': investigation.get('_id'), 'title': investigation.get('title'), 'body': investigation.get('plan_body'), 'author': '- '+investigation.get('author') });
       } else if (investigationType === "photo") {
         // if class is not set do it
         if (!view.$el.hasClass('photo-investigation-container')) {
           view.$el.addClass('photo-investigation-container');
         }
         listItemTemplate = _.template(jQuery(view.photoTemplate).text());
         listItem = listItemTemplate({ 'id': investigation.get('_id'), 'title': investigation.get('title'), 'url': app.config.pikachu.url + firstMediaUrl, 'author': '- '+investigation.get('author') });
       } else if (investigationType === "video") {
         // if class is not set do it
         if (!view.$el.hasClass('video-investigation-container')) {
           view.$el.addClass('video-investigation-container');
         }
         listItemTemplate = _.template(jQuery(view.videoTemplate).text());
         listItem = listItemTemplate({ 'id': investigation.get('_id'), 'title': investigation.get('title'), 'url': app.config.pikachu.url + firstMediaUrl, 'author': '- '+investigation.get('author') });
       }
       else {
         throw "Unknown investigation type!";
       }

       // add the myInvestigation class if needed
       if (investigation.get('habitat') === app.currentUser.get('habitat_group')) {
         view.$el.addClass('myInvestigation');
       }

       // Add the newly generated DOM elements to the view's part of the DOM
       view.$el.html(listItem);

       return view;
     }
   });


  /**
    InvestigationsReadView
  **/
  app.View.InvestigationsReadView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing InvestigationsReadView...', view.el);

      var habitat = app.habitats.findWhere({"number": app.currentUser.get('habitat_group')});
      if (habitat) {
        jQuery('.investigation-habitat-number-container').text('Ecosystem ' + habitat.get('number'));
        jQuery('.investigation-habitat-name-container').text(habitat.get('name'));
      } else if (app.currentUser.get('user_role') === "smartboard") {
        jQuery('.investigation-habitat-number-container').text('No ecosystem');
        jQuery('.investigation-habitat-name-container').text('Smartboard');
      } else {
        console.log('Teacher logged in');
      }

      /* We should not have to listen to change on collection but on add. However, due to wakefulness
      ** and published false first we would see the element with add and see it getting created. Also not sure
      ** how delete would do and so on.
      ** IMPORTANT: in addOne we check if the id of the model to be added exists in the DOM and only add it to the DOM if it is new
      */
      view.collection.on('change', function(n) {
        if (n.get('published') === true) {
          view.addOne(n);
        }
      });

      /*
      ** See above, but mostly we would want add and change in the relationship view. But due to wakeness and published flag
      ** we are better off with using change and filtering to react only if published true.
      ** IMPORTANT: in addOne we check that id isn't already in the DOM
      */
      view.collection.on('add', function(n) {
        if (n.get('published') === true) {
          view.addOne(n);
        }
      });

      return view;
    },

    events: {
      'click .nav-write-btn' : 'switchToWriteView'
    },

    switchToWriteView: function() {
      var view = this;
      var m;

      // var investigationToResume = view.collection.findWhere({author: app.username, published: false});

      // if (investigationToResume) {
      //   // RESUME INVESTIGATION
      //   console.log("Resuming...");
      //   m = investigationToResume;
      // } else {
      //   // NEW INVESTIGATION
      console.log("Starting a new investigation...");
      m = new Model.Investigation();
      m.set('habitat', app.currentUser.get('habitat_group'));
      m.set('author', 'Habitat ' + app.currentUser.get('habitat_group') + ' group');
      m.set('page_number', 1);
      m.wake(app.config.wakeful.url);
      m.save();
      view.collection.add(m);
      //}

      app.investigationsWriteView.model = m;
      app.investigationsWriteView.model.wake(app.config.wakeful.url);

      app.hideAllContainers();
      jQuery('#investigations-write-screen').removeClass('hidden');
      app.investigationsWriteView.render();
    },

    addOne: function(investigationModel) {
      var view = this;

      // check if the investigation already exists
      // http://stackoverflow.com/questions/4191386/jquery-how-to-find-an-element-based-on-a-data-attribute-value
      if (view.$el.find("[data-id='" + investigationModel.id + "']").length === 0 ) {
        // wake up the project model
        investigationModel.wake(app.config.wakeful.url);

        // This is necessary to avoid Backbone putting all HTML into an empty div tag
        var investigationContainer = jQuery('<li class="investigation-container col-xs-12 col-sm-4 col-lg-3" data-id="'+investigationModel.id+'"></li>');

        var investigationView = new app.View.Investigation({el: investigationContainer, model: investigationModel});
        var listToAddTo = view.$el.find('.investigations-list');
        listToAddTo.prepend(investigationView.render().el);
      } else {
        console.log("The investigation with id <"+investigationModel.id+"> wasn't added since it already exists in the DOM");
      }
    },

    render: function() {
      var view = this;
      console.log("Rendering InvestigationsReadView...");

      // sort newest to oldest (prepend!)
      view.collection.comparator = function(model) {
        return model.get('created_at');
      };

      var publishedCollection = view.collection.sort().where({published: true});
      var titledCollection = publishedCollection.filter(function(investigation) {
        return investigation.get('title') !== '';
      });

      // clear the house
      view.$el.find('.investigations-list').html("");

      if (titledCollection) {
        titledCollection.forEach(function(investigation) {
          view.addOne(investigation);
        });
      }
    }
  });


  /**
    InvestigationsWriteView
  **/
  app.View.InvestigationsWriteView = Backbone.View.extend({
    initialize: function() {
      var view = this;
      console.log('Initializing InvestigationsWriteView...', view.el);

      var habitat = app.habitats.findWhere({"number": app.currentUser.get('habitat_group')});
      if (habitat) {
        jQuery('.investigation-habitat-number-container').text('Ecosystem ' + habitat.get('number'));
        jQuery('.investigation-habitat-name-container').text(habitat.get('name'));
      } else if (app.currentUser.get('user_role') === "smartboard") {
        jQuery('.investigation-habitat-number-container').text('No ecosystem');
        jQuery('.investigation-habitat-name-container').text('Smartboard');
      } else {
        console.log('Teacher logged in');
      }
    },

    events: {
      'click .nav-read-btn'                   : 'moveBack',
      'click .nav-forward-btn'                : 'moveForward',
      'click .investigation-phase'            : 'jumpToPage',
      'keyup :input'                          : 'checkForAutoSave',
      'change .investigation-photo-file'      : 'uploadMedia',
      'click .remove-btn'                     : 'removeOneMedia',
      'click .photo-container'                : 'openPhotoModal',
      'click .species-selector-img'           : 'selectSpeciesPresent',
      'click .trend-container'                : 'setTrend',
      'click .investigation-present-btn'      : 'renderPresentPage'
    },

    selectSpeciesPresent: function(ev) {
      var view = this;
      if (jQuery(ev.target).attr('data-selected') === "off") {
        jQuery(ev.target).attr('src', app.images[jQuery(ev.target).data().speciesIndex].selected);
        jQuery(ev.target).attr('data-selected', 'on');                                    // brutal - jquery can't deal with multiple data attributes
      } else if (jQuery(ev.target).attr('data-selected') === "on") {
        jQuery(ev.target).attr('src', app.images[jQuery(ev.target).data().speciesIndex].unselected);
        jQuery(ev.target).attr('data-selected', 'off');
      } else {
        console.error('Somehow clicking on the wrong thing');
      }
    },

    setTrend: function(ev) {
      var view = this;
      var trendArr;
      var phase;
      var phaseArr = [];
      var speciesObj = {};
      var speciesIndex = jQuery(ev.target).data('species-index');

      // which type of cell are we clicking on
      if (jQuery(ev.target).hasClass('plan-column')) {
        phase = "plan";
        trendArr = ["introduce", "increase", "decrease"];
      } else if (jQuery(ev.target).hasClass('predict-column')) {
        phase = "predict";
        trendArr = ["goes up", "goes down", "stays the same"];
      } else if (jQuery(ev.target).hasClass('results-column')) {
        phase = "results";
        trendArr = ["went up", "went down", "stayed the same"];
      } else {
        console.error('Unknown cell type - cannot set trend');
      }

      // move forward in the array, update ui and save
      var index = _.indexOf(trendArr, jQuery(ev.target).text());
      var trend;
      if (index === -1) {
        // use the first val to cause the cell to be blank
        trend = trendArr[0];
      } else if (index+1 === trendArr.length) {
        // reset the cell to blank
        trend = "";
      } else {
        // if there is an index and we haven't reached the end of the arr, increment the value and then update ui
        trend = trendArr[index+1];
      }
      jQuery(ev.target).text(trend);

      // save this to the model
      phaseArr = view.model.get(phase+'_species');
      var newPhaseArr = [];
      // remove any previous copies of this index (don't need to worry about phase at this point)
      _.each(phaseArr, function(obj, i) {
        if (obj.index !== speciesIndex) {
          newPhaseArr.push(obj);
        }
      });
      // create the new species obj and push it in - should now be the only one
      speciesObj.index = speciesIndex;
      speciesObj.trend = trend;
      newPhaseArr.push(speciesObj);
      view.model.set(phase+'_species',newPhaseArr);
      view.model.save();
    },

    moveBack: function() {
      var view = this;

      view.setAllInputFields();

      if (view.model.get('page_number') === 1) {
        view.model.save();
        app.hideAllContainers();
        jQuery('#investigations-read-screen').removeClass('hidden');
        app.investigationsReadView.render();
      } else {
        var pageNum = view.model.get('page_number');
        pageNum--;
        view.model.set('page_number', pageNum);
        view.model.save();
        view.render();
      }
    },

    moveForward: function() {
      var view = this;
      var proceedFlag = true;

      // THIS IS SO INSANELY UGLY - FIXME
      var pageNum = view.model.get('page_number');
      if (pageNum === 4) {
        _.each(jQuery('[data-page-number=4] .predict-column'), function(el) {
          if (jQuery(el).text() === "") {
            proceedFlag = false;
          }
        });
      } else if (pageNum === 6) {
        _.each(jQuery('[data-page-number=6] .results-column'), function(el) {
          if (jQuery(el).text() === "") {
            proceedFlag = false;
          }
        });
      }

      if (proceedFlag === false) {
        jQuery().toastmessage('showWarningToast', "Please fill out all of the fields!");
      } else {
        pageNum++;
        view.model.set('page_number', pageNum);
        view.setAllInputFields();
        view.model.save();
        view.render();
      }
    },

    jumpToPage: function(ev) {
      var view = this;
      view.model.set('page_number', jQuery(ev.target).data('page-number'));
      view.model.save();

      view.render();
    },

    setAllInputFields: function() {
      var view = this;

      view.model.set('title', jQuery('#investigation-title-input').val());

      var habitatSpeciesArr = [];
      _.each(jQuery('.species-selector-img[data-selected=on]'), function(el) {
        habitatSpeciesArr.push(parseInt(jQuery(el).attr('data-species-index')));
        view.model.set('habitat_species',habitatSpeciesArr);
      });

      view.model.set('plan_body',jQuery('#investigation-plan-body-input').val());
      view.model.set('predict_body',jQuery('#investigation-predict-body-input').val());
      view.model.set('results_body',jQuery('#investigation-results-body-input').val());
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

    openPhotoModal: function(ev) {
      var view = this;
      var url = jQuery(ev.target).attr('src');
      //the fileName isn't working for unknown reasons - so we can't add metadata to the photo file name, or make them more human readable. Also probably doesn't need the app.parseExtension(url)
      //var fileName = view.model.get('author') + '_' + view.model.get('title').slice(0,8) + '.' + app.parseExtension(url);
      jQuery('#investigation-photo-modal .photo-content').attr('src', url);
      jQuery('#investigation-photo-modal .download-photo-btn a').attr('href',url);
      //jQuery('#investigation-photo-modal .download-photo-btn a').attr('download',fileName);
      jQuery('#investigation-photo-modal').modal({keyboard: true, backdrop: true});
    },

    uploadMedia: function(ev) {
      var view = this;
      var phase = jQuery(ev.target).data('phase');

      var file = jQuery('#investigation-'+phase+'-photo-file')[0].files.item(0);
      var formData = new FormData();
      formData.append('file', file);

      if (file.size < MAX_FILE_SIZE) {
        jQuery('#investigation-'+phase+'-photo-upload-spinner').removeClass('hidden');
        jQuery('.upload-icon').addClass('invisible');
        jQuery('.btn-circular').prop('disabled', true);

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
      } else {
        jQuery().toastmessage('showErrorToast', "Max file size of 20MB exceeded");
        jQuery('.upload-icon').val('');
      }

      function failure(err) {
        jQuery('.photo-spinner').addClass('hidden');
        jQuery('.upload-icon').removeClass('invisible');
        jQuery('.btn-circular').prop('disabled', false);
        jQuery().toastmessage('showErrorToast', "Photo could not be uploaded. Please try again");
      }

      function success(data, status, xhr) {
        jQuery('.photo-spinner').addClass('hidden');
        jQuery('.upload-icon').removeClass('invisible');
        jQuery('.btn-circular').prop('disabled', false);
        console.log("UPLOAD SUCCEEDED!");
        console.log(xhr.getAllResponseHeaders());

        // clear out the label value if they for some reason want to upload the same thing...
        jQuery('.upload-icon').val('');

        // update the model
        var mediaArray = view.model.get(phase+'_media');
        mediaArray.push(data.url);
        view.model.set(phase+'_media', mediaArray);
        view.model.save();
        // update the view (TODO: bind this to an add event, eg do it right)
        view.appendOneMedia(data.url, phase);

        // one lightweight way of doing captions for this wallcology - but only do it once (eg if length is one)
        // if (mediaArray.length === 1) {
        //   var investigationBodyText = jQuery('#investigation-'+phase+'-body-input').val();
        //   jQuery('#investigation-'+phase+'-body-input').val(investigationBodyText + '\n\nNotes on pictures and videos: ');
        // }
      }
    },

    // TODO: this can be done more cleanly/backbonely with views for the media containers
    appendOneMedia: function(url, phase) {
      var el;

      if (app.photoOrVideo(url) === "photo") {
        el = '<span class="media-container" data-url="'+url+'"><img src="'+app.config.pikachu.url+url+'" class="media photo-container img-responsive"></img><i class="fa fa-times fa-2x remove-btn editable" data-url="'+url+'" data-phase='+phase+'/></span>';
      } else if (app.photoOrVideo(url) === "video") {
        el = '<span class="media-container" data-url="'+url+'"><video src="' + app.config.pikachu.url+url + '" class="camera-icon img-responsive" controls /><i class="fa fa-times fa-2x remove-btn editable" data-url="'+url+'" data-phase='+phase+'/></span>';
      } else {
        el = '<img src="img/camera_icon.png" class="media img-responsive" alt="camera icon" />';
        throw "Error trying to append media - unknown media type!";
      }
      jQuery('#investigation-'+phase+'-media-container').append(el);
    },

    removeOneMedia: function(ev) {
      var view = this;
      var targetUrl = jQuery(ev.target).attr('data-url');
      var phase = jQuery(ev.target).attr('data-phase');
      var mediaArray = view.model.get(phase+'_media');
      var newMediaArray = [];
      _.each(mediaArray, function(url, i) {
        if (mediaArray[i] !== targetUrl) {
          newMediaArray.push(mediaArray[i]);
        }
      });
      view.model.set(phase+'_media', newMediaArray);
      view.model.save();

      jQuery('.media-container[data-url="'+targetUrl+'"]').remove();
      // clearing this out so the change event for this can be used (eg if they upload the same thing)
      jQuery('.upload-icon').val('');
    },

    renderSpeciesChart: function(el) {
      var view = this;
      jQuery(el).html('');

      var table = '<table class="table table-bordered table-hover"></table>';

      // create the header row
      var headerRow = '<tr class="header-row"><td class="species-chart-cell header-row"></td>';
      headerRow += '<td class="plan-column species-chart-cell header-row">Plan</td>';
      headerRow += '<td class="predict-column species-chart-cell header-row">Predict</td>';
      headerRow += '<td class="results-column species-chart-cell header-row">Result</td>';
      headerRow += '</tr>';

      // create all of the other rows
      var remainingRows = '';
      _.each(view.model.get('habitat_species'), function(i, iterator) {
        // create the header row
        remainingRows += '<tr><td class="species-column species-chart-cell" data-species-index='+i+'><img class="species-box" src="'+app.images[i].selected+'"></img></td>';
        // these ifs check if this species has a trend (eg increase)
        if (_.where(view.model.get('plan_species'), {"index": i}).length) {
          remainingRows += '<td class="plan-column species-chart-cell trend-container editable" data-species-index='+i+'>'+_.where(view.model.get('plan_species'), {"index": i})[0].trend+'</td>';
        } else {
          remainingRows += '<td class="plan-column species-chart-cell trend-container editable" data-species-index='+i+'></td>';
        }
        // these ifs check if this species has a trend (eg goes up)
        if (_.where(view.model.get('predict_species'), {"index": i}).length) {
          remainingRows += '<td class="predict-column species-chart-cell trend-container editable" data-species-index='+i+'>'+_.where(view.model.get('predict_species'), {"index": i})[0].trend+'</td>';
        } else {
          remainingRows += '<td class="predict-column species-chart-cell trend-container editable" data-species-index='+i+'></td>';
        }
        // these ifs check if this species has a trend (eg went up)
        if (_.where(view.model.get('results_species'), {"index": i}).length) {
          remainingRows += '<td class="results-column species-chart-cell trend-container editable" data-species-index='+i+'>'+_.where(view.model.get('results_species'), {"index": i})[0].trend+'</td>';
        } else {
          remainingRows += '<td class="results-column species-chart-cell trend-container editable" data-species-index='+i+'></td>';
        }
        remainingRows += '</tr>';
      });

      jQuery(el).html(jQuery(table).html(headerRow+remainingRows));
    },

    // this gets called without an ev sometimes (eg from render), in which case we always want plan
    renderPresentPage: function(ev) {
      var view = this;

      // this is the last page
      jQuery('.forward-nav').addClass('invisible');

      // clear everything out
      jQuery('#investigation-present-media-container').html('');

      jQuery('#investigation-present-title').text(view.model.get('title'));
      view.renderSpeciesChart('#investigation-present-species-container');
      jQuery('#investigation-present-species-container .species-chart-cell').prop('disabled', true);

      if (ev && jQuery(ev.target).data('phase') === "predict") {
        jQuery('#investigation-present-species-container .results-column').remove();
        jQuery('#investigation-present-body-container').text(view.model.get('predict_body'));
        view.model.get('predict_media').forEach(function(url) {
          view.appendOneMedia(url, 'present');
        });
      } else if (ev && jQuery(ev.target).data('phase') === "results") {
        jQuery('#investigation-present-body-container').text(view.model.get('results_body'));
        view.model.get('results_media').forEach(function(url) {
          view.appendOneMedia(url, 'present');
        });
      } else {
        // remove certain pieces of the chart here - pretty hacky, but we've got less than 12 hours to get this finished up
        jQuery('#investigation-present-species-container .predict-column').remove();
        jQuery('#investigation-present-species-container .results-column').remove();
        jQuery('#investigation-present-body-container').text(view.model.get('plan_body'));
        view.model.get('plan_media').forEach(function(url) {
          view.appendOneMedia(url, 'present');
        });
      }
    },

    render: function() {
      var view = this;

      jQuery('#investigations-write-screen .page').addClass('hidden');
      jQuery('#investigation-nav .investigation-phase').removeClass('heavy-text');
      jQuery('.side-nav').removeClass('my-group');

      // do we jump straight to present or chooes a page (jump to present if user is not in this group)
      if (view.model.get('habitat') === app.currentUser.get('habitat_group')) {
        var pageNum = view.model.get('page_number');

        jQuery('#investigations-write-screen .investigation-plan-body-container [data-page-number='+pageNum+']').removeClass('hidden');

        jQuery('#investigation-title-input').val(view.model.get('title'));
        jQuery('.species-present-container').html('');
        _.each(app.images, function(imgObj, index) {
          if (_.contains(view.model.get('habitat_species'), index)) {
            jQuery('.species-present-container').append('<img class="species-selector-img" data-selected="on" data-species-index='+index+' src="'+imgObj.selected+'"></img>');
          } else {
            jQuery('.species-present-container').append('<img class="species-selector-img" data-selected="off" data-species-index='+index+' src="'+imgObj.unselected+'"></img>');
          }
        });

        view.renderSpeciesChart('.species-chart');

        jQuery('.forward-nav').removeClass('invisible');
        jQuery('.side-nav').removeClass('invisible');
        jQuery('.species-chart-cell').prop("disabled", false);
        jQuery('.species-chart-cell').removeClass('uneditable');
        if (pageNum === 1) {
          jQuery('.investigation-phase[data-page-number=1]').addClass('heavy-text');
        } else if (pageNum === 2 || pageNum === 3) {
          jQuery('.investigation-phase[data-page-number=2]').addClass('heavy-text');
          jQuery('.species-chart .predict-column').prop("disabled", true);
          jQuery('.species-chart .predict-column').addClass('uneditable');
          jQuery('.species-chart .results-column').prop("disabled", true);
          jQuery('.species-chart .results-column').addClass('uneditable');
        } else if (pageNum === 4 || pageNum === 5) {
          jQuery('.investigation-phase[data-page-number=4]').addClass('heavy-text');
          jQuery('.species-chart .plan-column').prop("disabled", true);
          jQuery('.species-chart .results-column').prop("disabled", true);
          jQuery('.species-chart .results-column').addClass('uneditable');
        } else if (pageNum === 6 || pageNum === 7) {
          jQuery('.investigation-phase[data-page-number=6]').addClass('heavy-text');
          jQuery('.species-chart .plan-column').prop("disabled", true);
          jQuery('.species-chart .predict-column').prop("disabled", true);
        } else if (pageNum === 8) {
          jQuery('.investigation-phase[data-page-number=8]').addClass('heavy-text');
          jQuery('.side-nav').addClass('my-group');
          view.renderPresentPage();
        } else {
          console.error('Unknown page number!');
        }

        jQuery('#investigation-plan-body-input').val(view.model.get('plan_body'));
        jQuery('#investigation-predict-body-input').val(view.model.get('predict_body'));
        jQuery('#investigation-results-body-input').val(view.model.get('results_body'));
        jQuery('#investigation-plan-media-container').html('');
        view.model.get('plan_media').forEach(function(url) {
          view.appendOneMedia(url, 'plan');
        });
        jQuery('#investigation-predict-media-container').html('');
        view.model.get('predict_media').forEach(function(url) {
          view.appendOneMedia(url, 'predict');
        });
        jQuery('#investigation-results-media-container').html('');
        view.model.get('results_media').forEach(function(url) {
          view.appendOneMedia(url, 'results');
        });
      } else {
        jQuery('.side-nav').addClass('invisible');
        view.renderPresentPage();
        jQuery('#investigations-write-screen .investigation-plan-body-container [data-page-number=8]').removeClass('hidden');
      }
    }
  });
































  /**
   ** PosterNote View
   **/
  app.View.PosterNote = Backbone.View.extend({
    textTemplate: "#text-tile-template",
    photoTemplate: "#photo-tile-template",
    videoTemplate: "#video-tile-template",

    events: {
      'click'   : 'copyNote'
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
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'title': tile.get('title'), 'body': tile.get('body') });
      } else if (tile.get('type') === "media" && app.photoOrVideo(tile.get('url')) === "photo") {
        // if class is not set do it
        if (!view.$el.hasClass('photo-tile-container')) {
          view.$el.addClass('photo-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.photoTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'url': app.config.pikachu.url + tile.get('url') });
      } else if (tile.get('type') === "media" && app.photoOrVideo(tile.get('url')) === "video") {
        // if class is not set do it
        if (!view.$el.hasClass('video-tile-container')) {
          view.$el.addClass('video-tile-container');
        }

        listItemTemplate = _.template(jQuery(view.videoTemplate).text());
        listItem = listItemTemplate({ 'id': tile.get('_id'), 'url': app.config.pikachu.url + tile.get('url') });
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

    copyNote: function(ev) {
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

  this.Skeletor = Skeletor;
}).call(this);
