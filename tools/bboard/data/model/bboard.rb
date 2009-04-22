#
# File: bboard/data/model/bboard
#
# Defines the data models for the Bulletin Board.
# 
# Each item on the bulletin board (internal or external) is a news "article".
# Articles are part of a topic (i.e. a category), such as "For Sale" or
# "BBC World News".  Articles may also have comments assigned to them.
#
# Each bulletin board topic may have a permission list assigned to it that
# describes who can view, post to, comment on, and moderate the topic.
# Permissions can be granted to either groups or individual accounts.
# In addition to the `permissions` list, each topic has `public_can_view?`,
# `public_can_post?`, and `public_can_comment?` properties.  Permissions
# are additive; that is, if any permission field provides a `true` value,
# the account is considered to have permission.
# (start example)
# 
#   Topic#public_can_view?    Permission#can_view?    Effective Permission
#   ----------------------------------------------------------------------
#          true                      (nil)                   true
#          true                      false                   true
#          false                     true                    true
#          false                     (nil)                   false
# 
# (end example)
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
#   $Id: bboard.rb 119 2008-08-21 20:12:53Z nmellis $
#

require 'common/data/model/person'

#
# Module: BulletinBoard
#
# The module containing all Bulletin Board classes and data.
#
module BulletinBoard

  #
  # Data Model: BulletinBoard::BBRecord
  # 
  # Base class for data models that access the `bboard` database.
  # 
  class BBRecord < I3::Record
    set_db_name	I3.config.tools["bboard"].database
  end #class

  
  #
  # Data Model: BulletinBoard::Topic
  # 
  # Represents a single bulletin board topic.
  # Topics have the following properties:
  # 
  #   permalink - the URI-friendly name of the topic, to be used
  #     as an identifier in paths
  #   name - the (human-readable) name of the topic
  #   description - a description of the topic
  #   copyright - for external topics, the copyright string provided
  #     by the source
  #   is_external? - `true` if the articles in the topic come from an
  #     external source, such as an RSS feed, rather than being internal
  #     Bulletin Board posts
  #   external_uri - for external topics, the URI of the feed that
  #     provides the articles in the topic
  #   is_locked? - `true` if users are not allowed to remove the topic
  #     from their home pages
  #   public_can_view? - `true` if all users are allowed to view the
  #     topic in lists and see the articles posted to it
  #   public_can_post? - `true` if all users are allowed to post new
  #     articles to the topic
  #   public_can_comment? - `true` if all users are allowed to comment
  #     on existing articles posted to the topic
  #   articles - the list of <Article> objects that have been posted
  #     to the topic
  #   permissions - the list of <Permission> objects that have been assigned
  #     to describe who can moderate, post, and so on.
  #   permission_journal_entries - a list of <PermissionJournalEntry> objects
  #     that serve as a record of changes that have been made to the
  #     permissions for this topic
  #   is_deleted? - `true` if the topic has been marked as deleted
  #
  class Topic < BBRecord
    has_many :articles, :order => "posted_at DESC", :dependent => :destroy,
             :conditions => "is_deleted = 0"
    has_many :permissions, :dependent => :destroy
    has_many :permission_journal_entries
    has_many :subscriptions, :dependent => :destroy

    #
    # Class Method: find_all_external
    #
    # Returns the list of topics that are external (e.g. obtained
    # from RSS feeds), sorted by name.
    # 
    # Returns:
    #   The array of <Topic> objects.
    # 
    # See Also:
    #   <find_all_internal>
    #
    def self.find_all_external
      topic_records = Topic.find(:all,
        :conditions => "is_external = 1 AND is_deleted = 0",
        :order => "name")
    end

    #
    # Class Method: find_all_internal
    #
    # Returns the list of topics that are internal, sorted by name.
    # 
    # Returns:
    #   The array of <Topic> objects.
    # 
    # See Also:
    #   <find_all_external>
    #
    def self.find_all_internal
      topic_records = Topic.find(:all,
        :conditions => "is_external = 0 AND is_deleted = 0",
        :order => "name")
    end

    #
    # Method: recent_articles
    # 
    # Finds the articles in the topic that have been modified most recently.
    #
    # This looks at the journal entries and finds the articles
    # with the most recent journal recordings (which include postings,
    # revisions, and comments), sorted by the last activity date, with
    # the most recently modified articles at the top.
    #
    # Parameters:
    #   max - the maximum number of articles to return; the default is 10
    # 
    # Returns:
    #   An array of <Article> objects.
    # 
    def recent_articles(max=10)
      Article.find_recent(max, self)
    end #def

    #
    # Method: record_journal_entry
    #
    # Records a new permission journal entry for the topic, stamped
    # with the current time.
    # 
    # Parameters:
    #   account - the <Account> that is making the change to the permissions
    #   text - the text to record to the journal
    #
    def record_journal_entry(account, text)
      entry = PermissionJournalEntry.new
      entry.account = account
      entry.text = text
      entry.recorded_at = Time.now.utc
      self.permission_journal_entries << entry
    end

  end #class
  
  
  #
  # Data Model: BulletinBoard::Article
  #
  # Represents an article that belongs to a topic.
  # Articles have the following properties:
  # 
  #   topic - the <Topic> to which the article belongs
  #   author - the <I3::Person> that wrote the article
  #   author_name - the name of the author, used for external articles
  #     when there can be no associated `author` object
  #   permalink - the URI-friendly name of the article, to be used
  #     as an identifier in paths
  #   subject - the subject/title of the article, displayed in lists
  #   posted_at - the date/time at which the article was posted
  #   text - the full text of the article
  #   comments - the list of <Comment> objects that have been added
  #     to the article
  #   external_uri - the URI for the original article text, used for
  #     external articles to navigate to the full web page for the article
  #   is_deleted? - `true` if the article has been marked as deleted
  #   journal_entries - a list of <JournalEntry> objects that serves as
  #     a record of changes made to the article and/or its comments
  #   
  #
  class Article < BBRecord
    belongs_to :author, :class_name => "I3::Person", :foreign_key => "person_id"
    belongs_to :topic
    has_many :comments, :order => "posted_at", :dependent => :destroy,
             :conditions => "is_deleted = 0"
    has_many :journal_entries, :order => "recorded_at", :dependent => :destroy
    has_many :subscriptions, :dependent => :destroy

    #
    # Class Method: find_recent
    # 
    # Finds the articles that have been modified most recently.
    #
    # This looks at the journal entries and finds the articles
    # with the most recent journal recordings (which include postings,
    # revisions, and comments), sorted by the last activity date, with
    # the most recently modified articles at the top.
    # 
    # Each article will have an additional `last_activity` field that
    # provides the date/time at which the article was last modified.
    # The `last_activity` date/time for articles that have no journal
    # entries will be the same as the article's `posted_at` date/time.
    #
    # Parameters:
    #   max - the maximum number of articles to return; the default is 10
    #   topic_list - the `Array` of <Topics> to which the results should
    #     be limited (useful with <Account::viewable_topics>)
    # 
    # Returns:
    #   An array of <Article> objects.
    # 
    def self.find_recent(max=10, topic_list=nil)
      topic_list = [topic_list] if topic_list.is_a? Topic
      db = I3.config.tools["bboard"].database
      options = {
        :select => "articles.*, " +
          "IFNULL(MAX(recorded_at), posted_at) AS last_activity",
        :joins  => "LEFT JOIN #{db}.journal_entries " +
          "ON articles.id = journal_entries.article_id",
        :group  => "articles.id",
        :order  => "last_activity DESC",
        :limit  => max
      }
      if topic_list.nil?
        options[:conditions] = "articles.is_deleted = 0"
      else
        options[:conditions] = [
          "articles.is_deleted = 0 AND topic_id IN (?)",
          topic_list.collect(&:id)
        ]
      end #if
      self.find(:all, options)
    end #def
    
    #
    # Method: record_journal_entry
    #
    # Records a new journal entry for this article, stamped with
    # the current time.
    # 
    # Parameters:
    #   person - the <I3::Person> who is making the change to the article
    #   text - the text to record to the journal
    #   old_value - optional; when the journal entry is recording a change
    #     to a field, the previous value of the field
    #
    def record_journal_entry(person, text, old_value=nil)
      entry = JournalEntry.new
      entry.person = person
      entry.text = text
      entry.old_value = old_value unless old_value.nil?
      entry.recorded_at = Time.now.utc
      self.journal_entries << entry
    end
    
  end #class
  
  
  #
  # Data Model: BulletinBoard::Comment
  #
  # Represents a comment on an article.
  # Comments have the following properties:
  # 
  #   article - the <Article> to which the comment is responding
  #   person - the <I3::Person> that wrote the comment
  #   text - the text of the comment
  #   posted_at - the date/time at which the comment was made
  #   is_deleted? - `true` if the comment has been marked as deleted
  #
  class Comment < BBRecord
    belongs_to :article
    belongs_to :author, :class_name => "I3::Person", :foreign_key => "person_id"
    def topic; article.topic; end
  end #class


  #
  # Data Model: BulletinBoard::JournalEntry
  #
  # Represents a journal entry on an article.  Journal entries are recorded
  # when articles are created or modified (including changes to comments).
  # Each entry has the following properties:
  # 
  #   article - the <Article> that was affected by the change
  #   person - the <I3::Person> that made the change
  #   recorded_at - the date/time at which the journal entry was recorded
  #   text - a description of what occurred
  #   old_value - the value that existed prior to the change, in the case
  #     of modified articles/comments
  #
  class JournalEntry < BBRecord
    belongs_to :article
    belongs_to :person, :class_name => "I3::Person", :foreign_key => "person_id"
  end #class


  #
  # Data Model: BulletinBoard::Permission
  #
  # Represents an entry in the permissions table.  Permission entries have
  # the following properties:
  # 
  #   topic - the <Topic> to which the permission applies
  #   is_group? - `true` if the permission applies to a group, in which case
  #     the `group_dn` field specifies a group; otherwise this is `false` and
  #     the `account` field refers to a user account
  #   group_dn - the distinguished name of the group to which the permission
  #     applies, if it is a group permission
  #   account - the <Account> to which the permission applies, if it
  #     is not a group permission
  #   can_view? - `true` if the group or account is allowed to see the
  #     topic in lists and view articles that have been posted in the topic
  #   can_post? - `true` if the group or account is allowed to post new
  #     articles in the topic
  #   can_comment? - `true` if the group or account is allowed to comment
  #     on existing articles in the topic
  #   can_moderate? - `true` if the group or account is allowed to edit
  #     and/or delete articles and comments that have been made by others
  #   granted_by - the <Account> that granted this privilege to the
  #     group or account
  #   granted_at - the date/time at which the privilege was granted
  #
  class Permission < BBRecord
    belongs_to :topic
    belongs_to :account
    belongs_to :granted_by,
               :class_name => "Account",
               :foreign_key => "granted_by_id"
    
    # Method: is_useful?
    # Returns `true` if any of the `can_xxx` properties are `true`.
    # If all of these are `false`, the permission will always be
    # overridden, and thus serves no purpose.
    def is_useful?
      return (can_view? or can_post? or can_comment? or can_moderate?)
    end #def
    
  end #class


  #
  # Data Model: I3::PermissionJournalEntry
  #
  # Represents a journal entry for a change in permissions.  Journal entries
  # are recorded each time a permission is granted or revoked.  Permission
  # journal entries have the following properties:
  # 
  #   account - the <I3::Account> that altered the permission
  #   topic - the <Topic> for which the permission was changed
  #   text - a description of what occurred
  #   recorded_at - the date/time at which the journal entry was recorded
  #
  class PermissionJournalEntry < BBRecord
    belongs_to :account
    belongs_to :topic
  end #class


  #
  # Data Model: BulletinBoard::Account
  #
  # Extends the intranet user account model with methods for checking
  # bulletin board permissions.
  #
  class Account < I3::Account
    
    has_many :bboard_permissions, :class_name => "Permission"
    belongs_to :subscriber, :foreign_key => "person_id"

    #
    # Method: can_edit?
    # 
    # Returns `true` if the account has permission to edit the given
    # article or comment.
    # 
    # Parameters:
    #   entry - the <Article> or <Comment> for which permission
    #     is being checked
    # 
    def can_edit?(entry)
      entry.author == self.person or
        self.can_moderate_topic?(entry.topic) or
        self.has_permission?("administer")
    end #def

    #
    # Method: can_delete?
    # 
    # Returns `true` if the account has permission to delete the given
    # article or comment.
    # 
    # Parameters:
    #   entry - the <Article> or <Comment> for which permission
    #     is being checked
    # 
    def can_delete?(entry)
      self.can_edit?(entry)
    end #def
    
    #
    # Method: can_view_topic?
    # 
    # Returns `true` if the account has permission to see the given
    # topic in lists and view articles that have been posted in the topic.
    # 
    # Parameters:
    #   topic - the <Topic> for which permission is being checked
    # 
    def can_view_topic?(topic)
      has_bboard_permission?(topic, :can_view)
    end #def

    #
    # Method: can_post_to_topic?
    # 
    # Returns `true` if the account has permission to post new articles
    # in the given topic.
    # 
    # Parameters:
    #   topic - the <Topic> for which permission is being checked
    # 
    def can_post_to_topic?(topic)
      has_bboard_permission?(topic, :can_post)
    end #def

    #
    # Method: can_comment_on_topic?
    # 
    # Returns `true` if the account has permission to comment on existing
    # articles in the given topic.
    # 
    # Parameters:
    #   topic - the <Topic> for which permission is being checked
    # 
    def can_comment_on_topic?(topic)
      has_bboard_permission?(topic, :can_comment)
    end #def
    
    #
    # Method: can_moderate_topic?
    # 
    # Returns `true` if the account has permission to edit and/or delete
    # articles and comments in the given topic that have been made by others.
    # 
    # Parameters:
    #   topic - the <Topic> for which permission is being checked
    # 
    def can_moderate_topic?(topic)
      has_bboard_permission?(topic, :can_moderate)
    end #def

    #
    # Method: viewable_topics
    # 
    # Provides a list of all topics that this account has permission to view.
    # 
    # Parameters:
    #   filter - optional; limits the topics to either `:internal`
    #     or `:external`
    # 
    # Returns:
    #   An `Array` of <Topic> objects.
    # 
    def viewable_topics(filter=nil)
      case filter
        when :internal
          Topic.find_all_internal.select { |t| self.can_view_topic?(t) }
        when :external
          Topic.find_all_external.select { |t| self.can_view_topic?(t) }
        when nil
          Topic.find_all_by_is_deleted(false).select { |t| self.can_view_topic?(t) }
        else
          raise "Unknown filter for viewable_topics: #{filter}"
      end #case
    end #def
    
    private
    
    #
    # Private Method: has_bboard_permission?
    #
    # Checks to see if the account has a specific privilege for a topic.
    #
    # Example:
    #
    # (start example)
    #   # See if the current intranet user can post to the "Company News" topic.
    #   topic = BulletinBoard::Topic.find_by_permalink("company-news")
    #   account = I3.server.remote_account_as(BulletinBoard::Account)
    #   if account.has_bboard_permission?(topic, :can_post)
    #     # ...
    #   end #if
    # (end example)
    #
    # Parameters:
    #   topic - the <Topic> to which the permission belongs
    #   permission_field - the name of the permission field to check,
    #     as a `String` or `Symbol`; for example, "can_view"
    #
    # Returns:
    #   `true` if the account has the privilege, `false` otherwise.
    #
    def has_bboard_permission?(topic, permission_field)
      permission_field = permission_field.to_s  # Convert symbols

      # First see if the topic is available to the public.
      unless permission_field == "can_moderate"
        return true if topic["public_" + permission_field.to_s] == true
      end #unless
      
      # Next see if the account has specific permissions for this.
      options = {}
      options[:conditions] = [ "topic_id = ? AND #{permission_field} = ?", topic.id, true ]
      return true unless self.bboard_permissions.find(:first, options).nil?
      
      # Account check failed; see if account is in one of the groups with the
      # requested privilege.
      value = false
      conditions = [
        "topic_id = ? AND #{permission_field} = ? AND is_group = ?",
        topic.id, true, true ]
      Permission.find(:all, :conditions => conditions).each do |perm|
        value = true if self.member_of? perm.group_dn
      end #each
      return value
      
    end #def

  end #class
  
  #
  # Class: BulletinBoard::Subscriber
  #
  # Subclass of <I3::Person> that adds some preferences for email subscriptions.
  #
  class Subscriber < I3::Person
    set_table_name "i3.people"
    has_one :extension, :class_name => "SubscriberExtension"
    has_many :subscriptions, :dependent => :destroy
    has_one :account, :foreign_key => "person_id"
    
    def email_format ; self.extension.email_format rescue nil ; end
    def email_frequency ; self.extension.email_frequency rescue nil ; end

    def email_format=(str)
      if self.extension.nil?
        self.create_extension(:email_format => str)
      else
        self.extension.email_format = str
        self.extension.save
      end
    end

    def email_frequency=(str)
      if self.extension.nil?
        self.create_extension(:email_frequency => str)
      else
        self.extension.email_frequency = str
        self.extension.save
      end
    end
    
  end #class Subscriber
  
  #
  # Class: BulletinBoard::SubscriberExtension
  #
  # Extensions to the <I3::Person> class through <Subscriber>.  Adds preferences for email 
  # subscriptions.
  #
  class SubscriberExtension < BBRecord
    belongs_to :subscriber
  end #class SubscriberExtension
  
  #
  # Class: BulletinBoard::Subscription
  #
  # A user subscription to either a post or a topic.
  #
  class Subscription < BBRecord
    belongs_to :subscriber
    belongs_to :topic
    belongs_to :article
    
    def before_create
      if self.subscriber.extension.nil?
        self.subscriber.create_extension(:email_format => "html", :email_frequency => "every_post")
      end #if
      true
    end #before_create
    
  end #class Subscription

end #module
