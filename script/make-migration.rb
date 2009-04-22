#!/usr/bin/env ruby

#
# Helper Script: make-migration
#
# This script creates a new migration file in a tool's `data/model/migrations`
# folder.  You supply it with the tool name and the name of the migration,
# and it will create a migration file prefixed with the appropriate revision
# number.
# 
# For example, suppose you have a tool called "monkeys" that provides access
# to data in a table called "bananas", and that you already have two
# migration steps that describe the changes the "bananas" table has gone
# through:
# 
#   * `001_create_tables.rb`
#   * `002_add_brand_column.rb`
# 
# Let's say you want to add a third migration that will create a new table to
# contain banana brands and change the "brand" column into "brand_id".  You
# would create the migration file using this script as follows:
# 
# (start example)
#   ruby make-migration.rb monkeys extract_brands_into_table
# (end example)
#
# This would create a file called `003_extract_brands_into_table.rb` in
# `i3-site/tools/monkeys/data/model/migrations`.  You would then modify the
# `self.up` and `self.down` methods in the file to describe the
# modifications that should be made when migrating to the new schema.
# 
# The `self.up` method would contain the code to create the new "brands"
# table, load it with all the unique brands from the "bananas" table,
# create the "brand_id" column in "bananas", fill it with references
# to the new brand records, and then remove the old "brand" column.
# 
# The `self.down` method would re-create the "brand" column, fill it with
# the names of the banana brands, and then remove the "brand_id" column
# and "brands" table.
#
# Note that tools are expected to be in `i3-site`.  If you are modifying
# a tool that is in the core i3 framework, copy the existing tool into
# i3-site, make the modifications, test them, and then copy the tool back
# into the core framework when it is ready for widespread use.
# 
# Credits:
# 
#   Written by
#     Nathan Mellis (nathan@mellis.us) and
#     Marshall Elfstrand (marshall@vengefulcow.com)
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
#   $Id: make-migration.rb 25 2007-12-14 17:15:45Z melfstrand $
#

require File.dirname(__FILE__) + "/include/script-common"


#
# Class: MigrationFolder
# 
# Represents a folder that contains migration files.
# 
class MigrationFolder
  
  # Constant: MIGRATIONS_SUBFOLDER
  # The path inside the tool folder in which migrations are stored.
  MIGRATIONS_SUBFOLDER = "data/model/migrations"
  
  #
  # Constructor: new
  # 
  # Initializes a `MigrationFolder` instance for the given tool.
  # 
  # Parameters:
  #   tool_dirname - the directory name of the tool
  # 
  def initialize(tool_dirname)
    @tool = tool_dirname
    @path = "#{I3::SITE_PATH}/tools/#{tool_dirname}/#{MIGRATIONS_SUBFOLDER}"
    FileUtils.mkdir_p(@path)
  end #def
  
  #
  # Method: current_migration_number
  #
  # Determines the highest existing migration step number.
  # 
  # Returns:
  #   The migration number as a `Fixnum`
  #
  def current_migration_number
    Dir.glob("#{@path}/[0-9]*.rb").inject(0) do |max, file_path|
      n = File.basename(file_path).split("_", 2).first.to_i
      if n > max then n else max end
    end #inject
  end #current_migration_number

  #
  # Method: next_migration_number
  #
  # Determines the number to use for the next migration step.
  #
  # Returns:
  #   The migration number as a `Fixnum`
  #
  def next_migration_number
    self.current_migration_number + 1
  end #next_migration_number

  #
  # Method: next_migration_path
  #
  # Provides a file path for the given migration name, complete with
  # a prepended migration number and a ".rb" suffix.  The path will be
  # relative to the intranet root (that is, it will begin with the tool
  # directory).
  #
  # Parameters:
  #   migration_name - the name to use for the migration file; words should
  #     be separated by underscores
  #   
  # Returns:
  #   The path of the migration file as a `String`
  #
  def next_migration_path(migration_name)
    "%s/%s/%03d_%s.rb" % [ @tool, MIGRATIONS_SUBFOLDER,
      self.next_migration_number, migration_name ]
  end #next_migration_number

end #class


