/**
 * Script: common/client-web/js/i3-nav
 *
 * Intranet 3 navigation framework.
 * 
 * This extends the objects in <common/js/i3-core> and adds new objects
 * to support the virtual path navigation system used by the intranet.
 * This includes the applet loading mechanism, the navigation bar rendering,
 * the tool list, permission checking, and so on.  While `i3-core.js` can
 * be used as a library for standalone projects, this file both requires
 * and supports the complete intranet system.
 * 
 * Note that because this file extends objects that are created by
 * `i3-core.js`, it is critical that `i3-core.js` finishes loading
 * _before_ this file is loaded.
 * 
 * *Core Object Extensions*
 * 
 * The `I3.client` and `I3.ui` objects are given additional methods for
 * working with virtual paths.  See <I3Internals.ClientNavigationExtensions>
 * and <I3Internals.UserInterfaceNavigationExtensions> for details on the
 * additional methods.
 * 
 * *Navigation Objects*
 * 
 * Several new objects are included for enabling navigation support and
 * providing services for applets.  These include:
 * 
 *   I3.navbar - Instance of <I3Internals.NavBar>.
 *     Controls the navigation bar that appears at the top of all
 *     intranet content.  This is used in each applet's `loadData`
 *     method to add path components.
 *
 *   I3.user - Instance of <I3Internals.UserInfo>.
 *     Contains data about the user, such as account name, full name,
 *     and permissions.
 *
 *   I3.config - Instance of <I3Internals.Configuration>.
 *     Provides server configuration information, such as the intranet
 *     name and the list of tools that are available to the user.
 * 
 *   I3.preferences - Instance of <I3Internals.Preferences>.
 *     Applets can use this to retrieve and store user preferences
 *     (key/value pairs accessed on a user-specific, tool-specific basis).
 *
 *   I3.cache - Instance of <I3Internals.Cache>.
 *     Applets can use this to store data that needs to remain in memory
 *     even when a new applet is loaded.
 *
 * Credits:
 * 
 *   Written by
 *     Marshall Elfstrand (marshall@vengefulcow.com) and
 *     Nathan Mellis (nathan@mellis.us).
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
 *   $Id: i3-nav.js 87 2008-04-09 22:18:26Z nmellis $
 */


// ---------------------------------------------------------------------------
// INTRANET 3 INTERNALS MODULE
// ---------------------------------------------------------------------------

/**
 * Module: I3Internals
 *
 * Module containing class definitions for the objects accessible via
 * the <I3> module.  These are not intended to be instantiated by applets;
 * use the shared instances instead.
 */
@module I3Internals;

/**
 * Class: I3Internals.ClientNavigationExtensions
 *
 * Adds methods for navigating to virtual paths to `I3.client`.
 */
@class ClientNavigationExtensions {

  /**
   * Private Property: appletLoader
   * The applet loader.  For internal use only.
   */
  self.appletLoader = new I3Internals.AppletLoader();

  /**
   * Private Method: initializeNavigation
   *
   * Initializes the client, loading the applet for the current path.
   * This is called at the end of the pre-loading process.
   */
  @method initializeNavigation() {
    I3.navbar.initialize();
    self.appletLoader.initialize();
  }
  
  /**
   * Method: navigateTo
   *
   * Navigates to the given virtual path.
   *
   * The virtual path is the part following the hash mark (#) in the URL.
   *
   * Parameters:
   *   path - the virtual path string to navigate to, starting with a
   *     forward slash (e.g. "/home/customize")
   */
  @method navigateTo(path) {
    self.appletLoader.setCurrentPath(path);
  }
  
  /**
   * Method: getPath
   * Returns the current virtual path string.
   */
  @method getPath() {
    return self.appletLoader.getCurrentPath();
  }

  /**
   * Method: getToolName
   *
   * Returns the current tool name (the first element of the virtual path).
   *
   * For example, the tool name for the virtual path "/home/customize"
   * would be "home".
   */
  @method getToolName() {
    var path = self.getPath();
    if (path == "/") return I3.config.getFixedNavBarItems()[0].tool;
    else {
      var pathElements = path.split("/");
      return pathElements[1];
    }
  }

}


// ---------------------------------------------------------------------------
// APPLET LOADER
// ---------------------------------------------------------------------------

/**
 * Private Class: I3Internals.AppletLoader
 *
 * Manages the loading of applets into the shared I3 page and the
 * checking of path values for changes.
 *
 * This class is used internally by <I3Internals.ClientNavigationExtensions>
 * and is not intended for use by other intranet code.
 */
