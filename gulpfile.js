/*
 * There here is YOUR config
 * This var is an example of the assets you can use in your own application.
 * The array KEYS correspond to the OUTPUT files/directories,
 * The array VALUES contain a LIST OF SOURCE FILES
 */

// ------------
// Slides stuff
const yaml = require('js-yaml');
const yamlFilesDir = 'slides/';
const dumpDir = process.cwd()+'/templates/slides/';
// ------------

const config = {

    // The base output directory for all your assets
    "output_directory": "public",

    "copy": {
        "reveal/css/": [
            "node_modules/reveal.js/css/**/*.css",
        ],
        "reveal/js/": [
            "node_modules/reveal.js/js/**/*.js",
        ],
        "reveal/lib/": [
            "node_modules/reveal.js/lib/**/*",
        ],
        "reveal/plugin/": [
            "node_modules/reveal.js/plugin/**/*",
        ],
        "js/": [
            "node_modules/socket.io-client/dist/socket.io.js",
            "node_modules/socket.io-client/dist/socket.io.js.map"
        ]
    },

    "files_to_watch": [
    ],

    "images": {
        "img/": [
            "assets/img/*"
        ]
    },

    "less": {
    },

    "sass": {
        "css/app.css": [
            "assets/app.scss"
        ]
    },

    "css": {
        "css/hljs.darcula.css": [
            "assets/hljs.darcula.css"
        ]
    },

    "js": {
        "js/app.js": [
            "assets/app.js"
        ]
    }
};

/*************** End config ***************/

// Everything AFTER this line of code is updatable to the latest version of this gulpfile.
// Check it out there if you need: https://github.com/Orbitale/Gulpfile

/************* Some helpers *************/

const GulpfileHelpers = {
    /**
     * @param {Object} object
     * @returns {Number}
     */
    objectSize: function(object) {
        "use strict";
        let size = 0;

        for (let key in object) {
            if (object.hasOwnProperty(key)) {
                size++;
            }
        }

        return size;
    },

    /**
     * @param {Object} object
     * @param {Function} callback
     * @returns {Object}
     */
    objectForEach: function(object, callback) {
        for (let key in object) {
            if (object.hasOwnProperty(key)) {
                callback.apply(object, [key, object[key]]);
            }
        }

        return object;
    }
};

/*************** Global vars ***************/

// These data are mostly used to introduce logic that will save memory and time.
const isProd    = process.argv.indexOf('--prod') >= 0 || process.env.NODE_ENV === 'production';
const hasImages = GulpfileHelpers.objectSize(config.images) > 0;
const hasCopy   = GulpfileHelpers.objectSize(config.copy) > 0;
const hasLess   = GulpfileHelpers.objectSize(config.less) > 0;
const hasSass   = GulpfileHelpers.objectSize(config.sass) > 0;
const hasCss    = GulpfileHelpers.objectSize(config.css) > 0;
const hasJs     = GulpfileHelpers.objectSize(config.js) > 0;

// Required extensions
const fs         = require('fs');
const path       = require('path');
const pump       = require('pump');
const glob       = require('glob');
const gulp       = require('gulp4');
const gulpif     = require('gulp-if');
const concat     = require('gulp-concat');
const uglify     = require('gulp-uglify');
const cleancss   = require('gulp-clean-css');

// Load other extensions only when having specific components. Saves memory & time execution.
const less     = hasLess   ? require('gulp-less')     : function(){ return {}; };
const sass     = hasSass   ? require('gulp-sass')     : function(){ return {}; };
const imagemin = hasImages ? require('gulp-imagemin') : function(){ return {}; };

/************** Files checks **************/

var erroredFiles = [];
config.output_directory = config.output_directory.replace(/[\\\/]$/gi, '');

var checkCallback = function(key, values) {
    values.forEach(function(fileName) {
        if (glob.hasMagic(fileName)) {
            // Don't handle wildcards
            return;
        }
        try {
            // Remove wildcards
            fileName = fileName.replace(/(?:(?:\*\.\w{2,4}(?:$|\/))|(?:\/\*+(?:$|\/)))/gi, '');
            fs.statSync(fileName);
        } catch (e) {
            if (e.code === 'ENOENT' || (e.message && e.message.match(/no such file/i)) || String(e).match(/no such file/i)) {
                erroredFiles.push(fileName);
            } else {
                throw e;
            }
        }
    })
};

