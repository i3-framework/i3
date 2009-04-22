/**
 * Script: bboard/js/bboard
 *
 * Contains the primary applet for the Bulletin Board tool.  This handles
 * the listing and editing of posts on the Bulletin Board.
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
 *   $Id: index.js 151 2009-03-20 19:44:10Z nmellis $
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
 * Class: BulletinBoard.SubscriptionController
 *
 * Manages the methods for adding a post or topic to the user's subscription list.
 */
@class SubscriptionController {
  
  var CONTAINER = "bbSubscribeToTopicLinkContainer";
  var LINK      = "bbSubscribeToTopicLink";
  
  var _text;
  var _permalink;
  var _isSubscription;
  var _isTopic;
  
  var _working = false;
  
  /**
   * Method: hide
   *
   * Hides the subscription link.
   */
  @method hide() {
    I3.ui.hide(CONTAINER);
  }
  
  /**
   * Method: createSubscribeLink
   *
   * Create the link necessary to subscribe to post or topic.
   *
   * Parameters:
   *   text - description
   */
  @method createSubscribeLink(text, permalink, isSubscription, isTopic) {
    _text           = text;
    _permalink      = permalink;
    _isSubscription = isSubscription;
    _isTopic        = isTopic;
    
    I3.ui.clear(LINK).appendChild(I3.ui.createActionLink(
      (isSubscription ? "Uns" : "S") + "ubscribe " + (isSubscription ? "from" : "to") + " " + text, 
      null, "Subscribe", self._subscribe));
  }
  
  /**
   * Private Method: _subscribe
   *
   * Click handler for when a user subscribes to a topic or post.
   *
   * Parameters:
   *   e - the event info
   */
  @method _subscribe(e) {
    e = I3.ui.getEvent(e);
    var info = e.getInfo();
    
    var link = e.getTarget();
    link.innerHTML = _isSubscription ? "Unsubscribing from " + _text + "..." : 
                                       "Subscribing to " + _text + "...";
    if (_working) return;
    
    _working = true;
    
    if (_isSubscription) {
      I3.client.deleteObject(
        "/bboard/data/subscriptions/" + (_isTopic ? "topics" : "articles") + "/" + _permalink, 
        self._onSubscribeResponse);
    }
    else {
      I3.client.postObject(_permalink, 
        "/bboard/data/subscriptions/" + (_isTopic ? "topics" : "articles"), 
        self._onSubscribeResponse);
    }
  }
  
  /**
   * Private Method: _onSubscribeResponse
   *
   * Response handler for <subscribe>.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> object
   */
  @method _onSubscribeResponse(response) {
    _working = false;
    if (response.isOK()) 
      self.createSubscribeLink(_text, _permalink, !_isSubscription, _isTopic);
    else
      self.createSubscribeLink(_text, _permalink, _isSubscription, _isTopic);
  }
  
}

if (BulletinBoard.subscriptionController == null)
  BulletinBoard.subscriptionController = new BulletinBoard.SubscriptionController();


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.ListController
 *
 * Manages the list of subjects that have been posted in a topic.
 */
