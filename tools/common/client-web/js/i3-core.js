/**
 * Script: common/client-web/js/i3-core
 *
 * Intranet 3 core JavaScript objects.
 *
 * The API is comprised of several classes, each of which deals with a
 * specific set of functionality.  For example, <I3Internals.UserInterface>
 * deals with finding and creating DOM elements, while <I3Internals.Client>
 * deals with communicating with web services.  The <I3> module provides
 * shared instances of these classes, so you don't need to instantiate them
 * yourself.
 *
 *   I3.client - Instance of <I3Internals.Client>.
 *     Handles web client communication with the server, such as making
 *     web service requests, storing and retrieving cookies, encoding
 *     objects for sending, and so on.
 *
 *   I3.ui - Instance of <I3Internals.UserInterface>.
 *     Provides access to the intranet Document Object Model (DOM)
 *     and simplifies the creation of action links, form elements, etc.
 *
 *   I3.browser - Instance of <I3Internals.BrowserDetector>.
 *     Provides information about the web browser that is being used to
 *     access the intranet.
 *
 *   I3.util - Instance of <I3Internals.Utilities>.
 *     Has various useful methods for working with JavaScript objects.
 *
 * In addition to the objects available through the <I3> module, there are
 * some API classes that are provided to applets as results of operations.
 * Instances of the <I3.Event> class, which provides event information in a
 * browser-independent manner, are returned by `I3.ui.getEvent()`.
 * Calls to `I3.client.getObject` and similar communication methods
 * will provide an <I3.ObjectResponse> instance when they finish processing,
 * which contains the decoded object that the web service sent.
 *
 * Because these classes are so fundamental to intranet web clients, it is
 * worth taking time to go through the documentation for this file and
 * understand what the API can do.
 *
 * Examples:
 *
 * (start example)
 *   // Find a specific DIV in the document object model.
 *   var div = I3.ui.get("deathStar");
 *
 *   // Add some text to the DIV.
 *   div.appendChild(I3.ui.text("Fire when ready."));
 *
 *   // Add a link to the DIV that will call a method when clicked.
 *   div.appendChild(I3.ui.createActionLink("Destroy Planet!", "Alderaan",
 *     "Destroy:Alderaan", self.onDeathStarFire));
 * (end example)
 *
 * (start example)
 *   // Handle a click event.
 *   @method onDeathStarFire(e) {
 *
 *     // Get a browser-independent event object.
 *     // This will return an instance of I3.Event.
 *     e = I3.ui.getEvent(e);
 *
 *     // Retrieve the additional information associated with the event.
 *     var planet = e.getInfo();
 *
 *     // Begin a web service call to carry out the action.
 *     // The web service will be called in the background, and the
 *     // self.onResponse method will be called when it completes.
 *     I3.client.deleteObject("/galaxy/data/planets/" + planet,
 *       self.onResponse);
 *   }
 * (end example)
 *
 * (start example)
 *   // Handle the response from a web service.
 *   // The response parameter is an instance of I3.ObjectResponse.
 *   @method onResponse(response) {
 *     if (response.isOK()) self.loadFragmentCoordinates(response.getObject());
 *   }
 * (end example)
 *
 * Credits:
 * 
 *   Written by
 *     Marshall Elfstrand (marshall@vengefulcow.com) and
 *     Nathan Mellis (nathan@mellis.us).
 * 
 *   Event handling and cookie support based on code from QuirksMode
 *     (http://www.quirksmode.org/).
 *   Drag-and-drop support based on code from DOM-Drag by Aaron Boodman
 *     (http://boring.youngpup.net/2001/domdrag/).
 *   Number formatting based on code by Shawn Milo
 *     (milo@linuxmail.org).
 *   Time formatting based on code from the Typo project
 *     (http://typosphere.org/).
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
 *   $Id: i3-core.js 111 2008-05-29 17:19:59Z nmellis $
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


// ---------------------------------------------------------------------------
// INTRANET 3 WEB CLIENT LIBRARY
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.Client
 *
 * The main object for shared intranet client communications code.
 * This contains methods for sending and receiving objects, working
 * with cookies, and so on.
 *
 * The shared instance of this class is provided by the `I3.client` property.
 */
@class Client {
  
  /**
   * Private Property: requestManager
   * The HTTP request manager.  For internal use only.
   */
  self.requestManager = new I3Internals.RequestManager();
    
  /**
   * Method: getCookie
   *
   * Returns the value of a cookie.
   *
   * Parameters:
   *   name - the name of the cookie to look up
   *
   * Returns:
   *   the string value of the requested cookie
   */
  @method getCookie(name) {
    // Based on code from http://www.quirksmode.org/js/cookies.html
    var nameEq = name + "=";
    var cookies = document.cookie.split(';');
    for (var i = 0; i < cookies.length; i++) {
      var c = cookies[i];
      while (c.charAt(0) == ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEq) == 0) return c.substring(nameEq.length, c.length);
    }
    return null;
  }
  
  /**
   * Method: setCookie
   *
   * Sets the value of a cookie.
   *
   * Parameters:
   *   name - the name of the cookie to set, as a string
   *   value - the new value to give the cookie, as a string
   *   days - optional; an `int` describing the number of days after
   *     which this cookie should expire.  If omitted, no expiration
   *     date will be set for the cookie.
   */
  @method setCookie(name, value, days) {
    // Based on code from http://www.quirksmode.org/js/cookies.html
    // TODO: We need to find another way of storing information that
    //       does not get sent as part of the request each time.
    //       Maybe some user settings web service could be asynchronously
    //       loaded that provides cache headers to prevent the browser from
    //       actually loading it each time?
    var expires = "";
    if (days) {
      var date = new Date();
      date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
      expires = "; expires=" + date.toGMTString();
    }
    document.cookie = name + "=" + value + expires + "; path=/";
  }
  
  /**
   * Method: clearCookie
   *
   * Clears the value of a cookie.
   *
   * Parameters:
   *   name -  the name of the cookie to clear
   */
  @method clearCookie(name) {
    // Based on code from http://www.quirksmode.org/js/cookies.html
    self.setCookie(name, "", -1);
  }

  /**
   * Method: checkResponse
   *
   * Checks the given request object to see if the status is OK and
   * if it contains any text.
   *
   * Parameters:
   *   req - the `XMLHttpRequest` object that requested the data
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3UserInterface::displayError>.  Defaults to `true`.
   *
   * Returns:
   *   `true` if the request object contains a valid response.
   *   `false` if it does not.
   */
  @method checkResponse(req, displayErrors) {
    try {
      var responseCategory = req.status.toString().charAt(0);
      if (responseCategory == "4" || responseCategory == "5") {
        if (displayErrors == null || displayErrors == true) {
          var err = "HTTP Error " + req.status + ": " + req.statusText;
          try {
            if (req.getResponseHeader("Content-Type") == "text/javascript")
              err = I3.client.decodeObject(req.responseText);
          } catch (ex) {
            err += "\n(Furthermore, the error data itself is garbled.)";
          }
          I3.ui.displayError(err);
        }
        return false;
      } else if (req.responseText && req.responseText.length == 0) {
        return false;
      }
    } catch (ex) {
      return false;
    }
    return true;
  }

  /**
   * Private Method: _escapeJSONChar
   *
   * Encodes a single character for JSON serialization.
   *
   * Parameters:
   *   c - string consisting of the character to encode
   *
   * Returns:
   *   The JSON-encoded character as a string.
   */
  @method _escapeJSONChar(c) {
    if(c == "\"" || c == "\\") return "\\" + c;
    else if (c == "\b") return "\\b";
    else if (c == "\f") return "\\f";
    else if (c == "\n") return "\\n";
    else if (c == "\r") return "\\r";
    else if (c == "\t") return "\\t";
    var hex = c.charCodeAt(0).toString(16);
    if (hex.length == 1) return "\\u000" + hex;
    else if(hex.length == 2) return "\\u00" + hex;
    else if(hex.length == 3) return "\\u0" + hex;
    else return "\\u" + hex;
  }

  /**
   * Private Method: _escapeJSONString
   *
   * Encodes a string for JSON serialization.
   *
   * Parameters:
   *   s - the string to encode
   *
   * Returns:
   *   The JSON-encoded string.
   */
  @method _escapeJSONString(s) {
    var c;
    var parts = s.split("");
    for (var i = 0; i < parts.length; i++) {
  	  c = parts[i];
  	  if (c == '"' || c == '\\' ||
  	      c.charCodeAt(0) < 32 || c.charCodeAt(0) >= 128)
        parts[i] = self._escapeJSONChar(parts[i]);
    }
    return '"' + parts.join("") + '"';
  }

  /**
   * Method: encodeObject
   *
   * Encodes the given object for sending to the server.
   *
   * This converts the object to JavaScript Object Notation (JSON) and returns
   * it as a string.  JSON can be converted back into an object using
   * JavaScript's `eval()` function or by a YAML parser (as JSON is a
   * subset of YAML syntax).
   *
   * Parameters:
   *   o - the object to encode
   *
   * Returns:
   *   The encoded object as a string.
   */
  @method encodeObject(o) {
    // We need a reference to the applet window in order to check types,
    // since each window has its own JavaScript constructor functions.
    var aw = self.appletLoader ? self.appletLoader.getAppletWindow() : window;
    if (o == null) return "null";
    else if (o.constructor == String || o.constructor == aw.String)
      return self._escapeJSONString(o);
    else if (o.constructor == Number || o.constructor == aw.Number)
      return o.toString();
    else if (o.constructor == Boolean || o.constructor == aw.Boolean)
      return o.toString();
    else if (o.constructor == Date || o.constructor == aw.Date)
      return self._escapeJSONString(o.toUTCString());
    else if (o.constructor == Array || o.constructor == aw.Array) {
  	  var v = [];
  	  for (var i = 0; i < o.length; i++) v.push(self.encodeObject(o[i]));
  	  return "[" + v.join(", ") + "]";
    } else {
  	  var v = [];
  	  for (attr in o) {
  	    if (o[attr] == null) v.push('"' + attr + '": null');
  	    else if (typeof o[attr] == "function"); // skip
  	    else v.push(self._escapeJSONString(attr) + ": " +
  	                self.encodeObject(o[attr]));
  	  }
  	  return "{" + v.join(", ") + "}";
    }
  }

  /**
   * Method: decodeObject
   *
   * Converts an object from JavaScript Object Notation (JSON) into
   * an actual JavaScript object.
   *
   * Parameters:
   *   str - the string containing the encoded object
   *
   * Returns:
   *   the decoded JavaScript object
   */
  @method decodeObject(str) {
    return eval("(" + str + ")");
  }

  /**
   * Method: createRequest
   *
   * Creates a new `XMLHttpRequest` object in a browser-independent manner.
   *
   * Returns:
   *   The request object.
   */
  @method createRequest() {
    if (window.XMLHttpRequest) return new XMLHttpRequest();
    else return new ActiveXObject("Microsoft.XMLHTTP");
  }

  /**
   * Method: getObject
   *
   * Pulls an object from the server using an asynchronous HTTP `GET` request.
   *
   * `GET` requests are used to read data from a web service, and do not
   * result in any changes being made to the data.
   *
   * When the request completes, the handler function will be called with
   * an <I3.ObjectResponse> parameter.
   *
   * Parameters:
   *   path - the path string of the web service providing the object
   *   handler - the handler function to call when the request completes
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3Internals.UserInterface::displayError>. 
   *     Defaults to `true`.
   */
  @method getObject(path, handler, displayErrors) {
    if (displayErrors == null) displayErrors = true;
    self.requestManager.startRequest(
      "GET", path, null, handler, displayErrors);
  }

  /**
   * Method: postObject
   *
   * Sends an object to the server using an asynchronous HTTP `POST` request.
   * 
   * `POST` requests are generally used to update or append to existing data
   * in the web service.  This can include appending data to a collection
   * when the URI of the item to be appended will not be known until the
   * web service has assigned it.  On the other hand, overwriting or
   * creating a new item where the URI is known ahead of time is usually
   * done with a `PUT` request.
   * 
   * When the request completes, the handler function will be called with
   * an <I3.ObjectResponse> parameter.
   *
   * Parameters:
   *   obj - the object being sent to the service
   *   path - the path string of the web service receiving the object
   *   handler - the handler function to call when the request completes
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3Internals.UserInterface::displayError>.
   *     Defaults to `true`.
   */
  @method postObject(obj, path, handler, displayErrors) {
    if (displayErrors == null) displayErrors = true;
    self.requestManager.startRequest(
      "POST", path, obj, handler, displayErrors);
  }

  /**
   * Method: putObject
   *
   * Sends an object to the server using an asynchronous HTTP `PUT` request.
   * 
   * `PUT` requests are usually used to create new objects on the server or
   * overwrite existing ones.  Think of it as a file copy, where a file
   * is being created or overwritten (although web services will frequently
   * be accessing databases instead of a file system).  This is subtly
   * different from a `POST` request, which is intended to update an
   * existing item or append to a collection.
   * 
   * When the request completes, the handler function will be called with
   * an <I3.ObjectResponse> parameter.
   *
   * Parameters:
   *   obj - the object being sent to the service
   *   path - the path string of the web service receiving the object
   *   handler - the handler function to call when the request completes
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3Internals.UserInterface::displayError>.
   *     Defaults to `true`.
   */
  @method putObject(obj, path, handler, displayErrors) {
    if (displayErrors == null) displayErrors = true;
    self.requestManager.startRequest(
      "PUT", path, obj, handler, displayErrors);
  }

  /**
   * Method: deleteObject
   *
   * Removes an object from the server using an asynchronous HTTP `DELETE`
   * request.
   * 
   * `DELETE` requests are used to instruct a web service to remove an item.
   * The item must have its own URI, as no additional data is provided to
   * a web service during a `DELETE` request.
   * 
   * When the request completes, the handler function will be called with
   * an <I3.ObjectResponse> parameter.
   *
   * Parameters:
   *   path - the path string of the object to be removed
   *   handler - the handler function to call when the request completes
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3Internals.UserInterface::displayError>.
   *     Defaults to `true`.
   */
  @method deleteObject(path, handler, displayErrors) {
    if (displayErrors == null) displayErrors = true;
    self.requestManager.startRequest(
      "DELETE", path, null, handler, displayErrors);
  }

}


