/**
 * @file
 * AssessmentSummaryVisualisation.
 *
 * This class + jquery plugin deals with turning assessment summary fields into
 * visualisations using d3js.
 *
 * A lot of markup is generated by this which is not ideal but a necessary evil
 * for generating our SVGs. TODO: consider moving icons to svg files? They are not
 * big so not really worth it.
 *
 * The SVGs are heavily complimented by _assessment-summary.scss and the .ass-comp-vis
 * component.
 *
 * NOTE:
 * Confidence and comparability icons are handled by a field preprocessor.
 *
 * NOTE 2 (compatability with IE/EDGE):
 * A polyfill is used for IE and EDGE support due to not fully supporting innerHTML
 * on a svg object resulting in d3 the .html() method not working on svg objects
 * (used to add our grades). Polyfil innersvg.js is in the libraries folder.
 * Polyfill - https://code.google.com/archive/p/innersvg/
 * Issue - http://stackoverflow.com/questions/27307635/d3-js-ie-vs-chrome-svg-not-showing.
 */

(function ($) {

  "use strict";

  /**
   * Storage for all visualisations in the DOM.
   */
  var AssessmentSummaryVisualisations = [];

  /**
   * AssessmentSummaryVisualisation class.
   */
  var AssessmentSummaryVisualisation = function(dom, settings) {
    var self = this;

    /*
     * Available options and defaults.
     */
    self.defaults = {
      dom: dom,
      $dom: $(dom),
      $componentDom: {},
      visId: 0,
      trendSelector: '.ass-sum__item__trend',
      gradeSelector: '.ass-sum__item__grade',
      componentSelector: '.ass-sum__component-data',
      componentClass: 'ass-sum-vis',
      barWidth: 300,
      barHeight: 30,
      iconOffset: 12,
      gradient: '#d33526,#d47c26,#dee21b,#a5c956',
      gradientId: '',
      labels: [],
      trend: '',
      grade: 0,
      gradeScale: 4,
      notAssessedText: 'Insufficient information to make an assessment',
      trendIconScale: 0.3
    };

    // Settings start with defaults and extended by options passed to the constructor.
    self.settings = $.extend(self.defaults, settings);

    // Create an id for the gradient (each bar can differ).
    self.settings.gradientId = self.settings.componentClass + '__gradient-' + self.settings.visId;

    // The component (parent) for shared settings.
    self.settings.$componentDom = self.settings.$dom.closest(self.settings.componentSelector);

    // Storage for the values for this summary.
    self.data = [];

    /*
     * Return a bar SVG, with a given number of bars (gradeScale).
     */
    self.barSvg = function (gradeScale) {
      // Default grade count is 4, use this to calculate the width of each section.
      gradeScale = gradeScale || 4;
      var rectWidth = parseInt(self.settings.barWidth) / parseInt(gradeScale), svg, i;
      // Build Output.
      svg = '<svg class="' + self.settings.componentClass + '__bar grade-count-' + gradeScale + '"><g>';
      svg += '<rect class="' + self.settings.componentClass + '__gradient-bar" style="fill: url(#' + self.settings.gradientId + ')"/>';
      for (i = 1; i <= gradeScale; i++) {
        // Each rectangle gets created with the correct x offset and width based on gradeScale.
        svg += '<rect class="grade grade-' + i + '" x="' + ((i - 1) * rectWidth) + '" width="' + rectWidth + '" height="' + (self.settings.barHeight - 4) + '" y="0"/>';
      }
      svg += '</g></svg>';
      return svg;
    };

    /*
     * Adds a bar gradient.
     */
    self.barGradient = function () {
      var svg = '<linearGradient id="' + self.settings.gradientId + '">',
        cols = self.settings.gradient.split(','),
        i, offset;
      // Create each section of the linear gradient.
      for (i in cols) {
        offset = (100 / (cols.length)) * i;
        svg += '<stop offset="' + offset + '%" stop-color="' + cols[i] + '" />';
      }
      svg += '</linearGradient>';
      return svg;
    };

    /*
     * Trend icon.
     */
    self.trendIconSvg = function (trend) {
      trend = trend.toLowerCase();
      var comp = self.settings.componentClass, trendClass, icon;
      trendClass = comp + '__trend ' + comp + '__trend__' + trend.replace(' ', '-');
      switch (trend) {
        case "improving":
          icon = '<path class="trend-icon" d="M74,51.6l-6.2,6.1l0-20.3L32.7,72.6l-4.4-4.4l35.1-35.1H43.3l6.1-6.1H74V51.6z"/>';
          break;

        case "deteriorating":
          icon = '<path class="trend-icon" d="M28.4,48l6.2-6.1l0,20.3L69.6,27l4.4,4.4L38.9,66.5h20.2L53,72.6H28.4V48z"/>';
          break;

        case "stable":
          icon = '<rect class="trend-icon" x="30" y="46" width="41" height="8"/>';
          break;

        case "unclear":
          icon = '<path class="trend-icon" d="M45.8,59.7L45.7,58c-0.5-3.5,0.9-7.3,4.8-11.1c3.5-3.4,5.4-5.9,5.4-8.8c0-3.3-2.5-5.5-7.3-5.5 c-2.8,0-5.9,0.8-7.8,2l-1.9-4.1c2.6-1.5,7-2.6,11.1-2.6c8.9,0,12.9,4.6,12.9,9.5c0,4.4-2.9,7.5-6.7,11.2c-3.4,3.3-4.6,6.2-4.4,9.5 l0.1,1.7H45.8z M44.1,68.7c0-2.4,1.9-4.1,4.6-4.1s4.6,1.7,4.6,4.1c0,2.3-1.8,4-4.6,4C46,72.7,44.1,71,44.1,68.7z"/>';
          break;

        default:
          return null;
      }
      return '<g class="' + trendClass + '" transform="scale(' + self.settings.trendIconScale + ')"><rect class="trend-box" x="4" y="5" width="95" height="93" />' + icon + '</g>';
    };

    /*
     * If not assessed, replace grade vis with message.
     */
    self.notAssessed = function () {
      var $el = $('<div />')
        .addClass(self.settings.componentClass + '__not-assessed')
        .html(self.settings.notAssessedText);
      $(self.settings.gradeSelector, self.settings.$dom).html($el);
      self.hideFields();
    };

    /*
     * Hides the fields that we only required for getting the values.
     */
    self.hideFields = function() {
      $(self.settings.trendSelector, self.settings.$dom).hide();
      return self;
    };

    /*
     * Check the grade is valid (gt 0 and not empty).
     */
    self.validateGrade = function () {
      var grade = parseFloat($(self.settings.gradeSelector, self.settings.$dom).html());
      return grade > 0;
    };

    /*
     * Load values from the DOM into settings.
     */
    self.loadDomValues = function () {
      self.settings.trend = $(self.settings.trendSelector, self.settings.$dom).html();
      self.settings.grade = $(self.settings.trendSelector, self.settings.$dom).html();
      self.settings.gradeScale = self.settings.$componentDom.data('scale');
      self.settings.labels = self.settings.$componentDom.data('labels') !== undefined ? self.settings.$componentDom.data('labels').split(',') : [];
      return self;
    };

    /*
     * Prepare data required by d3 into an array.
     */
    self.prepareDataValues = function () {
      self.data.push({
        trend: $(self.settings.trendSelector, self.settings.$dom).html(),
        grade: $(self.settings.gradeSelector, self.settings.$dom).html(),
        gradeScale: self.settings.$componentDom.data('scale')
      });
      return self;
    };

    /*
     * Build the d3 visualisation.
     */
    self.buildBar = function () {
      var fig, $grade = $(self.settings.gradeSelector, self.settings.$dom);
      // Replace the trend value with the vi.
      fig = d3.select($grade[0])
        .html('')
        .selectAll('g')
        .data(self.data)
        .enter()
        .append('svg')
        .attr('viewBox', '0 0 ' + (self.settings.barWidth + (self.settings.iconOffset * 2)) + ' ' + (self.settings.barHeight + 10))
        .attr('class', self.settings.componentClass)
        .attr("aria-labeledby", "title")
        .attr("role", "diagram");

      // Adds the definition for the gradient.
      fig.append('defs')
        .html(self.barGradient());

      // Add background bar.
      fig.append("svg")
        .html(function (d) {
          // Create a bar based on the grade count.
          return self.barSvg(d.gradeScale);
        })
        .attr("x", (self.settings.iconOffset / 2))
        .attr("y", 3);

      // Add trend icon.
      fig.append("svg")
        .attr("x", function (d) {
          // Set the offset (grade) on the bar.
          return self.getOffset(d);
        })
        .attr("y", 0)
        .attr("title", function (d) {
          // Set a textural representation of the grade/trend as a title.
          var title = 'Grade: ' + self.getGradeLabel(d.grade) + ' - Trend: ' + d.trend;
          $grade.attr('title', title);
          return title;
        })
        .html(function (d) {
          // Add a textural representation of the grade/trend as a title element
          // for better accessibility.
          var title = '<title>Grade: ' + self.getGradeLabel(d.grade) + ' - Trend: ' + d.trend + '</title>';
          // Get the correct icon based on the trend.
          return title + self.trendIconSvg(d.trend);
        });

      return self;
    };

    /*
     * Get the offset for placing the trend icon on the bar.
     */
    self.getOffset = function(d) {
      // The trend icon is shifted to the left by half a point as defined by business rules.
      var grade = parseFloat(d.grade) - 0.5,
        // Get the offset percentage, multiply by bar width and subtract icon offset.
        offset = ((grade / d.gradeScale) * self.settings.barWidth) - self.settings.iconOffset;
      // To prevent the icon hanging off either end of the graph limit to bottom/top values.
      offset = offset < 0 ? 0 : offset;
      return offset > self.settings.barWidth ? (self.settings.barWidth - self.settings.iconOffset) : offset;
    };

    /*
     * Get a grade label.
     */
    self.getGradeLabel = function (grade) {
      // By subtracting 0.5 from the grade then parsing as int, we get the correct key for the label.
      var gradeInt = parseInt((parseFloat(grade) - 0.5));
      if (self.settings.labels[gradeInt]) {
        return self.settings.labels[gradeInt];
      }
      return '';
    };

    /*
     * Initialize callback.
     */
    self.init = function() {
      // If grade is not valid, we do not render a visualisation.
      if (!self.validateGrade()) {
        self.notAssessed();
        return;
      }

      // Valid grade, let's build this thing.
      self
        .loadDomValues()
        .prepareDataValues()
        .hideFields()
        .buildBar();
    };

    // Kick it all off.
    self.init();
  };

  /**
   * JQuery plugin/function.
   */
  $.fn.AssessmentSummaryVisualisation = function (settings) {
    window.AssessmentSummaryVisualisation = window.AssessmentSummaryVisualisation || [];
    settings = settings || {};
    return this.each(function (i, dom) {
      settings.visId = window.AssessmentSummaryVisualisation.length + 1;
      window.AssessmentSummaryVisualisation.push(
        new AssessmentSummaryVisualisation(dom, settings)
      );
    });
  };

})(jQuery);
