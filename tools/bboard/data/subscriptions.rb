#
# Web Service: bboard/data/subscriptions
# 
# Provides the list of current subscriptions for the current user.
# 
# Credits:
# 
#   Written by Nathan Mellis (nathan@mellis.us).
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
#   $Id: subscriptions.rb 70 2008-03-26 16:14:40Z nmellis $
#

require "bboard/data/model/bboard"              # Bulletin Board data model

#
# Bulletin Board servlet namespace
#
module BulletinBoard

  #
  # Servlet that provides access to the user's email subscriptions.
  #
  class SubscriptionsServlet < I3::Servlet
    
    #
    # Method: on_get
    #
    # Description of method
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_get(path)
      response = I3::SharedObject.new
      account = I3.server.remote_account_as(Account)
      subscriber = account.subscriber
      
      viewable_topics = account.viewable_topics(:internal)
      topics   = []
      articles = []
      subscriber.subscriptions.each do |subscription|
        topics   << subscription.topic unless subscription.topic.nil?
        articles << subscription.article unless subscription.article.nil?
      end #each
      
      # Add list of Topics that are subscribed to
      response.topics = viewable_topics.collect do |topic|
        { 
          :name => topic.name, 
          :permalink => topic.permalink, 
          :is_subscription => topics.include?(topic)
        }
      end #collect
      
      # Add list of Posts that are subscribed to
      response.posts = (articles.collect do |article|
        {
          :name => article.subject, 
          :topic => article.topic.name, 
          :permalink => article.permalink, 
          :is_subscription => true
        } if viewable_topics.include?(article.topic)
      end).compact
      
      # Add user preferences
      response.preferences = {
        :subscription_format    => subscriber.email_format, 
        :subscription_frequency => subscriber.email_frequency
      }
      
      I3.server.send_object response
    end #on_get
    
    #
    # Method: on_put
    #
    # Handles the HTTP `PUT` method.  Used for updating one's subscription preferences at once.
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_put(path)
      data = I3.server.receive_object
      subscriber = I3.server.remote_account_as(Account).subscriber
      
      begin
        subscriptions = []
        data.topics.to_a.each do |topic|
          subscriptions << Subscription.new(:topic => Topic.find_by_permalink(topic))
        end #each
      
        data.articles.to_a.each do |article|
          subscriptions << Subscription.new(:article => Article.find_by_permalink(article))
        end #each
      
        subscriber.email_format = data.preferences.subscription_format
        subscriber.email_frequency = data.preferences.subscription_frequency
        subscriber.subscriptions = subscriptions
        
        I3.server.send_object(true)
      
      rescue
        I3.server.send_error I3::ServerException.new($!)
      end #begin
      
    end #on_put
    
    #
    # Method: on_post
    #
    # Description of method
    #
    # Parameters:
    #   path - additional path data provided in the URI; ignored
    #
    def on_post(path)
      path = path[1..-1] if path.starts_with? "/"
      permalink = I3.server.receive_object
      subscriber = I3.server.remote_account_as(Account).subscriber
      subscriptions = subscriber.subscriptions
      
      case path
      when "topics"
        topic = Topic.find_by_permalink(permalink)
        if topic.nil?
          I3.server.send_error(I3::NotFoundException(:message => "Could not find that topic."))
          return
        end #if
        unless subscriptions.select { |s| s.topic == topic }.size > 0
          subscriber.subscriptions.create(:topic => topic)
        end #unless
      when "articles"
        article = Article.find_by_permalink(permalink)
        if article.nil?
          I3.server.send_error(I3::NotFoundException(:message => "Could not find that post."))
          return
        end #if
        unless subscriptions.select { |s| s.article == article }.size > 0
          subscriber.subscriptions.create(:article => article)
        end #unless
      else
        I3.server.send_error I3::NotFoundException.new(
          :message => "'#{path}' is not recognized as a valid subscription type.")
        return
      end #case
      
      I3.server.send_object(true)
    end #on_post
    
    #
    # Method: on_delete
    #
    # Description of method
    #
    # Parameters:
    #   path - description
    #
    def on_delete(path)
      path = path[1..-1] if path.starts_with? "/"
      path = path.split("/")
      subscriber = I3.server.remote_account_as(Account).subscriber
      
      case path[0]
      when "topics"
        topic = Topic.find_by_permalink(path[1])
        if topic.nil?
          I3.server.send_error(I3::NotFoundException(:message => "Could not find that topic."))
          return
        end #if
        subscriber.subscriptions = subscriber.subscriptions.reject { |s| s.topic == topic }
      when "articles"
        article = Article.find_by_permalink(path[1])
        if article.nil?
          I3.server.send_error(I3::NotFoundException(:message => "Could not find that article."))
          return
        end #if
        subscriber.subscriptions = subscriber.subscriptions.reject { |s| s.article == article }
      else
        I3.server.send_error I3::NotFoundException.new(
          :message => "Could not delete that subscription.")
        return
      end #case
      
      I3.server.send_object(true)
    end #on_delete
    
  end #class SubscriptionsServlet
  
end #module BulletinBoard
