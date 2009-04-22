#!/usr/bin/env ruby

#
# Helper Script: make-servlet
#
# This script creates a new web service file in a tool's data directory.
# You supply it with the tool name and the name of the web service, and
# it will create a service file that handles a basic `GET` request.
#
# For example, to create a web service in the "monkeys" tool called
# "banana-horde", you'd run the following:
#
#   ruby make-servlet.rb monkeys banana-horde
#
# This would create the `i3-site/tools/monkeys/data/banana-horde.rb` file,
# which would contain a `BananaHordeServlet` class inside a module called
# `Monkeys`.
#
# Note that tools are expected to be in `i3-site`.  If you are modifying
# a tool that is in the core i3 framework, copy the existing tool into
# i3-site, make the modifications, test them, and then copy the tool back
# into the core framework when it is ready for widespread use.
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
#   $Id: make-servlet.rb 131 2008-11-26 23:09:07Z nmellis $
#

require File.dirname(__FILE__) + "/include/script-common"

# Constant: SERVLET_TEMPLATE
# Path to the template file that will be used to generate the servlet.
SERVLET_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/servlet.rb.erb"


#
# Function: make_servlet
#
# Creates a servlet file from a template.
#
# Parameters:
#   tool_dirname - the directory name of the tool that will contain the
#     servlet
#   servlet_name - the name to give the new servlet
#
def make_servlet(tool_dirname, servlet_name)
  
  # Tool and servlet names should be lowercase.
  tool_dirname = tool_dirname.downcase
  servlet_name = servlet_name.downcase

  # Make sure the tool exists.
  tool_dir = "#{I3::SITE_PATH}/tools/#{tool_dirname}"
  unless File.exist?("#{tool_dir}/meta/info.yml")
    puts
    puts "*** ERROR: The \"#{tool_dirname}\" tool does not exist in i3-site."
    if File.exist?("#{I3::ROOT_PATH}/tools/#{tool_dirname}/meta/info.yml")
      puts "    To modify the #{tool_dirname} tool, first copy it into i3-site."
    else
      puts "    Run the make-tool.rb script to generate a new tool."
    end #if
    puts
    return false
  end #unless

  # Load the template file.
  template = I3::Template.new(SERVLET_TEMPLATE)
  
  # Fill in the template values.
  # Tool name is obtained from the tool's info.yml file.
  # Module name is the title-cased version of the tool directory name.
  # Servlet path is the path of the web service following the initial slash.
  # Servlet title is the title-cased version of the servlet name.
  # Servlet class name is the title without the spaces.
  # Hyphens are expected to separate words in tool_dirname and servlet_name.
  template["tool_name"] = I3.config.tools[tool_dirname].name
  template["module_name"] =
    tool_dirname.split("-").collect { |w| w.capitalize }.join
  template["servlet_path"] = tool_dirname + "/data/" + servlet_name
  servlet_title =
    servlet_name.split("-").collect {|w| w.capitalize}.join(" ")
  template["servlet_title"] = servlet_title
  template["servlet_class_name"] = servlet_title.gsub(" ", "") + "Servlet"
  template["credit"] = I3::CREDIT_STRING
  template["copyright"] = I3::COPYRIGHT_STRING
  template["version"] = I3::VERSION_STRING

  # Write the template file to the target directory.
  template.save("#{tool_dir}/data/#{servlet_name}.rb")
  puts "- Generated i3-site/tools/#{tool_dirname}/data/#{servlet_name}.rb"

end #def

if ARGV.length > 1 then
  make_servlet(ARGV[0], ARGV[1])
else
  puts 'Usage:  ruby make-servlet.rb tool-name servlet-name'
end #if
