/**
 * Script: home/client-web/js/customize
 *
 * Contains the Home Page Customization applet.  The applet presents a
 * set of news feeds and weather reports, each of which is displayed as
 * a box that can be dragged to re-order the set.  The draggable boxes
 * are created and managed by the <Home.DraggableBoxManager> class.
 * 
 * Credits:
 * 
 *   Written by Marshall Elfstrand (marshall@vengefulcow.com).
 * 
 * Copyright / License:
 * 
 *   Copyright 2009 Mission Aviation Fellowship
 * 
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 * Version:
 *   $Id: customize.js 82 2008-04-02 22:26:09Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Home
 *
 * The module containing all Home Page classes and data.
 */
@module Home;

// ---------------------------------------------------------------------------


/**
 * Class: Home.DraggableBoxManager
 * 
 * Manages a set of boxes that can be vertically re-arranged.  An event
 * handler is called when the order of the boxes changes, or when a box is
 * removed from the list by the user.  Each box has an associated `key`
 * that aids the event handler in determining what was changed.
 * 
 * Parameters:
 *   managedDiv - the `div` element that is managed by this class
 */
@class DraggableBoxManager(managedDiv) {
  
  // The drag-and-drop reorder code used here is based in part on
  // the "Javascript drag-and-drop ordered list" demonstration at:
  //   http://blog.simon-cozens.org/6785.html
  
  var _managedDiv = managedDiv;
  var _boxes = {};
  var _boxKeys = [];

  // -------------------------------------------------------------------------
  // Group: Box management
  // -------------------------------------------------------------------------
  
  /**
   * Method: addBox
   *
   * Adds a box to the list of draggable items.
   *
   * Parameters:
   *   key - the non-visible tag string used to refer to this box
   *   label - the label string displayed to the user for this item
   *   locked - optional; set to `true` if the user should be prevented
   *     from removing this box (defaults to `false`)
   * 
   * Returns:
   *   `true` if the item was added successfully, `false` if it already
   *   exists in the list.
   */
  @method addBox(key, label, locked) {

    // Make sure we don't already have this item.
    if (_boxes[key] != null) return false;

    // Create the box for this item.
    var div = I3.ui.create("div");
    div.className = "draggableBox";
    if (locked != true) {
      var removeDiv = I3.ui.create("div");
      var removeLink = I3.ui.createActionLink("Remove", key,
        "Remove:" + label, self._onBoxRemove);
      removeLink.key = key;
      removeDiv.className = "draggableBoxRemove";
      removeDiv.appendChild(removeLink);
      div.appendChild(removeDiv);
    }
    div.appendChild(I3.ui.text(label));
    _managedDiv.appendChild(div);

    // Allow the box to be dragged.
    I3.ui.enableDragging(div, { minX:0, maxX:0 });
    div.onDrag = self._onBoxDrag;
    div.onDragEnd = self._onBoxDrop;
    
    // Add the box to the list.
    _boxes[key] = { "key": key, "label": label, "div": div };
    _boxKeys.push(key);
    
    return true;
  }

  /**
   * Method: getBoxes
   *
   * Returns the array of keys in the order that they are visually arranged.
   */
  @method getBoxes() {
    return _boxKeys.slice(0);
  }

  // -------------------------------------------------------------------------
  // Group (Hidden): Internal event handlers
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _onBoxRemove
   *
   * Called when the "Remove" link is clicked on a box.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method _onBoxRemove(e) {
    e = I3.ui.getEvent(e);

    // Remove the item from the key index.
    var key = e.getInfo();
    var newBoxKeys = [];
    for (var i = 0; i < _boxKeys.length; i++) {
      if (_boxKeys[i] != key) newBoxKeys.push(_boxKeys[i]);
    }
    _boxKeys = newBoxKeys;

    // Remove the box from the managed DIV.
    _managedDiv.removeChild(_boxes[key].div);

    // Remove the box object.
    delete _boxes[key];
    
    // Let the delegate know that the box was removed.
    self.onBoxRemove(key);
  }

  /**
   * Private Method: _onBoxDrag
   *
   * Called when the box is being dragged by the user.  Determines where
   * the box is and moves the other boxes to make room as necessary.
   *
   * Parameters:
   *   options - a hash of options.  Contains keys: `x`, `y`, `handle`, and `container`.
   */
  @method _onBoxDrag(options) {
    var x = options.x;
    var y = options.y;
    var element = options.container;
    // Set the style for the box so that it's highlighted.
    element.className = "draggableBox draggableBoxDragging";

    // We're comparing offsets, so the actual x and y value don't matter;
    // we just need the offset of the element being dragged.
    y = element.offsetTop;

    // Determine the index of the element.
    var pos;
    for (pos = 0; pos < _boxKeys.length; pos++) {
      if (_boxes[_boxKeys[pos]].div == element) break;
    }

    // See if the element is being dragged down.
    if (pos != _boxKeys.length - 1 &&
        y > _boxes[_boxKeys[pos + 1]].div.offsetTop) {
      self._swapBoxes(pos + 1, pos);
      self.onBoxReorder(_boxKeys[pos + 1]);
    }

    // See if the element is being dragged up.
    if (pos != 0 &&
        y < _boxes[_boxKeys[pos - 1]].div.offsetTop) {
      self._swapBoxes(pos, pos - 1);
      self.onBoxReorder(_boxKeys[pos - 1]);
    }
  }

  /**
   * Private Method: _onBoxDrop
   *
   * Called when the box has been released from dragging.
   *
   * Parameters:
   *   options - a hash of options.  Contains keys: `x`, `y`, `handle`, and `container`.
   */
  @method _onBoxDrop(options) {
    var x = options.x;
    var y = options.y;
    var element = options.container;
    // Set the style for the box so that it's not highlighted.
    element.className = "draggableBox";
    element.style.top = "0px";
  }

  /**
   * Private Method: _swapBoxes
   *
   * Swaps the vertical positions of two boxes in the `_boxes` array.
   * As the user drags a box, it is swapped with boxes either lower or
   * higher than it, depending on the direction of the drag.
   *
   * Parameters:
   *   i - the index of the first box
   *   j - the index of the second box
   */
  @method _swapBoxes(i, j) {
    var box1 = _boxes[_boxKeys[i]];
    var box2 = _boxes[_boxKeys[j]];
    _managedDiv.removeChild(box1.div);
    _managedDiv.insertBefore(box1.div, box2.div);
    box1.div.style.top = "0px";
    box2.div.style.top = "0px";
    _boxKeys[i] = box2.key;
    _boxKeys[j] = box1.key;
  }
  
  // -------------------------------------------------------------------------
  // Group: Overridable event handlers
  // -------------------------------------------------------------------------

  /**
   * Method: onBoxReorder
   *
   * Called when the user has dragged a box to rearrange it.
   * 
   * Override this method with your own handler to examine the `key` and
   * process the change.
   *
   * Parameters:
   *   key - the key of the box that was re-ordered
   */
  @method onBoxReorder(key) {
    // Empty
  }

  /**
   * Method: onBoxRemove
   *
   * Called when the user has removed a box by clicking the "Remove" link.
   * 
   * Override this method with your own handler to examine the `key` and
   * process the change.
   *
   * Parameters:
   *   key - the key of the box that was removed
   */
  @method onBoxRemove(key) {
    // Empty
  }

}