GulpfileHelpers.objectForEach(config.css, checkCallback);
GulpfileHelpers.objectForEach(config.js, checkCallback);
GulpfileHelpers.objectForEach(config.images, checkCallback);
GulpfileHelpers.objectForEach(config.copy, checkCallback);
GulpfileHelpers.objectForEach(config.sass, checkCallback);
GulpfileHelpers.objectForEach(config.less, checkCallback);

if (erroredFiles.length) {
    process.stderr.write("\nMissing input files: \n"+erroredFiles.join("\n")+"\n");
    process.exit(1);
}

process.stdout.write('Running gulp in ' + (isProd ? 'production' : 'development') + ' mode.\n');

/*************** Gulp tasks ***************/

gulp.task('dump-slides', function (done) {
    // List of presentations with details
    let presentations = {};

    let files = glob.sync(yamlFilesDir+'/**/*.yaml');

    for (let i in files) {
        if (!files.hasOwnProperty(i)) { continue; }
        files[i] = files[i].replace(yamlFilesDir, '');
    }

    /**
     ****************************************************
     *               FETCH PRESENTATIONS                *
     ****************************************************
     */
    for (let i in files) {
        if (!files.hasOwnProperty(i)) { continue; }
        let file = files[i];

        if (!file.match(/\.yaml$/gi)) {
            console.error('File '+file+' is not a yaml file.');
            continue;
        }

        files[yamlFilesDir] = {};

        let data = fs.readFileSync(yamlFilesDir+file, 'utf8');

        // Here, we're parsing ONE file
        let document;

        try {
            document = yaml.safeLoad(data);
        } catch (e) {
            throw 'File '+file+' seems not to be a valid yaml file.'+"\n"+e.message;
        }

        /**
         * One file may have a lot of different presentations inside, so we parse them sequentially.
         */
        for (let presentationName in document) {
            if (!document.hasOwnProperty(presentationName)) { continue; }
            let presentations_slides = document[presentationName];
            let numberOfSlides = 0;

            if (presentations.hasOwnProperty(presentationName)) {
                throw 'Directory "'+presentationName+'" has been already processed!';
            }

            if (!presentations_slides) {
                return;
            }

            presentations[presentationName] = {
                'data': {},
                'views': {},
            };

            /**
             * And for each presentation, we have lots of slides to process.
             */
            for (let slideName in presentations_slides) {
                if (!presentations_slides.hasOwnProperty(slideName)) { continue; }

                let slide = presentations_slides[slideName];
                let content_to_prepend = '';

                if (!slide) {
                    continue;
                }

                /**
                 * Default slide properties values
                 */
                let slideData = {
                    title: '',
                    title_htmlattr: '',
                    title_tag: 'h3',
                    icon: null,
                    icon_size: '2x',
                    type: '',
                    htmlattr: '',
                    content: '',
                    notes: '',
                    sections: [],
                };

                slideData.notes = (slide.notes || slideData.notes).trim();
                slideData.type = (slide.type || slideData.htmlattr).trim().toLowerCase();
                slideData.htmlattr = (slide.htmlattr || slideData.htmlattr).trim();
                slideData.title_htmlattr = (slide.title_htmlattr || slideData.title_htmlattr).trim();
                slideData.title_tag = (slide.title_tag || slideData.title_tag).trim();

                slideData.htmlattr = ('id="'+presentationName+'_'+slideName+'" '+slideData.htmlattr).trim();

                if (slideData.htmlattr) { slideData.htmlattr = ' '+slideData.htmlattr; }

                slideData.content += "<section"+slideData.htmlattr+">\n";
                slideData.content += content_to_prepend;

                /**
                 * Show a <h2> tag if we have a title
                 */
                if (slide.title) {
                    slideData.title_htmlattr = ' '+(slideData.title_htmlattr.trim());
                    slideData.content += '<'+slideData.title_tag+slideData.title_htmlattr+'>';
                    slideData.content += slide.title;
                    slideData.content += '</'+slideData.title_tag+">\n"
                }

                /**
                 * Add a big icon under the title, sometimes it's cool, and it's FontAwesome-based!
                 */
                let icon = slide.icon || slideData.icon;
                let icon_size = slide.icon_size || slideData.icon_size;
                if (icon) {
                    slideData.content += '<i class="fa fa-'+icon+' fa-'+icon_size+'" aria-hidden="true"></i>';
                }

                /**
                 * Permits the use of "sections: { content: ... }"
                 * where "content: ..." corresponds to one single section.
                 */
                if (!slide.sections && slide.content) {
                    let content = slide.content;
                    if (!content.content) {
                        content = {content: content};
                    }
                    slide.sections = [content];
                }

                /**
                 * One slide can be a list of different sections, each under a <p> tag (or <pre> for code).
                 * By default, it's important to have at least one section,
                 *  unless you're making a "splash screen" slide.
                 */
                if (slide.sections && slide.sections.length) {
                    for (let i = 0, l = slide.sections.length; i < l; i++) {
                        /**
                         * Default section properties
                         */
                        let sectionData = {
                            title: '',
                            title_htmlattr: '',
                            is_fragment: false,
                            type: 'markdown',
                            code_language: 'php',
                            quote_source: '',
                            htmlattr: '',
                            content: ''
                        };

                        let section = slide.sections[i];

                        sectionData.type = section.type || sectionData.type;
                        sectionData.is_fragment = section.is_fragment || sectionData.is_fragment;
                        sectionData.htmlattr = (section.htmlattr || sectionData.htmlattr).trim();
                        sectionData.content = (section.content || sectionData.content).trim();
                        sectionData.title = (section.title || sectionData.title).trim();
                        sectionData.title_htmlattr = (section.title_htmlattr || sectionData.title_htmlattr).trim();

                        // Make sure attributes are prepended with a space to avoid html tag collision
                        if (sectionData.htmlattr) { sectionData.htmlattr = ' '+sectionData.htmlattr; }
                        if (sectionData.title_htmlattr) { sectionData.title_htmlattr = ' '+sectionData.title_htmlattr; }

                        switch (sectionData.type.toLowerCase()) {
                            /**
                             * PHP code parser
                             */
                            case 'code':
                                sectionData.code_language = (section.code_language || sectionData.code_language).trim();
                                if (sectionData.is_fragment) {
                                    slideData.content += '<div class="fragment">';
                                }

                                if (sectionData.title) {
                                    slideData.content += '<h3'+sectionData.title_htmlattr+'>';
                                    slideData.content += sectionData.title;
                                    slideData.content += '</h3>';
                                }

                                // Force relative positioning for div, because of Prism highlight language
                                if (!sectionData.htmlattr.match(/style=/gi)) {
                                    sectionData.htmlattr += ' style="position:relative;width:100%"';
                                } else {
                                    let posRegex = new RegExp('(["\';]|\s*)position: ?([^;]+);?', 'gi');
                                    if (sectionData.htmlattr.match(posRegex)) {
                                        sectionData.htmlattr = sectionData.htmlattr.replace(posRegex, '$1position: relative;')
                                    } else {
                                        sectionData.htmlattr = sectionData.htmlattr.replace(/(style=['"])/gi, '$1position: relative;')
                                    }
                                }

                                slideData.content += '<div'+(sectionData.htmlattr || '')+'>';
                                slideData.content += '    <pre class="hljs" data-trim><code class="'+sectionData.code_language+'">';

                                if ('twig' === sectionData.code_language) {
                                    slideData.content += '{%- verbatim -%}';
                                }

                                // This is like htmlspecialchars, but for code only.
                                slideData.content += sectionData.content
                                .replace(/&/g, "&amp;")
                                .replace(/</g, "&lt;")
                                .replace(/>/g, "&gt;")
                                .replace(/"/g, "&quot;")
                                .replace(/'/g, "&#039;")
                                ;

                                if ('twig' === sectionData.code_language) {
                                    slideData.content += '{%- endverbatim -%}';
                                }

                                slideData.content += '</code></pre>';

                                if (sectionData.is_fragment) {
                                    slideData.content += '</div>';
                                }

                                slideData.content += '</div>';
                                break;

                            /**
                             * Raw text parser
                             */
                            case 'raw':
                                slideData.content += "\n<div"+(sectionData.is_fragment ? ' class="fragment"' : '') + ">";
                                if (sectionData.title) {
                                    slideData.content += '<h3'+(sectionData.title_htmlattr || '')+'>';
                                    slideData.content += sectionData.title;
                                    slideData.content += '</h3>';
                                }
                                slideData.content += '<div'+sectionData.htmlattr+'>'+sectionData.content+'</div>';
                                slideData.content += "</div>\n";
                                break;

                            /**
                             * Raw text parser
                             */
                            case 'browser-image':
                                slideData.content += "\n<div"+(sectionData.is_fragment ? ' class="fragment"' : '') + ">";
                                if (sectionData.title) {
                                    slideData.content += '<h3'+(sectionData.title_htmlattr || '')+'>';
                                    slideData.content += sectionData.title;
                                    slideData.content += '</h3>';
                                }
                                slideData.content += '<p'+sectionData.htmlattr+'>'+sectionData.content+'</p>';
                                slideData.content += "</div>\n";
                                break;

                            case 'terminal':
                                slideData.content += "<div class=\"highlight-terminal"+(sectionData.is_fragment ? ' fragment' : '')+'" '+sectionData.htmlattr+">";
                                slideData.content += "    <table class=\"highlighttable\">";
                                slideData.content += "        <tbody>";

                                if (sectionData.title) {
                                    slideData.content += "        <tr"+(sectionData.title_htmlattr || '')+">";
                                    slideData.content += "            <th colspan=\"2\">"+sectionData.title+"</th>";
                                    slideData.content += "        </tr>";
                                }

                                let numberOfLines = (sectionData.content || '').split("\n").length || 0;

                                slideData.content += "            <tr>";
                                slideData.content += "                <td class=\"linenos\">";
                                slideData.content += "                    <div class=\"linenodiv\"><pre>";
                                for (let i = 1; i <= numberOfLines; i++) {
                                    slideData.content += i+"\n";
                                }
                                slideData.content += "</pre></div>";
                                slideData.content += "                </td>";
                                slideData.content += "                <td class=\"code\">";
                                slideData.content += "                    <div class=\"highlight\"><pre>"+sectionData.content+"</pre></div>";
                                slideData.content += "                </td>";
                                slideData.content += "            </tr>";
                                slideData.content += "        </tbody>";
                                slideData.content += "    </table>";
                                slideData.content += "</div>";
                                break;

                            /**
                             * Quote
                             */
                            case 'quote':
                                sectionData.quote_source = (section.quote_source || sectionData.quote_source).trim();
                                slideData.content += "\n<div class=\"quote"+(sectionData.is_fragment ? ' fragment' : '') + "\">";
                                slideData.content += '<div class="quote-content" data-markdown>'+sectionData.content+'</div>';
                                if (sectionData.quote_source) {
                                    slideData.content +=
                                        '<div class="quote-source">Source: ' +
                                        '<strong style="display: inline-block;" data-markdown>'+sectionData.quote_source+'</strong>' +
                                        '</div>';
                                }
                                slideData.content += "</div>\n";
                                break;

                            /**
                             * Markdown parser (default one)
                             */
                            case 'markdown':
                            default:
                                slideData.content += "\n<div"+(sectionData.is_fragment ? ' class="fragment"' : '') + ">";
                                if (sectionData.title) {
                                    slideData.content += '<h3'+(sectionData.title_htmlattr || '')+'>';
                                    slideData.content += sectionData.title;
                                    slideData.content += '</h3>';
                                }
                                if (!sectionData.htmlattr.match(/data-markdown/gi)) {
                                    sectionData.htmlattr = ' data-markdown '+sectionData.htmlattr;
                                }
                                slideData.content += '<p'+(sectionData.htmlattr || ' data-markdown')+'>'+sectionData.content+'</p>';
                                slideData.content += "</div>\n";
                                break;
                        } // End switch type

                        slideData.sections.push(sectionData);
                    } // End sections loop
                } // End if sections

                if (slideData.notes) {
                    slideData.content += '<aside class="notes" data-markdown>';
                    slideData.content += slideData.notes;
                    slideData.content += '</aside>';
                }

                slideData.content += "</section>\n";

                presentations[presentationName].data[slideName] = slideData;

            } // End presentations loop

        } // End document/yaml file loop

    } // end file loop

    /**
     ****************************************************
     *           DUMP METADATA AND TWIG FILES           *
     ****************************************************
     */
    let finalMetadata = {};
    for (let name in presentations) {
        if (!presentations.hasOwnProperty(name)) { continue; }
        let presentation = presentations[name];

        // Basically, they will contain just the views that have to be loaded for this presentation.
        finalMetadata[name] = [];

        let fileName = path.resolve(dumpDir.replace(/\/$/g, '')+'/'+name+'.html.twig');

        let slideContent = '';

        /**
         * Dump files contents
         */
        for (let slideName in presentation.data) {
            if (!presentation.data.hasOwnProperty(slideName)) { continue; }
            slideContent += presentation.data[slideName].content;
        }
        fs.writeFileSync(fileName, slideContent);
        console.info(" [file+] "+fileName);
    }

    done();
});

/**
 * Dumps the LESS assets
 */
gulp.task('less', function(done) {
    "use strict";

    let list = config.less,
        outputDir = config.output_directory+'/',
        assets_output, assets, i, l,
        outputCount = GulpfileHelpers.objectSize(list),
        pipesDone = 0
    ;

    if (outputCount === 0) {
        done();
        return;
    }

    for (assets_output in list) {
        if (!list.hasOwnProperty(assets_output)) { continue; }
        assets = list[assets_output];
        pump([
            gulp.src(assets),
            less(),
            concat(assets_output),
            gulpif(isProd, cleancss()),
            concat(assets_output),
            gulp.dest(outputDir),
        ], finalCallback);

        console.info(" [file+] "+assets_output);
        for (i = 0, l = assets.length; i < l; i++) {
            console.info("       > "+assets[i]);
        }
    }

    function finalCallback() {
        pipesDone++;
        if (outputCount === pipesDone) {
            done();
        }
    }
});

/**
 * Dumps the SASS assets
 */
gulp.task('sass', function(done) {
    "use strict";

    let list = config.sass,
        outputDir = config.output_directory+'/',
        assets_output, assets, i, l,
        outputCount = GulpfileHelpers.objectSize(list),
        pipesDone = 0
    ;

    if (outputCount === 0) {
        done();
        return;
    }

    for (assets_output in list) {
        if (!list.hasOwnProperty(assets_output)) { continue; }
        assets = list[assets_output];
        pump([
            gulp.src(assets),
            sass().on('error', sass.logError),
            concat(assets_output),
            gulpif(isProd, cleancss()),
            concat(assets_output),
            gulp.dest(outputDir)
        ], finalCallback);

        console.info(" [file+] "+assets_output);
        for (i = 0, l = assets.length; i < l; i++) {
            console.info("       > "+assets[i]);
        }
    }

    function finalCallback() {
        pipesDone++;
        if (outputCount === pipesDone) {
            done();
        }
    }
});

/**
 * Simply copy files into another directory.
 * Useful for simple "dist" files from node_modules directory, for example.
 */
gulp.task('copy', function(done) {
    "use strict";

    let list = config.copy,
        outputDir = config.output_directory+'/',
        assets_output, assets, i, l,
        outputCount = GulpfileHelpers.objectSize(list),
        pipesDone = 0
    ;

    if (outputCount === 0) {
        done();
        return;
    }

    for (assets_output in list) {
        if (!list.hasOwnProperty(assets_output)) { continue; }
        assets = list[assets_output];
        pump([
            gulp.src(assets),
            gulp.dest(outputDir + assets_output)
        ], finalCallback);

        console.info(" [file+] "+assets_output);
        for (i = 0, l = assets.length; i < l; i++) {
            console.info("       > "+assets[i]);
        }
    }

    function finalCallback() {
        pipesDone++;
        if (outputCount === pipesDone) {
            done();
        }
    }
});

/**
 * Compress images.
 * Thanks to @docteurklein.
 */
gulp.task('images', function(done) {
    "use strict";

    let list = config.images,
        outputDir = config.output_directory+'/',
        assets_output, assets, i, l,
        outputCount = GulpfileHelpers.objectSize(list),
        pipesDone = 0
    ;

    if (outputCount === 0) {
        done();
        return;
    }

    for (assets_output in list) {
        if (!list.hasOwnProperty(assets_output)) { continue; }
        assets = list[assets_output];
        pump([
            gulp.src(assets),
            imagemin([
                imagemin.gifsicle(isProd ? {interlaced: true} : {}),
                imagemin.jpegtran(isProd ? {progressive: true} : {}),
                imagemin.optipng(isProd ? {optimizationLevel: 7} : {}),
                imagemin.svgo({plugins: [{removeViewBox: true}]})
            ]),
            gulp.dest(outputDir + assets_output),
        ], finalCallback);

        console.info(" [file+] "+assets_output);
        for (i = 0, l = assets.length; i < l; i++) {
            console.info('       > '+assets[i]);
        }
    }

    function finalCallback() {
        pipesDone++;
        if (outputCount === pipesDone) {
            done();
        }
    }
});

/**
 * Dumps the CSS assets.
 */
gulp.task('css', function(done) {
    "use strict";

    let list = config.css,
        outputDir = config.output_directory+'/',
        assets_output, assets, i, l,
        outputCount = GulpfileHelpers.objectSize(list),
        pipesDone = 0
    ;

    if (outputCount === 0) {
        done();
        return;
    }

    for (assets_output in list) {
        if (!list.hasOwnProperty(assets_output)) { continue; }
        assets = list[assets_output];
        pump([
            gulp.src(assets),
            concat(assets_output),
            gulpif(isProd, cleancss()),
            concat(assets_output),
            gulp.dest(outputDir)
        ], finalCallback);

        console.info(" [file+] "+assets_output);
        for (i = 0, l = assets.length; i < l; i++) {
            console.info("       > "+assets[i]);
        }
    }

    function finalCallback() {
        pipesDone++;
        if (outputCount === pipesDone) {
            done();
        }
    }
});

/**
 * Dumps the JS assets
 */
gulp.task('js', function(done) {
    "use strict";

    let list = config.js,
        outputDir = config.output_directory+'/',
        assets_output, assets, i, l,
        outputCount = GulpfileHelpers.objectSize(list),
        pipesDone = 0
    ;

    if (outputCount === 0) {
        done();
        return;
    }

    for (assets_output in list) {
        if (!list.hasOwnProperty(assets_output)) { continue; }
        assets = list[assets_output];
        pump([
            gulp.src(assets),
            concat({path: assets_output, cwd: ''}),
            gulpif(isProd, uglify()),
            gulp.dest(outputDir)
        ], finalCallback);

        console.info(" [file+] "+assets_output);
        for (i = 0, l = assets.length; i < l; i++) {
            console.info("       > "+assets[i]);
        }
    }

    function finalCallback() {
        pipesDone++;
        if (outputCount === pipesDone) {
            done();
        }
    }
});

/**
 * Runs all the needed commands to dump all assets and manifests
 */
gulp.task('dump', gulp.series('images', 'copy', 'less', 'sass', 'css', 'js', 'dump-slides', function(done){
    done();
}));

/**
 * Will watch for files and run "dump" for each modification
 */
gulp.task('watch', gulp.series('dump', gulp.parallel(function(done) {
    "use strict";

    let files_less = [],
        files_images = [],
        files_copy = [],
        files_css = [],
        files_sass = [],
        files_js = [],
        files_to_watch = [],
        other_files_to_watch = config.files_to_watch || [],
        forEach = GulpfileHelpers.objectForEach,
        push = (key, elements, appendTo) => {
            appendTo.push(elements);
            files_to_watch.push(elements);
        },
        callback = function(event) {
            console.log('File "' + event + '" updated');
        }
    ;

    console.info('Night gathers, and now my watch begins...');

    forEach(config.images, (key, images) => { push(key, images, files_images); });
    forEach(config.copy, (key, images) => { push(key, images, files_copy); });
    forEach(config.less, (key, images) => { push(key, images, files_less); });
    forEach(config.sass, (key, images) => { push(key, images, files_sass); });
    forEach(config.css, (key, images) => { push(key, images, files_css); });
    forEach(config.js, (key, images) => { push(key, images, files_js); });

    if (files_to_watch.length) {
        console.info('Watching file(s):');
        // Flatten the array
        files_to_watch = [].concat.apply([], files_to_watch).sort();
        console.info("       > "+files_to_watch.join("\n       > "));
    }

    if (other_files_to_watch.length) {
        gulp.watch(other_files_to_watch, gulp.parallel('dump')).on('change', callback);
    }
    if (hasImages) {
        gulp.watch(files_images, gulp.parallel('images')).on('change', callback);
    }
    if (hasCopy) {
        gulp.watch(files_copy, gulp.parallel('copy')).on('change', callback);
    }
    if (hasLess) {
        gulp.watch(files_less, gulp.parallel('less')).on('change', callback);
    }
    if (hasSass) {
        gulp.watch(files_sass, gulp.parallel('sass')).on('change', callback);
    }
    if (hasCss) {
        gulp.watch(files_css, gulp.parallel('css')).on('change', callback);
    }
    if (hasJs) {
        gulp.watch(files_js, gulp.parallel('js')).on('change', callback);
    }
    gulp.watch('slides/*.yaml', gulp.parallel('dump-slides')).on('change', callback);


    done();
})));

gulp.task('test', gulp.series('dump', async function(done) {
    "use strict";
    let outputFilesList = [];
    let forEach = GulpfileHelpers.objectForEach;
    let push = (key) => {
        key = config.output_directory+'/'+key;
        outputFilesList.push(key);
    };

    /**
     * Retrieve files list.
     */
    forEach(config.less, push);
    forEach(config.sass, push);
    forEach(config.css, push);
    forEach(config.js, push);

    /**
     * Retrieve files from globs or specific file names.
     */
    GulpfileHelpers.objectForEach(config.images, function(outDir, list){
        list.forEach(function(element){
            outDir = outDir.replace(/[\\\/]$/gi, '');
            let basename = path.basename(element);
            let finalPath = config.output_directory+'/'+outDir+'/'+basename;
            if (glob.hasMagic(element)) {
                glob.sync(element, { nodir: true }).forEach(function(file){
                    let finalPath = config.output_directory+'/'+outDir+'/'+path.basename(file);
                    outputFilesList.push(finalPath);
                });
            } else {
                outputFilesList.push(finalPath);
            }
        });
    });

    console.info('Check files that are not dumped according to config.');
    console.info(outputFilesList);

    let number = outputFilesList.length;
    let processedFiles = 0;
    let valid = 0;
    let invalid = [];

    // Hack for "padding" strings
    let numberLength = String(number).length;
    let padString = '';
    for (let i = 0; i < numberLength; i++) {
        padString += ' ';
    }

    // Manual "left-pad"
    let pad = (s, p) => { if (typeof p === 'undefined') { p = padString; } return String(p+s).slice(-p.length); };

    for (let i = 0, l = outputFilesList.length; i < l; i++) {
        let file = outputFilesList[i];
        let fullPath = path.resolve(file);
        console.info(`Accessing file ${file} ////// ${fullPath}`);
        fs.access(fullPath, fs.constants.R_OK, async function(err){
            processedFiles++;
            if (!err) {
                valid++;
                //process.stdout.write('.');
            } else {
                invalid.push(fullPath);
                //process.stdout.write('F');
            }


            if (processedFiles % 50 === 0 && processedFiles !== number) {
                //process.stdout.write(' '+pad(processedFiles)+' / ' + number + ' (' + pad((Math.floor(100 * processedFiles / number)), '   ') + "%)\n");
            }

            if (processedFiles === number) {
                let rest = 50 - (processedFiles % 50);
                let spaces = '';
                for (let i = 0; i < rest; i++) {
                    spaces += ' ';
                }
                //process.stdout.write(' '+spaces+valid+' / ' + processedFiles + " (100%)\n");
            }

            await checkFinish();
        });
    }

    function checkFinish (){

        if (processedFiles !== number) {
            return;
        }

        if (invalid.length) {
            process.stdout.write("These files seem not to have been dumped by Gulp flow:\n");
            invalid.forEach((file) => {
                process.stdout.write(" > "+file+"\n");
            });

            done();
            process.exit(1);
        } else {
            process.stdout.write("All files seem to have been dumped correctly 👍\n");

            done();
            process.exit(0);
        }
    }

}));

/**
 * Small user guide
 */
gulp.task('default', function(done){
    console.info("");
    console.info("usage: gulp [command] [--prod]");
    console.info("");
    console.info("Options:");
    console.info("    --prod       If specified, will run clean-css and uglify when dumping the assets.");
    console.info("");
    console.info("Commands:");
    console.info("    copy         Copy the sources in the `config.copy` into a destination folder.");
    console.info("    images       Dumps the sources in the `config.images` parameter from image files.");
    console.info("    less         Dumps the sources in the `config.less` parameter from LESS files.");
    console.info("    sass         Dumps the sources in the `config.sass` parameter from SCSS files.");
    console.info("    css          Dumps the sources in the `config.css` parameter from plain CSS files.");
    console.info("    js           Dumps the sources in the `config.js` parameter from plain JS files.");
    console.info("    dump         Executes all the above commands.");
    console.info("    watch        Executes 'dump', then watches all sources, and dumps all assets once any file is updated.");
    console.info("    test         Executes 'dump', then makes sure that all files in the sources directories are dumped correctly.");
    console.info("");
    done();
});

// Gulpfile with a single var as configuration.
// License: MIT
// Author: 2016 - Alex "Pierstoval" Rock Ancelet <alex@orbitale.io>
// Repository: https://github.com/Orbitale/Gulpfile
