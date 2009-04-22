/**
 * Script: common/data/templates/client-web/preload
 * 
 * Intranet 3 pre-loader script.
 * 
 * This script pre-loads content that will be displayed by the intranet.
 * If the pre-load looks like it will take longer than one second, a
 * progress bar is displayed and updated as each element is loaded.
 * By pre-loading commonly accessed content, the main wait period for
 * people on slow connections is reduced to just the initial load; after
 * that, the intranet can be reasonably speedy.
 * 
 * The <I3Preloader> class handles the steps of loading the content.  It
 * creates an instance of the <I3PreloadUI> class and informs it of each
 * loaded element.  The preload UI can then update its display as necessary.
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
 *   $Id: preload.js 103 2008-05-14 18:46:25Z nmellis $
 */


/**
 * Class: I3Preloader
 *
 * Loads core scripts, styles, and images used by the intranet.
 * The load process is divided up into a series of steps, each step
 * having a description and method to call.  The steps are defined
 * and executed in the <I3Preloader::start> method.
 */
@class I3Preloader {

  // Paths to preload.
  // These are obtained from a constant defined in the index.rhtml
  // template, which appends revision identifiers to each path.
  var CORE_SCRIPT       = __I3_PRELOAD["scripts"]["core"];
  var CORE_NAV_SCRIPT   = __I3_PRELOAD["scripts"]["nav"];
  var CORE_STYLES       = __I3_PRELOAD["styles"]["core"];
  var CORE_THEME_STYLES = __I3_PRELOAD["styles"]["theme"];
  var CORE_PRINT_STYLES = __I3_PRELOAD["styles"]["print"];
  var THEME_IMAGES      = __I3_PRELOAD["images"];

  // User interface manager for preloader.
  var _ui;
  
  // Load steps.
  var _steps = [];
  var _nextStep = 0;

  // For keeping track of loaded resources.
  var _userImages = [];
  var _resources = [];
  var _themeImageLoadCount = 0;
  var _userImageLoadCount = 0;

  // XMLHttpRequest object.
  var _req;

  // Variables to check to see if the I3 objects have been found.
  var _hasFoundI3 = false;
  var _hasFoundI3Nav = false;
  
  // Interval reference for updating the UI.
  var _updateInterval;

  /**
   * Method: start
   *
   * Starts the pre-loading of resources.
   */
  @method start() {

    // Create a controller for the user interface and
    // display the progress bar.
    _ui = new I3PreloadUI();
    _ui.start();
    
    // Define a class that maintains the information for each step.
    function Step(progressAmount, text, func) {
      this.progressAmount = progressAmount;
      this.text = text;
      this.func = func;
    }
    
    // Set up the list of steps to take.
    // Each has a progress amount that the UI displays
    // when it gets to that step.
    _steps = [
      new Step(10, "core scripts", self.loadScripts),
      new Step(30, "visual theme", self.loadTheme),
      new Step(60, "style sheet", self.loadCoreStyles),
      new Step(65, "style sheet", self.loadThemeStyles),
      new Step(70, "style sheet", self.loadPrintStyles),
      new Step(75, "your favorite icons", self.loadNavBar),
      new Step(100, "starting intranet", self.runIntranet)
    ];

    // Start the process.
    self.doNextStep();
  }

  /**
   * Method: doNextStep
   *
   * Runs the next step in the pre-loading process.
   * 
   * This is called by each of the load methods (e.g. `loadScripts()`)
   * when the load has completed and the process can continue.  It
   * updates the user interface with the step's progress amount and
   * description before calling the step's load method.
   */
  @method doNextStep() {
    var step = _steps[_nextStep];
    _nextStep += 1;
    _ui.update();
    _ui.setProgressAmount(step.progressAmount);
    _ui.setProgressText(step.text);
    step.func();
  }

  /**
   * Method: loadScripts
   *
   * Loads the core i3 JavaScript libraries.
   */
  @method loadScripts() {
    var head = document.getElementsByTagName("head")[0];
    var script = document.createElement("script");
    script.type = "text/javascript";
    script.src = CORE_SCRIPT;
    head.appendChild(script);
    setTimeout(self.checkForI3, 100);
  }

  /**
   * Method: checkForI3
   *
   * Called by a timer to see if the `I3` JavaScript module has loaded yet.
   */
  @method checkForI3() {
    _ui.update();
    if (window.I3 && !_hasFoundI3) {
      _hasFoundI3 = true;
      var head = document.getElementsByTagName("head")[0];
      var script = document.createElement("script");
      script.type = "text/javascript";
      script.src = CORE_NAV_SCRIPT;
      head.appendChild(script);
      setTimeout(self.checkForI3Nav, 100);
    }
    else setTimeout(self.checkForI3, 100);
  }

  /**
   * Method: checkForI3Nav
   *
   * Called by a timer to see if the `I3` JavaScript module has loaded yet.
   */
  @method checkForI3Nav() {
    _ui.update();
    if (window.I3.user && !_hasFoundI3Nav) {
      _hasFoundI3Nav = true;
      
      // Load the user info into the framework objects.
      // The __I3_INFO constant is defined in index.rhtml,
      // and is generated by /common/data/index.
      var configData = __I3_INFO.server;
      configData.tools = __I3_INFO.tools;
      configData.fixedNavBarItems = __I3_INFO.quicklinks.fixed;
      I3.config.initConfig(configData);
      var userData = __I3_INFO;
      userData.server = null;
      userData.tools = null;
      I3.user.initUser(userData);
      
      // At this point we need to repeatedly update the UI because
      // everything will be called asynchronously.
      _updateInterval = setInterval(_ui.update, 500);
      self.doNextStep();
    }
    else setTimeout(self.checkForI3Nav, 100);
  }

  /**
   * Method: loadTheme
   *
   * Loads the theme images.
   */
  @method loadTheme() {
    for (var i = 0; i < THEME_IMAGES.length; i++) {
      var img = new Image();
      img.onload = self.onThemeLoad;
      img.src = THEME_IMAGES[i];
      _resources.push(img);
    }
  }

  /**
   * Method: onThemeLoad
   *
   * Called when a theme image has been loaded.  The next step will
   * be performed when this method has been called for all images.
   * 
   * Parameters:
   *   e - the image load event parameters
   */
  @method onThemeLoad(e) {
    _themeImageLoadCount++;
    if (_themeImageLoadCount == THEME_IMAGES.length) self.doNextStep();
  }

  /**
   * Method: loadCoreStyles
   *
   * Loads the CSS styles for the intranet DOM elements.
   * This is called after all images have been pre-loaded.
   */
  @method loadCoreStyles() {
    // We simply cache the file so that when we assign it to the page
    // it's already loaded from the server.
    _req = I3.client.createRequest();
    _req.onreadystatechange = function() {
      if (_req.readyState == 4) self.doNextStep();
    }
    _req.open("GET", CORE_STYLES, true);
    _req.send(null);
  }

  /**
   * Method: loadThemeStyles
   *
   * Loads the CSS styles for the intranet DOM elements.
   * This is called after all images have been pre-loaded.
   */
  @method loadThemeStyles() {
    // We simply cache the file so that when we assign it to the page
    // it's already loaded from the server.
    _req = I3.client.createRequest();
    _req.onreadystatechange = function() {
      if (_req.readyState == 4) self.doNextStep();
    }
    _req.open("GET", CORE_THEME_STYLES, true);
    _req.send(null);
  }
  
  /**
   * Method: loadPrintStyles
   *
   * Loads the CSS styles for printing.
   */
  @method loadPrintStyles() {
    // We simply cache the file so that when we assign it to the page
    // it's already loaded from the server.
    _req = I3.client.createRequest();
    _req.onreadystatechange = function() {
      if (_req.readyState == 4) self.doNextStep();
    }
    _req.open("GET", CORE_PRINT_STYLES, true);
    _req.send(null);
  }

  /**
   * Method: loadNavBar
   *
   * Loads the icons for the navigation bar.
   */
  @method loadNavBar() {
    var i;
    // Add required navigation bar icons to list of images to load.
    var defaultItems = I3.config.getFixedNavBarItems();
    for (i = 0; i < defaultItems.length; i++) _userImages.push(defaultItems[i].large_icon);
    // Add user-defined navigation bar icons to list of images to load.
    var userItems = I3.preferences.get("quicklinks", { tool: "common" });
    if (userItems != null && userItems.length > 0)
      for (i = 0; i < userItems.length; i++) _userImages.push(userItems[i].large_icon);
    // Load the images in the list.
    for (var i = 0; i < _userImages.length; i++) {
      var img = new Image();
      img.onload = self.onNavBarLoad;
      img.onerror = self.onNavBarLoad;
      img.src = _userImages[i];
      _resources.push(img);
    }
  }

  /**
   * Method: onNavBarLoad
   *
   * Called when a navigation bar icon has been loaded.  The next step
   * will be performed when this method has been called for all images.
   * 
   * Parameters:
   *   e - the image load event parameters
   */
  @method onNavBarLoad(e) {
    _userImageLoadCount++;
    if (_userImageLoadCount == _userImages.length) self.doNextStep();
  }
  
  /**
   * Method: runIntranet
   *
   * Hides the preload UI and passes control to the intranet framework.
   * This is the last step in the pre-loading process.
   */
  @method runIntranet() {
    var head = document.getElementsByTagName("head")[0];
    // Add link to core CSS file.
    var css_link = document.createElement("link");
    css_link.rel = "stylesheet";
    css_link.type = "text/css";
    css_link.href = CORE_STYLES;
    head.appendChild(css_link);
    // Add link to theme CSS file.
    css_link = document.createElement("link");
    css_link.rel = "stylesheet";
    css_link.type = "text/css";
    css_link.href = CORE_THEME_STYLES;
    head.appendChild(css_link);
    // Add link to printing CSS file.
    css_link = document.createElement("link");
    css_link.rel = "stylesheet";
    css_link.type = "text/css";
    css_link.media = "print";
    css_link.href = CORE_PRINT_STYLES;
    head.appendChild(css_link);
    // Display the page.
    clearInterval(_updateInterval);
    I3.client.initializeNavigation();
    _ui.finish();
  }

}

