#!/usr/bin/env ruby

#
# Helper Script: make-doc
#
# This script generates the i3 API documentation for both
# the JavaScript client and the Ruby web service framework.
#
# The generated files will be placed in i3-local/doc/.
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
#   $Id: make-doc.rb 50 2008-01-28 16:49:35Z nmellis $
#

require File.dirname(__FILE__) + "/include/script-common"

# Set up paths.
SRC_CODE_DIRS       = [ I3::ROOT_PATH + "/framework", I3::ROOT_PATH + "/tools" ]
SITE_SRC_CODE_DIRS  = [ I3::SITE_PATH + "/framework", I3::SITE_PATH + "/tools" ]
DEST_API_DIR        = I3::LOCAL_PATH + "/doc/api"
DEST_SITE_API_DIR   = I3::LOCAL_PATH + "/doc/site/api"
ND_PROJECT_DIR      = I3::LOCAL_PATH + "/doc/.nd"
ND_SITE_PROJECT_DIR = I3::LOCAL_PATH + "/doc/site/.nd"
ND_SCRIPT_DIR       = I3::LIB_PATH + "/naturaldocs"
TEMPLATE_DIR        = I3::TEMPLATE_PATH + "/make-doc"

#
# Module: APIDocGenerator
#
# Module for generating the documentation for the JavaScript client
# and Ruby server APIs.
#
module APIDocGenerator

  #
  # Method: APIDocGenerator.generate
  #
  # Generates the API documentation using NaturalDocs.
  #
  # Parameters:
  #   source_dirs - path (or paths) of the directories that will be scanned recursively
  #     for documentable source files
  #   dest_dir - path of the directory in which the generated HTML
  #     documentation will be placed
  #   template_dir - path of the directory from which the NaturalDocs
  #     project templates will be copied if they do not already exist
  #     in the project directory
  #   nd_dir - path of the directory containing the _NaturalDocs_ script
  #   project_dir - path of the directory that NaturalDocs will use
  #     for its project information
  #   force_rebuild - set to _true_ if the entire documentation tree
  #     should be rebuilt; otherwise NaturalDocs will only rebuild the
  #     changed files
  #   reset_project - set to _true_ if the NaturalDocs project files
  #     should be copied from the template directory, overwriting any
  #     changes that have been made in the project folder.  This
  #     causes a full rebuild as well.
  #
  def self.generate(source_dirs, dest_dir, template_dir, nd_dir, project_dir,
                    force_rebuild, reset_project)
    
    # Create directories and copy template files if necessary.
    templates = ["Default-i3.css", "Languages.txt", "Topics.txt"]
    
    begin
      FileUtils.mkdir_p dest_dir
      FileUtils.mkdir_p project_dir
      FileUtils.rm_r Dir[project_dir + "/*"] if reset_project
      templates.each do |template|
        unless File.exist? "#{project_dir}/#{template}"
          puts "Creating project file: " + template
          FileUtils.cp("#{template_dir}/nd-#{template}",
                       "#{project_dir}/#{template}")
        end #unless
      end #each
    rescue
      puts "ERROR: " + $!.to_s
      return false
    end
    
    # Run the NaturalDocs script.
    script_name = "NaturalDocs"
    script_name += ".bat" if (RUBY_PLATFORM =~ /mswin32/)
    args = []
    source_dirs.to_a.each { |path| args << '--input "%s"' % path }
    args << '--output HTML "%s"' % dest_dir
    args << '--project "%s"' % project_dir
    args << '--style Default Default-i3'
    args << "--rebuild" if force_rebuild
    return system('"%s/%s" %s' % [nd_dir, script_name, args.join(" ")])
    
  end #def
  
end #module


#
# Command-line interface for document generator.
#
module DocGeneratorCLI
  def self.main(args)

    # Set up hash of options.
    settings = args.inject(Hash.new) { |h, arg| h[arg.downcase] = true; h }
    did_something = false
    had_errors = false
    separator = "-" * 78

    if settings["api"] or settings["all"]
      puts separator
      puts "Generating API documentation using NaturalDocs..."
      force_rebuild = settings.include?("--force-rebuild")
      reset_project = settings.include?("--reset-project")
      include_site  = settings.include?("--include-site")
      
      result = APIDocGenerator.generate(SRC_CODE_DIRS, DEST_API_DIR, TEMPLATE_DIR, ND_SCRIPT_DIR, 
        ND_PROJECT_DIR, force_rebuild, reset_project)
      did_something = true
      had_errors = true if result == false
      
      if include_site
        puts
        puts "Building documentation for i3 Site ..."
        result = APIDocGenerator.generate(SITE_SRC_CODE_DIRS, DEST_SITE_API_DIR, TEMPLATE_DIR, 
          ND_SCRIPT_DIR, ND_SITE_PROJECT_DIR, force_rebuild, reset_project)
        did_something = true
        had_errors = true if result == false
      end #if
      
    end #if

    if did_something
      puts separator
      msg = had_errors ? " with errors" : ""
      puts "Process completed%s." % msg
    else
      puts "Usage:"
      puts "  ruby make-doc.rb api"
      puts "API Options:"
      puts "  --force-rebuild   Re-generate all documentation"
      puts "  --reset-project   Revert to default NaturalDocs project files"
      puts "  --include-site    Build documentation for i3 Site if present"
    end #if

  end #def
end #module

DocGeneratorCLI.main(ARGV) if $0 == __FILE__
