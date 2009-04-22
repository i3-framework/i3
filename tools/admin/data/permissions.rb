#
# Web Service: admin/data/permissions
#
# Provides an interface to the permission data managed by the Intranet
# Admin tool.  It responds to `GET`, `PUT`, and `DELETE` requests.
#
# *GET Requests*
#
# If no path is provided, the entire list of tools and the possible
# privileges for them will be sent.  This takes the form of a `Hash`,
# where the keys of the hash are the short names of the tools.  The
# keys map to objects, with each object having a `description` property
# (the more human-readable name of the tool) and a `permissions` array.
# Each item in the `permissions` array is an object with the following
# properties:
#
#   privilege - the privilege name, e.g. "access-tool"
#   description - a brief description of what the privilege allows
#   declared - `true` if the privilege has been declared in the tool's
#     `info.yml` file; `false` if it was found in the permissions
#     database but has no other information
#
# Navigating this object structure using JavaScript syntax would look like
# this:
#
# (start example)
#   tools["admin"].description                 // "Intranet Admin"
#   tools["admin"].permissions[0].privilege    // "access-tool"
# (end example)
#
# If a path is given, the list of users/groups that have the specified
# privilege is sent.  The path must be in "/tool-name/privilege-name"
# format (e.g. "/admin/access-tool").  A `Hash` will be sent containing two
# arrays, one with the key "groups" and one with the key "users".
# Each object in the "groups" array will have the following properties:
#
#   name - the short name of the group
#   dn - the distinguished name for the group (usually an LDAP DN)
#   description - the user-friendly version of the group DN
#
# The `name` and `description` are meant for display, whereas the `dn` is
# used when communicating with web services.
#
# Each object in the "users" array will have the following
# properties:
#
#   name - the user's full name
#   account_name - the user's network account name
#   description  - the user's account description
#
# *PUT Requests*
#
# The `PUT` method is used to assign a privilege to a group or a user.
# The path in this case takes one of two forms:
#
# (start example)
#   /admin/data/permissions/<toolname>/<privilege>/groups/<DN>
#   /admin/data/permissions/<toolname>/<privilege>/users/<account_name>
# (end example)
#
# The first form assigns a group privilege, where the full distinguished
# name (the `dn` property) of the group is provided.  The second form assigns
# a user privilege, where the `account_name` of the user is provided.  In
# either case, the content of the `PUT` request should be the simple boolean
# value of `true`.
#
# *DELETE Requests*
#
# The `DELETE` method revokes a privilege from a group or user.  The format
# is the same as that of `PUT` requests, but no content should be sent in
# the request body.
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
#   $Id: permissions.rb 8 2007-12-06 23:26:49Z melfstrand $
#

require "common/data/model/person"            # Person/Account data models
require "ldap"                                # Ruby/LDAP extension

