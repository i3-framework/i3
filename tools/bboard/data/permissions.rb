#
# Web Service: bboard/data/permissions
#
# Provides an interface to the permissions that can be set on
# each Bulletin Board topic.  It responds to `GET`, `PUT`, and
# `DELETE` requests.
# 
#
# *GET Requests*
#
# If no path is provided, the entire list of all Bulletin Board topics
# and their associated permissions will be sent.  This takes the form
# of a `Hash`, where the keys of the hash are the `permalink` identifiers
# of the topics.  Each key maps to a topic object that has the following
# properties:
# 
#   name - the name of the topic
#   description - the topic's description
#   public - a `Hash` of permissions that apply to all users,
#     including `can_view`, `can_post`, and `can_comment`
#   groups - the array of permissions that have been assigned
#     to specific groups
#   users - the array of permissions that have been assigned
#     to specific users
# 
# Each object in the `groups` array has the following
# properties:
# 
#   name - the short name of the group
#   dn - the distinguished name for the group (usually an LDAP DN)
#   description - the user-friendly version of the group DN
#   can_view - `true` if members of the group can view the topic
#   can_post - `true` if members of the group can post new messages
#   can_comment - `true` if members of the group can comment on messages
#   can_moderate - `true` if members of the group can edit and/or delete
#     the messages and comments of others
# 
# The `name` and `description` are meant for display, whereas the `dn` is
# used when communicating with web services.
# 
# Each object in the `users` array has the following
# properties:
# 
#   name - the user's full name
#   account_name - the user's network account name
#   description - the user's account description
#   can_view - `true` if the user can view the topic
#   can_post - `true` if the user can post new messages
#   can_comment - `true` if the user can comment on messages
#   can_moderate - `true` if the user can edit and/or delete the messages
#     and comments of others
# 
# Navigating this object structure using JavaScript syntax would look
# like this:
# 
# (start example)
#   topics["for-sale"].name                   // "For Sale"
#   topics["for-sale"].public.can_view        // true
#   topics["for-sale"].users[0].can_moderate  // true
# (end example)
#
# Specific portions of the hierarchy can be accessed with `GET` requests
# to a more specific path:
# (start example)
# 
#   # Permissions for a single topic
#   GET /bboard/data/permissions/for-sale
# 
#   # Permissions that apply to all users of a topic
#   GET /bboard/data/permissions/for-sale/public
# 
#   # List of users with specific permissions for the topic
#   GET /bboard/data/permissions/for-sale/users
# 
#   # Permissions for a single user
#   # (note the use of the account name)
#   GET /bboard/data/permissions/for-sale/users/wloman
# 
#   # Single permission for a user
#   # (hyphens are accepted as well as underscores)
#   GET /bboard/data/permissions/for-sale/users/wloman/can-moderate
# 
# (end example)
# 
# 
# *PUT Requests*
#
# The `PUT` method is used to assign permissions, either one-by-one or
# as a set.  Single permissions are assigned as follows:
# 
# (start example)
#   PUT /bboard/data/permissions/<topic>/public/<privilege>
#   PUT /bboard/data/permissions/<topic>/groups/<DN>/<privilege>
#   PUT /bboard/data/permissions/<topic>/users/<account_name>/<privilege>
# (end example)
# 
# The first form assigns a permission that applies to all users.  The second
# form assigns a group permission, where the full distinguished name (the
# `dn` property) of the group is provided.  The third form assigns a user
# permission, where the `account_name` of the user is provided.  In all
# cases, the content of the `PUT` request should be the simple boolean value
# of `true`.  Examples:
# (start example)
# 
#   # Allow all users to post to the For Sale topic
#   PUT /bboard/data/permissions/for-sale/public/can-post
# 
#   # Only allow the people in the Elite group (DN has been truncated)
#   # to view the Cool Stuff topic
#   PUT /bboard/data/permissions/cool-stuff/groups/CN=Elite,.../can-view
# 
# (end example)
# 
# Permissions can be applied as a set by leaving the specific privilege off
# the URL when sending the `PUT` request.  In this case, an object is sent
# with the request, which should have `can_view`, `can_post`, `can_comment`,
# and `can_moderate` properties, each of which is a boolean value.
# (Note that `can_moderate` cannot be assigned to the the `public` permissions
# for a topic, and should be omitted from the object in this case.)
# (start example)
#   
#   # Assign set of permissions to a specific user
#   PUT /bboard/data/permissions/for-sale/users/wloman
# 
#   # Content of PUT request in JSON format
#   { can_view: true,
#     can_post: true,
#     can_comment: true,
#     can_moderate: false }
# 
# (end example)
#
# Permissions that are omitted or have a value of `null` will be ignored
# and will not result in any change being made.
# 
# 
# *DELETE Requests*
#
# The `DELETE` method is used to revoke permissions.  Like the `PUT` method,
# it can revoke permissions individually or as a whole.  The URL format is
# the same as the `PUT` method, but no content should be sent in the request
# body.  Examples:
# (start example)
# 
#   # Remove a single permission from the public
#   DELETE /bboard/data/permissions/for-sale/public/can-post
# 
#   # Remove all permissions for a user
#   DELETE /bboard/data/permissions/for-sale/users/wloman
# 
# (end example)
# 
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
#   $Id: permissions.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "bboard/data/model/bboard"            # Bulletin Board data model
require "ldap"                                # For formatting LDAP paths