#
# Class: MigrationCreator
# 
# Generates schema migration files.
# 
# The <MigrationCreator::make_migration> method is the starting point for
# creating a migration file.  When the script is used from the command line,
# <MigrationCreator.main> is called, which parses the command-line arguments,
# creates an instance of the class, and calls `make_migration`.
# 
class MigrationCreator
  
  # Constant: MIGRATION_TEMPLATE
  # Path to the template file that will be used to generate the servlet.
  MIGRATION_TEMPLATE = I3::TEMPLATE_PATH + "/make-migration/migration.rb.erb"

  # Constant: ERR_NOTOOL
  # Message to display when the tool does not exist.
  ERR_NOTOOL =
    'The "%s" tool does not exist in i3-site or has not been set up properly.' +
    "\n" + 'Use the make-tool script to create the tool.'

  # Constant: WARN_NODATABASE
  # Message to display when a database has not been defined.
  WARN_NODATABASE =
    'WARNING: No database has been defined in "%s/meta/info.yml".' + "\n" +
    'You will not be able to run the migration scripts for this tool' + "\n" +
    'until the database has been specified in its info.yml file.'

  # Full path to the folder of migrations
  @migration_directory = nil

  #
  # Method: make_migration
  #
  # Creates a migration file from a template.
  # 
  # Hyphens are expected to separate words in `tool_dirname`.  Either hyphens
  # or underscores can be used for `migration_name`; hyphens in this case will
  # be converted to underscores to satisfy Active Record conventions.
  #
  # Parameters:
  #   tool_dirname - the directory name of the tool for which the new
  #     migration is being written
  #   migration_name - the name to give the new migration; the revision
  #     number will be prepended to this name
  # 
  # Returns:
  #   `true` if the migration step was created successfully,
  #   `false` if it was not
  #
  def make_migration(tool_dirname, migration_name)
  
    # Tool and migration names should be lowercase.
    # Migration names need to be underscore-separated.
    tool_dirname = tool_dirname.downcase
    migration_name = migration_name.downcase.gsub("-", "_")

    # Validate the tool (unless it's "common", which has its own defaults)
    unless tool_dirname == "common"

      # Make sure the tool exists.
      unless File.exists?("#{I3::SITE_PATH}/tools/#{tool_dirname}/meta/info.yml")
        STDERR.puts ERR_NOTOOL % tool_dirname
        return false
      end #unless
      tool = I3.config.tools[tool_dirname]
      if tool.nil?
        STDERR.puts ERR_NOTOOL % tool_dirname
        return false
      end #if

      # Warn if no database has been defined.
      STDERR.puts(WARN_NODATABASE % tool_dirname) if tool.database.nil?
      
    end #unless

    # Create a `MigrationFolder` instance for the tool.
    migration_folder = MigrationFolder.new(tool_dirname)

    # Load the template file and fill in the values.
    template = I3::Template.new(MIGRATION_TEMPLATE)
    migration_path = migration_folder.next_migration_path(migration_name)
    template["migration_path"] = migration_path[0..-4]  # Trim .rb extension
    template["migration_class_name"] = migration_name.camelize
    template["credit"]    = I3::CREDIT_STRING
    template["copyright"] = I3::COPYRIGHT_STRING
    template["version"]   = I3::VERSION_STRING
  
    # Write the template file to the target directory.
    template.save("#{I3::SITE_PATH}/tools/#{migration_path}")
    puts "- Generated i3-site/tools/#{migration_path}"

    return true
  end #def

  #
  # Method: dump_schema
  #
  # Outputs the Active Record schema definition for all tables in the
  # given tool.
  #
  # Parameters:
  #   tool_dirname - the directory name of the tool for which the schema
  #     should be written out
  #   stream - optional; the IO stream to which the data should be written.
  #     Defaults to standard output.
  # 
  # Returns:
  #   `true` if the schema dump succeeded, `false` if it did not
  #
  def dump_schema(tool_dirname, stream=STDOUT)

    # Retrieve the tool information from its config file and make sure
    # a database has been specified.  The "common" folder is not a tool,
    # and thus does not have a tool info file, so the default "i3" database
    # is supplied.
    if tool_dirname == "common" then tool_info = { "database" => "i3" }
    else tool_info = I3.config.tools[tool_dirname]
    end #if
    if tool_info.nil?
      STDERR.puts ERR_NOTOOL % tool_dirname
      return false
    end #if
    
    # Configure the data service that will be used to access the
    # schema information.
    data_service = I3.config.data_services["i3-migrate"]
    data_service = tool_info["data_service"] if tool_info["data_service"]
    if tool_info["database"]
      data_service["database"] = tool_info["database"]
    else
      STDERR.puts "A database must be specified in #{tool_name}/meta/info.yml"
      STDERR.puts "before a schema dump can be performed for this tool."
      return false
    end #if

    # Use the Active Record schema dumper to write to the stream.
    ActiveRecord::Base.establish_connection data_service
    ActiveRecord::SchemaDumper.dump(ActiveRecord::Base.connection, stream)

    return true
  end

  #
  # Class Method: main
  # 
  # Called when the script is run from the command line.
  # 
  # Parameters:
  #   args - the arguments supplied on the command line
  # 
  def self.main(args)
    if args.size == 2
      if args.delete("--dump-schema")
        self.new.dump_schema(args[0])
      else
        self.new.make_migration(args[0], args[1])
      end #if
    else
      puts 'Usage:  ruby %s tool-name migration-name' % __FILE__
      puts '        ruby %s --dump-schema tool-name' % __FILE__
    end #if
  end #self.main

end #class

MigrationCreator.main(ARGV) if __FILE__ == $0
