/**
 * Script: bboard/js/subscriptions
 *
 * Contains the applet for managing your email subscriptions.
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
 *   $Id: subscriptions.js 109 2008-05-19 15:45:55Z nmellis $
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
 * Class: BulletinBoard.SubscriptionsApplet
 *
 * Applet for managing your email subscriptions to Bulleting Board topics and posts.
 */
@class SubscriptionsApplet {
  
  var _topics = [];
  var _posts  = [];
  var _prefs  = [];
  
  /**
   * Method: initialize
   *
   * Initializes the Bulletin Board applet.
   */
  @method initialize() {
    I3.ui.get("bboard-saveSubscriptionChanges").onclick = self.saveChanges;
  }

  /**
   * Method: loadPath
   *
   * Called when a virtual path is handled by this applet.
   *
   * Parameters:
   *   path - the path string
   */
  @method loadPath(path) {

    // Add this tool's entry to the navigation bar.
    I3.navbar.addToPath("Bulletin Board", { link: "/bboard/" });
    I3.navbar.addToPath("Subscriptions");
    
    self.loadSubscriptions();
  }
  
  /**
   * Method: loadSubscriptions
   *
   * Loads the list of subscriptions for the current user.
   */
  @method loadSubscriptions() {
    I3.ui.hide("bboard-subscriptions");
    I3.ui.show("bboard-loadingSubscriptions");
    I3.client.getObject("/bboard/data/subscriptions", self.onLoadSubscriptionsResponse);
  }
  
  /**
   * Method: onLoadSubscriptionsResponse
   *
   * Response handler for <loadSubscriptions>.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> object
   */
  @method onLoadSubscriptionsResponse(response) {
    if (response.isOK()) {
      var obj = response.getObject();
      _topics = obj.topics;
      _posts  = obj.posts;
      _prefs  = obj.preferences;
      
      self.displaySubscriptions();
    }
    I3.ui.hide("bboard-loadingSubscriptions");
  }
  
  /**
   * Method: displaySubscriptions
   *
   * Displays a list containing the subscriptions for the current user.
   */
  @method displaySubscriptions() {
    // Display a list of Topics
    var topicContainer = I3.ui.clear("bboard-subscriptionTopicList");
    if (_topics.length > 0) {
      var topicList = I3.ui.create("UL");
      for (var i = 0; i < _topics.length; i++) {
        topicList.appendChild(I3.ui.createWithContent("LI", self._createTopicPostItem(_topics[i])));
      }
      topicContainer.appendChild(topicList);
    }
    else {
      topicContainer.innerHTML = "<em>You are not subscribed to any topics.</em>";
    }
    
    // Display a list of Posts
    var postContainer = I3.ui.clear("bboard-subscriptionPostList");
    if (_posts.length > 0) {
      var postList = I3.ui.create("UL");
      for (var i = 0; i < _posts.length; i++) {
        postList.appendChild(I3.ui.createWithContent("LI", self._createTopicPostItem(_posts[i])));
      }
      postContainer.appendChild(postList);
    }
    else {
      postContainer.innerHTML = "<em>You are not subscribed to any posts.</em>";
    }
    
    // Display preferences
    self.displayPreferences();
    I3.ui.show("bboard-subscriptions");
  }
  
  /**
   * Method: displayPreferences
   *
   * Displays the user preferences for email format and frequency.
   */
  @method displayPreferences() {
    var format, frequency;
    format    = _prefs.subscription_format || "html";
    frequency = _prefs.subscription_frequency || "every_post";

    I3.ui.get("bboard-prefers-" + format).checked = true;
    I3.ui.get("bboard-prefers-" + frequency).checked = true;
  }
  
  /**
   * Private Method: _createTopicPostItem
   *
   * Creates a LABEL, checkbox and sets the values appropriately and returns the new objects.
   *
   * Parameters:
   *   item - the topic or post being rendered
   * 
   * Returns:
   *   An HTML `LABEL` element.
   */
  @method _createTopicPostItem(item) {
    var label, checkbox, text;
    label = I3.ui.create("LABEL");
    checkbox = I3.ui.createCheckbox(item.is_subscription);
    checkbox.value = item.permalink;
    label.appendChild(checkbox);
    
    text = " " + item.name;
    if (item.topic) text += " <span class='postTopicName'>[" + item.topic + "]</span>";
    var span = I3.ui.create("SPAN");
    span.innerHTML = text;
    label.appendChild(span);
    return label;
  }
  
  /**
   * Method: saveChanges
   *
   * Saves the changes to the user's subscriptions
   *
   * Parameters:
   *   e - the event info
   */
  @method saveChanges(e) {
    e = I3.ui.getEvent(e);
    var button = e.getTarget();
    
    I3.ui.hide("bboard-saveSubscriptionsError");
    I3.ui.hide("bboard-saveSubscriptionsInstructions");
    I3.ui.show("bboard-saveSubscriptionsStatus");
    
    var allElements   = I3.ui.get("appletContent").getElementsByTagName("INPUT");
    var topicElements = I3.ui.get("bboard-subscriptionTopicList").getElementsByTagName("INPUT");
    var postElements  = I3.ui.get("bboard-subscriptionPostList").getElementsByTagName("INPUT");
    
    // Disable all the elements while we're saving
    for (var i = 0; i < allElements.length; i++) allElements[i].disabled = true;
    
    var topics = [];
    for (var i = 0; i < topicElements.length; i++) {
      if (topicElements[i].checked) topics.push(topicElements[i].value);
    }
    
    var posts = [];
    for (var i = 0; i < postElements.length; i++) {
      if (postElements[i].checked) posts.push(postElements[i].value);
    }
    
    var prefs = {};
    prefs.subscription_format = self._getRadioValueInContainer("bboard-prefers-format-list");
    prefs.subscription_frequency = self._getRadioValueInContainer("bboard-prefers-frequency-list");
    
    var obj = {
      topics: topics, 
      articles: posts, 
      preferences: prefs
    };
    
    I3.client.putObject(obj, "/bboard/data/subscriptions", function(response) {
      I3.ui.hide("bboard-saveSubscriptionsStatus");
      if (response.isOK()) {
        I3.ui.clear("bboard-saveSubscriptionsError").innerHTML = "Subscriptions updated.";
        I3.ui.show("bboard-saveSubscriptionsError");
      }
      else {
        I3.ui.hide("bboard-saveSubscriptionsStatus");
        I3.ui.clear("bboard-saveSubscriptionsError").innerHTML = 
          "ERROR: " + response.getObject().message;
        I3.ui.show("bboard-saveSubscriptionsError");
      }
      // Re-enable all the elements
      for (var i = 0; i < allElements.length; i++) allElements[i].disabled = false;
    }, false)
  }
  
  /**
   * Private Method: _getRadioValueInContainer
   *
   * Returns the value of the selected radio element in the supplied `container`.  Returns `null` 
   * if no selected radio element could be found.
   *
   * Parameters:
   *   container - a string or HTML element that contains the radio elements
   */
  @method _getRadioValueInContainer(container) {
    if (typeof container == "string") container = I3.ui.get(container);
    var elements = container.getElementsByTagName("INPUT");
    for (var i = 0; i < elements.length; i++) {
      if (elements[i].type == "radio") {
        if (elements[i].checked) return elements[i].value;
      }
    }
    return null;
  }
  
}