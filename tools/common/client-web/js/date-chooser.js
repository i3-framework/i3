/**
 * Script: common/client-web/js/date-chooser
 * 
 * Provides a date chooser object for simplifying date input.  The date
 * chooser can be used as either a static in-page element or as a pop-up
 * that is attached to an `input` element.
 * 
 * *Creating a pop-up date chooser*
 * 
 * (start example)
 *   var chooser = new I3.DateChooser();
 *   chooser.setInputElement(I3.ui.get("inputElementID"));
 *   chooser.create();
 * (end example)
 * 
 * *Creating an in-page date chooser*
 * 
 * (start example)
 *   var chooser = new I3.DateChooser();
 *   chooser.create(I3.ui.get("containerElementID"));
 * (end example)
 * 
 * Methods may be assigned to the date chooser object to handle events.
 * <I3.DateChooser::onDateSelected> will be called when a date has been
 * selected from the chooser.  When the pop-up window has been closed,
 * <I3.DateChooser::onClose> will be called.  See the method documentation
 * for details.
 * 
 * Date choosers are extensively customizable.  It is possible to set the
 * first day of the week, specify which days are weekends, limit the chooser
 * to certain years, show only the current month, specify whether it should
 * highlight the current date; show a time selector in addition to the date,
 * use 24-hour time, and more.
 * 
 * It is also possible to specify certain dates that cannot be selected.
 * The <I3.DateChooser::getDateStatus> method will set certain dates as
 * being disabled.  See the method documentation for details.
 *
 * Credits:
 * 
 *   Written by Nathan Mellis (nathan@mellis.us).
 * 
 *   Based on `date-functions.js` and `datechooser.js`
 *     by Baron Schwartz (baron@sequent.org).
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
 *   $Id: date-chooser.js 102 2008-05-12 21:33:39Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: I3
 *
 * Common I3 Module
 */
@module I3;

// ---------------------------------------------------------------------------

/**
 * Class: I3.DateChooser
 *
 * Provides a common date chooser.  See file documentation for details.
 */