// ---------------------------------------------------------------------------
// HTTP REQUEST MANAGER
// ---------------------------------------------------------------------------

/**
 * Private Class: I3Internals.RequestManager
 *
 * Manages the set of asynchronous HTTP requests started by the
 * `I3.client.xxxObject` methods.
 *
 * This class is used internally by <I3Internals.Client> and is not intended
 * for use by other intranet code.
 */
@class RequestManager {

  // Since this class is not part of the public API, the methods in
  // it all have "Method (Hidden):" declarations at the top, causing
  // the API doc generator to ignore them.
  
  // Array of request information objects.
  var _requests = [];
  
  /**
   * Method (Hidden): startRequest
   *
   * Starts an asyncronous HTTP request to the server.
   *
   * Parameters:
   *   httpMethod - the HTTP method to use ("GET", "PUT", "POST", or "DELETE")
   *   path - the path string of the web service to contact
   *   obj - for `PUT` or `POST` requests, the object being sent to the
   *     service; `null` for `GET` or `DELETE` requests
   *   handler - the handler function to call when the request completes
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3Internals.UserInterface::displayError>.
   *     Defaults to `true`.
   */
  @method startRequest(httpMethod, path, obj, handler, dispErrors) {
    var requestInfo = {};
    _requests.push(requestInfo);
    requestInfo.handler = handler;
    requestInfo.displayErrors = dispErrors;
    requestInfo.wasAborted = false;
    requestInfo.request = I3.client.createRequest();
    requestInfo.request.onreadystatechange = self.handleResponse;
    requestInfo.request.open(httpMethod, path, true);
    if (obj == null) {
      requestInfo.request.send(null);
    }
    else {
      requestInfo.request.setRequestHeader(
        "Content-Type", "text/javascript");
      requestInfo.request.send(I3.client.encodeObject(obj));
    }
  }

  /**
   * Method (Hidden): handleResponse
   *
   * Called when a request started by <startRequest> has
   * completed.  Calls the handler function associated with the request
   * and provides it with an <I3.ObjectResponse> instance.
   */
  @method handleResponse() {
    var requestsDone = [];
    var requestsOngoing = [];
    var info;
    // Partition into done vs. ongoing requests.
    for (var i = 0; i < _requests.length; i++) {
      info = _requests[i];
      if (info.request.readyState == 4) requestsDone.push(info);
      else requestsOngoing.push(info);
    }
    _requests = requestsOngoing;
    // Call the handlers for the finished requests.
    for (var i = 0; i < requestsDone.length; i++) {
      info = requestsDone[i];
      if (!info.wasAborted) {
        info.handler(new I3.ObjectResponse(info.request, info.displayErrors));
      }
    }
  }
  
  /**
   * Method (Hidden): cancelRequests
   *
   * Stops all asynchronous requests in progress.
   * 
   * This is called when a new applet is loaded so that asynchronous requests
   * do not attempt to call handler methods that no longer exist.
   */
  @method cancelRequests() {
    for (var i = 0; i < _requests.length; i++) {
      _requests[i].wasAborted = true;
      _requests[i].request.abort();
    }
    _requests = [];
  }
  
}


// ---------------------------------------------------------------------------
// BROWSER DETECTION
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.BrowserDetector
 *
 * Provides a simple way of checking what kind of browser is being
 * used.  This is useful when working around known bugs in browsers
 * (usually Internet Explorer).
 *
 * The shared instance of this class is provided by the `I3.browser` property.
 */
@class BrowserDetector {

  var _ua = navigator.userAgent.toLowerCase();
  var _isMozilla =
    (_ua.indexOf('gecko') != -1 && _ua.indexOf('safari') == -1);
  var _isIE =
    (_ua.indexOf('msie') != -1 && _ua.indexOf('opera') == -1);
  var _isKHTML =
    (_ua.indexOf('safari') != -1 || _ua.indexOf('konqueror') != -1);
  var _isMac =
    (_ua.indexOf('mac os') != -1);
  var _isWindows =
    (_ua.indexOf('windows') != -1);

  /**
   * Method: isMozilla
   * Returns `true` if the browser is a Mozilla variant, such as Firefox.
   */
  @method isMozilla() { return _isMozilla; }

  /**
   * Method: isIE
   * Returns `true` if the browser is Internet Explorer (any version).
   */
  @method isIE() { return _isIE; }
  
  /**
   * Method: isKHTML
   * Returns `true` if the browser is a KHTML variant, such as Safari.
   */
  @method isKHTML() { return _isKHTML; }

  /**
   * Method: isMac
   * Returns `true` if the browser is running on the Mac OS X platform.
   */
  @method isMac() { return _isMac; }

  /**
   * Method: isWindows
   * Returns `true` if the browser is running on the Windows platform.
   */
  @method isWindows() { return _isWindows; }
}


// ---------------------------------------------------------------------------
// DRAG-AND-DROP SUPPORT
// ---------------------------------------------------------------------------

/**
 * Private Class: I3Internals.DragManager
 *
 * Supplies drag-and-drop support to DOM elements to make it easier
 * to develop rich user interfaces.  Based on the DOM-Drag project.
 *
 * Use `I3.ui.enableDragging(elem)` to apply drag-and-drop functionality to an element.
 */
