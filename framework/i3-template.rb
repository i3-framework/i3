#
# File: framework/i3-template
#
# Provides a simple way of generating text from templates.
#
# *Usage*
#
# The <I3::Template> class loads `ERB`-formatted template files and
# renders them.  A template is a text file that can contain virtually
# any information -- HTML, JavaScript, Markdown, etc. -- but has special
# "tags" that contain Ruby code to either execute or display.  The
# concept and markup are similar to PHP and ASP.
#
# The `<% ... %>` syntax is used in the template to embed Ruby code that
# will be executed, such as `for` loops.  The `<%= ... %>` syntax is used
# to output an expression.
#
# A template file might look something like
# this:
#
# (start example)
#   <html>
#     <head>
#       <title><%= title %></title>
#     </head>
#     <body>
#       <p>
#         Hello there, <%= first_name + " " + last_name %>!
#         These are a few of my favorite things:
#       </p>
#       <ul>
#       <% for thing in favorite_things %>
#         <li><%= thing %></li>
#       <% end #for %>
#       </ul>
#     </body>
#   </html>
# (end example)
#
# To use a template, create an instance of the <I3::Template> class,
# providing the path to the template file as the argument to the
# <I3::Template::new> method.  Then set the template parameters using the
# familiar hash syntax.  Once the parameters have been set, the template
# can be rendered into a string by calling the <I3::Template::render> method.
# For example:
#
# (start example)
#   SAMPLE_PATH = I3.resource("sample/data/templates/hello.rhtml")
#   template = I3::Template.new(SAMPLE_PATH)
#   template["title"] = "The Sound of Templates"
#   template["first_name"] = "Maria"
#   template["last_name"] = "von Trapp"
#   template["favorite_things"] = [ "Ruby", "JavaScript", "HTML", "CSS" ]
#   I3.server.send_header(:type => "text/html")
#   I3.server.send_bytes(template.render)
# (end example)
#
# Template parameters can be provided either as strings or as symbols.
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
#   $Id: i3-template.rb 2 2007-12-06 00:18:23Z melfstrand $
#

require "erb"
require "ostruct"

#
# Module: I3
#
# Module containing class definitions and data shared by all
# intranet applications.
#
module I3

  #
  # Class: I3::Template
  #
  # Loads and renders a template file using values supplied via hash notation.
  #
  class Template

    #
    # Constructor: new
    #
    # Returns a new template instance.
    #
    # Parameters:
    #   template_file - the path to the template file that will be
    #     rendered when `render` is called
    #   preload_attrs - optional; a `Hash` of attributes to pre-load into
    #     the template
    #
    def initialize(template_file, preload_attrs={})
      @template = ERB.new(File.read(template_file), nil, "%<>")
      @binding = TemplateBinding.new
      preload_attrs.each { |k, v| self[k] = v }
    end #def

    #
    # Method: []
    #
    # Returns the bound template value for the given key.
    #
    def [](key)
      return @binding.send(key.to_s, value)
    end #def
  
    #
    # Method: []=
    #
    # Sets the bound template value for the given key.
    #
    def []=(key, value)
      @binding.send(key.to_s + "=", value)
    end #def

    #
    # Method: render
    #
    # Renders the template using the bound values.
    #
    # Returns:
    #   The rendered template as a string.
    #
    def render
      return @template.result(@binding._binding)
    end #def

    #
    # Method: save
    #
    # Renders the template and writes it to a file.
    #
    # Parameters:
    #   path - the file path to which the output will be saved
    #
    def save(path)
      File.open(path, "w") { |outfile| outfile.print self.render }
    end #def

  end #class


  #
  # Private Class: TemplateBinding
  #
  # Contains the variables that are passed to the template.
  #
  class TemplateBinding < OpenStruct
  
    #
    # Method (Hidden): _binding
    #
    # Provides access to the normally private `binding` attribute that
    # all objects have.
    #
    def _binding
      return binding
    end #def
  
  end #class
  
end #module
