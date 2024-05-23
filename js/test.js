/*
 * Global jQuery objects
 */
var jqMapCanvas = jQuery('#resultMap');
var jqResultList = jQuery('#resultList');
var jqAreaBreadcrumbs = jQuery('#areaBreadcrumbs');
var jqVaccinatorSettings = jQuery('#vaccinator-settings');
var infoWindowTemplate = '';
var selectedMarker;
var yourMarker;
var markerPos;
var secret = ghp_8EFsR2hlDJTB61C0ClDAgUu0Ne83Az0rVVRe
var pin = {
    mobil: true,
    fast: true
};
var filterExtendedOpeningHours = false;
var numItems = 0;
var mapCenter = jqMapCanvas.data('center');
// var mapBounds = jqMapCanvas.data('bounds');
var areasBoundaries;
var myOptions = {
    center: null,
    centerLat: (mapCenter !== null && typeof mapCenter !== 'undefined') ? mapCenter.lat : null,
    centerLng: (mapCenter !== null && typeof mapCenter !== 'undefined') ? mapCenter.lng : null,
    zoom: 12,
    mapTypeId: null,
    mapTypeControl: false,
    streetViewControl: false
};
var renderMarkersTimeout;
var forceOutsideRegion = false;
var popupNotShown = true;
var primaryNormal, primaryLight;
var base = document.getElementsByTagName('base');
if (base && base.length) {
    base = base[0].href;
} else {
    base = '/';
}
var iconDefaultSrc = jqVaccinatorSettings.data('imagesrc') + 'pin_red.png';
var iconDefaultSelectedSrc = jqVaccinatorSettings.data('imagesrc') + 'pin_red_active.png';
var iconMobileSrc = jqVaccinatorSettings.data('imagesrc') + 'pin_blue.png';
var iconMobileSelectedSrc = jqVaccinatorSettings.data('imagesrc') + 'pin_blue_active.png';
var yourLocationSrc = jqVaccinatorSettings.data('imagesrc') + 'pin_your_location.png';
var yourLocationIcon;
var iconDefault;
var iconDefaultSelected;
var iconMobile;
var iconMobileSelected;
var clickedSearchButton = false; // Small hack to tell us if the button was clicked to trigger the autocomplete search.
var spinner;
/*
 * The main map module
 */