#
# Module: BulletinBoard
#
# The module containing all Bulletin Board classes and data.
#
module BulletinBoard

  #
  # Class: BulletinBoard::PermissionServlet
  # 
  # Servlet that provides access to the bulletin board permission data.
  #
  class PermissionServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Builds the set of data requested by the client (based on the `path`)
    # and sends it.  A `404 Not Found` error will be sent if the specified
    # topic, user, group, or permission path component does not exist.
    #
    # Parameters:
    #   path - the "/topic/..." specification to get a subset of the
    #     permission data for a single topic, or an empty string if the
    #     full list of permissions is desired
    #
    def on_get(path)
      return unless self.user_is_administrator?
      response = PermissionResponseBuilder.response_for_path(path)
      if response.nil?
        I3.server.send_error(
          :status => "404 Not Found",
          :title => "Permission Not Found",
          :message => "The specified object could not be found.")
      else
        I3.server.send_object(response)
      end #if
    end #def
    
    #
    # Method: on_put
    #
    # Stores a permission for a topic.  If the permission assignment is
    # successful, an object will be sent with a `status` property of "OK".
    #
    # A `PermissionRequestHandler` is used to actually carry out the
    # permission assignment.  The handler provides a subclass that
    # can carry out a `PUT` request for a specific kind of permission
    # assignment (public, group, or user).  If the handler fails, it
    # will send its own error to the client.
    # 
    def on_put(path)
      return unless self.user_is_administrator?
      handler = PermissionRequestHandler.from_path(path)
      unless handler.nil?
        if handler.handle_put
          I3.server.send_header("status" => "201 Created")
          I3.server.send_object({ :status => "Created" })
        end #if
      end #unless
    end #def
    
    #
    # Method: on_delete
    #
    # Removes a permission from a topic.  If the permission removal is
    # successful, an object will be sent with a `status` property of "OK".
    #
    # A `PermissionRequestHandler` is used to actually carry out the
    # permission removal.  The handler provides a subclass that
    # can carry out a `DELETE` request for a specific kind of permission
    # assignment (public, group, or user).  If the handler fails, it
    # will send its own error to the client.
    #
    def on_delete(path)
      return unless self.user_is_administrator?
      handler = PermissionRequestHandler.from_path(path)
      unless handler.nil?
        if handler.handle_delete
          I3.server.send_object({ :status => "OK" })
        end #if
      end #unless
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
            "to access this service.",
          :help => "Please contact the Help Desk if you believe you have " +
            "received this message in error.")
        log.warn "Unauthorized access attempt by: #{acct}"
        return false
      end #unless
      return true
    end #def

  end #class


  # --------------------------------------------------------------------------


  #
  # Class: BulletinBoard::PermissonResponseBuilder
  #
  # Parses the path provided to the servlet and creates the response
  # object specified by the path.
  #
  class PermissionResponseBuilder
    
    #
    # Class Method: response_for_path
    # 
    # Examines the `path` and uses it to build a response object that can
    # be sent back to the client.  This is used by the `on_get` method.
    #
    # Parameters:
    #   path - the extra path information provided to the web service
    #
    # Returns:
    #   An object that can be sent to the client, or `nil` if the path
    #   did not specify a valid object.
    #
    def self.response_for_path(path)

      # Remove slashes from beginning and end of path
      path = path[1..-1] if path.starts_with? "/"
      path = path[0..-2] if path.ends_with? "/"
      
      # Select path format from supported options
      response = case path
        when ''
          build_all_topics
        when %r'^([^/]+)$'
          build_topic($1)
        when %r'^([^/]+)/public$'
          build_public_permissions($1)
        when %r'^([^/]+)/public/([^/]+)$'
          build_public_permissions($1)[$2.gsub("-", "_").to_sym]
        when %r'^([^/]+)/groups$'
          build_all_groups($1)
        when %r'^([^/]+)/groups/([^/]+)$'
          build_group($1, $2)
        when %r'^([^/]+)/groups/([^/]+)/([^/]+)$'
          build_group($1, $2)[$3.gsub("-", "_").to_sym]
        when %r'^([^/]+)/users$'
          build_all_users($1)
        when %r'^([^/]+)/users/([^/]+)$'
          build_user($1, $2)
        when %r'^([^/]+)/users/([^/]+)/([^/]+)$'
          build_user($1, $2)[$3.gsub("-", "_").to_sym]
        else
          nil
      end #case
      
      return response
    end #def

    #
    # Class Method: build_all_topics
    # 
    # Builds a `Hash` of all topics and their associated permisisons,
    # indexed by each topic's permalink.
    # 
    def self.build_all_topics
      response = {}
      Topic.find_all_by_is_external(false).each do |topic|
        response[topic.permalink] = build_topic(topic)
      end #each
      return response
    end
    
    #
    # Class Method: build_topic
    # 
    # Builds a `Hash` of a single topic.
    # 
    # Parameters:
    #   topic - a <Topic> object or the `permalink` string for a topic
    # 
    def self.build_topic(topic)
      topic = Topic.find_by_permalink(topic.to_s) unless topic.is_a? Topic
      response = {
        :name => topic.name,
        :description => topic.description,
        :public => build_public_permissions(topic),
        :groups => build_all_groups(topic),
        :users  => build_all_users(topic),
        :is_deleted => topic.is_deleted?
      }
      return response
    end #def

    #
    # Class Method: build_public_permissions
    # 
    # Builds the `Hash` of permissions that apply to all users for a topic.
    # 
    # Parameters:
    #   topic - a <Topic> object or the `permalink` string for a topic
    # 
    def self.build_public_permissions(topic)
      topic = Topic.find_by_permalink(topic.to_s) unless topic.is_a? Topic
      response = {
        :can_view    => topic.public_can_view?,
        :can_post    => topic.public_can_post?,
        :can_comment => topic.public_can_comment?
      }
      return response
    end #def

    #
    # Class Method: build_all_groups
    # 
    # Builds the `Array` of groups that have specific permissions assigned
    # to them for a topic.
    # 
    # Parameters:
    #   topic - a <Topic> object or the `permalink` string for a topic
    # 
    def self.build_all_groups(topic)
      topic = Topic.find_by_permalink(topic.to_s) unless topic.is_a? Topic
      return topic.permissions.find_all_by_is_group(true).to_a.collect do |perm|
        build_group(topic, perm)
      end #collect
    end #def
    
    #
    # Class Method: build_group
    # 
    # Builds the `Hash` for a single group and its permissions for a topic.
    # 
    # Parameters:
    #   topic - a <Topic> object or the `permalink` string for a topic
    #   group_perm_or_dn - a <Permission> object that references a group,
    #     or a group DN string that is known to have permissions associated
    #     with the given `topic`
    # 
    def self.build_group(topic, group_perm_or_dn)
      topic = Topic.find_by_permalink(topic.to_s) unless topic.is_a? Topic
      if group_perm_or_dn.is_a? Permission
        perm = group_perm_or_dn
      else
        perm = topic.permissions.find_by_group_dn(group_perm_or_dn.to_s)
      end #unless
      dn = perm.group_dn
      dn_components = dn.split(",")
      if dn_components.size > 1
        # LDAP-style path
        name = dn_components[0].split("=")[1]
        description = LDAP.dn2ufn(dn_components[1..-1].join(","))
      else
        # Simple group name
        name = dn_components[0].capitalize
        description = ""
      end #if
      return {
        :name => name,
        :description => description,
        :dn => dn,
        :can_view => perm.can_view?,
        :can_post => perm.can_post?,
        :can_comment => perm.can_comment?,
        :can_moderate => perm.can_moderate?
      }
    end #def
    
    #
    # Class Method: build_all_users
    # 
    # Builds the `Array` of users that have specific permissions assigned
    # to them for a topic.
    # 
    # Parameters:
    #   topic - a <Topic> object or the `permalink` string for a topic
    # 
    def self.build_all_users(topic)
      topic = Topic.find_by_permalink(topic.to_s) unless topic.is_a? Topic
      return topic.permissions.find_all_by_is_group(false).to_a.collect do |perm|
        build_user(topic, perm)
      end #collect
    end #def
    
    #
    # Class Method: build_user
    # 
    # Builds the `Hash` for a single user and its permissions for a topic.
    # 
    # Parameters:
    #   topic - a <Topic> object or the `permalink` string for a topic
    #   user_perm_or_name - a <Permission> object that references an
    #     <I3::Account>, or a user account name that is known to have
    #     permissions associated with the given `topic`
    # 
    def self.build_user(topic, user_perm_or_name)
      topic = Topic.find_by_permalink(topic.to_s) unless topic.is_a? Topic
      if user_perm_or_name.is_a? Permission
        perm = user_perm_or_name
      else
        account = Account.find_or_create(user_perm_or_name.to_s)
        return nil if account.nil?
        perm = topic.permissions.find_by_account_id(account.id)
      end #unless
      return {
        :name => perm.account.person.full_name,
        :account_name => perm.account.account_name,
        :description => perm.account.person.description.to_s,
        :can_view => perm.can_view?,
        :can_post => perm.can_post?,
        :can_comment => perm.can_comment?,
        :can_moderate => perm.can_moderate?
      }
    end #def
    
  end #class


  # --------------------------------------------------------------------------


  #
  # Class: BulletinBoard::PermissionRequestHandler
  #
  # Parses the path provided to the servlet and creates a permission
  # request object that is capable of carrying out the requested action.
  #
  class PermissionRequestHandler
    include I3::LoggingSupport

    # Property: topic
    # The <Topic> object for which permissions are being set.  Read-only.
    attr_reader :topic
    
    # Property: identifier
    # The identifier string for the object whose permissions are being
    # granted or revoked, e.g. the account name for a user, or the DN
    # for a group.  Read-only.
    attr_reader :identifier
    
    # Property: privilege
    # The symbol of the privilege being granted or revoked, e.g. `:can_post`.
    # This is `nil` for requests that are modifying a set of permissions
    # at once.  Read-only.
    attr_reader :privilege

    #
    # Class Method: from_path
    #
    # Examines the `path` and returns a subclass of `PermissionRequestHandler`
    # that carries out actions for either groups or users.  This is used by
    # the `on_put` and `on_delete` methods to obtain an object that
    # can carry out an operation (e.g. `handle_put`) in a group-specific
    # or user-specific way.
    #
    # Parameters:
    #   path - the extra path information provided to the web service
    #
    # Returns:
    #   A subclass of <Admin::PermissionRequestHandler> that is capable
    #   of carrying out `PUT` and `DELETE` requests for either users or
    #   groups.
    #
    def self.from_path(path)

      # Remove slashes from beginning and end of path
      path = path[1..-1] if path.starts_with? "/"
      path = path[0..-2] if path.ends_with? "/"

      # Parse the path and instantiate the appropriate handler.
      handler = case path
        when %r'^([^/]+)/(public)$'
          PublicPermissionRequestHandler.new($1, $2)
        when %r'^([^/]+)/(public)/([^/]+)$'
          PublicPermissionRequestHandler.new($1, $2, $3)
        when %r'^([^/]+)/groups/([^/]+)$'
          GroupPermissionRequestHandler.new($1, $2)
        when %r'^([^/]+)/groups/([^/]+)/([^/]+)$'
          GroupPermissionRequestHandler.new($1, $2, $3)
        when %r'^([^/]+)/users/([^/]+)$'
          UserPermissionRequestHandler.new($1, $2)
        when %r'^([^/]+)/users/([^/]+)/([^/]+)$'
          UserPermissionRequestHandler.new($1, $2, $3)
        else
          nil
      end #case

      # Send an error if the path could not be parsed.
      if handler.nil? or handler.topic.nil?
        I3.server.send_error(
          :status => "404 Not Found",
          :title => "Permission Not Found",
          :message => "The specified object could not be found.")
        return nil
      end #if
      
      return handler
    end #def
    
    #
    # Method: initialize
    #
    # Initializes an instance of the request handler.
    #
    # Parameters:
    #   topic - the `permalink` string of the <Topic> whose permissions
    #     are being modified
    #   identifier - a string that identifies the user or group that is
    #     receiving the privilege; interpreted differently by each subclass
    #   privilege - the name of the privilege that is being granted or
    #     revoked; this may be `nil` in cases where a set of permissions is
    #     being updated at once
    #
    def initialize(topic, identifier, privilege=nil)
      @topic = Topic.find_by_permalink(topic)
      @identifier = identifier
      @privilege = privilege.gsub("-", "_").to_sym unless privilege.nil?
    end #def
    
    #
    # Method: handle_put
    #
    # Carries out a `PUT` request.  Must be overridden by the subclass.
    #
    def handle_put
      log.error 'The handle_put method must be overridden by a subclass.'
      return nil
    end
      
    #
    # Method: handle_delete
    #
    # Carries out a `DELETE` request.  Must be overridden by the subclass.
    #
    def handle_delete
      log.error 'The handle_delete method must be overridden by a subclass.'
      return nil
    end

    #
    # Method: receive_permission_set
    # 
    # Returns a `Hash` of permissions.  If `privilege` is specified,
    # all entries in the `Hash` will map to `nil` except the specified
    # privilege, which will be set to the value sent by the client
    # (either `true` or `false`).  If the `privilege` is `nil`, it is
    # assumed that the client sent an object containing multiple permissions,
    # and these will be extracted.
    # 
    # This method is used when handling `PUT` requests to obtain the
    # set of data that needs to be changed.
    # 
    # Parameters:
    #   valid_set - the `Array` of permission `Symbols` that the client is
    #     allowed to specify; anything outside this set results in an error
    #     being sent to the client
    # 
    # Returns:
    #   A `Hash` containing `can_view`, `can_post`, `can_comment`, and
    #   `can_moderate` properties, each of which maps to a boolean.
    # 
    def receive_permission_set(valid_set)
      obj = I3.server.receive_object
      if self.privilege.nil?
        # Request is sending a set of permissions
        set = obj.to_hash.symbolize_keys
      else
        # Request is altering a single permission
        value = true unless obj == false
        set = { self.privilege => value }
      end #if
      is_valid = true
      set.keys.each { |key| is_valid = false unless valid_set.include? key }
      unless is_valid
        self.send_404
        return nil
      end #unless
      return set
    end #def

    #
    # Method: send_404
    # 
    # Sends an error message to the client stating that the requested
    # permission could not be found.
    # 
    def send_404
      I3.server.send_error(
        :status => "404 Not Found",
        :title => "Permission Not Found",
        :message => "The specified object could not be found.")
    end #def
    
  end #def


  #
  # Class: BulletinBoard::PublicPermissionRequestHandler
  #
  # Carries out `PUT` and `DELETE` requests on public permissions.
  #
  class PublicPermissionRequestHandler < PermissionRequestHandler

    # Constant: GRANT_FORMAT
    # Format string for journal entries about granted permissions.
    GRANT_FORMAT = 'Privilege "%s" granted for public.'

    # Constant: REVOKE_FORMAT
    # Format string for journal entries about revoked permissions.
    REVOKE_FORMAT = 'Privilege "%s" revoked for public.'

    # Constant: PERMISSION_MAP
    # Maps the "public" permissions as presented by the web service
    # (e.g. `:can_view`) to the permission fields used by the topic
    # object (e.g. `:public_can_view`).
    PERMISSION_MAP = {
      :can_view    => :public_can_view,
      :can_post    => :public_can_post,
      :can_comment => :public_can_comment
    }

    # Constant: VALID_PERMISSIONS
    # Permissions that can be specified.  Anything outside this
    # set results in an error being sent to the client.
    VALID_PERMISSIONS = PERMISSION_MAP.keys
    
    # Method: handle_put
    # Carries out a `PUT` request.
    def handle_put
      # Check sent permisisons.
      new_perms = self.receive_permission_set(VALID_PERMISSIONS)
      return false if new_perms.nil?
      topic_has_changed = false
      PERMISSION_MAP.each do |perm_name, perm_field|
        unless new_perms[perm_name].nil? or
               new_perms[perm_name] == self.topic[perm_field]
          self.topic[perm_field] = new_perms[perm_name]
          topic_has_changed = true
          format = new_perms[perm_name] ? GRANT_FORMAT : REVOKE_FORMAT
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            format % perm_name.to_s)
        end #unless
      end #each
      self.topic.save if topic_has_changed
      return true
    end #def
    
    # Method: handle_delete
    # Carries out a `DELETE` request.
    def handle_delete
      if self.privilege.nil?
        # Remove all public permissions for the topic.
        PERMISSION_MAP.each do |perm_name, perm_field|
          self.topic[perm_field] = false
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            REVOKE_FORMAT % perm_name.to_s)
        end #each
      else
        # Remove a single public permission.
        if VALID_PERMISSIONS.include? self.privilege
          self.topic[PERMISSION_MAP[self.privilege]] = false
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            REVOKE_FORMAT % self.privilege.to_s)
        else
          self.send_404
          return false
        end #if
      end #if
      self.topic.save
      return true
    end #def

  end #class
  

  #
  # Class: BulletinBoard::GroupPermissionRequestHandler
  #
  # Carries out `PUT` and `DELETE` requests on group permissions.
  #
  class GroupPermissionRequestHandler < PermissionRequestHandler

    # Constant: GRANT_FORMAT
    # Format string for journal entries about granted permissions.
    GRANT_FORMAT = 'Privilege "%s" granted for group "%s".'

    # Constant: REVOKE_FORMAT
    # Format string for journal entries about revoked permissions.
    REVOKE_FORMAT = 'Privilege "%s" revoked for group "%s".'

    # Constant: VALID_PERMISSIONS
    # Permissions that can be specified.  Anything outside this
    # set results in an error being sent to the client.
    VALID_PERMISSIONS = [ :can_view, :can_post, :can_comment, :can_moderate ]
    
    # Method: handle_put
    # Carries out a `PUT` request.
    def handle_put

      # Check sent permisisons.
      new_perms = self.receive_permission_set(VALID_PERMISSIONS)
      return false if new_perms.nil?
      
      # See if we have an existing group permission for this topic.
      perm = topic.permissions.find(:first, :conditions => [
        "is_group = ? AND group_dn = ?", true, self.identifier ])
      if perm.nil?
        # Create the new permission record.
        perm = Permission.new
        perm.is_group = true
        perm.group_dn = self.identifier
        perm.granted_by = I3.server.remote_account_as(Account)
        perm.granted_at = Time.now.utc
        self.topic.permissions << perm
      end #if
      
      # Go through the permission set and make any changes.
      perm_has_changed = false
      VALID_PERMISSIONS.each do |privilege|
        unless new_perms[privilege].nil? or
               new_perms[privilege] == perm[privilege]
          perm[privilege] = new_perms[privilege]
          perm_has_changed = true
          format = new_perms[privilege] ? GRANT_FORMAT : REVOKE_FORMAT
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            format % [privilege.to_s, perm.group_dn])
        end #unless
      end #each
      if perm_has_changed
        perm.granted_by = I3.server.remote_account_as(Account)
        perm.granted_at = Time.now.utc
        perm.save
      end #if
      
      # Remove the permission if all fields are false.
      self.topic.permissions.delete perm unless perm.is_useful?
      
      return true
    end #def
    
    # Method: handle_put
    # Carries out a `DELETE` request.
    def handle_delete
      
      # See if the permission exists.  If it doesn't, the permission
      # is already considered to be deleted, so we have nothing to do.
      perm = topic.permissions.find(:first, :conditions => [
        "is_group = ? AND group_dn  = ?", true, self.identifier ])
      return true if perm.nil?
      
      if self.privilege.nil?
        # Remove the entire permission entry for this group.
        self.topic.permissions.delete perm unless perm.nil?
      else
        # Remove a single group permission.
        if VALID_PERMISSIONS.include? self.privilege
          perm[self.privilege] = false
          perm.granted_by = I3.server.remote_account_as(Account)
          perm.granted_at = Time.now.utc
          perm.save
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            REVOKE_FORMAT % [self.privilege.to_s, perm.group_dn])
          # Remove the permission if all fields are false.
          self.topic.permissions.delete perm unless perm.is_useful?
        else
          self.send_404
          return false
        end #if
      end #if
      
      return true
    end #def

  end #class


  #
  # Class: BulletinBoard::UserPermissionRequestHandler
  #
  # Carries out `PUT` and `DELETE` requests on user permissions.
  #
  class UserPermissionRequestHandler < PermissionRequestHandler

    # Constant: GRANT_FORMAT
    # Format string for journal entries about granted permissions.
    GRANT_FORMAT = 'Privilege "%s" granted for user %d (%s).'

    # Constant: REVOKE_FORMAT
    # Format string for journal entries about revoked permissions.
    REVOKE_FORMAT = 'Privilege "%s" revoked for user %d (%s).'

    # Constant: VALID_PERMISSIONS
    # Permissions that can be specified.  Anything outside this
    # set results in an error being sent to the client.
    VALID_PERMISSIONS = [ :can_view, :can_post, :can_comment, :can_moderate ]
    
    # Method: handle_put
    # Carries out a `PUT` request.
    def handle_put

      # Check sent permisisons.
      new_perms = self.receive_permission_set(VALID_PERMISSIONS)
      return false if new_perms.nil?
      
      # Make sure the account exists.
      acct = Account.find_or_create(self.identifier)
      if acct.nil?
        self.send_missing_account_error
        return false
      end #if
      
      # See if we have an existing account permission for this topic.
      perm = topic.permissions.find(:first, :conditions => [
        "is_group = ? AND account_id  = ?", false, acct.id ])
      if perm.nil?
        # Create the new permission record.
        perm = Permission.new
        perm.is_group = false
        perm.account = acct
        perm.granted_by = I3.server.remote_account_as(Account)
        perm.granted_at = Time.now.utc
        self.topic.permissions << perm
      end #if
      
      # Go through the permission set and make any changes.
      perm_has_changed = false
      VALID_PERMISSIONS.each do |privilege|
        unless new_perms[privilege].nil? or
               new_perms[privilege] == perm[privilege]
          perm[privilege] = new_perms[privilege]
          perm_has_changed = true
          format = new_perms[privilege] ? GRANT_FORMAT : REVOKE_FORMAT
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            format % [privilege.to_s, acct.id, acct.account_name])
        end #unless
      end #each
      if perm_has_changed
        perm.granted_by = I3.server.remote_account_as(Account)
        perm.granted_at = Time.now.utc
        perm.save
      end #if
      
      # Remove the permission if all fields are false.
      self.topic.permissions.delete perm unless perm.is_useful?
      
      return true
    end #def
    
    # Method: handle_put
    # Carries out a `DELETE` request.
    def handle_delete

      # Make sure the account exists.
      acct = Account.find_or_create(self.identifier)
      if acct.nil?
        self.send_missing_account_error
        return false
      end #if
      
      # See if the permission exists.  If it doesn't, the permission
      # is already considered to be deleted, so we have nothing to do.
      perm = topic.permissions.find(:first, :conditions => [
        "is_group = ? AND account_id  = ?", false, acct.id ])
      return true if perm.nil?
      
      if self.privilege.nil?
        # Remove the entire permission entry for this group.
        self.topic.permissions.delete perm unless perm.nil?
      else
        # Remove a single group permission.
        if VALID_PERMISSIONS.include? self.privilege
          perm[self.privilege] = false
          perm.granted_by = I3.server.remote_account_as(Account)
          perm.granted_at = Time.now.utc
          perm.save
          self.topic.record_journal_entry(
            I3.server.remote_account_as(Account),
            REVOKE_FORMAT % [self.privilege.to_s, acct.id, acct.account_name])
          # Remove the permission if all fields are false.
          self.topic.permissions.delete perm unless perm.is_useful?
        else
          self.send_404
          return false
        end #if
      end #if
      
      return true
    end #def
    
    #
    # Method: send_missing_account_error
    # 
    # Sends an error message to the client stating that the requested
    # account could not be found.
    # 
    def send_missing_account_error
      I3.server.send_error(
        :status => "404 Not Found",
        :title => "Account Not Found",
        :message => "The specified account name could not be found.")
    end #def
    
  end #class
  
end #module