@class DragManager {
  
  var _handle = null;
  
  var _eventArgs;
  var _startingX;
  var _fireOriginalClickEvent = true;
  
  /**
   * Method (Hidden): init
   *
   * Adds support for drag-and-drop to the given element (`handle`).
   * 
   * You can also pass in a hash of options that may contain the following keys:
   * 
   *   container - specifies a container object for which `element`
   *     will be used as a handle.  If this is supplied, the container
   *     will be moved when the element is dragged.
   *   minX - limits horizontal dragging to a minimum X integer value.
   *   maxX - limits horizontal dragging to a maximum X integer value.
   *   minY - limits vertical dragging to a minimum Y integer value.
   *   maxY - limits vertical dragging to a maximum Y integer value.
   *   measureFromRight - if set to `true`, X coordinates will be
   *     swapped so that measurements are made from the right side
   *     instead of the left.
   *   measureFromBottom - if set to `true`, the Y coordinates will be
   *     swapped so that measurements are made from the bottom side
   *     instead of the top.
   *   mapFunctionX - sets a function to take an X coordinate input
   *     and return a modified coordinate.
   *   mapFunctionY - optional.  Sets a function to take a Y coordinate
   *     input and return a modified coordinate.
   *
   * See Also:
   *   <I3Internals.UserInterface.enableDragging>
   */
  @method init(handle, options) {
    if (options == null) options = {};
    
    // set event handler for starting the drag
    handle.onmousedown = self.start;
    
    // check to see if the handle has an onclick event.  If it does, then
    // copy it to _noDragClickHandler and set it to null
    if (handle.onclick != null) {
      handle.onNoDrag = handle.onclick;
      handle.onclick = null;
    }
    
    handle.measureFromRight   = options.measureFromRight;
    handle.measureFromBottom  = options.measureFromBottom;
    
    // set the container that will be moved; if none specified, uses `handle`
    if (options.container)
      handle.container = options.container;
    else
      handle.container = handle;
    
    // set the initial position of the container that will be moved
    if (!handle.measureFromRight && isNaN(parseInt(handle.container.style.left))) 
      handle.container.style.left = "0px";
    
    if (!handle.measureFromBottom && isNaN(parseInt(handle.container.style.top)))
      handle.container.style.top = "0px";
      
    if (handle.measureFromRight && isNaN(parseInt(handle.container.style.right)))
      handle.container.style.right = "0px";
      
    if (handle.measureFromBottom && isNaN(parseInt(handle.container.style.bottom)))
      handle.container.style.bottom = "0px";
    
    // set the constraints on the drag
		handle.minX = typeof options.minX != 'undefined' ? options.minX : null;
		handle.minY = typeof options.minY != 'undefined' ? options.minY : null;
		handle.maxX = typeof options.maxX != 'undefined' ? options.maxX : null;
		handle.maxY = typeof options.maxY != 'undefined' ? options.maxY : null;
    
    // set the function for modifying the x and y coordinates
		handle.mapFunctionX = options.mapFunctionX ? options.mapFunctionX : null;
		handle.mapFunctionY = options.mapFunctionY ? options.mapFunctionY : null;
    
    // set event handlers
    if (handle.container.onDragStart == null) handle.container.onDragStart = new Function();
		if (handle.container.onDragEnd == null)   handle.container.onDragEnd   = new Function();
		if (handle.container.onDrag == null)      handle.container.onDrag      = new Function();
  }
  
  /**
   * Method (Hidden): start
   * 
   * Called when a drag operation begins on the object.  Calls the user-supplied `onDragStart` 
   * function and passes in a hash that contains the following keys:
   * 
   *   x - the current 'x' coordinate
   *   y - the current 'y' coordinate
   *   handle - the element that acts as the drag handle
   *   container - the element that is moved when the handle is dragged.  It may be the same as 
   *     `handle`
   * 
   * It will also set the `onmousemove` and `onmouseup` events on `document`.  These will be 
   * unset by <end>.
   * 
   * Parameters:
   *   e - the event info
   * 
   * Returns:
   *   `false`
   */
  @method start(e) {
    e = I3.ui.getEvent(e);
    _eventArgs = e.getBaseEvent();
    
    _handle = this;
    var container = _handle.container;
    
    var x = self.getCoordinate("x");
    var y = self.getCoordinate("y");
    
    // Call the onDragStart function for user-definable action
		container.onDragStart({
		  x: x, 
		  y: y, 
		  container: container, 
		  handle: _handle
		});
		
		// get the coordinates of the mouse event
		var coords = e.getPageXY();
		_handle.lastMouseX	= coords[0];
		_handle.lastMouseY	= coords[1];
    
    // set the minimum and maximum x and y coordinates
		if (_handle.measureFromRight) {
			if (_handle.minX != null) _handle.maxMouseX = -_handle.minX + coords[0] + x;
			if (_handle.maxX != null) _handle.minMouseX = -_handle.maxX + coords[0] + x;
		} 
		else {
			if (_handle.minX != null) _handle.minMouseX	= coords[0] - x + _handle.minX;
			if (_handle.maxX != null) _handle.maxMouseX	= _handle.minMouseX + _handle.maxX - _handle.minX;
		}

		if (_handle.measureFromBottom) {
			if (_handle.minY != null) _handle.maxMouseY = -_handle.minY + coords[1] + y;
			if (_handle.maxY != null) _handle.minMouseY = -_handle.maxY + coords[1] + y;
		} 
		else {
			if (_handle.minY != null)	_handle.minMouseY	= coords[1] - y + _handle.minY;
			if (_handle.maxY != null)	_handle.maxMouseY	= _handle.minMouseY + _handle.maxY - _handle.minY;
		}

		_startingX = I3.ui.getElementOffsets(_handle).left;

		I3.ui.document.onmousemove = self.drag;
		I3.ui.document.onmouseup	 = self.end;

		return e.stopEvent();
  }
  
  /**
   * Method (Hidden): drag
   * 
   * Called repeatedly while a drag operation is in progress.  If the element moves more than 5 
   * pixels, it will disable any `onclick` event that may have been assigned to `handle`.
   * 
   * It will also ensure that the element is not dragged beyond that bounds set by `minX`, `maxX`, 
   * `minY`, and `maxY` in <init>.
   * 
   * Calls the user-supplied `onDrag` function and passes it the same object as `onDragStart`.
   * 
   * Parameters:
   *   e - the event info
   * 
   * Returns:
   *   `false`
   */
  @method drag(e) {
    e = I3.ui.getEvent(e);
    var coords = e.getPageXY();
    var container = _handle.container;
    
		var x = self.getCoordinate("x");
		var y = self.getCoordinate("y");
		var eventX = coords[0];
		var eventY = coords[1];
		
    if (_fireOriginalClickEvent) {
      // check to see if the movement was less than 5 pixels and set the 
      // handle's click event if it had one to fire on mouseup
      if (Math.abs(_startingX - x) > 5) _fireOriginalClickEvent = false;
    }
    
    if (_handle.minX != null) {
      if (_handle.measureFromRight) 
        eventX = Math.min(eventX, _handle.maxMouseX);
      else 
        eventX = Math.max(eventX, _handle.minMouseX);
    }
    
    if (_handle.maxX != null) {
      if (_handle.measureFromRight) 
        eventX = Math.max(eventX, _handle.minMouseX);
      else 
        eventX = Math.min(eventX, _handle.maxMouseX);
    }
    
    if (_handle.minY != null) {
      if (_handle.swapVerticle) 
        eventY = Math.min(eventY, _handle.maxMouseY);
      else 
        eventY = Math.max(eventY, _handle.minMouseY);
    }
    
    if (_handle.maxY != null) {
      if (_handle.measureFromBottom) 
        eventY = Math.max(eventY, _handle.minMouseY);
      else 
        eventY = Math.min(eventY, _handle.maxMouseY);
    }
    
		var newX = x + ((eventX-_handle.lastMouseX) * (_handle.measureFromRight ? -1:1));
		var newY = y + ((eventY-_handle.lastMouseY) * (_handle.measureFromBottom ? -1:1));
    
		if (_handle.mapFunctionX) newX = _handle.mapFunctionX(x);
		if (_handle.mapFunctionY) newY = _handle.mapFunctionY(y)

		container.style[_handle.measureFromRight ? "right":"left"] = newX + "px";
		container.style[_handle.measureFromBottom ? "bottom":"top"] = newY + "px";
		_handle.lastMouseX	= eventX;
		_handle.lastMouseY	= eventY;

		_handle.container.onDrag({
		  x: newX, 
		  y: newY, 
		  container: container, 
		  handle: _handle
		});
		
		return e.stopEvent();
  }
  
  /**
   * Method (Hidden): end
   * 
   * Called when the drag operation completes.  Fires any `onclick` event that is attached to 
   * `handle` if it hasn't moved farther than 5 pixels in any direction.
   * 
   * Calls the user-supplied `onDragEnd` function and passes it the same object as `onDragStart`.
   * Then it cleans up and unsets the `onmousemove` and `onmouseup` events on the `document`.
   * 
   * Parameters:
   *   e - the event info
   */
  @method end(e) {
    e = I3.ui.getEvent(e);
    
    var x = self.getCoordinate("x");
    var y = self.getCoordinate("y");
    
    // If the element hasn't moved, fire the original click event
    if (_fireOriginalClickEvent && _handle.onNoDrag && _eventArgs) _handle.onNoDrag(_eventArgs);
    
    // Reset all the information and call `onDragEnd`
    _fireOriginalClickEvent = true;
    _eventArgs = null;
    _startingX = null;
		I3.ui.document.onmousemove = null;
		I3.ui.document.onmouseup   = null;
		
		_handle.container.onDragEnd({
		  x: x, 
		  y: y,
		  container: _handle.container, 
		  handle: _handle
		});

		_handle = null;
		return e.stopEvent();
  }
  
  /**
   * Method (Hidden): getCoordinate
   *
   * Gets the current coordinate on `axis`.  If `measureFromRight` or `measureFromBottom` is 
   * specified, it will return the correct value for those calculations.
   *
   * Parameters:
   *   axis - a string "x" or "y"
   * 
   * Returns:
   *   An integer.
   */
  @method getCoordinate(axis) {
    if (_handle) {
      switch (axis.toLowerCase()) {
        case "x":
          if (_handle.measureFromRight) 
            return parseInt(_handle.container.style.right);
          else
            return parseInt(_handle.container.style.left);
          break;
      
        case "y":
          if (_handle.measureFromBottom)
            return parseInt(_handle.container.style.bottom);
          else
            return parseInt(_handle.container.style.top);
          break;
      }
    }
  }
  
}


// ---------------------------------------------------------------------------
// INTRANET 3 USER INTERFACE MANAGER
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.UserInterface
 *
 * Provides access to the i3 user interface.  This includes methods
 * for retrieving object references, setting up drag-and-drop, and
 * so on.  The DOM methods for creating and retrieving elements
 * (which would normally be called on the `document` object) have
 * equivalents here, since the architecture of the intranet renders
 * the applet's own `document` object useless.
 *
 * The shared instance of this class is provided by the `I3.ui` property.
 */
