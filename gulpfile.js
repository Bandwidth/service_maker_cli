"use strict";
let coMocha = require("co-mocha");
let gulp    = require("gulp");
let jshint  = require("gulp-jshint");
let mocha   = require("gulp-mocha");
let stylish = require("jshint-stylish");

const SRC_FILES  = [ "*.js", "bin/**/*.js", "lib/**/*.js" ];
const TEST_FILES = [ "test/**/*.js" ];
const ALL_FILES  = SRC_FILES.concat(TEST_FILES);

gulp.task("default", [ "lint", "test" ]);

gulp.task("lint", function (done) {
  let stream = gulp.src(ALL_FILES)
  .pipe(jshint())
  .pipe(jshint.reporter(stylish))
  .pipe(jshint.reporter("fail"));

  stream.on("error", done);
  stream.on("end", done);
});

gulp.task("test", function () {
  coMocha(require("mocha"));

  return gulp.src(TEST_FILES)
  .pipe(mocha({ reporter : "spec" }));
});

gulp.on("err", function (event) {
  console.error(event.err.toString());
  process.exit(1);
});

if (require.main === module) {
  gulp.start("default");
}
