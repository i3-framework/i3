#
# File: framework/intranet
#
# Loads the various classes used by the intranet framework.
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
#   $Id: intranet.rb 133 2008-11-26 23:12:27Z nmellis $
#

require "rubygems"

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3

  # Constant: ROOT_PATH
  # Location of i3 files.
  ROOT_PATH = File.expand_path(File.dirname(File.dirname(__FILE__)))

  # Constant: SITE_PATH
  # Location of site (organization-specific) files.
  SITE_PATH = File.expand_path("#{ROOT_PATH}/../i3-site")

  # Constant: LOCAL_PATH
  # Location of local (server-specific) files.
  LOCAL_PATH = File.expand_path("#{ROOT_PATH}/../i3-local")

  # 
  # Module Method: resource
  # 
  # Returns the full path to a file that can be found in either
  # the `i3` or `i3-site` trees.
  # 
  # The path may or may not begin with a slash; the path will
  # be resolved the same, regardless.
  # 
  # Parameters:
  #   relative_path - the path to the resource, relative to
  #     the `i3/tools` or `i3-site/tools` folder
  # 
  # Returns:
  #   The full path to the file as a string, or an empty
  #   string if the file could not be found.
  # 
  def self.resource(relative_path)
    relative_path = relative_path[1..-1] if relative_path[0..0] == "/"
    if relative_path =~ %r'^\$theme/(.+)'
      theme_resource_path = $1
      case
        when File.exists?("#{SITE_PATH}/themes/#{I3.config.theme}/#{theme_resource_path}")
          return "#{SITE_PATH}/themes/#{I3.config.theme}/#{theme_resource_path}"
        when File.exists?("#{ROOT_PATH}/themes/#{I3.config.theme}/#{theme_resource_path}")
          return "#{ROOT_PATH}/themes/#{I3.config.theme}/#{theme_resource_path}"
        when File.exists?("#{SITE_PATH}/themes/default/#{theme_resource_path}")
          return "#{SITE_PATH}/themes/default/#{theme_resource_path}"
        when File.exists?("#{ROOT_PATH}/themes/default/#{theme_resource_path}")
          return "#{ROOT_PATH}/themes/default/#{theme_resource_path}"
        else
          return ""
      end #case
    else
      if File.exists?("#{SITE_PATH}/tools/#{relative_path}")
        return "#{SITE_PATH}/tools/#{relative_path}"
      elsif File.exists?("#{ROOT_PATH}/tools/#{relative_path}")
        return "#{ROOT_PATH}/tools/#{relative_path}"
      else
        return ""
      end #if
    end #if
  end #def

end #module

# Add framework and third-party library folders to the search path.
$:.insert(0, "#{I3::ROOT_PATH}/framework")
$:.insert(0, "#{I3::SITE_PATH}/framework") if File.directory?("#{I3::SITE_PATH}/framework")
$:.insert(1, "#{I3::ROOT_PATH}/lib")
$:.insert(1, "#{I3::SITE_PATH}/lib") if File.directory?("#{I3::SITE_PATH}/lib")

# Add tool folders to the search path.
$:.insert(1, "#{I3::ROOT_PATH}/tools")
$:.insert(1, "#{I3::SITE_PATH}/tools") if File.directory?("#{I3::SITE_PATH}/tools")

require "intranet/attributes"    # Additional attribute creators
require "intranet/logging"       # Logging facility
require "intranet/config"        # Server configuration

require "intranet/json"          # JSON extensions
require "intranet/object"        # SharedObject module
require "intranet/string"        # String class extensions

require "intranet/record"        # ActiveRecord support

require "intranet/cache"         # Cache support
require "intranet/directory"     # Directory service support
require "intranet/exception"     # I3 Exception classes
require "intranet/file"          # File class extensions

require "intranet/server"        # Main intranet server objects

# Load site-specific intranet configuration, if applicable.
if File.exists?("#{I3::SITE_PATH}/framework/intranet.rb")
  require "#{I3::SITE_PATH}/framework/intranet.rb"
end #if
