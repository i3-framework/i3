/**
 * Script: common/client-web/js/tabs
 *
 * Simplifies the creation and management of tabbed panels.
 *
 * *Usage*
 *
 * The <I3.TabController> class manages a set of panels and shows or hides
 * them as tabs are clicked.  To use it, you'll want to define the panels
 * in your applet's HTML file, and then set up an <I3.TabController> in your
 * JavaScript code to display the tabs and control the panels.
 *
 * Each panel in a tabbed panel set is simply a `DIV` in the applet HTML.
 * The `class` attribute of the `DIV` is set to "i3tabPanel".  The panels
 * should all be placed inside a container `DIV` that the <I3.TabController>
 * will manage.
 *
 * In your applet's `initialize` method, you'll want to create an instance
 * of <I3.TabController> and provide it with the container `DIV` that it is
 * supposed to manage.  Then you'll call the <I3.TabController::addTab> method
 * for each tab that the controller will need to know about.
 *
 * When you call `addTab`, you'll supply a set of properties for the tab.
 * One of these is the `delegate`, which is the object that should be
 * notified whenever the tabbed panel is made visible (i.e. it was selected
 * by the user or via code).  This object will need to have a method named
 * `tabDidBecomeVisible` that takes a single `index` parameter.  This
 * parameter provides the zero-based index of the tab that was chosen.  If
 * you're managing all of the tabs in a single class, you can provide the
 * same object as the delegate for each tab, and use the `index` parameter
 * to tell which one was clicked.  If you have separate controller classes
 * for each tab, you can provide each tab with a different `delegate`, and
 * the controllers can ignore the `index` parameter.
 * 
 * Example HTML:
 *
 * (start example)
 *   <!-- Container for the panels that will be part of the tab set -->
 *   <div id="myTabContainer">
 *
 *     <!-- Content of the first tab -->
 *     <div id="myFirstTab" class="i3tabPanel">
 *       <p>This will be shown for the first tab.</p>
 *     </div>
 *
 *     <!-- Content of the second tab -->
 *     <div id="mySecondTab" class="i3tabPanel">
 *       <p>This will be shown for the second tab.</p>
 *     </div>
 *
 *   </div>
 * (end example)
 *
 * Example JavaScript:
 *
 * (start example)
 *   // Create a tab controller instance and set up the tabs.
 *   var _tabController;
 *   @method initialize() {
 *     _tabController = new I3.TabController(I3.ui.get("tabContainer"));
 *     _tabController.addTab({ title: "My first tab",
 *                             panelID: "myFirstTab",
 *                             delegate: self });
 *     _tabController.addTab({ title: "My second tab",
 *                             panelID: "mySecondTab",
 *                             delegate: self });
 *   }
 *
 *   // Show the first tab when a path is loaded.
 *   @method loadPath() {
 *     _tabController.selectTab(0);
 *   }
 *
 *   // Called when the user has chosen a tab.
 *   @method tabDidBecomeVisible(index) {
 *     alert("You selected tab #" + (index + 1).toString());
 *   }
 * (end example)
 *
 * Credits:
 * 
 *   Written by
 *     Marshall Elfstrand (marshall@vengefulcow.com) and
 *     Nathan Mellis (nathan@mellis.us)
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
 *   $Id: tabs.js 2 2007-12-06 00:18:23Z melfstrand $
 */


// ---------------------------------------------------------------------------

/**
 * Module: I3
 *
 * Module containing class definitions and data shared by all
 * intranet applications.
 */
@module I3;

// ---------------------------------------------------------------------------


/**
 * Class: I3.TabController
 *
 * Manages a tabbed UI and switches between views when a tab is clicked.
 *
 * Parameters:
 *   tabContainer - the `DIV` that contains the tab sections.
 *     The tab strip will be inserted as the first child of this DIV.
 */