@class AppletLoader {

  // Since this class is not part of the public API, the methods in
  // it all have "Method (Hidden):" declarations at the top, causing
  // the API doc generator to ignore them.

  // Web service to use for history tracking on IE.
  var HISTORY_PATH = "/common/data/internet-explorer-support";

  // Amount of time to wait between checking for changes.
  var CONTENT_CHECK_DELAY = 100;  // Loaded content
  var PATH_CHECK_DELAY = 300;     // Changes in path

  // Instance variables used for history management.
  var _currentPath;        // Current path as seen by the browser
  var _currentHistoryLen;  // Length of the browser's history array
  var _pathHistory = [];   // History of paths visited
  var _historyWindow;      // Frame to check for history changes

  // Instance variables used for applet loading.
  var _currentApplet;      // Path of the current applet's HTML file
  var _extraPath;          // Extra path info to be provided to the applet
  var _appletContent;      // Applet content div on the main page
  var _appletWindow;       // Frame into which new applet content is loaded

  /**
   * Method (Hidden): initialize
   *
   * Initializes the applet loader, loading the references to the
   * elements that it will control.
   */
  @method initialize() {

    // Set up the UI object's document.
    I3.ui.document = window.document;

    // Set the initial text values.
    document.title = I3.config.getTitle();
    I3.ui.get("appletTitle").innerHTML = "&nbsp;";
    document.getElementById("i3title").appendChild(
      document.createTextNode(I3.config.getTitle()));
    document.getElementById("i3copyrightText").appendChild(
      document.createTextNode(I3.config.getCopyright()));
    
    // Set up site-wide searching
    I3.ui._configureSiteSearchBox(I3.ui.get("i3siteSearch"));
    
    // Set up the applet.
    _currentApplet = "";
    _appletContent = document.getElementById("appletContent");
    _appletWindow = document.getElementById("i3appletFrame");
    if (_appletWindow.contentWindow)
      _appletWindow = _appletWindow.contentWindow;

    // Set up the history.
    _historyWindow = document.getElementById("i3historyFrame");
    if (_historyWindow.contentWindow)
      _historyWindow = _historyWindow.contentWindow;
    _currentPath = "";
    _currentHistoryLen = -1;

    // Start by loading the applet specified in the main window URL.
    var path = window.location.hash;
    if (path == "") path = "#/";
    if (I3.browser.isIE() && window.location.search)
      path += window.location.search.substr(1);
    self.setCurrentPath(path.substr(1));
    window.setTimeout(self.checkPath, PATH_CHECK_DELAY);
  }

  /**
   * Method (Hidden): getCurrentPath
   *
   * Returns the current virtual path string.
   */
  @method getCurrentPath() {
    return _currentPath;
  }
  
  /**
   * Method (Hidden): setCurrentPath
   *
   * Sets the current virtual path string, causing the applet loader to
   * re-examine the path and load the appropriate applet.
   *
   * Parameters:
   *   newPath - the new virtual path string
   */
  @method setCurrentPath(newPath) {
    if (I3.browser.isIE())
      _historyWindow.location.href = HISTORY_PATH + "?" + newPath;
    else
      window.location.href = "/#" + newPath;
  }

  /**
   * Method (Hidden): checkPath
   *
   * Checks the browser's location/history to determine if the path
   * has changed.  This is called by a timer to track back/forward
   * button usage.
   */
  @method checkPath() {
    var shouldRefresh = false;
    if (I3.browser.isIE()) {
      // IE has a query string appended to the URL since it
      // fails to update the window.location.hash value.
      var path = _historyWindow.location.search.substr(1);
      if (path == "") path = "/";
      if (path != _currentPath) {
        _currentPath = path;
        window.location.replace("/#" + _currentPath);
        shouldRefresh = true;
      }
    }
    else {
      var path = window.location.hash;
      if (path == "") path = "#/";
      path = path.substr(1);
      if (path != _currentPath) {
        _currentPath = path;
        shouldRefresh = true;
      }
    }
    if (shouldRefresh) self.loadAppletForPath(_currentPath);
    window.setTimeout(self.checkPath, PATH_CHECK_DELAY);
  }

  /**
   * Method (Hidden): loadAppletForPath
   *
   * Loads the applet for the given virtual path.
   *
   * This goes through the list of tools provided by `I3.config`,
   * determines which tool and applet should be used to handle the path,
   * loads the applet if it's not the current one, and finally calls the
   * applet's `loadPath()` method.
   *
   * Parameters:
   *   path - the virtual path string to be loaded
   */
  @method loadAppletForPath(path) {
    // Cancel any requests in progress.
    I3.client.requestManager.cancelRequests();
    var tools = I3.config.getTools();
    var toolName = "";
    var appletName = "";
    if (path == "/") {
      // Special case for the root path.
      toolName = I3.config.getFixedNavBarItems()[0].tool;
      appletName = "index";
      _extraPath = "";
    }
    else {
      // Find the tool.
      var pathElements = path.split("/");
      toolName = pathElements[1];
      if (tools[toolName] == null) {
        I3.ui.displayError("Missing tool: " + toolName);
        return false;
      }
      // See if there is an applet matching the second path component.
      if (pathElements.length > 2 && tools[toolName].applets[pathElements[2]]) {
        appletName = pathElements[2];
        _extraPath = path.substr(toolName.length + appletName.length + 2);
      } else {
        // Use index.html if no applet name match was found.
        appletName = "index";
        _extraPath = path.substr(toolName.length + 1);
      }
    }
    var newApplet = tools[toolName].applets[appletName];
    if (_currentApplet == "") {
      // First applet to load.
      _appletWindow.location.replace(newApplet);
      window.setTimeout(self.checkForApplet, CONTENT_CHECK_DELAY);
    }
    else if (_currentApplet != newApplet) {
      // New applet.
      _appletWindow.applet = null;
      _appletWindow.document.body.innerHTML = "";
      _appletWindow.location.replace(newApplet);
      I3.ui.get("appletTitle").className = "i3titleLoading";
      I3.ui.setTitle("Loading tool...");
      I3.ui.clearActions();
      I3.navbar.reset();
      if (toolName != I3.config.getFixedNavBarItems()[0].tool)
        I3.navbar.addToPath(I3.config.getTools()[toolName].name);
      _appletContent.innerHTML = "";
      window.setTimeout(self.checkForApplet, CONTENT_CHECK_DELAY);
    }
    else {
      // Same applet, different path.
      I3.navbar.reset();
      I3.client.applet.loadPath(_extraPath);
    }
    _currentApplet = newApplet;
  }

  /**
   * Method (Hidden): checkForApplet
   *
   * Checks for the existence of the `window.applet` object that is set
   * by the applet when its script has finished loading.  This is
   * called by a timer that is started when the applet is requested.
   */
  @method checkForApplet() {
    if (_appletWindow.applet) self.checkForContent();
    else window.setTimeout(self.checkForApplet, CONTENT_CHECK_DELAY);
  }
  
  /**
   * Method (Hidden): checkForContent
   *
   * Checks for the existence of the "appletContent" div that exists once
   * the applet's HTML file has finished loading.  This is called by a timer
   * that is started when the applet's script has finished loading, to make
   * sure that both the script and the HTML template are ready to run.
   */
  @method checkForContent() {
    var appletDocument = _appletWindow.document;
    if (appletDocument && appletDocument.getElementById("appletContent"))
      self.initApplet();
    else window.setTimeout(self.checkForContent, CONTENT_CHECK_DELAY);
  }
  
  /**
   * Method (Hidden): initApplet
   *
   * Initializes the newly loaded applet.  This copies the applet's template
   * into the main content window and starts the applet script.
   */
  @method initApplet() {

    // Set title.
    var appletDocument = _appletWindow.document;
    I3.ui.setTitle(appletDocument.title);
    I3.ui.get("appletTitle").className = "";
    _historyWindow.document.title = I3.config.getTitle();

    // Remove existing style links that aren't shared i3 ones.
    var head = document.getElementsByTagName("head")[0];
    var old_links = head.getElementsByTagName("link");
    for (var i = 0; i < old_links.length; i++) {
      var link = old_links[i];
      if ( link.rel == "stylesheet" &&
           link.href.indexOf("/common/client-web/css/") == -1 &&
           link.href.indexOf("/$theme/client-web/css/") == -1 ) {
        head.removeChild(link);
      }
    }

    // Copy the style links from the applet.
    var appletHead = appletDocument.getElementsByTagName("head")[0];
    var new_links = appletHead.getElementsByTagName("link");
    for (var i = 0; i < new_links.length; i++) {
      var link = new_links[i];
      if (link.rel == "stylesheet") {
        var new_link = document.createElement("link");
        new_link.rel = "stylesheet";
        new_link.type = "text/css";
        new_link.media = link.media;
        new_link.href = link.href;
        head.appendChild(new_link);
      }
    }
    
    // Copy content of window to main page content.
    _appletContent.innerHTML =
      appletDocument.getElementById("appletContent").innerHTML;

    // Make sure I3 namespace is available to applet code, incorporating
    // any I3 elements that may have been defined in the applet window.
    if (_appletWindow.I3) {
      var oldI3 = _appletWindow.I3;
      _appletWindow.I3 = I3;
      for (var i3key in oldI3) {_appletWindow.I3[i3key] = oldI3[i3key]; }
    } else _appletWindow.I3 = I3;

    // Initialize applet in main page.
    I3.client.applet = new _appletWindow.applet();
    I3.client.applet.initialize();
    
    // Load the relevant portion of the path.
    I3.navbar.reset();
    I3.client.applet.loadPath(_extraPath);
  }
  
  /**
   * Method (Hidden): getAppletWindow
   *
   * Returns a reference to the window in which the applet is loaded.
   */
  @method getAppletWindow() {
    return _appletWindow;
  }
  
}


// ---------------------------------------------------------------------------
// DATA CACHE
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.Cache
 *
 * Provides a data cache that can be used by applets to save state
 * within a single intranet session.  This can help prevent unnecessary
 * page loads for data that is frequently accessed but rarely changed.
 * Bear in mind, however, that the more data that is stored here, the
 * greater the intranet memory requirements will be, which can slow
 * down the browser.  Care must be taken in maintaining the balance.
 *
 * The shared instance of this class is provided by the `I3.cache` property.
 */
@class Cache {
  
  var _cache = {};
  
  /**
   * Method: get
   *
   * Retrieves a value from the data cache.
   *
   * Parameters:
   *   key - the key string of the value to be retrieved
   *   tool - optional; the name of the tool that stored the value.
   *     This will default to the current tool if none is specified.
   *
   * Returns:
   *   The requested value, or `null` if the key has not been set.
   */
  @method get(key, tool) {
    return _cache[self._getKey(key, tool)];
  }

  /**
   * Method: set
   *
   * Stores a value in the data cache.  Setting the value to `null` will
   * remove the key/value combination from the cache.
   *
   * Parameters:
   *   key - the key string of the value to be stored
   *   value - the value to be stored
   *   tool - optional; the name of the tool that is storing the value.
   *     This will default to the current tool if none is specified.
   */
  @method set(key, value, tool) {
    if (value == null)
      delete _cache[self._getKey(key, tool)];
    else
      _cache[self._getKey(key, tool)] = value;
  }
  
  /**
   * Private Method: _getKey
   *
   * Returns a single string key based on the provided key and tool.
   *
   * Parameters:
   *   key - the string to use for the key
   *   tool - optional; the name of the tool that is storing the value.
   *     This will default to the current tool if none is specified.
   *
   * Returns:
   *   The combined tool+key string.
   */
  @method _getKey(key, tool) {
    if (tool == null || tool == "") tool = I3.client.getToolName();
    return tool + "/" + key;
  }
}