@class ListController {
  
  /**
   * Method: displayListForTopic
   *
   * Shows the list of subjects that have been posted in the given topic.
   *
   * Parameters:
   *   topicPermalink - the permalink of the topic to display
   */
  @method displayListForTopic(topicPermalink) {
    I3.ui.show("bbLoading");
    I3.client.getObject("/bboard/data/messages/" + topicPermalink + "/",
                        self.onListResponse);
  }
  
  /**
   * Method: onListResponse
   *
   * Called when the list of subjects has been retrieved from the server.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> object containing the response data
   */
  @method onListResponse(response) {
    if (response.isOK()) self._renderList(response.getObject());
    I3.ui.hide("bbLoading");
  }

  /**
   * Method: _renderList
   *
   * Constructs a table containing the subject list and displays it.
   * 
   * The `subjectList` returned from the server will include these
   * properties:
   * 
   *   total - the total number of subjects that have been posted in
   *     the topic
   *   start - the index at which this list started
   *   limit - the maximum number of subjects that this request
   *     may have returned
   *   subjects - the array of subject data.
   * 
   * Each subject in the `subjects` list will include these
   * properties:
   * 
   *   subject - the text of the message subject
   *   author_name - the full name of the person who posted the message
   *   posted_at - the date and time at which the message was posted
   *   comment_count - the number of comments that have been made on the post
   *   uri - the web service URI from which the full message may be retrieved
   *
   * Parameters:
   *   subjectList - the object containing the subject list data
   */
  @method _renderList(subjectList) {

    // Create the information block describing what is being displayed.
    var infoP = I3.ui.clear("bbPostListInfo");
    if (subjectList.total > 0) {
      var lastIndex = (subjectList.limit + subjectList.start);
      if (lastIndex > subjectList.total) lastIndex = subjectList.total;
      infoP.appendChild(I3.ui.text(
        "Messages " + (subjectList.start + 1).toString() +
        " to " + lastIndex.toString() +
        " out of a total of " + subjectList.total.toString() ));
    } else {
      infoP.appendChild(I3.ui.text("No messages have been posted."));
    }
    
    // List each subject.
    var listDiv = I3.ui.clear("bbPostList");
    for (var i = 0; i < subjectList.subjects.length; i++) {
      var item = subjectList.subjects[i];
      var itemDiv = I3.ui.create("div");
      var titleH = I3.ui.create("h4");
      var bylineP = I3.ui.create("p");
      titleH.appendChild(I3.ui.createNavigationLink(item.subject,
        item.uri.replace("/bboard/data/messages/", "/bboard/topics/")));
      bylineP.appendChild(I3.ui.text(
        "Posted " + I3.util.formatFriendlyDate(new Date(item.posted_at)) +
        " by " + item.author_name ));
      if (item.comment_count > 0) {
        var rWord = (item.comment_count > 1) ? "responses" : "response";
        bylineP.appendChild(I3.ui.text(
          " (" + item.comment_count.toString() + " " + rWord + ")" ));
      }
      itemDiv.className = "bbPostListItem";
      itemDiv.appendChild(titleH);
      itemDiv.appendChild(bylineP);
      listDiv.appendChild(itemDiv);
    }
    
    // Now we can make it all visible.
    I3.ui.show("bbPosts");
  }
  
}


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.PostController
 * 
 * Manages the display and editing of posts and comments.
 */