// ---------------------------------------------------------------------------


/**
 * Class: Home.CustomizeApplet
 *
 * Provides the ability for the user to customize his or her home page,
 * such as which news topic headlines are displayed and which weather
 * forecasts are looked up.
 */
@class CustomizeApplet {

  // -------------------------------------------------------------------------
  // Group (Hidden): Instance variables
  // -------------------------------------------------------------------------

  // Hash of news topic objects.
  var _newsTopics = {};

  // Hash that maps weather city codes to names.
  var _weatherCities = {};

  // Manangers for the draggable boxes in the news and weather sections.
  var _newsBoxManager;
  var _weatherBoxManager;

  // Web controls that we'll need to reference.
  var _newsLocalDiv;
  var _newsExternalDiv;
  var _searchText;
  var _searchButton;
  var _searchingDiv;
  var _searchResultsDiv;
  var _saveButton;
  var _cancelButton;
  var _saveInstructionsDiv;
  var _saveStatusDiv;
  var _saveErrorDiv;


  // -------------------------------------------------------------------------
  // Group: Initialization
  // -------------------------------------------------------------------------

  /**
   * Method: initialize
   *
   * Initializes the applet by retrieving element references and assigning
   * event handlers.
   */
  @method initialize() {

    // Get references to the controls.
    _newsLocalDiv        = I3.ui.get("home-newsChoicesLocal");
    _newsExternalDiv     = I3.ui.get("home-newsChoicesExternal");
    _searchText          = I3.ui.get("home-weatherSearchText");
    _searchButton        = I3.ui.get("home-weatherSearchButton");
    _searchingDiv        = I3.ui.get("home-weatherSearching");
    _searchResultsDiv    = I3.ui.get("home-weatherSearchResults");
    _saveButton          = I3.ui.get("home-saveButton");
    _cancelButton        = I3.ui.get("home-cancelButton");
    _saveInstructionsDiv = I3.ui.get("home-saveInstructions");
    _saveStatusDiv       = I3.ui.get("home-saveStatus");
    _saveErrorDiv        = I3.ui.get("home-saveError");

    // Set up event handlers.
    _searchText.onkeyup   = self.onSearchChange;
    _searchButton.onclick = self.onSearchClick;
    _saveButton.onclick   = self.onSave;
    _cancelButton.onclick = self.onCancel;
  }

  /**
   * Method: loadPath
   *
   * Begins loading the user's home page settings.
   *
   * Parameters:
   *   path - the extra path data from the URI; ignored
   */
  @method loadPath(path) {

    // Set up navigation bar.
    I3.navbar.addToPath("Customize Home Page", { icon: "home-customize" });

    // Disable items that can't be used yet.
    _searchButton.disabled = true;

    // Begin loading the user's home page settings.
    I3.client.getObject("/home/data/settings", self.onSettingsLoadResponse);
  }


  // -------------------------------------------------------------------------
  // Group: Initial data load
  // -------------------------------------------------------------------------

  /**
   * Method: onSettingsLoadResponse
   *
   * Called when the user's home page settings have been loaded.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onSettingsLoadResponse(response) {
    if (response.isOK()) self.applySettings(response.getObject());
    I3.ui.hide("homeLoading");
  }
  
  /**
   * Method: applySettings
   *
   * Applies the home page settings to the page.
   *
   * This is called by `onSettingsLoadResponse` when a valid response
   * has been sent by the server.
   *
   * Parameters:
   *   settings - the home page settings provided by the server
   */
  @method applySettings(settings) {

    // Create drag managers for the news and weather sections.
    _newsBoxManager =
      new Home.DraggableBoxManager(I3.ui.get("home-customNewsItems"));
    _weatherBoxManager =
      new Home.DraggableBoxManager(I3.ui.get("home-customWeatherItems"));
    _newsBoxManager.onBoxRemove = self.onNewsTopicRemove;
    _weatherBoxManager.onBoxRemove = self.onWeatherReportRemove;

    // Add the news items to each section.
    for (var i = 0; i < settings.news.length; i++) {
      var newsItem = settings.news[i];
      _newsTopics[newsItem.permalink] = newsItem;
      if (newsItem.subscribed) {
        _newsBoxManager.addBox(
          newsItem.permalink, newsItem.name, newsItem.is_locked);
      }
    }

    // Display the news topics that weren't added to the box manager.
    self.renderAvailableNews();

    // Add the weather items.
    for (var i = 0; i < settings.weather.length; i++) {
      var weatherItem = settings.weather[i];
      self.addWeatherReport(weatherItem.code, weatherItem.name);
    }

    // Show the page contents.
    I3.ui.show("home-customNews");
    I3.ui.show("home-customWeather");
    I3.ui.show("home-customSaveCancel");
  }
  

  // -------------------------------------------------------------------------
  // Group: Available news topic list
  // -------------------------------------------------------------------------

  /**
   * Method: renderAvailableNews
   *
   * Updates the local news and external news lists in the "Available News"
   * section with the topics to which the user has not subscribed.
   */
  @method renderAvailableNews() {

    // Separate the local and external topics into sorted lists.
    var localTopics = [];
    var externalTopics = [];
    for (var key in _newsTopics) {
      var topic = _newsTopics[key];
      if (topic.subscribed == false) {
        if (topic.is_external == false) localTopics.push(topic);
        else if (topic.is_external == true) externalTopics.push(topic);
      }
    }
    
    // Clear current contents.
    _newsLocalDiv.innerHTML = "";
    _newsExternalDiv.innerHTML = "";
    
    // Add the topics to the UI.
    _newsLocalDiv.appendChild(self.buildNewsTopicList(localTopics));
    _newsExternalDiv.appendChild(self.buildNewsTopicList(externalTopics));
  }
  
  /**
   * Method: buildNewsTopicList
   *
   * Creates a sorted "unordered list" (`ul`) containing line items for
   * each news topic in the given array.  If the array is empty, a
   * paragraph (`p`) is returned stating "No more topics available."
   *
   * Parameters:
   *   topics - the array of news topic objects to render
   * 
   * Returns:
   *   The rendered HTML element, either a `ul` or a `p`.
   */
  @method buildNewsTopicList(topics) {
    topics.sort(self.compareTopics);
    if (topics.length > 0) {
      var ul = I3.ui.create("ul");
      var li, link;
      for (var i = 0; i < topics.length; i++) {
        li = I3.ui.create("li");
        link = I3.ui.createActionLink("Add", topics[i].permalink,
          "Add:" + topics[i].name, self.onNewsTopicAdd)
        li.appendChild(I3.ui.text(topics[i].name + " - "));
        li.appendChild(link);
        ul.appendChild(li);
      }
      return ul;
    }
    else {
      var p = I3.ui.create("p");
      p.appendChild(I3.ui.text("No more topics available."));
      return p;
    }
  }
  
  /**
   * Method: compareTopics
   *
   * Compares two news topics to determine sort order.
   * This is used by the `buildNewsTopicList` method.
   *
   * Parameters:
   *   a - the first topic object to compare
   *   b - the second topic object to compare
   * 
   * Returns:
   *   - `-1` if the first topic should come _before_ the second one
   *   - `0` if the topics are identical
   *   - `1` if the first topic should come _after_ the second one
   */
  @method compareTopics(a, b) {
    if (a.name < b.name) return -1;
    if (a.name > b.name) return 1;
    return 0;
  }
  

  // -------------------------------------------------------------------------
  // Group: Event handlers
  // -------------------------------------------------------------------------

  /**
   * Method: onNewsTopicAdd
   *
   * Called when someone clicks a news topic to add it to their list.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onNewsTopicAdd(e) {
    e = I3.ui.getEvent(e);
    var topic = _newsTopics[e.getInfo()];
    topic.subscribed = true;
    _newsBoxManager.addBox(topic.permalink, topic.name);
    self.renderAvailableNews();
  }

  /**
   * Method: onNewsTopicRemove
   *
   * Called by the news box manager when the "Remove" link is clicked.
   *
   * Parameters:
   *   key - the key of the box that was removed
   */
  @method onNewsTopicRemove(key) {
    _newsTopics[key].subscribed = false;
    self.renderAvailableNews();
  }

  /**
   * Method: onSearchChange
   *
   * Called when the user enters something in the weather search box.
   * This checks for the return key and starts the weather search if
   * it has been pressed.
   *
   * Parameters:
   *   e - the key-up event parameters
   */
  @method onSearchChange(e) {
    e = I3.ui.getEvent(e);
    _searchButton.disabled = (_searchText.value.length == 0);
    if (e.getKeyCode() == 13) self.startWeatherLookup(_searchText.value);
  }
  
  /**
   * Method: onSearchClick
   *
   * Called then the Add button (next to the weather search box) is pressed.
   * This starts the weather search, which will add the result to the user's
   * weather list if the search is successful.
   * 
   * Parameters:
   *   e - the click event parameters
   */
  @method onSearchClick(e) {
    self.startWeatherLookup(_searchText.value);
  }
  
  /**
   * Method: onWeatherLinkClick
   *
   * Called when the user clicks on a weather report link when multiple
   * results have been returned from a weather report search.
   * 
   * Parameters:
   *   e - the click event parameters
   */
  @method onWeatherLinkClick(e) {
    var link = I3.ui.getEvent(e).getTarget();
    self.addWeatherReport(link.cityCode, link.cityName);
    link.parentNode.parentNode.removeChild(link.parentNode);
  }
  
  /**
   * Method: onWeatherReportRemove
   *
   * Called by the weather box manager when the "Remove" link is clicked.
   *
   * Parameters:
   *   key - the key of the box that was removed
   */
  @method onWeatherReportRemove(key) {
    // Remove this key from the weatherCities hash so that it's possible
    // to re-add it later.
    delete _weatherCities[key];
  }
  
  /**
   * Method: onSave
   *
   * Called when the user presses the Save button.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onSave(e) {
    var weather = [];
    var weatherBoxes = _weatherBoxManager.getBoxes();
    for (var i = 0; i < weatherBoxes.length; i++) {
      weather.push({ "code": weatherBoxes[i],
                     "name": _weatherCities[weatherBoxes[i]] });
    }
    var data = {};
    data["news"] = _newsBoxManager.getBoxes();
    data["weather"] = weather;
    self.saveHomePage(data);
  }
  
  /**
   * Method: onCancel
   *
   * Called when the user presses the Cancel button.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onCancel(e) {
    I3.client.navigateTo("/");
  }
  
  
  // -------------------------------------------------------------------------
  // Group: Weather code lookup
  // -------------------------------------------------------------------------
  
  /**
   * Method: startWeatherLookup
   * 
   * Starts the process of looking up a weather code.
   *
   * Parameters:
   *   query - the city code string to look up
   */
  @method startWeatherLookup(query) {
    I3.ui.hide(_searchResultsDiv);
    I3.ui.show(_searchingDiv);
    I3.client.getObject("/home/data/weather-codes/" + escape(query),
      self.onWeatherLookupResponse);
  }
  
  /**
   * Method: onWeatherLookupResponse
   *
   * Called when the lookup process completes for a weather code.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onWeatherLookupResponse(response) {
    if (response.isOK()) self.displayWeatherCodes(response.getObject());
    I3.ui.hide(_searchingDiv);
  }
  
  /**
   * Method: displayWeatherCodes
   *
   * Displays the results of a weather code lookup.
   *
   * Parameters:
   *   codes - an array of objects, each of which has `name` and `code`
   *     attributes
   */
  @method displayWeatherCodes(codes) {
    _searchResultsDiv.innerHTML = "";
    // Display what's left.
    if (codes.length == 0) {
      // No results.
      var span = I3.ui.create("span");
      span.className = "customWeatherNotFound";
      span.appendChild(I3.ui.text("Weather report not found."));
      _searchResultsDiv.appendChild(span);
    }
    else if (codes.length == 1) {
      // See if we already have added this one.
      if (_weatherCities[codes[0].code] == null) {
        // Add the city to the user's weather report list.
        self.addWeatherReport(codes[0].code, _searchText.value);
      }
      else {
        // Code already exists.
        _searchResultsDiv.innerHTML =
          "You already have the weather report for " + _searchText.value +
          " in your list.";
      }
    }
    else {
      // Remove codes that already exist.
      var oldCodes = codes;
      codes = [];
      for (var i = 0; i < oldCodes.length; i++) {
        if (_weatherCities[oldCodes[i].code] == null) codes.push(oldCodes[i]);
      }
      if (codes.length == 0) {
        // Already have all matching cities.
        _searchResultsDiv.innerHTML =
          "You already have all available weather reports for " +
          _searchText.value + " in your list.";
      }
      else if (codes.length == 1) {
        // Add the one item.
        self.addWeatherReport(codes[0].code, codes[0].name);
      }
      else {
        // Display links to each city and let the user choose one.
        _searchResultsDiv.appendChild(I3.ui.text("Multiple reports found:"));
        var ul = I3.ui.create("ul");
        var li, link;
        for (var i = 0; i < codes.length; i++) {
          link = I3.ui.createActionLink(codes[i].name, codes[i].code,
            "Add:" + codes[i].name, self.onWeatherLinkClick);
          link.cityCode = codes[i].code;
          link.cityName = codes[i].name;
          li = I3.ui.create("li");
          li.appendChild(link);
          ul.appendChild(li);
        }
        _searchResultsDiv.appendChild(ul);
      }
    }
    I3.ui.show(_searchResultsDiv);
    _searchText.value = "";
    _searchButton.disabled = true;
  }

  /**
   * Method: addWeatherReport
   *
   * Adds a weather report to the draggable box list and the
   * hash mapping city codes to city names.
   *
   * Parameters:
   *   code - the city code
   *   name - the city name
   */
  @method addWeatherReport(code, name) {
    _weatherBoxManager.addBox(code, name);
    _weatherCities[code] = name;
  }


  // -------------------------------------------------------------------------
  // Group: Storage of settings
  // -------------------------------------------------------------------------
  
  /**
   * Method: saveHomePage
   *
   * Starts the process of saving the user's home page settings.
   *
   * Parameters:
   *   data - the home page data to post to the server
   */
  @method saveHomePage(data) {
    I3.ui.hide(_saveInstructionsDiv);
    I3.ui.show(_saveStatusDiv);
    I3.client.postObject(data, "/home/data/settings", self.onSaveResponse);
  }

  /**
   * Method: onSaveResponse
   *
   * Called when the home page save process completes.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onSaveResponse(response) {
    if (response.isOK()) {
      if (response.getObject().status == "OK") {
        I3.cache.set("homePage", null);
        I3.client.navigateTo("/");
      }
      else {
        I3.ui.hide(_saveStatusDiv);
        _saveErrorDiv.innerHTML = "ERROR: " + response.getObject().message;
        I3.ui.show(_saveErrorDiv);
      }
    }
  }

}