// ---------------------------------------------------------------------------
// SERVER CONFIGURATION
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.Configuration
 *
 * Provides server configuration information, such as the tool list
 * and the title/copyright strings.
 *
 * The shared instance of this class is provided by the `I3.config` property.
 */
@class Configuration {
  
  /**
   * Method: getTitle
   * Returns the name of the intranet.
   */
  @propertyReader title = "Intranet";
  
  /**
   * Method: getCopyright
   * Returns the copyright string for the intranet.
   */
  @propertyReader copyright = "Copyright" + (new Date()).getFullYear();

  /**
   * Method: getTools
   * Returns the hash of tools available to the user.
   */
  @propertyReader tools = {};

  /**
   * Method: getFixedNavBarItems
   * Returns the list of fixed navigation bar items.  These are the
   * items that appear on the left-hand side of the navigation bar,
   * which the user cannot modify.
   */
  @propertyReader fixedNavBarItems = [];

  /**
   * Private Method: initConfig
   * 
   * Initializes the configuration values with the provided data.
   * This is called by <I3Internals.UserInfo::onResponse> when the
   * user settings have been loaded from the web service.
   * 
   * Parameters:
   *   configData - an object providing a `title` string, a `copyright`
   *     string, and a `tools` hash
   *     
   */
  @method initConfig(configData) {
    if (configData.title) _title = configData.title;
    if (configData.copyright) _copyright = configData.copyright;
    if (configData.tools) _tools = configData.tools;
    if (configData.fixedNavBarItems) _fixedNavBarItems = configData.fixedNavBarItems;
  }
  
}


// ---------------------------------------------------------------------------
// NAVIGATION BAR
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.NavBar
 *
 * Renders and controls the navigation bar that appears at the top
 * of each intranet page, including the quick links and the
 * breadcrumb-style path components.
 *
 * The shared instance of this class is provided by the `I3.navbar` property.
 */
