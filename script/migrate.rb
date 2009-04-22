#!/usr/bin/env ruby

#
# Helper Script: migrate
#
# Migrates a database to the current version.
# 
# Example:
# (start example)
#   # Update the common databases to the latest version
#   ruby migrate.rb common
# 
#   # Update or revert the common databases to a specific version
#   ruby migrate.rb common VERSION=2
# (end example)
#
# Credits:
# 
#   Written by Nathan Mellis (nathan@mellis.us).
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
#   $Id: migrate.rb 59 2008-03-04 19:31:16Z nmellis $
#

require "syslog"
require File.dirname(__FILE__) + "/include/script-common"

# Extract schema version argument if specified.
# The schema_version variable will wind up as `nil` if none has been given.
schema_version = ARGV.detect { |arg| arg =~ /VERSION=[0-9]+/ }
ARGV.delete(schema_version)
schema_version =
  schema_version.to_s.split("=")[1].to_i unless schema_version.nil?

# We've processed all the named options, so all that should be left is the 
# tool name.  Make sure we have one.
if ARGV.length == 1
  tool_name = ARGV[0]
else
  puts 'Usage: %s <tool-name> [VERSION=#]' % $0
  exit
end #if

# Make sure the migrations folder exists.
migrations_path = I3.resource("#{tool_name}/data/model/migrations")
unless File.directory? migrations_path
  STDERR.puts "The migrations folder (#{migrations_path}) does not exist."
  exit
end #unless

# Retrieve the tool information from its config file and make sure a database
# has been specified.  The "common" folder is not a tool, and thus does not
# have a tool info file, so the default "i3" database is supplied.
if tool_name == "common" then tool_info = { "database" => "i3" }
else tool_info = I3.config.tools[tool_name]
end #if
data_service = I3.config.data_services["i3-migrate"]
data_service = tool_info.data_service if tool_info.data_service
if tool_info.database
  data_service["database"] = tool_info.database
else
  STDERR.puts "A database must be specified in #{tool_name}/meta/info.yml"
  STDERR.puts "before migrations can be used with this tool."
  exit
end #if

ActiveRecord::Base.establish_connection data_service
ActiveRecord::Base.logger = I3::log
ActiveRecord::Migrator.migrate(migrations_path, schema_version)
