/**
 * Script: search/client-web/js/index
 *
 * Place an overview of what the applet does here.
 *
 * Credits:
 * 
 *   Written by Nathan Mellis.
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
 *   $Id: index.js 97 2008-04-15 15:46:54Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Search
 *
 * The module containing all Search the Intranet classes and data.
 */
@module Search;

// ---------------------------------------------------------------------------

/**
 * Class: Search.IndexApplet
 *
 * Place a brief description of how the applet works here.
 */
@class IndexApplet {
  
  var _currentPath;
  var _tools;
  var _searchableToolNames;
  
  var _searchTerms;
  var _searchButton;
  var _searchOptions;
  var _showHideOptionsLink;
  var _loadingSearchResults;
  var _searchResults;
  
  var SHOW_OPTIONS_TEXT = "Show Options";
  var HIDE_OPTIONS_TEXT = "Hide Options";
  
  var SHOW_SECTION_TEXT = "Show Section";
  var HIDE_SECTION_TEXT = "Hide Section";
  
  var SHOW_ADDITIONAL_ROWS = "Show Additional Results";
  var HIDE_ADDITIONAL_ROWS = "Hide Additional Results";
  
  var DEFAULT_RESULT_LIMIT = 5;

  /**
   * Method: initialize
   *
   * Initializes the Index applet.
   */
  @method initialize() {
    _searchTerms          = I3.ui.get("search-searchTerms");
    _searchButton         = I3.ui.get("search-searchButton");
    _searchOptions        = I3.ui.get("search-searchOptions");
    _loadingSearchResults = I3.ui.get("search-loadingSearchResults");
    _searchResults        = I3.ui.get("search-searchResults");
    
    // Set up event handlers
    I3.ui.addEventListener(_searchTerms, "keydown", self.performSearch);
    I3.ui.addEventListener(_searchButton, "click", self.performSearch);
    
    // Set up links
    _showHideOptionsLink = I3.ui.createActionLink(
      SHOW_OPTIONS_TEXT, null, "Toggle:Options", self.toggleOptions)
    I3.ui.clear("search-showHideOptionsLink").appendChild(_showHideOptionsLink);

    _tools = I3.config.getTools();
    _searchableToolNames = [];
    for (var key in _tools) if (_tools[key].is_searchable) _searchableToolNames.push(key);
    _searchableToolNames.sort();
  }

  /**
   * Method: loadPath
   *
   * Loads the data for the given path.
   *
   * Parameters:
   *   path - the path to load
   */
  @method loadPath(path) {
    
    _currentPath = path;
    
    // Add this tool's entry to the navigation bar.
    I3.navbar.addToPath("Search the Intranet");
    
    var query         = path.match(/.+?.*q=([^&]+)/);
    var excludedTools = self._extractExcludedToolListFromURL(path);
    self.displayToolList(excludedTools);

    if (query) {
      var searchTerms = decodeURIComponent(query[1]);
      _searchTerms.value = searchTerms;
      _showHideOptionsLink.innerHTML = SHOW_OPTIONS_TEXT;
      I3.ui.hide(_searchOptions);
      self.loadSearchResults(searchTerms, excludedTools);
    }
    else {
      // Show the options and place focus on the search box.
      I3.ui.hide(_loadingSearchResults);
      I3.ui.hide(_searchResults);
      _showHideOptionsLink.innerHTML = HIDE_OPTIONS_TEXT;
      I3.ui.show(_searchOptions);
    }
    
    _searchTerms.focus();
  }
  
  /**
   * Method: loadSearchResults
   *
   * Loads the search results from the web service.
   *
   * Parameters:
   *   terms - the search terms
   */
  @method loadSearchResults(terms, excludedTools) {
    var url = "/search/data/search/?q=" + encodeURIComponent(terms);
    url += self._buildExcludedToolURLString(excludedTools);
    
    I3.ui.hide(_searchResults);
    I3.ui.show(_loadingSearchResults);
    I3.client.getObject(url, self.onLoadSearchResults);
  }
  
  /**
   * Method: onLoadSearchResults
   *
   * Response handler for <loadSearchResults>.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> object
   */
  @method onLoadSearchResults(response) {
    I3.ui.hide(_loadingSearchResults);
    if (response.isOK()) {
      self.displaySearchResults(response.getObject());
      I3.ui.show(_searchResults);
    }
  }
  
  /**
   * Method: displaySearchResults
   *
   * Displays the search results.  Sorts by tool.
   *
   * Parameters:
   *   results - description
   */
  @method displaySearchResults(results) {
    var container = I3.ui.clear(_searchResults);
    
    var tools = [];
    var documents;
    for (var tool in results) tools.push(tool);
    tools.sort(function(a,b) {
      var toolA = _tools[a].name;
      var toolB = _tools[b].name;
      if (toolA < toolB) return -1;
      if (toolA > toolB) return 1;
      return 0;
    });
    
    if (tools.length > 0) {
      for (var i = 0; i < tools.length; i++) {
        var items = results[tools[i]];
        if (items && items.length > 0)
          container.appendChild(self._createResultSectionForTool(_tools[tools[i]], items));
      }
    }
    else {
      container.appendChild(I3.ui.createWithContent("EM", "Search returned 0 results."));
    }
  }
  
  /**
   * Private Method: _createResultSectionForTool
   *
   * Creates the elements to display a set of results for a particular tool.
   *
   * Parameters:
   *   tool - a tool object (such as from I3.config.getTools())
   *   items - an array of search results
   * 
   * Returns:
   *   An HTML `DIV` element.
   */
  @method _createResultSectionForTool(tool, items) {
    var container = I3.ui.create("DIV");
    container.className = "searchResultsSection";
    
    // Create the section header
    var header = self._createHeaderForResultSection(tool, items.length);
    container.appendChild(header);
    
    // Create the results list
    var results = I3.ui.create("DIV");
    results.className = "searchResults";
    
    var resultsTable = I3.ui.create("TABLE");
    var resultsThead = I3.ui.create("THEAD");
    var resultsTbody = I3.ui.create("TBODY");
    
    // Create the table header
    var headerRow = I3.ui.create("TR");
    var emptyIconCell = I3.ui.create("TH");
    var nameCell = I3.ui.createWithContent("TH", "Name / Description");
    nameCell.style.textAlign = "left";
    var lastModifiedCell = I3.ui.createWithContent("TH", "Last Modified");
    lastModifiedCell.style.textAlign = "right";
    headerRow.appendChild(emptyIconCell);
    headerRow.appendChild(nameCell);
    headerRow.appendChild(lastModifiedCell);
    resultsThead.appendChild(headerRow);
    resultsTable.appendChild(resultsThead);
    
    
    var limit = items.length > DEFAULT_RESULT_LIMIT ? DEFAULT_RESULT_LIMIT : items.length;
    
    // Show the first N items
    var i;
    for (i = 0; i < limit; i++) {
      var row = self._createRowForResult(items[i]);
      row.className = (i % 2 == 0) ? "i3tableRow" : "i3tableRowAlt";
      resultsTbody.appendChild(row);
    }
    
    // Render the remainder of the items in a hidden div
    var additionalRows = [];
    for (i = limit; i < items.length; i++) {
      var row = self._createRowForResult(items[i]);
      row.className = (i % 2 == 0) ? "i3tableRow" : "i3tableRowAlt";
      row.style.display = "none";
      additionalRows.push(row);
      resultsTbody.appendChild(row);
    }
    
    resultsTable.appendChild(resultsTbody);
    results.appendChild(resultsTable);
    
    if (items.length > DEFAULT_RESULT_LIMIT) {
      var seeMoreDiv = I3.ui.create("DIV");
      seeMoreDiv.className = "searchResultsViewAdditional";
      var seeMoreLink = I3.ui.createActionLink(SHOW_ADDITIONAL_ROWS, additionalRows, 
        "Toggle:All_Rows", self.showHideAdditionalRows);
      seeMoreDiv.appendChild(seeMoreLink);
      results.appendChild(seeMoreDiv);
    }
    
    container.appendChild(results);
    
    return container;
  }
  
  /**
   * Private Method: _createHeaderForResultSection
   *
   * Creates the header to display for a result section.
   *
   * Parameters:
   *   tool - a tool object
   *   resultCount - the number of results in this section
   */
  @method _createHeaderForResultSection(tool, resultCount) {
    var header = I3.ui.create("DIV");
    header.className = "resultToolHeader";
    
    var headerTable = I3.ui.create("TABLE");
    var headerTbody = I3.ui.create("TBODY");
    var headerRow   = I3.ui.create("TR");
    
    var headerIconCell = I3.ui.create("TD");
    headerIconCell.className = "resultToolHeaderIcon";
    var toolIcon = I3.ui.create("IMG");
    toolIcon.src = "/" + tool.dir + "/client-web/img/applet-icon-32.png";
    headerIconCell.appendChild(toolIcon);
    headerRow.appendChild(headerIconCell)
    
    var headerTextCell = I3.ui.create("TD");
    headerTextCell.className = "resultToolHeaderText";
    headerTextCell.appendChild(I3.ui.createWithContent("STRONG", 
      I3.ui.createNavigationLink(tool.name, "/" + tool.dir + "/")));
    var resultCountSpan = I3.ui.createWithContent("SPAN", 
      resultCount + " result" + ((resultCount > 1) ? "s" : ""));
    resultCountSpan.className = "resultToolHeaderCount";
    headerTextCell.appendChild(resultCountSpan);
    headerRow.appendChild(headerTextCell);
    
    var collapseSectionCell = I3.ui.create("TD");
    collapseSectionCell.style.textAlign = "right";
    collapseSectionCell.appendChild(I3.ui.createActionLink(HIDE_SECTION_TEXT, header, 
      "Toggle:Section", self.showHideResultsSection));
    headerRow.appendChild(collapseSectionCell);
    
    headerTbody.appendChild(headerRow);
    headerTable.appendChild(headerTbody);
    header.appendChild(headerTable);
    
    return header;
  }
  
  /**
   * Private Method: _createRowForResult
   *
   * Creates a row for the supplied result and returns it.
   *
   * Parameters:
   *   result - description
   */
  @method _createRowForResult(result) {
    var row = I3.ui.create("TR");
    
    var iconCell = I3.ui.create("TD");
    iconCell.className = "searchResultIcon";
    if (result.small_icon) {
      var icon = I3.ui.create("IMG");
      icon.src = result.small_icon;
      iconCell.appendChild(icon);
    }
    row.appendChild(iconCell);
    
    var textCell = I3.ui.create("TD");
    textCell.className = "searchResultInfo";
    var link;
    if (result.uri.search(/\/documents\/data/) == -1)
      link = I3.ui.createNavigationLink(result.title, result.uri);
    else {
      link = I3.ui.createWithContent("A", result.title);
      link.href = result.uri;
    }
    var linkDiv = I3.ui.createWithContent("DIV", link);
    linkDiv.className = "searchResultLink";
    textCell.appendChild(linkDiv);
    if (result.description) {
      var description = I3.ui.createWithContent("SPAN", result.description)
      description.className = "searchResultDescription";
      textCell.appendChild(description);
    }
    row.appendChild(textCell);
    
    var modifiedAtCell = I3.ui.create("TD");
    modifiedAtCell.className = "searchResultLastModifiedAt";
    if (result.last_modified_at) {
      modifiedAtCell.appendChild(I3.ui.text(
        I3.util.formatFriendlyDate(result.last_modified_at).replace(/^on\s/, "")));
    }
    row.appendChild(modifiedAtCell);
    
    return row;
  }
  
  /**
   * Method: performSearch
   *
   * Event handler for both the text box and the search button.
   *
   * Parameters:
   *   e - description
   */
  @method performSearch(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    
    // If this was fired from the search box, only submit if "Enter" was pressed
    if (element == _searchTerms && e.getKeyCode() != 13) return;
    
    var url = "/search/?q=" + encodeURIComponent(_searchTerms.value);
    url += self._buildExcludedToolURLString(self._buildExcludedToolList());
    I3.client.navigateTo(url);
  }
  
  /**
   * Private Method: _extractExcludedToolListFromURL
   *
   * Extracts the list of excluded tools from the URL string and returns an `Array`.
   *
   * Parameters:
   *   url - the URL to extract from
   */
  @method _extractExcludedToolListFromURL(url) {
    var excludedTools = [];
    var pattern = /exclude=([^&]+)/g;
    var result;
    while((result = pattern.exec(url)) != null) {
      excludedTools.push(result[1]);
    }
    return excludedTools;
  }
  
  /**
   * Private Method: _buildExcludedToolURLString
   *
   * Builds the string used in the URL to specify which tools should be excluded.
   *
   * Parameters:
   *   excludedTools - an `Array` of excluded tool names
   */
  @method _buildExcludedToolURLString(excludedTools) {
    var url = "";
    for (var i = 0; i < excludedTools.length; i++) {
      url += "&exclude=" + encodeURIComponent(excludedTools[i]);
    }
    return url;
  }
  
  /**
   * Private Method: _buildExcludedToolList
   *
   * Builds an array of the tools that have been excluded from the search.
   */
  @method _buildExcludedToolList() {
    var checkboxes = I3.ui.get("search-searchableTools").getElementsByTagName("INPUT");
    var excludedTools = [];
    for (var i = 0; i < checkboxes.length; i++) {
      var checkbox = checkboxes[i];
      if (checkbox.type != "checkbox") continue;
      if (checkbox.checked == false) excludedTools.push(checkbox.toolName);
    }
    return excludedTools;
  }
  
  /**
   * Method: displayToolList
   *
   * Display a list of tools that have site-searching enabled.
   * 
   * Parameters:
   *   excludedTools - an `Array` of excluded tool names
   */
  @method displayToolList(excludedTools) {
    var container = I3.ui.clear("search-searchableTools");
    
    var height = _searchableToolNames.length > 4 ? 4 : _searchableToolNames.length;
    var counter = 0;
    var outerRow = I3.ui.create("TR");
    
    while (counter < _searchableToolNames.length) {
      var cell  = I3.ui.create("TD");
      var table = I3.ui.create("TABLE");
      var tbody = I3.ui.create("TBODY");

      for (var i = 0; i < height && counter < _searchableToolNames.length; i++, counter++) {
        var toolName = _searchableToolNames[counter];
        var tool = _tools[toolName];

        var isExcluded = false;
        for (var j = 0; j < excludedTools.length; j++) {
          if (excludedTools[j] == toolName) {
            isExcluded = true;
            break;
          }
        }

        var row, checkbox, checkboxCell, icon, iconCell, nameCell;
        row = I3.ui.create("TR");

        checkboxCell = I3.ui.create("TD");
        checkboxCell.style.width = "16px";
        checkbox = I3.ui.createCheckbox(!isExcluded);
        checkbox.toolName = toolName;
        checkboxCell.appendChild(checkbox);

        iconCell = I3.ui.create("TD");
        iconCell.style.width = "34px";
        icon = I3.ui.create("IMG");
        icon.src = "/" + tool.dir + "/client-web/img/applet-icon-32.png";
        iconCell.appendChild(icon);

        nameCell = I3.ui.create("TD");
        nameCell.appendChild(I3.ui.text(tool.name));

        row.appendChild(checkboxCell);
        row.appendChild(iconCell);
        row.appendChild(nameCell);
        tbody.appendChild(row);
      }
      
      table.appendChild(tbody);
      cell.appendChild(table);
      outerRow.appendChild(cell);
    }
    
    container.appendChild(outerRow);
  }
  
  /**
   * Method: toggleOptions
   *
   * Toggles the visibility of the search options container.
   *
   * Parameters:
   *   e - the event info
   */
  @method toggleOptions(e) {
    e = I3.ui.getEvent(e);
    var link = e.getTarget();
    if (link.innerHTML == SHOW_OPTIONS_TEXT) {
      I3.ui.show(_searchOptions);
      link.innerHTML = HIDE_OPTIONS_TEXT;
    }
    else if (link.innerHTML = HIDE_OPTIONS_TEXT) {
      I3.ui.hide(_searchOptions);
      link.innerHTML = SHOW_OPTIONS_TEXT;
    }
  }
  
  /**
   * Method: showHideResultsSection
   *
   * Shows or hides a results section.
   *
   * Parameters:
   *   e - the event info
   */
  @method showHideResultsSection(e) {
    e = I3.ui.getEvent(e);
    var link = e.getTarget();
    var info = e.getInfo();
    
    if (info.nextSibling && I3.ui.elementHasClassName(info.nextSibling, "searchResults")) {
      if (link.innerHTML == SHOW_SECTION_TEXT) {
        I3.ui.show(info.nextSibling);
        link.innerHTML = HIDE_SECTION_TEXT;
      }
      else if (link.innerHTML = HIDE_SECTION_TEXT) {
        I3.ui.hide(info.nextSibling);
        link.innerHTML = SHOW_SECTION_TEXT;
      }
    }
  }
  
  /**
   * Method: showHideAdditionalRows
   *
   * Shows or hides the additional rows in a particular result section.
   *
   * Parameters:
   *   e - the event info
   */
  @method showHideAdditionalRows(e) {
    e = I3.ui.getEvent(e);
    var link = e.getTarget();
    var info = e.getInfo();
    if (link.innerHTML == SHOW_ADDITIONAL_ROWS) {
      for (var i = 0; i < info.length; i++) I3.ui.show(info[i], "");
      link.innerHTML = HIDE_ADDITIONAL_ROWS;
    }
    else if (link.innerHTML == HIDE_ADDITIONAL_ROWS) {
      for (var i = 0; i < info.length; i++) I3.ui.hide(info[i]);
      link.innerHTML = SHOW_ADDITIONAL_ROWS;
    }
  }

} // end Search.IndexApplet