@class NavBar {

  // --- Instance variables --------------------------------------------------

  // Table row references for quick access.
  var _quickLinkIconTR;
  var _quickLinkCaptionTR;
  var _youAreHereTR;

  // Quick Link editing helper.
  var _editGrid;
  
  // Last added path element (for use when adding Quick Links).
  var _currentTitle;
  var _currentIcon;

  // --- Initializers --------------------------------------------------------

  /**
   * Private Method: initialize
   *
   * Initializes the navigation bar.  This is called by <I3Internals.Client>
   * when the client is first loading.
   */
  @method initialize() {
    self._initQuickLinks();
    self._initYouAreHere();
  }

  /**
   * Private Method: _initQuickLinks
   * Initializes the "Quick Links" area of the navigation bar.
   */
  @method _initQuickLinks() {

    // Get the table row references.
    _quickLinkIconTR = document.getElementById("i3navbarIcons");
    _quickLinkCaptionTR = document.getElementById("i3navbarCaptions");

    // Add the global navigation bar items.
    var defaultItems = I3.config.getFixedNavBarItems();
    for (var i = 0; i < defaultItems.length; i++) {
      self._addQuickLink(defaultItems[i]);
    }

    // Add a separator.
    var separatorTD = document.createElement("td");
    separatorTD.id = "i3quickLinkSeparator";
    separatorTD.rowSpan = 2;
    separatorTD.innerHTML = "&nbsp;";
    _quickLinkIconTR.appendChild(separatorTD);
    
    // Add a spacer.
    var spacerTD = document.createElement("td");
    spacerTD.id = "i3quickLinkSpacer";
    spacerTD.rowSpan = 2;
    spacerTD.innerHTML = "&nbsp;";
    _quickLinkIconTR.appendChild(spacerTD);

    // Add the user's navigation bar items.
    self._resetUserQuickLinks();
    
    // Set click event handler for the Edit/Remove link.
    document.getElementById("i3navbarOptionsLink").onclick = self.onEdit;
    document.getElementById("i3navbarOptionsText").onclick = self.onEdit;
  }

  /**
   * Private Method: _addQuickLink
   *
   * Adds a quick link icon and caption to the navigation bar.
   *
   * Parameters:
   *   info - the quick link information structure obtained from the
   *     user preferences
   */
  @method _addQuickLink(info) {
    
    // Determine the type of link.
    var linkIsExternal = (info.path.indexOf("/#/") != 0);
    
    // Create the caption.
    var captionSpan = document.createElement("span");
    var captionLink;
    if (linkIsExternal) {
      captionLink = I3.ui.create("a");
      captionLink.href = info.path;
      captionLink.appendChild(I3.ui.text(info.caption));
    } else captionLink = I3.ui.createNavigationLink(info.caption, info.path.substr(2));
    captionLink.className = "quickLink";
    captionSpan.appendChild(captionLink);
    var captionTD = document.createElement("td");
    captionTD.align = "center";
    captionTD.className = "i3quickLinkCaption";
    captionTD.width = "40px";
    captionTD.appendChild(captionSpan);

    // Create the icon.
    var img = I3.ui.createAlphaImage(info.large_icon, 32, 32);
    var imgLink;
    if (linkIsExternal) {
      imgLink = I3.ui.create("a");
      imgLink.href = info.path;
      imgLink.appendChild(img);
    } else imgLink = I3.ui.createNavigationLink(img, info.path.substr(2));
    imgLink.captionSpan = captionSpan;
    imgLink.onmouseover = self.onQuickLinkMouseOver;
    imgLink.onmouseout = self.onQuickLinkMouseOut;
    var iconTD = document.createElement("td");
    iconTD.align = "center";
    iconTD.appendChild(imgLink);
    
    // Add the icon and caption to their respective rows.
    _quickLinkIconTR.appendChild(iconTD);
    _quickLinkCaptionTR.appendChild(captionTD);
  }

  /**
   * Private Method: _initYouAreHere
   * Initializes the "You Are Here" area of the navigation bar.
   */
  @method _initYouAreHere() {
    // Get the table row for the "You Are Here" area.
    _youAreHereTR = document.getElementById("i3youAreHereRow");
    self.reset();

    // Set click event handler for the Add link.
    document.getElementById("i3youAreHereAddLink").onclick = self.onAdd;
    document.getElementById("i3youAreHereAddText").onclick = self.onAdd;
  }

  // --- Public API ----------------------------------------------------------

  /**
   * Method: addToPath
   *
   * Adds a component to the "You Are Here" section of the navbar.
   * 
   * The `title` parameter is required.  A hash of additional `options`
   * can also be provided if applicable.  The following keys are available
   * for configuring how the new path item will be rendered:
   *
   *   link - a virtual path to link to.  If the path being added is not
   *     the current page (e.g. the last element in the navbar), this
   *     should provide a path so that the user can use it for navigation.
   *   icon - the base name of a PNG icon to display (i.e. the part before
   *     the "-16" or "-32").  The icon will be looked for in the tool's
   *     "img" folder.  For example, if "home" is the `tool`, "door" would
   *     map to "/home/client-web/img/door-16.png".  If omitted, "applet-icon" will be
   *     used as the default.
   *   tool - the short name of the tool that contains the icon in its
   *     `img` folder.  If omitted, the tool used to handle the given
   *     `link` option will be used, or the current tool if no `link` has
   *     been provided.
   *
   * Example:
   * (start example)
   *   I3.navbar.addToPath("Door", { link: "/home/door/", icon: "door" });
   * (end example)
   *
   * Parameters:
   *   title - the string to display for the component
   *   options - the hash of additional options
   */
  @method addToPath(title, options) {
    if (options == null) options = {};

    // Add an arrow if necessary.
    if (options.isRoot != true) {
      var arrowTD = document.createElement("td");
      arrowTD.className = "i3youAreHereArrow";
      var arrowSpan = document.createElement("span");
      arrowSpan.appendChild(document.createTextNode(" > "));
      arrowTD.appendChild(arrowSpan);
      _youAreHereTR.appendChild(arrowTD);
    }

    // Determine the tool if necessary.
    var tool = options.tool;
    var url = options.link;
    if (!(tool && tool.length > 0)) tool = I3.client.getToolName();

    // Add the image cell.
    var icon = options.icon;
    if (!(icon && icon.length > 0)) icon = "applet-icon";
    var imgTD = document.createElement("td");
    imgTD.appendChild(I3.ui.createAlphaImage(
      "/" + tool + "/client-web/img/" + icon + "-16.png", 16, 16));
    _youAreHereTR.appendChild(imgTD);
    
    // Add the text cell.
    var titleTD = document.createElement("td");
    if (url && (url != ""))
      titleTD.appendChild(I3.ui.createNavigationLink(title, url));
    else titleTD.appendChild(I3.ui.text(title));
    _youAreHereTR.appendChild(titleTD);
    
    // Store the path information in case it is used for adding a Quick Link.
    _currentTitle = title;
    _currentIcon = "/" + tool + "/client-web/img/" + icon;
  }
  
  /**
   * Method: reset
   * Resets the "You Are Here" section of the navbar to only the
   * default home icon.
   */
  @method reset() {
    // Clear existing items.
    while (_youAreHereTR.childNodes.length > 1) {
      _youAreHereTR.removeChild(_youAreHereTR.lastChild);
    }
    var path = I3.client.getPath();
    var fixedItems = I3.config.getFixedNavBarItems();
    if (path && path.length > 0) {
      // Add the home item (the first item in the fixed item list).
      var homeTool = fixedItems[0].tool;
      var homeUrl = (path == "/") ? "" : "/";
      self.addToPath(fixedItems[0].caption, { link: homeUrl, tool: homeTool, isRoot: true });
      // Add "Tools" unless this is a fixed (and thus top-level) item.
      var tool = (path == null || path == "/") ? homeTool : path.split("/")[1];
      var isBelowTools = true;
      for (var i = 0; i < fixedItems.length; i++) {
        if (fixedItems[i].tool == tool) isBelowTools = false;
      }
      if (isBelowTools) self.addToPath("Tools", { link: "/tools/", tool: "tools" });
    }
  }
  
  /**
   * Private Method: _resetUserQuickLinks
   *
   * Re-builds the user-customizable Quick Links.  This is called after
   * the Quick Links are modified by the Add or Edit pop-ups.
   */
  @method _resetUserQuickLinks() {
    _quickLinkIconTR = document.getElementById("i3navbarIcons");
    _quickLinkCaptionTR = document.getElementById("i3navbarCaptions");
    while (_quickLinkIconTR.lastChild.id != "i3quickLinkSpacer") {
      _quickLinkIconTR.removeChild(_quickLinkIconTR.lastChild);
      _quickLinkCaptionTR.removeChild(_quickLinkCaptionTR.lastChild);
    }
    var items = I3.preferences.get("quicklinks", { tool: "common" });
    if (items != null && items.length > 0)
      for (var i = 0; i < items.length; i++) self._addQuickLink(items[i]);
  }

  // --- Event handlers ------------------------------------------------------

  /**
   * Private Method: onQuickLinkMouseOver
   *
   * Called when the cursor is placed over a Quick Link icon.
   *
   * Parameters:
   *   e - the mouse over event parameters
   */
  @method onQuickLinkMouseOver(e) {
    // Highlight the corresponding label.
    e = I3.ui.getEvent(e);
    e.getTarget().captionSpan.className = "i3quickLinkCaptionHover";
  }
  
  /**
   * Private Method: onQuickLinkMouseOut
   *
   * Called when the cursor leaves a Quick Link icon.
   *
   * Parameters:
   *   e - the mouse out event parameters
   */
  @method onQuickLinkMouseOut(e) {
    // Stop highlighting the corresponding label.
    e = I3.ui.getEvent(e);
    e.getTarget().captionSpan.className = null;
  }

  /**
   * Private Method: onEdit
   *
   * Called when the Edit/Remove link is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onEdit(e) {
    _editGrid = new I3Internals.NavBarEditGrid("i3navbarQuickLinksEditGrid");
    _editGrid.setQuickLinks(I3.preferences.get("quicklinks", { tool: "common" }));
    I3.ui.popupDialogWithElement("i3navbarQuickLinksEditPopup", {
      title: "Edit Quick Links",
      width: 600,
      acceptButton: { label: "Save", onclick: self.onSaveEditedQuickLinks },
      cancelButton: true
    });
    _editGrid.display();
  }
  
  /**
   * Private Method: onAdd
   *
   * Called when the Add link is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onAdd(e) {
    var icon = I3.ui.create("img");
    icon.src = _currentIcon + "-32.png";
    I3.ui.clear("i3navbarQuickLinksAddIcon").appendChild(icon);
    I3.ui.get("i3navbarQuickLinksAddCaption").value = _currentTitle;
    I3.ui.get("i3navbarQuickLinksAddCaption").disabled = false;
    I3.ui.clear("i3navbarQuickLinksAddPath").appendChild(I3.ui.text("/#" + I3.client.getPath()));
    I3.ui.popupDialogWithElement("i3navbarQuickLinksAddPopup", {
      title: "Add Quick Link",
      width: 500,
      acceptButton: { label: "Add", onclick: self.onSaveNewQuickLink },
      cancelButton: true
    });
  }
  
  /**
   * Private Method: onSaveNewQuickLink
   *
   * Called when the user has entered a caption and clicked the "Add" button
   * in the pop-up dialog for adding a new Quick Link.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onSaveNewQuickLink(e) {
    I3.ui.get("i3navbarQuickLinksAddStatus").style.visibility = "visible";
    var elements = I3.ui.get("i3navbarQuickLinksAddPopup").parentNode.getElementsByTagName("input");
    for (var i = 0; i < elements.length; i++) {
      elements[i].disabled = true;
    }
    var quicklinks = I3.preferences.get("quicklinks", { tool: "common" });
    quicklinks.push({
      path: "/#" + I3.client.getPath(),
      small_icon: _currentIcon + "-16.png",
      large_icon: _currentIcon + "-32.png",
      caption: I3.util.trim(I3.ui.get("i3navbarQuickLinksAddCaption").value)
    });
    I3.preferences.set("quicklinks", quicklinks, { tool: "common" });
    I3.preferences.save(function(e) {
      I3.ui.get("i3navbarQuickLinksAddStatus").style.visibility = "hidden";
      if (e.wasSuccessful) {
        I3.ui.endPopupDialog();
        self._resetUserQuickLinks();
      }
    }, { tool: "common" });
  }

  /**
   * Private Method: onSaveEditedQuickLinks
   *
   * Called when the user has clicked the "Save" button in the pop-up dialog
   * for editing existing Quick Links.
   */
  @method onSaveEditedQuickLinks() {
    I3.ui.get("i3navbarQuickLinksEditStatus").style.visibility = "visible";
    var elements = I3.ui.get("i3navbarQuickLinksAddPopup").parentNode.getElementsByTagName("input");
    for (var i = 0; i < elements.length; i++) {
      elements[i].disabled = true;
    }
    I3.preferences.set("quicklinks", _editGrid.getQuickLinks(), { tool: "common" });
    _editGrid = null;
    I3.preferences.save(function(e) {
      I3.ui.get("i3navbarQuickLinksEditStatus").style.visibility = "hidden";
      if (e.wasSuccessful) {
        I3.ui.endPopupDialog();
        self._resetUserQuickLinks();
      }
    }, { tool: "common" });
  }

}


