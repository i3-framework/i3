#
# Web Service: bboard/data/messages
#
# Provides subject lists and message content, and also receives new
# posts for addition to the bulletin board.
#
# *Usage*
# (start example)
#
#   Return all subjects for the topic "star-wars":
#     GET /bboard/data/messages/star-wars
# 
#   Return subjects 100-199 for the topic "star-wars":
#     GET /bboard/data/messages/star-wars?start=100&limit=199
#
#   Return a specific message (with comments) posted on May 19, 2005:
#     GET /bboard/data/messages/star-wars/2005/05/19/episode-iii-released
#
#   Replace an existing message:
#     PUT /bboard/data/messages/star-wars/2005/05/19/episode-iii-released
#
#   Post a new message:
#     POST /bboard/data/messages/star-wars
#
#   Post a new comment on a message:
#     POST /bboard/data/messages/star-wars/2005/05/19/episode-iii-released/comments
#
# (end example)
#
# *Data Format*
# 
# A posted message object should look
# like:
# 
# (start example)
#   { "subject": "Subject line", "body": "Content of post" }
# (end example)
# 
# Comments being posted should look
# like:
#
# (start example)
#   { "body": "Content of comment" }
# (end example)
#   
# For both messages and comments, the author will be automatically assigned
# based on the account name of the currently logged-in user.
#
# Credits:
# 
#   Written by Marshall Elfstrand (marshall@vengefulcow.com).
# 
# Copyright / License:
# 
#   Copyright 2009 Mission Aviation Fellowship
# 
#   Licensed under the Apache License, Version 2.0 (the "License");
#   you may not use this file except in compliance with the License.
#   You may obtain a copy of the License at
# 
#     http://www.apache.org/licenses/LICENSE-2.0
# 
#   Unless required by applicable law or agreed to in writing, software
#   distributed under the License is distributed on an "AS IS" BASIS,
#   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#   See the License for the specific language governing permissions and
#   limitations under the License.
#
# Version:
#   $Id: messages.rb 70 2008-03-26 16:14:40Z nmellis $
#

require "bboard/data/model/bboard"              # Bulletin Board data model
require "bboard/data/include/mail"              # Mailer functions

