/**
 * Script: common/client-web/js/menus
 * 
 * Simplifies the creation and management of section menus.  These are
 * similar to tabs, but are listed vertically instead of horizontally.
 * Menu items can include icons and be separated into groups.
 * 
 * *Usage*
 * 
 * The <I3.MenuController> class creates and manages a block of menu items
 * that perform some action when they are clicked.  A menu item can show
 * a DIV when selected, or it can navigate to a different path, depending
 * on how your applet is set up.  Either way, you'll want to create an
 * instance of <I3.MenuController> in your applet's `initialize` method and
 * provide it with a `DIV` in which it will place the menu.  Then you'll
 * call the <I3.MenuController::addItem> method for each menu item that the
 * controller will need to know about.
 * 
 * To use the menu controller to show or hide sections on a page, you'll want
 * to define the section DIVs in your applet's HTML file, each with its own
 * ID.  When you call `addItem()` for each section, you'll supply it with the
 * ID of the section to display, and a `delegate` object to notify when the
 * section becomes visible.  The `delegate` will need to have a method named
 * `sectionDidBecomeVisible` that takes a single `sectionID` parameter.  This
 * parameter provides the ID of the section that was displayed.  If you're
 * managing all the sections in a single class, you can provide the same
 * object as the `delegate` for each menu item, and use the `sectionID`
 * parameter to tell which item was clicked.  If you have separate controller
 * classes for each section, you can provide each menu item with a different
 * `delegate`, and the controllers can ignore the `sectionID` parameter.
 * 
 * To use the menu controller to navigate between pages, you simply provide
 * a `link` option when calling `addItem` that contains the virtual path to
 * navigate to when the item is clicked.  This works similarly to
 * <I3Internals.UserInterface::createNavigationLink>.  Each page that is
 * included in the menu should have an identical menu displayed on it with
 * its item highlighted (see the <I3.MenuController::selectItem> method).
 * 
 * Icons can optionally be added to each menu item.  To enable icons, you
 * will first need to call <I3.MenuController::setMenuIconSize> to choose
 * what size icon you want to display for each item.  The most common values
 * are `16` and `32`.  Then, when you call `addItem` for each menu item,
 * you'll include an `icon` option that provides the base name of the PNG
 * icon to display for that item (i.e. the part of the icon name before the
 * "-16" or "-32".
 * 
 * A title is displayed at the top of the menu.  This defaults to "Menu",
 * but can be customized via the <I3.MenuController::setTitle> method.
 * You can also supply your own CSS classes to customize the look of the
 * menu with the <I3.MenuController::setStyles> method.
 * 
 * Example HTML:
 * 
 * (start example)
 * 
 *   <!-- Menu will be placed in here -->
 *   <div id="myMenu"></div>
 * 
 *   <!-- Content of the first section -->
 *   <div id="myFirstSection">
 *     <p>This will be shown for the first section.</p>
 *   </div>
 * 
 *   <!-- Content of the first section -->
 *   <div id="mySecondSection">
 *     <p>This will be shown for the second section.</p>
 *   </div>
 * 
 * (end example)
 * 
 * Example JavaScript:
 * 
 * (start example)
 * 
 *   // Create a menu controller instance and set up the items.
 *   var _menu;
 *   @method initialize() {
 *     _menu = new I3.MenuController(I3.ui.get("myMenu"));
 *     _menu.setTitle("Amazing Menu");
 *     _menu.setMenuIconSize(32);
 *     _menu.addItem("My first item", { 
 *       sectionID: "myFirstSection", icon: "dog", delegate: self });
 *     _menu.addItem("My second item", { 
 *       sectionID: "mySecondSection", icon: "cat", delegate: self });
 *     _menu.addItem("My third item", {
 *       link: "/my-tool/other-page/", icon: "bird" });
 *   }
 * 
 *   // Show the first section when a path is loaded.
 *   @method loadPath() {
 *     _menu.selectItem(0);
 *   }
 * 
 *   // Called when the user has chosen one of the first two menu items.
 *   @method sectionDidBecomeVisible(sectionID) {
 *     alert("You selected the section with the ID: " + sectionID);
 *   }
 * 
 * (end example)
 * 
 * Credits:
 * 
 *   Written by
 *     Nathan Mellis (nathan@mellis.us) and
 *     Marshall Elfstrand (marshall@vengefulcow.com).
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
 *   $Id: menus.js 2 2007-12-06 00:18:23Z melfstrand $
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
 * Class: I3.MenuController
 *
 * Manages a collection of sections and switches between them when an
 * item in the menu is clicked.
 *
 * Parameters:
 *   menuContainer - the `DIV` that will contain the menu
 */
