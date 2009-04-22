/**
 * Script: admin/client-web/js/index
 *
 * Contains the primary applet for the Intranet Administration tool.
 * Separate controller classes are used to manage the privilege list and
 * the user/group lists.
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
 *   $Id: index.js 104 2008-05-14 19:04:06Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Admin
 *
 * Contains classes and data for the Intranet Administration tool.
 */
@module Admin;


// ---------------------------------------------------------------------------
// Tools/Privileges List Controller
// ---------------------------------------------------------------------------

/**
 * Class: Admin.PrivilegeListController
 *
 * Manages the lists of tools and privileges.  A `delegate` object is
 * assigned when the controller is initialized.  When a privilege is
 * selected from the list, the `privilegeWasSelected` method will be
 * called on the `delegate`, passing in the name of the tool and the
 * name of the privilege.  When a tool is selected without a privilege
 * being selected, the `privilegeWasDeselected` method will be called
 * on the `delegate`.
 */
@class PrivilegeListController {
  
  // Controller to call privilegeWasSelected method on when
  // a tool/privilege combination is chosen.
  var _delegate;
  
  // Hash of tools and associated permissions.
  var _tools;
  var _sortedToolList;
  
  // Currently selected tool.
  var _selectedToolKey;
  
  // Elements
  var _toolListContainer;
  var _privilegeListContainer;
  var _toolListTableView;
  var _privilegeListTableView;
  
  /**
   * Method: initialize
   *
   * Retrieves references to controls and sets up event handlers.
   *
   * Parameters:
   *   delegate - object implementing the
   *     `privilegeWasSelected(tool, privilege)` and
   *     `privilegeWasDeselected()` methods
   */
  @method initialize(delegate) {
    _delegate = delegate;
    _toolListContainer = I3.ui.clear("admin-toolListContainer");
    _privilegeListContainer = I3.ui.clear("admin-privilegeListContainer");
    
    // Display a loading message until the data has been retrieved.
    var span = I3.ui.createWithContent("SPAN", "Loading...");
    span.className = "adminLoadingText";
    _toolListContainer.appendChild(span);
    
    // Request the tool/privilege list from the server.
    I3.client.getObject("/admin/data/permissions", self.onListResponse);
  }
  
  /**
   * Method: onListResponse
   *
   * Called when the tool/privilege list has been retrieved from the server.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method onListResponse(response) {
    I3.ui.clear(_toolListContainer);
    if (response.isOK()) self.loadToolList(response.getObject());
  }
  
  /**
   * Method: loadToolList
   *
   * Loads the list of tools into the table and prepares the
   * privilege lists.
   *
   * Parameters:
   *   tools - the hash of tools + permissions to display
   */
  @method loadToolList(tools) {
    
    // Sort tool keys (the short names of the tools) into an array.
    _tools = tools;
    _sortedToolList = [];
    for (var toolKey in _tools) {
      if (toolKey != "i3-root") _sortedToolList.push(toolKey);
    }
    _sortedToolList = _sortedToolList.sort();
    _sortedToolList.unshift("i3-root");
    
    var model;
    model = new I3.ArrayTableModel(_sortedToolList);
    model.addColumn({ title: "Icon", 
                      retriever: self.getToolIconPath, 
                      formatter: self.formatIcon32, 
                      style: "toolListIconCell" });
    model.addColumn({ title: "Tool", 
                      retriever: self.getToolName, 
                      formatter: self.formatToolName, 
                      style: "toolListTextCell" });
    model.addColumn({ title: "Arrow", 
                      retriever: self.getArrowText, 
                      style: "toolListArrowCell" });
    
    _toolListTableView = new I3.TableView(_toolListContainer);
    _toolListTableView.setModel(model);
    _toolListTableView.setDelegate(self);
    _toolListTableView.setColumnHeadersEnabled(false);
    _toolListTableView.setRowSelectionEnabled(true);
    _toolListTableView.display();
    
    // Display a "select tool" message in the privilege box.
    var span = I3.ui.createWithContent("SPAN", "Select a tool.");
    span.className = "adminLoadingText";
    _privilegeListContainer.appendChild(span);
  }
  
  /**
   * Method: getToolIconPath
   *
   * Returns the path to the icon to use for the tool.
   *
   * Parameters:
   *   row - the row of data being displayed.
   */
  @method getToolIconPath(row) {
    var iconPath;
    if (row == "i3-root")
      iconPath = "/admin/client-web/img/i3-root.png";
    else 
      iconPath = "/" + row + "/client-web/img/applet-icon-32.png";
    return iconPath;
  }
  
  /**
   * Method: formatIcon32
   *
   * Returns the HTML to display the icon as a 32 x 32 image.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatIcon32(value, field, row) {
    return '<img src="' + value + '" width="32" height="32" />';
  }
  
  /**
   * Method: formatIcon24
   *
   * Returns the HTML to display the icon as a 24 x 24 image.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatIcon24(value, field, row) {
    return '<img src="' + value + '" width="24" height="24" />';
  }
  
  /**
   * Method: getToolName
   *
   * Returns the name of the tool being displayed.
   *
   * Parameters:
   *   row - the row of data being displayed
   */
  @method getToolName(row) {
    return row;
  }
  
  /**
   * Method: formatToolName
   *
   * Returns the HTML to display for the tool name and description.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatToolName(value, field, row) {
    return '<div class="listItemName">' + value + '</div>' + 
           '<span class="listItemDescription">' + _tools[value].description + '</span>';
  }
  
  /**
   * Method: getArrowText
   *
   * Returns the text to use for the arrow cell in a selectable table.
   *
   * Parameters:
   *   row - the row of data being displayed
   */
  @method getArrowText(row) {
    return ">";
  }
  
  /**
   * Method: loadPrivilegeList
   *
   * Loads a list of privileges into the privilege table.
   *
   * Parameters:
   *   privileges - the array of privileges associated with the selected tool
   */
  @method loadPrivilegeList(privileges) {
    
    // Clear out existing list.
    I3.ui.clear(_privilegeListContainer);
    
    var model;
    model = new I3.ArrayTableModel(privileges);
    model.addColumn({ title: "Icon", 
                      retriever: function(row) { return "/admin/client-web/img/star.png" }, 
                      formatter: self.formatIcon24, 
                      style: "privilegeListIconCell" });
    model.addColumn({ title: "Description", 
                      field: "privilege", 
                      formatter: self.formatPrivilegeDescription, 
                      style: "privilegeListTextCell" });
    
    _privilegeListTableView = new I3.TableView(_privilegeListContainer);
    _privilegeListTableView.setModel(model);
    _privilegeListTableView.setDelegate(self);
    _privilegeListTableView.setColumnHeadersEnabled(false);
    _privilegeListTableView.setRowSelectionEnabled(true);
    _privilegeListTableView.display();
  }
  
  /**
   * Method: formatPrivilegeDescription
   *
   * Returns the HTML for the privilege name and description.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatPrivilegeDescription(value, field, row) {
    var dClassName = row.declared ? "listItemDescription" : "listItemDescriptionError";
    return '<div class="listItemName">' + value + '</div>' + 
           '<div class="' + dClassName + '">' + row.description + '</div>';
  }
  
  /**
   * Method: tableViewSelectionDidChange
   *
   * Called when the selection in an <I3.TableView> changed.
   *
   * Parameters:
   *   tableView - the <I3.TableView> instance that generated this event
   */
  @method tableViewSelectionDidChange(tableView) {
    if (tableView == _toolListTableView) {
      var tool = _sortedToolList[tableView.getSelectedRow()];
      self.onToolClick(tool);
    }
    else if (tableView == _privilegeListTableView) {
      var index = tableView.getSelectedRow();
      self.onPrivilegeClick(index);
    }
    else {
      I3.ui.displayError(
        "The `tableViewSelectionDidChange` event was called by an unknown instance");
    }
  }
  
  /**
   * Method: onToolClick
   *
   * Called when an item in the Tool list is clicked.
   * 
   * The `loadPrivilegeList` method is called to display the available privileges.
   *
   * Parameters:
   *   tool - the tool that was selected
   */
  @method onToolClick(tool) {
    // Load the privilege list for the row.
    _selectedToolKey = tool;
    self.loadPrivilegeList(_tools[_selectedToolKey].permissions);
    // Notify the delegate that no privilege is selected now.
    if (_delegate.privilegeWasDeselected) _delegate.privilegeWasDeselected();
  }
  
  /**
   * Method: onPrivilegeClick
   *
   * Called when an item in the Privilege list is clicked.
   * 
   * The `privilegeWasSelected` method is called on the delegate.
   *
   * Parameters:
   *   index - the index of the privilege that was selected
   */
  @method onPrivilegeClick(index) {
    // Notify the delegate that a privilege was chosen.
    if (_delegate.privilegeWasSelected) {
      _delegate.privilegeWasSelected(
        _selectedToolKey, _tools[_selectedToolKey].permissions[index].privilege);
    }
  }

}

