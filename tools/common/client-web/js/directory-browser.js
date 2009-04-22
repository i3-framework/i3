/**
 * Script: common/client-web/js/directory-browser
 *
 * Provides a method for browsing through entries in the directory service.  Usually used to 
 * assign permissions.
 *
 * *Usage*
 * 
 * Inline page example:
 * (start example)
 * 
 *   @method showBrowser() {
 *     // Display the browser in the page
 *     var browser = new I3.DirectoryBrowser(I3.ui.get("browserContainer"), false);
 *     browser.onGroupAdd = self.onGroupAdd;
 *     browser.onUserAdd = self.onUserAdd;
 *     browser.show();
 *   }
 * 
 *   @method onGroupAdd(groupDN) {
 *     alert("Added group: " + groupDN);
 *   }
 * 
 *   @method onUserAdd(accountName) {
 *     alert("Added user: " + accountName);
 *   }
 * 
 * (end example)
 * 
 * Popup dialog example:
 * (start example)
 * 
 *   @method initialize() {
 *     // Create the browser as a popup
 *     var browser = new I3.DirectoryBrowser(I3.ui.get("browserContainer"), true);
 *     browser.onGroupAdd = self.onGroupAdd;
 *     browser.onUserAdd = self.onUserAdd;
 * 
 *     I3.ui.get("myButton").onclick = function(e) { browser.show() };
 *   }
 * 
 *   @method onGroupAdd(groupDN) {
 *     alert("Added group: " + groupDN);
 *   }
 * 
 *   @method onUserAdd(accountName) {
 *     alert("Added user: " + accountName);
 *   }
 * 
 * (end example)
 * 
 * 
 * You may also supply a list of group DNs or user account names that have already been selected 
 * and should therefore be disabled in the browser.  Use the 
 * <I3.DirectoryBrowser.setExistingGroupDNs> and <I3.DirectoryBrowser.setExistingUserAccountNames> 
 * methods to supply an array of strings containing either the group DNs or account names.
 * 
 * If you need to use your own custom web service to retrieve the group and user data, you 
 * may supply it using the <I3.DirectoryBrowser.setWebServicePath> method.  If you do create your 
 * own, it should conform to the same REST spec as "/admin/data/groups".
 * 
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
 *   $Id: directory-browser.js 74 2008-04-02 19:26:19Z nmellis $
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
 * Class: I3.DirectoryBrowser
 *
 * Displays a browser of groups and their users.  Users of this class assign event handlers for 
 * when groups or users are selected from the browser.  The browser may be displayed either as a 
 * popup dialog or inline in the page.
 * 
 * Parameters:
 *   container - a string or HTML element to use as the container for this control
 *   isDialog - `true` if this should be used as a popup dialog; `false` to display in page
 */
