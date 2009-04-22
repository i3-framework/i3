/**
 * Script: devworld/client-web/js/index
 *
 * Contains the primary applet for the Developer World tool.
 * Developer World is (currently) used for testing servlets: a developer
 * can select a web service to call, provide it with a path and/or
 * some PUT/POST data, and view the result.
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
 *   $Id: index.js 81 2008-04-02 22:11:11Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: DevWorld
 *
 * Contains classes and data for the Developer World tool.
 */
@module DevWorld;

// ---------------------------------------------------------------------------


/**
 * Class: DevWorld.IndexApplet
 *
 * Manages the Developer World index page.
 */
@class IndexApplet {
  
  // -------------------------------------------------------------------------
  // Instance variables
  // -------------------------------------------------------------------------

  // Request object used for loading data.
  var _req;
  
  // Hash of tool names and their associated arrays of servlets.
  var _tools = {};
  
  // Path being requested.
  var _requestMethod = "GET";
  var _requestPath = "/";
  
  // Data being sent via POST or PUT.
  var _postContent = "";
  
  // Text of last result for formatting.
  var _lastResult = "";
  
  // Web controls that we'll need to reference.
  var _toolListBox;
  var _servletListBox;
  var _methodCombo;
  var _paramsText;
  var _postText;
  var _methodLabel;
  var _pathLabel;
  var _goButton;
  var _loadingDiv;
  var _resultsDiv;
  var _resultHeadersDiv;
  var _resultOptionsDiv;
  var _resultViewDiv;
  var _resultErrorDiv;


  // -------------------------------------------------------------------------
  // Initializer
  // -------------------------------------------------------------------------

  /**
   * Method: initialize
   *
   * Initializes the Developer World applet.
   */
  @method initialize() {
    // Get references to the controls.
    _toolListBox      = I3.ui.get("devworld-toolList");
    _servletListBox   = I3.ui.get("devworld-serviceList");
    _methodCombo      = I3.ui.get("devworld-methodList");
    _paramsText       = I3.ui.get("devworld-serviceParamsInput");
    _postText         = I3.ui.get("devworld-servicePostText");
    _methodLabel      = I3.ui.get("devworld-serviceMethodPreview");
    _pathLabel        = I3.ui.get("devworld-serviceURIPreview");
    _goButton         = I3.ui.get("devworld-serviceButton");
    _loadingDiv       = I3.ui.get("devworld-serviceLoading");
    _resultsDiv       = I3.ui.get("devworld-serviceResults");
    _resultHeadersDiv = I3.ui.get("devworld-resultHeaders");
    _resultOptionsDiv = I3.ui.get("devworld-resultViewOptions");
    _resultViewDiv    = I3.ui.get("devworld-resultView");
    _resultErrorDiv   = I3.ui.get("devworld-serviceError");
  }

  /**
   * Method: loadPath
   *
   * Called when a virtual path is handled by this applet.
   *
   * Parameters:
   *   path - the path string
   */
  @method loadPath(path) {

    // Set up the navigation bar.
    I3.navbar.addToPath("Developer World");

    // Disable the controls.
    _toolListBox.disabled = true;
    _servletListBox.disabled = true;
    _methodCombo.disabled = true;
    _paramsText.disabled = true;
    _goButton.disabled = true;

    // Load the servlet list.
    I3.client.getObject("/devworld/data/servlet-list", self.onListResponse);
  }


  // -------------------------------------------------------------------------
  // Servlet list loading
  // -------------------------------------------------------------------------

  /**
   * Method: onListResponse
   *
   * Called when the servlet list has been retrieved from the server.
   *
   * Parameters:
   *   response - the response data
   */
  @method onListResponse(response) {
    if (response.isOK()) self.loadServletLists(response.getObject());
  }

  /**
   * Method: loadServletLists
   *
   * Replaces the contents of the Tools and Servlets list boxes
   * with the items in the given array of paths.
   *
   * Parameters:
   *   paths - array of URI's identifying servlets
   */
  @method loadServletLists(paths) {

    var toolNames = [];

    // Create tools hash.
    var parts;
    for (var i = 0; i < paths.length; i++) {
      parts = paths[i].split("/");
      if (_tools[parts[1]] == null) {
        _tools[parts[1]] = [];
        toolNames.push(parts[1]);
      }
      _tools[parts[1]].push({"name": parts[3], "uri": paths[i] });
    }

    // Load the tool names into the list box.
    _toolListBox.innerHTML = "";
    var opt;
    for (var i = 0; i < toolNames.length; i++) {
      opt = I3.ui.create("option");
      opt.value = toolNames[i];
      opt.appendChild(I3.ui.text(toolNames[i]));
      _toolListBox.appendChild(opt);
    }

    // Enable the list box.
    _toolListBox.onchange = self.onToolChange;
    _toolListBox.disabled = false;
  }


  // -------------------------------------------------------------------------
  // UI event handlers
  // -------------------------------------------------------------------------

  /**
   * Method: onToolChange
   *
   * Event handler called when a tool is selected from the list.
   *
   * Parameters:
   *   e - the change event parameters
   */
  @method onToolChange(e) {
    
    // Disable controls that won't work until a servlet is chosen.
    _methodCombo.disabled = true;
    _paramsText.value = "";
    _paramsText.disabled = true;
    _goButton.disabled = true;
    
    // Fill in servlet list.
    _servletListBox.innerHTML = "";
    var tool = _toolListBox.options[_toolListBox.selectedIndex].value
    var servlets = _tools[tool];
    var opt;
    for (var i = 0; i < servlets.length; i++) {
      opt = I3.ui.create("option");
      opt.value = servlets[i].uri;
      opt.appendChild(I3.ui.text(servlets[i].name));
      _servletListBox.appendChild(opt);
    }
    
    // Make sure the servlet list is enabled.
    _servletListBox.onchange = self.onServletChange;
    _servletListBox.disabled = false;
  }

  /**
   * Method: onServletChange
   *
   * Event handler called when a servlet is selected from the list.
   *
   * Parameters:
   *   e - the change event parameters
   */
  @method onServletChange(e) {

    // Allow method change.
    _methodCombo.disabled = false;
    _methodCombo.onchange = self.onMethodChange;

    // Clear extra path info.
    _paramsText.value = "";
    _paramsText.disabled = false;
    _paramsText.onkeyup = self.onParamChange;
    _goButton.disabled = false;
    _goButton.onclick = self.onGoButtonClick;

    // Update path preview.
    self.updateURIPreview();
  }
  
  /**
   * Method: onMethodChange
   *
   * Event handler called when the user changes the HTTP Request method.
   *
   * Parameters:
   *   e - the change event parameters
   */
  @method onMethodChange(e) {
    self.updateURIPreview();
    if (_requestMethod == "POST" || _requestMethod == "PUT")
      I3.ui.show("devworld-servicePostContainer");
    else
      I3.ui.hide("devworld-servicePostContainer");
  }

  /**
   * Method: onParamChange
   *
   * Event handler called when the user changes the parameter text.
   *
   * Parameters:
   *   e - the key up event parameters
   */
  @method onParamChange(e) {
    self.updateURIPreview();
  }

  /**
   * Method: onGoButtonClick
   *
   * Event handler called when the "Go!" button is pressed.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onGoButtonClick(e) {
    self.disableControls(true);
    _resultViewDiv.innerHTML = "";
    I3.ui.hide(_resultsDiv);
    I3.ui.hide(_resultViewDiv);
    I3.ui.hide(_resultErrorDiv);
    I3.ui.show(_loadingDiv);
    _req = I3.client.createRequest();
    _req.onreadystatechange = self.handleCustomResponse;
    _req.open(_requestMethod, _requestPath, true);
    if (_requestMethod == "GET" || _requestMethod == "DELETE")
      _req.send(null);
    else {
      _req.setRequestHeader("Content-Type", "text/javascript");
      _req.send(_postText.value);
    }
  }


  // -------------------------------------------------------------------------
  // UI manipulation
  // -------------------------------------------------------------------------

  /**
   * Method: updateURIPreview
   *
   * Updates the URI preview field based on the user input.
   */
  @method updateURIPreview() {
    var servletPath = 
      _servletListBox.options[_servletListBox.selectedIndex].value;
    var extraPath = encodeURI(_paramsText.value);
    if (extraPath.length > 0 && extraPath[0] != "/" && extraPath[0] != "?")
      extraPath = "/" + extraPath;
    _requestMethod = _methodCombo.options[_methodCombo.selectedIndex].value;
    _requestPath = servletPath + extraPath;
    _methodLabel.innerHTML = "";
    _methodLabel.appendChild(I3.ui.text(_requestMethod));
    _pathLabel.innerHTML = "";
    _pathLabel.appendChild(I3.ui.text(_requestPath));
  }
  
  /**
   * Method: disableControls
   *
   * Disables or enables interactive controls.  This is used when the
   * custom response is loading.
   *
   * Parameters:
   *   value - `true` to disable the controls, `false` to enable
   */
  @method disableControls(value) {
    _toolListBox.disabled = value;
    _servletListBox.disabled = value;
    _methodCombo.disabled = value;
    _paramsText.disabled = value;
    _goButton.disabled = value;
  }


  // -------------------------------------------------------------------------
  // Custom response loading
  // -------------------------------------------------------------------------

  /**
   * Method: handleCustomResponse
   *
   * Called when a response has been received from the custom request
   * created by the user.
   */
  @method handleCustomResponse() {
    if (_req.readyState == 4) {
      try {
        // Display headers.
        I3.ui.show(_resultsDiv);
        var status, statusText, type, size, size2;
        status = _req.status;
        statusText = _req.statusText;
        if (status == null) status = -1;
        if (statusText == null || statusText == "") statusText = "unknown";
        try { type = _req.getResponseHeader("Content-Type"); }
        catch (ex) { }
        try { size = _req.getResponseHeader("Content-Length"); }
        catch (ex) { }
        if (type == null || type == "") type = "(unknown)";
        if (size == null || size == "") size = -1;
        else size = parseInt(size);
        if (type.substr(0, 5) == "text/" && _req.responseText)
          size2 = _req.responseText.length;
        else size2 = -1;
        if (size >= 0) size = I3.util.formatWithCommas(size) + " bytes";
        else size = "(unknown)";
        if (size2 >= 0) size2 = I3.util.formatWithCommas(size2) + " bytes";
        else size2 = "(unknown)";
        var headerHTML =
          '<span class="resultHeaderLabel">Status Code:</span> ' + status +
          ' (' + statusText + ')<br />' +
          '<span class="resultHeaderLabel">Content Type:</span> ' + type +
          '<br />' +
          '<span class="resultHeaderLabel">Transfer Size:</span> ' + size +
          '<br />' +
          '<span class="resultHeaderLabel">Actual Size:</span>' + size2;
        _resultHeadersDiv.innerHTML = headerHTML;
          
        // Display content if possible.
        if (type == "text/javascript")
          self.displayJSON(_req.responseText);
        else if (type == "text/html")
          self.displayHTML(_req.responseText);
        else if (type.substr(0, 5) == "text/")
          self.displayText(_req.responseText);
        else if (type == "image/gif" ||
                 type == "image/jpeg" ||
                 type == "image/png")
          self.displayImage(type, _requestPath);
        else
          _resultViewDiv.innerHTML = "<em>No preview available.</em>";
        I3.ui.show(_resultViewDiv);
      }
      catch (ex) {
        self.displayError(ex.toString());
      }
      // Enable the UI again.
      I3.ui.hide(_loadingDiv);
      self.disableControls(false);
      _req = null;
    }
  }


  // -------------------------------------------------------------------------
  // Custom response display methods
  // -------------------------------------------------------------------------

  /**
   * Method: displayJSON
   *
   * Formats and displays the JSON object source.  Eventually it would be
   * nice to put in a tree view or maybe even column view of the object
   * itself.
   *
   * Parameters:
   *   text - the source of the JSON object
   */
  @method displayJSON(text) {
    var obj = eval("(" + text + ")");
    _resultViewDiv.appendChild(self._renderObject(obj));
  }

  /**
   * Private Method: _renderObject
   *
   * Creates a DOM element representing the given value.
   *
   * Arrays are rendered as DIVs with class "jsArray".
   * Objects are rendered as DIVs with class "jsObject".
   *
   * Parameters:
   *   o - the JavaScript object to render
   */
  @method _renderObject(o) {
    if (o == null) {
      var span = I3.ui.create("span");
      span.appendChild(I3.ui.text("null"));
      span.className = "jsNull";
      return span;
    }
    else if (o.constructor == String) {
      var span = I3.ui.create("span");
      span.appendChild(I3.ui.text(I3.client.encodeObject(o)));
      span.className = "jsString";
      return span;
    }
    else if (o.constructor == Number || o.constructor == Boolean) {
      var span = I3.ui.create("span");
      span.appendChild(I3.ui.text(o.toString()));
      span.className = "jsKeyword";
      return span;
    }
    else if (o.constructor == Array) {
      var div = I3.ui.create("div");
      var ol = I3.ui.create("ol");
      var li;
  	  for (var i = 0; i < o.length; i++) {
  	    li = I3.ui.create("li");
  	    li.appendChild(self._renderObject(o[i]));
  	    ol.appendChild(li);
  	  }
  	  ol.start = 0;
  	  div.appendChild(ol);
      div.className = "jsArray";
  	  return div;
    }
    else {
      var div = I3.ui.create("div");
      var attrs = [];
      for (var attr in o) { attrs.push(attr); }
      attrs.sort();
      var subdiv, strong;
  	  for (var i = 0; i < attrs.length; i++) {
  	    subdiv = I3.ui.create("div");
  	    strong = I3.ui.create("strong");
  	    strong.appendChild(I3.ui.text(attrs[i] + ": "));
  	    subdiv.appendChild(strong);
  	    subdiv.appendChild(self._renderObject(o[attrs[i]]));
  	    div.appendChild(subdiv);
  	  }
  	  div.className = "jsObject";
  	  return div;
    }
  }
  
  /**
   * Method: displayHTML
   *
   * Displays the HTML source.  Eventually it would be nice to put in
   * a rendering of the HTML.
   *
   * Parameters:
   *   text - the HTML source
   */
  @method displayHTML(text) {
    self.displayText(text);
  }
  
  /**
   * Method: displayText
   *
   * Displays the text in a preformatted block.
   *
   * Parameters:
   *   text - the text to display
   */
  @method displayText(text) {
    // IE has a text-wrapping bug when using the W3C way so we have to
    // use its innerText property instead.
    var pre = I3.ui.create("pre");
    if (I3.browser.isIE()) pre.innerText = text;
    else pre.appendChild(I3.ui.text(text));
    _resultViewDiv.appendChild(pre);
  }
  
  /**
   * Method: displayImage
   *
   * Displays the image.  Note that due to the limitations of the
   * `XMLHttpRequest` object, the image must be requested a second time
   * by the browser.
   *
   * Parameters:
   *   type - the MIME type of the image (e.g. "image/png")
   *   uri - the URI of the image so that it can be loaded
   */
  @method displayImage(type, uri) {
    var msg = "Received image of type " + type;
    _resultViewDiv.appendChild(I3.ui.text(msg));
    // TODO: Load the image (requires a second call, sadly)
  }
  
  /**
   * Method: displayError
   *
   * Displays an error message.
   *
   * Parameters:
   *   msg - the message text to display
   */
  @method displayError(msg) {
    I3.ui.clear(_resultErrorDiv);
    _resultErrorDiv.appendChild(I3.ui.text("Error: " + msg));
    I3.ui.show(_resultErrorDiv);
  }

}
