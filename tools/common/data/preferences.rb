#
# Web Service: common/data/preferences
#
# Provides tool-specific user preferences.
# 
# Preferences are objects that are stored on a per-user basis, associated
# with a tool name and a unique key.  Objects can be retrieved by making
# a `GET` request to the web service using the format:
# 
# (start example)
#   GET /common/data/preferences/tool-name/preference-key
# (end example)
# 
# Similarly, an object can be stored in the user preferences by making
# a `PUT` request:
# 
# (start example)
#   PUT /common/data/preferences/tool-name/preference-key
# (end example)
# 
# Multiple objects can be stored at once by making a `POST` request to
# the tool path.  The posted object is expected to have a key for each
# preference that is being added or overwritten.  Specifying `null` as
# the value for a key will result in the key/value pair being removed.
# Keys that are omitted from the object will be left unchanged.
# 
# A key/value pair can be removed from the user preferences by making
# a `DELETE` request:
# 
# (start example)
#   DELETE /common/data/preferences/tool-name/preference-key
# (end example)
# 
# Objects are expected to be in JSON format.  Any object representable
# by JSON can be stored in the preferences system.
# 
# A `404 Not Found` response will be sent if the requested preference
# key is missing.  A list of all preferences that have been stored for
# a tool can be requested by omitting the preference key.
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
#   $Id: preferences.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "common/data/model/person"            # Person/Account data models

#
# Module: I3Common
# Common servlet namespace
#
module I3Common

  #
  # Class: I3Common::UserInfoServlet
  #
  # Main servlet for User Preferences web service.
  #
  class PreferencesServlet < I3::Servlet

    #
    # Method: on_get
    #
    # Provides the user's saved preferences.
    #
    # Parameters:
    #   path - optional; the tool name and preference key
    #
    def on_get(path)
      prefs = I3.server.remote_account.preferences
      case path
        when %r'^/?$'
          # Client requested all preferences for all tools.
          result = Hash.new
          tool_names = I3.config.tools.collect { |name, tool| name } + [ "common" ]
          tool_names.each do |tool_name|
            prefs.each_for_tool(tool_name) do |k, v|
              result[tool_name] = Hash.new if result[tool_name].nil?
              result[tool_name][k] = v
            end #each_for_tool
          end #each
          I3.server.send_object(result)
        when %r'^/([^/]+)/?$'
          # Client requested all preferences for a specific tool.
          tool_name = $1
          if valid_tool_name?(tool_name)
            result = Hash.new
            prefs.each_for_tool(tool_name) { |k, v| result[k] = v }
            I3.server.send_object(result)
          else
            send_missing_tool_error(tool_name)
          end #if
        when %r'^/([^/]+)/([^/]+)/?$'
          # Client requested a specific preference.
          tool_name = $1
          preference_key = $2
          if valid_tool_name?(tool_name)
            result = prefs.get(preference_key, :tool => tool_name)
            if result.nil?
              I3.server.send_error(
                :status => "404 Not Found",
                :title => "Preference Not Found",
                :message => "The specified preference does not exist."
              )
            else
              I3.server.send_object(result)
            end #if
          else
            send_missing_tool_error(tool_name)
          end #if
        else
          # Unrecognized path format.
          I3.server.send_error(
            :status => "404 Not Found",
            :title => "Unrecognized Preference Path",
            :message => "Preferences cannot be retrieved from this location."
          )
      end #if
    end #def

    #
    # Method: on_post
    #
    # Adds or replaces multiple objects in the user's saved preferences.
    #
    # Parameters:
    #   path - the name of the tool for which the preferences are being
    #     modified
    #
    def on_post(path)
      if path =~ %r'^/([^/]+)/?$'
        tool_name = $1
        if valid_tool_name?(tool_name)
          prefs = I3.server.remote_account.preferences
          new_prefs = I3.server.receive_object
          if new_prefs.is_a? I3::SharedObject
            new_prefs.each { |k, v| prefs.set(k, v, :tool => tool_name) }
          else
            I3.server.send_error(
              :status => "400 Bad Request",
              :title => "Wrong Object Type",
              :message => "The sent object must be a hash of preference keys."
            )
          end #if
          I3.server.send_object(true)
        else
          send_missing_tool_error(tool_name)
        end #if
      else
        # Unrecognized path format.
        I3.server.send_error(
          :status => "403 Forbidden",
          :title => "Path Not Allowed",
          :message => "Preferences cannot be saved to this location.",
          :help => "Make sure the path is in the format: " +
                   "/common/data/preferences/tool-name/"
        )
      end #if
    end #def

    #
    # Method: on_put
    #
    # Stores an object in the user's saved preferences.
    #
    # Parameters:
    #   path - the tool name and preference key
    #
    def on_put(path)
      with_valid_path(path) do |tool_name, preference_key|
        obj = I3.server.receive_object
        if obj.nil?
          I3.server.send_error(
            :status => "400 Bad Request",
            :title => "Missing Object",
            :message => "No object was sent."
          )
        else
          I3.server.remote_account.preferences.set(preference_key, obj, :tool => tool_name)
          I3.server.send_object(true)
        end #if
      end #with_valid_path
    end #def

    #
    # Method: on_delete
    #
    # Removes an object and its key from the user's saved preferences.
    #
    # Parameters:
    #   path - the tool name and preference key
    #
    def on_delete(path)
      with_valid_path(path) do |tool_name, preference_key|
        I3.server.remote_account.preferences.set(preference_key, nil, :tool => tool_name)
        I3.server.send_object(true)
      end #with_valid_path
    end #def

    #
    # Method: with_valid_path
    #
    # Verifies that the path is in the required format and executes the
    # given block if it is, passing in the tool name and preference key.
    # This is used by the `on_put` and `on_delete` methods, which have
    # the same path requirements.
    # 
    # An error will be sent to the client if the path is not valid.
    #
    # Parameters:
    #   path - the path to validate
    # 
    # Returns:
    #   `true` if the path is valid, `false` if an error was sent to the client
    #
    def with_valid_path(path)
      if path =~ %r'^/([^/]+)/([^/]+)/?$'
        tool_name = $1
        preference_key = $2
        if valid_tool_name?(tool_name)
          yield tool_name, preference_key
          return true
        else
          send_missing_tool_error(tool_name)
          return false
        end #unless
      else
        # Unrecognized path format.
        I3.server.send_error(
          :status => "403 Forbidden",
          :title => "Path Not Allowed",
          :message => "Preferences cannot be saved to this location.",
          :help => "Make sure the path is in the format: " +
                   "/common/data/preferences/tool-name/preference-key"
        )
        return false
      end #if
    end #def

    #
    # Method: valid_tool_name?
    # 
    # Determines if the given tool name refers to an existing tool.
    # 
    # Parameters:
    #   tool_name - the short (directory) name of the tool
    # 
    # Returns:
    #   `true` if the tool exists, `false` if not
    # 
    def valid_tool_name?(tool_name)
      return false if tool_name != "common" and I3.config.tools[tool_name].nil?
      true
    end #def

    #
    # Method: send_missing_tool_error
    # 
    # Sends a `404 Not Found` error to the client.
    # 
    # Parameters:
    #   tool_name - the short (directory) name of the tool
    # 
    def send_missing_tool_error(tool_name)
      I3.server.send_error(
        :status => "404 Not Found",
        :title => "Tool Not Found",
        :message => "The specified tool (\"#{tool_name}\") does not exist."
      )
    end #def

  end #class

end #module