var seekhelpModule = seekhelpModule || (function (w, d, $, undefined) {
    'use strict';
    var map,
        mapInfoWindow,
        markers,
        matches,
        module,
        settings = {},
        localStorage = window.localStorage;
    function initMap(element, options) {
        if (!jqMapCanvas.length) {
            return;
        }
        map = new google.maps.Map(element, options);
        
        google.maps.event.addListenerOnce(map, 'idle', function () {
            doSearch();
        });
        // Set up the popup window
        mapInfoWindow = new google.maps.InfoWindow();
        
        mapInfoWindow.addListener('closeclick', function () {
            mapInfoWindow.close();
            
            if (selectedMarker) {
                module.toggleVisibility(selectedMarker.id);
            }
        });
    }
    function initAutocomplete() {
        var activeSearchBox,
            geocoder = new google.maps.Geocoder(),
            getSuggestions,
            jqInput = $('.js-searchForm .js-searchForm-input'),
            navigateTo,
            results = [],
            showResults;
        if (!jqInput.length) {
            return;
        }
        navigateTo = function (place_id) {
            geocoder.geocode({'placeId': place_id}, function (results, status) {
                var centerLat,
                    centerLng,
                    place,
                    placeName = '',
                    placePos = 0;
                if (status !== google.maps.GeocoderStatus.OK || !results[0]) {
                    return;
                }
                place = results[0];
                for (var i = 0; i < place.types.length; i++) {
                    if (place.types[i] === 'political' || place.types[i] === 'sublocality_level_1' || place.types[i] === 'sublocality' || place.types[i] === 'locality' ) {
                        placePos = i;
                        break;
                    }
                }
                placeName =  place.address_components[placePos].long_name;
                ga('send', 'event', 'Sokfalt', 'Klickade pa sokresultat', placeName);
                centerLat = place.geometry.location.lat() + 0;
                centerLng = place.geometry.location.lng() + 0;
                var placeBounds = {
                    'minLat': place.geometry.viewport.getSouthWest().lat(),
                    'maxLat': place.geometry.viewport.getNorthEast().lat(),
                    'minLng': place.geometry.viewport.getSouthWest().lng(),
                    'maxLng': place.geometry.viewport.getNorthEast().lng(),
                };
                var json = {
                    'place': encodeURIComponent(placeName),
                    'center': {
                        'lat': centerLat,
                        'lng': centerLng,
                    },
                    'placeBounds': placeBounds,
                }
             
                var location = base + 'place/' + encodeURIComponent(json.place);
             
                module.savePlace(json);
                window.location.assign(location);
            });
        };
        showResults = function () {
            var fragment = d.createDocumentFragment(),
                i = 0,
                key,
                jqPacContainer = $('.pac-container'),
                jqPacItem,
                jqSearchField;
            // Add pac container if it does not already exist
            if (!jqPacContainer.length) {
                jqPacContainer = $('<div class="pac-container pac-logo"></div>').appendTo('body');
                
                jqPacContainer.on('click', '.pac-item', function () {
                    var placeId = $(this).data('placeId');
                    
                    if (placeId) {
                        navigateTo(placeId);
                    }
                });
            }
            jqSearchField = $(activeSearchBox);
            jqPacContainer.css({
                'position': 'absolute',
                'top': Math.ceil(jqSearchField.offset().top + jqSearchField.height()) + 'px',
                'left': Math.ceil(jqSearchField.offset().left) + 'px'
            });
            
            for (key in results) {
                if (i > 5) {
                    break;
                }
                jqPacItem = $('<div class="pac-item" data-place-id="'+results[key].place_id+'"><span class="pac-icon pac-icon-marker"></span><span class="pac-item-query">'+results[key].description+'</span></div>');
                fragment.appendChild(jqPacItem.get(0));
                i++;
            }
            jqPacContainer.html(fragment);
        };
        getSuggestions = function (predictions, status) {
            if (status != google.maps.places.PlacesServiceStatus.OK) {
                return;
            }
            predictions.forEach(
                function (prediction) {
                    var type = '';
                    for (var i = 0; i < prediction.types.length; i++) {
                        if (results.length === 5) {
                            break;
                        }
                        type = prediction.types[i];
                        if (type === 'postal_town' || type === 'locality' || type === 'sublocality' || type === 'administrative_area_level_2') {
                            results[prediction.place_id] = prediction;
                        }
                    }
                }
            );
            showResults();
        };
        jqInput.on('keyup', function () {
            var serviceRegions = new google.maps.places.AutocompleteService();
            // Clear previous results
            results = [];
            if (this.value.length > 0) {
                // Get new predictions
                serviceRegions.getPlacePredictions({
                    types: ['geocode'],
                    componentRestrictions: {country: "se"},
                    input: this.value
                }, getSuggestions);
            }
        }).on('blur', function () {
            $('.pac-container').fadeOut('fast');
            activeSearchBox = false;
        }).on('focus', function () {
            $('.pac-container').show();
            activeSearchBox = this;
        });
    }
    function clearAllMarkers() {
        var key;
        for (key in markers) {
            if ('object' === typeof markers[key]) {
                markers[key].setMap(null);
            }
        }
        selectedMarker = null;
    }
    function doSearch() {
        var date = jQuery('.dateFilter input.datepicker').val(),
            datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/,
            mapSearchArgs = {},
            marker,
            match = false,
            queryParamPlace = module.getPlace() !== null ? module.getPlace().place : null,
            regExPlace = queryParamPlace ? new RegExp('^' + queryParamPlace + '$', 'gi') : new RegExp();
        jqAreaBreadcrumbs.addClass('active');
        if (datePattern.test(date)) {
            mapSearchArgs.date = date;
            clearAllMarkers();
        }
        jQuery.getJSON("/hitta-vaccinator/ajax/gethc", mapSearchArgs, function (items) {
            numItems = items.length;
            jqAreaBreadcrumbs.removeClass('active');
            
            if (numItems > 0) {
                
                markers = [];
                matches = [];
                for (var i = 0; i < numItems; i++) {
                    if (typeof markers[items[i].id] === 'undefined') {
                        if (items[i].homepage) {
                            // Make sure url starts with http://
                            if (!items[i].homepage.match(/^[a-zA-Z]+:\/\//)) {
                                items[i].homepage = 'http://' + s;
                            }
                        }
                        var marker = new google.maps.Marker({
                            address: items[i].address,
                            animation: google.maps.Animation.DROP,
                            city: items[i].city,
                            desc: items[i].desc,
                            draggable: false,
                            email: items[i].email,
                            has_extended_opening_hours: items[i].has_extended_opening_hours,
                            homepage: items[i].homepage,
                            icon: items[i].type === 'mobil' ? iconMobile : iconDefault,
                            iconDefault: items[i].type === 'mobil' ? iconMobile : iconDefault,
                            iconSelected: items[i].type === 'mobil' ? iconMobileSelected : iconDefaultSelected,
                            id: items[i].id,
                            lat: items[i].lat,
                            lng: items[i].lng,
                            name: items[i].name,
                            org_name: items[i].org_name,
                            person: items[i].person,
                            phone: items[i].phone,
                            position: new google.maps.LatLng(items[i].lat, items[i].lng),
                            raiseOnDrag: false,
                            type: items[i].type,
                            zip: items[i].zip
                        });
                        marker.addListener('click', function () {
                            if (base === '/') {
                                ga('send', 'event', 'Karta', 'Kartklick', this.type);
                                module.toggleVisibility(this.id, false);
                                animateScroll();
                            } else {
                                module.toggleVisibility(this.id, true);
                            }
                        });
                        // Add marker to array so that we can later remove it
                        markers[items[i].id] = marker;
                        if (queryParamPlace && (queryParamPlace === items[i].city || regExPlace.test(items[i].city))) {
                            matches[items[i].id] = marker;
                        }
                    }
                }
                typeof renderMarkers === 'function' && renderMarkers();
            }
        });
    }
    markers = [];
    module = {
        getMap: function () {
            return map;
        },
        getMarkers: function () {
            return markers;
        },
        getMarkersCount: function (markers) {
            var count = 0, key;
            if (!markers || !markers.length) {
                return false;
            }
            for (key in markers) {
                if ('object' === typeof markers[key]) {
                    count++;
                }
            }
            return count;
        },
        getMatches: function () {
            return matches;
        },
        savePlace: function (place) {
            localStorage.setItem('vaccinator_place', btoa(JSON.stringify(place)));
        },
        getPlace: function () {
            var stored = localStorage.getItem('vaccinator_place');
            return stored ? JSON.parse(atob(stored)) : null;
        },
        toggleVisibility: function (markerId, moveMap, event) {
            var key,
                markers = module.getMarkers(),
                jqResultItem = $('#resultItem_' + markerId);
            $(".contactDetails", jqResultList).each(
                function () {
                    if (this != jqResultItem && $(this).is(":visible")) {
                        $(this).slideUp("slow");
                        $(this).parent().removeClass("open");
                        $(this).parent().parent().removeClass("open");
                    }
                }
            );
            // Restore icons
            for (key in markers) {
                if ('object' === typeof markers[key]) {
                    markers[key].setIcon(markers[key].iconDefault);
                }
            }
            if (jqResultItem.find(".contactDetails").css('display') === 'block') {
                selectedMarker = null;
                jqResultItem.find(".contactDetails").slideUp("slow");
                jqResultItem.removeClass("open");
                mapInfoWindow.close();
            } else {
                selectedMarker = markers[markerId];
                selectedMarker.setIcon(selectedMarker.iconSelected);
                var windowContent = infoWindowTemplate;
                windowContent = windowContent.replace(/ID/, selectedMarker.id);
                windowContent = windowContent.replace(/NAME/, selectedMarker.name);
                windowContent = windowContent.replace(/DIRECTIONS/, 'https://maps.apple.com/?q='+selectedMarker.position.lat()+','+selectedMarker.position.lng());
                
                mapInfoWindow.setContent(windowContent);
                mapInfoWindow.setPosition(selectedMarker.position);
                mapInfoWindow.open(map, selectedMarker);
                jqResultItem.addClass("open").find(".contactDetails").addClass('hello').slideDown("slow");
                if (moveMap) {
                    map.panTo(selectedMarker.position);
                }
                trackHCClick("Visa kontaktuppgifter", "Visa uppgifter");
            }
        },
        triggerSearch: function () {
            doSearch();
        },
        /*
         * Parse a search query for a given key and return the value (if it exists).
         */
        getQueryParam: function (param, query) {
            var match,
                pl     = /\+/g,
                search = /([^&=]+)=?([^&]*)/g,
                decode = function (s) {
                    return decodeURIComponent(s.replace(pl, " ")); },
                query  = query || window.location.search.substring(1),
                urlParams = {};
            while (match = search.exec(query)) {
                urlParams[decode(match[1])] = decode(match[2]);
            }
            return urlParams[param] || false;
        },
        init: function (settings) {
            if ('object' !== typeof w.google || 'object' !== typeof w.google.maps) {
                return false;
            }
            var defaultSettings = {
                mapElement: null,
                mapOptions: {}
            };
            if (settings && settings.mapElement && settings.mapOptions) {
                initMap(settings.mapElement, settings.mapOptions);
            }
            initAutocomplete();
            jqResultList.off('click').on('click', '.js-isClickable', function (event) {
                
                    if (jQuery(this).hasClass('resultItem_title')) {
                        
                        var markerId = jQuery(this).parent().attr('id');
                        markerId = markerId.split("_").pop();
                        
                        if (markerId) {
                            seekhelpModule.toggleVisibility(markerId, (base === '/'));
                            // seekhelpModule.toggleVisibility(markerId, false);
                        }
                    } else if (jQuery(this).hasClass('hc-appointment-title')) {
                        if (jQuery(this).next().is(':visible')) {
                            jQuery(this).parent().removeClass('open');
                        } else {
                            jQuery(this).parent().addClass('open');
                        }
                        jQuery(this).next().slideToggle('fast');
                    } else if (jQuery(this).is('a')) {
                        event.stopPropagation();
                    }
                }
            );
        }
    };
    return module;
})(window, window.document, window.jQuery);
jQuery(function ($) {
    $('.js-searchForm').on('submit', function (event) {
        event.preventDefault();
        $('.js-searchForm-input:visible', this).trigger('focus');
    });
    $('.areaDropdown_label').css('cursor', 'pointer').on('click', function (event) {
        var $select = $('.areaDropdown_select');
        
        if ($select.is(':visible')) {
            $select.slideUp();
        } else {
            $select.slideDown();
        }
    });
    
        $('.js-toggleDateFilters').on(
            'click', function () {
                var target = $('#mapDateFilters');
                if (target.is(':visible')) {
                    target.hide();
                } else {
                    target.show().find('input').focus();
                }
            }
        );
        $('.js-toggleDateFilters-mobile').on(
            'click', function () {
                var target = $('#mapDateFilters-mobile');
                if (target.is(':visible')) {
                    target.hide();
                } else {
                    target.show().find('input').focus();
                }
            }
        );
        $('.js-clearDateFilters').on(
            'click', function () {
                $('.dateFilter input.datepicker').val('');
                $(this).parent().parent().hide();
                seekhelpModule.triggerSearch();
            }
        );
        $('.js-filterMapByDate').on(
            'click', function () {
                seekhelpModule.triggerSearch();
            }
        );
        window['ga'] = window['ga'] || function () {
            // try {
            //     // console.log('Google Analytics in disabled! Debug:', arguments);
            // } catch (e) {}
        };
    }
);
function mapsApiReady()
{
    var place = seekhelpModule.getPlace();
    if (place !== null && myOptions.center === null) {
        myOptions.centerLat = place.center.lat;
        myOptions.centerLng = place.center.lng;
    }
    myOptions.mapTypeId = google.maps.MapTypeId.ROADMAP;
    markerPos = (myOptions.centerLat && myOptions.centerLng) ? new google.maps.LatLng(myOptions.centerLat, myOptions.centerLng) : new google.maps.LatLng(62.173276, 14.942265);
    myOptions.center = markerPos;
    yourLocationIcon = new google.maps.MarkerImage(
        yourLocationSrc,
        new google.maps.Size(28, 28),
        new google.maps.Point(0, 0),
        new google.maps.Point(14, 14)
    );
    iconDefault = new google.maps.MarkerImage(
        iconDefaultSrc,
        new google.maps.Size(22, 30),
        new google.maps.Point(0, 0),
        new google.maps.Point(11, 15)
    );
    iconDefaultSelected = new google.maps.MarkerImage(
        iconDefaultSelectedSrc,
        new google.maps.Size(22, 30),
        new google.maps.Point(0, 0),
        new google.maps.Point(11, 15)
    );
    iconMobile = new google.maps.MarkerImage(
        iconMobileSrc,
        new google.maps.Size(22, 30),
        new google.maps.Point(0, 0),
        new google.maps.Point(11, 15)
    );
    iconMobileSelected = new google.maps.MarkerImage(
        iconMobileSelectedSrc,
        new google.maps.Size(22, 30),
        new google.maps.Point(0, 0),
        new google.maps.Point(11, 15)
    );
}
function hideAddressBar()
{
    if (!window.location.hash) {
        if (document.height < window.outerHeight) {
            document.body.style.height = (window.outerHeight + 50) + 'px';
        }
    }
    if (jQuery('#header').length == 1) {
        setTimeout(
            function () {
                window.scrollTo(0, jQuery('.contentStarts').offset().top); }, 1000
        );
    }
    else {
        setTimeout(
            function () {
                window.scrollTo(0, 1); }, 1000
        );
    }
}
function hideNotification(obj)
{
    obj.hide();
    popupNotShown = false;
}
var sendTo = "mail";
function setSendTypeTo(obj)
{
    if (jQuery(obj).hasClass("btnMail")) {
        jQuery(obj).css("background-color", primaryNormal);
        jQuery(obj).next().css("background-color", primaryLight);
        sendTo = "mail";
    }
    else {
        jQuery(obj).css("background-color", primaryNormal);
        jQuery(obj).prev().css("background-color", primaryLight);
        sendTo = "sms";
    }
}
function sendInfo()
{
    var jqCurrentDetails = jQuery(".contactDetails:visible");
    if (!jqCurrentDetails.length) {
        return false;
    }
    var recipient = jQuery("input[name=sendInfoTo]", jqCurrentDetails).val();
    var id = jqCurrentDetails.parent().attr("id").replace("resultItem_", "");
    if (sendTo == "mail") {
        if (validateEmail(recipient)) {
            jQuery.post(
                "/ajax/sendInfo.php", { email: recipient, id: id }, function (data) {
                    jQuery("#mailSent").fadeIn("slow");
                    jQuery("input", jqCurrentDetails).val("");
                }
            );
            trackHCClick('Skicka kontaktuppgifter som e-post', 'Skicka eller hamta uppgifter');
        } else {
            alert("Ogiltig e-postadress");
        }
    } else {
        var phoneNumber = recipient.replace(/[^\d.]/g, "");
        if (isNaN(phoneNumber) || phoneNumber < 1000000) {
            alert("Ogiltigt telefonnummer");
            return;
        }
        jQuery.post(
            "/ajax/sendInfo.php", { phone: recipient.replace(/[^\d.]/g, ""), id: id }, function (data) {
                jQuery("#smsSent").fadeIn("slow");
                jQuery("input", jqCurrentDetails).val("");
            }
        );
        trackHCClick('Skicka kontaktuppgifter som sms', 'Skicka eller hamta uppgifter');
    }
}
function validateEmail(email)
{
    var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
}
function HexToHsv(color)
{
    color = color.replace(/[^0-9,]+/g, "");
    var r = color.split(",")[0];
    var g = color.split(",")[1];
    var b = color.split(",")[2];
    var min = Math.min(r, g, b),
                max = Math.max(r, g, b),
                delta = max - min,
                h, s, v = max;
    v = Math.floor(max / 255 * 100);
    if (max == 0) { return [0, 0, 0];
    }
    s = Math.floor(delta / max * 100);
    var deltadiv = delta == 0 ? 1 : delta;
    if (r == max) { h = (g - b) / deltadiv;
    } else if (g == max) { h = 2 + (b - r) / deltadiv;
    } else { h = 4 + (r - g) / deltadiv;
    }
    h = Math.floor(h * 60);
    if (h < 0) { h += 360;
    }
    return { h: h, s: s, v: v }
}
function HsvToRgb(color)
{
    h = color.h / 360;
    s = color.s / 100;
    v = color.v / 100;
    if (s == 0) {
        var val = Math.round(v * 255);
        return { r: val, g: val, b: val };
    }
    hPos = h * 6;
    hPosBase = Math.floor(hPos);
    base1 = v * (1 - s);
    base2 = v * (1 - s * (hPos - hPosBase));
    base3 = v * (1 - s * (1 - (hPos - hPosBase)));
    if (hPosBase == 0) { red = v; green = base3; blue = base1 }
    else if (hPosBase == 1) { red = base2; green = v; blue = base1 }
    else if (hPosBase == 2) { red = base1; green = v; blue = base3 }
    else if (hPosBase == 3) { red = base1; green = base2; blue = v }
    else if (hPosBase == 4) { red = base3; green = base1; blue = v }
    else { red = v; green = base1; blue = base2 };
    red = Math.round(red * 255);
    green = Math.round(green * 255);
    blue = Math.round(blue * 255);
    return { r: red, g: green, b: blue };
}
function trackHCClick(desc, cat)
{
    if (typeof _gaq != "undefined") {
        _gaq.push(['_trackEvent', cat, desc, selectedMarker ? selectedMarker.name : '']);
    }
    if (typeof ga != "undefined") {
        ga('send', 'event', cat, desc, selectedMarker ? selectedMarker.name : '');
    }
}
function setVisible(id)
{
    var obj = jQuery("#" + id);
    var markerId = id.split("_").pop();
    jQuery(obj).find(".contactDetails").show();
}
function contains(array, item)
{
    for (var i = 0, I = array.length; i < I; ++i) {
        if (array[i] == item) { return true;
        }
    }
    return false;
}
function sortObj(arr)
{
    // Setup Arrays
    var sortedKeys = [];
    var sortedObj = {};
    // Separate keys and sort them
    for (var i in arr) {
        sortedKeys.push(i);
    }
    sortedKeys.sort();
    // Reconstruct sorted obj based on keys
    for (var i in sortedKeys) {
        sortedObj[sortedKeys[i]] = arr[sortedKeys[i]];
    }
    return sortedObj;
}
function getArrayCount(a)
{
    var len = 0;
    for (var i = 0; i < a.length; i++) {
        if (a[i] !== undefined) {
            len++;
        }
    }
    return len;
}
function inIframe()
{
    try {
        return window.self !== window.top;
    } catch (e) {
        return true;
    }
}
function navigateToExternalLink(where)
{
    jQuery("#confirmExternalNavigation").fadeIn("slow");
    externalUrl = where;
}
var rad = function (x) {
    return x * Math.PI / 180;
};
var getDistance = function (p1, p2) {
    var R = 6378137; // Earth’s mean radius in meter
    var dLat = rad(p2.lat() - p1.lat());
    var dLong = rad(p2.lng() - p1.lng());
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(p1.lat())) * Math.cos(rad(p2.lat())) *
        Math.sin(dLong / 2) * Math.sin(dLong / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d; // returns the distance in meter
};
function doNavigate()
{
    if (externalUrl.indexOf('maps.apple.com') >= 0) {
        jQuery(this).parent().hide();
        document.location = externalUrl;
    } else {
        jQuery(this).parent().hide();
        window.open(externalUrl);
    }
}