@class MenuController(menuContainer, title) {

  // Prefix to use for the table ID if no unique table ID is specified
  // using `setTableID()`.  The ID of the table used by the first menu
  // controller on the page will be this value followed by "__0", the
  // ID of the second will be this value followed by "__1", and so on.
  var DEFAULT_TABLE_ID_BASE       = "i3menuControllerTableInstance";
  
  // Constants to use for IDs for menu items.
  var DEFAULT_ITEM_SUFFIX         = "__i3menuItem";
  var DEFAULT_TITLE_SUFFIX        = "__i3menuItemTitle";
  var DEFAULT_ARROW_SUFFIX        = "__i3menuItemArrow";

  // Default title to display.
  var DEFAULT_TITLE               = "Menu";

  // Default menu icon size.
  var DEFAULT_ICON_SIZE           = 0;  // None

  // Styles for internal elements that are not overridden by the _styles hash.  
  MENU_TITLE_CONTAINER_CLASS = "i3menuTitleContainer";
  MENU_GROUP_ROW_CLASS = "i3menuGroupRow";

  // Array of menu items to be filled in by the applet using `addItem()`.
  var _menu = [];
  
  // This will be incremented as items are added to the menu.
  // It is used to generate IDs on-the-fly for menu items that do
  // not have a sectionID to use as the basis for their ID.
  var _nextItemIndex = 0;
  
  var _currentlySelectedItem;
  
  // Hash of CSS class names that will be used to style the menu.
  var _styles;

  // Controls that will need to be referenced.
  var _menuContainer;
  var _menuTBody;
  
  /**
   * Private Method: _initialize
   *
   * Creates the menu list and prepares the controller for use.
   * This is called automatically when the constructor is called.
   * 
   * Parameters:
   *   menuContainer - the `DIV` that will contain the menu
   */
  @method _initialize(menuContainer) {

    // Set up the default styles for the menu.
    // These are defined in common/css/i3-core.css.
    _styles = {
      menuBackground: "i3menuBackground",
      menuContent: "i3menuContent",
      menuTable: "i3menuTable",
      title: "i3menuTitle",
      titleBackground: "i3menuTitleBackground",
      group: "i3menuGroup",
      groupBackground: "i3menuGroupBackground",
      itemIcon: "i3menuItemIcon",
      itemTitle: "i3menuItemTitle",
      itemArrow: "i3menuItemArrow",
      itemLink: "i3menuItemLink",
      selectedItem: "i3menuSelectedItem",
      selectedItemTitle: "i3menuSelectedItemTitle",
      selectedItemArrow: "i3menuSelectedItemArrow"
    };
    
    // Invent an ID to use for the table if none ends up being specified.
    _tableID = DEFAULT_TABLE_ID_BASE + "__0";
    var index = 0;
    while (I3.ui.get(_tableID) != null) {
      index++;
      _tableID = DEFAULT_TABLE_ID_BASE + "__" + index.toString();
    }
    
    // Store the container reference for later use.
    _menuContainer = menuContainer;
  }


  // -------------------------------------------------------------------------
  // Group: Settings
  // -------------------------------------------------------------------------

  /**
   * Method: getTableID
   * Returns the string to use for the ID of the table that will contain
   * the menu items.
   *
   * Method: setTableID
   * Sets the string to use for the ID of the table that will contain
   * the menu items.
   */
  @property tableID;

  /**
   * Method: getMenuItemSuffix
   * Returns the suffix that will be appended to section IDs in order to
   * form the ID of the menu item row that will display the section when
   * clicked.  For example, if the suffix is "__menuItem", and a section
   * is added with a `sectionID` of "mySection", the ID of the menu item
   * that displays that section would be "mySection__menuItem".
   *
   * Method: setMenuItemSuffix
   * Sets the suffix that will be appended to section IDs in order to
   * form the ID of the menu item row that will display the section when
   * clicked.
   */
  @property menuItemSuffix = DEFAULT_ITEM_SUFFIX;

  /**
   * Method: getMenuItemTitleSuffix
   * Returns the suffix that will be appended to section IDs in order to
   * form the ID of the table cell that contains the title of the section.
   * This is generally the menu item suffix with "Title" appended to it.
   *
   * Method: setMenuItemTitleSuffix
   * Sets the suffix that will be appended to section IDs in order to
   * form the ID of the table cell that contains the title of the section.
   */
  @property menuItemTitleSuffix = DEFAULT_TITLE_SUFFIX;

  /**
   * Method: getMenuItemArrowSuffix
   * Returns the suffix that will be appended to section IDs in order to
   * form the ID of the table cell that contains the arrow marker when the
   * menu item is highlighted.  This is generally the menu item suffix
   * with "Arrow" appended to it.
   *
   * Method: setMenuItemArrowSuffix
   * Sets the suffix that will be appended to section IDs in order to
   * form the ID of the table cell that contains the arrow marker when the
   * menu item is highlighted.
   */
  @property menuItemArrowSuffix = DEFAULT_ARROW_SUFFIX;

  /**
   * Method: getMenuIconSize
   * Returns the size (in pixels) of the icons displayed next to each
   * menu item.  The size is generally 16 or 32.
   *
   * Method: setMenuIconSize
   * Sets the size (in pixels) of the icons displayed next to each menu
   * item.  Large icons are generally 32 pixels, small are 16 pixels.
   * The value will be appended to the name of the icon when the icon
   * filename is determined.  This can be set to 0 to disable icons.
   */
  @property menuIconSize = DEFAULT_ICON_SIZE;

  /**
   * Method: setMenuIconType
   *
   * Sets the size of the icons displayed next to each menu item based on
   * a string description of the type.  The recognized types are:
   * 
   *   * `"large"` - a 32x32 pixel icon
   *   * `"small"` - a 16x16 pixel icon
   *   * `"none"` - disable icons
   * 
   * Parameters:
   *   type - the type of icon to set the menu to
   */
  @method setMenuIconType(type) {
    var size = 0;
    if (type == "large") size = 32;
    else if (type == "small") size = 16;
    self.setMenuIconSize(size);
  }

  /**
   * Method: getStyles
   * 
   * Returns a hash of style keys and the associated CSS class names.
   * Note that modifying this hash will have no effect; use <setStyles>
   * to override specific styles with your own CSS classes.
   */
  @method getStyles() {
    var styles = {};
    for (var key in _styles) { styles[key] = _styles[key]; }
    return styles;
  }

  /**
   * Method: setStyles
   *
   * Overrides the CSS classes used to style menu elements.  The `styles`
   * parameter is a hash that maps recognized style keys to new CSS classes
   * instead of using the defaults.  You only need to include the specific
   * styles that you want to override.
   * 
   * Commonly used style keys:
   *   menuBackground - applies to the entire menu.  Can be used to set
   *     the background color for the menu.
   *   title - applies to the menu title.  Can be used to set the foreground
   *     color of the title.  This contains an `h3` that can be further styled
   *     using CSS selectors if necessary (e.g. ".customTitleStyle h3").
   *   titleBackground - applies to the menu title.  Can be used to set the
   *     background color of the title.
   *   group - applies to group titles.  Can be used to set the foreground
   *     color of the group separators.
   *   groupBackground - applies to group titles.  Can be used to set the
   *     background color of the group separators.
   *   selectedItem - applies to the row of the selected item.  Can be used
   *     to set the background color for the row.
   *   selectedItemTitle - applies to the title of the selected item.
   *     Can be used to set the foreground color of the selected title.
   *   selectedItemArrow - applies to the right-arrow indicator of the
   *     selected item.  Can be used to set the foreground color of the
   *     selected arrow.
   * 
   * Additional style keys:
   *   menuContent - applies to the portion of the menu below the title.
   *     This normally sets a border on the left, right, and bottom sides,
   *     and adds some internal padding for the content.
   *   menuTable - applies to the table that contains each row of the menu.
   *     Normally sets `border-collapse` and width options.
   *   itemIcon - applies to the table cells that contain item icons.
   *     Normally sets padding options.  This style is only applied when
   *     icons are visible and one has been assigned to the menu item.
   *   itemTitle - applies to the table cells that contain item titles.
   *     Normally sets padding, font, and width options.
   *   itemArrow - applies to the table cells that contain right-arrow
   *     indicators.  Normally sets padding, font, and width options.
   * 
   * Example JavaScript:
   * (start example)
   *   var menu = new I3.MenuController("myMenuDiv");
   *   menu.setStyles({
   *     title: "myMenuTitle",
   *     selectedItem: "myMenuSelectedItem" });
   * (end example)
   * 
   * Example CSS:
   * (start example)
   *   .myMenuTitle         { background: #407040; }
   *   .myMenuSelectedItem  { background: #305030; }
   * (end example)
   * 
   * Parameters:
   *   styles - a hash of style keys and associated CSS class names
   */
  @method setStyles(styles) {
    for (var key in styles) { _styles[key] = styles[key]; }
  }
  
  
  // -------------------------------------------------------------------------
  // Group: Section Management
  // -------------------------------------------------------------------------
  
  /**
   * Method: getTitle
   * Returns the user-visible title string for the menu.
   *
   * Method: setTitle
   * Sets the user-visible title string for the menu.
   * The title will be rendered when the first item is added.
   */
  @property title = DEFAULT_TITLE;

  /**
   * Method: addGroup
   *
   * Adds a group separator to the list.
   *
   * Parameters:
   *   title - the string to display in the group separator
   */
  @method addGroup(title) {
    
    // Create the row elements.
    var groupTR = I3.ui.create("tr");
    var groupTD = I3.ui.create("td");
    var groupBackground = I3.ui.create("div");
    var groupForeground = I3.ui.create("span");
    
    // Set styles.
    groupTR.className = MENU_GROUP_ROW_CLASS;
    groupBackground.className = _styles.groupBackground;
    groupForeground.className = _styles.group;
    
    // Build the group row and add it to the table.
    groupForeground.appendChild(I3.ui.text(title));
    groupBackground.appendChild(groupForeground);
    groupTD.colSpan = 3;
    groupTD.appendChild(groupBackground);
    groupTR.appendChild(groupTD);
    self._getTable().appendChild(groupTR);
  }
  
  /**
   * Method: addItem
   *
   * Adds a menu item to the list.
   *
   * The `title` parameter is required for all sections, as is a hash of
   * additional `options`.  The contents of the `options` will differ,
   * though, based on whether the menu item should display a `DIV` or
   * navigate to a different path when clicked.
   * 
   * If adding an item that shows a `DIV` when clicked, the `options`
   * parameter must contain at least these two properties:
   * 
   *   sectionID - the ID of the `DIV` to display when the item is clicked
   *   delegate - the delegate object that will control the section's contents
   * 
   * If adding an item that will navigate to another page when clicked,
   * the `options` parameter must at least include the following property:
   * 
   *   link - the virtual path to navigate to when the item is clicked
   * 
   * In either case, an additional `icon` parameter can be supplied that
   * specifies the base name of a PNG icon to display next to the item
   * (i.e. the part of the name before the "-16" or "-32").  The icon will
   * be looked for in the current tool's "img" folder.  For example, if
   * "death-star" is the current tool, and the icon size for the menu is
   * set to `32`, an `icon` setting of "tie-fighter" would map to
   * "/death-star/client-web/img/tie-fighter-32.png".  If the icon to be used is not
   * in the current tool's "img" folder, you can specify an alternate tool
   * with the `tool` option.
   * 
   * A `key` option can be provided to override the identifier for the
   * item being added.  The `key` can then be used with <selectItem> to
   * highlight the item later, instead of using the `sectionID` or an
   * integer index.  If supplied, the `key` will become the base name of
   * the elements generated for the menu item.
   * 
   * Examples:
   * 
   * Assume that you have an `I3.MenuController` instance assigned to
   * the variable `menu`.
   * 
   * (start example)
   * 
   *   // Create a navigation menu item with no icon.
   *   menu.addItem("Detention Level", { link: "/death-star/detention/" });
   * 
   *   // Create a show/hide menu item with an icon.
   *   menu.addItem("TIE Fighter", {
   *                sectionID: "tieFighterDiv",
   *                delegate: fighterController,
   *                icon: "tie-fighter" });
   * 
   *   // Create a show/hide menu item with an icon from another tool
   *   // and a custom key.
   *   menu.addItem("Alderaan", {
   *                key: "planetaryTarget",
   *                sectionID: "planetaryTargetDiv",
   *                delegate: planetController,
   *                icon: "alderaan",
   *                tool: "rebellion" });
   * 
   *   // Create a menu with file and folder links pulling icons from the file-types folder 
   *   // by specifying "file-types" as the tool.
   *   menu.addItem("Folder 1", {
   *                key: "folder-1", 
   *                link: "/folder-1", 
   *                icon: "folder", 
   *                tool: "file-types" });
   * 
   * (end example)
   * 
   * Parameters:
   *   title - the string to display for the item
   *   options - the hash of additional options, as described above
   * 
   * See Also:
   *   <setMenuIconSize>
   */
  @method addItem(title, options) {

    // Add the menu item to the array for later use.
    options.title = title;
    if (options.key == null) {
      if (options.sectionID != null) options.key = options.sectionID;
      else options.key = self.getTableID() + "__" + _nextItemIndex.toString();
    }
    _menu.push(options);
    
    // Create the table row.
    var tr = I3.ui.create("tr");
    tr.id = options.key + self.getMenuItemSuffix();
    tr.itemIndex = _nextItemIndex;
    tr.style.cursor = "pointer";
    tr.onclick = self.onMenuClick;

    // Create the icon cell.
    var iconTD = I3.ui.create("td");
    var iconSize = self.getMenuIconSize();
    if (iconSize > 0 && options.icon) {
      iconTD.className = _styles.itemIcon;
      var tool = options.tool ? options.tool : I3.client.getToolName();
      var imgPathBase = "/" + tool + "/client-web/img/";
      var img = I3.ui.create("IMG");
      img.src = imgPathBase + options.icon + "-" + iconSize.toString() + ".png";
      img.width = iconSize;
      img.height = iconSize;
      iconTD.appendChild(img);
    } else iconTD.appendChild(I3.ui.text(""));
    
    // Create the title cell.
    var titleTD = I3.ui.create("td");
    titleTD.className = _styles.itemTitle;
    titleTD.id = options.key + self.getMenuItemTitleSuffix();
    var linkActionText;
    if (options.link) linkActionText = "Go:" + options.link;
    else linkActionText = "Show:" + options.title;
    var link = I3.ui.createActionLink(options.title, options.key,
      linkActionText, self.onMenuClick);
    link.className = _styles.itemLink;
    titleTD.appendChild(link);
    
    // Create the arrow cell.
    var arrowTD = I3.ui.create("td");
    arrowTD.className = _styles.itemArrow;
    arrowTD.id = options.key + self.getMenuItemArrowSuffix();
    arrowTD.appendChild(I3.ui.text(">"));
    
    // Build and append the row.
    tr.appendChild(iconTD);
    tr.appendChild(titleTD);
    tr.appendChild(arrowTD);
    self._getTable().appendChild(tr);

    // Increment index for the next item.
    _nextItemIndex++;
  }
  
  /**
   * Method: updateItem
   *
   * Updates an item in the menu.  The `options` hash takes the same values as <addItem>.  Any value 
   * supplied in the hash will overwrite the value supplied to <addItem> except for the "key" 
   * property.  If you do not wish to change the title, pass `null`.
   *
   * Parameters:
   *   itemKey - the index of the item to update; can be a key if one was specified
   *   title - the new title for the menu item; pass `null` to skip
   *   options - an hash of key/value pairs; see <addItem> for details
   */
  @method updateItem(itemKey, title, options) {
    // Find the key if looking up the section by index.
    if (typeof itemKey == "number") {
      if (itemKey < 0) itemKey = "";
      else itemKey = _menu[itemKey].key;
    }
    
    for (var i = 0; i < _menu.length; i++) {
      if (_menu[i].key == itemKey) {
        if (title)
          _menu[i].title = title;
        if (options) {
          for (var key in options) {
            if (key == "key") continue;
            _menu[i][key] = options[key];
          }
        }
        break;
      }
      else {
        continue;
      }
    }
    
    self.selectItem(_currentlySelectedItem);
  }
  
  /**
   * Method: selectItem
   *
   * Updates the menu item display and sends the `sectionDidBecomeVisible`
   * message to the delegate for the selected menu item.
   *
   * The `itemKey` can be either the zero-based index of the item (based on
   * the order that the items were added), or the string `key` specified
   * when the item was added.  If no `key` was supplied, but a `sectionID`
   * was, that can be used for the `itemKey`.
   * 
   * You can use `-1` or an empty string for the `itemKey` to de-select
   * all menu items.
   * 
   * Parameters:
   *   itemKey - the item index or string identifier
   */
  @method selectItem(itemKey) {
    _currentlySelectedItem = itemKey;
    
    // Find the key if looking up the section by index.
    if (typeof itemKey == "number") {
      if (itemKey < 0) itemKey = "";
      else itemKey = _menu[itemKey].key;
    }
    
    // Update the display of the menu items.
    var delegate = null;
    var visibleSectionID = "";
    var link, linkActionText;
    for (var i = 0; i < _menu.length; i++) {
      
      // Obtain references to the item elements and reset their display.
      var tr = I3.ui.get(_menu[i].key + self.getMenuItemSuffix());
      var titleTD = I3.ui.get(_menu[i].key + self.getMenuItemTitleSuffix());
      var arrowTD = I3.ui.get(_menu[i].key + self.getMenuItemArrowSuffix());
      I3.ui.clear(titleTD);
      I3.ui.clear(arrowTD);
      
      // Re-build the row.
      if (_menu[i].key == itemKey) {

        // Highlight selected item.
        tr.className = _styles.selectedItem;

        // Build selected version of the title.
        var titleSpan = I3.ui.create("span");
        titleSpan.className = _styles.selectedItemTitle;
        titleSpan.appendChild(I3.ui.text(_menu[i].title));
        titleTD.appendChild(titleSpan);

        // Build selected version of the arrow.
        var arrowSpan = I3.ui.create("span");
        arrowSpan.className = _styles.selectedItemArrow;
        arrowSpan.appendChild(I3.ui.text(">"));
        arrowTD.appendChild(arrowSpan);

        // Show/hide the section if applicable.
        if (_menu[i].sectionID) {
          visibleSectionID = _menu[i].sectionID;
          I3.ui.show(visibleSectionID);
        }
        if (_menu[i].delegate) delegate = _menu[i].delegate;

      } else {

        // Build link for non-selected item.
        tr.className = "";
        if (_menu[i].link) linkActionText = "Go:" + _menu[i].link;
        else linkActionText = "Show:" + _menu[i].title;
        link = I3.ui.createActionLink(_menu[i].title, _menu[i].key,
          linkActionText, self.onMenuClick);
        link.className = _styles.itemLink;
        titleTD.appendChild(link);
        arrowTD.appendChild(I3.ui.text(">"));
        if (_menu[i].sectionID && _menu[i].sectionID != visibleSectionID) {
          I3.ui.hide(_menu[i].sectionID);
        }
        
      } // end if
    } // end for
    
    // Notify the delegate that the selected item has changed, if applicable.
    if (delegate && delegate.sectionDidBecomeVisible)
      delegate.sectionDidBecomeVisible(itemKey);
  }
  
  /**
   * Private Method: _getTable
   *
   * Returns the table that contains the menu item rows.  The table will
   * be created and added to the page if it does not already exist.
   */
  @method _getTable() {
    if (_menuTBody == null) {

      // This is the first access of the menu, after the styles have
      // been set.  We need to set up the menu and add the title.
      var menuDiv = I3.ui.create("div");
      menuDiv.className = _styles.menuBackground;

      // Create the title elements.
      var titleContainer = I3.ui.create("div");
      var titleBackground = I3.ui.create("div");
      var titleForeground = I3.ui.create("div");
      var titleHeader = I3.ui.create("h3");
      
      // Set title styles.
      titleContainer.className = MENU_TITLE_CONTAINER_CLASS;
      titleBackground.className = _styles.titleBackground;
      titleForeground.className = _styles.title;
      
      // Build and add the title.
      titleHeader.appendChild(I3.ui.text(self.getTitle()));
      titleForeground.appendChild(titleHeader);
      titleBackground.appendChild(titleForeground);
      titleContainer.appendChild(titleBackground);
      menuDiv.appendChild(titleContainer);
      
      // Create the table and its surrounding div.
      var menuContent = I3.ui.create("div");
      var menuTable = I3.ui.create("table");
      _menuTBody = I3.ui.create("tbody");
      
      // Set styles.
      menuContent.className = _styles.menuContent;
      menuTable.className = _styles.menuTable;
      
      // Build and add the table section.
      menuTable.appendChild(_menuTBody);
      menuContent.appendChild(menuTable);
      menuDiv.appendChild(menuContent);

      // Add the freshly-made-like-In-N-Out menu to the page.
      _menuContainer.appendChild(menuDiv);
    }
    return _menuTBody;
  }
  
  /**
   * Private Method: onMenuClick
   *
   * Called when one of the menu item links is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onMenuClick(e) {
    e = I3.ui.getEvent(e);
    var targ = e.getTarget();
    while (targ != null && targ.nodeName.toLowerCase() != "tr")
      targ = targ.parentNode;
    if (targ != null) {
      var index = targ.itemIndex;
      if (_menu[index].link && _menu[index].link != I3.client.getPath())
        I3.client.navigateTo(_menu[index].link);
      else
        self.selectItem(index);
    }
    e.cancelBubble();
  }
  
  self._initialize(menuContainer);
}