@class DirectoryBrowser(container, isDialog) {
  
  // CSS styles (class names) to use for table rendering.
  var CSS_CLASS_TABLE               = "i3directoryBrowserTable";
  var CSS_CLASS_ROW                 = "i3tableRow";
  var CSS_CLASS_ROW_ALT             = "i3tableRowAlt";
  var CSS_CLASS_ROW_SEL             = "i3tableRowSelected";
  var CSS_CLASS_ROW_INACTIVE        = "i3directoryBrowserRowSelectedInactive";
  var CSS_CLASS_CELL_HIDDEN         = "i3directoryBrowserCellHidden";
  var CSS_CLASS_LIST_CONTAINER      = "i3directoryBrowserListContainer";
  var CSS_CLASS_GROUP_CELL          = "i3directoryBrowserGroupListCell";
  var CSS_CLASS_GROUP_ICON          = "i3directoryBrowserGroupListIconCell";
  var CSS_CLASS_GROUP_NAME          = "i3directoryBrowserGroupListNameSpan";
  var CSS_CLASS_GROUP_DISABLED      = "i3directoryBrowserGroupListDisabled"
  var CSS_CLASS_USER_CELL           = "i3directoryBrowserUserListCell";
  var CSS_CLASS_USER_ICON           = "i3directoryBrowserUserListIconCell";
  var CSS_CLASS_USER_NAME           = "i3directoryBrowserUserListNameSpan";
  var CSS_CLASS_USER_DESC           = "i3directoryBrowserUserListDescriptionSpan";
  var CSS_CLASS_USER_DISABLED       = "i3directoryBrowserUserListDisabled";
  var CSS_CLASS_SELECTION_CONTAINER = "i3directoryBrowserSelectionContainer";
  var CSS_CLASS_SELECTION_SPAN      = "i3directoryBrowserSelectionSpan";
  var CSS_CLASS_BUTTON_CONTAINER    = "i3directoryBrowserButtonContainer";
  var CSS_CLASS_LOADING             = "i3directoryBrowserLoadingText";
  var CSS_CLASS_HELP                = "i3directoryBrowserHelpText";

  // Control references.
  var _container;
  var _groupListContainer;
  var _userListContainer;
  var _selectedGroupRow;
  var _selectedUserRow;
  var _groupFilterCell;
  var _userFilterCell;
  var _selectionContainer;
  var _selectionSpan;
  var _buttonContainer;
  var _addButton;
  var _closeButton;

  // List of all groups.
  var _allGroupList;
  var _groupListNeedsLoading;
  
  // Table views
  var _groupListTableView;
  var _userListTableView;
  
  var _lastUserSelection  = -1;

  /**
   * Method: getExistingGroupDNs
   * Returns the array of group DN strings that should be disabled.
   *
   * Method: setExistingGroupDNs
   * Sets the array of group DN strings that should be disabled.
   */
  @property existingGroupDNs = [];

  /**
   * Method: getExistingUserAccountNames
   * Returns the array of user account name strings that should be disabled.
   *
   * Method: setExistingUserAccountNames
   * Sets the array of user account name strings that should be disabled.
   */
  @property existingUserAccountNames = [];
  
  /**
   * Method: getWebServicePath
   * Returns the path to the web service that provides the group listing.  If none is provided, 
   * it will use the groups web service in the admin tool.
   *
   * Method: setWebServicePath
   * Sets the path to the web service that provides the group listing.  If none is provided, 
   * it will use the groups web service in the admin tool.
   */
  @property webServicePath = "/admin/data/groups";
  
  /**
   * Private Method: _initialize
   *
   * Retrieves references to controls and sets up default values.
   * 
   * Parameters:
   *   container - a string or HTML element to use as the container for this control
   *   isDialog - `true` if this should be used as a popup dialog; `false` to display in page
   */
  @method _initialize(container, isDialog) {
    _isDialog = isDialog == null ? true : isDialog;
    
    // Retrieve control references.
    _container = I3.ui.clear(container);
    if (_isDialog) I3.ui.hide(_container);
    
    // Create the table that will hold the user and group lists
    var table = I3.ui.create("TABLE");
    table.className = CSS_CLASS_TABLE;

    var thead = I3.ui.create("THEAD");
    var headerRow = I3.ui.createWithContent(
      "TR", I3.ui.createWithContent("TH", "Groups:"), I3.ui.createWithContent("TH", "Users:"));
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    var tbody = I3.ui.create("TBODY");
    var browserRow    = I3.ui.create("TR");
    var groupListCell = I3.ui.create("TD");
    var userListCell  = I3.ui.create("TD");
    
    _groupListContainer = I3.ui.create("DIV");
    _groupListContainer.className = CSS_CLASS_LIST_CONTAINER;
    groupListCell.appendChild(_groupListContainer);
    browserRow.appendChild(groupListCell);
    
    _userListContainer = I3.ui.create("DIV");
    _userListContainer.className = CSS_CLASS_LIST_CONTAINER;
    userListCell.appendChild(_userListContainer);
    browserRow.appendChild(userListCell);
    
    tbody.appendChild(browserRow);
    
    _groupFilterCell = I3.ui.create("TD");
    _userFilterCell  = I3.ui.create("TD");
    filterRow = I3.ui.createWithContent("TR", _groupFilterCell, _userFilterCell);
    tbody.appendChild(filterRow);
    
    _selectionSpan = I3.ui.create("SPAN");
    _selectionSpan.className = CSS_CLASS_SELECTION_SPAN;
    _selectionContainer = I3.ui.createWithContent("DIV", "Selection: ", _selectionSpan);
    _selectionContainer.className = CSS_CLASS_SELECTION_CONTAINER;
    
    _buttonContainer = I3.ui.create("DIV");
    _buttonContainer.className = CSS_CLASS_BUTTON_CONTAINER;
    _addButton = I3.ui.create("INPUT");
    _addButton.type = "button";
    _addButton.value = "Add Group";
    _addButton.onclick = self._onAdd;
    _addButton.disabled = true;
    _closeButton = I3.ui.create("INPUT");
    _closeButton.type = "button";
    _closeButton.value = "Close";
    _closeButton.onclick = self._onClose;
    if (I3.browser.isMac()) {
      if (_isDialog) _buttonContainer.appendChild(_closeButton);
      _buttonContainer.appendChild(_addButton);
    }
    else {
      _buttonContainer.appendChild(_addButton);
      if (_isDialog) _buttonContainer.appendChild(_closeButton);
    }
    
    table.appendChild(tbody);
    _container.appendChild(table);
    _container.appendChild(_selectionContainer);
    _container.appendChild(_buttonContainer);

    // Initialize values.
    _groupListNeedsLoading = true;
  }

  /**
   * Method: show
   *
   * Displays the pop-up group/user browser.  The list of groups is
   * obtained from a web service the first time the browser is displayed.
   */
  @method show() {
    if (_isDialog) I3.ui.popupDialogWithElement(_container, { title: "Add Group/User" });
    
    if (_groupListNeedsLoading) {
      _groupListNeedsLoading = false;

      // Display a loading message.
      var loading = I3.ui.createWithContent("DIV", "Loading...");
      loading.className = CSS_CLASS_LOADING;
      _groupListContainer.appendChild(loading)

      // Fix the width of the "Add Group" button to its current width.
      // This prevents the button from resizing when its label changes.
      // We have to do this here instead of in the initialize method
      // because the button has to be visible for offsetWidth to have
      // a usable value.
      _addButton.style.width = _addButton.offsetWidth + "px";

      // Load the list of all groups.
      I3.client.getObject(_webServicePath, self._onGroupListResponse);
    } else {
      // Disable items that are in the existing group and user lists.
      self._filterGroupList();
      self._filterUserList();
    }
  }

  /**
   * Private Method: _onGroupListResponse
   *
   * Called when the list of all available groups has been retrieved.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method _onGroupListResponse(response) {
    I3.ui.clear(_groupListContainer);
    if (response.isOK()) self._loadGroupList(response.getObject());
  }
  
  /**
   * Private Method: _loadGroupList
   *
   * Adds the list of all groups to the table.
   *
   * Parameters:
   *   groupList - an array of strings, each of which is the full
   *     distinguished name of a group provided by the directory server
   */
  @method _loadGroupList(groupList) {

    // Convert each item into an object containing the item name,
    // an array of path components (not including the domain name),
    // and the full distinguished name.
    _allGroupList = [];
    var groupItem, elements;
    for (var i = 0; i < groupList.length; i++) {
      elements = groupList[i].split(",");
      elements.reverse();
      while (elements[0].substr(0, 3) == "DC=") elements.shift();
      for (var j = 0; j < elements.length; j++) {
        elements[j] = elements[j].split("=")[1];
      }
      groupItem = {};
      groupItem.name = elements[elements.length - 1];
      groupItem.pathElements = elements;
      groupItem.dn = groupList[i];
      _allGroupList.push(groupItem);
    }
    
    // Sort the list by path.
    _allGroupList.sort(function(a, b) {
      var aString = a.pathElements.join("/");
      var bString = b.pathElements.join("/");
      if (aString < bString) return -1;
      if (aString > bString) return 1;
      return 0;
    })

    // Display elements.
    var model = new I3.ArrayTableModel(_allGroupList);
    model.addColumn({ title: "DN", field: "dn", style: CSS_CLASS_CELL_HIDDEN });
    model.addColumn({ title: "Name", field: "name", style: CSS_CLASS_CELL_HIDDEN });
    model.addColumn({ title: "Display", field: "name", formatter: self._formatGroupRow, 
                      style: CSS_CLASS_GROUP_CELL });
    model.enableIndex();
    
    _groupListTableView = new I3.TableView(_groupListContainer);
    _groupListTableView.setModel(model);
    _groupListTableView.setDelegate(self);
    _groupListTableView.setColumnHeadersEnabled(false);
    _groupListTableView.setRowSelectionEnabled(true);
    _groupListTableView.setSearchBoxContainer(_groupFilterCell);
    _groupListTableView.display();
    
    // Disable items in the `existingGroupDNs` array.
    self._filterGroupList();
    
    // Display a help message in the user list.
    var help = I3.ui.createWithContent("DIV", "Select a group to see the user list.");
    help.className = CSS_CLASS_HELP;
    _userListContainer.appendChild(help);
  }
  
  /**
   * Private Method: _formatGroupRow
   *
   * Returns a string of HTML for rendering a group row.
   *
   * Parameters:
   *   value - the value of the cell being rendered
   *   field - the field that contains `value`
   *   row - the data for the row being rendered
   */
  @method _formatGroupRow(value, field, row) {
    var iconSpan, iconPadding, nameSpan;
    iconPadding = (((row.pathElements.length - 1) * 20) + 4).toString();
    iconSpan = '<span class="'+CSS_CLASS_GROUP_ICON+'" style="padding-left:'+iconPadding+'px">' + 
      '<img src="/common/client-web/img/group-16.png" width="16" height="16" /></span>';
    
    nameSpan = '<span class="' + CSS_CLASS_GROUP_NAME + '">' + row.name + '</span>';
    
    return iconSpan + nameSpan;
  }
  
  /**
   * Method (Hidden): tableViewSelectionDidChange
   *
   * Delegate method for <I3.TableView>.  This method is called whenever a row is clicked in a 
   * table.
   *
   * Parameters:
   *   tableView - the <I3.TableView> instance that generated the event
   */
  @method tableViewSelectionDidChange(tableView) {
    var rowIndex = tableView.getSelectedRow();
    var model    = tableView.getModel();
    if (tableView == _groupListTableView) {
      var dn = model.getValueAt(rowIndex, 0);
      var rowIsDisabled = self._groupIsDisabled(dn);
      _selectedGroupRow = { dn: dn, name: model.getValueAt(rowIndex, 1) };
      _selectedUserRow  = null;
      _lastUserSelection = -1;
      self._onGroupClick(rowIsDisabled);
    }
    else if (tableView == _userListTableView) {
      var account = model.getValueAt(rowIndex, 0);
      var rowIsDisabled = self._userIsDisabled(account);
      if (rowIsDisabled) {
        tableView.setSelectedRow(_lastUserSelection);
      }
      else {
        _selectedUserRow = { account: account, full_name: model.getValueAt(rowIndex, 1) };
        self._onUserClick();
        _lastUserSelection = rowIndex;
      }
    }
  }

  /**
   * Private Method: _onGroupClick
   *
   * Called when a group in the list of all groups is clicked.  This calls
   * the web service for listing the users in the group.
   * 
   * Parameters:
   *   rowIsDisabled - `true` if the selected row is disabled; `false` or `null` otherwise
   */
  @method _onGroupClick(rowIsDisabled) {
    self._updateSelection();
    
    if (rowIsDisabled) _addButton.disabled = true;
    
    // Load the user list for the row.
    I3.ui.clear(_userListContainer);
    var loading = I3.ui.createWithContent("DIV", "Loading...");
    loading.className = CSS_CLASS_LOADING;
    _userListContainer.appendChild(loading);
    I3.client.getObject(_webServicePath + "/" + _selectedGroupRow.dn, self._onUserListResponse);
  }
  
  /**
   * Private Method: _groupIsDisabled
   *
   * Checks to see if the `dn` is disabled.
   *
   * Parameters:
   *   dn - the group DN to check
   * 
   * Returns:
   *   `true` if the group is disabled; `false` otherwise.
   */
  @method _groupIsDisabled(dn) {
    if (_existingGroupDNs && _existingGroupDNs.length > 0) {
      for (var i = 0; i < _existingGroupDNs.length; i++) {
        if (dn == _existingGroupDNs[i]) return true;
      }
    }
    return false;
  }

  /**
   * Private Method: _onUserListResponse
   *
   * Called when the list of assignees for the selected privilege
   * has been retrieved.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method _onUserListResponse(response) {
    I3.ui.clear(_userListContainer);
    if (response.isOK()) self._loadUserList(response.getObject());
  }
  
  /**
   * Private Method: _loadUserList
   *
   * Loads the list of users in the selected group into the table.
   *
   * Parameters:
   *   userList - an array of user objects, each of which contains properties
   *     for the user's account name, real name, and description.
   */
  @method _loadUserList(userList) {
    
    // Sort the user list by full name, or account name if the
    // full name is empty.
    userList.sort(function(a, b) {
      var aName = (a.first_name + " " + a.last_name).replace(" ", "");
      var bName = (b.first_name + " " + b.last_name).replace(" ", "");
      if (aName.length == 0) aName = a.account_name;
      if (bName.length == 0) bName = b.account_name;
      if (aName < bName) return -1;
      if (aName > bName) return 1;
      return 0;
    });
    
    var model = new I3.ArrayTableModel(userList);
    model.addColumn({ title: "Account Name", field: "account_name", style: CSS_CLASS_CELL_HIDDEN });
    model.addColumn({ title: "Full Name", retriever: self._retrieveUserFullName, 
                      style: CSS_CLASS_CELL_HIDDEN });
    model.addColumn({ title: "Icon", retriever: self._retrieveUserIconPath, 
                      formatter: self._formatUserIcon, style: CSS_CLASS_USER_ICON });
    model.addColumn({ title: "Display", retriever: self._retrieveUserFullName, 
                      formatter: self._formatUserRow, style: CSS_CLASS_USER_CELL });
    model.enableIndex();
    
    _userListTableView = new I3.TableView(_userListContainer);
    _userListTableView.setModel(model);
    _userListTableView.setDelegate(self);
    _userListTableView.setColumnHeadersEnabled(false);
    _userListTableView.setRowSelectionEnabled(true);
    _userListTableView.setSearchBoxContainer(_userFilterCell);
    _userListTableView.display();
    
    self._filterUserList();
  }
  
  /**
   * Private Method: _retrieveUserIconPath
   *
   * Returns the path to the image to use for users.
   *
   * Parameters:
   *   row - the data for the row being rendered
   */
  @method _retrieveUserIconPath(row) {
    return "/common/client-web/img/user-16.png";
  }
  
  /**
   * Private Method: _formatUserIcon
   *
   * Returns a string of HTML representing a properly configured image.
   *
   * Parameters:
   *   value - the value of the cell being rendered
   *   field - the field that contains `value`
   *   row - the data for the row being rendered
   */
  @method _formatUserIcon(value, field, row) {
    return '<img src="' + value + '" width="16" height="16" />';
  }
  
  /**
   * Private Method: _retrieveUserFullName
   *
   * Returns the full name of the person.
   *
   * Parameters:
   *   row - the data for the row being rendered
   */
  @method _retrieveUserFullName(row) {
    var fullName = row.first_name + " " + row.last_name;
    if (fullName.replace(" ", "").length == 0) fullName = row.account_name;
    return fullName;
  }
  
  /**
   * Private Method: _formatUserRow
   *
   * Returns a string of HTML for displaying the user row.
   *
   * Parameters:
   *   value - the value of the cell being rendered
   *   field - the field that contains `value`
   *   row - the data for the row being rendered
   */
  @method _formatUserRow(value, field, row) {
    var nameSpan, descSpan;
    nameSpan = '<span class="' + CSS_CLASS_USER_NAME + '">' + value + '</span>';
    descSpan = ' <span class="' + CSS_CLASS_USER_DESC + '">' + 
      row.description + ' [' + row.account_name + ']</span>';
    
    return nameSpan + descSpan;
  }
  
  /**
   * Private Method: _onUserClick
   *
   * Called when a user is clicked.  This selects the user.
   */
  @method _onUserClick() {
    self._updateSelection();
  }
  
  /**
   * Private Method: _userIsDisabled
   *
   * Checks to see if the `account` is disabled.
   *
   * Parameters:
   *   account - the user account to check
   * 
   * Returns:
   *   `true` if the user is disabled; `false` otherwise.
   */
  @method _userIsDisabled(account) {
    if (_existingUserAccountNames && _existingUserAccountNames.length > 0) {
      for (var i = 0; i < _existingUserAccountNames.length; i++) {
        if (account == _existingUserAccountNames[i]) return true;
      }
    }
    return false;
  }
  
  /**
   * Private Method: _updateSelection
   *
   * Updates the selection indicator and the label for the "Add" button.
   */
  @method _updateSelection() {
    I3.ui.clear(_selectionSpan);
    var img = I3.ui.create("IMG");
    img.width = 16;
    img.height = 16;
    if (_selectedUserRow) {
      // A user has been selected.
      img.src = "/common/client-web/img/user-16.png";
      _selectionSpan.appendChild(img);
      _selectionSpan.appendChild(I3.ui.text(_selectedUserRow.full_name));
      _addButton.value = "Add User";
      _addButton.disabled = false;
    } else if (_selectedGroupRow) {
      // A group has been selected.
      img.src = "/common/client-web/img/group-16.png";
      _selectionSpan.appendChild(img);
      _selectionSpan.appendChild(I3.ui.text(_selectedGroupRow.name));
      _addButton.value = "Add Group";
      _addButton.disabled = false;
    } else {
      _addButton.value = "Add Group";
      _addButton.disabled = true;
    }
  }
    
  /**
   * Private Method: _onAdd
   *
   * Called when the "Add" button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method _onAdd(e) {
    if (_selectedUserRow) {
      _existingUserAccountNames.push(_selectedUserRow.account);
      self._filterUserList();
      if (self.onUserAdd) self.onUserAdd(_selectedUserRow.account);
    }
    else if (_selectedGroupRow) {
      _existingGroupDNs.push(_selectedGroupRow.dn);
      self._filterGroupList();
      if (self.onGroupAdd) self.onGroupAdd(_selectedGroupRow.dn);
    }
  }

  /**
   * Private Method: _onClose
   *
   * Called when the "Close" button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method _onClose(e) {
    I3.ui.endPopupDialog();
  }
  
  /**
   * Private Method: _filterGroupList
   *
   * Enables only the groups that are not in the `existingGroupDNs` array.
   */
  @method _filterGroupList() {
    var rows = _groupListContainer.getElementsByTagName("TR");
    var tr;
    if (_existingGroupDNs && _existingGroupDNs.length > 0) {
      for (var i = 0; i < rows.length; i++) {
        tr = rows[i];
        if (tr.className.indexOf(CSS_CLASS_GROUP_DISABLED) != -1)
          I3.ui.removeClassFromElement(tr, CSS_CLASS_GROUP_DISABLED);
        for (var j = 0; j < _existingGroupDNs.length; j++) {
          if (tr.getElementsByTagName("TD")[0].innerHTML == _existingGroupDNs[j]) {
            I3.ui.addClassToElement(tr, CSS_CLASS_GROUP_DISABLED);
            if (tr.className.indexOf(CSS_CLASS_ROW_SEL) != -1)
              _addButton.disabled = true;
          } // end if
        } // end for
      } // end for
    } // end if
  }
  
  /**
   * Private Method: _filterUserList
   *
   * Enables only the users that are not in the `existingUserAccountNames`
   * array.
   */
  @method _filterUserList() {
    var rows = _userListContainer.getElementsByTagName("TR");
    var tr;
    if (_existingUserAccountNames && _existingUserAccountNames.length > 0) {
      for (var i = 0; i < rows.length; i++) {
        tr = rows[i];
        if (tr.className.indexOf(CSS_CLASS_USER_DISABLED) != -1)
          I3.ui.removeClassFromElement(tr, CSS_CLASS_USER_DISABLED);
        for (var j = 0; j < _existingUserAccountNames.length; j++) {
          if (tr.getElementsByTagName("TD")[0].innerHTML == _existingUserAccountNames[j]) {
            I3.ui.addClassToElement(tr, CSS_CLASS_USER_DISABLED);
            if (tr.className.indexOf(CSS_CLASS_ROW_SEL) != -1)
              _addButton.disabled = true;
          } // end if
        } // end for
      } // end for
    } // end if
  }
  
  self._initialize(container, isDialog);
}