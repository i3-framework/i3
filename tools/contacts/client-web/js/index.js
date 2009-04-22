/**
 * Script: contacts/js/index
 *
 * Main applet for the Contacts tool.
 * 
 * The Contacts tool lists contact information for each person in the Directory.
 * 
 * Credits:
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
 *   $Id: index.js 43 2008-01-07 17:58:02Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Contacts
 *
 * The module containing all Contacts classes and data.
 */
@module Contacts;


// ---------------------------------------------------------------------------


/**
 * Class: Contacts.ContactsController
 *
 * Displays the list of contacts in a table to the left, and displays
 * the selected contact in a panel to the right.
 * 
 * Parameters:
 *   contactList - the array of contact objects to display
 */
@class ContactsController(contactList) {

  var _contactList;           // The array of contacts to display
  var _detailCache;           // Contact details that have already been loaded
  var _view;                  // The table view
  var _hasDisplayed = false;  // Set to `true` when the tab has been displayed
  var _currentURL = "";       // Contact URL currently being displayed

  /**
   * Method: initialize
   *
   * Initializes the controller.  Called automatically when the controller
   * is instantiated.
   * 
   * Parameters:
   *   contactList - the array of contact objects to display
   */
  @method initialize(contactList) {
    
    // Create an array table model for displaying the data.
    _contactList = contactList;
    _detailCache = {};
    var model = new I3.ArrayTableModel(_contactList);
    model.addColumn({ title: "Contact", field: "last_name",
                      retriever: self.extractIndexString,
                      formatter: self.formatName });
    model.enableIndex();
    
    // Set up the view.  It will be displayed when the tab becomes visible.
    _view = new I3.TableView(I3.ui.get("contacts-contactsTableContainer"));
    _view.setDelegate(self);
    _view.setColumnHeadersEnabled(false);
    _view.setRowSelectionEnabled(true);
    _view.setModel(model);
    _view.sort(0);
    _view.display();
    
    // Reduce opacity of "Loading" message in contact info.
    I3.ui.setOpacity(I3.ui.get("contacts-contactFieldsLoading"), 0.5);
  }

  /**
   * Method: tableViewSelectionDidChange
   *
   * Called when a row has been selected from the table.
   *
   * Parameters:
   *   view - the <I3.TableView> whose selection was changed
   */
  @method tableViewSelectionDidChange(view) {
    self.displayContact(_contactList[view.getSelectedRow()]);
  }
  
  /**
   * Method: extractIndexString
   *
   * Retrieves the fields from the row and generates a string from it
   * in the format "Last First Spouse Title Department Location Email".
   * This is used to generate the index keywords.
   * 
   * Parameters:
   *   row - the row of data containing the fields to be indexed
   * 
   * Returns:
   *   The full name string.
   * 
   * See Also:
   *   <formatName>
   */
  @method extractIndexString(row) {
    var str = row.last_name + " " + row.first_name;
    if (row.job_title)  str += " " + row.job_title;
    if (row.department) str += " " + row.department;
    if (row.email)      str += " " + row.email;
    return str;
  }
  
  /**
   * Method: formatName
   *
   * Creates an HTML string for the name field.
   *
   * Parameters:
   *   value - ignored; the value being formatted
   *   field - ignored; the name of the field being formatted
   *   row - the row of data containing the name fields
   * 
   * Returns:
   *   The HTML for a `mailto:` link to the address.
   */
  @method formatName(value, field, row) {
    var name = "";
    if (row.display_name != null && (row.last_name == null || row.first_name == null))
      name = row.display_name;
    else
      name = row.last_name + ", " + row.first_name;
      
    if (row.department) name +=
      '<span class="contacts-contactListLocation"> - ' + row.department + '</span>';
    return name;
  }

  /**
   * Method: displayContact
   *
   * Displays a contact's fields in the right-hand pane of the viewer.
   *
   * Parameters:
   *   contact - the contact object to display
   */
  @method displayContact(contact) {
    _currentURL = contact.url;
    
    // Remove the instructions in case this is the first item being displayed.
    I3.ui.hide("contacts-contactInfoInstructions");

    // Hide fields that we may not have data for yet.
    I3.ui.hide("contacts-contactFieldsLoading");
    I3.ui.hide("contacts-contactFields");
    
    // Display the contact's name.
    var nameHeader = I3.ui.clear("contacts-contactName");
    nameHeader.appendChild(I3.ui.text(contact.display_name));
    
    // Display any available job/location info.
    var subtitleFields = [ "job_title", "department", "company" ];
    var subtitle = "";
    for (var i = 0; i < subtitleFields.length; i++) {
      if (contact[subtitleFields[i]] && contact[subtitleFields[i]].length > 0) {
        if (subtitle.length > 0) subtitle += " - ";
        subtitle += contact[subtitleFields[i]];
      }
    }
    I3.ui.clear("contacts-contactSubtitle").appendChild(I3.ui.text(subtitle));
    
    // Now that some data has been filled in, make sure the section is
    // visible in case this is the first item being displayed.
    I3.ui.show("contacts-contactInfoContent");

    // Add the e-mail address and extension to the (currently hidden)
    // field table.
    var tbody = I3.ui.clear("contacts-contactFieldsBody");
    if (contact.email && contact.email.length > 0) {
      var emailLink = I3.ui.create("a");
      emailLink.href = "mailto:" + contact.email;
      emailLink.appendChild(I3.ui.text(contact.email));
      tbody.appendChild(self.createContactInfoRow("e-mail", emailLink));
      tbody.appendChild(self.createContactInfoSeparator());
    }
    if (contact.extension && contact.extension.toString().length > 0) {
      tbody.appendChild(self.createContactInfoRow(
        "extension", "x" + contact.extension.toString()));
    }
    
    // See if we can display any additional data.
    // See if we already have this data.
    if (_detailCache[_currentURL]) {
      self.displayContactInfo(_detailCache[_currentURL]);
      I3.ui.show("contacts-contactFields");
    } 
    else {
      // Load additional data from the web service.
      I3.ui.show("contacts-contactFieldsLoading");
      I3.client.getObject(_currentURL, self.onContactInfoResponse);
    }
  }

  /**
   * Method: onContactInfoResponse
   *
   * Called when additional contact info has been retrieved from the server.
   * 
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onContactInfoResponse(response) {
    if (response.isOK()) {
      var contact = response.getObject();
      _detailCache[contact.url] = contact;
      if (contact.url != _currentURL) return;
      self.displayContactInfo(contact);
    }
    I3.ui.hide("contacts-contactFieldsLoading");
    I3.ui.show("contacts-contactFields");
  }

  /**
   * Method: displayContactInfo
   *
   * Renders the contact's additional information (phone number
   * and/or address) to the info panel.
   * 
   * Parameters:
   *   contact - the full contact object to be displayed
   */
  @method displayContactInfo(contact) {
    var tbody = I3.ui.get("contacts-contactFieldsBody");
    var i, j, label, address, addressLines, str, span;
    
    var phone_numbers = ["work_phone", "home_phone", "mobile", "pager", "fax"];
    for (i = 0; i < phone_numbers.length; i++) {
      label = phone_numbers[i].replace("_phone", "");
      if (contact[phone_numbers[i]] != null) {
        tbody.appendChild(self.createContactInfoRow(label, contact[phone_numbers[i]]));
      }
    }
    
    if (tbody.lastChild && tbody.lastChild.firstChild.colSpan != 2)
      tbody.appendChild(self.createContactInfoSeparator());
    
    addressLines = [];
    if (contact.street_address && contact.street_address.length > 0)
      addressLines = contact.street_address.split("\n");
    str = "";
    if (contact.city && contact.city.length > 0) str += contact.city;
    if (contact.state && contact.state.length > 0) {
      if (contact.city && contact.city.length > 0) str += ", ";
      str += contact.state + " ";
    }
    if (contact.zip_code && contact.zip_code.length > 0)
      str += contact.zip_code;
    if (str.length > 0) addressLines.push(str);
    if (contact.country && contact.country.length > 0)
      addressLines.push(contact.country);
    if (addressLines.length > 0) {
      span = I3.ui.create("span");
      for (j = 0; j < addressLines.length; j++) {
        if (j > 0) span.appendChild(I3.ui.create("br"));
        span.appendChild(I3.ui.text(addressLines[j]));
      }
      tbody.appendChild(self.createContactInfoRow("address", span));
    }
  }

  /**
   * Method: constructContactInfoRow
   *
   * Creates a row of contact info for the fields table.
   *
   * Parameters:
   *   label - the string to use for the label
   *   value - the value (string or DOM element) to use for the field content
   * 
   * Returns:
   *   A table row element.
   */
  @method createContactInfoRow(label, value) {
    label = I3.ui.text(label);
    if (typeof value == "string") value = I3.ui.text(value);
    var labelCell = I3.ui.create("td");
    labelCell.className = "contacts-contactLabel";
    labelCell.appendChild(label);
    var valueCell = I3.ui.create("td");
    valueCell.appendChild(value);
    var row = I3.ui.create("tr");
    row.appendChild(labelCell);
    row.appendChild(valueCell);
    return row;
  }
  
  /**
   * Method: createContactInfoSeparator
   *
   * Creates a separator row for the fields table.
   * 
   * Returns:
   *   A table row element.
   */
  @method createContactInfoSeparator() {
    var emptyCell = I3.ui.create("td");
    emptyCell.colSpan = 2;
    emptyCell.innerHTML = "&nbsp;";
    var row = I3.ui.create("tr");
    row.appendChild(emptyCell);
    return row;
  }

  self.initialize(contactList);
}


// ---------------------------------------------------------------------------


/**
 * Class: Contacts.IndexApplet
 * 
 * The main applet class for the Contacts tool.  This loads the summary data
 * and sets up the controller classes.
 */
@class IndexApplet {

  var _tabController;

  /**
   * Method: initialize
   *
   * Initializes the Index applet.
   */
  @method initialize() {
    
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
    I3.navbar.addToPath("Contacts");

    // Load the Contacts summary data.
    I3.client.getObject("/contacts/data/summary", self.onSummaryResponse);
  }
  
  /**
   * Method: onSummaryResponse
   *
   * Called when the Contacts summary has been loaded.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onSummaryResponse(response) {
    if (response.isOK()) {
      var summary = response.getObject();
      var controller = new Contacts.ContactsController(summary.people);
      I3.ui.show("contacts-tabs");
    }
    I3.ui.hide("contacts-loading");
  }

} // end Contacts.IndexApplet
