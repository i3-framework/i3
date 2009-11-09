/**
 * Script: log-viewer/client-web/js/index
 *
 * Place an overview of what the applet does here.
 *
 * Credits:
 * 
 *   Written by Nathan Mellis.
 * 
 * Copyright / License:
 * 
 *   Copyright 2008 Mission Aviation Fellowship
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
 *   $Id: index.js 1642 2008-08-21 21:00:08Z nmellis $
 */

// ---------------------------------------------------------------------------

/**
 * Module: LogViewer
 *
 * The module containing all Log Viewer classes and data.
 */
@module LogViewer;

// ---------------------------------------------------------------------------

/**
 * Class: LogViewer.IndexApplet
 *
 * Place a brief description of how the applet works here.
 */
@class IndexApplet {
  
  var _menu;
  var _services = [];
  var _data;
  var _path;
  
  var _needsInitialDataLoad = true;
  
  var HOST_STYLES = [ "hostStyle0", "hostStyle1", "hostStyle2", "hostStyle3", "hostStyle4" ];

  /**
   * Method: initialize
   *
   * Initializes the Index applet.
   */
  @method initialize() {
    var submitFunction = function() { self._fetchLogEntries() };
    
    I3.ui.addEventListener(I3.ui.get("logs-submit-query"), "click", submitFunction)
    I3.ui.addKeyEventListener(I3.ui.get("logs-query"), I3.Event.KEYCODE_ENTER, submitFunction);
    I3.ui.addKeyEventListener(I3.ui.get("logs-history"), I3.Event.KEYCODE_ENTER, submitFunction);
    I3.ui.addKeyEventListener(I3.ui.get("logs-result-limit"), I3.Event.KEYCODE_ENTER, submitFunction);
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

    _path = path;
    
    if (_needsInitialDataLoad)
      I3.client.getObject("/log-viewer/data/logs", self.onInitialDataLoadResponse);
    else
      self.handlePath();
  }
  
  /**
   * Method: onInitialDataLoadResponse
   *
   * Description of method
   *
   * Parameters:
   *   response - description
   */
  @method onInitialDataLoadResponse(response) {
    if (response.isOK()) {
      _needsInitialDataLoad = false;
      _data = response.getObject();
      for (var key in _data) _services.push(key);
      self._renderAvailableLogList();
      self.handlePath();
    }
  }
  
  /**
   * Method: handlePath
   *
   * Description of method
   */
  @method handlePath() {
    var path = _path;
    if (path.charAt(0) == "/") path = path.slice(1);
    path = path.split("/");
    
    if (path[0] == "") {
      // Add this tool's entry to the navigation bar.
      I3.navbar.addToPath("Log Viewer");
      
      I3.ui.hide("logs-viewer");
      I3.ui.show("logs-instructions");
    }
    else {
      // Add this tool's entry to the navigation bar.
      I3.navbar.addToPath("Log Viewer", { link: "/log-viewer/" });
      I3.navbar.addToPath(_data[path[0]].name);

      // _menu.selectItem(path[0]);
      self.displayLogsForService(path[0]);
      I3.ui.hide("logs-instructions");
      I3.ui.show("logs-viewer");
    }
  }
  
  /**
   * Private Method: _renderAvailableLogList
   *
   * Description of method
   */
  @method _renderAvailableLogList() {
    var container = I3.ui.get("logs-availableLogsList");
    for (var i = 0; i < _services.length; i++) {
      var row = I3.ui.create("LI");
      row.appendChild(I3.ui.createNavigationLink(_data[_services[i]].name, 
        "/log-viewer/" + _data[_services[i]].service + "/"));
      container.appendChild(row);
    }
    I3.ui.hide("logs-loadingLogsList");
    I3.ui.show("logs-availableLogsList");
  }
  
  /**
   * Method: displayLogsForService
   *
   * Description of method
   *
   * Parameters:
   *   serviceName - description
   */
  @method displayLogsForService(serviceName) {
    var service = _data[serviceName];
    var hosts   = service.hosts;
    
    self._renderHosts(hosts);
    self._renderAvailableDates(new Date(service.earliest_log_date));
    self._fetchLogEntries();
  }
  
  /**
   * Private Method: _renderAvailableDates
   *
   * Description of method
   * 
   * Parameters:
   *   theDate - d
   */
  @method _renderAvailableDates(theDate) {
    var selectBox = I3.ui.get("logs-start-from");
    selectBox.options.length = 0;   // Reset the select box
    
    var format = "%b %d";
    
    // Create the first entry for "Today"
    selectBox.options[selectBox.options.length] = new Option("Today", "");
    
    var evalDate = new Date();
    evalDate.setDate(evalDate.getDate() - 1);
    evalDate.setHours(0);
    evalDate.setMinutes(0);
    evalDate.setSeconds(0);
    var endDate = new Date(theDate);
    
    while (evalDate > endDate) {
      selectBox.options[selectBox.options.length] = 
        new Option(I3.util.formatDate(evalDate, format));
      evalDate.setDate(evalDate.getDate() - 1);
    }
  }
  
  /**
   * Method: _renderHosts
   *
   * Description of method
   *
   * Parameters:
   *   hosts - description
   */
  @method _renderHosts(hosts) {
    if (hosts && hosts.length > 0) {
      var container = I3.ui.clear("logs-hostList");
    
      // Hide the host list if there aren't any hosts to display
      if (hosts == null || hosts.length == 0) {
        I3.ui.displayError("No hosts are available.");
        return;
      }
    
      var list = I3.ui.create("UL");
      list.className = "hostList";
    
      for (var i = 0; i < hosts.length; i++) {
        var host     = hosts[i];
        var row      = I3.ui.create("LI");
        var label    = I3.ui.create("LABEL");
        var checkbox = I3.ui.createCheckbox(true);  // Checked by default
      
        row.className = HOST_STYLES[i];
      
        checkbox.value = host;
        // checkbox.onclick = self._toggleHost;
      
        label.appendChild(checkbox);
        label.appendChild(I3.ui.text(host));
        row.appendChild(label);
        list.appendChild(row);
      }
    
      container.appendChild(list);
      I3.ui.show("logs-hostListContainer", "");
    }
    else {
      I3.ui.hide("logs-hostListContainer");
    }
  }
  
  /**
   * Private Method: _toggleHost
   *
   * Description of method
   *
   * Parameters:
   *   e - the event info
   */
  @method _toggleHost(e) {
    self._fetchLogEntries();
  }
  
  /**
   * Private Method: _fetchLogEntries
   *
   * Description of method
   */
  @method _fetchLogEntries() {
    I3.ui.hide("logs-results");
    I3.ui.show("logs-searching");
    
    // Get the query
    var terms = I3.ui.get("logs-query").value;
    
    // Get the start date
    var startFrom = I3.ui.get("logs-start-from").value;
    
    // Get the number of days back to search
    var history = I3.ui.get("logs-history").value;
    
    // Get the record limit
    var limit = I3.ui.get("logs-result-limit").value;
    
    // Get the hosts to search (exclude?)
    var hosts = self._getActiveHosts();
    
    // Don't bother searching if there are no terms to search for
    // if (terms == "") return;
    
    var query = "?q=" + terms;
    if (startFrom != "") query += "&from=" + startFrom;
    if (history != "") query += "&history=" + history;
    if (limit != "") query += "&limit=" + limit;
    if (hosts && hosts.length > 0) {
      for (var i = 0; i < hosts.length; i++) query += "&host=" + hosts[i];
    }
    
    // console.log(query);
    I3.cache.set("lastQuery", query);
    I3.client.getObject("/log-viewer/data/search" + _path + query, self.onSearchResponse);
  }
  
  /**
   * Method: onSearchResponse
   *
   * Description of method
   *
   * Parameters:
   *   response - description
   */
  @method onSearchResponse(response) {
    if (response.isOK()) {
      var data = response.getObject();
      self.displayResults(data);
    }
  }
  
  /**
   * Method: displayResults
   *
   * Description of method
   *
   * Parameters:
   *   results - description
   */
  @method displayResults(results) {
    var hosts = [];
    for (var key in results) hosts.push(key);
    hosts.sort();
    
    // Create a TabView for each host and then render the log entries for each host in its tab
    var container = I3.ui.clear("logs-results");
    var tabContainer = I3.ui.create("DIV");
    container.appendChild(tabContainer);
    var tabController = new I3.TabController(tabContainer);
    
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i];
      var hostContainer = I3.ui.create("DIV");
      hostContainer.id = "logs-results-" + host;
      hostContainer.className = "i3tabPanel";
      self._renderEntriesInContainer(results[host], hostContainer);
      tabContainer.appendChild(hostContainer);
      tabController.addTab({ title: host, panelID: "logs-results-" + host, delegate: self });
    }
    
    tabController.selectTab(0);
    I3.ui.hide("logs-searching");
    I3.ui.show(container);
  }
  
  /**
   * Private Method: _renderEntriesInContainer
   *
   * Description of method
   *
   * Parameters:
   *   entries - description
   *   container - description
   */
  @method _renderEntriesInContainer(entries, container) {
    if (entries == null || entries.length == 0) {
      container.innerHTML = "<em>There are no entries that match your search.</em>";
    }
    else {
      var table, tbody;
      table = I3.ui.create("TABLE");
      tbody = I3.ui.create("TBODY");
      
      I3.ui.clear(container).appendChild(table);
      table.appendChild(tbody);

      for (var i = 0; i < entries.length; i++) {
        var row, cell;
        row  = I3.ui.create("TR");
        cell = I3.ui.create("TD");
        
        row.className = i % 2 == 0 ? "i3tableRow" : "i3tableRowAlt";
        cell.appendChild(I3.ui.text(entries[i]));
        
        row.appendChild(cell);
        tbody.appendChild(row);
      }
    }
  }
  
  /**
   * Private Method: _getActiveHosts
   *
   * Description of method
   */
  @method _getActiveHosts() {
    var inputs = I3.ui.get("logs-hostList").getElementsByTagName("INPUT");
    var activeHosts = [];
    for (var i = 0; i < inputs.length; i++) {
      if (inputs[i].checked) activeHosts.push(inputs[i].value);
    }
    return activeHosts;
  }

} // end LogViewer.IndexApplet