/**
 * Private Class: I3Internals.NavBarEditGrid
 *
 * Displays a grid of user-defined Quick Links that supports renaming,
 * removing, and reordering items.
 *
 * This class is used internally by <I3Internals.NavBar> and is not intended
 * for use by other intranet code.
 * 
 * Parameters:
 *   container - the element in which the grid will be displayed (either
 *     a DOM element object or the ID string of an element)
 */
@class NavBarEditGrid(container) {

  var _container;
  var _items;
  var _elements;
  var _itemOrderMap;
  var _itemBeingEdited;
  var _editDiv;
  var _tempNode;
  var _capDiv;
  
  var _itemCountPerRow;
  var _itemWidth;
  var _itemHeight;
  
  var _lastX;
  var _lastY;

  /**
   * Method (Hidden): initialize
   * 
   * Initializes the grid.
   * 
   * Parameters:
   *   container - a string or element to hold the toolbar items in
   */
  @method initialize(container) {
    if (typeof container == "string") container = I3.ui.get(container);
    _container = container;
    _items = [];
  }

  // --- External API --------------------------------------------------------

  /**
   * Method (Hidden): getQuickLinks
   * Returns the array of quick links that can be edited.
   */
  @method getQuickLinks() {
    self._stopEditing();
    var orderedList = [];
    for (var i = 0; i < _itemOrderMap.length; i++) orderedList.push(_items[_itemOrderMap[i]]);
    return orderedList;
  }

  /**
   * Method (Hidden): setQuickLinks
   * Sets the array of quick links that can be edited.
   */
  @method setQuickLinks(items) {
    for (var i = 0; i < items.length; i++) _items.push(items[i]);
  }
  
  /**
   * Method (Hidden): display
   * Displays the grid of icons in the container.
   */
  @method display() {
    I3.ui.clear(_container);

    _elements = [];
    _itemOrderMap = [];
    _itemBeingEdited = -1;
  
    // Add each item to the grid.
    for (var i = 0; i < _items.length; i++) {
      var itemDiv, iconDiv, titleDiv, icon;
      
      // Build item icon.
      icon = I3.ui.create("img");
      icon.src = _items[i].large_icon;
      iconDiv = I3.ui.create("div");
      iconDiv.className = "i3navbarQuickLinksEditIcon";
      iconDiv.appendChild(icon);
      
      // Build item caption.
      captionDiv = I3.ui.create("div");
      captionDiv.className = "i3navbarQuickLinksEditCaption";
      captionDiv.appendChild(I3.ui.text(_items[i].caption));
      
      // Assemble icon and caption into single DIV and add it to the grid.
      itemDiv = I3.ui.create("div");
      itemDiv.itemIndex = i;
      itemDiv.className = "i3navbarQuickLinksEditItem";
      itemDiv.appendChild(iconDiv);
      itemDiv.appendChild(captionDiv);
      _container.appendChild(itemDiv);
      
      // Set up handler for editing the item.
      itemDiv.onclick = self.onItemClick;
      
      // Enable drag-and-drop support for the item.
      I3.ui.enableDragging(itemDiv);
      itemDiv.onDragStart = self.onItemDragStart;
      itemDiv.onDrag      = self.onItemDrag;
      itemDiv.onDragEnd   = self.onItemDragEnd;

      // Track the item.
      _elements.push(itemDiv);
      _itemOrderMap.push(i);
    }
    
    // Mark the end of the grid with an empty item.
    _capDiv = I3.ui.create("div");
    _capDiv.className = "i3navbarQuickLinksEditItemCap";
    _capDiv.innerHTML = "&nbsp;";
    _container.appendChild(_capDiv);
    
    // Allow the user to click on the empty space to stop editing.
    _container.onmouseup = self.onBackgroundClick;
    if (I3.browser.isIE()) {
      // IE doesn't recognize that the container is below the mouse
      // when it is, so we have to assign a handler to the parent dialog.
      var popup = I3.ui.getParentWithTagName("div", _container, { className: "i3popupBorder" });
      if (popup != null) popup.onmouseup = self.onBackgroundClick;
    }
  }
  
  // --- Event handlers ------------------------------------------------------

  /**
   * Method: onBackgroundClick
   *
   * Called when the grid background is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onBackgroundClick(e) {
    var targ = I3.ui.getEvent(e).getTarget();
    if (targ.tagName.toLowerCase() != "a") self._stopEditing();
  }

  /**
   * Method (Hidden): onItemClick
   *
   * Called when an element is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onItemClick(e) {
    self._stopEditing();
    var targ = I3.ui.getEvent(e).getTarget();
    targ = I3.ui.getParentWithTagName("div", targ, { className: "i3navbarQuickLinksEditItem" });
    if (targ != null && targ.itemIndex != null) self._edit(targ.itemIndex);
  }

  /**
   * Method (Hidden): onItemDragStart
   *
   * Called when dragging starts on an element.  The supplied argument will
   * have the following structure:
   * 
   *   x - the value of the mouse's X coordinate
   *   y - the value of the mouse's Y coordinate
   *   handle - the element that has been assigned the drag events
   *   container - the element that will be dragged when the mouse is moved
   * 
   * When a drag begins, the boundaries for the drag area are set up, and a
   * semi-transparent placeholder for the element being dragged is created.
   *
   * Parameters:
   *   info - the drag event parameters sent from the drag manager
   */
  @method onItemDragStart(info) {
    self._stopEditing();

    _itemCountPerRow = Math.floor(_container.offsetWidth / info.container.offsetWidth);
    _itemWidth = info.container.offsetWidth;
    _itemHeight = info.container.offsetHeight;
    
    var containerOffsets = I3.ui.getElementOffsets(_container);
    var elementOffsets   = I3.ui.getElementOffsets(info.container);
    
    info.handle.minX = containerOffsets.left  - elementOffsets.left;
    info.handle.maxX = containerOffsets.right - elementOffsets.right - 8;
    info.handle.minY = containerOffsets.top   - elementOffsets.top + 8;
    info.handle.maxY = 
      containerOffsets.bottom - (elementOffsets.top + info.container.offsetHeight) - 23;

    _tempNode = info.container.cloneNode(true);
    _tempNode.style.visibility = "hidden";
    I3.ui.setOpacity(_tempNode, 0.3);
    _container.insertBefore(_tempNode, info.container);
    
    // IE and Safari incorporate an additional 8 pixels in the left and top
    // offsets (presumably due to some margin or padding somewhere) that Mozilla
    // does not.  We need to account for this when positioning the icon.  It
    // would be really nice to find out why this happens and really fix it
    // instead of using magic numbers like this.
    var offsetAdjustment = I3.browser.isMozilla() ? 0 : -8;
    var offsets = I3.ui.getElementOffsets(info.container);
    info.container.style.zIndex = 9;
    info.container.style.position = "absolute";
    info.container.style.left =
      (offsets.left - info.container.offsetWidth + offsetAdjustment).toString() + "px";
    info.container.style.top  = (offsets.top - 8 + offsetAdjustment).toString() + "px";
    
    _lastX = 0;
    _lastY = 0;
  }
  
  /**
   * Method (Hidden): onItemDrag
   *
   * Called repeatedly while an element is being dragged.  The supplied argument
   * will have the following structure:
   * 
   *   x - the value of the mouse's X coordinate
   *   y - the value of the mouse's Y coordinate
   *   handle - the element that has been assigned the drag events
   *   container - the element that will be dragged when the mouse is moved
   * 
   * While an item is being dragged, we determine if the `container` has moved
   * far enough to take the place of another one.  If so, we re-order the items.
   * Multiple rows are intelligently handled so that an element can only be
   * dragged to places where it can be dropped.
   *
   * Parameters:
   *   info - the drag event parameters sent from the drag manager
   */
  @method onItemDrag(info) {
    var containerOffsets = I3.ui.getElementOffsets(_container);
    
    _tempNode.style.visibility = "visible";

    var deltaX, deltaY, hoverRow, hoverIndex, i;
    var deltaX = info.x - containerOffsets.left + (info.container.offsetWidth / 2);
    var deltaY = info.y - containerOffsets.top + (info.container.offsetHeight / 2);

    var hoverRow    = Math.floor(deltaY / info.container.offsetHeight);
    var hoverColumn = Math.floor(deltaX / info.container.offsetWidth);
    var hoverIndex  = (hoverRow * _itemCountPerRow) + hoverColumn;
    var i;
    for (i = 0; i< _itemOrderMap.length; i++) {
      if (_itemOrderMap[i] == info.container.itemIndex) break;
    }
    if (hoverIndex >= _elements.length - 1) hoverIndex = _elements.length - 1;
    if (hoverIndex != i) self._order(i, hoverIndex)
    
    _lastX = info.x;
    _lastY = info.y;
  }
  
  /**
   * Method (Hidden): onItemDragEnd
   *
   * Called when dragging ends on an element.  The supplied argument will have
   * the following structure:
   * 
   *   x - the value of the mouse's X coordinate
   *   y - the value of the mouse's Y coordinate
   *   handle - the element that has been assigned the drag events
   *   container - the element that will be dragged when the mouse is moved
   * 
   * When an item is dropped, the placeholder element is swapped out for the
   * real element and discarded.
   *
   * Parameters:
   *   info - the drag event parameters sent from the drag manager
   */
  @method onItemDragEnd(info) {
    info.container.style.zIndex = 2;
    info.container.style.position = "relative";
    info.container.style.top = "0px";
    info.container.style.left = "0px";
    _container.replaceChild(info.container, _tempNode);
    _tempNode = null;
    _lastX = null;
    _lastY = null;
  }

  /**
   * Method: onItemEditKeyUp
   *
   * Called when a key has been pressed in the editing field for an item's caption.
   *
   * Parameters:
   *   e - the change event parameters
   */
  @method onItemEditKeyUp(e) {
    if (I3.ui.getEvent(e).getKeyCode() == 13) {  // Enter
      self._stopEditing();
    }
  }
  
  /**
   * Method: onItemRemove
   *
   * Called when the "Remove" link for an item has been clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onItemRemove(e) {
    self._stopEditing();
    self._remove(I3.ui.getEvent(e).getInfo());
  }

  // --- Private methods -----------------------------------------------------
  
  /**
   * Private Method: _order
   *
   * Relocates an element from one position to another.  This uses the given
   * indices to find the element being moved, remove it, and re-insert it at
   * its new position, ensuring that elements are not placed beyond the scope
   * of the array.
   *
   * Parameters:
   *   originalIndex - the index the item started
   *   newIndex      - the index that the item should be at now
   */
  @method _order(originalIndex, newIndex) {
    var index1 = _itemOrderMap[originalIndex];
    var index2 = _itemOrderMap[newIndex];
    
    var item1, item2;
    item1 = _tempNode;
    item2 = _elements[index2];
    
    // _container.removeChild(item1);
    if (newIndex == _itemOrderMap.length - 1)
      _container.insertBefore(item1, _capDiv);
    else
      _container.insertBefore(item1, item2);
    
    item1.style.top = "0px";
    item1.style.left = "0px";
    item2.style.top = "0px";
    item2.style.left = "0px";
    
    _itemOrderMap.splice(originalIndex, 1);
    _itemOrderMap.splice(originalIndex < newIndex ? (newIndex + 1) : newIndex, 0, index1);
  }

  /**
   * Private Method: _edit
   *
   * Sets up a text box for the given item.
   * 
   * Parameters:
   *   itemIndex - the index of the item being edited
   */
  @method _edit(itemIndex) {

    // Determine the location of the bottom of the icon so that we can place
    // the edit box over the caption.
    var element = _elements[itemIndex];
    var elementOffsets = I3.ui.getElementOffsets(element);
    var elementCenter = elementOffsets.left + (element.offsetWidth / 2);
    
    // Build the fields for editing the item.
    var captionField = I3.ui.create("input");
    captionField.className = "i3navbarQuickLinksEditText";
    captionField.value = _items[itemIndex].caption;
    captionField.onkeyup = self.onItemEditKeyUp;
    var removeLink = I3.ui.createActionLink("Remove", itemIndex,
      "Remove:" + _items[itemIndex].caption, self.onItemRemove);
    _editDiv = I3.ui.create("div");
    _editDiv.id = "i3navbarQuickLinksEditFields";
    _editDiv.appendChild(captionField);
    _editDiv.appendChild(I3.ui.create("br"));
    _editDiv.appendChild(I3.ui.text("["));
    _editDiv.appendChild(removeLink);
    _editDiv.appendChild(I3.ui.text("]"));

    // Place the editing box on top of the caption.
    _editDiv.style.visibility = "hidden";
    _container.appendChild(_editDiv);
    _editDiv.style.left = (elementCenter - (_editDiv.offsetWidth / 2)).toString() + "px";
    _editDiv.style.top = (elementOffsets.top + 36).toString() + "px";
    _editDiv.style.visibility = "visible";
    
    _itemBeingEdited = itemIndex;
    captionField.focus();
  }

  /**
   * Private Method: _stopEditing
   *
   * Stores the value of any text box being edited and hides the editing interface.
   */
  @method _stopEditing() {
    if (_itemBeingEdited != -1) {
      var newCaption = _editDiv.childNodes[0].value;
      if (newCaption.length > 0) _items[_itemBeingEdited].caption = newCaption;
      var captionDiv = I3.ui.clear(_elements[_itemBeingEdited].childNodes[1]);
      captionDiv.appendChild(I3.ui.text(_items[_itemBeingEdited].caption));
      _container.removeChild(_editDiv);
      _editDiv = null;
      _itemBeingEdited = -1;
    }
  }

  /**
   * Private Method: _remove
   *
   * Removes an item from the quick links.
   *
   * Parameters:
   *   itemIndex - the index of the item being removed
   */
  @method _remove(itemIndex) {
    _items.splice(itemIndex, 1);
    self.display();
  }

  self.initialize(container);
}


