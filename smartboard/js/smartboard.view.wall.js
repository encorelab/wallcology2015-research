(function () {
  "use strict";

  this.Skeletor = this.Skeletor || {};
  this.Skeletor.Smartboard = this.Skeletor.Smartboard || {};

  var Smartboard = this.Skeletor.Smartboard;

  Smartboard.View = Smartboard.View || {};

  Smartboard.View.Wall = Smartboard.View.Base.extend({
    initialize: function () {
      var wall = this;

      _.bindAll(this);

      Smartboard.runState.on('change', this.render);

      wall.tagFilters = [];
      wall.balloons = {};

      Skeletor.Model.awake.brainstorms.on('add', function(n) {
        // Filtering to only contain published brainstorms
        // if (n.get('published') === true) {
          wall.registerBalloon(n, Smartboard.View.NoteBalloon, wall.balloons);
        // }
      });

      Skeletor.Model.awake.brainstorms.on('destroy', function(n) {
        console.warn("I was destoryed", n.id);
        // wall.registerBalloon(n, Smartboard.View.NoteBalloon, wall.balloons);
      });

      // Skeletor.Model.awake.brainstorms.on('change', function(n) {
      //   // Filtering to only contain published brainstorms
      //   if (n.get('published') === true) {
      //     wall.registerBalloon(n, Smartboard.View.NoteBalloon, wall.balloons);
      //   }
      // });
      // Filtering to only contain published brainstorms
      Skeletor.Model.awake.brainstorms.where({"published":true}).forEach(function(n) {
        wall.registerBalloon(n, Smartboard.View.NoteBalloon, wall.balloons);
      });

      Skeletor.Model.awake.tags.on('add', function(t) {
        wall.registerBalloon(t, Smartboard.View.TagBalloon, wall.balloons);
      });
      Skeletor.Model.awake.tags.each(function(t) {
        wall.registerBalloon(t, Smartboard.View.TagBalloon, wall.balloons);
      });
      Skeletor.Model.awake.tags.each(function(t) {
        wall.balloons[t.id].renderConnectors();
      });
    },

    events: {
      'click #add-tag-opener': 'toggleTagInputter',
      'click #submit-new-tag': 'submitNewTag',
      'keydown #new-tag': function(ev) { if (ev.keyCode === 13) return this.submitNewTag(); },
      'click #toggle-pause': 'togglePause'
    },

    ready: function () {
      this.render();
      this.$el.removeClass('loading');
      this.changeWatermark('Brainstorm');
      this.trigger('ready');
    },

    toggleTagInputter: function () {
      var wall = this;
      var addTagContainer = this.$el.find('#add-tag-container');
      addTagContainer.toggleClass('opened');
      if (addTagContainer.hasClass('opened')) {
        return setTimeout(function() {
          return wall.$el.find('#new-tag').focus();
        }, 500);
      }
    },

    submitNewTag: function () {
      var newTag = this.$el.find('#new-tag').val();
      if (jQuery.trim(newTag).length < 2) {
        return; // don't allow tags shorter than 2 characters
      }
      Smartboard.createNewTag(newTag);
      this.$el.find('#add-tag-container').removeClass('opened').blur();
      return this.$el.find('#new-tag').val('');
    },

    togglePause: function () {
      var paused = Smartboard.runState.get('paused');
      return Smartboard.runState.save({
        paused: !paused
      });
    },

    pause: function() {
      this.$el.find('#toggle-pause').addClass('paused').text('Resume');
      if (this.$el.data('phase') !== 'evaluate') {
        jQuery('body').addClass('paused');
        return this.changeWatermark("Paused");
      }
    },

    unpause: function() {
      jQuery('body').removeClass('paused');
      this.$el.find('#toggle-pause').removeClass('paused').text('Pause');
      return this.changeWatermark(this.$el.data('phase') || "brainstorm");
    },

    changeWatermark: function(text) {
      return jQuery('#watermark').fadeOut(800, function() {
        return jQuery(this).text(text).fadeIn(800);
      });
    },

    registerBalloon: function(brainstorm, BalloonView) {
      var wall = this;

      var bv = new BalloonView({
        model: brainstorm
      });
      brainstorm.wake(Smartboard.config.wakeful.url);

      bv.$el.css('visibility', 'hidden');
      bv.wall = wall; // FIXME: hmmm...
      bv.render();

      wall.$el.append(bv.$el);
      brainstorm.on('change:pos', function() {
        bv.pos = brainstorm.getPos();
      });

      brainstorm.on('change:z-index', function() {
        bv.$el.zIndex(brainstorm.get('z-index'));
      });

      if (brainstorm.hasPos()) {
        bv.pos = brainstorm.getPos();
      } else {
        //wall.assignRandomPositionToBalloon(brainstorm, bv);
        wall.assignRandomPositionToBalloon(brainstorm, bv);
      }

      if (brainstorm.has('z-index')) {
        bv.$el.zIndex(brainstorm.get('z-index'));
      }

      wall.makeBalloonDraggable(brainstorm, bv);
      bv.$el.click(function() {
        wall.moveBalloonToTop(brainstorm, bv);
      });

      bv.render();
      brainstorm.save().done(function() {
        // If it isn't brainstorm show it and if it is brainstorm only show it on publish
        if ( !(brainstorm instanceof Skeletor.Model.Brainstorm) || ((brainstorm instanceof Skeletor.Model.Brainstorm) && brainstorm.get('published')) ) {
            bv.$el.css('visibility', 'visible');
        } else {
          console.log("Invisible man");
        }

        //WARNING: IMPLICIT AS HELL DAWG
        // we need a condition to determine if the 'brainstorm' is a balloon or a tag. For now, saying that if it has an author, it should be a balloon, if not it is a tag
        // if (brainstorm.get('author')) {
        //   // only show balloon if published is true
        //   // if it isn't we listen to change:publish in the balloon view
        //   if (brainstorm.get('published')) {
        //     bv.$el.css('visibility', 'visible');
        //   }
        // }
        // // this else is to show the Tag balloons
        // else {
        //   bv.$el.css('visibility', 'visible');
        // }

      });

      this.balloons[brainstorm.id] = bv;
    },

    assignStaticPositionToBalloon: function(doc, view) {
      doc.setPos({
        left: 0,
        top: 0
      });
      this.moveBalloonToTop(doc, view);
    },

    assignRandomPositionToBalloon: function(doc, view) {
      var left, top, wallHeight, wallWidth;
      // changed from this.$el.width;   very strange - maybe changed backbone api?
      wallWidth = this.$el.width();
      wallHeight = this.$el.height();
      left = Math.random() * (wallWidth - view.width);
      top = Math.random() * (wallHeight - view.height);
      doc.setPos({
        left: left,
        top: top
      });
      this.moveBalloonToTop(doc, view);
    },

    moveBalloonToTop: function(doc, view) {
      var maxZ;
      maxZ = this.maxBalloonZ();
      maxZ++;
      return doc.set('z-index', maxZ);
    },

    maxBalloonZ: function() {
      return _.max(this.$el.find('.balloon').map(function(el) {
        return parseInt(jQuery(this).zIndex(), 10);
      }));
    },

    makeBalloonDraggable: function(doc, view) {
      var _this = this;
      view.$el.draggable({
        distance: 30,
        containment: '#wall'
      }).css('position', 'absolute');
      view.$el.on('dragstop', function(ev, ui) {
        doc.setPos(ui.position);
        // NOTE: MOVING FROM PATCH TO SAVE
        // patch was flipping published to false, so we had to remove it. No idea why. Probably something in the faye library?
        // follow the .patch() below to faye-browser.js: this._socket.onmessage (~line 1827) to see where it happens
        return doc.save(null, { patch: true });
        // And moving back. When we remove the published: false default from the model the issue seems to disappear
        // Does faye somehow trigger the model init??
        // return doc.save();
      });
      view.$el.on('drag', function(ev, ui) {
        if (view.renderConnectors !== null) {
          return view.renderConnectors();
        }
      });
      return view.$el.on('dragstart', function(ev, ui) {
        return _this.moveBalloonToTop(doc, view);
      });
    },

    addTagFilter: function(tag) {
      if (this.tagFilters.indexOf(tag) < 0) {
        this.tagFilters.push(tag);
        return this.renderFiltered();
      }
    },

    removeTagFilter: function(tag) {
      this.tagFilters.splice(this.tagFilters.indexOf(tag), 1);
      return this.renderFiltered();
    },

    renderFiltered: function(tag) {
      var activeIds, maxZ, selector;
      if (this.tagFilters.length === 0) {
        return this.$el.find(".content, .connector").removeClass('blurred');
      } else {
        activeIds = (function() {
          var _i, _len, _ref, _results;
          _ref = this.tagFilters;
          _results = [];
          for (_i = 0, _len = _ref.length; _i < _len; _i++) {
            tag = _ref[_i];
            _results.push(tag.id);
          }
          return _results;
        }).call(this);
        selector = ".tag-" + activeIds.join(", .tag-");
        this.$el.find(".content:not(" + selector + ")").addClass('blurred');
        this.$el.find(".connector:not(" + selector + ")").addClass('blurred');
        maxZ = this.maxBalloonZ();
        this.$el.find(".content").filter("" + selector).removeClass('blurred').css('z-index', maxZ + 1);
        return this.$el.find(".connector").filter("" + selector).removeClass('blurred');
      }
    },

    render: function() {
      var elementsToRemove, fadeoutStyle, hideStyle, ig, paused, phase,
        _this = this;

      this.width = this.$el.outerWidth();
      this.height = this.$el.outerHeight();

      phase = Smartboard.runState.get('phase');
      if (phase !== this.$el.data('phase')) {
        // switch (phase) {
        //   case 'tagging':
        //     jQuery('body').removeClass('mode-brainstorm').addClass('mode-tagging').removeClass('mode-exploration').removeClass('mode-propose').removeClass('mode-investigate');
        //     this.changeWatermark("tagging");
        //     break;
        //   case 'exploration':
        //     jQuery('body').removeClass('mode-brainstorm').removeClass('mode-tagging').addClass('mode-exploration').removeClass('mode-propose').removeClass('mode-investigate');
        //     this.changeWatermark("exploration");
        //     break;
        //   case 'propose':
        //     jQuery('body').removeClass('mode-brainstorm').removeClass('mode-tagging').removeClass('mode-exploration').addClass('mode-propose').removeClass('mode-investigate');
        //     this.changeWatermark("propose");
        //     setTimeout((function() {
        //       return _this.$el.find('.contribution, .contribution-connector').remove();
        //     }), 1100);
        //     break;
        //   case 'investigate':
        //     ig = Sail.app.interestGroup;
        //     if (ig !== null) {
        //       this.changeWatermark(ig.get('name'));
        //       jQuery('body').addClass('mode-investigate-with-topic').addClass(ig.get('colorClass'));
        //       elementsToRemove = ".balloon.contribution, .connector.contribution-connector, .balloon.tag, .connector.proposal-connector, " + (".balloon.proposal:not(.ig-" + ig.id + "), .balloon.investigation:not(.ig-" + ig.id + "), .connector:not(.ig-" + ig.id + ")");
        //     } else {
        //       this.changeWatermark("investigate");
        //       jQuery('body').removeClass('mode-investigate-with-topic');
        //       elementsToRemove = '.balloon.contribution, .connector.contribution-connector';
        //     }
        //     fadeoutStyle = jQuery("<style>                            " + elementsToRemove + " {                                opacity: 0.0;                            }                        </style>");
        //     hideStyle = jQuery("<style>                            " + elementsToRemove + " {                                display: none;                            }                        </style>");
        //     jQuery('head').append(fadeoutStyle);
        //     jQuery('body').removeClass('mode-brainstorm').removeClass('mode-tagging').removeClass('mode-exploration').removeClass('mode-propose').addClass('mode-investigate');
        //     setTimeout((function() {
        //       return jQuery('head').append(hideStyle);
        //     }), 1100);
        //     break;
        //   default:
        //     jQuery('body').addClass('mode-brainstorm').removeClass('mode-tagging').removeClass('mode-exploration').removeClass('mode-propose').removeClass('mode-investigate');
        //     this.changeWatermark("brainstorm");
        // }
        this.$el.data('phase', phase);
      }

      paused = Smartboard.runState.get('paused');
      if (paused !== this.$el.data('paused')) {
        if (paused) {
          this.pause();
        } else {
          this.unpause();
        }
        return this.$el.data('paused', paused);
      }
    }
  });

}).call(this);