@class UserInterface() {
  
  // Drag-and-drop manager.  This stores references to elements that are
  // made draggable using the enableDrag method.
  var _dragManager = new I3Internals.DragManager();

  // List of action handlers and associated info for action links that
  // have been generated with the createActionLinkHTML method.
  var _actions = [];

  // DOM elements used for pop-up dialogs.
  var _dialogFaderDiv;
  var _dialogContainerDiv;
  var _dialogBorderDiv;
  var _dialogElement;
  var _dialogElementParent;
  
  // Constants for UI elements
  var POPUP_BORDER_SIZE = 8;
  
  /**
   * Property: document
   *
   * The document object for the applet content.
   *
   * Applets can use this property to gain access to the standard DOM
   * document methods, such as `getElementById()`.  In practice, however,
   * this property is rarely accessed directly, as <I3Internals.UserInterface>
   * provides various shortcut methods that are generally easier to work with.
   */
  self.document = window.document;

  /**
   * Method: get
   *
   * Returns the element with the given id.
   * Alias for `I3.ui.document.getElementById()`.
   *
   * Parameters:
   *   elementId - the id string of the desired element
   *
   * Returns:
   *   The requested DOM element.
   */
  @method get(elementId) {
    return document.getElementById(elementId);
  }
  
  /**
   * Method: getTags
   *
   * Returns all HTML elements with the given tag name.
   * Alias for `I3.ui.document.getElementsByTagName()`.
   * When used with the intranet client framework, it only returns
   * elements within the applet's content area.
   * 
   * Parameters:
   *   tagName - the tag name of the desired elements
   *
   * Returns:
   *   An array of DOM elements.
   */
  @method getTags(tagName) {
    var root = self.get("appletContent");
    if (root == null) root = self.document;
    return root.getElementsByTagName(tagName);
  }

  /**
   * Method: getParentWithTagName
   *
   * Returns the first parent node with the given tag name.
   * 
   * The `element` parameter can be either an element object or the
   * string ID of an element. 
   * 
   * The `options` parameter is a hash that can supply additional conditions.
   * The following options are recognized:
   * 
   *   className - the CSS class name required for the parent
   * 
   * Parameters:
   *   tagName - the tag name of the desired element
   *   element - the DOM element from which to start
   *   options - optional; hash of additional conditions
   * 
   * Returns:
   *   The matching DOM element, or `null` if no element could be found.
   */
  @method getParentWithTagName(tagName, element, options) {
    if (typeof element == "string") element = self.get(element);
    tagName = tagName.toLowerCase();
    var node = element.parentNode;
    if (options && options.className) {
      while (node != null && !(node.nodeName.toLowerCase() == tagName &&
                               self.elementHasClassName(node, options.className)))
        node = node.parentNode;
    } else {
      while (node != null && node.nodeName.toLowerCase() != tagName)
        node = node.parentNode;
    }
    return node;
  }
  
  /**
   * Method: text
   *
   * Creates a new text node with the given contents.
   * Alias for `I3.ui.document.createTextNode()`.
   *
   * Parameters:
   *   str - the string to place in the text node
   *
   * Returns:
   *   A text node DOM element containing the string.
   */
  @method text(str) {
    return document.createTextNode(str);
  }
  
  /**
   * Method: create
   *
   * Creates a new element of the given type.
   * Alias for `I3.ui.document.createElement()`.
   *
   * Parameters:
   *   tagName - the HTML tag of the new element
   *
   * Returns:
   *   The new DOM element.
   */
  @method create(tagName) {
    return document.createElement(tagName);
  }
  
  /**
   * Method: createWithContent
   *
   * Creates a new element of the given type and fills it with the supplied content.  
   * The content may be a String, an element, or an array of the previous two.
   * 
   * Multiple content parameters may also be passed in.
   * 
   * Example:
   * (start example)
   * var img = I3.ui.create("IMG");
   * 
   * // Multiple content elements using an `Array`
   * var element = I3.ui.createWithContent("DIV", ["Some Text", "Some More Text", img]);
   * 
   * // Multiple content elements using parameters
   * var element = I3.ui.createWithContent("DIV", "Some Text", "Some More Text", img);
   * 
   * // Multiple content elements using both
   * var element = I3.ui.createWithContent("DIV", ["Some Text", "Some More Text"], img);
   * (end example)
   * 
   * Parameters:
   *   tagName - the HTML tag of the new element
   *   content - the content to fill the new element with
   * 
   * Returns:
   *   The new DOM element.
   */
  @method createWithContent(tagName, content) {
    var element = document.createElement(tagName);
    if (content == null) return element;
    
    for (var i = 1; i < arguments.length; i++) {
      var arg = arguments[i];
      // Make sure we have an array.  If `content` is already an array, then it will add each of 
      // elements.  If it is not, then the new array will only have the one entry.
      arg = [].concat(arg);
      for (var j = 0; j < arg.length; j++) {
        var item = arg[j];
        if (typeof item == "string")
          element.appendChild(self.text(item));
        else
          element.appendChild(item);
      }
    }
    return element;
  }
  
  /**
   * Method: createCheckbox
   *
   * Creates a new checkbox input element.  Because of the inane way that 
   * IE handles the `checked` property when using standard DOM methods,
   * it will only take effect if the element is appended to the document
   * tree _before_ setting the value.  This method works around this
   * limitation.
   * 
   * This will return the element with only the necessary properties set.  
   * All other attributes (such as `id`, `className`) can be set normally
   * once the element has been created.
   * 
   * Parameters:
   *   isChecked - optional; set to `true` if the checkbox should be
   *     checked by default
   * 
   * Returns:
   *   The new DOM element.
   */
  @method createCheckbox(isChecked) {
    if (isChecked == null) isChecked = false;
    if (I3.browser.isIE()) {
      return self.create('<input type="checkbox"' +
        (isChecked ? " checked" : "") + ' />');
    } else {
      var element = self.create("input");
      element.type = "checkbox";
      if (isChecked) element.checked = true;
      return element;
    }
  }
  
  /**
   * Method: createRadioButton
   *
   * Creates a new radio button input element.  Because of the inane way
   * that IE handles (or doesn't handle as the case may be) radio button
   * creation, it has to be created in a special way if you want to
   * actually be able to click on and select the button.
   * 
   * This will return the element with only the necessary properties set.
   * All other attributes (such as `id`, `className`) can be set normally
   * once the element has been created.
   * 
   * Parameters:
   *   name - the string value to place in the `name` attribute
   *     of the radio button
   *   isChecked - optional; set to `true` if the radio button should be
   *     selected by default
   * 
   * Returns:
   *   The new DOM element.
   */
  @method createRadioButton(name, isChecked) {
    if (isChecked == null) isChecked = false;
    if (I3.browser.isIE()) {
      return self.create('<input type="radio" name="' + name + '"' + 
        (isChecked ? " checked" : "") + ' />');
    } else {
      var element = self.create("input");
      element.type = "radio";
      element.name = name;
      if (isChecked) element.checked = true;
      return element;
    }
  }
  
  /**
   * Method: createURLForDisplay
   *
   * Makes a display URL that does nothing.
   *
   * This is useful when you are handling the `onclick` event of a link,
   * but you need some URL for the `href` value of the link so that it
   * will be clickable.
   * 
   * The `actionText` will be displayed as part of the URL in the status
   * bar when the pointer is over the link.  Usually this will have a
   * "Action:Target" syntax, such as "ShowDetails:Joe Smith" or
   * "Remove:Classifieds".  It is used solely for user feedback.
   *
   * Parameters:
   *   actionText - the text to display in the virtual path
   *
   * Returns:
   *   A URL string that can be used as the `href` for a link.
   */
  @method createURLForDisplay(actionText) {
    actionText = actionText.replace(/[^0-9a-zA-Z:\/]+/g, "_");
    return "javascript:intranet('" + actionText + "')";
  }
  
  /**
   * Method: createActionLink
   *
   * Creates a hyperlink with a path that is used for display only.
   * The link will call the handler when it is clicked.
   * 
   * Additional information can be associated with the link via the
   * `info` parameter.  This information can then be retrieved in the
   * event handler using <I3.Event::getInfo>.  This is particularly useful
   * when creating action links in lists; you can place the item ID
   * or other identifying information about a single row in the `info`
   * parameter.
   *
   * The `actionText` will be displayed as part of the URL in the status
   * bar when the pointer is over the link.  Usually this will have a
   * "Action:Target" syntax, such as "ShowDetails:Joe Smith" or
   * "Remove:Classifieds".  It is used solely for user feedback, and
   * is ignored when the link is clicked.
   *
   * Parameters:
   *   contents - the content to place in the link, either a DOM element
   *     (created with `I3.ui.create()`) or a string
   *   info - an object to associate with the link, which can be retrieved
   *     by calling `getInfo()` on the click event object when the event
   *     is handled
   *   actionText - the text to display in the virtual path
   *   handler - the handler function to call when the link is clicked
   *
   * Returns:
   *   The hyperlink DOM element.
   */
  @method createActionLink(contents, info, actionText, handler) {
    if (typeof contents == "string") contents = self.text(contents);
    var elem = self.create("a");
    elem.href = self.createURLForDisplay(actionText);
    elem.i3extraInfo = info;
    elem.onclick = handler;
    elem.appendChild(contents);
    return elem;
  }

  /**
   * Method: createActionLinkHTML
   *
   * Creates an HTML-formatted string containing a hyperlink with a path
   * that is used for display only.  The link will call the handler when
   * it is clicked.
   * 
   * Additional information can be associated with the link via the
   * `info` parameter.  This information can then be retrieved in the
   * event handler using <I3.Event::getInfo>.  This is particularly useful
   * when creating action links in lists; you can place the item ID
   * or other identifying information about a single row in the `info`
   * parameter.
   *
   * The `actionText` will be displayed as part of the URL in the status
   * bar when the pointer is over the link.  Usually this will have a
   * "Action:Target" syntax, such as "ShowDetails:Joe Smith" or
   * "Remove:Classifieds".  It is used solely for user feedback, and
   * is ignored when the link is clicked.
   * 
   * *Do not overuse this method*.  The extra resources that are required
   * to emulate action link functionality in pure HTML are not released
   * until a new applet is loaded.  If possible, use <createActionLink>,
   * <createNavigationLink>, or <createNavigationLinkHTML> instead.
   *
   * Parameters:
   *   contents - the content to place in the link, either a DOM element
   *     (created with `I3.ui.create()`) or a string
   *   info - an object to associate with the link, which can be retrieved
   *     by calling `getInfo()` on the click event object when the event
   *     is handled
   *   actionText - the text to display in the virtual path
   *   handler - the handler function to call when the link is clicked
   *
   * Returns:
   *   The hyperlink HTML string.
   */
  @method createActionLinkHTML(contents, info, actionText, handler) {
    if (typeof contents != "string") {
      // Retrieve the HTML for the element.
      var tempDiv = I3.ui.create("div");
      tempDiv.appendChild(contents);
      contents = tempDiv.innerHTML;
    }
    var action = [handler, info];
    var actionIndex = _actions.length.toString();
    _actions.push(action);
    var eventParams = I3.browser.isIE() ? "null" : "event";
    var link = '<a href="' + self.createURLForDisplay(actionText) +
           '" onclick="return I3.ui.onActionClick(' + actionIndex +
           ', ' + eventParams + ');">' + contents + '</a>';
    return link;
  }

  /**
   * Private Method: onActionClick
   *
   * Called when an action link that has been generated using
   * <createActionLinkHTML> is clicked.  It retrieves the handler
   * and extra info from the `_actions` array and sets up the
   * event, emulating the behavior of a normal action link.
   *
   * Parameters:
   *   index - the index of the action in the `_actions` array
   *   e - the click event parameters
   */
  @method onActionClick(index, e) {
    var handler = _actions[index][0];
    var info = _actions[index][1];
    e = self.getEvent(e);
    e.getTarget().i3extraInfo = info;
    handler(e);
    return false;
  }
  
  /**
   * Private Method: clearActions
   *
   * Frees the resources used by action links that have been generated
   * using the <createActionLinkHTML> method.  This is called by the
   * applet loader when a new applet is loaded.
   */
  @method clearActions() {
    _actionMap = [];
  }
  
  /**
   * Method: createAlphaImage
   *
   * *Deprecated*
   * 
   * Creates an element that displays a PNG image with an alpha channel.
   * This used to be necessary because Internet Explorer 6 needed a
   * ridiculous CSS hack to get alpha transparency in PNG files to work.
   * Internet Explorer 7 and higher no longer need this hack, so there is
   * no longer a need for this method; images can be created normally.
   *
   * Example:
   * (start example)
   *   var img = I3.ui.createAlphaImage("/common/client-web/img/group-16.png", 16, 16);
   * (end example)
   *
   * Parameters:
   *   pngURL - the URL of the PNG image to be displayed
   *   width - the width of the image in pixels
   *   height - the height of the image in pixels
   *
   * Returns:
   *   A DOM element that displays the image.
   */
  @method createAlphaImage(pngURL, width, height) {
    itemImg = document.createElement("img");
    itemImg.src = pngURL;
    itemImg.width = width;
    itemImg.height = height;
    return itemImg;
  }

  /**
   * Method: show
   *
   * Displays a hidden DOM element.
   * 
   * The `element` parameter can be either an element object or the
   * string ID of an element.  The `style.display` property of the
   * element will be set to "block".
   *
   * Parameters:
   *   element - the DOM element to show
   *   displayStyle - optional; an alternate display style, such as "inline"
   *
   * Returns:
   *   The visible DOM element.
   */
  @method show(element, displayStyle) {
    if (typeof element == "string") element = self.get(element);
    if (displayStyle == null) displayStyle = "block";
    element.style.display = displayStyle;
    return element;
  }
  
  /**
   * Method: hide
   *
   * Hides a DOM element.
   *
   * The `element` parameter can be either an element object or the
   * string ID of an element.  The `style.display` property of the
   * element will be set to "none".
   *
   * Parameters:
   *   element - the DOM element to hide
   *
   * Returns:
   *   The hidden DOM element.
   */
  @method hide(element) {
    return self.show(element, "none");
  }

  /**
   * Method: clear
   *
   * Clears the contents (removes all children) of a DOM element.
   *
   * The `element` parameter can be either an element object or the
   * string ID of an element.
   *
   * Parameters:
   *   element - the DOM element to clear
   *
   * Returns:
   *   The cleared DOM element.
   */
  @method clear(element) {
    if (typeof element == "string") element = self.get(element);
    // The innerHTML property is faster than looping through and removing
    // children, but IE has a broken innerHTML implementation for some tags.
    if (I3.browser.isIE()) {
      switch(element.tagName.toLowerCase()) {
        case "col":
        case "colgroup":
        case "frameset":
        case "html":
        case "style":
        case "table":
        case "tbody":
        case "tfoot":
        case "thead":
        case "title":
        case "tr":
          while (element.hasChildNodes())
            element.removeChild(element.firstChild);
          break;
        default:
          element.innerHTML = "";
      }
    } else element.innerHTML = "";
    return element;
  }

  /**
   * Method: getElementOffsets
   *
   * Calculates the offsets in each direction of a DOM element.
   * 
   * Elements have `offsetLeft` and `offsetTop` properties that describe
   * the distance between the edge of the element and the edge of its
   * parent.  This method traverses the tree to get the total offsets from
   * the top and left edges of the document.  This is useful when absolutely
   * positioning elements on a page in relation to other elements that have
   * been laid out relatively.
   * 
   * The returned object has the following
   * fields:
   * 
   *   left - the distance between the left side of the `element`
   *     and the left side of the document
   *   right - the distance between the right side of the `element`
   *     and the left side of the document
   *   top - the distance between the top side of the `element`
   *     and the top of the document
   *   bottom - the distance between the bottom side of the `element`
   *     and the top of the document
   * 
   * All distances are in pixels.  Note that the `right` and `bottom`
   * values are calculated from the left and top of the document,
   * respectively; they are not the distances from the right edge and
   * bottom edge of the document.  Think of them as X and Y positions
   * of the sides of the `element`.
   *
   * The `element` parameter can be either an element object or the
   * string ID of an element.
   * 
   * Parameters:
   *   element - the DOM element to calculate offsets for
   * 
   * Returns:
   *   An object containing the offsets for each side of the `element`.
   */
  @method getElementOffsets(element) {
    if (typeof element == "string") element = self.get(element);

    var leftOffset = 0;
    var topOffset  = 0;
    
    var parent = element;
    while (parent) {
      leftOffset += parent.offsetLeft;
      topOffset += parent.offsetTop;
      
      if (parent.className == "i3popupContainer") {
        leftOffset += POPUP_BORDER_SIZE;
        topOffset  += POPUP_BORDER_SIZE;
      }
      
      parent = parent.offsetParent;
    }
    
    return { left: leftOffset, 
             right: leftOffset + element.offsetWidth, 
             top: topOffset, 
             bottom: topOffset + element.offsetHeight };
  }

  /**
   * Method: popupDialogWithElement
   *
   * Displays a modal in-browser dialog with the given contents.
   *
   * The `element` parameter can be either an element object or the
   * string ID of an element.
   * 
   * By default, the width of the dialog will be determined based on the
   * width of the `element`.  This means that the provided `element` should
   * always have an explicit width set, unless the `width` option is being
   * used.
   * 
   * The `options` parameter can be used to provide additional information
   * for the dialog.  The following keys are supported:
   * 
   *   title - specifies a string to display at the top of the dialog
   *   width - overrides the width of the dialog to the specified integer
   *     pixel value
   *   height - overrides the height of the dialog to the specified integer
   *     pixel value
   *   error - set to `true` for an alternate border style for error messages
   *     (note that <I3Internals.UserInterface::displayError> does this
   *     automatically and should be used in most cases for error messages)
   *   acceptButton - a hash of options describing the default button for
   *     the dialog
   *   cancelButton - a hash of options describing a button that closes
   *     the dialog with no action, or `true` to accept the default
   *     behavior and "Cancel" label
   *   extraButton - a hash of options describing a third button to display,
   *     commonly used for "Don't Save", "More Info...", etc.
   * 
   * Buttons:
   * 
   * If any button options are provided, the dialog will gain a button
   * section at the bottom that orders the buttons based on the platform.
   * On the Mac, the default (accept) button is on the far right, with the
   * cancel button to the left of it.  On other platforms, the positions
   * are swapped, with the cancel button in the far right.  If the extra
   * button is supplied, it is always placed on the far left of the dialog.
   * 
   * Each button is described by a set of key-value pairs.  The following
   * keys are supported:
   * 
   *   label - required; a verb to display on the button,
   *     such as "Save", "Add", or "Remove"
   *   onclick - optional; a method to call when the button is clicked.
   *     If omitted, the dialog will simply close when the button is clicked.
   * 
   * The cancel button is a special case.  It has a default label of
   * "Cancel" and a default `onclick` method that closes the dialog.
   * Passing in `true` for the `cancelButton` option will case these
   * defaults to be used.  The defaults can be overridden with options
   * if necessary.
   * 
   * Example:
   * (start example)
   *   var messageDiv = I3.ui.create("div");
   *   messageDiv.appendChild(I3.ui.text(
   *     "Are you sure you want to delete the Internet?"));
   *   I3.ui.popupDialogWithElement(messageDiv, {
   *     title: "Delete Internet",
   *     width: 500,
   *     acceptButton: { label: "Delete", onclick: self.onDeleteInternet },
   *     cancelButton: true
   *    });
   * (end example)
   * 
   * Parameters:
   *   element - the DOM element to display
   *   options - optional; the hash of additional options
   * 
   * See Also:
   *   <I3Internals.UserInterface::endPopupDialog>
   */
  @method popupDialogWithElement(element, options) {
    if (typeof element == "string") element = self.get(element);
    if (options == null) options = {};

    // Close any existing dialog.
    self.endPopupDialog();
    
    // Create a full-window div to fade the contents of the page
    // while the dialog is being displayed.
    _dialogFaderDiv = self.create("div");
    _dialogFaderDiv.className = "i3popupFader";
    self.setOpacity(_dialogFaderDiv, 0.75);
    document.body.appendChild(_dialogFaderDiv);
    
    // Create a full-window div in which the bordered content
    // will be positioned.
    _dialogContainerDiv = self.create("div");
    _dialogContainerDiv.className = "i3popupContainer";
    if (options.error == true)
        _dialogContainerDiv.className += " i3popupError"
    _dialogContainerDiv.style.visibility = "hidden";
    document.body.appendChild(_dialogContainerDiv);

    // Create the bordered content div and fill in the title
    // if applicable.
    _dialogBorderDiv = self.create("div");
    _dialogBorderDiv.className = "i3popupBorder";
    if (options.title && options.title.length > 0) {
      var titleDiv = self.create("div");
      titleDiv.className = "i3popupTitle";
      titleDiv.appendChild(self.text(options.title));
      _dialogBorderDiv.appendChild(titleDiv);
    }
    
    // Get the parent node for the element so that we can restore it later.
    _dialogElement = element;
    _dialogElementParent = _dialogElement.parentNode;

    // Move the element into the container.
    _dialogContainerDiv.appendChild(_dialogBorderDiv);
    _dialogBorderDiv.appendChild(_dialogElement);
    self.show(_dialogElement);
    
    // Add any buttons that have been defined.
    if (options.acceptButton || options.cancelButton || options.extraButton) {
      if (options.cancelButton == true) {
        options.cancelButton = { label: "Cancel" };
      }
      var buttonDiv = self.create("div");
      buttonDiv.className = "i3popupButtons";
      _dialogBorderDiv.appendChild(buttonDiv);
      var orderedButtons = [];
      orderedButtons.push(options.extraButton);
      orderedButtons.push(" ");  // Spacer
      if (I3.browser.isMac()) {
        orderedButtons.push(options.cancelButton);
        orderedButtons.push(options.acceptButton);
      } else {
        orderedButtons.push(options.acceptButton);
        orderedButtons.push(options.cancelButton);
      }
      var buttonTable = self.create("table");
      var buttonTBody = self.create("tbody");
      var buttonRow = self.create("tr");
      buttonTBody.appendChild(buttonRow);
      buttonTable.appendChild(buttonTBody);
      buttonDiv.appendChild(buttonTable);
      var buttonCell, button;
      for (var i = 0; i < orderedButtons.length; i++) {
        if (orderedButtons[i]) {
          buttonCell = self.create("td");
          buttonRow.appendChild(buttonCell);
          if (orderedButtons[i] == " ") {
            buttonCell.innerHTML = "&nbsp;";
            buttonCell.style.width = "100%";
          } else {
            button = self.create("input");
            button.type = "button";
            button.value = orderedButtons[i].label;
            if (orderedButtons[i].onclick)
              button.onclick = orderedButtons[i].onclick;
            else button.onclick = function() { self.endPopupDialog(); };
            buttonCell.appendChild(button);
            if (button.offsetWidth < 64) button.style.width = "64px";
          }
        }
      }
    }
    
    // Size the dialog based on the content.
    if (options.width) {
      if (typeof options.width != "string")
          options.width = options.width.toString() + "px";
      _dialogBorderDiv.style.width = options.width;
    } else {
      _dialogBorderDiv.style.width =
          (_dialogElement.offsetWidth + 8).toString() + "px";
    }
    if (options.height) {
      if (typeof options.height != "string")
          options.height = options.height.toString() + "px";
      _dialogBorderDiv.style.height = options.height;
    }

    // Position the top of the dialog in the upper third of the window.
    _dialogBorderDiv.style.marginTop = ( (_dialogContainerDiv.offsetHeight -
        _dialogBorderDiv.offsetHeight) / 3 ).toString() + "px";
    
    _dialogContainerDiv.style.visibility = "";
  }
  
  /**
   * Method: endPopupDialog
   *
   * Closes any open in-browser popup dialogs.
   * 
   * See Also:
   *   <I3Internals.UserInterface::popupDialogWithElement>
   */
  @method endPopupDialog() {
    if (_dialogElement) {
      self.hide(_dialogElement);
      if (_dialogElementParent)
          _dialogElementParent.appendChild(_dialogElement);
      _dialogElement = null;
      _dialogElementParent = null;
    }
    if (_dialogContainerDiv) {
      if (_dialogBorderDiv) {
        self.hide(_dialogBorderDiv);
        _dialogContainerDiv.removeChild(_dialogBorderDiv);
        _dialogBorderDiv = null;
      }
      self.hide(_dialogContainerDiv);
      document.body.removeChild(_dialogContainerDiv);
      _dialogContainerDiv = null;
    }
    if (_dialogFaderDiv) {
      self.hide(_dialogFaderDiv);
      document.body.removeChild(_dialogFaderDiv);
      _dialogFaderDiv = null;
    }
  }
  
  /**
   * Method: displayError
   *
   * Displays an error message to the user.  Applets that need to display
   * error messages should use this function so that error reporting is
   * consistent across the intranet.
   *
   * Parameters:
   *   errorInfo - the error information to be displayed.  This can be
   *     either an error object (see <I3::ServerApp::send_error>) or a
   *     simple string message.
   */
  @method displayError(errorInfo) {
    
    // Create an error object if only a string was supplied.
    if (typeof errorInfo == "string") {
      errorInfo = {
        title: "Error",
        message: "An error has occurred in the web application.",
        help: "Please notify Help Desk of this error:\n" + errorInfo
      };
    }
    
    // Make sure we have string values for all fields.
    if (errorInfo.title == null) errorInfo.title = "";
    if (errorInfo.message == null) errorInfo.message = "";
    if (errorInfo.help == null) errorInfo.help = "";
    
    // Create the elements that will be used to construct the error dialog.
    var errorDiv    = self.create("div");
    var messageDiv  = self.create("div");
    var helpDiv     = self.create("div");
    var buttonDiv   = self.create("div");
    var closeButton = self.create("input");
    
    // Fill in the dialog elements.
    var lines, i;
    lines = errorInfo.message.toString().split("\n");
    for (i = 0; i < lines.length; i++) {
      if (i > 0) messageDiv.appendChild(self.create("br"));
      messageDiv.appendChild(self.text(lines[i]));
    }
    lines = errorInfo.help.toString().split("\n");
    for (i = 0; i < lines.length; i++) {
      if (i > 0) helpDiv.appendChild(self.create("br"));
      helpDiv.appendChild(self.text(lines[i]));
    }
    
    // Construct and display the dialog.
    messageDiv.className = "i3popupErrorMessage";
    helpDiv.className = "i3popupErrorHelp";
    buttonDiv.className = "i3popupErrorButtons";
    errorDiv.appendChild(messageDiv);
    errorDiv.appendChild(helpDiv);
    errorDiv.appendChild(buttonDiv);
    self.popupDialogWithElement(errorDiv, {
        title: errorInfo.title.toString(),
        width: 500,
        error: true,
        acceptButton: { label: "OK" }
    });
  }

  /**
   * Method: getEvent
   *
   * Returns a new <I3.Event> for the given browser event, providing access
   * to event parameters in a browser-independent manner.
   * 
   * If the provided event object is already an <I3.Event> instance, it
   * will be returned unmodified.
   *
   * Parameters:
   *   e - the event parameter object provided to the handler, if any
   *
   * Returns:
   *   A cross-platform <I3.Event> object
   */
  @method getEvent(e) {
    if (e && e.constructor && e.constructor == I3.Event) return e;
    return new I3.Event(e);
  }

  /**
   * Method: enableDragging
   *
   * Enables drag-and-drop support for a DOM element.
   * 
   * The `element` parameter can be either an element object or the
   * string ID of an element.  An `options` hash can be provided to
   * further customize the behavior of the element.  The recognized
   * option keys are:
   * 
   *   container - specifies a container object for which `element`
   *     will be used as a handle.  If this is supplied, the container
   *     will be moved when the element is dragged.
   *   minX - limits horizontal dragging to a minimum X integer value.
   *   maxX - limits horizontal dragging to a maximum X integer value.
   *   minY - limits vertical dragging to a minimum Y integer value.
   *   maxY - limits vertical dragging to a maximum Y integer value.
   *   measureFromRight - if set to `true`, X coordinates will be
   *     swapped so that measurements are made from the right side
   *     instead of the left.
   *   measureFromBottom - if set to `true`, the Y coordinates will be
   *     swapped so that measurements are made from the bottom side
   *     instead of the top.
   *   mapFunctionX - sets a function to take an X coordinate input
   *     and return a modified coordinate.
   *   mapFunctionY - optional.  Sets a function to take a Y coordinate
   *     input and return a modified coordinate.
   *
   * You can attach functions to the draggable element to handle drag events.
   * The `onDragStart(options)` handler will be called when the drag operation
   * begins.  The `onDrag(options)` handler will be called repeatedly as the
   * object is dragged.  The `onDragEnd(options)` handler will be called when
   * the object is dropped.
   * 
   * The `options` hash that is passed to each of the three drag functions 
   * contain the following keys:
   * 
   *   x - the current 'x' coordinate
   *   y - the current 'y' coordinate
   *   handle - the element that acts as the drag handle
   *   container - the element that is moved when the handle is dragged.  
   *     It may be the same as the handle
   * 
   * Once drag-and-drop support has been added to an element, clicking on
   * the element will have no effect once the element has been moved more 
   * than 5 pixels in any direction.
   * 
   * Example:
   * (start example)
   *   var elem = I3.ui.get("someElement");
   *   elem.onDragStart = function(options) {
   *     // Code for when dragging starts.
   *   }
   *   elem.onDrag = function(options) {
   *     // Code for while dragging is taking place
   *     // (such as hover effects).
   *   }
   *   elem.onDragEnd = function(options) {
   *     // Code for when dragging ends.
   *   }
   *   I3.ui.enableDragging(elem);
   * (end example)
   *
   * Parameters:
   *   element - the DOM element to which drag-and-drop support will
   *     be added
   *   options - a hash of options.  See above more more details.
   */
  @method enableDragging(element, options) {
    if (typeof element == "string") element = self.get(element);
    if (options == null) options = {};
    _dragManager.init(element, options);
  }
  
  /**
   * Method: setTitle
   *
   * Sets the title of the page.
   * 
   * When used with the full i3 client framework, the title appears in both
   * the window title and at the top of the page.  Normally you will not
   * need to set this yourself; the i3 framework automatically uses the title
   * specified in the applet's HTML file.
   * 
   * Parameters:
   *   newTitle - the new title for the page
   */
  @method setTitle(newTitle) {
    document.title = newTitle + " - " + I3.config.getTitle();
    var appletTitleElement = I3.ui.get("appletTitle");
    if (appletTitleElement != null) appletTitleElement.innerHTML = newTitle;
  }
  
  /**
   * Method: addEventListener
   *
   * Attaches a function to a particular event.
   *
   * Parameters:
   *   element - the element that we are attaching the listener to
   *   eventName - the name of the event (i.e. "click", "mousedown", etc.)
   *   method - a reference to the function that is called when this event
   *     is triggered
   */
  @method addEventListener(element, eventName, method) {
    if (typeof element == "string") element = self.get(element);
    if (element.attachEvent) // for IE
      element.attachEvent("on" + eventName, method);
    else if (element.addEventListener) // Mozilla, W3C
      element.addEventListener(eventName, method, true);
    else
      element["on" + eventName] = method;
  }
  
  /**
   * Method: removeEventListener
   *
   * Removes a function from an event's stack.
   *
   * Parameters:
   *   element - the element whose event stack we are checking
   *   eventName - the name of the event (i.e. "click", "mousedown", etc.)
   *   method - a reference to the function that we are removing
   */
  @method removeEventListener(element, eventName, method) {
    if (typeof element == "string") element = self.get(element);
    if (element.detachEvent) // for IE
      element.detachEvent("on" + eventName, method);
    else if (element.removeEventListener) // Mozilla, W3C
      element.removeEventListener(eventName, method, true);
    else
      element["on" + eventName] = null;
  }
  
  /**
   * Method: addKeyEventListener
   *
   * Attaches a function to fire when a particular key is pressed.  The keycode should be one of 
   * the <KEYCODES> constants.  The event will be fired during the `onkeypress` event.  
   * 
   * When `method` is fired, the event information will be passed through as an <I3.Event> object.
   * 
   * NOTE: this event cannot be removed.
   *
   * Parameters:
   *   element - a string or element to attach the event to
   *   keycode - one of the <I3.Event> keycode constants
   *   method  - a method to fire when `keycode` is pressed
   */
  @method addKeyEventListener(element, keycode, method) {
    if (typeof element == "string") element = self.get(element);
    self.addEventListener(element, "keypress", function(e) {
      e = self.getEvent(e);
      if (e.getKeyCode() == keycode) method(e);
    });
  }
  
  /**
   * Method: addClassToElement
   *
   * Adds a CSS class to an element
   *
   * Parameters:
   *   element - the element we are adding the class to
   *   className - the CSS class name we are adding
   */
  @method addClassToElement(element, className) {
    if (typeof element == "string") element = self.get(element);
    if (element.className.indexOf(className) == -1)
      element.className += " " + className;
  }
  
  /**
   * Method: removeClassFromElement
   *
   * Removes a specific CSS class from an element while leaving all the rest
   * intact
   * 
   * Parameters:
   *   element - the element we are removing the class from
   *   className - the CSS class name to remove from the element
   */
  @method removeClassFromElement(element, className) {
    if (typeof element == "string") element = self.get(element);
    var classes = element.className.split(" ");
    var saved = [];
    for (var i=0; i<classes.length; i++) {
      if (classes[i] != className) saved.push(classes[i]);
    }
    element.className = saved.join(" ");
  }
  
  /**
   * Method: toggleClassOnElement
   *
   * Toggle the supplied `className` on `element` by adding it or removing it.  If the optional 
   * argument `state` is provided, it will ensure that the class is added or not based on the 
   * boolean value of `state`.
   *
   * Parameters:
   *   element - a `String` ID or element reference
   *   className - a `String`
   *   state - (optional) a `Boolean`; forces the addition or removal of the class
   */
  @method toggleClassOnElement(element, className, state) {
    if (typeof element == "string") element = self.get(element);
    var classExists = self.elementHasClassName(element, className);
    if (state == true) {
      if (classExists) return;
      else self.addClassToElement(element, className);
    }
    else if (state == false) {
      if (classExists) self.removeClassFromElement(element, className);
      else return;
    }
    else {
      if (classExists)
        self.removeClassFromElement(element, className);
      else
        self.addClassToElement(element, className);
    }
  }
  
  /**
   * Method: elementHasClassName
   *
   * Returns true if the element currently has `className` assigned to it; 
   * false otherwise
   *
   * Parameters:
   *   element - the element to test
   *   className - the class name to look for
   */
  @method elementHasClassName(element, className) {
    if (typeof element == "string") element = self.get(element);
    var classes = element.className.split(" ");
    for (var i=0; i<classes.length; i++) 
      if (className == classes[i]) return true;
    return false;
  }

  /**
   * Method: setOpacity
   *
   * Sets the opacity of an element to a percentage.
   *
   * Parameters:
   *   element - the DOM element to adjust
   *   opacity - the opacity as a floating-point value from `0` to `1`,
   *     where `0` is invisible and `1` is fully opaque.
   */
  @method setOpacity(element, opacity) {
    // This will be overridden by the appropriate browser-specific version
    // during the initialization of the class.
  }

  /**
   * Private Method: _setOpacityStd
   * Standards-compliant version of the `setOpacity` method.
   */
  @method _setOpacityStd(element, opacity) {
    // Mozilla and Safari support the standard opacity setting.
    element.style.opacity = opacity;
  }
  
  /**
   * Private Method: _setOpacityIE
   * IE-specific version of the `setOpacity` method.
   */
  @method _setOpacityIE(element, opacity) {
    // IE requires an MS-proprietary filter.
    if (opacity < 1) {
      element.style.filter =
        "progid:DXImageTransform.Microsoft.Alpha(opacity=" +
        Math.ceil(opacity * 100).toString() + ")";
    }
    else {
      element.style.filter = "";
    }
  }

  // Override the setOpacity method based on the browser.
  if (I3.browser.isIE()) self.setOpacity = self._setOpacityIE;
  else self.setOpacity = self._setOpacityStd;
  
  
  /**
   * Private Method: _configureSiteSearchBox
   *
   * Configures the site search box.
   *
   * Parameters:
   *   element - a `String` ID or element reference to the search box
   */
  @method _configureSiteSearchBox(element) {
    if (typeof element == "string") element = self.get(element);
    
    var PROMPT = "Search the Intranet";
    
    // Make sure we are starting off right
    if (!self.elementHasClassName(element, "empty")) {
      self.addClassToElement(element, "empty");
      element.value = PROMPT;
    }
    
    // Set the event handlers
    element.onfocus = function(e) {
      if (self.elementHasClassName(element, "empty")) {
        self.removeClassFromElement(element, "empty");
        element.value = "";
      }
    }
    element.onblur = function(e) {
      if (element.value.length == 0) {
        I3.ui.addClassToElement(element, "empty");
        element.value = PROMPT;
      }
    }
    element.onkeydown = function(e) {
      e = self.getEvent(e);
      if (e.getKeyCode() == 13) 
        I3.client.navigateTo("/search/?q=" + encodeURIComponent(element.value));
    }
  }
}