// ---------------------------------------------------------------------------
// INTRANET 3 USER INTERFACE MANAGER
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.UserInterfaceNavigationExtensions
 *
 * Adds methods for creating elements that use virtual paths to `I3.ui`.
 */
@class UserInterfaceNavigationExtensions() {
  
  /**
   * Method: createNavigationLink
   *
   * Creates a hyperlink used for navigation within the intranet.
   * The link click event will be handled by the i3 framework, which will
   * navigate to the given path.
   * 
   * The path should be the virtual part of the i3 path (i.e. the part
   * following the hash mark).
   *
   * Parameters:
   *   contents - the content to place in the link, either a DOM element
   *     (created with `I3.ui.create()`) or a string
   *   path - the virtual path to navigate to when clicked, starting with
   *     a forward slash (e.g. "/home/customize")
   *
   * Returns:
   *   The hyperlink DOM element.
   */
  @method createNavigationLink(contents, path) {
    if (typeof contents == "string") contents = I3.ui.text(contents);
    var elem = I3.ui.create("a");
    elem.href = "#" + path;
    elem.onclick = self.onNavigationClick;
    elem.appendChild(contents);
    return elem;
  }

  /**
   * Method: createNavigationLinkHTML
   *
   * Creates an HTML-formatted string containing a hyperlink used for
   * navigation within the intranet.  The link click event will be handled
   * by the i3 framework, which will navigate to the given path.
   * 
   * The path should be the virtual part of the i3 path (i.e. the part
   * following the hash mark).
   *
   * Parameters:
   *   contents - the content to place in the link, either a DOM element
   *     (created with `I3.ui.create()`) or a string
   *   path - the virtual path to navigate to when clicked, starting with
   *     a forward slash (e.g. "/home/customize")
   *
   * Returns:
   *   The hyperlink HTML string.
   */
  @method createNavigationLinkHTML(contents, path) {
    if (typeof contents != "string") {
      // Retrieve the HTML for the element.
      var tempDiv = I3.ui.create("div");
      tempDiv.appendChild(contents);
      contents = tempDiv.innerHTML;
    }
    var eventParams = I3.browser.isIE() ? "" : "event";
    return '<a href="#' + path +
           '" onclick="return I3.ui.onNavigationClick(' + eventParams +
           ');">' + contents + '</a>';
  }
  
  /**
   * Method: setNavigationPath
   *
   * Applies the navigation logic to an existing hyperlink.  This is
   * useful when you want to have a link in your template and apply the
   * behavior to it, rather than creating the link dynamically.
   *
   * The `path` should be the virtual part of the i3 path (i.e. the part
   * following the hash mark).
   *
   * Example:
   * (start example)
   *   var link = I3.ui.get("myHyperlink");
   *   I3.ui.setNavigationPath(link, "/my-tool/do-something");
   * (end example)
   *
   * Parameters:
   *   hyperlink - the existing hyperlink (`<a href=...>`) DOM element
   *   path - the virtual path to navigate to when clicked, starting with
   *     a forward slash (e.g. "/home/customize")
   */
  @method setNavigationPath(hyperlink, path) {
    hyperlink.href = "#" + path;
    hyperlink.onclick = self.onNavigationClick;
  }
  
  /**
   * Private Method: onNavigationClick
   *
   * Called when a navigation link is clicked.
   * Uses <I3Internals.Client::navigateTo> to process the path.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onNavigationClick(e) {
    e = I3.ui.getEvent(e);
    I3.client.navigateTo(e.getTarget().hash.substr(1));
    return false;
  }
  
}


// ---------------------------------------------------------------------------
// USER PREFERENCES
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.Preferences
 *
 * Manages per-tool user preferences.  Intranet client tools can use this
 * to store and retrieve user-specific settings with the <get> and <set>
 * methods, respectively.
 * 
 * Preferences must be loaded for a tool before they can be accessed.
 * The <load> method is used to retrieve the preferences from the server.
 * When changes to the preferences have been made, the <save> method is
 * used to write the preferences back to the server.
 * 
 * The shared instance of this class is provided by the `I3.preferences`
 * property.
 */
@class Preferences {
  
  var COMMON_PREFERENCES_SERVICE = "/common/data/preferences/";
  
  var _prefs = {};
  var _keysToSave = {};
  
  /**
   * Method: load
   *
   * Loads the user's preferences from the server.
   * 
   * Preferences for a tool must be loaded before they can be accessed.
   * The load takes place asynchronously, so a handler must be provided
   * that can be called when the load is complete in order for the tool
   * to know when the preferences are available.
   * 
   * By default, the preferences for the tool that is currently being
   * accessed will be loaded.  This can be overridden by providing a
   * "tool" option that specifies the name of the tool for which the
   * data should be loaded.
   * 
   * Once the preferences for a tool have been loaded (or set using the
   * <reset> method), the `load` method will not attempt to load the
   * preferences again, so it is safe to call this method multiple times.
   * The `onLoadHandler` will be called immediately in this case.
   * To force a reload of the tool's preferences, provide a "force" option
   * that is set to `true`.
   * 
   * The `onLoadHandler` should accept a single argument, which is an event
   * information object.  The object has the following attributes:
   * 
   *   wasSuccessful - `true` if the load succeeded
   *   loadedKeys - an array of the preference keys that are now available
   *   status - the HTTP status code
   *   statusText - the HTTP status message
   * 
   * Example:
   * (start example)
   * 
   *   @method loadPreferences() {
   *     I3.preferences.load(self.onPreferencesLoaded, { force: true });
   *   }
   * 
   *   @method onPreferencesLoaded(e) {
   *     if (e.wasSuccessful) {
   *       var favoriteColor = I3.preferences.get("favoriteColor");
   *       I3.ui.get("groovyColors-colorField").value = favoriteColor;
   *     }
   *   }
   * 
   * (end example)
   *
   * Parameters:
   *   onLoadHandler - the method to be called when the load has completed
   *   options - optional; additional options for the request
   */
  @method load(onLoadHandler, options) {
    var tool = self._getTool(options);
    if (_prefs[tool] == null || (options != null && options["force"] == true)) {
      I3.client.getObject(COMMON_PREFERENCES_SERVICE + tool,
          function(response) { self._onLoadComplete(response, tool, onLoadHandler) });
    } else {
      var eventInfo = {
        wasSuccessful: true,
        loadedKeys: [],
        status: "200",
        statusText: "OK"
      };
      for (var key in _prefs[tool]) eventInfo.loadedKeys.push(key);
      eventInfo.loadedKeys.sort();
      onLoadHandler(eventInfo);
    }
  }
  
  /**
   * Method: save
   *
   * Saves the user's preferences to the server.
   * 
   * Preferences for a tool must be saved after being set in order to
   * persist.  All preference values that have been modified using the
   * <set> method will be saved back to the server when this method is
   * called.
   * 
   * The save takes place asynchronously, so a handler must be provided
   * that can be called when the load is complete in order for the tool
   * to know when the preferences have been safely stored.  If no
   * preferences have been modified, the handler will be called immediately.
   * 
   * By default, the preferences for the tool that is currently being
   * accessed will be saved.  This can be overridden by providing a
   * "tool" option that specifies the name of the tool for which the
   * data should be saved.
   * 
   * The `onSaveHandler` should accept a single argument, which is an event
   * information object.  The object has the following attributes:
   * 
   *   wasSuccessful - `true` if the save succeeded
   *   status - the HTTP status code
   *   statusText - the HTTP status message
   * 
   * Example:
   * (start example)
   * 
   *   @method savePreferences() {
   *     self.showLoadingMessage();
   *     I3.preferences.save(self.onPreferencesSaved);
   *   }
   * 
   *   @method onPreferencesSaved(e) {
   *     if (e.wasSuccessful) {
   *       I3.ui.get("groovyColors-submitButton").disabled = true;
   *     }
   *     self.hideLoadingMessage();
   *   }
   * 
   * (end example)
   *
   * Parameters:
   *   onSaveHandler - the method to be called when the save has completed
   *   options - optional; additional options for the request
   */
  @method save(onSaveHandler, options) {
    var tool = self._getTool(options);
    if (_prefs[tool] == null) throw "Preferences for " + tool + " have not been loaded.";
    if (_keysToSave[tool].length > 0) {
      var prefsToSave = {};
      var key;
      for (var i = 0; i < _keysToSave[tool].length; i++) {
        key = _keysToSave[tool][i];
        prefsToSave[key] = _prefs[tool][key];
      }
      I3.client.postObject(prefsToSave, COMMON_PREFERENCES_SERVICE + tool,
          function(response) { self._onSaveComplete(response, tool, onSaveHandler) });
    } else {
      var eventInfo = {
        wasSuccessful: true,
        status: "200",
        statusText: "OK"
      };
      onSaveHandler(eventInfo);
    }
  }

  /**
   * Method: get
   *
   * Retrieves a preference for the user.
   *
   * By default, the preferences for the tool that is currently being
   * accessed will be retrieved.  This can be overridden by providing a
   * "tool" option that specifies the name of the tool to which the
   * preference belongs.
   * 
   * Parameters:
   *   key - the identifier string for the preference
   *   options - optional; additional options for retrieving the preference
   * 
   * Throws:
   *   An error message if the preferences have not been loaded.
   */
  @method get(key, options) {
    var tool = self._getTool(options);
    if (_prefs[tool] == null) throw "Preferences for " + tool + " have not been loaded.";
    return _prefs[tool][key];
  }

  /**
   * Method: set
   *
   * Sets a preference for the user.
   *
   * By default, the preferences for the tool that is currently being
   * accessed will be set.  This can be overridden by providing a "tool"
   * option that specifies the name of the tool to which the preference
   * belongs.
   * 
   * Parameters:
   *   key - the identifier string for the preference
   *   value - the object to be associated with the `key`
   *   options - optional; additional options for setting the preference
   * 
   * Throws:
   *   An error message if the preferences have not been loaded.
   */
  @method set(key, value, options) {
    var tool = self._getTool(options);
    if (_prefs[tool] == null) throw "Preferences for " + tool + " have not been loaded.";
    _prefs[tool][key] = value;
    _keysToSave[tool].push(key);
  }

  /**
   * Method: reset
   *
   * Resets the preferences for a tool to a given set of data.
   * 
   * This replaces the entire set of key/value pairs fo a tool, without
   * performing a <load> or <save> operation.  It is used internally by
   * <I3.Preferences> when the set of preferences for a tool is loaded,
   * but it may also be used by tools that load the user's preferences
   * along with some larger data set, so that an additional request does
   * not need to be made to the server.
   * 
   * The `data` object is expected to be a hashtable of key/value pairs,
   * where the key is a string identifier for the preference and the
   * value is an object that can be represented by JSON.
   *
   * Resetting the preferences also resets the tracking of which
   * preferences have been modified.
   * 
   * Parameters:
   *   tool - the name of the tool for which preferences are to be reset
   *   data - the set of key/value pairs to use as the user's preferences
   *     for the tool
   */
  @method reset(tool, data) {
    _prefs[tool] = data;
    _keysToSave[tool] = [];
  }
  
  /**
   * Private Method: _getTool
   *
   * Returns the tool name specified in the `options`, or the current tool
   * if none is specified.
   *
   * Parameters:
   *   options - the set of options provided to the method that needs a tool name
   * 
   * Returns:
   *   The name string for the tool.
   */
  @method _getTool(options) {
    if (options != null && options["tool"] != null && options["tool"] != "")
      return options["tool"];
    return I3.client.getToolName();
  }
  
  /**
   * Private Method: _onLoadComplete
   *
   * Called when the preference load operation finishes.
   *
   * Parameters:
   *   response - the <I3.ObjectResponse> containing the response data
   *   tool - the name of the tool for which preferences were loaded
   *   handler - the handler provided to the <load> method
   */
  @method _onLoadComplete(response, tool, handler) {
    var eventInfo = {
      wasSuccessful: response.isOK(),
      status: response.getStatus(),
      statusText: response.getStatusText()
    };
    if (response.isOK()) {
      var loadedPrefs = response.getObject();
      self.reset(tool, loadedPrefs);
      eventInfo.loadedKeys = [];
      for (var key in loadedPrefs) eventInfo.loadedKeys.push(key);
      eventInfo.loadedKeys.sort();
    }
    handler(eventInfo);
  }

  /**
   * Private Method: _onSaveComplete
   *
   * Called when the preference save operation finishes.
   *
   * Parameters:
   *   response - the <I3.ObjectResponse> containing the response data
   *   tool - the name of the tool for which preferences were saved
   *   handler - the handler provided to the <save> method
   */
  @method _onSaveComplete(response, tool, handler) {
    if (response.isOK()) _keysToSave[tool] = [];
    var eventInfo = {
      wasSuccessful: response.isOK(),
      status: response.getStatus(),
      statusText: response.getStatusText()
    };
    handler(eventInfo);
  }
  
}


// ---------------------------------------------------------------------------
// USER INFORMATION
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.UserInfo
 *
 * Manages the intranet-wide user info and preference data, such as
 * the user-defined navigation bar items, the user's permissions, and so on.
 *
 * The shared instance of this class is provided by the `I3.user` property.
 */
@class UserInfo {
  
  var _info = {};
  
  /**
   * Private Property: onload
   *
   * Function to call when the user data has been loaded.  This is only
   * used by the preloader.  It is set to a function that takes one
   * parameter, `isOK`, which is a boolean telling whether the load was
   * successful or not.
   */
  self.onload = null;
  
  /**
   * Private Method: initUser
   * 
   * Initializes the user information with the provided data.
   * This is called by the preloader.
   * 
   * Parameters:
   *   userData - an object providing the user's name, permissions,
   *     and other settings
   */
  @method initUser(userData) {
    _info = userData;
    I3.preferences.reset("common", { quicklinks: _info.quicklinks.user_defined });
  }
  
  /**
   * Method: getAccountName
   * Returns the user's account name.
   */
  @method getAccountName() { return _info.account_name; }
  
  /**
   * Method: getFirstName
   * Returns the user's first name.
   */
  @method getFirstName() { return _info.first_name; }

  /**
   * Method: getLastName
   * Returns the user's last name.
   */
  @method getLastName() { return _info.last_name; }

  /**
   * Method: getFullName
   * Returns the user's full name (first + last).
   */
  @method getFullName() { return _info.full_name; }
  
  /**
   * Method: getDescription
   * Returns the description for the user.
   * This is the `description` field for the user's account
   * in the directory server.
   */
  @method getDescription() { return _info.description; }
  
  /**
   * Method: getEmail
   * Returns the user's e-mail address.
   */
  @method getEmail() { return _info.email; }
  
  /**
   * Method: isAdministrator
   * Returns `true` if the user is an intranet administrator.
   */
  @method isAdministrator() {
    return self.hasPermission("administer", "i3-root");
  }

  /**
   * Method: isDeveloper
   * Returns `true` if the user is an intranet developer.
   */
  @method isDeveloper() {
    return self.hasPermission("develop", "i3-root");
  }
  
  /**
   * Method: hasPermission
   *
   * Checks to see if the user has a given permission.
   *
   * The intranet permission system is comprised of tool-specific
   * privileges that can be granted to a group or an individual user.
   * The set of privileges that the user has been granted (either
   * explicitly or via group membership) are loaded during the intranet
   * client pre-loading stage.  This method checks the permission set
   * for a specific tool+privilege combination.
   *
   * Note that web services will perform their own permission checks
   * when called; this method is here primarily to help determine
   * which user interface elements should be shown or hidden.
   *
   * Parameters:
   *   privilege - the tool-specific privilege that is to be checked,
   *     e.g. "administer"
   *   tool - optional; the short name of the tool to which the privilege
   *     belongs, e.g. "bboard".  The current tool will be used if
   *     this parameter is omitted.
   *
   * Returns:
   *   `true` if the user has the permission, `false` if not.
   */
  @method hasPermission(privilege, tool) {
    if (tool == null) tool = I3.client.getToolName();
    return (_info.permissions[tool] && _info.permissions[tool][privilege]);
  }
}


// ---------------------------------------------------------------------------
// I3 MODULE
// ---------------------------------------------------------------------------

/**
 * Module: I3
 *
 * Module containing class definitions and data shared by all
 * intranet applications.
 */
@module I3;


// ---------------------------------------------------------------------------
// INTRANET 3 SHARED OBJECTS
// ---------------------------------------------------------------------------

// Extend client and user interface classes with new methods.
I3.util.extend(I3.client, I3Internals.ClientNavigationExtensions);
I3.util.extend(I3.ui, I3Internals.UserInterfaceNavigationExtensions);

/**
 * Property: cache
 * Shared instance of <I3Internals.Cache>, the data cache object.
 */
I3.cache = new I3Internals.Cache();

/**
 * Property: config
 * Shared instance of <I3Internals.Configuration>, the server
 * configuration info.
 */
I3.config = new I3Internals.Configuration();

/**
 * Property: navbar
 * Shared instance of <I3Internals.NavBar>, the navigation bar object.
 */
I3.navbar = new I3Internals.NavBar();

/**
 * Property: preferences
 * Shared instance of <I3Internals.Preferences>, the user preference manager.
 */
I3.preferences = new I3Internals.Preferences();

/**
 * Property: user
 * Shared instance of <I3Internals.UserInfo>, the user information/permission
 * manager.
 */
I3.user = new I3Internals.UserInfo();
