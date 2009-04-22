/**
 * Script: common/client-web/js/editor
 *
 * Enables rich-text editing.
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
 *   $Id: editor.js 144 2009-03-10 20:38:55Z nmellis $
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
 * Class: I3.Editor
 *
 * Enables editing on the supplied `element`.
 * 
 * Parameters:
 *   element - the string ID or HTML element that should become editable
 */
@class Editor(element) {
  
  // Constants
  var DEFAULT_STYLESHEET = "/common/client-web/css/editor.css";
  
  // Element references
  var _parent;
  var _container;
  var _frame;
  var _window;
  var _document;
  var _htmlEditor;
  var _disabledCommands = [];
  
  // Internal Settings
  var _toolbar;
  var _mode = "wysiwyg";
  var _originalContents;
  var _stylesheets = [DEFAULT_STYLESHEET];  // Include default stylesheet
  
  // Editable document template
  var _template = 
    '<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" ' + 
    '   "http://www.w3.org/TR/html4/loose.dtd">' + 
    '<html>' + 
    '  <head>%stylesheets%</head>' + 
    '  <body class="i3editorFrameBody %baseCSSClass%">%content%</body>' + 
    '</html>';
  
  var _attachmentFormTemplate = 
    '<div id="editor-fileUploadContainer" style="display:none;">' + 
    '  <div id="editor-fileUploadFormContainer">' + 
    '    <form id="editor-fileUploadForm" name="fileUploadForm">' + 
    '      File to Attach: <input name="fileToUpload" type="file" />' + 
    '      <input id="editor-forceAttachment" type="hidden" name="force" value="false" />' + 
    '    </form>' + 
    '  </div>' + 
    '  <div id="editor-fileUploadProgressContainer" style="display:none;">' + 
    '    Attaching File... <img src="$theme/client-web/img/working.gif" />' + 
    '  </div>' + 
    '  <div id="editor-fileAlreadyExistsContainer" style="display:none;">' + 
    '    The file you are attaching already exists.  Would you like to replace it?' + 
    '  </div>' + 
    '</div>';
  
  
  // -----------------------------------------------------------------------------------------------
  // Group: API
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Method: getAttachments
   * Returns an array of attachments to this article.
   *
   * Method: setAttachments
   * Sets an array of attachments to this article.
   */
  @property attachments = [];
  
  /**
   * Method: getAttachmentWebServicePath
   * Returns the path to the web service that handles the uploading of attachments.  If the path is 
   * `null`, attachments will be disabled.
   *
   * Method: setAttachmentWebServicePath
   * Sets the path to the web service that handles the uploading of attachments.  By default, the 
   * path is `null` and attachments are disabled.
   */
  @property attachmentWebServicePath = null;
  
  /**
   * Method: getAutomaticallyAdjustHeight
   * Returns whether or not the height of the editor window should be automatically set to fill 
   * the height of the available screen.
   *
   * Method: setAutomaticallyAdjustHeight
   * Sets whether or not the height of the editor window should be automatically set to fill 
   * the height of the available screen.
   */
  @property automaticallyAdjustHeight = true;
  
  /**
   * Method: getEnableHTMLEditing
   * Returns whether or not the user is allowed to edit the HTML directly.  Default = true.
   *
   * Method: setEnableHTMLEditing
   * Sets whether or not the user is allowed to edit the HTML directly.
   */
  @property enableHTMLEditing = true;
  
  /**
   * Method: getBaseCSSClass
   * Returns the base CSS class to apply to the document body to ensure that CSS styles get applied 
   * properly.
   *
   * Method: setBaseCSSClass
   * Sets the base CSS class to apply to the document body to ensure that CSS styles get applied 
   * properly.
   */
  @property baseCSSClass = "";
  
  /**
   * Method: getMode
   * 
   * Returns the mode that the editor is in.  Should be either "wysiwyg" or "html".
   */
  @method getMode() {
    return _mode;
  }
  
  /**
   * Method: setMode
   * 
   * Sets the mode that the editor is in.  Should be either "wysiwyg" or "html".
   * 
   * Parameters:
   *   mode - the mode string
   */
  @method setMode(mode) {
    if (mode == "html" && _enableHTMLEditing == false) {
      I3.ui.displayError("HTML editing is not enabled for this editor.");
      return;
    }
    _mode = mode;
    switch(_mode) {
      case "html":
        self._switchToHTMLEditor();
        break;
      case "wysiwyg":
        self._switchToWYSIWYGEditor();
        break;
    }
    if (_delegate && _delegate.editorModeDidChange) _delegate.editorModeDidChange(self);
  }
  
  /**
   * Method: getContent
   *
   * Returns the contents of the editable element as an HTML string.
   */
  @method getContent() {
    return _document.body.innerHTML;
  }
  
  /**
   * Method: setContent
   *
   * Sets the contents of the editable element.
   *
   * Parameters:
   *   html - a `String` of HTML to set as the contents of the editable element
   */
  @method setContent(html) {
    _document.body.innerHTML = html;
  }
  
  /**
   * Method: addStylesheet
   *
   * Adds a stylesheet to the editor frame.  This is used to specify any custom tools styles 
   * so the editor looks the same as the final content.
   * 
   * Parameters:
   *   url - the path to the stylesheet to include
   */
  @method addStylesheet(url) {
    _stylesheets.push(url);
  }
  
  /**
   * Method: disableCommand
   *
   * Disables a command and removes its icon from the toolbar.
   *
   * Parameters:
   *   command - the command string to disable.
   */
  @method disableCommand(command) {
    _disabledCommands.push(command);
  }
  
  /**
   * Method: disableCommands
   *
   * Disables all the commands contained in the `commandsArray`.
   *
   * Parameters:
   *   commandsArray - an `Array` containing all the commands to disable.
   */
  @method disableCommands(commandsArray) {
    for (var i = 0; i < commandsArray.length; i++) {
      self.disableCommand(commandsArray[i]);
    }
  }
  
  /**
   * Method: getHeight
   * Returns the initial height of the editor frame.
   *
   * Method: setHeight
   * Sets the initial height of the editor frame.
   */
  @property height;
  
  /**
   * Method: display
   *
   * Displays the editor.
   */
  @method display() {
    // Make sure that there is something inside the element to edit
    // if (_parent.childNodes.length == 0 || _parent.innerHTML.search(/^\s*$/) > -1)
    //   _parent.appendChild(I3.ui.create("BR"));
    
    // Save the original contents of the element, then clear it
    _originalContents = _parent.innerHTML;
    I3.ui.clear(_parent);
    
    // Make the parent element invisible until all the elements get rendered.
    // We have to use the `visibility` property because we need all the calculations to work
    _parent.style.visibility = "hidden";
    
    _container = I3.ui.create("DIV");
    _container.className = "i3editorContainer";
    _parent.appendChild(_container);
    
    // Get a list of all the stylesheets that are applied to this page
    var stylesheets = [];
    for (var i = 0; i < _stylesheets.length; i++) {
      stylesheets.push('<link rel="stylesheet" type="text/css" href="' + _stylesheets[i] + '" />');
    }
    
    // Create the IFRAME that will hold the edited content
    _frame = I3.ui.create("IFRAME");
    _frame.className = "i3editorFrame";
    _container.appendChild(_frame);
    _window = _frame.contentWindow;
    _document = _window.document;
    var content = (_originalContents.search(/^\s*$/) == 0) ? "<p><br></p>" : _originalContents;
    var html = _template;
    html = html.replace(/%stylesheets%/, stylesheets.join(""));
    html = html.replace(/%baseCSSClass%/, _baseCSSClass);
    html = html.replace(/%toolname%/, I3.client.getToolName());
    html = html.replace(/%content%/, content);
    _document.open();
    _document.write(html);
    _document.close();
    
    // Enable content editing
    _document.designMode = "on";
    
    // Set event handlers on the editable document
    I3.ui.addEventListener(_window, "focus", self._onFocusHandler);
    I3.ui.addEventListener(_window, "blur", self._onBlurHandler);
    I3.ui.addEventListener(_document, "mouseup", function(e) { _toolbar.update() });
    I3.ui.addEventListener(_document, "mousemove", function(e) { _toolbar.update() });
    I3.ui.addEventListener(_document, "keyup", function(e) { _toolbar.update() });
    I3.ui.addEventListener(_document, "keyup", function(e) { 
      if (_delegate && _delegate.editorDidReceiveKeyUp) _delegate.editorDidReceiveKeyUp(e) });

    // Make sure we have a toolbar.  If we don't, create a default one.
    if (_toolbar == null) self.setToolbar(new I3Editor.Toolbar());
    _toolbar.disableCommands(_disabledCommands);
    
    // Add the toolbar, removing any previous toolbars if necessary.
    if (_container.previousSibling && 
        _container.previousSibling.className == "i3editorToolbarContainer") 
    {
      _container.parentNode.removeChild(_container.previousSibling);
    }
    
    var toolbar = _toolbar.create();
    _container.parentNode.insertBefore(toolbar, _container);
    I3.ui.addEventListener(toolbar, "mousedown", self._onToolbarMouseDown);
    I3.ui.addEventListener(toolbar, "mouseup", self._onToolbarMouseUp);
    
    self._configureDragHandle();
    
    // Perform finishing setup.
    var failOnRetryCount = 20;
    var retryCount = 0;
    var finishSetup = function() {
      if (_document && _document.body) {
        // Set the height of the editor
        self._setEditorWindowHeight(_height);

        // Show the editor
        _parent.style.visibility = "visible";
        
        // Give focus to the editor
        // _window.focus();
        _toolbar.update();
      }
      else {
        if (retryCount++ < failOnRetryCount) setTimeout(finishSetup, 100);
        else I3.ui.displayError("Editor failed to initialize.");
      }
    }
    setTimeout(finishSetup, 100);
  }
  
  /**
   * Method: textIsSelected
   *
   * Returns `true` if some text is selected in the editor, `false` otherwise.
   */
  @method textIsSelected() {
    return !(self.getSelectedText() == "");
  }
  
  /**
   * Method: getSelectedText
   *
   * Returns the text that is selected in the editor.  If no text is selected, it returns an 
   * empty string.
   * 
   * Returns:
   *   A `String`.
   */
  @method getSelectedText() {
    var text = "";
    if (_window.getSelection && _window.getSelection.toString) { // Mozilla & Safari
      text = _window.getSelection().toString() || "";
    }
    else if (_document.selection && _document.selection.createRange) { // IE
      text = _document.selection.createRange().text.replace(/^\s+/, "").replace(/\s+$/, "");
    }
    else {
      text = "";
    }
    return text;
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Group: Delegate methods
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Method: getDelegate
   * Returns the delegate object that will respond to events.
   *
   * Method: setDelegate
   * Sets the delegate object that will respond to events.
   */
  @property delegate;
  
  /**
   * Delegate Method: editorModeDidChange
   * 
   * Delegate method that gets called when the editor mode is changed.  Takes one argument, which 
   * is a reference to this editor object.
   * 
   * To get the current mode, call <I3.Editor.getMode> on the <I3.Editor> object.
   * 
   * Parameters:
   *   editor - the <I3.Editor> that generated this event
   */
  
  /**
   * Delegate Method: editorDidReceiveFocus
   * 
   * Delegate Method that gets called when the editor receives focus.  Takes one argument, which 
   * is a reference to this editor object.
   * 
   * Parameters:
   *   editor - the <I3.Editor> that generated this event
   */
  
  /**
   * Delegate Method: editorDidLoseFocus
   * 
   * Delegate method that gets called when the editor loses focus.  Takes one argument, which 
   * is a reference to this editor object.
   * 
   * Parameters:
   *   editor - the <I3.Editor> that generated this event
   */
  
  /**
   * Delegate Method: editorDidAttachFile
   * 
   * Delegate method that gets called when the editor attaches a new file.
   * 
   * Parameters:
   *   editor - the <I3.Editor> that generated this event
   */

  
  // -----------------------------------------------------------------------------------------------
  // Group: Toolbar methods
  // -----------------------------------------------------------------------------------------------

  /**
   * Method: getToolbar
   *
   * Returns the <I3Editor.Toolbar> that is associated with this editor.
   */
  @method getToolbar() {
    return _toolbar;
  }

  /**
   * Method: setToolbar
   *
   * Sets the <I3Editor.Toolbar> that is associated with this editor.
   *
   * Parameters:
   *   toolbar - an <I3Editor.Toolbar>
   */
  @method setToolbar(toolbar) {
    _toolbar = toolbar;
    _toolbar.setEditor(self);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Group: Editor command methods
  // -----------------------------------------------------------------------------------------------

  /**
   * Method: executeCommand
   *
   * Executes a command on the editable element.  See ... for documentation.
   *
   * Parameters:
   *   command - a `String` command to run
   *   value - the value to pass with `command`
   */
  @method executeCommand(command, value) {
    if (_document.queryCommandEnabled(command)) {
      _document.execCommand(command, false, value);
    }
  }
  
  /**
   * Method: commandIsEnabled
   *
   * Returns `true` if the supplied `command` is enabled for the editor.
   *
   * Parameters:
   *   command - the command string
   */
  @method commandIsEnabled(command) {
    try {
      return _document.queryCommandEnabled(command);
    }
    catch(ex) {
      return false;
    }
  }
  
  /**
   * Method: commandIsActive
   *
   * Returns `true` if the supplied `command` is currently active for the caret position/selection.
   *
   * Parameters:
   *   command - the command string
   */
  @method commandIsActive(command) {
    try {
      return _document.queryCommandState(command);
    }
    catch(ex) {
      return false;
    }
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Editor mode methods
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _switchToHTMLEditor
   *
   * Switches the editor to an HTML editor.
   */
  @method _switchToHTMLEditor() {
    var frameHeight = _frame.offsetHeight;
    var frameWidth  = _frame.offsetWidth;
    I3.ui.hide(_frame);
    _htmlEditor = I3.ui.create("TEXTAREA");
    _htmlEditor.value = self._tidyHTML(self.getContent());
    _htmlEditor.style.width  = frameWidth + "px";
    _htmlEditor.style.height = frameHeight + "px";
    _container.appendChild(_htmlEditor);
    _htmlEditor.focus();
  }
  
  /**
   * Private Method: _switchToHTMLEditor
   *
   * Switches the editor to a WYSIWYG editor.
   */
  @method _switchToWYSIWYGEditor() {
    self.setContent(_htmlEditor.value);
    _htmlEditor.parentNode.removeChild(_htmlEditor);
    _htmlEditor = null;
    I3.ui.show(_frame);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Event handlers
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _onToolbarMouseDown
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onToolbarMouseDown(e) {
    
  }
  
  /**
   * Private Method: _onToolbarMouseUp
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onToolbarMouseUp(e) {
    _window.focus();
  }
  
  /**
   * Private Method: _onFocusHandler
   *
   * Handles the `onfocus` event.  Notifies the delegate (if provided) and the toolbar.
   *
   * Parameters:
   *   e - the event info
   */
  @method _onFocusHandler(e) {
    _toolbar.update();
    if (_delegate && _delegate.editorDidReceiveFocus) _delegate.editorDidReceiveFocus(self);
  }
  
  /**
   * Private Method: _onBlurHandler
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onBlurHandler(e) {
    _toolbar.update();
    if (_delegate && _delegate.editorDidLoseFocus) _delegate.editorDidLoseFocus(self);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Helper methods
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _setEditorWindowHeight
   *
   * Sets the height of the editor window.
   * 
   * Parameters:
   *   height - (optional) the height to set the window to
   */
  @method _setEditorWindowHeight(height) {
    if (height) {
      _frame.style.height     = height + "px";
      _container.style.height = height + "px";
    }
    else {
      if (!_automaticallyAdjustHeight) return;

      var topOffset    = I3.ui.getElementOffsets(_parent).top + 30;
      var bottomOffset = I3.ui.get("i3copyright").offsetHeight + 40;
      var screenHeight;
      if (I3.browser.isIE())
        screenHeight = I3.ui.document.body.clientHeight;
      else
        screenHeight = I3.ui.document.defaultView.innerHeight;

      var editorHeight = screenHeight - topOffset - bottomOffset;
      _frame.style.height     = editorHeight + "px";
      _container.style.height = editorHeight + "px";
    }
  }
  
  /**
   * Private Method: _configureDragHandle
   *
   * Description of method
   */
  @method _configureDragHandle() {
    var dragHandleElement = I3.ui.create("div");
    dragHandleElement.className = "i3editorDragHandle";
    dragHandleElement.innerHTML = "<hr /><hr /><hr />";
    if (_container.nextSibling == null)
      _container.parentNode.appendChild(dragHandleElement);
    else
      _container.parentNode.insertBefore(dragHandleElement, _container.nextSibling);
    
    dragHandleElement.onDragStart = function(options) {
      var offsets = I3.ui.getElementOffsets(dragHandleElement);
      dragHandleElement.style.position = "static";
      // dragHandleElement.style.top = offsets.top + "px";
      // dragHandleElement.style.left = offsets.left + "px";
      dragHandleElement.initialFrameHeight = parseInt(_container.style.height);
    };
    dragHandleElement.onDrag = function(options) {
      var height = dragHandleElement.initialFrameHeight + options.y;
      self._setEditorWindowHeight(height);
    };
    I3.ui.enableDragging(dragHandleElement, { minX:0, maxX:0 });
  }
  
  /**
   * Private Method: _tidyHTML
   *
   * Tidies up the HTML into something that can be read more easily.
   *
   * Parameters:
   *   html - a string of HTML
   * 
   * Returns:
   *   A `String` of HTML.
   */
  @method _tidyHTML(html) {
    var pattern = new RegExp("(</[^>]+>)(\s*<[^/>]+>)", "ig");
    var replacement = (I3.browser.isIE()) ? "$1\r\n\r\n$2" : "$1\n\n$2";
    return html.replace(pattern, replacement);
  }
  
  /**
   * Private Method: _addAttachment
   *
   * Description of method
   *
   * Parameters:
   *   file - description
   */
  @method _addAttachment(file) {
    _attachments.push(file);
  }
  
  /**
   * Method: getAvailableImages
   *
   * Returns an `Array` of the images that are available to the editor.
   * 
   * See Also:
   *   <getAssets>
   */
  @method getAvailableImages() {
    var images = [];
    for (var i = 0; i < _attachments.length; i++) {
      var attachment = _attachments[i];
      if (attachment.small_icon.search("image") != -1) {
        images.push(attachment);
      }
    }
    return images;
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Group: Upload methods
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _showUploadForm
   *
   * Displays a popup to enable file uploads.
   */
  @method _showUploadForm() {
    // Sanity check
    if (I3.ui.get("editor-fileUploadContainer") == null) {
      var div = I3.ui.create("DIV");
      div.innerHTML = _attachmentFormTemplate;
      _parent.appendChild(div);
    }
    if (I3.CustomFileUploader == null) {
      I3.ui.displayError("File Uploading library is missing.");
      return;
    }
    if (_attachmentWebServicePath == null) {
      I3.ui.displayError("No web service specified for attachments.");
      return;
    }
    var uploader = new I3.CustomFileUploader(
      I3.ui.get("editor-fileUploadForm"), _attachmentWebServicePath, self._onFileUploadComplete);
    
    I3.ui.hide("editor-fileUploadProgressContainer");
    I3.ui.show("editor-fileUploadFormContainer");
    
    I3.ui.get("editor-forceAttachment").value = "false";
    I3.ui.popupDialogWithElement(
      I3.ui.get("editor-fileUploadContainer"), 
      {
        title: "Attach a File", 
        width: 500, 
        cancelButton: true, 
        acceptButton: {
          label: "Attach File", 
          onclick: self._uploadFile
        }
      })
  }
  
  /**
   * Private Method: _uploadFile
   *
   * Submits the form to upload a file.
   *
   * Parameters:
   *   e - the event info
   */
  @method _uploadFile(e) {
    e = I3.ui.getEvent(e);
    var button = e.getTarget();
    button.disabled = true;
    
    I3.ui.hide("editor-fileUploadFormContainer");
    I3.ui.hide("editor-fileAlreadyExistsContainer");
    I3.ui.show("editor-fileUploadProgressContainer");
    
    var form = I3.ui.get("editor-fileUploadForm");
    form.submit();
  }
  
  /**
   * Private Method: _onFileUploadComplete
   *
   * Event handler for when a file upload is complete.  Since we are handling responses differently 
   * than our normal `I3.client.postObject` method, we have to manually check to see if there is a 
   * `status` property on the object to determine if there was an error or not.
   * 
   * The status property (if present) will be one of the following:
   * 
   *   * 409 - Specifies a conflict, usually meaning that the file already exists
   *   * 403 - Specifies that the user does not have permission to write the file
   *
   * Parameters:
   *   obj - the object that was sent from the web service
   */
  @method _onFileUploadComplete(obj) {
    // Check to see if any errors were encountered.
    if (obj.status) {
      // Check to see the error status that was sent
      var statusCode = parseInt(obj.status);
      if (!isNaN(statusCode)) {
        switch (statusCode) {
          case 409: // File already exists
            self._handleExistingFile(obj);
            break;
          case 403: // Permission denied
            I3.ui.displayError(obj);
            break;
          default:  // Unknown error
            I3.ui.displayError(obj);
            break;
        }
      }
      else {
        I3.ui.displayError(obj);
      }
    }
    else {
      // Everything seems to be okay.  Add the response to the section list and redisplay
      I3.ui.endPopupDialog();
      
      // Do something with the new file
      self._handleSuccessfulFileUpload(obj);
    }
  }
  
  /**
   * Private Method: _handleExistingFile
   *
   * Handler for when the web service responds that the uploaded file already exists.  Will prompt 
   * the user to supply a new filename or to overwrite the existing file.
   *
   * Parameters:
   *   response - the object returned by the upload web service
   */
  @method _handleExistingFile(response) {
    I3.ui.hide("editor-fileUploadProgressContainer");
    I3.ui.show("editor-fileAlreadyExistsContainer");
    I3.ui.popupDialogWithElement(
      I3.ui.get("editor-fileUploadContainer"), 
      {
        title: "Replace Attached File", 
        width: 500, 
        cancelButton: true, 
        acceptButton: {
          label: "Overwrite Attached File", 
          onclick: function(e) {
            I3.ui.get("editor-forceAttachment").value = "true";
            self._uploadFile(e);
          }
        }
      })
  }
  
  /**
   * Private Method: _handleSuccessfulFileUpload
   *
   * Handles a successful file upload.  Adds it to this article's list of attachments and notifies
   * the delegate.
   *
   * Parameters:
   *   file - the file information returned from the web service
   */
  @method _handleSuccessfulFileUpload(file) {
    self._addAttachment(file);
    if (_delegate && _delegate.editorDidAttachFile) _delegate.editorDidAttachFile(self, file);
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Constructor
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _initialize
   *
   * Description of method
   *
   * Parameters:
   *   element - the string ID or HTML element that should become editable
   */
  @method _initialize(element) {
    if (typeof element == "string") element = I3.ui.get(element);
    _parent = element;
  }
  
  self._initialize(element);
}



// =================================================================================================



/**
 * Module: I3Editor
 *
 * Namespace for all the associated editor classes.
 */
@module I3Editor;


// -------------------------------------------------------------------------------------------------


/**
 * Class: I3Editor.Toolbar
 *
 * Description of class
 */
@class Toolbar {
  
  // Constants
  var AVAILABLE_COMMANDS = 
    [ "bold", "contentReadOnly", "createlink", "decreasefontsize", "fontsize", "forecolor", 
      "formatblock", "heading", "increasefontsize", "indent", "inserthorizontalrule", "inserthtml", 
      "insertimage", "insertorderedlist", "insertunorderedlist", "insertparagraph", "italic", 
      "justifycenter", "justifyfull", "justifyleft", "justifyright", "outdent", "removeformat", 
      "strikethrough", "subscript", "superscript", "underline", "unlink" ];
  

  // Element references
  var _container;
  var _linkLabel;
  var _linkHref;
  var _linkDialog;
  var _imageDialog;
  
  // Timeout reference
  var _popupTimeout;
  
  var _disabledCommands = {};
  
  
  // -----------------------------------------------------------------------------------------------
  // Group: API
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Method: getEditor
   * Returns the <I3.Editor> class that is associated with this toolbar.
   *
   * Method: setEditor
   * Sets the <I3.Editor> class that is associated with this toolbar.  You should not have to call 
   * this yourself.  It is automatically set when you assign the toolbar to an editor using 
   * <I3.Editor.setToolbar>.
   */
  @property editor;
  
  /**
   * Method: create
   *
   * Creates the toolbar and returns a `DIV` for the editor to append if necessary.  
   * This method is called by <I3.Editor> and should not be called directly.
   * 
   * Returns:
   *   An HTML `DIV` element.
   */
  @method create() {
    _container = I3.ui.create("DIV");
    _container.className = "i3editorToolbarContainer";
    
    self._setup();
    
    return _container;
  }
  
  /**
   * Method: update
   *
   * Updates the toolbar by enabling or disabling items as necessary.
   */
  @method update() {
    var items = _container.getElementsByTagName("LI");
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      // Set the default case
      var itemIsDisabled = !_editor.commandIsEnabled(item.command);
      // Handle special cases where they are always on
      if (item.command == "" || item.command == "html") itemIsDisabled = false;
      // Handle attachments
      if (item.command == "attachfile" || item.command == "insertimage")
        itemIsDisabled = (_editor.getAttachmentWebServicePath() == null);
      // Set the appropriate class name
      I3.ui.toggleClassOnElement(item, "i3editorToolbarItemDisabled", itemIsDisabled);
      
      var itemIsSelected = false;
      if (item.command == "html") {
        itemIsSelected = (_editor.getMode() == "html") ? true : false;
      }
      else {
        itemIsSelected = _editor.commandIsActive(item.command);
      }
      I3.ui.toggleClassOnElement(item, "i3editorToolbarItemSelected", itemIsSelected);
    }
  }
  
  /**
   * Method: disableCommand
   *
   * Disables a command and removes its icon from the toolbar.
   *
   * Parameters:
   *   command - the command string to disable.
   */
  @method disableCommand(command) {
    _disabledCommands[command] = true;
  }
  
  /**
   * Method: disableCommands
   *
   * Disables all the commands contained in the `commandsArray`.
   *
   * Parameters:
   *   commandsArray - an `Array` containing all the commands to disable.
   */
  @method disableCommands(commandsArray) {
    for (var i = 0; i < commandsArray.length; i++) {
      self.disableCommand(commandsArray[i]);
    }
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Internal methods
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _setup
   *
   * Sets up the toolbar, adding the appropriate items, etc.
   */
  @method _setup() {
    var topLevel = I3.ui.create("UL");
    var items = [];
    
    if (_editor.getEnableHTMLEditing()) {
      // Edit HTML
      var htmlButton = self._createCommandButton("html", null, "&nbsp;", "Edit HTML");
      htmlButton.className = 
        "i3editorToolbarImageItem i3editorToolbarItemEditHTML i3editorToolbarItemHTMLMode";
      items.push(htmlButton);
    }
    
    // Paragraph Styles
    if (!_disabledCommands["formatblock"]) {
      var pButton = self._createCommandButton("", null, "&para;", "Paragraph Styles");
      I3.ui.addEventListener(pButton, "mouseover", self._onItemMouseOver);
      I3.ui.addEventListener(pButton, "mouseout", self._onItemMouseOut);
      items.push(pButton);
      self._createChildCommandButton(pButton, "formatblock", "<p>", "Paragraph", null);
      self._createChildCommandButton(pButton, "formatblock", "<pre>", "<pre>Monospaced</pre>", null);
      self._createChildCommandButton(pButton, "formatblock", "<h1>", "<h1>Header 1</h1>", null);
      self._createChildCommandButton(pButton, "formatblock", "<h2>", "<h2>Header 2</h2>", null);
      self._createChildCommandButton(pButton, "formatblock", "<h3>", "<h3>Header 3</h3>", null);
      self._createChildCommandButton(pButton, "formatblock", "<h4>", "<h4>Header 4</h4>", null);
      self._createChildCommandButton(pButton, "formatblock", "<h5>", "<h5>Header 5</h5>", null);
    }
        
    // Bold
    if (!_disabledCommands["bold"])
      items.push(self._createCommandButton("bold", null, "<b>B</b>", "Bold"));
    
    // Italic
    if (!_disabledCommands["italic"])
      items.push(self._createCommandButton("italic", null, "<i>I</i>", "Italic"));
    
    // Text alignment buttons
    if (!_disabledCommands["justifyleft"]) {
      var alignLeftButton = self._createCommandButton("justifyleft", null, "&nbsp;", "Align Left");
      alignLeftButton.className += " i3editorToolbarImageItem i3editorToolbarItemAlignLeft";
      items.push(alignLeftButton);
    }
    if (!_disabledCommands["justifycenter"]) {
      var alignCenterButton = self._createCommandButton("justifycenter", null, "&nbsp;", "Align Center");
      alignCenterButton.className += " i3editorToolbarImageItem i3editorToolbarItemAlignCenter";
      items.push(alignCenterButton);
    }
    if (!_disabledCommands["justifyright"]) {
      var alignRightButton = self._createCommandButton("justifyright", null, "&nbsp;", "Align Right");
      alignRightButton.className += " i3editorToolbarImageItem i3editorToolbarItemAlignRight";
      items.push(alignRightButton);
    }
    if (!_disabledCommands["justifyfull"]) {
      var alignFullButton = self._createCommandButton("justifyfull", null, "&nbsp;", "Align Full");
      alignFullButton.className += " i3editorToolbarImageItem i3editorToolbarItemAlignFull";
      items.push(alignFullButton);
    }
    
    // Bulleted List
    if (!_disabledCommands["insertunorderedlist"]) {
      var ulButton = self._createCommandButton("insertunorderedlist", null, "&nbsp;", 
        "Insert Bulleted List");
      ulButton.className += " i3editorToolbarImageItem i3editorToolbarItemBulletedList";
      items.push(ulButton);
    }
    
    // Numbered List
    if (!_disabledCommands["insertorderedlist"]) {
      var olButton = self._createCommandButton("insertorderedlist", null, "&nbsp;", 
        "Insert Numbered List");
      olButton.className += " i3editorToolbarImageItem i3editorToolbarItemNumberedList";
      items.push(olButton);
    }
    
    // Increase/Decrease indentation
    if (!_disabledCommands["indent"]) {
      var indent = self._createCommandButton("indent", null, "&nbsp;", "Increase Indent");
      indent.className += " i3editorToolbarImageItem i3editorToolbarItemIncreaseIndent";
      items.push(indent);
    }
    if (!_disabledCommands["outdent"]) {
      var outdent = self._createCommandButton("outdent", null, "&nbsp;", "Decrease Indent");
      outdent.className += " i3editorToolbarImageItem i3editorToolbarItemDecreaseIndent";
      items.push(outdent); 
    }
    
    // Horizontal Rule
    if (!_disabledCommands["inserthorizontalrule"])
      items.push(self._createCommandButton(
          "inserthorizontalrule", null, "&mdash;", "Insert Horizontal Rule"));
    
    // Hyperlinks
    if (!_disabledCommands["createlink"]) {
      var pLink = self._createCommandButton("", null, "&infin;", "Create or edit a hyperlink...");
      I3.ui.addEventListener(pLink, "mouseover", self._onItemMouseOver);
      I3.ui.addEventListener(pLink, "mouseout", self._onItemMouseOut);
      items.push(pLink);
      self._createChildCommandButton(pLink, "createlink", null, "Create Hyperlink", null);
      self._createChildCommandButton(pLink, "unlink", null, "Remove Hyperlink", null);
    }
    
    // Image
    if (!_disabledCommands["insertimage"]) {
      var imageButton = self._createCommandButton("insertimage", null, "&nbsp;", "Insert Image...");
      imageButton.className += " i3editorToolbarImageItem i3editorToolbarItemInsertImage";
      items.push(imageButton);
    }
    
    // Attachments
    if (!_disabledCommands["attachfile"]) {
      var aButton = self._createCommandButton("attachfile", null, "&nbsp;", "Attach File...");
      aButton.className += " i3editorToolbarImageItem i3editorToolbarItemAttachment";
      items.push(aButton);
    }
    
    // Append the elements to the toolbar
    for (var i = 0; i < items.length; i++) {
      topLevel.appendChild(items[i]);
    }
    
    // Append the toolbar to the container
    _container.appendChild(topLevel);
  }
  
  /**
   * Private Method: _createCommandButton
   *
   * Creates an element that enables a certain editor command.
   *
   * Parameters:
   *   command - the command string that this button executes
   *   value - the value string to pass with the command.  May be `null`.
   *   html - a string of HTML or element to set as the item's contents
   *   title - the tooltip title for this button
   *   isTopLevel - (optional) `true` if this is a top level button; default = true
   * 
   * Returns:
   *   An HTML `LI` element.
   */
  @method _createCommandButton(command, value, html, title, isTopLevel) {
    if (isTopLevel == null) isTopLevel = true;
    
    var item = I3.ui.create("LI");
    if (typeof html == "string")
      item.innerHTML = html;
    else
      item.appendChild(html);
    item.title = title;
    item.command = command;
    item.commandValue = value;
    if (isTopLevel) item.className = "i3editorToolbarItem";
    I3.ui.addEventListener(item, "click", self._onItemClick);
    
    return item;
  }
  
  /**
   * Private Method: _createChildCommandButton
   *
   * Creates a child command button.  Creates the subordinate UL if necessary.  The item is 
   * automatically added to the DOM so you don't need to do so yourself.  The created LI is 
   * returned to further customize styles, events, etc.
   *
   * Parameters:
   *   parent - the LI element that this should be under
   *   command - the command string that this button executes
   *   value - the value string to pass with the command.  May be `null`.
   *   html - a string of HTML or element to set as the item's contents
   *   title - the tooltip title for this button
   * 
   * Returns:
   *   An already-appended HTML `LI` element.
   */
  @method _createChildCommandButton(parent, command, value, html, title) {
    // Check to see if we have a UL to put our item in
    var container;
    var uls = parent.getElementsByTagName("UL");
    for (var i = 0; i < uls.length; i++) {
      if (I3.ui.elementHasClassName(uls[i], "i3editorToolbarSubList")) {
        container = uls[i];
        break;
      }
    }
    if (!container) {
      container = I3.ui.create("UL");
      container.style.display = "none";
      container.className = "i3editorToolbarSubList";
      parent.appendChild(container);
    }
    
    var item = self._createCommandButton(command, value, html, title, false);
    container.appendChild(item);
    return item;
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Event handlers
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _onItemClick
   *
   * Description of method
   *
   * Parameters:
   *   e - description
   */
  @method _onItemClick(e) {
    e = I3.ui.getEvent(e);
    e.stopEvent();

    var element = e.getTarget();
    if (element.tagName.toLowerCase() != "li") {
      element = I3.ui.getParentWithTagName("li", element);
    }
    
    // Stop here if the item is disabled
    if (I3.ui.elementHasClassName(element, "i3editorToolbarItemDisabled")) return;
    
    var command = element.command;
    var commandValue = element.commandValue;
    
    var sublist = element.getElementsByTagName("UL")[0];
    var parent = I3.ui.getParentWithTagName("UL", element, { className: "i3editorToolbarSubList" });
    var isChildItem = parent == null ? false : true;
    
    if (command == "" && sublist) {
      if (sublist.style.display == "none") {
        var offsets = I3.ui.getElementOffsets(element);
        I3.ui.show(sublist);
        sublist.style.top = offsets.bottom;
        sublist.style.left = offsets.left;
      }
      else {
        I3.ui.hide(sublist);
      }
    }
    else if (command == "html") {
      // Change the mode of the editor
      if (_editor.getMode() == "wysiwyg")
        _editor.setMode("html");
      else
        _editor.setMode("wysiwyg");
    }
    else if (command == "createlink") {
      // Handle link creation separately
      self._handleLinkCreation();
    }
    else if (command == "insertimage") {
      // Handle image insertions separately
      self._handleImageInsertion();
    }
    else if (command == "attachfile") {
      // Handle attachments separately
      self._handleAttachments();
    }
    else {
      if (isChildItem) I3.ui.hide(parent);
      _editor.executeCommand(command, commandValue);
    }
    self.update();
  }
  
  /**
   * Private Method: _onItemMouseOver
   *
   * Description of method
   *
   * Parameters:
   *   e - the event info
   */
  @method _onItemMouseOver(e) {
    if (_popupTimeout) {
      clearTimeout(_popupTimeout);
      _popupTimeout = null;
    }
  }
  
  /**
   * Private Method: _onItemMouseOut
   *
   * Description of method
   *
   * Parameters:
   *   e - the event info
   */
  @method _onItemMouseOut(e) {
    e = I3.ui.getEvent(e);
    var element = this;
    var sublist = element.getElementsByTagName("UL");
    if (sublist.length > 0) {
      sublist = sublist[0];
      _popupTimeout = setTimeout(function() { I3.ui.hide(sublist) }, 500);
    }
  }
  
  /**
   * Private Method: _handleLinkCreation
   *
   * Handles the creation of links
   */
  @method _handleLinkCreation() {
    if (!_linkDialog) self._createLinkDialog();
    
    if (_editor.textIsSelected())
      I3.ui.hide("i3editorCreateLinkDialogLabelRow");
    else
      I3.ui.show("i3editorCreateLinkDialogLabelRow", "");
    
    I3.ui.get("i3editorCreateLinkDialogURLInput").value = "";
    I3.ui.get("i3editorCreateLinkDialogLabelInput").value = 
      (_editor.textIsSelected() ? _editor.getSelectedText() : "");
    
    I3.ui.popupDialogWithElement(
      _linkDialog, 
      {
        title: "Create Link", 
        width: 500, 
        cancelButton: true, 
        acceptButton: {
          label: "Create Link", 
          onclick: self._createLinkInEditor
        }
      });
    
    I3.ui.get("i3editorCreateLinkDialogURLInput").focus();
  }
  
  /**
   * Private Method: _createLinkInEditor
   *
   * Creates a link in the editor.
   *
   * Parameters:
   *   e - the event args
   */
  @method _createLinkInEditor(e) {
    e = I3.ui.getEvent(e);
    e.getTarget().disabled = true;
    
    var link, url, label;
    url   = I3.ui.get("i3editorCreateLinkDialogURLInput").value;
    label = I3.ui.get("i3editorCreateLinkDialogLabelInput").value;
    
    // Sanity check
    if (url.search(/^\s*$/) == 0) {
      I3.ui.displayError("You must enter a URL for the link to continue.");
      return;
    }
    
    // If no label is available, use the url as the label text.
    if (label.search(/^\s*$/) == 0) label = url;

    // Check to see if we have an external URL or not.  
    // If internal, use I3.ui.createNavigationLinkHTML.
    var emailAddressPattern = /^\w+@\w+\.\w+$/i;
    var externalURLPattern = new RegExp("^[a-zA-Z]+://", "i");
    if (url.search(emailAddressPattern) > -1) {
      // Email address was entered
      link = '<a href="mailto:' + url + '">' + label + '</a>';
    }
    else {
      if (url.search(externalURLPattern) == -1) {
        // Link is an internal reference
        link = I3.ui.createNavigationLinkHTML(label, url);
      }
      else {
        // Link is an external reference
        link = '<a href="' + url + '" target="_blank">' + label + '</a>';
      }
    }
    
    _editor.executeCommand("inserthtml", link);
    I3.ui.endPopupDialog();
  }
  
  /**
   * Private Method: _createLinkDialog
   *
   * Creates the element that will display the "Create Link" dialog.
   */
  @method _createLinkDialog() {
    if (_linkDialog) {
      _linkDialog.parentNode.removeChild(_linkDialog);
      _linkDialog = null;
    }
    
    _linkDialog = I3.ui.create("DIV");
    _linkDialog.style.display = "none";
    _linkDialog.className = "i3editorCreateLinkDialog";
    _linkDialog.innerHTML = 
      '<table>' + 
      '  <tr id="i3editorCreateLinkDialogURLRow">' + 
      '    <td class="label">URL</td>' + 
      '    <td class="field"><input id="i3editorCreateLinkDialogURLInput" /></td>' + 
      '  </tr>' + 
      '  <tr id="i3editorCreateLinkDialogLabelRow">' + 
      '    <td class="label">Label</td>' + 
      '    <td class="field"><input id="i3editorCreateLinkDialogLabelInput" /></td>' + 
      '  </tr>' + 
      '</table>' + 
      '<div class="i3editorCreateLinkDialogInstructions">' + 
      '  <p>Please enter a URL or email address in the "URL" field.</p>' + 
      '  <p>To specify an external address, prefix it with "http://" or "https://" ' + 
      '    (e.g. "http://www.google.com").</p>' + 
      '  <p>Otherwise, use the i3 relative path (e.g. "/home/customize").</p>' + 
      '</div>';
    I3.ui.get("appletContent").appendChild(_linkDialog);
  }
  
  /**
   * Private Method: _createImageDialog
   *
   * Creates the element that will display the "Insert Image" dialog.
   */
  @method _createImageDialog() {
    if (_imageDialog) {
      _imageDialog.parentNode.removeChild(_imageDialog);
      _imageDialog = null;
    }
    
    _imageDialog = I3.ui.create("DIV");
    _imageDialog.style.display = "none";
    _imageDialog.className = "i3editorInsertImageDialog";
    var baseClass = "i3editorImageAlignItem i3editorToolbarImageItem";
    _imageDialog.innerHTML = 
      '<table>' + 
      '  <tr id="i3editorInsertImageDialogURLRow">' + 
      '    <td class="label">Select Image</td>' + 
      '    <td class="field">' + 
      '      <select id="i3editorInsertImageDialogImageChooser"></select>' + 
      '      <span id="i3editorInsertImageDialogUploadFileLink"></span>' + 
      '    </td>' + 
      '  </tr>' + 
      '  <tr id="i3editorInsertImageDialogLabelRow">' + 
      '    <td class="label">Text Alternative</td>' + 
      '    <td class="field"><input id="i3editorInsertImageDialogLabelInput" /></td>' + 
      '  </tr>' + 
      '  <tr>' + 
      '    <td class="label">Dimensions</td>' + 
      '    <td class="field">' + 
      '      Width: <input id="i3editorInsertImageDialogWidthInput" size="4" />&nbsp;&nbsp;' + 
      '      Height: <input id="i3editorInsertImageDialogHeightInput" size="4" />' + 
      '    </td>' + 
      '  </tr>' + 
      '  <tr id="i3editorInsertImageAlignmentRow">' + 
      '    <td class="label">Alignment</td>' + 
      '    <td class="field">' + 
      '      <ul style="margin:0;padding:0;">' + 
      '        <li class="' + baseClass + ' i3editorToolbarItemImageAlignLeft"' + 
      '            title="Float left; wrap text.">&nbsp;</li>' + 
      '        <li class="' + baseClass + ' i3editorToolbarItemImageAlignBlock"' + 
      '            title="Block">&nbsp;</li>' + 
      '        <li class="' + baseClass + ' i3editorToolbarItemImageAlignRight"' + 
      '            title="Float right; wrap text.">&nbsp;</li>' + 
      '        <li class="' + baseClass + ' i3editorToolbarItemImageAlignInline"' + 
      '            title="Display inline.">&nbsp;</li>' + 
      '      </ul>' + 
      '    </td>' + 
      '  </tr>' + 
      '</table>';
    I3.ui.get("appletContent").appendChild(_imageDialog);
    
    I3.ui.get("i3editorInsertImageDialogUploadFileLink").appendChild(
      I3.ui.createActionLink("Attach New File", null, "Attach:File", _editor._showUploadForm));
    
    var alignments = _imageDialog.getElementsByTagName("LI");
    if (alignments.length != 4) {
      // Sanity check
      I3.ui.displayError("Incorrect number of image alignment options.");
      return;
    }
    
    // Pre-select the first one (float left)
    alignments[0].className += " i3editorToolbarItemSelected";
    alignments[0].alignment = "left";
    alignments[1].alignment = "block";
    alignments[2].alignment = "right";
    alignments[3].alignment = "inline";
    
    // Add click handlers
    for (var i = 0; i < alignments.length; i++) {
      I3.ui.addEventListener(alignments[i], "click", self._onImageAlignmentSelected);
    }
  }
  
  /**
   * Private Method: _handleImageInsertion
   *
   * Handles the insertion of images.
   */
  @method _handleImageInsertion() {
    if (!_imageDialog) self._createImageDialog();
    
    self.setAvailableImages(_editor.getAvailableImages());
    I3.ui.get("i3editorInsertImageDialogLabelInput").value = "";
    
    I3.ui.popupDialogWithElement(
      _imageDialog, 
      {
        title: "Insert Image", 
        width: 500, 
        cancelButton: true, 
        acceptButton: {
          label: "Insert Image", 
          onclick: self._insertImageInEditor
        }
      });
  }
  
  /**
   * Private Method: _insertImageInEditor
   *
   * Description of method
   *
   * Parameters:
   *   e - the event info
   */
  @method _insertImageInEditor(e) {
    var url, altText, width, height, style;
    
    url     = I3.ui.get("i3editorInsertImageDialogImageChooser").value;
    altText = I3.ui.get("i3editorInsertImageDialogLabelInput").value;
    width   = I3.ui.get("i3editorInsertImageDialogWidthInput").value;
    height  = I3.ui.get("i3editorInsertImageDialogHeightInput").value;
    
    var dimensions = "";
    if (width != "")  dimensions += 'width="' + width + '" ';
    if (height != "") dimensions += 'height="' + height + '" ';
    
    var alignments = _imageDialog.getElementsByTagName("LI");
    var alignment = "left";  // Set a default just in case
    for (var i = 0; i < alignments.length; i++) {
      if (I3.ui.elementHasClassName(alignments[i], "i3editorToolbarItemSelected")) {
        alignment = alignments[i].alignment;
        break;
      }
    }
    
    switch(alignment) {
      case "left":
        style = "display:block;float:left;margin-right:8px;";
        break;
      case "block":
        style = "display:block;text-align:center;";
        break;
      case "right":
        style = "display:block;float:right;margin-left:8px;";
        break;
      case "inline":
      default:
        style = "display:inline;margin:0px 8px 0px 8px;";
        break;
    }
    
    var html = '<img src="' + url + '" ' + 
                    'title="' + altText + '" ' + 
                    'alt="' + altText + '" ' + 
                    dimensions + 
                    'style="' + style + '" />';
    _editor.executeCommand("inserthtml", html);
    I3.ui.endPopupDialog();
  }
  
  /**
   * Method: setAvailableImages
   *
   * Sets the images that are available in the "Insert Image..." chooser.
   * 
   * Parameters:
   *   images - an array of images that are available to add to the article.
   */
  @method setAvailableImages(images) {
    var select = I3.ui.get("i3editorInsertImageDialogImageChooser");
    select.options.length = 0;  // Reset the box
    for (var i = 0; i < images.length; i++) {
      select.options[select.options.length] = new Option(images[i].name, images[i].client_path);
    }
  }
  
  /**
   * Private Method: _onImageAlignmentSelected
   *
   * Description of method
   *
   * Parameters:
   *   e - the event info
   */
  @method _onImageAlignmentSelected(e) {
    e = I3.ui.getEvent(e);
    var element = e.getTarget();
    if (element.tagName != "LI") element = I3.ui.getParentWithTagName("LI", element);
    var alignments = _imageDialog.getElementsByTagName("LI");
    for (var i = 0; i < alignments.length; i++) {
      I3.ui.removeClassFromElement(alignments[i], "i3editorToolbarItemSelected");
    }
    I3.ui.addClassToElement(element, "i3editorToolbarItemSelected");
  }
  
  /**
   * Private Method: _handleAttachments
   *
   * Description of method
   *
   * Parameters:
   *   e - the event info
   */
  @method _handleAttachments(e) {
    _editor._showUploadForm();
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Private Group: Constructor
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Private Method: _initialize
   */
  @method _initialize() {
    
  }
  
  self._initialize();
}