// ---------------------------------------------------------------------------
// Users/Groups Tab Controller
// ---------------------------------------------------------------------------

/**
 * Class: Admin.UserGroupController
 *
 * Manages the list of groups and users that have been given the
 * currently selected privilege.  
 */
@class UserGroupController {
  
  // Control references.
  var _assigneeHeader;
  var _existingContainer;
  var _addGroupUserButton;
  
  // Current tool/privilege being displayed.
  var _tool;
  var _privilege;
  
  // List of currently assigned users/groups.
  var _list;
  
  // Span displayed when an operation is in progress.
  var _actionInProgressSpan;
  
  // Directory Browser instance
  var _browser;
  
  /**
   * Method: initialize
   *
   * Retrieves references to controls and sets up event handlers.
   */
  @method initialize() {
    _browser = new I3.DirectoryBrowser("admin-directoryBrowserContainer");
    _browser.onGroupAdd = self.onGroupAdd;
    _browser.onUserAdd  = self.onUserAdd;
    
    _assigneeHeader     = I3.ui.get("admin-assigneeHeader");
    _existingContainer  = I3.ui.get("admin-assigneeExistingContainer");
    _addGroupUserButton = I3.ui.get("admin-addUserGroupButton");
    _addGroupUserButton.disabled = true;
    _addGroupUserButton.onclick = function(e) { _browser.show() };
    self.clear();
  }
  
  /**
   * Method: clear
   *
   * Resets the contents of the tables and the section header.
   * This is called by the applet when a new tool is chosen.
   */
  @method clear() {
    _tool = null;
    _privilege = null;
    _list = null;
    _assigneeHeader.innerHTML = "Select a tool and privilege from the lists above.";
    self._clearExistingList();
  }
  
  // -------------------------------------------------------------------------
  // Privileged Users/Groups Tab
  // -------------------------------------------------------------------------
  
  /**
   * Method: showForPrivilege
   *
   * Loads the list of groups/users for the given tool and privilege.
   * This is called when a selection is made.
   *
   * Parameters:
   *   tool - the short name of the tool that was selected
   *   privilege - the name of the privilege that was selected
   */
  @method showForPrivilege(tool, privilege) {
    _tool = tool;
    _privilege = privilege;

    // Update the header to provide feedback.
    _assigneeHeader.innerHTML = "People with " +
      "<strong>" + privilege + "</strong> privileges for " +
      "<strong>" + tool + "</strong>:";

    // Display a loading message until the data has been retrieved.
    I3.ui.clear(_existingContainer);
    // self._clearExistingList();
    var span = I3.ui.createWithContent("SPAN", "Loading...");
    span.className = "adminLoadingText";
    _existingContainer.appendChild(span);
    
    // Request the list of assigned privileges from the server.
    I3.client.getObject("/admin/data/permissions/" + tool + "/" + privilege,
      self.onAssigneeListResponse);
  }
  
  /**
   * Method: onAssigneeListResponse
   *
   * Called when the list of assignees for the selected privilege
   * has been retrieved.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method onAssigneeListResponse(response) {
    self._clearExistingList();
    if (response.isOK()) self.loadUserGroupList(response.getObject());
  }

  /**
   * Method: loadUserGroupList
   *
   * Loads the list of privileged users/groups into the table.
   * 
   * The `list` parameter should be an object that contains two
   * arrays: "groups" and "users".  Each object in the groups array
   * should have parameters for "name", "description", and "dn".
   * Each object in the users array should have parameters for
   * "name", "description", and "account_name".
   *
   * Parameters:
   *   list - an object containing "groups" and "users" arrays
   */
  @method loadUserGroupList(list) {
    _list = list;
    I3.ui.clear(_existingContainer);
    
    if (list.groups.length == 0 && list.users.length == 0) {
      var span = I3.ui.createWithContent("SPAN", 
        "There are no groups or users with this privilege.");
      span.className = "adminLoadingText";
      _existingContainer.appendChild(span);
    }
    else {
      self._loadUserGroupSubList("group");
      self._loadUserGroupSubList("user");
    }
    self._filterAddLists();
    _addGroupUserButton.disabled = false;
  }
  
  /**
   * Private Method: _loadUserGroupSubList
   *
   * Loads a section of the list (groups or users) into the privileged
   * user/group table.
   *
   * Parameters:
   *   type - the type ("group" or "user") of the items to load
   */
  @method _loadUserGroupSubList(type) {
    
    // Determine the array, icon, and link text to use.
    var arr = (type == "group") ? _list.groups : _list.users;
    var iconPath = "/common/client-web/img/" + type + "-16.png";
    var removeText = (type == "group") ? "Remove Group" : "Remove User";
    
    var model = new I3.ArrayTableModel(arr);
    model.addColumn({ title: "Icon", retriever: function(row) { return iconPath }, 
                      formatter: self.formatIcon16, style: "existingListIconCell" });
    model.addColumn({ title: "Name", field: "name", formatter: self.formatExistingPermissionName, 
                      style: "existingListTextCell" });
    model.addColumn({ title: "Remove", retriever: function(row) { return removeText }, 
                      formatter: self.formatRemoveLink, style: "existingListRemoveCell" });
    
    var div = I3.ui.create("DIV");
    _existingContainer.appendChild(div);
    var view = new I3.TableView(div);
    view.setModel(model);
    view.setColumnHeadersEnabled(false);
    view.display();
    
  }
  
  /**
   * Method: formatIcon16
   *
   * Returns the HTML for a 16 x 16 image for `value`.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatIcon16(value, field, row) {
    return '<img src="' + value + '" width="16" height="16" />';
  }
  
  /**
   * Method: formatExistingPermissionName
   *
   * Returns the HTML to display for an existing permission name and description.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatExistingPermissionName(value, field, row) {
    var nameSpan, descSpan;
    nameSpan = '<span class="existingListItemName">' + value + '</span>';
    descSpan = '<span class="existingListItemDescription">' + 
      (row.description.length > 0 ? ' - ' + row.description : '') + '</span>';
    
    return nameSpan + descSpan;
  }
  
  /**
   * Method: formatRemoveLink
   *
   * Returns the HTML to display a link to remove an existing permission.
   *
   * Parameters:
   *   value - the value of the cell
   *   field - the field in the row that contains `value`
   *   row - the row being rendered
   */
  @method formatRemoveLink(value, field, row) {
    var link, actionSpan;
    link = I3.ui.createActionLinkHTML(value, row, "Remove:" + row.name, self.onUserGroupRemove);
    actionSpan = '<span class="adminListInProgress" style="display:none;">Removing...</span>';
    
    return link + actionSpan;
  }

  /**
   * Method: onUserGroupRemove
   *
   * Called when the Remove link on a user/group in the privileged table
   * is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onUserGroupRemove(e) {
    e = I3.ui.getEvent(e);
    var targ = e.getTarget();
    _actionInProgressSpan = targ.nextSibling;
    I3.ui.hide(targ);
    I3.ui.show(_actionInProgressSpan);
    var uri = "/admin/data/permissions/" + _tool + "/" + _privilege;
    if (e.getInfo().dn != null) uri += "/groups/" + e.getInfo().dn;
    else uri += "/users/" + e.getInfo().account_name
    I3.client.deleteObject(uri, self.onUserGroupRemoveResponse);
  }
  
  /**
   * Method: onUserGroupRemoveResponse
   *
   * Called when the web service has finished removing the selected group
   * or user from the privileged list.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method onUserGroupRemoveResponse(response) {
    // The response will contain the new user/group list.
    I3.ui.hide(_actionInProgressSpan);
    _actionInProgressSpan = null;
    if (response.isOK()) self.loadUserGroupList(response.getObject().list);
  }
  
  /**
   * Private Method: _filterAddLists
   *
   * Filters the list in the Directory Browser to disable those users already chosen.
   */
  @method _filterAddLists() {
    if (_list == null) {
      _browser.setExistingGroupDNs([]);
      _browser.setExistingUserAccountNames([]);
    }
    else {
      var dns = [];
      var accounts = [];
      if (_list.groups && _list.groups.length > 0) {
        for (var i = 0; i < _list.groups.length; i++) {
          dns.push(_list.groups[i].dn);
        }
      }
      if (_list.users && _list.users.length > 0) {
        for (var i = 0; i < _list.users.length; i++) {
          accounts.push(_list.users[i].account_name);
        }
      }
      _browser.setExistingGroupDNs(dns);
      _browser.setExistingUserAccountNames(accounts);
    }
  }
  
  
  // -------------------------------------------------------------------------
  // Bestow Privileges Tab
  // -------------------------------------------------------------------------

  /**
   * Method: onGroupAdd
   *
   * Called when the Add link on a group in the list of all groups is clicked.
   * This calls the web service for adding the group.
   *
   * Parameters:
   *   dn - the DN of the group to add
   */
  @method onGroupAdd(dn) {
    var uri = "/admin/data/permissions/" + _tool + "/" + _privilege + "/groups/" + dn;
    I3.client.putObject(true, uri, self.onGroupAddResponse);
  }
  
  /**
   * Method: onGroupAddResponse
   *
   * Called when the web service has finished adding the selected group
   * to the privileged list.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method onGroupAddResponse(response) {
    // The response will contain the new user/group list.
    if (response.isOK()) self.loadUserGroupList(response.getObject().list);
  }
  
  /**
   * Method: onUserAdd
   *
   * Called when the Add link on a user in the list of all users is clicked.
   * This calls the web service for adding the user.
   *
   * Parameters:
   *   account_name - the account name to add
   */
  @method onUserAdd(account_name) {
    var uri = "/admin/data/permissions/" + _tool + "/" + _privilege + "/users/" + account_name;
    I3.client.putObject(true, uri, self.onUserAddResponse);
  }
  
  /**
   * Method: onUserAddResponse
   *
   * Called when the web service has finished adding the selected user
   * to the privileged list.
   *
   * Parameters:
   *   response - an `I3ObjectResponse` containing the response data
   */
  @method onUserAddResponse(response) {
    // The response will contain the new user/group list.
    if (response.isOK()) self.loadUserGroupList(response.getObject().list);
  }
  
  /**
   * Private Method: _clearExistingList
   *
   * Removes all child nodes from the existing user/group list.
   */
  @method _clearExistingList() {
    I3.ui.clear(_existingContainer);
    
    var span = I3.ui.createWithContent("DIV", "No privilege selected.");
    span.className = "adminLoadingText";
    _existingContainer.appendChild(span);
  }
  
}