#
# Module: BulletinBoard
#
# The module containing all Bulletin Board classes and data.
#
module BulletinBoard

  #
  # Class: BulletinBoard::MessageServlet
  # 
  # Servlet that provides access to the bulletin board message data.
  #
  class MessageServlet < I3::Servlet

    #
    # Method: on_get
    # 
    # Provides a list of subjects or individual messages, depending on
    # the given `path`.  See the file documentation for examples.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_get(path)
      
      # Make sure we have a valid topic.
      topic = find_topic(path)
      return if topic.nil?

      # See if the path matches a known format.
      case path
        when %r'^/[^/ ]+/(\d{4})/(\d{2})/(\d{2})/([^/ ]+)/comments/(\d+)$'
          # Requesting an individual comment
          comment = find_comment(topic, $1.to_i, $2.to_i, $3.to_i, $4, $5.to_i)
          return if comment.nil?
          send_comment(comment)
        when %r'^/[^/ ]+/(\d{4})/(\d{2})/(\d{2})/([^/ ]+)$'
          # Requesting an individual article.
          article = find_article(topic, $1.to_i, $2.to_i, $3.to_i, $4)
          return if article.nil?
          send_article(article)
        when %r'^/[^/ ]+/?$'
          # Requesting a list of articles for a topic.
          offset = I3.server.cgi["start"].to_i
          limit = I3.server.cgi["limit"].to_i
          send_subjects(topic, offset, limit)
        else
          # Path format is not recognized.
          send_404("The requested path could not be found.")
          log.warn "GET attempted to nonexistent path: #{path}"
          return
      end #case
        
    end #def

    #
    # Method: on_post
    # 
    # Posts a new message or comment to the bulletin board, depending on
    # the given `path`.  See the file documentation for examples.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_post(path)

      # Make sure we have a valid topic.
      topic = find_topic(path)
      return if topic.nil?

      # Retrieve the posted object and user information.
      message = I3.server.receive_object
      account = I3.server.remote_account_as(Account)
      author = account.person
      
      # See if the path matches a known format.
      error_message = ""
      case path
        when %r'^/[^/ ]+/(\d{4})/(\d{2})/(\d{2})/([^/ ]+)/comments/?$'
          # Path ends with /comments.  Add a comment to the article.
          if account.can_comment_on_topic?(topic)
            article = find_article(topic, $1.to_i, $2.to_i, $3.to_i, $4)
            return if article.nil?
            begin
              new_comment = add_comment(article, author, message)
              path += "/" unless path.ends_with?("/")
              new_uri = path + article.comments.index(new_comment).to_s
            rescue
              error_message = $!.to_s
            end
          else
            send_403("You do not have permission to comment on this topic.")
            log.warn("Unauthorized POST attempted by %s to: %s" %
              [account.to_s, path])
            return
          end #if
        when %r'^/[^/ ]+/?$'
          # Path is a topic.  Add a new article to the topic.
          if account.can_post_to_topic?(topic)
            begin
              new_article = add_article(topic, author, message)
              new_uri = '/bboard/data/messages/%s/%s/%s' % [
                topic.permalink,
                new_article.posted_at.strftime("%Y/%m/%d"),
                new_article.permalink
              ]
            rescue
              error_message = $!.to_s
            end
          else
            send_403("You do not have permission to post to this topic.")
            log.warn("Unauthorized POST attempted by %s to: %s" %
              [account.to_s, path])
            return
          end #if
        else
          # Path format is not recognized.
          send_404("The requested path could not be found.")
          log.warn "POST attempted to nonexistent path: #{path}"
          return
      end #case

      # Return an appropriate response.
      response = I3::SharedObject.new
      if error_message.empty?
        I3.server.send_header("status" => "201 Created")
        I3.server.send_object({
          :status => "Created",
          :message => "Your message was posted successfully.",
          :uri => new_uri
        })
      else
        log.error error_message
        send_500("Your message could not be posted.")
      end #if

    end #def
    
    #
    # Method: on_put
    #
    # Replaces an existing post or comment.  The remote user must be
    # either the author of the post/comment or have administrative
    # privileges for the bulletin board.
    #
    # Parameters:
    #   path - additional path data provided in the URI
    #
    def on_put(path)

      # Make sure we have a valid topic.
      topic = find_topic(path)
      return if topic.nil?

      # Retrieve the posted object and user information.
      message = I3.server.receive_object
      account = I3.server.remote_account_as(Account)
      author = account.person
      
      # See if the path matches a known format.
      error_message = ""
      case path
        when %r'^/[^/ ]+/(\d{4})/(\d{2})/(\d{2})/([^/ ]+)/comments/(\d+)$'
          # Path refers to a comment.
          comment = find_comment(topic, $1.to_i, $2.to_i, $3.to_i, $4, $5.to_i)
          return if comment.nil?
          begin
            if account.can_edit?(comment)
              revise_comment(comment, author, message)
            else
              send_403("You are not the author of this comment.")
              log.warn("Unauthorized PUT attempted by %s to: %s" %
                [account.to_s, path])
            end #if
          rescue
            error_message = $!.to_s
          end
        when %r'^/[^/ ]+/(\d{4})/(\d{2})/(\d{2})/([^/ ]+)$'
          # Path refers to an article.
          article = find_article(topic, $1.to_i, $2.to_i, $3.to_i, $4)
          return if article.nil?
          begin
            if account.can_edit?(article)
              revise_article(article, author, message)
            else
              send_403("You are not the author of this message.")
              log.warn("Unauthorized PUT attempted by %s to: %s" %
                [user.account.to_s, path])
              return
            end #if
          rescue
            error_message = $!.to_s
          end
        else
          # Path format is not recognized.
          send_404("The requested path could not be found.")
          log.warn "PUT attempted to nonexistent path: #{path}"
          return
      end #case

      # Return an appropriate response.
      response = I3::SharedObject.new
      if error_message.empty?
        I3.server.send_header("status" => "201 Created")
        I3.server.send_object({
          :status => "Created",
          :message => "Your changes were made successfully."
        })
      else
        log.error error_message
        send_500("Your changes could not be made.")
      end #if
    end

    #
    # Method: find_topic
    #
    # Checks the `path` to make sure it contains a valid topic permalink
    # and returns the topic object if it exists.
    # 
    # A `404 Not Found` error will be sent to the client if the path
    # either does not contain a topic or if the topic in the path does
    # not exist.
    # 
    # A `403 Forbidden` error will be sent to the client if the user
    # does not have permission to view the topic.
    # 
    # Parameters:
    #   path - the path data to scan for a topic permalink
    # 
    # Returns:
    #   The associated <Topic>, or `nil` if no topic was found.
    #
    def find_topic(path)

      # Check to make sure a topic was provided.
      topic_match = path.scan(%r'^/([^/ ]+)')[0]
      if topic_match.nil?
        send_404("A topic is required.")
        return nil
      end #if
      
      # See if the topic exists.
      topic = Topic.find_by_permalink(topic_match[0])
      if topic.nil?
        send_404("The requested topic could not be found.")
        return nil
      end #if

      # See if the user can access the topic.
      unless I3.server.remote_account_as(Account).can_view_topic?(topic)
        send_403("You do not have permission to access the requested topic.")
        log.warn "Unauthorized access attempt for: #{path}"
        return nil
      end #unless

      # If we got here, we have a valid topic.
      return topic

    end #def

    #
    # Method: find_article
    # 
    # Finds and returns an article object.
    #
    # A `404 Not Found` error will be sent to the client if no
    # matching article could be found.
    # 
    # Example:
    # 
    # To find an article that was posted in the "relocation" topic on
    # April 12, 2006, with the permalink "nampa-has-an-outback", you'd
    # do this:
    # 
    # (start example)
    #   topic = Topic.find_by_permalink("relocation")
    #   article = find_article(topic, 2006, 4, 12, "nampa-has-an-outback")
    # (end example)
    # 
    # Parameters:
    #   topic - the <Topic> that contains the article
    #   year - the year in which the article was posted, as an `Integer`
    #   month - the month in which the article was posted, as an `Integer`
    #   day - the day on which the article was posted, as an `Integer`
    #   permalink - the permalink for the article
    # 
    # Returns:
    #   The associated <Article> object, or `nil` if no matching
    #   article was found.
    #
    def find_article(topic, year, month, day, permalink)
      
      # See if the article exists.
      date_str = "%04d-%02d-%02d" % [year, month, day]
      article = topic.articles.find(:first, :conditions =>
        ["permalink = ? AND DATE(posted_at) = ?", permalink, date_str])
      if article.nil?
        send_404("The requested message could not be found.")
        return nil
      end #if
      
      # If we got here, we have a valid article.
      return article
      
    end #def
    
    #
    # Method: find_comment
    # 
    # Finds and returns a comment object.
    #
    # The syntax is essentially the same as <find_article>, except an
    # additional `index` parameter is supplied to find a specific comment
    # on that article.  Note that the `year`, `month`, and `day` parameters
    # refer to the article, not the comment.
    # 
    # A `404 Not Found` error will be sent to the client if the comment
    # could not be found.
    # 
    # Parameters:
    #   topic - the <Topic> that contains the article on which the
    #     comment was made
    #   year - the year in which the article was posted, as an `Integer`
    #   month - the month in which the article was posted, as an `Integer`
    #   day - the day on which the article was posted, as an `Integer`
    #   article_permalink - the permalink for the article on which the
    #     comment was made
    #   index - the index of the comment in the `comments` array of the
    #     article
    # 
    # Returns:
    #   The associated <Comment> object, or `nil` if the comment
    #   could not be found.
    #
    def find_comment(topic, year, month, day, article_permalink, index)
      
      # See if the article exists.
      article = find_article(topic, year, month, day, article_permalink)
      return nil if article.nil?
      
      # See if the comment exists.
      comment = article.comments[index]
      if comment.nil?
        send_404("The requested comment could not be found.")
        return nil
      end #if
      
      # If we got here, we have a valid comment.
      return comment

    end #def

    #
    # Method: send_article
    # 
    # Sends an individual <Article> object to the client.  Any comments
    # that have been made on the article will be included in the `comments`
    # array.
    # 
    # Parameters:
    #   article - the <Article> to send
    #
    def send_article(article)
      account = I3.server.remote_account_as(Account)
      response = I3::SharedObject.new
      response.permalink = article.permalink
      response.subject = article.subject
      response.author_name = article.author.full_name
      response.email = article.author.email
      response.posted_at = article.posted_at
      response.body = article.text
      response.can_edit = account.can_edit?(article)
      response.is_subscription = 
        account.subscriber.subscriptions.select { |s| s.article == article}.size > 0
      response.comments = article.comments.collect do |comment|
        comment_item = I3::SharedObject.new
        comment_item.author_name = comment.author.full_name
        comment_item.email = comment.author.email
        comment_item.posted_at = comment.posted_at
        comment_item.body = comment.text
        comment_item.can_edit = account.can_edit?(comment)
        comment_item
      end #collect
      I3.server.send_object(response)
    end #def
    
    #
    # Method: send_comment
    # 
    # Sends an individual <Comment> object to the client.
    # 
    # Parameters:
    #   comment - the <Comment> to send
    #
    def send_comment(comment)
      account = I3.server.remote_account_as(Account)
      response = I3::SharedObject.new
      response.author_name = comment.author.full_name
      response.email = comment.author.email
      response.posted_at = comment.posted_at
      response.body = comment.text
      response.can_edit = account.can_edit?(comment)
      I3.server.send_object(response)
    end #def
    
    #
    # Method: send_subjects
    # 
    # Sends the list of message subjects that have been posted in a topic
    # to the client.
    # 
    # The results can be paged using the `offset` and `limit` parameters.
    # For example, suppose the client were displaying 40 results to a
    # page.  The `limit` parameter for each call to `send_subjects` would
    # be `40`.  The first page would have an `offset` of `0`, the second
    # page would have an `offset` of `40`, the third an `offset` of `80`,
    # and so on.
    # 
    # Parameters:
    #   topic - the <Topic> containing the messages
    #   offset - optional; the number of items to skip
    #   limit - optional; the maximum number of items to list
    #
    def send_subjects(topic, offset, limit)

      # Set default values.
      offset = 0 if offset.nil?
      limit = 50 if limit.nil? or limit == 0

      # Build and send the response.
      response = I3::SharedObject.new
      articles = topic.articles[offset, limit]
      if articles.nil?
        response.subjects = []
      else
        response.subjects = articles.collect do |article|
          item = I3::SharedObject.new
          item.posted_at = article.posted_at
          item.subject = article.subject
          item.author_name = article.author.full_name
          item.uri = '/bboard/data/messages/%s/%s/%s' % [
            topic.permalink,
            article.posted_at.strftime("%Y/%m/%d"),
            article.permalink
          ]
          item.comment_count = article.comments.count
          item
        end #collect
      end #if
      response.start = offset
      response.limit = limit
      response.total = topic.articles.count
      I3.server.send_object(response)

    end #def
    
    #
    # Method: send_403
    # 
    # Sends a `403 Forbidden` error message to the client.
    # 
    # Parameters:
    #   message - the message to place in the error information structure
    #     sent to the client
    #
    def send_403(message)
      I3.server.send_error(
        :status => "403 Forbidden",
        :title => "Permission Denied",
        :message => message,
        :help => "Please contact the Help Desk if you believe you have " +
          "received this message in error.")
    end #def

    #
    # Method: send_404
    # 
    # Sends a `404 Not Found` error message to the client.
    # 
    # Parameters:
    #   message - the message to place in the error information structure
    #     sent to the client
    #
    def send_404(message)
      I3.server.send_error(
        :status => "404 Not Found",
        :title => "Message Not Found",
        :message => message)
    end #def
    
    #
    # Method: send_500
    #
    # Sends a `500 Internal Server Error` message to the client.
    #
    # Parameters:
    #   message - the message to place in the error information structure
    #     sent to the client
    #
    def send_500(message)
      I3.server.send_error(
        :status => "500 Internal Server Error",
        :title => "Internal Server Error",
        :message => message,
        :help => "Please contact the Help Desk.")
    end
    
    #
    # Method: add_article
    # 
    # Adds a new article to a topic.
    #
    # Parameters:
    #   topic - the <Topic> to which the article should be added
    #   author - the <I3::Person> that is posting the article
    #   message - an <I3::SharedObject> containing the message data
    #     (comprised of `subject` and `body` attributes)
    # 
    # Returns:
    #   The new <Article>.
    #
    def add_article(topic, author, message)

      # Make sure we got a valid posted object.
      if message.subject.to_s.empty?
        I3.server.send_error(
          :status => "400 Bad Request",
          :title => "Message Incomplete",
          :message => "Your message was missing a subject.",
          :help => 'Messages need to have both a "subject" and a "body".')
        return
      end #if
      if message.body.to_s.empty?
        I3.server.send_error(
          :status => "400 Bad Request",
          :title => "Message Incomplete",
          :message => "Your message was missing a body.",
          :help => 'Messages need to have both a "subject" and a "body".')
        return
      end #if

      # Come up with an appropriate permalink.
      today = Time.now.iso8601[0, 10]  # YYYY-MM-DD
      permalink_base = message.subject.to_permalink
      permalink = permalink_base
      next_index = 2
      while topic.articles.count(
          ["permalink = ? AND DATE(posted_at) = ?", permalink, today]) > 0
        permalink = permalink_base + "-" + next_index.to_s
        next_index += 1
      end #while

      # Create the article.
      article = Article.new
      article.topic = topic
      article.author = author
      article.permalink = permalink
      article.subject = message.subject
      article.text = message.body
      article.posted_at = Time.now.utc
      article.save
      
      # Create a journal entry about the article.
      journal = JournalEntry.new
      journal.article = article
      journal.person = author
      journal.recorded_at = Time.now.utc
      journal.text = 'Article was created'
      journal.save
      
      # Send out any notifications
      article.topic.subscriptions.each do |subscription|
        if subscription.subscriber.email_frequency == "every_post"
          Mailer.deliver_article_notification(
            subscription.subscriber.email, 
            article, 
            subscription.subscriber.email_format, 
            true)
        end #if
      end #each

      return article
    end #def
    
    #
    # Method: revise_article
    # 
    # Modifies an existing article.
    #
    # The `subject` and/or `body` attributes of the `message` can be
    # left as `nil` or empty strings to leave those fields as they are.
    # 
    # Parameters:
    #   article - the <Article> that is being modified
    #   person - the <I3::Person> that is modifying the article.  The
    #     `author` of the article is not changed, but a journal entry will
    #     be posted stating that this person modified it.
    #   message - an <I3::SharedObject> containing the message data
    #     (comprised of `subject` and `body` attributes)
    #
    def revise_article(article, person, message)
      
      # Modify the subject if applicable.
      unless message.subject.to_s.empty? or
             (article.subject == message.subject)
        
        # Modify the field.
        old_value = article.subject
        article.subject = message.subject
        
        # Create a journal entry about the modification.
        article.record_journal_entry(person,
          'Article subject was modified', old_value)

      end #unless

      # Modify the text if applicable.
      unless message.body.to_s.empty? or
             (article.text == message.body)
        
        # Modify the field.
        old_value = article.text
        article.text = message.body
        
        # Create a journal entry about the modification.
        article.record_journal_entry(person,
          'Article text was modified', old_value)

      end #unless
      
      # Save the updated article.
      article.save
      
    end #def
    
    #
    # Method: add_comment
    # 
    # Adds a new comment to an article.
    # 
    # Parameters:
    #   topic - the <Article> to which the comment should be added
    #   author - the <I3::Person> that is posting the comment
    #   message - an <I3::SharedObject> containing the message data
    #     (comprised of a single `body` attribute)
    #
    # Returns:
    #   The new <Comment>.
    #
    def add_comment(article, author, message)
      
      # Add the comment to the article.
      comment = Comment.new
      comment.article = article
      comment.author = author
      comment.text = message.body
      comment.posted_at = Time.now.utc
      article.comments << comment

      # Create a journal entry about the comment.
      article.record_journal_entry(author, 'Comment was added')
      
      # Send out any notifications
      article.subscriptions.each do |subscription|
        if subscription.subscriber.email_frequency == "every_post"
          Mailer.deliver_article_notification(
            subscription.subscriber.email, 
            article, 
            subscription.subscriber.email_format, 
            false)
        end #if
      end #each

      return comment
    end #def

    #
    # Method: revise_comment
    # 
    # Modifies an existing comment.
    #
    # Parameters:
    #   comment - the <Comment> that is being modified
    #   person - the <I3::Person> that is modifying the comment.  The `author`
    #     of the comment is not changed, but a journal entry will be posted
    #     stating that this person modified it.
    #   message - an <I3::SharedObject> containing the message data
    #     (comprised of a single `body` attribute)
    #
    def revise_comment(comment, person, message)
      
      # Modify the text if applicable.
      unless message.body.to_s.empty? or
             (comment.text == message.body)
        
        # Modify the field.
        old_value = comment.text
        comment.text = message.body
        comment.save
        
        # Create a journal entry about the modification.
        comment.article.record_journal_entry(person,
          'Comment text was modified', old_value)

      end #unless
      
    end #def

  end #class

end #module
