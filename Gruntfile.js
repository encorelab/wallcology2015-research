module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    jshint: {
      all: ['Gruntfile.js', 'shared/js/*.js', 'teacher/js/*.js', 'mobile/js/*.js', 'smartboard/js/*.js', 'agents/*.js', 'webbots/js/*.js']
    },
    jsonlint: {
      dev: {
        src: ['./*.json', 'scaffolding/*.json']
      }
    },
    sass: { // Task
      dist: { // Target
        options: { // Target options
          style: 'expanded'
        },
        files: { // Dictionary of files
          'smartboard/css/smartboard.css': 'smartboard/css/scss/wall.scss' // 'destination': 'source'
        }
      }
    }
  });

  // Load the plugin that provides the "uglify" task.
  // grunt.loadNpmTasks('grunt-contrib');
  grunt.loadNpmTasks('grunt-contrib-jshint');
  grunt.loadNpmTasks('grunt-contrib-sass');
  grunt.loadNpmTasks('grunt-jsonlint');

  // Default task(s) .
  // grunt.registerTask('default', ['uglify']);
  grunt.registerTask('default', ['jshint',  'jsonlint']);
  grunt.registerTask('lint', ['jshint', 'jsonlint']);
};