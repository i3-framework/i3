#!/usr/bin/env ruby

#
# Helper Script: make-applet
#
# Creates a new applet file set in a tool's client-web folder.  You supply it
# with the tool name and the name of the new applet, and it will generate a
# set of HTML, JavaScript, and (optionally) CSS files to implement the applet.
#
# For example, to create an applet in the "monkeys" tool called
# "banana-finder", you'd run the following:
#
# (start example)
#   ruby make-applet.rb monkeys banana-finder
# (end example)
#
# This would create the following
# files:
#
#   - i3-site/tools/monkeys/client-web/html/banana-finder.html
#   - i3-site/tools/monkeys/client-web/js/banana-finder.js
#
# The JavaScript file would contain a `BananaFinderApplet` class inside
# a module called `Monkeys`.
#
# By default, the tool's "common.css" file will be linked to in the HTML
# file.  If you want a separate CSS file to be generated for the applet,
# you can specify the "--with-css" option on the command line:
#
# (start example)
#   ruby make-applet.rb --with-css monkeys banana-finder
# (end example)
#
# This will cause the "banana-finder.css" file to be created, and the HTML
# file will link to it instead of the shared "common.css" file.
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
#   $Id: make-applet.rb 25 2007-12-14 17:15:45Z melfstrand $
#

require File.dirname(__FILE__) + "/include/script-common"

# Templates that will be used to generate the applet files.
HTML_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/index.html.erb"
CSS_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/styles.css.erb"
JS_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/script.js.erb"

#
# Function: make_servlet
#
# Creates a set of applet files from templates.
#
# Parameters:
#   tool_dirname - the directory name of the tool that will contain the
#     applet files
#   applet_name - the name to give the new applet
#   include_css - optional; `true` if a CSS file should be generated
#
def make_applet(tool_dirname, applet_name, include_css=false)
  
  # Tool and applet names should be lowercase.
  tool_dirname = tool_dirname.downcase
  applet_name = applet_name.downcase
  
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
  
  # Build the list of directories that we need to make sure exist.
  dir_list = [ "#{tool_dir}/client-web/html", "#{tool_dir}/client-web/js" ]

  # Determine values to be used in the templates.
  # Tool name is obtained from the tool's info.yml file.
  # Module name is the title-cased version of the tool directory name.
  # Applet path is the path of the JavaScript file from inside i3/tools.
  # Applet title is the title-cased version of the applet name.
  # Applet class name is the title without the spaces.
  # Hyphens are expected to separate words in tool_dirname and applet_name.
  tool_name = I3.config.tools[tool_dirname].name
  applet_title = applet_name.split("-").collect { |w| w.capitalize }.join(" ")
  values = {
    :tool_name => tool_name,
    :module_name => tool_dirname.split("-").collect { |w| w.capitalize }.join,
    :applet_path => tool_dirname + "/client-web/js/" + applet_name,
    :applet_title => applet_title,
    :applet_class_name => applet_title.gsub(" ", "") + "Applet",
    :js_path => "/#{tool_dirname}/client-web/js/#{applet_name}.js",
    :css_path => "/#{tool_dirname}/client-web/css/common.css",
    :page_title => applet_title,
    :credit => I3::CREDIT_STRING,
    :copyright => I3::COPYRIGHT_STRING,
    :version => I3::VERSION_STRING
  }

  # The JavaScript code for the navbar inserts the tool name and then the
  # applet title.  This is different from the code in make-tool.rb, which
  # generates just one navbar entry for the index page.
  values[:navbar_code] = (
    'I3.navbar.addToPath("%s", { link: "/%s/" });%s' +
    'I3.navbar.addToPath("%s");'
    ) % [ tool_name, tool_dirname, "\n    ", applet_title ]

  # Set up the list of templates to process.
  template_map = {
    HTML_TEMPLATE => "client-web/html/#{applet_name}.html",
    JS_TEMPLATE  => "client-web/js/#{applet_name}.js"
  }

  # Add CSS information if requested.
  if include_css
    dir_list << "#{tool_dir}/client-web/css"
    values[:stylesheet_path] = "/#{tool_dirname}/client-web/css/#{applet_name}"
    values[:css_path] = "/#{tool_dirname}/client-web/css/#{applet_name}.css"
    template_map[CSS_TEMPLATE] = "client-web/css/#{applet_name}.css"
  end

  # Create the necessary directories if they don't already exist.
  FileUtils.mkdir_p dir_list

  # Render the templates to the appropriate files.
  template_map.each do |src, dest|
    I3::Template.new(src, values).save("#{tool_dir}/#{dest}")
    puts "- Generated i3-site/tools/#{tool_dirname}/#{dest}"
  end #each

end #def

if ARGV.length > 1 then
  if (css_index = ARGV.index("--with-css")).nil?
    make_applet(ARGV[0], ARGV[1])
  else
    ARGV.delete_at(css_index)
    make_applet(ARGV[0], ARGV[1], true)
  end #if
else
  puts 'Usage:  ruby make-applet.rb [--with-css] tool-name applet-name'
end #if
