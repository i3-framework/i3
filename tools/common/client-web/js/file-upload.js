/**
 * Script: common/client-web/js/file-upload
 *
 * Provides asynchronous file uploads.
 *
 * *Usage*
 * 
 * Since the only way to upload files through a browser is to use HTML forms, we have to do 
 * some special magic behind the scenes to upload files in an asynchronous way.  This class will 
 * do all that behind the scenes work for you.  You simply have to pass it a web service path, 
 * a method reference to call when the upload is complete, and some options to determine where the 
 * class should pull its data from.
 * 
 * Forms can be created in one of two ways.  First, if a `container` property is passed in the 
 * options hash, a simple form with an `INPUT type="file"` element will be created along with a 
 * submit button.  If a more complex form is needed, you may create the necessary elements in 
 * your HTML and then pass a reference to the `FORM` object as a `form` property.
 * 
 * See <I3.FileUploader> for more information about what may be passed in as options.
 * 
 * Two helper classes are available as well.  See <I3.SimpleFileUploader> and 
 * <I3.CustomFileUploader> for more details.
 * 
 * Simple Form Example:
 * (start example)
 * // Create a simple form
 * var uploader = new I3.FileUploader("/path/to/web/service", self.onFileUploadComplete, 
 *   { container: I3.ui.get("fileUploadContainer") });
 * (end example)
 * 
 * When using a more complex form, you can simply include a submit button and your form will 
 * be submitted normally.  If you need to do any actions prior to the form being submitted, include 
 * a simple button that will do your validations, show an "Uploading..." message, etc. and then 
 * call the `submit()` method on the form.  DO NOT override the form's `onsubmit` event handler.
 * 
 * The only properties that may be set on the form in your HTML are the `id` and `name` properties.
 * All other properties (e.g. `enctype`, `encoding`, `target`, `action`, etc.) will be filled 
 * in automatically by the class.
 * 
 * Also note that it is necessary to give EVERY form element a `name` property, otherwise the form 
 * may not be submitted properly.
 * 
 * Complex Form Example:
 * (start example)
 * <html>
 *   <head>
 *     <script>
 *     var uploader = new I3.FileUploader("/path/to/web/service", onFileUploadComplete, 
 *       { form: I3.ui.get("myForm") });
 *     I3.ui.get("myFormButton").onclick = function(e) {
 *       if (validationsComplete) {
 *         // Show loading message
 *         I3.ui.show("uploadingMessage");
 *         // Submit the form
 *         I3.ui.get("myForm").submit();
 *       }
 *     }
 *     </script>
 *   </head>
 *   <body>
 *     <div id="uploadingMessage">Uploading...</div>
 *     <form id="myForm" name="myNamedForm">
 *       [ Form elements ]
 *       <input type="button" id="myFormButton" value="Upload" />
 *     </form>
 *   </body>
 * </html>
 * (end example)
 * 
 *
 * Credits:
 * 
 *   Written by Nathan Mellis (nathan@mellis.us)
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
 *   $Id: file-upload.js 65 2008-03-17 19:09:06Z nmellis $
 */


// ---------------------------------------------------------------------------

/**
 * Module: I3
 *
 * Module containing class definitions and data shared by all intranet applications.
 */
@module I3;

// ---------------------------------------------------------------------------

/**
 * Class: I3.SimpleFileUploader
 *
 * Simple wrapper around <I3.FileUploader> for creating a simple upload form.
 * 
 * Parameters:
 *   container - a string or element reference to put the simple form in
 *   path - the path to the web service that will receive the form
 *   callback - a function reference that will be called when the upload is complete
 */
@class SimpleFileUploader(container, path, callback) {
  if (typeof container == "string") container = I3.ui.get(container);
  return new I3.FileUploader(path, callback, { container: container });
}

/**
 * Class: I3.CustomFileUploader
 *
 * Simple wrapper around <I3.FileUploader> for configuring a custom file upload form.
 * 
 * Parameters:
 *   form - a string or element reference to an HTML FORM
 *   path - the path to the web service that will receive the form
 *   callback - a function reference that will be called when the upload is complete
 *   options - a hash of additional options; see <I3.FileUploader> for more details
 */
@class CustomFileUploader(form, path, callback, options) {
  if (options == null) options = {};
  if (typeof form == "string") form = I3.ui.get(form);
  options.form = form;
  return new I3.FileUploader(path, callback, options);
}

/**
 * Class: I3.FileUploader
 * 
 * Creates or sets up a form for uploading files in an asynchronous fashion.  Requires a 
 * web service path and a callback function to be called when the upload is complete.
 * 
 * The options hash may contain the following keys:
 * 
 *   * container       - used if a simple form should be created for you
 *   * form            - used if a form already exists that needs to be configured
 *   * progressElement - (optional) the element that should be used as a progress notice
 * 
 * Parameters:
 *   path - the path to the web service that will receive the form
 *   callback - a function reference that will be called when the upload is complete
 *   options - a hash of options; see above for details
 * 
 * See Also:
 *   <I3.SimpleFileUploader>, 
 *   <I3.CustomFileUploader>
 */
