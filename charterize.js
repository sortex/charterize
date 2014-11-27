/**
 * Chart module
 *
 * @package    Ongage\Charterize
 * @category   **CATEGORY**
 * @author     Rafi Bodill <rafi@sortex.co.il>
 * @copyright  Copyright (C) 2010 - 2012 Ongage, LTD. All rights reserved.
 * @license    Ongage, 2010-2012
 * @link       http://www.ongage.com
 */
(function ($) {

	// Default chart plugin configuration
	var default_settings = {
		provider:    'Highcharts',
		height:      398,
		extension:   '',
		bind:        '',
		query:       {},
		url:         '',
		type:        'column',
		types:       [ 'pie', 'column', 'bar', 'line', 'area' ],
		/*margin: {
				pie:    [ 40, 100, 40, 100 ],
				column: [ 40, 50, 150, 70 ],
				bar:    [ 40, 50, 80, 80 ],
				line:   [ 40, 50, 150, 70 ]
			},*/
		footer:      { text: 'Powered by Charterize', href: false },
		unit:        '',
		unitleft:    '',
		date_format: '',
		aggregate_values: false,
		// show_date_range: true/false, can also be function that receives response and return subtitle
		show_date_range: true,
		// Define decimals (How many digits to show after decimal point)
		decimals: 0,
		// Add average values to future dates
		future_average: false,
		// Formatters
		xaxis:     {
			formatter: null // function (label, record)
		},
		// Series config
		series: {
			labels: {
				decorator: 'autohide'
			},
			data:   [],
			line:   { data: [] },
			area:   { data: [] },
			column: { data: [] },
			bar:    { data: [] },
			pie:    { data: [], grouping: true },
			funnel: { data: [] }
		},
		// Provider options
		options:     {},
		// i18n
		language:    'en',
		lang: {
			en: {
				area_title:   'Area Chart',
				line_title:   'Line Chart',
				column_title: 'Column Chart',
				bar_title:    'Bar Chart',
				pie_title:    'Pie Chart',
				funnel_title: 'Funnel Chart',
				print_title:  'Print Chart',
				export_title: 'Export Chart'
			}
		}
	};

	// ------------------------------------------------------- METHODS ---------------------------------------------------------

	var methods = {

		/**
		 * Init widget
		 *
		 * @param {Object} options User configuration
		 */
		init: function (options) {
			return this.each(function () {
				var $this      = $(this),
					data       = $this.data('chart'),
					usr_config = $.extend(true, {}, options),
					settings;

				// Merge extension settings with user settings
				if (options.extension) {
					$.extend(true, usr_config, $.fn.chart.extensions[options.extension]);
				}
				// Merge default settings
				settings = $.extend(false, {}, default_settings, usr_config);
				settings.series = $.extend(true, {}, default_settings.series, settings.series);
				settings.xaxis = $.extend(true, {}, default_settings.xaxis, settings.xaxis);
				settings.lang = $.extend(true, {}, default_settings.lang, settings.lang);

				// If the plugin hasn't been initialized yet
				if ( ! data) {

					$this.addClass('charterize');

					// Store target and settings within element data collection
					$this.data('chart', {
						target:   $this,
						settings: settings,
						chart:    null,
						controls: null,
						response: null
					});

					methods.setup.apply(this, [ settings ]);

					if ( ! settings.model) {
						// Call refresh
						methods.refresh.call(this);
					}

				} else {
					data.settings = settings;
					$this.data('chart', data);
				}
			});
		},

		/**
		 * Setup extra elements and bindings
		 *
		 * @param {Object} settings
		 */
		setup: function (settings) {
			var $this     = $(this),
				data      = $this.data('chart'),
				lang      = settings.lang[settings.language],
				title     = '',
				$header   = $('<div />').addClass('chart-controls').append($('<div />').addClass('date-range')),
				$export_print_group = $('<div />').addClass('btn-group');

			// Binding custom events
			$.each(['create', 'beforerefresh', 'refresh', 'beforeload', 'load' ], function (i, event_type) {
				$this.bind(event_type+'.chart', function (event) {
					var func = $(this).data('chart').settings[event.type];
					if ($.isFunction(func)) {
						func.apply(this, arguments);
					}
				});
			});

			if (settings.model) {
				settings.model.onDataChanged.subscribe(function () {
					log('dataView.onDataChanged: chart');
					// Process response
					var response = { payload: settings.model.getItems() },
						query    = settings.model.getRequestQuery(),
						schema   = methods.post_process.apply($this[0], [ response, query ]);

					methods.update.apply($this[0], [ schema ]);
				});

				settings.model.onEmptyResult.subscribe(function () {
//					log('dataView.onEmptyResult: chart');
					$this.empty().html($('<div />').addClass('chart-empty').text('No results found for your criteria'));
				});
//				settings.model.onRowsChanged.subscribe(function (e, args) {
//					log('dataView.onRowsChanged: chart');
//				});
			}

			// Create export button
			$export_print_group.append(
				$('<span />').append($('<a />', { href: '#', text: '', title: lang['print_title']})
					.addClass('info icon print')
					.bind('click', function() {
						methods._print.apply($this[0]);
						return false;
					})
				));

			// Create export button
			$export_print_group.append(
				$('<span />').append($('<a />', { href: '#', text: '', title: lang['export_title']})
					.addClass('info icon export')
					.bind('click', function() {
						methods._export.apply($this[0]);
						return false;
					})
				));

			// Append export & print buttons
			$header.append($export_print_group);

			// Create 'type controls' element
			if (settings.types.length > 1) {
				var $type_group = $('<div />').addClass('btn-group');
				// Append buttons
				for (var i = 0, type_count = settings.types.length; i < type_count; i++) {
					title = lang[settings.types[i]+'_title'];
					$type_group.append(
						$('<span />').append($('<a />', { href: '#', text: '', title: title, rel: settings.types[i] })
							.addClass('info icon chart_'+settings.types[i]+(settings.types[i] == settings.type ? ' selected' : ''))
							.bind('click.chart', function () {
								var $icon = $(this);

								// Add "selected" class only to this icon
								$header.find('.icon').removeClass('selected');
								$icon.addClass('selected');

								methods._switch_type.apply($this[0], [ $icon.attr('rel') ]);
								return false;
							})
					));
				}
				// Add vertical separator
				$header.append($('<div />').addClass('vertical-separator'));

				// Append chart type buttons
				$header.append($type_group);
			}

			// Add header to screen
			$this.before($header);

			// Bind filter form
			if (settings.bind) {
				$('#'+settings.bind).on('submit', function () {
					methods.refresh.call($this[0]);
				});
			}

			$this.trigger('create');
		},

		/**
		 * Destroy chart widget
		 */
		destroy: function () {
			return this.each(function () {

				var $this = $(this),
					data = $this.data('chart');

				// Un-binding events by namespace
				$this.unbind('.chart');

				if (data) {
					// Destroying chart
					// TODO.rafi: I'm taking as granted: Highcharts.destroy()
					data.chart && data.chart.destroy();
					data.chart = null;

					// Removing controls
					data.controls && data.controls.remove();
					data.controls = null;

					// Emptying target element
					$this.empty();

					// Emptying data collections
					data.response = null;
					data.target = null;
				}

				// Removing data collections
				$this.removeData('chart');
			});
		},

		/**
		 * Export chart to JPEG
		 */
		_export: function () {

			var $this      = $(this),
				data       = $this.data('chart'),
				$header    = $this.siblings('h2:first');

			data.chart.exportChart({
				type: 'image/jpeg',
				filename: $header.text() ? $header.text() : 'chart'
			});
		},

		/**
		 * Print Chart
		 */
		_print: function () {
			$(this).data('chart').chart.print();
		},

		/**
		 * Switch chart type
		 *
		 * @param {String} type  Chart type
		 */
		_switch_type: function (type) {
			var $this      = $(this),
				data       = $this.data('chart'),
				settings   = data.settings,
				height     = $this.height(),
				schema;

			// Flash a red background if type is invalid
			if ($.inArray(type, settings.types) < 0) {
				$this.parent().trigger('focus').effect('highlight', { color: '#F55252' }, 1000);
				return false;
			}

			data.settings.type = type;
			$this.data('chart', data);

			if(data.response) {
				$this.empty().addClass('loading').css('height', height+'px');

				// Rebuild schema (Skip AJAX call)
				schema = methods.post_process.apply(this, [ data.response ]);
				methods.update.apply(this, [ schema ]);
			}
		},

		/**
		 * Parses bind form inputs to query
		 *
		 * @param {Object} settings  Object with { bind: '', query: {} }
		 */
		_parse_query_binds: function (settings) {
			var bind_regex = /^bind\((.*)\)$/,
				query        = $.extend(true, {}, settings.query),
				$form, filter, group, matches, selector, $inp, val, date, utc_day_timestamp;

			// Bind filter form
			if ( ! settings.bind) return query;

			$form = $('#'+settings.bind);

			// Empty filters
			query.filter = {};

			for (var i = 0, filter_count = settings.query.filter.length; i < filter_count; i++) {
				filter = settings.query.filter[i];

				if (bind_regex.test(filter[2])) {
					matches = bind_regex.exec(filter[2]);
					if (matches.length == 2) {
						selector = '[name="'+matches[1]+'"]';
						$inp = $form.find('input'+selector+', select'+selector).eq(0);
						val  = $inp.val();

						// TODO.rafi: generify
						// If field has been on dates, change value to unix timestamp
						/*if (val && (matches[1] == 'to_date' || matches[1] == 'from_date')) {
							// Convert datepicker date to Date object
							val = $.datepicker.parseDate('dd-mm-yy', val);
							// Convert to unix timestamp, adjusting to UTC timezone
							//utc_day_timestamp = (date.getTimezoneOffset() * -60) + (date.getTime() / 1000);
							/**
							 * Reducing user's timezone offset to get the final utc timestamp
							 * Example:
							 * - User timezone: GMT + 3
							 * - User filtered by day: 10/05/2013
							 * - Final timestamp sent as filter should be for 09/05/2013 21:00 in UTC (GMT+0)
							 *
							 * Note: when using from-to dates, the timestamp sent is the same, in server side the "to-date" should
							 *       be for 1 day from the from-date - second (adding to the value 1 day in seconds -1 second)
							 *       Then the filter will be: 09/05/2013 21:00 - 10/05/2013 21:00 in UTC and will fetch the correct records.
							 *//*
							/*val = utc_day_timestamp - App.user_timezone_offset;

							// For date_to filters - Set timestamp to the end of the day.
							if ($inp.hasClass('end-of-day')) {
								val += 86399; // 1 Day - 1 Second
							}*/
						//}

						if (val) {
							query.filter[filter[0]] = val;
						}
					}
				} else {
					query.filter.push(filter);
				}
			}

			// Empty group
			query.group = [];

			if (settings.query.group) {
				for (var g = 0, group_count = settings.query.group.length; g < group_count; g++) {
					group = settings.query.group[g];
					if (bind_regex.test(group[0])) {
						matches = bind_regex.exec(group[0]);
						if (matches.length == 2) {
							val = $form.find('input[name="'+matches[1]+'"]:checked').val();
							if (val) {
								query.group.push([val, group[1]]);
							}
						}
					} else if (bind_regex.test(group[1])) {
						matches = bind_regex.exec(group[1]);
						if (matches.length == 2) {
							val = $form.find('select[name="'+matches[1]+'"]').val();
							if (val) {
								query.group.push([group[0], val]);
							}
						}
					} else {
						query.group.push(group);
					}
				}
			}

			return query;
		},

		/**
		 * Refresh data
		 *
		 * @param {Object} settings  Override element's stored settings
		 */
		refresh: function (settings) {

			var $this     = $(this),
				data      = $this.data('chart'),
				height    = $this.height(),
				query;

			// Allow override of settings for refresh
			settings = settings || $.extend(true, {}, data.settings);

			if ( ! settings.query) throw('Missing `query` setting');

			$this.empty().addClass('loading').css('height', height+'px');

//			log('---------------------------------------------');
//			log('this:', $this);
//			log('data:', data);
//			log('refresh query select:', settings.query.select);
//			return;

			// Parse query filter bindings (to form)
			query = methods._parse_query_binds(settings);


			//log('query', query);

			$this.trigger('beforerefresh', [ query ]);

			if (settings.query) {
				var quertData = query.filter;

				if (query.sort) {
					quertData.sort = query.sort;
				}
				if (query.order) {
					quertData.order = query.order;
				}
				$.ajax({
					type: 'GET',
					url:  window.pass.site.domain+'/api/v1/addon_ga/?report_id='+settings.report_id,
					data: quertData,
					success: function (response) {
						// Process response
						var schema = methods.post_process.apply($this[0], [ response, query ]);

						// Prepare small DataView model
						var model = {
							data: response,
							set_data:  function(data) {
								this.data = data;
							},
							get_data:  function() {
								return this.data;
							},
							sum: function (field_name) {
								var total = 0;
								$.each(this.data.payload, function (i, row) {
									total += parseInt(row[field_name]);
								});
								return total;
							},
							get_item:  function (i) {
								return this.data.payload[i];
							},
							get_total:  function () {
								return this.data.metadata['total'];
							}
						};
						model.set_data(response);
						$this.trigger('refresh', [ model ]);

						// Update view
						methods.update.apply($this[0], [ schema ]);
					}
				});
			} else if ( ! settings.model) {
				throw('Must supply query or model for chart to work');
			}
		},

		/**
		 * Process AJAX response, and returns the final schema
		 *
		 * @param {Object} response  Object with { payload: [] }
		 * @param {Object} query     Optional: Query (with bind values) that was used to request data
		 */
		post_process: function (response, query) {

			// Check if the element really exist
			if ($(this).data('chart') === undefined) {
				return false;
			}

			var $this     = $(this),
				data      = $this.data('chart'),
				payload   = response.payload || [],
				settings  = data.settings,
				provider  = $.fn.chart.providers[settings.provider],
				xaxis     = { categories: [] },
				series    = [],
				content,
				fields;

//			console.log('post_process', $.extend({}, response), $.extend({}, query));

			// Fill in gaps - Only if query is provided, and xaxis.type is 'date'
			if (query && settings.xaxis.type == 'date' && payload.length) {
				settings.parse_format = settings.parse_format || 'yyyymmdd';

				// Pad missing month/day into label, if in yy-mm-dd mysql date format
				/*$.each(payload, function (index, record) {
					var label = record[settings.xaxis.field];

					if (settings.parse_format == 'yy-mm-dd' && label.length < 10) {
						// Grouping by week, set the date as the first day of the week
						if (settings.xaxis.field == 'week') {
							var week = parseInt(label.split('-')[1], 10),
								year = parseInt(label.split('-')[0], 10),
								year_first_day           = new Date(year, 0, 1),
								year_first_day_timestamp = year_first_day.getTime() / 1000,
								week_days_in_seconds     = (week-1) * 7 * 24 * 60 * 60,
								week_first_day           = new Date((year_first_day_timestamp + week_days_in_seconds + year_first_day.getTimezoneOffset()*60) * 1000);
							label = week_first_day.getFullYear()+'-'+(('0' + (week_first_day.getMonth() + 1)).slice(-2))+'-'+(('0' + week_first_day.getDate()).slice(-2));
						} else {
							label += '-01' + (label.length == 4 ? '-01' : '');
						}

						record[settings.xaxis.field] = label;
					}
				});*/

				var date = new Date,
					from = new Date(),
					to = new Date(),//$.datepicker.parseDate(settings.parse_format, payload[payload.length - 1][settings.xaxis.field]),
					ascending,
					new_payload = [],
					count = 0,
					counter = 0,
					total = 0;

				// Searching for from/to date from query filter
				$.each(query.group, function (i, field) {
					var name = $.isArray(field) ? field[0] : field,
						alias = $.isArray(field) ? field[1] : field;

					if (alias == settings.xaxis.field) {
						$.each(query.filter, function (j, condition) {
							if (condition[0] == name) {
								// Convert filter timestamp from user's timezone to user local time
								var filter_time = (condition[2] + (date.getTimezoneOffset() * 60) + App.user_timezone_offset) * 1000;
								if ( ! from || filter_time < from.getTime()) {
									from = new Date(filter_time);
								}
								if ( ! to || filter_time > to.getTime()) {
									to = new Date(filter_time);
								}
							}
						});
					}
				});

				ascending = from.getTime() < to.getTime();

//				console.log('debug', { payload: payload, from: from, to: to, query: query, xaxis: settings.xaxis });

				var _MS_PER_DAY = 1000 * 60 * 60 * 24;

				/**
				 * Helper - Compare two dates by: day, week, month, year
				 * @param {String} date_part  Possible values: day, week, month, year
				 * @param {Date}   local      First date object
				 * @param {Date}   remote     Second date object
				 */
				function date_part_is_diff(date_part, local, remote) {
					if (date_part == 'day' || date_part == 'week') {
						// Calculate the days diff between local & remote dates
						var day_diff = Math.floor((remote.getTime() - local.getTime()) / _MS_PER_DAY);

						if (date_part == 'day') {
							return (day_diff > 0);
						} else if (date_part == 'week') {
							return (day_diff > 7);
						}
					}
					else if (date_part == 'month') {
						return (local.getMonth() != remote.getMonth() || local.getFullYear() != remote.getFullYear());
					} else if (date_part == 'year') {
						return (local.getFullYear() != remote.getFullYear());
					}
				}

				/**
				 * Helper - Increment a date's part: day, week, month, year
				 * @param {String}  date_part  Possible values: day, week, month, year
				 * @param {Date}    date       Date to increment
				 * @param {Boolean} ascend     Ascend?
				 */
				function date_part_increment(date_part, date, ascend) {
					if (date_part == 'day') {
						date.setDate(date.getDate() + (ascend ? 1 : -1));
					} else if (date_part == 'week') {
						date.setDate(date.getDate() + (ascend ? 7 : -7));
					} else if (date_part == 'month') {
						date.setMonth(date.getMonth() + (ascend ? 1 : -1));
					} else if (date_part == 'year') {
						date.setFullYear(date.getFullYear() + (ascend ? 1 : -1));
					}
				}

				// Iterate through all payload records
				$.each(payload, function (index, record) {

					/*var actual = $.datepicker.parseDate(settings.parse_format, record[settings.xaxis.field]),
						new_record,
						ascend;

					// Prepare a new record array
					new_record = $.extend({}, record);
					$.each(new_record, function (key, val) {
						if (key !== settings.xaxis.field) {
							total+=parseFloat(val);
							new_record[key] = count;
						}
					});

//					console.log('--- debug ---', { xaxis_field: settings.xaxis.field, from: from, actual: actual });

					// Detect date gaps and fill them
					if (date_part_is_diff(settings.xaxis.field, from, actual)) {
//						console.log('1st iteration', from, '!=', actual);
						while (date_part_is_diff(settings.xaxis.field, from, actual)) {
							// Insert empty new record
							new_record[settings.xaxis.field] = $.datepicker.formatDate(settings.parse_format, from);
							new_payload.push($.extend({}, new_record));
							counter++;

							ascend = from.getTime() < actual.getTime();
							// Increment 'from' indicator
							date_part_increment(settings.xaxis.field, from, ascend);
						}
					}*/

					// show aggregated value in each record
					if (settings.aggregate_values) {
						$.each(record, function (key, val) {
							if (key !== settings.xaxis.field) {
								count+=parseFloat(val);
								record[key] = count;
							}
						});
					}

					new_payload.push(record);
					counter++;

					// Increment 'from' indicator
					date_part_increment(settings.xaxis.field, from, ascending);
				});

				// Previous iteration always increment `from` at the end. We need to cancel the last increment...
				date_part_increment(settings.xaxis.field, from, ! ascending);
//				console.log('#1 pass: from = ', from.toDateString(), ' to = ', to.toDateString());

				// Fill missing dates at the end
				if (date_part_is_diff(settings.xaxis.field, from, to)) {
					var ascend = from.getTime() < to.getTime(),
						new_record = $.extend({}, payload[0]),
						new_date, current_date, avg;

//					log('debug 2nd', { xaxis_field: settings.xaxis.field, from: from.toDateString(), to: to.toDateString() });

					$.each(new_record, function (key, val) {
						if (key !== settings.xaxis.field) {
							new_record[key] = count;
						}
					});

					while (date_part_is_diff(settings.xaxis.field, from, to)) {
						// Increment 'from' indicator
						date_part_increment(settings.xaxis.field, from, ascend);

						new_date = $.datepicker.formatDate(settings.parse_format, from);
						current_date = $.datepicker.formatDate(settings.parse_format, new Date);

//						console.log('# new_date = ', new_date, ' current_date = ', current_date);

						// Insert new record
						new_record[settings.xaxis.field] = new_date;

						if (new_date > current_date) {
							if (settings.future_average) {
								// Use Average value for future dates
								avg = total/counter;
								count+=parseFloat(avg);
								new_record[settings.series.data] = counter ? count : 0;
							}
						} else {
							counter++;
						}
						new_payload.push($.extend({}, new_record));
					}
				}

				// Switch new payload
				payload = new_payload;
			}

//			console.log('store response', $.extend({}, response, payload));

			// Store response
			data.response = response || { payload: [] };
			data.response.payload = payload;
			$this.data('chart', data);

			// Merge provider template with settings.options provided by user
			content = $.extend(true, {}, provider.template, settings.options);

			// Render series
			// Use extension/user series fields. Either by type of chart, or in series.data
			fields = settings.series[settings.type]
				&& $.isArray(settings.series[settings.type].data) && settings.series[settings.type].data.length
					? settings.series[settings.type].data
					: settings.series.data;

			// Data fields can be an object
			if ($.isPlainObject(fields)) {
				if (fields.all && payload[0]) {
					fields = [];
					$.each(payload[0], function (key, value) {
						if (key != settings.xaxis.field) {
							fields.push(key);
						}
					});
				}
			}

			// Process array of strings
			if ($.isArray(fields)) {
				$.each(fields, function (i, field_name) {
					var set = { name: field_name, data: [] };
					set.name = set.name.replace(/_/g, ' ').replace(/^([a-z])|\s+([a-z])/g, function ($1) { return $1.toUpperCase() });
					$.each(payload, function (i, record) {
						set.data.push(+(record[field_name]));
					});
					series.push(set);
				});
			} else if (payload && payload.length) {
				throw('Fields data for series is invalid')
			}

			// Render X-axis categories
			$.each(payload, function (index, record) {
				var field = settings.xaxis.field,
					type  = settings.xaxis.type,
					label = record[field];

				if (label) {
					label = label.charAt(0).toUpperCase() + label.slice(1);
				}

				// Call extension/user x-axis formatter function
				if ($.isFunction(settings.xaxis.formatter)) {
					label = settings.xaxis.formatter.apply($this[0], [ label, record ]);
				// Call internal formatters
				} else if ($.isFunction(methods.xaxis.formatters[type])) {
					label = methods.xaxis.formatters[type].apply($this[0], [ label, record, settings.xaxis ]);
				}

				// Prepend new label into categories collection
				xaxis.categories.push(label);
			});

			// Call custom provider post_process() function
			if ($.isFunction(provider.post_process)) {
				provider.post_process.apply($this[0], [ content, xaxis, series ])
			} else {
				throw('Provider is missing post_process()');
			}

			// Call custom decorator
			if (settings.series.labels.decorator && $.isFunction(provider.series.labels.decorators[settings.series.labels.decorator])) {
				provider.series.labels.decorators[settings.series.labels.decorator].apply($this[0], [ content, settings ])
			}

			return content;
		},

		/**
		 * Update chart element with final schema
		 *
		 * @param {Object} schema The complete object to create chart with
		 */
		update: function (schema) {

			// Check if the element really exist
			if ($(this).data('chart') === undefined) {
				return false;
			}

			var $this     = $(this),
				data      = $this.data('chart'),
				settings  = data.settings,
				provider  = $.fn.chart.providers[settings.provider],
				$date_from = $('#date_from'),
				$date_to   = $('#date_to'),
				subtitle;

			$this.trigger('beforeload', [ schema ]);

			// TODO: Assuming date range is in page like this, is wrong for a self-contained module
			// Display from-to dates
			if (settings.show_date_range) {
				if (typeof(settings.show_date_range) == 'function') {
					subtitle = settings.show_date_range(data.response);
				} else if ($date_from.length && $date_to.length) {
					subtitle = $date_from.val() + ' - ' + $date_to.val();
				}

				// Update highcharts subtitle
				if (subtitle) {
					$this.parents('.chart:first').find('.date-range')
						.empty()
						.append($('<span />').text('Date'))
						.append(
							$('<span />')
								.addClass('blue')
								.text(subtitle)
					);
				}
			}

			// Call custom provider update() function
			if ($.isFunction(provider.update)) {
				data.chart = provider.update.apply(this, [ schema ]);
				$this.data('chart', data);
			} else {
				throw('Provider is missing update()');
			}

			$this.trigger('load', [ data.chart ]);

			$this.removeClass('loading').css('height', '');
		},

		// Internal helpers

		xaxis: {
			formatters: {
				/**
				 * Formats date fields by a given format
				 * Formats: http://docs.jquery.com/UI/Datepicker/parseDate
				 *
				 * @param {String} label
				 * @param {Object} record
				 * @param {Object} args
				 */
				date: function (label, record, args) {
					return label;
				}
			}
		}
	};

	/**
	 * Chart plugin
	 *
	 * @param method
	 */
	$.fn.chart = function (method) {

		if (methods[method]) {
			return methods[method].apply(this, Array.prototype.slice.call(arguments, 1));
		} else {
			if (typeof method === 'object' || ! method) {
				return methods.init.apply(this, arguments);
			} else {
				$.error('Method '+method+' does not exist on jQuery.chart');
			}
		}
	};

	/**
	 * Set default settings
	 *
	 * @param {Object} options
	 */
	$.fn.chart.set_defaults = function (options) {
		$.extend(true, default_settings, options || {});
	};

	// ------------------------------------------------------- PROVIDERS -------------------------------------------------------

	$.fn.chart.providers = {

		/**
		 * Provider: Highcharts
		 */
		Highcharts: {

			/**
			 * Highcharts - Post process
			 *
			 * @param {Object} content
			 * @param {Object} xaxis
			 * @param {Array}  series
			 */
			post_process: function (content, xaxis, series) {
				var $this     = $(this),
					data      = $this.data('chart'),
					settings  = data.settings;

				//console.log('highcharts post_process', content, xaxis, series);

				// Pie: Custom formatting
				if (settings.type == 'pie') {
					content.series = [ { data: [] }];
					if (settings.series.pie && settings.series.pie.grouping) {
						// Summarize each series data values into one
						$.each(series, function (index, serie) {
							var name = serie.name,
								sum  = 0;
							// Summarize each data value
							$.each(serie.data, function(i, count) {
								sum += count;
							});
							content.series[0].data.push([ name, sum ]);
						});
					} else {
						$.each(series, function (index, serie) {
							$.each(serie.data, function(i, value) {
								content.series[0].data.push([ xaxis.categories[i], value ]);
							});
						});
					}
				} else {

					// Limit column/bar charts by width/height ratio
					if (settings.type == 'column' || settings.type == 'bar') {
						// Set the sweet spot! how much does does a column or bar weight in pixels?
						var stacks  = (settings.options && settings.options.plotOptions && settings.options.plotOptions[settings.type]
									    && settings.options.plotOptions[settings.type].stacking == 'normal')
									|| (settings.options && settings.options.plotOptions && settings.options.plotOptions.series
									    && settings.options.plotOptions.series.stacking == 'normal')
									? 1 : series.length,
							weight  = 10 * stacks,
							el_size = settings.type == 'column' ? $this.width() : $this.height();

						// See if there's too much categories for our element to contain
						if (xaxis.categories.length * weight > el_size) {
							// We have a bar overflow!
							// See how many columns/bars we can hold in our element..
							var limit = Math.round(el_size / weight),
								// How many shall we remove?
								remove = xaxis.categories.length - limit;

							// Splice them categories yo!
							xaxis.categories.splice(0, remove);
							// Splice each series data set also
							$.each(series, function (index, serie) {
								serie.data.splice(0, remove);
							});

							// If type is not date, it won't get an automatic title. Warn the user we limited his result!
							if (( ! settings.xaxis.type || settings.xaxis.type != 'date' ) && xaxis.categories.length > 1) {
								content.title.text = 'Showing top '+limit+' items';
							}
						}
					}

					// Update main content with processed series and x-axis categories
					content.series = series;
					content.xAxis.categories = xaxis.categories;
				}

				// Custom Funnel
				if (settings.type == 'funnel') {
					// Change x by window width
					if ($(window).width() > 1399) {
						content.plotOptions.series = { dataLabels: { x: -220 } };
					}
				}

//				// If x-axis=date, add title from first and last x-axis category
//				if (settings.xaxis.type && settings.xaxis.type == 'date' && xaxis.categories.length > 1) {
//					content.title.text = xaxis.categories[0]+' - '+xaxis.categories[xaxis.categories.length - 1];
//				}
			},

			/**
			 * Highcharts - Update chart
			 * Returns new Highcharts object
			 *
			 * @param {Object} schema
			 */
			update: function (schema) {
				var $this        = $(this),
					data         = $this.data('chart'),
					settings     = data.settings,
					formatters   = $.fn.chart.providers.Highcharts.series[settings.type];

//				console.log('highcharts update', schema);

				// Add general chart attributes
				schema.chart.renderTo = $this.attr('id');
				schema.credits = settings.footer;
				// i18n: http://www.highcharts.com/ref/#lang
				schema.lang = { exportButtonTitle: 'Save chart as image' };
				if (settings.type) {
					schema.chart.defaultSeriesType = settings.type;
					// TODO.rafi: Disable label rotation on 'bar' charts
					if (settings.type == 'bar') {
						schema.xAxis.labels.rotation = 0;
					}
				}

				// Define chart options from settings
				// @link http://www.highcharts.com/ref/#chart
				settings.height ? schema.chart.height = settings.height : null;
				settings.colors ? schema.colors = settings.colors : null;
				if (settings.margin) {
					// Allow margin by type
					schema.chart.margin = settings.margin[settings.type]
						? settings.margin[settings.type]
						: settings.margin;
				}

				// Check if there is any data
				var empty = ! schema.series.length;
				if ( ! empty) {
					if (settings.type == 'pie') {
						// Filter empty series data
						schema.series[0].data = $.grep(schema.series[0].data, function(el) { return el[1] ? true : false });
						empty = ! schema.series[0].data.length;
					} else {
						$.each(schema.series, function (i, val) {
							empty = val.data.length === 0 || empty;
						});
					}
				}

				// Show empty message if no data
				if (empty) {
					$this.empty().html($('<div />').addClass('chart-empty').text('No results found for your criteria'));
					return false;
				}

				// Attaching custom formatters
				// Use user tooltip setting as first priority
				if (settings.options.tooltip) {
					schema.tooltip = settings.options.tooltip;
				// Or use internal formatter
				} else if (formatters.tooltip) {
					schema.tooltip.formatter = function () {
						return formatters.tooltip.formatters.unit.apply(this, [ settings ]);
					};
				}
				if (formatters.data_labels) {
					schema.plotOptions[settings.type == 'funnel' ? 'series' : settings.type].dataLabels.formatter = function () {
						return formatters.data_labels.formatters.unit.apply(this, [ settings ]);
					}
				}
				if (formatters.stack_labels) {
					if ( ! schema.yAxis.stackLabels) {
						schema.yAxis.stackLabels = {};
					}
					schema.yAxis.stackLabels.formatter = function () {
						return formatters.stack_labels.formatters.unit.apply(this, [ settings ]);
					}
				}

//				log('final schema', schema);

				return new Highcharts.Chart(schema);
			},

			/**
			 * Highcharts - Series custom options
			 */
			series: {
				labels: {
					decorators: {
						/**
						 * Auto-hide data labels if plot is too large
						 *
						 * @param {Object} schema
						 * @param {Object} settings
						 */
						autohide: function (schema, settings) {
//							log('categories', schema.xAxis.categories.length, 'series', schema.series.length, schema.series[0].data.length);
							// Disabling x-axis labels if categories > 60
							if (schema.xAxis.categories && schema.xAxis.categories.length > 60) {
//								schema.xAxis.labels.staggerLines = 2;
								if ( ! schema.xAxis.labels) {
									schema.xAxis.labels = {};
								}
								schema.xAxis.labels.step = Math.ceil(schema.xAxis.categories.length / 60) * 2;
								// Disabling x-axis labels if categories > 120
								if (schema.xAxis.categories.length > 120) {
									schema.xAxis.labels.enabled = false;
								}
							}

							// Disable series point labels if data > 100
							if (schema.series[0] && schema.series[0].data && schema.series[0].data.length > 100) {
								schema.plotOptions[settings.type].dataLabels.enabled = false;
							}
						}
					}
				},
				line: {
					tooltip: {
						formatters: {
							unit: function (settings) {
								var name = this.series.name.replace('Ga:', ''),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;

								return '<span style="font-size:10px">'+this.x+'</span><br/>'
									+'<span style="color:#4a4a4a">'+(name.charAt(0).toUpperCase() + name.slice(1))+'</span>: '
									+'<b>'+unitleft+Highcharts.numberFormat(this.y, settings.decimals).replace(/\.0+$/,'')+unit+'</b>';
							}
						}
					},
					data_labels: {
						formatters: {
							unit: function (settings) {
								if ( ! this.y) return '';
								var name = this.series.name.replace(/ /g, '_').toLowerCase(),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return unitleft+Highcharts.numberFormat(this.y, settings.decimals).replace(/\.0+$/,'')+unit;
							}
						}
					}
				},
				area: {
					tooltip: {
						formatters: {
							unit: function (settings) {
								var name = this.series.name.replace('Ga:', ''),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;

								return '<span style="font-size:10px">'+this.x+'</span><br/>'
									+'<span style="color:#4a4a4a">'+(name.charAt(0).toUpperCase() + name.slice(1))+'</span>: '
									+'<b>'+unitleft+Highcharts.numberFormat(this.y, settings.decimals).replace(/\.0+$/,'')+unit+'</b>';
							}
						}
					},
					data_labels: {
						formatters: {
							unit: function (settings) {
								if ( ! this.y) return '';
								var name = this.series.name.replace(/ /g, '_').toLowerCase(),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return unitleft+Highcharts.numberFormat(this.y, settings.decimals).replace(/\.0+$/,'')+unit;
							}
						}
					}
				},
				bar: {
					tooltip: {
						formatters: {
							unit: function (settings) {
								var name = this.series.name.replace(/ /g, '_').toLowerCase(),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return '<span style="font-size:10px">'+this.x+'</span><br/>'
									+'<span style="color:#4a4a4a">'+this.series.name+'</span>: '
									+'<b>'+unitleft+Highcharts.numberFormat(this.y, settings.decimals)+unit+'</b>';
							}
						}
					},
					stack_labels: {
						formatters: {
							unit: function () {
								if ( ! this.total) return '';
								return Highcharts.numberFormat(this.total, 0);
							}
						}
					},
					data_labels: {
						formatters: {
							unit: function (settings) {
								if ( ! this.y) return '';
								var name = this.series.name.replace(/ /g, '_').toLowerCase(),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return unitleft+Highcharts.numberFormat(this.y, settings.decimals)+unit;
							}
						}
					}
				},
				column: {
					tooltip: {
						formatters: {
							unit: function (settings) {
								var name = this.series.name.replace('Ga:', '').replace(/ /g, '_').toLowerCase(),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return (this.x ? '<span style="font-size:10px">'+this.x+'</span><br/>' : '')
									+'<span style="color:#4a4a4a">'+(name.charAt(0).toUpperCase() + name.slice(1))+'</span>: '
									+'<b>'+unitleft+Highcharts.numberFormat(this.y, settings.decimals)+unit+'</b>';
							}
						}
					},
					stack_labels: {
						formatters: {
							unit: function (settings) {
								if ( ! this.total) return '';
								var unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return unitleft+Highcharts.numberFormat(this.total, settings.decimals)+unit;
							}
						}
					},
					data_labels: {
						formatters: {
							unit: function (settings) {
								if ( ! this.y) return '';
								var name = this.series.name.replace(/ /g, '_').toLowerCase(),
									unit = $.isPlainObject(settings.unit) ? settings.unit[name] || '' : settings.unit,
									unitleft = $.isPlainObject(settings.unitleft) ? settings.unitleft[name] || '' : settings.unitleft;
								return unitleft+Highcharts.numberFormat(this.y, settings.decimals)+unit;
							}
						}
					}
				},
				pie: {
					tooltip: {
						formatters: {
							unit: function (settings) {
								return this.point.name+': '+Highcharts.numberFormat(this.y, 0)+'<br/>'
									+this.percentage.toFixed(2)+'% of '+Highcharts.numberFormat(this.total, settings.decimals)+' total';
							}
						}
					},
					data_labels: {
						formatters: {
							unit: function () {
								return this.point.name+' '+this.percentage.toFixed(0)+'%';
							}
						}
					}
				},
				funnel: {
					tooltip: {
						formatters: {
							unit: function (settings) {
								return '<span style="color:#4a4a4a">'+this.point.name+'</span>: '
									+'<b>'+Highcharts.numberFormat(this.y, settings.decimals)+'</b>';
							}
						}
					},
					data_labels: {
						formatters: {
							unit: function (settings) {
								return '<b>'+this.point.name+'</b>: '+Highcharts.numberFormat(this.point.y, settings.decimals);
							}
						}
					}
				}

			}, // series

			/**
			 * Highcharts - Schema template base
			 */
			template: {
				chart: {
					zoomType: 'x'/*,
					renderTo: '',
					defaultSeriesType: '',
					margin: [ 40, 60, 130, 60 ]*/
				},
				legend: {
					layout: 'vertical',
					align: 'left',
					verticalAlign: 'top',
					x: 50,
					y: 0,
					floating: true,
					borderWidth: 1,
					backgroundColor: '#FFFFFF'
				},
				colors: [ 'dodgerblue', '#0DDDAB', 'gold', 'dimgray', '#cc66a7', '#ffee18', '#b9b9b9', '#00716c', '#678102', '#656565' ],
				title: { text: '' },
				subtitle: { text: '' },
				xAxis: {
					categories: []//,
					/*labels: {
						rotation: -65,
						align: 'right',
						style: { font: 'normal 11px Verdana, sans-serif', color: '#383838' }
					}*/
				},
				yAxis: {
					//min: 0,
					title: { text: '' }
					//labels: {
					//	style: { font: 'normal 11px Verdana, sans-serif', color: '#383838' }
					//},
					//stackLabels: { enabled: true }
				},
				tooltip: {},
				plotOptions: {
					line: {
						dataLabels: { enabled: true, color: '#383838', style: { font: 'normal 11px Verdana, sans-serif' } },
						enableMouseTracking: true
					},
					area: {
						dataLabels: { enabled: true, color: '#383838', style: { font: 'normal 11px Verdana, sans-serif' } },
						enableMouseTracking: true
					},
					bar: {
						dataLabels: { enabled: true, color: '#383838', style: { font: 'normal 11px Verdana, sans-serif' } },
						enableMouseTracking: true
					},
					column: {
						stacking: 'normal', // null, normal, percent
						dataLabels: { enabled: false, color: '#383838', style: { font: 'normal 11px Verdana, sans-serif' } },
						enableMouseTracking: true
					},
					pie: {
						dataLabels: { enabled: true, color: '#383838', style: { font: 'normal 11px Verdana, sans-serif' } },
						allowPointSelect: true,
						enableMouseTracking: true
					}
				}
			}

		} // Highcharts

	}; // providers

	// ------------------------------------------------------ EXTENSIONS -------------------------------------------------------

	$.fn.chart.extensions = {};

})(jQuery);