@class TabController(tabContainer) {

  // Constants to use for the class names of the tab strip.
  var DEFAULT_TABSTRIP_CLASS = "i3tabStrip";
  var DEFAULT_ITEM_CLASS = "i3tabStripItem";
  var DEFAULT_SELECTED_ITEM_CLASS = "i3selectedTabStripItem";
  var DEFAULT_LEFTMOST_ITEM_CLASS = "i3firstTabStripItem";
  
  // Constant to append to panel IDs for the tab strip item
  // that shows the panel.
  var DEFAULT_SUFFIX = "__i3tabStripItem";

  // Array of tab names, IDs, and controller classes, to be filled in
  // during applet initialization.
  var _tabs = [];

  // Index of the tab that is currently selected.
  var _currentTabIndex = 0;
  
  // Controls that will need to be referenced.
  var _tabStripDiv;

  /**
   * Private Method: _initialize
   *
   * Creates the tab strip and prepares the controller for use.
   * This is called automatically when the constructor is called.
   *
   * Parameters:
   *   tabContainer - the `DIV` that contains the tab sections.
   *     The tab strip will be inserted as the first child of this DIV.
   */
  @method _initialize(tabContainer) {
    _tabStripDiv = I3.ui.create("div");
    _tabStripDiv.className = _tabStripClassName;
    tabContainer.insertBefore(_tabStripDiv, tabContainer.firstChild);
  }
  

  // -------------------------------------------------------------------------
  // Group: Settings
  // -------------------------------------------------------------------------

  /**
   * Method: getTabStripClassName
   * Returns the name of the CSS class used to style the tab strip.
   * (the `DIV` that contains the tab items).
   *
   * Method: setTabStripClassName
   * Sets the name of the CSS class used to style the tab strip.
   * (the `DIV` that contains the tab items).
   */
  @property tabStripClassName = DEFAULT_TABSTRIP_CLASS;

  /**
   * Method: getTabItemClassName
   * Returns the name of the CSS class used to style non-selected tabs.
   *
   * Method: setTabItemClassName
   * Sets the name of the CSS class used to style non-selected tabs.
   * This must be called before tabs are added in order to have an effect.
   */
  @property tabItemClassName = DEFAULT_ITEM_CLASS;

  /**
   * Method: getSelectedClassName
   * Returns the name of the CSS class used to style selected tabs.
   *
   * Method: setSelectedClassName
   * Sets the name of the CSS class used to style selected tabs.
   * This must be called before tabs are added in order to have an effect.
   */
  @property selectedClassName = DEFAULT_SELECTED_ITEM_CLASS;
  
  /**
   * Method: getLeftmostClassName
   * Returns the name of the CSS class used to style the left-most item in
   * the tab strip.  This style will be applied in addition to the
   * non-selected or selected style.  Usually this simply adds a left-side
   * border, and the normal style applies the right-side border.
   *
   * Method: setLeftmostClassName
   * Sets the name of the CSS class used to style the left-most item in
   * the tab strip.  This must be called before tabs are added in order to
   * have an effect.
   */
  @property leftmostClassName = DEFAULT_LEFTMOST_ITEM_CLASS;

  /**
   * Method: getTabItemSuffix
   * Returns the suffix that will be appended to tab panel IDs in order to
   * form the ID of the tab item that will display the panel.  For example,
   * if the suffix is "__tabStripItem", and a tab is added with a panelID of
   * "myPanel", the ID of the tab strip item that displays that panel would
   * be "myPanel__tabStripItem".
   *
   * Method: setTabItemSuffix
   * Sets the suffix that will be appended to tab panel IDs in order to
   * form the ID of the tab item that will display the panel.  This must
   * be called before tabs are added in order to have an effect.
   */
  @property tabItemSuffix = DEFAULT_SUFFIX;


  // -------------------------------------------------------------------------
  // Group: Tab Management
  // -------------------------------------------------------------------------
  
  /**
   * Method: addTab
   *
   * Adds a managed tab to the tab strip.
   * 
   * The `options` parameter is an object that must contain these three
   * properties:
   *
   *   title    - the user-visible tab title
   *   panelID  - the ID of the `DIV` to display when the tab is clicked
   *   delegate - the delegate object that will control the tab's contents
   *
   * When the tab is selected, the `tabDidBecomeVisible` method of the
   * delegate will be called with the index of the tab that was shown,
   * if the method exists.
   * 
   * Parameters:
   *   options - the tab options
   * 
   * Returns:
   *   The index of the new tab.
   */
  @method addTab(options) {
    _tabs.push(options);
    var div = I3.ui.create("div");
    div.className = _tabItemClassName;
    if (_tabs.length == 1) div.className += " " + _leftmostClassName;
    div.id = options.panelID + _tabItemSuffix;
    div.appendChild(I3.ui.text(options.title));
    _tabStripDiv.appendChild(div);
    return _tabs.length - 1;
  }

  /**
   * Method: updateTab
   *
   * Updates the options for a managed tab.
   * 
   * The `options` parameter is an object that can contain any of the
   * properties supported by <addTab>.  The most commonly modified
   * property is `title`.
   *
   * Parameters:
   *   tabIndex - the index of the tab to update
   *   options - the tab options to update
   */
  @method updateTab(tabIndex, data) {
    for (var prop in data) { _tabs[tabIndex][prop] = data[prop]; }
    self._render();
  }

  /**
   * Method: selectTab
   *
   * Updates the tab display and sends the `tabDidBecomeVisible` message
   * to the delegate for the current tab.
   *
   * Parameters:
   *   tabIndex - the zero-based index of the tab to display
   */
  @method selectTab(tabIndex) {
    _currentTabIndex = tabIndex;
    self._render();

    // Notify the delegate that the tab has changed.
    var delegate = _tabs[tabIndex].delegate;
    if (delegate.tabDidBecomeVisible) delegate.tabDidBecomeVisible(tabIndex);
  }
  
  /**
   * Private Method: _render
   *
   * Creates (or re-creates if necessary) the tab bar and displays
   * the currently selected tab panel.
   */
  @method _render() {
    for (var i = 0; i < _tabs.length; i++) {
      var div = I3.ui.get(_tabs[i].panelID + _tabItemSuffix);
      // Remove any existing text from the tab.
      if (div.hasChildNodes()) div.removeChild(div.firstChild);
      if (i == _currentTabIndex) {
        // Selected tab.
        div.className = _selectedClassName;
        if (i == 0) div.className += " " + _leftmostClassName;
        div.appendChild(I3.ui.text(_tabs[i].title));
        I3.ui.show(_tabs[i].panelID);
      } else {
        // Non-selected tab.
        div.className = _tabItemClassName;
        if (i == 0) div.className += " " + _leftmostClassName;
        var link = I3.ui.createActionLink(_tabs[i].title, _tabs[i].panelID,
          "Show:" + _tabs[i].title, self.onTabClick);
        div.appendChild(link);
        I3.ui.hide(_tabs[i].panelID);
      }
    }
  }
  
  /**
   * Private Method: onTabClick
   *
   * Called when one of the tab links is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onTabClick(e) {
    e = I3.ui.getEvent(e);
    var tabIndex = -1;
    var panelID = e.getInfo();
    for (var i = 0; i < _tabs.length; i++) {
      if (panelID == _tabs[i].panelID) {
        tabIndex = i;
        break;
      }
    }
    if (tabIndex >= 0) self.selectTab(tabIndex);
  }
  
  self._initialize(tabContainer);
}