@class PostController {
  
  /**
   * Constant: COMMENT_WORDS
   * Synonyms for "said" to use in comment bylines.
   */
  var COMMENT_WORDS =
    [ "added", "commented", "remarked", "replied", "responded", "said" ];
  
  /**
   * Constant: DATE_THRESHOLD
   * Number of milliseconds after which we stop printing friendly time
   * distances (e.g. "20 minutes later") and start using actual date strings.
   */
  var DATE_THRESHOLD = 1000 * 60 * 60 * 24 * 14;  // 2 weeks
  
  var _messagePath;       // Path being displayed
  var _messageData;       // Message data being displayed
  var _isReloading;       // True when the message is re-displaying
  var _addCommentText;    // Reference to new comment text area
  var _addCommentButton;  // Reference to new comment submit button
  
  /**
   * Method: displayPost
   *
   * Displays a post and its associated comments.
   *
   * Parameters:
   *   path - the path of the post, starting with the topic permalink
   */
  @method displayPost(path) {
    _messagePath = path;
    _messageData = null;
    I3.ui.show("bbLoading");
    I3.client.getObject("/bboard/data/messages/" + _messagePath,
                        self.onMessageResponse);
  }

  /**
   * Method: onMessageResponse
   *
   * Called when a message has been retrieved from the server.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> object containing the response data
   */
  @method onMessageResponse(response) {
    if (response.isOK()) self._renderMessage(response.getObject());
    I3.ui.hide("bbLoading");
  }

  /**
   * Method: _renderMessage
   *
   * Renders the message data in the page.
   * 
   * The message data received from the server will include the following
   * properties:
   * 
   *   subject - the subject of the message
   *   body - the main text of the message
   *   author_name - the full name of the person who posted the message
   *   email - the e-mail address of the author
   *   posted_at - the date and time that the message was posted
   *   comments - the array of comments that people have left
   *   can_edit - `true` if the currently logged-in user is allowed
   *     to edit the message
   * 
   * Each comment in the `comments` array will include the following
   * properties:
   * 
   *   body - the text of the comment
   *   author_name - the full name of the person who posted the comment
   *   email - the e-mail address of the comment author
   *   posted_at - the date and time that the comment was posted
   *   can_edit - `true` if the currently logged-in user is allowed
   *     to edit the comment
   */
  @method _renderMessage(message) {
    _messageData = message;

    // Add the message title to the navbar.
    if (!_isReloading) I3.navbar.addToPath(message.subject);
    _isReloading = false;

    // Replace the topic name with the message subject.
    var topicNameH = I3.ui.clear("bbTopicName");
    topicNameH.appendChild(I3.ui.text(message.subject));
    
    // Display the "Subscribe" link
    BulletinBoard.subscriptionController.createSubscribeLink(
      message.subject, message.permalink, message.is_subscription, false);
    

    // Build the edit link if applicable.
    var bylineH = I3.ui.clear("bbPostByline");
    var editDiv;
    if (message.can_edit) {
      editDiv = I3.ui.create("div");
      editDiv.className = "bboard-editLink";
      editDiv.appendChild(I3.ui.text("["));
      editDiv.appendChild(I3.ui.createActionLink(
        "edit", "edit", "edit:post", self.onEditMessage));
      editDiv.appendChild(I3.ui.text("]"));
      bylineH.appendChild(editDiv);
    }

    // Construct the author link.
    var authorA = I3.ui.create("a");
    authorA.appendChild(I3.ui.text(message.author_name));
    authorA.href = "mailto:" + message.email;

    // Build the post display.
    var contentDiv = I3.ui.clear("bbPostContent");
    self._insertParagraphs(contentDiv, message.body);
    var previousDate = new Date(message.posted_at);
    var postDateStr = I3.util.formatFriendlyDate(previousDate);
    postDateStr = postDateStr.substr(0, 1).toUpperCase() +
                  postDateStr.substr(1);
    bylineH.appendChild(I3.ui.text(postDateStr + ", "))
    bylineH.appendChild(authorA);
    bylineH.appendChild(I3.ui.text(" said:"));

    // Add the comments.
    var commentsDiv = I3.ui.clear("bbPostComments");
    var comment, commentDiv, commentDate, commentDateStr, commentWord;
    for (var i = 0; i < message.comments.length; i++) {
      comment = message.comments[i];

      // Create the comment elements.
      bylineH = I3.ui.create("h5");
      commentDiv = I3.ui.create("div");
      contentDiv = I3.ui.create("div");

      // Build the edit link if applicable.
      if (message.can_edit) {
        editDiv = I3.ui.create("div");
        editDiv.className = "bboard-editLink";
        editDiv.appendChild(I3.ui.text("["));
        editDiv.appendChild(I3.ui.createActionLink("edit", i,
          "edit:comment " + (i + 1).toString(), self.onEditComment));
        editDiv.appendChild(I3.ui.text("]"));
        bylineH.appendChild(editDiv);
      }

      // Construct the author link.
      authorA = I3.ui.create("a");
      authorA.appendChild(I3.ui.text(comment.author_name));
      authorA.href = "mailto:" + comment.email;

      // Construct the byline strings.
      commentDate = new Date(comment.posted_at);
      if (commentDate - previousDate > DATE_THRESHOLD) {
        commentDateStr =
          "Then, " + I3.util.formatFriendlyDate(commentDate) + ", ";
      } else {
        commentDateStr =
          I3.util.distanceOfTimeInWords((commentDate - previousDate) / 60000);
        commentDateStr = commentDateStr.substr(0, 1).toUpperCase() +
                         commentDateStr.substr(1) + " later, ";
      }
      previousDate = commentDate;
      commentWord =
        COMMENT_WORDS[Math.floor(Math.random() * COMMENT_WORDS.length)];

      // Build the comment display.
      bylineH.appendChild(I3.ui.text(commentDateStr));
      bylineH.appendChild(authorA);
      bylineH.appendChild(I3.ui.text(" " + commentWord + ":"));
      self._insertParagraphs(contentDiv, comment.body);
      commentDiv.className = "bbPostComment";
      commentDiv.appendChild(bylineH);
      commentDiv.appendChild(contentDiv);
      commentsDiv.appendChild(commentDiv);
    }

    // Set up the Add Comment area.
    _addCommentText = I3.ui.get("bbAddCommentText");
    _addCommentButton = I3.ui.get("bbAddCommentButton");
    var authorSpan = I3.ui.clear("bbAddCommentAuthorLabel");
    authorSpan.appendChild(I3.ui.text(I3.user.getFullName()));
    var subjectSpan = I3.ui.clear("bbAddCommentSubjectLabel");
    subjectSpan.appendChild(I3.ui.text("Re: " + message.subject));
    _addCommentText.value = "";
    _addCommentText.onkeyup = self.onCommentChange;
    _addCommentButton.onclick = self.onAddComment;
    _addCommentButton.disabled = true;

    // Now we can make it all visible.
    I3.ui.show("bbSinglePost");
  }
  
  /**
   * Method: _insertParagraphs
   *
   * Creates paragraphs from a string and appends each paragraph
   * to an element.
   * 
   * Parameters:
   *   element - the DOM element to which the text should be appended
   *   text - the string to insert
   */
  @method _insertParagraphs(element, text) {
    var paragraphs = text.split("\n\n");
    var pElement;
    for (var i = 0; i < paragraphs.length; i++) {
      var content = paragraphs[i];
      content = content.replace(/\n/g, "<br/>");    // Replace newlines
      content = content.replace(/https?:\/\/[^\s]+/g, '<a href="$&">$&</a>');
      content = content.replace(/\w+@\w+\.\w+/g, '<a href="mailto:$&">$&</a>');
      
      pElement = I3.ui.create("p");
      pElement.innerHTML = content;
      // pElement.appendChild(I3.ui.text(paragraphs[i]));
      element.appendChild(pElement);
    }
  }

  /**
   * Method: onCommentChange
   *
   * Called when a key is pressed in the new comment text area.
   * Checks to see if any text has been entered and enables the submit
   * button if so.
   *
   * Parameters:
   *   e - the key-up event parameters
   */
  @method onCommentChange(e) {
    _addCommentButton.disabled = (_addCommentText.value.length == 0);
  }

  /**
   * Method: onAddComment
   *
   * Called when the "Submit" button is clicked for a new comment.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onAddComment(e) {
    _addCommentText.disabled = true;
    _addCommentButton.disabled = true;
    I3.ui.get("bbAddCommentStatusLabel").innerHTML = "Adding reply...";
    I3.client.postObject({ body: _addCommentText.value },
      "/bboard/data/messages/" + _messagePath + "/comments",
      self.onCommentAddResponse);
  }
  
  /**
   * Method: onCommentAddResponse
   *
   * Called when the add-comment web service has responded.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onCommentAddResponse(response) {
    if (response.isOK()) {
      I3.ui.hide("bbSinglePost");
      _isReloading = true;
      self.displayPost(_messagePath);
    } else _addCommentButton.disabled = false;
    I3.ui.get("bbAddCommentStatusLabel").innerHTML = "";
    _addCommentText.disabled = false;
  }

  /**
   * Method: onEditMessage
   *
   * Called when the "Edit" link is called for a post.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onEditMessage(e) {
    I3.ui.show("bboard-editSubjectHeader");
    I3.ui.get("bboard-editAuthorLabel").innerHTML = _messageData.author_name;
    I3.ui.get("bboard-editSubjectText").value = _messageData.subject;
    I3.ui.get("bboard-editBodyText").value = _messageData.body;
    I3.ui.get("bboard-editStatus").style.visibility = "hidden";
    I3.ui.get("bboard-editPath").value =
        "/bboard/data/messages/" + _messagePath;
    I3.ui.popupDialogWithElement(I3.ui.get("bboard-editPopup"), {
      title: "Edit Message",
      width: 500,
      acceptButton: { label: "Save", onclick: self.onMessageSave },
      cancelButton: true
     });
  }

  /**
   * Method: onEditComment
   *
   * Called when the "Edit" link is clicked for a comment.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onEditComment(e) {
    var commentIndex = I3.ui.getEvent(e).getInfo();
    var comment = _messageData.comments[commentIndex];
    I3.ui.hide("bboard-editSubjectHeader");
    I3.ui.get("bboard-editAuthorLabel").innerHTML = comment.author_name;
    I3.ui.get("bboard-editBodyText").value = comment.body;
    I3.ui.get("bboard-editStatus").style.visibility = "hidden";
    I3.ui.get("bboard-editPath").value =
        "/bboard/data/messages/" + _messagePath +
        "/comments/" + commentIndex.toString(),
    I3.ui.popupDialogWithElement(I3.ui.get("bboard-editPopup"), {
      title: "Edit Comment",
      width: 500,
      acceptButton: { label: "Save", onclick: self.onCommentSave },
      cancelButton: true
     });
  }

  /**
   * Method: onMessageSave
   *
   * Called when the "Save" button is clicked when editing message text.
   * 
   * Parameters:
   *   e - the click event parameters
   */
  @method onMessageSave(e) {
    I3.ui.get("bboard-editStatus").style.visibility = "visible";
    var message = {};
    message.subject = I3.ui.get("bboard-editSubjectText").value;
    message.body = I3.ui.get("bboard-editBodyText").value;
    I3.client.putObject(message,
      I3.ui.get("bboard-editPath").value,
      self.onEditResponse);
  }

  /**
   * Method: onCommentSave
   *
   * Called when the "Save" button is clicked when editing comment text.
   * 
   * Parameters:
   *   e - the click event parameters
   */
  @method onCommentSave(e) {
    I3.ui.get("bboard-editStatus").style.visibility = "visible";
    var comment = { body: I3.ui.get("bboard-editBodyText").value };
    I3.client.putObject(comment,
      I3.ui.get("bboard-editPath").value,
      self.onEditResponse);
  }
  
  /**
   * Method: onEditResponse
   *
   * Called when an edit operation has finished.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onEditResponse(response) {
    I3.ui.endPopupDialog();
    I3.ui.hide("bbSinglePost");
    _isReloading = true;
    self.displayPost(_messagePath);
  }
  
}


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.ComposeController
 *
 * Displays an editing panel for new messages.
 */
@class ComposeController {
  
  var _topic;
  var _subjectText;
  var _bodyText;
  var _submitButton;
  var _cancelButton;
  
  /**
   * Method: composeNewMessageForTopic
   *
   * Displays the editing panel for posting a new message.
   *
   * Parameters:
   *   topicPermalink - the permalink for the topic that the message
   *     will be placed in
   */
  @method composeNewMessageForTopic(topicPermalink) {

    _topic = topicPermalink;

    // Retrieve control references.
    _subjectText = I3.ui.get("bbComposeSubjectText");
    _bodyText = I3.ui.get("bbComposeBodyText");

    // Enable editing fields and set up change handlers.
    var textFields = [ _subjectText, _bodyText ];
    for (var i = 0; i < textFields.length; i++) {
      textFields[i].value = "";
      textFields[i].disabled = false;
      textFields[i].onkeyup = self.onTextChange;
    }

    // Set up event handlers for buttons.
    _submitButton = I3.ui.get("bbComposeSubmitButton");
    _submitButton.onclick = self.onSubmit;
    _submitButton.disabled = true;
    _cancelButton = I3.ui.get("bbComposeCancelButton");
    _cancelButton.onclick = self.onCancel;
    _cancelButton.disabled = false;
    
    // Display user name as author.
    var authorSpan = I3.ui.clear("bbComposeAuthorLabel");
    authorSpan.appendChild(I3.ui.text(I3.user.getFullName()));

    // Display UI.
    I3.ui.hide("bbPosts");
    I3.ui.show("bbCompose");
  }
  
  /**
   * Method: onTextChange
   *
   * Called when a key is pressed in one of the text boxes.
   * Enables the submit button if both a subject and body have been entered.
   *
   * Parameters:
   *   e - the key-up event parameters
   */
  @method onTextChange(e) {
    _submitButton.disabled = (_subjectText.value.length == 0 ||
                              _bodyText.value.length == 0);
  }
  
  /**
   * Method: onSubmit
   *
   * Called when submit button is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onSubmit(e) {

    // Disable controls.
    _subjectText.disabled = true;
    _bodyText.disabled = true;
    _submitButton.disabled = true;
    _cancelButton.disabled = true;
    
    // Build message object.
    var obj = { subject: _subjectText.value, body: _bodyText.value };
    
    // Send message to web service.
    I3.ui.get("bbComposeStatusLabel").innerHTML = "Posting message...";
    I3.client.postObject(obj, "/bboard/data/messages/" + _topic,
                         self.onSubmitResponse);
  }
  
  /**
   * Method: onSubmitResponse
   *
   * Called when the web service has responded.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> containing the response data
   */
  @method onSubmitResponse(response) {
    if (response.isOK()) {
      // Display new post.
      I3.client.navigateTo(response.getObject().uri.replace(
        "/bboard/data/messages/", "/bboard/topics/"));
    } else {
      // Re-renable UI so another attempt can be made.
      _subjectText.disabled = false;
      _bodyText.disabled = false;
      _submitButton.disabled = false;
      _cancelButton.disabled = false;
    }
    I3.ui.get("bbComposeStatusLabel").innerHTML = "";
  }
  
  /**
   * Method: onCancel
   *
   * Called when cancel button is clicked.
   *
   * Parameters:
   *   e - the click event parameters
   */
  @method onCancel(e) {
    _subjectText.value = "";
    _bodyText.value = "";
    I3.ui.hide("bbCompose");
    I3.ui.show("bbPosts");
  }
}


// ---------------------------------------------------------------------------


/**
 * Class: BulletinBoard.IndexApplet
 *
 * The main applet for the Bulletin Board tool.  This loads the topic list
 * and calls the appropriate methods on the list and post controllers
 * based on the path.
 */
@class IndexApplet {

  // Requested path.
  var _path;

  // Array of news topic objects.
  var _topics;

  // Custom Bulletin Board controllers.
  var _listController;
  var _postController;
  var _composeController;

  // Topic menu controller.
  var _topicMenu;

  /**
   * Method: initialize
   *
   * Initializes the Bulletin Board applet.
   */
  @method initialize() {

    // Set up the menu controller.
    _topicMenu = new I3.MenuController(I3.ui.get("bbTopics"));
    _topicMenu.setTitle("Topics");

    // Set up the custom controllers.
    _listController = new BulletinBoard.ListController();
    _postController = new BulletinBoard.PostController();
    _composeController = new BulletinBoard.ComposeController();
    
    // Set up the manage subscriptions link.
    I3.ui.get("bboard-manageSubscriptionsLink").appendChild(
      I3.ui.createNavigationLink("Manage Subscriptions", "/bboard/subscriptions"));
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
    _path = path;
    if (_path && _path.length > 1) {
      I3.navbar.addToPath("Bulletin Board", { link: "/bboard/" });
      self.setupNavBar();
    } else {
      I3.navbar.addToPath("Bulletin Board");
      if (_topics) _topicMenu.selectItem("");
    }

    // Begin loading the topic list if necessary.
    if (_topics == null) {
      I3.ui.show("bbLoadingTopics");
      I3.client.getObject("/bboard/data/topic-list", self.onTopicListResponse);
    }
    else self.processPath();
  }
  
  /**
   * Method: setupNavBar
   *
   * Examines the path and constructs the Navigation Bar entries.
   */
  @method setupNavBar() {
    if (_topics && _path && _path.substr(0, 8) == "/topics/") {
      var pathElements = _path.split("/");
      var topic = _topics[pathElements[2]];
      if (topic) {
        if (pathElements[3]) I3.navbar.addToPath(
          topic.name, { link: "/bboard/topics/" + topic.permalink + "/" });
        else I3.navbar.addToPath(topic.name);
        _topicMenu.selectItem(topic.permalink);
      } else I3.navbar.addToPath("Not Found");
    }
  }
  
  /**
   * Method: onTopicListResponse
   *
   * Called when the topic list has been retrieved from the server.
   *
   * Parameters:
   *   response - an <I3.ObjectResponse> object containing the response data
   */
  @method onTopicListResponse(response) {
    I3.ui.hide("bbLoadingTopics");
    if (response.isOK()) self.loadTopics(response.getObject());
  }

  /**
   * Method: loadTopics
   *
   * Loads the array of topic objects into a hash and displays them.
   * Each topic is an object with a `name` and a `permalink`.
   *
   * Parameters:
   *   topics - the array of topic objects
   */
  @method loadTopics(topics) {

    _topics = {};
    for (var i = 0; i < topics.length; i++) {
      var topic = topics[i];
      _topicMenu.addItem(topic.name, {
                         key: topic.permalink,
                         link: "/bboard/topics/" + topic.permalink + "/" });
      _topics[topic.permalink] = topic;
    }

    // Set up the admin link if applicable.
    if (I3.user.hasPermission("administer")) {
      var linkDiv = I3.ui.get("bboard-adminLink");
      linkDiv.appendChild(
          I3.ui.createNavigationLink("Edit Topics", "/bboard/admin" ));
      I3.ui.show(linkDiv);
    }
    
    I3.ui.show("bboard-manageSubscriptionsLink");
    
    self.setupNavBar();
    self.processPath();
  }
 
  /**
   * Method: processPath
   *
   * Examines the path and calls the appropriate controller method.
   */
  @method processPath() {
    
    // Reset sections.
    I3.ui.hide("bbIntro");
    I3.ui.hide("bbLoading");
    I3.ui.hide("bbTopic");
    I3.ui.hide("bbPosts");
    I3.ui.hide("bbCompose");
    I3.ui.hide("bbSinglePost");
    
    // See if we're displaying the intro page or something that requires
    // one of the controller objects.
    if (_path && _path.substr(0, 8) == "/topics/") {
      // We need to load a controller.
      // First remove leading and trailing slashes and break up the path components.
      var path = _path.substr(1);
      if (path.substr(path.length - 1) == "/") path = path.substr(0, path.length - 1);
      var pathElements = path.split("/");
      
      // Display the topic title.
      var topicNameH = I3.ui.clear("bbTopicName");
      topicNameH.appendChild(I3.ui.text(_topics[pathElements[1]].name));
      
      // Display the topic description.
      var topicDescriptionH = I3.ui.clear("bbTopicDescription");
      topicDescriptionH.appendChild(I3.ui.text(_topics[pathElements[1]].description));
      
      // Display the "Subscribe" link
      BulletinBoard.subscriptionController.createSubscribeLink(
        _topics[pathElements[1]].name, _topics[pathElements[1]].permalink, 
        _topics[pathElements[1]].is_subscription, true);
      
      I3.ui.show("bbTopic");
      
      // Now see if we're looking for more than just a topic.
      if (pathElements.length < 3) {
        I3.ui.show("bbTopicDescription");
        // Display the list of subjects.
        I3.ui.hide("bbTopicLinkContainer");
        var composeP = I3.ui.clear("bbPostListCompose");
        composeP.appendChild(I3.ui.createActionLink(
          "Post a new message in " + _topics[pathElements[1]].name,
          pathElements[1], "Post:" + pathElements[1],
          self.onCompose));
          
        _listController.displayListForTopic(pathElements[1]);
      }
      else {
        I3.ui.hide("bbTopicDescription");
        // Create a link back to the message list for the topic.
        var topicLink = I3.ui.clear("bbTopicLink");
        topicLink.appendChild(I3.ui.createNavigationLink(
          _topics[pathElements[1]].name, "/bboard/topics/" + pathElements[1] + "/"));
          
        I3.ui.show("bbTopicLinkContainer", "inline");
        _postController.displayPost(pathElements.slice(1).join("/"));
      }
    }
    else {
      // We're displaying the intro page.
      I3.ui.show("bbIntro");
    }
  }
  
  /**
   * Method: onCompose
   *
   * Called when the "Post New Message" link is clicked.
   * 
   * Parameters:
   *   e - the click event parameters
   */
  @method onCompose(e) {
    _composeController.composeNewMessageForTopic(I3.ui.getEvent(e).getInfo());
  }
  
}
