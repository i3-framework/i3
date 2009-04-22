#!/usr/bin/env ruby

# 
# == Objective-JS preprocessor
#
# Objective-JS is a set of extensions to JavaScript that make it somewhat
# easier to write modularized; object-oriented code that is easy to
# understand.  It adds several directives (all beginning with the @ sign)
# and one keyword.  It's called Objective-JS in reference to Objective-C,
# which started out as a preprocessor for C to make it easier to write
# object-oriented software.
#
# === Usage
#
# This file can either be used as a library or as a stand-alone script.
# To run as a script from the command line:
#
#   ruby objective-js.rb                     # Read from standard input
#   ruby objective-js.rb file.js             # Read an existing file
#   ruby objective-js.rb --compress file.js  # Apply source compression
#
# To use as a library:
#
#   processor = ObjectiveJS::Processor.new
#   processor.enable_compression
#   processor.process(File.read(filename))
#
# === Objective-JS Syntax
# 
#   // Place classes inside a module.
#   @module TimeTravel;
#
#   // Define a class.
#   @class Driver {
#
#     // Define private variables.
#     var _catchPhrase;
#
#     // Generate property get/set methods with private variables.
#     @property firstName, lastName;
#     
#     // Initialize the private variables.
#     @method initialize() {
#       _firstName = "Marty";
#       _lastName = "McFly";
#       _catchPhrase = "This is heavy!";
#     }
#
#     // Return a computed property.
#     @method getFullName() {
#       return self.getFirstName() + " " + self.getLastName();
#     }
#
#     // Call the initializer when the class is constructed.
#     self.initialize();
#   }
#
#   var user = new TimeTravel.Driver();
#
# === Modules
#
# The +@module+ directive begins a new module definition.  A module is
# used to provide classes with a namespace, reducing the possibility of
# name conflicts in large web applications.  Any class definitions following
# the +@module+ directive will be placed in the module.  If the +@module+
# directive is omitted, classes will be placed in the global namespace.  A
# module may be defined in more than one source file.
#
# Defining a module essentially creates an JavaScript object to which the
# class constructors will be assigned.  You can thus assign additional
# properties to the module if you want:
#
#   @module TimeTravel;
#   TimeTravel.GIGAWATTS_REQUIRED = 1.21;
#
# === Classes
#
# The +@class+ directive begins a new class definition.  Braces are used to
# open and close the definition.  The class will become part of the current
# module, if defined.
#
# Any code inside the class definition will be executed as the class is
# instantiated.  It's good practice to put initialization code in an
# "initialize" method (or equivalent) and call it at the end of the class
# definition, but it is by no means required.
#
# Additional parameters can be supplied to the class constructor by placing
# them after the name of the class:
#
#   @class Driver(firstName, lastName, catchPhrase) {
#     var _catchPhrase = catchPhrase;
#     @property firstName = firstName;
#     @property lastName = lastName;
#   }
#
# === Methods
#
# Methods are defined using the +@method+ directive.  They will automatically
# become members of the class in which they are defined.  The syntax follows
# that of function definitions, just replacing "function" with "@method".
#
# === Properties
#
# The +@property+ directive defines a private variable (with an underscore
# prefix) and a get/set pair of accessor methods.  You can specify multiple
# properties, separated by commas.
#
# In addition to the basic +@property+ directive, there are specific
# directives for read-only and write-only properties, called +@propertyReader+
# and +@propertyWriter+, respectively.  These will create the private variable
# and only one of the accessor methods.
#
#   @propertyReader vehicleMake = "DeLorean";
#   @propertyWriter blackHole;
#
# === The self keyword
#
# When a class is defined using the +@class+ directive, a variable is created
# called +self+ that refers to the class instance.  This is similar to the
# JavaScript "this" keyword, except it _always_ refers to the class instance,
# whereas "this" has some quirks with regards to inner functions.  Unless
# you know you want the behavior of "this", you'll probably want to use
# the +self+ keyword as a replacement.
#
# === Documentation
#
# Because of the new keywords, documentation tools like jsdoc will not be
# able to parse your source files.  To work around this, you can either
# process the file without compression and run the documentation tool on
# that, or (my preferred method) you can use a tool like NaturalDocs
# (<http://www.naturaldocs.org/>) that lets you specify the method and
# class names yourself.
#
# === To Do
#
# The handling of class inheritance has not yet been considered.  This is
# largely because the projects in which Objective-JS has been used so far
# have primarily used duck typing and composition.  Still, it would be a
# good thing to have for the sake of completion.
#
# === License
#
# Copyright (c) 2006 Marshall Elfstrand
#
# Permission is hereby granted, free of charge, to any person obtaining a
# copy of this software and associated documentation files (the "Software"),
# to deal in the Software without restriction, including without limitation
# the rights to use, copy, modify, merge, publish, distribute, sublicense,
# and/or sell copies of the Software, and to permit persons to whom the
# Software is furnished to do so, subject to the following conditions:
#
# The above copyright notice and this permission notice shall be included
# in all copies or substantial portions of the Software.
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
# OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL
# THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
# FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
# DEALINGS IN THE SOFTWARE.
#
# But hey, if you wanted to send me a gift certificate or something as
# a little "thank-you", I sure wouldn't mind.
#
# Main Page::  http://www.vengefulcow.com/objective-js
# Author::     Marshall Elfstrand <marshall@vengefulcow.com>
# Version::    1.0.1
# 

