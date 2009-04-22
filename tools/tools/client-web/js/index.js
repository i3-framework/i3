/**
 * Script: tools/client-web/js/index
 *
 * Main applet for the Tool List tool.
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
 *   $Id: index.js 15 2007-12-10 22:34:11Z melfstrand $
 */

// ---------------------------------------------------------------------------

/**
 * Module: Tools
 *
 * The module containing all Tool List classes and data.
 */
@module Tools;

// ---------------------------------------------------------------------------

/**
 * Class: Tools.IndexApplet
 * 
 * The main applet class for the Tool List.
 * Displays the list of tools available to the user.
 */
@class IndexApplet {

  /**
   * Method: initialize
   *
   * Initializes the applet.
   */
  @method initialize() {
    // Empty
  }
  
  /**
   * Method: loadPath
   *
   * Loads the list of tools into the applet.  The tool list is
   * sent with the server configuration during the intranet pre-load,
   * so a web service call does not need to be made here.
   * 
   * Parameters:
   *   path - the extra path data from the URI; ignored
   */
  @method loadPath(path) {

    // Set up navigation bar.
    I3.navbar.addToPath("Tools");

    // Load the tool list from the server configuration.
    // Don't include any items that are in the navbar's default list.
    var tools = I3.config.getTools();
    var toolArray = [];
    var hiddenTools = {};
    var fixedNavBarItems = I3.config.getFixedNavBarItems();
    var fixedItemTool;
    for (var i = 0; i < fixedNavBarItems.length; i++) {
      hiddenTools[fixedNavBarItems[i].tool] = true;
    }
    for (var key in tools) {
      if (hiddenTools[key] == null) toolArray.push(tools[key]);
    }
    self.displayTools(toolArray);
  }
  
  /**
   * Method: displayTools
   *
   * Renders an array of tool info structures.
   *
   * Parameters:
   *   tools - the array of tool data
   */
  @method displayTools(tools) {
    
    // Sort the tool list by the displayed name.
    tools = tools.sort(self.compareTools);
    var toolCount = tools.length;
    
    // Loop through each tool and create a block for it.
    var blocks = [];
    var tool, imgFilename, img, imgLink, nameLink, linkWrapper, descP;
    var toolTable, toolTBody, toolTR, iconTD, textTD;
    for (var i = 0; i < toolCount; i++) {
      // Create icon link.
      tool = tools[i];
      imgFilename = "/" + tool.dir + "/client-web/img/applet-icon-32.png";
      img = I3.ui.createAlphaImage(imgFilename, 32, 32);
      img.className = "toolIcon";
      imgLink = self.createLinkForTool(tool);
      imgLink.appendChild(img);
      // Create link in an H4 wrapper.
      nameLink = self.createLinkForTool(tool);
      linkWrapper = I3.ui.create("h4");
      linkWrapper.appendChild(nameLink);
      // Create description paragraph.
      descP = I3.ui.create("p");
      descP.appendChild(I3.ui.text(tool.description));
      // Build individual tool table containing icon and text.
      iconTD = I3.ui.create("td");
      iconTD.appendChild(img);
      textTD = I3.ui.create("td");
      textTD.appendChild(linkWrapper);
      textTD.appendChild(descP);
      toolTR = I3.ui.create("tr");
      toolTR.appendChild(iconTD);
      toolTR.appendChild(textTD);
      toolTBody = I3.ui.create("tbody");
      toolTBody.appendChild(toolTR);
      toolTable = I3.ui.create("table");
      toolTable.className = "toolBlock";
      toolTable.appendChild(toolTBody);
      blocks.push(toolTable);
    }

    // Now add the blocks to the main tools table in two columns.
    var tbody = I3.ui.get("toolsTBody");
    var columnLength = Math.ceil(blocks.length / 2);
    var tr, td;
    for (var i = 0; i < columnLength; i++) {
      tr = I3.ui.create("tr");
      td = I3.ui.create("td");
      td.appendChild(blocks[i]);
      tr.appendChild(td);
      td = I3.ui.create("td");
      if ((i + columnLength) < toolCount)
        td.appendChild(blocks[i + columnLength]);
      else td.innerHTML = "&nbsp;";
      tr.appendChild(td);
      tbody.appendChild(tr);
    }
    
    I3.ui.show("toolsList");
  }

  /**
   * Method: createLinkForTool
   *
   * Creates a link that will navigate to the given `tool`.
   *
   * Parameters:
   *   tool - the tool info structure 
   */
  @method createLinkForTool(tool) {
    if (tool.is_native) {
      return I3.ui.createNavigationLink(tool.name, "/" + tool.dir + "/");
    } else {
      var link = I3.ui.create("a");
      link.href = tool.applets["index"];
      link.appendChild(I3.ui.text(tool.name));
      return link;
    }
  }

  /**
   * Method: compareTools
   *
   * Compares two tool info structures for sorting.
   * 
   * Parameters:
   *   a - the first tool object to compare
   *   b - the second tool object to compare
   * 
   * Returns:
   *   - `-1` if the first tool should come _before_ the second one
   *   - `0` if the tools are identical
   *   - `1` if the first tool should come _after_ the second one
   */
  @method compareTools(a, b) {
    var aName = a.name.toLowerCase();
    var bName = b.name.toLowerCase();
    if (aName < bName) return -1;
    if (aName > bName) return 1;
    return 0;
  }

}
