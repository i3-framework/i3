#
# Web Service: bboard/data/topic-list
# 
# Provides the list of available bulletin board topics to the web client.
# 
# Topics can be added to the list using a `POST` request.  The sent object
# must contain a `name` field for the topic, and optionally a `description`
# field.
# 
# A topic's name and description can be overwritten using a `PUT` request,
# sent to the permalink of the topic.  For example:
# 
# (start example)
#   PUT /bboard/data/topic-list/bananas-forever
# (end example)
# 
# The sent object is the same as when using a `POST` request.
# 
# A `DELETE` request can be sent to remove a topic from the list.
# This sets the `is_deleted` attribute on the topic to `true`.
# 
# A topic can be undeleted by sending a `PUT` request to the topic's
# permalink and setting the `is_deleted` attribute to `false`.  In this
# case, any other keys sent in the request are ignored, and the flag
# is simply removed from the topic.
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
#   $Id: topic-list.rb 151 2009-03-20 19:44:10Z nmellis $
#

require "bboard/data/model/bboard"              # Bulletin Board data model

#
# Bulletin Board servlet namespace
#
module BulletinBoard

  #
  # Servlet that provides access to the bulletin board topic list.
  #
  class TopicServlet < I3::Servlet

    #
    # Provides the list of topics that aren't external news feeds.
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      account = I3.server.remote_account_as(Account)
      viewable_topics = account.viewable_topics(:internal)
      topics   = []
      account.subscriber.subscriptions.each do |subscription|
        topics << subscription.topic unless subscription.topic.nil?
      end #each
      
      # Add list of Topics that are subscribed to
      I3.server.send_object(viewable_topics.collect do |topic|
        { 
          :name => topic.name, 
          :permalink => topic.permalink, 
          :description => topic.description, 
          :is_subscription => topics.include?(topic)
        }
      end)
    end #def
    
    #
    # Method: on_post
    #
    # Adds a new topic.
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_post(path)
      return unless self.user_is_administrator?
      
      # Make sure topic info has required fields.
      topic_info = I3.server.receive_object
      unless topic_info.name.to_s.size > 0
        I3.server.send_error(
          :status => "400 Bad Request",
          :title => "Topic Name Required",
          :message => "The new topic must have a name.");
        return
      end #unless
      
      # Make sure we don't already have a topic with this name.
      similar_topic =
        Topic.find(:first, :conditions => ["name LIKE ?", topic_info.name])
      unless similar_topic.nil?
        I3.server.send_error(
          :status => "409 Conflict",
          :title => "Topic Name Must Be Unique",
          :message => "The new topic's name matches an existing topic.",
          :help => "Try a different name.");
        return
      end #unless

      # Come up with a unique permalink.
      permalink_base = topic_info.name.to_permalink
      permalink = permalink_base
      next_index = 2
      while Topic.count(["permalink = ?", permalink]) > 0
        permalink = permalink_base + "-" + next_index.to_s
        next_index += 1
      end #while

      # Create the new topic.
      topic = Topic.new
      topic.name = topic_info.name
      topic.description = topic_info.description
      topic.permalink = permalink
      topic.is_external = false
      topic.is_locked = false
      topic.is_deleted = false
      topic.public_can_view = false
      topic.public_can_post = false
      topic.public_can_comment = false
      topic.save
      
      # Send response.
      I3.server.send_header("status" => "201 Created")
      I3.server.send_object({
        :status => "Created",
        :location => "/bboard/data/messages/" + permalink
      })
    end

    #
    # Method: on_put
    #
    # Replaces the data in a topic with new data.
    #
    # Parameters:
    #   path - the permalink of the topic whose data is being replaced
    #
    def on_put(path)
      return unless self.user_is_administrator?
      topic = self.find_topic(path)
      unless topic.nil?
        new_info = I3.server.receive_object
        if new_info.is_deleted.nil?
          topic.name = new_info.name if new_info.name
          topic.description = new_info.description if new_info.description
        else
          topic.is_deleted = new_info.is_deleted
        end #if
        topic.save
        I3.server.send_header("status" => "201 Created")
        I3.server.send_object({ :status => "Created" })
      end #unless
    end

    #
    # Method: on_delete
    #
    # Removes an existing topic.
    #
    # Parameters:
    #   path - the permalink of the topic being removed
    #
    def on_delete(path)
      return unless self.user_is_administrator?
      topic = self.find_topic(path)
      unless topic.nil?
        topic.is_deleted = true
        topic.save
      end #unless
      I3.server.send_object({ :status => "OK" })
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
        I3.server.send_error(
          :status => "404 Not Found",
          :title => "Topic Not Found",
          :message => "A topic must be specified.")
        return nil
      end #if
      
      # See if the topic exists.
      topic = Topic.find_by_permalink(topic_match[0])
      if topic.nil?
        I3.server.send_error(
          :status => "404 Not Found",
          :title => "Topic Not Found",
          :message => "The requested topic could not be found.")
        return nil
      end #if

      # If we got here, we have a valid topic.
      return topic

    end #def

    #
    # Method: user_is_administrator?
    #
    # Checks the current remote account's permissions and returns `true` if
    # the account has "administer" privileges for the tool.  If the account
    # does not have the necessary rights, a `403 Forbidden` message is sent
    # to the user and `false` is returned.
    #
    def user_is_administrator?
      acct = I3.server.remote_account
      unless acct.has_permission?("administer")
        I3.server.send_error(
          :status => "403 Forbidden",
          :title => "Access Denied",
          :message => "You must be a Bulletin Board administrator " +
            "to modify topics.",
          :help => "Please contact the Help Desk if you believe you have " +
            "received this message in error.")
        log.warn "Unauthorized access attempt by: #{acct}"
        return false
      end #unless
      return true
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
    def send_404
      I3.server.send_error(
        :status => "404 Not Found",
        :title => "Topic Not Found",
        :message => "The requested topic could not be found.")
    end #def

  end #class

end #module
