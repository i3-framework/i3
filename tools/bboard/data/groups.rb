#
# Web Service: bboard/data/groups
#
# Provides lists of groups and users.
#
# If no additional path information is provided, a list of available groups
# is sent (as an array of strings, with each string being the distinguished
# name of a group).  If the DN of a group is given as the path, the list of
# users in that group will be sent, with each user having `account_name`,
# `first_name`, `last_name`, and `description` properties.
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
#   $Id: groups.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "ldap"                                # For formatting LDAP paths

#
# Module: BulletinBoard
#
# The module containing all Bulletin Board classes and data.
#
module BulletinBoard

  #
  # Class: BulletinBoard::GroupListServlet
  #
  # Main servlet for Group List web service.
  #
  class GroupListServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Calls either <send_group_list> or <send_user_list>, depending on
    # the `path`.
    #
    # Parameters:
    #   path - the distinguished name of the group to list the users in,
    #     or an empty string if a full list of groups is desired
    #
    def on_get(path)
      # Check user account permissions.
      acct = I3.server.remote_account
      unless acct.has_permission?("administer")
        I3.server.send_error(
          :status => "403 Forbidden",
          :title => "Access Denied",
          :message => "You must be an administrator to access this service.",
          :help => "Please contact the Help Desk if you believe you have " +
            "received this message in error.")
        log.warn "Unauthorized group list attempt by: #{acct}"
        return
      end #unless
      # Determine what to send.
      if path.to_s.size > 1
        send_user_list(path)
      else
        send_group_list
      end #if
    end #def
  
    #
    # Method: send_group_list
    #
    # Sends the entire list of groups as an array of LDAP group
    # distinguished names (DNs).
    #
    def send_group_list
      I3.server.send_object(I3.directory.find_all_groups)
    end #def
    
    #
    # Method: send_user_list
    #
    # Sends the list of users in the group specified by the `path`.
    #
    # Parameters:
    #   path - the DN of an LDAP group
    #
    def send_user_list(path)
      path = path[1..-1]
      path = path[0..-2] if path.ends_with?("/")
      results = []
      I3.directory.find_people(:groups, path).each do |uuid|
        p = I3.directory.read_person(uuid)
        result = I3::SharedObject.new
        result.account_name = p.account_name.to_s.downcase
        result.first_name   = p.first_name.to_s
        result.last_name    = p.last_name.to_s
        result.description  = p.description.to_s
        results << result
      end #each
      I3.server.send_object(results)
    end #def

  end #class

end #module
