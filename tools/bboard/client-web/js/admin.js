/**
 * Script: bboard/js/admin
 *
 * Provides a user interface for adding/removing bulletin board topics
 * and setting permissions.
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
 *   $Id: admin.js 75 2008-04-02 19:33:48Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: BulletinBoard
 *
 * The module containing all Bulletin Board classes and data.
 */
@module BulletinBoard;


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.AdminApplet
 *
 * Place a brief description of how the applet works here.
 */
@class AdminApplet {

  var TOPIC_SERVICE = "/bboard/data/topic-list/";
  var PERMISSION_SERVICE = "/bboard/data/permissions/";

  var _topics;
  var _topicMenu;
  var _topicButtonLabel;
  var _deletedTopics;
  
  var _selectedTopic;
  var _topicNameField;
  var _topicDescriptionField;

  var _addDialog;
  var _permissionView;
  var _groupBrowser;

  /**
   * Method: initialize
   *
   * Initializes the Admin applet.
   */
  @method initialize() {

    // Obtain control references.
    _topicButtonLabel = I3.ui.get("bboard-adminTopicButtonLabel");
    _topicNameField = I3.ui.get("bboard-adminTopicName");
    _topicDescriptionField = I3.ui.get("bboard-adminTopicDescription");
        
    // Set up the dialog for adding/restoring topics.
    _addDialog = new BulletinBoard.AddTopicDialog();
    _addDialog.onTopicAdd = self.onTopicAdd;
    _addDialog.onTopicRestore = self.onTopicRestore;
        
    // Set up the permission view.
    _permissionView =
      new BulletinBoard.PermissionView("bboard-adminPrivilegeTable");
    _permissionView.onPublicPermissionChange = self.onPublicPermissionChange;
    _permissionView.onGroupPermissionChange = self.onGroupPermissionChange;
    _permissionView.onUserPermissionChange = self.onUserPermissionChange;
    _permissionView.onGroupRemove = self.onGroupRemove;
    _permissionView.onUserRemove = self.onUserRemove;
        
    // Set up the group/user list controller.
    _groupBrowser = new I3.DirectoryBrowser("bboard-adminUserPopup");
    _groupBrowser.setWebServicePath("/bboard/data/groups");
    _groupBrowser.onGroupAdd = self.onGroupAdd;
    _groupBrowser.onUserAdd = self.onUserAdd;
        
    // Hook up event handlers for the Add Topic button.
    var addButton = I3.ui.get("bboard-adminAddTopicButton");
    var removeButton = I3.ui.get("bboard-adminRemoveTopicButton");
    addButton.onclick = self.onTopicAddButtonClick;
    addButton.onmouseover = function() {
      I3.ui.clear(_topicButtonLabel);
      _topicButtonLabel.appendChild(I3.ui.text("Add/Restore Topic..."));
    }
    addButton.onmouseout = function() { I3.ui.clear(_topicButtonLabel); }

    // Hook up event handlers for the Remove Topic button.
    removeButton.onclick = self.onTopicRemove;
    removeButton.onmouseover = function() {
      I3.ui.clear(_topicButtonLabel);
      _topicButtonLabel.appendChild(I3.ui.text("Remove Selected Topic..."));
    }
    removeButton.onmouseout = function() { I3.ui.clear(_topicButtonLabel); }
    
    // Hook up event handlers for topic editing.
    I3.ui.get("bboard-adminSaveButton").onclick = self.onTopicSave;
    I3.ui.get("bboard-adminRevertButton").onclick = self.onTopicRevert;
    I3.ui.get("bboard-adminAddButton").onclick = self.onAddButtonClick;
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

    // Add this tool's entry to the navigation bar.
    I3.navbar.addToPath("Bulletin Board", { link: "/bboard/" });
    I3.navbar.addToPath("Administration");

    // Load the data from the permission service.
    // In addition to the permissions themselves, the web service
    // sends the topic names and descriptions, which are then used
    // to construct the menu on the side.
    I3.client.getObject(PERMISSION_SERVICE, self.onPermissionResponse);
  }
  
  /**
   * Method: onPermissionResponse
   * 
   * Called when the list of topics and their associated permissions
   * has been loaded from the web service.
   * 
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onPermissionResponse(response) {
    I3.ui.hide("bboard-adminTopicsLoading");
    if (response.isOK()) {

      // Sort the topic keys.
      _topics = response.getObject();
      keys = [];
      for (var key in _topics) { keys.push(key); }
      keys.sort();

      // Set up the menu controller.
      _topicMenu = new I3.MenuController(I3.ui.get("bboard-adminTopicList"));
      _topicMenu.setTitle("Edit Topics");
      _topicMenu.setStyles({
        titleBackground: "bboard-adminMenuTitle",
        selectedItem: "bboard-adminMenuSelection"
      });

      // Add the "(About)" item.
      _topicMenu.addItem("(About)", {
          key: "__ABOUT__",
          sectionID: "bboard-adminIntroSection",
          delegate: self });

      // Add each topic.
      _deletedTopics = [];
      var topic, i, j;
      for (i = 0; i < keys.length; i++) {
        _topics[keys[i]].permalink = keys[i];
        if (_topics[keys[i]].is_deleted == false) {
          _topicMenu.addItem(_topics[keys[i]].name, {
              key: keys[i],
              sectionID: "bboard-adminTopicInfoSection",
              delegate: self });
        } else {
          _deletedTopics.push(_topics[keys[i]]);
        }
      }
      
      // Display the add/remove buttons below the topic list.
      // These are hidden by default so that they can't be
      // clicked while the topic list is still loading.
      I3.ui.show("bboard-adminTopicButtons");
      
      // Select the "(About)" item by default.
      _topicMenu.selectItem(0);
    }
  }

  /**
   * Method: resetTopicList
   *
   * Clears the topic list and displays the "Loading" message.
   */
  @method resetTopicList() {
    _topicMenu.selectItem(0);
    var listDiv = I3.ui.get("bboard-adminTopicList");
    while (listDiv.lastChild.id != "bboard-adminTopicsLoading") {
      listDiv.removeChild(listDiv.lastChild);
    }
    I3.ui.show("bboard-adminTopicsLoading");
  }

  /**
   * Method: sectionDidBecomeVisible
   * 
   * Called when an item is clicked in the topic list and its
   * editing section becomes visible.  This is a delegate method
   * for <I3.MenuController>.
   * 
   * Parameters:
   *   key - the key of the item that was clicked, as defined when
   *     the item was added to the menu
   */
  @method sectionDidBecomeVisible(key) {
    if (key == "__ABOUT__") {
      I3.ui.get("bboard-adminRemoveTopicButton").style.visibility = "hidden";
      return;
    }
    _selectedTopic = _topics[key];
    self.displaySelectedTopic();
    I3.ui.get("bboard-adminRemoveTopicButton").style.visibility = "visible";
  }
  
  /**
   * Method: displaySelectedTopic
   *
   * Fills in the fields for the currently selected topic object.
   * 
   * This is called both when a new topic is selected and when a
   * topic's data has been modified/reloaded.
   */
  @method displaySelectedTopic() {
    
    // Fill in the name and description fields.
    if (_selectedTopic.name)
      _topicNameField.value = _selectedTopic.name;
    else _topicNameField.value = "";
    if (_selectedTopic.description)
      _topicDescriptionField.value = _selectedTopic.description;
    else _topicDescriptionField.value = "";

    // Display the permission view.
    _permissionView.displayForTopic(_selectedTopic);
  }
  
  /**
   * Method: setIsWorking
   *
   * Displays a working indicator and disables the UI.
   * This is used when data is being saved back to the server.
   * 
   * Parameters:
   *   value - set to `true` if the applet is working,
   *     `false` to re-enable the UI
   */
  @method setIsWorking(value) {
    _topicNameField.disabled = value;
    _topicDescriptionField.disabled = value;
    I3.ui.get("bboard-adminSaveButton").disabled = value;
    I3.ui.get("bboard-adminRevertButton").disabled = value;
    I3.ui.get("bboard-adminAddButton").disabled = value;
    if (value) I3.ui.get("bboard-adminSaving").style.visibility = "visible";
    else I3.ui.get("bboard-adminSaving").style.visibility = "hidden";
  }
  
  /**
   * Method: onTopicAddButtonClick
   *
   * Called when the Add Topic button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method onTopicAddButtonClick(e) {
    _addDialog.setRestorableTopics(_deletedTopics);
    _addDialog.show();
  }
  
  /**
   * Method: onTopicAdd
   *
   * Called when a new topic has been created using
   * the Add/Restore Topic dialog.
   *
   * Parameters:
   *   name - the name of the new topic
   *   description - the description for the new topic
   */
  @method onTopicAdd(name, description) {
    self.resetTopicList();
    var topicInfo = {
      "name": name,
      "description": description
    };
    I3.client.postObject(topicInfo, TOPIC_SERVICE,
      function(response) {
        I3.client.getObject(PERMISSION_SERVICE, self.onPermissionResponse);
      });
  }
  
  /**
   * Method: onTopicRestore
   *
   * Called when a previously deleted topic has been selected
   * from the Add/Restore Topic dialog.
   * 
   * Parameters:
   *   permalink - the permalink of the topic to be restored
   */
  @method onTopicRestore(permalink) {
    self.resetTopicList();
    var topicInfo = { "is_deleted": false };
    I3.client.putObject(topicInfo, TOPIC_SERVICE + permalink,
      function(response) {
        I3.client.getObject(PERMISSION_SERVICE, self.onPermissionResponse);
      });
  }
  
  /**
   * Method: onTopicRemove
   *
   * Called when the Remove Selected Topic button is clicked.
   * This displays a pop-up dialog confirming the request.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method onTopicRemove(e) {
    var element = I3.ui.get("bboard-adminConfirmationPopup");
    var topicName = I3.ui.get("bboard-adminConfirmationTopicName");
    I3.ui.clear(topicName);
    topicName.appendChild(I3.ui.text(_selectedTopic.name));
    I3.ui.popupDialogWithElement(element, {
      title: "Delete Topic",
      width: 500,
      acceptButton: { label: "Delete", onclick: self.onConfirmTopicRemove },
      cancelButton: true
    });
  }
  
  /**
   * Method: onConfirmTopicRemove
   *
   * Called when the user has confirmed the removal of the selected topic.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method onConfirmTopicRemove(e) {
    I3.ui.endPopupDialog();
    self.resetTopicList();
    I3.client.deleteObject(
      "/bboard/data/topic-list/" + _selectedTopic.permalink,
      function(response) {
        I3.client.getObject(PERMISSION_SERVICE, self.onPermissionResponse);
      });
  }
  
  /**
   * Method: onTopicSave
   *
   * Called when the Save button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method onTopicSave(e) {
    self.setIsWorking(true);
    var topicInfo = {
      name: _topicNameField.value,
      description: _topicDescriptionField.value
    };
    I3.client.putObject(topicInfo,
      TOPIC_SERVICE + _selectedTopic.permalink,
      self.onTopicModified);
  }

  /**
   * Method: onTopicRevert
   *
   * Called when the Revert button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method onTopicRevert(e) {
    self.setIsWorking(true);
    self.displaySelectedTopic();
  }
  
  /**
   * Method: onAddButtonClick
   *
   * Called when the "Add Group/User" button is clicked.
   * This displays the Group Browser for choosing a group or user.
   * 
   * Parameters:
   *   e - the click event arguments
   */
  @method onAddButtonClick(e) {
    var i;
    var existingGroups = [];
    for (i = 0; i < _selectedTopic.groups.length; i++) {
      existingGroups.push(_selectedTopic.groups[i].dn);
    }
    var existingUsers = [];
    for (i = 0; i < _selectedTopic.users.length; i++) {
      existingUsers.push(_selectedTopic.users[i].account_name);
    }
    _groupBrowser.setExistingGroupDNs(existingGroups);
    _groupBrowser.setExistingUserAccountNames(existingUsers);
    _groupBrowser.show();
  }
  
  /**
   * Method: onGroupAdd
   *
   * Called when a group has been added to the permission list
   * from the Group Browser.
   *
   * Parameters:
   *   groupDN - the distinguished name of the group that was selected
   */
  @method onGroupAdd(groupDN) {
    self.setIsWorking(true);
    var defaultPerms = {
      can_view: true,
      can_post: true,
      can_comment: true,
      can_moderate: false
    };
    I3.client.putObject(defaultPerms,
      PERMISSION_SERVICE + _selectedTopic.permalink + "/groups/" + groupDN,
      self.onTopicModified);
  }

  /**
   * Method: onUserAdd
   *
   * Called when a user has been added to the permission list
   * from the Group Browser.
   *
   * Parameters:
   *   accountName - the account name of the user that was selected
   */
  @method onUserAdd(accountName) {
    self.setIsWorking(true);
    var defaultPerms = {
      can_view: true,
      can_post: true,
      can_comment: true,
      can_moderate: false
    };
    I3.client.putObject(defaultPerms,
      PERMISSION_SERVICE + _selectedTopic.permalink + "/users/" + accountName,
      self.onTopicModified);
  }

  /**
   * Method: onPublicPermissionChange
   *
   * Called when a permission checkbox has been modified for
   * the "Everyone" entry in the permission view.
   *
   * Parameters:
   *   permission - the permission that was changed
   *     ("view", "post", or "comment")
   *   value - the new value of the permission (`true` or `false`)
   */
  @method onPublicPermissionChange(permission, value) {
    self.setIsWorking(true);
    var uri = PERMISSION_SERVICE + _selectedTopic.permalink +
      "/public/can-" + permission;
    if (value == true) I3.client.putObject(true, uri, self.onTopicModified);
    else I3.client.deleteObject(uri, self.onTopicModified);
  }
  
  /**
   * Method: onGroupPermissionChange
   *
   * Called when a permission checkbox has been modified for
   * a group entry in the permission view.
   *
   * Parameters:
   *   groupDN - the distinguished name of the group for which
   *     the permission was changed
   *   permission - the permission that was changed
   *     ("view", "post", "comment", or "moderate")
   *   value - the new value of the permission (`true` or `false`)
   */
  @method onGroupPermissionChange(groupDN, permission, value) {
    self.setIsWorking(true);
    var uri = PERMISSION_SERVICE + _selectedTopic.permalink +
      "/groups/" + groupDN + "/can-" + permission;
    if (value == true) I3.client.putObject(true, uri, self.onTopicModified);
    else I3.client.deleteObject(uri, self.onTopicModified);
  }
  
  /**
   * Method: onUserPermissionChange
   *
   * Called when a permission checkbox has been modified for
   * a user entry in the permission view.
   *
   * Parameters:
   *   accountName - the account name of the user for whom
   *     the permission was changed
   *   permission - the permission that was changed
   *     ("view", "post", "comment", or "moderate")
   *   value - the new value of the permission (`true` or `false`)
   */
  @method onUserPermissionChange(accountName, permission, value) {
    self.setIsWorking(true);
    var uri = PERMISSION_SERVICE + _selectedTopic.permalink +
      "/users/" + accountName + "/can-" + permission;
    if (value == true) I3.client.putObject(true, uri, self.onTopicModified);
    else I3.client.deleteObject(uri, self.onTopicModified);
  }
  
  /**
   * Method: onGroupRemove
   *
   * Called when a group is removed from the permission view.
   *
   * Parameters:
   *   groupDN - the distinguished name of the group that was removed
   */
  @method onGroupRemove(groupDN) {
    self.setIsWorking(true);
    I3.client.deleteObject(PERMISSION_SERVICE + _selectedTopic.permalink +
      "/groups/" + groupDN,
      self.onTopicModified);
  }
  
  /**
   * Method: onUserRemove
   *
   * Called when a user is removed from the permission view.
   *
   * Parameters:
   *   accountName - the account name of the user that was removed
   */
  @method onUserRemove(accountName) {
    self.setIsWorking(true);
    I3.client.deleteObject(PERMISSION_SERVICE + _selectedTopic.permalink +
      "/users/" + accountName,
      self.onTopicModified);
  }
   
  /**
   * Method: onTopicModified
   *
   * Called whenever the topic has been modified to refresh the data
   * from the server.
   * 
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onTopicModified(response) {
    I3.client.getObject(PERMISSION_SERVICE + _selectedTopic.permalink,
      function(response) {
        if (response.isOK()) {
          var updatedTopic = response.getObject();
          for (var key in updatedTopic) {
            _selectedTopic[key] = updatedTopic[key];
          }
        }
        // If an error occurred, the selected topic will be
        // re-displayed unmodified.
        self.displaySelectedTopic();
        self.setIsWorking(false);
      });
  }
  
} // end BulletinBoard.AdminApplet


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.AddTopicDialog
 *
 * Displays a pop-up dialog for adding a new Bulletin Board topic
 * or restoring a previously deleted topic.
 * 
 * Users of this class assign event handlers for when a topic is
 * added from the dialog.
 * 
 * Example:
 * (start example)
 * 
 *   @method showAddDialog() {
 *     var dialog = new BulletinBoard.AddTopicDialog();
 *     dialog.onTopicAdd = self.onTopicAdd;
 *     dialog.onTopicRestore = self.onTopicRestore;
 *     dialog.show();
 *   }
 * 
 *   @method onTopicAdd(name, description) {
 *     alert("Adding new topic: " + name);
 *   }
 * 
 *   @method onTopicRestore(permalink) {
 *     alert("Restoring deleted topic: " + permalink);
 *   }
 * 
 * (end example)
 */
@class AddTopicDialog {
  
  // Control references.
  var _dialogElement;
  var _restoreListSelect;
  var _nameField;
  var _descriptionField;
  var _addButton;
  var _cancelButton;
  
  // Set to `true` once the dialog has been shown.
  var _hasBeenShown = false;
  
  /**
   * Method: getRestorableTopics
   * Returns the list of topics that can be restored.
   *
   * Method: setRestorableTopics
   * Sets the list of topics that can be restored.
   * Each topic object must have `name`, `description`,
   * and `permalink` fields.
   */
  @property restorableTopics = [];
  
  /**
   * Method: initialize
   *
   * Initializes the dialog.
   * 
   * This is called automatically when a dialog object is created.
   */
  @method initialize() {
    
    // Retrieve control references.
    _dialogElement = I3.ui.get("bboard-adminAddTopicPopup");
    _restoreListSelect = I3.ui.get("bboard-adminRestoreList");
    _nameField = I3.ui.get("bboard-adminNewTopicName");
    _descriptionField = I3.ui.get("bboard-adminNewTopicDescription");

    // Set up event handlers for editing controls.
    _restoreListSelect.onchange = self._onRestoreListChange;
    _nameField.onkeyup = self._onFieldChange;

    // Set up buttons.
    var buttonDiv = I3.ui.get("bboard-adminNewTopicButtons");
    _addButton = I3.ui.create("input");
    _addButton.type = "button";
    _addButton.value = "Restore";
    _addButton.onclick = self._onAdd;
    _addButton.disabled = true;
    _cancelButton = I3.ui.create("input");
    _cancelButton.type = "button";
    _cancelButton.value = "Cancel";
    _cancelButton.onclick = self._onCancel;
    if (I3.browser.isMac()) {
      buttonDiv.appendChild(_cancelButton);
      buttonDiv.appendChild(_addButton);
    }
    else {
      buttonDiv.appendChild(_addButton);
      buttonDiv.appendChild(_cancelButton);
    }
  }
  
  /**
   * Method: show
   *
   * Displays the dialog.
   */
  @method show() {
    
    // Set up UI for restorable topics.
    var title;
    if (_restorableTopics && _restorableTopics.length > 0) {
      // Topics are available.
      self._buildRestoreList();
      I3.ui.show("bboard-adminRestoreRow", "");
      title = "Add/Restore Topic";
    } else {
      // No topics can be restored.
      I3.ui.hide("bboard-adminRestoreRow");
      title = "Add Topic";
    }

    // Set interface defaults.
    _nameField.disabled = false;
    _nameField.value = "";
    _descriptionField.disabled = false;
    _descriptionField.value = "";
    _addButton.disabled = true;
    if (_hasBeenShown) _addButton.value = "Add";
    
    // Display the dialog.
    I3.ui.popupDialogWithElement(_dialogElement, { title: title });
    
    // Fix the width of the "Restore" button to its current width,
    // then change the label to the default "Add".  This prevents the
    // button from resizing when its label changes.  We have to do this
    // here instead of in the initialize method because the button has
    // to be visible for offsetWidth to have a usable value.
    if (!_hasBeenShown) {
      _addButton.style.width = _addButton.offsetWidth + "px";
      _addButton.value = "Add";
      _hasBeenShown = true;
    }
    
    _nameField.focus();
  }

  /**
   * Private Method: _buildRestoreList
   *
   * Builds the drop-down list of restorable topics.
   */
  @method _buildRestoreList() {

    // Create an option for "None" and add it to the drop-down.
    var opt;
    opt = I3.ui.create("option");
    opt.value = "__none";
    opt.appendChild(I3.ui.text("(None)"));
    I3.ui.clear(_restoreListSelect);
    _restoreListSelect.appendChild(opt);
    
    // Add each topic name to the drop down.
    var topics = self.getRestorableTopics();
    for (var i = 0; i < topics.length; i++) {
      opt = I3.ui.create("option");
      opt.value = topics[i].permalink;
      opt.appendChild(I3.ui.text(topics[i].name));
      _restoreListSelect.appendChild(opt);
    }
    
    // Select "(None)" by default.
    _restoreListSelect.selectedIndex = 0;
  }

  /**
   * Private Method: _onRestoreListChange
   *
   * Called when an item is selected from the list of restorable topics.
   *
   * Parameters:
   *   e - the change event arguments
   */
  @method _onRestoreListChange(e) {
    var topic;
    if (_restoreListSelect.selectedIndex > 0) {
      topic = self.getRestorableTopics()[_restoreListSelect.selectedIndex - 1];
    }
    _nameField.value = (topic != null) ? topic.name : "";
    _nameField.disabled = (topic != null);
    _descriptionField.value = (topic != null) ? topic.description : "";
    _descriptionField.disabled = (topic != null);
    _addButton.value = (topic != null) ? "Restore" : "Add";
    _addButton.disabled = (topic == null);
  }
  
  /**
   * Private Method: _onFieldChange
   *
   * Called when a text box is modified.
   *
   * Parameters:
   *   e - the change event arguments
   */
  @method _onFieldChange(e) {
    _addButton.disabled = (I3.util.trim(_nameField.value).length == 0);
  }

  /**
   * Private Method: _onAdd
   *
   * Called when the Add button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method _onAdd(e) {
    I3.ui.endPopupDialog();
    var index = 0;
    if (self.getRestorableTopics().length > 0)
      index = _restoreListSelect.selectedIndex;
    if (index > 0) {
      if (self.onTopicRestore)
        self.onTopicRestore(self.getRestorableTopics()[index - 1].permalink);
    } else {
      if (self.onTopicAdd)
        self.onTopicAdd(_nameField.value, _descriptionField.value);
    }
  }

  /**
   * Private Method: _onCancel
   *
   * Called when the Cancel button is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method _onCancel(e) {
    I3.ui.endPopupDialog();
  }
  
  self.initialize();
} // end BulletinBoard.AddTopicDialog


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.PermissionView
 *
 * Displays a table of groups and users that have been explicitly granted
 * permissions for a bulletin board topic.
 * 
 * Users of this class assign event handlers for when permissions are
 * modified or entries are removed from the table.  When an event handler
 * is called, the table is disabled as it waits for new data.  Once the
 * change has been saved, <displayForTopic> should be called again with
 * the new topic data.
 * 
 * Example:
 * (start example)
 * 
 *   @method displayPermissionViewForTopic(topic) {
 *     var permissionView =
 *       new BulletinBoard.PermissionView("bboard-adminPrivilegeTable");
 *     permissionView.onPublicPermissionChange = self.onPublicPermissionChange;
 *     permissionView.onGroupPermissionChange = self.onGroupPermissionChange;
 *     permissionView.onUserPermissionChange = self.onUserPermissionChange;
 *     permissionView.onGroupRemove = self.onGroupRemove;
 *     permissionView.onUserRemove = self.onUserRemove;
 *     permissionView.displayForTopic(_topic);
 *   }
 * 
 *   @method onPublicPermissionChange(permission, value) {
 *     alert("The " + permission + " setting for everyone has changed to " +
 *           value.toString());
 *   }
 * 
 *   @method onGroupPermissionChange(groupDN, permission, value) {
 *     alert("The " + permission + " setting for group " + groupDN +
 *           " has changed to " + value.toString());
 *   }
 * 
 *   @method onGroupRemove(groupDN) {
 *     alert("The " + groupDN + " group has been removed.");
 *   }
 * 
 *   @method onUserPermissionChange(accountName, permission, value) {
 *     alert("The " + permission + " setting for user " + accountName +
 *           " has changed to " + value.toString());
 *   }
 * 
 *   @method onUserRemove(accountName) {
 *     alert("The " + accountName + " account has been removed.");
 *   }
 * 
 * (end example)
 * 
 * Parameters:
 *   container - the HTML DOM element into which the table will be rendered
 */
@class PermissionView(container) {

  // Column headers for table rendering.
  var HEADER_LABELS = [
    "", "Name", "Can View", "Can Post", "Can Comment", "Can Moderate", ""
  ];

  // Images to use for table rendering.
  var IMG_PUBLIC = "/bboard/client-web/img/world-16.png";
  var IMG_GROUP  = "/common/client-web/img/group-16.png";
  var IMG_USER   = "/common/client-web/img/user-16.png";

  // CSS styles (class names) to use for table rendering.
  var CSS_CLASS_CONTAINER    = "i3tableContainer";
  var CSS_CLASS_ROW          = "i3tableRow";
  var CSS_CLASS_ROW_ALT      = "i3tableRowAlt";
  var CSS_CLASS_ROW_HEADER   = "i3tableHead";
  var CSS_CLASS_COL_ICON     = "bboard-permissionIconColumn";
  var CSS_CLASS_COL_NAME     = "bboard-permissionNameColumn";
  var CSS_CLASS_COL_CHECKBOX = "bboard-permissionCheckboxColumn";
  var CSS_CLASS_COL_REMOVE   = "bboard-permissionRemoveColumn";
  var CSS_CLASS_SPAN_PUBLIC  = "bboard-permissionCellPublic";

  // Instance variables.
  var _container = container;    // Containing DOM element
   
  /**
   * Method: displayForTopic
   *
   * Renders the permissions for the given `topic` into the table.
   *
   * Parameters:
   *   topic - the topic object to display
   */
  @method displayForTopic(topic) {
    if (typeof _container == "string") _container = I3.ui.get(_container);
    I3.ui.clear(_container);
    _container.className = CSS_CLASS_CONTAINER;
    
    // Create the table.
    var rowIndex = 0;
    var table, tbody, tr, th, perm, i;
    table = I3.ui.create("table");
    tbody = I3.ui.create("tbody");
    
    // Add row for everyone.
    perm = topic.public;
    tr = I3.ui.create("tr");
    tr.assigneeType = "public";
    tr.className = (rowIndex % 2 == 0) ? CSS_CLASS_ROW : CSS_CLASS_ROW_ALT;
    tr.appendChild(self._createIconCell(IMG_PUBLIC));
    tr.appendChild(self._createNameCell(
      '<span class="' + CSS_CLASS_SPAN_PUBLIC + '">(Everyone)</span>'));
    tr.appendChild(self._createCheckboxCell("View", perm.can_view));
    tr.appendChild(self._createCheckboxCell("Post", perm.can_post));
    tr.appendChild(self._createCheckboxCell("Comment", perm.can_comment));
    tr.appendChild(self._createCheckboxCell("Moderate", null, true));
    tr.appendChild(self._createRemoveCell(null, true));
    tbody.appendChild(tr);
    rowIndex += 1;
 
    // Add group rows.
    for (i = 0; i < topic.groups.length; i++) {
      perm = topic.groups[i];
      tr = I3.ui.create("tr");
      tr.assigneeType = "group";
      tr.assigneeID = perm.dn;
      tr.className = (rowIndex % 2 == 0) ? CSS_CLASS_ROW : CSS_CLASS_ROW_ALT;
      tr.appendChild(self._createIconCell(IMG_GROUP));
      tr.appendChild(self._createNameCell(perm.name));
      tr.appendChild(self._createCheckboxCell("View", perm.can_view));
      tr.appendChild(self._createCheckboxCell("Post", perm.can_post));
      tr.appendChild(self._createCheckboxCell("Comment", perm.can_comment));
      tr.appendChild(self._createCheckboxCell("Moderate", perm.can_moderate));
      tr.appendChild(self._createRemoveCell(perm.name));
      tbody.appendChild(tr);
      rowIndex += 1;
    }
 
    // Add user rows.
    for (i = 0; i < topic.users.length; i++) {
      perm = topic.users[i];
      tr = I3.ui.create("tr");
      tr.assigneeType = "user";
      tr.assigneeID = perm.account_name;
      tr.className = (rowIndex % 2 == 0) ? CSS_CLASS_ROW : CSS_CLASS_ROW_ALT;
      tr.appendChild(self._createIconCell(IMG_USER));
      tr.appendChild(self._createNameCell(perm.name));
      tr.appendChild(self._createCheckboxCell("View", perm.can_view));
      tr.appendChild(self._createCheckboxCell("Post", perm.can_post));
      tr.appendChild(self._createCheckboxCell("Comment", perm.can_comment));
      tr.appendChild(self._createCheckboxCell("Moderate", perm.can_moderate));
      tr.appendChild(self._createRemoveCell(perm.name));
      tbody.appendChild(tr);
      rowIndex += 1;
    }
   
    // Display the table.
    table.appendChild(tbody);
    _container.appendChild(table);
  }

  // ------------------------------------------------------------------------
  // Cell creation methods
  // ------------------------------------------------------------------------

  /**
   * Private Method: _createHeader
   *
   * Creates a table cell with a column header in it.
   *
   * Parameters:
   *   contents - the string to display in the column header
   * 
   * Returns:
   *   A DOM element for a table header cell.
   */
  @method _createHeader(contents) {
    if (contents == null || contents.length == 0) contents = "&nbsp;";
    var th = I3.ui.create("th");
    th.innerHTML = contents;
    return th;
  }

  /**
   * Private Method: _createIconCell
   *
   * Creates a table cell containing an icon with the given path.
   *
   * Parameters:
   *   iconPath - the path of the icon to display
   * 
   * Returns:
   *   A DOM element for a table data cell.
   */
  @method _createIconCell(iconPath) {
    var icon = I3.ui.create("img");
    icon.src = iconPath;
    var td = I3.ui.create("td");
    td.className = CSS_CLASS_COL_ICON;
    td.appendChild(icon);
    return td;
  }

  /**
   * Private Method: _createNameCell
   *
   * Creates a table cell containing an HTML string.
   *
   * Parameters:
   *   contentHTML - the HTML to display in the cell
   * 
   * Returns:
   *   A DOM element for a table data cell.
   */
  @method _createNameCell(contentHTML) {
    var td = I3.ui.create("td");
    td.className = CSS_CLASS_COL_NAME;
    td.innerHTML = contentHTML;
    return td;
  }

  /**
   * Private Method: _createCheckboxCell
   *
   * Creates a table cell containing a checkbox element with the given value.
   *
   * Parameters:
   *   label - the label string to display next to the checkbox
   *   initialValue - optional; `true` if the checkbox should be
   *     checked by default, `false` otherwise
   *   isHidden - optional; sets the contents to be invisible (useful for
   *     cells that have no content but should affect the table layout)
   * 
   * Returns:
   *   A DOM element for a table data cell.
   */
  @method _createCheckboxCell(label, initialValue, isHidden) {
    if (initialValue == null) initialValue = false;
    if (isHidden == null) isHidden = false;
    var checkbox = I3.ui.createCheckbox(initialValue);
    var textSpan = I3.ui.create("span");
    textSpan.appendChild(I3.ui.text(" " + label));
    if (isHidden) {
      checkbox.style.visibility = "hidden";
      textSpan.style.visibility = "hidden";
    } else {
      checkbox.onclick = self._onCheckboxClicked;
    }
    var td = I3.ui.create("td");
    td.className = CSS_CLASS_COL_CHECKBOX;
    td.appendChild(checkbox);
    td.appendChild(textSpan);
    return td;
  }

  /**
   * Private Method: _createRemoveCell
   *
   * Creates a table cell with a Remove link.
   * 
   * Parameters:
   *   name - the name of the item that will be removed, for use
   *     in the action link display URL
   *   isHidden - optional; sets the contents to be invisible (useful for
   *     cells that have no content but should affect the table layout)
   * 
   * Returns:
   *   A DOM element for a table data cell.
   */
  @method _createRemoveCell(name, isHidden) {
    if (isHidden == null) isHidden = false;
    var textSpan = I3.ui.create("span");
    textSpan.appendChild(I3.ui.text("["));
    textSpan.appendChild(I3.ui.createActionLink(
      "Remove", null, "Remove:" + name, self._onRemove));
    textSpan.appendChild(I3.ui.text("]"));
    if (isHidden) textSpan.style.visibility = "hidden";
    var td = I3.ui.create("td");
    td.className = CSS_CLASS_COL_REMOVE;
    td.appendChild(textSpan);
    return td;
  }

  /**
   * Private Method: _createEmptyCell
   *
   * Creates a table cell containing only a non-breaking space.
   * 
   * Parameters:
   *   className - optional; a CSS class to assign to the cell
   * 
   * Returns:
   *   A DOM element for a table data cell.
   */
  @method _createEmptyCell(className) {
    var td = I3.ui.create("td");
    if (className != null) td.className = className;
    td.innerHTML = "&nbsp";
    return td;
  }

  // ------------------------------------------------------------------------
  // Event handlers
  // ------------------------------------------------------------------------

  /**
   * Private Method: _onCheckboxClicked
   *
   * Called when a checkbox in the table is clicked.
   *
   * Parameters:
   *   e - the click event arguments
   */
  @method _onCheckboxClicked(e) {
    var targ = I3.ui.getEvent(e).getTarget();
    var cell = targ.parentNode;
    var row = cell.parentNode;

    var permName;
    switch (cell.cellIndex) {
      case 2: permName = "view"; break;
      case 3: permName = "post"; break;
      case 4: permName = "comment"; break;
      case 5: permName = "moderate"; break;
    }
    var permValue = targ.checked;

    switch (row.assigneeType) {
      case "public":
        if (self.onPublicPermissionChange) {
          self._disableInput(I3.ui.getParentWithTagName("table", row));
          self.onPublicPermissionChange(permName, permValue);
        }
        break;
      case "group":
        if (self.onGroupPermissionChange) {
          self._disableInput(I3.ui.getParentWithTagName("table", row));
          self.onGroupPermissionChange(row.assigneeID, permName, permValue);
        }
        break;
      case "user":
        if (self.onUserPermissionChange) {
          self._disableInput(I3.ui.getParentWithTagName("table", row));
          self.onUserPermissionChange(row.assigneeID, permName, permValue);
        }
        break;
    }
  }

  /**
   * Private Method: _onRemove
   *
   * Called when the remove link is clicked for a row.
   * 
   * Parameters:
   *   e - the click event arguments
   */
  @method _onRemove(e) {
    e = I3.ui.getEvent(e);
    var row = I3.ui.getParentWithTagName("tr", e.getTarget());
    if (row != null) {
      switch (row.assigneeType) {
        case "group":
          if (self.onGroupRemove) {
            self._disableInput(I3.ui.getParentWithTagName("table", row));
            self._prepareRowForRemoval(row);
            self.onGroupRemove(row.assigneeID);
          }
          break;
        case "user":
          if (self.onUserRemove) {
            self._disableInput(I3.ui.getParentWithTagName("table", row));
            self._prepareRowForRemoval(row);
            self.onUserRemove(row.assigneeID);
          }
          break;
      } // end switch
    } // end if
  }

  /**
   * Private Method: _disableInput
   *
   * Prevents any changes to the table while an operation is in progress.
   * 
   * Parameters:
   *   table - the table for which input should be disabled
   */
  @method _disableInput(table) {
    var checkboxes = table.getElementsByTagName("input");
    for (var i = 0; i < checkboxes.length; i++) {
      checkboxes[i].disabled = true;
    }
  }

  /**
   * Private Method: _prepareRowForRemoval
   *
   * Disables a row and replaces the "Remove" link with a working indicator.
   *
   * Parameters:
   *   row - the row DOM element
   */
  @method _prepareRowForRemoval(row) {
    row.cells[1].style.textDecoration = "line-through";
    I3.ui.setOpacity(row, 0.5);
    I3.ui.clear(row.cells[6]);
    var workingImg = I3.ui.create("img");
    workingImg.src = "/$theme/client-web/img/working.gif";
    row.cells[6].appendChild(workingImg);
  }

} // end BulletinBoard.PermissionView