// ---------------------------------------------------------------------------
// INTRANET 3 DYNAMIC HTML UTILITIES
// ---------------------------------------------------------------------------

/**
 * Class: I3Internals.Utilities
 *
 * A set of utility methods for working with JavaScript objects.
 * Useful code that is common to web applications but isn't a core
 * part of all web clients goes here.
 *
 * The shared instance of this class is provided by the `I3.util` property.
 */
@class Utilities {
  
  /**
   * Constant: LONG_DAY_NAMES
   * An array of the full names of the days of the week 
   * (i.e. "Monday", "Tuesday", etc.)
   */
  var LONG_DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", 
    "Thursday", "Friday", "Saturday"];
  
  /**
   * Constant: SHORT_DAY_NAMES
   * An array of the shortened names of the days of the week 
   * (i.e. "Mon", "Tue", etc.)
   */
  var SHORT_DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  
  /**
   * Constant: LONG_MONTH_NAMES
   * An array of the full names of the months
   * (i.e. "January", "February", etc.)
   */
  var LONG_MONTH_NAMES = ["January", "February", "March", "April", "May", 
    "June", "July", "August", "September", "October", "November", "December"];

  /**
   * Constant: SHORT_MONTH_NAMES
   * An array of the shortened names of the months
   * (i.e. "Jan", "Feb", etc.)
   */
  var SHORT_MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", 
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  /**
   * Method: extend
   *
   * Extends an existing class or object with methods from another.
   * 
   * Parameters:
   *   target - the class or object to be extended
   *   category - the class or object providing the new methods
   */
  @method extend(target, category) {
    if (typeof target == "function") target = target.prototype;
    if (typeof category == "function") category = new category();
    for (var m in category) target[m] = category[m];
  }
  
  /**
   * Method: trim
   *
   * Removes whitespace from the beginning and end of a string.
   *
   * Parameters:
   *   str - the string to trim
   * 
   * Returns:
   *   The trimmed string
   */
  @method trim(str) {
    return str.replace(/^\s*|\s*$/g, "");
  }

  /**
   * Method: formatWithCommas
   *
   * Formats a number with commas between group of thousands.
   *
   * Parameters:
   *   num - the number to be formatted (either an `int` or a `float`)
   *   decimal - (optional) the number of fixed decimal points
   *
   * Returns:
   *   A string representation of the value with thousands separators.
   */
  @method formatWithCommas(num, decimal) {
    var value;
    if (decimal == null)
      value = num.toString();
    else
      value = num.toFixed(decimal);
    // Code by Shawn Milo (milo@linuxmail.org).
    while (value.match(/^\d\d{3}/)) {
      value = value.replace(/(\d)(\d{3}(\.|,|$))/, '$1,$2');
    }
    return value;
  }
  
  /**
   * Method: isValidEmailAddress
   *
   * Checks a string to determine if it is a valid e-mail address. E-mail 
   * addresses are considered valid if they contain, at minimum, one 
   * at sign (@), and a domain that has at least two components 
   * (e.g. "gmail.com").
   *
   * Parameters:
   *   str - a string containing a possible email address
   * 
   * Returns:
   *   `true` if the string contains a valid email address, 
   *   `false` otherwise
   */
  @method isValidEmailAddress(str) {
    if (str.match(/^[^ ]+@[^ ]+\.[^ ]+$/)) return true;
    return false;
  }
  
  /**
   * Method: testObjectClass
   *
   * Tests the supplied object `obj` against the supplied class `klass`.  Since objects could be 
   * created either in the main window, or the applet window, it will check both constructors.
   * 
   * Parameters:
   *   obj   - the object the test
   *   klass - a String representing the name of the class to check (e.g. "Array").
   *           Note: the string must be capitalized as appropriate to correspond to the class.
   */
  @method testObjectClass(obj, klass) {
    var aw = I3.client.appletLoader ? I3.client.appletLoader.getAppletWindow() : window;
    return (obj.constructor == window[klass] || obj.constructor == aw[klass]);
  }

  /**
   * Method: distanceOfTimeInWords
   *
   * Returns a representation of the number of minutes in word form,
   * such as "less than a minute", "about one day", and so on.
   *
   * Parameters:
   *   minutes - the number of minutes to display
   *
   * Returns:
   *   A string representation of the time distance in word form.
   */
  @method distanceOfTimeInWords(minutes) {
    // Based on code from the Typo project (http://typo.leetsoft.com/).
    if (minutes.isNaN) return "";
    minutes = Math.abs(Math.ceil(minutes));
    if (minutes < 1) return ('less than a minute');
    if (minutes < 50) return (minutes + ' minute' + (minutes==1 ? '' : 's'));
    if (minutes < 90) return ('about one hour');
    if (minutes < 1080) return (Math.round(minutes / 60) + ' hours');
    if (minutes < 1440) return ('one day');
    if (minutes < 2880) return ('about one day');
    else return (Math.round(minutes / 1440) + ' days');
  }

  /**
   * Method: formatFriendlyDate
   *
   * Returns a friendly localized version of the date, such as
   * "6 minutes ago" or "2 days from now".  If the date is more
   * than eight weeks ago, the localized date string is returned.
   *
   * Parameters:
   *   theDate - the `Date` object to format
   *   allowFutureDates - optional; boolean describing whether dates
   *     in the future ("from now") should be allowed.  When `false`,
   *     any dates in the future will be regarded as "less than a minute
   *     ago".  Defaults to `false`.
   *
   * Returns:
   *   The friendly localized string.
   */
  @method formatFriendlyDate(theDate, allowFutureDates) {
    if (!theDate || typeof theDate == "string") theDate = new Date(theDate);
    
    // Based on code from the Typo project (http://typo.leetsoft.com/).
    var now = new Date();
    var deltaMinutes = Math.floor((now - theDate) / (60 * 1000));
    if (deltaMinutes < 0 && allowFutureDates != true) deltaMinutes = 0;
    if (Math.abs(deltaMinutes) <= (8 * 7 * 24 * 60)) {
      distance = self.distanceOfTimeInWords(deltaMinutes);
      if (deltaMinutes < 0) {
        return distance + ' from now';
      } else {
        return distance + ' ago';
      }
    } else {
      // Over eight weeks ago.
      return 'on ' + theDate.toLocaleDateString();
    }
  }
  
  /**
   * Method: createSortFunctionForProperty
   *
   * Creates a function for sorting an array by an object property.
   * This is useful when an array of objects needs to be sorted by
   * a particular field, such as sorting an array of user objects
   * by their full names.
   *
   * Example:
   * (start example)
   *   arr = [
   *     { name: "Bill", product: "Windows" },
   *     { name: "Linus", product: "Linux" },
   *     { name: "Steve", product: "Mac OS X" } ];
   *   arr.sort(I3.util.createSortFunctionForProperty("product"));
   * (end example)
   *
   * Parameters:
   *   prop - the name of the property to sort by.  Object hierarchies can
   *     be traversed by using the dot notation, e.g. "address.city".
   *
   * Returns:
   *   A `function` that can be passed to the `sort` method of an `Array`.
   */
  @method createSortFunctionForProperty(prop) {
    return new Function("a", "b", 
      "strA = a." + prop + " ? a." + prop + ".toString().toLowerCase() : ''; " + 
      "strB = b." + prop + " ? b." + prop + ".toString().toLowerCase() : ''; " + 
      "if (strA < strB) return -1; " + 
      "else if (strA > strB) return 1; " + 
      "else return 0; ");
  }

  /**
   * Method: createSortFunctionForDateProperty
   *
   * Creates a function for sorting an array by an object date property.
   * This is useful when an array of objects needs to be sorted by
   * a particular date field, such as sorting an array of journal entries.
   *
   * Parameters:
   *   prop - the name of the property to sort by.  Object hierarchies can
   *     be traversed by using the dot notation, e.g. "alert.created_at".
   *
   * Returns:
   *   A `function` that can be passed to the `sort` method of an `Array`.
   */
  @method createSortFunctionForDateProperty(prop) {
    return new Function("a", "b", 
      "dateA = new Date(a." + prop + " ? a." + prop + " : ''); " + 
      "dateB = new Date(b." + prop + " ? b." + prop + " : ''); " + 
      "if (dateA < dateB) return -1; " + 
      "else if (dateA > dateB) return 1; " + 
      "else return 0; ");
  }

  /**
   * Method: formatDate
   *
   * Returns a string representing the supplied date in the given format.
   * 
   * Format:
   *   - %a is replaced by the locale's abbreviated weekday name.
   *   - %A is replaced by the locale's full weekday name.
   *   - %b is replaced by the locale's abbreviated month name.
   *   - %B is replaced by the locale's full month name.
   *   - %c is replaced by the locale's appropriate date and time representation.
   *   - %C is replaced by the century number as a decimal number [00-99].
   *   - %d is replaced by the day of the month as a decimal number [01,31].
   *   - %D same as %m/%d/%y.
   *   - %e is replaced by the day of the month as a decimal number [1,31]
   *   - %h same as %b.
   *   - %H is replaced by the hour (24-hour clock) as a decimal number [00,23].
   *   - %I is replaced by the hour (12-hour clock) as a decimal number [01,12].
   *   - %j is replaced by the day of the year as a decimal number [001,366].
   *   - %k is replaced by the hour (24-hour clock) as a decimal number without leading zero [0,23].
   *   - %l is replaced by the hour (12-hour clock) as a decimal number without leading zero [1,12].
   *   - %m is replaced by the month as a decimal number [01,12].
   *   - %M is replaced by the minute as a decimal number [00,59].
   *   - %n is replaced by a newline character.
   *   - %p is replaced by the locale's equivalent of either AM or PM.
   *   - %P is replaced by the locale's equivalent of either am or pm.
   *   - %r is replaced by the time in 12 hour notation; equivalent to %I:%M:%S %p.
   *   - %R is replaced by the time in 24 hour notation (%H:%M).
   *   - %S is replaced by the second as a decimal number [00,61].
   *   - %t is replaced by a tab character.
   *   - %T is replaced by the time (%H:%M:%S).
   *   - %u is replaced by the weekday as a decimal number [1,7], with 1 representing Monday.
   *   - %w is replaced by the weekday as a decimal number [0,6], with 0 representing Sunday.
   *   - %x is replaced by the locale's appropriate date representation.
   *   - %X is replaced by the locale's appropriate time representation.
   *   - %y is replaced by the year without century as a decimal number [00,99].
   *   - %Y is replaced by the year with century as a decimal number.
   *   - %Z is replaced by the timezone offset in hours from UTC.
   *   - %% is replaced by %.
   *
   * Parameters:
   *   theDate - a Date object
   *   formatString - a UNIX-standard date format string; see above for valid values
   */
  @method formatDate(theDate, formatString) {
    if (theDate.getFullYear() < 1970 || theDate == "Invalid Date") return "";
    
    var SECOND = 1000;
    var MINUTE = SECOND * 60;
    var HOUR   = MINUTE * 60;
    var DAY    = HOUR * 24;
    var WEEK   = DAY * 7;
    
    var month     = theDate.getMonth();
    var day       = theDate.getDate();
    var year      = theDate.getFullYear();
    var dayOfWeek = theDate.getDay();
    var hour      = theDate.getHours();
    var minute    = theDate.getMinutes();
    var second    = theDate.getSeconds();
    var isPM      = hour >= 12;
    var hour12    = hour - 12 == 0 ? hour - 12 : 12;
    
    var now = new Date(
      theDate.getFullYear(), theDate.getMonth(), theDate.getDate(), 0, 0, 0);
    var then = new Date(theDate.getFullYear(), 0, 0, 0, 0, 0);
    var diff = now - then;
    
    var dOY       = Math.floor(diff / DAY); // the day of the year
    

    var map   = {};
    map["%a"] = SHORT_DAY_NAMES[dayOfWeek];
    map["%A"] = LONG_DAY_NAMES[dayOfWeek];
    map["%b"] = SHORT_MONTH_NAMES[month];
    map["%B"] = LONG_MONTH_NAMES[month];
    map["%c"] = theDate.toLocaleString();
    map["%C"] = 1 + Math.floor(year / 100);
    map["%d"] = day < 10 ? ("0" + day) : day;
    map["%e"] = day;
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
    map["%s"] = Math.floor(theDate.getTime() / 1000);
    map["%S"] = second < 10 ? ("0" + second) : second;
    map["%t"] = "\t";
    map["%u"] = dayOfWeek + 1;
//  map["%U"] = week number
    map["%w"] = dayOfWeek;
    map["%x"] = theDate.toLocaleDateString();
    map["%X"] = theDate.toLocaleTimeString();
    map["%y"] = ("" + year).substr(2,2);
    map["%Y"] = year;
    map["%Z"] = theDate.getTimezoneOffset() / 60 * -1;
    map["%%"] = "%";

    map["%D"] = map["%m"] + "/" + map["%d"] + "/" + map["%y"];  // American Date Style: %m/%d/%y
    map["%h"] = map["%b"];
    map["%r"] = map["%I"] + ":" + map["%M"] + ":" + map["%S"] + " " + map["%p"];
    map["%R"] = map["%H"] + ":" + map["%M"];
    map["%T"] = map["%H"] + ":" + map["%M"] + ":" + map["%S"];  // time in 24hr notation: %H:%M:%S

    var pattern = /%./g;

    return formatString.replace(pattern, function(ptrn) {
      return map[ptrn] || ptrn; });
  }
}