#
# Module: Admin
#
# Contains classes and data for the Intranet Administration tool.
#
module Admin

  #
  # Class: Admin::PermissionServlet
  #
  # Main servlet for Permission List web service.
  #
  class PermissionServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Calls either <get_privilege_list> or <get_assignee_list>,
    # based on the `path`.  A `404 Not Found` error will be sent
    # if the tool/privilege combination does not exist.
    #
    # Parameters:
    #   path - the "/tool/privilege" specification to get a list of groups
    #     and users with a privilege, or an empty string if a full list of
    #     available tools and privileges is desired
    #
    def on_get(path)
      return unless self.user_is_administrator?
      if path.to_s.size > 1
        # Requested list of assignees for a tool+privilege.
        # Make sure we have the requisite number of path components.
        # The first one will be empty because the path string always
        # starts with a slash.
        path_components = path.split("/")
        if path_components.size > 2
          I3.server.send_object(
            get_assignee_list(path_components[1], path_components[2]))
        else
          I3.server.send_error(
            :status => "404 Not Found",
            :title => "Tool/Privilege Not Found",
            :message => "The specified tool/privilege combination " +
              "does not exist.")
          return
        end #if
      else
        # Requested list of tools and privileges.
        I3.server.send_object(get_privilege_list)
      end #if
    end #def
    
    #
    # Method: on_put
    #
    # Stores a privilege for the given tool/privilege/object set.
    # If the privilege assignment is successful, an object will be sent
    # with a `status` property of "OK" and a `list` property containing
    # the new assignee list (just as if a `GET` request were made for a
    # specific "tool/privilege").
    #
    # A `PermissionRequestHandler` is used to actually carry out the
    # permission assignment.  The handler provides a subclass that
    # can carry out a `PUT` request for either a user or a group.
    # 
    def on_put(path)
      return unless self.user_is_administrator?
      handler = PermissionRequestHandler.from_path(path)
      unless handler.nil?
        if handler.handle_put
          response = I3::SharedObject.new
          response.status = "OK"
          response.list = get_assignee_list(handler.tool, handler.privilege)
          I3.server.send_object(response)
        end #if
      end #unless
    end #def
    
    #
    # Method: on_delete
    #
    # Removes a privilege for the given tool/privilege/object set.
    # If the privilege is successfully removed, an object will be sent
    # with a `status` property of "OK" and a `list` property containing
    # the new assignee list (just as if a `GET` request were made for a
    # specific "tool/privilege").
    #
    # A `PermissionRequestHandler` is used to actually carry out the
    # permission removal.  The handler provides a subclass that
    # can carry out a `DELETE` request for either a user or a group.
    #
    def on_delete(path)
      return unless self.user_is_administrator?
      handler = PermissionRequestHandler.from_path(path)
      unless handler.nil?
        if handler.handle_delete
          response = I3::SharedObject.new
          response.status = "OK"
          response.list = get_assignee_list(handler.tool, handler.privilege)
          I3.server.send_object(response)
        end #if
      end #unless
    end #def

    #
    # Method: user_is_administrator?
    #
    # Checks the current remote account's permissions and returns `true` if
    # the account has "administer" privileges for "i3-root".  If the account
    # does not have the necessary rights, a `403 Forbidden` message is sent
    # to the user and `false` is returned.
    #
    def user_is_administrator?
      acct = I3.server.remote_account
      unless acct.has_permission?("administer", "i3-root")
        I3.server.send_error(
          :status => "403 Forbidden",
          :title => "Access Denied",
          :message => "You must be an administrator to access this service.",
          :help => "Please contact the Help Desk if you believe you have " +
            "received this message in error.")
        log.warn "Unauthorized access attempt by: #{acct}"
        return false
      end #unless
      return true
    end #def

    #
    # Method: get_privilege_list
    #
    # Sends the list of available tools and their associated privileges to
    # the client.
    #
    def get_privilege_list

      # Get privileges from database.
      descriptions = Hash.new
      perms = I3::Permission.find(:all, :select => "DISTINCT tool, privilege")
      perms.each do |perm|
        descriptions[perm.tool] = Hash.new if descriptions[perm.tool].nil?
        descriptions[perm.tool][perm.privilege] = ""
      end #each
      
      # Fill in descriptions for i3-root virtual tool.
      descriptions["i3-root"] = Hash.new if descriptions["i3-root"].nil?
      descriptions["i3-root"]["administer"] =
        "Make global changes to the intranet."
      descriptions["i3-root"]["develop"] =
        "Access developer-only features of the intranet."
        
      # Fill in descriptions from each tool's YAML file.
      I3.config.tools.each do |short_name, tool|
        if tool.has_info?
          descriptions[short_name] = Hash.new if descriptions[short_name].nil?
          tool_info = YAML.load(File.new(I3.resource(tool.dir + "/meta/info.yml")))
          if tool_info.has_key? "privileges"
            tool_info["privileges"].each do |k, v|
              descriptions[short_name][k] = v
            end #each
          end #if
          descriptions[short_name]["access-tool"] =
            "See the tool in the list and visit it."
        end #if
      end #each

      # Build the list of privileges from the descriptions.
      result = Hash.new
      descriptions.each do |short_name, privileges|
        tool_result = I3::SharedObject.new
        if short_name == "i3-root"
          tool_result.description = "(Entire Intranet)"
        elsif I3.config.tools[short_name].nil?
          tool_result.description = "(Unknown)"
        else
          tool_result.description = I3.config.tools[short_name].name
        end #if
        tool_result.permissions = []
        descriptions[short_name].keys.sort.each do |priv_name|
          perm = I3::SharedObject.new
          perm.privilege = priv_name
          perm.description = descriptions[short_name][priv_name]
          if perm.description == ""
            perm.declared = false
            perm.description = "Not declared in info file."
          else
            perm.declared = true
          end #if
          tool_result.permissions << perm
        end #each
        result[short_name] = tool_result
      end #each

      return result
    end #def

    #
    # Method: get_assignee_list
    #
    # Sends the list of users/groups that have been assigned a
    # specific privilege.
    #
    # Parameters:
    #   tool - the short name of the tool providing the privilege
    #   privilege - the short name of the privilege to check
    #
    def get_assignee_list(tool, privilege)

      # Build the basic result object.
      result = I3::SharedObject.new
      result.groups = []
      result.users = []
      
      # Find all items that have the privilege and separate into
      # groups vs. users
      perms = I3::Permission.find(:all, :conditions => [
        "tool = ? AND privilege = ?", tool, privilege
      ])
      group_perms, user_perms = perms.partition { |perm| perm.is_group? }
      
      # Add each list to the result set.
      group_perms.each do |perm|
        group_result = I3::SharedObject.new
        dn_components = perm.group_dn.split(",")
        if dn_components.size > 1
          # LDAP-style path
          group_result.name = dn_components[0].split("=")[1]
          group_result.description =
            LDAP.dn2ufn(dn_components[1..-1].join(","))
          group_result.dn = perm.group_dn
        else
          # Simple group name
          group_result.name = dn_components[0].capitalize
          group_result.description = ""
          group_result.dn = perm.group_dn
        end #if
        result.groups << group_result
      end #each
      user_perms.each do |perm|
        user_result = I3::SharedObject.new
        user_result.name = perm.account.person.full_name
        user_result.description = perm.account.person.description.to_s
        user_result.account_name = perm.account.account_name
        result.users << user_result
      end #each
      
      return result
    end #def

  end #class


  #
  # Class: Admin::PermissionRequestHandler
  #
  # Parses the path provided to the servlet and creates a permission
  # request object that is capable of carrying out the requested action.
  #
  class PermissionRequestHandler
    include I3::LoggingSupport

    attr_reader :tool, :privilege, :identifier

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

      # Make sure we have the requisite number of path components.
      # The first one will be empty because the path string always
      # starts with a slash.
      path_components = path.split("/")
      if path_components.size < 5
        I3.server.send_error(
          :status => "404 Not Found",
          :title => "Tool/Privilege Not Found",
          :message => "The specified tool/privilege combination " +
            "does not exist.")
        return nil
      end #if
      
      # Determine what type of request this is.
      item_type = path_components[3]
      case item_type.downcase
        when "groups"
          klass = GroupPermissionRequestHandler
        when "users"
          klass = UserPermissionRequestHandler
        else
          I3.server.send_error(
            :status => "404 Not Found",
            :title => "Collection Not Found",
            :message => "The specified collection (#{item_type}) " +
              "does not exist.",
            :help => 'The available collections are "groups" and "users".')
          return nil
      end #case
      
      # Initialize a handler for this type of request.
      return klass.new(
        path_components[1], path_components[2], path_components[4])

    end #def
    
    #
    # Method: initialize
    #
    # Initializes an instance of the request handler.
    #
    # Parameters:
    #   tool - the short name of the tool that uses the privilege
    #   privilege - the name of the privilege that is being granted or revoked
    #   identifier - a string that identifies the user or group that is
    #     receiving the privilege; interpreted differently by each subclass
    #
    def initialize(tool, privilege, identifier)
      @tool = tool
      @privilege = privilege
      @identifier = identifier
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
    # Method: record_journal
    #
    # Records a journal entry about a permission operation.
    #
    # Parameters:
    #   text - the text to record
    #
    def record_journal(text)
      journal = I3::PermissionJournalEntry.new
      journal.account = I3.server.remote_account
      journal.tool = self.tool
      journal.privilege = self.privilege
      journal.text = text
      journal.recorded_at = Time.now.utc
      journal.save
      return true
    end #def
    
  end #def


  #
  # Class: Admin::UserPermissionRequestHandler
  #
  # Carries out `PUT` and `DELETE` requests on user permissions.
  #
  class UserPermissionRequestHandler < PermissionRequestHandler

    # Constant: GRANT_FORMAT
    # Format string for journal entries about granted permissions.
    GRANT_FORMAT = 'Granted for user %d (%s).'

    # Constant: REVOKE_FORMAT
    # Format string for journal entries about revoked permissions.
    REVOKE_FORMAT = 'Revoked for user %d (%s).'
    
    # Method: handle_put
    # Carries out a `PUT` request.
    def handle_put
      acct = I3::Account.find_or_create(self.identifier)
      granting_acct = I3.server.remote_account
      perm = I3::Permission.new
      perm.tool = self.tool
      perm.privilege = self.privilege
      perm.account = acct
      perm.granted_by = granting_acct
      perm.granted_at = Time.now.utc
      perm.save
      self.record_journal(GRANT_FORMAT % [acct.id, acct.account_name])
      return true
    end #def
    
    # Method: handle_put
    # Carries out a `DELETE` request.
    def handle_delete
      acct = I3::Account.find_or_create(self.identifier)
      perm = I3::Permission.find(:first, :conditions => [
        "tool = ? AND privilege = ? AND account_id = ?",
        self.tool, self.privilege, acct.id
      ])
      perm.destroy unless perm.nil?
      self.record_journal(REVOKE_FORMAT % [acct.id, acct.account_name])
      return true
    end #def
    
  end #class
  

  #
  # Class: Admin::GroupPermissionRequestHandler
  #
  # Carries out `PUT` and `DELETE` requests on group permissions.
  #
  class GroupPermissionRequestHandler < PermissionRequestHandler

    # Constant: GRANT_FORMAT
    # Format string for journal entries about granted permissions.
    GRANT_FORMAT = 'Granted for group "%s".'

    # Constant: REVOKE_FORMAT
    # Format string for journal entries about revoked permissions.
    REVOKE_FORMAT = 'Revoked for group "%s".'
    
    # Method: handle_put
    # Carries out a `PUT` request.
    def handle_put
      granting_acct = I3.server.remote_account
      perm = I3::Permission.new
      perm.tool = self.tool
      perm.privilege = self.privilege
      perm.group_dn = self.identifier
      perm.is_group = true
      perm.granted_by = granting_acct
      perm.granted_at = Time.now.utc
      perm.save
      self.record_journal(GRANT_FORMAT % self.identifier)
      return true
    end #def
    
    # Method: handle_put
    # Carries out a `DELETE` request.
    def handle_delete
      perm = I3::Permission.find(:first, :conditions => [
        "tool = ? AND privilege = ? AND group_dn = ?",
        self.tool, self.privilege, self.identifier
      ])
      perm.destroy unless perm.nil?
      self.record_journal(REVOKE_FORMAT % self.identifier)
      return true
    end #def

  end #class

end #module
