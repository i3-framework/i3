#!/usr/bin/env ruby

#
# Helper Script: make-tool
#
# Creates a set of files that can be used as a starting point for a new tool.
# You supply it with the short name of the tool you want to create, followed
# by the long name that will be displayed in the Tools list on the client.
# The script will set up a folder in `tools` with some sample code filled in,
# which you can then modify to create your tool.  For example:
#
# (start example)
#   ruby make-tool.rb monkeys "Monkey Ball"
# (end example)
#
# This would create the following folder hierarchy
# in `i3-site/tools`:
# (start example)
#
#   i3-site/
#     tools/
#       monkeys/
#         client-web/
#           css/
#             common.css
#           html/
#             index.html
#           img/
#             applet-icon-32.png
#             applet-icon-16.png
#           js/
#             index.js
#         data/
#           model/
#             migrations/
#         meta/
#           info.yml
#
# (end example)
# The index.html file in this example will be generated with the tool name in
# the title tag (e.g. "Monkey Ball").  The monkeys.js file will have a
# skeleton applet class that sets up the navigation bar.  The PNG files will
# be generic icons that will need to be replaced with PNGs for the tool.
# The info.yml file will contain a generic description for the tool that will
# need to be changed.
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
#   $Id: make-tool.rb 25 2007-12-14 17:15:45Z melfstrand $
#

require File.dirname(__FILE__) + "/include/script-common"

# Templates that will be used to generate the tool files.
INFO_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/info.yml.erb"
HTML_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/index.html.erb"
CSS_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/styles.css.erb"
JS_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/script.js.erb"

# Names to use for the index items.
INDEX_APPLET_TITLE = "Index"
INDEX_APPLET_CLASS_NAME = "IndexApplet"

#
# Function: make_tool
#
# Creates a set of tool files from templates.
#
# Parameters:
#   tool_dirname - the name of the tool directory that will be created
#   tool_name - the display name of the tool
#
def make_tool(tool_dirname, tool_name)

  # Tool directory name should be lowercase.
  tool_dirname = tool_dirname.downcase
  
  # Make sure we're not destroying an existing tool.
  tool_dir = "#{I3::SITE_PATH}/tools/#{tool_dirname}"
  if File.exist?("#{tool_dir}/meta/info.yml")
    puts
    puts "*** ERROR: The \"#{tool_dirname}\" tool already exists."
    puts "    Remove the existing tool's directory and try again."
    puts
    return false
  end #if

  # Build the list of directories and templates to process.
  dir_list = [
    "#{tool_dir}/meta",
    "#{tool_dir}/client-web/img",
    "#{tool_dir}/client-web/css",
    "#{tool_dir}/client-web/html",
    "#{tool_dir}/client-web/js",
    "#{tool_dir}/data/model/migrations"
  ]
  template_map = {
    CSS_TEMPLATE => "client-web/css/common.css",
    HTML_TEMPLATE => "client-web/html/index.html",
    JS_TEMPLATE => "client-web/js/index.js",
    INFO_TEMPLATE => "meta/info.yml"
  }
  
  # Determine values to be used in the templates.
  # Module name is the title-cased version of the tool directory name.
  # Applet path is the path of the JavaScript file from inside i3/tools.
  # Hyphens are expected to separate words in tool_dirname.
  values = {
    :tool_name => tool_name,
    :module_name => tool_dirname.split("-").collect { |w| w.capitalize }.join,
    :applet_path => tool_dirname + "/client-web/js/index",
    :stylesheet_path => tool_dirname + "/client-web/css/common",
    :applet_title => INDEX_APPLET_TITLE,
    :applet_class_name => INDEX_APPLET_CLASS_NAME,
    :js_path => "/#{tool_dirname}/client-web/js/index.js",
    :css_path => "/#{tool_dirname}/client-web/css/common.css",
    :page_title => tool_name,
    :credit => I3::CREDIT_STRING,
    :copyright => I3::COPYRIGHT_STRING,
    :version => I3::VERSION_STRING
  }
  
  # The JavaScript code for the navbar inserts a single entry for the tool
  # name, since the page that is generated is the main page for the tool.
  # This is different from the code in make-applet.rb, which generates both
  # an entry for the tool and an entry for the individual applet.
  values[:navbar_code] = 'I3.navbar.addToPath("%s");' % tool_name
  
  # Create the directories for the tool.
  FileUtils.mkdir_p dir_list

  # Render the templates to the appropriate files.
  puts
  template_map.each do |src, dest|
    I3::Template.new(src, values).save("#{tool_dir}/#{dest}")
    puts "- Generated i3-site/tools/#{tool_dirname}/#{dest}"
  end #each

  # Copy the images to the destination folder.
  ["applet-icon-32.png", "applet-icon-16.png"].each do |img_name|
    FileUtils.cp("#{I3::TEMPLATE_PATH}/make-tool/#{img_name}",
                 "#{tool_dir}/client-web/img/#{img_name}")
    puts "- Created i3-site/tools/#{tool_dirname}/client-web/img/#{img_name}"
  end #each
      
  puts
  puts 'The tool files have been generated in "i3-site/tools/%s".' % tool_dirname
  puts

  return true
end #def

if ARGV.length > 1 then
  make_tool(ARGV[0], ARGV[1])
else
  puts 'Usage:  ruby make-tool.rb short-name "Full Name"'
end #if