@class DateChooser {
  var DOC_ROOT = I3.ui.document;
  var _container;
  var _isPopup = false;
  var _isHidden = false;
  var _displayInPopup = false;
  var _currentDate;
  var _currentDateString;
  
  var TOOL_TIPS = {};
  TOOL_TIPS["INFO"]              = "About the calendar.";
  TOOL_TIPS["ABOUT"]             = "Date selection:\n" +
    "- Use the \xab, \xbb buttons to select year\n" +
    "- Use the " + String.fromCharCode(0x2039) + ", " + 
    String.fromCharCode(0x203a) + " buttons to select month\n" +
    "- Hold mouse button on any of the above buttons for faster selection.";
  TOOL_TIPS["ABOUT_TIME"]        = "\n\n" +
    "Time selection:\n" +
    "- Click on any of the time parts to increase it\n" +
    "- or Shift-click to decrease it\n" +
    "- or click and drag for faster selection.";
  TOOL_TIPS["PREV_YEAR"]         = "Previous Year.  Hold for menu.";
  TOOL_TIPS["PREV_MONTH"]        = "Previous Month.  Hold for menu.";
  TOOL_TIPS["GO_TO_TODAY"]       = "Go to Today";
  TOOL_TIPS["NEXT_MONTH"]        = "Next Month.  Hold for menu.";
  TOOL_TIPS["NEXT_YEAR"]         = "Next Year.  Hold for menu.";
  TOOL_TIPS["DRAG_TO_MOVE"]      = ""; //"Drag to Move";
  TOOL_TIPS["PART_TODAY"]        = " (today)";
  TOOL_TIPS["FIRST_DAY_OF_WEEK"] = "Display %s first.";
  TOOL_TIPS["CLOSE"]             = "Close";
  TOOL_TIPS["TIME_PART"]         = "(Shift-) Click or drag to change value.";
  TOOL_TIPS["TT_DATE_FORMAT"]    = "%a, %b %e";
  TOOL_TIPS["WK"]                = "wk";
  TOOL_TIPS["TIME"]              = "Time:";
  
  // Set text constants
  var TODAY_TEXT                 = "Today";
  var SELECT_DATE_TEXT           = "Select Date";
  
  var DATE_FORMAT                = "%d %b %Y";
  var TIME_FORMAT                = "%H:%M";
  
  // Setup navType constants
  var PREV_YEAR         = -2;
  var PREV_MONTH        = -1;
  var TODAY             = 0;
  var NEXT_MONTH        = 1;
  var NEXT_YEAR         = 2;
  var TIME_CHOOSER_PART = 50;
  var WEEKDAY_NAME      = 100;
  var CLOSE             = 200;
  var TITLE             = 300;
  var HELP              = 400;
  
  
  var _titleCell;
  var _prevYearButton;
  var _prevMonthButton;
  var _gotoTodayButton;
  var _nextMonthButton;
  var _nextYearButton;
  var _calendarBody;
  var _toolTipCell;
  var _monthsComboDiv;
  var _yearsComboDiv;
  
  var _timeout;
  var _currentDateCell;
  var _activeElement;
  var _highlightedMonth;
  var _activeMonth;
  var _highlightedYear;
  var _activeYear;
  
  var _dateWasClicked;
  
  var _hoursCell;
  var _minutesCell;
  var _ampmCell;
  
  // -------------------------------------------------------------------------
  // Group: API Properties
  // -------------------------------------------------------------------------
  
  /**
   * Method: getFirstDayOfWeek
   * Returns the integer specifying the first day of the week (0 through 6) 
   * (default = 0)
   *
   * Method: setFirstDayOfWeek
   * Sets the integer specifying the first day of the week (0 through 6)
   */
  @property firstDayOfWeek = 0;
  
  /**
   * Method: getWeekendDays
   * Returns a comma-delimited string specifying which days should constitute 
   * weekends (i.e. "0 6" for Saturday and Sunday) (default = "0 6").
   *
   * Method: setWeekendDays
   * Sets a comma-delimited string specifying which days should constitute 
   * weekends (i.e. "0 6" for Saturday and Sunday).
   */
  @property weekendDays = "0 6";
  
  /**
   * Method: getMinYear
   * Returns the earliest year that the calendar should display 
   * (default = 1970)
   *
   * Method: setMinYear
   * Sets the earliest year that the calendar should display
   */
  @property minYear = 1970;
  
  /**
   * Method: getMaxYear
   * Returns the latest year that the calendar should display 
   * (default = 2150)
   *
   * Method: setMaxYear
   * Sets the latest year that the calendar should display
   */
  @property maxYear = 2150;
  
  /**
   * Method: getShowOnlyCurrentMonth
   * Returns true if the calendar should only show days in the current month
   * (default = false)
   *
   * Method: setShowOnlyCurrentMonth
   * Sets true if the calendar should only show days in the current month
   */
  @property showOnlyCurrentMonth = false;
  
  /**
   * Method: getHighlightToday
   * Returns whether or not Today should be highlighted
   * (default = true)
   *
   * Method: setHighlightToday
   * Sets whether or not Today should be highlighted
   */
  @property highlightToday = true;
  
  /**
   * Method: getShowTimeSelector
   * Returns whether or not to show the time selector.  DO NOT USE.  This 
   * functionality is currently not working properly.
   * (default = false)
   *
   * Method: setShowTimeSelector
   * Sets whether or not to show the time selector.  DO NOT USE.  This 
   * functionality is currently not working properly.
   * (default = false)
   */
  @property showTimeSelector = false;
  
  /**
   * Method: getUse24HourTime
   * Returns whether or not to use 24 hour time representations
   * (default = false)
   *
   * Method: setUse24HourTime
   * Sets whether or not to use 24 hour time representations
   */
  @property use24HourTime = false;
  
  /**
   * Method: getDateFormat
   * Returns the format that a date will be returned in as a string.  Follows 
   * the standard UNIX date format string.
   *
   * Method: setDateFormat
   * Sets the format that a date will be returned in as a string.  Follows 
   * the standard UNIX date format string.
   */
  @property dateFormat;
  
  /**
   * Method: getToolTipDateFormat
   * Returns the format which Tool Tip dates are displayed in.  Follows 
   * the standard UNIX date format string.
   *
   * Method: setToolTipDateFormat
   * Sets the format which Tool Tip dates are displayed in.  Follows 
   * the standard UNIX date format string.
   */
  @property toolTipDateFormat = TOOL_TIPS["TT_DATE_FORMAT"];
  
  /**
   * Method: getInputElement
   * Returns the INPUT element that will hold the date string
   *
   * Method: setInputElement
   * Sets the INPUT element that will hold the date string
   */
  @property inputElement;
  

  /**
   * Method: onDateSelected
   * 
   * A user-supplied function that will be called when a date is selected.  
   * It takes a single argument that will be the date that was clicked.
   * 
   * Example:
   * (start example)
   *   var dateChooser = new I3.DateChooser();
   *   dateChooser.onDateSelected = function(theDate) {
   *     alert(theDate);
   *   }
   *   ...
   * (end example)
   */
  self.onDateSelected = new Function();
  
  /**
   * Method: onClose
   * 
   * A user-supplied function that will be called when the popup box is closed.
   * It takes a single argument that is the current <I3.DateChooser> object.
   */
  self.onClose = function() { self.hide() };
  
  /**
   * Method: getDateStatus
   * 
   * A user-supplied function that will take a <Date> object as an argument
   * and return true if the date should be enabled for selecting, and false
   * if it should be disabled.  It takes a single argument that is the date 
   * we are testing for.
   * 
   * Example:
   * (start example)
   * var dateChooser = new I3.DateChooser();
   * dateChooser.getDateStatus = function(theDate) {
   *   // Don't allow the user to select today
   *   var today = new Date();
   *   if (theDate == today) return false;
   *   else return true;
   * }
   * ...
   * (end example)
   */
  self.getDateStatus = new Function();
  
  
  // -------------------------------------------------------------------------
  // Group: API Methods
  // -------------------------------------------------------------------------
  
  /**
   * Method: setPosition
   *
   * Sets the position of the chooser if it is a popup.  It takes an `x` and 
   * a `y` argument.
   *
   * Parameters:
   *   x - the horizontal position
   *   y - the vertical position
   *   fixed - (optional) whether the position should be fixed or not.  Used 
   *           when the element is in a popup
   */
  @method setPosition(x, y, fixed) {
    if (fixed && fixed == true) {
      _container.style.position = "fixed";
    }
    else {
      _container.style.position = "absolute";
    }
    _container.style.left = parseInt(x) + "px";
    _container.style.top  = parseInt(y) + "px";
  }
  
  /**
   * Method: createElement
   *
   * Creates a new element and appends it to `parent`.  Can be overridden
   *
   * Parameters:
   *   elementName - the name of an HTML element to create
   *   parent - the HTML element that the new element will be appended to
   */
  @method createElement(elementName, parent) {
    var element = I3.ui.create(elementName);
    if (parent != null) parent.appendChild(element);
    return element;
  }
  
  /**
   * Method: setDate
   *
   * Sets the date that should be used as the starting date for the calendar.  
   * If `theDate` is not specified, the current date will be used.
   * 
   * Parameters:
   *   theDate - the date to be used as the initial date in the calendar.  If 
   *             not supplied, today will be used.
   */
  @method setDate(theDate) {
    if (theDate == null) {
      _currentDateString = null;
      return;
    }
    if (typeof theDate == "string") theDate = new Date(theDate);
    _currentDateString = theDate.toString();
  }
  
  /**
   * Method: create
   *
   * Creates the calendar and inserts it into the page.  If supplied a 
   * `container`, it will be static; otherwise it will be a popup that can be
   * shown by using <I3.DateChooser::show> and <I3.DateChooser::hide> along 
   * with <I3.DateChooser::setPosition>.  If it is supplied an INPUT element, 
   * then a calendar icon will be inserted next to the INPUT element that will 
   * handle the showing and hiding.
   *
   * Parameters:
   *   container - the container to display the calendar in. If one is not 
   *               supplied, it will be rendered as a popup.
   */
  @method create(container) {
    self._initialize(container);
  }
  
  /**
   * Method: show
   *
   * Shows the date chooser.
   */
  @method show() {
    // set the absolute position of the floating calendar to just below 
    // the input element
    var inputOffsets = I3.ui.getElementOffsets(_inputElement);
    self.setPosition(inputOffsets.left, inputOffsets.bottom + 1);
    
    // clear all the highlighted rows, cells, etc.
    var rows = 
      _container.getElementsByTagName("TABLE")[0].getElementsByTagName("TR");
    for (var i=0; i<rows.length; i++) {
      var row = rows[i];
      I3.ui.removeClassFromElement(row, "i3dateChooserHighlightedRow");
      var cells = row.getElementsByTagName("TD");
      for (var j=0; j<cells.length; j++) {
        var cell = cells[j];
        I3.ui.removeClassFromElement(cell, "i3dateChooserHighlighted");
        I3.ui.removeClassFromElement(cell, "i3dateChooserActive");
      }
    }
    
    _container.style.display = "block";
    _isHidden = false;
    if (_isPopup) {
      // attach key events
      false;
    }
  }
  
  /**
   * Method: hide
   *
   * Hides the date chooser.
   */
  @method hide() {
    if (_isPopup) {
      // detach key events
      false;
    }
    _container.style.display = "none";
    _isHidden = true;
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group: Internal Methods
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _initialize
   *
   * Called the object is initially created.  Sets up variables, etc.
   * 
   * Parameters:
   *   container - if set, specifies which element to put the date chooser in
   */
  @method _initialize(container) {
    // create the main container
    _container = I3.ui.create("DIV");
    
    // add the time component if the time selector is enabled
    if (!_dateFormat) {
      _dateFormat = DATE_FORMAT;
      if (_showTimeSelector) _dateFormat += " " + TIME_FORMAT;
    }
    
    // if _inputElement is specified, then setup a default onDateSelected
    if (_inputElement != null) {
      var onDateSelectedOld = self.onDateSelected;
      self.onDateSelected = function(theDate, dateWasClicked) {
        _inputElement.value = self.getFormattedDate(theDate, _dateFormat);
        if (dateWasClicked) self.hide();
        if (onDateSelectedOld) onDateSelectedOld(theDate);
      };
    
      if (container == null) {
        // we are using a popup calendar so we need to add the icon
        var iconSpan = I3.ui.create("SPAN");
        iconSpan.className = "i3dateChooserIconSpan";
        iconSpan.height = _inputElement.offsetHeight;
        iconSpan.onclick = self.show;
        
        var icon = I3.ui.create("IMG");
        icon.src = "/common/client-web/img/calendar.png";
        icon.width  = 16;
        icon.height = 16;
        iconSpan.appendChild(icon);
        
        if (_inputElement.nextSibling == null)
          _inputElement.parentNode.appendChild(iconSpan);
        else {
          if (_inputElement.nextSibling.className != "i3dateChooserIconSpan") {
            _inputElement.parentNode.insertBefore(
              iconSpan, _inputElement.nextSibling);
          }
          else {
            _inputElement.parentNode.replaceChild(
              iconSpan, _inputElement.nextSibling);
          }
        }
      }
    }
    
    self._render(container);
  }
  
  /**
   * Private Method: _render
   *
   * Creates all the elements and sets them in the page.  If supplied an 
   * argument, it will place it statically inside that element.  If no 
   * argument is provided, it will render it as a popup element.
   *
   * Parameters:
   *   container - (optional) the HTML element to put the chooser in
   */
  @method _render(parent) {
    if (parent == null) {
      _isPopup = true;
      parent = I3.ui.get("appletContent");
    }
    if (parent.constructor == String) parent = I3.ui.get(parent);
    
    if (_currentDateString) {
      _currentDate = new Date(_currentDateString);
      if (_inputElement) 
        _inputElement.value = self.getFormattedDate(_currentDate, _dateFormat);
    }
    else _currentDate = new Date();
    
    var container = _container;
    container.className = "i3dateChooser";
    if (_isPopup) {
      container.style.position = "absolute";
      container.style.display  = "none";
    }
    
    var table = I3.ui.create("TABLE");
    table.cellSpacing = 0;
    table.cellPadding = 0;
    I3.ui.addEventListener(table, "mousedown", self._onTableMouseDown);
    container.appendChild(table);
    
    var thead = self.createElement("THEAD", table);
    
    var row = self.createElement("TR", thead);
    var titleLength = 5;
    
    self._createCell(row, "?", 1, HELP).toolTip = TOOL_TIPS["INFO"];
    
    _titleCell = self._createCell(row, "", titleLength, TITLE);
    _titleCell.className = "i3dateChooserTitle";

    var closePopupButton = self._createCell(row, "&#x00d7;", 1, CLOSE);
    closePopupButton.toolTip = TOOL_TIPS["CLOSE"];

    if (_isPopup) {
      _titleCell.toolTip = TOOL_TIPS["DRAG_TO_MOVE"];
      //_titleCell.style.cursor = "move";
    }
    else {
      closePopupButton.style.visibility = "hidden";
    }
    
    row = self.createElement("TR", thead);
    row.className = "i3dateChooserHeaderRow";
    
    _prevYearButton = self._createCell(row, "&#x00ab;", 1, PREV_YEAR);
    _prevYearButton.toolTip = TOOL_TIPS["PREV_YEAR"];
    
    _prevMonthButton = 
      self._createCell(row, String.fromCharCode(0x2039), 1, PREV_MONTH);
    _prevMonthButton.toolTip = TOOL_TIPS["PREV_MONTH"];
    
    _gotoTodayButton = self._createCell(row, TODAY_TEXT, 3, TODAY);
    _gotoTodayButton.toolTip = TOOL_TIPS["GO_TO_TODAY"];
    
    _nextMonthButton = 
      self._createCell(row, String.fromCharCode(0x203a), 1, NEXT_MONTH);
    _nextMonthButton.toolTip = TOOL_TIPS["NEXT_MONTH"];

    _nextYearButton = self._createCell(row, "&#x00bb;", 1, NEXT_YEAR);
    _nextYearButton.toolTip = TOOL_TIPS["NEXT_YEAR"];
    
    // create row of week day names
    row = self.createElement("TR", thead);
    row.className = "i3dateChooserDayNames";
    for (var i=7; i > 0; --i) {
      cell = self.createElement("TD", row);
      if (!i) {
        cell.navType = WEEKDAY_NAME;
        self._addEventsToCell(cell);
      }
    }
    
    self._displayWeekdayHeader(row);
    
    // Setup the main table body
    var tbody = self.createElement("TBODY", table);
    _calendarBody = tbody;
    
    for (var i=0; i<6; i++) {
      row = self.createElement("TR", tbody);
      for (var j=0; j<7; j++) {
        cell = self.createElement("TD", row);
        self._addEventsToCell(cell);
      }
    }
    
    // Show the time selector
    if (_showTimeSelector) {
      row = self.createElement("TR", tbody);
      row.className = "i3dateChooserTimeSelector";
      
      cell = self.createElement("TD", row);
      cell.className = "i3dateChooserTimeSelector";
      cell.colSpan = 2;
      cell.appendChild(I3.ui.text(TOOL_TIPS["TIME"] || "&nbsp;"));
      
      cell = self.createElement("TD", row);
      cell.className = "i3dateChooserTimeSelector";
      cell.colSpan = 3;
      
      var hr       = _currentDate.getHours();
      var min      = _currentDate.getMinutes();
      var is12Hour = !_use24HourTime;
      var isPM     = hr > 12;
      
      if (is12Hour && isPM) hr -= 12;
      
      _hoursCell = self._createTimeChooserPart(cell, "i3dateChooserHour", hr, 
        is12Hour ? 1 : 0, is12Hour ? 12 : 23);
      
      var seperator = self.createElement("SPAN", cell);
      seperator.appendChild(I3.ui.text(":"));
      seperator.className = "i3dateChooserTimeSeperator";
      
      _minutesCell = self._createTimeChooserPart(cell, "i3dateChooserMinute", 
        min, 0, 59);
      
      cell = self.createElement("TD", row);
      cell.className = "i3dateChooserTimeSelector";
      cell.colSpan = 2;
      if (is12Hour) 
        _ampmCell = self._createTimeChooserPart(cell, "i3dateChooserAMPM", 
          isPM ? "pm" : "am", ["am", "pm"]);
      else cell.appendChild(I3.ui.text("&nbsp;"));
    }
    
    
    // Setup the footer
    var tfoot = self.createElement("TFOOT", table);
    row = self.createElement("TR", tfoot);
    row.className = "i3dateChooserFooter";
    
    cell = self._createCell(row, SELECT_DATE_TEXT, 7, TITLE);
    cell.className = "i3dateChooserToolTip";
    
    if (_isPopup) {
      //cell.toolTip = TOOL_TIPS["DRAG_TO_MOVE"];
      //cell.style.cursor = "move";
    }
    
    _toolTipCell = cell;
    
    // Create the Month and Year dropdown boxes
    var monthsDiv = self.createElement("DIV", container);
    _monthsComboDiv = monthsDiv;
    monthsDiv.className = "i3dateChooserCombo";
    for (var i=0; i<SHORT_MONTH_NAMES.length; i++) {
      var div = self.createElement("DIV");
      div.className = "i3dateChooserComboItem";
      div.monthIndex = i;
      div.appendChild(I3.ui.text(SHORT_MONTH_NAMES[i]));
      monthsDiv.appendChild(div);
    }
    
    var yearsDiv = self.createElement("DIV", container);
    _yearsComboDiv = yearsDiv;
    yearsDiv.className = "i3dateChooserCombo";
    for (var i=0; i<12; i++) {
      var div = self.createElement("DIV");
      div.className = "i3dateChooserComboItem";
      yearsDiv.appendChild(div);
    }
    
    // Fill the calendar with the appropriate dates
    self._fillCalendarData(_currentDate);
    
    // Append the Date Chooser to the document
    parent.appendChild(container);
  }
  
  /**
   * Private Method: _fillCalendarData
   *
   * Fills the calendar with the appropriate dates, etc.
   *
   * Parameters:
   *   theDate - a Date object that represents the currently selected date
   */
  @method _fillCalendarData(theDate) {
    var now = new Date();
    nYear   = now.getFullYear();
    nMonth  = now.getMonth();
    nDate   = now.getDate();
    
    _container.style.visibility = "hidden";
    
    var year = theDate.getFullYear();
    if (year < _minYear) { year = _minYear; theDate.setFullYear(_minYear); }
    if (year > _maxYear) { year = _maxYear; theDate.setFullYear(_maxYear); }
    
    _currentDate = new Date(theDate);
    var month = theDate.getMonth();
    var dayOfMonth = theDate.getDate();
    var monthDays = self.getDaysInMonth(month);
    
    // Compute the first day that should be shown
    theDate.setDate(1);
    var firstDay = (theDate.getDay() - _firstDayOfWeek) % 7;
    if (firstDay < 0) firstDay += 7;
    theDate.setDate(-firstDay);
    theDate.setDate(theDate.getDate() + 1);
    
    // Display the day numbers in their cells
    var row = _calendarBody.firstChild;
    var monthName = SHORT_MONTH_NAMES[month];
    
    for (var i=0; i<6; i++, row = row.nextSibling) {
      var cell = row.firstChild;
      row.className = "i3dateChooserDayRow";
      var hasDaysToShow = false;
      var dayIndex;
      
      for (var j=0; j<7; j++, theDate.setDate(dayIndex + 1), 
                         cell = cell.nextSibling) {
        I3.ui.clear(cell);
        dayIndex = theDate.getDate();
        var dayOfWeek = theDate.getDay();
        cell.className = "i3dateChooserDayCell";
        var isCurrentMonth = theDate.getMonth() == month;
        if (!isCurrentMonth) {
          if (!_showOnlyCurrentMonth) {
            cell.className += " i3dateChooserAdjacentMonth";
            cell.isAdjacentMonth = true;
          }
          else {
            cell.className = "i3dateChooserEmptyCell";
            cell.appendChild(I3.ui.text("&nbsp;"));
            cell.disabled = true;
            continue;
          }
        }
        else {
          cell.isAdjacentMonth = false;
          hasDaysToShow = true;
        }
        
        cell.disabled = false;
        cell.appendChild(I3.ui.text(dayIndex));
        
        if (!cell.disabled) {
          cell.date = new Date(theDate);
          cell.toolTip = "_";
          if (isCurrentMonth && dayIndex == dayOfMonth && _highlightToday) {
            cell.className += " i3dateChooserSelected";
            _currentDateCell = cell;
          }
          if (theDate.getFullYear() == nYear && 
              theDate.getMonth() == nMonth && 
              dayIndex == nDate) {
            cell.className += " i3dateChooserToday";
            cell.toolTip += TOOL_TIPS["PART_TODAY"];
          }
          if (_weekendDays.indexOf(dayOfWeek.toString()) != -1) {
            cell.className += 
              cell.isAdjacentMonth ? " i3dateChooserAdjacentMonthWeekend" : 
                                     " i3dateChooserWeekend";
          }
        }
      }
      
      if (!(hasDaysToShow || !_showOnlyCurrentMonth))
        row.className = "i3dateChooserEmptyRow";
    }
    
    I3.ui.clear(_titleCell);
    _titleCell.appendChild(I3.ui.text(
      LONG_MONTH_NAMES[month] + ", " + year));
    self._onSetTime();
    _container.style.visibility = "visible";
  }
  
  /**
   * Private Method: _displayWeekdayHeader
   *
   * Fills in the header bar with the names of the days of the week
   *
   * Parameters:
   *   container - the row containing the header table cells
   */
  @method _displayWeekdayHeader(container) {
    var cell = container.firstChild;
    
    for (var i=0; i<7; ++i) {
      cell.className = "i3dateChooserDayCell i3dateChooserDayNameCell";
      var todayIndex = (i + _firstDayOfWeek) % 7;
      if (i) {
        cell.toolTip = TOOL_TIPS["FIRST_DAY_OF_WEEK"].replace(
          "%s", LONG_DAY_NAMES[todayIndex]);
        cell.navType = WEEKDAY_NAME;
//        self._addEventsToCell(cell);
      }
      
      // Add styles for weekends if applicable
      if (_weekendDays.indexOf(todayIndex.toString()) != -1) {
        I3.ui.addClassToElement(cell, "i3dateChooserWeekend");
      }
      
      cell.appendChild(I3.ui.text(SHORT_DAY_NAMES[todayIndex]));
      cell = cell.nextSibling;
    }
  }
  
  /**
   * Private Method: _showMonthsCombo
   *
   * Shows the months combo element so the user can pick a month from the 
   * drop down list
   */
  @method _showMonthsCombo() {
    var activeElement = _activeElement;
    var container     = _monthsComboDiv;
    
    if (_highlightedMonth) I3.ui.removeClassFromElement(_highlightedMonth, 
      "i3dateChooserHighlighted");
    if (_activeMonth) I3.ui.removeClassFromElement(_activeMonth, 
      "i3dateChooserActive");
    
    var div = container.getElementsByTagName("DIV")[_currentDate.getMonth()];
    I3.ui.addClassToElement(div, "i3dateChooserActive");
    _activeMonth = div;
    
    container.style.display = "block";
    if (activeElement.navType < TODAY)
      container.style.left = activeElement.offsetLeft + "px";
    else
      container.style.left = (activeElement.offsetLeft + 
        activeElement.offsetWidth - container.offsetWidth) + "px";
    
    container.style.top = 
      (activeElement.offsetTop + activeElement.offsetHeight) + "px";
  }
  
  /**
   * Private Method: _showYearsCombo
   *
   * Shows the years combo element so the user can pick a year from the 
   * drop down list
   */
  @method _showYearsCombo(forward) {
    var activeElement = _activeElement;
    var container     = _yearsComboDiv;
    var forward = activeElement.navType > TODAY ? true : false;
    
    if (_highlightedYear) I3.ui.removeClassFromElement(_highlightedYear, 
      "i3dateChooserHighlighted");
    if (_activeYear) I3.ui.removeClassFromElement(_activeYear, 
      "i3dateChooserActive");
    
    _activeYear = null;
    var year = _currentDate.getFullYear() + (forward ? 1 : -1);
    var div = container.firstChild;
    var shouldShow = false;
    
    for (var i=12; i>0; --i) {
      if (year >= _minYear && year <= _maxYear) {
        div.innerHTML = year;
        div.year = year;
        div.style.display = "block";
        shouldShow = true;
      }
      else {
        div.style.display = "none";
      }
      div = div.nextSibling;
      year += forward ? 1 : -1;
    }
    
    if (shouldShow) {
      container.style.display = "block";
      if (activeElement.navType < TODAY)
        container.style.left = activeElement.offsetLeft + "px";
      else
        container.style.left = (activeElement.offsetLeft + 
          activeElement.offsetWidth - container.offsetWidth) + "px";
      
      container.style.top = (activeElement.offsetTop + 
        activeElement.offsetHeight) + "px";
    }
  }
  
  /**
   * Private Method: _hideCombos
   *
   * Hides both combo boxes.
   */
  @method _hideCombos() {
    _monthsComboDiv.style.display = "none";
    _yearsComboDiv.style.display  = "none";
  }
  
  /**
   * Private Method: _createCell
   *
   * Creates and sets up a table cell
   *
   * Parameters:
   *   element - description
   *   text - description
   *   colSpan - description
   *   navType - description
   */
  @method _createCell(element, text, colSpan, navType) {
    var cell = self.createElement("TD", element);
    cell.colSpan = colSpan;
    cell.className = "i3dateChooserButton";
    
    if (navType != TODAY && Math.abs(navType) <= NEXT_YEAR) 
      cell.className += " i3dateChooserNav";
    
    self._addEventsToCell(cell);
    cell.navType = navType;
    cell.innerHTML = "<div unselectable='on'>" + text + "</div>";
    
    return cell;
  }
  
  /**
   * Private Method: _createTimeChooserPart
   *
   * Creates an element for the time chooser
   *
   * Parameters:
   *   container - description
   *   className - description
   *   currentValue - description
   *   rangeStart - description
   *   rangeEnd - description
   */
  @method _createTimeChooserPart(container, className, currentValue, 
                                 rangeStart, rangeEnd) {
    var part = self.createElement("SPAN", container);
    part.className = className;
    part.innerHTML = currentValue;
    part.toolTip = TOOL_TIPS["TIME_PART"];
    part.navType = TIME_CHOOSER_PART;
    part.range = [];
    if (typeof rangeStart != "number") part.range = rangeStart;
    else {
      for (var i=rangeStart; i<=rangeEnd; i++) {
        var value;
        if (i < 10 && rangeEnd >= 10) value = "0" + i;
        else value = i.toString();
        part.range.push(value);
      }
    }
    
    self._addEventsToCell(part);
    return part;
  }
  
  /**
   * Private Method: _addEventsToCell
   *
   * Adds a set of standard events to the table cells
   *
   * Parameters:
   *   element - description
   */
  @method _addEventsToCell(element) {
    I3.ui.addEventListener(element, "mouseover", self._onDayMouseOver);
    I3.ui.addEventListener(element, "mousedown", self._onDayMouseDown);
    I3.ui.addEventListener(element, "mouseout", self._onDayMouseOut);
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group: Event Handlers
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _onDayMouseOver
   *
   * Event handler for when the mouse moves over an element
   *
   * Parameters:
   *   e - the event args
   */
  @method _onDayMouseOver(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "TD")
      element = I3.ui.getParentWithTagName("TD", element);
    
    // remove 'null' here and replace it with whatever Calendar._C is
    if (self._isRelated(element, e) || null || element.disabled)
      return false;
    
    if (element.toolTip) {
      if (element.toolTip.substr(0,1) == "_") element.toolTip = 
        self.getFormattedDate(element.date, _toolTipDateFormat) + 
          element.toolTip.substr(1);
      
      _toolTipCell.innerHTML = element.toolTip;
    }
    
    if (element.navType != TITLE) {
      I3.ui.addClassToElement(element, "i3dateChooserHighlighted");
      if (element.date) I3.ui.addClassToElement(element.parentNode, 
        "i3dateChooserHighlightedRow");
    }
    
    return self._stopEvent(e);
  }
  
  /**
   * Private Method: _onDayMouseOut
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onDayMouseOut(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "TD")
      element = I3.ui.getParentWithTagName("TD", element);
    
    // Replace 'null' with whatever Calendar._C does
    if (self._isRelated(element, e) || null || element.disabled) return false;
    I3.ui.removeClassFromElement(element, "i3dateChooserHighlighted");
    if (element.date) I3.ui.removeClassFromElement(element.parentNode, 
      "i3dateChooserHighlightedRow");
    
    _toolTipCell.innerHTML = SELECT_DATE_TEXT;
    
    return self._stopEvent(e);
  }
  
  /**
   * Private Method: _onDayMouseDown
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onDayMouseDown(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "TD")
      element = I3.ui.getParentWithTagName("TD", element);
    if (element.disabled) return false;
    _activeElement = element;
    
    if (element.navType != TITLE) {
      if (element.navType == TIME_CHOOSER_PART) {
        element._current = element.innerHTML;
        I3.ui.addEventListener(DOC_ROOT, "mousemove", self._onTableMouseOver);
      }
      else {
        I3.ui.addEventListener(DOC_ROOT, "mouseover", self._onTableMouseOver);
      }
      
      I3.ui.addClassToElement(element, 
        "i3dateChooserHighlighted i3dateChooserActive");
      
      I3.ui.addEventListener(DOC_ROOT, "mouseup", self._onTableMouseUp);
    }
    else if (_isPopup) {
      self._onDragStart(e);
    }
    
    if (element.navType == PREV_MONTH || element.navType == NEXT_MONTH) {
      if (_timeout) clearTimeout(_timeout);
      _timeout = setTimeout(self._showMonthsCombo, 250);
    }
    else if (element.navType == PREV_YEAR || element.navType == NEXT_YEAR) {
      if (_timeout) clearTimeout(_timeout);
      _timeout = setTimeout(self._showYearsCombo, 250);
    }
    else _timeout = null;
    
    return self._stopEvent(e);
  }
  
  /**
   * Private Method: _onTableMouseDown
   *
   * Description of method
   *
   * Parameters:
   *   e - the event args
   */
  @method _onTableMouseDown(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    var initialElement = new Object(element);
    if (initialElement.tagName != "TD")
      initialElement = I3.ui.getParentWithTagName("TD", initialElement);
    
    // if (initialElement == element)
    //   return self._stopEvent(e);
  }
  
  /**
   * Private Method: _onTableMouseOver
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onTableMouseOver(e) {
    e = I3.ui.getEvent(e);
    var element = _activeElement;
    var target  = e.getTarget();
    if (target == element || target.parentNode == element) {
      I3.ui.addClassToElement(element, 
        "i3dateChooserHighlighted i3dateChooserActive");
      I3.ui.addClassToElement(element.parentNode, 
        "i3dateChooserHighlightedRow");
    }
    else {
      if (element.navType == null || (element.navType != TIME_CHOOSER_PART && 
            (element.navType == TODAY || Math.abs(element.navType) > NEXT_YEAR))) {
        I3.ui.removeClassFromElement(element, "i3dateChooserActive");
      }
      I3.ui.removeClassFromElement(element, "i3dateChooserHighlighted");
      I3.ui.removeClassFromElement(element.parentNode, 
        "i3dateChooserHighlightedRow");
    }
    
    if (element.navType == TIME_CHOOSER_PART && target != element) {
      var position = self._getAbsolutePosition(element);
      var width = element.offsetWidth;
      var x = e.clientX;
      var deltaX;
      var shouldDecrease = true;
      if (x > position.x + width) {
        deltaX = x - position.x - width;
        shouldDecrease = false;
      }
      else deltaX = position.x - x;
      
      if (deltaX < 0) deltaX = 0;
      var range   = element.range;
      var current = element._current;
      var count = Math.floor(deltaX / 10) % range.length;
      var i;
      for (i=0; i<range.length; i++) {
        if (range[i] == current) break;
      }
      while (count-- > 0) {
        if (shouldDecrease) {
          if (--i < 0) i = range.length - 1;
        }
        else if (++i >= range.length) i = 0;
      }
      
      var newValue = range[i];
      element.innerHTML = newValue;
      
      self._onUpdateTime();
    }
    
    var month = self._getMonthFromElement(target);
    if (month) {
      if (month.monthIndex != _currentDate.getMonth()) {
        if (_highlightedMonth) I3.ui.removeClassFromElement(
          _highlightedMonth, "i3dateChooserHighlighted");
        I3.ui.addClassToElement(month, "i3dateChooserHighlighted");
        _highlightedMonth = month;
      }
      else if (_highlightedMonth) I3.ui.removeClassFromElement(
        _highlightedMonth, "i3dateChooserHighlighted");
    }
    else {
      if (_highlightedMonth) I3.ui.removeClassFromElement(
        _highlightedMonth, "i3dateChooserHighlighted");
      var year = self._getYearFromElement(target);
      if (year) {
        if (year.year != _currentDate.getFullYear()) {
          if (_highlightedYear) I3.ui.removeClassFromElement(
            _highlightedYear, "i3dateChooserHighlighted");
          I3.ui.addClassToElement(year, "i3dateChooserHighlighted");
          _highlightedYear = year;
        }
        else if (_highlightedYear) I3.ui.removeClassFromElement(
          _highlightedYear, "i3dateChooserHighlighted");
      }
      else if (_highlightedYear) I3.ui.removeClassFromElement(
        _highlightedYear, "i3dateChooserHighlighted");
    }
    
    return self._stopEvent(e);
  }
  
  /**
   * Private Method: _onTableMouseUp
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onTableMouseUp(e) {
    e = I3.ui.getEvent(e);
    if (_timeout) clearTimeout(_timeout);
    var element = _activeElement;
    if (!element) return false;
    var target = e.getTarget();
    I3.ui.removeClassFromElement(element, "i3dateChooserActive");
    if (target == element || target.parentNode == element)
      self._onCellClick(element, e);
    
    var month = self._getMonthFromElement(target);
    var date;
    if (month) {
      date = new Date(_currentDate);
      if (month.monthIndex != date.getMonth()) {
        date.setMonth(month.monthIndex);
        self._setCurrentDate(date);
        _dateWasClicked = false;
        self.onDateSelected(_currentDate, _dateWasClicked);
      }
    }
    else {
      var year = self._getYearFromElement(target);
      if (year) {
        date = new Date(_currentDate);
        if (year.year != date.getFullYear()) {
          date.setFullYear(year.year);
          self._setCurrentDate(date);
          _dateWasClicked = false;
          self.onDateSelected(_currentDate, _dateWasClicked);
        }
      }
    }
    
    I3.ui.removeEventListener(DOC_ROOT, "mouseup", self._onTableMouseUp);
    I3.ui.removeEventListener(DOC_ROOT, "mouseover", self._onTableMouseOver);
    I3.ui.removeEventListener(DOC_ROOT, "mousemove", self._onTableMouseOver);
    
    self._hideCombos();
    
    return self._stopEvent(e);
  }
  
  /**
   * Private Method: _onCellClick
   *
   * Description of method
   *
   * Parameters:
   *   element - description
   *   e - description
   */
  @method _onCellClick(element, e) {
    var shouldClose = false;
    var isNewDate = false;
    var date = null;
    if (element.navType == null) {
      if (_currentDateCell) {
        I3.ui.removeClassFromElement(_currentDateCell, "i3dateChooserSelected");
        I3.ui.addClassToElement(element, "i3dateChooserSelected");
        shouldClose = _currentDateCell == element;
        if (!shouldClose) _currentDateCell = element;
      }
      
      self.setDatePartOnly(_currentDate, element.date);
      date = _currentDate;
      var isAdjacentMonth = !(_dateWasClicked = !element.isAdjacentMonth);
      if (!isAdjacentMonth && !_currentDateCell)
        // TODO: Toggle selecting multiple dates
        false;
      else isNewDate = !element.disabled;

      // A date was clicked
      if (isAdjacentMonth) self._fillCalendarData(date);
    }
    else {
      // If the close button is clicked...
      if (element.navType == CLOSE) {
        I3.ui.removeClassFromElement(element, "i3dateChooserHighlighted");
        self._closeDateChooser();
        return;
      }
      
      date = new Date(_currentDate);
      if (element.navType == TODAY) self.setDatePartOnly(date, new Date());
      _dateWasClicked = false;
      var year = date.getFullYear();
      var month = date.getMonth();
      
      switch (element.navType) {
        // Help
        case HELP:
          I3.ui.removeClassFromElement(element, "i3dateChooserHighlighted");
          var helpText = TOOL_TIPS["ABOUT"];
          if (_showTimeSelector) helpText += TOOL_TIPS["ABOUT_TIME"];
          alert(helpText);
          return;
        
        // Previous year
        case PREV_YEAR:
          if (year > _minYear) date.setFullYear(year - 1);
          break;
        
        // Previous month
        case PREV_MONTH:
          if (month > 0) self.setMonthForDate(date, month - 1);
          else if (year-- > _minYear) {
            date.setFullYear(year);
            self.setMonthForDate(date, 11);
          }
          break;
        
        // Next month
        case NEXT_MONTH:
          if (month < 11) self.setMonthForDate(date, month + 1);
          else if (year < _maxYear) {
            date.setFullYear(year + 1);
            self.setMonthForDate(date, 0);
          }
          break;
        
        // Next year
        case NEXT_YEAR:
          if (year < _maxYear) date.setFullYear(year + 1);
          break;
        
        // Sets first day of week.  Not currently enabled
        case WEEKDAY_NAME:
          break;
        
        // Set the time
        case TIME_CHOOSER_PART:
          var range = element.range;
          var current = element.innerHTML;
          for (var i=range.length; --i >= 0;)
            if (range[i] == current) break;
          if (e && e.shiftKey) {
            if (--i < 0) i = range.length - 1;
          }
          else if (++i >= range.length) i = 0;
          var newValue = range[i];
          element.innerHTML = newValue;
          self._onUpdateTime();
          return;
        
        // ?
        case TODAY:
          if (self.getDateStatus(date)) return false;
          break;
      }
      
      if (!self._datesAreEqual(date, _currentDate)) {
        self._setCurrentDate(date);
        isNewDate = true;
      }
      else if (element.navType == TODAY) {
        isNewDate = true;
        shouldClose = true;
      }
    }
    
    if (isNewDate) {
      if (e) self.onDateSelected(_currentDate, _dateWasClicked);
    }
    
    if (shouldClose) {
      I3.ui.removeClassFromElement(element, "i3dateChooserHighlighted");
      if (e) self._closeDateChooser();
    }
  }
  
  /**
   * Private Method: _onDragStart
   *
   * Called when a drag event starts
   *
   * Parameters:
   *   e - the event args
   */
  @method _onDragStart(e) {
    // body...
  }
  
  /**
   * Private Method: _onSetTime
   *
   * Event that is called when the time is set
   *
   * Parameters:
   *   e - description
   */
  @method _onSetTime(e) {
    if (!_showTimeSelector) return;
    
    var isPM;
    var hours = _currentDate.getHours();
    var minutes = _currentDate.getMinutes();
    if (!_use24HourTime) {
      isPM = hours >= 12;
      if (isPM) hours -= 12;
      if (hours == 0) hours = 12;
      _ampmCell.innerHTML = isPM ? "pm" : "am";
    }
    _hoursCell.innerHTML = hours < 10 ? "0" + hours : hours;
    _minutesCell.innerHTML = minutes < 10 ? "0" + minutes : minutes;
  }
  
  /**
   * Private Method: _onUpdateTime
   *
   * Event that is called when the time is changed
   *
   * Parameters:
   *   e - description
   */
  @method _onUpdateTime(e) {
    var currentDate = _currentDate;
    var hour = parseInt(_hoursCell.innerHTML, 10);
    var minute = parseInt(_minutesCell.innerHTML, 10);
    if (!_use24HourTime) {
      if (/pm/i.test(_ampmCell.innerHTML) && hour < 12) hour += 12;
      else if (/am/i.test(_ampmCell.innerHTML) && hour == 12) hour = 0;
    }
    
    var date = currentDate.getDate();
    var month = currentDate.getMonth();
    var year = currentDate.getFullYear();

    currentDate.setHours(hour);
    currentDate.setMinutes(minute);
    currentDate.setFullYear(year);
    currentDate.setMonth(month);
    currentDate.setDate(date);
    _dateWasClicked = false;
    self.onDateSelected(currentDate, _dateWasClicked);
  }
  
  /**
   * Private Method: _isRelated
   *
   * Returns a boolean signifying whether or not the event and the element 
   * are related
   *
   * Parameters:
   *   element - the element to test for
   *   e - the event
   */
  @method _isRelated(element, e) {
    var related = e.relatedTarget;
    if (!related) {
      var type = e.type;
      if (type == "mouseover") related = e.fromElement;
      else if (type == "mouseout") related = e.toElement;
    }
    while (related) {
      if (related == element) return true;
      related = related.parentNode;
    }
    return false;
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group: Utility Functions
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _closeDateChooser
   *
   * Closes date chooser by hiding the popup
   */
  @method _closeDateChooser() {
    if (self.onClose) self.onClose(self);
  }
  
  /**
   * Private Method: _setCurrentDate
   *
   * Sets the _currentDate value for the class
   * 
   * Parameters:
   *   theDate - the date to set _currentDate to
   */
  @method _setCurrentDate(theDate) {
    if (!self._datesAreEqual(theDate, _currentDate))
      self._fillCalendarData(theDate);
  }
  
  /**
   * Private Method: _datesAreEqual
   *
   * Returns true if the dates are the same
   *
   * Parameters:
   *   theDate1 - description
   *   theDate2 - description
   */
  @method _datesAreEqual(theDate1, theDate2) {
    return ((theDate1.getFullYear() == theDate2.getFullYear()) && 
            (theDate1.getMonth()    == theDate2.getMonth()) && 
            (theDate1.getDate()     == theDate2.getDate()) && 
            (theDate1.getHours()    == theDate2.getHours()) && 
            (theDate1.getMinutes()  == theDate2.getMinutes()));
  }
  
  /**
   * Private Method: _getMonthFromElement
   *
   * Returns the month index from a combo item element
   *
   * Parameters:
   *   element - description
   */
  @method _getMonthFromElement(element) {
    if (typeof element.monthIndex != "undefined") 
      return element;
    else if (typeof element.parentNode.monthIndex != "undefined")
      return element.parentNode;
    
    return null;
  }
  
  /**
   * Private Method: _getYearFromElement
   *
   * Returns the year from a combo item element
   *
   * Parameters:
   *   element - description
   */
  @method _getYearFromElement(element) {
    if (typeof element.year != "undefined") 
      return element;
    else if (typeof element.parentNode.year != "undefined")
      return element.parentNode;
    
    return null;
  }
  
  /**
   * Private Method: _stopEvent
   *
   * A cross browser way to prevent events from propogating
   *
   * Parameters:
   *   e - the event
   */
  @method _stopEvent(e) {
    return e.stopEvent();
  }
  
  /**
   * Private Method: _getAbsolutePosition
   *
   * Returns the absolute position of an element
   *
   * Parameters:
   *   element - the element to find the position for
   */
  @method _getAbsolutePosition(element) {
    var scrollLeft = 0;
    var scrollTop  = 0;
    var isDiv = /^div$/i.test(element.tagName);
    if (isDiv && element.scrollLeft) scrollLeft = element.scrollLeft;
    if (isDiv && element.scrollTop)  scrollTop  = element.scrollTop;
    
    var position = {
      x: element.offsetLeft - scrollLeft, 
      y: element.offsetTop  - scrollTop
    };
    
    if (element.offsetParent) {
      var parentOffset = self._getAbsolutePosition(element.offsetParent);
      position.x += parentOffset.x;
      position.y += parentOffset.y;
    }
    
    return position;
  }
  
  
  // -------------------------------------------------------------------------
  // Group: Additional Date Functions & Properties
  // -------------------------------------------------------------------------
  
  // set constants for time lengths
  var SECOND = 1000;
  var MINUTE = SECOND * 60;
  var HOUR   = MINUTE * 60;
  var DAY    = HOUR * 24;
  var WEEK   = DAY * 7;
  
  var FIRST_WEEKDAY = 0;
  
  var DAYS_IN_MONTH = new Array(31,28,31,30,31,30,31,31,30,31,30,31);
  
  var LONG_DAY_NAMES = new Array("Sunday", "Monday", "Tuesday", "Wednesday", 
    "Thursday", "Friday", "Saturday");
  var SHORT_DAY_NAMES = 
    new Array("Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat");
  
  var LONG_MONTH_NAMES = new Array("January", "February", "March", "April", 
    "May", "June", "July", "August", "September", "October", "November", 
    "December");
  var SHORT_MONTH_NAMES = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
  
  /**
   * Method: getDaysInMonth
   *
   * Returns the number of days that are in the given month.  Allows for 
   * leap years.
   *
   * Parameters:
   *   month - the zero-based integer of the month to look up.
   *           (e.g. 0 = January, 1 = February, etc.)
   * 
   * Returns:
   *   An integer that specifies how many days are in that month (e.g. 31)
   */
  @method getDaysInMonth(month) {
    if (month == null) return null;
    
    var year = (new Date()).getFullYear();
    
    // If this is a leap year and the month asked for is February, then 
    // return 29, otherwise return the standard result
    if (month == 1 && 
       (year % 4 == 0) && ((year % 100 != 0) || (year % 400 == 0)))
      return 29;
    else
      return DAYS_IN_MONTH[month];
    
  }
  
  /**
   * Method: getDayOfYear
   *
   * Returns the day of the year for a given date
   *
   * Parameters:
   *   theDate - a Date object
   */
  @method getDayOfYear(theDate) {
    if (theDate.constructor != Date) return null;
    
    var now = new Date(
      theDate.getFullYear(), theDate.getMonth(), theDate.getDate(), 0, 0, 0);
    var then = new Date(theDate.getFullYear(), 0, 0, 0, 0, 0);
    var diff = now - then;
    
    return Math.floor(diff / DAY);
  }
  
  /**
   * Method: setDatePartOnly
   *
   * Sets the date parts of `oldDate` set to what is supplied 
   * by `newDate`
   *
   * Parameters:
   *   oldDate - description
   *   newDate - description
   */
  @method setDatePartOnly(oldDate, newDate) {
    oldDate.setDate(1);
    oldDate.setFullYear(newDate.getFullYear());
    oldDate.setMonth(newDate.getMonth());
    oldDate.setDate(newDate.getDate());
    return oldDate;
  }
  
  /**
   * Method: setMonthForDate
   *
   * Sets the month for the given date
   *
   * Parameters:
   *   theDate - description
   *   month - description
   */
  @method setMonthForDate(theDate, month) {
    var day = theDate.getDate();
    var max = self.getDaysInMonth(month);
    if (day > max) theDate.setDate(max);
    theDate.setMonth(month);
    return theDate;
  }
  
  /**
   * Method: getFormattedDate
   *
   * Returns a string representing the supplied date in the given format.
   *
   * Parameters:
   *   theDate - a Date object
   *   formatString - a standard date formatting string
   */
  @method getFormattedDate(theDate, formatString) {
    var month     = theDate.getMonth();
    var day       = theDate.getDate();
    var year      = theDate.getFullYear();
    var dayOfWeek = theDate.getDay();
    var dOY       = self.getDayOfYear(theDate); // the day of the year
    var hour      = theDate.getHours();
    var minute    = theDate.getMinutes();
    var second    = theDate.getSeconds();
    var isPM      = hour >= 12;
    var hour12    = hour - 12 == 0 ? hour - 12 : 12;
    
    var map   = {};
    map["%a"] = SHORT_DAY_NAMES[dayOfWeek];
    map["%A"] = LONG_DAY_NAMES[dayOfWeek];
    map["%b"] = SHORT_MONTH_NAMES[month];
    map["%B"] = LONG_MONTH_NAMES[month];
//  map["%c"] = locale date with time
    map["%C"] = 1 + Math.floor(year / 100);
    map["%d"] = day < 10 ? ("0" + day) : day;
    map["%e"] = day;
//  map["%D"] = American Date Style: %m/%d/%y
//  map["%E"]
//  map["%F"]
//  map["%G"]
//  map["%g"]
//  map["%h"]
    map["%H"] = hour < 10 ? ("0" + hour) : hour;
    map["%I"] = hour12 < 10 ? ("0" + hour12) : hour12;
    map["%j"] = dOY < 100 ? (dOY < 10 ? ("00" + dOY) : ("0" + dOY)) : dOY;
    map["%k"] = hour;
    map["%l"] = hour12;
    map["%m"] = month < 9 ? ("0" + (month + 1)) : (month + 1);
    map["%M"] = minute < 10 ? ("0" + minute) : minute;
    map["%n"] = "\n";
    map["%p"] = isPM ? "PM" : "AM";
    map["%P"] = isPM ? "pm" : "am";
//  map["%r"] = time in 12hr notation: %I:%M:%S %p
//  map["%R"] = time in 24hr notation: %H:%M
    map["%s"] = Math.floor(theDate.getTime() / 1000);
    map["%S"] = second < 10 ? ("0" + second) : second;
    map["%t"] = "\t";
//  map["%T"] = time in 24hr notation: %H:%M:%S
//  map["%U"] = week number
    map["%u"] = dayOfWeek + 1;
    map["%w"] = dayOfWeek;
//  map["%x"] = locale date without time
//  map["%X"] = locale time wihtout date
    map["%y"] = ("" + year).substr(2,2);
    map["%Y"] = year;
    map["%%"] = "%";
    
    var pattern = /%./g;
    
    return formatString.replace(pattern, function(ptrn) {
      return map[ptrn] || ptrn; });
  }
}