/**
 * Class Method: start
 * 
 * Creates a new instance of the pre-loader and starts the process.
 */
I3Preloader.start = function() { new I3Preloader().start(); }


// ---------------------------------------------------------------------------


/**
 * Class: I3PreloadUI
 *
 * Manages the display of the loading process, including animating the
 * progress bar and fading elements in and out.
 */
@class I3PreloadUI {

  // Constants
  var INITIAL_DELAY = 1000;  // milliseconds before displaying UI
  var ANIMATE_DELAY = 50;    // milliseconds between animation frames

  // Progress bar elements.
  var _progressDiv;
  var _progressBarContainer;
  var _progressBar;
  var _progressStatus;

  // Main i3 page elements.
  var _navbarDiv;
  var _contentDiv;

  // Timer for animation effects.
  var _animTimer;

  // Animation settings.
  var _uiIsVisible = false;
  var _delayedStartTime;
  var _shouldFadeProgressIn = false;
  var _shouldFadeProgressOut = false;
  var _shouldFadeHeaderIn = false;
  var _shouldFadeBordersIn = false;
  var _progressAmount = 0;
  var _progressTarget = 0;
  var _fadeStartTime;
  var _fadeStartTime2;
  var _fadeEndTime;

  /**
   * Method: initialize
   *
   * Initializes the preload UI manager.  This is called automatically
   * when an instance of the class is created.
   */
  @method initialize() {

    // Get references to elements.
    _progressDiv = document.getElementById("i3preloader");
    _progressBarContainer = document.getElementById("i3preloadProgress");
    _progressBar = _progressBarContainer.firstChild;
    _progressStatus = document.getElementById("i3preloadStatus");
    _navbarDiv = document.getElementById("i3navbar");
    _contentDiv = document.getElementById("i3contentWrapper");
      
    // Set up the opacity method based on the browser type.
    var _ua = navigator.userAgent.toLowerCase();
    if (_ua.indexOf('msie') != -1 && _ua.indexOf('opera') == -1)
      self._setOpacity = self._setOpacityIE;
    else self._setOpacity = self._setOpacityStd;
  }

  /**
   * Method: start
   *
   * Marks the starting time for the preload UI.
   */
  @method start() {
    // Determine the time after which the UI must be displayed.
    _delayedStartTime = new Date().getTime() + INITIAL_DELAY;
  }

  /**
   * Method: update
   *
   * Updates the UI animation.  This is called repeatedly when the client
   * is waiting for something so that the UI can check to see if enough
   * time has passed that it needs to display.
   */
  @method update() {
    if (!_uiIsVisible && (new Date().getTime()) > _delayedStartTime) {
      // Time to display the UI.
      self._setProgressFadeInMode();
    }
  }

  /**
   * Method: finish
   *
   * Finishes the preload UI, fading out the progress bar and fading in
   * the i3 page content.
   */
  @method finish() {
    if (_uiIsVisible) {
      // Begin fade-out of progress UI.
      self._setProgressFadeOutMode();
    } else {
      // The progress UI hasn't been shown yet.
      // Just display the main page immediately.
      clearTimeout(_animTimer);
      _progressDiv.style.display = "none";
      _navbarDiv.style.display = "block";
      _contentDiv.style.display = "block";
    }
  }

  /**
   * Method: setProgressAmount
   *
   * Smoothly animates the progress bar to the given amount.
   *
   * Parameters:
   *   amount - progress amount as an integer percentage (from 0 to 100)
   */
  @method setProgressAmount(amount) {
    _progressTarget = amount;
    self._animate();
  }
  
  /**
   * Method: setProgressText
   *
   * Sets the status text displayed below the progress bar.
   *
   * Parameters:
   *   text - the string to display
   *   forceVisible - set to `true` to make sure that the progress text
   *     is displayed, even if the UI has not been made visible yet
   */
  @method setProgressText(text, forceVisible) {
    if (forceVisible) {
      _progressDiv.style.display = "block";
      _uiIsVisible = true;
    }
    _progressStatus.innerHTML = text;
  }
  
  /**
   * Private Method: _setProgressFadeInMode
   *
   * Enables the animation of the progress bar fade-in.  This is called
   * when the initial delay has completed and the intranet files have
   * not yet been loaded, thus requiring a progress indicator to inform
   * the user that something is still happening.
   */
  @method _setProgressFadeInMode() {
    _progressDiv.style.display = "block";
    _uiIsVisible = true;
    _shouldFadeProgressIn = true;
    _fadeStartTime = new Date().getTime();
    self._setOpacity(_progressBarContainer, 0);
    _progressBarContainer.style.display = "block";
    self._animate();
  }
  
  /**
   * Private Method: _setProgressFadeOutMode
   *
   * Enables the animation of the progress section fade-out.  This is called
   * when the files have finished loading and it's time to display the main
   * intranet page.
   */
  @method _setProgressFadeOutMode() {
    _shouldFadeProgressIn = false;
    _shouldFadeProgressOut = true;
    _fadeEndTime = new Date().getTime() + 1000;
    self._animate();
  }
  
  /**
   * Private Method: _setContentFadeInMode
   *
   * Enables the animation of the main i3 page content fade-in.  This is
   * called when the progress bar has finished fading out after pre-loading.
   */
  @method _setContentFadeInMode() {
    _shouldFadeHeaderIn = true;
    self._setOpacity(_navbarDiv, 0);
    _navbarDiv.style.display = "block";
    _fadeStartTime = new Date().getTime();
  }
  
  /**
   * Private Method: _animate
   * 
   * Called when animation should be performed.
   */
  @method _animate() {
    if (_animTimer) clearTimeout(_animTimer);
    var shouldContinue = false;
    if (_uiIsVisible && self._adjustProgress()) shouldContinue = true;
    if (self._fade()) shouldContinue = true;
    if (shouldContinue)
      _animTimer = setTimeout(self._animate, ANIMATE_DELAY);
  }
  
  /**
   * Private Method: _setOpacity
   *
   * Sets the opacity of an element to a percentage.
   *
   * Parameters:
   *   el - the DOM element to adjust
   *   percentOpaque - opacity as an integer percentage (from 0 to 100,
   *     where 0 is fully transparent and 100 is fully opaque)
   */
  @method _setOpacity(el, percentOpaque) {
    // This will be overridden by the appropriate browser-specific version
    // during the initialization of the class.
  }
  
  /**
   * Private Method: _setOpacityStd
   *
   * Standards-compliant version of the `_setOpacity` method.
   *
   * Parameters:
   *   el - the DOM element to adjust
   *   percentOpaque - opacity as an integer percentage (from 0 to 100,
   *     where 0 is fully transparent and 100 is fully opaque)
   */
  @method _setOpacityStd(el, percentOpaque) {
    // Mozilla and Safari support the standard opacity setting.
    el.style.opacity = percentOpaque / 100;
  }
  
  /**
   * Private Method: _setOpacityIE
   *
   * IE-specific version of the `_setOpacity` method.
   *
   * Parameters:
   *   el - description
   *   percentOpaque - description
   */
  @method _setOpacityIE(el, percentOpaque) {
    // IE requires an MS-proprietary filter.
    if (percentOpaque < 100) {
      el.style.filter = "progid:DXImageTransform.Microsoft.Alpha(opacity=" +
        percentOpaque.toString() + ")";
    }
    else {
      el.style.filter = "";
    }
  }

  /**
   * Private Method: _fade
   *
   * Adjusts the opacity of the elements based on the current settings.
   * 
   * Returns:
   *   `true` if the animation process needs to continue
   */
  @method _fade() {
    var incomplete = false;
    var el, opacity;
    if (_shouldFadeProgressIn) {
      opacity = Math.min(Math.ceil(
        (new Date().getTime() - _fadeStartTime) / 10), 100);
      self._setOpacity(_progressBarContainer, opacity);
      _shouldFadeProgressIn = (opacity < 100);
      if (_shouldFadeProgressIn) incomplete = true;
    }
    if (_shouldFadeProgressOut) {
      opacity = Math.max(Math.ceil(
        (_fadeEndTime - new Date().getTime()) / 10), 0);
      self._setOpacity(_progressDiv, opacity);
      _shouldFadeProgressOut = (opacity > 0);
      if (_shouldFadeProgressOut) incomplete = true;
      else {
        _progressDiv.style.display = "none";
        _uiIsVisible = false;
        self._setContentFadeInMode();
      }
    }
    if (_shouldFadeHeaderIn) {
      opacity = Math.min(Math.ceil(
        (new Date().getTime() - _fadeStartTime) / 10), 100);
      self._setOpacity(_navbarDiv, opacity);
      if (opacity > 30 && _shouldFadeBordersIn == false) {
        _shouldFadeBordersIn = true;
        self._setOpacity(_contentDiv, 0);
        _contentDiv.style.display = "block";
        _fadeStartTime2 = new Date().getTime();
      }
      _shouldFadeHeaderIn = (opacity < 100);
      if (_shouldFadeHeaderIn) incomplete = true;
    }
    if (_shouldFadeBordersIn) {
      opacity = Math.min(Math.ceil(
        (new Date().getTime() - _fadeStartTime2) / 10), 100);
      self._setOpacity(_contentDiv, opacity);
      _shouldFadeBordersIn = (opacity < 100);
      if (_shouldFadeBordersIn) incomplete = true;
    }
    return incomplete;
  }
  
  /**
   * Private Method: _adjustProgress
   *
   * Adjusts the width of the progress bar to move it closer to the
   * target amount.
   * 
   * Returns:
   *   `true` if the animation process needs to continue
   */
  @method _adjustProgress() {
    if (_progressAmount == _progressTarget) return false;
    _progressAmount += Math.ceil((_progressTarget - _progressAmount) / 3);
    if (_progressAmount > 100) _progressAmount = 100;
    _progressBar.style.width = _progressAmount.toString() + "%";
    return (_progressTarget > _progressAmount);
  }
  
  // Run the initializer.
  self.initialize();
}
