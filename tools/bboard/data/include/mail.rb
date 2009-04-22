#
# File: bboard/data/include/mail
#
# Provides the interface to the mailing system to send mail.
# 
# Provides subclasses of <I3::Mailer> which itself is a subclass of Ruby on 
# Rails' ActionMailer class.  Each method defined in these classes has a 
# pair of corresponding class methods "deliver_..." and "create_..." where 
# "..." is the name of the method.
# 
# Example:
# (start example)
# # Creates a TMail object
# email = Mailer.create_new_email(object, recipients)
# 
# # Delivers the email to 'recipients'
# Mailer.deliver_new_email(object, recipients)
# (end example)
#
# Each function represents a type of email response that can be sent.  
# The template files should be located under the "templates" folder under 
# "data" for each tool.  In the templates folder, there should be a folder 
# that is the name of the class (e.g. "Mailer").  Under the Mailer folder are 
# the templates that are named for each of the functions.  So the template 
# for "new_email" would be "new_email.rhtml".  You can also send multipart 
# emails by naming the template files according to what kind of part they 
# are.  So "new_email.text.plain.rhtml" would be the template for the 
# `new_email` function when sent as text/plain; "new_email.text.html.rhtml" 
# will be for the text/html part, etc.
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
#   $Id: mail.rb 70 2008-03-26 16:14:40Z nmellis $
#

require "i3-mailer"                                   # I3::Mailer
require "bboard/data/model/bboard"                    # Bulletin Board data models

#
# Module: BulletinBoard
# 
module BulletinBoard
  
  #
  # Class: BulletinBoard::Mailer
  #
  # Provides mail messages used by the Bulletin Board.
  # 
  # See Also:
  #   <I3::Mailer>
  #
  class Mailer < I3::Mailer
    set_tool_name "bboard"
    
    TOOL_SETTINGS = I3.config.tools["bboard"].settings
    
    LINK_BASE = TOOL_SETTINGS.base_url + "/#/bboard"
    UNSUBSCRIBE_LINK = LINK_BASE + "/subscriptions"
    
    #
    # Method: daily_digest
    #
    # A digest message of all posts and comments that a user has subscribed to for the day.
    # 
    # The parameter `data` should be a hash that contains the following keys:
    # 
    #   - date - the date that the digest messages cover in "YYYY-MM-DD" format
    #   - topics - an `Array` of <Topic> objects
    #   - new_articles - a `Hash` keyed on <Topic> permalinks containing arrays of <Article>s that 
    #                    were created on the date this digest is for
    #   - updated_articles - a `Hash` keyed on <Topic> permlinks containing arrays of <Article>s 
    #                        that were commented on during the date this digest is for
    #
    # Parameters:
    #   recipient - a string email address
    #   data      - a `Hash` containing the above keys
    #   format    - the format of message the recipient prefers.  
    #               Accepted values are: "html" and "plain".
    #
    def daily_digest(recipient, data, format=nil)
      from        TOOL_SETTINGS.digest_settings.from
      recipients  recipient
      subject     TOOL_SETTINGS.digest_settings.subject
      
      data[:unsubscribe_text]         = TOOL_SETTINGS.unsubscribe_text
      data[:unsubscribe_link]         = UNSUBSCRIBE_LINK
      data[:unsubscribe_instructions] = TOOL_SETTINGS.unsubscribe_instructions
      data[:permalink_base]           = LINK_BASE
      
      # Add the appropriately formatted message parts
      case format
      when "html", nil
        part :content_type => "text/plain", 
             :body => render_message("daily_digest_plain", data)
        part :content_type => "text/html", 
             :body => render_message("daily_digest_html", data)
      when "plain"
        part :content_type => "text/plain", 
             :body => render_message("daily_digest_plain", data)
      end #case
      
      @content_type = "multipart/alternative"
      
    end #daily_digest
    
    #
    # Method: article_notification
    #
    # A message that is sent out whenever a new article is posted to a topic, or a new comment is 
    # posted to an article.
    # 
    # Setting the `is_new_article` to `true` will send out the original article text.  Setting it 
    # to `false` will send out the more recent comment that was posted to the article.
    #
    # Parameters:
    #   recipient      - a string email address
    #   article        - an <Article> object
    #   format         - the format of message the recipient prefers.  
    #                    Accepted values are: "html" and "plain".
    #   is_new_article - `true` if this article is newly created; `false` otherwise; default=`true`
    #
    def article_notification(recipient, article, format=nil, is_new_article=true)
      # Get the appropriate sender for what we're sending
      sender = if is_new_article
        "#{article.author.full_name} <#{article.author.email}>"
      else
        "#{article.comments.last.author.full_name} <#{article.comments.last.author.email}>"
      end
      
      # Construct the hash that will be used by the template to construct the email
      data = { 
              :article => article, 
              :is_new_article => is_new_article, 
              :article_link => LINK_BASE + "/topics" + 
                "/#{article.topic.permalink}" + 
                "/#{article.posted_at.year}" + 
                "/#{article.posted_at.mon.to_s.rjust(2,"0")}" + 
                "/#{article.posted_at.day.to_s.rjust(2,"0")}" + 
                "/#{article.permalink}"
             }
      
      data[:unsubscribe_text]         = TOOL_SETTINGS.unsubscribe_text
      data[:unsubscribe_link]         = UNSUBSCRIBE_LINK
      data[:unsubscribe_instructions] = TOOL_SETTINGS.unsubscribe_instructions
      
      # Set the message properties
      from        sender
      recipients  recipient
      subject     "#{is_new_article ? "" : "Re: "}[#{article.topic.name}] #{article.subject}"
      
      if (TOOL_SETTINGS.notice_settings.reply_to.host rescue false)
        if TOOL_SETTINGS.notice_settings.reply_to.user
          address = TOOL_SETTINGS.notice_settings.reply_to.user
        else
          address = article.topic.permalink
        end #if
        headers ({ "Reply-To" => "#{address}@#{TOOL_SETTINGS.notice_settings.reply_to.host}"})
      end #if
      
      # Add the appropriately formatted message parts
      case format
      when "html", nil
        part :content_type => "text/plain", 
             :body => render_message("article_notification_plain", data)
        part :content_type => "text/html", 
             :body => render_message("article_notification_html", data)
      when "plain"
        part :content_type => "text/plain", 
             :body => render_message("article_notification_plain", data)
      end #case
      
      @content_type = "multipart/alternative"
      
    end #article_notification
    
  end #class Mailer

end #module BulletinBoard
