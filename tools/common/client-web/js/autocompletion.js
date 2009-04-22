/**
 * Script: common/client-web/js/autocompletion
 * 
 * Extends a text box to autocomplete entries from a list.
 * 
 * *Overview*
 * 
 * This file defines several classes that make it possible to extend a
 * text box so that it automatically suggests completions for the user's
 * text as the user types in the box.  This is particularly useful for cases
 * when input needs to be limited to certain values, but there are too many
 * options to use an HTML `select` element.  For example, one common use of
 * the suggest box is to allow the user to start typing someone's name and
 * get a drop-down list of all names that start with the typed characters.
 * It is also useful in text boxes where input may not be required to match
 * a list, but a completion list may speed up the user's typing.
 * 
 * There are two pieces involved in adding this functionality: the *view*,
 * which is responsible for handling input and rendering the suggestions,
 * and the *model*, which provides the list of completions for a given
 * set of input.
 * 
 * *The Suggest View*
 * 
 * The view is managed by the <I3.AutocompleteView> class.  Using the view takes
 * (at minimum) two steps:
 * 
 *   o  Tell it which text box to watch for input.
 *   o  Tell it where to get the data that will be used for completions.
 * 
 * The first step -- providing the text box to watch -- is performed when
 * you create an instance of <I3.AutocompleteView>.  You'll supply it with a
 * reference to an `input` element that the view can "own" -- that is, one
 * that it can modify at will.
 * 
 * The second step is performed by calling <I3.AutocompleteView::setModel> and
 * supplying a suggest model object to the view.
 * 
 * *Model classes*
 * 
 * A suggest model class is any class that includes a method called `match`
 * that takes two arguments: a `matchString` to autocomplete, and an
 * `onResponse` handler.  When the model has assembled the set of matches
 * to be displayed, it should call the handler, passing it an array of
 * match objects.  Each match object must have a `name` field, and optionally
 * an `alt` field that provides additional data about the match.
 * 
 * While you can easily create your own suggest model classes, a couple of
 * general-use model classes are included.  These classes implement the
 * `match` method for common cases.
 * 
 * The first model class provided is <I3.ArrayAutocompleteModel>.  When you create
 * an instance of this, you provide an array of JavaScript objects, each of
 * which must have a `name` and `alt` field.  When the user types into the
 * suggest view, results that have either `name` or `alt` values that start
 * with the typed text will be provided as matches.
 * 
 * The second model class is <I3.WebServiceAutocompleteModel>.  This enables use
 * of a web service to provide the auto-complete list.  The web service that
 * is called should be a subclass of <I3::SuggestionServlet>.  See the
 * documentation for <common/data/include/suggestion> for details.
 * 
 * *PersonAutocompleteView*
 * 
 * A custom model/view combination is included for the specific case of
 * auto-completing name and e-mail address combinations.  Instead of
 * supplying a single `input` element, two input elements are provided
 * when creating the view: one for the name field and one for the e-mail
 * address field.  Both will be auto-completed when a match is found
 * for either.
 * 
 * Credits:
 * 
 *   Written by Nathan Mellis (nathan@mellis.us).
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
 *   $Id: autocompletion.js 22 2007-12-12 23:26:00Z melfstrand $
 */

// ---------------------------------------------------------------------------

/**
 * Module: I3
 *
 */
@module I3;

// ---------------------------------------------------------------------------

/**
 * Class: I3.AutocompleteView
 *
 * Attaches to an `input` element to provide an auto-complete list
 * when the user types into the element.
 */