module ObjectiveJS
  
  class Processor
    
    #
    # Returns a new Objective-JS parser.
    #
    def initialize
      enable_applet(false)
      enable_compression(false)
    end #def

    #
    # Turns on source compression for the preprocessor.
    #
    # When this is enabled, comments and extra whitespace will be stripped
    # from the output.  This is not nearly as aggressive as some dedicated
    # JavaScript compression tools, and it doesn't use any obfuscation
    # techniques, but it's helpful for heavily-documented source nonetheless.
    #
    def enable_compression(value=true)
      @compression_enabled = (value.to_s.downcase == "true")
    end #def

    #
    # Returns +true+ if source compression has been enabled.
    # The default value is +false+.
    #
    def compression_enabled?
      return @compression_enabled
    end #def

    #
    # Turns on applet support for the preprocessor.
    #
    # This is used specifically with the framework that Objective-JS was
    # written for, and is not expected to have general application.
    # If enabled, the processor will look for either the +@applet+ keyword
    # or a class with the suffix "Applet", and it will add the following
    # line to the bottom of the output:
    #
    #   window.applet = AppletClassName;
    # 
    # where "AppletClassName" is the constructor for the discovered applet.
    #
    def enable_applet(value=true) #:nodoc:
      @applet_enabled = (value.to_s.downcase == "true")
    end #def

    #
    # Returns +true+ if applet support has been enabled.
    # The default value is +false+.
    #
    def applet_enabled? #:nodoc:
      return @applet_enabled
    end #def
    
    #
    # Processes Objective-JS source and outputs standard JavaScript code.
    # The +input+ can be either a string containing the source or an open
    # +IO+ stream (e.g. a +File+ object); if omitted, +$stdin+ will be used.
    # The +output+ should be an open +IO+ stream; if omitted, +$stdout+ will
    # be used.
    #
    def process(input=nil, output=nil)
      input = $stdin if input.nil?
      output = $stdout if output.nil?
      prefix = ""
      applet = ""
      applet_defined = (not applet_enabled?)
      text = (input.is_a? IO) ? input.read : input.to_s
      if compression_enabled?
        text.gsub!(%r'/[*].*?[*]/'m, "")  # Remove /*...*/ style comments
      end #if
      text.gsub!(%r'\n\s*\{'m, ' {')      # Move opening braces to same line
      text.split("\n").each do |line|
        if compression_enabled?
          line = " " + line               # Make sure comments match next rule
          line.sub!(%r'\s+//(.*)', "")    # Remove // style comments
          line.strip!                     # Remove extra whitespace
        end #if
        if (line.size > 0) or (compression_enabled? == false)
          case line

            # @module ModuleName;
            #   becomes
            # if (!window.ModuleName) var ModuleName = {};
            #
            when /^(\s*)@module (.*?)\s*;(.*)$/
              prefix = $2 + "."
              output.puts "#{$1}if (!window.#{$2}) var #{$2} = {};#{$3}"

            # @applet AppletName;
            #   overrides the default applet
            #
            when /^\s*@applet (.*?)\s*;(.*)$/
              applet = $1

            # @class ClassName(params)
            #   becomes
            # ModuleName.ClassName = function ClassName(params)
            #   and
            # var self = this;
            #
            when /^(\s*)@class (.*?)([\s\(]+.*?)\{(.*)$/
              if (applet.empty? and $2[-6..-1] == "Applet")
                applet = prefix + $2
              end #if
              params = $3.strip.empty? ? "()" : $3
              output.puts "#{$1}#{prefix}#{$2} = function #{$2}#{params} { " +
                "var self = this; #{$4}"

            # @method methodName(params)
            #   becomes
            # this.methodName = function methodName(params)
            #
            when /^(\s*)@method ([^\s\(\{]+)(.*)$/
              params = ($3[0..0] == "(" ? $3 : "()" + $3)
              output.puts "#{$1}this.#{$2} = function #{$2}#{params}"
            
            # @property propName [, ...]
            #   becomes
            # var _propName;
            # this.getPropName = function getPropName() { return _propName; }
            # this.setPropName = function setPropName(x) { _propName = x; }
            #
            when /^(\s*)@property(Reader |Writer | )(.*?)\s*;(.*)$/
              reader_enabled = ($2.strip.downcase != "writer")
              writer_enabled = ($2.strip.downcase != "reader")
              indent = $1
              $3.split(",").each do |prop|
                var_name, var_init = prop.split("=")
                var_name = "_" + var_name.strip
                var_init = var_init.nil? ? "" : " = " + var_init.strip
                output.puts "#{indent}var #{var_name}#{var_init};"
                if reader_enabled
                  meth_name = "get" + var_name[1..1].upcase + var_name[2..-1]
                  output.puts "#{indent}this.#{meth_name} = " +
                    "function #{meth_name}() { return #{var_name}; }"
                end #if
                if writer_enabled
                  meth_name = "set" + var_name[1..1].upcase + var_name[2..-1]
                  output.puts "#{indent}this.#{meth_name} = " +
                    "function #{meth_name}(x) { #{var_name} = x; }"
                end #if
              end #each

            # window.applet = ClassName
            #   sets applet_defined
            #
            when /^window\.applet\s*=\s*/
              applet_defined = true
              output.puts line

            else
              output.puts line

          end #case
        end #if
      end #each

      unless (applet.empty? or applet_defined)
        output.puts "window.applet = #{applet};"
      end #unless

    end #def

  end #class

  #
  # Provides a command-line interface to the Objective-JS preprocessor.
  #
  module CommandLineUI

    #
    # Displays usage information for the command-line interface.
    #
    def self.usage
      puts "Usage: #{$0} [--compress] [--output outfile.js] [infile.js]"
    end #def
  
    #
    # Parses the arguments and runs the processor.
    #
    def self.main(args)
      (usage; return) if args.include?("--help")
      input_file = nil
      output_file = nil
      processor = Processor.new
      if (opt_index = args.index("--compress"))
        processor.enable_compression
        args.delete_at(opt_index)
      end #if
      if (opt_index = args.index("--applet"))
        processor.enable_applet
        args.delete_at(opt_index)
      end #if
      if (opt_index = args.index("--output"))
        output_file = args[opt_index + 1]
        args.delete_at(opt_index + 1)
        args.delete_at(opt_index)
      end #if
      input_file = args[0] if args.length > 0
      istream = (input_file.nil? ? $stdin : File.new(input_file))
      ostream = (output_file.nil? ? $stdout : File.new(output_file, "w"))
      processor.process(istream, ostream)
      istream.close if istream.is_a? File
      ostream.close if ostream.is_a? File
    end #def

  end #module

end #module

ObjectiveJS::CommandLineUI.main(ARGV) if $0 == __FILE__