@class FileUploader(path, callback, options) {
  
  var _webServicePath;
  var _callback;
  
  // Elements
  var _form;
  var _frame;
  var _progress;
  var _submitButton;
  
  // Constants
  var FORM_NAME          = "i3fileUploaderForm";
  var FRAME_NAME         = "i3fileUploaderFrame";
  var SUBMIT_BUTTON_NAME = "i3fileUploaderSubmitButton";
  var DEFAULT_FILE_NAME  = "fileToUpload";
  

  /**
   * Private Method: _beforeSubmit
   *
   * Performs validation, callbacks, and submits the file upload form.  Displays a loading message 
   * if one is provided, and disables a submit button if one could be determined.
   *
   * Parameters:
   *   e - the event info
   */
  @method _beforeSubmit(e) {
    if (_submitButton) _submitButton.disabled = true;
    if (_progress) I3.ui.show(_progress, "");
    return true;
  }
  
  /**
   * Private Method: _onUploadResponse
   *
   * Event handler for when the `IFRAME` content is loaded.  The content will be the response 
   * from the web server.  It should be in JSON format.  It may be enclosed in a `PRE` tag or not.
   * The decoded object will be passed to the method supplied in the constructor as the callback.
   * 
   * Also hides the loading message if present and re-enables the submit button if necessary.
   *
   * Parameters:
   *   e - the event info
   */
  @method _onUploadResponse(e) {
    if (_progress) I3.ui.hide(_progress);
    if (_submitButton) _submitButton.disabled = false;
    
    var obj, str, body;
    if (I3.browser.isIE())
      body = _frame.contentWindow.document.body;
    else
      body = _frame.contentDocument.body;
    
    if (body.hasChildNodes() && body.firstChild.tagName == "PRE")
      str = body.firstChild.innerHTML;
    else
      str = body.innerHTML;
    
    try {
      obj = I3.client.decodeObject(str);
      if (obj) _callback(obj);
    }
    catch(ex) {
      // I3.ui.displayError(ex.message);
    }
  }
  
  /**
   * Private Method: _createFrame
   *
   * Creates the IFRAME that will be used as the form's target.
   *
   * Parameters:
   *   id - the name or id that should be given to the new frame
   */
  @method _createFrame(id) {
    var frame;
    if (I3.browser.isIE()) {
      frame = I3.ui.create('<IFRAME id="' + id + '" name="' + id + '" />');
      frame.src = "javascript:false";
    }
    else {
      frame = I3.ui.create("IFRAME");
      frame.id = id;
      frame.name = id;
    }
    return frame;
  }
  
  /**
   * Private Method: _initialize
   *
   * Initializes the file upload form.  See <I3.FileUploader> for details.
   *
   * Parameters:
   *   path - the path to the web service that will receive the form
   *   callback - a function reference that will be called when the upload is complete
   *   options - a hash of options
   */
  @method _initialize(path, callback, options) {
    // Sanity checks
    if (options == null) options = {};
    if (callback == null) callback = new Function();
    
    // Set the supplied callbacks
    _callback = callback;                   // Callback for when the upload is complete
    
    // Timestamp to ensure unique IDs
    var timestamp        = (new Date()).getTime();
    var frameName        = FRAME_NAME + "-" + path + "-" + timestamp;
    var formName         = FORM_NAME + "-" + path + "-" + timestamp;
    var submitButtonName = SUBMIT_BUTTON_NAME + "-" + path + "-" + timestamp;
    
    // Create the IFRAME that will used to receive the form post
    _frame = self._createFrame(frameName);
    _frame.className = "i3controller";
    I3.ui.get("appletContent").appendChild(_frame);
    I3.ui.addEventListener(_frame, "load", self._onUploadResponse);
    // _frame.onload = self._onUploadResponse;
    
    // Check to see if we are creating a form or if one is being supplied
    if (options.container) {
      // We should create a form in the specified container
      var container = options.container;
      if (typeof container == "string") container = I3.ui.get(container);
      
      var form, file, submitButton;
      form          = I3.ui.create("FORM");
      form.target   = frameName;
      form.action   = path;
      form.method   = "POST";
      form.encoding = "multipart/form-data";
      form.enctype  = "multipart/form-data";
      form.name     = formName;
      
      file = I3.ui.create("INPUT");
      file.type = "file";
      file.name = DEFAULT_FILE_NAME;
      form.appendChild(I3.ui.createWithContent("P", file));
      
      _submitButton = I3.ui.create("INPUT");
      _submitButton.type = "submit";
      _submitButton.name = submitButtonName;
      _submitButton.value = "Upload";
      
      _progress = I3.ui.create("SPAN");
      _progress.style.display = "none";
      var workingImg = I3.ui.create("IMG");
      workingImg.src = "$theme/client-web/img/working.gif";
      _progress.appendChild(workingImg);
      
      form.appendChild(I3.ui.createWithContent("P", _submitButton, _progress));
      
      I3.ui.clear(container);
      container.appendChild(form);
      _form = form;
    }
    else {
      // A form is being supplied.  Make sure we have one.
      _form = options.form;
      if (typeof _form == "string") _form = I3.ui.get(_form);
      
      if (!_form) {
        I3.ui.displayError("You must supply either a form or a container.");
        return;
      }
      
      // Make sure that the form has the proper attributes
      _form.target   = frameName;
      _form.action   = path;
      _form.method   = "POST";
      _form.enctype  = "multipart/form-data";
      _form.encoding = "multipart/form-data";
      if (!_form.name || _form.name == "") _form.name = formName;
      
      // Check to see if a progress element was supplied
      if (options.progressElement) _progress = options.progressElement;
      
      // Find a submit button if we can find one
      var elements = _form.getElementsByTagName("INPUT");
      for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        if (element.type == "submit") {
          _submitButton = element;
          break;
        }
      }
    }
    
    // Set the `onsubmit` event handler for the form
    _form.onsubmit = self._beforeSubmit;
  }
  
  self._initialize(path, callback, options);
}