@class AutocompleteView() {
  
  // Constants
  var DOC_ROOT = I3.ui.get("appletContent");
  var TIMEOUT  = 500;
  var Z_INDEX  = 300;
  
  // HTML elements
  var _input;                   // the INPUT element that triggers the process
  var _container;               // the floating container for the suggestions
  var _loadingSpan;             // the loading message
  
  // variables
  var _matches = [];
  var _currentSuggestionMatch;
  // var _currentInputValue;
  
  // event variables
  var _matchTimer;
  
  // tracker variables
  var _index = -1;
  var _highlightedSuggestionRow;
  var _suggestionRows;
  
  
  
  // -------------------------------------------------------------------------
  // Group: Properties
  // -------------------------------------------------------------------------
  
  /**
   * Method: getModel
   * Returns the model used to get suggestions for the typed text
   *
   * Method: setModel
   * Sets the model used to get suggestions for the typed text
   */
  @property model;
  
  /**
   * Method: getPrompt
   * Returns the prompt to use for this element when empty to describe what 
   * kind of data it contains.
   *
   */
  @propertyReader prompt = "";
  
  /**
   * Method: setShowAltField
   * Sets whether or not to show the `alt` field in the suggestion list
   */
  @propertyWriter showAltField = true;
  
  
  // -------------------------------------------------------------------------
  // Group: Public Event Handlers
  // -------------------------------------------------------------------------
  
  /**
   * Event Handler: onAutocomplete
   * User-pluggable event handler to execute instance-specific code whenever 
   * a suggestion is made.  Takes a `text` and (optional) `value` parameter.
   */
  self.onAutocomplete = new Function();
  
  
  // -------------------------------------------------------------------------
  // Group: API Methods
  // -------------------------------------------------------------------------
  
  /**
   * Method: attachToInputElement
   *
   * Attaches this view to an input element which will handle the events, etc.
   *
   * Parameters:
   *   element - an HTML INPUT DOM element to attach to; can also be a string 
   *             with the ID of the element to use
   */
  @method attachToInputElement(element) {
    if (typeof element == "string") element = I3.ui.get(element);
    _input = element;
    _input.autocomplete = "off";
    
    // attach the event listeners the INPUT element
    I3.ui.addEventListener(_input, "blur", self._onBlurHandler);
    I3.ui.addEventListener(_input, "focus", self._onFocusHandler);
    I3.ui.addEventListener(_input, "keyup", self._onKeyUpHandler);
    I3.ui.addEventListener(_input, "keydown", self._onKeyDownHandler);
    I3.ui.addEventListener(_input, "click", self._onClickHandler);
    
    // Set the prompt if it's available
    if (_prompt && _prompt != "") {
      I3.ui.addClassToElement(_input, "suggestionEmpty");
      _input.value = _prompt;
    }
    
    // position the suggestion container properly
    self._positionContainer();
  }
  
  /**
   * Method: setPrompt
   *
   * Sets the prompt to use for this element when empty to describe what 
   * kind of data it contains.
   * 
   * Parameters:
   *   prompt - a string to use for the prompt when the element is empty
   */
  @method setPrompt(prompt) {
    _prompt = prompt;
    if (_input && _input.value == "" && _prompt != "") {
      I3.ui.addClassToElement(_input, "suggestionEmpty");
      _input.value = _prompt;
    }
  }
  
  /**
   * Method: reset
   *
   * Resets the suggest box back to the initial state
   */
  @method reset() {
    _input.value = _prompt;
    I3.ui.addClassToElement(_input, "suggestionEmpty");
  }
  
  /**
   * Method: setIsEmpty
   *
   * Allows one to manually set whether the box is styled as empty or not
   *
   * Parameters:
   *   bool - `true` if the box should be styled as empty; false otherwise
   */
  @method setIsEmpty(bool) {
    if (bool) {
      I3.ui.addClassToElement(_input, "suggestionEmpty");
    }
    else {
      I3.ui.removeClassFromElement(_input, "suggestionEmpty");
    }
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group: Internal Methods
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _initialize
   *
   * This function handles all the inital setup and configuration.  It creates
   * the div that the suggestions will be going in and formats it (such as 
   * making it invisible).  It also configures the event handlers for the 
   * input box and turns off autocomplete since we will be handling our own.
   */
  @method _initialize() {
    
    // create and attach a loading notice
    _loadingSpan = I3.ui.create("DIV");
    _loadingSpan.style.zIndex = Z_INDEX;
    _loadingSpan.style.position = "absolute";
    _loadingSpan.style.visibility = "hidden";
    _loadingSpan.innerHTML = "<img src='/$theme/client-web/img/working.gif' />";
    DOC_ROOT.appendChild(_loadingSpan);
    
    // create and attach the suggestion div
    _container = I3.ui.create("DIV");
    _container.style.border          = "#000000 1px solid";
    _container.style.zIndex          = Z_INDEX;
    _container.style.padding         = "0";
    _container.style.visibility      = "hidden";
    _container.style.position        = "absolute";
    _container.style.backgroundColor = "white";
    
    // append the floating suggestion container to the document
    DOC_ROOT.appendChild(_container);
    
    // append the styles needed for the class to the default stylesheet
    self._setStylesForClass(_container);
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group:  Event Handlers
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _onKeyUpHandler
   *
   * Handles the keyup event
   *
   * Parameters:
   *   e - the event information
   */
  @method _onKeyUpHandler(e) {
    e = I3.ui.getEvent(e);
    var keyCode = e.getKeyCode();
    
    // _currentInputValue = _input.value;
    if (_matchTimer) clearTimeout(_matchTimer);
    
    if (_input.value == "") {
      self._hideLoadingNotice();
      self._hideSuggestions();
      // self.onAutocomplete({ text: "", alt: "" });
      return;
    }
    
    // If the key that was pressed was a word-key, then do a search for a 
    // match, otherwise process the special keys
    // Key code 8 = Backspace
    if (/\w/i.test(String.fromCharCode(keyCode)) || keyCode == 8) {
      self._showLoadingNotice();
      _matchTimer = setTimeout(self._onMatchDelayComplete, TIMEOUT);
      // only gets called if using IE?
      // if (_input.createTextRange && e.getTarget() == _input && 
      //     self._getSelectionStart(_input) == 0 && 
      //     self._getSelectionLength(_input) == 0) {
      //   self._setSelection(_input);
      //   e.stopEvent();
      // }
    }
  }
  
  /**
   * Private Method: _onKeyDownHandler
   *
   * Handles the keydown event.  Checks to see if any special keys are 
   * pressed and handles them appropriately.
   * 
   * Parameters:
   *   e - the event info
   */
  @method _onKeyDownHandler(e) {
    e = I3.ui.getEvent(e);
    var keyCode = e.getKeyCode();
    switch (keyCode) {
      case 9:  // Tab
        if (_currentSuggestionMatch) {
          self._selectSuggestion(_currentSuggestionMatch);
        }
        break;
        
      case 13: // Enter
        if (_currentSuggestionMatch) {
          self._selectSuggestion(_currentSuggestionMatch);
        }
        e.stopEvent();
        break;
      
      case 27:  // Escape
        _currentSuggestionMatch = null;
        _index = -1;
        self._hideSuggestions();
        e.stopEvent();
        break;
    
      case 38: // Up Arrow
        self._highlightSuggestion(_index - 1);
        break;
      case 40: // Down Arrow
        self._highlightSuggestion(_index + 1);
        break;
    }
  }
  
  /**
   * Private Method: _onMatchDelayComplete
   *
   * Called after the delay has finished for searching
   */
  @method _onMatchDelayComplete() {
    clearTimeout(_matchTimer);
    _model.match(_input.value, self._processSuggestions);
    // _input.focus();
  }
  
  /**
   * Private Method: _onClickHandler
   *
   * Called when the input box is clicked.  Shows the suggestions if there 
   * are any and the container is hidden.
   *
   * Parameters:
   *   e - the event information
   */
  @method _onClickHandler(e) {
    if (_matches.length > 1) self._showSuggestions();
  }
  
  /**
   * Private Method: _onBlurHandler
   *
   * Handles the blur event
   *
   * Parameters:
   *   e - the event information
   */
  @method _onBlurHandler(e) {
    self._hideSuggestions();
    if (_input.value == "" && _prompt != "") {
      I3.ui.addClassToElement(_input, "suggestionEmpty");
      _input.value = _prompt;
    }
  }
  
  /**
   * Private Method: _onFocusHandler
   *
   * Handles the focus event
   *
   * Parameters:
   *   e - the event information
   */
  @method _onFocusHandler(e) {
    I3.ui.removeClassFromElement(_input, "suggestionEmpty");
    if (_input.value == _prompt) _input.value = "";
  }
  
  /**
   * Private Method: _onSuggestionMouseDown
   *
   * Description of method
   * 
   * Parameters:
   *   e - the event information
   */
  @method _onSuggestionMouseDown(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "TR") 
      element = I3.ui.getParentWithTagName("TR", element);
      
    _index = element.suggestionRowIndex;
    _currentSuggestionMatch = _matches[_index];
    self._selectSuggestion(_currentSuggestionMatch);
    setTimeout(function() { _input.focus() }, 10);
  }
  
  /**
   * Private Method: _onSuggestionMouseOver
   *
   * MouseOver event handler for a suggestion entry.  It will take the 
   * previously selected item and change its class to normal, then set itself 
   * to highlighted.
   * 
   * Parameters:
   *   e - the event information
   */
  @method _onSuggestionMouseOver(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "TR") 
      element = I3.ui.getParentWithTagName("TR", element);
      
    if (_highlightedSuggestionRow) {
      _highlightedSuggestionRow.className = "suggestionRow";
    }
    element.className = "selectedSuggestionRow";
  }
  
  /**
   * Private Method: _onSuggestionMouseOut
   *
   * MouseOut method for a suggestion entry.  Changes its class back to normal
   * when the mouse leaves the row.
   * 
   * Parameters:
   *   e - the event information
   */
  @method _onSuggestionMouseOut(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "TR") 
      element = I3.ui.getParentWithTagName("TR", element);
      
    element.className = "suggestionRow";
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group:  Processing Functions
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _processSuggestions
   *
   * Called when a list of suggestions is received.
   * 
   * Parameters:
   *   matches - an array of suggestions
   */
  @method _processSuggestions(matches) {
    self._hideLoadingNotice();
    _matches = matches;
    
    if (self._renderSuggestions())
      self._showSuggestions();
    else
      self._hideSuggestions();
    
    self._handleInput();
  }
  
  /**
   * Private Method: _handleInput
   *
   * Description of method
   */
  @method _handleInput() {
    var foundMatch = false;
    var matchIsText = false;
    var matchIsValue = false;
    _index = -1;

    var rows = _container.getElementsByTagName("TR");
    var rowCount = rows.length;
    _suggestionRows = rows;

    // var i;
    // for (i=0; i<rowCount; i++) {
    //   // find the first row where the first part of the suggestion is the 
    //   // first part of the suggestion row
    //   if (_matches[i].text.toUpperCase().indexOf(
    //       _currentInputValue.toUpperCase()) == 0) {
    //     foundMatch = true;
    //     matchIsText = true;
    //     break;
    //   }
    //   if (self._getAltValue(_matches[i].alt).toUpperCase().indexOf(
    //       _currentInputValue.toUpperCase()) == 0) {
    //     foundMatch = true;
    //     matchIsValue = true;
    //     break;
    //   }
    // }
    // if (foundMatch) _index = i;
    // 
    // // set styles for each of the rows
    // for (var i=0; i<rowCount; i++) {
    //   rows.item(i).className = "suggestionRow";
    // }
    // 
    // if (_index > -1)
    //   _highlightedSuggestionRow = rows.item(_index);
    // else
    //   _highlightedSuggestionRow = null;
    // 
    // if (_highlightedSuggestionRow) {
    //   _highlightedSuggestionRow.className = "selectedSuggestionRow";
    // 
    //   if (_matches[_index].text != _input.value) {
    //     if (_input.value != _currentInputValue) return;
    //     
    //     if (_input.createTextRange || _input.setSelectionRange) {
    //       self._selectSuggestion(_matches[_index]);
    //     }
    //     if (_input.createTextRange) {
    //       var range = _input.createTextRange();
    //       range.moveStart("character", _currentInputValue.length);
    //       range.select();
    //     }
    //     else if (_input.setSelectionRange)
    //       _input.setSelectionRange(
    //         _currentInputValue.length, _input.value.length);
    //   }
    // }
    // else {
    //   _index = -1;
    // }
  }
  
  /**
   * Private Method: _selectSuggestion
   *
   * Fills in _input with the text of the current suggestion
   *
   * Parameters:
   *   match - the suggestion being chosen
   */
  @method _selectSuggestion(match) {
    _input.value = match.text;
    self.onAutocomplete(match);
    self._hideSuggestions();
    if (_currentSuggestionMatch) _currentSuggestionMatch = null;
  }

  
  // -------------------------------------------------------------------------
  // Private Group:  Show/Hide Functions
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _showLoadingNotice
   *
   * Shows a loading notice
   */
  @method _showLoadingNotice() {
    var o = I3.ui.getElementOffsets(_input);
    _loadingSpan.style.zIndex = Z_INDEX;
    _loadingSpan.style.left = (o.right - _loadingSpan.offsetWidth) + "px";
    _loadingSpan.style.top  = o.top + "px";
    _loadingSpan.style.visibility = "visible";
  }
  
  /**
   * Private Method: _hideLoadingNotice
   *
   * Hides the loading notice
   */
  @method _hideLoadingNotice() {
    _loadingSpan.style.visibility = "hidden";
  }
  
  /**
   * Private Method: _showSuggestions
   *
   * Resizes the DIV that holds the suggestions and then displays it.
   */
  @method _showSuggestions() {
    self._positionContainer();
    _container.style.visibility = "visible";
  }
  
  /**
   * Private Method: _hideSuggestions
   *
   * Hides the DIV that contains all the selections.
   */
  @method _hideSuggestions() {
    _container.style.visibility = "hidden";
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group:  Display Functions
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _positionContainer
   *
   * Sets the size and location of the suggestion div
   */
  @method _positionContainer() {
    if (_container) {
      var inputOffsets = I3.ui.getElementOffsets(_input);
      _container.style.left = inputOffsets.left + "px";
      _container.style.top  = inputOffsets.bottom + "px";
    }
  }

  /**
   * Private Method: _renderSuggestions
   *
   * This handles the displaying of the suggestions in the div that has been 
   * created for them.  It also sets the mouse events and styling for the 
   * suggestions.
   */
  @method _renderSuggestions() {
    var container = I3.ui.clear(_container);
    
    var suggestionCount = _matches.length;
    if (suggestionCount > 0) {
      
      var table = I3.ui.create("TABLE");
      table.style.width = self._calculateContainerWidth() + "px";
    
      for (var i=0; i<suggestionCount; i++) {
        var row = table.insertRow(-1);
        row.className = "suggestionRow";
        row.suggestionRowIndex = i;
        // set mouse events
        I3.ui.addEventListener(row, "mousedown", self._onSuggestionMouseDown);
        I3.ui.addEventListener(row, "mouseover", self._onSuggestionMouseOver);
        I3.ui.addEventListener(row, "mouseout", self._onSuggestionMouseOut);
    
        var suggestionName = row.insertCell(-1);
        suggestionName.style.cursor = "default";
        suggestionName.innerHTML = _matches[i].text;
        suggestionName.className = "suggestionName";
      
        if (_showAltField) {
          var suggestionValue = row.insertCell(-1);
          suggestionValue.style.cursor = "default";
          suggestionValue.innerHTML = self._getAltValue(_matches[i].alt);
          suggestionValue.className = "suggestionValue";
        }
      
      }
      
      container.appendChild(table);
      
      // if (suggestionCount == 1) return false;
      return true;
    }
    else
      return false;
  }
  
  /**
   * Private Method: _highlightSuggestion
   *
   * Description of method
   *
   * Parameters:
   *   index - description
   */
  @method _highlightSuggestion(index) {
    if (!_suggestionRows || _matches.length <= 0) return;
    
    // prevent selecting a selection higher than the choices available
    if (index >= _matches.length) index = _matches.length - 1;
    
    if (index < 0) {
      _index = -1;
      _currentSuggestionMatch = null;
      // _input.focus();
      return;
    }

    // _currentInputValue = _matches[index].text;
    // self._selectSuggestion(_matches[index]);

    if (_index >= 0 && index != _index) {
      if (_highlightedSuggestionRow)
        _highlightedSuggestionRow.className = "suggestionRow";
      _currentSuggestionMatch = null;
      _index = -1;
    }
    
    _index = index;
    _highlightedSuggestionRow = _suggestionRows.item(index);
    _highlightedSuggestionRow.className = "selectedSuggestionRow";
    _currentSuggestionMatch = _matches[index];
    // _currentInputValue = _matches[_index].text;
    // self._selectSuggestion(_matches[index]);

    // showing the suggestion div
    self._showSuggestions();
  }
  
  /**
   * Private Method: _calculateContainerWidth
   *
   * Calculates what the width of the result div should be
   */
  @method _calculateContainerWidth() {
    if (!I3.browser.isIE())
      return _input.offsetWidth - 1 * 2;
    else
      return _input.offsetWidth;
  }
  
  /**
   * Private Method: _getAltValue
   *
   * Returns the value of the `alt` field allowing for hashes
   *
   * Parameters:
   *   alt - the value passed as the `alt` field in a match
   */
  @method _getAltValue(alt) {
    if (alt) {
      if (alt.constructor == String) return alt;
      return alt[_model.getAltKey()];
    }
    else return "";
  }
  
  
  // -------------------------------------------------------------------------
  // Private Group:  CSS Functions
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _setStylesForClass
   *
   * Description of method
   *
   * Parameters:
   *   element - description
   */
  @method _setStylesForClass(element) {
    var suggestionContainer = 
      "font-size: 13px; " + 
      "font-family: arial,sans-serif; ";
    var suggestionTable = 
      "border-collapse: collapse;";
    var suggestionRow =  
      "background-color: white; " + 
      "white-space: nowrap; " + 
      "padding: 4px;";
    var selectedSuggestionRow =  
      "background-color: #3366CC; " + 
      "color: white ! important; " + 
      "white-space: nowrap; " + 
      "padding: 4px;";
    var suggestionName = 
      "font-weight: normal;";
    var suggestionValue = 
      "font-size: 10px; " + 
      "text-align: right; " + 
      "color: #C0C0C0; ";
    var suggestionEmpty = 
      "color: #CCCCCC;";
    
    self._addStyleToStylesheet(".suggestionContainer", suggestionContainer);
    self._addStyleToStylesheet(".suggestionContainer TABLE", suggestionTable);
    self._addStyleToStylesheet(".suggestionRow *", suggestionRow);
    self._addStyleToStylesheet(".selectedSuggestionRow *", selectedSuggestionRow);
    self._addStyleToStylesheet(".suggestionName", suggestionName);
    self._addStyleToStylesheet(".suggestionValue", suggestionValue);
    self._addStyleToStylesheet(".suggestionEmpty", suggestionEmpty);
    
    element.className = "suggestionContainer";
  }

  /**
   * Private Method: _addStyleToStylesheet
   *
   * Description of method
   *
   * Parameters:
   *   name - description
   *   value - description
   */
  @method _addStyleToStylesheet(name, value) {
    var stylesheet = I3.ui.document.styleSheets[0];

    if (stylesheet.addRule) stylesheet.addRule(name, value);
    else if (stylesheet.insertRule) {
      stylesheet.insertRule(name + "{"+value+"}", stylesheet.cssRules.length);
    }
  }


  // -------------------------------------------------------------------------
  // Private Group:  Text Selection Functions
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _getSelectionLength
   *
   * Returns the selection length in the input box
   *
   * Parameters:
   *   element - description
   */
  @method _getSelectionLength(element) {
    var result = -1;

    // check to see if we are using IE or Mozilla
    if (element.createTextRange) {
      var range = I3.ui.document.selection.createRange().duplicate();
      result = range.text.length;
    }
    else if (element.setSelectionRange) {
      result = element.selectionEnd - element.selectionStart;
    }
    
    return result;
  }

  /**
   * Private Method: _getSelectionStart
   *
   * Returns the starting point of the selection
   *
   * Parameters:
   *   element - description
   */
  @method _getSelectionStart(element) {
    var result = 0;
    if (element.createTextRange) {
      var range = I3.ui.document.selection.createRange().duplicate();
      range.moveEnd("textedit", 1);
      result = element.value.length - range.text.length;
    }
    else if (element.setSelectionRange) {
      result = element.selectionStart
    }
    else
      result = -1;
      
    return result;
  }

  /**
   * Private Method: _setSelection
   *
   * Sets the selection in the input box
   *
   * Parameters:
   *   element - description
   */
  @method _setSelection(element) {
    if (element.createTextRange) {
      var range = element.createTextRange();
      range.moveStart("character", element.value.length);
      range.select();
    }
    else if (element.setSelectionRange)
      element.setSelectionRange(element.value.length, element.value.length);
  }
  
  self._initialize();
}

// ===========================================================================

/**
 * Class: I3.ArrayAutocompleteModel
 *
 * Implements the `match` method for the common case of displaying
 * an array of JavaScript objects.  See file documentation for details.
 * 
 * Parameters:
 *   data - an array of objects with a 'text' and (optionally) 'alt' key
 */
@class ArrayAutocompleteModel(data) {
  
  var _data;
  
  /**
   * Method: getAltKey
   * Returns the Hash key to use for `alt` if `alt` is a Hash
   *
   * Method: setAltKey
   * Sets the Hash key to use for `alt` if `alt` is a Hash
   */
  @property altKey = "id";
  
  /**
   * Method: initialize
   *
   * Initializes the object
   *
   * Parameters:
   *   data - the array of data that we will match from
   */
  @method initialize(data) {
    _data = data;
  }
  
  /**
   * Method: match
   *
   * Description of method
   *
   * Parameters:
   *   matchString - a string to match suggestions for
   *   onResponse - the handler method to call when the matches are ready
   */
  @method match(matchString, onResponse) {
    var matches = [];
    var pattern = new RegExp("^" + matchString, "i");
    for (var i=0; i<_data.length; i++) {
      if (pattern.test(_data[i].text) || pattern.test(_data[i].alt)) {
        var match = {};
        match.text = _data[i].text;
        match.alt  = _data[i].alt;
        matches.push(match);
      }
    }
    
    matches.sort(self._sortFunctionForMatches);
    _matches = matches;
    if (onResponse) onResponse(matches);
    return matches;
  }
  
  /**
   * Private Method: _sortFunctionForMatches
   *
   * Sorts matches based on their `text` attribute
   *
   * Parameters:
   *   a - the first item
   *   b - the second item
   */
  @method _sortFunctionForMatches(a,b) {
    if (a.text < b.text) return -1;
    else if (a.text > b.text) return 1;
    else return 0;
  }
  
  self.initialize(data);
}

// ===========================================================================

/**
 * Class: I3.WebServiceAutocompleteModel
 *
 * Implements the `match` method for the common case of displaying
 * matches from a web service.  See file documentation for details.
 *
 * Parameters:
 *   uri - the path of the web service
 */
@class WebServiceAutocompleteModel(uri) {
  
  var _handler;
  
  /**
   * Method: getUri
   * Returns the URI of the web service
   */
  @propertyReader uri;
  
  /**
   * Method: getAltKey
   * Returns the Hash key to use for `alt` if `alt` is a Hash
   *
   * Method: setAltKey
   * Sets the Hash key to use for `alt` if `alt` is a Hash
   */
  @property altKey = "id";
  
  /**
   * Private Method: _initialize
   *
   * Initializes the model
   *
   * Parameters:
   *   uri - the path of the web service
   */
  @method _initialize(uri) {
    _uri = uri;
    if (_uri.charAt(_uri.length - 1) == "/") _uri = _uri.slice(0,-1);
  }
  
  /**
   * Method: match
   *
   * Description of method
   *
   * Parameters:
   *   str - a string to match suggestions for
   *   onResponse - the handler method to call when the matches are ready
   */
  @method match(str, onResponse) {
    _handler = onResponse;
    var path = self.getUri() + "?q=" + str;
    if (_altKey) path += "&altKey=" + _altKey;
    I3.client.getObject(path, self._onSuggestResponse);
  }
  
  /**
   * Private Method: _onSuggestResponse
   *
   * Called when the data has been received from the web service.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the array of matches
   */
  @method _onSuggestResponse(response) {
    if (response.isOK()) {
      _handler(response.getObject());
    }
  }
  
  self._initialize(uri);
}

// ===========================================================================

/**
 * Class: I3.PersonAutocompleteView
 *
 * Implements a specific kind of AutocompleteView for people.
 */
@class PersonAutocompleteView() {
  
  var _nameView;
  var _emailView;
  
  /**
   * Method: getNameElement
   * Returns the INPUT element that contains the person's name
   */
  @propertyReader nameElement;
  
  /**
   * Method: getEmailElement
   * Returns the INPUT element that contains the person's email address
   */
  @propertyReader emailElement;
  
  /**
   * Method: getNamePrompt
   * Returns the prompt that is placed in the name field when it is empty.
   *
   * Method: setNamePrompt
   * Sets the prompt that is placed in the name field when it is empty.
   */
  @property namePrompt = "Name";
  
  /**
   * Method: getEmailPrompt
   * Returns the prompt that is placed in the email field when it is empty.
   *
   * Method: setEmailPrompt
   * Sets the prompt that is placed in the email field when it is empty.
   */
  @property emailPrompt = "E-Mail Address";
  
  /**
   * Private Method: _initialize
   *
   * Initializes the view
   */
  @method _initialize() {
    
  }
  
  /**
   * Method: setNameElement
   *
   * Sets the element to be used for the person's name
   *
   * Parameters:
   *   element - the HTML INPUT element to use for the person's name; can 
   *             also be a string for the ID of the element
   */
  @method setNameElement(element) {
    if (typeof element == "string") element = I3.ui.get(element);
    _nameElement = element;
    _nameElement.autocompleteView = self;
  }
  
  /**
   * Method: setEmailElement
   *
   * Sets the element to be used for the person's email
   *
   * Parameters:
   *   element - the HTML INPUT element to use for the person's email; can 
   *             also be a string for the ID of the element
   */
  @method setEmailElement(element) {
    if (typeof element == "string") element = I3.ui.get(element);
    _emailElement = element;
    _emailElement.autocompleteView = self;
  }
  
  /**
   * Method: display
   *
   * Sets the views after all properties have been set.
   */
  @method display() {
    var nameModel = new I3.WebServiceAutocompleteModel(
      "/common/data/suggestions/people/by-name");
    var emailModel = new I3.WebServiceAutocompleteModel(
      "/common/data/suggestions/people/by-email");

    _nameView = new I3.AutocompleteView();
    _nameView.setModel(nameModel);
    _nameView.setPrompt(_namePrompt);
    _nameView.attachToInputElement(_nameElement);
    _nameView.onAutocomplete = self.onAutocompleteName;
    
    _emailView = new I3.AutocompleteView();
    _emailView.setModel(emailModel);
    _emailView.setPrompt(_emailPrompt);
    _emailView.attachToInputElement(_emailElement);
    _emailView.onAutocomplete = self.onAutocompleteEmail;
  }

  /**
   * Method: onAutocompleteName
   *
   * Called when a suggestion is made for the owner name field.  It will set 
   * the email field with the `alt` value so that the two are always in sync.
   *
   * Parameters:
   *   suggestion - the current suggestion
   */
  @method onAutocompleteName(suggestion) {
    if (suggestion.alt != "") {
      _emailView.setIsEmpty(false);
      _emailElement.value = suggestion.alt;
    }
  }

  /**
   * Method: onAutocompleteEmail
   *
   * Called when a suggestion is made for the owner email field.  It will set 
   * the name field with the `alt` value so that the two are always in sync.
   *
   * Parameters:
   *   suggestion - the current suggestion
   */
  @method onAutocompleteEmail(suggestion) {
    if (suggestion.alt != "") {
      _nameView.setIsEmpty(false);
      _nameElement.value = suggestion.alt;
    }
  }
  
  /**
   * Method: reset
   *
   * Resets the fields back to their initial state
   */
  @method reset() {
    _nameView.reset();
    _emailView.reset();
  }
  
  /**
   * Method: setIsEmpty
   *
   * Allows one to manually set whether the boxes are styled as empty or not
   *
   * Parameters:
   *   bool - `true` if the boxes should be styled as empty; false otherwise
   */
  @method setIsEmpty(bool) {
    _nameView.setIsEmpty(bool);
    _emailView.setIsEmpty(bool);
  }
  
  /**
   * Method: isValid
   *
   * Validates the contents of the boxes.  Returns true if everything is 
   * valid; false otherwise.
   */
  @method isValid() {
    var value = _emailElement.value;
    if (value != "" && value != _emailPrompt && 
        I3.util.isValidEmailAddress(value))
    {
      return true;
    }
    else return false;
  }

  self._initialize();
}