// ---------------------------------------------------------------------------

/**
 * Class: Admin.AdminApplet
 *
 * Main applet class for the Intranet Admin tool.  Separate controller
 * classes are used for the tool/privilege list and the user/group
 * tab set.  The applet manages the communication between the
 * controller objects.
 */
@class AdminApplet {

  // Applet-specific controller objects.
  var _privilegeController;
  var _userGroupController;

  /**
   * Method: initialize
   *
   * Initializes the applet.
   */
  @method initialize() {

    // Create the controller objects for the UI elements that
    // will be managed by the applet.
    _privilegeController = new Admin.PrivilegeListController();
    _userGroupController = new Admin.UserGroupController();
  }

  /**
   * Method: loadPath
   *
   * Loads the data for the given path.
   *
   * Parameters:
   *   path - the path string to load
   */
  @method loadPath(path) {

    // Set up the navigation bar.
    I3.navbar.addToPath("Intranet Admin");

    // Start loading the privilege list.
    _privilegeController.initialize(self);

    // Display the first tab.
    _userGroupController.initialize();
  }
  
  /**
   * Method: privilegeWasSelected
   *
   * Called when the user has selected a tool/privilege combination.
   * Forwards the information to the tab controllers.
   *
   * Parameters:
   *   tool - the short name of the tool that was chosen
   *   privilege - the short name of the privilege that was chosen
   */
  @method privilegeWasSelected(tool, privilege) {
    _userGroupController.showForPrivilege(tool, privilege);
  }

  /**
   * Method: privilegeWasDeselected
   *
   * Called when no privilege has been chosen (such as when the user has
   * selected a different tool without choosing a different privilege).
   * Forwards the information to the tab controllers.
   */
  @method privilegeWasDeselected() {
    _userGroupController.clear();
  }

}
