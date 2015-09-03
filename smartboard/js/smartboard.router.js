

(function () {
  "use strict";

  this.Skeletor = this.Skeletor || {};
  this.Skeletor.Smartboard = this.Skeletor.Smartboard || {};
  var Smartboard = this.Skeletor.Smartboard;

  Smartboard.Router = new (Backbone.Router.extend({
    routes: {
      '' : 'index',
      'ben': 'initClassBen',
      'michael': 'initClassMichael',
      'test': 'initClassTest'
    },
    initialize: function() {

    },
    index: function() {
      console.log("routing on");
    },
    initClassBen: function () {
      Skeletor.Smartboard.init('ben');
    },
    initClassMichael: function () {
      Skeletor.Smartboard.init('michael');
    },
    initClassTest: function () {
      Skeletor.Smartboard.init('test');
    },
    start: function() {
      // to allow single page app with various routes
      Backbone.history.start();
      // Skeletor.Smartboard.init();
    }
  }))();

  this.Skeletor.Smartboard = Smartboard;
  return this.Skeletor.Smartboard;

}).call(this);
