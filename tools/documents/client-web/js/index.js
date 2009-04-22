/**
 * Script: documents/client-web/js/index
 *
 * Displays the document list.
 *
 * Credits:
 * 
 *   Written by 
 *     Marshall Elfstrand (marshall@vengefulcow.com) and
 *     Nathan Mellis (nathan@mellis.us).
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
 *   $Id: index.js 127 2008-10-27 20:41:10Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Documents
 *
 * Contains classes and data for the Documents tool.
 */
@module Documents;

// ---------------------------------------------------------------------------

/**
 * Class: Documents.IndexApplet
 *
 * Manages the Documents tool.  All virtual paths in /documents/
 * are sent through this applet for display.
 */
@class IndexApplet {

  // -------------------------------------------------------------------------
  // Constants
  // -------------------------------------------------------------------------

  /**
   * Constant: SEARCH_MARKER
   * The string passed to <constructNavBar> when searching.
   */
  var SEARCH_MARKER    = "#search";
  var COLLECTION_LABEL = "Collections";

  // -------------------------------------------------------------------------
  // Instance variables
  // -------------------------------------------------------------------------

  var _currentPath;  // current document path being displayed
  var _isSearching;  // true when search results are being displayed
  var _searchText;   // search text box
  var _limitSearch;  // search folder limit checkbox
  
  var _redirectingFromRoot = false;
  var _rootFolderData;
  
  var _currentSection;

  // -------------------------------------------------------------------------
  // Initializer
  // -------------------------------------------------------------------------

  /**
   * Method: initialize
   *
   * Initializes the Index applet.
   */
  @method initialize() {
    // Handle search box change events.
    _searchText = I3.ui.get("documents-searchText");
    _searchText.onkeyup = self.onSearchChange;
    
    _limitSearch = I3.ui.get("documents-onlyin");
  }

  /**
   * Method: loadPath
   *
   * Loads the data for the given document path.
   * 
   * If the path begins with "search?", it is treated as a search result.
   * Otherwise, the file list for the given path is displayed.  If no
   * path is provided, an overview page is displayed.
   *
   * Parameters:
   *   path - the path to display
   */
  @method loadPath(path) {
    _currentPath = path;
    _isSearching = (_currentPath.substr(0, 8) == "/search?");
    if (_isSearching) self.requestSearch(path.substr(10));
    else {
      if (_redirectingFromRoot) {
        self.constructNavBar(path);
        self.displayListResults(_rootFolderData);
        _redirectingFromRoot = false;
      }
      else {
        self.requestList(path);
      }
    }
  }

  // -------------------------------------------------------------------------
  // Navigation bar builder
  // -------------------------------------------------------------------------

  /**
   * Method: constructNavBar
   *
   * Builds the navigation bar for the current path.
   *
   * Parameters:
   *   path - the directory path being displayed
   */
  @method constructNavBar(path) {
    
    if (path == "/") {

      // We're in the root of the Documents applet, so Documents shouldn't
      // be linked.
      I3.navbar.addToPath("Documents");

    } else {

      // We're displaying a subdirectory, so we can link to the root.
      var basePath = "/documents/";
      I3.navbar.addToPath("Documents", { link: basePath });
      
      // See if we're getting search results.
      if (path == SEARCH_MARKER) {
      
        I3.navbar.addToPath("Search", { icon: "search" });
      
      } else {
        var collectionPrefix = "/" + COLLECTION_LABEL;
        var isCollection = path.substr(0, collectionPrefix.length) == collectionPrefix
        
        // Filter out any empty strings in the path.
        var pathSplit = path.split("/");
        var pathElements = [];
        for (var i = 0; i < pathSplit.length; i++) {
          if (pathSplit[i].length > 0)
            pathElements.push(decodeURIComponent(pathSplit[i]));
        }

        // Add links to each element in the path except the final one.
        var builtPath = basePath;
        for (var i = 0; i < (pathElements.length - 1); i++) {
          builtPath += encodeURIComponent(pathElements[i]) + "/";
          // Handle Public and Department links specially.
          if (builtPath == basePath + "Public/" ||
              builtPath == basePath + "Public/Departments/") {
            I3.navbar.addToPath(
              pathElements[i], { link: basePath,
                icon: "file-types/folder", tool: "common" });
          }
          else {
            if (isCollection) {
              I3.navbar.addToPath(pathElements[i], { link: builtPath, icon: "collection" });
            }
            else {
              I3.navbar.addToPath(pathElements[i], { 
                link: builtPath, icon: "file-types/folder", tool: "common" });
            }
          }
        }
        
        // Add the final element with no link.
        var lastElement = pathElements[pathElements.length - 1];
        if (isCollection) {
          I3.navbar.addToPath(lastElement, { icon: "collection" });
        }
        else {
          I3.navbar.addToPath(lastElement, { icon: "file-types/folder", tool: "common" });
        }
      }
    }
  }
  
  // -------------------------------------------------------------------------
  // Request methods
  // -------------------------------------------------------------------------

  /**
   * Method: requestList
   *
   * Makes the request to the <documents/data/documents> web service for
   * the file listing for the current path.
   *
   * Parameters:
   *   path - the directory path to list
   */
  @method requestList(path) {
    self.constructNavBar(path);
    self.hideFileSections();
    I3.ui.show("documents-loading");
    _searchText.value = "";
    
    // Check to see if we have menu data already
    var options = "";
    if (Documents.shares == null) {
      options = "?with-shares=true";
    }

    I3.client.getObject("/documents/data/documents" + path + options,
        self.onListResponse);
  }

  /**
   * Method: requestSearch
   *
   * Makes the request to the <documents/data/search> web service for
   * the given query.
   *
   * Parameters:
   *   query - the query string entered by the user
   */
  @method requestSearch(query) {
    self.constructNavBar(SEARCH_MARKER);
    self.hideFileSections();
    I3.ui.show("documents-searching");
    var niceQuery = decodeURIComponent(query);
    _searchText.value = niceQuery.match(/^([^&]+)/)[1];
    
    var hasFolderLimit = niceQuery.search(/&in=/) != -1;
    _limitSearch.checked = hasFolderLimit;

    // Check to see if we have menu data already
    var options = "";
    if (Documents.shares == null) {
      options = "&with-shares=true";
    }
    
    I3.client.getObject("/documents/data/search?q=" + query + options,
        self.onSearchResponse);
  }

  /**
   * Method: hideFileSections
   *
   * Hides the headers and file sections so that nothing is displayed
   * while a request is being made.
   */
  @method hideFileSections() {
    I3.ui.hide("documents-fileSectionsContainer");
  }

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  /**
   * Method: onSearchChange
   *
   * Called when the user enters something in the search box.
   * 
   * Parameters:
   *   e - the change event parameters
   */
  @method onSearchChange(e) {
    e = I3.ui.getEvent(e);
    if (e.getKeyCode() == 13) {  // Enter
      var query = encodeURIComponent(_searchText.value);
      var searchPath = "";
      if (_currentPath.search("^/search") != -1) {
        if (_currentPath.search(/&in=/) != -1) {
          searchPath = _currentPath.match(/&in=([^&]+)/)[1];
        }
      }
      else {
        searchPath = _currentPath;
      }
      var onlyin = (_limitSearch.checked && searchPath != "") ? ("&in=" + searchPath) : "";
      I3.client.navigateTo("/documents/search?q=" + query + onlyin);
    }
  }

  /**
   * Method: onListResponse
   *
   * Called when the file list has been retrieved from the server.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onListResponse(response) {
    if (response.isOK()) {
      var result = response.getObject();
      if (_currentPath == "/") {
        _redirectingFromRoot = true;
        _rootFolderData = result;
        I3.client.navigateTo(result.sections[0].path.replace("/documents/data/", "/"));
      }
      else {
        self.displayListResults(result);
      }
    }
    I3.ui.hide("documents-loading");
  }
  
  /**
   * Method: displayListResults
   *
   * Displays the results received from the web service.
   *
   * Parameters:
   *   result - description
   */
  @method displayListResults(result) {
    // Check to see if the shares list is included in the object
    self._buildSharesMenu(result.collections, result.shares);
    
    var container = I3.ui.clear("documents-fileSectionsContainer");
    if (result.is_searchable) I3.ui.show("documents-toolbar");
    
    if (!result.sections || result.sections.length == 0) {
      container.innerHTML = "<em>There are no results to display</em>";
    }
    else {
      for (var i=0; i<result.sections.length; i++) {
        var section = result.sections[i];
        if (_currentPath.search(/^\/[^\/]+\/$/) != -1) {

          // Partition files into public and departments
          var publicFiles = [];
          var deptFiles = [];
          for (var i = 0; i < section.files.length; i++) {
            if (section.files[i].name.substr(0, 12) == "Departments/") {
              // Department entry.  Remove prefix and add to department list.
              section.files[i].name = section.files[i].name.substr(12);
              deptFiles.push(section.files[i]);
            } else {
              // Public entry.  Add to public list.
              publicFiles.push(section.files[i]);
            }
          }

          // Build public section.
          var publicSection = self.createFileSection({
            name: "Shared", 
            path: section.path, 
            kind: section.kind, 
            share_name: section.share_name, 
            files: publicFiles
          });
          container.appendChild(publicSection);
          
          if (deptFiles.length > 0) {
            // Build department section.
            var deptSection = self.createFileSection({
              name: "Departments", 
              path: section.path, 
              kind: section.kind, 
              share_name: section.share_name, 
              files: deptFiles
            });
            container.appendChild(deptSection);
          }

        } else {
          // Display entire file list
          var section = self.createFileSection(section);
          container.appendChild(section);
        }
      }
    }
    
    I3.ui.show(container);
  }
  
  /**
   * Method: onSearchResponse
   *
   * Called when a search has finished.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onSearchResponse(response) {
    if (response.isOK()) {
      var results = response.getObject();
      
      // Check to see if the shares list is included in the object
      self._buildSharesMenu(results.collections, results.shares);
      var container = I3.ui.clear("documents-fileSectionsContainer");
      
      var name = 'Search results for "' + _searchText.value + '"';
      if (_currentPath.search(/&in=/) != -1)
        name += ' in "' + decodeURIComponent(_currentPath.match(/&in=([^&]+)/)[1]) + '"';
      
      var section = self.createFileSection({
        name: name, 
        path: "", 
        kind: "", 
        share_name: "", 
        files: results.files
      }, true);
      container.appendChild(section);
    }
    I3.ui.hide("documents-searching");
    I3.ui.show("documents-toolbar");
    I3.ui.show(container);
  }
  
  
  // -------------------------------------------------------------------------
  // Shares menu builder
  // -------------------------------------------------------------------------
  
  /**
   * Private Method: _buildSharesMenu
   *
   * Builds a menu with all the user's share points for quick accessibility.  The menu controller
   * will be stored in `Documents.shares`.
   * 
   * Assumes that the first item in the array will be the root "Public" folder.
   *
   * Parameters:
   *   collections - an array of collection names
   *   shares - an array of share points
   */
  @method _buildSharesMenu(collections, shares) {
    if (shares != null && Documents.shares == null) {
      Documents.shares = new I3.MenuController(I3.ui.clear("documents-shares-menu"));
      Documents.shares.setMenuIconType("small");
      Documents.shares.setTitle("Places");
      
      Documents.shares.addGroup(COLLECTION_LABEL);
      for (var i=0; i<collections.length; i++) {
        var path = "/documents/" + COLLECTION_LABEL + "/" + collections[i] + "/";
        var key  = "/" + COLLECTION_LABEL + "/" + collections[i] + "/";
        Documents.shares.addItem("All " + collections[i], { 
          link: path, key: key, icon: "collection" });
      }
      
      Documents.shares.addGroup("Shares");
      for (var i=0; i<shares.length; i++) {
        var path = shares[i].path.replace("/documents/data/", "/");
        var key  = path.slice(10);
        Documents.shares.addItem(shares[i].name, {
          link: path, 
          key: key, 
          icon: "file-types/folder", 
          tool: "common"
        });
      }
    }
    
    var splitCurrentPath = _currentPath.split("/");
    var endIndex;
    if (splitCurrentPath[1] == COLLECTION_LABEL)
      endIndex = 3;
    else
      endIndex = 2;
    
    Documents.shares.selectItem(splitCurrentPath.slice(0, endIndex).join("/") + "/");
  }

  // -------------------------------------------------------------------------
  // File list builder
  // -------------------------------------------------------------------------
  
  /**
   * Method: createFileSection
   *
   * Creates a file section complete with header, etc.
   *
   * Parameters:
   *   section - a file section that was received from the web service
   *   fromSearch - `true` if we are displaying search results; `false` otherwise
   */
  @method createFileSection(section, fromSearch) {
    if (fromSearch == null) fromSearch = false;
    
    _currentSection = section;
    
    var container, header, readme, readmeHeader, readmeText, fileSection;
    
    // Create elements
    container    = I3.ui.create("DIV");
    header       = I3.ui.create("H3");
    readme       = I3.ui.create("DIV");
    readmeHeader = I3.ui.create("DIV");
    readmeText   = I3.ui.create("DIV");
    fileSection  = I3.ui.create("DIV");
    
    // Set styles
    header.className       = "documents-header";
    if (fromSearch)
      header.className    += " documents-searchHeader";
    else
      header.className    += " documents-fileHeader";
    readme.className       = "documents-fileSectionReadme";
    readmeHeader.className = "documents-fileSectionReadmeHeader";
    readmeText.className   = "documents-fileSectionReadmeText";
    fileSection.className  = "documents-fileSection";
    
    // Fill and append header
    header.innerHTML = section.name;
    if (!fromSearch) header.innerHTML += " <em>(" + section.share_name + ")</em>";
    container.appendChild(header);
    
    // Fill and append readme
    if (section.readme) {
      readmeHeader.innerHTML = "Contents of <strong>" + section.readme.file + "</strong>";
      readmeText.innerHTML = section.readme.text;
      if (section.readme.type == "text-plain")
        readmeText.style.whiteSpace = "pre";
      else
        readmeText.style.whiteSpace = "normal";
      
      readme.appendChild(readmeHeader);
      readme.appendChild(readmeText);
      container.appendChild(readme);
    }
    
    // Prepend an entry to go up a folder and upload a file (if applicable)
    var files;
    if (fromSearch)
      files = section.files;
    else {
      files = [];
      if (section.writable) {
        files.push({
          small_icon: "/documents/client-web/img/upload-16.png", 
          name: "Upload a file", 
          path: section.path, 
          size: "", 
          modified_at: "", 
          isUploadLink: true
        })
      }
      if (section.path.replace("/documents/data/documents/", "").split("/").length > 2) {
        var pathArray     = section.path.split("/");
        var cap           = pathArray.pop();
        var currentFolder = pathArray.pop();
        var parentFolder  = pathArray.pop();
        files.push({
          small_icon: "/common/client-web/img/file-types/folder-16.png", 
          name: "Go up to " + parentFolder, 
          path: pathArray.join("/") + "/" + parentFolder + "/", 
          size: "", 
          modified_at: "", 
          is_folder: true, 
          isParentFolderLink: true
        })
      }
      
      // Add the actual files
      files = files.concat(section.files);
    }
    
    // Fill section table
    if (files.length > 0) {
      var model = new I3.ArrayTableModel(files);
      model.addColumn({ title: "", field: "small_icon",
                        formatter: self.formatIcon,
                        style: "documents-iconCell" });
      model.addColumn({ title: "Name", field: "name",
                        formatter: self.formatFileName,
                        comparator: self.compareFiles,
                        style: "documents-nameCell" });
      model.addColumn({ title: "Size", field: "size",
                        formatter: self.formatSize,
                        style: "documents-sizeCell" });
      model.addColumn({ title: "Modified", field: "modified_at",
                        formatter: self.formatDate,
                        style: "documents-dateCell" });

      // Build and display the table view.
      var view = new I3.TableView(fileSection);
      view.setModel(model);
      view.display();
      view.sort(1);  // Sort by name
    }
    else {
      if (fromSearch)
        fileSection.innerHTML = "<em>Search returned 0 results</em>";
      else
        fileSection.innerHTML = "<em>This folder is empty</em>";
    }
    container.appendChild(fileSection);
    
    return container;
  }

  /**
   * Method: compareFiles
   *
   * Compares two files by both their types and the given values for
   * sorting.  This causes folders to be displayed before files.
   * 
   * If the item is either the upload link or the folder up link, they will automatically be 
   * sorted to the top.
   *
   * Parameters:
   *   value1 - the first value being compared
   *   value2 - the second value being compared
   *   field - the name of the field that the list is being sorted on
   *   row1 - the data for the first row being compared
   *   row2 - the data for the second row being compared
   * 
   * Returns:
   *   * `-1` if the first file comes before the second one
   *   * `0` if the two file names/types are identical
   *   * `1` if the first file comes after the second one
   */
  @method compareFiles(value1, value2, field, row1, row2) {
    if (row1.isUploadLink)
      return -1;
    else if (row2.isUploadLink)
      return 1;
    else if (row1.isParentFolderLink)
      return -1;
    else if (row2.isParentFolderLink)
      return 1;
    else if (row1.is_folder == row2.is_folder) {
      // Same type; do a standard value comparison.
      value1 = value1.toString().toLowerCase();
      value2 = value2.toString().toLowerCase();
      if (value1 < value2) return -1;
      if (value1 > value2) return 1;
      return 0;
    }
    else {
      // Folders come before files.
      if (row1.is_folder) return -1;
      return 1;
    }
  }

  // -------------------------------------------------------------------------
  // Table formatters
  // -------------------------------------------------------------------------

  /**
   * Method: formatIcon
   *
   * Renders the given icon path as an image.
   *
   * Parameters:
   *   value - the value being formatted
   *   field - the name of the field providing the value
   *   row - the data for the entire row
   * 
   * Returns:
   *   An HTML-formatted string.
   */
  @method formatIcon(value, field, row) {
    return '<img src="' + value + '" width="16" height="16" />';
  }

  /**
   * Method: formatFileName
   *
   * Converts the file name to a hyperlink.
   * 
   * Folder names become navigation links.  File names become standard
   * hyperlinks, so that the browser downloads the file properly.
   *
   * Parameters:
   *   value - the value being formatted
   *   field - the name of the field providing the value
   *   row - the data for the entire row
   * 
   * Returns:
   *   An HTML-formatted string.
   */
  @method formatFileName(value, field, row) {
    // The path provided in the row is to the web service for retrieving
    // the folder or file.  Here we convert it into a virtual path for
    // the client to use.
    var link;
    if (row.is_folder) {
      var label = value.split("/")[0];
      if (row.isParentFolderLink) label = "<em>" + label + "</em>";
      link = I3.ui.createNavigationLinkHTML(label, row.path.replace("/documents/data/", "/"));
    } 
    else {
      if (row.isUploadLink) {
        link = "<em>" + I3.ui.createActionLinkHTML(
            value, row.path, "Upload:File", self.showUploadForm) + "</em>";
      }
      else {
        link = '<a href="' + row.path + '">' + value + '</a>';
      }
    }
    if (_isSearching) {
      // Search results get an extra description row telling where
      // they were found.
      var parentFolder = row.path.substr(0, row.path.lastIndexOf("/"));
      parentFolder = parentFolder.replace("/documents/data/documents/", "");
      link += "<br />" + parentFolder + " folder";
    }
    return link;
  }

  /**
   * Method: formatSize
   *
   * Converts the file size to kilobytes.  Folder sizes are left empty.
   *
   * Parameters:
   *   value - the value being formatted
   *   field - the name of the field providing the value
   *   row - the data for the entire row
   * 
   * Returns:
   *   An HTML-formatted string.
   */
  @method formatSize(value, field, row) {
    if (row.is_folder || isNaN(parseInt(value))) return "&nbsp;";
    return I3.util.formatWithCommas(Math.ceil(parseInt(value) / 1000)) + "&nbsp;K";
  }

  /**
   * Method: formatDate
   *
   * Renders the date in a friendly format.
   *
   * Parameters:
   *   value - the value being formatted
   *   field - the name of the field providing the value
   *   row - the data for the entire row
   * 
   * Returns:
   *   An HTML-formatted string.
   */
  @method formatDate(value, field, row) {
    var date = new Date(value);
    if (date == "Invalid Date" || date == "NaN") return "&nbsp;";
    return I3.util.formatFriendlyDate(date).replace(/^on /, "");
  }
  
  
  // -----------------------------------------------------------------------------------------------
  // Group: Upload methods
  // -----------------------------------------------------------------------------------------------
  
  /**
   * Method: showUploadForm
   *
   * Displays a popup to enable file uploads.
   *
   * Parameters:
   *   e - the event info
   */
  @method showUploadForm(e) {
    e = I3.ui.getEvent(e);
    var path = e.getInfo();

    I3.ui.hide("documents-fileUploadProgressContainer");
    I3.ui.show("documents-fileUploadFormContainer");
    
    var uploader = new I3.CustomFileUploader(
      I3.ui.get("documents-fileUploadForm"), path, self._onFileUploadComplete);
    
    I3.ui.popupDialogWithElement(
      I3.ui.get("documents-fileUploadContainer"), 
      {
        title: "Upload a File", 
        width: 500, 
        cancelButton: true, 
        acceptButton: {
          label: "Upload File", 
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
    
    I3.ui.hide("documents-fileUploadFormContainer");
    I3.ui.show("documents-fileUploadProgressContainer");
    
    var form = I3.ui.get("documents-fileUploadForm");
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
      var newFile = true;
      for (var i = 0; i < _currentSection.files.length; i++) {
        if (_currentSection.files[i].path == obj.path) {
          _currentSection.files[i] = obj;
          newFile = false;
          break;
        }
      }
      if (newFile) _currentSection.files.push(obj);
      var container = I3.ui.clear("documents-fileSectionsContainer");
      var section = self.createFileSection(_currentSection);
      container.appendChild(section);
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
    // Sanity check
    if (!response.path || !response.original_filename || !response.temp_file) {
      I3.ui.displayError("There was a problem uploading your file.  Please try again.");
      return;
    }
    
    var newFilenameElement = I3.ui.get("documents-fileUploadNewFilename");
    var overwriteFileNotice = I3.ui.clear("documents-fileUploadOverwriteFileNotice");
    if (response.overwritable) {
      overwriteFileNotice.appendChild(I3.ui.text(
        "If you leave the existing filename, the old file will be overwritten."));
      newFilenameElement.value = response.original_filename;
    }
    else {
      var lastDotIndex = response.original_filename.lastIndexOf(".");
      var filename = response.original_filename.slice(0, lastDotIndex);
      var extension = response.original_filename.slice(lastDotIndex);
      newFilenameElement.value = filename + "-1" + extension;
    }
    
    var options = {
      title: "Save Uploaded File As...", 
      width: 500, 
      cancelButton: true, 
      acceptButton: {
        label: "Save", 
        onclick: function(e) {
          e = I3.ui.getEvent(e);
          e.getTarget().disabled = true;
          I3.client.putObject(
            { temp_file: response.temp_file }, 
            "/documents/data/documents" + response.path + "/" + newFilenameElement.value, 
            function(r) {
              if (r.isOK()) self._onFileUploadComplete(r.getObject());
            })
        }
      }
    }
    
    I3.ui.popupDialogWithElement(
      I3.ui.get("documents-fileUploadExistingFileContainer"), options);
  }
  
}  // end Documents.IndexApplet
