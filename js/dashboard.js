'use strict';

// Declare classes
var Match = function(singles, date, time, location, players, confirmed, key) {
	this.singles = singles;
	this.date = date;
	this.time = time;
	this.location = location;
	this.players = players;
	this.confirmed = confirmed;
	this.key = key;
};


// AngularJS
var app = angular.module('dashboard', ['ngRoute']);

app.config(['$routeProvider', function($routeProvider) {
	$routeProvider
		.when('/',              {templateUrl: '/templates/summary.html', controller: 'SummaryCtrl as summary'})
		.when('/req_match',     {templateUrl: '/templates/req_match.html', controller: 'ReqCtrl as req'})
		.when('/conf_match',    {templateUrl: '/templates/conf_match.html', controller: 'MatchCtrl as match'})
		.when('/pend_match',    {templateUrl: '/templates/pend_match.html', controller: 'MatchCtrl as match'})
		.when('/avail_match',   {templateUrl: '/templates/avail_match.html', controller: 'MatchCtrl as match'})
		.otherwise({redirectTo:'/'});
}]);

// "Global variable"/service to store current match to view details of it
app.factory('currentMatch', function() {
	var myMatch = new Match(true, 'a', 'b', 'c', 'd', false);

	// Boilerplate code
	function set(match) { myMatch = match; }
	function get() { return myMatch; }
	return {
		set: set,
		get: get
	}
});

app.controller('SummaryCtrl', function(currentMatch) {
	var summary = this;
	summary.firstName = '';
	summary.confirmedMatches = [];
	summary.pendingMatches = [];
	summary.availableMatches = [];

	// These functions get called on corresponding button clicks
	summary.showReqMatch = function(match) {
		window.location.href = '#/req_match';
	};
	
	summary.showConfMatch = function(match) {
		currentMatch.set(match);
		window.location.href = '#/conf_match';
	};
	
	summary.showPendMatch = function(match) {
		currentMatch.set(match);
		window.location.href = '#/pend_match';
	};

	summary.showAvailMatch = function(match) {
		currentMatch.set(match);
		window.location.href = '#/avail_match';
	};
});

app.controller('ReqCtrl', function() {
	var req = this;

	// Regex for form validation
	req.datePattern = '[0-9]{2}/[0-9]{2}/[0-9]{4}';
	req.timePattern = '[0-9]{2}:[0-9]{2}';

	req.submitForm = function(isValid) {
		if (isValid) {
			// First, disable all inputs while match request is in process
			$('.container :input, select, button').attr('disabled', true);

			// Read values from form
			var singlesDoubles = $('#singles-doubles').val();
			var date           = $('#date').val();
			var time           = $('#time').val();
			var location       = $('#pac-input').val();

			// Convert singlesDoubles to boolean
			var singles = singlesDoubles=='singles' ? true : false;

			var match = {
				'singles':   singles,
				'date':      date,
				'time':      time,
				'location':  location,
				'players':   [],     // back-end will set default value
				'confirmed': false,  // ditto
				'ntrp':      0.0,    // ditto
			};

			// Call back-end API
			gapi.client.tennis.createMatch(match).
				execute(function(resp) {
					bootbox.dialog({
						closeButton: false,
						message: "Match request successful",
						buttons: {
							ok: {
								label: "OK",
								className: "btn-default",
								callback: function() {
									window.location.href = '/dashboard';
								}
							}
						}
					});
				});
		}
	}
});

app.controller('MatchCtrl', function(currentMatch) {
	var match = this;
	match.currentMatch = currentMatch.get();
});


// Any Google API functionality must be executed -after- the gapi is loaded, thus it's placed in a callback
function onGapiLoad() {
	// Check Google OAuth
	gapi.auth.authorize({client_id: CLIENT_ID, scope: SCOPES, immediate: true}, handleAuthResult);
}

function handleAuthResult(authResult) {
	// Get Angular scope
	var $scope = $('#dashboard').scope();

	if (authResult && !authResult.error) {
		// Get user profile, show personalized greeting
		gapi.client.tennis.getProfile().execute(function(resp) {
			var userId = resp.result.userId;

			// If user has not created a profile, redirect to profile page
			// Else, stay here and update greeting
			if (resp.result.firstName == '' || resp.result.lastName == '') {
				window.location.href = '/profile';
			} else {
				$scope.$apply(function () { $scope.summary.firstName = resp.result.firstName; });
			}
		});

		// Get all matches for current user, populate Confirmed Matches and Pending Matches
		gapi.client.tennis.getMyMatches().execute(function(resp) {
			if ($.isEmptyObject(resp.result)) { return; }

			// The MatchesMsg message is stored in resp.result
			// Go through all matches in the match "list" (see models.py for format)
			var matches = resp.result;
			var num_matches = matches.singles.length;

			var confirmedMatches = [];
			var pendingMatches = [];

			for (var i = 0; i < num_matches; i++) {
				var newMatch = new Match(
					matches.singles[i],
					matches.date[i],
					matches.time[i],
					matches.location[i],
					matches.players[i],
					matches.confirmed[i],
					matches.key[i]
				);

				if (newMatch.confirmed) {
					confirmedMatches.push(newMatch);
				} else {
					pendingMatches.push(newMatch);
				}
			}

			// Point to the confirmed/pendingMatches in the controller
			$scope.$apply(function () {
				$scope.summary.confirmedMatches = confirmedMatches;
				$scope.summary.pendingMatches = pendingMatches;
			});
		});

		// Query all available matches for current user, populate Available Matches
		gapi.client.tennis.getAvailableMatches().execute(function(resp) {
			if ($.isEmptyObject(resp.result)) { return; }

			// The MatchesMsg message is stored in resp.result
			// Go through all matches in the match "list" (see models.py for format)
			var matches = resp.result;
			var num_matches = matches.singles.length;

			var availableMatches = [];

			for (var i = 0; i < num_matches; i++) {
				var newMatch = new Match(
					matches.singles[i],
					matches.date[i],
					matches.time[i],
					matches.location[i],
					matches.players[i],
					matches.confirmed[i],
					matches.key[i]
				);

				availableMatches.push(newMatch);
			}

			// Point to the availableMatches in the controller
			$scope.$apply(function () {
				$scope.summary.availableMatches = availableMatches;
			});
		});

	} else {
		// If user is not authorized, redirect to login page
		window.location = '/login';
	}
}