// ---------------------------------------------------------------------------
// DISPLAY FUNCTION
// ---------------------------------------------------------------------------

/**
 * Private Function: intranet
 *
 * Function that does nothing.  This is used when we need to provide the
 * browser with a link but we don't want it to actually go anywhere (usually
 * because we're handling the onclick event).
 * 
 * Several methods in <I3Internals.UserInterface> create URLs that call
 * this function.
 *
 * Parameters:
 *   theTitle - the title of the display-only "destination"; ignored
 */
function intranet(theTitle) { return void(0); }


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

/**
 * Property: browser
 * Shared instance of <I3Internals.BrowserDetector>, the browser
 * detection object.
 */
I3.browser = new I3Internals.BrowserDetector();

/**
 * Property: client
 * Shared instance of <I3Internals.Client>, the web client library.
 */
I3.client = new I3Internals.Client();

/**
 * Property: ui
 * Shared instance of <I3Internals.UserInterface>, the user interface
 * manager.
 */
I3.ui = new I3Internals.UserInterface();

/**
 * Property: util
 * Shared instance of <I3Internals.Utilities>, a collection of useful
 * JavaScript functions.
 */
I3.util = new I3Internals.Utilities();


// ---------------------------------------------------------------------------
// COMMON EVENT OBJECT
// ---------------------------------------------------------------------------

