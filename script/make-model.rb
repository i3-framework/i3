#!/usr/bin/env ruby

#
# Helper Script: make-model
#
# This script creates a new I3::Record data model file in a tool's data/model directory.
# You supply it with the tool name and the name of the file, and
# it will create a model file with a base Record class for the tool.
#
# Note that tools are expected to be in `i3-site`.  If you are modifying
# a tool that is in the core i3 framework, copy the existing tool into
# i3-site, make the modifications, test them, and then copy the tool back
# into the core framework when it is ready for widespread use.
# 
# Credits:
# 
#   Written by:
#     Marshall Elfstrand (marshall@vengefulcow.com) and 
#     Nathan Mellis (nathan@mellis.us)
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
#   $Id: make-model.rb 112 2008-06-23 17:40:53Z nmellis $
#

require File.dirname(__FILE__) + "/include/script-common"

# Constant: MODEL_TEMPLATE
# Path to the template file that will be used to generate the model.
MODEL_TEMPLATE = I3::TEMPLATE_PATH + "/make-tool/model.rb.erb"

# Constant: WARN_NODATABASE
# Message to display when a database has not been defined.
WARN_NODATABASE =
  'WARNING: No database has been defined in "%s/meta/info.yml".' + "\n" +
  'You will not be able to run the migration scripts for this tool' + "\n" +
  'until the database has been specified in its info.yml file.'

#
# Function: make_model
#
# Creates a model file from a template.
#
# Parameters:
#   tool_dirname - the directory name of the tool that will contain the
#     servlet
#   class_name - the name to give the new model class
#
def make_model(tool_dirname, class_name)
  
  # Tool and servlet names should be lowercase.
  tool_dirname = tool_dirname.to_s.downcase
  class_name = class_name.to_s.downcase

  # Make sure the tool exists.
  tool_dir = "#{I3::SITE_PATH}/tools/#{tool_dirname}"
  unless File.exist?("#{tool_dir}")
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
  
  # Warn if no database has been defined.
  tool = I3.config.tools[tool_dirname]
  if tool.database.nil? and class_name.empty?
    STDERR.puts(WARN_NODATABASE % tool_dirname) if tool.database.nil?
    return false
  end
  

  # Load the template file.
  template = I3::Template.new(MODEL_TEMPLATE)
  
  # Fill in the template values.
  template["tool_dir"] = tool_dirname
  template["tool_name"] = I3.config.tools[tool_dirname].name
  template["module_name"] =
    tool_dirname.split("-").collect { |w| w.capitalize }.join
  template["model_path"] = tool_dirname + "/data/model/" + 
                           (class_name.empty? ? tool_dirname : class_name)
  model_title = class_name.split("-").collect {|w| w.capitalize}.join(" ")
  template["model_title"] = model_title
  template["model_class_name"] = model_title.gsub(" ", "")
  template["credit"] = I3::CREDIT_STRING
  template["copyright"] = I3::COPYRIGHT_STRING
  template["version"] = I3::VERSION_STRING

  # Write the template file to the target directory.
  template_name = class_name.empty? ? tool_dirname : class_name
  template.save("#{tool_dir}/data/model/#{template_name}.rb")
  puts "- Generated i3-site/tools/#{tool_dirname}/data/model/#{template_name}.rb"

end #def

if ARGV.length > 0 then
  make_model(ARGV[0], ARGV[1])
else
  puts 'Usage:  ruby make-model.rb tool-name [ class-name ]'
end #if