/**
 * Class: I3.Event
 *
 * Provides a cross-platform way of accessing events.  This makes it much
 * easier to deal with the (sometimes quite significant) differences between
 * browsers when it comes to event handling.
 *
 * To get an instance of this class, call `I3.ui.getEvent(e)` from within
 * your event handler.  For example:
 *
 * (start example)
 *   @method onButtonClick(e) {
 *     e = I3.ui.getEvent(e);
 *     var button = e.getTarget();
 *     // Do something with the button here.
 *   }
 * (end example)
 *
 * Parameters:
 *   e - the event object provided to the event handler, if any
 */
@class Event(e) {
  
  var _baseEvent = e ? e : window.event;
  
  // Most of these methods are based on code from:
  //   http://www.quirksmode.org/dom/w3c_events.html
  
  /**
   * Method (Hidden): getBaseEvent
   *
   * Returns the original event object that the browser provided.
   * This is for internal use by other i3 framework classes, e.g. <DragManager>.
   */
  @method getBaseEvent() {
    return _baseEvent;
  }
  
  /**
   * Method: getType
   * Returns the integer type of the event.
   */
  @method getType() {
    return _baseEvent.type;
  }
  
  /**
   * Method: getTarget
   * Returns the target element of the event.
   */
  @method getTarget() {
    // Mozilla gives us the anchor that was clicked (the correct behavior).
    // IE gives us the anchor, but calls it srcElement instead.
    // Safari calls it target, but gives us the contents of the anchor.
    // This provides the Mozilla behavior on all platforms.
    var targ = _baseEvent.target ? _baseEvent.target : _baseEvent.srcElement;
    if (targ.parentNode.nodeName.toLowerCase() == "a") targ = targ.parentNode;
    return targ;
  }
  
  /**
   * Method: getInfo
   *
   * Returns the info field of the target.
   * 
   * This is only applicable to links created using
   * <I3Internals.UserInterface::createActionLink>.
   */
  @method getInfo() {
    return self.getTarget().i3extraInfo;
  }
  
  /**
   * Method: getPageXY
   *
   * Returns the mouse position relative to the document.
   *
   * The position is returned as the array `[x, y]`.
   */
  @method getPageXY() {
    var posx = 0;
    var posy = 0;
    if (_baseEvent.pageX || _baseEvent.pageY) {
      // Mozilla and Safari provide methods for obtaining this
      posx = _baseEvent.pageX;
      posy = _baseEvent.pageY;
    } else if (_baseEvent.clientX || _baseEvent.clientY) {
      posx = _baseEvent.clientX + document.body.scrollLeft;
      posy = _baseEvent.clientY + document.body.scrollTop;
    }
    return [posx, posy];
  }
  
  /**
   * Method: getKeyCode
   * Returns the integer code of the key that was pressed.
   */
  @method getKeyCode() {
    return _baseEvent.keyCode;
  }
  
  /**
   * Method: getKeyChar
   * Returns a string representation of the key that was pressed.
   */
  @method getKeyChar() {
    return String.fromCharCode(self.getKeyCode());
  }
  
  /**
   * Method: cancelBubble
   * 
   * *Deprecated*
   * 
   * Use <stopEvent> instead.
   */
  @method cancelBubble() {
    _baseEvent.cancelBubble = true;
  }
  
  /**
   * Method: stopEvent
   * 
   * Stops event propagation and prevents the default browser behavior.
   * Use when all desired event processing has already taken place.
   * 
   * This method always returns `false`, so it can be used as a return
   * value for event handlers.
   */
  @method stopEvent() {
    if (I3.browser.isIE()) {
      _baseEvent.cancelBubble = true;
      _baseEvent.returnValue  = false;
    }
    else {
      _baseEvent.preventDefault();
      _baseEvent.stopPropagation();
    }
    return false;
  }
  
  /**
   * Method: getShiftKey
   * Returns true if the shift key was held during the event.
   */
  @method getShiftKey() {
    return _baseEvent.shiftKey;
  }
  
  /**
   * Method: getAltKey
   * Returns true if the alt key was held during the event.
   */
  @method getAltKey() {
    return _baseEvent.altKey;
  }
  
  /**
   * Method: getCtrlKey
   * Returns true if the control key was held during the event.
   */
  @method getCtrlKey() {
    return _baseEvent.ctrlKey;
  }
  
}


/**
 * Constant: KEYCODES
 * 
 * Defines the different event key codes as constants.  They are as follows:
 * 
 *   o I3.Event.KEYCODE_BACKSPACE
 *   o I3.Event.KEYCODE_TAB
 *   o I3.Event.KEYCODE_ENTER
 *   o I3.Event.KEYCODE_SHIFT
 *   o I3.Event.KEYCODE_CONTROL
 *   o I3.Event.KEYCODE_ESCAPE
 *   o I3.Event.KEYCODE_SPACEBAR
 *   o I3.Event.KEYCODE_PAGE_UP
 *   o I3.Event.KEYCODE_PAGE_DOWN
 *   o I3.Event.KEYCODE_END
 *   o I3.Event.KEYCODE_HOME
 *   o I3.Event.KEYCODE_LEFT_ARROW
 *   o I3.Event.KEYCODE_UP_ARROW
 *   o I3.Event.KEYCODE_RIGHT_ARROW
 *   o I3.Event.KEYCODE_DOWN_ARROW
 *   o I3.Event.KEYCODE_DELETE
 */

I3.Event.KEYCODE_BACKSPACE        = 8;
I3.Event.KEYCODE_TAB              = 9;
I3.Event.KEYCODE_ENTER            = 13;
I3.Event.KEYCODE_SHIFT            = 16;
I3.Event.KEYCODE_CONTROL          = 17;
I3.Event.KEYCODE_ESCAPE           = 27;
I3.Event.KEYCODE_SPACEBAR         = 32;
I3.Event.KEYCODE_PAGE_UP          = 33;
I3.Event.KEYCODE_PAGE_DOWN        = 34;
I3.Event.KEYCODE_END              = 35;
I3.Event.KEYCODE_HOME             = 36;
I3.Event.KEYCODE_LEFT_ARROW       = 37;
I3.Event.KEYCODE_UP_ARROW         = 38;
I3.Event.KEYCODE_RIGHT_ARROW      = 39;
I3.Event.KEYCODE_DOWN_ARROW       = 40;
I3.Event.KEYCODE_DELETE           = 46;



// ---------------------------------------------------------------------------
// HTTP RESPONSE OBJECT
// ---------------------------------------------------------------------------

/**
 * Class: I3.ObjectResponse
 *
 * Encapsulates the results of an asynchronous HTTP request.
 *
 * Instances of this class are provided as parameters to the handler
 * functions called when an asynchronous request completes (i.e. a
 * request started by `I3.client.getObject`, `I3.client.putObject`,
 * `I3.client.postObject`, or `I3.client.deleteObject`).
 *
 * Parameters:
 *   request - the `XMLHttpRequest` object that finished
 *   displayErrors - optional; set this to `false` if you are doing your
 *     own error handling and do not want errors to be automatically
 *     handled using <I3Internals.UserInterface::displayError>.
 *     Defaults to `true`.
 */
@class ObjectResponse(request, displayErrors) {

  var _isOK;

  /**
   * Method: getStatus
   * Returns the HTTP status code as a string.
   * For example, "200", "404", "500".
   */
  @propertyReader status;
  
  /**
   * Method: getStatusText
   * Returns the HTTP status message.
   * For example: "OK", "Not Found", "Internal Server Error".
   */
  @propertyReader statusText;
  
  /**
   * Method: getHeaders
   * Returns a map of the HTTP headers and associated values that
   * were sent by the server.
   */
  @propertyReader headers;
  
  /**
   * Method: getObject
   * Returns the decoded JSON object, if available.
   */
  @propertyReader object;
  
  /**
   * Method: isOK
   * Returns `true` if the request completed successfully.  A request is
   * considered successful if the status is not an error (i.e. the HTTP
   * code is not in the 400 or 500 range) and contains a valid object.
   * If the request failed, this will return `false`, and the error
   * information will be available using the <getStatus> and <getStatusText>
   * methods.
   */
  @method isOK() {
    return _isOK;
  }

  /**
   * Private Method: _initialize
   *
   * Examines the `request` and attempts to extract a JSON-encoded object
   * from the response text.
   *
   * Parameters:
   *   request - the `XMLHttpRequest` object containing the encoded object
   *     in its `responseText` property
   *   displayErrors - optional; set this to `false` if you are doing your
   *     own error handling and do not want errors to be automatically
   *     handled using <I3Internals.UserInterface::displayError>.
   *     Defaults to `true`.
   */
  @method _initialize(request, displayErrors) {
    if (displayErrors == null) displayErrors = true;
    _status = request.status.toString();
    _statusText = request.statusText;
    _headers = self._parseRequestHeaders(request);
    var requestSucceeded = I3.client.checkResponse(request, displayErrors);
    if (request.getResponseHeader("Content-Type") == "text/javascript") {
      try {
        _object = I3.client.decodeObject(request.responseText);
      } catch (ex) {
        if (requestSucceeded && displayErrors) I3.ui.displayError(ex);
        _object = null;
      }
    }
    _isOK = (_status.charAt(0) != "4" && _status.charAt(0) != "5" &&
             _object != null);
  }
  
  /**
   * Private Method: _parseRequestHeaders
   *
   * Extracts the response headers from a `request` object.
   *
   * Parameters:
   *   request - the `XMLHttpRequest` object containing the headers
   * 
   * Returns:
   *   An object that maps each request header to its value.
   */
  @method _parseRequestHeaders(request) {
    var headers = {};
    var headerLines = request.getAllResponseHeaders().split("\n");
    var colonIndex;
    for (var i = 0; i < headerLines.length; i++) {
      colonIndex = headerLines[i].indexOf(":");
      if (colonIndex > 0) {
        headers[headerLines[i].substring(0, colonIndex)] =
            I3.util.trim(headerLines[i].substring(colonIndex + 1));
      }
    }
    return headers;
  }
  
  self._initialize(request, displayErrors);
}
